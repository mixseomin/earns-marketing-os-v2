// LOGS etp — loại sự kiện + gom theo khung (một chỗ cho trang components/etp-logs.tsx và bài tự kiểm etp-logs.test.mts). Máy chủ: lib/actions/etp-logs docLogs.
/** một sự kiện: [giây epoch, loại, mã (camp / dòng / creative), chữ, nhóm thống kê 1, nhóm thống kê 2, mã phim]
 *  nhóm 1: camp = luật · dòng / creative / chấm / duyệt = dạng · lệnh lỗi = câu lỗi; nhóm 2: tăng / giảm = bậc $a → $b · tắt = ngân sách lúc tắt · chấm trượt = tiêu chí chặn · duyệt = người duyệt */
export type HangLog = [number, string, number | null, string, string, string, (number | null)?, (string | null)?, string?, string?, string?, (number | null)?];
// [3] lý do / nội dung (bỏ tiền tố ngày) · [6] mã phim (mở ngăn phim / sản xuất) · [7] bộ tài khoản (null = chưa gắn camp) · [8] tên camp / phim · [9] thay đổi ($3 → $1, bộ 2 → bộ 1, dạng) · [10] ai làm (máy / lệnh anh / người duyệt) · [11] camp liên quan (dòng: camp đã lên · creative: camp dùng creative) — lọc theo bộ lọc camp
/** tên hai chiều thống kê theo loại (đầu thẻ nổi) */
export const CHIEU_TK: Record<string, [string, string]> = { camp: ['Theo luật', 'Theo bậc'], dong: ['Theo dạng', 'Theo bước · lý do'], creative: ['Theo dạng', 'Theo tiêu chí'],
  dm: ['Theo dạng', 'Theo nguồn'], sx: ['Theo dạng', 'Theo bước'], ct: ['Theo dạng', 'Theo tiêu chí chặn'], dq: ['Theo dạng', 'Theo người duyệt'], dlt: ['Theo dạng', 'Theo người duyệt'],
  loi: ['Theo lỗi', 'Theo bậc'], cho: ['Theo giờ hẹn', 'Theo dạng'] };   // khoá = mã loại (ưu tiên) hoặc ma
export type DemTk = { ten: string; n: number };
/** đếm một chiều, nhiều nhất trước; mục rỗng gộp "không ghi"; quá `toiDa` mục thì gộp phần đuôi "khác" */
export function demTk(ds: HangLog[], cot: 4 | 5, toiDa = 8): DemTk[] {
  const m = new Map<string, number>(); for (const e of ds) { const k = e[cot] || ''; m.set(k, (m.get(k) ?? 0) + 1); }
  const xep = [...m.entries()].filter(([k]) => k).sort((a, b) => b[1] - a[1]).map(([ten, n]) => ({ ten, n }));
  if (xep.length > toiDa) { const du = xep.splice(toiDa - 1); xep.push({ ten: `${du.length} nhóm khác`, n: du.reduce((a, x) => a + x.n, 0) }); }
  return xep;
}
/** chi / thu một giờ × bộ của nhà: [giây epoch đầu giờ, chi, thu, bộ] */
export type HangGio = [number, number, number, (string | null)?];   // [3] = bộ tài khoản
export type DuLogs = { gio: number; den: number; ev: HangLog[]; tien: HangGio[]; luat?: Record<string, string> };   // luat: mã luật thường → tên đầy đủ (etp.xet_luat)

