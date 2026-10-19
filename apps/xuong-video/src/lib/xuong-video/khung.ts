// KIỂM KHUNG — phần thuần (14/10/2026, anh: "cần giải pháp kỹ thuật để không xảy ra cho mọi shot về sau, check bằng mắt mới thấy thì còn sai nhiều").
// Mỗi keyframe phải được MÁY NHÌN so với thẻ shot + các khung cùng cảnh (kiem-khung.ts); kết quả gắn với ĐÚNG url keyframe đã kiểm, nên sinh lại
// keyframe là tự hết hiệu lực. Cổng video + duyệt animatic đọc chanKhung — không có đường nào đi tiếp bằng một khung chưa kiểm hoặc kiểm trượt.
import { giaChuCents, type Canh, type KiemKhung, type SoiMat } from './kieu';

export const LOAI_LOI_KHUNG = [
  { key: 'chuyen_canh', ten: 'Chuyển cảnh không nối', mo_ta: 'từ khung trước sang khung này: trạng thái (ai cầm gì, ở đâu), hướng di chuyển, liền máy không phải khoảnh khắc kế' },
  { key: 'bo_tri', ten: 'Bố trí set lệch', mo_ta: 'đồ vật đổi chỗ / đổi trước–sau so với các khung khác trong cảnh' },
  { key: 'vi_tri', ten: 'Nhân vật sai chỗ', mo_ta: 'nhân vật ở sai phía / sai chỗ trong bộ set so với hành động' },
  { key: 'vuot_truc', ten: 'Vượt trục 180°', mo_ta: 'máy sang phía bên kia hành động, hướng màn hình đảo' },
  { key: 'thieu', ten: 'Thiếu', mo_ta: 'nhân vật / đạo cụ thẻ shot cần mà không có' },
  { key: 'thua', ten: 'Thừa', mo_ta: 'nhân vật nhân đôi, tay người lạc, mặt trên vật phải trơn, chữ, thứ thẻ không có' },
  { key: 'trang_thai', ten: 'Sai trạng thái mở', mo_ta: 'khung không đúng trạng thái MỞ của thẻ shot' },
  { key: 'anh_sang', ten: 'Ánh sáng lệch', mo_ta: 'ánh sáng / giờ trong ngày không nối với cảnh' },
  { key: 'nhan_dang', ten: 'Sai tạo hình', mo_ta: 'nhân vật / đạo cụ khác ảnh mẫu (màu, dáng, chi tiết)' },
] as const;
export type LoaiLoiKhung = (typeof LOAI_LOI_KHUNG)[number]['key'];
export const tenLoiKhung = (k: string) => LOAI_LOI_KHUNG.find((x) => x.key === k)?.ten ?? k;
export const TEN_NUT_KHUNG = '🔍 Kiểm khung';

/** Trạng thái kiểm khung của một shot: 'khong' = chưa có keyframe, 'chua' = chưa kiểm / keyframe đổi sau lần kiểm, 'dat', 'tay' = người duyệt tay, 'lech'. */
export function trangThaiKhung(c: Pick<Canh, 'keyframe_url' | 'kiem_khung'>): 'khong' | 'chua' | 'dat' | 'tay' | 'lech' {
  if (!c.keyframe_url) return 'khong';
  const k = c.kiem_khung;
  if (!k || k.url !== c.keyframe_url) return 'chua';
  if (k.dat) return 'dat';
  return k.duyet_tay ? 'tay' : 'lech';
}

/** Trạng thái SOI MẶT (soi-mat.ts): 'khong' = chưa có keyframe / chưa soi lần nào / phim không có mặt người để theo dõi · 'chua' = keyframe đổi sau lần soi ·
 *  'dat' · 'tay' = người nhận (máy báo nhầm) · 'lech' = có nhân vật thấy mặt mà mặt không giống ảnh mẫu. */
