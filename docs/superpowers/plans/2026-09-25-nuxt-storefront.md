# Nuxt 3 Mini Storefront Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a small server-rendered Nuxt 3 storefront with a product list, product detail page and working cart, drawing products from a GraphQL API and editorial content from Contentful through a Nitro route.

**Architecture:** Two deliberately separate data paths. Products flow through Apollo Client, instantiated per-request inside a Nuxt plugin and consumed via `useAsyncData` so the first render happens on the server. Editorial content flows through a Nitro server route that holds the Contentful token, calls the REST Content Delivery API and reshapes its split entry/asset response into a flat DTO. Cart state is client-side Pinia.

**Tech Stack:** Nuxt 3.21.11 (SSR), Apollo Client 3.14.1, graphql 16.14.2, Pinia 3.0.4, TypeScript 5.9.3, Vitest 5.0.2, Lighthouse CI 0.15.1, hand-written CSS.

**Spec:** `docs/superpowers/specs/2026-09-25-nuxt-storefront-design.md`

## Global Constraints

- **Nuxt 3.21.11 exactly.** Not Nuxt 4. The brief names Nuxt 3 and pinning avoids a checklist argument.
- **No alpha or release-candidate dependencies.** This is why Apollo is wired by hand rather than via `@nuxtjs/apollo`, whose only Nuxt 3 build is an alpha.
- **Apollo Client 3.x and graphql 16.x.** Apollo Client 4 and graphql 17 are incompatible with the Vue-Apollo ecosystem. Import from `@apollo/client/core`, never `@apollo/client`, or the React entry point is pulled in.
- **TypeScript 5.9.3, `strict: true`.** Not TypeScript 7 (the Go-port rewrite); `vue-tsc` declares only `>=5.0.0`, which is a permissive range rather than evidence of support.
- **No cart persistence.** In-memory Pinia only. This is a scope decision recorded in the README, not an oversight.
- **No GraphQL mutations.** The second operation is the `product(id:)` query.
- **Accessibility is built in per task, not retrofitted.** Every interactive control gets a visible focus style and an accessible name that stands alone.
- **Product API:** `https://api.escuelajs.co/graphql` (Platzi Fake Store). Public, shared and writable by anyone, so all rendering must tolerate malformed data.
- **Contentful space ID:** `5ek3f7n6ag1n`. Delivery token is supplied by the developer in a gitignored `.env`.
- **Commit after every task.** Repo is `https://github.com/keipa/enbw.git`, branch `main` tracking `origin/main`.
- **Shell:** commands are written for Git Bash, which is available here. In PowerShell, translate: `VAR=x cmd` becomes `$env:VAR = 'x'; cmd`; `mkdir -p x` becomes `New-Item -ItemType Directory -Force x`; `rm -rf x` becomes `Remove-Item -Recurse -Force x`.

---

## File Structure

| File | Responsibility |
|---|---|
| `nuxt.config.ts` | SSR, modules, runtimeConfig, global head |
| `package.json` | Pinned dependencies, scripts, chromedriver override |
| `assets/css/tokens.css` | Colour, spacing, type and focus-ring custom properties |
| `assets/css/main.css` | Reset, base typography, shared component classes |
| `layouts/default.vue` | Skip link, header, `<main>`, live region, footer |
| `components/AppHeader.vue` | Brand, primary nav, cart badge (store consumer 1) |
| `components/ProductCard.vue` | Reusable card — props `product`, emits `add` |
| `components/DataState.vue` | Loading / error / content states for async data |
| `components/PaginationNav.vue` | Prev/next and labelled page-size select |
| `components/PromoBanner.vue` | Renders the CMS banner DTO |
| `composables/useProducts.ts` | Paginated product list via Apollo + `useAsyncData` |
| `composables/useProduct.ts` | Single product via Apollo + `useAsyncData` |
| `composables/useAnnouncer.ts` | Shared polite live-region message |
| `graphql/products.ts` | Both query documents and their result types |
| `plugins/apollo.ts` | Per-request ApolloClient, provided as `$apollo` |
| `stores/cart.ts` | Cart state, getters, actions, `CartLine` type |
| `types/product.ts` | `Category`, `Product`, `ProductDetail` |
| `types/promo.ts` | `PromoBanner`, `PromoBannerImage` |
| `utils/image.ts` | `firstImage` — tolerates malformed Platzi image arrays |
| `utils/format.ts` | `formatPrice` |
| `server/api/promo-banner.get.ts` | Nitro route: fetch, degrade gracefully |
| `server/utils/contentful.ts` | `mapPromoBanner` — pure CDA reshaping |
| `pages/index.vue` | Redirect to `/products` |
| `pages/products/index.vue` | List page |
| `pages/products/[id].vue` | Detail page (dynamic route) |
| `pages/cart.vue` | Cart page (store consumer 4) |
| `tests/cart.store.spec.ts` | The one required unit test |
| `.github/workflows/ci.yml` | typecheck, test, build, Lighthouse gate |
| `.lighthouserc.json` | Lighthouse assertions |
| `docs/adr/0001-*.md` | SSR vs SSG decision record |

---

### Task 1: Project scaffold and tooling baseline

**Files:**
- Create: `package.json`, `nuxt.config.ts`, `tsconfig.json`, `app.vue`, `pages/index.vue`, `.gitignore`, `.gitattributes`, `.env.example`

**Interfaces:**
- Consumes: nothing.
- Produces: a booting Nuxt 3 app. `runtimeConfig.public.graphqlEndpoint: string`, `runtimeConfig.contentfulSpaceId/contentfulDeliveryToken/contentfulEnvironment: string` (server-only). npm scripts `dev`, `build`, `start`, `typecheck`, `test`, `a11y`, `lighthouse:ci`.

- [ ] **Step 1: Create `.gitattributes`**

Git warned about LF→CRLF on the spec commit. Without this, every file churns between Windows and the Ubuntu CI runner.

```
* text=auto eol=lf
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules
.nuxt
.output
.data
dist
.env
*.log
.DS_Store
.lighthouseci
```

- [ ] **Step 3: Create `package.json`**

`overrides.chromedriver` is load-bearing: `@axe-core/cli` depends on `chromedriver: latest` (154), but the machine has Chrome 153. Without the override, axe fails with `SessionNotCreatedError`.

```json
{
  "name": "enbw-storefront",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "preview": "nuxt preview",
    "start": "node .output/server/index.mjs",
    "postinstall": "nuxt prepare",
    "typecheck": "nuxt typecheck",
    "test": "vitest run",
    "a11y": "axe http://localhost:3000/products --save docs/a11y/axe-products.json",
    "lighthouse:ci": "lhci autorun"
  },
  "dependencies": {
    "@apollo/client": "3.14.1",
    "graphql": "16.14.2",
    "nuxt": "3.21.11",
    "pinia": "3.0.4",
    "vue": "^3.5.43",
    "vue-router": "^4.6.4"
  },
  "devDependencies": {
    "@axe-core/cli": "4.13.0",
    "@lhci/cli": "0.15.1",
    "@pinia/nuxt": "0.11.3",
    "typescript": "5.9.3",
    "vitest": "5.0.2",
    "vue-tsc": "3.3.11"
  },
  "overrides": {
    "chromedriver": "153.0.3"
  }
}
```

- [ ] **Step 4: Create `nuxt.config.ts`**

`htmlAttrs.lang` is required — axe flags a missing `lang` as a violation, and it would cost an accessibility point in the graded Lighthouse run.

```ts
export default defineNuxtConfig({
  compatibilityDate: '2026-09-25',
  ssr: true,
  modules: ['@pinia/nuxt'],
  typescript: { strict: true },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },
  runtimeConfig: {
    contentfulSpaceId: '',
    contentfulDeliveryToken: '',
    contentfulEnvironment: 'master',
    public: {
      graphqlEndpoint: 'https://api.escuelajs.co/graphql',
    },
  },
})
```

- [ ] **Step 5: Create `tsconfig.json`**

```json
{
  "extends": "./.nuxt/tsconfig.json"
}
```

- [ ] **Step 6: Create `.env.example`**

The space ID is not a secret and is committed deliberately so the next developer only has to supply a token.

```
NUXT_CONTENTFUL_SPACE_ID=5ek3f7n6ag1n
NUXT_CONTENTFUL_DELIVERY_TOKEN=
NUXT_CONTENTFUL_ENVIRONMENT=master
NUXT_PUBLIC_GRAPHQL_ENDPOINT=https://api.escuelajs.co/graphql
```

- [ ] **Step 7: Create `app.vue`**

```vue
<template>
  <NuxtPage />
</template>
```

- [ ] **Step 8: Create `pages/index.vue`**

Temporary content so the app renders something verifiable. Task 5 replaces this with the redirect once `/products` exists.

```vue
<template>
  <h1>EnBW Storefront</h1>
</template>
```

- [ ] **Step 9: Install dependencies**

Run: `npm install`
Expected: completes without `ERESOLVE`. React is an *optional* peer of `@apollo/client`, so it is not installed.

- [ ] **Step 10: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exits 0, no errors.

If it fails complaining about the `vue-tsc` version, downgrade with `npm install -D vue-tsc@2.2.12` and rerun. Do not change the TypeScript version.

- [ ] **Step 11: Verify the app builds and serves**

Run: `npm run build`
Expected: exits 0, writes `.output/`.

