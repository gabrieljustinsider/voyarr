export interface AuthConfig {
  appName: string
  providers: Array<'discord' | 'google'>
  registration: 'invite-only' | 'open'
  passkey: {
    stepUpWindow: number
    firstRunOnboarding: boolean
  }
}

export interface AuthEnv {
  Bindings: any
  Variables: {
    user_id: string
    session_id: string
    [key: string]: any
  }
}

export interface AuthUser {
  id: string
  email: string | null
  displayName: string | null
  avatarUrl: string | null
  globalRole: string
  status: string
  createdAt: string | null
}

export interface AuthSession {
  id: string
  userId: string
  expiresAt: string
  passkeyVerifiedAt: string | null
  userAgent: string | null
  ipAddress: string | null
  createdAt: string | null
  isPersistent: boolean | null
  deviceName: string | null
  os: string | null
  browser: string | null
  location: string | null
}

export interface PasskeyEntry {
  id: string
  name: string | null
  aaguid: string | null
  createdAt: string
  lastUsedAt: string | null
  lastUsedIpV4: string | null
  lastUsedIpV6: string | null
  lastUsedUa: string | null
  browser: string | null
  os: string | null
  deviceName: string | null
  city: string | null
  country: string | null
  region: string | null
  latitude: string | null
  longitude: string | null
  providerName: string | null
  icon: string | null
  securityLevel: string | null
  manufacturer: string | null
  logo: string | null
  counter: number
  transports: string | null
  registrationIpV4: string | null
  registrationIpV6: string | null
  registrationCity: string | null
  registrationCountry: string | null
  registrationUa: string | null
  lastUsedCity: string | null
  lastUsedCountry: string | null
}
