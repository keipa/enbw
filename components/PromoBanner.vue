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
