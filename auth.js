// api/auth.js
// Strava OAuth 回调 → 存用户信息到 Vercel KV → 重定向到 /[username]
import { kv } from '@vercel/kv'

export default async function handler(req, res) {
  const { code, error } = req.query

  if (error || !code) {
    return res.redirect('/?error=access_denied')
  }

  try {
    // 用 code 换 token
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    })
    const tokenData = await tokenRes.json()

    if (!tokenData.access_token) {
      return res.redirect('/?error=token_failed')
    }

    const athlete = tokenData.athlete
    // username 优先用 Strava username，没有则用 id
    const username = athlete.username || `user${athlete.id}`

    // 存入 KV：tokens + 基本信息
    await kv.set(`user:${username}`, {
      id: athlete.id,
      username,
      name: `${athlete.firstname} ${athlete.lastname}`.trim(),
      avatar: athlete.profile_medium,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
    })

    // 同时存一个 id→username 的映射方便查询
    await kv.set(`athlete:${athlete.id}`, username)

    // 重定向到专属页面，带上 username（前端用来初始化）
    return res.redirect(`/${username}?welcome=1&u=${username}`)
  } catch (err) {
    console.error('Auth error:', err)
    return res.redirect('/?error=server_error')
  }
}