export function trangThaiMat(c: Pick<Canh, 'keyframe_url'> & Partial<Pick<Canh, 'soi_mat'>>): 'khong' | 'chua' | 'dat' | 'tay' | 'lech' {
  const m = c.soi_mat;
  if (!c.keyframe_url || !m || !m.ket.length) return 'khong';
  if (m.url !== c.keyframe_url) return 'chua';
  if (m.dat) return 'dat';
  return m.duyet_tay ? 'tay' : 'lech';
}
export const TEN_NUT_MAT = '🙂 Soi mặt';
/** 🩹 Sửa mặt (soi-mat.ts › suaMatCanh): số lần thử tối đa mỗi shot + giá một lần ở cổng đầu chuỗi (ckey Nano Banana 2, sổ nguồn 16/10/2026) */
export const SUA_MAT_TOI_DA = 3;
export const GIA_SUA_MAT_VND = 110.5;
export const chuLechMat = (m: SoiMat) => m.ket.filter((k) => !k.dat).map((k) => `${k.ten} (giống ${Math.round((k.giong ?? 0) * 100)}%)`).join(', ');

/** HƯỚNG NHÌN đo trên keyframe (anh 19/10/2026 "ánh nhìn … làm mấy lần mà vẫn chưa ổn"): người có phía phải nhìn (3D) mà góc đo về phía đó dưới
 *  NGUONG_NHIN° = nhìn vào ống kính / sai phía → cắt sang người kia không khớp ánh mắt (eyeline match). Hiệu chỉnh 4 keyframe tập 122 (soi-mat.py). */
export const NGUONG_NHIN = 15;
type MatDo = SoiMat['ket'][number];
/** Mặt đo được mà nhìn SAI so với phía cần nhìn (nhìn ống kính / sai phía). */
/** Cúi / ngẩng quá ngưỡng này (độ) mà góc ngang gần 0 = đang nhìn xuống / lên một thứ (vết bẩn, điện thoại, sàn), KHÔNG phải nhìn ống kính
 *  (tập 122 #2: Hạ cúi nhìn vết cà phê, ngang +1°, cúi 29° — luật cũ chỉ xét góc ngang nên báo "nhìn ống kính"). */
export const NGUONG_CUI = 20;
export const nhinSai = (k: MatDo): boolean => {
  const n = k.nhin; if (!n?.can || n.can * n.g >= NGUONG_NHIN) return false;
  return !(Math.abs(n.g) < NGUONG_NHIN && Math.abs(n.doc) >= NGUONG_CUI);   // cúi / ngẩng nhìn thứ khác: không phải nhìn máy, không phải sai phía
};
/** NGƯỜI ĐỂ GÁN MẶT trong một shot: người 3D thấy TRONG KHUNG (khung_xam.kiem › trong_khung) nếu shot có khung 3D, không thì mọi nhân vật của shot.
 *  Tập 122 #2: 3D chỉ có Hạ trong khung, bộ so mặt gán mặt Hạ cho Vivian (giống 49%) vì Vivian cũng gắn shot → báo Vivian nhìn sai, 🩹 sửa nhầm người. */
export const nguoiSoiMat = (c: Partial<Pick<Canh, 'khung_xam'>>, ten: string[]): string[] => {
  const k = c.khung_xam?.kiem; if (!k?.length) return ten;
  const trong = new Set(k.filter((x) => x.trong_khung).map((x) => x.nhan_vat));
  return ten.filter((t) => trong.has(t));
};
export const loiNhin = (m: SoiMat): string[] => m.ket.filter(nhinSai).map((k) => {
  const n = k.nhin!; return `${k.ten} ${Math.abs(n.g) < NGUONG_NHIN ? 'nhìn vào ống kính' : 'nhìn sai phía'} (đo ${n.g > 0 ? '+' : ''}${n.g}°, cần nhìn sang ${n.can! > 0 ? 'PHẢI' : 'TRÁI'} màn ${n.tu ? `— ngược phía người đối diện ở shot #${n.tu} (khớp ánh mắt qua cú cắt)` : 'về phía người đối diện'})`;
});

