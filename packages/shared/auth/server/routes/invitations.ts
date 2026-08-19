import { Hono } from 'hono'
import { AuthConfig, AuthEnv } from '../../types'
import { AuthService } from '../services/auth.service'
import { getDb } from '#/index'
import { adminInvitations } from '#/schema'
import { eq } from 'drizzle-orm'

export function createInvitationRoutes(config: AuthConfig) {
  const router = new Hono<AuthEnv>()

  router.post('/', async (c) => {
    try {
      const { email, role } = await c.req.json()
      if (!email) return c.json({ success: false, error: 'Email is required.' }, 400)

      const userId = c.get('user_id')
      const auth = new AuthService(c.env, config)
      const token = await auth.createInvitation(email, role || 'admin', userId)

      return c.json({ success: true, token, message: `Invitation created for ${email}. Share the token with the recipient.` })
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500)
    }
  })

  router.get('/', async (c) => {
    try {
      const db = getDb(c.env)
      const list = await db.select().from(adminInvitations).orderBy(adminInvitations.createdAt)
      return c.json({ success: true, invitations: list })
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500)
    }
  })

  router.post('/accept', async (c) => {
    try {
      const { token, displayName, password } = await c.req.json()
      if (!token || !displayName || !password) {
        return c.json({ success: false, error: 'Token, display name, and password are required.' }, 400)
      }

      const auth = new AuthService(c.env, config)
      const result = await auth.acceptInvitation(token, displayName, password)
      if (!result.success) return c.json({ success: false, error: result.error }, 400)

      return c.json({ success: true, message: 'Invitation accepted. You can now log in.' })
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500)
    }
  })

  return router
}
