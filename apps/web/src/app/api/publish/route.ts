import sql from '@/app/api/utils/sql';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    let jobs;
    if (projectId) {
      jobs = await sql`
        SELECT pj.*, c.title as clip_title, c.score as clip_score, c.platforms as clip_platforms
        FROM publish_jobs pj
        LEFT JOIN clips c ON c.id = pj.clip_id AND c.project_id = pj.project_id
        WHERE pj.project_id = ${projectId}
        ORDER BY pj.created_at DESC
      `;
    } else {
      jobs = await sql`
        SELECT pj.*, c.title as clip_title, c.score as clip_score
        FROM publish_jobs pj
        LEFT JOIN clips c ON c.id = pj.clip_id AND c.project_id = pj.project_id
        ORDER BY pj.created_at DESC
        LIMIT 100
      `;
    }

    return Response.json({ jobs });
  } catch (error) {
    console.error('List publish jobs error:', error);
    return Response.json({ error: 'Failed to list publish jobs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clip_id, project_id, platform, caption, hashtags, scheduled_at } = body;

    if (!clip_id || !project_id || !platform) {
      return Response.json(
        { error: 'clip_id, project_id, and platform are required' },
        { status: 400 }
      );
    }

    const [job] = await sql`
      INSERT INTO publish_jobs (clip_id, project_id, platform, caption, hashtags, scheduled_at, status)
      VALUES (${clip_id}, ${project_id}, ${platform}, ${caption || null}, ${hashtags || []}, ${scheduled_at || null}, ${scheduled_at ? 'scheduled' : 'queued'})
      RETURNING *
    `;

    return Response.json({ job });
  } catch (error) {
    console.error('Create publish job error:', error);
    return Response.json({ error: 'Failed to create publish job' }, { status: 500 });
  }
}
