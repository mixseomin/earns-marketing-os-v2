import { readFile, writeFile } from 'node:fs/promises';

// Tracked sending/monitored domains for the deliverability table. Untracked file on the box
// (survives GHA reset --hard). The mail-tester cron reads the same file.
export interface TrackedDomain {
  domain: string; dkimSelector?: string; listUid?: string; send?: boolean;
  warmupStart?: string; warmupCampaign?: string;
  // Automated warm-up (the box worker picks these up):
  autoWarm?: boolean;          // worker advances the ramp + engages seeds daily
  channel?: 'mailjet' | 'mailwizz'; // send transport (default mailjet)
  fromEmail?: string;          // envelope/from, default hello@<domain>
  mjListId?: string;           // optional Mailjet list id → ramp to real subscribers
  sentCursor?: number;         // real subscribers already warmed (ramp progress)
  graduatedAt?: string;        // YYYY-MM-DD set by worker when placement threshold met
}

const FILE = process.env.DOMAINS_FILE || '/opt/earns-marketing-os-v2/.domains.json';

export async function readDomains(): Promise<TrackedDomain[]> {
  try {
    const j = JSON.parse(await readFile(FILE, 'utf8'));
    return Array.isArray(j) ? j : [];
  } catch { return []; }
}
export async function writeDomains(list: TrackedDomain[]): Promise<void> {
  await writeFile(FILE, JSON.stringify(list, null, 2));
}
