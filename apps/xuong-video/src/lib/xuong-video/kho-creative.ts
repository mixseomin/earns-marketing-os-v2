// KHO CREATIVE THEO SẢN PHẨM (anh 16/10/2026: "từ 104 góc sẽ cần tạo 10000 creatives — tổ chức thế nào để không ngợp, thấy từng thành phần
// Góc, Loại… sâu hơn Hook… CTA"). Dựng từ bản mô phỏng JettJeans đã duyệt. Không quản lý 10.000 dòng mà quản lý THÀNH PHẦN; creative là
// một tổ hợp (góc spy × khuôn template × hook × … × CTA). Thuần — dữ liệu đọc ở actions.ts › docKhoSanPham. Tự kiểm: kho-creative.test.mts
import { DONG_TEMPLATE } from './kieu';
import { LOAI_GOC_SPY, type GocSpy } from './goc-spy';

export type ShotKho = { phim_id: number; thu_tu: number; phan_doan: string; chu_man: string; loi: string; hanh_dong: string; co_hinh: boolean; co_clip: boolean; co_giong: boolean; can_giong: boolean; sua_luc: string };
export type AnchorKho = { phim_id: number; loai: string; ten: string; mo_ta: string; so_anh: number; giong: string };
export type KhuonKho = { id: number; dong: string; khuon: string; ten: string };
export type CreativeKho = {
  id: number; ten: string; sua_luc: string; anh: string | null; goc: GocSpy[]; ngon_ngu: string; phong_cach: string;
  tpl: KhuonKho | null; xuat: { url: string; luc: string } | null;
};
/** Một nấc sản xuất: xong · đang (có một phần) · chưa. so/tong để hover. */
export type Nac = { key: 'kich_ban' | 'hinh' | 'giong' | 'clip' | 'xuat'; ten: string; tt: 'xong' | 'dang' | 'chua'; so: number; tong: number };
export type DongCreative = CreativeKho & { nac: Nac[]; ket: string; hook: string; cta: string; sua_sau_xuat: boolean; so_shot: number };

export const TEN_NAC: Record<Nac['key'], string> = { kich_ban: 'Kịch bản', hinh: 'Hình', giong: 'Giọng', clip: 'Clip', xuat: 'Xuất' };
const nac = (key: Nac['key'], so: number, tong: number): Nac => ({ key, ten: TEN_NAC[key], so, tong, tt: tong > 0 && so >= tong ? 'xong' : so > 0 ? 'dang' : 'chua' });

/** Hàng của bảng creative: 5 nấc sản xuất + chỗ kẹt (nấc đầu chưa xong) + hook / CTA (chữ màn shot đầu / shot cuối) + cờ sửa sau xuất. */
export function dongCreative(c: CreativeKho, shot: ShotKho[]): DongCreative {
  const s = shot.filter((x) => x.phim_id === c.id).sort((a, b) => a.thu_tu - b.thu_tu);
  const canGiong = s.filter((x) => x.can_giong);
  const ds = [nac('kich_ban', s.length ? 1 : 0, 1), nac('hinh', s.filter((x) => x.co_hinh).length, s.length), nac('giong', canGiong.filter((x) => x.co_giong).length, canGiong.length),
    nac('clip', s.filter((x) => x.co_clip).length, s.length), nac('xuat', c.xuat ? 1 : 0, 1)];
  // Không có câu nào cần giọng thì nấc giọng tính xong (QC không lời).
  if (!canGiong.length && s.length) ds[2] = { ...ds[2]!, tt: 'xong' };
  const ket = ds.find((x) => x.tt !== 'xong');
  const cuoi = [...s].reverse().find((x) => /^(end_card|cta)$/.test(x.phan_doan)) ?? s[s.length - 1];
  return { ...c, nac: ds, ket: ket ? `kẹt ${ket.ten.toLowerCase()}` : 'xong', hook: chuShot(s[0]), cta: chuShot(cuoi), so_shot: s.length,
    sua_sau_xuat: !!c.xuat && s.some((x) => x.sua_luc > c.xuat!.luc) };
}
/** Chữ của shot để đọc: chữ màn (bỏ mốc @giây, gộp dòng), không có thì lời. */
export const chuShot = (s: Pick<ShotKho, 'chu_man' | 'loi'> | undefined): string => {
  if (!s) return '';
  const c = s.chu_man.replace(/@\d+(\.\d+)?\s*/g, '').split('\n').map((x) => x.trim()).filter(Boolean);
  return [...new Set(c)].join(' / ').replace(/\*\*/g, '') || s.loi.trim();
};

