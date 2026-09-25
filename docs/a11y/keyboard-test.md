# Keyboard test notes

## Methodology (read this first)

Every result in this document was produced by a **scripted WebDriver walkthrough**,
not by a human pressing keys. The script drives real Chrome via
`selenium-webdriver` + `chromedriver`, sends genuine `Tab` / `Shift+Tab` / `Enter`
key events through the browser's input pipeline (not synthetic DOM events), and
reads `document.activeElement` and the live region's `textContent` after each
step — the same signals a human tester would use their eyes and a screen reader
for. No step in this document was performed by a human with a physical keyboard.
No screen reader (NVDA/JAWS/VoiceOver) was used — the live-region checks confirm
the *text is set into* a `role="status" aria-live="polite"` element, which is the
correct mechanism for a screen reader to pick it up, but actual screen-reader
announcement was not listened to.

- **Chrome version:** 153.0.8010.53 (`C:\Program Files (x86)\Google\Chrome\Application\153.0.8010.53`)
- **chromedriver version:** 153.0.3 (pinned via `package.json` `overrides`, confirmed with `npm ls chromedriver`)
- **selenium-webdriver version:** 4.44.0
- **Build under test:** production (`npm run build` && `node .output/server/index.mjs`), served at `http://localhost:3000`
- **Script location:** throwaway, in the session scratchpad only
  (`.../scratchpad/keyboard-walkthrough.cjs`), **not committed** — per instructions,
  this is verification tooling, not part of the project's one deliberately-kept
  test file (`tests/cart.store.spec.ts`).
- **Live product used:** id `4` — "Classic Grey Hooded Sweatshirt". `/products/2`
  from the original brief no longer exists in the public Platzi Fake Store API;
  id 4 was resolved live by fetching `/products` and reading the first
  `href="/products/N"` link, then confirmed by loading `/products/4` and
  checking its rendered `<h1>`.
- The cart Pinia store holds state only in memory (no persistence). The script
  therefore uses exactly one full page load per logical phase, and afterwards
  navigates only via keyboard-activated `NuxtLink`s (client-side SPA navigation),
  the same way a real user would move between pages without losing cart state.
  Skip-link and tab-order checks (Phases 1–3) each start from their own fresh
  full load since they don't depend on cart state.
- The script was run three times while being debugged. The first two runs
  surfaced **script bugs**, not app bugs, described below; the third run is the
  one whose results are reported here. All failures found along the way are
  disclosed in "Notes on the process" at the end — nothing was silently
  papered over.

## Flow

