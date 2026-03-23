// api/token.js
import { kv } from '@vercel/kv'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { code, grant_type, refresh_token, username } = req.body
  const CLIENT_ID = process.env.STRAVA_CLIENT_ID
  const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET
  if (!CLIENT_ID || !CLIENT_SECRET) return res.status(500).json({ error: 'Server not configured' })

  try {
    let body = { client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type }
    if (grant_type === 'authorization_code') {
      body.code = code
    } else if (grant_type === 'refresh_token') {
      if (username) {
        const user = await kv.get(`user:${username}`)
        if (!user) return res.status(404).json({ error: 'User not found' })
        if (Date.now() < user.expires_at * 1000 - 60000) {
          return res.status(200).json({ access_token: user.access_token, expires_at: user.expires_at })
        }
        body.refresh_token = user.refresh_token
      } else {
        body.refresh_token = refresh_token
      }
    }
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json()
    if (data.access_token && username) {
      const user = await kv.get(`user:${username}`)
      if (user) await kv.set(`user:${username}`, { ...user, access_token: data.access_token, refresh_token: data.refresh_token || user.refresh_token, expires_at: data.expires_at })
    }
    return res.status(200).json(data)
  } catch (err) {
    return res.status(500).json({ error: 'Token failed', detail: err.message })
  }
}
