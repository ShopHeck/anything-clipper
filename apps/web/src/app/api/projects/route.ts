import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import sql from '@/app/api/utils/sql';

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  try {
    // Owned projects plus any shared with the caller (by user id or email).
    const projects = await sql`
      SELECT p.id, p.title, p.file_name, p.file_url, p.total_duration, p.viral_score,
             p.clip_count, p.status, p.created_at,
             CASE WHEN p.user_id = ${user.id} THEN 'owner' ELSE s.role END AS role
      FROM projects p
      LEFT JOIN project_shares s
        ON s.project_id = p.id
        AND (s.shared_with_user_id = ${user.id} OR lower(s.shared_with_email) = lower(${user.email}))
      WHERE p.user_id = ${user.id} OR s.id IS NOT NULL
      ORDER BY p.created_at DESC
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
