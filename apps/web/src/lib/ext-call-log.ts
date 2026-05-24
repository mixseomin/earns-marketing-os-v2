// Helper logger cho /api/ext/* endpoints. Insert vào ext_call_log (mig 0062).
// Best-effort: log fail không block response.

import 'server-only';
import { getDb, extCallLog } from '@mos2/db';

export interface LogEntry {
  endpoint: string;        // 'learn-selectors' | 'habitats' | ...
  method: 'GET' | 'POST';
  extVersion?: string | null;
  pageUrl?: string | null;
  payloadMeta?: Record<string, unknown>;
  responseMeta?: Record<string, unknown>;
  status?: number;
  durationMs?: number;
  errorMsg?: string;
}

export async function logExtCall(entry: LogEntry): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.insert(extCallLog).values({
      endpoint: entry.endpoint,
      method: entry.method,
      extVersion: entry.extVersion ?? null,
      pageUrl: entry.pageUrl ?? null,
      payloadMeta: entry.payloadMeta ?? {},
      responseMeta: entry.responseMeta ?? {},
      status: entry.status ?? null,
      durationMs: entry.durationMs ?? null,
      errorMsg: entry.errorMsg ?? null,
    });
  } catch (e) {
    console.warn('[logExtCall] failed:', (e as Error).message);
  }
}

// Helper: extract version + page URL từ request headers
export function extractExtMeta(req: Request): { extVersion: string | null; pageUrl: string | null } {
  return {
    extVersion: req.headers.get('x-ext-version'),
    pageUrl: req.headers.get('x-page-url'),
  };
}
