import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function GET(_req: NextRequest) {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) {
    return Response.json({ error: 'TIKTOK_CLIENT_KEY is not configured' }, { status: 500 });
  }

  // Generate a cryptographically random state to prevent CSRF
  const state = crypto.randomBytes(24).toString('hex');

  // Store state in a short-lived cookie (10 min)
  const cookieStore = await cookies();
  cookieStore.set('tiktok_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 10,
    path: '/',
    sameSite: 'lax',
  });

  const redirectUri = `${process.env.NEXT_PUBLIC_CREATE_APP_URL}/api/auth/tiktok/callback`;

  const params = new URLSearchParams({
    client_key: clientKey,
    scope: 'user.info.basic,video.publish,video.upload,video.list',
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
  });

  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;

  return Response.redirect(authUrl);
}
