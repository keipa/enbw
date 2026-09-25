# 1. Server-side rendering for product pages

Date: 2026-09-25

## Status

Accepted

## Context

Product list and detail pages are the core of the storefront. Nuxt offers three
rendering strategies for them:

- **SSG** — prerender every product page at build time.
- **SSR** — render on each request.
- **ISR/SWR** — render on demand and cache for a window.

Product data comes from the Platzi Fake Store API, a public demo endpoint that
is writable by anyone. Prices, titles and the set of products all change without
notice, and the catalogue has no stable size.

Both correctness and first-paint performance matter. So does SEO: product pages
must return complete HTML to crawlers.

## Decision

Render product list and detail pages with SSR on every request.

## Consequences

**What this buys us**

- Prices and availability are never stale. For a storefront this is not a
  preference; a wrong price is a wrong page.
- Crawlers and social scrapers get complete HTML, so `useSeoMeta` tags are
  present in the initial response rather than applied after hydration.
- No build-time coupling to the catalogue. The build does not enumerate products,
  so it cannot break when the upstream API is down or the catalogue grows.

**What it costs**

- A server render and an upstream GraphQL request per page view. Time-to-first-byte
  depends on the upstream API's latency, which we do not control. Measured: the
  `server-response-time` Lighthouse audit is ~858ms on the current build and is
  the largest remaining performance opportunity (see `README.md`) — this cost is
  real, not theoretical.
- A server must be running. This rules out pure static hosting.
- Traffic spikes hit the product API directly. A production deployment would need
  a cache in front — ISR or SWR on the Nitro layer would be the natural next step.

**Why not SSG**

SSG would give the fastest possible TTFB and the cheapest hosting, but it requires
enumerating every product at build time and rebuilding whenever data changes.
Against an API that mutates continuously and has no webhook available to us, the
result would be a storefront that confidently serves stale prices.

**Why not ISR now**

ISR is the pragmatic middle ground and would likely be correct at real scale, and
it is the direct answer to the `server-response-time` cost above. It is out of
scope here because it adds cache-invalidation questions this exercise does not
need to answer, and because the brief explicitly asks for SSR. The measured
~858ms upstream wait is being carried deliberately rather than accidentally —
see the README's performance section for the same trade-off from the
measurement side. Revisit if request volume against the product API becomes a
problem, or if the ~858ms response time needs to come down without giving up
per-request freshness.
