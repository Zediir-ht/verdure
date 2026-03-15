export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  try {
    const serverToken = process.env.VITE_TREFLE_USER_TOKEN
    if (!serverToken) {
      return res.status(500).json({ error: 'VITE_TREFLE_USER_TOKEN not configured on server' })
    }

    // Reconstruct path from catch-all param
    const pathParts = req.query.path ?? []
    const pathStr = Array.isArray(pathParts) ? pathParts.join('/') : pathParts

    // Forward existing query params except "token" (we inject ours)
    const incoming = { ...req.query }
    delete incoming.path
    delete incoming.token
    const qs = new URLSearchParams(incoming)
    qs.set('token', serverToken)

    const trefleUrl = `https://trefle.io/api/v1/${pathStr}?${qs.toString()}`

    const upstream = await fetch(trefleUrl)
    const contentType = upstream.headers.get('content-type') || ''

    if (!contentType.includes('application/json')) {
      const text = await upstream.text()
      return res.status(upstream.status).json({ error: 'Trefle returned non-JSON', body: text.slice(0, 200) })
    }

    const data = await upstream.json()
    res.status(upstream.status).json(data)
  } catch (err) {
    res.status(502).json({ error: 'Trefle API proxy error', detail: err.message })
  }
}

