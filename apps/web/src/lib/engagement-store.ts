import { readFile } from 'node:fs/promises';

// List engagement summary for the militarycalc list, written hourly by the box worker
// (engagement-summary.mjs): tiers from the Mailjet engagement pull + live drip open/click/bounce
// from Mailjet statcounters. Read-only view for the deliverability card — no per-load Mailjet calls.
export interface EngagementSummary {
  list: string;
  updatedAt: string;
  total: number;
  sendable: number;
  engaged: number;
  engagedPct: number;
  tiers: { hot: number; warm: number; cold: number };
  suppressed: number;
  unsubProcessed?: number;
  drip: {
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
}

const FILE = process.env.ENGAGEMENT_FILE || '/opt/earns-marketing-os-v2/.engagement-summary.json';

export async function readEngagement(): Promise<EngagementSummary | null> {
  try {
    const j = JSON.parse(await readFile(FILE, 'utf8'));
    return j && typeof j === 'object' && j.total ? j : null;
  } catch {
    return null;
  }
}
