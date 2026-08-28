/**
 * 👑 Discord Linked Roles Specification (v7.0)
 * OAuth2 role_connections.write schema registration and verification handlers.
 */

export enum ApplicationRoleConnectionMetadataType {
  INTEGER_LESS_THAN_OR_EQUAL = 1,
  INTEGER_GREATER_THAN_OR_EQUAL = 2,
  INTEGER_EQUAL = 3,
  INTEGER_NOT_EQUAL = 4,
  DATETIME_LESS_THAN_OR_EQUAL = 5,
  DATETIME_GREATER_THAN_OR_EQUAL = 6,
  BOOLEAN_EQUAL = 7,
  BOOLEAN_NOT_EQUAL = 8,
}

export interface ApplicationRoleConnectionMetadata {
  type: ApplicationRoleConnectionMetadataType;
  key: string;
  name: string;
  name_localizations?: Record<string, string>;
  description: string;
  description_localizations?: Record<string, string>;
}

export const FLEET_LINKED_ROLES_METADATA: ApplicationRoleConnectionMetadata[] = [
  {
    key: 'is_verified_user',
    name: 'Verified Fleet Account',
    description: 'User has verified identity and active session in Foundation',
    type: ApplicationRoleConnectionMetadataType.BOOLEAN_EQUAL,
  },
  {
    key: 'role_tier',
    name: 'Fleet Privilege Tier',
    description: 'User role hierarchy rank level (Owner=0, Admin=1, Mod=2, User=3)',
    type: ApplicationRoleConnectionMetadataType.INTEGER_LESS_THAN_OR_EQUAL,
  },
  {
    key: 'passkey_count',
    name: 'Registered Passkeys',
    description: 'Number of hardware WebAuthn credentials active',
    type: ApplicationRoleConnectionMetadataType.INTEGER_GREATER_THAN_OR_EQUAL,
  },
  {
    key: 'account_created_date',
    name: 'Account Age',
    description: 'Timestamp when user registered in GameProductions',
    type: ApplicationRoleConnectionMetadataType.DATETIME_GREATER_THAN_OR_EQUAL,
  }
];

export async function registerLinkedRolesMetadata(
  applicationId: string, 
  botToken: string, 
  metadata: ApplicationRoleConnectionMetadata[] = FLEET_LINKED_ROLES_METADATA
): Promise<boolean> {
  const url = `https://discord.com/api/v10/applications/${applicationId}/role-connections/metadata`;
  const resp = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bot ${botToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(metadata)
  });
  return resp.ok;
}

export function renderDiscordLinkedRoleSuccessHtml(userName: string, roleName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Role Connected | GameProductions</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-white min-h-screen flex items-center justify-center p-6">
  <div class="max-w-md w-full bg-slate-900 border border-white/10 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
    <div class="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-2xl flex items-center justify-center mx-auto text-2xl font-bold">
      ✓
    </div>
    <div class="space-y-2">
      <h1 class="text-2xl font-black">Role Verified!</h1>
      <p class="text-xs text-slate-400">Welcome, <strong>${userName}</strong>. Your Discord account has been linked with the <strong>${roleName}</strong> role.</p>
    </div>
    <p class="text-[11px] text-slate-500">You may now close this window or return to Discord.</p>
    <script>
      setTimeout(() => { window.close(); }, 3000);
    </script>
  </div>
</body>
</html>`;
}
