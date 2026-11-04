// KÊNH SẢN PHẨM — phần TÍNH (thuần, client import được; tự kiểm: tsx kenh-sp-tinh.test.mts). Đọc DB ở kenh-sp.ts.
// Kênh nội dung coi là SẢN PHẨM (xv_may.la_san_pham — anh 02/11/2026, kênh Yesterday's News Tonight): số đo hằng ngày ở kenh_so_ngay
// (kenh youtube, san_pham 'may:<mã>', hien = lượt xem cộng dồn, so_muc = video đã đăng, chi_tiet.nguoi_dk) do may-dung.mts --so-kenh ghi.
// 7 ngày = bản ghi mới nhất − bản ghi gần nhất có ngày ≤ hôm nay − 7; chưa có mốc đó = null ("–", chưa đo ≠ 0).

export type SoNgayKenh = { ngay: string; xem: number; daDang: number; nguoiDk: number | null };
export type VideoKenh = { slug: string; ten: string; /** ngày làm xong (bản xuất, không có thì ngày nạp) */ ngayLam: string | null; trangThai: 'chua_xuat' | 'cho_cham' | 'duyet' | 'sua_lai' | 'da_dang'; ngayDang: string | null; url: string | null; xem: number | null; giay: number | null;
  /** mã playlist của tập (xv_may_video.dang.playlist — lam-tap ghi lúc nạp; G1) — null = tập cũ chưa chia playlist */ playlist?: string | null;
  /** mẫu + ý tưởng trong sổ kênh (xv_may_video.dang.mau / y_tuong — lam-tap ghi lúc nạp) — null = kênh chưa có sổ / tập cũ */ mau?: string | null; yTuong?: string | null };
export type KenhSp = {
  ma: string; ten: string; chay: boolean; kenhUrl: string | null;
  tap: number; choDang: number; daDang: number;
  xem: number | null; xem7: number | null; nguoiDk: number | null; nguoiDk7: number | null; ngaySo: string | null; dangCuoi: string | null;
  /** phim Studio quản lý kênh (xv_phim.kinh_thanh.may = mã máy) · ảnh đại diện kênh (trang YouTube, may-dung --so-kenh) */
  phimId: number | null; anh: string | null;
  /** video của kênh (cây dưới dòng kênh): trạng thái theo chặng — chưa xuất → chờ chấm → DUYỆT / SỬA LẠI (Phòng Nội dung) → đã đăng */
  videos: VideoKenh[];
  /** KẾ HOẠCH kênh (anh 02/11/2026: "show plan cụ thể — lịch đăng bài, bài đã sx, đang sx"): lịch làm tập (kenh.json lich_tap + gio_tap), tập đang làm
   *  (xv_may.nguon.dang_lam_ds — mỗi tập một dấu, nhiều tập chạy song song được; chay-kenh / lam-tap ghi qua box3.mjs › dauDangLam), lịch đăng dự kiến của máy đăng (xv_lich_du_kien) */
  ke: { lichTap: string | null; tapKe: string[]; dangLam: DangLam[]; lichDang: { ngay: string; gio: string | null; nen: string; tieuDe: string }[];
    /** giờ VN sớm nhất máy đăng được đăng bài của kênh (xv_may.dang[].gio_tu) */ gioDang: string | null;
    /** tập đang dở chưa nạp máy đăng (xv_may.nguon.tap_cho — chay-kenh.mjs ghi mỗi lượt) */ tapCho?: TapCho[] };
  /** PLAYLIST THẬT của kênh (kenh.json › playlist — máy làm tập chạy theo đây; G1 tầng playlist chung): lịch + số từng playlist. [] = kênh chưa chia playlist */
  playlist?: PlaylistKenh[];
  /** SỔ KÊNH (apps/xuong-video/scripts/lich-su/so-kenh.json theo mã máy — anh 04/11/2026 "cần có nơi tổ chức để sau này lên video mới ko bị chệch hướng"):
   *  định vị + luật + mẫu đã duyệt + hàng chờ ý tưởng + playlist kế hoạch + lộ trình G0…Gn; null = kênh chưa khai sổ */
  so?: SoKenh | null;
  /** ý tưởng tự sinh 60 ngày tới từ nguồn của sổ (so.nguon_y_tuong — vd lịch trời) — hiện trong 💡 Hàng chờ */
  yTuongTuSinh?: YTuong[];
  /** sổ người nổi tiếng của kênh (so.nguoi_tep) — khối 👤 */
  nguoi?: { ds: NguoiLaSo[]; dungNha: string[] } | null;
  /** social trỏ về kênh (bài short dẫn link kênh) — tab Tài sản gắn theo khung ?ky= */
  social?: import('./social-tro-ve-tinh').TroVe | null;
};

/** tập đang dở chưa nạp máy đăng (xv_may.nguon.tap_cho) */
export type TapCho = { id: string; chu_de: string | null; cau: number; lan: number; loi: string | null; tho: string | null; /** 3 lần kẹt → máy bỏ, lượt kế làm đề khác (05/11/2026) */ bo?: boolean };
/** một tập đang trong lò (xv_may.nguon.dang_lam_ds[<tập>] — chay-kenh ghi lúc bắt đầu, lam-tap ghi từng bước; hỏng thì giữ kèm loi) */
export type DangLam = { id: string; luc: string; buoc?: string; so?: number; tong?: number; buoc_luc?: string; loi?: string | null; chi_tiet?: string | null; /** tên tập (tiêu đề / chủ đề) */ ten?: string | null };

