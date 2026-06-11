import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { getApiUser } from '@/app/api/utils/auth';
import { youTubeConfigured } from '@/lib/publish/youtube';

// GET /api/auth/youtube — start Google OAuth for YouTube upload access.
export async function GET(request: Request) {
  const user = await getApiUser(request);
  const appUrl = process.env.NEXT_PUBLIC_CREATE_APP_URL ?? new URL(request.url).origin;
  if (!user) return Response.redirect(`${appUrl}/publish?youtube_error=not_signed_in`);
  if (!youTubeConfigured()) {
    return Response.json({ error: 'YouTube is not configured on this deployment' }, { status: 501 });
  }

  const state = crypto.randomBytes(24).toString('hex');
  const cookieStore = await cookies();
  cookieStore.set('youtube_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
    sameSite: 'lax',
  });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    redirect_uri: `${appUrl}/api/auth/youtube/callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube.upload',
    access_type: 'offline',
    prompt: 'consent', // force a refresh_token on every connect
    state,
  });
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
