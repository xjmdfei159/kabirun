// api/activities.js
// GET /api/activities?username=alice&page=1
// 返回该用户的活动列表（从 Strava 拉取并缓存到 KV）
import { kv } from '@vercel/kv'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { username, page = '1', refresh = '0' } = req.query
  if (!username) return res.status(400).json({ error: 'username required' })

  const user = await kv.get(`user:${username}`)
  if (!user) return res.status(404).json({ error: 'User not found' })

  const cacheKey = `activities:${username}:${page}`

  // 有缓存且不强制刷新，直接返回
  if (refresh !== '1') {
    const cached = await kv.get(cacheKey)
    if (cached) return res.status(200).json(cached)
  }

  // token 刷新
  let accessToken = user.access_token
  if (Date.now() >= user.expires_at * 1000 - 60000) {
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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
      await kv.set(`user:${username}`, { ...user, access_token: tokenData.access_token, refresh_token: tokenData.refresh_token || user.refresh_token, expires_at: tokenData.expires_at })
    }
  }

  // 拉取 Strava 活动
  const stravaRes = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?per_page=50&page=${page}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const activities = await stravaRes.json()

  if (!Array.isArray(activities)) {
    return res.status(502).json({ error: 'Strava API error', detail: activities })
  }

  const parsed = activities
    .filter(a => a.map?.summary_polyline)
    .map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      date: a.start_date_local,
      dist: a.distance,
      time: a.moving_time,
      speed: a.average_speed,
      ele: Math.round(a.total_elevation_gain),
      polyline: a.map.summary_polyline,
    }))

  // 缓存 10 分钟
  await kv.set(cacheKey, { activities: parsed, hasMore: activities.length === 50 }, { ex: 600 })

  return res.status(200).json({ activities: parsed, hasMore: activities.length === 50 })
}
