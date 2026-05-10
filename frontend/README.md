# Voyarr Frontend

The frontend for Voyarr is built with **React**, **Vite**, and **Material UI**. It operates as a fully installable **Progressive Web App (PWA)**, meaning you can install it to your desktop or mobile device for a native-like experience.

## Features
- **Dashboard:** Overview of system health and active downloads.
- **Provider & Credential Management:** Securely input credentials for various media sites.
- **Library & Duplicates:** Manage your local media and resolve duplicates based on perceptual hashing (phash).
- **Download Rules:** Configure multi-criteria rules for Mass Ripping and automated downloads.
- **PWA Ready:** Includes a web manifest, service workers, and scalable icons for standalone installation.

## Development

If you are developing without Docker:

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## PWA Configuration
PWA features are powered by `vite-plugin-pwa`. The manifest is automatically generated and injected during the build process. Icons are sourced from `public/favicon.svg`.
