/**
 * Verdure — Store persistence via Supabase
 * GET  /api/store  → returns the full store JSON blob
 * POST /api/store  → saves the full store JSON blob
 *
 * Requires env vars on Vercel:
 *   SUPABASE_URL          e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_KEY  service_role key (never exposed to client)
 */
export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY

  if (!url || !key) {
    return res.status(503).json({ error: 'Supabase not configured' })
  }

  const endpoint = `${url}/rest/v1/verdure_store`
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }

  if (req.method === 'GET') {
    const r = await fetch(`${endpoint}?id=eq.1&select=data`, { headers })
    if (!r.ok) return res.status(502).json({ error: 'Supabase read failed' })
    const rows = await r.json()
    return res.json({ data: rows[0]?.data ?? null })
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ id: 1, data: body.data }),
    })
    if (!r.ok) return res.status(502).json({ error: 'Supabase write failed' })
    return res.json({ ok: true })
  }

  res.setHeader('Allow', 'GET, POST')
  res.status(405).end()
}
