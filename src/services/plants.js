const TREFLE_BASE = 'https://trefle.io/api/v1'
const TREFLE_AUTH = 'https://trefle.io/api/auth/claim'
const USER_TOKEN = 'usr-5pAQ63LD52r54zpRDqGJCsOXEZJAunoLFx7W_ebBhfE'
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages'
const JWT_CACHE_KEY = 'verdure:trefle:jwt'

// ---------------------------------------------------------------------------
// Trefle JWT claim — browser requests require a short-lived JWT, not the raw token
// ---------------------------------------------------------------------------

async function getTrefleJwt() {
  // Return cached JWT if still valid (Trefle JWTs last ~1 hour)
  const cached = cacheGet(JWT_CACHE_KEY)
  if (cached?.token && cached.expiresAt > Date.now() + 60_000) {
    return cached.token
  }

  const origin = window.location.origin
  const res = await fetch(
    `${TREFLE_AUTH}?token=${USER_TOKEN}&origin=${encodeURIComponent(origin)}`,
    { method: 'POST' }
  )

  if (!res.ok) {
    throw new Error(`Trefle auth failed (${res.status}). Vérifie que l'origine "${origin}" est enregistrée sur trefle.io/me.`)
  }

  const data = await res.json()
  const jwt = data.token
  if (!jwt) throw new Error('Trefle n\'a pas retourné de JWT.')

  // Cache for 55 minutes
  cacheSet(JWT_CACHE_KEY, { token: jwt, expiresAt: Date.now() + 55 * 60 * 1000 })
  return jwt
}

const moistureMap = {
  Low: 0.2,
  Medium: 0.5,
  High: 0.9,
}

export function mapMoistureToCoefficient(moisture) {
  return moistureMap[moisture] ?? null
}

// Keep backward-compat alias used by AddPlantModal / PlantDetail
export function mapWateringToCoefficient(moisture) {
  return mapMoistureToCoefficient(moisture) ?? 0.5
}

function cacheGet(key) {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    sessionStorage.removeItem(key)
    return null
  }
}

function cacheSet(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // sessionStorage full — ignore
  }
}

// ---------------------------------------------------------------------------
// Claude fallback — fetch watering data when Trefle has none
// ---------------------------------------------------------------------------

async function fetchWateringFromClaude(latinName) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) return null

  const cacheKey = `verdure:claude:plant:${latinName.toLowerCase()}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  try {
    const res = await fetch(CLAUDE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content:
              `Give me the watering coefficient (0.0 to 1.0) and key care data ` +
              `for ${latinName} in JSON format only, no extra text: ` +
              `{ "wateringCoefficient": number, "droughtTolerant": boolean, ` +
              `"frostHardy": boolean, "wateringTips": string }`,
          },
        ],
      }),
    })

    if (!res.ok) return null
    const payload = await res.json()
    const text = payload?.content?.[0]?.text ?? ''
    // Extract JSON block even if Claude adds surrounding text
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0])
    cacheSet(cacheKey, parsed)
    return parsed
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function searchPlants(query) {
  if (!query?.trim()) return []

  const cacheKey = `verdure:trefle:search:${query.trim().toLowerCase()}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  const jwt = await getTrefleJwt()
  const params = new URLSearchParams({ q: query.trim(), token: jwt })
  const res = await fetch(`${TREFLE_BASE}/plants/search?${params}`)

  if (!res.ok) {
    if (res.status === 401) throw new Error('JWT Trefle expiré, réessaie.')
    throw new Error('Recherche de plante indisponible.')
  }

  const payload = await res.json()
  const items = (payload?.data ?? []).map((p) => ({
    id: p.id,
    // Prefer common name, fall back to scientific
    name: p.common_name || p.scientific_name || 'Plante inconnue',
    latinName: p.scientific_name || '',
    thumbnail: p.image_url || '',
  }))

  cacheSet(cacheKey, items)
  return items
}

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

export async function getPlantDetails(id) {
  const cacheKey = `verdure:trefle:details:${id}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  const jwt = await getTrefleJwt()
  const params = new URLSearchParams({ token: jwt })
  const res = await fetch(`${TREFLE_BASE}/plants/${id}?${params}`)

  if (!res.ok) {
    throw new Error('Impossible de charger les détails de la plante.')
  }

  const payload = await res.json()
  const data = payload?.data ?? {}
  const growth = data.main_species?.growth ?? data.growth ?? {}
  const specs = data.main_species?.specifications ?? data.specifications ?? {}

  const moistureUse = growth.moisture_use ?? null
  const lightLevel = growth.light ?? null
  const avgHeightCm = specs.average_height?.cm ?? null
  const droughtTolerance = growth.drought_tolerance ?? null
  const frostFreeDays = growth.frost_free_days ?? null
  const latinName = data.scientific_name || ''

  let wateringCoefficient = mapMoistureToCoefficient(moistureUse)
  let claudeData = null

  // Fallback to Claude when Trefle has no moisture data
  if (wateringCoefficient === null && latinName) {
    claudeData = await fetchWateringFromClaude(latinName)
    wateringCoefficient = claudeData?.wateringCoefficient ?? 0.5
  }

  const result = {
    // Watering
    watering: moistureUse ?? (claudeData ? 'via IA' : 'Non renseigné'),
    wateringCoefficient,
    wateringTips: claudeData?.wateringTips ?? null,
    // Care
    droughtTolerant: claudeData?.droughtTolerant ?? (droughtTolerance === 'High' || droughtTolerance === 'Very High'),
    frostHardy: claudeData?.frostHardy ?? (frostFreeDays !== null ? frostFreeDays < 30 : null),
    // Growth
    light: lightLevel,          // 0-10 scale from Trefle
    avgHeightCm,
    droughtTolerance,
    frostFreeDays,
    // Meta
    latinName,
    commonName: data.common_name || '',
    description: data.main_species?.observations ?? data.observations ?? 'Pas de description disponible.',
    imageUrl: data.image_url || '',
    // Keep sunlight as array for backward compat with PlantDetail
    sunlight: lightLevel !== null ? [`Lumière : ${lightLevel}/10`] : [],
    filledByAI: !!claudeData,
  }

  cacheSet(cacheKey, result)
  return result
}