Run in a second terminal: `npm run dev`
Run: `curl -s http://localhost:3000/ | grep -c "EnBW Storefront"`
Expected: `1` or more — proving the heading is in the server response, not injected by client JS.

- [ ] **Step 12: Commit**

```bash
git add .gitattributes .gitignore package.json package-lock.json nuxt.config.ts tsconfig.json app.vue pages/index.vue .env.example
git commit -m "chore: scaffold Nuxt 3 app with pinned toolchain"
```

---

### Task 2: Cart store with unit test

**Files:**
- Create: `stores/cart.ts`, `tests/cart.store.spec.ts`, `vitest.config.ts`

**Interfaces:**
- Consumes: `pinia` from Task 1.
- Produces: `useCartStore()` with state `items: CartLine[]`; getters `totalItems: number`, `totalPrice: number`; actions `add(product: CartAddition, quantity?: number)`, `remove(id: string)`, `setQuantity(id: string, quantity: number)`, `clear()`. Exported types `CartLine`, `CartAddition`.

`defineStore` is imported explicitly rather than relying on Nuxt auto-imports, so the store can be unit tested in a plain Vitest environment with no Nuxt runtime.

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
  },
})
```

- [ ] **Step 2: Write the failing test**

Create `tests/cart.store.spec.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCartStore } from '../stores/cart'

const hoodie = { id: '2', title: 'Classic Red Pullover Hoodie', price: 10, image: null }
const sweatshirt = { id: '4', title: 'Classic Grey Hooded Sweatshirt', price: 90, image: null }

describe('cart store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('adds a product as a single line with quantity one', () => {
    const cart = useCartStore()
    cart.add(hoodie)

    expect(cart.items).toHaveLength(1)
    expect(cart.items[0]).toMatchObject({ id: '2', quantity: 1 })
    expect(cart.totalItems).toBe(1)
  })

  it('merges quantity instead of duplicating when the same product is added twice', () => {
    const cart = useCartStore()
    cart.add(hoodie)
    cart.add(hoodie)

    expect(cart.items).toHaveLength(1)
    expect(cart.items[0].quantity).toBe(2)
    expect(cart.totalItems).toBe(2)
  })

  it('removes a line by id', () => {
    const cart = useCartStore()
    cart.add(hoodie)
    cart.add(sweatshirt)
    cart.remove('2')

    expect(cart.items).toHaveLength(1)
    expect(cart.items[0].id).toBe('4')
  })

  it('totals price across lines and quantities', () => {
    const cart = useCartStore()
    cart.add(hoodie, 3)
    cart.add(sweatshirt)

    expect(cart.totalPrice).toBe(120)
  })

  it('removes the line when quantity is set below one', () => {
    const cart = useCartStore()
    cart.add(hoodie)
    cart.setQuantity('2', 0)

    expect(cart.items).toHaveLength(0)
  })

  it('clears every line', () => {
    const cart = useCartStore()
    cart.add(hoodie)
    cart.add(sweatshirt)
    cart.clear()

    expect(cart.items).toHaveLength(0)
    expect(cart.totalPrice).toBe(0)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "../stores/cart"`.

- [ ] **Step 4: Implement `stores/cart.ts`**

```ts
import { defineStore } from 'pinia'

export interface CartAddition {
  id: string
  title: string
  price: number
  image: string | null
}

export interface CartLine extends CartAddition {
  quantity: number
}

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [] as CartLine[],
  }),
  getters: {
    totalItems: (state): number =>
      state.items.reduce((sum, line) => sum + line.quantity, 0),
    totalPrice: (state): number =>
      state.items.reduce((sum, line) => sum + line.price * line.quantity, 0),
  },
  actions: {
    add(product: CartAddition, quantity = 1) {
      const existing = this.items.find((line) => line.id === product.id)
      if (existing) {
        existing.quantity += quantity
        return
      }
      this.items.push({ ...product, quantity })
    },
    remove(id: string) {
      this.items = this.items.filter((line) => line.id !== id)
    },
    setQuantity(id: string, quantity: number) {
      const line = this.items.find((item) => item.id === id)
      if (!line) return
      if (quantity < 1) {
        this.remove(id)
        return
      }
      line.quantity = quantity
    },
    clear() {
      this.items = []
    },
  },
})
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 6 tests.

- [ ] **Step 6: Verify typecheck still passes**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts stores/cart.ts tests/cart.store.spec.ts
git commit -m "feat: add cart store with unit tests"
```

---

### Task 3: Design tokens, layout shell and header

**Files:**
- Create: `assets/css/tokens.css`, `assets/css/main.css`, `layouts/default.vue`, `components/AppHeader.vue`, `composables/useAnnouncer.ts`
- Modify: `nuxt.config.ts` (add `css` array), `app.vue` (wrap in `NuxtLayout`)

**Interfaces:**
- Consumes: `useCartStore` from Task 2.
- Produces: `useAnnouncer()` returning `{ message: Ref<string>, announce(text: string): Promise<void> }`. CSS classes available globally: `.container`, `.button`, `.visually-hidden`, `.skip-link`, `.card`, `.data-state`.

- [ ] **Step 1: Create `assets/css/tokens.css`**

Colours chosen for WCAG AA contrast on white: `--color-text` ≈ 16:1, `--color-text-muted` ≈ 6:1, `--color-accent` ≈ 5.4:1, and white on `--color-accent` ≈ 5.4:1.

```css
:root {
  --color-bg: #ffffff;
  --color-surface: #f6f7f9;
  --color-text: #14181f;
  --color-text-muted: #4a5565;
  --color-accent: #0b5cd5;
  --color-accent-hover: #0847a5;
  --color-on-accent: #ffffff;
  --color-danger: #a4232b;
  --color-border: #d4d9e0;

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;

  --radius: 8px;
  --focus-ring: 3px solid var(--color-accent);
  --focus-offset: 2px;

  --font-body: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --max-width: 72rem;
}
```

- [ ] **Step 2: Create `assets/css/main.css`**

The `:focus-visible` rule is deliberate: outlines are never removed, which is a graded accessibility requirement.

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: var(--font-body);
  color: var(--color-text);
  background: var(--color-bg);
  line-height: 1.5;
}

h1, h2, h3 {
  line-height: 1.2;
  margin: 0 0 var(--space-3);
}

img {
  max-width: 100%;
  height: auto;
}

a {
  color: var(--color-accent);
}

:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.container {
  width: 100%;
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0 var(--space-4);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.skip-link {
  position: absolute;
  left: var(--space-4);
  top: -3rem;
  z-index: 10;
  padding: var(--space-2) var(--space-4);
  background: var(--color-accent);
  color: var(--color-on-accent);
  border-radius: var(--radius);
  transition: top 0.15s ease-in-out;
}

.skip-link:focus {
  top: var(--space-4);
}

.button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: 1px solid transparent;
  border-radius: var(--radius);
  background: var(--color-accent);
  color: var(--color-on-accent);
  font: inherit;
  cursor: pointer;
  text-decoration: none;
}

.button:hover:not(:disabled) {
  background: var(--color-accent-hover);
}

.button:disabled {
  background: var(--color-surface);
  color: var(--color-text-muted);
  border-color: var(--color-border);
  cursor: not-allowed;
}

.button--quiet {
  background: transparent;
  color: var(--color-accent);
  border-color: var(--color-border);
}

.site-header {
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding-top: var(--space-4);
  padding-bottom: var(--space-4);
}

.brand {
  font-weight: 700;
  font-size: 1.125rem;
  color: var(--color-text);
  text-decoration: none;
}

main {
  padding-top: var(--space-6);
  padding-bottom: var(--space-8);
}

.site-footer {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-4);
  padding-bottom: var(--space-4);
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.data-state {
  padding: var(--space-4);
  background: var(--color-surface);
  border-radius: var(--radius);
}

.data-state--error {
  background: #fdf2f2;
  border: 1px solid var(--color-danger);
  color: var(--color-danger);
}
```

- [ ] **Step 3: Register the stylesheets in `nuxt.config.ts`**

Add the `css` key directly after `typescript`:

```ts
  css: ['~/assets/css/tokens.css', '~/assets/css/main.css'],
```

- [ ] **Step 4: Create `composables/useAnnouncer.ts`**

Clearing the message then setting it on the next tick forces screen readers to re-announce an identical message — adding the same product twice must speak twice.

```ts
import { nextTick } from 'vue'

export function useAnnouncer() {
  const message = useState<string>('announcer', () => '')

  async function announce(text: string) {
    message.value = ''
    await nextTick()
    message.value = text
  }

  return { message, announce }
}
```

- [ ] **Step 5: Create `components/AppHeader.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useCartStore } from '~/stores/cart'

const cart = useCartStore()

const cartLabel = computed(() =>
  cart.totalItems === 1 ? 'Cart, 1 item' : `Cart, ${cart.totalItems} items`,
)
</script>

<template>
  <header class="site-header">
    <div class="container header-inner">
      <NuxtLink to="/products" class="brand">EnBW Storefront</NuxtLink>
      <nav aria-label="Primary">
        <NuxtLink to="/cart" class="button button--quiet">
          <span aria-hidden="true">Cart ({{ cart.totalItems }})</span>
          <span class="visually-hidden">{{ cartLabel }}</span>
        </NuxtLink>
      </nav>
    </div>
  </header>
</template>
```

- [ ] **Step 6: Create `layouts/default.vue`**

