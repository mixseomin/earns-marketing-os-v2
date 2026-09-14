// GET|POST /api/phu/postback?k=<token nguồn>&mang=crakrevenue&event=signup|lead|spend&sid=<aff_sub>&amount=12.5&id=<txn>&platform=candy-ai
//
// Mạng affiliate (CrakRevenue, AWEmpire, Stripcash…) gọi thẳng vào đây khi có signup/sale. Token `k`
// là của MỘT nguồn traffic (phu_nguon.postback_token) — sai token thì 401, đúng thì ghi phu_su_kien
// và khử trùng bằng (postback:<mạng>, id). Không có id thì băm (sid|event|amount|phút) — mạng gọi
// lại cùng giao dịch trong một phút không thành hai dòng.
// Trả 200 text "ok" kể cả khi trùng: mạng chỉ cần biết đã nhận, retry vì 4xx là tự đếm hai lần.
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { sidPrefix } from '@/lib/phu';

export const dynamic = 'force-dynamic';

const LOAI: Record<string, string> = { signup: 'signup', reg: 'signup', join: 'signup', lead: 'lead', cpl: 'lead', sale: 'spend', spend: 'spend', purchase: 'spend', rebill: 'spend', pps: 'lead' };

async function xuLy(req: Request) {
  const u = new URL(req.url);
  const p = Object.fromEntries(u.searchParams.entries()) as Record<string, string>;
  if (req.method === 'POST') {
    try { Object.assign(p, await req.json()); } catch { /* form-encoded hoặc rỗng */ }
  }
  const k = String(p.k ?? '').trim();
  if (!k) return new NextResponse('missing k', { status: 401 });
  const db = getDb();
  if (!db) return new NextResponse('db', { status: 503 });
  const ng = (await db.execute(sql`SELECT project_id, key FROM phu_nguon WHERE postback_token = ${k} LIMIT 1`)) as unknown as Array<{ project_id: string; key: string }>;
  if (!ng.length) return new NextResponse('bad k', { status: 401 });
  const { project_id: projectId, key: nguonKey } = ng[0]!;
  const mang = String(p.mang ?? p.net ?? 'khac').toLowerCase().replace(/[^a-z0-9-]/g, '');
  const loai = LOAI[String(p.event ?? p.type ?? '').toLowerCase()] ?? 'lead';
  const sid = String(p.sid ?? p.aff_sub ?? p.sub ?? '').slice(0, 200);
  const amount = Number(p.amount ?? p.payout ?? p.value ?? 0) || 0;
  const ts = p.ts && !Number.isNaN(Date.parse(p.ts)) ? new Date(p.ts) : new Date();
  const maDon = String(p.id ?? p.txn ?? p.transaction_id ?? '').trim()
    || createHash('sha1').update([sid, loai, amount, ts.toISOString().slice(0, 16)].join('|')).digest('hex').slice(0, 24);
  await db.execute(sql`
    INSERT INTO phu_su_kien (project_id, ts, loai, sid, sid_prefix, platform_slug, mang, amount, ma_don, nguon_du_lieu, raw)
    VALUES (${projectId}, ${ts.toISOString()}::timestamptz, ${loai}, ${sid || null}, ${sidPrefix(sid) || nguonKey}, ${p.platform ?? null}, ${mang}, ${amount},
            ${maDon}, ${'postback:' + mang}, ${JSON.stringify(p)}::jsonb)
    ON CONFLICT (nguon_du_lieu, ma_don) DO NOTHING`);
  await db.execute(sql`
    INSERT INTO phu_adapter (project_id, key, name, loai, lich, last_run, last_ok, last_note)
    VALUES (${projectId}, ${'postback-' + mang}, ${'Postback ' + mang}, 'postback', 'khi mạng gọi', now(), true, ${loai + ' ' + (sid || '(no sid)')})
    ON CONFLICT (project_id, key) DO UPDATE SET last_run = now(), last_ok = true, last_note = EXCLUDED.last_note`);
  return new NextResponse('ok', { status: 200, headers: { 'cache-control': 'no-store' } });
}

export async function GET(req: Request) { return xuLy(req); }
export async function POST(req: Request) { return xuLy(req); }
