import type { FetchResult } from '../types';
import { fetchRss } from './rss';
import { fetchReddit } from './reddit';
import { fetchHackerNews } from './hackernews';

export async function fetchPlatform(platform: string, url: string, lastActivityAt: string | null): Promise<FetchResult> {
  switch (platform) {
    case 'reddit': return fetchReddit(url, lastActivityAt);
    case 'hackernews': return fetchHackerNews(url, lastActivityAt);
    case 'xenforo':
    case 'generic_forum':
    case 'generic':
    default: return fetchRss(url, lastActivityAt);
  }
}
