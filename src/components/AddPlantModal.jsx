import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPlantDetails, searchPlants } from '../services/plants'
import { usePlantsStore } from '../store/usePlantsStore'

const emojis = ['🪴', '🌿', '🌵', '🌸', '🌱', '🍃', '🪻', '🌺']

const locationLabels = {
  interieur: 'Intérieur',
  balcon: 'Balcon',
  exterieur: 'Extérieur',
}

const potLabels = {
  small: 'Petit',
  medium: 'Moyen',
  large: 'Grand',
}

export default function AddPlantModal() {
  const navigate = useNavigate()
  const addPlant = usePlantsStore((s) => s.addPlant)

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState([])
  const [searchError, setSearchError] = useState('')

  const [selected, setSelected] = useState(null)
  const [details, setDetails] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  const [emoji, setEmoji] = useState('🪴')
  const [location, setLocation] = useState('interieur')
  const [potSize, setPotSize] = useState('medium')

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!query.trim()) {
        setResults([])
        return
      }
      setSearching(true)
      setSearchError('')
      try {
        const items = await searchPlants(query)
        setResults(items)
      } catch (e) {
        setSearchError(e.message)
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => clearTimeout(handle)
  }, [query])

  const canConfirm = useMemo(() => selected && details, [selected, details])

  const onSelectPlant = async (item) => {
    setSelected(item)
    setDetails(null)
    setDetailsLoading(true)
    try {
      const payload = await getPlantDetails(item.id)
      setDetails(payload)
    } finally {
      setDetailsLoading(false)
    }
  }

  const onConfirm = () => {
    if (!selected || !details) return

    const now = new Date().toISOString()
    addPlant({
      id: crypto.randomUUID(),
      name: selected.name,
      emoji,
      type: details.watering?.toLowerCase()?.includes('minimum') ? 'cactus' : 'tropical',
      perenualId: selected.id,
      wateringCoefficient: details.wateringCoefficient,
      location,
      potSize,
      lastWatered: now,
      history: [{ date: now, action: 'Plante ajoutée' }],
      notes: '',
      info: details,
    })

    navigate('/')
  }

  return (
    <div className="sheet-backdrop" onClick={() => navigate(-1)}>
      <section className="sheet-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h2>Ajouter une plante</h2>

        {!selected ? (
          <>
            <label className="field-label">Rechercher une espèce</label>
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ex: Monstera, Basilic..."
            />
            {searching ? <p className="text-dim">Recherche en cours…</p> : null}
            {searchError ? <p className="error">{searchError}</p> : null}

            <ul className="result-list">
              {results.map((item) => (
                <li key={item.id}>
                  <button type="button" className="result-item" onClick={() => onSelectPlant(item)}>
                    {item.thumbnail ? <img src={item.thumbnail} alt="" /> : <span className="thumb-empty">🌿</span>}
                    <span>{item.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <div className="selected-plant">
              <h3>{selected.name}</h3>
              {detailsLoading ? <p>Chargement des détails…</p> : null}
              {details ? (
                <>
                  <p className="text-dim">Arrosage: {details.watering}</p>
                  <p className="text-dim">Ensoleillement: {(details.sunlight || []).join(', ') || 'Variable'}</p>
                </>
              ) : null}
            </div>

            <label className="field-label">Choisis un emoji</label>
            <div className="emoji-row">
              {emojis.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`icon-btn ${emoji === item ? 'active' : ''}`}
                  onClick={() => setEmoji(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <label className="field-label">Emplacement</label>
            <div className="segmented">
              {Object.entries(locationLabels).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={location === value ? 'active' : ''}
                  onClick={() => setLocation(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="field-label">Taille du pot</label>
            <div className="segmented">
              {Object.entries(potLabels).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={potSize === value ? 'active' : ''}
                  onClick={() => setPotSize(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <button className="primary-btn" onClick={onConfirm} disabled={!canConfirm}>
              Confirmer
            </button>
          </>
        )}
      </section>
    </div>
  )
}
