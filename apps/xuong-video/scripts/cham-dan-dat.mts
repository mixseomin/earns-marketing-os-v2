// Chấm DẪN DẮT một tập (dan-dat.ts) từ DB — chỉ đọc, 0đ. In điểm tập / cảnh / từng điểm cắt bị trừ.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/cham-dan-dat.mts 122
//   --het : mọi tập — đếm shot bị CỔNG dẫn dắt chặn (chanDanDat), in vài ví dụ (đo trước khi siết ngưỡng)
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { chamDanDat, chanDanDat, type ShotDanDat } from '../src/lib/xuong-video/dan-dat';
import type { ApKhuon } from '../src/lib/xuong-video/khuon-chuoi';

const db = getDb()!;
if (process.argv.includes('--het')) {
  const taps = (await db.execute(sql`SELECT t.id, t.phan_canh, t.khuon_chuoi, p.loai, p.kinh_thanh->>'the_loai' AS tl FROM xv_tap t JOIN xv_phim p ON p.id = t.phim_id`)) as unknown as { id: number; phan_canh: never; khuon_chuoi: never; loai: string; tl: string }[];
  let tong = 0, chan = 0; const theoLoai = new Map<string, number>(); const vd: string[] = [];
  for (const t of taps) {
    const ds = ((await db.execute(sql`SELECT id, thu_tu, phan_doan, hanh_dong, canh, nhan_vat, ky_thuat FROM xv_canh WHERE tap_id = ${t.id} ORDER BY thu_tu`)) as unknown as ShotDanDat[]).map((c) => ({ ...c, id: Number(c.id), nhan_vat: (c.nhan_vat ?? []).map(Number) }));
    for (const c of ds) { tong++; const r = chanDanDat(c.id, ds, { phan_canh: t.phan_canh ?? [], khuon_chuoi: t.khuon_chuoi ?? [] }, t.tl as never); if (r.length) { chan++; theoLoai.set(t.loai, (theoLoai.get(t.loai) ?? 0) + 1); if (vd.length < 8) vd.push(`  ${t.loai} tập ${t.id} #${c.thu_tu}: ${r[0]!.slice(0, 170)}`); } }
  }
  console.log(`${taps.length} tập · ${tong} shot · bị cổng chặn ${chan} (${[...theoLoai].map(([k, v]) => `${k} ${v}`).join(', ')})`); console.log(vd.join('\n'));
  process.exit(0);
}
const tapId = Number(process.argv[2]);
const t = ((await db.execute(sql`SELECT t.phan_canh, t.khuon_chuoi, p.kinh_thanh->>'the_loai' AS tl FROM xv_tap t JOIN xv_phim p ON p.id = t.phim_id WHERE t.id = ${tapId}`)) as unknown as { phan_canh: { ten: string; noi?: string; luc?: string; ngay?: string }[]; khuon_chuoi: ApKhuon[]; tl: string }[])[0]!;
const canh = ((await db.execute(sql`SELECT id, thu_tu, phan_doan, hanh_dong, canh, nhan_vat, ky_thuat FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu`)) as unknown as ShotDanDat[]).map((c) => ({ ...c, id: Number(c.id), nhan_vat: (c.nhan_vat ?? []).map(Number) }));
const k = chamDanDat(canh, t.phan_canh ?? [], t.khuon_chuoi ?? [], t.tl as never);
const so = new Map(canh.map((c) => [c.id, c.thu_tu]));
console.log(`Dẫn dắt tập ${tapId}: ${k.diem}/100 (điểm cắt ${k.diemCat} · khuôn ${k.diemKhuon ?? '—'})`);
for (const c of k.canh) console.log(`  cảnh "${c.ten}": ${c.diem}${c.tru.length ? ` — ${c.tru.map((t) => `−${t.tru} ${t.chu}`).join('; ')}` : ''}`);
for (const c of k.cat.filter((x) => x.tru.length)) console.log(`  #${so.get(c.truoc)}→#${so.get(c.sau)}${c.sangCanh ? ' (sang cảnh)' : ''} ${c.diem}: ${c.tru.map((x) => `−${x.tru} ${x.chu}`).join(' | ')}`);
if (k.ngoaiKhuon.length) console.log(`  shot ngoài khuôn: ${k.ngoaiKhuon.map((id) => `#${so.get(id)}`).join(' ')}`);
process.exit(0);
