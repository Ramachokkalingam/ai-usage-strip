/* AI Usage Strip — toolbar popup: every site at a glance. */
(function () {
  'use strict';
  const api = AUS.api;
  const esc = AUS.escape;
  const SEG = 20;
  const $ = (id) => document.getElementById(id);

  const data = { settings: AUS.defaultSettings(), events: {}, live: {}, limitHits: {} };
  let currentSite = null;

  async function load() {
    const d = await api.storage.local.get(['settings', 'events', 'live', 'limitHits']);
    data.settings = AUS.mergeSettings(d.settings);
    data.events = d.events || {};
    data.live = d.live || {};
    data.limitHits = d.limitHits || {};
  }

  function meter(pct, state) {
    const on = pct == null ? 0 : Math.max(pct > 0 ? 1 : 0, Math.round((pct / 100) * SEG));
    let html = '';
    for (let i = 0; i < SEG; i++) html += `<i class="${i < on ? 'on' : ''}"></i>`;
    return `<div class="meter" data-state="${state}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct || 0)}">${html}</div>`;
  }

  function row(id) {
    const site = AUS.SITES[id];
    const cfg = data.settings.sites[id];
    const now = Date.now();
    const stats = AUS.computeStats(id, cfg, data.events[id], data.live[id], data.limitHits[id], now);
    const { plan, messages } = stats;
    const classes = ['site'];
    if (id === currentSite) classes.push('current');
    const name = `<button class="name" type="button" data-open="${id}" title="Open ${esc(site.name)}">${esc(site.name)}</button>`;

    if (!cfg.enabled) {
      classes.push('off', 'idle');
      return `<li class="${classes.join(' ')}" style="--site:${site.color}"><div class="head"><span class="dot"></span>${name}<span class="pct muted">Off</span></div></li>`;
    }
    if (plan.source !== 'live' && messages.week === 0 && !plan.limited) {
      classes.push('idle');
      return `<li class="${classes.join(' ')}" style="--site:${site.color}"><div class="head"><span class="dot"></span>${name}<span class="pct muted">No messages this week</span></div></li>`;
    }

    let pct;
    if (plan.limited) pct = '<span class="pct limited">Limit reached</span>';
    else if (plan.pct == null) pct = '<span class="pct muted">No cap tracked</span>';
    else pct = `<span class="pct" title="${plan.source === 'live' ? 'Live' : 'Estimated'}">${plan.source === 'estimate' ? '~' : ''}${Math.round(plan.pct)}%</span>`;

    let reset;
    if (plan.resetAt && plan.resetAt > now) {
      reset = `${plan.resetKind === 'frees' ? 'Slot frees in' : 'Resets in'} <b>${AUS.fmtDuration(plan.resetAt - now)}</b>`;
    } else {
      reset = plan.source === 'none' ? `${messages.week} this week` : 'Full allowance';
    }

    const weekly = plan.source === 'live' && plan.windows.find((w) => w.key === 'seven_day');
    const weekLine =
      weekly && plan.label !== weekly.label
        ? `<div class="week">Weekly <b>${Math.round(weekly.pct)}%</b>${weekly.resetsAt ? `, resets ${esc(AUS.fmtClock(weekly.resetsAt, now))}` : ''}</div>`
        : '';

    const of = plan.pct == null ? '' : `of ${esc(plan.label)} limit, `;
    return `<li class="${classes.join(' ')}" style="--site:${site.color}" aria-label="${esc(site.name)}: ${plan.pct == null ? 'no cap tracked' : `${Math.round(plan.pct)}% ${of}`}${messages.today} sent today">
      <div class="head"><span class="dot"></span>${name}${pct}</div>
      ${meter(plan.pct, plan.state)}
      <div class="meta"><span>${reset}</span><span><b>${messages.today}</b> sent today</span></div>
      ${weekLine}
    </li>`;
  }

  function render() {
    $('showStrip').checked = !!data.settings.global.showStrip;
    const order = AUS.SITE_ORDER.slice();
    if (currentSite) order.sort((a, b) => (a === currentSite ? -1 : b === currentSite ? 1 : 0));
    $('sites').innerHTML = order.map(row).join('');
  }

  async function checkAccess() {
    if (!api.permissions || !api.permissions.contains) return;
    try {
      const ok = await api.permissions.contains({ origins: AUS.HOST_PATTERNS });
      $('grant').hidden = ok;
    } catch (e) {
      $('grant').hidden = true;
    }
  }

  async function init() {
    await load();
    try {
      const [tab] = await api.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) currentSite = AUS.detectSite(new URL(tab.url).hostname);
    } catch (e) {
      currentSite = null;
    }
    render();
    checkAccess();
    setInterval(render, 15000);
  }

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.settings) data.settings = AUS.mergeSettings(changes.settings.newValue);
    if (changes.events) data.events = changes.events.newValue || {};
    if (changes.live) data.live = changes.live.newValue || {};
    if (changes.limitHits) data.limitHits = changes.limitHits.newValue || {};
    render();
  });

  $('showStrip').addEventListener('change', async (e) => {
    data.settings.global.showStrip = e.target.checked;
    await api.storage.local.set({ settings: data.settings });
  });

  $('sites').addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]');
    if (!b) return;
    api.tabs.create({ url: AUS.SITES[b.getAttribute('data-open')].url });
    window.close();
  });

  $('starLink').addEventListener('click', (e) => {
    e.preventDefault();
    api.tabs.create({ url: e.currentTarget.href });
    window.close();
  });

  $('openOptions').addEventListener('click', () => {
    api.runtime.openOptionsPage();
    window.close();
  });

  $('refresh').addEventListener('click', async () => {
    const btn = $('refresh');
    btn.disabled = true;
    btn.textContent = 'Refreshing…';
    const res = await api.runtime.sendMessage({ type: 'refreshLive' }).catch(() => null);
    btn.textContent = res && res.tabs ? 'Refreshed' : 'Open claude.ai first';
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'Refresh Claude';
    }, 2200);
  });

  $('grantBtn').addEventListener('click', async () => {
    try {
      const ok = await api.permissions.request({ origins: AUS.HOST_PATTERNS });
      $('grant').hidden = ok;
    } catch (e) {
      /* user dismissed */
    }
  });

  init();
})();
