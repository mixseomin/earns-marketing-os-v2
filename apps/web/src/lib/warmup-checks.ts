// Server-only helpers fetching public metrics for platform_accounts in
// `warming` state. Mapped to platforms.checklist items having `auto` flag
// (set in migration 0017_warmup_auto_flags).
//
// Reddit: needs OAuth (server IPs blocked, see memory reference_reddit_oauth).
// HackerNews: public Firebase API.
// Bluesky: public AppView API (no auth needed).

import 'server-only';

const REDDIT_TOKEN_TTL_MS = 50 * 60 * 1000;  // refresh 10 min before expiry
let redditToken: { value: string; expiresAt: number } | null = null;

async function getRedditToken(): Promise<string | null> {
  if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) return null;
  if (redditToken && redditToken.expiresAt > Date.now()) return redditToken.value;

  const auth = Buffer.from(
    `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`,
  ).toString('base64');
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': process.env.REDDIT_USER_AGENT || 'mos2-warmup/1.0',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`reddit token http ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  redditToken = { value: data.access_token, expiresAt: Date.now() + REDDIT_TOKEN_TTL_MS };
  return data.access_token;
}

async function fetchRedditUser(handle: string): Promise<{ link_karma: number; comment_karma: number; total_karma?: number; created_utc: number; name: string } | null> {
  const token = await getRedditToken();
  if (!token) throw new Error('REDDIT_CLIENT_ID/SECRET not configured');
  const clean = handle.replace(/^u\//i, '').replace(/^@/, '');
  const res = await fetch(`https://oauth.reddit.com/user/${clean}/about`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': process.env.REDDIT_USER_AGENT || 'mos2-warmup/1.0',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`reddit user http ${res.status}`);
  const data = (await res.json()) as { data: { link_karma: number; comment_karma: number; total_karma?: number; created_utc: number; name: string } };
  return data.data;
}

// HackerNews: https://github.com/HackerNews/API
async function fetchHNUser(handle: string): Promise<{ karma: number; created: number; id: string } | null> {
  const clean = handle.replace(/^@/, '');
  const res = await fetch(`https://hacker-news.firebaseio.com/v0/user/${clean}.json`);
  if (!res.ok) throw new Error(`hn user http ${res.status}`);
  const data = (await res.json()) as { karma: number; created: number; id: string } | null;
  return data;
}

// Bluesky AppView: https://docs.bsky.app/docs/api/app-bsky-actor-get-profile
async function fetchBlueskyProfile(handle: string): Promise<{ followersCount: number; followsCount: number; postsCount: number; handle: string } | null> {
  const clean = handle.replace(/^@/, '');
  const res = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(clean)}`);
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`bluesky profile http ${res.status}`);
  const data = (await res.json()) as { followersCount: number; followsCount: number; postsCount: number; handle: string };
  return data;
}

// Single-source-of-truth: map auto key → fetcher producing { value, target? }.
// `auto` keys are set in DB migration 0017_warmup_auto_flags.
export interface AutoFetchResult {
  ok: boolean;
  value?: number | string;
  error?: string;
}

export async function runAutoFetch(autoKey: string, handle: string | null): Promise<AutoFetchResult> {
  if (!handle) return { ok: false, error: 'account chưa có handle' };
  try {
    switch (autoKey) {
      case 'reddit-karma': {
        const u = await fetchRedditUser(handle);
        if (!u) return { ok: false, error: 'Reddit user not found' };
        return { ok: true, value: (u.total_karma ?? u.link_karma + u.comment_karma) };
      }
      case 'reddit-age': {
        const u = await fetchRedditUser(handle);
        if (!u) return { ok: false, error: 'Reddit user not found' };
        const days = Math.floor((Date.now() / 1000 - u.created_utc) / 86400);
        return { ok: true, value: days };
      }
      case 'reddit-comments': {
        const token = await getRedditToken();
        if (!token) return { ok: false, error: 'REDDIT_CLIENT_ID not set' };
        const clean = handle.replace(/^u\//i, '').replace(/^@/, '');
        const res = await fetch(`https://oauth.reddit.com/user/${clean}/comments?limit=10`, {
          headers: { Authorization: `Bearer ${token}`, 'User-Agent': process.env.REDDIT_USER_AGENT || 'mos2-warmup/1.0' },
        });
        if (!res.ok) return { ok: false, error: `reddit comments http ${res.status}` };
        const data = (await res.json()) as { data: { children: unknown[] } };
        return { ok: true, value: data.data.children.length };
      }
      case 'hn-karma': {
        const u = await fetchHNUser(handle);
        if (!u) return { ok: false, error: 'HN user not found' };
        return { ok: true, value: u.karma };
      }
      case 'hn-age': {
        const u = await fetchHNUser(handle);
        if (!u) return { ok: false, error: 'HN user not found' };
        const days = Math.floor((Date.now() / 1000 - u.created) / 86400);
        return { ok: true, value: days };
      }
      case 'bluesky-followers': {
        const p = await fetchBlueskyProfile(handle);
        if (!p) return { ok: false, error: 'Bluesky profile not found' };
        return { ok: true, value: p.followersCount };
      }
      case 'bluesky-posts': {
        const p = await fetchBlueskyProfile(handle);
        if (!p) return { ok: false, error: 'Bluesky profile not found' };
        return { ok: true, value: p.postsCount };
      }
      default:
        return { ok: false, error: `unknown auto key: ${autoKey}` };
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
