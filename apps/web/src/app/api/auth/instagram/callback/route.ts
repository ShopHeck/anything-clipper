import { cookies } from 'next/headers';
import { getApiUser } from '@/app/api/utils/auth';
import sql from '@/app/api/utils/sql';
import { instagramConfigured } from '@/lib/publish/instagram';

const GRAPH = 'https://graph.facebook.com/v21.0';

// GET /api/auth/instagram/callback — exchange code for a long-lived token,
// resolve the linked Instagram Business account id, and store the connection.
export async function GET(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_CREATE_APP_URL ?? new URL(request.url).origin;
  const user = await getApiUser(request);
  if (!user) return Response.redirect(`${appUrl}/publish?instagram_error=not_signed_in`);
  if (!instagramConfigured()) return Response.redirect(`${appUrl}/publish?instagram_error=server`);

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  if (error) return Response.redirect(`${appUrl}/publish?instagram_error=${encodeURIComponent(error)}`);
  if (!code || !state) return Response.redirect(`${appUrl}/publish?instagram_error=missing_code`);

  const cookieStore = await cookies();
  if (cookieStore.get('instagram_oauth_state')?.value !== state) {
    return Response.redirect(`${appUrl}/publish?instagram_error=state_mismatch`);
  }
  cookieStore.delete('instagram_oauth_state');

  const appId = process.env.FACEBOOK_APP_ID as string;
  const appSecret = process.env.FACEBOOK_APP_SECRET as string;
  const redirectUri = `${appUrl}/api/auth/instagram/callback`;

  try {
    // 1) Code → short-lived user token.
    const tokenRes = await fetch(
      `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
          code,
        }).toString()
    );
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return Response.redirect(`${appUrl}/publish?instagram_error=token_exchange_failed`);
    }

    // 2) Exchange for a long-lived token (~60 days).
    const llRes = await fetch(
      `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: tokenData.access_token,
        }).toString()
    );
    const llData = await llRes.json();
    const longLived = llData.access_token ?? tokenData.access_token;
    const expiresAt = llData.expires_in
      ? new Date(Date.now() + llData.expires_in * 1000).toISOString()
      : null;

    // 3) Find the Page and its linked Instagram Business account.
    const pagesRes = await fetch(
      `${GRAPH}/me/accounts?fields=instagram_business_account,name&access_token=${encodeURIComponent(longLived)}`
    );
    const pagesData = await pagesRes.json();
    const page = (pagesData.data ?? []).find(
      (p: { instagram_business_account?: { id: string } }) => p.instagram_business_account?.id
    );
    const igUserId = page?.instagram_business_account?.id;
    if (!igUserId) {
      return Response.redirect(`${appUrl}/publish?instagram_error=no_business_account`);
    }

    // Best-effort username for display.
    let username = 'Instagram';
    try {
      const uRes = await fetch(
        `${GRAPH}/${igUserId}?fields=username&access_token=${encodeURIComponent(longLived)}`
      );
      if (uRes.ok) username = (await uRes.json()).username ?? username;
    } catch {
      /* non-fatal */
    }

    await sql`
      INSERT INTO platform_connections
        (user_id, platform, username, access_token, open_id, expires_at)
      VALUES
        (${user.id}, 'Instagram', ${username}, ${longLived}, ${igUserId}, ${expiresAt})
      ON CONFLICT (user_id, platform) DO UPDATE SET
        username     = EXCLUDED.username,
        access_token = EXCLUDED.access_token,
        open_id      = EXCLUDED.open_id,
        expires_at   = EXCLUDED.expires_at,
        connected_at = NOW()
    `;
  } catch (err) {
    console.error('Instagram OAuth error:', err);
    return Response.redirect(`${appUrl}/publish?instagram_error=server`);
  }

  return Response.redirect(`${appUrl}/publish?instagram_connected=1`);
}
