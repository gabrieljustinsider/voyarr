import { Hono } from 'hono'
import { AuthConfig, AuthEnv } from '../../types'
import { getDb } from '#/index'
import { users, sessions, userIdentities } from '#/schema'
import { eq, and } from 'drizzle-orm'
import { setCookie } from 'hono/cookie'
import { AuthService, generateUUIDv7, generatePrefixedId } from '../services/auth.service'
import crypto from 'crypto'

export function createOauthRoutes(config: AuthConfig) {
  const router = new Hono<AuthEnv>()

  router.get('/:provider', async (c) => {
    const provider = c.req.param('provider')
    const hostStr = c.req.header('host') || ''
    const isLocal = c.env.ENVIRONMENT !== 'production' && (hostStr.includes('localhost') || c.req.header('origin')?.includes('localhost'))

    if (provider === 'discord') {
      const redirectUri = isLocal
        ? 'http://localhost:5172/api/auth/callback/discord'
        : 'https://sso.gpnet.dev/api/proxy/callback/discord'

      const persistent = c.req.query('persistent') === 'true'
      const targetOrigin = isLocal
        ? 'http://localhost:5172/api/auth/callback/discord'
        : 'https://foundation.gpnet.dev/api/auth/callback/discord'
      const state = btoa(JSON.stringify({ persistent, targetOrigin }))

      const url = new URL('https://discord.com/oauth2/authorize')
      url.searchParams.set('client_id', c.env.DISCORD_CLIENT_ID)
      url.searchParams.set('redirect_uri', redirectUri)
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('scope', 'identify')
      url.searchParams.set('state', state)
      url.searchParams.set('prompt', 'consent')
      return c.redirect(url.toString())
    }

    if (provider === 'google') {
      if (!c.env.GOOGLE_CLIENT_ID) {
        return c.json({ success: false, error: 'Google OAuth is not configured.' }, 500)
      }

      const isLocal = c.env.ENVIRONMENT !== 'production' && (hostStr.includes('localhost') || c.req.header('origin')?.includes('localhost'))
      const redirectUri = isLocal
        ? 'http://localhost:5172/api/auth/callback/google'
        : 'https://sso.gpnet.dev/api/proxy/callback/google'

      const persistent = c.req.query('persistent') === 'true'
      const targetOrigin = isLocal
        ? 'http://localhost:5172/api/auth/callback/google'
        : 'https://foundation.gpnet.dev/api/auth/callback/google'
      const state = btoa(JSON.stringify({ persistent, targetOrigin }))

      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      url.searchParams.set('client_id', c.env.GOOGLE_CLIENT_ID)
      url.searchParams.set('redirect_uri', redirectUri)
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('scope', 'openid profile email')
      url.searchParams.set('state', state)
      return c.redirect(url.toString())
    }

    return c.json({ success: false, error: `Unknown provider: ${provider}` }, 400)
  })

  return router
}

export function createOauthCallbackRoutes(config: AuthConfig) {
  const router = new Hono()
  router.get('/callback/discord', async (c) => handleOAuthCallback(c, config, 'discord'))
  router.get('/callback/google', async (c) => handleOAuthCallback(c, config, 'google'))
  return router
}

