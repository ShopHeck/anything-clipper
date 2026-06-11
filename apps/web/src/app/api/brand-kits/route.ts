import { getApiUser, unauthorized } from '@/app/api/utils/auth';
import sql from '@/app/api/utils/sql';

const POSITIONS = new Set(['tl', 'tr', 'bl', 'br']);
const HEX = /^#[0-9a-fA-F]{6}$/;

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  try {
    const kits = await sql`
      SELECT id, name, logo_url, logo_position, caption_color, is_default, created_at
      FROM brand_kits WHERE user_id = ${user.id}
      ORDER BY is_default DESC, created_at DESC
    `;
    return Response.json({ brandKits: kits });
  } catch (err) {
    console.error('List brand kits error:', err);
    return Response.json({ error: 'Failed to list brand kits' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'My Brand';
    const logoUrl = typeof body.logoUrl === 'string' ? body.logoUrl : null;
    const position = POSITIONS.has(body.logoPosition) ? body.logoPosition : 'br';
    const captionColor = HEX.test(body.captionColor ?? '') ? body.captionColor : null;
    const isDefault = Boolean(body.isDefault);

    if (isDefault) {
      await sql`UPDATE brand_kits SET is_default = FALSE WHERE user_id = ${user.id}`;
    }

    const [kit] = await sql`
      INSERT INTO brand_kits (user_id, name, logo_url, logo_position, caption_color, is_default)
      VALUES (${user.id}, ${name}, ${logoUrl}, ${position}, ${captionColor}, ${isDefault})
      RETURNING id, name, logo_url, logo_position, caption_color, is_default, created_at
    `;
    return Response.json({ brandKit: kit });
  } catch (err) {
    console.error('Create brand kit error:', err);
    return Response.json({ error: 'Failed to create brand kit' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return Response.json({ error: 'id required' }, { status: 400 });
    await sql`DELETE FROM brand_kits WHERE id = ${id} AND user_id = ${user.id}`;
    return Response.json({ success: true });
  } catch (err) {
    console.error('Delete brand kit error:', err);
    return Response.json({ error: 'Failed to delete brand kit' }, { status: 500 });
  }
}