// ── THÀNH PHẦN ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Loại thành phần: chữ (theo phân đoạn shot QC) và hình / tiếng (theo anchor + kinh thánh). Thứ tự = thứ tự tab. */
export const LOAI_THANH_PHAN: { key: string; ten: string; nhom: 'chu' | 'hinh'; doan?: string[]; anchor?: string }[] = [
  { key: 'hook', ten: 'Hook', nhom: 'chu', doan: ['hook'] },
  { key: 'noi_dau', ten: 'Nỗi đau', nhom: 'chu', doan: ['noi_dau'] },
  { key: 'giai_phap', ten: 'Giải pháp / lật', nhom: 'chu', doan: ['giai_phap'] },
  { key: 'demo', ten: 'Demo', nhom: 'chu', doan: ['demo'] },
  { key: 'tinh_nang', ten: 'Tính năng', nhom: 'chu', doan: ['tinh_nang'] },
  { key: 'so_sanh', ten: 'So sánh', nhom: 'chu', doan: ['so_sanh'] },
  { key: 'bang_chung', ten: 'Bằng chứng', nhom: 'chu', doan: ['bang_chung'] },
  { key: 'tran_an', ten: 'Trấn an', nhom: 'chu', doan: ['tran_an'] },
  { key: 'uu_dai', ten: 'Ưu đãi', nhom: 'chu', doan: ['uu_dai'] },
  { key: 'cta', ten: 'CTA / end card', nhom: 'chu', doan: ['cta', 'end_card'] },
  { key: 'nguoi', ten: 'Người', nhom: 'hinh', anchor: 'nhan_vat' },
  { key: 'boi_canh', ten: 'Bối cảnh', nhom: 'hinh', anchor: 'boi_canh' },
  { key: 'san_pham', ten: 'Sản phẩm', nhom: 'hinh', anchor: 'san_pham' },
  { key: 'dao_cu', ten: 'Đạo cụ', nhom: 'hinh', anchor: 'dao_cu' },
  { key: 'giong', ten: 'Giọng', nhom: 'hinh' },
  { key: 'phong_cach', ten: 'Phong cách hình', nhom: 'hinh' },
];
export type ThanhPhan = { loai: string; noi_dung: string; phu: string; dung_o: number[]; co_media: number };
/** Khoá gộp: cùng câu (bỏ hoa thường, dấu câu, khoảng trắng) = cùng một thành phần, dù nằm ở bao nhiêu creative. */
export const khoaChu = (x: string) => x.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function gomThanhPhan(shot: ShotKho[], anchor: AnchorKho[], cr: Pick<CreativeKho, 'id' | 'phong_cach'>[]): ThanhPhan[] {
  const out = new Map<string, ThanhPhan>();
  const them = (loai: string, noi: string, phu: string, phim: number, media: boolean) => {
    if (!noi.trim()) return;
    const k = `${loai}|${khoaChu(noi)}`;
    const t = out.get(k) ?? { loai, noi_dung: noi, phu, dung_o: [], co_media: 0 };
    if (!t.dung_o.includes(phim)) t.dung_o.push(phim);
    if (media) t.co_media++;
    if (!t.phu && phu) t.phu = phu;
    out.set(k, t);
  };
  for (const s of shot) {
    const l = LOAI_THANH_PHAN.find((x) => x.doan?.includes(s.phan_doan));
    if (l) them(l.key, chuShot(s), s.hanh_dong, s.phim_id, s.co_clip || s.co_hinh);
  }
  for (const a of anchor) {
    const l = LOAI_THANH_PHAN.find((x) => x.anchor === a.loai);
    if (l) them(l.key, a.ten, a.mo_ta.slice(0, 160), a.phim_id, a.so_anh > 0);
    if (a.giong.trim()) them('giong', a.giong, a.ten, a.phim_id, false);
  }
  for (const c of cr) if (c.phong_cach.trim()) them('phong_cach', c.phong_cach.slice(0, 140), '', c.id, false);
  return [...out.values()].map((t) => ({ ...t, dung_o: t.dung_o.sort((a, b) => a - b) })).sort((a, b) => b.dung_o.length - a.dung_o.length);
}

