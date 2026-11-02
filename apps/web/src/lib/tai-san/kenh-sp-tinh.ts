// KÊNH SẢN PHẨM — phần TÍNH (thuần, client import được; tự kiểm: tsx kenh-sp-tinh.test.mts). Đọc DB ở kenh-sp.ts.
// Kênh nội dung coi là SẢN PHẨM (xv_may.la_san_pham — anh 02/11/2026, kênh Yesterday's News Tonight): số đo hằng ngày ở kenh_so_ngay
// (kenh youtube, san_pham 'may:<mã>', hien = lượt xem cộng dồn, so_muc = video đã đăng, chi_tiet.nguoi_dk) do may-dung.mts --so-kenh ghi.
// 7 ngày = bản ghi mới nhất − bản ghi gần nhất có ngày ≤ hôm nay − 7; chưa có mốc đó = null ("–", chưa đo ≠ 0).

export type SoNgayKenh = { ngay: string; xem: number; daDang: number; nguoiDk: number | null };
export type VideoKenh = { slug: string; ten: string; /** ngày làm xong (bản xuất, không có thì ngày nạp) */ ngayLam: string | null; trangThai: 'chua_xuat' | 'cho_cham' | 'duyet' | 'sua_lai' | 'da_dang'; ngayDang: string | null; url: string | null; xem: number | null; giay: number | null };
export type KenhSp = {
  ma: string; ten: string; chay: boolean; kenhUrl: string | null;
  tap: number; choDang: number; daDang: number;
  xem: number | null; xem7: number | null; nguoiDk: number | null; nguoiDk7: number | null; ngaySo: string | null; dangCuoi: string | null;
  /** phim Studio quản lý kênh (xv_phim.kinh_thanh.may = mã máy) · ảnh đại diện kênh (trang YouTube, may-dung --so-kenh) */
  phimId: number | null; anh: string | null;
  /** video của kênh (cây dưới dòng kênh): trạng thái theo chặng — chưa xuất → chờ chấm → DUYỆT / SỬA LẠI (Phòng Nội dung) → đã đăng */
  videos: VideoKenh[];
  /** KẾ HOẠCH kênh (anh 02/11/2026: "show plan cụ thể — lịch đăng bài, bài đã sx, đang sx"): lịch làm tập (kenh.json lich_tap + gio_tap), tập đang làm
   *  (xv_may.nguon.dang_lam — chay-kenh.mjs ghi), lịch đăng dự kiến của máy đăng (xv_lich_du_kien) */
  ke: { lichTap: string | null; tapKe: string[]; dangLam: DangLam | null; lichDang: { ngay: string; gio: string | null; nen: string; tieuDe: string }[];
    /** giờ VN sớm nhất máy đăng được đăng bài của kênh (xv_may.dang[].gio_tu) */ gioDang: string | null };
  /** LỘ TRÌNH kênh (apps/xuong-video/scripts/lich-su/lo-trinh.json theo mã máy — anh 02/11/2026 "dựng phần kênh nội dung và Studio để còn follow theo"); null = kênh không khai lộ trình */
  loTrinh?: LoTrinh | null;
  /** social trỏ về kênh (bài short dẫn link kênh) — tab Tài sản gắn theo khung ?ky= */
  social?: import('./social-tro-ve-tinh').TroVe | null;
};

/** tập đang trong lò (xv_may.nguon.dang_lam — chay-kenh ghi lúc bắt đầu, lam-tap ghi từng bước; hỏng thì giữ kèm loi) */
export type DangLam = { id: string; luc: string; buoc?: string; so?: number; tong?: number; buoc_luc?: string; loi?: string | null };

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
  if (k.ke.dangLam) them(k.ke.dangLam.luc.slice(0, 10), 'sx', `đang làm ${k.ke.dangLam.id}`);
  for (const v of k.videos) { them(v.ngayLam, 'lam', v.ten); if (v.trangThai === 'da_dang') them(v.ngayDang, 'dang', v.ten); }
  for (const l of k.ke.lichDang) them(l.ngay, 'hen', `${l.gio ?? ''} ${l.nen} · ${l.tieuDe}`.trim());
  return [...m.values()].sort((a, b) => a.ngay.localeCompare(b.ngay));
}

