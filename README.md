# EnBW Mini Storefront

A small server-rendered Nuxt 3 storefront: product list, product detail and a
working cart. Product data comes from a GraphQL API, editorial content from
Contentful through a Nitro server route.

## Setup

```bash
npm install
cp .env.example .env   # add your Contentful delivery token
npm run dev
```

Requires Node 20.19+ or 22.12+.

### Environment variables

| Variable | Purpose |
|---|---|
| `NUXT_CONTENTFUL_SPACE_ID` | Contentful space (`5ek3f7n6ag1n`) |
| `NUXT_CONTENTFUL_DELIVERY_TOKEN` | Content Delivery API token — server-side only |
| `NUXT_CONTENTFUL_ENVIRONMENT` | Contentful environment, defaults to `master` |
| `NUXT_PUBLIC_GRAPHQL_ENDPOINT` | Product GraphQL API |

Without Contentful credentials the app runs normally and simply omits the banner.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm run start` | Production build and serve |
| `npm run typecheck` | `vue-tsc` over the project |
| `npm test` | Vitest unit tests |
| `npm run a11y` | axe-core scan of the list page |
| `npm run lighthouse:ci` | Lighthouse with the CI thresholds |

## Architecture

Two separate data paths, deliberately:

**Products → Apollo.** `ApolloClient` is created inside `plugins/apollo.ts`, not
at module scope, so each server request gets its own `InMemoryCache`. A
module-scope client would share one cache across every visitor. Pages call
`useProducts` / `useProduct`, which wrap `useAsyncData`, so the first render
happens on the server and the client hydrates from the payload without refetching.

**Editorial → Nitro.** `/api/promo-banner` holds the Contentful token in the
server half of `runtimeConfig` and reshapes the Content Delivery API's split
`items` + `includes.Asset` response into a flat DTO. During SSR, `useFetch` calls
this handler in-process — no HTTP round trip to our own server.

**Cart → Pinia**, client-side only.

### What runs where

| Server | Browser |
|---|---|
| First product query, Contentful fetch and token, initial HTML, SEO meta | Cart mutations, pagination after hydration, queries on client-side navigation |

### The promo-banner route's actual response

`/api/promo-banner` returns one of two things, and both are intentional:

- **HTTP 200** with the banner DTO, when an active `promoBanner` entry exists.
- **HTTP 204, empty body**, in every other case — no active entry, missing
  Contentful credentials, an upstream error, or a request that exceeds the 3s
  timeout. The handler's return type is `PromoBanner | null`; h3 maps a literal
  `null` return to `sendNoContent()`, which is a 204, not "200 with a null body".
  The client-side `useFetch` treats a 204 the same as "no banner" and simply
  omits it.

### Where the Nitro route would run in production

`/api/promo-banner` is stateless and I/O-bound: it holds a token, makes one
outbound HTTPS call and reshapes JSON. That means it runs anywhere.

- **Node server** — simplest; one long-lived process, easy to add an in-memory cache.
- **Serverless** — a natural fit given the workload is short and bursty. Cold starts
  add latency to a request that is already waiting on Contentful.
- **Edge** — lowest latency to the user, but no Node built-ins, and the benefit
  depends on being near Contentful's CDN rather than near a database. Since this
  route's latency is dominated by the upstream call, edge buys less than it appears to.

For this app, a Node server or serverless function is the right default. The
decision would change if the route grew to aggregate several sources.

## Scope decisions

- **The cart does not survive a page reload.** The brief requires it to survive
  navigation, which in-memory Pinia does. Persistence was considered and left out
  as scope. A cookie-backed store would be the natural next step, and would also
  let the server render the correct cart badge in the initial HTML.
- **No GraphQL mutation.** The brief allows a second query instead, and the detail
  page needs `product(id:)` regardless.
- **Contentful failures degrade silently.** If the CMS errors, times out, or no
  active entry exists, the route returns `null` (204, see above) and the banner
  is omitted. Editorial content failing should not take down a storefront.
- **An unknown product id renders the error state, not a 404.** The upstream
  GraphQL API returns `INTERNAL_SERVER_ERROR` for an id that doesn't exist,
  rather than a clean null result, so Apollo throws and `DataState` shows its
  error panel (`role="alert"`) with a retry action. `GET /products/99999999`
  is therefore HTTP 200 with an error page, not a 404. This is a property of the
  upstream API, documented here rather than engineered around with a synthesised
  404 that the brief doesn't ask for.
- **The `images.ctfassets.net` preconnect anticipates the configured deployment.**
  It is present in `nuxt.config.ts` alongside the product-image host, but is
  unexercised while no Contentful delivery token is set — no requests to that
  host happen until the banner actually renders.

## Accessibility

Semantic landmarks, one `h1` per page, a skip link, visible `:focus-visible`
rings that are never suppressed, labelled form controls, and per-row accessible
names so repeated buttons are distinguishable. Adding to the cart is announced
through a polite live region.

**Product card images use `alt=""`, not the product title.** The design intent
was "product images use the product title as alt", and that's still true on the
detail page — but on the product list, axe found 12 real `image-redundant-alt`
violations (one per card): the card image sat inside the same `NuxtLink` as the
`<h2>` carrying the product title, so the link's accessible name concatenated
the alt text with the heading and every card announced its name twice (e.g.
"Classic Grey Hooded Sweatshirt Classic Grey Hooded Sweatshirt, link"). The fix
sets the card image to `alt=""`: it's correct because the adjacent heading
already names the link, so the image is decorative in that context. The detail
page keeps `alt="product.title"` on its image because that image is not wrapped
in an interactive element — there's no heading to concatenate with, so the alt
text is the only accessible description of the image and using it is correct.

**Accessibility was verified by a scripted WebDriver walkthrough, not by a
human, and screen readers were not tested.** `docs/a11y/keyboard-test.md`
describes a `selenium-webdriver` script driving real Chrome through Tab/Shift+Tab/
Enter and reading `document.activeElement` and the live region's `textContent`.
It confirms that the correct mechanism (`role="status" aria-live="polite"`)
receives clear-then-set mutations when an item is added or removed — that is
the signal a screen reader would key off — but no screen reader (NVDA, JAWS,
VoiceOver) actually read anything aloud during this verification. Treat the
keyboard/focus/live-region findings as verified, and screen-reader announcement
itself as unverified.

- axe CLI output: `docs/a11y/axe-products.json`, `docs/a11y/axe-product-detail.json`, `docs/a11y/axe-cart.json` (0 violations on all three, after the fix above)
- Keyboard test notes: `docs/a11y/keyboard-test.md`
- axe DevTools screenshot: not yet captured — see "Outstanding items" below

## Performance

Lighthouse on `/products`, production build, **mobile defaults**
(`formFactor: mobile`, simulated throttling — the same configuration the CI
gate in `.lighthouserc.json` now collects under), median of 3 runs.

| | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| Before | 78 | 100 | 100 | 100 |
| After | 91 | 100 | 100 | 100 |

**What actually happened, in order:**

The baseline's real top opportunities were `uses-text-compression` (1190ms),
`unused-javascript` (900ms) and `server-response-time` (730ms). Images ranked
fifth, at ~210ms (`uses-responsive-images`) — nowhere near "the dominant
opportunity" the original plan assumed.

**First attempt — image loading, and it did not work.** The LCP element was
still the first product card image, and it was carrying a blanket
`loading="lazy"`, which is a genuine bug worth fixing on its own merits. The
fix made the first row `eager`/`fetchpriority="high"` and left the rest lazy,
and added preconnects for both image hosts. Result: performance moved from 78
to 79 — inside run-to-run noise (the baseline's own best individual run was
already 79; the three baseline runs were 76/78/79). LCP timing was essentially
unchanged before and after (~4.1–4.3s both times). The predicted CLS
improvement also didn't materialize, because CLS was already 0 before this fix
— intrinsic `width`/`height` had been declared on images much earlier in the
build, so there was no layout shift left to fix.

**Second attempt — compression, and it worked.** The actual top opportunity,
`uses-text-compression`, was addressed directly: Nitro's `compressPublicAssets`
(gzip + brotli) was enabled, so built JS/CSS assets are pre-compressed and
served with a matching `Content-Encoding`. This moved performance to 91 (before:
76/78/79; after: 89/91/92 — no overlap between the two ranges, so this is a real
improvement, not noise). `uses-text-compression` fell from 1190ms to 150ms.

**The limit of that fix, stated precisely:** `compressPublicAssets` only
pre-compresses static assets (JS/CSS bundles) written to disk at build time. The
SSR HTML document itself is still served uncompressed — verified with `curl`
against the running server: `GET /products` has no `Content-Encoding` header.
The bare Node server (`node .output/server/index.mjs`) does not gzip responses
it generates per-request; that's ordinarily a reverse-proxy or CDN concern, out
of scope for this app.

**What's left, on purpose.** `server-response-time` is now ~858ms and is the
largest remaining opportunity in the after report. It is the SSR wait on the
upstream GraphQL call and is deliberately unaddressed here — fixing it means
caching or ISR, which [ADR 0001](docs/adr/0001-ssr-vs-ssg-for-product-pages.md)
explicitly defers as a "revisit if it becomes a problem" decision, not an
oversight.

Full reports: `docs/lighthouse/before/` and `docs/lighthouse/after/` (JSON + HTML,
3 runs each).

## CI

`.github/workflows/ci.yml` runs typecheck, unit tests, build and Lighthouse on
every push and pull request.

Thresholds: accessibility ≥ 0.95 and performance ≥ 0.80 fail the build;
best-practices and SEO warn. The performance bar is set well below the measured
91: shared CI runners are noisy, and a gate that flakes red teaches people to
ignore CI, so the bar is set where it will hold rather than where it looks
impressive. `.lighthouserc.json` collects under the same mobile defaults used
for the before/after evidence above (no desktop preset), so the CI gate and the
published numbers describe the same configuration rather than the gate
measuring an easier one.

## Testing

One unit test, on the cart store (`tests/cart.store.spec.ts`): adding, merging
quantity on a repeat add, removal, removal via a zero quantity, and the total
getter.

## Known local issue (Windows only)

`lhci collect` crashes locally on Windows with an `EPERM` during
chrome-launcher's temp-directory cleanup (Lighthouse's report is already
generated by that point — this is antivirus/file-locking, not a bug in this
project). It's worked around by a one-line patch to gitignored
`node_modules/lighthouse/node_modules/chrome-launcher/dist/chrome-launcher.js`
(log instead of throw during cleanup). That patch lives only in `node_modules`
and is **not part of any commit** — it must be reapplied after any fresh
`npm install` if you want to run `npm run lighthouse:ci` locally on Windows. CI
is unaffected: it runs on Ubuntu, where this doesn't occur.

## Outstanding items requiring the developer

These are not implemented in this pass and nothing below should be read as
already existing:

- **Contentful setup.** No `promoBanner` content type or delivery token exists
  in this environment. The banner code path (`server/api/promo-banner.get.ts`,
  the list-page render, its 200/204 behaviour) has not been exercised against a
  live Contentful space — only against missing credentials. Someone with
  Contentful access needs to create the content type, add an active entry, and
  set `NUXT_CONTENTFUL_DELIVERY_TOKEN` to verify the banner actually renders.
- `docs/evidence/axe-devtools-products.png` — axe DevTools browser-extension
  screenshot. Not captured.
- `docs/evidence/view-source-products.png` — view-source screenshot proving SSR
  HTML. Not captured (`docs/evidence/products-ssr.html`, the raw SSR HTML
  response saved to disk, is committed instead and can stand in for this).
- `docs/evidence/ci-run.png` — screenshot of a green CI run. Not captured; no
  run has been pushed yet, since this branch has not been pushed or opened as
  a PR.
- `docs/evidence/contentful-model.png` — content model screenshot, blocked on
  the same Contentful setup above.

## Decision records

- [ADR 0001: SSR vs SSG for product pages](docs/adr/0001-ssr-vs-ssg-for-product-pages.md)
