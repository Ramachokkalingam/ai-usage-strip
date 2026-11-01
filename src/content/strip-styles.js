/* AI Usage Strip — styles for the strip. Lives in a shadow root, so host-page CSS can't reach it. */
(function (root) {
  'use strict';
  root.AUS.STRIP_CSS = `
:host {
  all: initial;
  display: block;
  box-sizing: border-box;
  position: relative;
  z-index: 3;
  margin: 0 0 6px 0;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}
:host([data-mode="floating"]) { position: fixed; margin: 0; z-index: 2147483000; }
:host([hidden]) { display: none; }
*, *::before, *::after { box-sizing: border-box; }

.wrap {
  container-type: inline-size;
  --surface: rgba(255, 255, 255, 0.84);
  --surface-solid: #FFFFFF;
  --ink: #1C2430;
  --muted: #5F6878;
  --line: rgba(28, 36, 48, 0.11);
  --hover: rgba(28, 36, 48, 0.06);
  --seg-idle: #DDE2E9;
  --ok: #23966A;
  --warn: #C98A12;
  --hot: #D2453A;
  --link: #2F5BD3;
  --focus: #2F5BD3;
  --state: var(--muted);
  color: var(--ink);
  font-size: 12.5px;
  line-height: 1.3;
}
.wrap[data-theme="dark"] {
  --surface: rgba(33, 36, 42, 0.86);
  --surface-solid: #23262C;
  --ink: #E9EDF3;
  --muted: #9BA4B3;
  --line: rgba(233, 237, 243, 0.11);
  --hover: rgba(233, 237, 243, 0.08);
  --seg-idle: #3A414B;
  --ok: #4CC38A;
  --warn: #EDB240;
  --hot: #F2685C;
  --link: #8FB0FF;
  --focus: #8FB0FF;
}
.wrap[data-state="ok"] { --state: var(--ok); }
.wrap[data-state="warn"] { --state: var(--warn); }
.wrap[data-state="hot"], .wrap[data-state="limited"] { --state: var(--hot); }

.row {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 32px;
  padding: 0 4px 0 12px;
  background: var(--surface);
  -webkit-backdrop-filter: blur(12px) saturate(1.3);
  backdrop-filter: blur(12px) saturate(1.3);
  border: 1px solid var(--line);
  border-radius: 11px;
  box-shadow: 0 1px 1px rgba(16, 24, 40, 0.04), 0 3px 10px -6px rgba(16, 24, 40, 0.14);
  overflow: hidden;
  cursor: pointer;
  user-select: none;
}
.wrap[data-state="limited"] .row { border-color: color-mix(in srgb, var(--hot) 45%, var(--line)); }

.cell { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; flex: none; }
.cell[hidden] { display: none; }
.cell > * { flex: none; }
.val { font-weight: 600; font-variant-numeric: tabular-nums; }
.lbl { color: var(--muted); }

.site .dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--site, var(--muted));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--site, var(--muted)) 20%, transparent);
}
.site .name { font-weight: 600; letter-spacing: -0.005em; }

.seg { display: inline-flex; align-items: center; gap: 2px; }
.seg i {
  display: block; width: 3px; height: 12px; border-radius: 1.5px;
  background: var(--seg-idle);
  transition: background-color 0.3s ease;
}
.seg i.on { background: var(--state); }
.intro .seg i { transition-delay: calc(var(--i) * 24ms); }
.wrap[data-state="limited"] .pct { color: var(--hot); }
.wrap[data-source="estimate"] .pct::before { content: "~"; opacity: 0.7; margin-right: 1px; }

.reset svg, .msgs svg { width: 13px; height: 13px; color: var(--muted); flex: none; }
.msgs { gap: 5px; }

.track { display: block; width: 52px; height: 4px; border-radius: 2px; background: var(--seg-idle); overflow: hidden; }
.track i { display: block; height: 100%; width: 0; border-radius: inherit; background: var(--ctx, var(--ok)); transition: width 0.4s ease; }

.grow { flex: 1 1 auto; }
.icon {
  all: unset;
  display: inline-grid; place-items: center;
  width: 26px; height: 26px; flex: none;
  border-radius: 7px;
  color: var(--muted);
  cursor: pointer;
}
.icon + .icon { margin-left: -12px; }
.icon:hover { background: var(--hover); color: var(--ink); }
.icon svg { width: 16px; height: 16px; }
.more svg { transition: transform 0.18s ease; }
.more[aria-expanded="true"] svg { transform: rotate(180deg); }
.icon:focus-visible, .link:focus-visible, .row:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }

/* details panel — opens upward so the strip stays glued to the chat box */
.panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px 24px;
  margin-bottom: 6px;
  padding: 14px 16px 12px;
  background: var(--surface-solid);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: 0 14px 34px -14px rgba(16, 24, 40, 0.3);
  animation: rise 0.16s ease-out;
  cursor: default;
}
.panel[hidden] { display: none; }
@keyframes rise { from { opacity: 0; transform: translateY(4px); } }
.panel h3 { margin: 0 0 9px; font-size: 12.5px; font-weight: 650; color: var(--ink); }
.win + .win { margin-top: 10px; }
.win-top { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 5px; }
.win-top span::first-letter { text-transform: uppercase; }
.bar { height: 6px; border-radius: 3px; background: var(--seg-idle); overflow: hidden; }
.bar i { display: block; height: 100%; border-radius: inherit; background: var(--ok); }
.bar i[data-s="warn"] { background: var(--warn); }
.bar i[data-s="hot"], .bar i[data-s="limited"] { background: var(--hot); }
.bar i[data-s="none"] { background: var(--muted); }
.sub { margin: 6px 0 0; color: var(--muted); font-size: 12px; }
.note { margin: 10px 0 0; color: var(--muted); font-size: 11.5px; line-height: 1.45; max-width: 46ch; }
.alert {
  margin: 10px 0 0; padding: 8px 10px; border-radius: 8px; font-size: 12px; line-height: 1.4;
  background: color-mix(in srgb, var(--hot) 13%, transparent);
}
.big { font-size: 20px; font-weight: 650; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; margin-bottom: 8px; }
.big small { font-size: 12px; font-weight: 400; letter-spacing: 0; color: var(--muted); margin-left: 4px; }
.spark { display: flex; align-items: flex-end; gap: 4px; height: 34px; margin-bottom: 10px; }
.spark i { flex: 1; min-height: 2px; border-radius: 2px; background: var(--seg-idle); }
.spark i.today { background: var(--site, var(--ok)); }
dl { margin: 0; display: grid; gap: 4px; }
dl div { display: flex; justify-content: space-between; gap: 8px; }
dt { color: var(--muted); }
dd { margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; }
.foot { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 6px 18px; padding-top: 10px; border-top: 1px solid var(--line); }
.link { all: unset; cursor: pointer; color: var(--link); font-size: 12px; font-weight: 550; border-radius: 4px; }
.link:hover { text-decoration: underline; }

.wrap[data-density="compact"] .row { min-height: 26px; gap: 12px; }
.wrap[data-density="compact"] .opt,
.wrap[data-density="compact"] .site .name { display: none; }

/* fit levels, added by Strip.fit() while the row is wider than the chat box */
.fit-1 .rl { display: none; }
.fit-2 .ctx > .lbl { display: none; }
.fit-3 .site .name { display: none; }
.fit-4 .row { gap: 12px; }
.fit-5 .ml { display: none; }
.fit-6 .week { display: none; }
.fit-7 .ctx .track { display: none; }
.fit-8 .ctx { display: none; }
.fit-9 .pl { display: none; }
.fit-10 .msgs { display: none; }
.fit-11 .reset { display: none; }

@media (prefers-reduced-motion: reduce) {
  .seg i, .track i, .more svg { transition: none; }
  .panel { animation: none; }
}
`;
})(globalThis);
