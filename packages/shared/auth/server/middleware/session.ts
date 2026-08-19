import { getCookie } from 'hono/cookie'
import { getDb } from '#/index'
import { sessions, users } from '#/schema'
import { eq, gt } from 'drizzle-orm'

export function sessionGuard() {
  return async (c: any, next: any) => {
    const serviceToken = c.req.header('X-Service-Token')
    if (serviceToken && serviceToken === c.env.SHARED_SERVICE_SECRET) {
      return await next()
    }

    const sessionId = getCookie(c, 'FOUNDATION_SESSION')
    if (!sessionId) {
      return c.json({ authenticated: false, error: 'No active session.' }, 401)
    }

    const db = getDb(c.env)
    const session = await db.select().from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1)
      .then(r => r[0])

    if (!session || new Date(session.expiresAt) < new Date()) {
      return c.json({ authenticated: false, error: 'Session expired.' }, 401)
    }

    const user = await db.select().from(users)
      .where(eq(users.id, session.userId))
      .limit(1)
      .then(r => r[0])

    if (!user) {
      return c.json({ authenticated: false, error: 'User not found.' }, 401)
    }

    if (user.status === 'locked' || user.status === 'suspended') {
      return c.json({ authenticated: false, error: 'Account is restricted.' }, 403)
    }

    c.set('user_id', user.id)
    c.set('global_role', user.globalRole)
    c.set('session_id', session.id)
    c.set('passkey_verified_at', session.passkeyVerifiedAt || null)

    await db.update(sessions).set({ lastActiveAt: new Date().toISOString() }).where(eq(sessions.id, session.id))

    await next()
  }
}