`tabindex="-1"` on `<main>` makes the skip link actually move focus, not just scroll.

```vue
<script setup lang="ts">
const { message } = useAnnouncer()
</script>

<template>
  <a class="skip-link" href="#main">Skip to main content</a>
  <AppHeader />
  <main id="main" class="container" tabindex="-1">
    <slot />
  </main>
  <footer class="site-footer container">
    <p>Demo storefront. Product data from the Platzi Fake Store API.</p>
  </footer>
  <div class="visually-hidden" role="status" aria-live="polite">{{ message }}</div>
</template>
```

- [ ] **Step 7: Update `app.vue`**

```vue
<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
```

- [ ] **Step 8: Verify the shell renders server-side**

Run: `npm run dev`
Run: `curl -s http://localhost:3000/ | grep -c "Skip to main content"`
Expected: `1` or more.

Run: `curl -s http://localhost:3000/ | grep -c 'lang="en"'`
Expected: `1`.

- [ ] **Step 9: Verify the skip link by keyboard**

Open `http://localhost:3000/`, press Tab once.
Expected: "Skip to main content" becomes visible with a focus ring. Press Enter; focus moves into `<main>`.

- [ ] **Step 10: Commit**

```bash
git add assets/css layouts components/AppHeader.vue composables/useAnnouncer.ts nuxt.config.ts app.vue
git commit -m "feat: add design tokens, layout shell and header"
```

---

### Task 4: Apollo wiring and server-rendered product list

**Files:**
- Create: `types/product.ts`, `graphql/products.ts`, `plugins/apollo.ts`, `composables/useProducts.ts`, `pages/products/index.vue`

**Interfaces:**
- Consumes: `runtimeConfig.public.graphqlEndpoint` from Task 1.
- Produces: `$apollo: ApolloClient<NormalizedCacheObject>` on the Nuxt app. `useProducts({ page, perPage })` returning `{ products: ComputedRef<Product[]>, hasNext: ComputedRef<boolean>, pending: Ref<boolean>, error: Ref<Error | null>, refresh: () => Promise<void> }`. Types `Product`, `ProductDetail`, `Category`.

This task proves the data path end to end with a minimal page. Task 5 turns it into the real grid.

- [ ] **Step 1: Create `types/product.ts`**

```ts
export interface Category {
  id: string
  name: string
}

export interface Product {
  id: string
  title: string
  price: number
  images: string[]
  category: Category
}

export interface ProductDetail extends Product {
  description: string
}
```

- [ ] **Step 2: Create `graphql/products.ts`**

```ts
import { gql } from '@apollo/client/core'
import type { Product, ProductDetail } from '~/types/product'

export const PRODUCTS_QUERY = gql`
  query Products($limit: Int!, $offset: Int!) {
    products(limit: $limit, offset: $offset) {
      id
      title
      price
      images
      category {
        id
        name
      }
    }
  }
`

export const PRODUCT_QUERY = gql`
  query Product($id: ID!) {
    product(id: $id) {
      id
      title
      price
      description
      images
      category {
        id
        name
      }
    }
  }
`

export interface ProductsQueryResult {
  products: Product[]
}

export interface ProductQueryResult {
  product: ProductDetail | null
}
```

- [ ] **Step 3: Create `plugins/apollo.ts`**

The client is constructed inside the plugin body on purpose. Nuxt runs plugins once per request on the server, so every request gets its own `InMemoryCache`. A module-scope client would share one cache across all visitors — a genuine SSR data-leak bug.

```ts
import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client/core'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const client = new ApolloClient({
    link: new HttpLink({ uri: config.public.graphqlEndpoint }),
    cache: new InMemoryCache(),
    ssrMode: import.meta.server,
  })

  return {
    provide: { apollo: client },
  }
})
```

- [ ] **Step 4: Create `composables/useProducts.ts`**

Platzi returns no total count, so the query asks for one more item than it displays; the extra item's presence is what enables "Next".

```ts
import type { Ref } from 'vue'
import { computed } from 'vue'
import { PRODUCTS_QUERY, type ProductsQueryResult } from '~/graphql/products'
import type { Product } from '~/types/product'

export interface UseProductsOptions {
  page: Ref<number>
  perPage: Ref<number>
}

export function useProducts({ page, perPage }: UseProductsOptions) {
  const { $apollo } = useNuxtApp()

  const { data, pending, error, refresh } = useAsyncData(
    'products',
    async () => {
      const result = await $apollo.query<ProductsQueryResult>({
        query: PRODUCTS_QUERY,
        variables: {
          limit: perPage.value + 1,
          offset: (page.value - 1) * perPage.value,
        },
      })
      return result.data.products
    },
    { watch: [page, perPage] },
  )

  const products = computed<Product[]>(() =>
    (data.value ?? []).slice(0, perPage.value),
  )
  const hasNext = computed<boolean>(
    () => (data.value?.length ?? 0) > perPage.value,
  )

  return { products, hasNext, pending, error, refresh }
}
```

- [ ] **Step 5: Create `pages/products/index.vue`**

Minimal on purpose — this step is proving SSR + GraphQL, not styling.

```vue
<script setup lang="ts">
import { ref } from 'vue'

const page = ref(1)
const perPage = ref(12)
const { products, pending, error } = useProducts({ page, perPage })
</script>

<template>
  <h1>Products</h1>
  <p v-if="pending">Loading products…</p>
  <p v-else-if="error">Failed to load products.</p>
  <ul v-else>
    <li v-for="product in products" :key="product.id">{{ product.title }}</li>
  </ul>
</template>
```

- [ ] **Step 6: Verify products are server-rendered, not client-fetched**

Run: `npm run dev`
Run: `curl -s http://localhost:3000/products | grep -o "Classic Red Pullover Hoodie" | head -1`
Expected: prints `Classic Red Pullover Hoodie`.

This is the key check. The title appearing in raw `curl` output — with no JavaScript executed — proves the GraphQL query ran on the server.

- [ ] **Step 7: Verify the error state path**

Temporarily set `NUXT_PUBLIC_GRAPHQL_ENDPOINT=https://api.escuelajs.co/nope` in `.env`, restart dev, load `/products`.
Expected: "Failed to load products." renders instead of a crash or blank page.

Remove the override and restart before continuing.

- [ ] **Step 8: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 9: Commit**

```bash
git add types/product.ts graphql/products.ts plugins/apollo.ts composables/useProducts.ts pages/products/index.vue
git commit -m "feat: fetch products through Apollo with SSR"
```

---

### Task 5: Product grid with reusable card and add to cart

**Files:**
- Create: `utils/image.ts`, `utils/format.ts`, `components/ProductCard.vue`, `components/DataState.vue`, `public/placeholder.svg`
- Modify: `pages/products/index.vue`, `pages/index.vue`, `assets/css/main.css`

**Interfaces:**
- Consumes: `useProducts` (Task 4), `useCartStore` (Task 2), `useAnnouncer` (Task 3).
- Produces: `firstImage(images: string[] | null | undefined): string`, `formatPrice(value: number): string`. `ProductCard` — props `{ product: Product }`, emits `add(product: Product)`. `DataState` — props `{ pending: boolean, error: unknown, label: string }`, emits `retry()`, default slot for content.

- [ ] **Step 1: Create `public/placeholder.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300" role="img" aria-label="No image available">
  <rect width="300" height="300" fill="#f6f7f9"/>
  <path d="M90 190l40-50 30 35 25-30 35 45z" fill="#d4d9e0"/>
  <circle cx="115" cy="115" r="18" fill="#d4d9e0"/>
</svg>
```

- [ ] **Step 2: Create `utils/image.ts`**

The Platzi database is public and writable, so `images` routinely contains entries like `["https://..."]` stored as a single string, or plain junk. This helper is the reason the grid never renders a broken image.

```ts
const PLACEHOLDER = '/placeholder.svg'

export function firstImage(images: string[] | null | undefined): string {
  if (!images) return PLACEHOLDER

  for (const raw of images) {
    if (typeof raw !== 'string') continue

    const candidate = raw
      .trim()
      .replace(/^\[/, '')
      .replace(/\]$/, '')
      .replace(/^"/, '')
      .replace(/"$/, '')
      .trim()

    if (!candidate) continue

    try {
      const url = new URL(candidate)
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return url.toString()
      }
    } catch {
      continue
    }
  }

  return PLACEHOLDER
}
```

- [ ] **Step 3: Create `utils/format.ts`**

```ts
const formatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
})

export function formatPrice(value: number): string {
  return formatter.format(value)
}
```

- [ ] **Step 4: Create `components/DataState.vue`**

```vue
<script setup lang="ts">
defineProps<{
  pending: boolean
  error: unknown
  label: string
}>()

const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <p v-if="pending" class="data-state" aria-busy="true">Loading {{ label }}…</p>
  <div v-else-if="error" class="data-state data-state--error" role="alert">
    <p>Sorry, we couldn't load {{ label }}. Please try again.</p>
    <button type="button" class="button" @click="emit('retry')">Try again</button>
  </div>
  <slot v-else />
</template>
```

- [ ] **Step 5: Create `components/ProductCard.vue`**

The card stays presentational and emits rather than touching the store, so it is reusable anywhere. The `visually-hidden` span is what makes "Add to cart" a unique, self-describing accessible name — twelve identical "Add to cart" buttons on a page is an axe finding and a genuinely poor screen-reader experience.

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { Product } from '~/types/product'

