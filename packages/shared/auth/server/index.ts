import { Hono } from 'hono'
import { AuthConfig } from '../types'
import { sessionGuard } from './middleware/session'
import { requireRole } from './middleware/role'
import { requirePasskeyFreshness } from './middleware/stepup'
import { createLoginRoutes } from './routes/login'
import { createSessionRoutes } from './routes/session'
import { createPasswordRoutes } from './routes/password'
import { createOauthRoutes, createOauthCallbackRoutes } from './routes/oauth'
import { createProfileRoutes } from './routes/profile'
import { createInvitationRoutes } from './routes/invitations'
import { createBackupCodeRoutes } from './routes/backup-codes'
import { createPasskeyRoutes } from './routes/passkey'

export function mountAuth(app: Hono<any>, config: AuthConfig) {
  app.route('/api/auth', createLoginRoutes(config))
  app.route('/api/auth/session', createSessionRoutes(config))
  app.route('/api/auth/password', createPasswordRoutes(config))
  app.route('/api/auth/oauth', createOauthRoutes(config))
  app.route('/api/auth', createOauthCallbackRoutes(config))

  // Protected auth routes (require session + step-up)
  app.use('/api/auth/profile/*', sessionGuard(), requirePasskeyFreshness(config.passkey.stepUpWindow))
  app.route('/api/auth/profile', createProfileRoutes(config))

  app.use('/api/auth/invitations/*', sessionGuard(), requireRole('owner'))
  app.route('/api/auth/invitations', createInvitationRoutes(config))

  app.use('/api/auth/backup-codes/*', sessionGuard(), requirePasskeyFreshness(config.passkey.stepUpWindow))
  app.route('/api/auth/backup-codes', createBackupCodeRoutes(config))

  app.use('/api/auth/passkeys/*', sessionGuard(), requirePasskeyFreshness(config.passkey.stepUpWindow))
  app.route('/api/auth/passkeys', createPasskeyRoutes(config))
}

export { AuthService, generateUUIDv7, generatePrefixedId } from './services/auth.service'
export { sessionGuard } from './middleware/session'
export { requireRole } from './middleware/role'
export { requirePasskeyFreshness } from './middleware/stepup'
