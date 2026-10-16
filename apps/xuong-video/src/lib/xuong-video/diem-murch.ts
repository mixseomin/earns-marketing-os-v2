// ĐIỂM MURCH của từng shot (anh 15/10/2026: "sinh bộ tính điểm dựa vào luật của Murch cho mỗi shot dựa vào cảnh trước, cảnh sau, cảnh hiện tại và toàn cảnh").
// Walter Murch — In the Blink of an Eye, Rule of Six: cảm xúc 51 · truyện 23 · nhịp 10 · eye trace 7 · mặt phẳng màn hình (trục) 5 · không gian 3 chiều 4.
// Đây là ƯỚC LƯỢNG từ dữ liệu đang có (thẻ shot, kỹ thuật, 3D, cổng) — không ai đo được "cảm xúc 51%" bằng số; phần cảm xúc / truyện dùng dấu hiệu
// gián tiếp (có thấy mặt, vai phản ứng, cung cảm xúc đổi bậc, mục đích / motif / gài–trả có ghi). Dùng để SO SÁNH shot trong tập và tìm shot yếu,
// không phải điểm tuyệt đối. Thuần: nhận dữ liệu, không gọi DB / model. Chưa có bên nào bán sẵn thang này (nghiên cứu dựng tự động: Galvane 2015,
// Leake 2017 có hàm chi phí liên tục / nhịp, không có cảm xúc).
import type { Canh, NhanVat, BoSet, PhanCanh } from './kieu';
import { giayPhat } from './kieu';
import { camXucDo, loiMachBieuCam } from './qc-cam-xuc';
import { loiMachTap, matQuayDi, vuotTruc, shotSoTruc, chuThe, boSetCuaShot, loiHinhHoc, VAI_GOC_RIENG, PT_THAY } from './bo-set-3d';
import { giayDoc } from './nhip-hinh';

export type TieuChi = 'cam_xuc' | 'truyen' | 'nhip' | 'eye_trace' | 'hai_chieu' | 'ba_chieu';
export const TRONG_SO: Record<TieuChi, number> = { cam_xuc: 51, truyen: 23, nhip: 10, eye_trace: 7, hai_chieu: 5, ba_chieu: 4 };
export const TEN_TIEU_CHI: Record<TieuChi, string> = { cam_xuc: 'Cảm xúc', truyen: 'Truyện', nhip: 'Nhịp', eye_trace: 'Eye trace', hai_chieu: 'Mặt phẳng màn hình (trục)', ba_chieu: 'Không gian 3 chiều' };
/** phan = 0…1 từng tiêu chí; tong = 0…100 theo trọng số Murch; ly_do = vì sao mất điểm (ngắn, một câu / tiêu chí). */
export type DiemMurch = { tong: number; phan: Record<TieuChi, number>; ly_do: Partial<Record<TieuChi, string>> };

type Shot = Pick<Canh, 'id' | 'thu_tu' | 'phan_doan' | 'nhan_vat' | 'cam_xuc' | 'hanh_dong' | 'ky_thuat' | 'dan_dung' | 'may_3d' | 'khung_xam' | 'phat_s' | 'thoi_luong_s' | 'thoai'> & Partial<Pick<Canh, 'bieu_cam' | 'soat' | 'keyframe_url' | 'video_url' | 'video_cuoi_url'>> & { nhanh?: string };
type NV = Pick<NhanVat, 'id' | 'ten' | 'loai' | 'bo_set_id' | 'khoi_3d'>;
const kep = (x: number) => Math.max(0, Math.min(1, x));
const tamThay = (c: Shot, ten: string) => { const t = c.khung_xam?.thay?.find((x) => x.ten === ten); return t && t.pt >= PT_THAY ? { x: (t.hop[0] + t.hop[2]) / 2, y: (t.hop[1] + t.hop[3]) / 2 } : null; };

