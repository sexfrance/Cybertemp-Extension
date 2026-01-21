# CyberTemp - Premium Temp Mail (Firefox)

![CyberTemp Logo](icons/icon.png)

**Secure, fast, and anonymous temporary email service with autofill capabilities.**

## Overview

This is the Firefox version of the CyberTemp extension. It is built using the same Next.js core as the Chrome version but adapted for Firefox. It supports Manifest V3 (with some Firefox-specific adjustments where necessary).

### Key Features

-   **Instant Email Generation:** Get a temporary email address in seconds.
-   **Autofill:** Automatically fill email fields on websites with your temporary address.
-   **Live Inbox:** Real-time email updates without refreshing.
-   **Privacy Focused:** No personal data collected.

## Installation (Developer Mode)

To run this extension locally in Firefox:

1.  **Build the Project:**
    (Same build process as Chrome)
    ```bash
    npm install
    npm run build
    ```
    This generates the extension in the `out/` directory.

2.  **Load in Firefox:**
    -   Open Firefox and go to `about:debugging#/runtime/this-firefox`.
    -   Click **Load Temporary Add-on...**.
    -   Navigate to the `extensions/firefox/out` directory.
    -   Select any file in that directory (e.g., `manifest.json`).

## Development

The development workflow uses Next.js. To make UI changes:

1.  Run `npm run dev` in the `extensions/firefox` directory.
2.  Open `http://localhost:3000` to view the popup UI in a browser context.

## Publishing

This extension is automatically built and synced to the release repository via GitHub Actions when changes are pushed to `main`.
