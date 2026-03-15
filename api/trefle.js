export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const token = process.env.TREFLE_TOKEN

  if (!token) {
    return res.status(500).json({ error: 'TREFLE_TOKEN non configuré sur Vercel' })
  }

  const { q, id } = req.query

  try {
    let url
    if (id) {
      url = `https://trefle.io/api/v1/plants/${id}?token=${token}`
    } else if (q) {
      url = `https://trefle.io/api/v1/plants/search?q=${encodeURIComponent(q)}&token=${token}`
    } else {
      return res.status(400).json({ error: 'Paramètre q ou id requis' })
    }

    const response = await fetch(url, {
      headers: {
        'Origin': 'https://verdure-pi.vercel.app'
      }
    })

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Trefle error: ${response.status}` 
      })
    }

    const data = await response.json()
    return res.status(200).json(data)

  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
