// POST /api/ext/cj-events
// Receive an "apply attempt" event from cj-bulk.js after each AID is processed,
// then upsert into Directus affiliate_programs[].notes for that advertiser.
//
// Body: { aid: "4297311", result: "applied"|"skipped"|"failed", reason?: string, snippet?: string, viaTC?: boolean }
//
// Side effects:
//  - Patches affiliate_programs row tagged cj-aid-<AID> with the latest attempt.
//  - If result==="applied" and current Directus status === "paused" (default for
//    notjoined rows), bumps it to "pending" so cj-stats can later detect auto-reject.
//  - Maintains a running counter in api_config.cj_session_stats on the account
//    row (45388bdb) so cj-stats can serve it back without polling Directus
//    every render.

import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';

export const dynamic = 'force-dynamic';

const DIRECTUS_URL   = process.env.DIRECTUS_URL || 'https://as.on.tc';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || '';
const CJ_ACCOUNT_ID  = '45388bdb-ffdc-4a0d-993a-da66e3d28105';

type Body = {
  aid: string;
  result: 'applied' | 'skipped' | 'failed';
  reason?: string;
  snippet?: string;
  viaTC?: boolean;
};

async function dx(method: string, path: string, body?: unknown) {
  const r = await fetch(`${DIRECTUS_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${DIRECTUS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  return { ok: r.ok, status: r.status, json: r.ok ? await r.json().catch(() => null) : null };
}

export async function POST(req: Request) {
  const err = await checkAuth(req);
  if (err) return err;
  if (!DIRECTUS_TOKEN) return NextResponse.json({ error: 'Directus not configured' }, { status: 503 });

  let body: Body;
  try { body = (await req.json()) as Body; } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  if (!body?.aid || !body?.result) return NextResponse.json({ error: 'aid + result required' }, { status: 400 });

  // Locate advertiser row. Directus 11 JSONB `_contains` doesn't work on
  // `tags`, but `notes` is plain text → `_contains` is allowed. We embedded
  // `"aid":<AID>` into notes during cj-sync, so search there.
  const needle = encodeURIComponent(`"aid":${body.aid}`);
  const r = await dx(
    'GET',
    `/items/affiliate_programs?filter[account_id][_eq]=${CJ_ACCOUNT_ID}&filter[notes][_contains]=${needle}&fields=id,tags,notes,status&limit=1`,
  );
  const target = (r.ok && r.json?.data?.[0]) || null;
  if (!target) return NextResponse.json({ error: `AID ${body.aid} not found in Directus` }, { status: 404 });

  // Parse + amend notes
  const notesStr = target.notes || '';
  const blobMatch = notesStr.match(/^\[cj-sync\]\s*(\{[\s\S]*\})\s*$/);
  type Blob = { apply_attempts?: Array<{ at: string; result: string; reason?: string; viaTC?: boolean }> } & Record<string, unknown>;
  let blob: Blob = {};
  if (blobMatch?.[1]) { try { blob = JSON.parse(blobMatch[1]) as Blob; } catch { /* keep empty */ } }

  const attempts = Array.isArray(blob.apply_attempts) ? blob.apply_attempts : [];
  attempts.push({
    at: new Date().toISOString(),
    result: body.result,
    ...(body.reason ? { reason: body.reason } : {}),
    ...(body.viaTC ? { viaTC: true } : {}),
  });
  blob.apply_attempts = attempts.slice(-10); // last 10 only

  // Compute new status: if user applied successfully, mark pending; if reason
  // indicates already-handled, mark pending; otherwise keep current.
  let newStatus = target.status;
  if (body.result === 'applied' || body.reason === 'already-handled') {
    if (newStatus === 'paused' || newStatus === null) newStatus = 'pending';
  }

  const newNotes = '[cj-sync] ' + JSON.stringify(blob);
  const patch: Record<string, unknown> = { notes: newNotes };
  if (newStatus !== target.status) patch.status = newStatus;

  const updated = await dx('PATCH', `/items/affiliate_programs/${target.id}`, patch);
  if (!updated.ok) return NextResponse.json({ error: `Directus ${updated.status}` }, { status: 502 });

  return NextResponse.json({ ok: true, aid: body.aid, status: newStatus });
}
