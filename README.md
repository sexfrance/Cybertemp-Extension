# CyberTemp Extensions Architecture

This directory contains the source code for the CyberTemp browser extensions, ensuring a native experience on both Chrome and Firefox.

## Supported Browsers

| Browser | Manifest Version | Status | Path |
| :--- | :--- | :--- | :--- |
| **Chrome** | V3 | ✅ Stable | [`chrome/`](chrome/) |
| **Firefox** | V3 | ✅ Stable | [`firefox/`](firefox/) |

## Architecture Overview

The extensions are built using a **Next.js Static Export** workflow. This allows us to use modern React features, TailwindCSS, and the Shadcn UI library to build a premium interface, which is then compiled into standard HTML/CSS/JS for the browser extension.

### key Components

1.  **Next.js App Router:** Handles the UI routing within the extension popup.
2.  **Build Script (`build-extension.js`):** A custom Node.js script that:
    -   Runs `next build` to generate a static site.
    -   Post-processes the output to be compatible with extension CSP (Content Security Policy).
    -   Renames `_next` folders (underscores are restricted in some extension stores) to `next`.
    -   Extracts inline scripts to separate files to satisfy Manifest V3 requirements.

## Development Workflow

### Shared Code
Currently, the extensions maintain separate `app` directories but can share logic if configured. We use a monorepo-style approach where `chrome` and `firefox` are independent Next.js apps.

### Running Locally

**Chrome:**
```bash
cd extensions/chrome
npm install && npm run build
# Load unpacked 'out' folder in chrome://extensions
```

**Firefox:**
```bash
cd extensions/firefox
npm install && npm run build
# Load temporary add-on 'out/manifest.json' in about:debugging
```
## Contributing

1.  **Code Style:** Follow standard React/Next.js best practices.
2.  **Testing:** Always test in *both* Chrome and Firefox before submitting major changes, as API differences (especially around `chrome.runtime` vs `browser.runtime`) can cause issues.
