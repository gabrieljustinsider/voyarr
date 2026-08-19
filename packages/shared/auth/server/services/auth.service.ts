import { eq, or, and, gt } from 'drizzle-orm'
import { getDb } from '#/index'
import { users, sessions, userIdentities, passwordResets, adminInvitations, backupCodes } from '#/schema'
import { setCookie, deleteCookie } from 'hono/cookie'
import { AuthConfig, AuthUser } from '../../types'

let lastTimestamp = -1
let sequenceCounter = 0

/**
 * 🆔 Cryptographically Secure RFC 9562 UUIDv7 Generator
 * Natural time-sorting with 48-bit Unix timestamp + 74-bit CSPRNG entropy.
 */
export function generateUUIDv7(): string {
  let now = Date.now()
  if (now <= lastTimestamp) {
    now = lastTimestamp
    sequenceCounter++
  } else {
    lastTimestamp = now
    sequenceCounter = 0
  }

  const timeBytes = new Uint8Array(6)
  timeBytes[0] = (now / 0x10000000000) & 0xff
  timeBytes[1] = (now / 0x100000000) & 0xff
  timeBytes[2] = (now / 0x1000000) & 0xff
  timeBytes[3] = (now / 0x10000) & 0xff
  timeBytes[4] = (now / 0x100) & 0xff
  timeBytes[5] = now & 0xff

  const randomBytes = crypto.getRandomValues(new Uint8Array(10))
  if (sequenceCounter > 0) {
    randomBytes[0] = (randomBytes[0] ^ (sequenceCounter >> 8)) & 0xff
    randomBytes[1] = (randomBytes[1] ^ sequenceCounter) & 0xff
  }

  // Version 7 in byte 6 (0b0111_xxxx)
  const octet6 = (randomBytes[0] & 0x0f) | 0x70
  // Variant 2 in byte 8 (0b10xx_xxxx)
  const octet8 = (randomBytes[2] & 0x3f) | 0x80

  const b = [
    timeBytes[0], timeBytes[1], timeBytes[2], timeBytes[3],
    timeBytes[4], timeBytes[5],
    octet6, randomBytes[1],
    octet8, randomBytes[3],
    randomBytes[4], randomBytes[5], randomBytes[6], randomBytes[7], randomBytes[8], randomBytes[9]
  ]

  const hex = Array.from(b, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * 🏷️ Generate Type-Prefixed Monotonic Identifier (e.g. "usr_0190...", "sess_0190...")
 */
export function generatePrefixedId(prefix: 'usr' | 'sess' | 'ident' | 'merge' | 'del' | 'inv' | 'passkey' | 'act' | string): string {
  const rawUuid = generateUUIDv7().replace(/-/g, '')
  return `${prefix}_${rawUuid}`
}

const PBKDF2_ITERATIONS = 100000

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits', 'deriveKey'])
  const derivedBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, keyMaterial, 256)
  const saltBase64 = uint8ArrayToBase64(salt)
  const hashBase64 = uint8ArrayToBase64(new Uint8Array(derivedBits))
  return `${PBKDF2_ITERATIONS}.${saltBase64}.${hashBase64}`
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const [iterations, saltBase64, expectedHashBase64] = storedHash.split('.')
    const salt = base64ToUint8Array(saltBase64)
    const encoder = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits', 'deriveKey'])
    const derivedBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt as BufferSource, iterations: parseInt(iterations), hash: 'SHA-256' }, keyMaterial, 256)
    const actualHashBase64 = uint8ArrayToBase64(new Uint8Array(derivedBits))
    return timingSafeEqual(actualHashBase64, expectedHashBase64)
  } catch {
    return false
  }
}