| Step | Keys | How verified | Result |
|---|---|---|---|
| Reveal skip link | Tab from fresh page load | Scripted: read `document.activeElement` immediately after one `Tab` | Focus lands on `<a class="skip-link" href="#main">Skip to main content</a>` on the very first Tab. |
| Skip link becomes visible | (same Tab, then wait) | Scripted: `getBoundingClientRect().top` read immediately (`-48px`, off-screen) and again 250ms later (`+16px`, on-screen) | The link has `transition: top 0.15s`, so it visibly slides on-screen over ~150ms rather than appearing instantly. After the transition settles it is fully on-screen with a visible focus ring (`:focus-visible` outline from `main.css`). This is a real, intentional CSS animation, not a defect — flagged here only because the script's first pass measured position at t=0 and mis-reported it as a failure before the wait was added. |
| Activate skip link | Enter | Scripted: read `document.activeElement` after Enter | Focus moves to `<main id="main" tabindex="-1">`. Confirmed working. |
| Tab order through the grid | Tab × 12 from fresh load | Scripted: logged each of the first 12 stops | Order is: skip link → header brand link (`/products`) → header cart link (`/cart`) → card 1 link (`/products/4`) → card 1 "Add to cart" → card 2 link → card 2 "Add to cart" → … i.e. link-then-button per card, in DOM/visual order. Sensible, no surprises. |
| Add to cart (first product) | Enter on "Add to cart" (reached after 5 Tabs from load) | Scripted: read header cart link text before/after; read the live region's `textContent` after | Header text changed from `"Cart (0)Cart, 0 items"` to `"Cart (1)Cart, 1 item"`. Live region text became `"Classic Grey Hooded Sweatshirt added to cart"`. |
| Add the **same** product again | Enter again on the still-focused "Add to cart" button | Scripted: installed a `MutationObserver` on the live region before the second press, then read both the recorded mutation list and the final text | The observer recorded two mutations — text cleared to `""`, then re-set to `"Classic Grey Hooded Sweatshirt added to cart"` — confirming the announcer's clear-then-set behaviour actually fires a second, distinct DOM mutation (so a screen reader has something new to announce) rather than being a no-op because the string is unchanged. |
| Reach the cart | Shift+Tab back to the header cart link (2 shift-tabs from the "Add to cart" button, since the header sits before the grid in DOM order), then Enter | Scripted: read `document.activeElement`, then `location.href` after Enter | Reached the link (text `"Cart (2)Cart, 2 items"`), Enter navigated to `/cart` via client-side routing (cart state preserved). |
| Same product added twice → one line, qty 2 | (result of the two adds above) | Scripted: queried `.cart-line` elements on `/cart` | Exactly **one** `.cart-line`, with title "Classic Grey Hooded Sweatshirt" and quantity input value `"2"` — not two separate lines. Confirms `cart.add()`'s existing-line-merge logic. |
| Change quantity | Tab to the quantity input (2 tabs), Ctrl+A, type `5`, Tab out | Scripted: read `.cart-total strong` text before/after, and the header badge after | Total changed from `€180.00` to `€450.00`; header badge updated to `"Cart (5)Cart, 5 items"`. |
| Set quantity to 0 | Ctrl+A, type `0`, Tab out | Scripted: counted `.cart-line` elements before/after | Line count went from 1 to 0 — the line was removed, matching `setQuantity`'s "quantity < 1 → remove" behaviour. |
| Remove a line via the "Remove" button | Re-added the product from `/products` (keyboard, SPA nav), Shift+Tab to the header cart link (2 shift-tabs), Enter to `/cart`, Tab to "Remove" (3 tabs), Enter | Scripted: counted `.cart-line` before/after; read the live region before/after | Line count went from 1 to 0; live region text became `"Classic Grey Hooded Sweatshirt removed from cart"`. |
| Paginate / disabled buttons | Tab through the whole page-1 DOM (40 tabs) | Scripted: checked `document.activeElement.disabled` on every stop | The disabled "Previous page" button (confirmed disabled via `:disabled` selector) was **never** the active element during the full forward Tab sweep — it is correctly removed from the tab order rather than being a focusable dead end. "Next page" and the per-page `<select>` were both reached normally. |
| No keyboard trap | Shift+Tab from the last forward stop, repeated 15 more times | Scripted: compared `document.activeElement` description at each step, watched for a repeat (stuck focus) | Focus moved backward every time; no repeated/stuck state was observed anywhere in the sweep. |

## Observations

- Focus is visible on every interactive element hit during the walkthrough (via the
  global `:focus-visible { outline: var(--focus-ring); ... }` rule) — this was
  read from `main.css`, not independently re-measured pixel-by-pixel by the
  script, so treat "visible" here as "not suppressed in CSS" rather than a
  rendered-pixel check.
- No keyboard trap: Shift+Tab reverses cleanly the whole way back, verified by
  script (see table).
- Buttons that repeat per row ("Add to cart", "Remove") do carry visually-hidden
  product names (`Add to cart<span class="visually-hidden">: {{ product.title }}</span>`
  in `ProductCard.vue` and `Remove<span class="visually-hidden"> {{ line.title }} from cart</span>`
  in `cart.vue`), confirmed by reading the source and by the script's captured
  accessible-name text (e.g. `"Add to cart: Classic Grey Hooded Sweatshirt"`,
  `"RemoveClassic Grey Hooded Sweatshirt from cart"`).