/** HƯỚNG NHÌN THEO CẶP SHOT (anh 19/10/2026 "hướng nhìn rất quan trọng"): phía cần nhìn lấy từ 3D (canNhin) — nhưng shot 3D KHÔNG cho biết người đó
 *  nhìn ai (đối phương không khai trong vi_tri, hoặc không khai hướng) thì trước đây KHÔNG KIỂM: nhìn thẳng ống kính vẫn qua. Ngành: khớp ánh mắt
 *  qua cú cắt (eyeline match — Bordwell & Thompson, *Film Art*, ch. 6 "continuity editing"; Murch: ánh mắt là thứ người xem bám theo khi cắt): hai
 *  người đối đáp ở hai shot liền nhau phải nhìn NGƯỢC phía màn nhau (A nhìn phải → B nhìn trái). Luật: A, B liền nhau cùng phân cảnh, mỗi shot đúng
 *  MỘT mặt đo được hướng, hai người khác nhau, có liên hệ (3D shot này có khai người kia) — mặt chưa có phía cần nhìn lấy NGƯỢC phía mặt bên kia, nếu
 *  mặt bên kia đáng tin (nhìn rõ sang một phía ≥ NGUONG_NHIN và không sai so với 3D của chính nó). Trả các shot có kết quả đổi (id → ket mới). Thuần. */
export function canTheoCap(ds: (Pick<Canh, 'id' | 'thu_tu' | 'phan_doan' | 'keyframe_url'> & Partial<Pick<Canh, 'soi_mat' | 'may_3d'>>)[]): Map<number, SoiMat['ket']> {
  const out = new Map<number, SoiMat['ket']>();
  const xep = [...ds].sort((a, b) => a.thu_tu - b.thu_tu);
  const motMat = (c: (typeof xep)[number]) => { const m = c.soi_mat; if (!m || m.url !== c.keyframe_url) return undefined; const co = m.ket.filter((k) => k.nhin); return co.length === 1 ? co[0] : undefined; };
  const khai = (c: (typeof xep)[number], ten: string) => !!c.may_3d?.vi_tri.some((v) => v.ten === ten);
  const gan = (c: (typeof xep)[number], ten: string, can: 1 | -1, tu: number) => {
    const ket = (out.get(c.id) ?? c.soi_mat!.ket).map((k) => (k.ten === ten && k.nhin && !k.nhin.can ? { ...k, nhin: { ...k.nhin, can, tu } } : k));
    out.set(c.id, ket);
  };
  for (let i = 1; i < xep.length; i++) {
    const a = xep[i - 1]!, b = xep[i]!; if (a.phan_doan !== b.phan_doan) continue;
    const ma = motMat(a), mb = motMat(b); if (!ma || !mb || ma.ten === mb.ten) continue;
    if (!khai(a, mb.ten) && !khai(b, ma.ten)) continue;   // không có gì nói hai người đang đối đáp
    const tin = (k: MatDo) => Math.abs(k.nhin!.g) >= NGUONG_NHIN && !nhinSai(k);
    if (!mb.nhin!.can && !mb.nhin!.tu && tin(ma)) gan(b, mb.ten, ma.nhin!.g > 0 ? -1 : 1, a.thu_tu);
    else if (!ma.nhin!.can && !ma.nhin!.tu && tin(mb)) gan(a, ma.ten, mb.nhin!.g > 0 ? -1 : 1, b.thu_tu);
  }
  return out;
}
/** Đo lại một shot (sửa mặt) mất phía cần nhìn lấy theo cặp — giữ lại từ lần đo trước cho cùng người. */
export const giuCanCap = (moi: SoiMat['ket'], cu?: SoiMat['ket']): SoiMat['ket'] => moi.map((k) => {
  const o = cu?.find((x) => x.ten === k.ten)?.nhin; return k.nhin && !k.nhin.can && o?.can && o.tu ? { ...k, nhin: { ...k.nhin, can: o.can, tu: o.tu } } : k;
});
/** Shot cần 🩹: mặt lệch ảnh mẫu, hoặc ánh mắt sai mà chưa nhận tay. */
export const canSuaMat = (c: Pick<Canh, 'keyframe_url'> & Partial<Pick<Canh, 'soi_mat'>>): boolean =>
  trangThaiMat(c) === 'lech' || (!!c.soi_mat && c.soi_mat.url === c.keyframe_url && !c.soi_mat.duyet_tay && c.soi_mat.ket.some(nhinSai));
