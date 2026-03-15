// Plant enrichment service: combines Trefle + Claude to build complete plant profiles
const TREFLE_BASE = '/api/trefle'
const CLAUDE_URL = '/anthropic/v1/messages'
// Token injected server-side by Vercel function
const CACHE_PREFIX = 'enriched_'

// ─── Persistent localStorage cache ──────────────────────────────────────────

function persistGet(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function persistSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // quota — ignore
  }
}

function sessionGet(key) {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function sessionSet(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

// ─── Trefle JWT ──────────────────────────────────────────────────────────────

// ─── Trefle fetch ─────────────────────────────────────────────────────────────

async function fetchTrefleData(latinName) {
  if (!latinName) return null
  try {
    const res = await fetch(`${TREFLE_BASE}?q=${encodeURIComponent(latinName.trim())}`)
    if (!res.ok) return null
    const payload = await res.json()
    const plant = payload?.data?.[0]
    if (!plant) return null

    // Fetch full detail for growth data
    const detailRes = await fetch(`${TREFLE_BASE}?id=${plant.id}`)
    if (!detailRes.ok) return null
    const detail = await detailRes.json()
    const d = detail?.data ?? {}
    const growth = d.main_species?.growth ?? d.growth ?? {}
    const specs = d.main_species?.specifications ?? d.specifications ?? {}
    const minTemp = d.main_species?.growth?.minimum_temperature?.deg_c ?? null
    const maxTemp = specs?.maximum_temperature?.deg_c ?? null

    return {
      moisture_use: growth.moisture_use ?? null,
      drought_tolerance: growth.drought_tolerance ?? null,
      frost_free_days: growth.frost_free_days ?? null,
      light: growth.light ?? null,
      ph_minimum: growth.ph_minimum ?? null,
      ph_maximum: growth.ph_maximum ?? null,
      minimum_temperature: minTemp,
      maximum_temperature: maxTemp,
    }
  } catch {
    return null
  }
}

// ─── Claude enrichment ────────────────────────────────────────────────────────

async function fetchClaudeProfile(latinName, nameFr) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) return null

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
        max_tokens: 1024,
        system: 'You are an expert horticulturist. Return ONLY raw JSON, no markdown.',
        messages: [
          {
            role: 'user',
            content: `Give complete care profile for: ${latinName}${nameFr ? ` (${nameFr})` : ''}

Return this exact JSON:
{
  "wateringCoefficient": 0.0-1.0,
  "baseFrequencyDays": { "spring": 0, "summer": 0, "autumn": 0, "winter": 0 },
  "droughtTolerant": false,
  "frostHardy": false,
  "minTemperature": 0,
  "maxTemperature": 0,
  "idealHumidity": { "min": 0, "max": 0 },
  "sunlight": "plein-soleil|mi-ombre|ombre",
  "soilType": "bien-drainé|humide|universel|sableux|argileux",
  "mistingNeeded": false,
  "overWateringRisk": "faible|moyen|élevé",
  "wateringTips": "conseil en une phrase en français",
  "vulnerabilities": [],
  "seasonalActions": {
    "spring": "action en français",
    "summer": "action en français",
    "autumn": "action en français",
    "winter": "action en français"
  }
}`,
          },
        ],
      }),
    })

    if (!res.ok) return null
    const payload = await res.json()
    const text = payload?.content?.[0]?.text ?? ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

// ─── Merge & normalise ────────────────────────────────────────────────────────

function normaliseSunlight(trefleLight, claudeSunlight) {
  if (claudeSunlight) return claudeSunlight
  if (trefleLight == null) return 'mi-ombre'
  if (trefleLight >= 7) return 'plein-soleil'
  if (trefleLight >= 4) return 'mi-ombre'
  return 'ombre'
}

function buildEnriched(plant, trefle, claude) {
  const droughtTolerant =
    claude?.droughtTolerant ??
    (trefle?.drought_tolerance === 'High' || trefle?.drought_tolerance === 'Very High')

  const frostHardy =
    claude?.frostHardy ??
    (trefle?.frost_free_days != null ? trefle.frost_free_days < 30 : false)

  const minTemperature = claude?.minTemperature ?? trefle?.minimum_temperature ?? (frostHardy ? -5 : 5)
  const maxTemperature = claude?.maxTemperature ?? trefle?.maximum_temperature ?? 35

  const moistureIntervalMap = { Low: 14, Medium: 7, High: 4 }
  const baseInterval = moistureIntervalMap[trefle?.moisture_use] ?? null
  const baseFrequencyDays = claude?.baseFrequencyDays ?? {
    spring: baseInterval ?? 7,
    summer: Math.max(2, (baseInterval ?? 7) - 2),
    autumn: baseInterval ?? 7,
    winter: Math.min(21, (baseInterval ?? 7) + 5),
  }

  return {
    latinName: plant.latinName,
    nameFr: plant.name,
    wateringCoefficient: claude?.wateringCoefficient ?? (trefle?.moisture_use ? { Low: 0.2, Medium: 0.5, High: 0.9 }[trefle.moisture_use] : 0.5),
    baseFrequencyDays,
    droughtTolerant,
    frostHardy,
    minTemperature,
    maxTemperature,
    idealHumidity: claude?.idealHumidity ?? { min: 40, max: 70 },
    sunlight: normaliseSunlight(trefle?.light, claude?.sunlight),
    soilType: claude?.soilType ?? 'universel',
    mistingNeeded: claude?.mistingNeeded ?? false,
    overWateringRisk: claude?.overWateringRisk ?? 'moyen',
    wateringTips: claude?.wateringTips ?? null,
    vulnerabilities: claude?.vulnerabilities ?? [],
    seasonalActions: claude?.seasonalActions ?? {},
    phMin: trefle?.ph_minimum ?? null,
    phMax: trefle?.ph_maximum ?? null,
    trefleLight: trefle?.light ?? null,
    enrichedAt: new Date().toISOString(),
    source: claude && trefle ? 'trefle+claude' : claude ? 'claude' : trefle ? 'trefle' : 'default',
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function enrichPlant(plant) {
  const latinName = plant?.latinName
  if (!latinName) return buildEnriched(plant, null, null)

  const cacheKey = `${CACHE_PREFIX}${latinName.toLowerCase().replace(/\s+/g, '_')}`
  const cached = persistGet(cacheKey)
  if (cached) return cached

  const [trefle, claude] = await Promise.allSettled([
    fetchTrefleData(latinName),
    fetchClaudeProfile(latinName, plant.name),
  ])

  const trefleData = trefle.status === 'fulfilled' ? trefle.value : null
  const claudeData = claude.status === 'fulfilled' ? claude.value : null

  const profile = buildEnriched(plant, trefleData, claudeData)
  persistSet(cacheKey, profile)
  return profile
}

export function getCachedEnrichedProfile(latinName) {
  if (!latinName) return null
  const cacheKey = `${CACHE_PREFIX}${latinName.toLowerCase().replace(/\s+/g, '_')}`
  return persistGet(cacheKey)
}

export function clearEnrichedCache() {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX))
  keys.forEach((k) => localStorage.removeItem(k))
}