/** nhom = nhóm cột bảng (DataTable group; 'khac' tắt mặc định — bật ở ⚙ Cột) · ma = mã sự kiện trỏ tới gì · mau = màu nhãn icon + số (anh 08/11/2026 "nhìn toàn số đéo hiểu ngay… dùng icon + màu sắc cho rõ ràng": mỗi số mang icon + màu của loại, khỏi dò cột) — xanh = mở / tăng / qua, đỏ = tắt / lỗi / loại, cam = giảm / dừng · bao = lỗi cần liếc thấy */
export type LoaiLog = { k: string; icon: string; ten: string; nhom: 'camp' | 'sx' | 'cham' | 'khac'; ma: 'camp' | 'dong' | 'creative'; mau: string; ngan: string; giai?: string; bao?: boolean };   // giai = câu giải thích loại việc (đầu thẻ nổi)   // ngan = tên ngắn ở tiêu đề cột
export const NHOM_LOG = [
  { key: 'camp', label: 'Camp', title: 'việc máy làm trên camp nhà: mở, nhân bản, tắt, tăng / giảm bậc, lên ROAS, sang bộ' },
  { key: 'sx', label: 'Sản xuất', title: 'dòng sản xuất creative: dòng mới, creative dựng xong, dòng xong / dừng / lỗi' },
  { key: 'cham', label: 'Chấm · duyệt', title: 'cổng chấm creative (lần chấm gần nhất) + người duyệt trên Telegram / trang' },
  { key: 'khac', label: 'Khác', title: 'nhiều mà ít khi cần: lộ trình phim, việc khác, dòng huỷ', defaultOn: false },
] as const;
/** thứ tự = thứ tự cột (cố định — không sắp theo số) */
export const LOAI_LOG: LoaiLog[] = [
  { k: 'mo', icon: '▶', ten: 'Mở camp', nhom: 'camp', mau: '#4ade80', ngan: 'Mở', ma: 'camp' },
  { k: 'cho', icon: '⏳', ten: 'Chờ chạy', ngan: 'Chờ chạy', nhom: 'camp', mau: '#fbbf24', ma: 'camp' },
  { k: 'nb', icon: '⧉', ten: 'Nhân bản', nhom: 'camp', mau: '#22d3ee', ngan: 'Nhân bản', ma: 'camp' },
  { k: 'tat', icon: '⏹', ten: 'Tắt', nhom: 'camp', mau: '#f87171', ngan: 'Tắt', ma: 'camp' },
  { k: 'tang', icon: '▲', ten: 'Tăng bậc', nhom: 'camp', mau: '#a3e635', ngan: 'Tăng', ma: 'camp' },
  { k: 'giam', icon: '▼', ten: 'Giảm bậc', nhom: 'camp', mau: '#fb923c', ngan: 'Giảm', ma: 'camp' },
  { k: 'roas', icon: '★', ten: 'Lên ROAS', nhom: 'camp', mau: '#facc15', ngan: 'ROAS', ma: 'camp' },
  { k: 'sb', icon: '⇄', ten: 'Sang bộ', nhom: 'camp', mau: '#c084fc', ngan: 'Sang bộ', ma: 'camp' },
  { k: 'dtc', icon: '✋', ten: 'Duyệt tay', nhom: 'camp', mau: '#93c5fd', ngan: 'Duyệt tay', ma: 'camp' },
  { k: 'loi', icon: '⛔', ten: 'Lệnh lỗi', nhom: 'camp', mau: '#ef4444', ngan: 'Lỗi lệnh', ma: 'camp', bao: true },
  { k: 'dm', icon: '＋', ten: 'Dòng mới', nhom: 'sx', mau: '#60a5fa', ngan: 'Dòng mới', ma: 'dong' },
  { k: 'sx', icon: '🎬', ten: 'Creative dựng', nhom: 'sx', mau: '#a78bfa', ngan: 'Dựng', ma: 'creative' },
  { k: 'dx', icon: '✅', ten: 'Dòng xong', nhom: 'sx', mau: '#4ade80', ngan: 'Xong', ma: 'dong' },
  { k: 'dd', icon: '⏸', ten: 'Dòng dừng', nhom: 'sx', mau: '#fbbf24', ngan: 'Dừng', ma: 'dong' },
  { k: 'dl', icon: '⛔', ten: 'Dòng lỗi', nhom: 'sx', mau: '#ef4444', ngan: 'Lỗi', ma: 'dong', bao: true },
  { k: 'cq', icon: '✓', ten: 'Chấm qua', nhom: 'cham', mau: '#4ade80', ngan: 'Qua', ma: 'creative' },
  { k: 'ct', icon: '✗', ten: 'Chấm trượt', nhom: 'cham', mau: '#f87171', ngan: 'Trượt', ma: 'creative' },
  { k: 'dq', icon: '👍', ten: 'Người duyệt qua', nhom: 'cham', mau: '#86efac', ngan: 'Duyệt qua', ma: 'creative' },
  { k: 'dlt', icon: '👎', ten: 'Người duyệt loại', nhom: 'cham', mau: '#fca5a5', ngan: 'Loại', ma: 'creative', bao: true },
  { k: 'lt', icon: '🗺', ten: 'Lộ trình phim', nhom: 'khac', mau: '#94a3b8', ngan: 'Lộ trình', ma: 'camp' },
  { k: 'khac', icon: '·', ten: 'Việc khác', nhom: 'khac', mau: '#94a3b8', ngan: 'Khác', ma: 'camp' },
  { k: 'dh', icon: '✕', ten: 'Dòng huỷ', nhom: 'khac', mau: '#94a3b8', ngan: 'Huỷ', ma: 'dong' },
];
export const LOAI_THEO_K: Record<string, LoaiLog> = Object.fromEntries(LOAI_LOG.map((x) => [x.k, x]));

