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

## Visitor statistics

Cloudflare Web Analytics is off until `PUBLIC_WEB_ANALYTICS_TOKEN` is present in
the build environment. Create the site in the Cloudflare dashboard and choose
the **manual** setup — automatic injection would add the beacon outside this
repository, where the privacy notice cannot see it and would drift out of step
with what is actually collected. Copy the token from the snippet Cloudflare
offers; the layout renders the beacon and the privacy notice reveals its
visitor-statistics section from that one value.

`public/_headers` already names the two Cloudflare hosts in the CSP, so nothing
else has to change when the token is set.

## Deployment

```sh
npm run deploy
```

Cloudflare serves `dist/` as static assets. Only `/api/*` runs through the
Worker first; unknown site routes still use the branded static 404 page.
