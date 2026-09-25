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
