import { mapPromoBanner, type CdaResponse } from '../utils/contentful'
import type { PromoBanner } from '~/types/promo'

export default defineEventHandler(async (): Promise<PromoBanner | null> => {
  const config = useRuntimeConfig()
  const spaceId = config.contentfulSpaceId
  const token = config.contentfulDeliveryToken
  const environment = config.contentfulEnvironment || 'master'

  if (!spaceId || !token) {
    console.warn('[promo-banner] Contentful credentials missing; skipping banner')
    return null
  }

  try {
    const response = await $fetch<CdaResponse>(
      `https://cdn.contentful.com/spaces/${spaceId}/environments/${environment}/entries`,
      {
        query: {
          content_type: 'promoBanner',
          'fields.isActive': true,
          limit: 1,
          include: 1,
        },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 3000,
      },
    )
    return mapPromoBanner(response)
  } catch (error) {
    console.error('[promo-banner] Contentful request failed', error)
    return null
  }
})
