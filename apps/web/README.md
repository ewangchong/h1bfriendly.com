# H1B Friend (Next.js Web)

This is the SEO-first Next.js React frontend for H1B Friendly.

## Requirements

1. Verify the `db` and `backend` containers are running via the root `docker-compose.yml`.
2. Ensure you have Node 20+ installed.
3. Make sure to define your variables in `.env` based on `.env.example`. Do NOT commit it.

## Local Dev

```bash
npm install
npm run dev
```

The web app will run on `http://localhost:3000`.

## Build & Docker

The `next.config.ts` is configured for `output: "standalone"` to ensure minimal image sizes when built as a Docker container.

To build manually:

```bash
npm run build
```

## 🎨 Notable Features

- **Dynamic Year Filtering**: The UI automatically detects available data years per filter state.
- **Global Loading State**: Visual feedback via a CSS spinner during data fetches.
- **Mobile Responsive**: Fully optimized for mobile and desktop viewing.
- **Null Safety**: Comprehensive `COALESCE` and null-check logic to prevent UI crashes on sparse datasets.