/** khung gom (phút) + kỳ (giờ) cho chip */
export const KHUNG_PHUT = [15, 30, 60, 180, 360, 1440] as const;
export const KY_GIO = [6, 24, 72, 168, 720] as const;
export const tenKhung = (p: number) => (p < 60 ? `${p} phút` : p < 1440 ? `${p / 60} giờ` : '1 ngày');
export const tenKy = (h: number) => (h < 24 ? `${h} giờ` : h === 24 ? '24 giờ' : `${h / 24} ngày`);

const VN = 7 * 3600;
/** đầu khung (giây epoch) chứa t — khung tính theo giờ VN (khung 1 ngày bắt đầu 07:00 VN = ngày Ethopex; khung giờ khớp đồng hồ VN) */
export function dauKhung(t: number, phut: number): number {
  const s = phut * 60;
  if (phut >= 1440) return Math.floor(t / s) * s;   // ngày Ethopex = ngày UTC (07:00 VN)
  return Math.floor((t + VN) / s) * s - VN;
}

export type KhungLog = { t: number; dem: Record<string, HangLog[]>; chi: number; thu: number; coTien: boolean };
/** gom sự kiện + tiền theo khung — khung mới nhất trước; khung trống (không sự kiện, không tiền) vẫn có dòng để thấy khoảng lặng */
export function gomLogs(du: Pick<DuLogs, 'ev' | 'tien' | 'gio' | 'den'>, phut: number): KhungLog[] {
  const m = new Map<number, KhungLog>(), s = phut * 60;
  const lay = (t: number) => { const k = dauKhung(t, phut); let x = m.get(k); if (!x) m.set(k, (x = { t: k, dem: {}, chi: 0, thu: 0, coTien: false })); return x; };
  const dau = dauKhung(du.den - du.gio * 3600, phut);
  for (let t = dauKhung(du.den, phut); t >= dau; t -= s) lay(t);
  for (const e of du.ev) { if (e[0] < dau) continue; const x = lay(e[0]); (x.dem[e[1]] ??= []).push(e); }
  // tiền chỉ có theo GIỜ — khung < 1 giờ thì giờ đó cộng vào khung chứa đầu giờ (trang ghi rõ)
  for (const [t, chi, thu] of du.tien) { if (t < dau) continue; const x = lay(t); x.chi += chi; x.thu += thu; x.coTien = true; }
  return [...m.values()].sort((a, b) => b.t - a.t);
}

const p2 = (n: number) => String(n).padStart(2, '0');
/** nhãn khung theo giờ VN: "14:15–14:30 08/11" · "08/11" (ngày, 07:00→07:00) */
export function nhanKhung(t: number, phut: number): string {
  const a = new Date((t + VN) * 1000), b = new Date((t + VN + phut * 60) * 1000);
  const ng = `${p2(a.getUTCDate())}/${p2(a.getUTCMonth() + 1)}`;
  if (phut >= 1440) return `${ng} (07h→07h)`;
  return `${p2(a.getUTCHours())}:${p2(a.getUTCMinutes())}–${p2(b.getUTCHours())}:${p2(b.getUTCMinutes())} ${ng}`;
}
export const gioVn = (t: number) => { const a = new Date((t + VN) * 1000); return `${p2(a.getUTCHours())}:${p2(a.getUTCMinutes())} ${p2(a.getUTCDate())}/${p2(a.getUTCMonth() + 1)}`; };

/** LỌC THEO BỘ LỌC CAMP CỦA TRANG (anh 08/11/2026 "Dùng bộ lọc này cho đầy đủ" — Lọc · Lãi/lỗ · Tuổi · Luật · Loại · ROAS · A/B · TK): ids = tập camp sau lọc (null = không lọc).
 *  Việc giữ lại khi camp liên quan [11] nằm trong tập; việc chưa gắn camp (chấm / dựng / dòng mới trước khi lên camp) bị loại khi đang lọc, đếm ở `chuaCamp`. Tiền đã lọc ở máy chủ. */
