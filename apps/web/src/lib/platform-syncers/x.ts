import type { PlatformSyncer, SyncerInput, SyncerResult } from './types';

// X / Twitter API v2. Token = OAuth 2.0 Bearer token (User Context).
// /2/users/me trả authenticated user. user.fields có thể request thêm
// public_metrics (followers/following), verified, created_at, description...
//
// Free tier API v2 cho phép /me read OK. Rate limit thấp: 25 req/24h.

const API_BASE = 'https://api.twitter.com/2';

const USER_FIELDS = [
  'id', 'name', 'username', 'created_at',
  'description', 'location', 'url',
  'profile_image_url', 'protected', 'verified', 'verified_type',
  'public_metrics', 'entities',
].join(',');

export const xSyncer: PlatformSyncer = {
  platformKey: 'x',
  label: 'X (Twitter)',
  async fetch(input: SyncerInput): Promise<SyncerResult> {
    const headers = {
      Authorization: `Bearer ${input.token}`,
    };
    try {
      const res = await fetch(`${API_BASE}/users/me?user.fields=${USER_FIELDS}`, { headers });
      if (!res.ok) {
        return { ok: false, error: `X /users/me ${res.status}: ${await res.text().catch(() => '?')}` };
      }
      const json = await res.json() as { data?: Record<string, unknown>; errors?: unknown };
      const u = json.data;
      if (!u) {
        return { ok: false, error: `X API: no data — ${JSON.stringify(json.errors ?? {})}` };
      }
      const metrics = u.public_metrics as Record<string, number> | undefined;
      const avatar = u.profile_image_url ? String(u.profile_image_url).replace('_normal', '_400x400') : null;
      return {
        ok: true,
        profile: {
          externalId: u.id != null ? String(u.id) : null,
          handle: u.username ? String(u.username) : null,
          email: null,                       // X API v2 không expose email
          displayName: u.name ? String(u.name) : null,
          avatarUrl: avatar,
          verified: typeof u.verified === 'boolean' ? u.verified : null,
          mfaEnabled: null,
          tier: u.verified_type ? String(u.verified_type) : null,   // 'blue' | 'business' | 'government'
          followerCount: metrics?.followers_count ?? null,
          followingCount: metrics?.following_count ?? null,
          extra: {
            description: u.description,
            location: u.location,
            url: u.url,
            createdAt: u.created_at,
            protected: u.protected,
            tweetCount: metrics?.tweet_count,
            listedCount: metrics?.listed_count,
            entities: u.entities,
          },
        },
      };
    } catch (e) {
      return { ok: false, error: `X fetch error: ${(e as Error).message}` };
    }
  },
};
