export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, anthropic-version')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  try {
    const anthropicUrl = 'https://api.anthropic.com' + req.url.replace(/^\/api\/anthropic/, '')

    const upstream = await fetch(anthropicUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': req.headers['x-api-key'] || '',
        'anthropic-version': req.headers['anthropic-version'] || '2023-06-01',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    })
    const data = await upstream.json()
    res.status(upstream.status).json(data)
  } catch (err) {
    res.status(502).json({ error: 'Anthropic proxy error', detail: err.message })
  }
}
