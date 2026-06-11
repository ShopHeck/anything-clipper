import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import sql from '@/app/api/utils/sql';

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const limit = parseInt(searchParams.get('limit') || '50');

    let clips;
    if (projectId) {
      clips = await sql`
        SELECT c.*, p.title as project_title, p.file_url
        FROM clips c
        JOIN projects p ON p.id = c.project_id
        WHERE c.project_id = ${projectId} AND p.user_id = ${user.id}
        ORDER BY c.score DESC
        LIMIT ${limit}
      `;
    } else {
      clips = await sql`
        SELECT c.*, p.title as project_title, p.file_url
        FROM clips c
        JOIN projects p ON p.id = c.project_id
        WHERE p.user_id = ${user.id}
        ORDER BY c.created_at DESC
        LIMIT ${limit}
      `;
    }

    return Response.json({ clips });
  } catch (error) {
    console.error('List clips error:', error);
    return Response.json({ error: 'Failed to list clips' }, { status: 500 });
  }
}
