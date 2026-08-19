import { Hono } from 'hono'
import { AuthConfig, AuthEnv, PasskeyEntry } from '../../types'
import { getDb } from '#/index'
import { sessions, passkeys } from '#/schema'
import { eq, and, desc } from 'drizzle-orm'
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server'
import { VaultService } from '~/services/vault.service'

const AAGUID_METADATA: Record<string, { name: string; icon: string; securityLevel: string; manufacturer: string; logo: string }> = {
  'fec3...0001': { name: 'Yubico YubiKey 5 Series', icon: '🔑', securityLevel: 'Hardware', manufacturer: 'Yubico', logo: '' },
  'fec3...0002': { name: 'Yubico YubiKey 5 NFC', icon: '🔑', securityLevel: 'Hardware', manufacturer: 'Yubico', logo: '' },
  'fec3...0003': { name: 'Yubico YubiKey 5C', icon: '🔑', securityLevel: 'Hardware', manufacturer: 'Yubico', logo: '' },
  'fec3...0004': { name: 'Yubico Security Key', icon: '🔑', securityLevel: 'Hardware', manufacturer: 'Yubico', logo: '' },
  'fec3...0005': { name: 'Yubico Security Key NFC', icon: '🔑', securityLevel: 'Hardware', manufacturer: 'Yubico', logo: '' },
  'fec3...0006': { name: 'Yubico Security Key C', icon: '🔑', securityLevel: 'Hardware', manufacturer: 'Yubico', logo: '' },
  'fec3...0007': { name: 'Yubico Bio Key', icon: '🔑', securityLevel: 'Hardware', manufacturer: 'Yubico', logo: '' },
  'adce0002-35bc-c60a-648b-0b25f1f05503': { name: 'Chrome on macOS', icon: '💻', securityLevel: 'Software', manufacturer: 'Google', logo: '' },
  '08987058-cad0-4399-b38f-02f6fa2ff0f8': { name: 'Windows Hello', icon: '🪟', securityLevel: 'TPM', manufacturer: 'Microsoft', logo: '' },
  'dd2ec1e5-3c85-4d1e-954b-0098bc104ba0': { name: 'iCloud Keychain', icon: '☁️', securityLevel: 'iCloud', manufacturer: 'Apple', logo: '' },
  '3c0a05e8-f995-4c96-8a2e-47ef7a539f8b': { name: 'Apple Touch ID', icon: '👆', securityLevel: 'Secure Enclave', manufacturer: 'Apple', logo: '' },
  '9ddd1817-af5a-4672-a2b9-3e205c3d2b5c': { name: 'Google Password Manager', icon: '🔒', securityLevel: 'Software', manufacturer: 'Google', logo: '' },
}

function getRpID(c: any): string {
  const host = c.req.header('host') || 'foundation.gpnet.dev'
  if (host.includes('localhost') || host.includes('127.0.0.1')) return 'localhost'
  return host.split(':')[0]
}

function getAAGUIDMetadata(aaguid: string) {
  return AAGUID_METADATA[aaguid] || { name: 'Unknown Security Key', icon: '🔑', securityLevel: 'Standard', manufacturer: 'Unknown', logo: '' }
}

function getForensics(c: any) {
  const connectingIp = c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || '127.0.0.1'
  return {
    connectingIp,
    ipV4: c.req.header('CF-Connecting-IP') || null,
    ipV6: c.req.header('CF-Pseudo-IPv4') || null,
    userAgent: c.req.header('User-Agent') || null,
    cfRay: c.req.header('CF-Ray') || null,
    city: c.req.header('CF-IPCity') || null,
    country: c.req.header('CF-IPCountry') || null,
    region: c.req.header('CF-Region') || null,
    latitude: c.req.header('CF-IPLatitude') || null,
    longitude: c.req.header('CF-IPLongitude') || null,
    location: null,
  }
}

