import { Hono } from 'hono'
import { AuthConfig, AuthEnv } from '../../types'
import { AuthService } from '../services/auth.service'

export function createBackupCodeRoutes(config: AuthConfig) {
  const router = new Hono<AuthEnv>()

  router.post('/generate', async (c) => {
    try {
      const userId = c.get('user_id')
      const auth = new AuthService(c.env, config)
      const codes = await auth.generateBackupCodes(userId)

      return c.json({ success: true, codes })
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500)
    }
  })

  router.post('/verify', async (c) => {
    try {
      const userId = c.get('user_id')
      const { code } = await c.req.json()
      if (!code) return c.json({ success: false, error: 'Code is required.' }, 400)

      const auth = new AuthService(c.env, config)
      const result = await auth.verifyBackupCode(userId, code)
      if (!result.success) return c.json({ success: false, error: result.error }, 400)

      return c.json({ success: true })
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500)
    }
  })

  return router
}
