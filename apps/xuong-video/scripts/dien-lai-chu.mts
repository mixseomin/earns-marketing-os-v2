// Áp câu chữ QC có nguồn tham khảo (skill viet-qc-truc-dien) vào một phim tạo từ template — 0đ, không gọi model.
// Tệp: scripts/du-lieu/cau-chu/phim-<id>.json { phim, ghi, o: { <ô>: [giá trị, NguonThamKhao[]] } }
// Chữ màn + lời + nguồn của mọi shot điền lại từ template (template-db.ts › dienLaiChu); keyframe / clip giữ nguyên, câu lời đổi phải sinh giọng lại.
// cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/dien-lai-chu.mts scripts/du-lieu/cau-chu/phim-36.json
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { dienLaiChu } from '../src/lib/xuong-video/template-db';
import { cauThieuNguon, type NguonThamKhao, type ThamKhaoCau } from '../src/lib/xuong-video/tham-khao';

const f = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as { phim: number; o: Record<string, [string, NguonThamKhao[]]> };
const gt = Object.fromEntries(Object.entries(f.o).map(([k, v]) => [k, v[0]]));
const tk = Object.fromEntries(Object.entries(f.o).map(([k, v]) => [k, v[1]]));
const trong = Object.entries(tk).filter(([, v]) => !v.length).map(([k]) => k);
if (trong.length) { console.error(`ô chưa có nguồn: ${trong.join(', ')}`); process.exit(1); }
const db = getDb()!;
const r = await dienLaiChu(db, f.phim, { gt, tk });
if (!r) { console.error(`phim #${f.phim} không tạo từ template`); process.exit(1); }
console.log(`phim #${f.phim}: ${r.shot} shot điền lại · ${r.canGiong} câu lời cần sinh giọng lại${r.lech.length ? ` · lệch: ${r.lech.join('; ')}` : ''}`);
const ds = (await db.execute(sql`SELECT c.thu_tu, c.nhanh, c.chu_man, c.thoai, c.tham_khao FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = ${f.phim} ORDER BY t.so, c.thu_tu, c.nhanh`)) as unknown as { thu_tu: number; nhanh: string; chu_man: string; thoai: { loi?: string }[]; tham_khao: ThamKhaoCau[] }[];
for (const c of ds) {
  const thieu = cauThieuNguon(c);
  console.log(`#${c.thu_tu}${c.nhanh} ${thieu.length ? '✗' : '✓'} ${[c.chu_man, ...c.thoai.map((x) => x.loi ?? '')].filter(Boolean).join(' / ')}${thieu.length ? `   ← CHƯA NGUỒN: ${thieu.join(' | ')}` : ` (${c.tham_khao.reduce((a, x) => a + x.nguon.length, 0)} nguồn)`}`);
}
process.exit(0);
