const PLACEHOLDER = '/placeholder.svg'

export function firstImage(images: string[] | null | undefined): string {
  if (!images) return PLACEHOLDER

  for (const raw of images) {
    if (typeof raw !== 'string') continue

    const candidate = raw
      .trim()
      .replace(/^\[/, '')
      .replace(/\]$/, '')
      .replace(/^"/, '')
      .replace(/"$/, '')
      .trim()

    if (!candidate) continue

    try {
      const url = new URL(candidate)
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return url.toString()
      }
    } catch {
      continue
    }
  }

  return PLACEHOLDER
}
