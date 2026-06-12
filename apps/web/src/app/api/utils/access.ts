import sql from '@/app/api/utils/sql';

export type ProjectRole = 'owner' | 'editor' | 'viewer';

// Pure role decision: ownership wins; otherwise the share role (if any).
export function roleFrom(isOwner: boolean, shareRole: string | null): ProjectRole | null {
  if (isOwner) return 'owner';
  if (shareRole === 'editor') return 'editor';
  if (shareRole === 'viewer') return 'viewer';
  return null;
}

export function canEdit(role: ProjectRole | null): boolean {
  return role === 'owner' || role === 'editor';
}

// Resolve the caller's effective role on a project: owner (projects.user_id),
// or a share grant matching their user id or email.
export async function resolveProjectRole(
  userId: string,
  email: string,
  projectId: string
): Promise<ProjectRole | null> {
  const [proj] = await sql`SELECT user_id FROM projects WHERE id = ${projectId}`;
  if (!proj) return null;
  if (proj.user_id === userId) return 'owner';

  const [share] = await sql`
    SELECT role FROM project_shares
    WHERE project_id = ${projectId}
      AND (shared_with_user_id = ${userId} OR lower(shared_with_email) = lower(${email}))
    ORDER BY CASE role WHEN 'editor' THEN 0 ELSE 1 END
    LIMIT 1
  `;
  return roleFrom(false, share?.role ?? null);
}
