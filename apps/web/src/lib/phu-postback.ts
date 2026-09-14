// Thân xử lý postback — dùng chung cho /api/phu/postback?k=… và /api/phu/postback/<k> (AWEmpire bỏ query
// string của URL gốc, chỉ gắn tham số họ map, nên token phải nằm được trên đường dẫn).
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
import { sidPrefix } from '@/lib/phu-shared';

const LOAI: Record<string, string> = { signup: 'signup', reg: 'signup', join: 'signup', lead: 'lead', cpl: 'lead', sale: 'spend', spend: 'spend', purchase: 'spend', rebill: 'spend', pps: 'lead' };

export async function xuLyPostback(req: Request, kPath?: string) {
  const u = new URL(req.url);
  const p = Object.fromEntries(u.searchParams.entries()) as Record<string, string>;
  if (kPath) p.k = kPath;
  if (req.method === 'POST') {
    try { Object.assign(p, await req.json()); } catch { /* form-encoded hoặc rỗng */ }
  }
  const k = String(p.k ?? '').trim();
  if (!k) return new NextResponse('missing k', { status: 401 });
  const db = getDb();
  if (!db) return new NextResponse('db', { status: 503 });
  // Token theo MẠNG (phu_adapter postback-<mạng>) là đường chính; token theo nguồn (phu_nguon) vẫn nhận
  // để URL đã dán ở đâu đó không chết. Mạng suy từ adapter, hoặc từ tham số mang= khi token là của nguồn.
  const ad = (await db.execute(sql`SELECT project_id, key FROM phu_adapter WHERE postback_token = ${k} LIMIT 1`)) as unknown as Array<{ project_id: string; key: string }>;
  const ng = ad.length ? [] : (await db.execute(sql`SELECT project_id, key FROM phu_nguon WHERE postback_token = ${k} LIMIT 1`)) as unknown as Array<{ project_id: string; key: string }>;
  if (!ad.length && !ng.length) return new NextResponse('bad k', { status: 401 });
  const projectId = (ad[0] ?? ng[0])!.project_id;
  const nguonKey = ng[0]?.key ?? '';
  const mang = ad.length ? ad[0]!.key.replace(/^postback-/, '') : String(p.mang ?? p.net ?? 'khac').toLowerCase().replace(/[^a-z0-9-]/g, '');
  // Mạng bỏ query gốc thì mất cả platform= — suy mặc định theo mạng một-nền-tảng.
  const platform = p.platform ?? ({ awempire: 'livejasmin', stripcash: 'stripchat', bongacash: 'bongacams', chaturbate: 'chaturbate' } as Record<string, string>)[mang] ?? null;
  // Tên tham số theo từng mạng — CrakRevenue đặt được tên tuỳ ý ({aff_sub}, {payout}, {transaction_id}),
  // AWEmpire chọn từ danh sách cố định (subAffiliateId, commission, transactionHash, isFirstBill, isRebill,
  // isChargeback, isEmailVerification). Nhận cả hai, không bắt mạng phải theo tên của mình.
  const dung = (v: unknown) => v !== undefined && v !== null && String(v) !== '' && String(v) !== '0' && String(v).toLowerCase() !== 'false';
  const sid = String(p.sid ?? p.aff_sub ?? p.sub ?? p.subAffiliateId ?? p.subaffid ?? '').slice(0, 200);
  let amount = Number(p.amount ?? p.payout ?? p.value ?? p.commission ?? 0) || 0;
  let loai = LOAI[String(p.event ?? p.type ?? '').toLowerCase()] ?? '';
  if (!loai) {
    if (dung(p.isFirstBill) || dung(p.isRebill) || dung(p.isChargeback) || p.commission !== undefined) loai = 'spend';
    else if (dung(p.isEmailVerification) || p.memberId !== undefined || p.memberNick !== undefined || p.member !== undefined) loai = 'signup';
    else loai = 'lead';
  }
  if (dung(p.isChargeback) && amount > 0) amount = -amount;   // hoàn tiền = trừ, không cộng
  const ts = p.ts && !Number.isNaN(Date.parse(p.ts)) ? new Date(p.ts) : new Date();
  const maDon = String(p.id ?? p.txn ?? p.transaction_id ?? p.transactionHash ?? p.eventHash ?? '').trim()
    || createHash('sha1').update([sid, loai, amount, ts.toISOString().slice(0, 16)].join('|')).digest('hex').slice(0, 24);
  await db.execute(sql`
    INSERT INTO phu_su_kien (project_id, ts, loai, sid, sid_prefix, platform_slug, mang, amount, ma_don, nguon_du_lieu, raw)
    VALUES (${projectId}, ${ts.toISOString()}::timestamptz, ${loai}, ${sid || null}, ${sidPrefix(sid) || nguonKey || null}, ${platform}, ${mang}, ${amount},
            ${maDon}, ${'postback:' + mang}, ${JSON.stringify(p)}::jsonb)
    ON CONFLICT (nguon_du_lieu, ma_don) DO NOTHING`);
  await db.execute(sql`
    INSERT INTO phu_adapter (project_id, key, name, loai, lich, last_run, last_ok, last_note)
    VALUES (${projectId}, ${'postback-' + mang}, ${'Postback ' + mang}, 'postback', 'khi mạng gọi', now(), true, ${loai + ' ' + (sid || '(no sid)')})
    ON CONFLICT (project_id, key) DO UPDATE SET last_run = now(), last_ok = true, last_note = EXCLUDED.last_note, postback_token = COALESCE(phu_adapter.postback_token, encode(gen_random_bytes(12), 'hex'))`);
  return new NextResponse('ok', { status: 200, headers: { 'cache-control': 'no-store' } });
}

