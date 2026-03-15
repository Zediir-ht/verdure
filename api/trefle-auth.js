export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  try {
    const token = process.env.VITE_TREFLE_USER_TOKEN
    if (!token) {
      return res.status(500).json({ error: 'VITE_TREFLE_USER_TOKEN not configured on server' })
    }

    // Trefle requires the origin of the calling app to be whitelisted
    const origin = req.headers.origin || req.headers.referer || ''

    const url = `https://trefle.io/api/auth/claim?token=${token}&origin=${encodeURIComponent(origin)}`
    const upstream = await fetch(url, { method: 'POST' })
    const data = await upstream.json()
    res.status(upstream.status).json(data)
  } catch (err) {
    res.status(502).json({ error: 'Trefle auth proxy error', detail: err.message })
  }
}