const props = defineProps<{ product: Product }>()
const emit = defineEmits<{ add: [product: Product] }>()

const image = computed(() => firstImage(props.product.images))
const price = computed(() => formatPrice(props.product.price))
</script>

<template>
  <article class="card">
    <NuxtLink :to="`/products/${product.id}`" class="card__link">
      <img
        :src="image"
        :alt="product.title"
        class="card__image"
        width="300"
        height="300"
        loading="lazy"
        decoding="async"
      >
      <h2 class="card__title">{{ product.title }}</h2>
    </NuxtLink>
    <p class="card__price">{{ price }}</p>
    <button type="button" class="button" @click="emit('add', product)">
      Add to cart<span class="visually-hidden">: {{ product.title }}</span>
    </button>
  </article>
</template>
```

- [ ] **Step 6: Add grid and card styles to `assets/css/main.css`**

Append:

```css
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: var(--space-6);
  list-style: none;
  margin: 0;
  padding: 0;
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  height: 100%;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg);
}

.card__link {
  color: inherit;
  text-decoration: none;
}

.card__link:hover .card__title {
  text-decoration: underline;
}

.card__image {
  width: 100%;
  height: auto;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: var(--radius);
  background: var(--color-surface);
}

.card__title {
  font-size: 1rem;
  margin: var(--space-3) 0 0;
}

.card__price {
  margin: 0 0 var(--space-2);
  font-weight: 700;
}

.card button {
  margin-top: auto;
  justify-content: center;
}
```

- [ ] **Step 7: Replace `pages/products/index.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useCartStore } from '~/stores/cart'
import type { Product } from '~/types/product'

const page = ref(1)
const perPage = ref(12)
const { products, pending, error, refresh } = useProducts({ page, perPage })

const cart = useCartStore()
const { announce } = useAnnouncer()

useSeoMeta({
  title: 'Products — EnBW Storefront',
  description: 'Browse the full product catalogue and add items to your cart.',
  ogTitle: 'Products — EnBW Storefront',
  ogDescription: 'Browse the full product catalogue and add items to your cart.',
})

function addToCart(product: Product) {
  cart.add({
    id: product.id,
    title: product.title,
    price: product.price,
    image: firstImage(product.images),
  })
  announce(`${product.title} added to cart`)
}
</script>

<template>
  <h1>Products</h1>

  <DataState :pending="pending" :error="error" label="products" @retry="refresh">
    <p v-if="products.length === 0" class="data-state">No products found.</p>
    <ul v-else class="product-grid">
      <li v-for="product in products" :key="product.id">
        <ProductCard :product="product" @add="addToCart" />
      </li>
    </ul>
  </DataState>
</template>
```

- [ ] **Step 8: Replace `pages/index.vue` with the redirect**

```vue
<script setup lang="ts">
await navigateTo('/products', { redirectCode: 301 })
</script>

<template>
  <div />
</template>
```

- [ ] **Step 9: Verify the grid renders server-side**

Run: `npm run dev`
Run: `curl -s http://localhost:3000/products | grep -c "card__title"`
Expected: `12`.

Run: `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/`
Expected: `301 http://localhost:3000/products`.

- [ ] **Step 10: Verify add to cart works and announces**

In the browser, click "Add to cart" on two different products, then a third time on the first product.
Expected: the header badge reads `Cart (3)`. Inspect the live region in DevTools; its text updates on every click, including the repeat.

- [ ] **Step 11: Verify the badge reflects merged quantities**

Expected: adding the same product twice leaves 2 items in one line, so the badge counts 3 after three clicks across two products — matching the store behaviour Task 2 pinned.

Cart-survives-navigation is verified in Task 7 step 6, once a second real route exists to navigate to.

- [ ] **Step 12: Commit**

```bash
git add utils components/ProductCard.vue components/DataState.vue public/placeholder.svg pages assets/css/main.css
git commit -m "feat: add product grid with reusable card and add to cart"
```

---

### Task 6: Pagination with URL-synced state

**Files:**
- Create: `components/PaginationNav.vue`
- Modify: `pages/products/index.vue`, `assets/css/main.css`

**Interfaces:**
- Consumes: `useProducts` `hasNext` (Task 4).
- Produces: `PaginationNav` — props `{ page: number, perPage: number, hasNext: boolean }`, emits `update:page(value: number)` and `update:perPage(value: number)`.

Page state lives in the URL so the server renders the requested page directly — a link to page 3 returns page 3 in the HTML.

- [ ] **Step 1: Create `components/PaginationNav.vue`**

The `<select>` carries a real `<label>`, which is the brief's "labelled form controls" requirement.

```vue
<script setup lang="ts">
defineProps<{
  page: number
  perPage: number
  hasNext: boolean
}>()

const emit = defineEmits<{
  'update:page': [value: number]
  'update:perPage': [value: number]
}>()

const perPageOptions = [8, 12, 24]

function onPerPageChange(event: Event) {
  emit('update:perPage', Number((event.target as HTMLSelectElement).value))
}
</script>

<template>
  <nav class="pagination" aria-label="Product pages">
    <button
      type="button"
      class="button button--quiet"
      :disabled="page <= 1"
      @click="emit('update:page', page - 1)"
    >
      Previous page
    </button>

    <p class="pagination__status">Page {{ page }}</p>

    <button
      type="button"
      class="button button--quiet"
      :disabled="!hasNext"
      @click="emit('update:page', page + 1)"
    >
      Next page
    </button>

    <div class="pagination__size">
      <label for="per-page">Products per page</label>
      <select id="per-page" :value="perPage" @change="onPerPageChange">
        <option v-for="option in perPageOptions" :key="option" :value="option">
          {{ option }}
        </option>
      </select>
    </div>
  </nav>
</template>
```

- [ ] **Step 2: Add pagination styles to `assets/css/main.css`**

```css
.pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-4);
  margin-top: var(--space-8);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.pagination__status {
  margin: 0;
  color: var(--color-text-muted);
}

.pagination__size {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
}

.pagination__size select {
  padding: var(--space-2);
  font: inherit;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg);
  color: var(--color-text);
}
```

- [ ] **Step 3: Wire URL-synced state into `pages/products/index.vue`**

Replace the `page` and `perPage` refs from Task 5 with writable computeds, and add the component to the template.

In `<script setup>`, replace `const page = ref(1)` and `const perPage = ref(12)` with:

```ts
const route = useRoute()
const router = useRouter()

const page = computed({
  get: () => {
    const value = Number(route.query.page)
    return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1
  },
  set: (value: number) => {
    router.push({ query: { ...route.query, page: String(value) } })
  },
})

const perPage = computed({
  get: () => {
    const value = Number(route.query.perPage)
    return [8, 12, 24].includes(value) ? value : 12
  },
  set: (value: number) => {
    router.push({ query: { ...route.query, perPage: String(value), page: '1' } })
  },
})
```

Update the import line to `import { computed } from 'vue'` (the `ref` import is no longer needed).

Add to the template, immediately after the closing `</DataState>`:

```vue
  <PaginationNav
    :page="page"
    :per-page="perPage"
    :has-next="hasNext"
    @update:page="page = $event"
    @update:per-page="perPage = $event"
  />
```

And add `hasNext` to the destructured `useProducts` result.

- [ ] **Step 4: Verify pagination is server-rendered**

Run: `npm run dev`
Run: `curl -s "http://localhost:3000/products?page=2" | grep -c "card__title"`
Expected: `12`.

Run: `curl -s "http://localhost:3000/products?page=1" | grep -o "Page 1"`
Expected: prints `Page 1`.

Compare the first product title on page 1 and page 2 — they must differ, proving `offset` is applied:

Run: `curl -s "http://localhost:3000/products?page=1" | grep -o 'card__title">[^<]*' | head -1`
Run: `curl -s "http://localhost:3000/products?page=2" | grep -o 'card__title">[^<]*' | head -1`
Expected: two different titles.

- [ ] **Step 5: Verify per-page and the Previous boundary**

Run: `curl -s "http://localhost:3000/products?perPage=8" | grep -c "card__title"`
Expected: `8`.

In the browser on page 1: "Previous page" is disabled. Change the select to 24; the URL gains `perPage=24&page=1` and 24 cards render.

- [ ] **Step 6: Verify keyboard operation**

Tab to "Next page" and press Enter. Tab to the select and change it with arrow keys.
Expected: both work, both show a visible focus ring, and the page updates.

- [ ] **Step 7: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 8: Commit**

```bash
git add components/PaginationNav.vue pages/products/index.vue assets/css/main.css
git commit -m "feat: add URL-synced pagination to product list"
```

---

### Task 7: Product detail page

**Files:**
- Create: `composables/useProduct.ts`, `pages/products/[id].vue`
- Modify: `assets/css/main.css`

**Interfaces:**
- Consumes: `PRODUCT_QUERY`, `ProductQueryResult` (Task 4), `useCartStore`, `useAnnouncer`, `firstImage`, `formatPrice`.
- Produces: `useProduct(id: Ref<string>)` returning `{ product: Ref<ProductDetail | null>, pending: Ref<boolean>, error: Ref<Error | null>, refresh: () => Promise<void> }`.

This is the brief's required dynamic route and its second GraphQL query.

- [ ] **Step 1: Create `composables/useProduct.ts`**

The key is a function so each product id gets its own cache entry rather than overwriting one shared key.

