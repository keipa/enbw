# Mini e-commerce storefront — design

Date: 2026-09-25
Status: Approved, ready for implementation planning

## 1. Goal

Build a small Nuxt 3 storefront that exercises each required tool once, properly:
SSR, Nitro, Pinia, GraphQL/Apollo, a headless CMS, accessibility, performance,
and an ADR. The brief's own instruction governs scope: *keep it small*. Breadth
of tooling beats depth of features.

Source brief: `prompt.txt` (repo root).

## 2. Decisions

Each row was decided explicitly during design. Rationale is recorded because
several of these will be questioned by a reviewer.

| # | Decision | Rationale |
|---|---|---|
| 1 | Products come from the Platzi Fake Store GraphQL API (`https://api.escuelajs.co/graphql`) | Verified live during design: real remote GraphQL, products and categories, variables supported, no auth for reads. Caveat: shared public database, data can be scruffy, so the UI must degrade gracefully. |
| 2 | The Nitro route fronts Contentful, not the product API | Gives a clean split to explain — Apollo owns products, Nitro owns editorial. Keeps the delivery token server-side, reshapes a genuinely nested response, and leaves one place to swap CMS. |
| 3 | The Contentful content model is created by hand in the Contentful UI from the spec in section 6 | Satisfies the "content model you created" evidence row by definition, needs no Content Management API token, takes minutes. |
| 4 | Second GraphQL operation is a second query (`product(id:)`), not a mutation | The detail page needs it anyway. Smallest surface consistent with "keep it small". No mutation ships. |
| 5 | List page uses `limit`/`offset` pagination | Gives the query variables real work, keeps payloads small for Lighthouse, and supplies the labelled form control the accessibility row requires (page-size `<select>`). |
| 6 | Nuxt 3.21.11, not Nuxt 4.5.2 | The brief names Nuxt 3 repeatedly and a reviewer works down a checklist. Pins the stable Nuxt-3-targeted module line. |
| 7 | Apollo Client wired by hand in a Nuxt plugin, consumed via `useAsyncData` | The only Nuxt 3 Apollo module is an alpha (`@nuxtjs/apollo@5.0.0-alpha.14`). Hand wiring keeps every dependency stable, avoids SSR cache-hydration surprises, and `useAsyncData`'s `pending`/`error` supply the required loading and error states. |
| 8 | Hand-written CSS with a design-token layer | No dependency, tiny CSS payload for Lighthouse, and it puts focus rings and contrast visibly in our own hands, which is what the accessibility row grades. |
| 9 | Cart is in-memory Pinia only | Exactly what the brief requires (survives navigation). No persistence. The README states this as a scope decision so a reviewer who refreshes does not read it as a bug. |
| 10 | CMS model is a promo banner with an image asset | Small enough to build and screenshot quickly; the image asset doubles as the Lighthouse issue to fix via the Contentful Images API. |
| 11 | GitHub Actions, with the remote created by the user | Produces a real green run as evidence rather than unexecuted YAML. No `gh` CLI is available in this environment. |
| 12 | Lighthouse fix is hand-rolled image work, measured organically | Platzi's imgur JPEGs are oversized and undimensioned, so the baseline is genuinely poor. No new dependency, consistent with decision 8. |
| 13 | GraphQL responses typed by hand, colocated with each operation | No codegen pipeline, no build-time dependency on a public demo API. Accepted risk: the types are a claim about the server, not a guarantee. |
| 14 | One unit test, on the cart store | Literal compliance with the brief's rule. |
| 15 | Cart lives on a dedicated `/cart` page with a header badge | No focus trap or modal semantics, so the graded keyboard-only flow is straightforward to get right and to document. |
| 16 | ADR 0001 records SSR vs SSG for product pages | The brief's own example, and genuinely arguable given a mutable public catalogue. |
| 17 | TypeScript pinned to 5.9.3, not 7.0.2 | TypeScript 7 is the Go-port rewrite. `vue-tsc` declares only `typescript >=5.0.0`, which is a permissive range rather than evidence of support, and Nuxt 3.21 pins no TypeScript of its own. Same reasoning as decision 6: stay on the line the toolchain is proven against, since a broken `typecheck` step would fail a graded row. |

