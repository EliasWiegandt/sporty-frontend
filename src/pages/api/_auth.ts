export type RuntimeEnv = {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
};

export type AuthUser = {
  id: string;
  email?: string | null;
};

export function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

export async function verifySupabaseToken(request: Request, env: RuntimeEnv): Promise<AuthUser | null> {
  const token = getBearerToken(request);
  if (!token) return null;
  const supabaseUrl = env.SUPABASE_URL;
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) return null;

  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return null;
  const user = (await response.json()) as { id?: string; email?: string | null };
  if (!user || !user.id) return null;
  return { id: user.id, email: user.email ?? null };
}
