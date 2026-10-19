// Bổ sung khuôn QC phim cho các phim lô Ethopex đã tạo (0đ — chỉ ghi DB): cổng "người xem" của studio (19/10/2026, phim #133 chấm 1/10) đòi
// biết đang QC gì + xem ở đâu → (1) thêm cảnh THẺ CUỐI: tên phim + "WATCH FULL EPISODES FREE" (ES: "MIRA TODOS LOS EPISODIOS GRATIS"),
// (2) chữ trên màn shot 1 kèm tên phim, (3) chữ trên màn rút ≤ 7 từ (lời đọc giữ nguyên), (4) qc.ten = "<tên> — short drama, free on <nền tảng>".
// tao-lo.mts từ nay tạo sẵn đúng khuôn này. Chạy lại được (đã có thẻ cuối thì bỏ qua).
//   … NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/ethopex/them-the-cuoi.mts <phim_id…>
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { khuonQcPhim } from './khuon-qc-phim';
const db = getDb()!;
for (const id of process.argv.slice(2).map(Number)) {
  const p = ((await db.execute(sql`SELECT p.id, p.kinh_thanh, t.id AS tap FROM xv_phim p JOIN xv_tap t ON t.phim_id = p.id WHERE p.id = ${id} ORDER BY t.so LIMIT 1`)) as unknown as { id: number; kinh_thanh: Record<string, unknown>; tap: number }[])[0];
  if (!p) { console.log(`#${id}: không thấy`); continue; }
  const canh = (await db.execute(sql`SELECT id, thu_tu, loi_thoai, chu_man, nhan_vat FROM xv_canh WHERE tap_id = ${p.tap} ORDER BY thu_tu`)) as unknown as { id: number; thu_tu: number; loi_thoai: string; chu_man: string; nhan_vat: unknown }[];
  const kt = p.kinh_thanh as { ngon_ngu?: string; qc?: { ten?: string }; ethopex?: { nguon?: string } };
  const ten = String(kt.qc?.ten ?? '').replace(/ \(Ethopex\)$/, '').replace(/ — short drama.*$/, '');
  const k = khuonQcPhim(ten, kt.ngon_ngu === 'es' ? 'es' : 'en', kt.ethopex?.nguon ?? '', canh.map((c) => c.loi_thoai));
  for (const [i, c] of canh.entries()) await db.execute(sql`UPDATE xv_canh SET chu_man = ${k.chu[i] ?? c.chu_man}, updated_at = now() WHERE id = ${c.id}`);
  await db.execute(sql`UPDATE xv_phim SET kinh_thanh = jsonb_set(kinh_thanh, '{qc,ten}', ${JSON.stringify(k.qcTen)}::jsonb), updated_at = now() WHERE id = ${id}`);
  if (!canh.some((c) => c.thu_tu === 7)) {
    await db.execute(sql`INSERT INTO xv_canh (tap_id, thu_tu, canh, hanh_dong, prompt_anh, prompt_video, loi_thoai, thoai, chu_man, nhan_vat, phan_doan, thoi_luong_s, trang_thai)
      VALUES (${p.tap}, 7, 'Shot 7 · thẻ cuối', ${k.theCuoi.anh}, ${k.theCuoi.anh}, ${k.theCuoi.dong}, ${k.theCuoi.loi}, ${JSON.stringify([{ nhan_vat: '', loi: k.theCuoi.loi }])}::jsonb,
        ${k.theCuoi.chu}, ${JSON.stringify(canh[0]?.nhan_vat ?? [])}::jsonb, 'cta', 4, 'nhap')`);
  }
  console.log(`✓ #${id} ${ten}: ${k.chu.join(' / ')} / [${k.theCuoi.chu.replace(/\n/g, ' ')}]`);
}
process.exit(0);
