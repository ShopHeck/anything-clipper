import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import sql from '@/app/api/utils/sql';

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  try {
    const connections = await sql`
      SELECT id, platform, username, avatar_url, followers_count, connected_at, expires_at
      FROM platform_connections
      WHERE user_id = ${user.id}
      ORDER BY connected_at DESC
    `;
    return Response.json({ connections });
  } catch (error) {
    console.error('List connections error:', error);
    return Response.json({ error: 'Failed to list connections' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const { platform, username, avatar_url, followers_count, access_token } = body;

    if (!platform || !username) {
      return Response.json({ error: 'platform and username are required' }, { status: 400 });
    }

    // Upsert this user's connection for the platform
    const [conn] = await sql`
      INSERT INTO platform_connections (user_id, platform, username, avatar_url, followers_count, access_token)
      VALUES (${user.id}, ${platform}, ${username}, ${avatar_url || null}, ${followers_count || 0}, ${access_token || null})
      ON CONFLICT (user_id, platform) DO UPDATE SET
        username = EXCLUDED.username,
        avatar_url = EXCLUDED.avatar_url,
        followers_count = EXCLUDED.followers_count,
        access_token = EXCLUDED.access_token,
        connected_at = NOW()
      RETURNING id, platform, username, avatar_url, followers_count, connected_at
    `;

    return Response.json({ connection: conn });
  } catch (error) {
    console.error('Create connection error:', error);
    return Response.json({ error: 'Failed to save connection' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    if (!platform) return Response.json({ error: 'platform required' }, { status: 400 });

    await sql`
      DELETE FROM platform_connections WHERE platform = ${platform} AND user_id = ${user.id}
    `;
    return Response.json({ success: true });
  } catch (error) {
    console.error('Delete connection error:', error);
    return Response.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