```ts
import type { Ref } from 'vue'
import { PRODUCT_QUERY, type ProductQueryResult } from '~/graphql/products'

export function useProduct(id: Ref<string>) {
  const { $apollo } = useNuxtApp()

  const { data, pending, error, refresh } = useAsyncData(
    () => `product-${id.value}`,
    async () => {
      const result = await $apollo.query<ProductQueryResult>({
        query: PRODUCT_QUERY,
        variables: { id: id.value },
      })
      return result.data.product
    },
    { watch: [id] },
  )

  return { product: data, pending, error, refresh }
}
```

- [ ] **Step 2: Create `pages/products/[id].vue`**

`useSeoMeta` takes functions so the tags track the async product rather than freezing at the initial null.

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useCartStore } from '~/stores/cart'

const route = useRoute()
const id = computed(() => String(route.params.id))

const { product, pending, error, refresh } = useProduct(id)

const cart = useCartStore()
const { announce } = useAnnouncer()

const image = computed(() =>
  product.value ? firstImage(product.value.images) : '/placeholder.svg',
)

useSeoMeta({
  title: () =>
    product.value
      ? `${product.value.title} — EnBW Storefront`
      : 'Product — EnBW Storefront',
  description: () =>
    product.value?.description?.slice(0, 155) ?? 'Product detail page.',
  ogTitle: () => product.value?.title ?? 'Product',
  ogDescription: () => product.value?.description?.slice(0, 155) ?? '',
  ogImage: () => image.value,
})

function addToCart() {
  if (!product.value) return
  cart.add({
    id: product.value.id,
    title: product.value.title,
    price: product.value.price,
    image: image.value,
  })
  announce(`${product.value.title} added to cart`)
}
</script>

<template>
  <DataState :pending="pending" :error="error" label="this product" @retry="refresh">
    <p v-if="!product" class="data-state">
      This product is no longer available.
      <NuxtLink to="/products">Back to all products</NuxtLink>
    </p>

    <article v-else class="product-detail">
      <img
        :src="image"
        :alt="product.title"
        class="product-detail__image"
        width="600"
        height="600"
        fetchpriority="high"
        decoding="async"
      >
      <div>
        <p class="product-detail__breadcrumb">
          <NuxtLink to="/products">Products</NuxtLink>
          <span aria-hidden="true">/</span>
          <span>{{ product.category.name }}</span>
        </p>
        <h1>{{ product.title }}</h1>
        <p class="product-detail__price">{{ formatPrice(product.price) }}</p>
        <p>{{ product.description }}</p>
        <button type="button" class="button" @click="addToCart">
          Add to cart<span class="visually-hidden">: {{ product.title }}</span>
        </button>
      </div>
    </article>
  </DataState>
</template>
```

- [ ] **Step 3: Add detail styles to `assets/css/main.css`**

```css
.product-detail {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-8);
}

@media (min-width: 48rem) {
  .product-detail {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}

.product-detail__image {
  width: 100%;
  height: auto;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: var(--radius);
  background: var(--color-surface);
}

.product-detail__breadcrumb {
  display: flex;
  gap: var(--space-2);
  margin: 0 0 var(--space-2);
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.product-detail__price {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 var(--space-4);
}
```

- [ ] **Step 4: Verify the detail page is server-rendered with SEO meta**

Run: `npm run dev`
Run: `curl -s http://localhost:3000/products/2 | grep -o "<title>[^<]*</title>"`
Expected: `<title>Classic Red Pullover Hoodie — EnBW Storefront</title>`.

Run: `curl -s http://localhost:3000/products/2 | grep -c 'property="og:image"'`
Expected: `1`.

- [ ] **Step 5: Verify the missing-product path**

Run: `curl -s http://localhost:3000/products/99999999 | grep -c "no longer available"`
Expected: `1` — a useful message, not a stack trace.

- [ ] **Step 6: Verify navigation keeps the cart**

In the browser: add an item on `/products`, click through to a product, add it again, go back.
Expected: the header count includes both additions.

- [ ] **Step 7: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 8: Commit**

```bash
git add composables/useProduct.ts "pages/products/[id].vue" assets/css/main.css
git commit -m "feat: add product detail page with dynamic SEO meta"
```

---

### Task 8: Cart page

**Files:**
- Create: `pages/cart.vue`
- Modify: `assets/css/main.css`

**Interfaces:**
- Consumes: `useCartStore` (Task 2), `formatPrice` (Task 5).
- Produces: nothing consumed by later tasks. This is the fourth store-consuming component.

- [ ] **Step 1: Create `pages/cart.vue`**

Each quantity input gets its own `<label>` tied by a unique id, and each remove button names its product — both are graded accessibility requirements and both matter to a real screen-reader user faced with five identical rows.

```vue
<script setup lang="ts">
import { useCartStore } from '~/stores/cart'

const cart = useCartStore()
const { announce } = useAnnouncer()

useSeoMeta({
  title: 'Your cart — EnBW Storefront',
  description: 'Review the items in your cart.',
})

function onQuantityChange(id: string, event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  cart.setQuantity(id, value)
}

function removeLine(id: string, title: string) {
  cart.remove(id)
  announce(`${title} removed from cart`)
}
</script>

<template>
  <h1>Your cart</h1>

  <p v-if="cart.items.length === 0" class="data-state">
    Your cart is empty.
    <NuxtLink to="/products">Browse products</NuxtLink>
  </p>

  <template v-else>
    <ul class="cart-list">
      <li v-for="line in cart.items" :key="line.id" class="cart-line">
        <img
          :src="line.image ?? '/placeholder.svg'"
          alt=""
          class="cart-line__image"
          width="96"
          height="96"
          loading="lazy"
        >

        <div class="cart-line__details">
          <h2 class="cart-line__title">
            <NuxtLink :to="`/products/${line.id}`">{{ line.title }}</NuxtLink>
          </h2>
          <p class="cart-line__price">{{ formatPrice(line.price) }}</p>
        </div>

        <div class="cart-line__quantity">
          <label :for="`quantity-${line.id}`">Quantity</label>
          <input
            :id="`quantity-${line.id}`"
            type="number"
            min="0"
            step="1"
            :value="line.quantity"
            @change="onQuantityChange(line.id, $event)"
          >
        </div>

        <button
          type="button"
          class="button button--quiet"
          @click="removeLine(line.id, line.title)"
        >
          Remove<span class="visually-hidden"> {{ line.title }} from cart</span>
        </button>
      </li>
    </ul>

    <p class="cart-total">
      Total: <strong>{{ formatPrice(cart.totalPrice) }}</strong>
    </p>
  </template>
</template>
```

The thumbnail uses `alt=""` deliberately: the product title is already the adjacent link text, so a duplicate alt would make a screen reader say it twice.

- [ ] **Step 2: Add cart styles to `assets/css/main.css`**

```css
.cart-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.cart-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.cart-line__image {
  width: 6rem;
  height: 6rem;
  object-fit: cover;
  border-radius: var(--radius);
  background: var(--color-surface);
}

.cart-line__details {
  flex: 1 1 12rem;
}

.cart-line__title {
  font-size: 1rem;
  margin: 0 0 var(--space-1);
}

.cart-line__price {
  margin: 0;
  color: var(--color-text-muted);
}

.cart-line__quantity {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.cart-line__quantity input {
  width: 4.5rem;
  padding: var(--space-2);
  font: inherit;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.cart-total {
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
  font-size: 1.25rem;
  text-align: right;
}
```

- [ ] **Step 3: Verify the empty state**

Run: `npm run dev`
Run: `curl -s http://localhost:3000/cart | grep -c "Your cart is empty"`
Expected: `1`.

- [ ] **Step 4: Verify the full cart flow in the browser**

Add two products, go to `/cart`.
Expected: both lines render with correct prices and a correct total. Change a quantity to 3 — the total updates and the header badge updates. Set a quantity to 0 — the line disappears. Click Remove — the line disappears and the live region announces it.

- [ ] **Step 5: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add pages/cart.vue assets/css/main.css
git commit -m "feat: add cart page with quantity and removal controls"
```

---

### Task 9: Nitro route and Contentful reshaping

**Files:**
- Create: `types/promo.ts`, `server/utils/contentful.ts`, `server/api/promo-banner.get.ts`, `.env`

**Interfaces:**
- Consumes: `runtimeConfig.contentfulSpaceId`, `contentfulDeliveryToken`, `contentfulEnvironment` (Task 1).
- Produces: `GET /api/promo-banner` returning `PromoBanner | null`. `mapPromoBanner(response: CdaResponse): PromoBanner | null`. Types `PromoBanner`, `PromoBannerImage`.

**This task needs the Contentful delivery token.** Steps 1–5 do not and can be completed first; step 6 onward needs the token in `.env` and the `promoBanner` content type published with one active entry.

**Developer task — build the content model before step 6.** In the Contentful web app for space `5ek3f7n6ag1n`, create a content type with ID exactly `promoBanner` (the API queries that string; a mismatch silently returns no entries). Field IDs must match exactly too:

| Field name | Field ID | Type | Required | Notes |
|---|---|---|---|---|
| Heading | `heading` | Short text | yes | The mapper returns `null` without it |
| Body | `body` | Short text | no | |
| CTA label | `ctaLabel` | Short text | no | |
| CTA URL | `ctaUrl` | Short text | no | Add URL validation |
| Image | `image` | Media, one file | no | Give the asset a **description** — it becomes the `alt` text |
| Is active | `isActive` | Boolean | no | Default true |

Then create one entry, tick `isActive`, and **publish** it — draft entries are invisible to the Delivery API. Screenshot the content model editor to `docs/evidence/contentful-model.png` for the brief's evidence column.

- [ ] **Step 1: Create `types/promo.ts`**

```ts
export interface PromoBannerImage {
  url: string
  alt: string
  width: number
  height: number
}

export interface PromoBanner {
  heading: string
  body: string | null
  ctaLabel: string | null
  ctaUrl: string | null
  image: PromoBannerImage | null
}
```

- [ ] **Step 2: Create `server/utils/contentful.ts`**

This is the reshaping the brief asks for. The CDA returns the entry in `items` and its image in a *separate* `includes.Asset` array, joined only by a sys id — so the mapper resolves the link, flattens the result, scales the declared dimensions to match the width requested from the Images API, and normalises Contentful's protocol-relative `//images.ctfassets.net/...` URLs.

```ts
import type { PromoBanner } from '~/types/promo'

const IMAGE_WIDTH = 1200
const IMAGE_PARAMS = `w=${IMAGE_WIDTH}&fm=webp&q=70`

interface CdaAsset {
  sys: { id: string }
  fields?: {
    title?: string
    description?: string
    file?: {
      url?: string
      details?: { image?: { width?: number; height?: number } }
    }
  }
}

interface CdaEntry {
  fields?: {
    heading?: string
    body?: string
    ctaLabel?: string
    ctaUrl?: string
    isActive?: boolean
    image?: { sys?: { id?: string } }
  }
}

export interface CdaResponse {
  items?: CdaEntry[]
  includes?: { Asset?: CdaAsset[] }
}

export function mapPromoBanner(response: CdaResponse): PromoBanner | null {
  const entry = response?.items?.[0]
  const heading = entry?.fields?.heading
  if (!heading) return null

  const assetId = entry.fields?.image?.sys?.id
  const asset = assetId
    ? response.includes?.Asset?.find((candidate) => candidate.sys?.id === assetId)
    : undefined

  const file = asset?.fields?.file
  let image: PromoBanner['image'] = null

  if (file?.url) {
    const base = file.url.startsWith('//') ? `https:${file.url}` : file.url
    const originalWidth = file.details?.image?.width ?? IMAGE_WIDTH
    const originalHeight = file.details?.image?.height ?? Math.round(IMAGE_WIDTH / 2)
    const width = Math.min(IMAGE_WIDTH, originalWidth)
    const height = Math.round((originalHeight / originalWidth) * width)

    image = {
      url: `${base}?${IMAGE_PARAMS}`,
      alt: asset?.fields?.description ?? asset?.fields?.title ?? '',
      width,
      height,
    }
  }

  return {
    heading,
    body: entry.fields?.body ?? null,
    ctaLabel: entry.fields?.ctaLabel ?? null,
    ctaUrl: entry.fields?.ctaUrl ?? null,
    image,
  }
}
```

- [ ] **Step 3: Create `server/api/promo-banner.get.ts`**

Editorial content failing must never take down the storefront, so every failure path returns `null` and the banner simply does not render.

```ts
import { mapPromoBanner, type CdaResponse } from '../utils/contentful'
import type { PromoBanner } from '~/types/promo'

export default defineEventHandler(async (): Promise<PromoBanner | null> => {
  const config = useRuntimeConfig()
  const spaceId = config.contentfulSpaceId
  const token = config.contentfulDeliveryToken
  const environment = config.contentfulEnvironment || 'master'

  if (!spaceId || !token) {
    console.warn('[promo-banner] Contentful credentials missing; skipping banner')
    return null
  }

  try {
    const response = await $fetch<CdaResponse>(
      `https://cdn.contentful.com/spaces/${spaceId}/environments/${environment}/entries`,
      {
        query: {
          content_type: 'promoBanner',
          'fields.isActive': true,
          limit: 1,
          include: 1,
        },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 3000,
      },
    )
    return mapPromoBanner(response)
  } catch (error) {
    console.error('[promo-banner] Contentful request failed', error)
    return null
  }
})
```

- [ ] **Step 4: Verify the route degrades safely without credentials**

Run: `npm run dev`
Run: `curl -s -w "\nHTTP %{http_code}\n" http://localhost:3000/api/promo-banner`
Expected: body `null`, `HTTP 200`, and a `[promo-banner] Contentful credentials missing` warning in the dev server log. The route must not 500.

