// QUY TRÌNH CHUẨN NGÀNH của một video (12/10/2026 — anh: "phải có tự động chứ tao cứ phải nhắc từng tí một"). Một bảng duy nhất các bước
// tiền kỳ → sản xuất → hậu kỳ mà đoàn phim/agency làm trước khi tiêu tiền; mỗi bước tốn tiền (keyframe, video, xuất) có CỔNG:
// bước nào gác cổng đó mà chưa đạt thì máy chủ từ chối (sinhKeyframeCanh, batDauVideoCanh) và thanh 🎬 Quy trình trên studio chỉ đúng
// chỗ thiếu + cách làm. Thêm một chuẩn mới = thêm MỘT mục ở đây, không vá từng nút. Khác kiem-qc.ts: bên đó chấm NỘI DUNG quảng cáo
// (hook, CTA, bằng chứng), bên này chấm QUY TRÌNH sản xuất. Thuần — tự kiểm: quy-trinh.test.mts.
import { thanhPhanCanh, type Canh, type NhanVat, type PhanCanh } from './kieu';
import type { Beat } from './dien-anh';
import { dongThoai } from './am-thanh';
import { chamKichBan } from './cham-kich-ban';
import type { Series } from './kieu';

export type Cong = 'keyframe' | 'video' | 'xuat';
export type NhomQt = 'Tiền kỳ' | 'Sản xuất' | 'Hậu kỳ';
export type MucQt = { key: string; nhom: NhomQt; ten: string; ok: boolean; thieu: string[]; cong: Cong | null; lam: string };
export type TapQt = { so?: number; brief: string; beats: Pick<Beat, 'ten' | 'cam_xuc'>[]; phan_canh: (Pick<PhanCanh, 'ten'> & Partial<Pick<PhanCanh, 'beat'>>)[]; nhac_url: string | null; nhac_phan_canh: Record<string, string> };
export type PhimQt = { phong_cach?: string; ti_le?: string; logo_url?: string; laQc: boolean; logline?: string; series?: Series | null };
type ShotQt = Pick<Canh, 'id' | 'thu_tu' | 'phat_s' | 'thoi_luong_s' | 'thoai_url' | 'nhan_vat' | 'bien_the' | 'prompt_anh' | 'hanh_dong' | 'phan_doan' | 'keyframe_url' | 'trang_thai' | 'ky_thuat' | 'thoai' | 'loi_thoai' | 'chu_man'>;

/** Luật anh 12/10/2026: MỌI video phải có PHÂN CẢNH cụ thể (mục tiêu · xung đột · cảm xúc đầu→cuối) trước khi sinh keyframe —
 *  shot nào không thuộc một phân cảnh đã khai (phan_doan khớp tên trong tap.phan_canh) thì chưa được sinh. MỘT luật cho bảng chọn,
 *  máy chủ (sinhKeyframeCanh) và script nạp shot (nap-canh). null = đạt. */
export function thieuPhanCanh(phanCanh: Pick<PhanCanh, 'ten'>[], c: Pick<Canh, 'phan_doan'>): string | null {
  if (!phanCanh.length) return 'tập chưa có phân cảnh — ✂ Tách cảnh (hoặc nạp kèm phanCanh) trước khi sinh keyframe';
  if (!phanCanh.some((x) => x.ten === c.phan_doan)) return c.phan_doan ? `phân cảnh "${c.phan_doan}" chưa khai trong tập` : 'shot chưa thuộc phân cảnh nào';
  return null;
}

/** Luật anh 12/10/2026 (nhắc hai lần): keyframe phải đứng trên MẪU — mỗi shot sinh ảnh gắn ≥1 anchor Bối cảnh, và đối tượng của phim
 *  (người, sản phẩm, đạo cụ) được nhắc tên trong prompt thì phải gắn mẫu, không để model vẽ theo chữ (mỗi shot một khuôn mặt / một căn phòng).
 *  Ảnh mẫu thiếu thì thanhPhanCanh đã chặn. nhanVat = MỌI anchor của phim. MỘT luật cho bảng chọn, máy chủ và script. */
