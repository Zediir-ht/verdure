import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const usePlantsStore = create(
  persist(
    (set) => ({
      plants: [],
      weatherData: null,
      lastWeatherFetch: null,

      addPlant: (plant) =>
        set((state) => ({
          plants: [plant, ...state.plants],
        })),

      deletePlant: (id) =>
        set((state) => ({
          plants: state.plants.filter((p) => p.id !== id),
        })),

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
    }),
    {
      name: 'verdure-store',
      partialize: (state) => ({
        plants: state.plants,
        weatherData: state.weatherData,
        lastWeatherFetch: state.lastWeatherFetch,
      }),
    },
  ),
)
