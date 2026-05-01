export interface Publication {
  id: number;
  projectId: string;
  url: string;
  title: string | null;
  platformKey: string;
  accountId: number | null;
  publishedAt: string | null;
  lastCheckedAt: string | null;
  lastActivityAt: string | null;
  checkIntervalHours: number;
  nextCheckAt: string | null;
  replyCount: number;
  viewCount: number | null;
  score: number | null;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PublicationActivity {
  id: number;
  publicationId: number;
  detectedAt: string;
  activityType: string;
  externalId: string | null;
  author: string | null;
  contentSnippet: string | null;
  activityUrl: string | null;
  humanTaskId: number | null;
  createdAt: string;
}

export interface FetchResult {
  title?: string;
  replyCount?: number;
  viewCount?: number;
  score?: number;
  lastActivityAt?: string;
  newActivities: Array<{
    externalId: string;
    author: string;
    contentSnippet: string;
    activityUrl: string;
    publishedAt: string;
  }>;
}

export const PLATFORM_CONFIGS: Record<string, { label: string; icon: string; defaultIntervalHours: number; evergreen: boolean }> = {
  xenforo:       { label: 'XenForo Forum', icon: '🏛️', defaultIntervalHours: 6,  evergreen: true },
  reddit:        { label: 'Reddit',        icon: '🟠', defaultIntervalHours: 1,  evergreen: false },
  hackernews:    { label: 'Hacker News',   icon: '🔶', defaultIntervalHours: 2,  evergreen: false },
  linkedin:      { label: 'LinkedIn',      icon: '💼', defaultIntervalHours: 24, evergreen: false },
  generic_forum: { label: 'Forum',         icon: '📋', defaultIntervalHours: 12, evergreen: true },
};

export function detectPlatform(url: string): string {
  if (/reddit\.com/i.test(url)) return 'reddit';
  if (/news\.ycombinator\.com/i.test(url)) return 'hackernews';
  if (/linkedin\.com\/posts?\//i.test(url)) return 'linkedin';
  if (/\/threads\/[\w-]+\.\d+\/?/.test(url)) return 'xenforo';
  if (/viewthread|showthread|forumdisplay|thread\.php/i.test(url)) return 'generic_forum';
  return 'generic_forum';
}
