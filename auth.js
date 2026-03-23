import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

export default async function handler(req, res) {
  const { code, error } = req.query
  if (error || !code) return res.redirect('/?error=access_denied')

  try {
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
    if (!tokenData.access_token) return res.redirect('/?error=token_failed')

    const athlete = tokenData.athlete
    const username = athlete.username || `user${athlete.id}`

    await redis.set(`user:${username}`, JSON.stringify({
      id: athlete.id,
      username,
      name: `${athlete.firstname} ${athlete.lastname}`.trim(),
      avatar: athlete.profile_medium,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
    }))
    await redis.set(`athlete:${athlete.id}`, username)

    return res.redirect(`/${username}?welcome=1&u=${username}`)
  } catch (err) {
    console.error('Auth error:', err)
    return res.redirect('/?error=server_error')
  }
}
