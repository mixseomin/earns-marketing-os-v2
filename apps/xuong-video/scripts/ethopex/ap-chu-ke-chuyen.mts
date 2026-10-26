// ÁP KHUÔN CHỮ MÀN QC KỂ CHUYỆN cho phim ĐÃ tạo (0đ — chỉ ghi DB, chụp hoàn tác trước khi ghi): anh 27/10/2026 "chữ trên màn nhiều và che hết nội dung".
// (1) kinh thánh qc.kieu_chu + qc.vi_tri_chu = KIEU_CHU_KE_CHUYEN (chữ nhỏ, vùng dưới, ≤ 7 từ/khung) · (2) shot 1 bỏ dòng "SHORT DRAMA / MINISERIE: tên"
// · (3) thẻ cuối ≤ 2 dòng (chuTheCuoi) + kiểu không cắt cụm. Phim mới từ tao-lo.mts đã có sẵn khuôn này. Chạy lại được (đã đúng thì ghi y nguyên).
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/ethopex/ap-chu-ke-chuyen.mts <phim_id…>
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { chupTruoc } from '../../src/lib/xuong-video/hoan-tac';
import { KIEU_CHU_KE_CHUYEN, VI_TRI_CHU_KE_CHUYEN, KIEU_THE_CUOI, NUT_CTA, chuTheCuoi } from './khuon-qc-phim';
const db = getDb()!;
const DONG_TEN = /^\s*(SHORT DRAMA|MINISERIE)\s*:/i;
for (const id of process.argv.slice(2).map(Number)) {
  const p = ((await db.execute(sql`SELECT p.id, p.ten, p.kinh_thanh, t.id AS tap FROM xv_phim p JOIN xv_tap t ON t.phim_id = p.id WHERE p.id = ${id} ORDER BY t.so LIMIT 1`)) as unknown as { id: number; ten: string; kinh_thanh: { the_loai?: string; ngon_ngu?: string; qc?: { ten?: string } }; tap: number }[])[0];
  if (!p) { console.log(`#${id}: không thấy`); continue; }
  if (p.kinh_thanh.the_loai !== 'qc_ke_chuyen') { console.log(`#${id}: thể loại ${p.kinh_thanh.the_loai} — không phải QC kể chuyện, bỏ qua`); continue; }
  const lang = p.kinh_thanh.ngon_ngu === 'es' ? 'es' : 'en';
  const ten = String(p.kinh_thanh.qc?.ten ?? '').split(' — ')[0]!.trim() || p.ten.split(' · ')[1]!;
  const nhom = randomUUID();
  await chupTruoc(db, { bang: 'xv_phim', id, cot: ['kinh_thanh'], moTa: '🔤 khuôn chữ QC kể chuyện (nhỏ, dưới, ≤ 2 dòng)', nguoi: '', nhom });
  await db.execute(sql`UPDATE xv_phim SET kinh_thanh = jsonb_set(jsonb_set(kinh_thanh, '{qc,kieu_chu}', ${JSON.stringify(KIEU_CHU_KE_CHUYEN)}::jsonb, true), '{qc,vi_tri_chu}', ${JSON.stringify(VI_TRI_CHU_KE_CHUYEN)}::jsonb, true), updated_at = now() WHERE id = ${id}`);
  const canh = (await db.execute(sql`SELECT id, thu_tu, phan_doan, chu_man FROM xv_canh WHERE tap_id = ${p.tap} ORDER BY thu_tu, id`)) as unknown as { id: number; thu_tu: number; phan_doan: string; chu_man: string }[];
  const cuoi = canh[canh.length - 1];
  const doi: string[] = [];
  for (const c of canh) {
    let chu = c.chu_man ?? ''; let kieu: object | null = null;
    if (c === canh[0]) chu = chu.split('\n').filter((d) => !DONG_TEN.test(d)).join('\n').trim();
    if (c === cuoi && c.phan_doan === 'cta') { chu = chuTheCuoi(ten, NUT_CTA[lang]); kieu = KIEU_THE_CUOI; }
    if (chu === c.chu_man && !kieu) continue;
    await chupTruoc(db, { bang: 'xv_canh', id: c.id, cot: ['chu_man', 'kieu_chu'], moTa: '🔤 khuôn chữ QC kể chuyện', nguoi: '', nhom });
    await db.execute(sql`UPDATE xv_canh SET chu_man = ${chu}, kieu_chu = CASE WHEN ${kieu ? JSON.stringify(kieu) : null}::jsonb IS NULL THEN kieu_chu ELSE ${kieu ? JSON.stringify(kieu) : null}::jsonb END, updated_at = now() WHERE id = ${c.id}`);
    doi.push(`#${c.thu_tu}: ${chu.replace(/\n/g, ' ⏎ ')}`);
  }
  console.log(`✓ phim #${id} (tập #${p.tap}) ${ten}\n   ${doi.join('\n   ')}`);
}
process.exit(0);
