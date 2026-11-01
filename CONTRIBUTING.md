# Contributing to AI Usage Strip

Thanks for helping. The most useful contributions are support for new AI sites and quick fixes when a site changes its layout. Small, focused pull requests get merged fastest.

## Set up

You need Node 18 or newer. There are no dependencies to install.

```sh
git clone https://github.com/Ramachokkalingam/ai-usage-strip.git
cd ai-usage-strip
npm run check     # syntax and manifest checks
npm run build     # writes dist/chromium and dist/firefox
```

Load the extension:

- **Chromium:** `chrome://extensions`, turn on Developer mode, **Load unpacked**, pick `dist/chromium`. After a change, run `npm run build` and click the reload icon on the extension card.
- **Firefox:** `about:debugging#/runtime/this-firefox`, **Load Temporary Add-on**, pick `dist/firefox/manifest.json`. Click **Reload** after each build.

You can also load `src/` directly in Chromium while developing. Chrome warns about the Firefox-only manifest keys, which is harmless.

## Where things live

| File | What it does |
| --- | --- |
| `src/shared/core.js` | Site list, plan presets, window maths, token estimate, formatting. Runs everywhere. |
| `src/content/sites.js` | Per-site adapters: where the chat box is, where to attach the strip, which elements hold messages. |
| `src/content/main.js` | Mounts the strip, counts sends, estimates context, reads Claude's live usage. |
| `src/content/strip.js` | The strip and details panel. |
| `src/background.js` | Stores message history and live usage, sets the toolbar badge. |
| `src/popup/`, `src/options/` | Toolbar popup and settings page. |

## Adding a site

1. In `src/shared/core.js`, add an entry to `AUS.SITES` (name, brand color, URL, hostnames, context window, plan presets) and its id to `AUS.SITE_ORDER`.
2. Add the site's URL pattern to `AUS.HOST_PATTERNS` in the same file, and to `host_permissions` and `content_scripts[0].matches` in `src/manifest.json`.
3. In `src/content/sites.js`, add an adapter to `AUS.ADAPTERS`:

   ```js
   lechat: {
     composer: () => first(['textarea[placeholder]', 'div[contenteditable="true"]']),
     anchor: (c) => closestOf(c, ['form']),
     messages: '[data-message-author-role]' // optional
   }
   ```

   Every field is optional. Without an adapter the extension finds the widest editable box near the bottom of the page and attaches above it.
4. Build, load the extension and check on the real site that the strip appears above the chat box, that sending a message raises the count by one, and that the theme matches in light and dark mode.
5. Add the site to the tables in `README.md`.

Plan limits change often. Link a source for the numbers you put in a preset (a help page or announcement) in your pull request.

## Fixing a site that broke

Sites ship redesigns without notice. Usually only the `composer` or `anchor` selector in `src/content/sites.js` needs updating. Open the site's developer tools, inspect the chat box, and prefer stable hooks such as `id`, `data-testid`, `aria-label` or custom element names over generated class names.

## Style

- Plain JavaScript, no frameworks, no build step beyond copying files.
- Keep it working in both Chromium and Firefox. Use `AUS.api` instead of `chrome` or `browser` directly.
- Escape anything that goes into HTML with `AUS.escape`.
- UI text is sentence case, plain and short. Say what something does, not how it's built.
- Run `npm run check` before you push.

## Pull requests

- One change per pull request, with a short description of what and why.
- For visual changes, add a before and after screenshot.
- Mention which browsers you tested in.

## Reporting bugs

Use the [issue forms](https://github.com/Ramachokkalingam/ai-usage-strip/issues/new/choose). For security problems, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
