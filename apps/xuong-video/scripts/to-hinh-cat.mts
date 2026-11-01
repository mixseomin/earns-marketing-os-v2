// TỜ HÌNH CẮT cho hoạt hình giấy cắt bằng code (giay-cat/): MỘT ảnh nền xanh chứa các mảnh rời (thân người, đạo cụ, nét mặt…) cùng nét vẽ → giay-cat/tach.mjs
// tách từng mảnh theo vùng liền. Một ảnh cho cả bộ mảnh = cùng phong cách, cùng ánh sáng. Tốn 1 ảnh (~110₫).
// Chạy trên box3: DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/to-hinh-cat.mts --phim=1156 --ref=736,806,764 --manh='…' [--ten=gag4]
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { uploadToR2 } from '../src/lib/r2';
import { sinhAnhQuaCong } from '../src/lib/xuong-video/cong-ai';
import { docKinhThanh, phongCachHinh, type KinhThanh } from '../src/lib/xuong-video/kieu';

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? '';
const phimId = Number(arg('phim')), refIds = arg('ref').split(',').map(Number).filter(Boolean), manh = arg('manh'), ten = arg('ten') || 'to';
if (!phimId || !manh) { console.error('thiếu --phim --manh'); process.exit(1); }
if (process.env.DUYET_SINH_1_LAN !== '1') { console.error('tốn tiền (~110₫): chạy kèm DUYET_SINH_1_LAN=1 ngay sau khi anh bảo'); process.exit(1); }
const db = getDb();
const kt = docKinhThanh(((await db.execute(sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${phimId}`)) as unknown as { kinh_thanh: KinhThanh }[])[0]!.kinh_thanh);
const refs = refIds.length ? ((await db.execute(sql`SELECT id, anh_ref->>0 AS u FROM xv_nhan_vat WHERE id IN (${sql.raw(refIds.join(','))})`)) as unknown as { id: number; u: string | null }[])
  .sort((a, b) => refIds.indexOf(a.id) - refIds.indexOf(b.id)).map((r) => r.u).filter((u): u is string => !!u).slice(0, 3) : [];
const style = phongCachHinh(kt.phong_cach).replace(/[.\s]+$/, '');
const prompt = `Visual style: ${style}. A CUT-OUT PUPPET SHEET for paper cut-out animation: separate pieces laid out apart from each other on a flat pure chroma green (#00FF00) background, generous green gaps between pieces so no two pieces touch or overlap, every piece complete and uncropped, flat even lighting, no cast shadows, nothing green on any piece. Pieces, left to right: ${manh}${refs.length ? ` Reference image${refs.length > 1 ? `s 1–${refs.length} show` : ' 1 shows'} the designs — keep them exactly.` : ''} No text, no labels.`;
const k = await sinhAnhQuaCong(kt.mo_hinh_anh, { prompt, thamChieuUrl: refs, tiLe: '16:9' });
if (!k.anh) { console.error('không sinh được', k.thu); process.exit(1); }
console.log(await uploadToR2(`xuong-video/giay-cat/${phimId}-${ten}-${randomUUID().slice(0, 8)}.png`, k.anh.data, k.anh.mimeType), `· ${k.nguon?.vnd ?? '?'}₫`);
process.exit(0);
