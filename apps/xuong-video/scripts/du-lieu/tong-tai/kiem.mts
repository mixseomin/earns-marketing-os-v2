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
import { kiemNguPhapMay, diCm } from '../../../src/lib/xuong-video/ngu-phap-may';
import { kiemNhipHinh, kiemGiayDoc, kiemVaiKe, kiemDanKhongGian } from '../../../src/lib/xuong-video/nhip-hinh';
import { loiMachTap, canhBaoMachTap, thieuKhaiNguoi, gocMayLech } from '../../../src/lib/xuong-video/bo-set-3d';

const D = dirname(fileURLToPath(import.meta.url));
const doc = (f: string) => JSON.parse(readFileSync(join(D, f), 'utf8'));
const phim = doc('phim.json'); const sets = doc('bo-set.json') as { ten: string; boi_canh: string; vat: unknown[] }[]; const shots = doc('shot.json') as Record<string, never>[];
const boChu = process.argv.includes('--bo-chu');

const nv = (phim.nhan_vat as { ten: string; loai: string; khoi_3d?: unknown }[]).map((a, i) => ({ id: i + 1, ten: a.ten, loai: a.loai, khoi_3d: a.khoi_3d ?? null, bo_set_id: a.loai === 'boi_canh' ? sets.findIndex((s) => s.boi_canh === a.ten) + 1 || null : null }));
const boSet = sets.map((s, i) => ({ id: i + 1, du_lieu: { vat: s.vat } }));
const phanCanh = phim.tap.phan_canh as { ten: string; ngay?: string; lien_truoc?: boolean }[];
const idCua = (t: string) => { const x = nv.find((a) => a.ten === t); if (!x) throw new Error(`shot nhắc "${t}" mà phim.json không có anchor`); return x.id; };
const ds = shots.map((s: Record<string, any>, i) => ({ id: i + 1, thu_tu: i + 1, canh: s.canh, phan_doan: s.canh, nhan_vat: (s.nhan_vat as string[]).map(idCua), may_3d: mayShot(s.may_3d, s.ky_thuat, (t: string) => (phim.nhan_vat as { ten: string; khoi_3d?: { co: number[] } }[]).find((a) => a.ten === t)?.khoi_3d ?? null), ky_thuat: s.ky_thuat, hanh_dong: s.hanh_dong, dan_dung: s.dan_dung, prompt_video: s.prompt_video, ma: s.ma }));

// Cổng tiền kỳ phần dữ liệu shot (quy-trinh.ts › chanTienKy gọi đúng các hàm này) — trước 17/10/2026 bộ chấm này bỏ sót, tập mẫu trượt nhịp hình (12/20 shot đứng yên).
const nt = ds.map((c, i) => ({ thu_tu: c.thu_tu, ky_thuat: c.ky_thuat, bieu_cam: (shots[i] as Record<string, any>).bieu_cam, dan_dung: c.dan_dung, hanh_dong: c.hanh_dong, di_cm: diCm(c.may_3d?.vi_tri), cuoi: i === ds.length - 1, phan_doan: c.phan_doan, phat_s: (shots[i] as Record<string, any>).phat_s, thoi_luong_s: (shots[i] as Record<string, any>).thoi_luong_s }));
const tienKy = [...kiemNhipHinh(nt), ...kiemNguPhapMay(nt as never, phim.kinh_thanh.the_loai), ...kiemGiayDoc(nt as never, {}), ...kiemVaiKe(nt as never, {} as never), ...kiemDanKhongGian(ds as never, nv.filter((a) => a.loai === 'boi_canh').map((a) => a.id), {})];
console.log(`tiền kỳ: ${tienKy.length ? tienKy.map((x) => '\n  CHẶN ' + x).join('') : 'đạt'}`);
const kb = chamKichBan({ tap: { so: 1, beats: phim.tap.beats, phan_canh: phanCanh as never }, kt: phim.kinh_thanh,
  canh: shots.map((s: Record<string, any>) => ({ phat_s: s.phat_s, thoi_luong_s: s.thoi_luong_s, phan_doan: s.canh, chu_man: s.chu_man, thoai: s.thoai, loi_thoai: '', hanh_dong: s.hanh_dong })) as never });
console.log(`kịch bản ${kb.diem}/100`); for (const m of kb.muc) if (!m.dat) console.log('  ✗', m.ten, '—', m.ghi);
const chan = loiMachTap(ds as never, nv as never, boSet as never, phanCanh);
const canh = canhBaoMachTap(ds as never, (t) => nv.some((a) => a.loai === 'nhan_vat' && a.ten === t), phanCanh);
const khai = thieuKhaiNguoi(ds as never, phanCanh);
let nChan = 0, nCanh = 0;
for (const c of ds) {
  const l = chan[c.id] ?? [];
  const w = [...(canh[c.id] ?? []), ...(khai[c.id] ?? []), gocMayLech(c.may_3d, c.ky_thuat?.goc)].filter((x): x is string => !!x && !(boChu && x.startsWith('chữ lệch 3D')));
  nChan += l.length; nCanh += w.length;
  if (l.length || w.length) console.log(`#${c.thu_tu} (${c.ma})`, [...l.map((x) => 'CHẶN ' + x), ...w.map((x) => '⚐ ' + x)].join('\n    '));
}
console.log(`— ${ds.length} shot · ${nChan} chặn · ${nCanh} cảnh báo`);
process.exitCode = nChan || tienKy.length ? 1 : 0;