export function createPasskeyRoutes(config: AuthConfig) {
  const router = new Hono<AuthEnv>()

  router.post('/generate-registration', async (c) => {
    try {
      const userId = c.get('user_id')
      if (!userId) return c.json({ error: 'Unauthorized.' }, 401)

      const rpID = getRpID(c)
      const db = getDb(c.env)
      const userPasskeys = await db.select().from(passkeys).where(eq(passkeys.userId, userId))

      const options = await generateRegistrationOptions({
        rpName: config.appName,
        rpID,
        userName: userId,
        attestationType: 'none',
        excludeCredentials: userPasskeys.map(pk => ({
          id: pk.id,
          type: 'public-key' as const,
          transports: pk.transports ? JSON.parse(pk.transports) : undefined,
        })),
      })

      await db.update(sessions).set({ passkeyVerifiedAt: options.challenge }).where(eq(sessions.id, c.get('session_id')))

      return c.json({ options })
    } catch (err: any) {
      return c.json({ error: err.message }, 500)
    }
  })

  router.post('/verify-registration', async (c) => {
    try {
      const userId = c.get('user_id')
      const sessionId = c.get('session_id')
      if (!userId || !sessionId) return c.json({ error: 'Unauthorized.' }, 401)

      const rpID = getRpID(c)
      const db = getDb(c.env)

      const sessionRecord = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1).then(r => r[0])
      if (!sessionRecord || !sessionRecord.passkeyVerifiedAt) {
        return c.json({ error: 'No active challenge.' }, 400)
      }

      const body = await c.req.json()
      const verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge: sessionRecord.passkeyVerifiedAt,
        expectedOrigin: c.req.header('origin') || `https://${rpID}`,
        expectedRPID: rpID,
        requireUserVerification: true,
      })

      if (verification.verified && verification.registrationInfo) {
        const { credential, aaguid } = verification.registrationInfo
        const { publicKey, id: credentialID, counter } = credential
        const forensics = getForensics(c)
        const vault = new VaultService(db, c.env.ENCRYPTION_KEY)

        const credentialIdUrl = credentialID
        const publicKeyUrl = Buffer.from(publicKey).toString('base64url')

        await vault.setSecret(credentialIdUrl, 'PASSKEY_PUBLIC_KEY', 'internal', publicKeyUrl)
        const providerMeta = getAAGUIDMetadata(aaguid || '')

        await db.insert(passkeys).values({
          id: credentialIdUrl,
          userId,
          counter,
          aaguid: aaguid || null,
          providerName: providerMeta.name,
          icon: providerMeta.icon,
          securityLevel: providerMeta.securityLevel,
          manufacturer: providerMeta.manufacturer,
          logo: providerMeta.logo,
          transports: JSON.stringify(body.response.transports || []),
          registrationIpV4: forensics.ipV4,
          registrationIpV6: forensics.ipV6,
          registrationUa: forensics.userAgent,
          registrationCity: forensics.city,
          registrationCountry: forensics.country,
          registrationRegion: forensics.region,
          registrationLatitude: forensics.latitude,
          registrationLongitude: forensics.longitude,
          createdAt: new Date().toISOString(),
        })

        await db.update(sessions).set({ passkeyVerifiedAt: new Date().toISOString() }).where(eq(sessions.id, sessionId))

        return c.json({ verified: true })
      }

      return c.json({ verified: false }, 400)
    } catch (err: any) {
      return c.json({ error: err.message }, 400)
    }
  })

  router.get('/', async (c) => {
    try {
      const userId = c.get('user_id')
      if (!userId) return c.json({ error: 'Unauthorized.' }, 401)

      const db = getDb(c.env)
      const results = await db.select().from(passkeys).where(eq(passkeys.userId, userId)).orderBy(desc(passkeys.createdAt))

      return c.json({ passkeys: results })
    } catch (err: any) {
      return c.json({ error: 'Failed to retrieve passkeys.' }, 500)
    }
  })

  router.put('/:id', async (c) => {
    try {
      const userId = c.get('user_id')
      const keyId = c.req.param('id')
      const { name } = await c.req.json()
      if (!userId) return c.json({ error: 'Unauthorized.' }, 401)

      const db = getDb(c.env)
      await db.update(passkeys).set({ name }).where(and(eq(passkeys.id, keyId), eq(passkeys.userId, userId)))

      return c.json({ success: true })
    } catch (err: any) {
      return c.json({ error: 'Failed to rename passkey.' }, 500)
    }
  })

  router.delete('/:id', async (c) => {
    try {
      const userId = c.get('user_id')
      const keyId = c.req.param('id')
      if (!userId) return c.json({ error: 'Unauthorized.' }, 401)

      const db = getDb(c.env)
      const vault = new VaultService(db, c.env.ENCRYPTION_KEY)

      await db.delete(passkeys).where(and(eq(passkeys.id, keyId), eq(passkeys.userId, userId)))
      await vault.deleteSecret(keyId, 'PASSKEY_PUBLIC_KEY', 'internal')

      return c.json({ success: true })
    } catch (err: any) {
      return c.json({ error: 'Failed to revoke passkey.' }, 500)
    }
  })

  // 🔑 Unauthenticated Passkey Login Generation (Discoverable Credentials / Passkey Autofill)
  router.post('/generate-authentication', async (c) => {
    try {
      const rpID = getRpID(c)
      const options = await generateAuthenticationOptions({
        rpID,
        userVerification: 'preferred',
      })

      // Store challenge in KV or cookie so unauthenticated verify can look it up
      const tempChallengeId = crypto.randomUUID()
      if (c.env.FLEET_SECURITY_CACHE) {
        await c.env.FLEET_SECURITY_CACHE.put(`passkey_challenge:${tempChallengeId}`, options.challenge, { expirationTtl: 300 })
      }

      return c.json({ options, challengeId: tempChallengeId })
    } catch (err: any) {
      return c.json({ error: err.message }, 500)
    }
  })

  // 🔑 Unauthenticated Passkey Login Verification
  router.post('/verify-authentication', async (c) => {
    try {
      const rpID = getRpID(c)
      const db = getDb(c.env)
      const body = await c.req.json()
      const challengeId = c.req.query('challengeId') || body.challengeId

      let expectedChallenge: string | null = null
      if (challengeId && c.env.FLEET_SECURITY_CACHE) {
        expectedChallenge = await c.env.FLEET_SECURITY_CACHE.get(`passkey_challenge:${challengeId}`)
      }

      const passkey = await db.select().from(passkeys)
        .where(eq(passkeys.id, body.id))
        .limit(1).then(r => r[0])

      if (!passkey) return c.json({ success: false, error: 'Passkey not recognized on this account.' }, 404)

      const vault = new VaultService(db, (c.env as any)?.ENCRYPTION_KEY)
      const publicKeyUrl = await vault.getSecret(body.id, 'PASSKEY_PUBLIC_KEY', 'internal')

      const verification = await verifyAuthenticationResponse({
        response: body,
        expectedChallenge: expectedChallenge || body.challenge || '',
        expectedOrigin: c.req.header('origin') || `https://${rpID}`,
        expectedRPID: rpID,
        credential: {
          id: passkey.id,
          publicKey: Buffer.from(publicKeyUrl!, 'base64url'),
          counter: passkey.counter ?? 0,
          transports: passkey.transports ? JSON.parse(passkey.transports) : undefined,
        },
      })

      if (verification.verified) {
        const forensics = getForensics(c)
        await db.update(passkeys).set({
          counter: verification.authenticationInfo.newCounter,
          lastUsedAt: new Date().toISOString(),
          lastUsedIpV4: forensics.ipV4,
          lastUsedIpV6: forensics.ipV6,
          lastUsedUa: forensics.userAgent,
        }).where(eq(passkeys.id, passkey.id))

        const auth = new AuthService(c.env, config)
        const hostStr = c.req.header('host') || ''
        const isLocal = c.env.ENVIRONMENT !== 'production' && (hostStr.includes('localhost') || c.req.header('origin')?.includes('localhost'))
        const { sessionId, expirationHours } = await auth.createSession(passkey.userId, forensics, true)
        auth.setSessionCookie(c, sessionId, expirationHours, isLocal)

        return c.json({ success: true, verified: true })
      }

      return c.json({ success: false, error: 'Passkey verification failed.' }, 400)
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 400)
    }
  })

  // 🛡️ Authenticated Step-up Challenge
  router.post('/generate-auth', async (c) => {
    try {
      const userId = c.get('user_id')
      const sessionId = c.get('session_id')
      if (!userId || !sessionId) return c.json({ error: 'Unauthorized.' }, 401)

      const rpID = getRpID(c)
      const db = getDb(c.env)
      const userPasskeys = await db.select().from(passkeys).where(eq(passkeys.userId, userId))

      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: userPasskeys.map(pk => ({
          id: pk.id,
          type: 'public-key' as const,
          transports: pk.transports ? JSON.parse(pk.transports) : undefined,
        })),
        userVerification: 'preferred',
      })

      await db.update(sessions).set({ passkeyVerifiedAt: options.challenge }).where(eq(sessions.id, sessionId))

      return c.json({ options })
    } catch (err: any) {
      return c.json({ error: err.message }, 500)
    }
  })

  router.post('/verify-auth', async (c) => {
    try {
      const userId = c.get('user_id')
      const sessionId = c.get('session_id')
      if (!userId || !sessionId) return c.json({ error: 'Unauthorized.' }, 401)

      const rpID = getRpID(c)
      const db = getDb(c.env)

      const sessionRecord = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1).then(r => r[0])
      if (!sessionRecord || !sessionRecord.passkeyVerifiedAt) {
        return c.json({ error: 'No active challenge.' }, 400)
      }

      const body = await c.req.json()
      const passkey = await db.select().from(passkeys)
        .where(and(eq(passkeys.userId, userId), eq(passkeys.id, body.id)))
        .limit(1).then(r => r[0])

      if (!passkey) return c.json({ error: 'Passkey not found.' }, 404)

      const vault = new VaultService(db, (c.env as any)?.ENCRYPTION_KEY)
      const publicKeyUrl = await vault.getSecret(body.id, 'PASSKEY_PUBLIC_KEY', 'internal')

      const verification = await verifyAuthenticationResponse({
        response: body,
        expectedChallenge: sessionRecord.passkeyVerifiedAt,
        expectedOrigin: c.req.header('origin') || `https://${rpID}`,
        expectedRPID: rpID,
        credential: {
          id: passkey.id,
          publicKey: Buffer.from(publicKeyUrl!, 'base64url'),
          counter: passkey.counter ?? 0,
          transports: passkey.transports ? JSON.parse(passkey.transports) : undefined,
        },
      })

      if (verification.verified) {
        const forensics = getForensics(c)
        await db.update(passkeys).set({
          counter: verification.authenticationInfo.newCounter,
          lastUsedAt: new Date().toISOString(),
          lastUsedIpV4: forensics.ipV4,
          lastUsedIpV6: forensics.ipV6,
          lastUsedUa: forensics.userAgent,
          lastUsedCity: forensics.city,
          lastUsedCountry: forensics.country,
          lastUsedRegion: forensics.region,
          lastUsedLatitude: forensics.latitude,
          lastUsedLongitude: forensics.longitude,
        }).where(eq(passkeys.id, passkey.id))

        if (sessionId) {
          await db.update(sessions).set({ passkeyVerifiedAt: new Date().toISOString() }).where(eq(sessions.id, sessionId as string))
        }

        return c.json({ verified: true })
      }

      return c.json({ verified: false }, 400)
    } catch (err: any) {
      return c.json({ error: err.message }, 400)
    }
  })

  return router
}