- [ ] **Step 5: Verify the mapper against a representative CDA payload**

The developer chose a single committed unit test (the cart store), so this is a throwaway verification, not a committed spec. Write this to the scratchpad directory, not the repo:

```ts
import { mapPromoBanner } from './server/utils/contentful'

const sample = {
  items: [
    {
      fields: {
        heading: 'Autumn sale',
        body: 'Up to 30% off selected items.',
        ctaLabel: 'Shop the sale',
        ctaUrl: 'https://example.com/sale',
        isActive: true,
        image: { sys: { id: 'asset-1' } },
      },
    },
  ],
  includes: {
    Asset: [
      {
        sys: { id: 'asset-1' },
        fields: {
          title: 'Autumn sale banner',
          description: 'Knitwear arranged on a wooden table',
          file: {
            url: '//images.ctfassets.net/abc/def/banner.jpg',
            details: { image: { width: 2400, height: 1200 } },
          },
        },
      },
    ],
  },
}

console.log(JSON.stringify(mapPromoBanner(sample), null, 2))
console.log('empty ->', mapPromoBanner({ items: [] }))
```

Run it from the repo root: `npx vite-node <scratchpad>/check-mapper.ts`

Expected output: `url` is `https://images.ctfassets.net/abc/def/banner.jpg?w=1200&fm=webp&q=70`, `alt` is the asset description, `width` is `1200`, `height` is `600` (aspect ratio preserved from 2400×1200), and the empty case prints `null`.

- [ ] **Step 6: Create `.env` with the real credentials** *(needs the token)*

This file is gitignored. Never commit it.

```
NUXT_CONTENTFUL_SPACE_ID=5ek3f7n6ag1n
NUXT_CONTENTFUL_DELIVERY_TOKEN=<token from the developer>
NUXT_CONTENTFUL_ENVIRONMENT=master
```

- [ ] **Step 7: Verify the live Contentful response** *(needs the token)*

Restart the dev server so the new environment variables load.

Run: `curl -s http://localhost:3000/api/promo-banner`
Expected: a JSON object with `heading` populated and, if the entry has an image, an `image.url` on `images.ctfassets.net` carrying `?w=1200&fm=webp&q=70`.

If it returns `null`, check in order: the content type id is exactly `promoBanner`, the entry is **published** (not draft), and `isActive` is ticked.

- [ ] **Step 8: Confirm the token never reaches the client**

Run: `curl -s http://localhost:3000/products | grep -c "<token value>"`
Expected: `0`. The token lives in the server half of `runtimeConfig` and must never appear in the payload.

- [ ] **Step 9: Commit**

```bash
git add types/promo.ts server/utils/contentful.ts server/api/promo-banner.get.ts
git commit -m "feat: add Nitro route reshaping Contentful banner content"
```

Confirm `.env` is absent from `git status` before committing.

---

### Task 10: Promo banner rendering

**Files:**
- Create: `components/PromoBanner.vue`
- Modify: `pages/products/index.vue`, `assets/css/main.css`

**Interfaces:**
- Consumes: `GET /api/promo-banner` and the `PromoBanner` type (Task 9).
- Produces: `PromoBanner` component — props `{ banner: PromoBanner }`.

- [ ] **Step 1: Create `components/PromoBanner.vue`**

`aria-labelledby` gives the region an accessible name. The image carries the width and height the Nitro route computed, which is what prevents layout shift when it loads.

```vue
<script setup lang="ts">
import type { PromoBanner } from '~/types/promo'

defineProps<{ banner: PromoBanner }>()
</script>

<template>
  <section class="promo" aria-labelledby="promo-heading">
    <img
      v-if="banner.image"
      :src="banner.image.url"
      :alt="banner.image.alt"
      :width="banner.image.width"
      :height="banner.image.height"
      class="promo__image"
      fetchpriority="high"
      decoding="async"
    >
    <div class="promo__body">
      <h2 id="promo-heading">{{ banner.heading }}</h2>
      <p v-if="banner.body">{{ banner.body }}</p>
      <a
        v-if="banner.ctaUrl && banner.ctaLabel"
        :href="banner.ctaUrl"
        class="button"
      >{{ banner.ctaLabel }}</a>
    </div>
  </section>
</template>
```

- [ ] **Step 2: Add banner styles to `assets/css/main.css`**

```css
.promo {
  margin-bottom: var(--space-8);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--color-surface);
}

.promo__image {
  display: block;
  width: 100%;
  height: auto;
}

.promo__body {
  padding: var(--space-6);
}

.promo__body h2 {
  margin-top: 0;
}
```

- [ ] **Step 3: Fetch the banner in `pages/products/index.vue`**

Add to `<script setup>`:

```ts
const { data: banner } = await useFetch('/api/promo-banner')
```

Add to the template, immediately after `<h1>Products</h1>`:

```vue
  <PromoBanner v-if="banner" :banner="banner" />
```

