export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  try {
    const serverToken = process.env.VITE_TREFLE_USER_TOKEN
    if (!serverToken) {
      return res.status(500).json({ error: 'VITE_TREFLE_USER_TOKEN not configured on server' })
    }

    // Strip our proxy prefix to get the Trefle path + existing query params
    const trefleRelative = req.url.replace(/^\/api\/trefle-api/, '')
    const separator = trefleRelative.includes('?') ? '&' : '?'
    // Inject the token server-side — no origin whitelist needed
    const trefleUrl = `https://trefle.io/api/v1${trefleRelative}${separator}token=${serverToken}`

    const upstream = await fetch(trefleUrl)
    const data = await upstream.json()
    res.status(upstream.status).json(data)
  } catch (err) {
    res.status(502).json({ error: 'Trefle API proxy error', detail: err.message })
  }
}
