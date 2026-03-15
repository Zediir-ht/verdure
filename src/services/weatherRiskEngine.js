// Weather risk engine: analyses weather data against enriched plant profiles
// to produce actionable alerts with French messages.

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCurrentSeason(date = new Date()) {
  const month = date.getMonth() + 1 // 1-12
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

function seasonLabel(season) {
  return { spring: 'printemps', summer: 'été', autumn: 'automne', winter: 'hiver' }[season] ?? season
}

function weatherCodeToDesc(code) {
  if (code === 0) return 'ciel dégagé'
  if (code <= 3) return 'partiellement nuageux'
  if (code <= 49) return 'brumeux'
  if (code <= 69) return 'pluie légère'
  if (code <= 79) return 'neige'
  if (code <= 82) return 'averses'
  if (code <= 99) return 'orages'
  return 'variable'
}

function deadlineLabel(daysAhead) {
  if (daysAhead <= 0) return "aujourd'hui"
  if (daysAhead === 1) return 'demain matin'
  if (daysAhead === 2) return 'dans 2 jours'
  if (daysAhead <= 4) return `dans ${daysAhead} jours`
  return 'cette semaine'
}

function isOutdoor(plant) {
  return plant?.location === 'exterieur' || plant?.location === 'balcon'
}

// ─── Risk detection functions ─────────────────────────────────────────────────

function detectFrostRisk(plant, profile, forecast, plantId) {
  const risks = []
  const threshold = profile.minTemperature ?? 3

  forecast.forEach((day, idx) => {
    const min = day.tempMin
    if (min == null) return

    const gap = min - threshold
    let level = null
    if (gap <= -3) level = 'critical'
    else if (gap <= 0) level = 'danger'
    else if (gap <= 3) level = 'warning'
    if (!level) return

    const tempStr = `${min > 0 ? '+' : ''}${min.toFixed(1)}°C`
    const threshStr = `${threshold > 0 ? '+' : ''}${threshold}°C`

    let message
    if (level === 'critical') {
      message = `Rentrer ${plant.name} immédiatement, gel sévère prévu à ${tempStr} (seuil critique : ${threshStr})`
    } else if (level === 'danger') {
      message = `Protéger ${plant.name} avec un voile hivernal, température de ${tempStr} attendue`
    } else {
      if (profile.frostHardy) {
        message = `${plant.name} résistant jusqu'à ${threshStr}, surveiller tout de même le gel`
        level = 'info'
      } else {
        message = `Surveiller ${plant.name} : petite gelée possible à ${tempStr}, proche du seuil (${threshStr})`
      }
    }

    risks.push({
      id: `frost_${plantId}_${idx}`,
      plantId,
      plantName: plant.name,
      plantEmoji: plant.emoji ?? '🌿',
      riskType: 'frost',
      level,
      title: 'Risque de gel',
      message,
      action: level === 'critical' || level === 'danger' ? 'rentrer' : 'protéger',
      deadline: deadlineLabel(idx),
      triggerValue: `${tempStr} prévu`,
      autoResolve: true,
    })
  })

  return risks
}

function detectHeatRisk(plant, profile, forecast, plantId) {
  const risks = []
  const threshold = profile.maxTemperature ?? 35

  forecast.forEach((day, idx) => {
    const max = day.tempMax
    if (max == null) return

    const gap = max - threshold
    let level = null
    if (gap > 3) level = 'danger'
    else if (gap > 0) level = 'warning'
    else if (gap > -3) level = 'info'
    if (!level) return

    const tempStr = `${max.toFixed(0)}°C`
    let message
    if (level === 'danger') {
      if (!isOutdoor(plant)) {
        message = `Déplacer ${plant.name} loin de la fenêtre sud, ${tempStr} prévus`
      } else {
        message = `Ombrager ${plant.name} avec une toile, brûlures foliaires probables à ${tempStr}`
      }
    } else if (level === 'warning') {
      message = `Arroser ${plant.name} tôt le matin avant la chaleur, ${tempStr} attendus`
    } else {
      message = `${plant.name} approche de son seuil de stress thermique (${tempStr}, max conseillé : ${threshold}°C)`
    }

    risks.push({
      id: `heat_${plantId}_${idx}`,
      plantId,
      plantName: plant.name,
      plantEmoji: plant.emoji ?? '🌿',
      riskType: 'heat',
      level,
      title: 'Stress thermique',
      message,
      action: isOutdoor(plant) ? 'ombrager' : 'aucune',
      deadline: deadlineLabel(idx),
      triggerValue: `${tempStr} prévu`,
      autoResolve: true,
    })
  })

  return risks
}

function detectWindRisk(plant, profile, forecast, plantId) {
  if (!isOutdoor(plant)) return []
  const risks = []

  forecast.forEach((day, idx) => {
    const gusts = day.windGustsMax ?? day.windSpeedMax ?? 0
    if (gusts < 50) return

    const level = gusts > 70 ? 'danger' : 'warning'
    const gustStr = `${gusts.toFixed(0)} km/h`

    let message
    if (level === 'danger') {
      if (plant.location === 'balcon') {
        message = `Rentrer les pots de ${plant.name} du balcon, rafales à ${gustStr} prévues`
      } else {
        message = `Attacher ${plant.name} ou tuteurer, risque de dégâts avec des rafales à ${gustStr}`
      }
    } else {
      message = `Surveiller ${plant.name} : vents forts prévus (rafales ${gustStr})`
    }

    risks.push({
      id: `wind_${plantId}_${idx}`,
      plantId,
      plantName: plant.name,
      plantEmoji: plant.emoji ?? '🌿',
      riskType: 'wind',
      level,
      title: 'Vents forts',
      message,
      action: plant.location === 'balcon' ? 'rentrer' : 'tuteurer',
      deadline: deadlineLabel(idx),
      triggerValue: `rafales ${gustStr}`,
      autoResolve: true,
    })
  })

  return risks
}

function detectRainRisk(plant, profile, forecast, plantId) {
  if (!isOutdoor(plant)) return []
  if (profile.overWateringRisk !== 'élevé') return []
  const risks = []

  forecast.forEach((day, idx) => {
    const rain = day.precipitation ?? 0
    if (rain < 20) return

    const rainStr = `${rain.toFixed(0)} mm`
    let message
    if (rain > 40) {
      message = `Rentrer ${plant.name} du balcon, pluie intense prévue (${rainStr}) — risque de pourriture racinaire`
    } else {
      message = `Vérifier le drainage de ${plant.name}, ${rainStr} de pluie prévus`
    }

    risks.push({
      id: `rain_${plantId}_${idx}`,
      plantId,
      plantName: plant.name,
      plantEmoji: plant.emoji ?? '🌿',
      riskType: 'rain',
      level: rain > 40 ? 'danger' : 'warning',
      title: 'Excès de pluie',
      message,
      action: rain > 40 ? 'rentrer' : 'drainer',
      deadline: deadlineLabel(idx),
      triggerValue: `${rainStr} de pluie`,
      autoResolve: true,
    })
  })

  return risks
}

function detectDroughtRisk(plant, profile, pastDays, forecast, plantId) {
  if (profile.droughtTolerant) return []

  // Count consecutive dry days (past + near future)
  const allDays = [...(pastDays ?? []), ...(forecast ?? []).slice(0, 4)]
  let dryStreak = 0
  for (let i = allDays.length - 1; i >= 0; i--) {
    if ((allDays[i].precipitation ?? 0) < 1) dryStreak++
    else break
  }

  const cumEt0 = allDays.slice(-5).reduce((sum, d) => sum + (d.et0 ?? 0), 0)
  if (dryStreak < 5 || cumEt0 < 30) return []

  const message =
    dryStreak > 8
      ? `Aucune pluie depuis ${dryStreak} jours et forte chaleur : arroser profondément ${plant.name} ce soir`
      : `${dryStreak} jours sans pluie et forte évapotranspiration : ${plant.name} montre des signes de stress hydrique probable`

  return [
    {
      id: `drought_${plantId}`,
      plantId,
      plantName: plant.name,
      plantEmoji: plant.emoji ?? '🌿',
      riskType: 'drought',
      level: dryStreak > 8 ? 'danger' : 'warning',
      title: 'Stress de sécheresse',
      message,
      action: 'arroser',
      deadline: "aujourd'hui",
      triggerValue: `${dryStreak} jours sans pluie`,
      autoResolve: false,
    },
  ]
}

function detectUvRisk(plant, profile, forecast, plantId) {
  const season = getCurrentSeason()
  if (season === 'winter') return []
  if (!isOutdoor(plant)) return []
  if (profile.sunlight === 'plein-soleil') return []

  const risks = []
  forecast.forEach((day, idx) => {
    const uv = day.uvIndexMax ?? 0
    if (uv < 7) return

    const message =
      uv >= 9
        ? `UV index ${uv} prévu : déplacer ${plant.name} à l'ombre, risque de brûlures foliaires graves`
        : `UV index ${uv} prévu : ${plant.name} en balcon risque des brûlures foliaires aujourd'hui`

    risks.push({
      id: `uv_${plantId}_${idx}`,
      plantId,
      plantName: plant.name,
      plantEmoji: plant.emoji ?? '🌿',
      riskType: 'uv',
      level: uv >= 9 ? 'danger' : 'warning',
      title: 'UV intense',
      message,
      action: 'ombrager',
      deadline: deadlineLabel(idx),
      triggerValue: `UV ${uv}`,
      autoResolve: true,
    })
  })

  return risks
}

function detectHumidityRisk(plant, profile, current, plantId) {
  const humidity = current?.humidity ?? 0
  if (humidity < 85) return []
  if (profile.mistingNeeded) return [] // high humidity is fine for misting plants

  // Only flag plants susceptible to fungal issues
  const vulnerable =
    profile.vulnerabilities?.includes('humidité') ||
    profile.overWateringRisk === 'élevé' ||
    plant.type === 'flower'

  if (!vulnerable) return []

  return [
    {
      id: `humidity_${plantId}`,
      plantId,
      plantName: plant.name,
      plantEmoji: plant.emoji ?? '🌿',
      riskType: 'humidity',
      level: 'warning',
      title: 'Humidité excessive',
      message: `Humidité ${humidity}% : aérer autour de ${plant.name} pour prévenir les maladies fongiques`,
      action: 'aérer',
      deadline: "aujourd'hui",
      triggerValue: `${humidity}% humidité`,
      autoResolve: true,
    },
  ]
}

function detectSeasonalTransition(plant, profile, forecast, plantId) {
  const risks = []
  const season = getCurrentSeason()
  const minForecast = Math.min(...forecast.map((d) => d.tempMin ?? 99))
  const maxForecast = Math.max(...forecast.map((d) => d.tempMax ?? -99))

  // First frost of autumn
  if (season === 'autumn' && minForecast < 3 && !profile.frostHardy) {
    risks.push({
      id: `seasonal_frost_${plantId}`,
      plantId,
      plantName: plant.name,
      plantEmoji: plant.emoji ?? '🌿',
      riskType: 'seasonal',
      level: 'warning',
      title: 'Première gelée approche',
      message: `Première gelée probable cette semaine (${minForecast.toFixed(1)}°C) : préparer ${plant.name} pour l'hiver`,
      action: 'protéger',
      deadline: 'cette semaine',
      triggerValue: `${minForecast.toFixed(1)}°C prévu`,
      autoResolve: false,
    })
  }

  // Spring warming
  if (season === 'spring' && maxForecast > 15) {
    const action = profile.baseFrequencyDays?.spring
    if (action || profile.seasonalActions?.spring) {
      risks.push({
        id: `seasonal_spring_${plantId}`,
        plantId,
        plantName: plant.name,
        plantEmoji: plant.emoji ?? '🌿',
        riskType: 'seasonal',
        level: 'info',
        title: 'Le printemps arrive',
        message: profile.seasonalActions?.spring
          ? `${plant.name} : ${profile.seasonalActions.spring}`
          : `Le printemps arrive (${maxForecast.toFixed(0)}°C), augmenter les arrosages de ${plant.name}`,
        action: 'arroser',
        deadline: 'cette semaine',
        triggerValue: `${maxForecast.toFixed(0)}°C prévu`,
        autoResolve: true,
      })
    }
  }

  return risks
}

// ─── Level ordering ───────────────────────────────────────────────────────────

const LEVEL_WEIGHT = { critical: 4, danger: 3, warning: 2, info: 1 }

function deduplicateRisks(risks) {
  // Keep only the highest-level risk per plant per type
  const seen = new Map()
  const sorted = [...risks].sort((a, b) => (LEVEL_WEIGHT[b.level] ?? 0) - (LEVEL_WEIGHT[a.level] ?? 0))
  return sorted.filter((r) => {
    const key = `${r.plantId}_${r.riskType}`
    if (seen.has(key)) return false
    seen.set(key, true)
    return true
  })
}

// ─── Global summary ───────────────────────────────────────────────────────────

function buildGlobalSummary(risks, weatherData) {
  const current = weatherData?.current ?? {}
  const forecast = weatherData?.daily ?? []
  const season = getCurrentSeason()

  const criticalCount = risks.filter((r) => r.level === 'critical').length
  const dangerCount = risks.filter((r) => r.level === 'danger').length
  const warningCount = risks.filter((r) => r.level === 'warning').length

  const topPriority = [...risks].sort(
    (a, b) => (LEVEL_WEIGHT[b.level] ?? 0) - (LEVEL_WEIGHT[a.level] ?? 0),
  )[0] ?? null

  // Build weather summary sentence
  const avgMax = forecast.slice(0, 5).reduce((s, d) => s + (d.tempMax ?? 0), 0) / Math.max(1, forecast.slice(0, 5).length)
  const totalRain = forecast.slice(0, 5).reduce((s, d) => s + (d.precipitation ?? 0), 0)
  const weatherCode = current.weatherCode ?? 0
  const desc = weatherCodeToDesc(weatherCode)

  let weatherSummary
  if (avgMax < 5) {
    weatherSummary = `Semaine froide en ${seasonLabel(season)}, moyennes autour de ${avgMax.toFixed(0)}°C — risques de gel à surveiller.`
  } else if (totalRain > 40) {
    weatherSummary = `Semaine pluvieuse (${totalRain.toFixed(0)} mm cumulés), ${desc} actuellement à Rodez.`
  } else if (avgMax > 32) {
    weatherSummary = `Semaine chaude (${avgMax.toFixed(0)}°C en moyenne), stress thermique possible pour certaines plantes.`
  } else {
    weatherSummary = `Semaine ${totalRain > 5 ? 'humide' : 'sèche'}, températures douces autour de ${avgMax.toFixed(0)}°C à Rodez.`
  }

  let generalAdvice
  if (criticalCount > 0) {
    generalAdvice = 'Des plantes nécessitent une attention immédiate — vérifiez les alertes critiques.'
  } else if (dangerCount > 0) {
    generalAdvice = `${dangerCount} plante${dangerCount > 1 ? 's' : ''} en danger cette semaine — agissez dès que possible.`
  } else if (warningCount > 0) {
    generalAdvice = 'Conditions globalement favorables, quelques ajustements recommandés cette semaine.'
  } else {
    generalAdvice = 'Toutes vos plantes devraient bien se porter cette semaine — continuez votre routine.'
  }

  return {
    criticalCount,
    dangerCount,
    warningCount,
    topPriority,
    weatherSummary,
    generalAdvice,
    season,
    currentTemp: current.temperature ?? null,
    currentHumidity: current.humidity ?? null,
    currentWeatherCode: weatherCode,
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Analyse risks for all plants given enriched profiles + weather data.
 * @param {Array} plants - store plants array
 * @param {Object} enrichedProfiles - map of plantId → enriched profile
 * @param {Object} weatherData - from fetchWeather()
 * @param {Array} dismissedRiskIds - user-dismissed risk ids
 * @returns {{ risks: Array, globalSummary: Object }}
 */
export function analyseRisks(plants, enrichedProfiles, weatherData, dismissedRiskIds = []) {
  if (!weatherData || !plants?.length) {
    return { risks: [], globalSummary: buildGlobalSummary([], weatherData) }
  }

  const current = weatherData.current ?? {}
  const forecast = weatherData.daily ?? []
  const pastDays = weatherData.pastDays ?? []

  const allRisks = []

  for (const plant of plants) {
    const profile = enrichedProfiles[plant.id] ?? {
      minTemperature: 3,
      maxTemperature: 35,
      droughtTolerant: false,
      frostHardy: false,
      overWateringRisk: 'moyen',
      mistingNeeded: false,
      sunlight: 'mi-ombre',
      vulnerabilities: [],
      seasonalActions: {},
    }

    allRisks.push(
      ...detectFrostRisk(plant, profile, forecast, plant.id),
      ...detectHeatRisk(plant, profile, forecast, plant.id),
      ...detectWindRisk(plant, profile, forecast, plant.id),
      ...detectRainRisk(plant, profile, forecast, plant.id),
      ...detectDroughtRisk(plant, profile, pastDays, forecast, plant.id),
      ...detectUvRisk(plant, profile, forecast, plant.id),
      ...detectHumidityRisk(plant, profile, current, plant.id),
      ...detectSeasonalTransition(plant, profile, forecast, plant.id),
    )
  }

  const deduped = deduplicateRisks(allRisks)
  const filtered = dismissedRiskIds.length
    ? deduped.filter((r) => !dismissedRiskIds.includes(r.id))
    : deduped

  const sorted = filtered.sort(
    (a, b) =>
      (LEVEL_WEIGHT[b.level] ?? 0) - (LEVEL_WEIGHT[a.level] ?? 0),
  )

  const globalSummary = buildGlobalSummary(sorted, weatherData)

  return { risks: sorted, globalSummary }
}

export { getCurrentSeason, weatherCodeToDesc, LEVEL_WEIGHT }
