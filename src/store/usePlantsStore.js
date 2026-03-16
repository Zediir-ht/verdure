import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { enrichPlant } from '../services/plantEnrichment'
import { analyseRisks } from '../services/weatherRiskEngine'
import { fetchWeather, DEFAULT_COORDS } from '../services/weather'
import {
  fetchAllPlants,
  insertPlant,
  updatePlant as dbUpdatePlant,
  deletePlantById,
  insertWateringLog,
} from '../services/supabase'

// ---------------------------------------------------------------------------
// Hybrid storage: localStorage (fast, offline) + Supabase via /api/store (sync)
// On startup  → try remote first, fall back to localStorage
// On mutation → write localStorage immediately, sync remote after 2 s debounce
// ---------------------------------------------------------------------------
let _syncTimer = null

function scheduleRemoteSync(value) {
  clearTimeout(_syncTimer)
  _syncTimer = setTimeout(() => {
    fetch('/api/store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: value }),
    }).catch(() => {}) // non-fatal — next mutation will retry
  }, 2000)
}

const hybridStorage = {
  async getItem(name) {
    // Prefer remote (may be more recent — e.g. updated from another device)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 4000)
      const res = await fetch('/api/store', { signal: controller.signal })
      clearTimeout(timeout)
      if (res.ok) {
        const { data } = await res.json()
        // Supabase JSONB may return an object — stringify back for createJSONStorage
        if (data != null) return typeof data === 'string' ? data : JSON.stringify(data)
      }
    } catch {
      // network error or Supabase not configured → fall through to localStorage
    }
    return localStorage.getItem(name)
  },
  setItem(name, value) {
    // value is a JSON string produced by createJSONStorage
    localStorage.setItem(name, value)
    scheduleRemoteSync(value)
  },
  removeItem(name) {
    localStorage.removeItem(name)
  },
}

export const usePlantsStore = create(
  persist(
    (set, get) => ({
      plants: [],
      plantsLoaded: false,         // true once Supabase fetch completed (or failed)
      plantsLoading: false,
      weatherData: null,
      enrichedProfiles: {},
      activeRisks: [],
      globalSummary: null,
      lastRiskAnalysis: null,
      lastWeatherFetch: null,
      dismissedRiskIds: [],

      // ── Load plants from Supabase ─────────────────────────────────────────
      loadPlants: async () => {
        set({ plantsLoading: true })
        try {
          const plants = await fetchAllPlants()
          set({ plants, plantsLoaded: true, plantsLoading: false })
          get().refreshRisks()
        } catch {
          set({ plantsLoaded: true, plantsLoading: false })
        }
      },

      addPlant: async (plant) => {
        // Optimistic local update
        set((state) => ({ plants: [plant, ...state.plants] }))
        try {
          const saved = await insertPlant(plant)
          // Replace temp entry with DB row (may have different UUID)
          if (saved && saved.id !== plant.id) {
            set((state) => ({
              plants: state.plants.map((p) => (p.id === plant.id ? saved : p)),
            }))
          }
        } catch {
          // revert on failure
          set((state) => ({ plants: state.plants.filter((p) => p.id !== plant.id) }))
        }
      },

      updatePlant: async (id, updates) => {
        set((state) => ({
          plants: state.plants.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        }))
        try {
          await dbUpdatePlant(id, updates)
        } catch {
          // keep local update, will sync on next load
        }
      },

      deletePlant: async (id) => {
        set((state) => ({
          plants: state.plants.filter((p) => p.id !== id),
          enrichedProfiles: Object.fromEntries(
            Object.entries(state.enrichedProfiles).filter(([k]) => k !== id),
          ),
          activeRisks: state.activeRisks.filter((r) => r.plantId !== id),
        }))
        try {
          await deletePlantById(id)
        } catch {
          // non-fatal: will be deleted on next sync
        }
      },

      waterAllPlants: async () => {
        const { plants } = get()
        const nowIso = new Date().toISOString()
        set({
          plants: plants.map((p) => ({
            ...p,
            last_watered: nowIso,
            lastWatered: nowIso,
            history: [{ date: nowIso, action: 'Arrosage manuel' }, ...(p.history || [])],
          })),
        })
        await Promise.allSettled(
          plants.map((p) =>
            Promise.all([
              dbUpdatePlant(p.id, { last_watered: nowIso }),
              insertWateringLog(p.id, 'Arrosage groupé'),
            ]),
          ),
        )
      },

      waterPlant: async (id) => {
        const nowIso = new Date().toISOString()
        set((state) => ({
          plants: state.plants.map((p) => {
            if (p.id !== id) return p
            return {
              ...p,
              last_watered: nowIso,
              lastWatered: nowIso,
              history: [{ date: nowIso, action: 'Arrosage manuel' }, ...(p.history || [])],
            }
          }),
        }))
        try {
          await Promise.all([
            dbUpdatePlant(id, { last_watered: nowIso }),
            insertWateringLog(id, 'Arrosage manuel'),
          ])
        } catch {
          // non-fatal
        }
      },

      updateWeather: (weatherData) =>
        set({
          weatherData,
          lastWeatherFetch: new Date().toISOString(),
        }),

      // Enrich a single plant — stores profile keyed by plant.id
      enrichPlantById: async (plantId) => {
        const plant = get().plants.find((p) => p.id === plantId)
        if (!plant) return
        try {
          const profile = await enrichPlant(plant)
          set((state) => ({
            enrichedProfiles: { ...state.enrichedProfiles, [plantId]: profile },
          }))
          // Re-analyse risks after enrichment
          get().refreshRisks()
        } catch {
          // enrichment failure is non-fatal
        }
      },

      // Enrich all plants that don't have a profile yet
      enrichAllPlants: async () => {
        const { plants, enrichedProfiles } = get()
        const toEnrich = plants.filter((p) => !enrichedProfiles[p.id])
        await Promise.allSettled(toEnrich.map((p) => get().enrichPlantById(p.id)))
      },

      // Run risk analysis synchronously (called after weather/enrich updates)
      refreshRisks: () => {
        const { plants, enrichedProfiles, weatherData, dismissedRiskIds } = get()
        if (!weatherData) return
        const { risks, globalSummary } = analyseRisks(
          plants,
          enrichedProfiles,
          weatherData,
          dismissedRiskIds,
        )
        set({ activeRisks: risks, globalSummary, lastRiskAnalysis: new Date().toISOString() })
      },

      dismissRisk: (riskId) =>
        set((state) => ({
          dismissedRiskIds: [...new Set([...state.dismissedRiskIds, riskId])],
          activeRisks: state.activeRisks.filter((r) => r.id !== riskId),
        })),

      // Fetch weather then re-analyse risks
      refreshWeather: async () => {
        try {
          const data = await fetchWeather(DEFAULT_COORDS.lat, DEFAULT_COORDS.lon)
          set({ weatherData: data, lastWeatherFetch: new Date().toISOString() })
          get().refreshRisks()
        } catch {
          // leave previous weather data intact
        }
      },
    }),
    {
      name: 'verdure-store',
      storage: createJSONStorage(() => hybridStorage),
      partialize: (state) => ({
        plants: state.plants,
        weatherData: state.weatherData,
        lastWeatherFetch: state.lastWeatherFetch,
        enrichedProfiles: state.enrichedProfiles,
        dismissedRiskIds: state.dismissedRiskIds,
        plantsLoaded: false, // always reload on next boot
      }),
    },
  ),
)
