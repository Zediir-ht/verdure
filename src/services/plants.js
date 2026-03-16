// Plants service — wraps Perenual API + Supabase DB
// Replaces Trefle.io entirely

import { searchPerenual, getPerenualDetails } from './perenual'
import {
  fetchAllPlants as dbFetchAll,
  insertPlant as dbInsert,
  updatePlant as dbUpdate,
  deletePlantById as dbDelete,
  insertWateringLog as dbLogWatering,
  uploadPlantPhoto as dbUploadPhoto,
} from './supabase'

// ─── Coefficient helpers (kept for hydricBalance compat) ─────────────────────

const WATERING_COEFF = { frequent: 0.9, average: 0.5, minimum: 0.2, none: 0.05 }
const WATERING_INTERVAL = { frequent: 3, average: 7, minimum: 14, none: 30 }

export function mapWateringToCoefficient(watering) {
  return WATERING_COEFF[watering?.toLowerCase()] ?? 0.5
}

export function mapMoistureToCoefficient(moisture) {
  return mapWateringToCoefficient(moisture)
}

export function mapMoistureToIntervalDays(watering) {
  return WATERING_INTERVAL[watering?.toLowerCase()] ?? 7
}

// ─── Search (delegates to Perenual service) ──────────────────────────────────

export async function searchPlants(query) {
  const results = await searchPerenual(query)
  return results.map((p) => ({
    id: p.id,
    name: p.name,
    latinName: p.scientificName,
    thumbnail: p.imageUrl ?? '',
    cycle: p.cycle,
    watering: p.watering,
  }))
}

// ─── Details (delegates to Perenual service) ────────────────────────────────

export async function getPlantDetails(perenualId) {
  const p = await getPerenualDetails(perenualId)
  return {
    ...p,
    watering: p.watering_frequency,
    wateringCoefficient: mapWateringToCoefficient(p.perenual_raw?.watering),
    wateringIntervalDays: p.watering_interval_days,
    wateringTips: null,
    droughtTolerant: p.perenual_raw?.drought_tolerant ?? false,
    frostHardy: p.min_temperature !== null ? p.min_temperature <= 0 : false,
    light: null,
    avgHeightCm: p.height_max_cm,
    latinName: p.scientific_name,
    commonName: p.name,
    description: p.perenual_raw?.description ?? '',
    imageUrl: p.photo_url ?? '',
    sunlight: p.sunlight ? [p.sunlight] : [],
    filledByAI: false,
  }
}

// ─── Supabase CRUD ───────────────────────────────────────────────────────────

export async function loadPlantsFromDB() {
  return dbFetchAll()
}

export async function savePlantToDB(plant) {
  return dbInsert(plant)
}

export async function updatePlantInDB(id, updates) {
  return dbUpdate(id, updates)
}

export async function deletePlantFromDB(id) {
  return dbDelete(id)
}

export async function logWatering(plantId, note) {
  return dbLogWatering(plantId, note ?? '')
}

export async function uploadPlantPhoto(plantId, file) {
  return dbUploadPhoto(plantId, file)
}