const lui = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

/** Số mới nhất + chênh 7 ngày từ các bản ghi ngày của một kênh. */
export function tinhSoKenh(ds: SoNgayKenh[], hom: string): Pick<KenhSp, 'xem' | 'xem7' | 'nguoiDk' | 'nguoiDk7' | 'ngaySo'> {
  const xep = [...ds].sort((a, b) => b.ngay.localeCompare(a.ngay)), moi = xep[0];
  if (!moi) return { xem: null, xem7: null, nguoiDk: null, nguoiDk7: null, ngaySo: null };
  const cu = xep.find((d) => d.ngay <= lui(hom, 7));
  return {
    xem: moi.xem, xem7: cu ? moi.xem - cu.xem : null,
    nguoiDk: moi.nguoiDk, nguoiDk7: cu && cu.nguoiDk != null && moi.nguoiDk != null ? moi.nguoiDk - cu.nguoiDk : null,
    ngaySo: moi.ngay,
  };
}

/** Chặng của một video kênh — đã đăng thắng mọi thứ; chưa có bản xuất = chưa xuất; có bản xuất mà Phòng Nội dung chưa chấm = chờ chấm. */
export const changVideo = (v: { daDang: boolean; xuat: boolean; cham: string | null }): VideoKenh['trangThai'] =>
  v.daDang ? 'da_dang' : !v.xuat ? 'chua_xuat' : v.cham === 'DUYET' ? 'duyet' : v.cham === 'SUA_LAI' ? 'sua_lai' : 'cho_cham';

const THU = ['', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];
/** Lịch làm tập: thứ (1 = Thứ Hai … 7 = Chủ nhật) + giờ VN → chữ lịch + n lượt kế từ hôm nay (YYYY-MM-DD), hôm nay còn giờ thì tính. Thuần. */
export function lichSanXuat(thu: number[], gio: string | null, hom: string, gioNay: string, n = 3): { chu: string | null; ke: string[] } {
  if (!thu.length) return { chu: null, ke: [] };
  const ke: string[] = [];
  for (let i = 0; ke.length < n && i < 21; i++) { const d = new Date(Date.parse(`${hom}T00:00:00Z`) + i * 86_400_000), t = d.getUTCDay() || 7, ymd = d.toISOString().slice(0, 10);
    if (thu.includes(t) && !(i === 0 && gio && gioNay >= gio)) ke.push(`${ymd} ${gio ?? ''}`.trim()); }
  return { chu: `${thu.map((t) => THU[t]).join(' · ')}${gio ? ` · ${gio}` : ''}`, ke };
}

/** LỊCH KẾ HOẠCH của kênh (anh 02/11/2026: "show calendar + số video, hover ra chi tiết"): mỗi ngày gộp theo loại → một ô số + danh sách chi tiết. Thuần. */
export type OLich = { ngay: string; loai: 'sx' | 'lam' | 'hen' | 'dang'; so: number; chiTiet: string[] };
export function lichKenh(k: Pick<KenhSp, 'videos' | 'ke'>): OLich[] {
  const m = new Map<string, OLich>(), them = (ngay: string | null | undefined, loai: OLich['loai'], chu: string) => { if (!ngay) return; const key = `${ngay}|${loai}`;
    const o = m.get(key) ?? { ngay, loai, so: 0, chiTiet: [] }; o.so++; o.chiTiet.push(chu); m.set(key, o); };
  for (const t of k.ke.tapKe) them(t.slice(0, 10), 'sx', `lượt làm tập tự động ${t.slice(11)}`);
  for (const d of k.ke.dangLam) them(d.luc.slice(0, 10), 'sx', `đang làm ${d.id}`);
  for (const v of k.videos) { them(v.ngayLam, 'lam', v.ten); if (v.trangThai === 'da_dang') them(v.ngayDang, 'dang', v.ten); }
  for (const l of k.ke.lichDang) them(l.ngay, 'hen', `${l.gio ?? ''} ${l.nen} · ${l.tieuDe}`.trim());
  return [...m.values()].sort((a, b) => a.ngay.localeCompare(b.ngay));
}

/** CÂY KẾ HOẠCH của kênh (anh 02/11/2026: "nhìn được realtime quá trình sx, lên lịch ở đây"): khối ▶ Đang sản xuất (tập trong lò, bước k/n, từ giờ nào)
 *  + khối 🗓 Lịch (bài chờ đăng lúc nào, bài chờ chấm / sửa lại, lượt làm tập kế). Thuần — component chỉ vẽ. Giờ hiện theo giờ VN. */
export type DongKe = { id: string; nhom?: boolean; chu: string; phu?: string; mau?: string;
  /** MỌI LINK RA NGĂN (anh 04/11/2026 "mọi link đều phải ra drawer"): nút trên dòng mở ngăn loại / mã — không có url mở tab ngoài */ ngan?: { loai: 'mau' | 'mo_dau' | 'nguoi'; id: string }; nganChu?: string;
  /** ĐỒNG HỒ của tập đang sản xuất (anh 05/11/2026: "đồng hồ nằm ở dòng của video đang sx"): bước so / tong, hỏng thì đỏ */ dongHo?: { so: number; tong: number; loi: boolean };
  /** ô số thẳng cột (bảng thống kê mẫu) + tên cột ở dòng nhóm */ o?: (number | null)[]; oTieuDe?: string[] };
