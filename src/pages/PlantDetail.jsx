import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Alert, Avatar, Badge, Button, Card, Descriptions, Modal,
  Progress, Space, Tabs, Tag, Tooltip, Typography, Upload, Spin, message
} from 'antd'
import {
  ArrowLeftOutlined, DeleteOutlined, CameraOutlined, DropboxOutlined
} from '@ant-design/icons'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts'
import PlantEnvironment from '../components/plants/PlantEnvironment'
import { calculateHydricBalance } from '../services/hydricBalance'
import { fetchWateringLogs } from '../services/supabase'
import { uploadPlantPhoto } from '../services/plants'
import { usePlantsStore } from '../store/usePlantsStore'

const { Text, Title } = Typography

// ─── Season helpers ───────────────────────────────────────────────────────────
function getSeason() {
  const m = new Date().getMonth() + 1
  if (m >= 3 && m <= 5) return 'spring'
  if (m >= 6 && m <= 8) return 'summer'
  if (m >= 9 && m <= 11) return 'autumn'
  return 'winter'
}
const SEASON_LABELS = { spring: '🌱 Printemps', summer: '☀️ Été', autumn: '🍂 Automne', winter: '❄️ Hiver' }

// ─── Contextual advice logic ──────────────────────────────────────────────────
function buildContextualAdvice(plant, weather, profile) {
  const advice = []
  const current = weather?.current
  const forecast = weather?.daily ?? []
  const season = getSeason()
  const isOutdoor = plant?.location === 'exterieur' || plant?.location === 'balcon'
  const month = new Date().getMonth() + 1 // Rodez climate

  if (!current) return advice

  // Frost risk (Rodez: October–April)
  const frostDays = forecast.filter((d) => d.tempMin < 3)
  if (frostDays.length > 0 && isOutdoor) {
    advice.push({ type: 'error', msg: `❄️ Gel prévu (${frostDays[0].tempMin.toFixed(1)}°C) — Rentrer la plante cette nuit !` })
  }

  // Heatwave (Rodez: July–August)
  const heatDays = forecast.filter((d) => d.tempMax > 32)
  if (heatDays.length > 0) {
    advice.push({ type: 'error', msg: `🌡️ Canicule prévue (${heatDays[0].tempMax.toFixed(0)}°C) — Arroser plus souvent, mettre à l'ombre si possible` })
  }

  // Recent rain → no need to water (outdoor)
  const todayRain = forecast[0]?.precipitation ?? 0
  if (todayRain > 5 && isOutdoor) {
    advice.push({ type: 'success', msg: `🌧️ Il a plu aujourd'hui (${todayRain.toFixed(1)} mm) — Arrosage non nécessaire` })
  }

  // Strong sunshine → shade warning
  const sunshineHours = (forecast[0]?.sunshineDuration ?? 0) / 3600
  if (sunshineHours > 8 && profile?.sunlight === 'ombre') {
    advice.push({ type: 'warning', msg: `☀️ Ensoleillement fort prévu (${sunshineHours.toFixed(0)}h) — Plante d'ombre : éviter l'exposition directe` })
  }

  // High humidity → fungal risk
  if (current.humidity > 80) {
    advice.push({ type: 'warning', msg: `💧 Humidité élevée (${current.humidity}%) — Attention aux maladies fongiques` })
  }

  // Cold temp → bring inside
  if (current.temperature < 5 && isOutdoor) {
    advice.push({ type: 'warning', msg: `🥶 Température basse (${current.temperature}°C) — Envisager de rentrer la plante` })
  }

  // Flowering season advice (spring/summer = main season)
  if ((season === 'spring' || season === 'summer') && plant?.flowering_season) {
    advice.push({ type: 'success', msg: `🌸 Période de floraison — Fertiliser avec de l'engrais à fleurs` })
  }

  // Winter = dormancy
  if (season === 'winter') {
    advice.push({ type: 'info', msg: `❄️ Période de dormance probable — Réduire l'arrosage et éviter les engrais` })
  }

  // Repotting reminder (> 2 years)
  if (plant?.last_repotted) {
    const years = (Date.now() - new Date(plant.last_repotted).getTime()) / (365.25 * 86400000)
    if (years >= 2) {
      advice.push({ type: 'info', msg: `🪴 Dernier rempotage il y a ${Math.floor(years)} an(s) — Envisager un rempotage` })
    }
  } else {
    advice.push({ type: 'info', msg: `🪴 Date de rempotage inconnue — Vérifier si un rempotage est nécessaire` })
  }

  // Pruning season
  if (plant?.pruning_month?.toLowerCase().includes(
    ['jan','fév','feb','mar','avr','apr','mai','may','jun','jui','jul','aoû','aug','sep','oct','nov','déc','dec'][new Date().getMonth()]
  )) {
    advice.push({ type: 'success', msg: `✂️ Période d'élagage recommandée pour ${plant.name}` })
  }

  return advice
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function daysDiff(iso) {
  if (!iso) return null
  return Math.round((new Date(iso).getTime() - Date.now()) / 86400000)
}

export default function PlantDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const plant = usePlantsStore((s) => s.plants.find((p) => p.id === id))
  const weather = usePlantsStore((s) => s.weatherData)
  const waterPlant = usePlantsStore((s) => s.waterPlant)
  const deletePlant = usePlantsStore((s) => s.deletePlant)
  const updatePlant = usePlantsStore((s) => s.updatePlant)
  const activeRisks = usePlantsStore((s) => s.activeRisks)
  const dismissRisk = usePlantsStore((s) => s.dismissRisk)
  const enrichedProfiles = usePlantsStore((s) => s.enrichedProfiles)

  const [wateringLogs, setWateringLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msgApi, contextHolder] = message.useMessage()

  const profile = enrichedProfiles[id] ?? null
  const plantRisks = activeRisks.filter((r) => r.plantId === id)

  useEffect(() => {
    if (!id) return
    setLogsLoading(true)
    fetchWateringLogs(id)
      .then(setWateringLogs)
      .catch(() => {})
      .finally(() => setLogsLoading(false))
  }, [id])

  const balance = useMemo(() => {
    if (!plant) return null
    return calculateHydricBalance(plant, weather?.pastDays ?? [], weather?.daily ?? [])
  }, [plant, weather])

  const chartData = useMemo(() => {
    const days7 = [...new Array(7)].map((_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - 6 + i)
      return d.toISOString().slice(0, 10)
    })
    return days7.map((dateStr) => {
      const log = wateringLogs.find((l) => l.watered_at?.slice(0, 10) === dateStr)
      return {
        date: new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
        watered: log ? 1 : 0,
      }
    })
  }, [wateringLogs])

  const contextAdvice = useMemo(() => buildContextualAdvice(plant, weather, profile), [plant, weather, profile])

  if (!plant) {
    return (
      <section className="page">
        <Text>Plante introuvable.</Text>
        <Button onClick={() => navigate('/')} style={{ marginTop: 12 }}>Retour</Button>
      </section>
    )
  }

  const handleWater = () => {
    waterPlant(plant.id)
    msgApi.success(`💧 ${plant.name} arrosée !`)
  }

  const handleDelete = () => {
    Modal.confirm({
      title: `Supprimer « ${plant.name} » ?`,
      content: 'Cette action est irréversible.',
      okText: 'Supprimer',
      okType: 'danger',
      cancelText: 'Annuler',
      onOk: () => {
        deletePlant(plant.id)
        navigate('/', { replace: true })
      },
    })
  }

  const handlePhotoUpload = async ({ file }) => {
    setUploading(true)
    try {
      const url = await uploadPlantPhoto(plant.id, file)
      await updatePlant(plant.id, { photo_url: url })
      msgApi.success('Photo mise à jour !')
    } catch (e) {
      msgApi.error(`Erreur : ${e.message}`)
    } finally {
      setUploading(false)
    }
    return false // prevent default upload
  }

  const days = daysDiff(balance?.nextWateringDate?.toISOString())
  const isUrgent = balance?.urgencyScore > 70
  const isMedium = balance?.urgencyScore > 40

  const tabItems = [
    {
      key: 'arrosage',
      label: '💧 Arrosage',
      children: (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Next watering */}
          <Card style={{ marginBottom: 14, background: isUrgent ? '#fff1f0' : '#f0fdf4', border: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Prochain arrosage</Text>
                <div style={{ fontSize: 20, fontWeight: 700, color: isUrgent ? '#ef4444' : '#4a7c59' }}>
                  {days === null ? '—' : days < 0 ? 'Dépassé !' : days === 0 ? "Aujourd'hui" : days === 1 ? 'Demain' : `Dans ${days} jours`}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>{formatDate(balance?.nextWateringDate?.toISOString())}</Text>
              </div>
              <div style={{ textAlign: 'center' }}>
                <Progress
                  type="circle"
                  percent={Math.max(0, 100 - (balance?.urgencyScore ?? 0))}
                  size={72}
                  strokeColor={isUrgent ? '#ef4444' : isMedium ? '#f59e0b' : '#4a7c59'}
                  format={(p) => `${p}%`}
                />
                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>Hydratation</div>
              </div>
            </div>

            <Progress
              percent={Math.max(0, 100 - (balance?.urgencyScore ?? 0))}
              showInfo={false}
              strokeColor={isUrgent ? '#ef4444' : isMedium ? '#f59e0b' : '#4a7c59'}
              trailColor="#e9f5ed"
              style={{ marginTop: 12 }}
            />
          </Card>

          <Button
            type="primary"
            size="large"
            block
            icon={<DropboxOutlined />}
            onClick={handleWater}
            style={{ minHeight: 52, fontSize: 16, background: '#4a7c59', borderColor: '#4a7c59', marginBottom: 16 }}
          >
            J'ai arrosé ! 💧
          </Button>

          {/* Last dates */}
          <Card size="small" style={{ marginBottom: 14 }}>
            <Space direction="vertical" style={{ width: '100%' }} size={6}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Dernier arrosage</Text>
                <Text strong>{formatDate(plant.last_watered ?? plant.lastWatered)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Dernière fertilisation</Text>
                <Text strong>{formatDate(plant.last_fertilized)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Dernier rempotage</Text>
                <Text strong>{formatDate(plant.last_repotted)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Fréquence recommandée</Text>
                <Text strong>
                  {plant.watering_interval_days
                    ? `Tous les ${plant.watering_interval_days} jours`
                    : plant.wateringIntervalDays
                    ? `Tous les ${plant.wateringIntervalDays} jours`
                    : '—'}
                </Text>
              </div>
            </Space>
          </Card>

          {/* Watering history chart */}
          <Text strong style={{ display: 'block', marginBottom: 8 }}>Historique (7 jours)</Text>
          {logsLoading ? (
            <Spin />
          ) : (
            <Card size="small" style={{ marginBottom: 14 }}>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e9f5ed" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis hide />
                  <ReTooltip formatter={(v) => [v ? 'Arrosé ✓' : 'Non arrosé', '']} labelStyle={{ fontSize: 12 }} />
                  <Bar dataKey="watered" fill="#4a7c59" radius={[6, 6, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* All logs */}
          {wateringLogs.length > 0 && (
            <>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Tous les arrosages ({wateringLogs.length})
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {wateringLogs.slice(0, 10).map((log) => (
                  <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f0fdf4', borderRadius: 8 }}>
                    <Text>💧 {new Date(log.watered_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
                    {log.note && <Text type="secondary" style={{ fontSize: 12 }}>{log.note}</Text>}
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      ),
    },
    {
      key: 'conseils',
      label: '🌟 Conseils',
      children: (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Tag color="green" style={{ marginBottom: 12, fontSize: 13 }}>
            {SEASON_LABELS[getSeason()]} — Rodez, Aveyron
          </Tag>
          {contextAdvice.length === 0 ? (
            <Alert type="success" message="Tout va bien ! Aucune action urgente." showIcon />
          ) : (
            <Space direction="vertical" style={{ width: '100%' }} size={10}>
              {contextAdvice.map((a, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Alert type={a.type} message={a.msg} showIcon />
                </motion.div>
              ))}
            </Space>
          )}

          {/* Plant-specific risks */}
          {plantRisks.length > 0 && (
            <>
              <Text strong style={{ display: 'block', marginTop: 16, marginBottom: 8 }}>
                🔔 Alertes météo actives
              </Text>
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {plantRisks.map((risk) => (
                  <Alert
                    key={risk.id}
                    type={risk.level === 'critical' ? 'error' : risk.level === 'danger' ? 'warning' : 'info'}
                    message={risk.title}
                    description={risk.message}
                    showIcon
                    closable
                    onClose={() => dismissRisk(risk.id)}
                  />
                ))}
              </Space>
            </>
          )}
        </motion.div>
      ),
    },
    {
      key: 'fiche',
      label: '📋 Fiche',
      children: (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Descriptions
            column={1}
            size="small"
            bordered
            labelStyle={{ background: '#f0fdf4', fontSize: 13, fontWeight: 600 }}
            contentStyle={{ fontSize: 13 }}
          >
            {plant.scientific_name && <Descriptions.Item label="Nom scientifique"><em>{plant.scientific_name}</em></Descriptions.Item>}
            {plant.family && <Descriptions.Item label="Famille">{plant.family}</Descriptions.Item>}
            {plant.origin && <Descriptions.Item label="Origine">{plant.origin}</Descriptions.Item>}
            {plant.cycle && <Descriptions.Item label="Cycle de vie">{plant.cycle}</Descriptions.Item>}
            {plant.sunlight && <Descriptions.Item label="Lumière">☀️ {plant.sunlight}</Descriptions.Item>}
            {plant.soil_type && <Descriptions.Item label="Sol">{plant.soil_type}</Descriptions.Item>}
            {plant.watering_frequency && <Descriptions.Item label="Arrosage">{plant.watering_frequency}</Descriptions.Item>}
            {plant.fertilizer_type && <Descriptions.Item label="Engrais">{plant.fertilizer_type}</Descriptions.Item>}
            {plant.pruning_month && <Descriptions.Item label="Élagage">{plant.pruning_month}</Descriptions.Item>}
            {plant.flowering_season && <Descriptions.Item label="Floraison">🌸 {plant.flowering_season}</Descriptions.Item>}
            {plant.height_max_cm && <Descriptions.Item label="Hauteur max">📏 {Math.round(plant.height_max_cm)} cm</Descriptions.Item>}
            {plant.min_temperature !== null && plant.min_temperature !== undefined && (
              <Descriptions.Item label="Temp. min">🌡️ {plant.min_temperature}°C</Descriptions.Item>
            )}
          </Descriptions>

          {/* Toxicity */}
          <Card size="small" style={{ marginTop: 12 }} title="Toxicité">
            <Space wrap>
              <Tooltip title={plant.toxic_humans ? 'Toxique pour les humains' : 'Non toxique'}>
                <Tag color={plant.toxic_humans ? 'red' : 'green'}>
                  {plant.toxic_humans ? '⚠️' : '✅'} Humains
                </Tag>
              </Tooltip>
              <Tooltip title={plant.toxic_dogs ? 'Toxique pour les chiens' : 'Non toxique'}>
                <Tag color={plant.toxic_dogs ? 'red' : 'green'}>
                  {plant.toxic_dogs ? '⚠️' : '✅'} 🐕 Chiens
                </Tag>
              </Tooltip>
              <Tooltip title={plant.toxic_cats ? 'Toxique pour les chats' : 'Non toxique'}>
                <Tag color={plant.toxic_cats ? 'red' : 'green'}>
                  {plant.toxic_cats ? '⚠️' : '✅'} 🐈 Chats
                </Tag>
              </Tooltip>
            </Space>
          </Card>

          {plant.notes && (
            <Card size="small" style={{ marginTop: 12 }} title="Notes">
              <Text>{plant.notes}</Text>
            </Card>
          )}
        </motion.div>
      ),
    },
    {
      key: 'env',
      label: '🌡 Env.',
      children: <PlantEnvironment plant={plant} />,
    },
  ]

  return (
    <section className="page detail-page">
      {contextHolder}

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 16 }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            type="text"
            onClick={() => navigate(-1)}
            style={{ minWidth: 44, minHeight: 44 }}
          />
          <div style={{ flex: 1 }} />
          <Button
            icon={<DeleteOutlined />}
            type="text"
            danger
            onClick={handleDelete}
            style={{ minWidth: 44, minHeight: 44 }}
          />
        </div>

        <Card style={{ borderRadius: 20, overflow: 'hidden', border: 'none', background: 'linear-gradient(135deg, #e9f5ed 0%, #f0fdf4 100%)' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {plant.photo_url ? (
                <img
                  src={plant.photo_url}
                  alt={plant.name}
                  style={{ width: 90, height: 90, borderRadius: 16, objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  width: 90, height: 90, borderRadius: 16, background: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48,
                }}>
                  {plant.emoji ?? '🪴'}
                </div>
              )}
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={() => false}
                onChange={({ file }) => handlePhotoUpload({ file })}
              >
                <Button
                  icon={<CameraOutlined />}
                  size="small"
                  loading={uploading}
                  style={{
                    position: 'absolute', bottom: -6, right: -6,
                    minWidth: 30, minHeight: 30, borderRadius: '50%',
                    background: '#4a7c59', color: '#fff', border: 'none', padding: 0,
                  }}
                />
              </Upload>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <Title level={4} style={{ margin: 0, color: '#1a3c26' }} ellipsis>{plant.name}</Title>
              {plant.scientific_name && (
                <Text type="secondary" italic style={{ fontSize: 12 }}>{plant.scientific_name}</Text>
              )}
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <Tag color="green">{plant.location === 'interieur' ? '🏠 Intérieur' : plant.location === 'balcon' ? '🌤 Balcon' : '🌳 Extérieur'}</Tag>
                {plant.room && <Tag>{plant.room}</Tag>}
                {plant.cycle && <Tag color="cyan">{plant.cycle}</Tag>}
                {isUrgent && <Tag color="red">🚨 Urgent</Tag>}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      <Tabs
        items={tabItems}
        defaultActiveKey="arrosage"
        tabBarStyle={{ marginBottom: 16 }}
      />
    </section>
  )
}
