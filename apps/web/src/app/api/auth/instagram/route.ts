import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { getApiUser } from '@/app/api/utils/auth';
import { instagramConfigured } from '@/lib/publish/instagram';

// GET /api/auth/instagram — start Facebook Login for Instagram content publish.
export async function GET(request: Request) {
  const user = await getApiUser(request);
  const appUrl = process.env.NEXT_PUBLIC_CREATE_APP_URL ?? new URL(request.url).origin;
  if (!user) return Response.redirect(`${appUrl}/publish?instagram_error=not_signed_in`);
  if (!instagramConfigured()) {
    return Response.json({ error: 'Instagram is not configured on this deployment' }, { status: 501 });
  }

  const state = crypto.randomBytes(24).toString('hex');
  const cookieStore = await cookies();
  cookieStore.set('instagram_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
    sameSite: 'lax',
  });

  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID as string,
    redirect_uri: `${appUrl}/api/auth/instagram/callback`,
    response_type: 'code',
    scope: 'instagram_basic,instagram_content_publish,pages_show_list,business_management',
    state,
  });
  return Response.redirect(`https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`);
}
