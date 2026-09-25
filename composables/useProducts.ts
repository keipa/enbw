import type { Ref } from 'vue'
import { computed } from 'vue'
import { PRODUCTS_QUERY, type ProductsQueryResult } from '~/graphql/products'
import type { Product } from '~/types/product'

export interface UseProductsOptions {
  page: Ref<number>
  perPage: Ref<number>
}

export function useProducts({ page, perPage }: UseProductsOptions) {
  const { $apollo } = useNuxtApp()

  const { data, pending, error, refresh } = useAsyncData(
    'products',
    async () => {
      const result = await $apollo.query<ProductsQueryResult>({
        query: PRODUCTS_QUERY,
        variables: {
          limit: perPage.value + 1,
          offset: (page.value - 1) * perPage.value,
        },
      })
      return result.data.products
    },
    { watch: [page, perPage] },
  )

  const products = computed<Product[]>(() =>
    (data.value ?? []).slice(0, perPage.value),
  )
  const hasNext = computed<boolean>(
    () => (data.value?.length ?? 0) > perPage.value,
  )

  return { products, hasNext, pending, error, refresh }
}
