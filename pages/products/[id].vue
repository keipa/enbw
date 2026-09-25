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
  <h1>{{ product?.title ?? 'Product' }}</h1>

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
          <template v-if="product.category?.name">
            <span aria-hidden="true">/</span>
            <span>{{ product.category.name }}</span>
          </template>
        </p>
        <p v-if="Number.isFinite(product.price)" class="product-detail__price">
          {{ formatPrice(product.price) }}
        </p>
        <p>{{ product.description }}</p>
        <button type="button" class="button" @click="addToCart">
          Add to cart<span class="visually-hidden">: {{ product.title }}</span>
        </button>
      </div>
    </article>
  </DataState>
</template>
