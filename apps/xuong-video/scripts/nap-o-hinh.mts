// NẠP Ô HÌNH (ô _hinh / bối cảnh / tên nhân vật của template) cho mọi cặp đang bật của một sản phẩm, từ tệp dữ liệu viết tay (0đ):
// scripts/du-lieu/o-hinh/<tệp>.json — { sp_key, nguon, chung: {ô: giá trị}, concept: {ma: {nguoi, ten, boi_canh, …ô}}, dan_toc: {so biến thể: sắc tộc} }.
// Ô hình lưu ở xv_phuong_an (so = 1) như ô chữ — gtCreative / xem trước gộp vào giá trị; diễn viên + bối cảnh ghi vào xv_bien_the_hinh.
// Không ghi đè dòng của nguồn khác (AI / người sửa tay); bản cũ của biến thể chép ra <tệp>.sao-luu.json trước khi sửa.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/nap-o-hinh.mts scripts/du-lieu/o-hinh/jettjeans.json [--ghi]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { docOTemplate } from '../src/lib/xuong-video/template-db';
import { oChuTuKhung } from '../src/lib/xuong-video/concept';

type DuLieu = { sp_key: string; nguon: string; chung: Record<string, string>; concept: Record<string, Record<string, string>>; dan_toc: Record<string, string> };
type Row = Record<string, unknown>;
const tep = process.argv[2]; const ghi = process.argv.includes('--ghi');
if (!tep) { console.error('dùng: nap-o-hinh.mts <tệp.json> [--ghi]'); process.exit(2); }
const d = JSON.parse(readFileSync(tep, 'utf8')) as DuLieu;
const db = getDb()!;
// ô do biến thể diễn viên lo (gtBienThe) — không nạp thành phương án
const O_BIEN_THE = new Set(['nhan_vat_hinh', 'nguoi_2_hinh', 'boi_canh']);

const caps = (await db.execute(sql`SELECT c.id, c.template_id, k.ma FROM xv_cap c JOIN xv_concept k ON k.id = c.concept_id
  WHERE k.sp_key = ${d.sp_key} AND c.bat ORDER BY k.ma, c.template_id`)) as unknown as Row[];
let soO = 0, boQua = 0; const thieu = new Map<string, number>();
for (const c of caps) {
  const ma = String(c.ma), cv = d.concept[ma];
  if (!cv) { console.log(`  ! concept ${ma} không có trong tệp — bỏ`); continue; }
  const o = await docOTemplate(db, Number(c.template_id));
  if (!o) continue;
  const dung = o.o.filter((x) => x.dung);
  const chu = new Set(oChuTuKhung(dung, o.khung).map((x) => x.k));
  const gtConcept: Record<string, string> = { ...cv, nhan_vat_ten: cv.ten ?? '' };
  for (const x of dung) {
    if (chu.has(x.k) || O_BIEN_THE.has(x.k)) continue;
    const v = gtConcept[x.k] ?? d.chung[x.k];
    if (!v) { if (/_hinh$|^boi_canh|_ten$/.test(x.k)) thieu.set(`T${c.template_id}.${x.k}`, 1); continue; }
    soO++;
    if (!ghi) continue;
    const r = (await db.execute(sql`INSERT INTO xv_phuong_an (cap_id, o, so, chu, nguon) VALUES (${Number(c.id)}, ${x.k}, 1, ${v}, ${d.nguon})
      ON CONFLICT (cap_id, o, so) DO UPDATE SET chu = EXCLUDED.chu, an = false WHERE xv_phuong_an.nguon = EXCLUDED.nguon RETURNING id`)) as unknown as Row[];
    if (!r.length) boQua++;
  }
}
// diễn viên + bối cảnh của từng biến thể: persona tiếng Anh của concept + sắc tộc theo số biến thể; người phụ = nguoi_2_hinh chung
const bt = (await db.execute(sql`SELECT b.id, b.so, b.nguoi_chinh, b.nguoi_phu, b.boi_canh, k.ma FROM xv_bien_the_hinh b JOIN xv_cap c ON c.id = b.cap_id
  JOIN xv_concept k ON k.id = c.concept_id WHERE k.sp_key = ${d.sp_key} AND c.bat AND NOT b.an`)) as unknown as Row[];
const moi = bt.flatMap((b) => {
  const cv = d.concept[String(b.ma)]; const dt = d.dan_toc[String(b.so)];
  if (!cv?.nguoi || !dt) return [];
  return [{ id: Number(b.id), nguoi_chinh: cv.nguoi.replace(/^American man/, `American ${dt} man`), nguoi_phu: d.chung.nguoi_2_hinh ?? '', boi_canh: cv.boi_canh ?? '' }];
});
console.log(`${d.sp_key}: ${caps.length} cặp · ${soO} ô hình · ${moi.length}/${bt.length} biến thể diễn viên${ghi ? '' : ' (chưa ghi — thêm --ghi)'}`);
if (thieu.size) console.log(`  ô hình chưa có giá trị: ${[...thieu.keys()].join(', ')}`);
if (!ghi) process.exit(0);
const saoLuu = tep.replace(/\.json$/, '.sao-luu.json');
if (!existsSync(saoLuu)) writeFileSync(saoLuu, JSON.stringify(bt.map((b) => ({ id: b.id, nguoi_chinh: b.nguoi_chinh, nguoi_phu: b.nguoi_phu, boi_canh: b.boi_canh })), null, 1));
for (const b of moi) await db.execute(sql`UPDATE xv_bien_the_hinh SET nguoi_chinh = ${b.nguoi_chinh}, nguoi_phu = ${b.nguoi_phu}, boi_canh = ${b.boi_canh} WHERE id = ${b.id}`);
console.log(`✓ ghi ${soO - boQua} ô (${boQua} giữ bản nguồn khác) · ${moi.length} biến thể · sao lưu ${saoLuu}`);
process.exit(0);
