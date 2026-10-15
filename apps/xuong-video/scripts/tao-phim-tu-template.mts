// Tạo phim QC từ template KÈM NGUỒN THAM KHẢO cho từng ô chữ (skill viet-qc-truc-dien) — cùng lõi nút 🧩 Tạo phim từ template (template-db.ts › chepPhim),
// thêm tk để mọi câu chữ màn / lời mang nguồn ngay từ đầu (cổng chanThamKhao không chặn). 0đ, không gọi model.
// Tệp: scripts/du-lieu/cau-chu/<ten>.json { template: <id>, ten: "<tên phim>", o: { <ô>: "giá trị" | ["giá trị", NguonThamKhao[]] } }
//   ô chữ (hiện trên màn / đọc thành lời) PHẢI có nguồn; ô mô tả hình / bối cảnh / link để chuỗi trơn.
// cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/tao-phim-tu-template.mts scripts/du-lieu/cau-chu/<ten>.json
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { chepPhim, docOTemplate } from '../src/lib/xuong-video/template-db';
import { oThieu } from '../src/lib/xuong-video/template';
import { cauThieuNguon, type NguonThamKhao, type ThamKhaoCau } from '../src/lib/xuong-video/tham-khao';

const f = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as { template: number; ten: string; o: Record<string, string | [string, NguonThamKhao[]]> };
const gt = Object.fromEntries(Object.entries(f.o).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
const tk = Object.fromEntries(Object.entries(f.o).filter(([, v]) => Array.isArray(v) && v[1].length).map(([k, v]) => [k, (v as [string, NguonThamKhao[]])[1]]));
const db = getDb()!;
const t = await docOTemplate(db, f.template);
if (!t) { console.error(`không thấy template #${f.template}`); process.exit(1); }
const thieu = oThieu(t.o, gt);
if (thieu.length) { console.error(`chưa điền: ${thieu.map((o) => o.k).join(', ')}`); process.exit(1); }
const r = await chepPhim(db, f.template, { ten: f.ten, gt, laTemplate: false, tk });
if (!r) { console.error('chép hỏng'); process.exit(1); }
console.log(`phim #${r.phimId} từ template #${f.template}`);
// Soát: câu chữ nào của phim mới còn thiếu nguồn (cổng sẽ chặn sinh) — sửa tệp rồi chạy dien-lai-chu.mts.
const ds = (await db.execute(sql`SELECT c.thu_tu, c.chu_man, c.thoai, c.tham_khao FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = ${r.phimId} ORDER BY t.so, c.thu_tu`)) as unknown as { thu_tu: number; chu_man: string; thoai: { loi?: string }[]; tham_khao: ThamKhaoCau[] }[];
for (const c of ds) { const x = cauThieuNguon(c); console.log(`#${c.thu_tu} ${x.length ? `✗ thiếu nguồn: ${x.join(' | ')}` : '✓'} ${c.chu_man}`); }
process.exit(0);