async function handleOAuthCallback(c: any, config: AuthConfig, provider: string) {
  const code = c.req.query('code')
  if (!code) return c.text('Unauthorized: Missing OAuth code.', 400)

  const hostStr = c.req.header('host') || ''
  const isLocal = c.env.ENVIRONMENT !== 'production' && (hostStr.includes('localhost') || c.req.header('origin')?.includes('localhost'))

  try {
    let providerUserId: string
    let username: string
    let avatarUrl: string | null = null
    let email: string | null = null

    if (provider === 'discord') {
      const redirectUri = isLocal
        ? 'http://localhost:5172/api/auth/callback/discord'
        : 'https://sso.gpnet.dev/api/proxy/callback/discord'

      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: c.env.DISCORD_CLIENT_ID,
          client_secret: c.env.DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }).toString(),
      })

      if (!tokenRes.ok) return c.text('Discord token exchange failed.', 401)
      const { access_token } = await tokenRes.json() as any
      const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` },
      })
      if (!userRes.ok) return c.text('Failed to fetch Discord profile.', 500)
      const profile = await userRes.json() as any
      providerUserId = profile.id
      username = profile.global_name || profile.username
      avatarUrl = profile.avatar
        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(profile.id) >> 22n) % 6}.png`
    } else if (provider === 'google') {
      const redirectUri = isLocal
        ? 'http://localhost:5172/api/auth/callback/google'
        : 'https://sso.gpnet.dev/api/proxy/callback/google'

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: c.env.GOOGLE_CLIENT_ID,
          client_secret: c.env.GOOGLE_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }).toString(),
      })

      if (!tokenRes.ok) return c.text('Google token exchange failed.', 401)
      const { access_token } = await tokenRes.json() as any
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      })
      if (!userRes.ok) return c.text('Failed to fetch Google profile.', 500)
      const profile = await userRes.json() as any
      providerUserId = profile.id
      username = profile.name
      email = profile.email
      avatarUrl = profile.picture || null
    } else {
      return c.text('Unknown provider.', 400)
    }

    const db = getDb(c.env)
    
    let identity: any = null
    try {
      identity = await db.select({ userId: userIdentities.userId })
        .from(userIdentities)
        .where(and(eq(userIdentities.provider, provider), eq(userIdentities.providerUserId, providerUserId)))
        .limit(1)
        .then(r => r[0])
    } catch (e: any) {
      console.warn('[Auth] userIdentities query error:', e.message)
    }

    let targetUserId: string

    if (!identity) {
      // Check if this is the first user in the entire system
      let isFirstUser = false
      try {
        const existingUsers = await db.select({ id: users.id }).from(users).limit(1)
        isFirstUser = existingUsers.length === 0
      } catch (e: any) {
        console.warn('[Auth] users count check fallback:', e.message)
      }

      if (isFirstUser) {
        const newUserId = generateUUIDv7()
        await db.insert(users).values({
          id: newUserId,
          email,
          displayName: username,
          avatarUrl,
          globalRole: 'owner',
          status: 'active',
        })
        try {
          await db.insert(userIdentities).values({
            id: generatePrefixedId('ident'),
            userId: newUserId,
            provider,
            providerUserId,
            name: username,
            email,
            avatarUrl,
          })
        } catch {}
        targetUserId = newUserId
      } else {
        // Check if there is an existing root user or email match
        let existingUser: any = null
        if (email) {
          try {
            existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1).then(r => r[0])
          } catch {}
        }

        if (existingUser) {
          targetUserId = existingUser.id
          try {
            await db.insert(userIdentities).values({
              id: generatePrefixedId('ident'),
              userId: targetUserId,
              provider,
              providerUserId,
              name: username,
              email,
              avatarUrl,
            })
          } catch {}
        } else {
          // Check if registration allowed
          const newUserId = generateUUIDv7()
          await db.insert(users).values({
            id: newUserId,
            email,
            displayName: username,
            avatarUrl,
            globalRole: 'user',
            status: 'active',
          })
          try {
            await db.insert(userIdentities).values({
              id: generatePrefixedId('ident'),
              userId: newUserId,
              provider,
              providerUserId,
              name: username,
              email,
              avatarUrl,
            })
          } catch {}
          targetUserId = newUserId
        }
      }
    } else {
      try {
        await db.update(users).set({ avatarUrl, displayName: username }).where(eq(users.id, identity.userId))
      } catch {}
      targetUserId = identity.userId
    }

    const auth = new AuthService(c.env, config)
    const forensics = getForensics(c)
    const state = c.req.query('state')
    let isPersistent = false
    let targetOrigin: string | null = null

    if (state) {
      try {
        const decoded = JSON.parse(atob(state))
        isPersistent = !!decoded.persistent
        targetOrigin = decoded.targetOrigin || null
      } catch {}
    }

    const { sessionId, expirationHours } = await auth.createSession(targetUserId, forensics, isPersistent)
    auth.setSessionCookie(c, sessionId, expirationHours, isLocal)

    if (targetOrigin) {
      try {
        const targetUrl = new URL(targetOrigin)
        const redirectPath = targetUrl.pathname.includes('/callback') ? '/directory' : targetUrl.pathname
        return c.redirect(redirectPath)
      } catch {}
    }

    return c.redirect(isLocal ? 'http://localhost:5172/directory' : '/directory')
  } catch (err: any) {
    console.error(`[Auth] ${provider} callback failed:`, err.message)
    return c.text(`Authentication failed: ${err.message}`, 500)
  }
}

function getForensics(c: any) {
  const connectingIp = c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || '127.0.0.1'
  return {
    connectingIp,
    ipV4: c.req.header('CF-Connecting-IP') || null,
    ipV6: c.req.header('CF-Pseudo-IPv4') || null,
    userAgent: c.req.header('User-Agent') || null,
    cfRay: c.req.header('CF-Ray') || null,
    location: null,
  }
}
