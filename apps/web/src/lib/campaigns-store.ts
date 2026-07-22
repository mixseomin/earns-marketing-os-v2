import { readFile, writeFile } from 'node:fs/promises';

// MailWizz's API doesn't return campaign HTML on read, so we keep a copy of what MOS2 created
// (keyed by campaign_uid) purely for previewing. Untracked file (survives GHA reset --hard).
export interface StoredCampaign { name: string; subject: string; fromName: string; fromEmail: string; html: string; offers?: Array<{ label: string; url: string; interest: string }> }

const FILE = process.env.CAMPAIGNS_FILE || '/opt/earns-marketing-os-v2/.campaigns.json';

export async function readCampaigns(): Promise<Record<string, StoredCampaign>> {
  try { const j = JSON.parse(await readFile(FILE, 'utf8')); return j && typeof j === 'object' ? j : {}; }
  catch { return {}; }
}
export async function saveCampaign(uid: string, c: StoredCampaign): Promise<void> {
  const all = await readCampaigns();
  all[uid] = c;
  await writeFile(FILE, JSON.stringify(all, null, 2));
}
export async function deleteCampaign(uid: string): Promise<void> {
  const all = await readCampaigns();
  if (all[uid]) { delete all[uid]; await writeFile(FILE, JSON.stringify(all, null, 2)); }
}
