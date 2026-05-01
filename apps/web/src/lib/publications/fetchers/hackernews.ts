import type { FetchResult } from '../types';

export async function fetchHackerNews(url: string, lastActivityAt: string | null): Promise<FetchResult> {
  const idMatch = /item\?id=(\d+)/.exec(url);
  if (!idMatch) throw new Error('Cannot extract HN item ID');
  const itemId = idMatch[1];

  const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${itemId}.json`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HN API ${res.status}`);
  const item = await res.json() as { title?: string; score?: number; kids?: number[]; time?: number };

  const sinceDate = lastActivityAt ? new Date(lastActivityAt) : null;
  const newActivities: FetchResult['newActivities'] = [];
  let latestTs = sinceDate;

  const kids = (item.kids ?? []).slice(0, 30);
  await Promise.allSettled(kids.map(async (kidId) => {
    const cRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${kidId}.json`, { signal: AbortSignal.timeout(5_000) });
    if (!cRes.ok) return;
    const c = await cRes.json() as { id?: number; by?: string; text?: string; time?: number; deleted?: boolean };
    if (!c.id || !c.time || c.deleted) return;
    const ts = new Date(c.time * 1000);
    if (sinceDate && ts <= sinceDate) return;
    if (!latestTs || ts > latestTs) latestTs = ts;
    newActivities.push({
      externalId: String(c.id),
      author: c.by ?? 'unknown',
      contentSnippet: (c.text ?? '').replace(/<[^>]+>/g, '').slice(0, 300),
      activityUrl: `https://news.ycombinator.com/item?id=${c.id}`,
      publishedAt: ts.toISOString(),
    });
  }));

  return {
    title: item.title,
    score: item.score,
    replyCount: (item.kids ?? []).length,
    lastActivityAt: latestTs?.toISOString(),
    newActivities: newActivities.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt)),
  };
}
