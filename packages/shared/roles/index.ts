/**
 * 👑 Universal Role Hierarchy & Display Aliases (Standard v7.0)
 * Single source of truth for role rankings, permission gates, and per-app themed aliases.
 *
 * Hierarchy (0 = Apex Authority / Owner, descending):
 *   0 -> OWNER        (Global root control across Foundation & fleet)
 *   1 -> ADMIN        (App-level administrator / infrastructure manager)
 *   2 -> MODERATOR    (Content moderator / operational coordinator)
 *   3 -> USER         (Standard registered user)
 *   4 -> GUEST        (Read-only / temporary attendee)
 */

export const ROLE_RANKS: Record<string, number> = {
  owner: 0,
  admin: 1,
  administrator: 1,
  mod: 2,
  moderator: 2,
  user: 3,
  participant: 3,
  guest: 4,
};

export const CANONICAL_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  USER: 'user',
  GUEST: 'guest',
} as const;

export const DEFAULT_ROLE_RANK = ROLE_RANKS.user; // 3

export function normalizeRole(role?: string | null): string {
  if (!role) return 'user';
  return role.toLowerCase().trim();
}

export function getRoleRank(role?: string | null): number {
  const norm = normalizeRole(role);
  return ROLE_RANKS[norm] ?? DEFAULT_ROLE_RANK;
}

export function isAuthorized(userRole: string | null | undefined, minRequiredRole: string): boolean {
  const userRank = getRoleRank(userRole);
  const requiredRank = getRoleRank(minRequiredRole);
  return userRank <= requiredRank;
}

/**
 * Resolves the display name for a role in a specific application context.
 * Always defaults to the role's primary display name if no custom app alias is defined.
 */
export function resolveRoleDisplayName(
  role: { name: string; appAliasesJson?: string | Record<string, string> | null },
  appId?: string | null
): string {
  if (!role || !role.name) return 'User';
  if (!appId) return role.name;

  const appKey = appId.toLowerCase().trim();
  let aliases: Record<string, string> = {};

  if (typeof role.appAliasesJson === 'string') {
    try {
      aliases = JSON.parse(role.appAliasesJson);
    } catch {
      aliases = {};
    }
  } else if (role.appAliasesJson && typeof role.appAliasesJson === 'object') {
    aliases = role.appAliasesJson as Record<string, string>;
  }

  return aliases[appKey] || role.name;
}
