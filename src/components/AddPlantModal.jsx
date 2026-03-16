import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Badge, Button, Card, Input, Select, Spin, Tag, Typography, Space, Divider, Avatar
} from 'antd'
import {
  SearchOutlined, CheckCircleOutlined, EnvironmentOutlined, ArrowLeftOutlined
} from '@ant-design/icons'
import { searchPlants, getPlantDetails } from '../services/plants'
import { usePlantsStore } from '../store/usePlantsStore'

const { Text, Title } = Typography

const emojis = ['🪴', '🌿', '🌵', '🌸', '🌱', '🍃', '🪻', '🌺']

const locationOptions = [
  { value: 'interieur', label: '🏠 Intérieur' },
  { value: 'balcon', label: '🌤 Balcon' },
  { value: 'exterieur', label: '🌳 Extérieur' },
]

const roomOptions = [
  { value: 'salon', label: 'Salon' },
  { value: 'cuisine', label: 'Cuisine' },
  { value: 'chambre', label: 'Chambre' },
  { value: 'salle_de_bain', label: 'Salle de bain' },
  { value: 'bureau', label: 'Bureau' },
  { value: 'terrasse', label: 'Terrasse' },
]

const potOptions = [
  { value: 'small', label: 'Petit' },
  { value: 'medium', label: 'Moyen' },
  { value: 'large', label: 'Grand' },
]

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
  const [detailsError, setDetailsError] = useState('')

  const [emoji, setEmoji] = useState('🪴')
  const [location, setLocation] = useState('interieur')
  const [room, setRoom] = useState('salon')
  const [potSize, setPotSize] = useState('medium')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!query.trim()) { setResults([]); return }
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
    }, 400)
    return () => clearTimeout(handle)
  }, [query])

  const canConfirm = useMemo(() => selected && details && !saving, [selected, details, saving])

  const onSelectPlant = async (item) => {
    setSelected(item)
    setDetails(null)
    setDetailsError('')
    setDetailsLoading(true)
    try {
      const payload = await getPlantDetails(item.id)
      setDetails(payload)
    } catch (e) {
      setDetailsError(e.message || 'Impossible de charger les détails.')
    } finally {
      setDetailsLoading(false)
    }
  }

  const onConfirm = async () => {
    if (!selected || !details) return
    setSaving(true)
    const now = new Date().toISOString()
    const coeff = details.wateringCoefficient ?? 0.5
    const type = coeff <= 0.25 ? 'cactus' : coeff >= 0.8 ? 'tropical' : 'flower'

    const plant = {
      id: crypto.randomUUID(),
      // User fields
      name: details.name ?? selected.name,
      scientific_name: details.scientific_name ?? selected.latinName ?? '',
      latinName: details.scientific_name ?? selected.latinName ?? '',
      family: details.family ?? '',
      slug: details.slug ?? '',
      perenual_id: details.perenual_id ?? selected.id ?? null,
      emoji,
      type,
      // Soins
      watering_frequency: details.watering_frequency ?? '',
      watering_interval_days: details.watering_interval_days ?? 7,
      wateringIntervalDays: details.watering_interval_days ?? 7,
      wateringCoefficient: details.wateringCoefficient ?? 0.5,
      sunlight: details.sunlight ?? '',
      soil_type: details.soil_type ?? '',
      fertilizer_type: details.fertilizer_type ?? '',
      pruning_month: details.pruning_month ?? '',
      pruning_description: details.pruning_description ?? '',
      // Caractéristiques
      origin: details.origin ?? '',
      indoor: details.indoor ?? (location === 'interieur'),
      outdoor: details.outdoor ?? (location !== 'interieur'),
      cycle: details.cycle ?? '',
      growth_rate: details.growth_rate ?? '',
      // Toxicité
      toxic_humans: details.toxic_humans ?? false,
      toxic_dogs: details.toxic_dogs ?? false,
      toxic_cats: details.toxic_cats ?? false,
      // Températures
      min_temperature: details.min_temperature ?? null,
      max_temperature: details.max_temperature ?? null,
      // Taille
      height_min_cm: details.height_min_cm ?? null,
      height_max_cm: details.height_max_cm ?? null,
      // Saisons
      flowering_season: details.flowering_season ?? '',
      // Photo
      photo_url: details.photo_url ?? details.imageUrl ?? null,
      // Localisation
      location,
      room,
      pot_size: potSize,
      potSize,
      // Dates
      last_watered: now,
      lastWatered: now,
      last_fertilized: null,
      last_repotted: null,
      // Notes
      notes: '',
      history: [{ date: now, action: 'Plante ajoutée' }],
      // Info pour hydricBalance
      info: details,
    }

    await addPlant(plant)
    navigate('/')
  }

  return (
    <div className="sheet-backdrop" onClick={() => navigate(-1)}>
      <motion.section
        className="sheet-modal"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            type="text"
            onClick={() => navigate(-1)}
            style={{ minWidth: 44, minHeight: 44 }}
          />
          <Title level={4} style={{ margin: 0, color: '#4a7c59' }}>
            🌱 Ajouter une plante
          </Title>
        </div>

        <AnimatePresence mode="wait">
          {!selected ? (
            <motion.div
              key="search"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Input
                size="large"
                prefix={<SearchOutlined style={{ color: '#4a7c59' }} />}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ex: Monstera, Basilic, Lavande..."
                autoFocus
                style={{ marginBottom: 12, fontSize: 16 }}
              />

              {searching && (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <Spin tip="Recherche en cours…" />
                </div>
              )}
              {searchError && <Text type="danger">{searchError}</Text>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {results.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card
                      hoverable
                      onClick={() => onSelectPlant(item)}
                      size="small"
                      style={{ cursor: 'pointer' }}
                      bodyStyle={{ padding: '10px 14px' }}
                    >
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        {item.thumbnail ? (
                          <Avatar src={item.thumbnail} size={48} shape="square" style={{ borderRadius: 10 }} />
                        ) : (
                          <Avatar size={48} shape="square" style={{ background: '#e9f5ed', borderRadius: 10, fontSize: 24 }}>
                            🌿
                          </Avatar>
                        )}
                        <div>
                          <Text strong style={{ fontSize: 15 }}>{item.name}</Text>
                          {item.latinName && (
                            <div><Text type="secondary" italic style={{ fontSize: 12 }}>{item.latinName}</Text></div>
                          )}
                          <Space size={4} style={{ marginTop: 4 }}>
                            {item.cycle && <Tag color="green" style={{ fontSize: 11 }}>{item.cycle}</Tag>}
                          </Space>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="configure"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-start' }}>
                {selected.thumbnail ? (
                  <Avatar src={selected.thumbnail} size={64} shape="square" style={{ borderRadius: 12, flexShrink: 0 }} />
                ) : (
                  <Avatar size={64} shape="square" style={{ background: '#e9f5ed', borderRadius: 12, fontSize: 32, flexShrink: 0 }}>🌿</Avatar>
                )}
                <div>
                  <Text strong style={{ fontSize: 16 }}>{selected.name}</Text>
                  {selected.latinName && (
                    <div><Text type="secondary" italic style={{ fontSize: 12 }}>{selected.latinName}</Text></div>
                  )}
                  <Button size="small" type="link" onClick={() => { setSelected(null); setDetails(null) }} style={{ padding: 0, marginTop: 4 }}>
                    Changer de plante
                  </Button>
                </div>
              </div>

              {detailsLoading && <div style={{ textAlign: 'center', padding: 16 }}><Spin tip="Chargement des données…" /></div>}
              {detailsError && <Text type="danger">{detailsError}</Text>}

              {details && (
                <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {details.watering_interval_days && (
                    <Tag color="blue">💧 Tous les {details.watering_interval_days}j</Tag>
                  )}
                  {details.sunlight && <Tag color="orange">☀️ {details.sunlight}</Tag>}
                  {details.cycle && <Tag color="green">{details.cycle}</Tag>}
                  {details.toxic_humans && <Tag color="red">⚠️ Toxique humains</Tag>}
                  {details.toxic_dogs && <Tag color="red">🐕 Toxique chiens</Tag>}
                  {details.toxic_cats && <Tag color="red">🐈 Toxique chats</Tag>}
                  {details.height_max_cm && <Tag>📏 max {Math.round(details.height_max_cm)} cm</Tag>}
                </div>
              )}

              <Divider style={{ margin: '12px 0' }} />

              <div style={{ marginBottom: 12 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>Icône</Text>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {emojis.map((item) => (
                    <Button
                      key={item}
                      type={emoji === item ? 'primary' : 'default'}
                      onClick={() => setEmoji(item)}
                      style={{ fontSize: 20, minWidth: 48, minHeight: 48, padding: 0 }}
                    >
                      {item}
                    </Button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  <EnvironmentOutlined /> Emplacement
                </Text>
                <Select
                  size="large"
                  value={location}
                  onChange={setLocation}
                  options={locationOptions}
                  style={{ width: '100%' }}
                />
              </div>

              {location === 'interieur' && (
                <div style={{ marginBottom: 12 }}>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>Pièce</Text>
                  <Select
                    size="large"
                    value={room}
                    onChange={setRoom}
                    options={roomOptions}
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>Taille du pot</Text>
                <Select
                  size="large"
                  value={potSize}
                  onChange={setPotSize}
                  options={potOptions}
                  style={{ width: '100%' }}
                />
              </div>

              <Button
                type="primary"
                size="large"
                block
                icon={<CheckCircleOutlined />}
                onClick={onConfirm}
                disabled={!canConfirm}
                loading={saving}
                style={{ minHeight: 52, fontSize: 16, fontWeight: 600 }}
              >
                Ajouter au jardin 🌱
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </div>
  )
}
