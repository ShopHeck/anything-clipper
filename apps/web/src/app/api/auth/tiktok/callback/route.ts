import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getApiUser } from '@/app/api/utils/auth';
import sql from '@/app/api/utils/sql';

export async function GET(req: NextRequest) {
  // The OAuth redirect arrives in the user's browser, so their session
  // cookie is present — the connection must be saved under their account.
  const user = await getApiUser(req);
  if (!user) {
    const appUrl = process.env.NEXT_PUBLIC_CREATE_APP_URL ?? '';
    return Response.redirect(`${appUrl}/publish?tiktok_error=not_signed_in`);
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const appUrl = process.env.NEXT_PUBLIC_CREATE_APP_URL ?? '';

  // User denied access
  if (error) {
    console.error('TikTok OAuth error:', error, errorDescription);
    return Response.redirect(
      `${appUrl}/publish?tiktok_error=${encodeURIComponent(errorDescription ?? error)}`
    );
  }

  if (!code || !state) {
    return Response.redirect(`${appUrl}/publish?tiktok_error=missing_code`);
  }

  // Validate state to prevent CSRF
  const cookieStore = await cookies();
  const storedState = cookieStore.get('tiktok_oauth_state')?.value;

  if (!storedState || storedState !== state) {
    console.error('TikTok OAuth state mismatch', { storedState, state });
    return Response.redirect(`${appUrl}/publish?tiktok_error=state_mismatch`);
  }

  // Clear state cookie
  cookieStore.delete('tiktok_oauth_state');

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

  if (!clientKey || !clientSecret) {
    return Response.redirect(`${appUrl}/publish?tiktok_error=server_misconfigured`);
  }

  const redirectUri = `${appUrl}/api/auth/tiktok/callback`;

  // ── Exchange code for tokens ──────────────────────────────
  let accessToken: string;
  let refreshToken: string;
  let openId: string;
  let expiresIn: number;

  try {
    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('TikTok token exchange failed:', tokenRes.status, errBody);
      return Response.redirect(`${appUrl}/publish?tiktok_error=token_exchange_failed`);
    }

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error('TikTok token error:', tokenData.error, tokenData.error_description);
      return Response.redirect(
        `${appUrl}/publish?tiktok_error=${encodeURIComponent(tokenData.error_description ?? tokenData.error)}`
      );
    }

    accessToken = tokenData.access_token;
    refreshToken = tokenData.refresh_token;
    openId = tokenData.open_id;
    expiresIn = tokenData.expires_in ?? 86400;
  } catch (err) {
    console.error('TikTok token exchange error:', err);
    return Response.redirect(`${appUrl}/publish?tiktok_error=token_request_failed`);
  }

  // ── Fetch user info ───────────────────────────────────────
  let displayName: string = 'TikTok User';
  let avatarUrl: string | null = null;
  let followerCount = 0;

  try {
    const userRes = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,follower_count',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (userRes.ok) {
      const userData = await userRes.json();
      const user = userData?.data?.user;
      if (user) {
        displayName = user.display_name ?? displayName;
        avatarUrl = user.avatar_url ?? null;
        followerCount = user.follower_count ?? 0;
      }
    }
  } catch (err) {
    console.error('TikTok user info fetch error (non-fatal):', err);
  }

  // ── Save connection to database ───────────────────────────
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  try {
    await sql`
      INSERT INTO platform_connections
        (user_id, platform, username, avatar_url, followers_count, access_token, refresh_token, open_id, expires_at)
      VALUES
        (${user.id}, 'TikTok', ${displayName}, ${avatarUrl}, ${followerCount}, ${accessToken}, ${refreshToken}, ${openId}, ${expiresAt})
      ON CONFLICT (user_id, platform) DO UPDATE SET
        username        = EXCLUDED.username,
        avatar_url      = EXCLUDED.avatar_url,
        followers_count = EXCLUDED.followers_count,
        access_token    = EXCLUDED.access_token,
        refresh_token   = EXCLUDED.refresh_token,
        open_id         = EXCLUDED.open_id,
        expires_at      = EXCLUDED.expires_at,
        connected_at    = NOW()
    `;
  } catch (err) {
    console.error('DB save error:', err);
    return Response.redirect(`${appUrl}/publish?tiktok_error=db_save_failed`);
  }

  // ── All done — redirect back to publish page ──────────────
  return Response.redirect(`${appUrl}/publish?tiktok_connected=1`);
}