- Disabled pagination buttons are correctly skipped by Tab rather than being
  focusable dead ends — verified by script, not just by reading markup.
- The header cart link sits before the product grid in DOM order, so returning
  to it from a card's "Add to cart" button requires Shift+Tab (going back up
  the page), not further Tab presses. This is normal/expected page structure,
  not a defect — noted here because it tripped up the first version of the
  test script itself.
- On client-side (SPA) navigation back to `/products`, the grid refetches from
  the real external GraphQL API (`https://api.escuelajs.co/graphql`) and this
  measurably takes over 400ms; a short fixed wait after such a navigation is
  not enough to reliably find the "Add to cart" buttons. This is a property of
  depending on a live third-party API from the client, not an accessibility
  defect, but worth knowing if anyone re-runs or extends this script.
- Screen-reader announcement itself (NVDA/JAWS/VoiceOver actually reading the
  text aloud) was **not** tested — only that the correct ARIA live-region
  mechanism (`role="status" aria-live="polite"`) receives the clear-then-set
  text mutations that would trigger such an announcement. This is a
  known limitation of automating with WebDriver rather than a real AT.

## axe scans

All three scans below ran against the **production build**
(`npm run build` && `node .output/server/index.mjs`, port 3000), using
`@axe-core/cli` 4.13.0 with chromedriver 153.0.3 (pinned via `package.json`
`overrides` to match installed Chrome 153).

| Page | URL scanned | Violations | Incomplete | Passes |
|---|---|---|---|---|
| Product list | `http://localhost:3000/products` | 0 (after fix — see below) | 0 | 44 |
| Product detail | `http://localhost:3000/products/4` | 0 | 0 | 37 |
| Cart | `http://localhost:3000/cart` | 0 | 0 | 34 |

**One real violation was found and fixed**, on the product list page:

- **Rule:** `image-redundant-alt` (12 occurrences — one per product card).
- **Cause:** `components/ProductCard.vue` set the card image's `alt` to
  `product.title`, and the card's visible `<h2 class="card__title">{{ product.title }}</h2>`
  sits inside the *same* `<NuxtLink>`. The link's accessible name was therefore
  the image's alt text concatenated with the heading text — the product name
  announced twice for every card link (e.g. "Classic Grey Hooded Sweatshirt
  Classic Grey Hooded Sweatshirt, link").
- **Fix:** changed the image to `alt=""` (it is purely decorative once the
  adjacent visible heading already names the product), so the link's
  accessible name now comes only from the `<h2>` text. Re-scanned after
  rebuilding — 0 violations.
- No violation was suppressed or hidden. No false positives were encountered
  in any of the three scans; there is nothing in `incomplete` on any page
  either (0 across all three).

The **cart page scan reflects the empty-cart state only** — the page is
server-rendered and the cart store has no server-side or persisted state, so a
fresh `axe http://localhost:3000/cart` request always sees an empty cart (the
"Your cart is empty. Browse products." message), never a populated cart. The
populated-cart markup (cart lines, quantity inputs, Remove buttons, total) was
exercised only by the scripted keyboard walkthrough above, not by axe.

Raw JSON output is committed at `docs/a11y/axe-products.json`,
`docs/a11y/axe-product-detail.json`, and `docs/a11y/axe-cart.json`.

There was no Contentful delivery token available in this environment, so the
CMS promo banner never rendered on any scanned page (`[promo-banner] Contentful
credentials missing; skipping banner` in the server log) — the list-page scan
covers the page without the banner.

## axe DevTools

*(Developer task, not yet done.)* Extension screenshot pending at
`docs/evidence/axe-devtools-products.png` — not created by this pass.
CLI output: `docs/a11y/axe-*.json` (committed).
