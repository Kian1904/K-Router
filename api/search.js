module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = req.headers.authorization
  if (!auth || auth !== 'Bearer ' + process.env.BEARER_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { query } = req.body
  if (!query) return res.status(400).json({ error: 'Query required' })

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: true
      })
    })

    if (!response.ok) {
      return res.status(502).json({ error: 'Tavily failed: ' + response.status })
    }

    const data = await response.json()
    return res.status(200).json({
      answer: data.answer || null,
      results: data.results.map(r => ({
        title: r.title,
        url: r.url,
        content: r.content
      }))
    })

  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
