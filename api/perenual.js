/**
 * Verdure — Perenual API proxy
 * GET /api/perenual?q=NAME        → search plants
 * GET /api/perenual?id=123        → get plant details
 *
 * Requires env var: PERENUAL_API_KEY
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const apiKey = process.env.PERENUAL_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'PERENUAL_API_KEY non configurée sur Vercel' })
  }

  const { q, id } = req.query

  try {
    let url
    if (id) {
      url = `https://perenual.com/api/species/details/${encodeURIComponent(id)}?key=${apiKey}`
    } else if (q) {
      url = `https://perenual.com/api/species-list?key=${apiKey}&q=${encodeURIComponent(q)}&page=1`
    } else {
      return res.status(400).json({ error: 'Paramètre q ou id requis' })
    }

    const response = await fetch(url)
    if (!response.ok) {
      const text = await response.text()
      return res.status(response.status).json({ error: `Perenual API error: ${text}` })
    }

    const data = await response.json()
    return res.json(data)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
