/**
 * Discord Notification Dispatch Service for Foundation Fleet
 * GameProductions (Rule 26)
 */

export interface DiscordFleetNotificationPayload {
  title: string;
  description: string;
  action: 'redeploy' | 'start' | 'stop' | 'restart' | 'pause' | 'unpause' | 'create' | 'delete' | 'error' | 'test';
  status: 'success' | 'failed' | 'in_progress';
  stackName: string;
  environmentName?: string;
  endpointId?: number;
  user?: string;
  details?: Record<string, string | number | boolean | undefined>;
}

export interface DiscordNotificationSettings {
  enabled: boolean;
  webhookUrl: string;
  notifyOnDeploy: boolean;
  notifyOnLifecycle: boolean;
  notifyOnError: boolean;
  channelName?: string;
}

export async function getDiscordNotificationSettings(env: any): Promise<DiscordNotificationSettings> {
  let webhookUrl = env?.DISCORD_FLEET_WEBHOOK_URL || env?.DISCORD_WEBHOOK_URL || '';
  let enabled = !!webhookUrl;
  let notifyOnDeploy = true;
  let notifyOnLifecycle = true;
  let notifyOnError = true;
  let channelName = '#fleet-alerts';

  if (env?.FLEET_SECURITY_CACHE) {
    try {
      const stored = await env.FLEET_SECURITY_CACHE.get('settings:discord:fleet');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.webhookUrl !== undefined) webhookUrl = parsed.webhookUrl;
        if (parsed.enabled !== undefined) enabled = parsed.enabled;
        if (parsed.notifyOnDeploy !== undefined) notifyOnDeploy = parsed.notifyOnDeploy;
        if (parsed.notifyOnLifecycle !== undefined) notifyOnLifecycle = parsed.notifyOnLifecycle;
        if (parsed.notifyOnError !== undefined) notifyOnError = parsed.notifyOnError;
        if (parsed.channelName !== undefined) channelName = parsed.channelName;
      }
    } catch {
      // fallback
    }
  }

  return {
    enabled,
    webhookUrl,
    notifyOnDeploy,
    notifyOnLifecycle,
    notifyOnError,
    channelName,
  };
}

export async function saveDiscordNotificationSettings(env: any, settings: DiscordNotificationSettings): Promise<void> {
  if (env?.FLEET_SECURITY_CACHE) {
    await env.FLEET_SECURITY_CACHE.put('settings:discord:fleet', JSON.stringify(settings));
  }
}

export async function sendFleetDiscordNotification(
  env: any,
  payload: DiscordFleetNotificationPayload
): Promise<boolean> {
  const settings = await getDiscordNotificationSettings(env);
  if (!settings.enabled || !settings.webhookUrl) {
    return false;
  }

  if (payload.action === 'redeploy' || payload.action === 'create' || payload.action === 'delete') {
    if (!settings.notifyOnDeploy && payload.action !== 'test') return false;
  } else if (payload.action === 'error') {
    if (!settings.notifyOnError && payload.action !== 'test') return false;
  } else if (['start', 'stop', 'restart', 'pause', 'unpause'].includes(payload.action)) {
    if (!settings.notifyOnLifecycle && payload.action !== 'test') return false;
  }

  const colorMap = {
    success: 0x10b981, // Emerald Green
    failed: 0xf43f5e,  // Rose Red
    in_progress: 0x38bdf8, // Sky Blue
  };

  const fields = [
    { name: 'Stack / Container', value: `\`${payload.stackName}\``, inline: true },
    { name: 'Environment', value: payload.environmentName || `Endpoint #${payload.endpointId || 2}`, inline: true },
    { name: 'Action', value: `\`${payload.action.toUpperCase()}\``, inline: true },
  ];

  if (payload.user) {
    fields.push({ name: 'Triggered By', value: payload.user, inline: true });
  }

  if (payload.details) {
    for (const [key, value] of Object.entries(payload.details)) {
      if (value !== undefined) {
        fields.push({ name: key, value: String(value), inline: true });
      }
    }
  }

  const embed = {
    title: payload.title,
    description: payload.description,
    color: colorMap[payload.status] || 0x6366f1,
    fields,
    timestamp: new Date().toISOString(),
    footer: {
      text: 'GameProductions Foundation Fleet Orchestrator',
      icon_url: 'https://foundation.gpnet.dev/icons/foundation.png',
    },
  };

  try {
    const res = await fetch(settings.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Foundation Fleet Bot',
        avatar_url: 'https://foundation.gpnet.dev/icons/foundation.png',
        embeds: [embed],
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('[DiscordNotification] Failed to send Discord webhook:', err);
    return false;
  }
}