/** CÂY KẾ HOẠCH của kênh (anh 02/11/2026: "nhìn được realtime quá trình sx, lên lịch ở đây"): khối ▶ Đang sản xuất (tập trong lò, bước k/n, từ giờ nào)
 *  + khối 🗓 Lịch (bài chờ đăng lúc nào, bài chờ chấm / sửa lại, lượt làm tập kế). Thuần — component chỉ vẽ. Giờ hiện theo giờ VN. */
export type DongKe = { id: string; nhom?: boolean; chu: string; phu?: string; mau?: string };
const gioVn = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
const thuNgay = (ymd: string) => `${THU[new Date(`${ymd}T00:00:00Z`).getUTCDay() || 7]} ${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
export function cayKeHoach(k: Pick<KenhSp, 'videos' | 'ke'>, bayGio = Date.now()): DongKe[] {
  const ra: DongKe[] = [], d = k.ke.dangLam;
  if (d) {
    const phut = Math.max(0, Math.round((bayGio - Date.parse(d.buoc_luc ?? d.luc)) / 60_000)), tong = Math.max(0, Math.round((bayGio - Date.parse(d.luc)) / 60_000));
    ra.push({ id: 'sx', nhom: true, chu: '▶ Đang sản xuất', phu: `bắt đầu ${gioVn(d.luc)} · ${tong} phút` });
    // bước đứng TRƯỚC (cột hẹp cắt phần phụ — YDNI một dòng), mã tập xuống phần phụ
    // một bước đứng > 30 phút (bước dài nhất ~10–15 phút) = nghi treo → đỏ ngay, không đợi trần giờ của lam-tap
    const dung = !d.loi && phut > 30;
    ra.push({ id: 'sx/1', chu: d.loi ? `✗ ${d.loi}` : d.buoc ? `bước ${d.so}/${d.tong} · ${d.buoc} · ${dung ? `⚠ đứng ${phut} phút` : `${phut} phút`}` : 'đang khởi động',
      mau: d.loi || dung ? 'var(--bad)' : 'var(--warn)', phu: d.id });
  }
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

/** LỘ TRÌNH KÊNH (lo-trinh.json, chung mọi kênh studio): các giai đoạn G0…Gn, mỗi giai đoạn một trạng thái. Giai đoạn đang đứng = cái đầu tiên chưa xong. */
export type TrangThaiGd = 'cho_anh' | 'dang' | 'chua' | 'xong';
export type GiaiDoan = { ma: string; ten: string; viec: string; anh: string; trang_thai: TrangThaiGd };
/** PLAYLIST theo kế hoạch (lo-trinh.json › playlist; G1 chuyển sang kenh.json khi máy làm tập theo playlist). */
export type TrangThaiPl = 'de_xuat' | 'mo' | 'sau' | 'tam_dung';
export type PlaylistKh = { ma: string; ten: string; tien_to?: string; noi_dung?: string; ho_hinh?: string; ngay?: string; trang_dich?: string; mo_dau?: boolean; trang_thai: TrangThaiPl; khi?: string };
export type LoTrinh = { ten?: string; plan?: string; muc_tieu?: string; cap_nhat?: string; playlist?: PlaylistKh[]; giai_doan: GiaiDoan[] };
const GD: Record<TrangThaiGd, { ic: string; chu: string; mau: string }> = {
  xong: { ic: '✅', chu: 'xong', mau: 'var(--ok)' }, dang: { ic: '▶', chu: 'đang làm', mau: 'var(--warn)' },
  cho_anh: { ic: '⏸', chu: 'chờ anh', mau: 'var(--accent)' }, chua: { ic: '○', chu: 'chưa tới', mau: 'var(--fg-4)' },
};
/** Tóm một dòng cho dòng kênh: "🧭 G0 Chốt · chờ anh chốt" / "🧭 xong lộ trình". Thuần. */
export function tomLoTrinh(lt: LoTrinh): { xong: number; tong: number; hienTai: GiaiDoan | null; chu: string; mau: string } {
  const ds = lt.giai_doan ?? [], xong = ds.filter((g) => g.trang_thai === 'xong').length, h = ds.find((g) => g.trang_thai !== 'xong') ?? null;
  if (!h) return { xong, tong: ds.length, hienTai: null, chu: '🧭 xong lộ trình', mau: 'var(--ok)' };
  const t = GD[h.trang_thai] ?? GD.chua;
  return { xong, tong: ds.length, hienTai: h, chu: `🧭 ${h.ma} ${h.ten} · ${h.trang_thai === 'cho_anh' ? (h.anh && h.anh !== 'không' ? `chờ anh ${h.anh}` : 'chờ anh') : t.chu}`, mau: t.mau };
}
/** Khối 🧭 Lộ trình trong cây kênh: dòng nhóm (x/n xong · đang ở đâu) + mỗi giai đoạn một dòng (trạng thái · việc · anh làm gì). Thuần. */
export function cayLoTrinh(lt: LoTrinh): DongKe[] {
  const t = tomLoTrinh(lt), ngay = lt.cap_nhat ? ` · cập nhật ${lt.cap_nhat.slice(8, 10)}/${lt.cap_nhat.slice(5, 7)}` : '';
  return [{ id: 'lt', nhom: true, chu: `🧭 Lộ trình (${t.xong}/${t.tong} xong)`, phu: `${t.hienTai ? `đang ở ${t.hienTai.ma}` : 'đã tự vận hành'}${ngay}${lt.muc_tieu ? ` · đích: ${lt.muc_tieu}` : ''}` },
    ...(lt.giai_doan ?? []).map((g): DongKe => { const s = GD[g.trang_thai] ?? GD.chua;
      return { id: `lt/${g.ma}`, chu: `${s.ic} ${g.ma} ${g.ten} · ${s.chu}`, mau: s.mau, phu: `${g.viec}${g.anh && g.anh !== 'không' ? ` · anh: ${g.anh}` : ''}` }; })];
}

const PL: Record<TrangThaiPl, { ic: string; chu: string; mau: string }> = {
  mo: { ic: '▶', chu: 'đang mở', mau: 'var(--ok)' }, de_xuat: { ic: '📝', chu: 'đề xuất', mau: 'var(--accent)' },
  sau: { ic: '○', chu: 'mở sau', mau: 'var(--fg-4)' }, tam_dung: { ic: '⏸', chu: 'tạm dừng', mau: 'var(--warn)' },
};
/** Khối 📂 Playlist trong cây kênh: playlist theo kế hoạch, playlist mở đầu đứng trước. Thuần. */
export function cayPlaylist(lt: LoTrinh): DongKe[] {
  const ds = [...(lt.playlist ?? [])].sort((a, b) => Number(!!b.mo_dau) - Number(!!a.mo_dau));
  if (!ds.length) return [];
  const mo = ds.filter((p) => p.trang_thai === 'mo').length, dau = ds.filter((p) => p.mo_dau).length;
  return [{ id: 'pl', nhom: true, chu: `📂 Playlist (${ds.length})`, phu: `${mo} đang mở · ${dau} mở đầu${ds.some((p) => p.trang_thai === 'de_xuat') ? ' · đề xuất chờ G0 chốt' : ''}` },
    ...ds.map((p): DongKe => { const s = PL[p.trang_thai] ?? PL.sau;
      return { id: `pl/${p.ma}`, chu: `${s.ic} ${p.ten} · ${s.chu}${p.mo_dau ? ' · mở đầu' : p.khi ? ` · ${p.khi}` : ''}`, mau: s.mau,
        phu: [p.noi_dung, p.ho_hinh && `hình ${p.ho_hinh}`, p.ngay && p.ngay !== '—' && `ngày ${p.ngay}`, p.trang_dich && `→ ${p.trang_dich}`, p.tien_to && `tiêu đề "${p.tien_to}"`].filter(Boolean).join(' · ') }; })];
}
/** ĐÓNG / MỞ từng khối trong cây (anh 02/11/2026 "các phần bên trong đều phải cho đóng mở tuỳ ý"): dòng nhóm luôn giữ, con của nhóm đang gập thì bỏ.
 *  khoaNhom(r) = khoá nhóm nếu r là dòng nhóm, null nếu là dòng con (thuộc nhóm đứng trước gần nhất). Thuần. */
export function locGap<T>(rows: T[], khoaNhom: (r: T) => string | null, gap: ReadonlySet<string>): T[] {
  let dangGap = false;
  return rows.filter((r) => { const k = khoaNhom(r); if (k != null) { dangGap = gap.has(k); return true; } return !dangGap; });
}
