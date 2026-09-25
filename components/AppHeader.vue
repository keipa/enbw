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
