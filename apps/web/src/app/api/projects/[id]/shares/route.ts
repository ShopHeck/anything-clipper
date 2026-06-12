import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import sql from '@/app/api/utils/sql';

async function isOwner(userId: string, projectId: string): Promise<boolean> {
  const [p] = await sql`SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${userId}`;
  return Boolean(p);
}

// GET /api/projects/:id/shares — list collaborators (owner only).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const { id } = await params;
  if (!(await isOwner(user.id, id))) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }
  const shares = await sql`
    SELECT id, shared_with_email, shared_with_user_id, role, created_at
    FROM project_shares WHERE project_id = ${id}
    ORDER BY created_at ASC
  `;
  return Response.json({ shares });
}

// POST /api/projects/:id/shares { email, role } — invite a collaborator.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const { id } = await params;
  if (!(await isOwner(user.id, id))) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  const { email, role } = (await request.json()) as { email?: string; role?: string };
  const normalizedEmail = (email ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
    return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  if (normalizedEmail === user.email.toLowerCase()) {
    return Response.json({ error: "You already own this project." }, { status: 400 });
  }
  const shareRole = role === 'editor' ? 'editor' : 'viewer';

  // Resolve the invitee to an existing user id when possible (better-auth's
  // user table), so access works immediately on their next request.
  const [invitee] = await sql`SELECT id FROM "user" WHERE lower(email) = ${normalizedEmail} LIMIT 1`;

  const [share] = await sql`
    INSERT INTO project_shares (project_id, owner_id, shared_with_email, shared_with_user_id, role)
    VALUES (${id}, ${user.id}, ${normalizedEmail}, ${invitee?.id ?? null}, ${shareRole})
    ON CONFLICT (project_id, shared_with_email) DO UPDATE SET
      role = EXCLUDED.role,
      shared_with_user_id = COALESCE(EXCLUDED.shared_with_user_id, project_shares.shared_with_user_id)
    RETURNING id, shared_with_email, role, created_at
  `;
  return Response.json({ share });
}

// DELETE /api/projects/:id/shares?shareId=... — revoke a collaborator.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const { id } = await params;
  if (!(await isOwner(user.id, id))) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }
  const shareId = new URL(request.url).searchParams.get('shareId');
  if (!shareId) return Response.json({ error: 'shareId required' }, { status: 400 });
  await sql`DELETE FROM project_shares WHERE id = ${shareId} AND project_id = ${id}`;
  return Response.json({ success: true });
}
