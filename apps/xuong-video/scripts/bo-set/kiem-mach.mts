// KIỂM MẠCH TRÊN DỮ LIỆU NGUỒN (0đ, không cần DB): liền mạch chỗ đứng / đồ cầm / trạng thái vật + chuỗi chú ý nhìn → thấy → làm, theo thứ tự shot
// của hồ sơ — chạy TRƯỚC khi nạp lên box để bắt lỗi sớm (cùng hàm cổng keyframe: bo-set-3d.ts › lienMachTap / chuoiChuY).
//   node_modules/.bin/tsx apps/xuong-video/scripts/bo-set/kiem-mach.mts <hồ sơ.json> <set.json> [--bo=7.1a,7.1b]   (--bo: bỏ shot để phá thử)
import { readFileSync } from 'node:fs';
import { lienMachTap, chuoiChuY, choVatSet } from '../../src/lib/xuong-video/bo-set-3d';
import type { May3d } from '../../src/lib/xuong-video/kieu';
const [hs, st] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!hs || !st) { console.error('cần <hồ sơ.json> <set.json>'); process.exit(1); }
const bo = ((process.argv.find((a) => a.startsWith('--bo=')) ?? '').slice(5)).split(',').filter(Boolean);
const kb = JSON.parse(readFileSync(hs, 'utf8')) as { canh: { ten: string; shot: { ma: string }[] }[] };
const set = JSON.parse(readFileSync(st, 'utf8')) as { vat: never[]; khoi: Record<string, { co: number[] }>; may: Record<string, Partial<May3d>> };
let id = 0;
const ds = kb.canh.flatMap((c) => c.shot.map((s) => ({ id: ++id, thu_tu: id, ma: s.ma, phan_doan: c.ten, may_3d: set.may[s.ma] ? ({ dat: [0, 0, 0], nhin: [0, 1, 0], ong_kinh: 35, ...set.may[s.ma] } as May3d) : null })))
  .filter((x) => x.may_3d && !bo.includes(x.ma));
const lm = lienMachTap(ds, (t) => set.khoi[t] ?? null); const cy = chuoiChuY(ds, choVatSet({ du_lieu: { vat: set.vat } }));
let loi = 0;
for (const c of ds) { const l = [...(lm[c.id] ?? []), ...(cy[c.id] ?? [])]; if (l.length) { loi++; console.log(c.ma, l.join(' | ')); } }
console.log(`${ds.length} shot có 3D · ${loi} shot lỗi mạch`);
process.exit(loi ? 1 : 0);
