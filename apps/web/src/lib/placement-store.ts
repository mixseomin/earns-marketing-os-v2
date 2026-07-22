import { readFile } from 'node:fs/promises';

// Saved inbox-vs-spam placement per domain, written by the box measure script (both channels).
// Persisted so the UI shows it without re-measuring every load — re-measure only on demand.
export interface Placement { inbox: number; spam: number; missing: number; seeds: number; channel: string; date: string }

const FILE = process.env.PLACEMENT_FILE || '/opt/earns-marketing-os-v2/.placement.json';

export async function readPlacement(): Promise<Record<string, Placement>> {
  try { const j = JSON.parse(await readFile(FILE, 'utf8')); return j && typeof j === 'object' ? j : {}; }
  catch { return {}; }
}
