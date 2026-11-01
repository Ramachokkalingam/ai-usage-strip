# Security policy

## Supported versions

Security fixes go into the latest release only.

## Reporting a vulnerability

Please don't open a public issue for security problems.

Report them privately through GitHub: open the repository's **Security** tab and click **Report a vulnerability**. Include what you found, how to reproduce it, and which browser and version you used.

The maintainer aims to reply within a week. Once a fix is ready, it ships in a new release and the advisory is published with credit to you, unless you'd rather stay anonymous.

## What counts

The extension runs on AI chat sites where people are signed in, so these matter most:

- Anything that lets a web page or another extension read or change the extension's stored data or settings.
- Anything that sends data off the user's machine. The extension is designed to make no network requests except reading usage from claude.ai with the user's own session.
- Script injection through text the extension displays.