let counter = 0
function generateToken(): string {
  counter++
  const random = crypto.getRandomValues(new Uint8Array(32))
  const time = new Uint8Array(8)
  const view = new DataView(time.buffer)
  view.setBigUint64(0, BigInt(Date.now()) + BigInt(counter), false)
  const combined = new Uint8Array(40)
  combined.set(random, 0)
  combined.set(time, 32)
  return uint8ArrayToBase64(combined).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c] || '')
}

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return uint8ArrayToBase64(new Uint8Array(hashBuffer))
}

export class AuthService {
  constructor(private env: any, private config: AuthConfig) {}

  async validateCredentials(identifier: string, password: string) {
    const db = getDb(this.env)
    const result = await db.select().from(users).where(
      or(eq(users.email, identifier), eq(users.displayName, identifier))
    ).limit(1)
    const user = result[0]
    if (!user) return { success: false, error: 'Invalid credentials' } as const

    if (user.status === 'locked' || user.status === 'suspended') {
      return { success: false, error: 'Account is restricted.' } as const
    }

    if (!user.passwordHash) {
      return { success: false, error: 'Account linked via social provider. Please use Discord or Google login.' } as const
    }

    const isMatch = await verifyPassword(password, user.passwordHash)
    if (!isMatch) {
      await db.update(users).set({ failedLoginAttempts: (user.failedLoginAttempts || 0) + 1 }).where(eq(users.id, user.id))

      if ((user.failedLoginAttempts || 0) + 1 >= 5) {
        const lockMinutes = 30
        const lockUntil = new Date(Date.now() + lockMinutes * 60 * 1000).toISOString()
        await db.update(users).set({ lockedAt: lockUntil }).where(eq(users.id, user.id))
        return { success: false, error: `Account locked for ${lockMinutes} minutes due to multiple failed attempts.` } as const
      }

      return { success: false, error: 'Invalid credentials' } as const
    }

    await db.update(users).set({ failedLoginAttempts: 0, lockedAt: null }).where(eq(users.id, user.id))

    return { success: true, user: user as any } as const
  }

  async createSession(userId: string, forensics: any, isPersistent: boolean) {
    const db = getDb(this.env)
    const sessionId = generateToken()
    const expirationHours = isPersistent ? 30 * 24 : 24
    const nowIso = new Date().toISOString()

    await db.insert(sessions).values({
      id: sessionId,
      userId,
      expiresAt: new Date(Date.now() + expirationHours * 60 * 60 * 1000).toISOString(),
      passkeyVerifiedAt: nowIso,
      userAgent: forensics.userAgent || null,
      ipAddress: forensics.connectingIp || null,
      ipV4: forensics.ipV4 || null,
      ipV6: forensics.ipV6 || null,
      cfRay: forensics.cfRay || null,
      isPersistent,
      location: forensics.location || null,
    })

    return { sessionId, expirationHours }
  }

  setSessionCookie(c: any, sessionId: string, expirationHours: number, isLocal: boolean) {
    const host = c.req.header('host') || ''
    const domain = isLocal || host.includes('localhost') ? undefined : (host.endsWith('gpnet.dev') ? '.gpnet.dev' : undefined)
    setCookie(c, 'FOUNDATION_SESSION', sessionId, {
      path: '/',
      domain,
      secure: !isLocal,
      httpOnly: true,
      maxAge: 60 * 60 * expirationHours,
      sameSite: 'Lax',
    })
  }

  clearSessionCookie(c: any) {
    const host = c.req.header('host') || ''
    const domain = host.includes('localhost') ? undefined : (host.endsWith('gpnet.dev') ? '.gpnet.dev' : undefined)
    deleteCookie(c, 'FOUNDATION_SESSION', { path: '/', domain })
  }

  async createInvitation(email: string, role: string, createdBy: string) {
    const db = getDb(this.env)
    const token = generateToken()
    const tokenHash = await hashToken(token)

    await db.insert(adminInvitations).values({
      id: generateToken(),
      email,
      role,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdBy,
    })

    return token
  }

