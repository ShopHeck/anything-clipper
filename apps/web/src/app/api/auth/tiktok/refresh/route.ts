import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import { refreshTikTokToken } from '@/app/api/utils/tiktok';

/**
 * POST /api/auth/tiktok/refresh
 * Refreshes the caller's TikTok access token using their stored
 * refresh_token. Can be called proactively before the token expires, or
 * reactively on 401.
 */
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  try {
    const token = await refreshTikTokToken(user.id);
    if (!token) {
      return Response.json(
        { error: 'No TikTok connection found or token refresh failed.' },
        { status: 404 }
      );
    }
    return Response.json({ success: true });
  } catch (err) {
    console.error('TikTok refresh error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
