# Privacy policy

AI Usage Strip is a browser extension made by Ramachokkalingam. This policy explains what it handles and where that data goes. Short version: everything stays in your browser.

Last updated: 1 November 2026

## What the extension handles

| Data | Why | Where it stays |
| --- | --- | --- |
| The time each message is sent on a supported site | To count messages sent today and estimate how much of a plan limit you've used | Your browser's extension storage |
| The text shown on the chat page | To estimate how many tokens the conversation holds | Read in memory when the page changes; never stored |
| Your claude.ai usage percentages and reset times | To show your real Claude plan usage | Your browser's extension storage |
| Your settings (plans, limits, display choices) | To remember how you set the extension up | Your browser's extension storage |
| Limit notices shown by a site | To show "Limit reached" until the window resets | Your browser's extension storage |

The extension notices when you press Enter in a site's chat box or click its send button, only to record the time of the send. It doesn't record what you typed, and it doesn't watch keys anywhere else.

## Network requests

The extension makes one kind of request: on claude.ai it asks claude.ai for your usage (`/api/organizations` and `/api/organizations/{id}/usage`), using your existing signed-in session, the same way claude.ai's own Settings page does. The answer is kept in your browser.

It sends nothing to the developer or to anyone else. There are no analytics, ads, trackers or remote code.

## Sharing and selling

User data is never sold, shared, transferred to third parties, used for advertising, or used to decide creditworthiness or for lending.

## Keeping and deleting data

Message times older than eight days are deleted automatically. You can delete all history at any time on the settings page with **Clear message history**, or export it with **Export as JSON**. Uninstalling the extension deletes everything it stored.

## Changes

Changes to this policy are published in this file, with the date above updated.

## Contact

Questions or concerns: open an issue at <https://github.com/Ramachokkalingam/ai-usage-strip/issues>, or report privately through the repository's Security tab.
