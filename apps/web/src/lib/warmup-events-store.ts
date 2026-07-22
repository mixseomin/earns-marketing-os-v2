import { readFile, writeFile } from 'node:fs/promises';

// Append-only daily warm-up metrics per domain, written by the box worker, read by the UI
// to draw the placement trend + decide graduation. Untracked box file.
export interface WarmupEvent {
  domain: string;
  date: string;        // YYYY-MM-DD (UTC)
  dayIdx: number;      // ramp day (0-based)
  sentSeeds: number;
  sentReal: number;    // real subscribers warmed this day (0 if seed-only)
  inbox: number;       // seeds that landed in Inbox
  spam: number;        // seeds that landed in Spam/Junk
  placementPct: number; // inbox / (inbox+spam) * 100
  moved: number;       // seeds pulled out of spam this run
  replied: number;     // seeds that replied
  graduated?: boolean;
  note?: string;
}

const FILE = process.env.WARMUP_EVENTS_FILE || '/opt/earns-marketing-os-v2/.warmup-events.json';

export async function readEvents(): Promise<WarmupEvent[]> {
  try { const j = JSON.parse(await readFile(FILE, 'utf8')); return Array.isArray(j) ? j : []; }
  catch { return []; }
}
export async function appendEvent(e: WarmupEvent): Promise<void> {
  const all = await readEvents();
  all.push(e);
  await writeFile(FILE, JSON.stringify(all, null, 2));
}
