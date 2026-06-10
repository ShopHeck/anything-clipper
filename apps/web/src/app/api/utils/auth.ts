import { auth } from '@/lib/auth';

export interface ApiUser {
  id: string;
  email: string;
  name: string | null;
}

// Resolve the signed-in user from a route handler request. Works for both
// cookie sessions (web) and Authorization: Bearer tokens (mobile, via
// better-auth's bearer plugin).
export async function getApiUser(request: Request): Promise<ApiUser | null> {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return null;
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name ?? null,
    };
  } catch (err) {
    console.error('getApiUser: session lookup failed:', err);
    return null;
  }
}

export function unauthorized(): Response {
  return Response.json({ error: 'Sign in to use this feature.' }, { status: 401 });
}
