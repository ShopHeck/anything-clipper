import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import sql from '@/app/api/utils/sql';

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  try {
    const projects = await sql`
      SELECT id, title, file_name, file_url, total_duration, viral_score,
             clip_count, status, created_at
      FROM projects
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
    `;
    return Response.json({ projects });
  } catch (error) {
    console.error('List projects error:', error);
    return Response.json({ error: 'Failed to list projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const { title, file_name, file_url, storage_key, status = 'uploading' } = body;

    const [project] = await sql`
      INSERT INTO projects (user_id, title, file_name, file_url, storage_key, status)
      VALUES (${user.id}, ${title || 'Untitled Project'}, ${file_name || null},
              ${file_url || null}, ${storage_key || null}, ${status})
      RETURNING id, title, file_name, file_url, status, created_at
    `;

    return Response.json({ project });
  } catch (error) {
    console.error('Create project error:', error);
    return Response.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