/** Điểm Murch của mọi shot trong một nhánh (đã xếp theo thứ tự phát). gag: cú bùng của từng cảnh (phan_canh[].gag) để thưởng shot phản ứng sau bùng. */
export function diemMurchTap(ds: Shot[], nhanVat: NV[], sets: Pick<BoSet, 'id' | 'du_lieu'>[], p: { khong_loi?: boolean; laQc?: boolean; phanCanh?: Pick<PhanCanh, 'ten' | 'gag'>[] } = {}): Record<number, DiemMurch> {
  const out: Record<number, DiemMurch> = {};
  const laNv = (t: string) => nhanVat.some((x) => x.loai === 'nhan_vat' && x.ten === t);
  const tenNv = new Set(nhanVat.filter((x) => x.loai === 'nhan_vat').map((x) => x.id));
  // Lỗi mạch (một lần cho cả nhánh) — phân loại theo nội dung câu cổng (bo-set-3d.ts): mỗi câu đã mang tên luật ở đầu.
  const mach = loiMachTap(ds as Parameters<typeof loiMachTap>[0], nhanVat, sets);
  const machBieuCam = p.laQc ? loiMachBieuCam(ds, nhanVat) : {};
  const loai = (s: string): TieuChi | 'truyen_chuoi' => /NHÌN|THẤY|LÀM|chuỗi chú ý/.test(s) ? 'truyen_chuoi' : /TỔNG THỂ/.test(s) ? 'truyen' : /đứt mạch|quay ngoắt|đã chia|trạng thái|đang cầm|đảo \(|trục chuyển động/.test(s) ? 'ba_chieu' : /hướng máy chủ|qua trục liền nhau|đối mặt|cùng hướng/.test(s) ? 'hai_chieu' : 'ba_chieu';
  const giayChuan = giayDoc(p);
  const bungCua = new Map<string, Set<number>>(); for (const pc of p.phanCanh ?? []) for (const g of pc.gag ?? []) if (g.o_shot) (bungCua.get(pc.ten) ?? bungCua.set(pc.ten, new Set()).get(pc.ten)!).add(g.o_shot);
  const viTriTrongCanh = new Map<number, number>(); { let d = ''; let k = 0; for (const c of ds) { if (c.phan_doan !== d) { d = c.phan_doan; k = 0; } viTriTrongCanh.set(c.id, ++k); } }
  for (let i = 0; i < ds.length; i++) {
    const c = ds[i]!; const a = i > 0 && ds[i - 1]!.phan_doan === c.phan_doan ? ds[i - 1]! : null;
    const kt = c.ky_thuat ?? {}; const vai = kt.vai ?? ''; const dd = c.dan_dung ?? {}; const phat = giayPhat(c);
    const coNv = c.nhan_vat.some((id) => tenNv.has(id)); const ly: Partial<Record<TieuChi, string>> = {};
    const lm = mach[c.id] ?? [];
    // ── CẢM XÚC (51): thấy mặt · vai kể mang cảm xúc · cung cảm xúc đổi bậc · giữ phản ứng · có diễn xuất ghi ──
    let cx = 0; const thieuCx: string[] = [];
    const matOk = coNv && c.may_3d ? !matQuayDi(c, laNv).length : true;
    cx += coNv ? (matOk ? 0.3 : 0) : 0.15; if (coNv && !matOk) thieuCx.push('máy không thấy mặt');
    cx += ['phan_ung', 'tam_trang', 'chu_quan'].includes(vai) ? 0.25 : ['hanh_dong', 'chi_tiet', 'nguoi_thu_ba'].includes(vai) ? 0.15 : 0.08;
    if (!['phan_ung', 'tam_trang', 'chu_quan'].includes(vai)) thieuCx.push('không phải shot cảm xúc (phản ứng / tâm trạng / POV)');
    const doiBac = a ? Math.abs((c.cam_xuc ?? 0) - (a.cam_xuc ?? 0)) >= 1 : (c.cam_xuc ?? 0) !== 0;
    cx += doiBac ? 0.2 : 0; if (!doiBac) thieuCx.push('cảm xúc khán giả không đổi bậc so với shot trước');
    const sauBung = a && bungCua.get(c.phan_doan)?.has(viTriTrongCanh.get(a.id)!) && vai === 'phan_ung';
    if (vai === 'phan_ung') { cx += phat >= 1.5 ? 0.15 : 0.05; if (phat < 1.5) thieuCx.push('phản ứng chưa giữ đủ 1,5 giây'); }
    if (sauBung) cx += 0.1;
    if (kt.dien_xuat || dd.dien?.trim() || (c.thoai ?? []).some((t) => t.dien_xuat?.trim())) cx += 0.1; else thieuCx.push('chưa ghi diễn xuất');
    // QC: cảm xúc ĐO THẬT (soát keyframe / clip — qc-cam-xuc.ts) thay phần ước lượng; lệch liền mạch biểu cảm với shot trước thì 0.
    const doCx = p.laQc ? camXucDo({ keyframe_url: c.keyframe_url ?? null, video_url: c.video_url ?? null, video_cuoi_url: c.video_cuoi_url ?? null, soat: c.soat }) : null; const machBc = p.laQc ? (machBieuCam[c.id] ?? []) : [];
    if (doCx) { cx = doCx.diem; thieuCx.length = 0; if (doCx.ly_do) thieuCx.push(doCx.ly_do); }
    if (machBc.length) { cx = 0; thieuCx.push(...machBc); }
    const camXuc = kep(cx); if (thieuCx.length) ly.cam_xuc = thieuCx.join(' · ');
    // ── TRUYỆN (23): hành động chính · mục đích · motif / gài–trả · chuỗi nhìn → thấy → làm · điểm nhấn ở shot bùng ──
    let tr = 0; const thieuTr: string[] = [];
    if (c.hanh_dong?.trim()) tr += 0.2; else thieuTr.push('chưa có hành động chính');
    if (dd.muc_dich?.trim()) tr += 0.2; else thieuTr.push('chưa ghi mục đích');
    if (dd.motif?.trim() || (kt.luat ?? []).some((l) => ['tu_ke_du', 'motif', 'chenh_thong_tin', 'gia_tri_doi'].includes(l))) tr += 0.2; else thieuTr.push('không gài / trả / motif');
    const loiChuoi = lm.filter((s) => loai(s) === 'truyen_chuoi'); tr += loiChuoi.length ? 0 : 0.2; if (loiChuoi.length) thieuTr.push('đứt chuỗi nhìn → thấy → làm');
    const laBung = !!bungCua.get(c.phan_doan)?.has(viTriTrongCanh.get(c.id)!); tr += laBung ? (dd.nhan?.trim() ? 0.2 : 0) : 0.2; if (laBung && !dd.nhan?.trim()) thieuTr.push('shot bùng gag chưa ghi điểm nhấn');
    const loiTt = lm.filter((s) => loai(s) === 'truyen'); if (loiTt.length) { tr -= 0.2; thieuTr.push('cảnh thiếu shot tổng thể'); }
    const truyen = kep(tr); if (thieuTr.length) ly.truyen = thieuTr.join(' · ');
    // ── NHỊP (10): giây phát vừa đọc · khác shot trước về cỡ / chuyển động · phản ứng không cắt vội ──
    let nh = 0; const thieuNh: string[] = [];
    const tren = giayChuan * 2 + 1; nh += phat >= giayChuan && phat <= tren ? 0.5 : phat < giayChuan ? kep(0.5 * (phat / giayChuan)) : kep(0.5 * (tren / phat));
    if (phat < giayChuan) thieuNh.push(`phát ${phat}s ngắn hơn giây đọc ${giayChuan}s`); if (phat > tren) thieuNh.push(`phát ${phat}s dài quá (trần ${tren}s)`);
    const giong = a && a.ky_thuat?.co_canh && a.ky_thuat.co_canh === kt.co_canh && (a.ky_thuat.chuyen_dong ?? 'tinh') === (kt.chuyen_dong ?? 'tinh');
    nh += giong ? 0 : 0.3; if (giong) thieuNh.push('cùng cỡ + cùng chuyển động máy với shot trước');
    nh += vai === 'phan_ung' && phat < 1.5 ? 0 : 0.2;
    const nhip = kep(nh); if (thieuNh.length) ly.nhip = thieuNh.join(' · ');
    // ── EYE TRACE (7): tâm chủ thể shot trước ↔ shot này (từ hộp bao 3D); góc riêng / thiếu số → 0,8 ──
    let et = 0.8;
    if (a && c.may_3d && a.may_3d && !VAI_GOC_RIENG.has(vai) && !VAI_GOC_RIENG.has(a.ky_thuat?.vai ?? '')) {
      const sa = chuThe(a.may_3d)[0], sb = chuThe(c.may_3d)[0]; const ta = sa ? tamThay(a, sa) : null, tb = sb ? tamThay(c, sb) : null;
      if (ta && tb) { const d = Math.hypot(ta.x - tb.x, ta.y - tb.y); et = kep(1 - d / 0.6); if (d > 0.35) ly.eye_trace = `mắt phải dời ${Math.round(d * 100)}% khung từ ${sa} sang ${sb}`; }
    }
    // ── MẶT PHẲNG MÀN HÌNH (5): trục 180° · hướng máy chủ · đối mặt ──
    let hc = 1; const thieuHc: string[] = [];
    if (c.may_3d && !c.may_3d.qua_truc) {
      const sid = boSetCuaShot(c, nhanVat); const set = sets.find((x) => x.id === sid);
      const tr0 = set ? shotSoTruc(ds.filter((x) => boSetCuaShot(x, nhanVat) === sid) as Parameters<typeof shotSoTruc>[0], ds.filter((x) => boSetCuaShot(x, nhanVat) === sid).findIndex((x) => x.id === c.id)) : null;
      if (tr0?.may_3d && vuotTruc(tr0.may_3d, c.may_3d, laNv)) { hc -= 0.5; thieuHc.push('máy sang phía bên kia trục'); }
    } else if (c.may_3d?.qua_truc) hc = 0.8;
    const loiHc = lm.filter((s) => loai(s) === 'hai_chieu'); if (loiHc.length) { hc -= 0.3; thieuHc.push('lệch hướng máy chủ / đối mặt'); }
    const haiChieu = kep(hc); if (thieuHc.length) ly.hai_chieu = thieuHc.join(' · ');
    // ── KHÔNG GIAN 3 CHIỀU (4): liền mạch chỗ đứng / trạng thái / hướng đi · hình học khung ──
    let bc = 1; const thieuBc: string[] = [];
    const loiBc = lm.filter((s) => loai(s) === 'ba_chieu'); if (loiBc.length) { bc -= 0.5; thieuBc.push('đứt mạch chỗ đứng / trạng thái / hướng đi'); }
    if (c.may_3d && loiHinhHoc(c).length) { bc -= 0.3; thieuBc.push('chủ thể ngoài khung / bị che'); }
    if (!c.may_3d) { bc = 0.6; thieuBc.push('chưa có 3D'); }
    const baChieu = kep(bc); if (thieuBc.length) ly.ba_chieu = thieuBc.join(' · ');
    const phan: Record<TieuChi, number> = { cam_xuc: camXuc, truyen, nhip, eye_trace: et, hai_chieu: haiChieu, ba_chieu: baChieu };
    const tong = Math.round((Object.keys(TRONG_SO) as TieuChi[]).reduce((s, k) => s + TRONG_SO[k] * phan[k], 0));
    out[c.id] = { tong, phan, ly_do: ly };
  }
  return out;
}

/** Trung bình theo cảnh + cả nhánh — để đặt điểm một shot cạnh "cảnh này / cả tập" (so sánh, không tuyệt đối). */
export function diemMurchCanh(ds: Pick<Shot, 'id' | 'phan_doan'>[], diem: Record<number, DiemMurch>): { canh: Record<string, number>; tap: number } {
  const canh: Record<string, number> = {}; const dem: Record<string, number> = {}; let tong = 0, n = 0;
  for (const c of ds) { const d = diem[c.id]; if (!d) continue; canh[c.phan_doan] = (canh[c.phan_doan] ?? 0) + d.tong; dem[c.phan_doan] = (dem[c.phan_doan] ?? 0) + 1; tong += d.tong; n++; }
  for (const k of Object.keys(canh)) canh[k] = Math.round(canh[k]! / dem[k]!);
  return { canh, tap: n ? Math.round(tong / n) : 0 };
}
/** Màu điểm: ≥ 75 xanh · 55–74 vàng · < 55 đỏ. */
export const mauDiem = (d: number) => (d >= 75 ? '#4ade80' : d >= 55 ? 'var(--amber)' : 'var(--red)');
