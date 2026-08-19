import { Hono } from 'hono'
import { AuthConfig } from '../../types'
import { getDb } from '#/index'
import { sessions, users } from '#/schema'
import { eq, and, ne, gt } from 'drizzle-orm'
import { getCookie } from 'hono/cookie'

export function createSessionRoutes(config: AuthConfig) {
  const router = new Hono<any>()

  router.get('/', async (c) => {
    try {
      let userId = (c.get as any)('user_id') as string | undefined
      const db = getDb(c.env)

      if (!userId) {
        const sessionId = getCookie(c, 'FOUNDATION_SESSION')
        if (sessionId) {
          const sess = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1).then(r => r[0])
          if (sess && new Date(sess.expiresAt) > new Date()) {
            userId = sess.userId
          }
        }
      }

      if (!userId) return c.json({ authenticated: false }, 200)

      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1).then((r: any[]) => r[0])
      if (!user) return c.json({ authenticated: false }, 200)

      return c.json({
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl || user.avatar,
          globalRole: user.globalRole,
          status: user.status,
          createdAt: user.createdAt,
        },
      })
    } catch (err: any) {
      return c.json({ authenticated: false, error: err.message }, 200)
    }
  })

  router.get('/list', async (c) => {
    try {
      const userId = (c.get as any)('user_id') as string
      const currentSessionId = (c.get as any)('session_id') as string | undefined
      const db = getDb(c.env)

      const list = await db.select().from(sessions)
        .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date().toISOString())))
        .orderBy(sessions.createdAt)

      return c.json({
        success: true,
        sessions: list.map((s: any) => ({
          ...s,
          isCurrent: s.id === currentSessionId,
        })),
      })
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500)
    }
  })

  router.delete('/:id', async (c) => {
    try {
      const userId = (c.get as any)('user_id') as string
      const sessionId = c.req.param('id')
      const db = getDb(c.env)
      await db.delete(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      return c.json({ success: true })
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500)
    }
  })

  router.delete('/', async (c) => {
    try {
      const userId = (c.get as any)('user_id') as string
      const currentSessionId = (c.get as any)('session_id') as string
      const db = getDb(c.env)
      await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, currentSessionId)))
      return c.json({ success: true })
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500)
    }
  })

  return router
}