export function thieuMau(c: Pick<Canh, 'nhan_vat' | 'prompt_anh' | 'hanh_dong'>, nhanVat: Pick<NhanVat, 'id' | 'ten' | 'loai'>[]): string[] {
  const out: string[] = [];
  const gan = nhanVat.filter((v) => c.nhan_vat.includes(v.id));
  if (!gan.some((v) => v.loai === 'boi_canh')) out.push(nhanVat.some((v) => v.loai === 'boi_canh') ? 'chưa gắn bối cảnh — gắn một anchor Bối cảnh (mục 2) để mọi shot cùng nơi trông như một chỗ' : 'phim chưa có anchor Bối cảnh nào — tả + sinh ảnh mẫu các nơi chốn lặp lại (mục 2) trước khi sinh keyframe');
  const chu = ` ${c.prompt_anh} ${c.hanh_dong} `.toLowerCase();
  for (const v of nhanVat) {
    if (v.loai === 'boi_canh' || v.loai === 'phong_cach' || c.nhan_vat.includes(v.id) || v.ten.trim().length < 3) continue;
    const t = v.ten.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^|[^\\p{L}])${t}([^\\p{L}]|$)`, 'u').test(chu)) out.push(`"${v.ten}" có trong prompt mà chưa gắn mẫu`);
  }
  return out;
}

/** Shot cần SINH ảnh: chưa có keyframe. Shot dùng ảnh có sẵn (ảnh chụp thật, thẻ kết) đã có keyframe nên không phải qua cổng mẫu. */
const canSinh = (c: ShotQt) => !c.keyframe_url;

/** Cổng tiền kỳ cấp TẬP — áp cho mọi shot trước khi sinh keyframe. */
/** Chấm kịch bản tập (cham-kich-ban.ts) theo dữ liệu cổng. */
const chamTap = (tap: TapQt, phim: PhimQt, canh: Pick<Canh, 'phat_s' | 'thoi_luong_s' | 'phan_doan' | 'chu_man' | 'thoai' | 'loi_thoai'>[]) =>
  chamKichBan({ tap: { so: tap.so, beats: tap.beats, phan_canh: tap.phan_canh.map((p) => ({ ten: p.ten, beat: p.beat ?? '' })) }, canh, kt: { logline: phim.logline, series: phim.series } });
/** `canh` = các shot của tập (theo thứ tự) — có thì chấm cả hook 3 giây đầu. Phim có KINH THÁNH SERIES thì kịch bản chưa đạt (logline, 5 nhịp,
 *  hook) cũng chặn keyframe; phim lẻ chỉ hiện điểm trên thanh 🎬 Quy trình. */
export function chanTienKy(tap: TapQt, phim: PhimQt, canh: Pick<Canh, 'phat_s' | 'thoi_luong_s' | 'phan_doan' | 'chu_man' | 'thoai' | 'loi_thoai'>[] = []): string[] {
  const out: string[] = [];
  if (phim.series?.dong_co?.trim()) out.push(...chamTap(tap, phim, canh).chan);
  if (tap.brief.trim().length < 20) out.push('chưa có brief (mục tiêu, người xem, thông điệp) — viết ở ô Brief của tập');
  const cx = tap.beats.map((b) => b.cam_xuc);
  if (tap.beats.length < 3) out.push('chưa có khung truyện (≥3 beat: mở – xung đột – giải quyết)');
  else if (!(Math.min(...cx) < 0 && Math.max(...cx) > 0)) out.push('khung truyện phẳng — phải có beat âm (vấn đề/cao trào) và beat dương (giải quyết)');
  if (!tap.phan_canh.length) out.push('chưa có phân cảnh (mục tiêu · xung đột · cảm xúc đầu→cuối)');
  if ((phim.phong_cach ?? '').trim().length < 30) out.push('chưa chốt phong cách hình (style frame: ánh sáng, màu, chất liệu) — mục 1 Kinh thánh');
  return out;
}
/** Cổng tiền kỳ cấp SHOT: phân cảnh + mẫu bối cảnh/đối tượng + ảnh mẫu + ngôn ngữ máy (cỡ cảnh). */
export function chanShot(c: ShotQt, tap: TapQt, nhanVatPhim: NhanVat[]): string[] {
  const out: string[] = [];
  const pc = thieuPhanCanh(tap.phan_canh, c); if (pc) out.push(pc);
  out.push(...thieuMau(c, nhanVatPhim));
  out.push(...thanhPhanCanh(c, nhanVatPhim).thieu);
  if (!c.ky_thuat?.co_canh) out.push('chưa chọn cỡ cảnh (shot list: toàn / trung / cận / đặc tả…)');
  return out;
}
/** Cổng sản xuất cho VIDEO: keyframe duyệt + GIỌNG TRƯỚC VIDEO (Veo tự đọc thoại lơ lớ, in phụ đề giả — mất $0,40 ngày 09/10/2026). */
export function chanVideo(c: ShotQt, nhanVat: NhanVat[]): string[] {
  const out: string[] = [];
  if (!c.keyframe_url) out.push('chưa có keyframe');
  else if (c.trang_thai !== 'duyet' && c.trang_thai !== 'loi' && c.trang_thai !== 'xong') out.push('chưa duyệt keyframe');
  const thieu = dongThoai(c, nhanVat).filter((d) => d.loi.trim() && !d.url);
  if (thieu.length) out.push(`${thieu.length} dòng thoại/lời dẫn chưa có giọng — sinh giọng trước (độ dài shot khớp theo giọng)`);
  return out;
}

/** Bảng quy trình cả tập — thanh 🎬 trên studio. canh = shot nhánh dựng (thân + hook A). */
export function quyTrinh(o: { tap: TapQt; phim: PhimQt; canh: ShotQt[]; nhanVat: NhanVat[] }): MucQt[] {
  const { tap, phim, canh, nhanVat } = o;
  const sinh = canh.filter(canSinh);
  const theoShot = (f: (c: ShotQt) => string | string[] | null, ds = canh) => ds.flatMap((c) => { const r = f(c); const a = Array.isArray(r) ? r : r ? [r] : []; return a.map((x) => `#${c.thu_tu}: ${x}`); });
  const tk = chanTienKy(tap, phim, canh);
  const kb = chamTap(tap, phim, canh);
  const m = (key: string, nhom: NhomQt, ten: string, thieu: string[], cong: Cong | null, lam: string): MucQt => ({ key, nhom, ten, ok: !thieu.length, thieu, cong, lam });
  const coGiong = canh.some((c) => dongThoai(c, nhanVat).some((d) => d.loi.trim()));
  const cat = Math.max(0, canh.length - 1);
  const coSfx = canh.slice(1).filter((c) => (c.ky_thuat?.am_thanh ?? []).length).length;
  const coCc = canh.slice(0, -1).filter((c) => c.ky_thuat?.chuyen_canh).length;
  return [
    m('brief', 'Tiền kỳ', 'Brief', tk.filter((x) => x.startsWith('chưa có brief')), 'keyframe', 'Ô Brief của tập: mục tiêu, người xem, thông điệp chính.'),
    m('truyen', 'Tiền kỳ', 'Khung truyện (beat)', tk.filter((x) => x.includes('khung truyện')), 'keyframe', '✂ Tách cảnh (hoặc nạp kèm beats): mở – xung đột – cao trào – giải quyết.'),
    m('kich_ban', 'Tiền kỳ', `Kịch bản ${kb.diem}/100`, kb.muc.filter((x) => !x.dat).map((x) => `${x.ten}: ${x.ghi}`), phim.series?.dong_co?.trim() ? 'keyframe' : null, 'Logline một câu · hook ≤ 3s · đủ 5 nhịp (hook → vấn đề → leo thang → lật ngược → kết/móc) · lật ngược ở 55–92% phim · series: kết bằng móc.'),
    m('phan_canh', 'Tiền kỳ', 'Phân cảnh', [...tk.filter((x) => x.includes('phân cảnh')), ...theoShot((c) => thieuPhanCanh(tap.phan_canh, c))].filter((x, i, a) => a.indexOf(x) === i), 'keyframe', 'Mỗi phân cảnh: mục tiêu nhân vật, xung đột, cảm xúc đổi đầu→cuối; mỗi shot thuộc một phân cảnh.'),
    m('phong_cach', 'Tiền kỳ', 'Phong cách hình', tk.filter((x) => x.includes('phong cách')), 'keyframe', 'Mục 1 Kinh thánh: ánh sáng, bảng màu, chất liệu, ống kính chủ đạo.'),
    m('mau_doi_tuong', 'Tiền kỳ', 'Mẫu nhân vật / sản phẩm', [...nhanVat.filter((v) => v.loai !== 'boi_canh' && v.loai !== 'phong_cach' && (!v.mo_ta.trim() || !v.anh_ref.length)).map((v) => `${v.ten}: ${!v.mo_ta.trim() ? 'chưa tả' : 'chưa có ảnh mẫu'}`), ...theoShot((c) => thieuMau(c, nhanVat).filter((x) => x.includes('có trong prompt')), sinh)], 'keyframe', 'Mục 2: tả đặc tính cố định + sinh ảnh mẫu; shot nhắc tên thì gắn mẫu.'),
    m('mau_boi_canh', 'Tiền kỳ', 'Mẫu bối cảnh', [...nhanVat.filter((v) => v.loai === 'boi_canh' && !v.anh_ref.length).map((v) => `${v.ten}: chưa có ảnh mẫu`), ...theoShot((c) => thieuMau(c, nhanVat).filter((x) => !x.includes('có trong prompt')), sinh)], 'keyframe', 'Mục 2: mỗi nơi chốn lặp lại một anchor Bối cảnh có ảnh mẫu; gắn vào shot.'),
    m('shot_list', 'Tiền kỳ', 'Shot list (cỡ cảnh, máy)', theoShot((c) => (c.ky_thuat?.co_canh ? null : 'chưa chọn cỡ cảnh'), sinh), 'keyframe', 'Mỗi shot: cỡ cảnh + chuyển động máy (nhóm Ngôn ngữ điện ảnh).'),
    m('keyframe', 'Sản xuất', 'Storyboard (keyframe đã duyệt)', theoShot((c) => (!c.keyframe_url ? 'chưa có keyframe' : c.trang_thai === 'co_keyframe' || c.trang_thai === 'nhap' ? 'chưa duyệt' : null)), 'video', 'Sinh keyframe, xem từng ảnh, ✓ duyệt (hoặc sinh lại).'),
    m('giong', 'Sản xuất', 'Giọng trước video', coGiong ? theoShot((c) => { const n = dongThoai(c, nhanVat).filter((d) => d.loi.trim() && !d.url).length; return n ? `${n} dòng chưa có giọng` : null; }) : [], 'video', 'Sinh giọng cho lời dẫn/thoại TRƯỚC khi sinh clip; giây phát của shot khớp theo giọng.'),
    m('nhac', 'Hậu kỳ', 'Nhạc nền', tap.nhac_url || Object.keys(tap.nhac_phan_canh ?? {}).length ? [] : ['tập chưa có nhạc nền'], 'xuat', 'Làn 🎵 Nhạc: sinh một bài cả tập hoặc theo phân cảnh; rồi 🎯 khớp nhịp.'),
    m('sfx', 'Hậu kỳ', 'Tiếng hiệu ứng', cat && coSfx * 2 < cat ? [`${coSfx}/${cat} điểm cắt có tiếng hiệu ứng`] : [], null, 'Nhóm Âm thanh của shot (đập, vút, dâng…) hoặc ⚡ Nhịp hành động.'),
    m('chuyen_canh', 'Hậu kỳ', 'Chuyển cảnh', cat && coCc * 3 < cat ? [`${coCc}/${cat} điểm cắt có chuyển cảnh`] : [], null, 'Bấm ⇄ ở điểm nối trên làn Hình.'),
    m('logo', 'Hậu kỳ', 'Logo + CTA', phim.laQc ? [...(phim.logo_url ? [] : ['chưa có logo']), ...(canh.length && canh[canh.length - 1]!.chu_man.trim() ? [] : ['shot cuối chưa có chữ CTA'])] : [], null, 'Mục 0: logo PNG nền trong; shot cuối có chữ kêu gọi.'),
  ];
}
