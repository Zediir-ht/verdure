// Translation service using MyMemory API (free, no key required)
// https://api.mymemory.translated.net

const CACHE_PREFIX = 'verdure:tr:'
const MAX_CACHE_SIZE = 200

function trCacheGet(key) {
  try {
    return sessionStorage.getItem(CACHE_PREFIX + key) || null
  } catch {
    return null
  }
}

function trCacheSet(key, value) {
  try {
    // Simple LRU-lite: clear if too many entries
    if (sessionStorage.length > MAX_CACHE_SIZE) sessionStorage.clear()
    sessionStorage.setItem(CACHE_PREFIX + key, value)
  } catch {}
}

/**
 * Translate a single text from English to French via MyMemory.
 * Returns the original text if translation fails.
 */
export async function translateToFr(text) {
  if (!text || typeof text !== 'string') return text
  const trimmed = text.trim()
  if (!trimmed) return text

  // Skip if already French-looking (heuristic: no ASCII-only words over 3 chars)
  const englishPattern = /\b(the|is|are|was|were|has|have|and|for|with|from|that|this|which)\b/i
  if (!englishPattern.test(trimmed)) return text

  const cacheKey = trimmed.toLowerCase()
  const cached = trCacheGet(cacheKey)
  if (cached) return cached

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=en|fr`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)

    if (!res.ok) return text
    const data = await res.json()
    const translated = data?.responseData?.translatedText
    if (!translated || translated === trimmed) return text

    trCacheSet(cacheKey, translated)
    return translated
  } catch {
    return text
  }
}

/**
 * Translate multiple fields of an object in parallel.
 * Pass an array of field names to translate.
 */
export async function translateFields(obj, fields) {
  if (!obj) return obj
  const entries = await Promise.allSettled(
    fields.map(async (field) => {
      if (obj[field]) {
        const translated = await translateToFr(obj[field])
        return [field, translated]
      }
      return [field, obj[field]]
    }),
  )
  const result = { ...obj }
  for (const entry of entries) {
    if (entry.status === 'fulfilled' && entry.value) {
      const [field, value] = entry.value
      result[field] = value
    }
  }
  return result
}

/**
 * Translate an array of strings in parallel.
 */
export async function translateArray(arr) {
  if (!Array.isArray(arr)) return arr
  return Promise.all(arr.map((item) => translateToFr(item)))
}
