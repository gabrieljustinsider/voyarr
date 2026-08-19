import { Hono } from 'hono'
import { AuthConfig, AuthEnv } from '../../types'
import { getDb } from '#/index'
import { users } from '#/schema'
import { eq } from 'drizzle-orm'

export function createProfileRoutes(config: AuthConfig) {
  const router = new Hono<AuthEnv>()

  router.get('/', async (c) => {
    try {
      const userId = c.get('user_id')
      const db = getDb(c.env)
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1).then(r => r[0])
      if (!user) return c.json({ success: false, error: 'User not found.' }, 404)

      return c.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          globalRole: user.globalRole,
          status: user.status,
          timezone: user.timezone,
          locale: user.locale,
          themePreference: user.themePreference,
          createdAt: user.createdAt,
        },
      })
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500)
    }
  })

  router.put('/', async (c) => {
    try {
      const userId = c.get('user_id')
      const { displayName, email, avatarUrl, timezone, locale, themePreference } = await c.req.json()
      const db = getDb(c.env)

      await db.update(users).set({
        displayName: displayName || undefined,
        email: email || undefined,
        avatarUrl: avatarUrl || undefined,
        timezone: timezone || undefined,
        locale: locale || undefined,
        themePreference: themePreference || undefined,
        updatedAt: new Date().toISOString(),
      }).where(eq(users.id, userId))

      return c.json({ success: true })
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500)
    }
  })

  return router
}
