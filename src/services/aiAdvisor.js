const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-20250514'
const SYSTEM_PROMPT =
  "Tu es un expert horticulteur bienveillant. Tu analyses les données météo et le bilan hydrique de chaque plante pour donner des conseils précis et personnalisés. Réponds toujours en français, de façon concise et pratique."

export async function askAdvisor(messages) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('Ajoute VITE_ANTHROPIC_API_KEY dans ton environnement pour activer le conseiller IA.')
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      system: SYSTEM_PROMPT,
      max_tokens: 600,
      messages,
    }),
  })

  if (!response.ok) {
    throw new Error('Le conseiller IA est temporairement indisponible.')
  }

  const payload = await response.json()
  return payload?.content?.[0]?.text || 'Je n’ai pas de réponse pour le moment.'
}
