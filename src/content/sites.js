/*
 * AI Usage Strip — per-site knowledge.
 * Each adapter says where the chat box is, where the strip should sit, which elements
 * hold the conversation, and (Claude only) how to read live plan usage.
 * Sites redesign often, so every lookup falls back to generic detection.
 */
(function (root) {
  'use strict';
  const AUS = root.AUS;

  function visible(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function first(selectors) {
    for (const sel of selectors) {
      let list;
      try {
        list = document.querySelectorAll(sel);
      } catch (e) {
        continue;
      }
      for (const el of list) if (visible(el)) return el;
    }
    return null;
  }

  function closestOf(el, selectors) {
    for (const sel of selectors) {
      try {
        const hit = el.closest(sel);
        if (hit) return hit;
      } catch (e) {
        /* unsupported selector */
      }
    }
    return null;
  }

  // The chat box is usually the widest editable element nearest the bottom of the screen.
  AUS.genericComposer = function () {
    const nodes = document.querySelectorAll('textarea, [contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"]');
    let best = null;
    let bestScore = -Infinity;
    for (const el of nodes) {
      if (el.closest('[aria-hidden="true"], aus-strip')) continue;
      if (el.parentElement && el.parentElement.closest('[contenteditable="true"]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 200 || r.height < 14 || r.bottom < 0 || r.top > innerHeight) continue;
      const score = r.bottom + r.width * 0.1;
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }
    return best;
  };

  AUS.composerText = function (el) {
    if (!el) return '';
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return el.value || '';
    return el.innerText || el.textContent || '';
  };

  AUS.looksLikeSend = function (btn, composer) {
    if (!btn || btn.disabled || btn.getAttribute('aria-disabled') === 'true') return false;
    const label = [
      btn.getAttribute('aria-label'),
      btn.getAttribute('title'),
      btn.getAttribute('data-testid'),
      btn.id,
      (btn.textContent || '').trim().slice(0, 24)
    ]
      .filter(Boolean)
      .join(' ');
    if (/stop|cancel|feedback|share|report|voice|dictat|micro|attach|upload|copy|edit|retry|regenerat/i.test(label)) return false;
    if (/\bsend\b|submit|send[-_ ]?button|composer-submit/i.test(label)) return true;
    return btn.type === 'submit' && !!btn.form && !!composer && btn.form.contains(composer);
  };

  // Phrases sites show when you hit a cap. Kept specific so AI replies that merely
  // talk about limits don't trip it.
  AUS.LIMIT_RE = /(you['’]ve (?:reached|hit) (?:your|the|our) (?:[\w.-]+ ){0,6}limit|usage limit reached|message limit reached|out of free messages|limit resets at|rate limit(?:ed)? reached)/i;

  async function claudeLive() {
    let pageFetch = root.fetch.bind(root);
    try {
      // Firefox: run the request as the page so claude.ai sees its own session.
      // eslint-disable-next-line no-undef
      if (typeof content !== 'undefined' && content && typeof content.fetch === 'function') pageFetch = content.fetch.bind(content);
    } catch (e) {
      /* Chromium */
    }
    const getJSON = async (path) => {
      const res = await pageFetch(location.origin + path, { credentials: 'include', headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`claude.ai answered ${res.status}`);
      return res.json();
    };

    const candidates = [];
    const cookie = document.cookie.match(/(?:^|;\s*)lastActiveOrg=([^;]+)/);
    if (cookie) candidates.push(decodeURIComponent(cookie[1]));

    let lastErr = null;
    for (let pass = 0; pass < 2; pass++) {
      for (const org of candidates) {
        try {
          const windows = AUS.parseClaudeUsage(await getJSON(`/api/organizations/${encodeURIComponent(org)}/usage`));
          if (windows.length) return windows;
        } catch (e) {
          lastErr = e;
        }
      }
      if (pass === 0) {
        const orgs = await getJSON('/api/organizations');
        const list = Array.isArray(orgs) ? orgs : [];
        const ranked = list
          .filter((o) => o && o.uuid && !candidates.includes(o.uuid))
          .sort((a, b) => Number((b.capabilities || []).includes('chat')) - Number((a.capabilities || []).includes('chat')));
        candidates.length = 0;
        ranked.forEach((o) => candidates.push(o.uuid));
        if (!candidates.length) break;
      }
    }
    throw lastErr || new Error('No usage data found for this Claude account');
  }

  AUS.ADAPTERS = {
    claude: {
      composer: () => first(['div.ProseMirror[contenteditable="true"]', '[data-testid="chat-input"]', 'fieldset [contenteditable="true"]']),
      anchor: (c) => closestOf(c, ['fieldset']),
      messages: '[data-testid="user-message"], .font-claude-response, .font-claude-message',
      fetchLive: claudeLive
    },
    chatgpt: {
      composer: () => first(['#prompt-textarea', 'form [contenteditable="true"]', 'form textarea']),
      anchor: (c) => closestOf(c, ['form']),
      messages: '[data-message-author-role]'
    },
    gemini: {
      composer: () => first(['rich-textarea .ql-editor[contenteditable="true"]', 'rich-textarea [contenteditable="true"]', '.text-input-field [contenteditable="true"]']),
      anchor: (c) => closestOf(c, ['input-area-v2', '.input-area-container', '.input-area']),
      messages: 'user-query, model-response'
    },
    perplexity: {
      composer: () => first(['#ask-input', 'textarea[placeholder]', 'div[contenteditable="true"][role="textbox"]']),
      anchor: () => null
    },
    grok: {
      composer: () => first(['form textarea', 'form [contenteditable="true"]', 'textarea']),
      anchor: (c) => closestOf(c, ['form']),
      messages: '.message-bubble'
    },
    deepseek: {
      composer: () => first(['textarea#chat-input', 'textarea']),
      anchor: () => null
    }
  };
})(globalThis);
