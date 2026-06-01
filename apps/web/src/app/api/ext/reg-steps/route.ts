import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { getDb, platforms, habitats } from '@mos2/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// Template "bước cần làm" theo scope:
//  - platform: bước SAU ĐĂNG KÝ (verify email, câu hỏi phụ, chờ duyệt) → lưu vào
//    platforms.checklist các item phase='creating' (giữ nguyên item phase khác).
//  - habitat: bước VÀO NHÓM (trả lời câu hỏi, chờ mod) → habitats.join_checklist.
// Step shape: { key, label, tip?, actionUrl? }. Progress lưu riêng per account/brief.
type Step = { key: string; label: string; tip?: string | null; actionUrl?: string | null };

function normSteps(raw: unknown): Step[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s) => s && typeof s === 'object' && typeof (s as Step).key === 'string' && (s as Step).key.trim())
    .map((s) => {
      const o = s as Step;
      return { key: o.key.trim(), label: String(o.label ?? o.key).trim(), tip: o.tip ?? null, actionUrl: o.actionUrl ?? null };
    });
}

// GET /api/ext/reg-steps?scope=platform&key=resetera-com  |  scope=habitat&key=<id>
export async function GET(req: Request) {
  const err = checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });
  const sp = new URL(req.url).searchParams;
  const scope = sp.get('scope'); const key = (sp.get('key') ?? '').trim();
  if (!key) return NextResponse.json({ ok: false, error: 'key required' }, { status: 400 });

  if (scope === 'habitat') {
    const [h] = await db.select({ jc: habitats.joinChecklist }).from(habitats).where(eq(habitats.id, Number(key))).limit(1);
    return NextResponse.json({ ok: true, scope, key, steps: normSteps(h?.jc) });
  }
  // platform: lấy item phase='creating' từ checklist.
  const [p] = await db.select({ cl: platforms.checklist }).from(platforms).where(eq(platforms.key, key)).limit(1);
  const items = Array.isArray(p?.cl) ? (p!.cl as Array<Record<string, unknown>>) : [];
  const steps = normSteps(items.filter((it) => it.phase === 'creating'));
  return NextResponse.json({ ok: true, scope: 'platform', key, steps });
}

// POST /api/ext/reg-steps { scope, key, steps:[{key,label,tip?,actionUrl?}] }
export async function POST(req: Request) {
  const err = checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });
  const body = await req.json() as { scope?: string; key?: string; steps?: unknown };
  const key = (body.key ?? '').trim();
  if (!key) return NextResponse.json({ ok: false, error: 'key required' }, { status: 400 });
  const steps = normSteps(body.steps);

  if (body.scope === 'habitat') {
    await db.update(habitats).set({ joinChecklist: steps }).where(eq(habitats.id, Number(key)));
    return NextResponse.json({ ok: true, scope: 'habitat', key, steps });
  }
  // platform: thay item phase='creating', GIỮ NGUYÊN các phase khác (warming/active).
  const [p] = await db.select({ cl: platforms.checklist }).from(platforms).where(eq(platforms.key, key)).limit(1);
  if (!p) return NextResponse.json({ ok: false, error: 'platform not found' }, { status: 404 });
  const existing = Array.isArray(p.cl) ? (p.cl as Array<Record<string, unknown>>) : [];
  const kept = existing.filter((it) => it.phase !== 'creating');
  const creating = steps.map((s) => ({ key: s.key, phase: 'creating', label: s.label, tip: s.tip, actionUrl: s.actionUrl }));
  await db.update(platforms).set({ checklist: [...kept, ...creating] }).where(eq(platforms.key, key));
  return NextResponse.json({ ok: true, scope: 'platform', key, steps });
}
