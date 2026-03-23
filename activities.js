import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { username, page = '1', refresh = '0' } = req.query
  if (!username) return res.status(400).json({ error: 'username required' })

  const raw = await redis.get(`user:${username}`)
  const user = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (!user) return res.status(404).json({ error: 'User not found' })

  const cacheKey = `activities:${username}:${page}`

  if (refresh !== '1') {
    const cached = await redis.get(cacheKey)
    if (cached) {
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached
      return res.status(200).json(data)
    }
  }

  // token 刷新
  let accessToken = user.access_token
  if (Date.now() >= user.expires_at * 1000 - 60000) {
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: user.refresh_token,
      }),
    })
    const tokenData = await tokenRes.json()
    if (tokenData.access_token) {
      accessToken = tokenData.access_token
      await redis.set(`user:${username}`, JSON.stringify({
        ...user,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || user.refresh_token,
        expires_at: tokenData.expires_at,
      }))
    }
  }

  const stravaRes = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?per_page=50&page=${page}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const activities = await stravaRes.json()
  if (!Array.isArray(activities)) return res.status(502).json({ error: 'Strava API error' })

  const parsed = activities
    .filter(a => a.map?.summary_polyline)
    .map(a => ({
      id: a.id, name: a.name, type: a.type,
      date: a.start_date_local, dist: a.distance,
      time: a.moving_time, speed: a.average_speed,
      ele: Math.round(a.total_elevation_gain),
      polyline: a.map.summary_polyline,
    }))

  const result = { activities: parsed, hasMore: activities.length === 50 }
  await redis.set(cacheKey, JSON.stringify(result), { ex: 600 })

  return res.status(200).json(result)
}
