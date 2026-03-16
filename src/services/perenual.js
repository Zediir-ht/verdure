// Perenual API service — replaces Trefle.io
// API docs: https://perenual.com/docs/api
// Proxy endpoint: /api/perenual (Vercel function)

import { translateToFr, translateFields } from './translation'

const PERENUAL_BASE = '/api/perenual'

// ─── Sunlight label → FR ────────────────────────────────────────────────────

const SUNLIGHT_FR = {
  'full_sun': 'Plein soleil',
  'full sun': 'Plein soleil',
  'part_shade': 'Mi-ombre',
  'part shade': 'Mi-ombre',
  'part_sun/part_shade': 'Mi-soleil / mi-ombre',
  'full_shade': 'Ombre complète',
  'full shade': 'Ombre complète',
  'filtered_indirect_light': 'Lumière indirecte filtrée',
  'filtered indirect light': 'Lumière indirecte filtrée',
}

function sunlightFr(sunlight) {
  if (!sunlight) return null
  if (Array.isArray(sunlight)) {
    return sunlight.map((s) => SUNLIGHT_FR[s?.toLowerCase()] ?? s).join(', ')
  }
  return SUNLIGHT_FR[sunlight?.toLowerCase()] ?? sunlight
}

// ─── Cycle → FR ─────────────────────────────────────────────────────────────

const CYCLE_FR = {
  annual: 'Annuelle',
  biennial: 'Bisannuelle',
  perennial: 'Vivace',
  biannual: 'Bisannuelle',
}

// ─── Watering → interval days ───────────────────────────────────────────────

const WATERING_INTERVAL = {
  frequent: 3,
  average: 7,
  minimum: 14,
  none: 30,
}

function wateringIntervalDays(watering) {
  return WATERING_INTERVAL[watering?.toLowerCase()] ?? 7
}

// ─── Session cache ───────────────────────────────────────────────────────────

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
  } catch {}
}

// ─── Search ──────────────────────────────────────────────────────────────────

/**
 * Search Perenual for plants by name.
 * Returns an array of { id, name, scientificName, imageUrl, cycle, watering }
 */
export async function searchPerenual(query) {
  if (!query?.trim()) return []

  const cacheKey = `perenual:search:${query.toLowerCase().trim()}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  const res = await fetch(`${PERENUAL_BASE}?q=${encodeURIComponent(query.trim())}`)
  if (!res.ok) throw new Error("Impossible de contacter l'API plantes")

  const payload = await res.json()
  const items = (payload.data ?? []).map((p) => ({
    id: p.id,
    name: p.common_name ?? p.scientific_name?.[0] ?? 'Plante inconnue',
    scientificName: p.scientific_name?.[0] ?? '',
    imageUrl: p.default_image?.small_url ?? p.default_image?.medium_url ?? null,
    cycle: CYCLE_FR[p.cycle?.toLowerCase()] ?? p.cycle ?? 'Vivace',
    watering: p.watering ?? 'average',
  }))

  cacheSet(cacheKey, items)
  return items
}

// ─── Detail ──────────────────────────────────────────────────────────────────

/**
 * Fetch full Perenual plant details and map to our schema.
 * All text fields are translated to French.
 */
export async function getPerenualDetails(perenualId) {
  if (!perenualId) throw new Error('ID Perenual requis')

  const cacheKey = `perenual:detail:${perenualId}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  const res = await fetch(`${PERENUAL_BASE}?id=${perenualId}`)
  if (!res.ok) throw new Error('Impossible de charger les détails de la plante')

  const p = await res.json()

  // ── Translate text fields in parallel ──────────────────────────────────────
  const [
    wateringFrequency,
    soilType,
    fertilizerType,
    pruningDescription,
    origin,
    careDesc,
  ] = await Promise.all([
    translateToFr(p.watering_general_benchmark?.value ?? p.watering ?? ''),
    translateToFr(Array.isArray(p.soil) ? p.soil.join(', ') : (p.soil ?? '')),
    translateToFr(Array.isArray(p.feeds) ? p.feeds.join(', ') : (p.feeds ?? '')),
    translateToFr(
      Array.isArray(p.pruning_description)
        ? p.pruning_description.map((d) => d.description).join('. ')
        : (p.pruning_description ?? ''),
    ),
    translateToFr(Array.isArray(p.origin) ? p.origin.join(', ') : (p.origin ?? '')),
    translateToFr(p.care_level ?? ''),
  ])

  // Pruning months
  const pruningMonths = Array.isArray(p.pruning_month)
    ? p.pruning_month.join(', ')
    : (p.pruning_month ?? '')

  // Sunlight
  const sunlightFrStr = sunlightFr(p.sunlight)

  const result = {
    perenual_id: p.id,
    slug: p.slug ?? '',
    name: p.common_name ?? p.scientific_name?.[0] ?? 'Plante inconnue',
    scientific_name: p.scientific_name?.[0] ?? '',
    family: p.family ?? '',
    photo_url: p.default_image?.original_url ?? p.default_image?.medium_url ?? null,
    // Soins
    watering_frequency: wateringFrequency,
    watering_interval_days: wateringIntervalDays(p.watering),
    sunlight: sunlightFrStr,
    soil_type: soilType,
    fertilizer_type: fertilizerType,
    pruning_month: pruningMonths,
    pruning_description: pruningDescription,
    // Caractéristiques
    origin,
    indoor: !!p.indoor,
    outdoor: !p.indoor,
    cycle: CYCLE_FR[p.cycle?.toLowerCase()] ?? p.cycle ?? 'Vivace',
    growth_rate: p.growth_rate ?? '',
    maintenance: careDesc,
    // Toxicité
    toxic_humans: !!(p.poisonous_to_humans),
    toxic_dogs: !!(p.poisonous_to_pets),
    toxic_cats: !!(p.poisonous_to_pets),
    // Températures
    min_temperature: p.hardiness?.min ? parseFloat(p.hardiness.min) : null,
    max_temperature: null,
    // Taille
    height_min_cm: p.dimensions?.min_value ? parseFloat(p.dimensions.min_value) * 30.48 : null,
    height_max_cm: p.dimensions?.max_value ? parseFloat(p.dimensions.max_value) * 30.48 : null,
    width_min_cm: null,
    width_max_cm: null,
    // Saisons
    flowering_season: Array.isArray(p.flowering_season)
      ? p.flowering_season.join(', ')
      : (p.flowering_season ?? ''),
    dormant_season: '',
    hardiness_zone: p.hardiness?.max ?? '',
    // Raw
    perenual_raw: p,
  }

  cacheSet(cacheKey, result)
  return result
}
