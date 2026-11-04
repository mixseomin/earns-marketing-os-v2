// TẦNG PLAYLIST CHUNG cho mọi kênh của studio (G1 lộ trình Astrolas, 02/11/2026 — anh chốt G0). Thuần, không I/O; tự kiểm: tsx playlist.test.mts.
// Cây: Kênh (kenh.json một mục, `may` = máy đăng, trần đăng tính ở đây) → Playlist (kenh.json › playlist[]) → Tập (tap.playlist).
// Mỗi playlist: { ma, ten, tien_to?, lich_tap: [thứ 1–7], gio_tap?, trang_dich?, yt?: { <ngôn ngữ>: <mã playlist YouTube> }, + khoá đè hồ sơ kênh (DE) }.
// Lịch làm tập nằm ở playlist; kênh không khai playlist thì dùng lich_tap / gio_tap của kênh như trước (không đổi gì).
// Hai playlist KHÔNG được trùng ngày: mỗi tập một dấu nguon.dang_lam_ds[<tập>] nhưng khoá chống chồng của chay-kenh vẫn một lượt / kênh + kênh mới trần 1 bài/ngày.

/** khoá playlist được đè lên hồ sơ kênh (khuôn kịch bản, giọng, theme… theo loạt) */
export const DE = ['theme', 'khuon', 'giong_van', 'giong', 'nhac', 'sfx', 'ket', 'cau_cuoi', 'do_dai', 'cau', 'cau_noi', 'tu', 'tu_noi', 'chu_de_truoc', 'toi_da_giay', 'luat_hai', 'hinh_ca_tap'];

export const dsPlaylist = (K) => (Array.isArray(K?.playlist) ? K.playlist : []);

/** lỗi cấu hình playlist của một kênh ([] = sạch) */
export function kiemPlaylist(K) {
  const ds = dsPlaylist(K), loi = [], ma = new Set(), ngay = new Map();
  for (const [i, p] of ds.entries()) {
    if (!p?.ma || !/^[a-z0-9-]+$/.test(p.ma)) loi.push(`playlist #${i + 1}: mã "${p?.ma ?? ''}" phải là chữ thường / số / gạch nối`);
    else if (ma.has(p.ma)) loi.push(`playlist "${p.ma}" khai hai lần`); else ma.add(p.ma);
    if (!p?.ten) loi.push(`playlist "${p?.ma ?? i + 1}": thiếu tên`);
    for (const t of p?.lich_tap ?? []) {
      if (!Number.isInteger(t) || t < 1 || t > 7) { loi.push(`playlist "${p.ma}": thứ ${t} sai (1 = Thứ Hai … 7 = Chủ nhật)`); continue; }
      if (ngay.has(t)) loi.push(`playlist "${p.ma}" và "${ngay.get(t)}" cùng làm tập thứ ${t} — mỗi ngày một playlist (trần 1 bài/ngày, một dấu đang làm mỗi máy)`); else ngay.set(t, p.ma);
    }
  }
  return loi;
}

/** Hôm nay (thứ 1–7, giờ VN "HH:MM") có lượt làm tập không, của playlist nào. { den, playlist: mã | null }. */
export function lichHomNay(K, thu, gioNay) {
  const ds = dsPlaylist(K);
  if (!ds.length) return { den: (K?.lich_tap ?? []).includes(thu) && gioNay >= (K?.gio_tap ?? '00:00'), playlist: null };
  const p = ds.find((x) => (x.lich_tap ?? []).includes(thu) && gioNay >= (x.gio_tap ?? K.gio_tap ?? '00:00'));
  return { den: !!p, playlist: p?.ma ?? null };
}

/** số tập một tuần của kênh (cộng mọi playlist) */
export const tapMoiTuan = (K) => (dsPlaylist(K).length ? dsPlaylist(K).reduce((t, p) => t + (p.lich_tap ?? []).length, 0) : (K?.lich_tap ?? []).length);

/** playlist theo mã (null = không có / kênh không chia playlist); mã lạ thì ném lỗi — tập không được rơi vào playlist không khai */
export function timPlaylist(K, ma) {
  if (!ma) return null;
  const p = dsPlaylist(K).find((x) => x.ma === ma);
  if (!p) throw new Error(`kênh không có playlist "${ma}" (có: ${dsPlaylist(K).map((x) => x.ma).join(', ') || 'không'})`);
  return p;
}

/** Playlist của một tập: mã tập ghi (tap.playlist), không có thì kênh chỉ MỘT playlist → playlist đó (tập làm trước khi chia playlist), không thì null. */
export const playlistCuaTap = (K, ma) => ma ?? (dsPlaylist(K).length === 1 ? dsPlaylist(K)[0].ma : null);

/** Hồ sơ kênh đã đè khoá của playlist (DE) — máy viết / kiểm dùng bản này. */
export function apPlaylist(K, ma) {
  const p = timPlaylist(K, ma);
  if (!p) return K;
  return { ...K, ...Object.fromEntries(DE.filter((k) => p[k] !== undefined).map((k) => [k, p[k]])) };
}

// MẪU ≠ PLAYLIST (anh 05/11/2026: "mẫu là dạng video với nội dung cùng kiểu format; playlist là dạng series có thể chứa nhiều kiểu mẫu để hỗ trợ quá trình truyền
// thông tin — theo góc spy"): kenh.json › mau_khuon[<mẫu>] = KHUÔN VIDEO (độ dài, số câu / từ, trần giây, khuôn kể); playlist = SERIES (nội dung loạt, tiền tố, lịch,
// mẫu được dùng). Hồ sơ một tập = kênh → đè playlist → đè mẫu (khuôn thắng) + dòng "Loạt …" của series nối vào khuôn kể. Mọi máy (viết, dựng, thumbnail, lam-tap) gọi hàm này.
export function hoSoTap(K, { playlist = null, mau = null } = {}) {
  const k1 = apPlaylist(K, playlist), dsMau = K?.mau_khuon ?? null;
  if (mau && dsMau && !dsMau[mau]) throw new Error(`kênh không có mẫu "${mau}" (có: ${Object.keys(dsMau).join(', ')})`);
  const m = mau && dsMau ? dsMau[mau] : null, p = timPlaylist(K, playlist);
  if (p?.mau?.length && mau && !p.mau.includes(mau)) throw new Error(`playlist "${p.ma}" không dùng mẫu "${mau}" (dùng: ${p.mau.join(', ')})`);
  const r = m ? { ...k1, ...Object.fromEntries(DE.filter((k) => m[k] !== undefined).map((k) => [k, m[k]])) } : k1;
  return p?.noi_dung && Array.isArray(r.khuon) && !r.khuon.some((x) => x.startsWith('Loạt ')) ? { ...r, khuon: [...r.khuon, `Loạt (playlist) "${p.ten}": ${p.noi_dung}`] } : r;
}

/** Tiêu đề đăng = tiền tố playlist + tiêu đề tập ("Chart Chapters: Steve Jobs…"); đã có tiền tố thì giữ nguyên. Tiền tố viết "Chart Chapters: …" hoặc "Chart Chapters". */
export function tieuDeDang(tieuDe, p) {
  const tt = String(p?.tien_to ?? '').replace(/[:\s]*…\s*$/, '').replace(/[:\s]+$/, '').trim();
  if (!tt || !tieuDe) return tieuDe;
  return tieuDe.toLowerCase().startsWith(tt.toLowerCase()) ? tieuDe : `${tt}: ${tieuDe}`;
}
