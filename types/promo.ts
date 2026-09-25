export interface PromoBannerImage {
  url: string
  alt: string
  width: number
  height: number
}

export interface PromoBanner {
  heading: string
  body: string | null
  ctaLabel: string | null
  ctaUrl: string | null
  image: PromoBannerImage | null
}
