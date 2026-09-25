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
