// CHẤM TẠI CHỖ tập mẫu tổng tài — đọc thẳng phim.json + bo-set.json + shot.json (không cần DB / nạp lên box), chạy đúng các cổng studio chạy:
// điểm kịch bản (chamKichBan, có cả shot — mục cảm xúc mạnh / nút thắt đọc thoại + hành động shot); trên lưới: loiMachTap (liền mạch, chuỗi chú ý, nhịp dẫn, tổng thể, hướng đi, đối mặt) = CHẶN; canhBaoMachTap + thieuKhaiNguoi + gocMayLech = ⚐.
// Sửa dung-shot.py / dung-bo-set.py → python3 … → chạy lại tới khi hết CHẶN, rồi mới nạp (nap.mts).
//   node_modules/.bin/tsx apps/xuong-video/scripts/du-lieu/tong-tai/kiem.mts      (từ gốc repo)
// "chữ lệch 3D" cần khung xám Blender (khung_xam.thay) — chưa dựng previs thì cổng đó báo hết, bỏ qua bằng --bo-chu.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chamKichBan } from '../../../src/lib/xuong-video/cham-kich-ban';
import { mayShot } from './may-shot';
import { chanTienKy, chanShot, phimQt } from '../../../src/lib/xuong-video/quy-trinh';
import { TIEN_TO_NGUOI_XEM } from '../../../src/lib/xuong-video/nguoi-xem';
import { loiMachTap, canhBaoMachTap, thieuKhaiNguoi, gocMayLech, loiNoiMay, shotSoTruc, boSetCuaShot } from '../../../src/lib/xuong-video/bo-set-3d';

const D = dirname(fileURLToPath(import.meta.url));
const doc = (f: string) => JSON.parse(readFileSync(join(D, f), 'utf8'));
const phim = doc('phim.json'); const sets = doc('bo-set.json') as { ten: string; boi_canh: string; vat: unknown[] }[]; const shots = doc('shot.json') as Record<string, never>[];
const boChu = process.argv.includes('--bo-chu');

// biến thể (sổ trang phục): ảnh chỉ có trên DB — ở đây coi như có (lookChuaChuan vẫn chặn chữ tự do + thiếu dáng nghỉ)
const nv = (phim.nhan_vat as { ten: string; loai: string; khoi_3d?: unknown; bien_the?: { nhom: string; ten: string; mo_ta: string; dan_3d?: unknown }[] }[]).map((a, i) => ({ id: i + 1, ten: a.ten, loai: a.loai, khoi_3d: a.khoi_3d ?? null,
  bien_the: (a.bien_the ?? []).map((b, k) => ({ id: (i + 1) * 100 + k, nhan_vat_id: i + 1, ...b, anh_url: '(cục bộ)' })), bo_set_id: a.loai === 'boi_canh' ? sets.findIndex((s) => s.boi_canh === a.ten) + 1 || null : null }));
const boSet = sets.map((s, i) => ({ id: i + 1, du_lieu: { vat: s.vat } }));
const phanCanh = phim.tap.phan_canh as { ten: string; ngay?: string; lien_truoc?: boolean }[];
const idCua = (t: string) => { const x = nv.find((a) => a.ten === t); if (!x) throw new Error(`shot nhắc "${t}" mà phim.json không có anchor`); return x.id; };
const ds = shots.map((s: Record<string, any>, i) => ({ id: i + 1, thu_tu: i + 1, canh: s.canh, phan_doan: s.canh, nhan_vat: (s.nhan_vat as string[]).map(idCua), may_3d: mayShot(s.may_3d, s.ky_thuat, (t: string) => (phim.nhan_vat as { ten: string; khoi_3d?: { co: number[] } }[]).find((a) => a.ten === t)?.khoi_3d ?? null), ky_thuat: s.ky_thuat, hanh_dong: s.hanh_dong, dan_dung: s.dan_dung, prompt_video: s.prompt_video, ma: s.ma }));

