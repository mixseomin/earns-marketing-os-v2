// THƯ VIỆN BỐI CẢNH + DIỄN VIÊN dùng chung mọi sản phẩm (anh 17/10/2026: "các bối cảnh cũng phải đa dạng hơn… cần thư viện đầy đủ mọi nơi có thể
// diễn ra … nhân vật cũng thế, phải có đủ loại màu da, chủng tộc, tuổi tác, giới tính (kể cả LGBT)"). Dữ liệu: scripts/du-lieu/thu-vien/*.json
// (thêm nơi / người = thêm một dòng). phanBo: chia cho từng bộ hình một diễn viên chính hợp yêu cầu concept, người phụ theo quan hệ, hai bối cảnh
// hợp hoạt động của template — ưu tiên nhóm / nơi / người ÍT dùng nhất để cả kho trải đều. Thuần — tự kiểm: thu-vien-dien.test.mts.
import BC from '../../../scripts/du-lieu/thu-vien/boi-canh.json';
import DV from '../../../scripts/du-lieu/thu-vien/dien-vien.json';

export type BoiCanhTv = { ma: string; nhom: string; ten: string; prompt: string; hoat_dong: string[]; dip: string[]; thoi_gian: string; ngoai_troi: boolean; /** nơi làm được KHOẢNH KHẮC ĐỈNH ĐIỂM (dịp dinh_diem): tên dịp tiếng Anh cho câu chữ màn */ dip_en?: string };
export type DienVienTv = { ma: string; ten: string; gioi: 'nam' | 'nu' | 'phi_nhi_nguyen'; tuoi: number; sac_toc: string; dang: string; toc: string; mo_ta: string; lgbt: boolean };
export type QuanHe = { ma: string; vi: string; en: string; lgbt: boolean };
export const BOI_CANH = BC.boi_canh as BoiCanhTv[];
export const NHOM_BOI_CANH = BC.nhom as Record<string, string>;
export const DIEN_VIEN = DV.dien_vien as DienVienTv[];
export const SAC_TOC = DV.sac_toc as Record<string, string>;
export const QUAN_HE = DV.quan_he as QuanHe[];
/** Áo (không quần — quần là sản phẩm hoặc đồ của shot): đổi theo bộ hình để các phim không cùng một bộ đồ. */
export const AO = ['a plain gray crew-neck tee', 'a navy henley', 'a white oxford shirt', 'a red plaid flannel shirt', 'a black crew tee', 'an olive bomber jacket over a white tee',
  'a heather gray hoodie', 'a light blue polo shirt', 'a mustard knit sweater', 'a white linen shirt', 'a burgundy quarter-zip', 'a black leather jacket over a gray tee'];

/** Yêu cầu của một concept với diễn viên chính + bối cảnh (khai trong tệp dữ liệu sản phẩm, vd o-hinh/jettjeans.json › yeu_cau). */
export type YeuCau = { gioi?: DienVienTv['gioi'][]; tuoi?: [number, number]; dang?: string[]; dip?: string[]; hoat_dong?: string[]; nhom_tranh?: string[] };
export type ViecPhanBo = { key: string; concept: string; yc: YeuCau };
export type KetPhanBo = { key: string; chinh: DienVienTv; phu: { qh: QuanHe; dv: DienVienTv }; boi_canh: BoiCanhTv; boi_canh_2: BoiCanhTv; /** dịp đỉnh điểm (template kể chuyện) — đổi theo bộ hình */ su_kien: BoiCanhTv; ao: string };

