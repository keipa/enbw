<script setup lang="ts">
import { computed } from 'vue'
import { useCartStore } from '~/stores/cart'
import type { Product } from '~/types/product'

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

const { products, hasNext, pending, error, refresh } = useProducts({ page, perPage })

const { data: banner } = await useFetch('/api/promo-banner')

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

  <PromoBanner v-if="banner" :banner="banner" />

  <DataState :pending="pending" :error="error" label="products" @retry="refresh">
    <p v-if="products.length === 0" class="data-state">No products found.</p>
    <ul v-else class="product-grid">
      <li v-for="product in products" :key="product.id">
        <ProductCard :product="product" @add="addToCart" />
      </li>
    </ul>
  </DataState>

  <PaginationNav
    :page="page"
    :per-page="perPage"
    :has-next="hasNext"
    @update:page="page = $event"
    @update:per-page="perPage = $event"
  />
</template>
