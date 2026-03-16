import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquant — mode dégradé localStorage uniquement')
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// ─── Plants CRUD ─────────────────────────────────────────────────────────────

export async function fetchAllPlants() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('plants')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function insertPlant(plant) {
  if (!supabase) throw new Error('Supabase non configuré')
  const { data, error } = await supabase
    .from('plants')
    .insert([plant])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePlant(id, updates) {
  if (!supabase) throw new Error('Supabase non configuré')
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
