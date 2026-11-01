/*
 * AI Usage Strip — content controller.
 * Finds the chat box, keeps the strip mounted above it through the site's re-renders,
 * counts the messages you send, estimates context size and reads Claude's live usage.
 */
(function (root) {
  'use strict';
  const AUS = root.AUS;
  const api = AUS && AUS.api;
  if (!AUS || !api || root.__ausStripLoaded) return;

  const siteId = AUS.detectSite(location.hostname);
  if (!siteId) return;
  root.__ausStripLoaded = true;

  const site = AUS.SITES[siteId];
  const adapter = AUS.ADAPTERS[siteId] || {};

  const state = {
    settings: AUS.defaultSettings(),
    events: [],
    live: null,
    hit: null,
    ctx: { tokens: 0, draft: 0 },
    composer: null,
    anchor: null,
    theme: 'light',
    themeAt: 0
  };
  let strip = null;
  let alive = true;
  let lastSend = 0;
  let lastBadge = '';

  // ---------- messaging ----------

  function contextAlive() {
    try {
      return !!(api.runtime && api.runtime.id);
    } catch (e) {
      return false;
    }
  }

  function send(msg) {
    if (!contextAlive()) {
      teardown();
      return Promise.resolve(null);
    }
    try {
      return Promise.resolve(api.runtime.sendMessage(msg)).catch(() => null);
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  // ---------- storage ----------

  function apply(d) {
    if ('settings' in d) state.settings = AUS.mergeSettings(d.settings);
    if ('events' in d) state.events = ((d.events || {})[siteId] || []).slice();
    if ('live' in d) state.live = (d.live || {})[siteId] || null;
    if ('limitHits' in d) state.hit = (d.limitHits || {})[siteId] || null;
  }

  api.storage.local.get(['settings', 'events', 'live', 'limitHits']).then((d) => {
    apply(d);
    start();
  });

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !alive) return;
    const d = {};
    for (const k of Object.keys(changes)) d[k] = changes[k].newValue;
    apply(d);
    if ('settings' in d) {
      state.themeAt = 0;
      ensureMounted(true);
    }
    render();
  });

  api.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'refreshLive') refreshLive(true);
  });

  // ---------- helpers ----------

  const timers = {};
  function throttle(key, ms, fn) {
    if (timers[key]) return;
    timers[key] = setTimeout(() => {
      timers[key] = null;
      if (alive) fn();
    }, ms);
  }

  function cfg() {
    return state.settings.sites[siteId];
  }

  function luminance(rgb) {
    const m = String(rgb).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (a < 0.5) return null;
    const lin = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  function resolveTheme() {
    const pref = state.settings.global.theme;
    if (pref === 'light' || pref === 'dark') return pref;
    const now = Date.now();
    if (now - state.themeAt < 2000) return state.theme;
    state.themeAt = now;
    let el = state.anchor || document.body;
    let lum = null;
    while (el && el.nodeType === 1 && lum === null) {
      lum = luminance(getComputedStyle(el).backgroundColor);
      el = el.parentElement;
    }
    if (lum === null) lum = root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches ? 0 : 1;
    state.theme = lum < 0.4 ? 'dark' : 'light';
    return state.theme;
  }

  // ---------- mounting ----------

  function findComposer() {
    let c = null;
    try {
      c = adapter.composer ? adapter.composer() : null;
    } catch (e) {
      c = null;
    }
    return c || AUS.genericComposer();
  }

  function climb(c) {
    const w = c.getBoundingClientRect().width;
    let el = c;
    for (let i = 0; i < 8; i++) {
      const p = el.parentElement;
      if (!p || p === document.body || p === document.documentElement) break;
      if (p.getBoundingClientRect().width > w * 1.35 + 48) break;
      el = p;
    }
    return el;
  }

  function findAnchor(c) {
    let a = null;
    try {
      a = adapter.anchor ? adapter.anchor(c) : null;
    } catch (e) {
      a = null;
    }
    if (a && a.getBoundingClientRect().width > 0) return a;
    return c.closest('form') || climb(c);
  }

  function insertInline() {
    const a = state.anchor;
    const parent = a && a.parentElement;
    if (!parent) return false;
    const cs = getComputedStyle(parent);
    const rowFlex = /flex/.test(cs.display) && !/column/.test(cs.flexDirection);
    if (rowFlex || /grid/.test(cs.display)) return false;
    strip.setMode('inline');
    parent.insertBefore(strip.host, a);
    return true;
  }

  function setFloating() {
    strip.setMode('floating');
    if (strip.host.parentElement !== document.documentElement) document.documentElement.appendChild(strip.host);
  }

  function inlineLooksRight() {
    if (!strip || strip.mode !== 'inline' || !state.anchor) return true;
    const h = strip.host.getBoundingClientRect();
    const a = state.anchor.getBoundingClientRect();
    if (h.width < 160 || h.height === 0) return false;
    if (h.bottom > a.top + 8 || a.top - h.bottom > 60) return false;
    const x = Math.min(innerWidth - 1, Math.max(0, h.left + 40));
    const y = Math.min(innerHeight - 1, Math.max(0, h.bottom - 8));
    const hit = document.elementFromPoint(x, y);
    return !hit || hit === strip.host || strip.host.contains(hit);
  }

  function ensureMounted(force) {
    if (!alive) return;
    const g = state.settings.global;
    if (!g.showStrip || !cfg().enabled) {
      if (strip) strip.host.remove();
      updateBadge(null);
      return;
    }
    const c = findComposer();
    if (!c) {
      if (strip && strip.mode === 'floating') strip.host.hidden = true;
      return;
    }
    if (strip) strip.host.hidden = false;

    const placedOk =
      strip &&
      strip.host.isConnected &&
      c === state.composer &&
      state.anchor &&
      state.anchor.isConnected &&
      (strip.mode === 'floating' ? g.placement !== 'inline' : g.placement !== 'floating' && strip.host.nextElementSibling === state.anchor);
    if (placedOk && !force) return;

    state.composer = c;
    state.anchor = findAnchor(c);
    if (!strip) {
      strip = new AUS.Strip({
        onSettings: () => send({ type: 'openOptions' }),
        onRefresh: () => refreshLive(true),
        onClearLimit: () => {
          state.hit = null;
          render();
          send({ type: 'clearLimit', site: siteId });
        },
        onResize: () => layout()
      });
      watchResize();
    }

    if (g.placement === 'floating' || !insertInline()) setFloating();
    render();
    layout();
    if (g.placement === 'auto' && strip.mode === 'inline') {
      requestAnimationFrame(() => {
        if (!inlineLooksRight()) {
          setFloating();
          layout();
        }
      });
    }
    computeContext();
  }

  function layout() {
    if (!strip || !state.anchor || !strip.host.isConnected) return;
    const host = strip.host;
    const a = state.anchor.getBoundingClientRect();
    if (strip.mode === 'inline') {
      host.style.width = `${Math.round(a.width)}px`;
      host.style.marginLeft = '0px';
      const h = host.getBoundingClientRect();
      const dx = Math.round(a.left - h.left);
      if (dx) host.style.marginLeft = `${dx}px`;
      return;
    }
    if (!state.anchor.isConnected || a.width === 0 || a.bottom < 0 || a.top > innerHeight) {
      host.style.visibility = 'hidden';
      return;
    }
    host.style.visibility = '';
    host.style.left = `${Math.round(a.left)}px`;
    host.style.width = `${Math.round(a.width)}px`;
    host.style.top = `${Math.max(4, Math.round(a.top - host.offsetHeight - 6))}px`;
  }

  let ro = null;
  function watchResize() {
    const schedule = () => throttle('layout', 60, layout);
    if (root.ResizeObserver) {
      ro = new ResizeObserver(schedule);
      ro.observe(document.documentElement);
    }
    root.addEventListener('resize', schedule, { passive: true });
    root.addEventListener('scroll', schedule, { passive: true, capture: true });
    // Floating mode: the chat box can move without resizing (sidebar toggles, banners).
    setInterval(() => {
      if (alive && strip && strip.mode === 'floating' && document.visibilityState === 'visible') layout();
    }, 700);
  }

  // ---------- rendering ----------

  function render() {
    if (!strip || !alive) return;
    const c = cfg();
    const stats = AUS.computeStats(siteId, c, state.events, state.live, state.hit);
    strip.update({
      siteId,
      site,
      cfg: c,
      global: state.settings.global,
      stats,
      live: state.live,
      canRefresh: !!adapter.fetchLive && c.useLive,
      ctx: { ...state.ctx, limit: Number(c.contextTokens) || site.contextTokens },
      theme: resolveTheme()
    });
    updateBadge(stats);
    if (strip.mode === 'floating') throttle('layout', 30, layout);
  }

  function updateBadge(stats) {
    let text = '';
    let color = '#23966A';
    if (stats && stats.plan.pct != null) {
      text = stats.plan.limited ? '!' : `${Math.round(stats.plan.pct)}%`;
      const s = stats.plan.state;
      color = s === 'hot' || s === 'limited' ? '#D2453A' : s === 'warn' ? '#B57A0C' : '#23966A';
    }
    const key = text + color;
    if (key === lastBadge) return;
    lastBadge = key;
    send({ type: 'badge', text, color });
  }

  // ---------- context estimate ----------

  function computeContext() {
    const draftText = AUS.composerText(state.composer);
    let text = '';
    let nodes = [];
    if (adapter.messages) {
      try {
        nodes = Array.from(document.querySelectorAll(adapter.messages));
      } catch (e) {
        nodes = [];
      }
    }
    if (nodes.length) {
      const parts = [];
      for (const n of nodes) {
        if (n.parentElement && n.parentElement.closest(adapter.messages)) continue;
        parts.push(n.textContent || '');
      }
      text = parts.join('\n');
    } else {
      const area = document.querySelector('main') || document.body;
      text = area.textContent || '';
      if (state.composer && area.contains(state.composer)) text = text.replace(draftText, '');
    }
    const next = { tokens: AUS.estimateTokens(text), draft: AUS.estimateTokens(draftText) };
    if (next.tokens !== state.ctx.tokens || next.draft !== state.ctx.draft) {
      state.ctx = next;
      render();
    }
  }

  // ---------- sends and limits ----------

  function inComposer(target) {
    const c = state.composer;
    return !!(c && target && (c === target || c.contains(target)));
  }

  function recordSend() {
    const now = Date.now();
    if (now - lastSend < 1500) return;
    lastSend = now;
    state.events = state.events.concat(now);
    render();
    send({ type: 'sent', site: siteId, at: now });
    if (adapter.fetchLive) {
      setTimeout(() => refreshLive(true), 6000);
      setTimeout(() => refreshLive(true), 30000);
    }
    throttle('ctx', 2500, computeContext);
  }

  function onKeydown(e) {
    if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.isComposing || e.keyCode === 229) return;
    if (!inComposer(e.target)) return;
    if (!AUS.composerText(state.composer).trim()) return;
    recordSend();
  }

  function onClick(e) {
    const t = e.target;
    const btn = t && t.closest && t.closest('button, [role="button"]');
    if (!btn) return;
    const composer = state.composer || findComposer();
    if (!composer || !AUS.composerText(composer).trim()) return;
    if (AUS.looksLikeSend(btn, composer)) recordSend();
  }

  function scanForLimit(mutations) {
    let checked = 0;
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1 || checked > 60) continue;
        checked++;
        const txt = n.textContent || '';
        if (txt.length < 16 || txt.length > 500) continue;
        if (adapter.messages && n.closest && n.closest(adapter.messages)) continue;
        if (inComposer(n)) continue;
        if (AUS.LIMIT_RE.test(txt)) {
          state.hit = { at: Date.now() };
          render();
          send({ type: 'limitHit', site: siteId, text: txt.trim() });
          return;
        }
      }
    }
  }

  // ---------- live usage (Claude) ----------

  let liveBusy = false;
  let liveAt = 0;
  async function refreshLive(force) {
    if (!adapter.fetchLive || !cfg().useLive || liveBusy || !alive) return;
    if (!force && Date.now() - liveAt < 20000) return;
    liveBusy = true;
    liveAt = Date.now();
    try {
      const windows = await adapter.fetchLive();
      state.live = { windows, fetchedAt: Date.now(), lastError: null };
      send({ type: 'live', site: siteId, data: { ok: true, windows, fetchedAt: state.live.fetchedAt } });
    } catch (e) {
      const error = String((e && e.message) || e);
      state.live = { ...(state.live || {}), lastError: error };
      send({ type: 'live', site: siteId, data: { ok: false, error } });
    } finally {
      liveBusy = false;
      render();
    }
  }

  // ---------- lifecycle ----------

  let mo = null;
  const intervals = [];

  function start() {
    document.addEventListener('keydown', onKeydown, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener(
      'input',
      (e) => {
        if (inComposer(e.target)) throttle('draft', 500, computeContext);
      },
      true
    );

    mo = new MutationObserver((muts) => {
      throttle('mount', 350, () => ensureMounted(false));
      throttle('ctx', 1500, computeContext);
      scanForLimit(muts);
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });

    intervals.push(setInterval(() => document.visibilityState === 'visible' && render(), 15000));
    if (adapter.fetchLive) {
      intervals.push(setInterval(() => document.visibilityState === 'visible' && refreshLive(false), 90000));
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && refreshLive(false));
      refreshLive(true);
    }
    ensureMounted(true);
  }

  function teardown() {
    if (!alive) return;
    alive = false;
    if (mo) mo.disconnect();
    if (ro) ro.disconnect();
    intervals.forEach(clearInterval);
    document.removeEventListener('keydown', onKeydown, true);
    document.removeEventListener('click', onClick, true);
    if (strip) strip.destroy();
    root.__ausStripLoaded = false;
  }
})(globalThis);
