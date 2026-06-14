// Server-only: mint GSC access tokens from a refresh_token. Caches the token
// in module scope for its TTL so repeated API calls within ~1h reuse it.

const CACHE: { token: string | null; exp: number } = { token: null, exp: 0 };

export async function getGscAccessToken(): Promise<string | null> {
  const now = Date.now();
  if (CACHE.token && CACHE.exp > now + 30_000) return CACHE.token;

  const id = process.env.GSC_CLIENT_ID;
  const secret = process.env.GSC_CLIENT_SECRET;
  const refresh = process.env.GSC_REFRESH_TOKEN;
  if (!id || !secret || !refresh) return null;

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      refresh_token: refresh,
      grant_type: 'refresh_token',
    }).toString(),
  });
  if (!r.ok) return null;
  const j = await r.json();
  CACHE.token = j.access_token;
  CACHE.exp = now + (j.expires_in || 3600) * 1000;
  return CACHE.token;
}
