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
