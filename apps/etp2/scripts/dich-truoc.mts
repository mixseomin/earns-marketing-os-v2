// MÁY DỊCH SẴN chữ thẻ creative (anh 23/11/2026: "Phần dịch thì phải làm ngay từ lúc sinh ra creative !! Nếu chưa dịch thì dịch 1 loạt luôn.
// Chỉ các creative đang, chuẩn bị và sẽ chạy !!"). Chạy trên box3 cuối mỗi lượt apps/etp/dong-bo.py (timer etp-dong-bo 10 phút), không tiến trình riêng:
//   node_modules/.bin/tsx apps/etp2/scripts/dich-truoc.mts [--xem] [--so N]
// Tập creative = TAP_CHAY (lib/etp-dich.ts: camp ACTIVE · dòng thay thế chờ camp · hàng chờ lên camp). Chữ gom bằng ĐÚNG hàm thẻ dùng (dungBaiQc) nên khoá trùng khít,
// mở thẻ là có bản dịch. Creative đã dịch ghi etp.dich_cr; bản chấm / chữ QC mới hơn mốc đó (vd chép lại giọng) thì dịch phần chữ mới.
// --xem: chỉ đếm + ước tiền (theo giá thật trung bình của etp.dich), không gọi AI.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { dungBaiQc, docDich, dichKho, TAP_CHAY, TRAN_SO_DICH } from '../src/lib/etp-dich';

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const XEM = process.argv.includes('--xem'), SO = Number(arg('--so') ?? 300), TY_GIA = 26000, LO_KY_TU = 6000, SONG_SONG = 4;
const db = getDb(); if (!db) throw new Error('không nối được kho (thiếu DATABASE_URL)');

const viec = (await db.execute(sql`with t as (${TAP_CHAY})
  select t.creative_id from t join etp.cham ch using (creative_id) left join etp.dich_cr d using (creative_id) left join etp.bai_cr b using (creative_id)
  left join etp.camp k on k.creative_id = t.creative_id and k.trang_thai = 'ACTIVE'
  where d.creative_id is null or d.loi is not null or d.luc < greatest(ch.luc, coalesce(b.luc, ch.luc))
  group by t.creative_id order by bool_or(k.camp_id is not null) desc, t.creative_id desc limit ${SO}`)) as unknown as { creative_id: number }[];
const the = new Map<number, string[]>();
for (const v of viec) the.set(v.creative_id, (await dungBaiQc(db, v.creative_id, null)).canDich);
const tatCa = [...new Set([...the.values()].flat())];
const nho = new Set<string>();
for (let i = 0; i < tatCa.length; i += 500) Object.keys(await docDich(db, tatCa.slice(i, i + 500))).forEach((k) => nho.add(k));
const thieu = tatCa.filter((x) => !nho.has(x));
const kyTu = thieu.reduce((n, x) => n + x.length, 0);

if (XEM) {
  const g = ((await db.execute(sql`select sum(chi_usd) / nullif(sum(length(goc)), 0) u from etp.dich where chi_usd is not null`)) as unknown as { u: string | null }[])[0]?.u;
  const usd = g == null ? null : Number(g) * kyTu;
  console.log(JSON.stringify({ creative: viec.length, doan_thieu: thieu.length, ky_tu: kyTu, uoc_vnd: usd == null ? null : Math.round(usd * TY_GIA) }));
  process.exit(0);
}

// lô ≤ TRAN_SO_DICH đoạn, ≤ LO_KY_TU ký tự — mỗi lô một lượt AI, chạy song song SONG_SONG lô
const lo: string[][] = []; let cur: string[] = [], n = 0;
for (const x of thieu) { if (cur.length && (cur.length >= TRAN_SO_DICH || n + x.length > LO_KY_TU)) { lo.push(cur); cur = []; n = 0; } cur.push(x); n += x.length; }
if (cur.length) lo.push(cur);
let chi = 0, moi = 0; const loi: string[] = []; let k = 0;
await Promise.all(Array.from({ length: Math.min(SONG_SONG, lo.length) }, async () => {
  while (k < lo.length) {
    const l = lo[k++]!;
    try { const r = await dichKho(db, l, 'etp2-dich-truoc'); chi += r.chi_usd; moi += r.moi; r.vi && Object.keys(r.vi).forEach((x) => nho.add(x)); }
    catch (e) { loi.push(String((e as Error)?.message ?? e).slice(0, 160)); }
  }
}));
let du = 0;
for (const [cr, ds] of the) {
  const con = ds.filter((x) => !nho.has(x)).length;
  if (!con) du++;
  await db.execute(sql`insert into etp.dich_cr (creative_id, luc, so_chu, loi) values (${cr}, now(), ${ds.length}, ${con ? `còn ${con} đoạn chưa dịch` : null})
    on conflict (creative_id) do update set luc = now(), so_chu = excluded.so_chu, loi = excluded.loi`);
}
console.log(JSON.stringify({ creative: viec.length, du, doan_moi: moi, lo: lo.length, vnd: Math.round(chi * TY_GIA), loi: loi.slice(0, 3) }));
process.exit(loi.length && !moi ? 1 : 0);
