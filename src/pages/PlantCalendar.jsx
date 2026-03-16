import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Badge, Button, Card, Tag, Typography, Space, Empty } from 'antd'
import { ArrowLeftOutlined, DropboxOutlined } from '@ant-design/icons'
import { calculateHydricBalance } from '../services/hydricBalance'
import { usePlantsStore } from '../store/usePlantsStore'

const { Text, Title } = Typography

function formatDayLabel(date, i) {
  if (i === 0) return "Aujourd'hui"
  if (i === 1) return 'Demain'
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toYMD(date) {
  return date.toISOString().slice(0, 10)
}

export default function PlantCalendar() {
  const navigate = useNavigate()
  const plants = usePlantsStore((s) => s.plants)
  const weatherData = usePlantsStore((s) => s.weatherData)
  const waterPlant = usePlantsStore((s) => s.waterPlant)

  const schedule = useMemo(() => {
    return plants.map((plant) => {
      const balance = calculateHydricBalance(
        plant,
        weatherData?.pastDays ?? [],
        weatherData?.daily ?? [],
      )
      return {
        plant,
        nextWateringDate: balance?.nextWateringDate ?? null,
        urgencyScore: balance?.urgencyScore ?? 0,
      }
    })
  }, [plants, weatherData])

  const byDate = useMemo(() => {
    const map = {}
    schedule.forEach(({ plant, nextWateringDate, urgencyScore }) => {
      if (!nextWateringDate) return
      const key = toYMD(new Date(nextWateringDate))
      if (!map[key]) map[key] = []
      map[key].push({ plant, urgencyScore })
    })
    return map
  }, [schedule])

  const today = new Date()
  const nextDays = Array.from({ length: 10 }, (_, i) => {
    const d = addDays(today, i)
    const key = toYMD(d)
    return { date: d, label: formatDayLabel(d, i), key, items: byDate[key] ?? [] }
  })

  return (
    <section className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          type="text"
          onClick={() => navigate(-1)}
          style={{ minWidth: 44, minHeight: 44 }}
        />
        <Title level={4} style={{ margin: 0, color: '#2E5902' }}>
          📅 Planning d&apos;arrosage
        </Title>
      </div>

      {!plants.length ? (
        <Empty description="Ajoutez des plantes pour voir votre planning" style={{ marginTop: 40 }} />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          {nextDays.map(({ date, label, key, items }, i) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card
                size="small"
                style={{
                  borderRadius: 14,
                  border: items.length > 0 && i === 0
                    ? '2px solid #2E5902'
                    : items.length > 0
                    ? '1px solid #D96941'
                    : '1px solid #dbe9d7',
                  background: i === 0 && items.length > 0 ? '#f0f7eb' : '#fff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: items.length ? 8 : 0 }}>
                  <Text strong style={{ color: i === 0 ? '#2E5902' : '#193C40', textTransform: 'capitalize' }}>
                    {label}
                  </Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {items.length > 0 && (
                      <Badge count={items.length} color="#2E5902" />
                    )}
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                    </Text>
                  </div>
                </div>

                {items.length === 0 ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Aucun arrosage prévu 🌿
                  </Text>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {items.map(({ plant, urgencyScore }) => (
                      <div
                        key={plant.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 10px',
                          background: urgencyScore > 70 ? '#fff1f0' : '#f0fdf4',
                          borderRadius: 10,
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}
                          onClick={() => navigate(`/plant/${plant.id}`)}
                        >
                          {plant.photo_url ? (
                            <img
                              src={plant.photo_url}
                              alt=""
                              style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                            />
                          ) : (
                            <span style={{ fontSize: 20, flexShrink: 0 }}>{plant.emoji ?? '🪴'}</span>
                          )}
                          <Text style={{ fontSize: 14 }}>{plant.name}</Text>
                          <Tag
                            color={urgencyScore > 70 ? 'red' : urgencyScore > 40 ? 'orange' : 'green'}
                            style={{ fontSize: 10, lineHeight: '14px', margin: 0 }}
                          >
                            {urgencyScore > 70 ? '🚨 Urgent' : urgencyScore > 40 ? '⚠️ Bientôt' : '✅'}
                          </Tag>
                        </div>
                        {i <= 1 && (
                          <Button
                            size="small"
                            type="text"
                            icon={<DropboxOutlined />}
                            onClick={(e) => { e.stopPropagation(); waterPlant(plant.id) }}
                            style={{ color: '#2E5902', minHeight: 32, flexShrink: 0 }}
                          >
                            Arrosé
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </Space>
      )}
    </section>
  )
}
