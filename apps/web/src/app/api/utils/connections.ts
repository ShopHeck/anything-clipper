import sql from '@/app/api/utils/sql';

export interface PlatformConnection {
  id: string;
  username: string | null;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
}

export async function getConnection(
  userId: string,
  platform: string
): Promise<PlatformConnection | null> {
  const [conn] = await sql`
    SELECT id, username, access_token, refresh_token, expires_at
    FROM platform_connections
    WHERE platform = ${platform} AND user_id = ${userId}
    LIMIT 1
  `;
  return conn?.access_token ? (conn as PlatformConnection) : null;
}

export async function saveTokens(
  userId: string,
  platform: string,
  tokens: { accessToken: string; refreshToken?: string | null; expiresInSec?: number }
): Promise<void> {
  const expiresAt = tokens.expiresInSec
    ? new Date(Date.now() + tokens.expiresInSec * 1000).toISOString()
    : null;
  await sql`
    UPDATE platform_connections SET
      access_token  = ${tokens.accessToken},
      refresh_token = COALESCE(${tokens.refreshToken ?? null}, refresh_token),
      expires_at    = COALESCE(${expiresAt}, expires_at),
      connected_at  = NOW()
    WHERE platform = ${platform} AND user_id = ${userId}
  `;
}

// True if the stored token expires within `withinSec`.
export function tokenExpiringSoon(conn: PlatformConnection, withinSec = 300): boolean {
  if (!conn.expires_at) return false;
  return Date.now() + withinSec * 1000 > new Date(conn.expires_at).getTime();
}
