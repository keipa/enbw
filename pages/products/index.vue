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