/** Chữ lỗi mặt + ánh mắt của shot (nhãn / hover lưới). */
export const chuLoiMat = (m: SoiMat): string => [chuLechMat(m), ...(m.duyet_tay ? [] : loiNhin(m))].filter(Boolean).join('; ');
/** Câu chỉ hướng nhìn cho mô hình sửa ảnh (khung tiếng Anh, hướng theo NGƯỜI XEM). */
export const cauHuongNhin = (ten: string, can: 1 | -1, dich?: string): string =>
  `${ten} looks toward the viewer's ${can > 0 ? 'RIGHT' : 'LEFT'} (screen-${can > 0 ? 'right' : 'left'})${dich ? `, at ${dich}` : ''} — irises clearly turned to that side, eyes NOT on the camera`;
/** Lý do chặn (rỗng = qua) — MỘT luật cho cổng video, duyệt animatic, lưới. */
export function chanKhung(c: Pick<Canh, 'keyframe_url' | 'kiem_khung'> & Partial<Pick<Canh, 'soi_mat'>>): string | null {
  const tm = trangThaiMat(c);
  if (tm === 'lech') return `mặt lệch ảnh mẫu: ${chuLechMat(c.soi_mat!)} — sinh lại keyframe (kèm ảnh mẫu mặt / LoRA nhân vật) rồi ${TEN_NUT_MAT} lại`;
  if (tm === 'chua') return `keyframe đổi sau lần ${TEN_NUT_MAT} — soi lại`;
  const ln = c.soi_mat && c.soi_mat.url === c.keyframe_url && !c.soi_mat.duyet_tay ? loiNhin(c.soi_mat) : [];
  if (ln.length) return `ánh mắt: ${ln.join('; ')} — 🩹 sửa hướng nhìn (~${GIA_SUA_MAT_VND}₫ / lần, chỉ vẽ lại vùng đầu) hoặc sinh lại keyframe; cố ý nhìn máy thì bấm nhận tay`;
  const t = trangThaiKhung(c);
  if (t === 'chua') return `keyframe chưa qua ${TEN_NUT_KHUNG} (bố trí set, trục máy, nhân vật) — hoặc đã sinh lại sau lần kiểm`;
  if (t === 'lech') return `keyframe lệch: ${(c.kiem_khung as KiemKhung).loi.map((l) => `${tenLoiKhung(l.loai)} — ${l.mo_ta}`).join('; ')} — sinh lại keyframe rồi kiểm lại`;
  return null;
}

/** Các khối cảnh cần kiểm: khối = shot liền nhau cùng phan_doan; khối có ít nhất một shot 'chua' thì kiểm CẢ khối (so cả cảnh mới thấy lệch bố trí). */
export function khoiCanKiem<T extends Pick<Canh, 'id' | 'phan_doan' | 'keyframe_url' | 'kiem_khung'>>(ds: T[], tatCa = false): T[][] {
  const khoi: T[][] = [];
  for (const c of ds) { const l = khoi[khoi.length - 1]; if (l && l[0]!.phan_doan === c.phan_doan) l.push(c); else khoi.push([c]); }
  return khoi.map((k) => k.filter((c) => c.keyframe_url)).filter((k) => k.length && (tatCa || k.some((c) => trangThaiKhung(c) === 'chua')));
}

/** Token ước cho một khối n khung (+1 khung cảnh trước; ảnh 640×1138 ≈ 1k token + thẻ ≈ 300) — nút hiện giá trước khi bấm. */
export const tokenKhoi = (n: number) => ({ in: 3500 + n * 2500, out: 300 + n * 180 });   // mỗi khung + khung xám 3D của nó
export const giaKiemKhung = (model: string, khoi: number[]): number => khoi.reduce((a, n) => { const t = tokenKhoi(n); return a + giaChuCents(model, t.in, t.out); }, 0);

