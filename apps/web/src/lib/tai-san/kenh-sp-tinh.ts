// KÊNH SẢN PHẨM — phần TÍNH (thuần, client import được; tự kiểm: tsx kenh-sp-tinh.test.mts). Đọc DB ở kenh-sp.ts.
// Kênh nội dung coi là SẢN PHẨM (xv_may.la_san_pham — anh 02/11/2026, kênh Yesterday's News Tonight): số đo hằng ngày ở kenh_so_ngay
// (kenh youtube, san_pham 'may:<mã>', hien = lượt xem cộng dồn, so_muc = video đã đăng, chi_tiet.nguoi_dk) do may-dung.mts --so-kenh ghi.
// 7 ngày = bản ghi mới nhất − bản ghi gần nhất có ngày ≤ hôm nay − 7; chưa có mốc đó = null ("–", chưa đo ≠ 0).

export type SoNgayKenh = { ngay: string; xem: number; daDang: number; nguoiDk: number | null };
export type VideoKenh = { slug: string; ten: string; /** ngày làm xong (bản xuất, không có thì ngày nạp) */ ngayLam: string | null; trangThai: 'chua_xuat' | 'cho_cham' | 'duyet' | 'sua_lai' | 'da_dang'; ngayDang: string | null; url: string | null; xem: number | null; giay: number | null;
  /** mã playlist của tập (xv_may_video.dang.playlist — lam-tap ghi lúc nạp; G1) — null = tập cũ chưa chia playlist */ playlist?: string | null };
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
    /** giờ VN sớm nhất máy đăng được đăng bài của kênh (xv_may.dang[].gio_tu) */ gioDang: string | null;
    /** tập đang dở chưa nạp máy đăng (xv_may.nguon.tap_cho — chay-kenh.mjs ghi mỗi lượt) */ tapCho?: TapCho[] };
  /** PLAYLIST THẬT của kênh (kenh.json › playlist — máy làm tập chạy theo đây; G1 tầng playlist chung): lịch + số từng playlist. [] = kênh chưa chia playlist */
  playlist?: PlaylistKenh[];
  /** SỔ KÊNH (apps/xuong-video/scripts/lich-su/so-kenh.json theo mã máy — anh 04/11/2026 "cần có nơi tổ chức để sau này lên video mới ko bị chệch hướng"):
   *  định vị + luật + mẫu đã duyệt + hàng chờ ý tưởng + playlist kế hoạch + lộ trình G0…Gn; null = kênh chưa khai sổ */
  so?: SoKenh | null;
  /** social trỏ về kênh (bài short dẫn link kênh) — tab Tài sản gắn theo khung ?ky= */
  social?: import('./social-tro-ve-tinh').TroVe | null;
};

/** tập đang trong lò (xv_may.nguon.dang_lam — chay-kenh ghi lúc bắt đầu, lam-tap ghi từng bước; hỏng thì giữ kèm loi) */
export type TapCho = { id: string; chu_de: string | null; cau: number; lan: number; loi: string | null; tho: string | null };
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
  if (k.ke.dangLam) them(k.ke.dangLam.luc.slice(0, 10), 'sx', `đang làm ${k.ke.dangLam.id}`);
  for (const v of k.videos) { them(v.ngayLam, 'lam', v.ten); if (v.trangThai === 'da_dang') them(v.ngayDang, 'dang', v.ten); }
  for (const l of k.ke.lichDang) them(l.ngay, 'hen', `${l.gio ?? ''} ${l.nen} · ${l.tieuDe}`.trim());
  return [...m.values()].sort((a, b) => a.ngay.localeCompare(b.ngay));
}

/** CÂY KẾ HOẠCH của kênh (anh 02/11/2026: "nhìn được realtime quá trình sx, lên lịch ở đây"): khối ▶ Đang sản xuất (tập trong lò, bước k/n, từ giờ nào)
 *  + khối 🗓 Lịch (bài chờ đăng lúc nào, bài chờ chấm / sửa lại, lượt làm tập kế). Thuần — component chỉ vẽ. Giờ hiện theo giờ VN. */
