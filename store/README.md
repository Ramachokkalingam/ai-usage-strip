# Store listing package

Everything needed to publish AI Usage Strip on the Chrome Web Store and Firefox Add-ons (addons.mozilla.org). Images are in this folder; the packages come from `npm run build` or the GitHub release.

| File | Size | Use |
| --- | --- | --- |
| `screenshot-1-strip.png` | 1280×800 | Both stores: the strip above the chat box |
| `screenshot-2-details.png` | 1280×800 | Both stores: the details panel |
| `screenshot-3-dark.png` | 1280×800 | Both stores: dark theme with an estimate |
| `screenshot-4-popup.png` | 1280×800 | Both stores: the toolbar popup |
| `screenshot-5-settings.png` | 1280×800 | Both stores: settings |
| `promo-small-440x280.png` | 440×280 | Chrome small promo tile |
| `promo-marquee-1400x560.png` | 1400×560 | Chrome marquee promo tile |
| `store-icon-128.png` | 128×128 | Chrome store icon (same as the one in the package) |

The screenshots were recorded on stand-in chat pages. Swap in real ones from claude.ai and chatgpt.com when you can; reviewers and users trust real screenshots more.

## Chrome Web Store

Developer Dashboard: <https://chrome.google.com/webstore/devconsole>. Registering a developer account costs a one-time US$5 fee.

1. **Add new item** and upload `ai-usage-strip-chromium-v1.0.0.zip`.
2. Fill the tabs below, then **Submit for review**.

### Store listing tab

- **Description:**

  ```text
  See how much of your AI chat limit is left, right above the chat box.

  AI Usage Strip adds a slim strip on top of the message box on Claude, ChatGPT, Gemini, Perplexity, Grok and DeepSeek. It shows:

  • Plan limit: how much of your plan's limit you've used, as a meter and a percentage
  • Reset timer: when the limit resets, or when your oldest message frees a slot
  • Context fill: roughly how many tokens the conversation holds
  • Messages: how many you've sent today

  On Claude the numbers are live, the same as Settings > Usage. ChatGPT, Gemini, Perplexity and Grok don't share usage with the page, so the strip counts the messages you send and compares them with the plan you choose in settings.

  Click the strip for details: every limit window with its reset time, the context breakdown and a 7-day history. The toolbar popup shows every site at once.

  It matches each site's light or dark theme and trims itself on narrow screens.

  Private: everything stays in your browser. No accounts, analytics or ads.
  Free and open source: https://github.com/Ramachokkalingam/ai-usage-strip

  AI Usage Strip is an independent project and is not affiliated with Anthropic, OpenAI, Google, Perplexity, xAI or DeepSeek.
  ```

- **Category:** Productivity, in the closest subcategory the dashboard offers.
- **Language:** English.
- **Graphic assets:** the store icon, the five screenshots in order, both promo tiles.
- **Homepage URL:** `https://github.com/Ramachokkalingam/ai-usage-strip`
- **Support URL:** `https://github.com/Ramachokkalingam/ai-usage-strip/issues`

### Privacy practices tab

- **Single purpose:**

  ```text
  Shows the user's AI chat usage (plan limit, reset time, context size and messages sent) above the chat box on supported AI chat sites.
  ```

- **Permission justification, `storage`:**

  ```text
  Saves the user's settings, the times of messages they send and their latest claude.ai usage in the browser, so the strip and popup can show usage across page loads. Nothing is sent off the device.
  ```

- **Permission justification, host permissions:**

  ```text
  Needed to show the strip above the chat box on these AI chat sites (claude.ai, chatgpt.com, chat.openai.com, gemini.google.com, perplexity.ai, grok.com, chat.deepseek.com) and, on claude.ai, to read the user's own usage from claude.ai with their existing session. The extension runs on no other sites.
  ```

- **Remote code:** No, I am not using remote code.
- **Data usage:** Chrome counts data handled only on the device, so declare what the extension reads, even though nothing leaves the browser:
  - Website content (it reads the chat page's text to estimate tokens)
  - Personal communications (that page text is the user's chat)
  - User activity (it records when the user sends a message)
- **Certifications:** tick all three (not sold to third parties, not used for unrelated purposes, not used for creditworthiness or lending).
- **Privacy policy URL:** `https://github.com/Ramachokkalingam/ai-usage-strip/blob/main/PRIVACY.md`

### Distribution tab

Public, all regions.

## Firefox Add-ons

Developer Hub: <https://addons.mozilla.org/developers/>. Free.

1. **Submit a New Add-on**, choose **On this site** (listed), upload `ai-usage-strip-firefox-v1.0.0.zip`.
2. **Platforms:** Firefox for desktop (Linux, macOS, Windows). Android isn't tested.
3. **Source code:** No. The package isn't minified or transpiled, so it is the source.
4. Fill the listing, then submit.

### Listing

- **Name:** AI Usage Strip
- **Summary** (208 of 250 characters):

  ```text
  See how much of your AI chat limit is left, right above the chat box on Claude, ChatGPT, Gemini, Perplexity, Grok and DeepSeek: plan usage, reset time, context size and messages sent. Private and open source.
  ```

- **Description:** the Chrome description above; Markdown is supported.
- **Categories:** up to two; pick the closest productivity and tools categories offered.
- **Support email:** an address you're happy to publish. **Support site:** `https://github.com/Ramachokkalingam/ai-usage-strip/issues`
- **Homepage:** `https://github.com/Ramachokkalingam/ai-usage-strip`
- **License:** MIT
- **Privacy policy:** paste the text of `PRIVACY.md`.
- **Screenshots:** the five screenshots (1280×800). Mozilla asks for no text on screenshots; these have none added.

### Notes to reviewer

```text
No build step: the uploaded zip is the source (github.com/Ramachokkalingam/ai-usage-strip).

Network: on claude.ai only, the content script requests https://claude.ai/api/organizations and /api/organizations/{id}/usage with the user's own session (via content.fetch) to show their plan usage. It makes no other network requests and sends nothing to the developer.

To test: sign in to claude.ai or chatgpt.com and open a chat. The strip appears above the message box. Settings are under the toolbar popup's Settings button.
```

## After approval

- Add the store links to the README's quick start and tick the roadmap item.
- Bump `version` in `src/manifest.json` and `package.json` for every update; both stores reject a re-upload with the same version.