// Cổng tiền kỳ = ĐÚNG hàm cổng keyframe chạy (sinh-anh.ts › lyChanKeyframe → quy-trinh.ts › chanTienKy + chanShot), không tự lắp danh sách:
// 17/10/2026 bộ chấm tự lắp báo "0 chặn" trong khi cổng thật chặn cả 20 shot (thẻ shot, kết tập ba nhịp, liền mạch biểu cảm). Người xem ảo đọc DB
// (thu_nguoi_xem) — ở đây chỉ nhắc, không tính chặn; ảnh gốc anchor cũng chỉ có trên DB (coi như có).
const nvQt = nv.map((a, i) => ({ ...a, mo_ta: (phim.nhan_vat as { mo_ta?: string }[])[i]!.mo_ta ?? '', anh_ref: ['(cục bộ)'], bien_the: [] }));
const canhQt = ds.map((c, i) => ({ ...c, phat_s: (shots[i] as Record<string, any>).phat_s, thoi_luong_s: (shots[i] as Record<string, any>).thoi_luong_s, chu_man: (shots[i] as Record<string, any>).chu_man,
  thoai: (shots[i] as Record<string, any>).thoai, loi_thoai: '', bieu_cam: (shots[i] as Record<string, any>).bieu_cam, prompt_anh: (shots[i] as Record<string, any>).prompt_anh || 'x', bien_the: [], nhanh: '' }));
const tapQt = { so: 1, brief: phim.tap.brief ?? '', beats: phim.tap.beats, phan_canh: phanCanh as never, thu_nguoi_xem: null, nhac_url: null, nhac_phan_canh: {} };
const pq = phimQt(phim.loai, phim.kinh_thanh);
const tatCaTk = [...chanTienKy(tapQt, pq, canhQt as never, canhQt as never, nv.filter((a) => a.loai === 'boi_canh').map((a) => a.id)),
  ...canhQt.flatMap((c) => chanShot(c as never, tapQt, nvQt as never, { camXucQc: pq.camXucQc, ds: canhQt as never }).map((x) => `#${c.thu_tu} ${x}`))];
const tienKy = tatCaTk.filter((x) => !x.startsWith(TIEN_TO_NGUOI_XEM));
if (tatCaTk.length > tienKy.length) console.log('ℹ người xem ảo: đọc trên DB (kiem-nguoi-xem.mts), không chấm ở đây');
console.log(`tiền kỳ: ${tienKy.length ? tienKy.map((x) => '\n  CHẶN ' + x).join('') : 'đạt'}`);
const kb = chamKichBan({ tap: { so: 1, beats: phim.tap.beats, phan_canh: phanCanh as never }, kt: phim.kinh_thanh,
  canh: shots.map((s: Record<string, any>) => ({ phat_s: s.phat_s, thoi_luong_s: s.thoi_luong_s, phan_doan: s.canh, chu_man: s.chu_man, thoai: s.thoai, loi_thoai: '', hanh_dong: s.hanh_dong })) as never });
console.log(`kịch bản ${kb.diem}/100`); for (const m of kb.muc) if (!m.dat) console.log('  ✗', m.ten, '—', m.ghi);
const chan = loiMachTap(ds as never, nv as never, boSet as never, phanCanh);
const canh = canhBaoMachTap(ds as never, (t) => nv.some((a) => a.loai === 'nhan_vat' && a.ten === t), phanCanh);
const khai = thieuKhaiNguoi(ds as never, phanCanh);
let nChan = 0, nCanh = 0;
ds.forEach((c, i) => { const sid = boSetCuaShot(c as never, nv as never); if (sid) (chan[c.id] ??= []).push(...loiNoiMay(c as never, nv as never, { id: sid }, i > 0 ? shotSoTruc(ds as never, i) : null)); });   // nối máy: cùng hàm cổng keyframe, không cần dựng
for (const c of ds) {
  const l = chan[c.id] ?? [];
  const w = [...(canh[c.id] ?? []), ...(khai[c.id] ?? []), gocMayLech(c.may_3d, c.ky_thuat?.goc)].filter((x): x is string => !!x && !(boChu && x.startsWith('chữ lệch 3D')));
  nChan += l.length; nCanh += w.length;
  if (l.length || w.length) console.log(`#${c.thu_tu} (${c.ma})`, [...l.map((x) => 'CHẶN ' + x), ...w.map((x) => '⚐ ' + x)].join('\n    '));
}
console.log(`— ${ds.length} shot · ${nChan} chặn · ${nCanh} cảnh báo`);
process.exitCode = nChan || tienKy.length ? 1 : 0;