export type DongKe = { id: string; nhom?: boolean; chu: string; phu?: string; mau?: string; /** link mở kèm dòng (vd ▶ xem demo) */ url?: string; urlChu?: string };
const gioVn = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
const thuNgay = (ymd: string) => `${THU[new Date(`${ymd}T00:00:00Z`).getUTCDay() || 7]} ${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
export function cayKeHoach(k: Pick<KenhSp, 'videos' | 'ke'>, bayGio = Date.now()): DongKe[] {
  const ra: DongKe[] = [], d = k.ke.dangLam;
  if (d) {
    const phut = Math.max(0, Math.round((bayGio - Date.parse(d.buoc_luc ?? d.luc)) / 60_000)), tong = Math.max(0, Math.round((bayGio - Date.parse(d.luc)) / 60_000));
    ra.push({ id: 'sx', nhom: true, chu: `▶ Đang sản xuất: ${d.ten ?? d.id}`, phu: `bắt đầu ${gioVn(d.luc)} · ${tong} phút` });
    // bước đứng TRƯỚC (cột hẹp cắt phần phụ — YDNI một dòng), mã tập xuống phần phụ
    // một bước đứng > 30 phút (bước dài nhất ~10–15 phút) = nghi treo → đỏ ngay, không đợi trần giờ của lam-tap
    const dung = !d.loi && phut > 30;
    ra.push({ id: 'sx/1', chu: d.loi ? `✗ ${d.loi}` : d.buoc ? `bước ${d.so}/${d.tong} · ${d.buoc} · ${dung ? `⚠ đứng ${phut} phút` : `${phut} phút`}` : 'đang khởi động',
      mau: d.loi || dung ? 'var(--bad)' : 'var(--warn)', phu: d.chi_tiet ? `${d.chi_tiet} · ${d.id}` : d.id });
  }
  // tập đang dở (chưa nạp máy đăng, không phải tập đang chạy): hiện để không "biến mất" giữa hai lượt
  const cho = (k.ke.tapCho ?? []).filter((t) => t.id !== d?.id);
  if (cho.length) { if (!d) ra.push({ id: 'sx', nhom: true, chu: '▶ Đang sản xuất', phu: 'không có tập nào đang chạy · việc nền chạy lại mỗi giờ' });
    for (const t of cho) ra.push({ id: `cho/${t.id}`, chu: `⏸ ${t.chu_de ?? t.id}`, mau: t.lan >= 3 ? 'var(--bad)' : 'var(--fg-2)',
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
export type MauKenh = { ma: string; ten: string; loai: 'short' | 'dai'; playlist?: string; nhip?: string; kho?: string; trang?: string; sinh?: string; demo?: string; tu_sinh?: string };
/** Ý TƯỞNG trong hàng chờ (so-kenh.json › hang_cho); trạng thái trong sổ bị tập thật đè (tập slug = mã ý tưởng: đã làm / đã đăng). */
export type TrangThaiY = 'chua' | 'san_sang' | 'demo' | 'da_lam' | 'da_dang';
export type YTuong = { ma: string; mau: string; chu_de: string; ngay?: string; trang_thai: TrangThaiY };
export type SoKenh = { ten?: string; plan?: string; muc_tieu?: string; cap_nhat?: string; playlist?: PlaylistKh[]; giai_doan: GiaiDoan[];
  dinh_vi?: { cho_ai?: string; dich?: string; cau_ket?: string; ngon_ngu?: string }; luat?: string[]; mau?: MauKenh[]; hang_cho?: YTuong[]; mo_dau?: string };
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
/** Khối 🧩 MẪU ĐÃ DUYỆT: một dòng một mẫu (Short / dài · playlist · nhịp · kho ý tưởng) + link ▶ xem demo. Thuần. */
export function cayMau(so: SoKenh): DongKe[] {
  const ds = so.mau ?? []; if (!ds.length) return [];
  const pl = new Map((so.playlist ?? []).map((p) => [p.ma, p.ten])), n = (l: string) => ds.filter((m) => m.loai === l).length;
  return [{ id: 'mau', nhom: true, chu: `🧩 Mẫu đã duyệt (${ds.length})`, phu: `${n('short')} Short · ${n('dai')} dài 16:9 · tập ngoài các mẫu này không lên kênh`, url: so.mo_dau, urlChu: so.mo_dau ? '▶ đoạn mở đầu' : undefined },
    ...ds.map((m): DongKe => ({ id: `mau/${m.ma}`, chu: `${m.loai === 'dai' ? '🎞' : '📱'} ${m.ten}`, url: m.demo, urlChu: m.demo ? '▶ xem demo' : undefined,
      phu: [m.loai === 'dai' ? 'dài 16:9' : 'Short 9:16', m.playlist && `playlist ${pl.get(m.playlist) ?? m.playlist}`, m.nhip, m.kho && `kho ${m.kho}`, m.tu_sinh && 'máy tự sinh ý tưởng'].filter(Boolean).join(' · ') }))];
}
const YT: Record<TrangThaiY, { ic: string; chu: string; mau: string; thu: number }> = {
  san_sang: { ic: '⏳', chu: 'sẵn sàng', mau: 'var(--warn)', thu: 0 }, chua: { ic: '○', chu: 'chưa làm', mau: 'var(--fg-2)', thu: 1 }, demo: { ic: '🎬', chu: 'đã có demo', mau: 'var(--accent)', thu: 2 },
  da_lam: { ic: '✔', chu: 'đã làm', mau: 'var(--ok)', thu: 3 }, da_dang: { ic: '✅', chu: 'đã đăng', mau: 'var(--ok)', thu: 4 },
};
/** Trạng thái thật của ý tưởng: tập kênh có slug = mã ý tưởng thì đè trạng thái trong sổ (đã đăng > đã làm). Thuần. */
export function trangThaiY(y: YTuong, videos: Pick<VideoKenh, 'slug' | 'trangThai'>[]): TrangThaiY {
  const v = videos.filter((x) => x.slug === y.ma);
  return v.some((x) => x.trangThai === 'da_dang') ? 'da_dang' : v.length ? 'da_lam' : y.trang_thai;
}
/** Khối 💡 HÀNG CHỜ Ý TƯỞNG: sẵn sàng → chưa làm (theo ngày) → đã có demo → đã làm → đã đăng. Thuần. */
export function cayHangCho(so: SoKenh, videos: Pick<VideoKenh, 'slug' | 'trangThai'>[]): DongKe[] {
  const ds = (so.hang_cho ?? []).map((y) => ({ y, t: trangThaiY(y, videos) })); if (!ds.length) return [];
  const mau = new Map((so.mau ?? []).map((m) => [m.ma, m.ten])), dem = (t: TrangThaiY) => ds.filter((x) => x.t === t).length;
  ds.sort((a, b) => YT[a.t].thu - YT[b.t].thu || (a.y.ngay ?? '9').localeCompare(b.y.ngay ?? '9'));
  return [{ id: 'hc', nhom: true, chu: `💡 Hàng chờ ý tưởng (${ds.length})`, phu: `${dem('san_sang')} sẵn sàng · ${dem('chua')} chưa làm · ${dem('demo')} có demo · ${dem('da_dang')} đã đăng · máy lấy chủ đề kế từ đây` },
    ...ds.map(({ y, t }): DongKe => ({ id: `hc/${y.ma}`, chu: `${YT[t].ic} ${y.chu_de}`, mau: YT[t].mau,
      phu: [mau.get(y.mau) ?? y.mau, y.ngay && `${y.ngay.slice(8, 10)}/${y.ngay.slice(5, 7)}/${y.ngay.slice(0, 4)}`, YT[t].chu].filter(Boolean).join(' · ') }))];
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
