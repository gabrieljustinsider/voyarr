import { Hono } from 'hono'
import { AuthConfig, AuthEnv } from '../../types'
import { AuthService } from '../services/auth.service'

export function createLoginRoutes(config: AuthConfig) {
  const router = new Hono<AuthEnv>()

  router.post('/login', async (c) => {
    try {
      const { identifier, password, persistent } = await c.req.json()
      if (!identifier || !password) {
        return c.json({ success: false, error: 'Email and password are required.' }, 400)
      }

      const auth = new AuthService(c.env, config)
      const result = await auth.validateCredentials(identifier, password)
      if (!result.success) {
        return c.json({ success: false, error: result.error }, 401)
      }

      const forensics = getForensics(c)
      const { sessionId, expirationHours } = await auth.createSession(result.user.id, forensics, persistent === true)

      const host = c.req.header('host') || ''
      const isLocal = Boolean((c.env as any)?.ENVIRONMENT !== 'production' && (host.includes('localhost') || c.req.header('origin')?.includes('localhost')))
      auth.setSessionCookie(c, sessionId, expirationHours, isLocal)

      return c.json({ success: true, user: sanitizeUser(result.user) })
    } catch (err: any) {
      return c.json({ success: false, error: err.message || 'Login failed.' }, 500)
    }
  })

  router.post('/logout', async (c) => {
    const auth = new AuthService(c.env, config)
    auth.clearSessionCookie(c)
    return c.json({ success: true })
  })

  return router
}

function sanitizeUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    globalRole: user.globalRole,
    status: user.status,
    createdAt: user.createdAt,
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
