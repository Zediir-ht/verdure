// The JWT claim flow requires whitelisting origins on trefle.io — not reliable.
// Instead, return the raw user token directly. The trefle-api proxy injects it
// server-side via ?token= so it never hits origin checks.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  const token = process.env.VITE_TREFLE_USER_TOKEN
  if (!token) {
    return res.status(500).json({ error: 'VITE_TREFLE_USER_TOKEN not configured on server' })
  }

  // Return the token directly — the API proxy will use it server-side
  res.status(200).json({ token })
}
