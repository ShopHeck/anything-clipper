import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import { heygenConfigured, listAvatars } from '@/lib/assets/heygen';

export const runtime = 'nodejs';

// GET /api/ugc/avatars
// Returns the list of talking-avatar options for the UGC creator picker.
// `configured` tells the UI whether the avatar pipeline is available at all;
// when false the UI hides the picker and the pipeline falls back to stock.
export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  if (!heygenConfigured()) {
    return Response.json({ configured: false, avatars: [] });
  }

  const avatars = await listAvatars();
  return Response.json({ configured: true, avatars });
}