During SSR this calls the Nitro handler in-process — there is no HTTP round trip back to our own server.

- [ ] **Step 4: Verify the banner is server-rendered** *(needs the token)*

Run: `npm run dev`
Run: `curl -s http://localhost:3000/products | grep -c 'id="promo-heading"'`
Expected: `1`.

Run: `curl -s http://localhost:3000/products | grep -o 'images.ctfassets.net[^"]*' | head -1`
Expected: a URL carrying `w=1200&fm=webp&q=70`.

- [ ] **Step 5: Verify graceful degradation**

Temporarily blank `NUXT_CONTENTFUL_DELIVERY_TOKEN` in `.env` and restart.
Expected: `/products` renders the full product grid with no banner and no error. Restore the token and restart.

- [ ] **Step 6: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add components/PromoBanner.vue pages/products/index.vue assets/css/main.css
git commit -m "feat: render CMS promo banner on the product list"
```

---

### Task 11: Accessibility verification

**Files:**
- Create: `docs/a11y/keyboard-test.md`, `docs/a11y/axe-products.json` (generated)
- Modify: any file with an axe finding

**Interfaces:**
- Consumes: the complete UI from Tasks 3–10.
- Produces: committed axe output and keyboard-test notes for the brief's evidence column.

- [ ] **Step 1: Build and start the production server**

axe and Lighthouse must run against the production build, not the dev server — dev ships unminified assets and an HMR client that distort results.

Run: `npm run build`
Run: `npm run start`
Expected: server listening on `http://localhost:3000`.

- [ ] **Step 2: Run the axe scan on the list page**

Run: `mkdir -p docs/a11y`
Run: `npm run a11y`
Expected: the CLI launches Chrome, scans, and writes `docs/a11y/axe-products.json`.

If it fails with `SessionNotCreatedError`, the chromedriver override did not take effect. Run `npm ls chromedriver` — it must report `153.0.3`. If not, `rm -rf node_modules package-lock.json && npm install`.

- [ ] **Step 3: Scan the detail and cart pages**

Run: `npx axe http://localhost:3000/products/2 --save docs/a11y/axe-product-detail.json`
Run: `npx axe http://localhost:3000/cart --save docs/a11y/axe-cart.json`

- [ ] **Step 4: Review and fix every violation**

Run: `node -e "for (const f of ['products','product-detail','cart']) { const r = require('./docs/a11y/axe-' + f + '.json'); const v = (r[0] || r).violations || []; console.log(f, v.length, v.map(x => x.id).join(', ')); }"`
Expected: `0` violations per page.

If any appear, fix the markup and rerun. Do not suppress a rule to make the count zero. If a violation is genuinely a false positive, record why in `docs/a11y/keyboard-test.md` rather than hiding it.

- [ ] **Step 5: Walk the keyboard flow and record it**

With the keyboard only — no mouse — walk: `/products` → Tab to skip link → grid → Add to cart → header cart → `/cart` → change quantity → Remove → back to products → open a product → Add to cart.

Create `docs/a11y/keyboard-test.md`:

```markdown
# Keyboard test notes

Tested with Chrome 153 on Windows, keyboard only, no mouse.
Build: production (`npm run build && npm run start`).

## Flow

| Step | Keys | Result |
|---|---|---|
| Reveal skip link | Tab from page load | Link becomes visible with a focus ring; Enter moves focus into `<main>` |
| Reach a product | Tab | Each card's link and Add to cart button receive focus in DOM order |
| Add to cart | Enter on "Add to cart" | Item added; the polite live region announces "<product> added to cart" |
| Open a product | Enter on the card link | Detail page loads; focus starts at the document top |
| Reach the cart | Tab to the header cart link, Enter | Cart page loads |
| Change quantity | Tab to the quantity input, type a value, Tab out | Line total and header badge update on change |
| Remove a line | Enter on "Remove" | Line disappears; live region announces the removal |
| Paginate | Tab to "Next page", Enter | Next page loads; disabled buttons are skipped by Tab |
| Change page size | Tab to the select, arrow keys | Page size changes and the URL updates |

## Observations

- Focus is visible on every interactive element; no outline is suppressed anywhere.
- No keyboard traps; Shift+Tab reverses the order cleanly throughout.
- Buttons that repeat per row ("Add to cart", "Remove") carry visually hidden
  product names, so each has a unique accessible name.
- Disabled pagination buttons are correctly skipped rather than focusable dead ends.

## axe DevTools

Extension scan screenshots: `docs/evidence/axe-devtools-products.png`.
CLI output: `docs/a11y/axe-*.json`.
```

Adjust any row whose observed result differs — these notes must describe what actually happened.

- [ ] **Step 6: Capture the axe DevTools screenshot**

*(Developer task.)* Open `http://localhost:3000/products` in Chrome, run the axe DevTools extension, and save the results panel to `docs/evidence/axe-devtools-products.png`.

- [ ] **Step 7: Commit**

```bash
git add docs/a11y docs/evidence
git commit -m "docs: add axe scan output and keyboard test notes"
```

---

### Task 12: Lighthouse baseline, image fix and after report

**Files:**
- Create: `docs/lighthouse/before/`, `docs/lighthouse/after/`, `docs/evidence/`
- Modify: `nuxt.config.ts` (preconnect), `components/ProductCard.vue`

**Interfaces:**
- Consumes: the production build from Task 11.
- Produces: before/after Lighthouse reports for the brief's evidence column.

The baseline must be captured **before** the fix. Do not reorder these steps.

- [ ] **Step 1: Capture the server-rendered HTML evidence**

Run: `mkdir -p docs/evidence`
Run: `curl -s http://localhost:3000/products > docs/evidence/products-ssr.html`
Run: `grep -c "card__title" docs/evidence/products-ssr.html`
Expected: a non-zero count, proving product markup is present with no JavaScript executed.

*(Developer task.)* Also open `view-source:http://localhost:3000/products` in Chrome and screenshot it to `docs/evidence/view-source-products.png` — the brief asks for a screenshot specifically.

- [ ] **Step 2: Capture the Lighthouse baseline**

Run: `mkdir -p docs/lighthouse/before`
Run: `CHROME_PATH="/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" npx lhci collect --url=http://localhost:3000/products --numberOfRuns=3`
Run: `cp .lighthouseci/*.html .lighthouseci/*.json docs/lighthouse/before/`

- [ ] **Step 3: Record the baseline scores**

Run: `node -e "const fs=require('fs');const f=fs.readdirSync('docs/lighthouse/before').find(n=>n.endsWith('.json'));const r=JSON.parse(fs.readFileSync('docs/lighthouse/before/'+f));console.log(Object.entries(r.categories).map(([k,v])=>k+': '+Math.round(v.score*100)).join('\n'))"`

Write the four numbers down — they go in the README in Task 14.

- [ ] **Step 4: Identify the top opportunity**

Run: `node -e "const fs=require('fs');const f=fs.readdirSync('docs/lighthouse/before').find(n=>n.endsWith('.json'));const r=JSON.parse(fs.readFileSync('docs/lighthouse/before/'+f));Object.values(r.audits).filter(a=>a.details&&a.details.type==='opportunity'&&a.numericValue>0).sort((a,b)=>b.numericValue-a.numericValue).slice(0,5).forEach(a=>console.log(Math.round(a.numericValue)+'ms', a.id))"`

Expected: image-related audits dominate — `uses-responsive-images`, `modern-image-formats`, `offscreen-images`. Platzi serves full-size imgur JPEGs for 300px slots.

- [ ] **Step 5: Add preconnect hints in `nuxt.config.ts`**

Inside `app.head`, add alongside `meta`:

```ts
      link: [
        { rel: 'preconnect', href: 'https://i.imgur.com', crossorigin: '' },
        { rel: 'preconnect', href: 'https://images.ctfassets.net', crossorigin: '' },
      ],
```

- [ ] **Step 6: Prioritise the first row of product images in `components/ProductCard.vue`**

A blanket `loading="lazy"` delays the LCP image, which Lighthouse penalises. Give the card an `eager` prop so the list page can prioritise the first row only.

Replace the `<script setup>` block:

```ts
import { computed } from 'vue'
import type { Product } from '~/types/product'

const props = withDefaults(
  defineProps<{ product: Product; eager?: boolean }>(),
  { eager: false },
)
const emit = defineEmits<{ add: [product: Product] }>()

const image = computed(() => firstImage(props.product.images))
const price = computed(() => formatPrice(props.product.price))
```

Replace the `<img>` tag:

```vue
      <img
        :src="image"
        :alt="product.title"
        class="card__image"
        width="300"
        height="300"
        :loading="eager ? 'eager' : 'lazy'"
        :fetchpriority="eager ? 'high' : 'auto'"
        decoding="async"
      >
```

- [ ] **Step 7: Mark the first row eager in `pages/products/index.vue`**

Replace the `ProductCard` usage:

```vue
        <ProductCard :product="product" :eager="index < 4" @add="addToCart" />
```

And update the loop to expose the index:

```vue
      <li v-for="(product, index) in products" :key="product.id">
```

- [ ] **Step 8: Rebuild and capture the after report**

Run: `npm run build`
Run: `npm run start`
Run: `rm -rf .lighthouseci && mkdir -p docs/lighthouse/after`
Run: `CHROME_PATH="/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" npx lhci collect --url=http://localhost:3000/products --numberOfRuns=3`
Run: `cp .lighthouseci/*.html .lighthouseci/*.json docs/lighthouse/after/`

