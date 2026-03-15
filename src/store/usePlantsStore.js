import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { enrichPlant } from '../services/plantEnrichment'
import { analyseRisks } from '../services/weatherRiskEngine'
import { fetchWeather, DEFAULT_COORDS } from '../services/weather'

export const usePlantsStore = create(
  persist(
    (set, get) => ({
      plants: [],
      weatherData: null,
      enrichedProfiles: {},
      activeRisks: [],
      globalSummary: null,
      lastRiskAnalysis: null,
      lastWeatherFetch: null,
      dismissedRiskIds: [],

      addPlant: (plant) =>
        set((state) => ({
          plants: [plant, ...state.plants],
        })),

      deletePlant: (id) =>
        set((state) => ({
          plants: state.plants.filter((p) => p.id !== id),
          enrichedProfiles: Object.fromEntries(
            Object.entries(state.enrichedProfiles).filter(([k]) => k !== id),
          ),
          activeRisks: state.activeRisks.filter((r) => r.plantId !== id),
        })),

      waterAllPlants: () =>
        set((state) => {
          const nowIso = new Date().toISOString()
          return {
            plants: state.plants.map((p) => ({
              ...p,
              lastWatered: nowIso,
              history: [{ date: nowIso, action: 'Arrosage manuel' }, ...(p.history || [])],
            })),
          }
        }),

      waterPlant: (id) =>
        set((state) => ({
          plants: state.plants.map((p) => {
            if (p.id !== id) return p
            const nowIso = new Date().toISOString()
            return {
              ...p,
              lastWatered: nowIso,
              history: [{ date: nowIso, action: 'Arrosage manuel' }, ...(p.history || [])],
            }
          }),
        })),

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
      partialize: (state) => ({
        plants: state.plants,
        weatherData: state.weatherData,
        lastWeatherFetch: state.lastWeatherFetch,
        enrichedProfiles: state.enrichedProfiles,
        dismissedRiskIds: state.dismissedRiskIds,
      }),
    },
  ),
)
