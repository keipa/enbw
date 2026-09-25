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
