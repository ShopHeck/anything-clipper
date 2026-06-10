import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import sql from '@/app/api/utils/sql';

// Every handler verifies the project belongs to the signed-in user before
// touching it (or any of its child rows).
async function ownsProject(userId: string, projectId: string): Promise<boolean> {
  const [row] = await sql`
    SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${userId}
  `;
  return Boolean(row);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  try {
    const { id } = await params;

    const [project] = await sql`
      SELECT id, title, file_name, file_url, storage_key, total_duration, viral_score,
             word_count, clip_count, status, created_at, updated_at
      FROM projects WHERE id = ${id} AND user_id = ${user.id}
    `;

    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    const segments = await sql`
      SELECT id, start_time, end_time, segment_text, is_highlight, is_deleted, viral_score, sort_order
      FROM transcript_segments
      WHERE project_id = ${id}
      ORDER BY sort_order ASC
    `;

    const clips = await sql`
      SELECT id, title, hook, score, platforms, start_time, end_time, duration_label,
             reason, thumbnail, rendered_url, render_status, created_at
      FROM clips
      WHERE project_id = ${id}
      ORDER BY created_at ASC
    `;

    return Response.json({ project, segments, clips });
  } catch (error) {
    console.error('Get project error:', error);
    return Response.json({ error: 'Failed to get project' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    if (!(await ownsProject(user.id, id))) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      title,
      file_url,
      total_duration,
      viral_score,
      word_count,
      clip_count,
      status,
      segments,
      clips,
    } = body;

    // Build dynamic update
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (title !== undefined) {
      setClauses.push(`title = $${idx++}`);
      values.push(title);
    }
    if (file_url !== undefined) {
      setClauses.push(`file_url = $${idx++}`);
      values.push(file_url);
    }
    if (total_duration !== undefined) {
      setClauses.push(`total_duration = $${idx++}`);
      values.push(total_duration);
    }
    if (viral_score !== undefined) {
      setClauses.push(`viral_score = $${idx++}`);
      values.push(viral_score);
    }
    if (word_count !== undefined) {
      setClauses.push(`word_count = $${idx++}`);
      values.push(word_count);
    }
    if (clip_count !== undefined) {
      setClauses.push(`clip_count = $${idx++}`);
      values.push(clip_count);
    }
    if (status !== undefined) {
      setClauses.push(`status = $${idx++}`);
      values.push(status);
    }

    setClauses.push(`updated_at = NOW()`);

    if (setClauses.length > 1) {
      values.push(id);
      await sql(`UPDATE projects SET ${setClauses.join(', ')} WHERE id = $${idx}`, values);
    }

    // Upsert segments if provided
    if (segments && segments.length > 0) {
      // Delete existing and re-insert
      await sql`DELETE FROM transcript_segments WHERE project_id = ${id}`;
      for (const seg of segments) {
        await sql`
          INSERT INTO transcript_segments (id, project_id, start_time, end_time, segment_text, is_highlight, is_deleted, viral_score, sort_order)
          VALUES (${seg.id}, ${id}, ${seg.start}, ${seg.end}, ${seg.text}, ${seg.highlight ?? false}, ${seg.deleted ?? false}, ${seg.viralScore ?? 65}, ${seg.sortOrder ?? 0})
        `;
      }
    }

    // Upsert clips if provided
    if (clips && clips.length > 0) {
      await sql`DELETE FROM clips WHERE project_id = ${id}`;
      for (const clip of clips) {
        await sql`
          INSERT INTO clips (id, project_id, title, hook, score, platforms, start_time, end_time, duration_label, reason, thumbnail)
          VALUES (${clip.id}, ${id}, ${clip.title}, ${clip.hook}, ${clip.score ?? 75}, ${clip.platforms ?? []}, ${clip.start ?? 0}, ${clip.end ?? 0}, ${clip.duration ?? '0:00'}, ${clip.reason ?? ''}, ${clip.thumbnail ?? ''})
        `;
      }
      // Update clip count
      await sql`UPDATE projects SET clip_count = ${clips.length} WHERE id = ${id}`;
    }

    const [updated] = await sql`SELECT * FROM projects WHERE id = ${id}`;
    return Response.json({ project: updated });
  } catch (error) {
    console.error('Update project error:', error);
    return Response.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    await sql`DELETE FROM projects WHERE id = ${id} AND user_id = ${user.id}`;
    return Response.json({ success: true });
  } catch (error) {
    console.error('Delete project error:', error);
    return Response.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
