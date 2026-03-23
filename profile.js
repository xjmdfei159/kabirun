import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { username } = req.query
  if (!username) return res.status(400).json({ error: 'username required' })

  const raw = await redis.get(`user:${username}`)
  const user = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (!user) return res.status(404).json({ error: 'User not found' })

  return res.status(200).json({
    username: user.username,
    name: user.name,
    avatar: user.avatar,
  })
}
