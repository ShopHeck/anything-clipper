import sql from '@/app/api/utils/sql';

/**
 * POST /api/auth/tiktok/refresh
 * Refreshes the TikTok access token using the stored refresh_token.
 * Can be called proactively before the token expires, or reactively on 401.
 */
export async function POST() {
  try {
    // Fetch the stored TikTok connection
    const [conn] = await sql`
      SELECT refresh_token, open_id FROM platform_connections
      WHERE platform = 'TikTok' LIMIT 1
    `;

    if (!conn?.refresh_token) {
      return Response.json(
        { error: 'No TikTok connection found or no refresh token stored.' },
        { status: 404 }
      );
    }

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

    if (!clientKey || !clientSecret) {
      return Response.json({ error: 'TikTok credentials not configured' }, { status: 500 });
    }

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
      const body = await res.text();
      console.error('TikTok refresh failed:', res.status, body);
      return Response.json({ error: 'Token refresh failed', detail: body }, { status: 502 });
    }

    const data = await res.json();

    if (data.error) {
      return Response.json({ error: data.error_description ?? data.error }, { status: 400 });
    }

    const expiresAt = new Date(Date.now() + (data.expires_in ?? 86400) * 1000).toISOString();

    await sql`
      UPDATE platform_connections SET
        access_token  = ${data.access_token},
        refresh_token = ${data.refresh_token ?? conn.refresh_token},
        expires_at    = ${expiresAt},
        connected_at  = NOW()
      WHERE platform = 'TikTok'
    `;

    return Response.json({ success: true, expires_at: expiresAt });
  } catch (err) {
    console.error('TikTok refresh error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
