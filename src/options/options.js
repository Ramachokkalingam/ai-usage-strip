/* AI Usage Strip — settings page. Saves as you change things. */
(function () {
  'use strict';
  const api = AUS.api;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  let settings = AUS.defaultSettings();
  let saveTimer = null;
  let savedTimer = null;

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      await api.storage.local.set({ settings });
      const el = $('#saved');
      el.textContent = 'Saved';
      el.style.opacity = '1';
      clearTimeout(savedTimer);
      savedTimer = setTimeout(() => (el.style.opacity = '0'), 1600);
    }, 250);
  }

  // ---------- strip section ----------

  function bindGlobal() {
    const g = settings.global;
    $$('[data-g]').forEach((input) => {
      const key = input.getAttribute('data-g');
      input.checked = !!g[key];
      input.addEventListener('change', () => {
        g[key] = input.checked;
        save();
      });
    });
    $$('[data-sec]').forEach((input) => {
      const key = input.getAttribute('data-sec');
      input.checked = !!g.sections[key];
      input.addEventListener('change', () => {
        g.sections[key] = input.checked;
        save();
      });
    });
    ['placement', 'density', 'theme'].forEach((name) => {
      $$(`input[name="${name}"]`).forEach((r) => {
        r.checked = r.value === g[name];
        r.addEventListener('change', () => {
          if (r.checked) {
            g[name] = r.value;
            save();
          }
        });
      });
    });
  }

  // ---------- sites section ----------

  function matchingPreset(id, cfg) {
    const presets = AUS.SITES[id].presets;
    for (const key of Object.keys(presets)) {
      const p = presets[key];
      if (Number(p.limit) === Number(cfg.limit) && p.windowType === cfg.windowType && Number(p.windowHours) === Number(cfg.windowHours)) return key;
    }
    return 'custom';
  }

  function hourLabel(h) {
    const d = new Date();
    d.setHours(h, 0, 0, 0);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function renderSite(id) {
    const site = AUS.SITES[id];
    const cfg = settings.sites[id];
    const node = $('#siteTpl').content.firstElementChild.cloneNode(true);
    node.style.setProperty('--site', site.color);
    node.dataset.site = id;
    $('h3', node).textContent = site.name;
    const open = $('.open', node);
    open.href = site.url;
    open.setAttribute('aria-label', `Open ${site.name}`);

    const preset = $('[data-k="preset"]', node);
    for (const key of Object.keys(site.presets)) preset.add(new Option(site.presets[key].label, key));
    preset.add(new Option('Custom', 'custom'));

    const resetHour = $('[data-k="resetHour"]', node);
    for (let h = 0; h < 24; h++) resetHour.add(new Option(hourLabel(h), String(h)));

    if (site.live) $('.live-row', node).hidden = false;

    const fill = () => {
      node.classList.toggle('off', !cfg.enabled);
      $$('[data-k]', node).forEach((input) => {
        const k = input.getAttribute('data-k');
        if (input.type === 'checkbox') input.checked = !!cfg[k];
        else input.value = cfg[k];
      });
      preset.value = matchingPreset(id, cfg);
      const daily = cfg.windowType === 'daily';
      $('[data-show="hours"]', node).hidden = daily;
      $('[data-show="daily"]', node).hidden = !daily;
    };

    node.addEventListener('change', (e) => {
      const input = e.target.closest('[data-k]');
      if (!input) return;
      const k = input.getAttribute('data-k');
      if (k === 'preset') {
        const p = site.presets[input.value];
        if (p) Object.assign(cfg, { preset: input.value, limit: p.limit, windowType: p.windowType, windowHours: p.windowHours });
        else cfg.preset = 'custom';
      } else if (input.type === 'checkbox') {
        cfg[k] = input.checked;
      } else if (input.type === 'number') {
        const v = Number(input.value);
        if (!Number.isFinite(v) || v < Number(input.min || 0)) {
          input.value = cfg[k];
          return;
        }
        cfg[k] = v;
      } else if (k === 'resetHour') {
        cfg[k] = Number(input.value);
      } else {
        cfg[k] = input.value;
        if (k === 'windowType' && input.value === 'daily') cfg.windowHours = 24;
      }
      if (k !== 'preset' && ['limit', 'windowType', 'windowHours'].includes(k)) cfg.preset = matchingPreset(id, cfg);
      fill();
      save();
    });

    fill();
    return node;
  }

  function renderSites() {
    const wrap = $('#sites');
    wrap.textContent = '';
    AUS.SITE_ORDER.forEach((id) => wrap.appendChild(renderSite(id)));
  }

  // ---------- data ----------

  $('#export').addEventListener('click', async () => {
    const all = await api.storage.local.get(null);
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...all }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ai-usage-strip-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });

  $('#clear').addEventListener('click', async () => {
    if (!confirm('Clear all message history and limit alerts? Your settings stay as they are.')) return;
    await api.runtime.sendMessage({ type: 'resetHistory' });
    const el = $('#saved');
    el.textContent = 'History cleared';
    el.style.opacity = '1';
    setTimeout(() => (el.style.opacity = '0'), 1800);
  });

  // ---------- welcome + permissions ----------

  async function checkAccess() {
    if (!api.permissions || !api.permissions.contains) return true;
    try {
      return await api.permissions.contains({ origins: AUS.HOST_PATTERNS });
    } catch (e) {
      return true;
    }
  }

  async function initWelcome() {
    const welcome = new URLSearchParams(location.search).has('welcome');
    const granted = await checkAccess();
    if (welcome || !granted) $('#welcome').hidden = false;
    $('#grantWrap').hidden = granted;
    $('#grantBtn').addEventListener('click', async () => {
      try {
        const ok = await api.permissions.request({ origins: AUS.HOST_PATTERNS });
        $('#grantWrap').hidden = ok;
      } catch (e) {
        /* dismissed */
      }
    });
  }

  async function init() {
    const d = await api.storage.local.get('settings');
    settings = AUS.mergeSettings(d.settings);
    $('#version').textContent = 'v' + api.runtime.getManifest().version;
    bindGlobal();
    renderSites();
    initWelcome();
  }

  init();
})();
