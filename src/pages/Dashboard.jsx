import { Link, useNavigate } from 'react-router-dom'
import PlantCard from '../components/PlantCard'
import { calculateHydricBalance } from '../services/hydricBalance'
import { usePlantsStore } from '../store/usePlantsStore'

export default function Dashboard() {
  const navigate = useNavigate()
  const plants = usePlantsStore((s) => s.plants)
  const weatherData = usePlantsStore((s) => s.weatherData)
  const waterPlant = usePlantsStore((s) => s.waterPlant)

  const enriched = plants
    .map((plant) => {
      const metrics = calculateHydricBalance(plant, weatherData?.pastDays ?? [], weatherData?.daily ?? [])
      return { plant, ...metrics }
    })
    .sort((a, b) => b.urgencyScore - a.urgencyScore)

  const criticalCount = enriched.filter((item) => item.urgencyScore > 80).length

  return (
    <section className="page">
      {criticalCount > 0 ? (
        <div className="alert-banner">{criticalCount} plantes ont besoin d'eau maintenant</div>
      ) : null}

      <div className="section-title-row">
        <h2>Mes plantes</h2>
        <Link to="/add" className="link-cta">
          Ajouter
        </Link>
      </div>

      {!plants.length ? (
        <div className="empty-state">
          <p>Aucune plante pour le moment.</p>
          <button className="primary-btn" onClick={() => navigate('/add')}>
            Ajouter ma première plante
          </button>
        </div>
      ) : (
        <div className="plant-grid">
          {enriched.map((item, idx) => (
            <div key={item.plant.id} style={{ animationDelay: `${idx * 90}ms` }} className="stagger-in">
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

      <button className="fab" onClick={() => navigate('/add')} aria-label="Ajouter une plante">
        +
      </button>
    </section>
  )
}
