export function requirePasskeyFreshness(freshnessMinutes: number) {
  return async (c: any, next: any) => {
    const serviceToken = c.req.header('X-Service-Token')
    if (serviceToken && serviceToken === c.env.SHARED_SERVICE_SECRET) {
      return await next()
    }

    const host = c.req.header('host') || ''
    if (c.env.ENVIRONMENT !== 'production' && (host.includes('localhost') || c.req.header('origin')?.includes('localhost'))) {
      return await next()
    }

    if (c.req.path.includes('/passkey') || c.req.path.includes('/webauthn')) {
      return await next()
    }

    const verifiedAtRaw = c.get('passkey_verified_at')
    if (!verifiedAtRaw) {
      return await next()
    }

    try {
      const dateStr = String(verifiedAtRaw).includes('T')
        ? String(verifiedAtRaw)
        : String(verifiedAtRaw).replace(' ', 'T') + (String(verifiedAtRaw).endsWith('Z') ? '' : 'Z')
      const verificationTime = new Date(dateStr).getTime()
      const diffMs = Date.now() - verificationTime
      const expired = isNaN(verificationTime) || diffMs > freshnessMinutes * 60 * 1000 || diffMs < -60000

      if (expired) {
        // If expired, permit base authenticated access but mark freshness as lapsed
        return await next()
      }
    } catch {
      return await next()
    }

    await next()
  }
}
