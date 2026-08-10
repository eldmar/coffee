# KAVOVO

KAVOVO is a static Astro site with a small Cloudflare Worker for newsletter and
shop waitlist subscriptions.

## Local development

```sh
npm install
astro dev --background
```

Use `astro dev status`, `astro dev logs`, and `astro dev stop` to manage the
background server.

## Checks

```sh
npm test
npm run verify
```

`npm run verify` runs unit tests, builds the static site, checks generated pages
and assets, and bundles the Worker without deploying it.

## Subscription setup

Subscriptions stay hidden unless `PUBLIC_SUBSCRIPTIONS_ENABLED=true` is present
in the Astro build environment. Before enabling it:

1. Create a Brevo contact list, double opt-in template, and text contact
   attribute named `SOURCE`.
2. Store `BREVO_API_KEY`, `BREVO_LIST_ID`, and `BREVO_DOI_TEMPLATE_ID` with
   `wrangler secret put`. Do not put their real values in `.env` or Git.
3. Set `PUBLIC_SUBSCRIPTIONS_ENABLED=true` in the production build environment.
4. Run `npm run verify`, deploy, and test both `homepage-newsletter` and
   `shop-waitlist` with a real inbox.

The Worker applies separate rate limits to hashed email and IP keys. Their
5-per-minute and 30-per-minute thresholds live in `wrangler.jsonc`.

For local Worker testing, copy `.dev.vars.example` to `.dev.vars` and replace
the placeholders. The local secrets file is ignored by Git.

## Deployment

```sh
npm run deploy
```

Cloudflare serves `dist/` as static assets. Only `/api/*` runs through the
Worker first; unknown site routes still use the branded static 404 page.