## 3. Stack

- `nuxt@3.21.11` (SSR enabled)
- `@apollo/client@3.14.1`, `graphql@16.14.2` (v4 / v17 are incompatible with the Vue-Apollo ecosystem)
- `pinia@3.0.4`, `@pinia/nuxt@0.11.3` (the Nuxt-3-targeted line)
- `vitest@5.0.2`
- `@lhci/cli@0.15.1`, `@axe-core/cli@4.13.0` (dev only)
- `typescript@5.9.3`, `vue-tsc@3.3.11`, `strict: true` (see decision 17)

No alpha or release-candidate dependencies.

## 4. Architecture and data flow

### Routes

| Route | Purpose |
|---|---|
| `/` | Redirect to `/products` |
| `/products` | Product list, paginated via `?page` and `?perPage` |
| `/products/[id]` | Product detail (the required dynamic route) |
| `/cart` | Cart with quantity controls and removal |

### Products path — Apollo

`ApolloClient` is instantiated **inside** `plugins/apollo.ts`, not at module
scope. Nuxt plugins run once per request on the server, so each request gets a
fresh `InMemoryCache`. A module-scope client would share one cache across every
visitor — an SSR data-leak bug.

Pages never touch Apollo directly. They call composables that wrap
`useAsyncData(key, () => client.query(...))`. On first load the query runs on
the server and the result is serialised into the Nuxt payload; the client
hydrates without refetching. On later client-side navigation the same composable
runs in the browser and hits the Apollo cache.

### Editorial path — Nitro

The list page calls `useFetch('/api/promo-banner')`. The handler runs
server-side only and reads Contentful credentials from the server half of
`runtimeConfig`, which is never serialised to the client. During SSR `useFetch`
invokes the handler in-process, with no HTTP round trip to our own server.

### Cart path — Pinia

Client-side state. The server renders an empty cart; the store fills after
hydration. No persistence (decision 9).

### What runs where

| Server | Browser |
|---|---|
| First product query, Contentful fetch and token handling, initial HTML, SEO meta | Cart mutations, pagination after hydration, product queries on client-side navigation |

### Pagination

`?page` and `?perPage` map to `limit`/`offset` variables. Platzi returns no
total count, so the query requests `limit + 1` items; the extra item's presence
determines whether "Next" is enabled, and it is not rendered.

## 5. Code structure

```
components/   AppHeader.vue  ProductCard.vue  PromoBanner.vue
              PaginationNav.vue  DataState.vue
composables/  useProducts.ts  useProduct.ts
graphql/      products.ts
plugins/      apollo.ts
pages/        index.vue  products/index.vue  products/[id].vue  cart.vue
server/       api/promo-banner.get.ts  utils/contentful.ts
stores/       cart.ts
types/        product.ts  promo.ts
tests/        cart.store.spec.ts
docs/         adr/  lighthouse/  a11y/
```

### Components

`ProductCard` is the required reusable component with props and emits. It takes
`product: Product` and emits `add(product)`. It stays presentational — the page
calls the store — which keeps it reusable on both the list and detail pages.

`DataState` renders the required loading and error states: an `aria-busy`
skeleton while pending, and on error a `role="alert"` message with a Retry
button wired to `refresh()`.

### Composables

- `useProducts({ page, perPage })` returns `{ products, hasNext, pending, error, refresh }`
- `useProduct(id)` returns `{ product, pending, error, refresh }`

### Store

```ts
interface CartLine {
  id: string
  title: string
  price: number
  image: string | null
  quantity: number
}
```

State `items: CartLine[]`; getters `totalItems`, `totalPrice`; actions `add`,
`remove`, `setQuantity`, `clear`. `add` merges quantity when the line already
exists.

