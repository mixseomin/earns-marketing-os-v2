import { readFile, writeFile } from 'node:fs/promises';

// Tracked sending/monitored domains for the deliverability table. Untracked file on the box
// (survives GHA reset --hard). The mail-tester cron reads the same file.
export interface TrackedDomain { domain: string; dkimSelector?: string; listUid?: string; send?: boolean }

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