const dem = () => new Map<string, number>();
const tang = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
const so = (m: Map<string, number>, k: string) => m.get(k) ?? 0;
/** Chọn phần tử điểm thấp nhất (ít dùng nhất), hoà thì theo thứ tự xoay `xoay` để không luôn lấy phần tử đầu. */
function itNhat<T>(ds: T[], diem: (x: T) => number, xoay: number): T | undefined {
  if (!ds.length) return undefined;
  let tot: T | undefined, d0 = Infinity;
  for (let i = 0; i < ds.length; i++) { const x = ds[(i + xoay) % ds.length]!; const d = diem(x); if (d < d0) { d0 = d; tot = x; } }
  return tot;
}
export function phanBo(viec: ViecPhanBo[], o: { tiLeLgbt?: number } = {}): KetPhanBo[] {
  const dSac = dem(), dNguoi = dem(), dNoi = dem(), dNhom = dem(), dAo = dem(), dQh = dem(), dSk = dem();
  const lgbt = o.tiLeLgbt ?? 0.2;
  return viec.map((v, i) => {
    const yc = v.yc;
    const hop = DIEN_VIEN.filter((d) => (!yc.gioi || yc.gioi.includes(d.gioi)) && (!yc.tuoi || (d.tuoi >= yc.tuoi[0] && d.tuoi <= yc.tuoi[1])));
    const hopDang = yc.dang?.length ? hop.filter((d) => yc.dang!.includes(d.dang)) : hop;
    const chinh = itNhat(hopDang.length ? hopDang : hop, (d) => so(dSac, d.sac_toc) * 10 + so(dNguoi, d.ma) * 100, i * 7) ?? DIEN_VIEN[i % DIEN_VIEN.length]!;
    tang(dSac, chinh.sac_toc); tang(dNguoi, chinh.ma);
    // người phụ: quan hệ xoay vòng; cứ ~1/5 bộ hình là cặp đồng giới (chồng / bạn trai cho nhân vật nam, vợ / bạn gái cho nhân vật nữ)
    const laLgbt = Math.floor((i + 1) * lgbt) > Math.floor(i * lgbt);
    const qhHop = QUAN_HE.filter((q) => (chinh.gioi === 'nam' ? q.ma !== 'vo' || !laLgbt : true) && (laLgbt ? q.lgbt : !q.lgbt));
    const qh = itNhat(qhHop, (q) => so(dQh, q.ma), i) ?? QUAN_HE[0]!; tang(dQh, qh.ma);
    const gioiPhu: DienVienTv['gioi'][] = ['vo', 'ban_gai', 'me', 'con_gai'].includes(qh.ma) ? ['nu'] : ['chong', 'ban_trai', 'bo', 'con_trai'].includes(qh.ma) ? ['nam'] : ['nam', 'nu', 'phi_nhi_nguyen'];
    const tuoiPhu: [number, number] = ['me', 'bo'].includes(qh.ma) ? [chinh.tuoi + 20, 99] : ['con_gai', 'con_trai'].includes(qh.ma) ? [18, Math.max(18, chinh.tuoi - 18)] : [chinh.tuoi - 12, chinh.tuoi + 12];
    const phuHop = DIEN_VIEN.filter((d) => d.ma !== chinh.ma && gioiPhu.includes(d.gioi) && d.tuoi >= tuoiPhu[0] && d.tuoi <= tuoiPhu[1]);
    const phu = itNhat(phuHop.length ? phuHop : DIEN_VIEN.filter((d) => d.ma !== chinh.ma && gioiPhu.includes(d.gioi)), (d) => so(dNguoi, d.ma) * 10 + (d.sac_toc === chinh.sac_toc ? 0 : 1), i * 3)!;
    tang(dNguoi, phu.ma);
    // bối cảnh: hợp dịp của concept + có hoạt động template cần; nơi / nhóm ít dùng nhất; bối cảnh 2 khác nhóm bối cảnh 1
    const coHd = (b: BoiCanhTv) => !yc.hoat_dong?.length || yc.hoat_dong.some((h) => b.hoat_dong.includes(h));
    const hopNoi = BOI_CANH.filter((b) => coHd(b) && !(yc.nhom_tranh ?? []).includes(b.nhom) && (!yc.dip?.length || yc.dip.some((x) => b.dip.includes(x))));
    const nguon = hopNoi.length >= 2 ? hopNoi : BOI_CANH.filter(coHd);
    const bc1 = itNhat(nguon, (b) => so(dNoi, b.ma) * 10 + so(dNhom, b.nhom), i * 5)!; tang(dNoi, bc1.ma); tang(dNhom, bc1.nhom);
    const bc2 = itNhat(nguon.filter((b) => b.nhom !== bc1.nhom).length ? nguon.filter((b) => b.nhom !== bc1.nhom) : nguon.filter((b) => b.ma !== bc1.ma), (b) => so(dNoi, b.ma) * 10 + so(dNhom, b.nhom), i * 11)!;
    tang(dNoi, bc2.ma); tang(dNhom, bc2.nhom);
    const ao = itNhat(AO, (a) => so(dAo, a), i)!; tang(dAo, ao);
    const sk = itNhat(BOI_CANH.filter((b) => b.dip_en && b.ma !== bc1.ma && b.ma !== bc2.ma), (b) => so(dSk, b.ma), i * 3)!; tang(dSk, sk.ma);
    return { key: v.key, chinh, phu: { qh, dv: phu }, boi_canh: bc1, boi_canh_2: bc2, su_kien: sk, ao };
  });
}
/** Mô tả người chính đưa vào ô nhan_vat_hinh / anchor: người + áo; KHÔNG ghi quần (quần là sản phẩm hoặc đồ của shot). */
export const moTaChinh = (k: Pick<KetPhanBo, 'chinh' | 'ao'>): string => `${k.chinh.mo_ta}, wears ${k.ao}`;
export const moTaPhu = (k: Pick<KetPhanBo, 'phu'>): string => `${k.phu.dv.mo_ta}, ${k.phu.qh.en}`;
/** Giọng mô tả cho ô giong theo diễn viên (tuổi + giới) — chonGiongDan đọc chuỗi này. */
export const moTaGiong = (d: Pick<DienVienTv, 'gioi' | 'tuoi'>): string => `American ${d.gioi === 'nu' ? 'woman' : d.gioi === 'nam' ? 'man' : 'non-binary person'}, ${d.tuoi}, natural, conversational`;
