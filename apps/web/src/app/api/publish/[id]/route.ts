import sql from '@/app/api/utils/sql';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, platform_url, error_msg } = body;

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (status !== undefined) {
      setClauses.push(`status = $${idx++}`);
      values.push(status);
      if (status === 'published') {
        setClauses.push(`published_at = NOW()`);
      }
    }
    if (platform_url !== undefined) {
      setClauses.push(`platform_url = $${idx++}`);
      values.push(platform_url);
    }
    if (error_msg !== undefined) {
      setClauses.push(`error_msg = $${idx++}`);
      values.push(error_msg);
    }

    if (setClauses.length === 0) {
      return Response.json({ error: 'Nothing to update' }, { status: 400 });
    }

    values.push(id);
    const [job] = await sql(
      `UPDATE publish_jobs SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    return Response.json({ job });
  } catch (error) {
    console.error('Update publish job error:', error);
    return Response.json({ error: 'Failed to update publish job' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await sql`DELETE FROM publish_jobs WHERE id = ${id}`;
    return Response.json({ success: true });
  } catch (error) {
    console.error('Delete publish job error:', error);
    return Response.json({ error: 'Failed to delete publish job' }, { status: 500 });
  }
}
