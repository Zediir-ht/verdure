export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  try {
    // req.url is like /api/trefle-api/plants?token=... — strip prefix to get Trefle path
    const trefleUrl = 'https://trefle.io/api/v1' + req.url.replace(/^\/api\/trefle-api/, '')

    const upstream = await fetch(trefleUrl, {
      headers: {
        Authorization: req.headers.authorization || '',
        'Content-Type': 'application/json',
      },
    })
    const data = await upstream.json()
    res.status(upstream.status).json(data)
  } catch (err) {
    res.status(502).json({ error: 'Trefle API proxy error', detail: err.message })
  }
}
