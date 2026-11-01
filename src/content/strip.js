/*
 * AI Usage Strip — the strip itself.
 * A custom element with a shadow root: one slim row above the chat box and a
 * details panel that opens upward from it.
 */
(function (root) {
  'use strict';
  const AUS = root.AUS;
  const SEGMENTS = 20;
  const esc = AUS.escape;
  const cap = (s) => String(s || '').replace(/^./, (c) => c.toUpperCase());

  const ICONS = {
    chevron:
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    gear:
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 5.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M13.1 9.4l1.1.9-1.2 2.1-1.4-.5a5 5 0 0 1-1.4.8L9.9 14H7.5l-.3-1.3a5 5 0 0 1-1.4-.8l-1.4.5-1.2-2.1 1.1-.9a5 5 0 0 1 0-1.6l-1.1-.9 1.2-2.1 1.4.5a5 5 0 0 1 1.4-.8L7.5 2h2.4l.3 1.3a5 5 0 0 1 1.4.8l1.4-.5 1.2 2.1-1.1.9a5 5 0 0 1 0 1.6Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
    clock:
      '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 4.8V8l2.2 1.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    chat:
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.5h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H7.2L4.5 13.6V11.5H3a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>'
  };
  const FIT_LEVELS = 11;

  class Strip {
    constructor(opts) {
      this.opts = opts || {};
      this.mode = null;
      this.expanded = false;
      this.introDone = false;
      this.panelHTML = '';
      this.model = null;

      const host = document.createElement('aus-strip');
      host.setAttribute('data-aus', '');
      this.host = host;
      const shadow = host.attachShadow({ mode: 'open' });
      this.shadow = shadow;

      const segs = Array.from({ length: SEGMENTS }, (_, i) => `<i style="--i:${i}"></i>`).join('');
      shadow.innerHTML = `
<style>${AUS.STRIP_CSS}</style>
<div class="wrap" data-state="none" data-theme="light">
  <section class="panel" hidden aria-label="Usage details"></section>
  <div class="row" role="group" aria-label="AI usage">
    <span class="cell site"><span class="dot"></span><span class="name"></span></span>
    <span class="cell plan" data-sec="plan">
      <span class="lbl pl"></span>
      <span class="seg" role="meter" aria-valuemin="0" aria-valuemax="100">${segs}</span>
      <span class="val pct"></span>
    </span>
    <span class="cell week" data-sec="plan"><span class="lbl">Week</span><span class="val wv"></span></span>
    <span class="cell reset" data-sec="reset">${ICONS.clock}<span class="val rv"></span><span class="lbl opt rl"></span></span>
    <span class="cell ctx" data-sec="context"><span class="lbl opt">Context</span><span class="track"><i></i></span><span class="val cv"></span></span>
    <span class="cell msgs" data-sec="messages">${ICONS.chat}<span class="val mv"></span><span class="lbl ml">today</span></span>
    <span class="grow"></span>
    <button class="icon more" type="button" aria-expanded="false" aria-label="Show usage details">${ICONS.chevron}</button>
    <button class="icon gear" type="button" aria-label="Open AI Usage Strip settings" title="Settings">${ICONS.gear}</button>
  </div>
</div>`;

      const $ = (s) => shadow.querySelector(s);
      this.el = {
        wrap: $('.wrap'),
        panel: $('.panel'),
        row: $('.row'),
        dot: $('.site .dot'),
        name: $('.site .name'),
        site: $('.site'),
        seg: $('.seg'),
        segs: Array.from(shadow.querySelectorAll('.seg i')),
        pct: $('.pct'),
        pl: $('.pl'),
        week: $('.week'),
        wv: $('.wv'),
        reset: $('.reset'),
        rv: $('.rv'),
        rl: $('.rl'),
        ctx: $('.ctx'),
        track: $('.track i'),
        cv: $('.cv'),
        msgs: $('.msgs'),
        mv: $('.mv'),
        more: $('.more'),
        gear: $('.gear')
      };

      this.el.more.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggle();
      });
      this.el.gear.addEventListener('click', (e) => {
        e.stopPropagation();
        this.opts.onSettings && this.opts.onSettings();
      });
      this.el.row.addEventListener('click', () => this.toggle());
      this.el.panel.addEventListener('click', (e) => {
        const act = e.target.closest && e.target.closest('[data-act]');
        if (!act) return;
        const name = act.getAttribute('data-act');
        if (name === 'settings') this.opts.onSettings && this.opts.onSettings();
        if (name === 'refresh') this.opts.onRefresh && this.opts.onRefresh();
        if (name === 'clear') this.opts.onClearLimit && this.opts.onClearLimit();
      });
      this.el.wrap.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.expanded) {
          e.stopPropagation();
          this.toggle(false);
          this.el.more.focus();
        }
      });
      // Keep typing in the strip from reaching the site's keyboard shortcuts.
      ['keydown', 'keyup', 'keypress'].forEach((t) => this.el.wrap.addEventListener(t, (e) => e.stopPropagation()));

      if (root.ResizeObserver) {
        let lastW = 0;
        new ResizeObserver(() => {
          const w = this.el.row.clientWidth;
          if (w !== lastW) {
            lastW = w;
            this.fit();
          }
        }).observe(this.el.row);
      }
    }

    setMode(mode) {
      this.mode = mode;
      this.host.setAttribute('data-mode', mode);
      if (mode === 'inline') {
        this.host.style.removeProperty('top');
        this.host.style.removeProperty('left');
      }
    }

    toggle(force) {
      this.expanded = typeof force === 'boolean' ? force : !this.expanded;
      this.el.more.setAttribute('aria-expanded', String(this.expanded));
      this.el.more.setAttribute('aria-label', this.expanded ? 'Hide usage details' : 'Show usage details');
      this.el.panel.hidden = !this.expanded;
      if (this.expanded && this.model) this.renderPanel(this.model, true);
      this.opts.onResize && this.opts.onResize();
    }

    update(m) {
      this.model = m;
      const { stats, ctx, global, site } = m;
      const plan = stats.plan;
      const now = Date.now();
      const el = this.el;

      el.wrap.dataset.theme = m.theme;
      el.wrap.dataset.state = plan.state;
      el.wrap.dataset.source = plan.source;
      el.wrap.dataset.density = global.density;
      el.wrap.style.setProperty('--site', site.color);
      el.name.textContent = site.name;
      el.site.title = `${site.name}, tracked by AI Usage Strip`;

      const sec = global.sections || {};
      this.shadow.querySelectorAll('[data-sec]').forEach((n) => {
        n.hidden = !sec[n.getAttribute('data-sec')];
      });

      // plan limit
      let pctText = '';
      let label = '';
      if (plan.limited) {
        pctText = 'Limit reached';
        label = cap(plan.label);
      } else if (plan.pct == null) {
        label = 'No cap';
      } else {
        pctText = `${Math.round(plan.pct)}%`;
        label = cap(plan.label);
      }
      el.pct.textContent = pctText;
      el.pl.textContent = label;
      const on = plan.pct == null ? 0 : Math.max(plan.pct > 0 ? 1 : 0, Math.round((plan.pct / 100) * SEGMENTS));
      const paint = () => el.segs.forEach((s, i) => s.classList.toggle('on', i < on));
      if (!this.introDone) {
        this.introDone = true;
        const reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!reduce && on > 0) {
          el.wrap.classList.add('intro');
          requestAnimationFrame(() => requestAnimationFrame(paint));
          setTimeout(() => el.wrap.classList.remove('intro'), 900);
        } else paint();
      } else paint();
      el.seg.setAttribute('aria-valuenow', String(Math.round(plan.pct || 0)));
      el.seg.setAttribute(
        'aria-valuetext',
        plan.pct == null ? 'No cap tracked' : `${Math.round(plan.pct)} percent of ${plan.label} limit used${plan.source === 'estimate' ? ', estimated' : ''}`
      );
      el.seg.parentElement.title =
        plan.source === 'live'
          ? `Live from ${site.name}`
          : plan.source === 'estimate'
            ? `Estimated: ${plan.used} of ${plan.limit} messages in this ${plan.label} window`
            : 'Set a message cap in settings to track this site';

      const weekly = plan.source === 'live' && plan.windows.find((w) => w.key === 'seven_day');
      const primaryIsWeekly = weekly && plan.label === weekly.label;
      el.week.hidden = !sec.plan || !weekly || primaryIsWeekly;
      if (weekly) {
        el.wv.textContent = `${Math.round(weekly.pct)}%`;
        el.week.title = weekly.resetsAt ? `Weekly limit resets ${AUS.fmtClock(weekly.resetsAt, now)}` : 'Weekly limit';
      }

      // reset timer
      if (plan.resetAt && plan.resetAt > now) {
        el.rv.textContent = AUS.fmtDuration(plan.resetAt - now);
        el.rl.textContent = plan.resetKind === 'frees' ? 'to free a slot' : 'to reset';
        el.reset.title = `${plan.resetKind === 'frees' ? 'Oldest message leaves the window' : 'Resets'} at ${AUS.fmtClock(plan.resetAt, now)}`;
      } else {
        el.rv.textContent = '';
        el.rl.textContent = plan.source === 'none' ? 'No window' : 'Full allowance';
        el.reset.title = plan.source === 'none' ? '' : 'Nothing counted in the current window';
      }

      // context
      const total = (ctx.tokens || 0) + (ctx.draft || 0);
      const cpct = ctx.limit ? Math.min(100, (total / ctx.limit) * 100) : 0;
      el.track.style.width = `${Math.max(cpct, total > 0 ? 2 : 0)}%`;
      const cstate = AUS.stateFor(cpct);
      el.ctx.style.setProperty('--ctx', `var(--${cstate === 'none' ? 'ok' : cstate})`);
      el.cv.textContent = `~${AUS.fmtTokens(total)} / ${AUS.fmtTokens(ctx.limit)}`;
      el.ctx.title = `About ${total.toLocaleString()} tokens in this chat${ctx.draft ? ` (including ~${ctx.draft.toLocaleString()} in your draft)` : ''}, ${cpct.toFixed(1)}% of a ${ctx.limit.toLocaleString()}-token window`;

      // messages
      el.mv.textContent = String(stats.messages.today);
      el.msgs.title = `${stats.messages.today} sent today, ${stats.messages.week} in the last 7 days`;

      if (this.expanded) this.renderPanel(m);
      this.fit();
    }

    // Hide lower-priority pieces, one level at a time, until the row fits the chat box.
    fit() {
      const { wrap, row } = this.el;
      if (!row.isConnected || !row.clientWidth) return;
      for (let i = 1; i <= FIT_LEVELS; i++) wrap.classList.remove(`fit-${i}`);
      for (let i = 1; i <= FIT_LEVELS && row.scrollWidth > row.clientWidth + 1; i++) wrap.classList.add(`fit-${i}`);
    }

    renderPanel(m, force) {
      const { stats, ctx, site, cfg, live } = m;
      const plan = stats.plan;
      const now = Date.now();
      const pctOf = (v) => Math.round(v || 0);

      let planHTML = '';
      if (plan.windows.length) {
        planHTML = plan.windows
          .map((w) => {
            const s = plan.limited ? 'limited' : AUS.stateFor(w.pct);
            const reset = w.resetsAt && w.resetsAt > now ? `Resets in ${AUS.fmtDuration(w.resetsAt - now)}, at ${AUS.fmtClock(w.resetsAt, now)}` : 'No active window';
            return `<div class="win"><div class="win-top"><span>${esc(w.label)} limit</span><b class="val">${plan.source === 'estimate' ? '~' : ''}${pctOf(w.pct)}%</b></div>
              <div class="bar"><i data-s="${s}" style="width:${Math.max(pctOf(w.pct), w.pct > 0 ? 2 : 0)}%"></i></div><p class="sub">${esc(reset)}</p></div>`;
          })
          .join('');
      } else {
        planHTML = '<div class="bar"><i data-s="none" style="width:0"></i></div>';
      }

      let note;
      if (plan.source === 'live') {
        note = `Live from ${esc(site.name)}, updated ${esc(AUS.fmtAgo(live.fetchedAt, now))}.`;
      } else if (plan.source === 'estimate') {
        const preset = AUS.SITES[m.siteId].presets[cfg.preset];
        note = `${plan.liveError ? `Couldn't read live usage (${esc(plan.liveError)}). ` : ''}Estimated from ${plan.used} message${plan.used === 1 ? '' : 's'} in this window against a ${plan.limit}-message ${preset ? esc(preset.label) + ' ' : ''}limit. Adjust it in settings if your plan differs.`;
      } else {
        note = `No message cap is set for ${esc(site.name)}. Add one in settings to track it.`;
      }

      const limitedHTML = plan.limited
        ? `<p class="alert">${esc(site.name)} says you've hit a limit. It should lift in ${esc(AUS.fmtDuration(plan.resetAt - now))}. <button class="link" type="button" data-act="clear">Not limited? Clear it</button></p>`
        : '';

      const total = (ctx.tokens || 0) + (ctx.draft || 0);
      const cpct = ctx.limit ? Math.min(100, (total / ctx.limit) * 100) : 0;
      const max = Math.max(1, ...stats.messages.byDay.map((d) => d.count));
      const spark = stats.messages.byDay
        .map((d, i) => {
          const day = new Date(d.from).toLocaleDateString([], { weekday: 'short' });
          return `<i class="${i === 6 ? 'today' : ''}" style="height:${Math.max(6, (d.count / max) * 100)}%" title="${esc(day)}: ${d.count}"></i>`;
        })
        .join('');

      const html = `
<div class="col"><h3>Plan limit</h3>${planHTML}<p class="note">${note}</p>${limitedHTML}</div>
<div class="col"><h3>Context</h3>
  <div class="big">~${AUS.fmtTokens(total)}<small>tokens in this chat</small></div>
  <div class="bar"><i data-s="${AUS.stateFor(cpct)}" style="width:${Math.max(cpct, total ? 1 : 0).toFixed(1)}%"></i></div>
  <p class="sub">${cpct < 0.1 && total ? '<0.1' : cpct.toFixed(cpct < 10 ? 1 : 0)}% of a ${AUS.fmtTokens(ctx.limit)} window${ctx.draft ? `, ~${AUS.fmtTokens(ctx.draft)} in your draft` : ''}</p>
  <p class="note">Counted from the text on this page. Files, images and hidden system prompts aren't included.</p>
</div>
<div class="col"><h3>Messages</h3><div class="spark" aria-hidden="true">${spark}</div>
  <dl><div><dt>Today</dt><dd>${stats.messages.today}</dd></div>
  <div><dt>This window</dt><dd>${stats.messages.window}</dd></div>
  <div><dt>Last 7 days</dt><dd>${stats.messages.week}</dd></div></dl>
</div>
<div class="foot"><button class="link" type="button" data-act="settings">Plan and limit settings</button>${
        m.canRefresh ? '<button class="link" type="button" data-act="refresh">Refresh live usage</button>' : ''
      }</div>`;

      if (force || html !== this.panelHTML) {
        this.panelHTML = html;
        this.el.panel.innerHTML = html;
      }
    }

    destroy() {
      this.host.remove();
    }
  }

  AUS.Strip = Strip;
})(globalThis);
