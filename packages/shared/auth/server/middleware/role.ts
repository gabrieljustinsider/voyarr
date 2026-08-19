const ROLE_RANK: Record<string, number> = {
  owner: 100,
  admin: 80,
  mod: 60,
  user: 40,
}

export function requireRole(minRole: string) {
  return async (c: any, next: any) => {
    const serviceToken = c.req.header('X-Service-Token')
    if (serviceToken && serviceToken === c.env.SHARED_SERVICE_SECRET) {
      return await next()
    }

    const userRole: string = c.get('global_role') || 'user'
    const minRank = ROLE_RANK[minRole.toLowerCase()] || 0
    const userRank = ROLE_RANK[userRole.toLowerCase()] || 0

    if (userRank < minRank) {
      return c.json({ success: false, error: 'Insufficient permissions.' }, 403)
    }

    await next()
  }
}
