const PLACEHOLDER = '/placeholder.svg'

function normalizeCandidate(raw: string): string {
  return raw
    .trim()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .replace(/^"/, '')
    .replace(/"$/, '')
    .trim()
}

function resolveUrl(candidate: string): string | null {
  // A literal quote surviving normalisation means the entry packed more
  // than one value together (e.g. two URLs glued into one array element).
  // WHATWG URL parsing is lenient enough to percent-encode that into a
  // "valid but garbled" URL, so reject it outright rather than let it
  // through.
  if (!candidate || candidate.includes('"')) return null

  try {
    const url = new URL(candidate)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString()
    }
  } catch {
    // Not a valid URL — ignore.
  }

  return null
}

export function firstImage(images: string[] | null | undefined): string {
  if (!images) return PLACEHOLDER

  for (const raw of images) {
    if (typeof raw !== 'string') continue

    const trimmed = raw.trim()
    if (!trimmed) continue

    // Some catalogue entries are themselves a JSON-encoded array stored as
    // a single string (a double-encoding artifact of the upstream, public,
    // writable database) — e.g. one element literally containing
    // `["https://a.com/1.jpg","https://b.com/2.jpg"]`. Parse those
    // properly and treat each inner element as its own candidate, instead
    // of trimming brackets by hand, so a packed/garbled entry can't be
    // mistaken for a single valid URL.
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed: unknown = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          for (const entry of parsed) {
            if (typeof entry !== 'string') continue
            const resolved = resolveUrl(normalizeCandidate(entry))
            if (resolved) return resolved
          }
          continue
        }
      } catch {
        // Not valid JSON — fall through and treat the raw string as a
        // plain (possibly quote/bracket-wrapped) candidate below.
      }
    }

    const resolved = resolveUrl(normalizeCandidate(trimmed))
    if (resolved) return resolved
  }

  return PLACEHOLDER
}
