/*
 * AI Usage Strip — background.
 * Chromium runs this as a service worker (core.js is pulled in with importScripts);
 * Firefox runs it as an event page with core.js listed first in background.scripts.
 * All writes go through here so several open tabs can't overwrite each other's history.
 */
/* global importScripts */
if (typeof importScripts === 'function' && !self.AUS) {
  importScripts('shared/core.js');
}

const api = globalThis.browser || globalThis.chrome;
const KEEP_MS = 8 * AUS.TIME.DAY;

let queue = Promise.resolve();
function serial(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

api.runtime.onInstalled.addListener(async (details) => {
  const { settings } = await api.storage.local.get('settings');
  await api.storage.local.set({ settings: AUS.mergeSettings(settings) });
  if (details.reason === 'install') {
    api.tabs.create({ url: api.runtime.getURL('options/options.html?welcome=1') });
  }
});

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handle(msg || {}, sender).then(
    (res) => sendResponse(res || { ok: true }),
    (err) => sendResponse({ ok: false, error: String((err && err.message) || err) })
  );
  return true;
});

async function handle(msg, sender) {
  const site = msg.site;
  switch (msg.type) {
    case 'sent':
      if (!AUS.SITES[site]) return { ok: false };
      return serial(async () => {
        const now = Date.now();
        const { events = {} } = await api.storage.local.get('events');
        const list = (events[site] || []).filter((t) => t > now - KEEP_MS);
        list.push(Number(msg.at) || now);
        events[site] = list;
        await api.storage.local.set({ events });
        return { ok: true };
      });

    case 'live':
      if (!AUS.SITES[site] || !msg.data) return { ok: false };
      return serial(async () => {
        const { live = {} } = await api.storage.local.get('live');
        if (msg.data.ok) {
          live[site] = { windows: msg.data.windows, fetchedAt: msg.data.fetchedAt || Date.now(), lastError: null };
        } else {
          live[site] = { ...(live[site] || {}), lastError: msg.data.error || 'Unknown error', lastAttemptAt: Date.now() };
        }
        await api.storage.local.set({ live });
        return { ok: true };
      });

    case 'limitHit':
      return serial(async () => {
        const { limitHits = {} } = await api.storage.local.get('limitHits');
        const prev = limitHits[site];
        if (prev && Date.now() - prev.at < 10 * AUS.TIME.MIN) return { ok: true };
        limitHits[site] = { at: Date.now(), text: String(msg.text || '').slice(0, 200) };
        await api.storage.local.set({ limitHits });
        return { ok: true };
      });

    case 'clearLimit':
      return serial(async () => {
        const { limitHits = {} } = await api.storage.local.get('limitHits');
        delete limitHits[site];
        await api.storage.local.set({ limitHits });
        return { ok: true };
      });

    case 'resetHistory':
      return serial(async () => {
        await api.storage.local.set({ events: {}, limitHits: {}, live: {} });
        return { ok: true };
      });

    case 'openOptions':
      await api.runtime.openOptionsPage();
      return { ok: true };

    case 'refreshLive': {
      // Ask every open claude.ai tab to re-read live usage with its own session.
      const tabs = await api.tabs.query({ url: ['https://claude.ai/*'] });
      await Promise.all(tabs.map((t) => api.tabs.sendMessage(t.id, { type: 'refreshLive' }).catch(() => {})));
      return { ok: true, tabs: tabs.length };
    }

    case 'badge': {
      const tabId = sender && sender.tab && sender.tab.id;
      if (tabId == null) return { ok: false };
      const { settings } = await api.storage.local.get('settings');
      const show = AUS.mergeSettings(settings).global.badge;
      const text = show ? String(msg.text || '') : '';
      try {
        await api.action.setBadgeText({ tabId, text });
        if (text) {
          await api.action.setBadgeBackgroundColor({ tabId, color: msg.color || '#23966A' });
          if (api.action.setBadgeTextColor) await api.action.setBadgeTextColor({ tabId, color: '#FFFFFF' });
        }
      } catch (e) {
        /* tab closed */
      }
      return { ok: true };
    }

    default:
      return { ok: false, error: 'Unknown message' };
  }
}