/** Đuôi lệnh mọi lượt vẽ lại VÙNG ĐẦU (cắt → sửa → dán lại): giữ mọi thứ khác để dán khớp từng điểm ảnh. */
export const GIU_VUNG_DAU = 'lighting direction, hair, ears, clothes, background, framing and scale exactly the same — the result must line up with image 1 pixel for pixel so it can be pasted back into the frame. Natural skin texture, no beauty filter, no text, no watermark.';
/** KẾ HOẠCH MỘT LƯỢT 🩹 (soi-mat.ts › suaMatCanh) — thuần, có test (huong-nhin.test.mts). Mặt lệch ảnh mẫu nặng nhất trước ('mat': vẽ lại mặt theo
 *  ảnh mẫu); không còn mặt lệch thì mặt nhìn sai ('nhin': chỉ xoay mắt / đầu). Cả hai chế độ đều nói RÕ phía cần nhìn khi biết (trước 19/10/2026 lệnh
 *  sửa mặt chỉ nói "giữ ánh nhìn", ảnh mẫu là mặt nhìn thẳng → mô hình chép luôn ánh mắt nhìn ống kính). Ảnh mẫu: mặt quay đầu CÙNG phía cần nhìn
 *  (anh_mat.dau) nếu có, không thì ảnh điển hình. */
export function keHoachSuaMat(sm: SoiMat, nv: { ten: string; anh_mat?: { url: string[]; dau?: (number | null)[] } | null }[], dichCua: (ten: string) => string | undefined = () => undefined):
  { ten: string; o: { x: number; y: number }; che_do: 'mat' | 'nhin'; mau: string; prompt: string } | { loi: string } {
  const coMau = (k: MatDo) => !!nv.find((v) => v.ten === k.ten)?.anh_mat?.url.length && !!k.o;
  const k = sm.ket.filter((x) => !x.dat && coMau(x)).sort((a, b) => (a.giong ?? 0) - (b.giong ?? 0))[0] ?? (sm.duyet_tay ? undefined : sm.ket.find((x) => nhinSai(x) && coMau(x)));
  if (!k) return { loi: sm.ket.some((x) => !x.dat || nhinSai(x)) ? 'nhân vật lệch chưa có ảnh sát mặt (ảnh mẫu không thấy mặt rõ)' : 'không có mặt lệch hay ánh mắt sai để sửa' };
  const am = nv.find((v) => v.ten === k.ten)!.anh_mat!; const can = k.nhin?.can;
  const i = can ? (am.dau ?? []).map((d, j) => ({ d, j })).filter((x) => x.d != null && x.d * can >= 12).sort((a, b) => Math.abs(a.d! - can * 25) - Math.abs(b.d! - can * 25))[0]?.j : undefined;
  const mau = am.url[i ?? 0]!; const huong = can ? cauHuongNhin(k.ten, can, dichCua(k.ten)) : '';
  const giu = GIU_VUNG_DAU;
  const che_do = k.dat ? 'nhin' : 'mat';
  const prompt = che_do === 'mat'
    ? `Image 1 is a close-up crop of a photorealistic film frame showing the person ${k.ten}. Redraw ONLY the face so it is exactly the person in image 2: same bone structure, eyes, nose, mouth, hairline, skin tone and age. ${huong ? `GAZE: ${huong}. Image 2 is for identity only — ignore its head angle and where its eyes look. Keep image 1's head angle, expression, ` : "Keep image 1's head angle, expression, gaze, "}${giu}`
    : `Image 1 is a close-up crop of a photorealistic film frame showing the person ${k.ten}. Change ONLY where ${k.ten} is looking: ${huong}. Turn the irises clearly to that side and the head slightly (about 15–25°) the same way. Keep the same person (image 2 shows ${k.ten} for identity only — ignore its pose and gaze), same expression, ${giu}`;
  return { ten: k.ten, o: k.o!, che_do, mau, prompt };
}
/** Ảnh sửa về: NHẬN khi người vừa sửa giống ảnh mẫu VÀ nhìn đúng phía (trước 19/10/2026 chỉ xét giống mặt — ảnh sửa nhìn ống kính vẫn được nhận). */
export const nhanSuaMat = (sm: SoiMat, ten: string): boolean => { const k = sm.ket.find((x) => x.ten === ten); return !!k && k.dat && !nhinSai(k); };
