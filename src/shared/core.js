/*
 * AI Usage Strip — shared data model.
 * Loaded by the background worker, the content scripts, the popup and the settings page,
 * so everything here must run without the DOM.
 */
(function (root) {
  'use strict';

  const AUS = root.AUS || (root.AUS = {});
  const MIN = 60 * 1000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  AUS.TIME = { MIN, HOUR, DAY };
  AUS.api = root.browser || root.chrome;

  // Plan presets are starting points. Providers change their caps often, so every
  // number is editable on the settings page.
  AUS.SITES = {
    claude: {
      name: 'Claude',
      color: '#C8754E',
      url: 'https://claude.ai/new',
      hosts: ['claude.ai'],
      live: true,
      contextTokens: 200000,
      defaultPreset: 'pro',
      presets: {
        free: { label: 'Free', limit: 10, windowType: 'session', windowHours: 5 },
        pro: { label: 'Pro', limit: 45, windowType: 'session', windowHours: 5 },
        max5: { label: 'Max 5x', limit: 225, windowType: 'session', windowHours: 5 },
        max20: { label: 'Max 20x', limit: 900, windowType: 'session', windowHours: 5 }
      }
    },
    chatgpt: {
      name: 'ChatGPT',
      color: '#10A37F',
      url: 'https://chatgpt.com/',
      hosts: ['chatgpt.com', 'chat.openai.com'],
      contextTokens: 128000,
      defaultPreset: 'plus',
      presets: {
        free: { label: 'Free', limit: 10, windowType: 'rolling', windowHours: 5 },
        plus: { label: 'Plus', limit: 160, windowType: 'rolling', windowHours: 3 },
        pro: { label: 'Pro (no cap)', limit: 0, windowType: 'rolling', windowHours: 3 }
      }
    },
    gemini: {
      name: 'Gemini',
      color: '#4C8DF6',
      url: 'https://gemini.google.com/app',
      hosts: ['gemini.google.com'],
      contextTokens: 1000000,
      defaultPreset: 'pro',
      presets: {
        free: { label: 'Free', limit: 5, windowType: 'daily', windowHours: 24 },
        pro: { label: 'Google AI Pro', limit: 100, windowType: 'daily', windowHours: 24 },
        ultra: { label: 'Google AI Ultra', limit: 500, windowType: 'daily', windowHours: 24 }
      }
    },
    perplexity: {
      name: 'Perplexity',
      color: '#1F8A96',
      url: 'https://www.perplexity.ai/',
      hosts: ['perplexity.ai'],
      contextTokens: 128000,
      defaultPreset: 'free',
      presets: {
        free: { label: 'Free', limit: 5, windowType: 'daily', windowHours: 24 },
        pro: { label: 'Pro', limit: 300, windowType: 'daily', windowHours: 24 }
      }
    },
    grok: {
      name: 'Grok',
      color: '#8A93A0',
      url: 'https://grok.com/',
      hosts: ['grok.com'],
      contextTokens: 128000,
      defaultPreset: 'free',
      presets: {
        free: { label: 'Free', limit: 10, windowType: 'rolling', windowHours: 2 },
        super: { label: 'SuperGrok', limit: 100, windowType: 'rolling', windowHours: 2 }
      }
    },
    deepseek: {
      name: 'DeepSeek',
      color: '#4D6BFE',
      url: 'https://chat.deepseek.com/',
      hosts: ['chat.deepseek.com'],
      contextTokens: 128000,
      defaultPreset: 'free',
      presets: {
        free: { label: 'Free (no cap)', limit: 0, windowType: 'rolling', windowHours: 24 }
      }
    }
  };

  AUS.SITE_ORDER = ['claude', 'chatgpt', 'gemini', 'perplexity', 'grok', 'deepseek'];

  AUS.HOST_PATTERNS = [
    'https://claude.ai/*',
    'https://chatgpt.com/*',
    'https://chat.openai.com/*',
    'https://gemini.google.com/*',
    'https://www.perplexity.ai/*',
    'https://perplexity.ai/*',
    'https://grok.com/*',
    'https://chat.deepseek.com/*'
  ];

  AUS.detectSite = function (hostname) {
    hostname = String(hostname || '').toLowerCase();
    for (const id of AUS.SITE_ORDER) {
      if (AUS.SITES[id].hosts.some((h) => hostname === h || hostname.endsWith('.' + h))) return id;
    }
    return null;
  };

  // ---------- settings ----------

  AUS.defaultSettings = function () {
    const sites = {};
    for (const id of AUS.SITE_ORDER) {
      const s = AUS.SITES[id];
      const p = s.presets[s.defaultPreset];
      sites[id] = {
        enabled: true,
        preset: s.defaultPreset,
        limit: p.limit,
        windowType: p.windowType,
        windowHours: p.windowHours,
        resetHour: 0,
        contextTokens: s.contextTokens,
        useLive: !!s.live
      };
    }
    return {
      version: 1,
      global: {
        showStrip: true,
        placement: 'auto', // auto | inline | floating
        density: 'full', // full | compact
        theme: 'auto', // auto | light | dark
        badge: true,
        sections: { plan: true, reset: true, context: true, messages: true }
      },
      sites
    };
  };

  function isObj(v) {
    return v && typeof v === 'object' && !Array.isArray(v);
  }

  function merge(base, extra) {
    if (!isObj(extra)) return base;
    const out = Array.isArray(base) ? base.slice() : { ...base };
    for (const k of Object.keys(extra)) {
      out[k] = isObj(base[k]) ? merge(base[k], extra[k]) : extra[k];
    }
    return out;
  }

  AUS.mergeSettings = function (saved) {
    return merge(AUS.defaultSettings(), saved || {});
  };

  // ---------- maths ----------

  function startOfDay(ts, hour) {
    const d = new Date(ts);
    d.setHours(hour || 0, 0, 0, 0);
    return d.getTime();
  }

  function windowMs(cfg) {
    return Math.max(0.25, Number(cfg.windowHours) || 5) * HOUR;
  }

  AUS.windowLabel = function (cfg) {
    if (cfg.windowType === 'daily') return 'daily';
    const h = Number(cfg.windowHours) || 5;
    return `${h % 1 ? h.toFixed(1) : h}-hour`;
  };

  function estimateWindow(cfg, events, now) {
    const W = windowMs(cfg);
    if (cfg.windowType === 'daily') {
      const hour = Math.min(23, Math.max(0, Number(cfg.resetHour) || 0));
      let start = startOfDay(now, hour);
      if (start > now) start = startOfDay(now - DAY, hour);
      const next = startOfDay(start + DAY + 2 * HOUR, hour); // DST-safe "same hour tomorrow"
      return { used: events.filter((t) => t >= start).length, start, resetAt: next, resetKind: 'reset' };
    }
    if (cfg.windowType === 'session') {
      // A fixed block that opens with the first message and resets in full when it ends.
      let blockStart = null;
      let n = 0;
      for (const t of events) {
        if (blockStart === null || t >= blockStart + W) {
          blockStart = t;
          n = 0;
        }
        n++;
      }
      if (blockStart !== null && now < blockStart + W) {
        return { used: n, start: blockStart, resetAt: blockStart + W, resetKind: 'reset' };
      }
      return { used: 0, start: null, resetAt: null, resetKind: 'reset' };
    }
    // Rolling: every message counts for W, then frees its slot.
    const start = now - W;
    const inWindow = events.filter((t) => t > start);
    return {
      used: inWindow.length,
      start,
      resetAt: inWindow.length ? inWindow[0] + W : null,
      resetKind: 'frees'
    };
  }

  AUS.stateFor = function (pct) {
    if (pct == null || Number.isNaN(pct)) return 'none';
    if (pct >= 85) return 'hot';
    if (pct >= 60) return 'warn';
    return 'ok';
  };

  /**
   * Turns raw history into what the UI shows.
   * @returns {{plan: object, messages: object}}
   */
  AUS.computeStats = function (siteId, cfg, rawEvents, live, hit, now) {
    now = now || Date.now();
    const events = (rawEvents || []).filter((t) => typeof t === 'number' && t <= now).sort((a, b) => a - b);
    const today = startOfDay(now, 0);

    const byDay = [];
    for (let i = 6; i >= 0; i--) {
      const from = startOfDay(now - i * DAY, 0);
      const to = startOfDay(from + DAY + 2 * HOUR, 0);
      byDay.push({ from, count: events.filter((t) => t >= from && t < to).length });
    }

    const est = estimateWindow(cfg, events, now);
    const messages = {
      today: events.filter((t) => t >= today).length,
      week: events.filter((t) => t >= now - 7 * DAY).length,
      window: est.used,
      byDay
    };

    const plan = {
      source: 'none',
      pct: null,
      used: est.used,
      limit: Number(cfg.limit) || 0,
      label: AUS.windowLabel(cfg),
      windows: [],
      resetAt: null,
      resetKind: est.resetKind,
      limited: false,
      liveError: null
    };

    const liveFresh = live && live.windows && live.windows.length && live.fetchedAt && now - live.fetchedAt < 30 * MIN;
    if (cfg.useLive && liveFresh) {
      const primary = live.windows.find((w) => w.key === 'five_hour') || live.windows[0];
      plan.source = 'live';
      plan.windows = live.windows.map((w) => ({ ...w }));
      plan.pct = primary.pct;
      plan.label = primary.label;
      plan.resetAt = primary.resetsAt;
      plan.resetKind = 'reset';
    } else if (plan.limit > 0) {
      plan.source = 'estimate';
      plan.pct = Math.min(100, (est.used / plan.limit) * 100);
      plan.resetAt = est.resetAt;
      plan.windows = [{ key: 'estimate', label: plan.label, pct: plan.pct, resetsAt: est.resetAt }];
    }
    if (cfg.useLive && live && live.lastError && !liveFresh) plan.liveError = live.lastError;

    if (hit && hit.at) {
      const until = plan.resetAt && plan.resetAt > hit.at ? plan.resetAt : hit.at + windowMs(cfg);
      if (now < until) {
        plan.limited = true;
        plan.pct = 100;
        plan.resetAt = until;
        plan.resetKind = 'reset';
      }
    }

    plan.state = plan.limited ? 'limited' : AUS.stateFor(plan.pct);
    return { plan, messages };
  };

  // Rough token count. ~4 characters per token for Latin text; scripts like Tamil,
  // Hindi, Chinese or Japanese tokenize far less efficiently, so they weigh more.
  AUS.estimateTokens = function (text) {
    if (!text) return 0;
    const t = String(text).replace(/\s+/g, ' ');
    const nonAscii = t.replace(/[\x00-\x7F]+/g, '').length;
    const ascii = t.length - nonAscii;
    return Math.round(ascii / 4 + nonAscii * 0.7);
  };

  // claude.ai /api/organizations/{org}/usage → [{key, label, pct, resetsAt}]
  AUS.parseClaudeUsage = function (data) {
    if (!isObj(data)) return [];
    const out = [];
    for (const key of Object.keys(data)) {
      const v = data[key];
      if (!isObj(v) || typeof v.utilization !== 'number') continue;
      if (!/^(five_hour|seven_day)/.test(key)) continue;
      let label;
      if (key === 'five_hour') label = '5-hour';
      else if (key === 'seven_day') label = 'weekly';
      else label = 'weekly ' + key.replace(/^seven_day_?/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const reset = v.resets_at ? Date.parse(v.resets_at) : NaN;
      out.push({
        key,
        label,
        pct: Math.max(0, Math.min(100, v.utilization)),
        resetsAt: Number.isFinite(reset) ? reset : null
      });
    }
    const rank = (k) => (k === 'five_hour' ? 0 : k === 'seven_day' ? 1 : 2);
    return out.sort((a, b) => rank(a.key) - rank(b.key));
  };

  // ---------- formatting ----------

  AUS.fmtDuration = function (ms) {
    if (ms == null || !Number.isFinite(ms)) return '';
    if (ms <= 0) return 'now';
    if (ms < MIN) return '<1m';
    const m = Math.floor(ms / MIN);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
    const d = Math.floor(h / 24);
    return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
  };

  AUS.fmtTokens = function (n) {
    n = Math.max(0, Math.round(n || 0));
    if (n < 1000) return String(n);
    if (n < 1e6) return (n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '') + 'K';
    return (n / 1e6).toFixed(n < 1e7 ? 1 : 0).replace(/\.0$/, '') + 'M';
  };

  AUS.fmtAgo = function (ts, now) {
    const d = (now || Date.now()) - ts;
    if (d < MIN) return 'just now';
    return AUS.fmtDuration(d) + ' ago';
  };

  AUS.fmtClock = function (ts, now) {
    const d = new Date(ts);
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const sameDay = new Date(now || Date.now()).toDateString() === d.toDateString();
    return sameDay ? time : `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`;
  };

  AUS.escape = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