// ── BẢN ĐỒ / MA TRẬN ───────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Cột bản đồ = dòng template; creative không tạo từ template nằm cột "Ngoài template". */
export const COT_DONG: { key: string; ten: string }[] = [...DONG_TEMPLATE.map((d) => ({ key: d.key, ten: d.ten.split(' — ')[0]! })), { key: 'ngoai', ten: 'Ngoài template' }];
export const dongCua = (c: Pick<CreativeKho, 'tpl'>) => c.tpl?.dong || 'ngoai';
/** ô[loại góc][dòng] = id creative có ít nhất một góc thuộc loại đó (một creative gắn nhiều góc → có mặt ở nhiều hàng). */
export function banDo(cr: Pick<CreativeKho, 'id' | 'goc' | 'tpl'>[]): Record<string, Record<string, number[]>> {
  const o: Record<string, Record<string, number[]>> = {};
  for (const l of LOAI_GOC_SPY) o[l.key] = Object.fromEntries(COT_DONG.map((d) => [d.key, [] as number[]]));
  for (const c of cr) for (const l of new Set(c.goc.map((g) => g.loai))) o[l]?.[dongCua(c)]?.push(c.id);
  return o;
}
/** Khuôn (cột ma trận) theo thứ tự DONG_TEMPLATE, cộng cột "ngoài template". */
export const COT_KHUON: { dong: string; khuon: string; ten: string; ngan: string }[] = vietTatKhongTrung([
  ...DONG_TEMPLATE.flatMap((d) => d.khuon.map((k) => ({ dong: d.key, khuon: k.key, ten: k.ten }))),
  { dong: 'ngoai', khuon: '', ten: 'Ngoài template' },
]);
/** Viết tắt 2 chữ cho tiêu đề cột ma trận, KHÔNG trùng nhau (Chữ động / Chia đôi từng cùng ra "CĐ"): trùng thì lấy chữ kế tiếp của từ thứ hai. */
function vietTatKhongTrung<T extends { ten: string }>(ds: T[]): (T & { ngan: string })[] {
  const dung = new Set<string>();
  return ds.map((k) => {
    const w = k.ten.replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean);
    const dau = (w[0]?.[0] ?? '').toUpperCase(); const sau = (w.slice(1).join('') || w[0]?.slice(1) || 'X').toUpperCase();
    let ngan = dau + sau[0]; for (let i = 1; dung.has(ngan) && i < sau.length; i++) ngan = dau + sau[i];
    dung.add(ngan); return { ...k, ngan };
  });
}
/** Creative ở ô (góc × khuôn). */
export const oMaTran = (cr: Pick<CreativeKho, 'id' | 'goc' | 'tpl'>[], gocId: number, cot: { dong: string; khuon: string }) =>
  cr.filter((c) => c.goc.some((g) => g.id === gocId) && dongCua(c) === cot.dong && (c.tpl?.khuon ?? '') === cot.khuon).map((c) => c.id);
