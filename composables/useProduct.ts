import type { Ref } from 'vue'
import { PRODUCT_QUERY, type ProductQueryResult } from '~/graphql/products'

export function useProduct(id: Ref<string>) {
  const { $apollo } = useNuxtApp()

  const { data, pending, error, refresh } = useAsyncData(
    () => `product-${id.value}`,
    async () => {
      const result = await $apollo.query<ProductQueryResult>({
        query: PRODUCT_QUERY,
        variables: { id: id.value },
      })
      return result.data.product
    },
    { watch: [id] },
  )

  return { product: data, pending, error, refresh }
}