export function locCamp(du: DuLogs, ids: number[] | null): DuLogs & { chuaCamp: number } {
  if (!ids) return { ...du, chuaCamp: 0 };
  const co = new Set(ids);
  return { ...du, ev: du.ev.filter((e) => e[11] != null && co.has(e[11])), chuaCamp: du.ev.filter((e) => e[11] == null).length };
}
/** mã luật chưa có trong sổ xét luật (etp.xet_luat) — tên lấy từ mô tả của chính máy luật (apps/xuong-video/scripts/ethopex/luat-ethopex.py) */
const LUAT_THEM: Record<string, string> = { h2: 'H2 · tăng bậc rồi lỗ 2 ngày đã khép → về $1' };
/** nhóm thống kê 1 của việc camp: mã luật trơ ("T1", "H2") → tên đầy đủ; chữ thường giữ nguyên */
export const tenLuat = (n1: string, so?: Record<string, string>) => (/^[A-Z]+[0-9]*$/.test(n1) ? so?.[n1.toLowerCase()] ?? LUAT_THEM[n1.toLowerCase()] ?? n1 : n1);

const GIAI: Record<string, string> = {"cho": "Camp đã tạo trên Ethopex nhưng CHƯA tới giờ chạy: lịch lên camp 07–12h VN, camp tạo ngoài khung đó hẹn chạy 07:00 hôm sau. Đếm ở khung giờ TẠO camp; tới giờ hẹn thì camp rời khỏi cột này và bắt đầu tiêu.", "mo": "Tạo camp mới trên Ethopex cho một creative đã qua cổng chấm. Camp mới chạy theo lịch lên (07–12h VN; ngoài giờ đó hẹn 07:00 hôm sau).", "nb": "Nhân bản một camp đang thắng thành camp mới cùng creative, cùng bộ tài khoản, để mở rộng chi.", "tat": "Tắt camp theo luật tắt của máy (T1 lỗ ngày đầu, T2 lỗ 2 ngày đầu, T8 cắt sớm 8 giờ đầu, L3 lỗ 3 ngày liền, G10…) hoặc theo lệnh anh.", "tang": "Tăng ngân sách camp lên bậc kế trên thang $1 → 2 → 3 → 4 → 6 → 9 → 13 → 20 (mỗi bậc ≤ ×1,5) khi đủ điều kiện tăng, hoặc theo A/B.", "giam": "Hạ ngân sách camp xuống bậc dưới khi lỗ (H2: tăng rồi lỗ 2 ngày → về $1, giảm trong ngày…) hoặc theo lệnh anh.", "roas": "Lên camp ★ ROAS (đặt mức ROAS tối thiểu) từ camp đủ lãi, hoặc nhân thêm camp ROAS trong A/B.", "sb": "Nhân camp sang BỘ TÀI KHOẢN KHÁC: tạo camp mới ở bộ đích với cùng creative; camp gốc ở bộ cũ giữ nguyên, không bị tắt.", "dtc": "Người duyệt bấm trên trang hoặc Telegram cho một creative: duyệt chạy tiếp, loại, đổi sang ảnh tĩnh…", "loi": "Lệnh gửi Ethopex bị từ chối hoặc gửi rồi mà không đổi (vượt trần $/camp, camp đang tắt…). Lý do ở từng dòng.", "dm": "Máy mở một dòng sản xuất creative mới cho phim (theo lộ trình tự động, ưu tiên ảnh tĩnh, hoặc lệnh anh).", "sx": "Một bước dựng (creative / poster) của dòng sản xuất đã xong — có creative mới chờ chấm.", "dx": "Dòng sản xuất chạy hết các bước và đã tạo camp.", "dd": "Dòng sản xuất dừng giữa chừng (không lên được camp, dòng bị gác…). Lý do ở từng dòng.", "dl": "Một bước của dòng sản xuất bị lỗi (tải phim, cắt, dựng, đưa lên Ethopex…).", "cq": "Creative qua cổng chấm: không tiêu chí Meta / Google nào ≤ 4 điểm — được phép lên camp.", "ct": "Creative bị cổng chấm chặn: có tiêu chí ≤ 4 điểm. Chờ máy cứu (cắt khung vi phạm) hoặc người duyệt.", "dq": "Người duyệt cho qua creative mà máy chấm chặn — quyết định của người duyệt thắng điểm máy.", "dlt": "Người duyệt loại creative — không lên camp.", "lt": "Máy lộ trình xếp việc sản xuất cho phim (thử dạng nào, đang sản xuất bao nhiêu…).", "khac": "Việc khác máy ghi vào nhật ký.", "dh": "Dòng sản xuất bị huỷ (thường vì phim đã có dòng cùng loại đang chạy)."};
for (const l of LOAI_LOG) l.giai = GIAI[l.k];
