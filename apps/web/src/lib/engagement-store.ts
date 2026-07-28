import { readFile } from 'node:fs/promises';

// Multi-list email engagement summary, written hourly by the box worker (engagement-summary.mjs):
// every Mailjet contact list (militarycalc keeps rich tiers + live drip; other lists = subscriber
// count) plus beehiiv publications (open/click/sent). Read-only view for the deliverability card —
// no per-load Mailjet/beehiiv calls.
export interface ListSummary {
  source: 'mailjet' | 'beehiiv';
  list: string;
  total: number;
  sendable: number;
  // rich (militarycalc engaged drip)
  engaged?: number;
  engagedPct?: number;
  tiers?: { hot: number; warm: number; cold: number };
  suppressed?: number;
  unsubProcessed?: number;
  drip?: {
    campaign: string;
    sent: number;
    target: number;
    processed?: number | null;
    delivered?: number | null;
    opened?: number;
    clicked?: number;
    bounced?: number;
    blocked?: number;
    spam?: number;
    unsub?: number;
    error?: string;
  };
  // beehiiv publication stats
  openRate?: number | null;
  clickRate?: number | null;
  sent?: number;
}

export interface EngagementSummary {
  updatedAt: string;
  lists: ListSummary[];
}

const FILE = process.env.ENGAGEMENT_FILE || '/opt/earns-marketing-os-v2/.engagement-summary.json';

export async function readEngagement(): Promise<EngagementSummary | null> {
  try {
    const j = JSON.parse(await readFile(FILE, 'utf8'));
    if (j && Array.isArray(j.lists)) return j;
    // ponytail: back-compat with the old single-object format (pre multi-list writer)
    if (j && typeof j === 'object' && j.total) {
      const { updatedAt, ...rest } = j;
      return { updatedAt, lists: [{ source: 'mailjet', ...rest }] };
    }
    return null;
  } catch {
    return null;
  }
}