Consumed by four components — list page, detail page, header badge, cart page —
clearing the brief's "at least two" requirement.

## 6. Contracts

### GraphQL operations

```graphql
query Products($limit: Int!, $offset: Int!) {
  products(limit: $limit, offset: $offset) {
    id
    title
    price
    images
    category { id name }
  }
}

query Product($id: ID!) {
  product(id: $id) {
    id
    title
    price
    description
    images
    category { id name }
  }
}
```

### Domain types

```ts
interface Category { id: string; name: string }
interface Product {
  id: string
  title: string
  price: number
  images: string[]
  category: Category
}
interface ProductDetail extends Product { description: string }
```

Because the Platzi database is public and writable by anyone, `images` can
contain malformed entries. A `firstImage(product)` helper returns the first
entry that parses as an HTTP(S) URL, falling back to a local placeholder.

### Contentful content model

Content type ID `promoBanner`:

| Field ID | Type | Required | Notes |
|---|---|---|---|
| `heading` | Short text | yes | |
| `body` | Short text | no | |
| `ctaLabel` | Short text | no | |
| `ctaUrl` | Short text | no | URL validation |
| `image` | Media, one file | no | |
| `isActive` | Boolean | no | default true |

At least one published entry with `isActive` true is required.

### Nitro route

`GET /api/promo-banner` returns `PromoBanner | null`

```ts
interface PromoBannerImage {
  url: string
  alt: string
  width: number
  height: number
}
interface PromoBanner {
  heading: string
  body: string | null
  ctaLabel: string | null
  ctaUrl: string | null
  image: PromoBannerImage | null
}
```

Upstream call is Contentful's **REST Content Delivery API**, chosen over its
GraphQL endpoint deliberately: CDA returns entries and linked assets in separate
arrays (`items` plus `includes.Asset`), so the route performs real reshaping —
resolving the asset link, flattening the entry, and appending Images API
parameters (`?w=1200&fm=webp&q=70`) to the asset URL. This makes the "proxies or
reshapes data" requirement substantive, and keeps GraphQL unambiguously the
products story.

Request shape:

```
GET https://cdn.contentful.com/spaces/{SPACE}/environments/{ENV}/entries
    ?content_type=promoBanner&fields.isActive=true&limit=1&include=1
Authorization: Bearer {DELIVERY_TOKEN}
```

Failure behaviour: if Contentful errors, times out, or no active entry exists,
the route returns `null` and the banner renders nothing. Editorial content
failing must not take down the storefront. This degradation is documented in the
README.

### Configuration

```ts
runtimeConfig: {
  contentfulSpaceId: '',
  contentfulDeliveryToken: '',
  contentfulEnvironment: 'master',
  public: { graphqlEndpoint: 'https://api.escuelajs.co/graphql' },
}
```

Environment variables, with `.env.example` committed and `.env` ignored:
`NUXT_CONTENTFUL_SPACE_ID`, `NUXT_CONTENTFUL_DELIVERY_TOKEN`,
`NUXT_CONTENTFUL_ENVIRONMENT`, `NUXT_PUBLIC_GRAPHQL_ENDPOINT`.

## 7. Accessibility

Built in from the start rather than retrofitted:

- Semantic landmarks (`header`, `nav`, `main`), one `h1` per page, ordered headings
- Skip link to main content
- Product images use the product title as `alt`; the banner image uses the Contentful asset description
- `:focus-visible` rings defined in the token layer; outlines never removed
- Accessible names that stand alone — "Remove Classic Red Hoodie from cart", not "Remove"
- `aria-live="polite"` region announcing "Added to cart", since a keyboard-only user otherwise gets no feedback
- Labelled form controls: the pagination page-size `<select>` and the cart quantity inputs

Verification: a scripted `@axe-core/cli` run with output saved to `docs/a11y/`,
plus a manual axe DevTools scan and a keyboard walkthrough (list, detail, add to
cart, cart, remove) performed by the developer.

## 8. Performance

