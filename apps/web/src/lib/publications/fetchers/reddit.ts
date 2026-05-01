import type { FetchResult } from '../types';

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getRedditToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  try {
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': process.env.REDDIT_USER_AGENT ?? 'mos2-monitor/1.0',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { access_token: string; expires_in: number };
    cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return cachedToken.token;
  } catch { return null; }
}

export async function fetchReddit(url: string, lastActivityAt: string | null): Promise<FetchResult> {
  const idMatch = /\/comments\/([a-z0-9]+)/i.exec(url);
  if (!idMatch) throw new Error('Cannot extract Reddit post ID from URL');
  const postId = idMatch[1];
  const token = await getRedditToken();
  const apiUrl = `https://${token ? 'oauth' : 'www'}.reddit.com/comments/${postId}.json?limit=100&sort=new`;
  const headers: HeadersInit = { 'User-Agent': process.env.REDDIT_USER_AGENT ?? 'mos2-monitor/1.0' };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

  const res = await fetch(apiUrl, { headers, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Reddit API ${res.status}`);
  const data = await res.json() as unknown[];

  type PostData = { title: string; score: number; num_comments: number };
  type CommentData = { id: string; author: string; body: string; permalink: string; created_utc: number; deleted?: boolean };
  const postData = (data[0] as { data: { children: Array<{ data: PostData }> } })?.data?.children?.[0]?.data;
  const comments = (data[1] as { data: { children: Array<{ data: CommentData }> } })?.data?.children ?? [];

  const sinceDate = lastActivityAt ? new Date(lastActivityAt) : null;
  const newActivities: FetchResult['newActivities'] = [];
  let latestTs = sinceDate;

  for (const child of comments) {
    const c = child.data;
    if (!c.id || c.author === '[deleted]' || c.author === 'AutoModerator') continue;
    const ts = new Date(c.created_utc * 1000);
    if (sinceDate && ts <= sinceDate) continue;
    if (!latestTs || ts > latestTs) latestTs = ts;
    newActivities.push({
      externalId: c.id,
      author: c.author,
      contentSnippet: (c.body ?? '').slice(0, 300),
      activityUrl: `https://reddit.com${c.permalink}`,
      publishedAt: ts.toISOString(),
    });
  }

  return {
    title: postData?.title,
    score: postData?.score,
    replyCount: postData?.num_comments,
    lastActivityAt: latestTs?.toISOString(),
    newActivities,
  };
}
