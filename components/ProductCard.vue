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
