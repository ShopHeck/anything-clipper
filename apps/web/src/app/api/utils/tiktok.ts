import sql from '@/app/api/utils/sql';

export interface TikTokConnection {
  id: string;
  username: string | null;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
}

export async function getTikTokConnection(userId: string): Promise<TikTokConnection | null> {
  const [conn] = await sql`
    SELECT id, username, access_token, refresh_token, expires_at
    FROM platform_connections
    WHERE platform = 'TikTok' AND user_id = ${userId}
    LIMIT 1
  `;
  return conn?.access_token ? (conn as TikTokConnection) : null;
}

// Refresh the user's TikTok access token in place. Returns the fresh token,
// or null if refresh wasn't possible (caller decides whether to continue
// with the existing token or fail).
export async function refreshTikTokToken(userId: string): Promise<string | null> {
  const conn = await getTikTokConnection(userId);
  if (!conn?.refresh_token) return null;

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) return null;

  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: conn.refresh_token,
    }),
  });

  if (!res.ok) {
    console.error('TikTok refresh failed:', res.status, await res.text().catch(() => ''));
    return null;
  }

  const data = await res.json();
  if (data.error || !data.access_token) {
    console.error('TikTok refresh error:', data.error_description ?? data.error);
    return null;
  }

  const expiresAt = new Date(Date.now() + (data.expires_in ?? 86400) * 1000).toISOString();
  await sql`
    UPDATE platform_connections SET
      access_token  = ${data.access_token},
      refresh_token = ${data.refresh_token ?? conn.refresh_token},
      expires_at    = ${expiresAt},
      connected_at  = NOW()
    WHERE platform = 'TikTok' AND user_id = ${userId}
  `;
  return data.access_token as string;
}

// Returns a valid access token, refreshing first if it expires within
// five minutes.
export async function getFreshTikTokToken(userId: string): Promise<string | null> {
  const conn = await getTikTokConnection(userId);
  if (!conn) return null;

  const expiresAt = conn.expires_at ? new Date(conn.expires_at).getTime() : null;
  if (expiresAt && Date.now() + 5 * 60 * 1000 > expiresAt) {
    const refreshed = await refreshTikTokToken(userId);
    if (refreshed) return refreshed;
  }
  return conn.access_token;
}
