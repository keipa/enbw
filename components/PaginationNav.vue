<script setup lang="ts">
defineProps<{
  page: number
  perPage: number
  hasNext: boolean
}>()

const emit = defineEmits<{
  'update:page': [value: number]
  'update:perPage': [value: number]
}>()

const perPageOptions = [8, 12, 24]

function onPerPageChange(event: Event) {
  emit('update:perPage', Number((event.target as HTMLSelectElement).value))
}
</script>

<template>
  <nav class="pagination" aria-label="Product pages">
    <button
      type="button"
      class="button button--quiet"
      :disabled="page <= 1"
      @click="emit('update:page', page - 1)"
    >
      Previous page
    </button>

    <p class="pagination__status" role="status">Page {{ page }}</p>

    <button
      type="button"
      class="button button--quiet"
      :disabled="!hasNext"
      @click="emit('update:page', page + 1)"
    >
      Next page
    </button>

    <div class="pagination__size">
      <label for="per-page">Products per page</label>
      <select id="per-page" :value="perPage" @change="onPerPageChange">
        <option
          v-for="option in perPageOptions"
          :key="option"
          :value="option"
          :selected="option === perPage"
        >
          {{ option }}
        </option>
      </select>
    </div>
  </nav>
</template>
