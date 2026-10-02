// /shop — CHẾ ĐỘ XEM: dữ liệu THẬT hay DEMO, không bao giờ lẫn (anh yêu cầu 02/10/2026). Một hàm thuần, page.tsx gọi một lần trên mọi sổ.
// Gốc là cờ `demo` của cửa hàng và NCC (0218). Mọi thứ khác suy theo gốc:
//   - đơn, biến thể, sản phẩm, đánh giá, hồ sơ → theo cửa hàng của nó
//   - sản phẩm NCC (danh mục chung) → NCC demo thì thuộc demo; NCC thật thì thuộc chế độ của cửa hàng đang lấy nó làm nguồn
//     (chưa shop nào dùng = hàng thật đang tìm hiểu → chế độ thật)
//   - NCC thật hiện ở demo khi một cửa hàng demo đang dùng nó (CJ thật bán cho shop demo)
//   - biến động → phía shop theo cửa hàng, phía NCC theo sản phẩm NCC
//   - cổng / pháp nhân → theo cửa hàng nó phục vụ; chưa gắn shop nào = đồ thật
//   - đối thủ là thông tin thị trường thật, chung cho cả hai chế độ
import type { BienTheDong, CuaHangDong, DanhGiaDong, DonDong, NccSpDong, SanPhamDong } from './doc';
import type { BienDongNcc, HoSoDong, NccDong } from './ho-so-doc';
import type { CongDong, PhapNhanDong } from './cong-luat';

export type CheDo = 'that' | 'demo';
export const cheDoCua = (v: string | string[] | null | undefined): CheDo => (v === 'demo' ? 'demo' : 'that');

type SoShop = { don: DonDong[]; bienThe: BienTheDong[]; cuaHang: CuaHangDong[]; sanPham: SanPhamDong[]; danhGia: DanhGiaDong[]; danhMuc: NccSpDong[];
  hoSo: HoSoDong[]; ncc: NccDong[]; bienDong: BienDongNcc[]; cong: CongDong[]; phapNhan: PhapNhanDong[] };

export function locCheDo<T extends SoShop>(d: T, cheDo: CheDo): T & { dsCh: string[] } {
  const demo = cheDo === 'demo';
  const demoCua = new Map(d.cuaHang.map((c) => [c.khoa, c.demo]));
  const cuaHang = d.cuaHang.filter((c) => c.demo === demo);
  const dsCh = cuaHang.map((c) => c.khoa), coCh = (k: string | null | undefined) => k != null && dsCh.includes(k);

  // sản phẩm NCC đang được cửa hàng thuộc chế độ nào dùng làm nguồn
  const dungBoi = new Map<number, Set<boolean>>();
  for (const b of d.bienThe) for (const n of b.nguon) {
    const s = dungBoi.get(n.nccSpId) ?? new Set<boolean>(); s.add(demoCua.get(b.cuaHang) ?? false); dungBoi.set(n.nccSpId, s);
  }
  const nccDemo = new Map(d.ncc.map((n) => [n.khoa, n.demo]));
  const danhMuc = d.danhMuc.filter((s) => (nccDemo.get(s.ncc) ? demo : dungBoi.get(s.id)?.has(demo) ?? !demo));
  const spNcc = new Set(danhMuc.map((s) => s.id));
  const ncc = d.ncc.filter((n) => (n.demo ? demo : !demo || danhMuc.some((s) => s.ncc === n.khoa) || cuaHang.some((c) => c.ncc === n.khoa)));
  const coNcc = new Set(ncc.map((n) => n.khoa));
  const theoShop = <X extends { shops: string[] }>(x: X): X | null => {
    const shops = x.shops.filter(coCh);
    return shops.length || (!demo && !x.shops.length) ? { ...x, shops } : null;
  };

  return {
    ...d, dsCh, cuaHang, danhMuc, ncc,
    don: d.don.filter((x) => coCh(x.cuaHang)),
    bienThe: d.bienThe.filter((x) => coCh(x.cuaHang)),
    sanPham: d.sanPham.filter((x) => coCh(x.cuaHang)),
    danhGia: d.danhGia.filter((x) => coCh(x.cuaHang)),
    hoSo: d.hoSo.filter((x) => coCh(x.cuaHang)),
    bienDong: d.bienDong.filter((x) => (x.cuaHang ? coCh(x.cuaHang) : x.nccSpId != null ? spNcc.has(x.nccSpId) : x.ncc ? coNcc.has(x.ncc) : !demo)),
    cong: d.cong.map(theoShop).filter((x): x is CongDong => !!x),
    phapNhan: d.phapNhan.map(theoShop).filter((x): x is PhapNhanDong => !!x),
  };
}
