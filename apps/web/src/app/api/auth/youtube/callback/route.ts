import { cookies } from 'next/headers';
import { getApiUser } from '@/app/api/utils/auth';
import sql from '@/app/api/utils/sql';
import { youTubeConfigured } from '@/lib/publish/youtube';

// GET /api/auth/youtube/callback — exchange the code for tokens and store the
// YouTube connection (per user).
export async function GET(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_CREATE_APP_URL ?? new URL(request.url).origin;
  const user = await getApiUser(request);
  if (!user) return Response.redirect(`${appUrl}/publish?youtube_error=not_signed_in`);
  if (!youTubeConfigured()) return Response.redirect(`${appUrl}/publish?youtube_error=server`);

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  if (error) return Response.redirect(`${appUrl}/publish?youtube_error=${encodeURIComponent(error)}`);
  if (!code || !state) return Response.redirect(`${appUrl}/publish?youtube_error=missing_code`);

  const cookieStore = await cookies();
  if (cookieStore.get('youtube_oauth_state')?.value !== state) {
    return Response.redirect(`${appUrl}/publish?youtube_error=state_mismatch`);
  }
  cookieStore.delete('youtube_oauth_state');

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID as string,
        client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${appUrl}/api/auth/youtube/callback`,
      }),
    });
    if (!tokenRes.ok) {
      return Response.redirect(`${appUrl}/publish?youtube_error=token_exchange_failed`);
    }
    const tokens = await tokenRes.json();
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    // Best-effort channel name for display.
    let username = 'YouTube';
    try {
      const ch = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      );
      if (ch.ok) {
        const data = await ch.json();
        username = data?.items?.[0]?.snippet?.title ?? username;
      }
    } catch {
      /* non-fatal */
    }

    await sql`
      INSERT INTO platform_connections
        (user_id, platform, username, access_token, refresh_token, expires_at)
      VALUES
        (${user.id}, 'YouTube', ${username}, ${tokens.access_token}, ${tokens.refresh_token ?? null}, ${expiresAt})
      ON CONFLICT (user_id, platform) DO UPDATE SET
        username      = EXCLUDED.username,
        access_token  = EXCLUDED.access_token,
        refresh_token = COALESCE(EXCLUDED.refresh_token, platform_connections.refresh_token),
        expires_at    = EXCLUDED.expires_at,
        connected_at  = NOW()
    `;
  } catch (err) {
    console.error('YouTube OAuth error:', err);
    return Response.redirect(`${appUrl}/publish?youtube_error=server`);
  }

  return Response.redirect(`${appUrl}/publish?youtube_connected=1`);
}
