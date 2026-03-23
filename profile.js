// api/profile.js
// GET /api/profile?username=alice
import { kv } from '@vercel/kv'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { username } = req.query
  if (!username) return res.status(400).json({ error: 'username required' })

  const user = await kv.get(`user:${username}`)
  if (!user) return res.status(404).json({ error: 'User not found' })

  // 只返回公开信息，不返回 token
  return res.status(200).json({
    username: user.username,
    name: user.name,
    avatar: user.avatar,
  })
}
