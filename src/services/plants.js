const API_KEY = 'sk-KkPjLalO9I5g3Y8tJ3906'
const BASE_URL = 'https://perenual.com/api'

const wateringCoefficientMap = {
  Frequent: 0.9,
  Average: 0.6,
  Minimum: 0.3,
  None: 0.1,
}

export function mapWateringToCoefficient(wateringValue) {
  return wateringCoefficientMap[wateringValue] ?? 0.6
}

function getSearchCacheKey(query) {
  return `verdure:perenual:search:${query.trim().toLowerCase()}`
}

export async function searchPlants(query) {
  if (!query?.trim()) return []

  const cacheKey = getSearchCacheKey(query)
  const cached = sessionStorage.getItem(cacheKey)
  if (cached) {
    try {
      return JSON.parse(cached)
    } catch {
      sessionStorage.removeItem(cacheKey)
    }
  }

  const params = new URLSearchParams({ key: API_KEY, q: query.trim() })
  const response = await fetch(`${BASE_URL}/species-list?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Recherche de plante indisponible.')
  }

  const payload = await response.json()
  const items = (payload?.data ?? []).map((plant) => ({
    id: plant.id,
    name: plant.common_name || plant.scientific_name?.[0] || 'Plante inconnue',
    thumbnail: plant.default_image?.thumbnail || '',
  }))

  sessionStorage.setItem(cacheKey, JSON.stringify(items))
  return items
}

export async function getPlantDetails(id) {
  const params = new URLSearchParams({ key: API_KEY })
  const response = await fetch(`${BASE_URL}/species/details/${id}?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Impossible de charger les détails de la plante.')
  }

  const data = await response.json()
  const wateringLabel = data.watering || 'Average'

  return {
    watering: wateringLabel,
    wateringCoefficient: mapWateringToCoefficient(wateringLabel),
    sunlight: data.sunlight || [],
    description: data.description || 'Pas de description disponible.',
    default_image: data.default_image?.medium_url || data.default_image?.regular_url || '',
  }
}