- [ ] **Step 9: Compare the scores**

Run: `node -e "const fs=require('fs');for (const d of ['before','after']) {const f=fs.readdirSync('docs/lighthouse/'+d).find(n=>n.endsWith('.json'));const r=JSON.parse(fs.readFileSync('docs/lighthouse/'+d+'/'+f));console.log(d, Object.entries(r.categories).map(([k,v])=>k+':'+Math.round(v.score*100)).join(' '))}"`

Expected: performance improves, and CLS-related audits improve because every image now declares intrinsic dimensions. Record both rows for the README.

If performance did not improve, do not fake it. Re-read the step 4 opportunity list, fix the actual top item, and recapture.

- [ ] **Step 10: Commit**

```bash
git add docs/lighthouse docs/evidence nuxt.config.ts components/ProductCard.vue pages/products/index.vue
git commit -m "perf: prioritise above-the-fold images and add preconnect hints"
```

---

### Task 13: CI with a Lighthouse threshold

**Files:**
- Create: `.lighthouserc.json`, `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the npm scripts from Task 1.
- Produces: a CI run enforcing typecheck, tests and Lighthouse thresholds on every push and pull request.

- [ ] **Step 1: Create `.lighthouserc.json`**

Thresholds are set where they will hold. A gate that flakes red trains a team to ignore CI, so best-practices and SEO warn rather than fail.

```json
{
  "ci": {
    "collect": {
      "startServerCommand": "npm run start",
      "startServerReadyPattern": "Listening",
      "url": ["http://localhost:3000/products"],
      "numberOfRuns": 3,
      "settings": {
        "preset": "desktop"
      }
    },
    "assert": {
      "assertions": {
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:performance": ["error", { "minScore": 0.8 }],
        "categories:best-practices": ["warn", { "minScore": 0.9 }],
        "categories:seo": ["warn", { "minScore": 0.9 }]
      }
    },
    "upload": {
      "target": "filesystem",
      "outputDir": "./.lighthouseci/reports"
    }
  }
}
```

- [ ] **Step 2: Create `.github/workflows/ci.yml`**

The Contentful secrets are optional by design — the Nitro route returns `null` without them, so a fork's pull request still gets a full green run rather than a confusing failure.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest

    env:
      NUXT_CONTENTFUL_SPACE_ID: ${{ secrets.NUXT_CONTENTFUL_SPACE_ID }}
      NUXT_CONTENTFUL_DELIVERY_TOKEN: ${{ secrets.NUXT_CONTENTFUL_DELIVERY_TOKEN }}
      NUXT_CONTENTFUL_ENVIRONMENT: master

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Unit tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Lighthouse
        run: npx lhci autorun

      - name: Upload Lighthouse reports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: lighthouse-reports
          path: .lighthouseci/reports
```

- [ ] **Step 3: Verify the Lighthouse gate locally before pushing**

Stop any running server so `lhci` can start its own.

Run: `CHROME_PATH="/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" npx lhci autorun`
Expected: collects, asserts, and exits 0.

If an assertion fails, the threshold is either genuinely unmet — fix the site — or set too high for this machine. Only lower it with a reason you would defend out loud, and record that reason in the README.

- [ ] **Step 4: Commit and push**

```bash
git add .lighthouserc.json .github/workflows/ci.yml
git commit -m "ci: enforce typecheck, tests and Lighthouse thresholds"
git push origin main
```

- [ ] **Step 5: Verify the run is green on GitHub**

*(Developer task.)* Open `https://github.com/keipa/enbw/actions` and confirm the run passes. Optionally add `NUXT_CONTENTFUL_SPACE_ID` and `NUXT_CONTENTFUL_DELIVERY_TOKEN` as repository secrets so CI exercises the banner path too.

Screenshot the green run to `docs/evidence/ci-run.png`.

If Lighthouse fails on the runner but passed locally, check the performance score in the uploaded artifact before touching the threshold — runner variance is real, but so is a genuine regression.

---

### Task 14: ADR, README and evidence assembly

**Files:**
- Create: `docs/adr/0001-ssr-vs-ssg-for-product-pages.md`, `README.md`

**Interfaces:**
- Consumes: the measured scores from Task 12 and the CI result from Task 13.
- Produces: the repo's documentation deliverables.

- [ ] **Step 1: Create `docs/adr/0001-ssr-vs-ssg-for-product-pages.md`**

```markdown
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
  depends on the upstream API's latency, which we do not control.
- A server must be running. This rules out pure static hosting.
- Traffic spikes hit the product API directly. A production deployment would need
  a cache in front — ISR or SWR on the Nitro layer would be the natural next step.

**Why not SSG**

SSG would give the fastest possible TTFB and the cheapest hosting, but it requires
enumerating every product at build time and rebuilding whenever data changes.
Against an API that mutates continuously and has no webhook available to us, the
result would be a storefront that confidently serves stale prices.

**Why not ISR now**

ISR is the pragmatic middle ground and would likely be correct at real scale. It
is out of scope here because it adds cache-invalidation questions this exercise
does not need to answer, and because the brief explicitly asks for SSR. Revisit
if request volume against the product API becomes a problem.
```

- [ ] **Step 2: Create `README.md`**

Replace every `<...>` marker with the real measured values from Tasks 12 and 13.

```markdown
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
- **Contentful failures degrade silently.** If the CMS errors or no active entry
  exists, the route returns `null` and the banner is omitted. Editorial content
  failing should not take down a storefront.

## Accessibility

Semantic landmarks, one `h1` per page, a skip link, visible `:focus-visible`
rings that are never suppressed, labelled form controls, and per-row accessible
names so repeated buttons are distinguishable. Adding to the cart is announced
through a polite live region.

- axe CLI output: `docs/a11y/`
- Keyboard test notes: `docs/a11y/keyboard-test.md`
- axe DevTools screenshot: `docs/evidence/axe-devtools-products.png`

## Performance

Lighthouse on `/products`, production build, desktop preset, median of 3 runs.

| | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| Before | <before-perf> | <before-a11y> | <before-bp> | <before-seo> |
| After | <after-perf> | <after-a11y> | <after-bp> | <after-seo> |

**What changed:** product images were the dominant opportunity — the upstream API
serves full-size JPEGs into 300px slots. The fix declares intrinsic `width` and
`height` on every image to eliminate layout shift, marks the first row `eager`
with `fetchpriority="high"` while lazy-loading the rest, requests the banner from
Contentful's Images API already resized and in WebP, and preconnects to both image
hosts.

Full reports: `docs/lighthouse/before/` and `docs/lighthouse/after/`.

## CI

`.github/workflows/ci.yml` runs typecheck, unit tests, build and Lighthouse on
every push and pull request.

Thresholds: accessibility ≥ 0.95 and performance ≥ 0.80 fail the build;
best-practices and SEO warn. Performance on shared CI runners is noisy, and a
gate that flakes red teaches people to ignore CI — so the performance bar is set
where it will hold rather than where it looks impressive.

## Testing

One unit test, on the cart store (`tests/cart.store.spec.ts`): adding, merging
quantity on a repeat add, removal, removal via a zero quantity, and the total
getter.

## Decision records

- [ADR 0001: SSR vs SSG for product pages](docs/adr/0001-ssr-vs-ssg-for-product-pages.md)
```

- [ ] **Step 3: Fill in the real scores**

Run: `node -e "const fs=require('fs');for (const d of ['before','after']) {const f=fs.readdirSync('docs/lighthouse/'+d).find(n=>n.endsWith('.json'));const r=JSON.parse(fs.readFileSync('docs/lighthouse/'+d+'/'+f));console.log(d, Object.entries(r.categories).map(([k,v])=>k+':'+Math.round(v.score*100)).join(' '))}"`

Replace every `<...>` placeholder in the README table with these numbers. Verify none remain:

Run: `grep -c "<before-\|<after-" README.md`
Expected: `0`.

- [ ] **Step 4: Verify the full suite one more time**

Run: `npm run typecheck && npm test && npm run build`
Expected: all three exit 0.

- [ ] **Step 5: Commit and push**

```bash
git add README.md docs/adr
git commit -m "docs: add ADR and project README with measured results"
git push origin main
```

---

## Evidence checklist

Before submitting, confirm each row of the brief has its artefact:

- [ ] Repo shows Composition API pages, `ProductCard` with props and emits, and composables
- [ ] `pages/products/[id].vue` exists; SSR verified; `useSeoMeta` on both pages
- [ ] `docs/evidence/view-source-products.png` — screenshot of view-source
- [ ] `server/api/promo-banner.get.ts` plus the production note in the README
- [ ] Cart store used by four components and surviving navigation
- [ ] Two GraphQL queries, one with variables; loading and error states in `DataState`
- [ ] `docs/evidence/contentful-model.png` — content model screenshot, **developer captures this**
- [ ] `docs/a11y/axe-*.json` and `docs/evidence/axe-devtools-products.png`
- [ ] `docs/a11y/keyboard-test.md`
- [ ] `docs/lighthouse/before/` and `docs/lighthouse/after/` with scores in the README
- [ ] `docs/adr/0001-ssr-vs-ssg-for-product-pages.md`
- [ ] TypeScript strict throughout; one unit test; Lighthouse threshold in CI
- [ ] `docs/evidence/ci-run.png` — green CI run