Baseline Lighthouse run on `/products` **before** any image work, with the
report committed. Then the fix:

- Explicit `width`/`height` on product and banner images to eliminate CLS
- `fetchpriority="high"` on the LCP image, `loading="lazy"` below the fold
- Contentful Images API parameters for the banner asset
- `preconnect` to the image hosts

Both reports committed to `docs/lighthouse/before/` and `docs/lighthouse/after/`.

## 9. CI

`.github/workflows/ci.yml`: install, `nuxi typecheck`, `vitest run`, `build`,
start server, `lhci autorun`.

Assertion thresholds in `.lighthouserc.json`:

- accessibility at least 0.95 — error
- performance at least 0.80 — error
- best-practices, SEO — warning

Performance scores on shared CI runners are noisy. A threshold that flakes red
trains a team to ignore CI, so the performance bar is set where it will hold.
The README records this reasoning.

## 10. Testing

One Vitest unit test, `tests/cart.store.spec.ts`, covering the cart store:
adding a new line, adding an existing line (quantity merges rather than
duplicating), removing, and the `totalPrice` getter. No DOM or Nuxt test
environment is needed, which avoids the `@nuxt/test-utils` version friction on
Nuxt 3.

## 11. Documentation

- `docs/adr/0001-ssr-vs-ssg-for-product-pages.md` — SSR chosen because the
  Platzi catalogue is mutable and publicly writable, so prerendering risks stale
  prices; the cost is a render per request.
- `README.md` — setup, environment variables, the required note on where the
  Nitro route would run in production (stateless and I/O-bound, so Node server,
  serverless, or edge all work; the edge caveat is no Node built-ins and a
  benefit that depends on proximity to Contentful's CDN rather than to a
  database), the cart-persistence scope decision, the CI threshold reasoning,
  and links to all evidence.

## 12. Evidence plan

| Evidence | Produced by |
|---|---|
| Server-rendered HTML | Raw SSR response saved to `docs/evidence/` by script; the brief asks for a *screenshot* of view-source, so the developer captures that from the browser |
| Lighthouse before/after | `@lhci/cli` against local Chrome, committed |
| axe scan output | `@axe-core/cli`, committed |
| Contentful content model screenshot | Developer, in the Contentful UI |
| axe DevTools panel screenshot | Developer, browser extension |
| Keyboard-test notes | Developer, following a supplied checklist |

## 13. Requirement coverage

| Brief row | Satisfied by |
|---|---|
| Vue 3 | `<script setup>` throughout; `ProductCard` props and emits; `useProducts` / `useProduct` |
| Nuxt 3 | `pages/products/[id].vue`; SSR with `useAsyncData` and `useFetch`; `useSeoMeta` |
| Nitro | `/api/promo-banner` reshaping CDA; README production note |
| Pinia | Cart store, four consuming components, survives navigation |
| GraphQL & Apollo | `products(limit, offset)` with variables; `product(id)`; `DataState` loading and error states |
| Headless CMS | `promoBanner` model, rendered on the list page |
| Accessibility | Section 7 |
| Lighthouse | Section 8 |
| ADR | `docs/adr/0001-ssr-vs-ssg-for-product-pages.md` |
| Rules | TypeScript strict; cart store unit test; Lighthouse threshold in CI |

## 14. Non-goals

Checkout, payments, authentication, cart persistence, search or category
filtering, GraphQL mutations, internationalisation, and deployment. Each was
considered and excluded to honour the brief's "keep it small" instruction.

## 15. External dependencies

Implementation blocks on two items supplied by the developer:

1. A GitHub repository URL, created manually — no `gh` CLI is available here.
2. A Contentful space with the `promoBanner` model built and at least one
   published entry, plus `NUXT_CONTENTFUL_SPACE_ID` and
   `NUXT_CONTENTFUL_DELIVERY_TOKEN` in `.env`.

Work that does not depend on these — the Nuxt app, Apollo wiring, product pages,
cart, store, test, and the Nitro route built against the documented contract —
proceeds without them.
