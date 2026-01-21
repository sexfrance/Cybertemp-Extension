# CyberTemp - Premium Temp Mail Extension

![CyberTemp Logo](icons/icon.png)

**Secure, fast, and anonymous temporary email service with autofill capabilities.**

## Overview

CyberTemp is a premium browser extension (Manifest V3) built with Next.js, React, and TailwindCSS. It provides instant access to temporary email addresses, keeping your primary inbox clean from spam, phishing, and unwanted promotional emails.

### Key Features

-   **Instant Email Generation:** Get a temporary email address in seconds.
-   **Autofill:** Automatically fill email fields on websites with your temporary address.
-   **Live Inbox:** Real-time email updates without refreshing.
-   **Premium UI:** A sleek, modern interface powered by Shadcn UI and TailwindCSS.
-   **Secure & Anonymous:** No personal information required.
-   **Manifest V3:** Fully compliant with the latest Chrome Extension standards.

## Tech Stack

-   **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
-   **UI Library:** [React 19](https://react.dev/) & [Shadcn UI](https://ui.shadcn.com/)
-   **Styling:** [TailwindCSS v3](https://tailwindcss.com/)
-   **Icons:** [Lucide React](https://lucide.dev/)
-   **Build Tool:** Custom Node.js script for Next.js -> Chrome Extension adaptation.

## Installation (Developer Mode)

To run this extension locally:

1.  **Prerequisites:** Ensure you have Node.js (v18+) and npm installed.

2.  **Install Dependencies:**
    ```bash
    npm install
    # or
    pnpm install
    # or
    yarn install
    ```

3.  **Build the Project:**
    ```bash
    npm run build
    # or
    pnpm run build
    ```
    This command will:
    -   Run `next build` to generate the static export.
    -   Execute `build-extension.js` to process the output for Chrome (e.g., renaming `_next` to `next`, extracting inline scripts).
    -   Output the final extension to the `out/` directory.

4.  **Load in Chrome:**
    -   Open Chrome and navigate to `chrome://extensions/`.
    -   Enable **Developer mode** (toggle in the top right).
    -   Click **Load unpacked**.
    -   Select the `out/` directory generated in the previous step.

## Development

To start the Next.js development server (for UI testing):

```bash
npm run dev
```

*Note: `npm run dev` starts a standard web server. Extension-specific APIs (like `chrome.storage`, `chrome.runtime`) will not work in this mode unless mocked.*

## Project Structure

```
extensions/chrome/
├── app/                 # Next.js App Router pages
├── components/          # Reusable UI components
├── public/
│   ├── icons/           # Extension icons
│   ├── manifest.json    # Chrome Extension Manifest V3
│   └── ...
├── build-extension.js   # Post-build script to adapt Next.js for Chrome
├── next.config.js       # Next.js configuration (static export)
└── package.json         # Project dependencies and scripts
```

## Contributing

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/amazing-feature`).
3.  Commit your changes (`git commit -m 'Add some amazing feature'`).
4.  Push to the branch (`git push origin feature/amazing-feature`).
5.  Open a Pull Request.

## License

[MIT](LICENSE)
