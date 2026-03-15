import { useEffect, useMemo, useState } from 'react'
import { askAdvisor } from '../services/aiAdvisor'
import { calculateHydricBalance } from '../services/hydricBalance'
import { usePlantsStore } from '../store/usePlantsStore'

const chips = [
  "Quelles plantes arroser aujourd'hui ?",
  'Conseils pour la semaine',
  'Pourquoi ma plante est en retard ?',
]

export default function AIAdvisor() {
  const plants = usePlantsStore((s) => s.plants)
  const weather = usePlantsStore((s) => s.weatherData)

  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')
  const [booted, setBooted] = useState(false)

  const contextSummary = useMemo(() => {
    const enriched = plants.map((plant) => ({
      id: plant.id,
      name: plant.name,
      type: plant.type,
      location: plant.location,
      lastWatered: plant.lastWatered,
      urgencyScore: calculateHydricBalance(plant, weather?.pastDays ?? [], weather?.daily ?? []).urgencyScore,
    }))

    return JSON.stringify(
      {
        date: new Date().toISOString(),
        weatherSummary: weather
          ? {
              temperature: weather.current.temperature,
              humidity: weather.current.humidity,
              et0: weather.current.et0,
              precipitation: weather.current.precipitation,
            }
          : null,
        plants: enriched,
      },
      null,
      2,
    )
  }, [plants, weather])

  const send = async (text) => {
    const userMessage = { role: 'user', content: text }
    const next = [...messages, userMessage]
    setMessages(next)
    setLoading(true)

    try {
      const answer = await askAdvisor(next)
      setMessages((prev) => [...prev, { role: 'assistant', content: answer }])
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: e.message }])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (booted) return
    setBooted(true)
    send(`Contexte automatique Verdure:\n${contextSummary}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted, contextSummary])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return
    const value = input
    setInput('')
    send(value)
  }

  return (
    <section className="page chat-page">
      <h2>Conseiller IA</h2>
      <div className="chat-box">
        {messages.map((msg, idx) => (
          <div key={idx} className={`bubble ${msg.role === 'assistant' ? 'assistant' : 'user'}`}>
            {msg.content}
          </div>
        ))}
        {loading ? <div className="bubble assistant">Je prépare ton conseil…</div> : null}
      </div>

      <div className="chip-row">
        {chips.map((chip) => (
          <button key={chip} type="button" className="chip" onClick={() => send(chip)}>
            {chip}
          </button>
        ))}
      </div>

      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pose ta question…"
        />
        <button className="primary-btn" type="submit" disabled={loading}>
          Envoyer
        </button>
      </form>
    </section>
  )
}