const gioVn = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
const thuNgay = (ymd: string) => `${THU[new Date(`${ymd}T00:00:00Z`).getUTCDay() || 7]} ${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
export function cayKeHoach(k: Pick<KenhSp, 'videos' | 'ke'>, bayGio = Date.now()): DongKe[] {
  const ra: DongKe[] = [], ds = k.ke.dangLam;
  // ▶ Đang sản xuất: một dòng / tập (đồng hồ bước ở đầu dòng, tên tập là chữ chính, bước + phút + chi tiết + mã ở phần phụ) — N tập song song là N dòng
  // một bước đứng > 30 phút (bước dài nhất ~10–15 phút) = nghi treo → đỏ ngay, không đợi trần giờ của lam-tap
  const dongSx = ds.map((d): DongKe => {
    const phut = Math.max(0, Math.round((bayGio - Date.parse(d.buoc_luc ?? d.luc)) / 60_000)), dung = !d.loi && phut > 30;
    return { id: `sx/${d.id}`, chu: d.ten ?? d.id, mau: d.loi || dung ? 'var(--bad)' : 'var(--warn)', dongHo: { so: d.so ?? 0, tong: d.tong ?? 8, loi: !!d.loi || dung },
      phu: [d.loi ? `✗ ${d.loi}` : d.buoc ? `bước ${d.so}/${d.tong} · ${d.buoc} · ${dung ? `⚠ đứng ${phut} phút` : `${phut} phút`}` : 'đang khởi động', d.chi_tiet, d.id].filter(Boolean).join(' · ') };
  });
  // tập đang dở (chưa nạp máy đăng, không phải tập đang chạy): hiện để không "biến mất" giữa hai lượt
  const cho = (k.ke.tapCho ?? []).filter((t) => !ds.some((d) => d.id === t.id));
  if (ds.length || cho.length) {
    const som = ds.reduce<string | null>((m, d) => (!m || d.luc < m ? d.luc : m), null);
    ra.push({ id: 'sx', nhom: true, chu: `▶ Đang sản xuất${ds.length > 1 ? ` (${ds.length})` : ''}`,
      phu: som ? `${ds.length} tập · sớm nhất bắt đầu ${gioVn(som)} · ${Math.max(0, Math.round((bayGio - Date.parse(som)) / 60_000))} phút` : 'không có tập nào đang chạy · việc nền chạy lại mỗi giờ' }, ...dongSx);
    for (const t of cho) ra.push(t.bo ? { id: `cho/${t.id}`, chu: `✖ ${t.chu_de ?? t.id}`, mau: 'var(--fg-4)', phu: `bỏ sau 3 lần tự làm lại kẹt · máy tự làm đề khác ở lượt lịch kế · ${t.id}` }
      : { id: `cho/${t.id}`, chu: `⏸ ${t.chu_de ?? t.id}`, mau: t.lan >= 3 ? 'var(--bad)' : 'var(--fg-2)',
      phu: [t.lan ? `đã tự làm lại ${t.lan}/3` : 'chờ lượt giờ sau', t.tho ? '🔧 đã giao Mạnh sửa' : null, t.loi ? `lỗi: ${t.loi}` : null, t.id].filter(Boolean).join(' · ') }); }
  const lich: DongKe[] = [];
  for (const v of k.videos) {
    if (v.trangThai === 'duyet') { const h = k.ke.lichDang.find((l) => l.tieuDe && v.ten.startsWith(l.tieuDe.replace(/\s*#shorts\s*/i, '').slice(0, 30)));
      lich.push({ id: `l/${v.slug}`, chu: `📤 ${v.ten}`, mau: 'var(--accent)', phu: h ? `đăng ${thuNgay(h.ngay)} ${h.gio ?? ''}`.trim() : `DUYỆT · máy đăng lấy ở khung từ ${k.ke.gioDang ?? '19:00'} giờ VN (trần 1 bài/ngày)` }); }
    else if (v.trangThai === 'cho_cham') lich.push({ id: `l/${v.slug}`, chu: `⏳ ${v.ten}`, phu: 'chờ Phòng Nội dung chấm' });
    else if (v.trangThai === 'sua_lai') lich.push({ id: `l/${v.slug}`, chu: `🔧 ${v.ten}`, mau: 'var(--bad)', phu: 'SỬA LẠI · việc nền tự làm lại mỗi giờ (tối đa 3 lần)' });
  }
  for (const t of k.ke.tapKe) lich.push({ id: `l/sx/${t}`, chu: '🛠 làm tập mới', phu: `${thuNgay(t.slice(0, 10))} ${t.slice(11)}`.trim() });
  if (lich.length) ra.push({ id: 'lich', nhom: true, chu: '🗓 Lịch', phu: k.ke.lichTap ? `làm tập ${k.ke.lichTap} · đăng từ ${k.ke.gioDang ?? '19:00'} giờ VN` : undefined }, ...lich);
  return ra;
}

/** LỘ TRÌNH KÊNH (so-kenh.json › giai_doan, chung mọi kênh studio): các giai đoạn G0…Gn, mỗi giai đoạn một trạng thái. Giai đoạn đang đứng = cái đầu tiên chưa xong. */
export type TrangThaiGd = 'cho_anh' | 'dang' | 'chua' | 'xong';
export type GiaiDoan = { ma: string; ten: string; viec: string; anh: string; trang_thai: TrangThaiGd };
/** PLAYLIST theo kế hoạch (so-kenh.json › playlist; G1 chuyển sang kenh.json khi máy làm tập theo playlist). */
export type TrangThaiPl = 'de_xuat' | 'chot' | 'mo' | 'sau' | 'tam_dung';
export type PlaylistKh = { ma: string; ten: string; tien_to?: string; noi_dung?: string; ho_hinh?: string; ngay?: string; trang_dich?: string; mo_dau?: boolean; trang_thai: TrangThaiPl; khi?: string };
/** MẪU đã duyệt (so-kenh.json › mau): mỗi tập kênh phải thuộc một mẫu (máy gác lich-su/kiem-so-kenh.mjs). */
export type MauKenh = { ma: string; ten: string; loai: 'short' | 'dai'; /** MẪU LÀ GÌ — cấu trúc + ví dụ cụ thể (anh 05/11/2026) */ mo_ta?: string; /** góc nhu cầu spy mẫu này phục vụ (goc.id của nhóm spy của máy) */ goc_spy?: { id: number; loai: string; ten: string }[]; /** khổ video — thiếu thì Short 9:16, dài 16:9 (kênh YNT dài cũng dọc 9:16) */ khung?: '9:16' | '16:9'; playlist?: string; nhip?: string; kho?: string; trang?: string; sinh?: string; demo?: string; tu_sinh?: string; /** mẫu mới chưa duyệt: chỉ làm demo, máy gác chặn tập thật */ cho_duyet?: boolean };
/** Ý TƯỞNG trong hàng chờ (so-kenh.json › hang_cho); trạng thái trong sổ bị tập thật đè (tập slug = mã ý tưởng: đã làm / đã đăng). */
export type TrangThaiY = 'chua' | 'san_sang' | 'demo' | 'da_lam' | 'da_dang';
export type YTuong = { ma: string; mau: string; chu_de: string; ngay?: string; trang_thai: TrangThaiY; /** ý tưởng máy tự sinh (so-kenh.json › nguon_y_tuong) — giờ UTC của sự kiện */ tu_sinh?: string; utc?: string };
export type SoKenh = { ten?: string; plan?: string; muc_tieu?: string; cap_nhat?: string; playlist?: PlaylistKh[]; giai_doan: GiaiDoan[];
  dinh_vi?: { cho_ai?: string; dich?: string; cau_ket?: string; ngon_ngu?: string }; luat?: string[]; mau?: MauKenh[]; hang_cho?: YTuong[]; mo_dau?: string;
  nguon_y_tuong?: { mau: string; tep: string; ngay_toi?: number; ghi?: string }[]; /** sổ người nổi tiếng (giờ sinh + hạng Rodden), đường dưới lich-su/ */ nguoi_tep?: string };
/** NGƯỜI NỔI TIẾNG trong sổ người (la-so/nguoi.json): giờ sinh + hạng Rodden; cung Mọc / nhà chỉ cho hạng trong rodden_dung_nha. */
export type NguoiLaSo = { slug: string; ten: string; sinh: { ngay: number; thang: number; nam: number; gio: number; phut: number; noi: string }; rodden: string; nguon?: string; ghi?: string; khong_dung?: string };
const GD: Record<TrangThaiGd, { ic: string; chu: string; mau: string }> = {
  xong: { ic: '✅', chu: 'xong', mau: 'var(--ok)' }, dang: { ic: '▶', chu: 'đang làm', mau: 'var(--warn)' },
  cho_anh: { ic: '⏸', chu: 'chờ anh', mau: 'var(--accent)' }, chua: { ic: '○', chu: 'chưa tới', mau: 'var(--fg-4)' },
};
/** Tóm một dòng cho dòng kênh: "🧭 G0 Chốt · chờ anh chốt" / "🧭 xong lộ trình". Thuần. */
export function tomLoTrinh(lt: SoKenh): { xong: number; tong: number; hienTai: GiaiDoan | null; chu: string; mau: string } {
  const ds = lt.giai_doan ?? [], xong = ds.filter((g) => g.trang_thai === 'xong').length, h = ds.find((g) => g.trang_thai !== 'xong') ?? null;
  if (!h) return { xong, tong: ds.length, hienTai: null, chu: '🧭 xong lộ trình', mau: 'var(--ok)' };
  const t = GD[h.trang_thai] ?? GD.chua;
  return { xong, tong: ds.length, hienTai: h, chu: `🧭 ${h.ma} ${h.ten} · ${h.trang_thai === 'cho_anh' ? (h.anh && h.anh !== 'không' ? `chờ anh ${h.anh}` : 'chờ anh') : t.chu}`, mau: t.mau };
}
/** Khối 🧭 Lộ trình trong cây kênh: dòng nhóm (x/n xong · đang ở đâu) + mỗi giai đoạn một dòng (trạng thái · việc · anh làm gì). Thuần. */
export function cayLoTrinh(lt: SoKenh): DongKe[] {
  const t = tomLoTrinh(lt), ngay = lt.cap_nhat ? ` · cập nhật ${lt.cap_nhat.slice(8, 10)}/${lt.cap_nhat.slice(5, 7)}` : '';
  return [{ id: 'lt', nhom: true, chu: `🧭 Lộ trình (${t.xong}/${t.tong} xong)`, phu: `${t.hienTai ? `đang ở ${t.hienTai.ma}` : 'đã tự vận hành'}${ngay}${lt.muc_tieu ? ` · đích: ${lt.muc_tieu}` : ''}` },
    ...(lt.giai_doan ?? []).map((g): DongKe => { const s = GD[g.trang_thai] ?? GD.chua;
      return { id: `lt/${g.ma}`, chu: `${s.ic} ${g.ma} ${g.ten} · ${s.chu}`, mau: s.mau, phu: `${g.viec}${g.anh && g.anh !== 'không' ? ` · anh: ${g.anh}` : ''}` }; })];
}

const PL: Record<TrangThaiPl, { ic: string; chu: string; mau: string }> = {
  mo: { ic: '▶', chu: 'đang mở', mau: 'var(--ok)' }, chot: { ic: '✔', chu: 'đã chốt', mau: 'var(--accent)' }, de_xuat: { ic: '📝', chu: 'đề xuất', mau: 'var(--accent)' },
  sau: { ic: '○', chu: 'mở sau', mau: 'var(--fg-4)' }, tam_dung: { ic: '⏸', chu: 'tạm dừng', mau: 'var(--warn)' },
};
/** Khối 📂 Playlist trong cây kênh: playlist theo kế hoạch, playlist mở đầu đứng trước. Thuần. */
export function cayPlaylist(lt: SoKenh): DongKe[] {
  const ds = [...(lt.playlist ?? [])].sort((a, b) => Number(!!b.mo_dau) - Number(!!a.mo_dau));
  if (!ds.length) return [];
  const mo = ds.filter((p) => p.trang_thai === 'mo').length, dau = ds.filter((p) => p.mo_dau).length;
  return [{ id: 'pl', nhom: true, chu: `📂 Playlist (${ds.length})`, phu: `${mo} đang mở · ${dau} mở đầu${ds.some((p) => p.trang_thai === 'de_xuat') ? ' · đề xuất chờ G0 chốt' : ds.some((p) => p.trang_thai === 'chot') ? ' · đã chốt, mở trên YouTube ở G7' : ''}` },
    ...ds.map((p): DongKe => { const s = PL[p.trang_thai] ?? PL.sau;
      return { id: `pl/${p.ma}`, chu: `${s.ic} ${p.ten} · ${s.chu}${p.mo_dau ? ' · mở đầu' : p.khi ? ` · ${p.khi}` : ''}`, mau: s.mau,
        phu: [p.noi_dung, p.ho_hinh && `hình ${p.ho_hinh}`, p.ngay && p.ngay !== '—' && `ngày ${p.ngay}`, p.trang_dich && `→ ${p.trang_dich}`, p.tien_to && `tiêu đề "${p.tien_to}"`].filter(Boolean).join(' · ') }; })];
}
/** Khối 📘 SỔ KÊNH: cho ai · đích · câu kết · từng luật. Thuần. */
export function caySoKenh(so: SoKenh): DongKe[] {
  const d = so.dinh_vi ?? {}, luat = so.luat ?? [];
  if (!d.cho_ai && !luat.length) return [];
  return [{ id: 'so', nhom: true, chu: '📘 Sổ kênh', phu: `định vị + ${luat.length} luật · mọi tập phải theo` },
    ...[d.cho_ai && ['cho', `Cho ai: ${d.cho_ai}`], d.dich && ['dich', `Đích: ${d.dich}`], d.cau_ket && ['ket', `Câu kết bắt buộc: "${d.cau_ket}"`]].filter((x): x is string[] => !!x)
      .map(([id, chu]): DongKe => ({ id: `so/${id}`, chu: chu! })),
    ...luat.map((l, i): DongKe => ({ id: `so/l${i}`, chu: `Luật ${i + 1}: ${l}`, mau: 'var(--fg-2)' }))];
}
/** SỐ THEO MẪU (anh 04/11/2026 "các mẫu này hãy có bảng thống kê số bài, video đã sx, đang plan"): ý tưởng (hàng chờ + tự sinh) theo trạng thái + tập thật
 *  (tập khai mau, hoặc khai y_tuong / slug trùng một ý tưởng của mẫu) đã làm / đã đăng / lượt xem. Thuần. */
export type SoMau = { keHoach: number; sanSang: number; demo: number; daLam: number; daDang: number; xem: number | null; videos: VideoKenh[]; yTuong: (YTuong & { tt: TrangThaiY })[] };
export function thongKeMau(so: SoKenh, videos: VideoKenh[], tuSinh: YTuong[] = []): Map<string, SoMau> {
  const ra = new Map<string, SoMau>((so.mau ?? []).map((m) => [m.ma, { keHoach: 0, sanSang: 0, demo: 0, daLam: 0, daDang: 0, xem: null, videos: [], yTuong: [] }]));
  const yt = [...(so.hang_cho ?? []), ...tuSinh], mauY = new Map(yt.map((y) => [y.ma, y.mau]));
  for (const y of yt) { const o = ra.get(y.mau); if (!o) continue; const tt = trangThaiY(y, videos); o.yTuong.push({ ...y, tt });
    if (tt === 'chua') o.keHoach++; else if (tt === 'san_sang') o.sanSang++; else if (tt === 'demo') o.demo++; }
  for (const v of videos) { const ma = v.mau ?? mauY.get(v.yTuong ?? '') ?? mauY.get(v.slug); const o = ma ? ra.get(ma) : null; if (!o) continue;
    o.videos.push(v); if (v.trangThai === 'da_dang') o.daDang++; else o.daLam++; if (v.xem != null) o.xem = (o.xem ?? 0) + v.xem; }
  return ra;
}
/** Bài & video của một mẫu cho bảng trong ngăn: tập thật + ý tưởng chưa thành tập, MỚI NHẤT trên cùng (ngày đăng → ngày làm → ngày sự kiện). Thuần. */
export type DongMau = { loai: 'video'; v: VideoKenh; ngay: string | null } | { loai: 'y'; y: YTuong & { tt: TrangThaiY }; ngay: string | null };
export function dongMau(s: SoMau): DongMau[] {
  const daCo = new Set(s.videos.flatMap((v) => [v.slug, v.yTuong ?? '']));
  return [...s.videos.map((v): DongMau => ({ loai: 'video', v, ngay: v.ngayDang ?? v.ngayLam ?? null })),
    ...s.yTuong.filter((y) => !daCo.has(y.ma)).map((y): DongMau => ({ loai: 'y', y, ngay: y.utc ?? y.ngay ?? null }))]
    .sort((a, b) => (b.ngay ?? '').localeCompare(a.ngay ?? ''));
}
/** Khối 🧩 MẪU ĐÃ DUYỆT: một dòng một mẫu (Short / dài · playlist · nhịp · kho ý tưởng) + link ▶ xem demo. Thuần. */
export const COT_MAU = ['Kế hoạch', 'Sẵn sàng', 'Demo', 'Đã làm', 'Đã đăng', 'Lượt xem'];
const oMau = (s?: SoMau): (number | null)[] => (s ? [s.keHoach, s.sanSang, s.demo, s.daLam, s.daDang, s.xem] : [0, 0, 0, 0, 0, null]);
export function cayMau(so: SoKenh, tk: Map<string, SoMau> = new Map()): DongKe[] {
  const ds = so.mau ?? []; if (!ds.length) return [];
  const pl = new Map((so.playlist ?? []).map((p) => [p.ma, p.ten])), n = (l: string) => ds.filter((m) => m.loai === l).length;
  const tong = COT_MAU.map((_, i) => { const xs = ds.map((m) => oMau(tk.get(m.ma))[i]); return xs.every((x) => x == null) ? null : xs.reduce<number>((a, x) => a + (x ?? 0), 0); });
  // CHỜ DUYỆT chỉ khi CÓ DEMO để xem (anh 05/11/2026: "chờ tao duyệt mà không có demo thì duyệt cái gì") — mẫu mới chưa có demo là "đang làm demo", việc của máy
  const cho = ds.filter((m) => m.cho_duyet && m.demo).length, lamDemo = ds.filter((m) => m.cho_duyet && !m.demo).length;
  return [{ id: 'mau', nhom: true, chu: `🧩 Mẫu (${ds.length - cho - lamDemo} đã duyệt${cho ? ` · ${cho} chờ duyệt` : ''}${lamDemo ? ` · ${lamDemo} đang làm demo` : ''})`, phu: `${n('short')} Short · ${n('dai')} dài · tập ngoài các mẫu đã duyệt không lên kênh · bấm tên mẫu: demo + danh sách bài, video`,
      ngan: so.mo_dau ? { loai: 'mo_dau', id: '' } : undefined, nganChu: so.mo_dau ? '▶ đoạn mở đầu' : undefined, o: tong, oTieuDe: COT_MAU },
    ...[...ds].sort((a, b) => Number(!!a.cho_duyet) - Number(!!b.cho_duyet)).map((m): DongKe => ({ id: `mau/${m.ma}`, chu: `${m.loai === 'dai' ? '🎞' : '📱'} ${m.ten}${m.cho_duyet ? (m.demo ? ' · ⏳ chờ anh duyệt' : ' · 🛠 máy đang làm demo') : ''}`,
      mau: m.cho_duyet ? (m.demo ? 'var(--warn)' : 'var(--fg-3)') : undefined, ngan: { loai: 'mau', id: m.ma }, nganChu: m.demo ? '▶ xem' : 'mở', o: oMau(tk.get(m.ma)),
      phu: [m.goc_spy?.length && `góc spy: ${m.goc_spy.map((g) => g.ten).join(' · ')}`, `${m.loai === 'dai' ? 'dài' : 'Short'} ${m.khung ?? (m.loai === 'dai' ? '16:9' : '9:16')}`, m.playlist && `playlist ${pl.get(m.playlist) ?? m.playlist}`, m.nhip, m.kho && `kho ${m.kho}`, m.tu_sinh && 'máy tự sinh ý tưởng'].filter(Boolean).join(' · ') }))];
}
export const YT: Record<TrangThaiY, { ic: string; chu: string; mau: string; thu: number }> = {
  san_sang: { ic: '⏳', chu: 'sẵn sàng', mau: 'var(--warn)', thu: 0 }, chua: { ic: '○', chu: 'chưa làm', mau: 'var(--fg-2)', thu: 1 }, demo: { ic: '🎬', chu: 'đã có demo', mau: 'var(--accent)', thu: 2 },
  da_lam: { ic: '✔', chu: 'đã làm', mau: 'var(--ok)', thu: 3 }, da_dang: { ic: '✅', chu: 'đã đăng', mau: 'var(--ok)', thu: 4 },
};
/** Trạng thái thật của ý tưởng: tập kênh có slug = mã ý tưởng thì đè trạng thái trong sổ (đã đăng > đã làm). Thuần. */
export function trangThaiY(y: YTuong, videos: Pick<VideoKenh, 'slug' | 'trangThai' | 'yTuong'>[]): TrangThaiY {
  const v = videos.filter((x) => x.slug === y.ma || x.yTuong === y.ma);
  return v.some((x) => x.trangThai === 'da_dang') ? 'da_dang' : v.length ? 'da_lam' : y.trang_thai;
}
/** Ý TƯỞNG TỰ SINH từ một nguồn (vd lịch trời): sự kiện trong [hom, hom + ngay_toi] ngày, bỏ mã đã có trong hàng chờ tay. Thuần. */
export function yTuongTuSinh(so: SoKenh, nguon: Record<string, { ma: string; chu: string; utc: string }[]>, hom: string): YTuong[] {
  const co = new Set((so.hang_cho ?? []).map((y) => y.ma)), ra: YTuong[] = [], t0 = Date.parse(`${hom}T00:00:00Z`);
  for (const n of so.nguon_y_tuong ?? []) for (const s of nguon[n.tep] ?? []) {
    const t = Date.parse(s.utc); if (co.has(s.ma) || t < t0 || t > t0 + (n.ngay_toi ?? 60) * 86400e3) continue;
    ra.push({ ma: s.ma, mau: n.mau, chu_de: s.chu, ngay: s.utc.slice(0, 10), utc: s.utc, trang_thai: 'chua', tu_sinh: n.tep }); }
  return ra;
}
const gioVnUtc = (iso: string) => { const d = new Date(Date.parse(iso) + 7 * 3600e3); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()} giờ VN`; };
/** Khối 👤 LÁ SỐ NGƯỜI NỔI TIẾNG: AA dùng đủ (cung Mọc, nhà, Profection) lên trước; A / B / DD ghi rõ không dùng nhà; bị đánh dấu thì đỏ + lý do. Thuần. */
export function cayNguoi(ds: NguoiLaSo[], dungNha: string[]): DongKe[] {
  if (!ds.length) return [];
  const hang = (n: NguoiLaSo) => (n.khong_dung ? 2 : dungNha.includes(n.rodden) ? 0 : 1), xep = [...ds].sort((a, b) => hang(a) - hang(b) || a.ten.localeCompare(b.ten));
  const dung = ds.filter((n) => hang(n) === 0).length, p2 = (x: number) => String(x).padStart(2, '0');
  return [{ id: 'ng', nhom: true, chu: `👤 Lá số người nổi tiếng (${ds.length})`, phu: `${dung} dùng được cung Mọc / nhà (hạng ${dungNha.join('/')}) · giờ sinh đọc trên Astrotheme (bản Astro-Databank) · không dùng giờ của trang /c/` },
    ...xep.map((n): DongKe => { const h = hang(n), s = n.sinh;
      return { id: `ng/${n.slug}`, chu: `${['✅', '⚠', '✗'][h]} ${n.rodden} · ${n.ten}`, mau: ['var(--ok)', 'var(--warn)', 'var(--bad)'][h], ngan: { loai: 'nguoi', id: n.slug }, nganChu: 'chi tiết',
        phu: [`${p2(s.ngay)}/${p2(s.thang)}/${s.nam} ${p2(s.gio)}:${p2(s.phut)} · ${s.noi}`, h === 2 ? `không dùng: ${n.khong_dung}` : h === 1 ? 'không dùng cung Mọc / nhà' : 'dùng đủ', n.ghi].filter(Boolean).join(' · ') }; })];
}
/** Khối 💡 HÀNG CHỜ Ý TƯỞNG: sẵn sàng → chưa làm (theo ngày) → đã có demo → đã làm → đã đăng. Thuần. */
export function cayHangCho(so: SoKenh, videos: Pick<VideoKenh, 'slug' | 'trangThai'>[], tuSinh: YTuong[] = []): DongKe[] {
  const ds = [...(so.hang_cho ?? []), ...tuSinh].map((y) => ({ y, t: trangThaiY(y, videos) })); if (!ds.length) return [];
  const mau = new Map((so.mau ?? []).map((m) => [m.ma, m.ten])), dem = (t: TrangThaiY) => ds.filter((x) => x.t === t).length;
  ds.sort((a, b) => YT[a.t].thu - YT[b.t].thu || (a.y.ngay ?? '9').localeCompare(b.y.ngay ?? '9'));
  const nTu = tuSinh.length;
  return [{ id: 'hc', nhom: true, chu: `💡 Hàng chờ ý tưởng (${ds.length})`, phu: `${dem('san_sang')} sẵn sàng · ${dem('chua')} chưa làm${nTu ? ` (${nTu} tự sinh)` : ''} · ${dem('demo')} có demo · ${dem('da_dang')} đã đăng · máy lấy chủ đề kế từ đây` },
    ...ds.map(({ y, t }): DongKe => ({ id: `hc/${y.ma}`, chu: `${YT[t].ic} ${y.chu_de}`, mau: YT[t].mau,
      phu: [mau.get(y.mau) ?? y.mau, y.utc ? gioVnUtc(y.utc) : y.ngay && `${y.ngay.slice(8, 10)}/${y.ngay.slice(5, 7)}/${y.ngay.slice(0, 4)}`, YT[t].chu,
        y.tu_sinh && `tự sinh · ${y.tu_sinh === 'lich-troi.json' ? 'lịch trời' : y.tu_sinh}`].filter(Boolean).join(' · ') }))];
}
/** ĐÓNG / MỞ từng khối trong cây (anh 02/11/2026 "các phần bên trong đều phải cho đóng mở tuỳ ý"): dòng nhóm luôn giữ, con của nhóm đang gập thì bỏ.
 *  khoaNhom(r) = khoá nhóm nếu r là dòng nhóm, null nếu là dòng con (thuộc nhóm đứng trước gần nhất). Thuần. */
