import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquant — mode dégradé localStorage uniquement')
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Promesse résolue dès qu'une session (anonyme ou non) est disponible
let _authReady = null
function authReady() {
  if (!supabase) return Promise.resolve()
  if (_authReady) return _authReady
  _authReady = supabase.auth.getSession().then(async ({ data }) => {
    if (!data.session) {
      await supabase.auth.signInAnonymously().catch(() => {})
    }
  })
  return _authReady
}

// ─── Plants CRUD ─────────────────────────────────────────────────────────────

export async function fetchAllPlants() {
  if (!supabase) return []
  await authReady()
  const { data, error } = await supabase
    .from('plants')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// Colonnes valides de la table plants (cf. supabase-schema.sql)
const PLANT_COLUMNS = [
  'id', 'name', 'scientific_name', 'family', 'slug', 'perenual_id',
  'photo_url', 'emoji',
  'watering_frequency', 'watering_interval_days', 'sunlight', 'soil_type',
  'fertilizer_type', 'fertilizer_season', 'pruning_month', 'pruning_description',
  'origin', 'indoor', 'outdoor', 'cycle', 'growth_rate', 'maintenance',
  'toxic_humans', 'toxic_dogs', 'toxic_cats',
  'min_temperature', 'max_temperature',
  'height_min_cm', 'height_max_cm', 'width_min_cm', 'width_max_cm',
  'flowering_season', 'dormant_season', 'hardiness_zone',
  'location', 'room', 'pot_size',
  'last_watered', 'last_fertilized', 'last_repotted',
  'notes', 'perenual_raw',
]

function sanitizePlant(plant) {
  return Object.fromEntries(
    PLANT_COLUMNS
      .filter((k) => plant[k] !== undefined)
      .map((k) => [k, plant[k]])
  )
}

export async function insertPlant(plant) {
  if (!supabase) throw new Error('Supabase non configuré')
  await authReady()
  const row = sanitizePlant(plant)
  const { data, error } = await supabase
    .from('plants')
    .insert([row])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePlant(id, updates) {
  if (!supabase) throw new Error('Supabase non configuré')
  await authReady()
  const { data, error } = await supabase
    .from('plants')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePlantById(id) {
  if (!supabase) throw new Error('Supabase non configuré')
  await authReady()
  const { error } = await supabase.from('plants').delete().eq('id', id)
  if (error) throw error
}

// ─── Watering logs ────────────────────────────────────────────────────────────

export async function fetchWateringLogs(plantId) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('watering_logs')
    .select('*')
    .eq('plant_id', plantId)
    .order('watered_at', { ascending: false })
    .limit(60)
  if (error) throw error
  return data ?? []
}

export async function insertWateringLog(plantId, note = '', amount_ml = null) {
  if (!supabase) return null
  await authReady()
  const { data, error } = await supabase
    .from('watering_logs')
    .insert([{ plant_id: plantId, watered_at: new Date().toISOString(), note, amount_ml }])
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Photo upload ─────────────────────────────────────────────────────────────

export async function uploadPlantPhoto(plantId, file) {
  if (!supabase) throw new Error('Supabase non configuré')
  const ext = file.name.split('.').pop().toLowerCase()
  const allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif']
  if (!allowed.includes(ext)) throw new Error('Format de fichier non supporté')
  if (file.size > 5 * 1024 * 1024) throw new Error('Fichier trop volumineux (max 5 Mo)')

  const path = `plants/${plantId}/photo.${ext}`
  const { error: uploadError } = await supabase.storage
    .from('plant-photos')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('plant-photos').getPublicUrl(path)
  // Bust cache with timestamp
  return `${data.publicUrl}?t=${Date.now()}`
}
