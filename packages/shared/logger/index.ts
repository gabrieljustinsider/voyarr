import type { Context } from 'hono';

const SENSITIVE_KEYS = [
  'password', 'passwordHash', 'token', 'accessToken', 'refreshToken', 
  'secret', 'key', 'webhookUrl', 'discordWebhookUrl', 'totpSecret',
  'email', 'phone', 'ssn', 'creditCard'
];

export function redactSensitiveData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item));
  }
  const redacted: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      redacted[key] = redactSensitiveData(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

export interface UniversalAuditPayload {
  sourceSystem: string;
  targetType: string;
  recordId?: string | number | null;
  action: string;
  oldValues?: any;
  newValues?: any;
  metadata?: any;
}

export function logUniversalAudit(
  c: Context<any>,
  payload: UniversalAuditPayload
) {
  const performLog = async () => {
    try {
      const connectingIp = c.req.header('cf-connecting-ip') || 
                           c.req.header('x-forwarded-for') || 
                           '0.0.0.0';
      const user = c.var?.user;
      const actorId = user?.id || c.get('userId') || c.get('user_id') || 'unauthenticated';
      const cfRay = c.req.header('cf-ray') || 'local-ray';
      const city = c.req.header('cf-ipcity') || null;
      const country = c.req.header('cf-ipcountry') || null;
      const location = city && country ? `${city}, ${country}` : country || 'Unknown';

      const auditRecord = {
        guildId: payload.sourceSystem,
        actorId,
        action: payload.action,
        targetType: payload.targetType,
        targetId: payload.recordId ? String(payload.recordId) : null,
        oldValuesJson: JSON.stringify(redactSensitiveData(payload.oldValues || {})),
        newValuesJson: JSON.stringify(redactSensitiveData(payload.newValues || {})),
        metadataJson: JSON.stringify({
          ...redactSensitiveData(payload.metadata || {}),
          userAgent: c.req.header('user-agent'),
          ipAddress: connectingIp
        }),
        cfRay,
        location,
        createdAt: new Date().toISOString()
      };

      // Fallback 1: If central database URL exists in context (e.g. Foundation)
      if (c.env?.DATABASE_URL) {
        const { getDb } = await import('#/index');
        const { auditLogs } = await import('#/schema');
        const db = getDb(c.env);
        await db.insert(auditLogs).values(auditRecord as any);
      }
    } catch (err) {
      console.error('[UniversalLogger] Asynchronous log write failed:', err);
    }
  };

  // Zero-latency asynchronous dispatch
  if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') {
    c.executionCtx.waitUntil(performLog());
  } else {
    performLog();
  }
}