export function locGap<T>(rows: T[], khoaNhom: (r: T) => string | null, gap: ReadonlySet<string>): T[] {
  let dangGap = false;
  return rows.filter((r) => { const k = khoaNhom(r); if (k != null) { dangGap = gap.has(k); return true; } return !dangGap; });
}

/** PLAYLIST THẬT (kenh.json › playlist — cùng luật với apps/xuong-video/scripts/lich-su/playlist.mjs): lịch làm tập + số tập / đã đăng / lượt xem từng playlist. */
export type PlaylistHs = { ma: string; ten: string; tien_to?: string; lich_tap?: number[]; gio_tap?: string; trang_dich?: string; yt?: Record<string, string> };
export type HoSoKenhLich = { lich_tap?: number[]; gio_tap?: string; playlist?: PlaylistHs[] };
export type PlaylistKenh = { ma: string; ten: string; tienTo: string | null; lich: string | null; trangDich: string | null; coYt: boolean; tap: number; daDang: number; xem: number | null };
/** Lịch làm tập của kênh: có playlist thì từng playlist một lịch (giờ riêng hoặc giờ kênh), lượt kế gộp lại theo thời gian; không thì lịch kênh như cũ. Thuần. */
export function lichKenhHs(h: HoSoKenhLich | undefined, hom: string, gioNay: string, n = 3): { chu: string | null; ke: string[]; theo: Record<string, string | null> } {
  const pls = h?.playlist ?? [];
  if (!pls.length) { const l = lichSanXuat(h?.lich_tap ?? [], h?.gio_tap ?? null, hom, gioNay, n); return { ...l, theo: {} }; }
  const ls = pls.map((p) => ({ p, l: lichSanXuat(p.lich_tap ?? [], p.gio_tap ?? h?.gio_tap ?? null, hom, gioNay, n) }));
  return { chu: ls.filter((x) => x.l.chu).map((x) => (pls.length > 1 ? `${x.p.ten}: ${x.l.chu}` : x.l.chu)).join(' | ') || null,
    ke: ls.flatMap((x) => x.l.ke).sort().slice(0, n), theo: Object.fromEntries(ls.map((x) => [x.p.ma, x.l.chu])) };
}
/** Số từng playlist từ video của kênh; tập chưa gắn playlist (tập trước G1) gom vào dòng "chưa gắn playlist" khi có. Thuần. */
export function soTheoPlaylist(pls: PlaylistHs[], theo: Record<string, string | null>, videos: Pick<VideoKenh, 'playlist' | 'trangThai' | 'xem'>[]): PlaylistKenh[] {
  if (!pls.length) return [];
  const dem = (vs: typeof videos) => ({ tap: vs.length, daDang: vs.filter((v) => v.trangThai === 'da_dang').length,
    xem: vs.some((v) => v.xem != null) ? vs.reduce((t, v) => t + (v.xem ?? 0), 0) : null });
  const ma = new Set(pls.map((p) => p.ma)), le = videos.filter((v) => !v.playlist || !ma.has(v.playlist));
  return [...pls.map((p) => ({ ma: p.ma, ten: p.ten, tienTo: p.tien_to?.trim() || null, lich: theo[p.ma] ?? null, trangDich: p.trang_dich ?? null,
      coYt: !!Object.values(p.yt ?? {}).some(Boolean), ...dem(videos.filter((v) => v.playlist === p.ma)) })),
    ...(le.length ? [{ ma: '', ten: 'chưa gắn playlist', tienTo: null, lich: null, trangDich: null, coYt: false, ...dem(le) }] : [])];
}
/** Khối 📂 Playlist từ playlist THẬT (kenh.json). Thuần. */
export function cayPlaylistThat(ds: PlaylistKenh[]): DongKe[] {
  if (!ds.length) return [];
  const so = (n: number | null) => (n == null ? '–' : n.toLocaleString('vi-VN'));
  return [{ id: 'pl', nhom: true, chu: `📂 Playlist (${ds.filter((p) => p.ma).length})`, phu: 'lịch làm tập theo playlist · trần đăng 1 bài/ngày tính chung cả kênh' },
    ...ds.map((p): DongKe => ({ id: `pl/${p.ma || '_'}`, chu: p.ma ? `▶ ${p.ten}` : `· ${p.ten}`, mau: p.ma ? undefined : 'var(--fg-3)',
      phu: [p.lich && `làm tập ${p.lich}`, `${p.tap} tập · ${p.daDang} đã đăng · ${so(p.xem)} xem`, p.tienTo && `tiêu đề "${p.tienTo}: …"`, p.trangDich && `→ ${p.trangDich}`,
        p.ma && (p.coYt ? 'có playlist YouTube' : 'chưa có playlist YouTube (G7)')].filter(Boolean).join(' · ') }))];
}