  async acceptInvitation(token: string, displayName: string, password: string) {
    const db = getDb(this.env)
    const tokenHash = await hashToken(token)

    const invitation = await db.select().from(adminInvitations)
      .where(and(eq(adminInvitations.tokenHash, tokenHash), gt(adminInvitations.expiresAt, new Date().toISOString())))
      .limit(1)
      .then(r => r[0])

    if (!invitation) return { success: false, error: 'Invalid or expired invitation token.' } as const
    if (invitation.acceptedAt) return { success: false, error: 'Invitation has already been used.' } as const

    const passwordHash = await hashPassword(password)
    const userId = generateToken()

    await db.insert(users).values({
      id: userId,
      email: invitation.email,
      displayName,
      passwordHash,
      globalRole: invitation.role,
      status: 'active',
    })

    await db.update(adminInvitations).set({ acceptedAt: new Date().toISOString() }).where(eq(adminInvitations.id, invitation.id))

    return { success: true, userId } as const
  }

  async requestPasswordReset(email: string) {
    const db = getDb(this.env)
    const user = await db.select().from(users).where(eq(users.email, email)).limit(1).then(r => r[0])
    if (!user) return { success: true }

    const token = generateToken()
    const tokenHash = await hashToken(token)

    await db.insert(passwordResets).values({
      id: generateToken(),
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })

    return { success: true, token }
  }

  async resetPassword(token: string, newPassword: string) {
    const db = getDb(this.env)
    const tokenHash = await hashToken(token)

    const reset = await db.select().from(passwordResets)
      .where(and(eq(passwordResets.tokenHash, tokenHash), gt(passwordResets.expiresAt, new Date().toISOString())))
      .limit(1)
      .then(r => r[0])

    if (!reset || reset.usedAt) return { success: false, error: 'Invalid or expired reset token.' } as const

    const passwordHash = await hashPassword(newPassword)
    await db.update(users).set({ passwordHash, passwordChangedAt: new Date().toISOString() }).where(eq(users.id, reset.userId))
    await db.update(passwordResets).set({ usedAt: new Date().toISOString() }).where(eq(passwordResets.id, reset.id))

    return { success: true } as const
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const db = getDb(this.env)
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1).then(r => r[0])
    if (!user) return { success: false, error: 'User not found.' } as const

    if (!user.passwordHash) {
      await db.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, userId))
      return { success: true } as const
    }

    const isMatch = await verifyPassword(currentPassword, user.passwordHash)
    if (!isMatch) return { success: false, error: 'Current password is incorrect.' } as const

    await db.update(users).set({ passwordHash: await hashPassword(newPassword), passwordChangedAt: new Date().toISOString() }).where(eq(users.id, userId))
    return { success: true } as const
  }

  async generateBackupCodes(userId: string) {
    const db = getDb(this.env)
    const codes: string[] = []

    await db.delete(backupCodes).where(eq(backupCodes.userId, userId))

    for (let i = 0; i < 10; i++) {
      const code = `1P-${generateToken().slice(0, 20).toUpperCase().replace(/-/g, '').match(/.{1,4}/g)!.join('-')}`
      codes.push(code)
      const codeHash = await hashPassword(code)
      await db.insert(backupCodes).values({
        id: generateToken(),
        userId,
        codeHash,
      })
    }

    return codes
  }

  async verifyBackupCode(userId: string, code: string) {
    const db = getDb(this.env)
    const storedCodes = await db.select().from(backupCodes).where(and(eq(backupCodes.userId, userId), eq(backupCodes.usedAt as any, null)))

    for (const stored of storedCodes) {
      const isValid = await verifyPassword(code, stored.codeHash)
      if (isValid) {
        await db.update(backupCodes).set({ usedAt: new Date().toISOString() }).where(eq(backupCodes.id, stored.id))
        return { success: true } as const
      }
    }

    return { success: false, error: 'Invalid or already used backup code.' } as const
  }
}

export function uint8ArrayToBase64url(bytes: Uint8Array): string {
  return uint8ArrayToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
