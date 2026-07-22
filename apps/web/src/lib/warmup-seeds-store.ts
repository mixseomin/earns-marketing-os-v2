import { readFile, writeFile, chmod } from 'node:fs/promises';

// Seed inboxes used to warm sending domains: the worker sends to them, then over IMAP
// measures Inbox-vs-Spam placement and pushes positive signals (move-out-of-spam, reply,
// mark-read). Creds live in an untracked, 0600 box file (survives GHA reset --hard).
export interface WarmupSeed {
  id: string;
  provider: 'gmail' | 'outlook' | 'yahoo' | 'other';
  email: string;
  imapHost: string; imapPort: number;
  smtpHost: string; smtpPort: number;
  user: string; pass: string;   // pass = app-password
  active?: boolean;
}

const FILE = process.env.WARMUP_SEEDS_FILE || '/opt/earns-marketing-os-v2/.warmup-seeds.json';

export async function readSeeds(): Promise<WarmupSeed[]> {
  try { const j = JSON.parse(await readFile(FILE, 'utf8')); return Array.isArray(j) ? j : []; }
  catch { return []; }
}
export async function writeSeeds(list: WarmupSeed[]): Promise<void> {
  await writeFile(FILE, JSON.stringify(list, null, 2));
  try { await chmod(FILE, 0o600); } catch { /* best-effort perms */ }
}
