import type { FetchResult } from '../types';

export function parseRss(xml: string, sinceDate: Date | null, baseUrl: string): FetchResult {
  const items: FetchResult['newActivities'] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  let latestTs = sinceDate;

  const titleMatch = xml.match(/<channel>[\s\S]*?<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i);
  const title = titleMatch?.[1]?.trim();

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]!;
    const get = (tag: string): string | null => {
      const m = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i').exec(block);
      return m?.[1]?.trim() ?? null;
    };
    const pubDateStr = get('pubDate') ?? get('dc:date');
    const pubDate = pubDateStr ? new Date(pubDateStr) : null;
    if (!pubDate || isNaN(pubDate.getTime())) continue;
    if (sinceDate && pubDate <= sinceDate) continue;
    if (!latestTs || pubDate > latestTs) latestTs = pubDate;

    const guid = get('guid') ?? get('link') ?? `${baseUrl}-${pubDate.getTime()}`;
    const author = get('author') ?? get('dc:creator') ?? 'unknown';
    const description = (get('description') ?? '').replace(/<[^>]+>/g, '').slice(0, 300).trim();
    const link = get('link') ?? baseUrl;

    items.push({ externalId: guid, author, contentSnippet: description, activityUrl: link, publishedAt: pubDate.toISOString() });
  }

  return {
    title,
    newActivities: items.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt)),
    lastActivityAt: latestTs?.toISOString(),
  };
}

export async function fetchRss(url: string, lastActivityAt: string | null): Promise<FetchResult> {
  const sinceDate = lastActivityAt ? new Date(lastActivityAt) : null;
  // Try {url}.rss, {url}?format=rss, {url}/feed, url as-is if ends with rss/xml
  const candidates = url.match(/\.(rss|xml)$/i)
    ? [url]
    : [`${url.replace(/\/$/, '')}.rss`, `${url.replace(/\/$/, '')}?format=rss`, `${url.replace(/\/$/, '')}/feed`];

  for (const rssUrl of candidates) {
    try {
      const res = await fetch(rssUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MOS2-Monitor/1.0)', 'Accept': 'application/rss+xml, text/xml, */*' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.includes('xml') && !ct.includes('rss')) continue;
      const xml = await res.text();
      if (!xml.includes('<item')) continue;
      return parseRss(xml, sinceDate, url);
    } catch { continue; }
  }
  throw new Error('No RSS feed found for URL');
}
