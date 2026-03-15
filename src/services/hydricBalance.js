const typeCoefficientMap = {
  cactus: 0.2,
  tropical: 0.8,
  flower: 0.7,
  aromatic: 1,
  fern: 0.9,
  orchid: 0.5,
  default: 0.6,
}

const locationFactorMap = {
  interieur: 0,
  balcon: 0.5,
  exterieur: 1,
}

const potCapacityMap = {
  small: 20,
  medium: 40,
  large: 70,
}

function plantCoefficient(plant) {
  if (typeof plant?.wateringCoefficient === 'number') {
    return plant.wateringCoefficient
  }
  return typeCoefficientMap[plant?.type] ?? typeCoefficientMap.default
}

function computeProjectedBalances(capacity, coeff, locationFactor, days) {
  let running = capacity
  return days.map((d) => {
    running = running - (Number(d.et0 || 0) * coeff) + (Number(d.precipitation || 0) * locationFactor)
    return { ...d, balance: Number(running.toFixed(2)) }
  })
}

export function calculateHydricBalance(plant, weatherHistory = [], forecast = []) {
  const coeff = plantCoefficient(plant)
  const locationFactor = locationFactorMap[plant?.location] ?? 0.5
  const capacity = potCapacityMap[plant?.potSize] ?? potCapacityMap.medium

  const allDays = [...weatherHistory, ...forecast]
  const evapLoss = allDays.reduce((sum, d) => sum + Number(d.et0 || 0) * coeff, 0)
  const rainGain = allDays.reduce((sum, d) => sum + Number(d.precipitation || 0) * locationFactor, 0)

  const balance = capacity - evapLoss + rainGain
  const normalizedDeficit = Math.max(0, Math.min(1, (capacity - balance) / capacity))
  const urgencyScore = Math.round(normalizedDeficit * 100)
  const needsWater = urgencyScore > 65

  const projected = computeProjectedBalances(capacity, coeff, locationFactor, forecast)
  const triggerDay = projected.find((d) => d.balance < capacity * 0.35)
  const nextWateringDate = triggerDay ? new Date(triggerDay.date) : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)

  const rainComing = forecast.slice(0, 3).reduce((sum, d) => sum + Number(d.precipitation || 0), 0)
  const reasoning = needsWater
    ? rainComing > 4
      ? 'Un peu de pluie arrive, mais le déficit hydrique reste élevé.'
      : 'Le sol estimé est trop sec, un arrosage est recommandé rapidement.'
    : rainComing > 2
      ? 'Les pluies prévues aident à maintenir une bonne réserve en eau.'
      : "L'équilibre hydrique reste correct pour l'instant."

  const forecastImpact =
    rainComing > 5
      ? 'La pluie prévue devrait retarder le prochain arrosage.'
      : rainComing > 1
        ? "Un léger apport de pluie limitera les besoins d'arrosage."
        : "Peu de pluie attendue : surveille l'humidité du substrat."

  return {
    needsWater,
    urgencyScore,
    nextWateringDate,
    reasoning,
    forecastImpact,
    balance,
    projected,
  }
}
