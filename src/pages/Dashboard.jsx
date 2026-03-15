import { Link, useNavigate } from 'react-router-dom'
import RiskBanner from '../components/dashboard/RiskBanner'
import PlantCard from '../components/PlantCard'
import WeeklyImpact from '../components/weather/WeeklyImpact'
import { calculateHydricBalance } from '../services/hydricBalance'
import { usePlantsStore } from '../store/usePlantsStore'

export default function Dashboard() {
  const navigate = useNavigate()
  const plants = usePlantsStore((s) => s.plants)
  const weatherData = usePlantsStore((s) => s.weatherData)
  const waterPlant = usePlantsStore((s) => s.waterPlant)
  const waterAllPlants = usePlantsStore((s) => s.waterAllPlants)

  const enriched = plants
    .map((plant) => {
      const metrics = calculateHydricBalance(plant, weatherData?.pastDays ?? [], weatherData?.daily ?? [])
      return { plant, ...metrics }
    })
    .sort((a, b) => b.urgencyScore - a.urgencyScore)

  return (
    <section className="page">
      <RiskBanner />

      <WeeklyImpact />

      <div className="section-title-row">
        <h2>Mes plantes</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {plants.length > 0 && (
            <button className="water-all-btn" onClick={waterAllPlants}>
              💧 Tout arrosé !
            </button>
          )}
          <Link to="/add" className="link-cta">
            Ajouter
          </Link>
        </div>
      </div>

      {!plants.length ? (
        <div className="empty-state">
          <p>Aucune plante pour le moment.</p>
          <button className="primary-btn" onClick={() => navigate('/add')}>
            Ajouter ma première plante
          </button>
        </div>
      ) : (
        <div className="plant-list">
          {enriched.map((item, idx) => (
            <div key={item.plant.id} className="stagger-in" style={{ animationDelay: `${idx * 80}ms` }}>
              <PlantCard
                plant={item.plant}
                urgencyScore={item.urgencyScore}
                nextWateringDate={item.nextWateringDate}
                reasoning={item.reasoning}
                onWater={waterPlant}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

