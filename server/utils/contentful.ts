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

// Mirrors the http(s)-only predicate `utils/image.ts` applies to catalogue
// image URLs. A `promoBanner` entry is editable by anyone with Contentful
// editor access — a lower trust boundary than the developer — and Vue does
// not sanitise `:href` on its own, so a `javascript:` (or other non-http(s))
// scheme must be stripped here, in the server DTO, rather than trusted to the
// component that renders it.
function sanitizeCtaUrl(raw: string | undefined): string | null {
  if (!raw) return null

  try {
    const url = new URL(raw)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString()
    }
  } catch {
    // Not a valid URL — ignore.
  }

  return null
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
    const declaredWidth = file.details?.image?.width
    const declaredHeight = file.details?.image?.height
    // Both dimensions must be declared and positive *together*. Falling back
    // per-axis mixes one real value with one synthetic default and emits an
    // aspect ratio that belongs to neither the asset nor the documented
    // default — exactly the fabricated ratio `width`/`height` exist to
    // prevent. If either axis is missing or non-positive, fall back to the
    // full default pair (2:1) instead.
    const hasDeclaredPair =
      declaredWidth !== undefined &&
      declaredWidth > 0 &&
      declaredHeight !== undefined &&
      declaredHeight > 0
    const originalWidth = hasDeclaredPair ? declaredWidth : IMAGE_WIDTH
    const originalHeight = hasDeclaredPair ? declaredHeight : Math.round(IMAGE_WIDTH / 2)
    const width = Math.min(IMAGE_WIDTH, originalWidth)
    const height = Math.round((originalHeight / originalWidth) * width)

    image = {
      url: `${base}?${IMAGE_PARAMS}`,
      alt: asset?.fields?.description ?? asset?.fields?.title ?? '',
      width: Math.round(width),
      height,
    }
  }

  return {
    heading,
    body: entry.fields?.body ?? null,
    ctaLabel: entry.fields?.ctaLabel ?? null,
    ctaUrl: sanitizeCtaUrl(entry.fields?.ctaUrl),
    image,
  }
}
