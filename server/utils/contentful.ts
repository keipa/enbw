import type { PromoBanner } from '~/types/promo'

const IMAGE_WIDTH = 1200
const IMAGE_PARAMS = `w=${IMAGE_WIDTH}&fm=webp&q=70`

interface CdaAsset {
  sys: { id: string }
  fields?: {
    title?: string
    description?: string
    file?: {
      url?: string
      details?: { image?: { width?: number; height?: number } }
    }
  }
}

interface CdaEntry {
  fields?: {
    heading?: string
    body?: string
    ctaLabel?: string
    ctaUrl?: string
    isActive?: boolean
    image?: { sys?: { id?: string } }
  }
}

export interface CdaResponse {
  items?: CdaEntry[]
  includes?: { Asset?: CdaAsset[] }
}

export function mapPromoBanner(response: CdaResponse): PromoBanner | null {
  const entry = response?.items?.[0]
  const heading = entry?.fields?.heading
  if (!heading) return null

  const assetId = entry.fields?.image?.sys?.id
  const asset = assetId
    ? response.includes?.Asset?.find((candidate) => candidate.sys?.id === assetId)
    : undefined

  const file = asset?.fields?.file
  let image: PromoBanner['image'] = null

  if (file?.url) {
    const base = file.url.startsWith('//') ? `https:${file.url}` : file.url
    const originalWidth = file.details?.image?.width ?? IMAGE_WIDTH
    const originalHeight = file.details?.image?.height ?? Math.round(IMAGE_WIDTH / 2)
    const width = Math.min(IMAGE_WIDTH, originalWidth)
    const height = Math.round((originalHeight / originalWidth) * width)

    image = {
      url: `${base}?${IMAGE_PARAMS}`,
      alt: asset?.fields?.description ?? asset?.fields?.title ?? '',
      width,
      height,
    }
  }

  return {
    heading,
    body: entry.fields?.body ?? null,
    ctaLabel: entry.fields?.ctaLabel ?? null,
    ctaUrl: entry.fields?.ctaUrl ?? null,
    image,
  }
}
