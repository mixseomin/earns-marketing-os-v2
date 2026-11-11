'use server';
// DANH SÁCH PHIM TÍNH Ở MÁY CHỦ (anh 11/11/2026: "bấm vào đâu thì hiện ở đó thôi"). Trước: trình duyệt tải cả ~2.900 phim (~3 MB, phần lớn
// creative Ethopex) rồi tự gom nhóm / đếm / tính tiền. Giờ mỗi tab hỏi đúng thứ nó vẽ: đầu trang = vài con số (tongQuanPhim), 🧩 Template = phim
// template + video từ template, 🎬 Làm tự do = nhóm đã lọc + cắt theo số dòng đang hiện, 📦 Sản phẩm = mỗi sản phẩm một dòng tổng. Cùng hàm
// thuần nhom-phim.ts như trước — chỉ đổi chỗ chạy. Đi đường đọc song song (doc-ham.ts).
import { dsPhim } from './actions';
import { catNhom, demKieu, dongSanPham, laLuuTru, nhomPhim, type DongSanPham, type KieuNhom, type NhomPhim } from './xuong-video/nhom-phim';
import type { Phim } from './xuong-video/kieu';

export type TongQuanPhim = { dem: Record<KieuNhom, number>; soPhim: number; soCanh: number; tongTien: number; soLuuTru: number; soVideoTemplate: number; soTuDo: number };
const laTuDo = (p: Phim) => !p.kinh_thanh?.tu_template && p.loai !== 'may_dung';

/** Mấy con số ở đầu trang (nhãn tab, bộ lọc, tổng tiền). */
export async function tongQuanPhim(): Promise<TongQuanPhim> {
  const ds = await dsPhim();
  return {
    dem: demKieu(ds), soPhim: ds.length, soCanh: ds.reduce((a, p) => a + p.so_canh, 0), tongTien: ds.reduce((a, p) => a + p.chi_phi_cents, 0),
    soLuuTru: ds.filter(laLuuTru).length, soVideoTemplate: ds.filter((p) => p.kinh_thanh?.tu_template && !laLuuTru(p)).length,
    soTuDo: ds.filter((p) => laTuDo(p) && !laLuuTru(p) && !p.kinh_thanh?.template).length,
  };
}

/** 🧩 Template: phim template (chưa lưu trữ) + mọi phim tạo từ template. */
export async function dsPhimTemplate(): Promise<{ ds: Phim[]; phimTu: Phim[] }> {
  const ds = await dsPhim();
  return { ds: ds.filter((p) => p.kinh_thanh?.template && !laLuuTru(p)), phimTu: ds.filter((p) => p.kinh_thanh?.tu_template) };
}

/** 🎬 Làm tự do: nhóm theo series / sản phẩm / tên (đã lọc kiểu + chữ tìm), cắt còn `toiDa` dòng phim; `tong` = số dòng khớp lọc. */
export async function dsNhomTuDo(loc: { kieu: KieuNhom | ''; tim: string; luuTru: boolean; toiDa: number }): Promise<{ nhom: NhomPhim[]; tong: number }> {
  const nhom = nhomPhim((await dsPhim()).filter(laTuDo), { kieu: loc.kieu, tim: loc.tim, luuTru: loc.luuTru });
  return { nhom: catNhom(nhom, Math.max(1, Math.min(5000, loc.toiDa))), tong: nhom.reduce((a, g) => a + g.phim.length, 0) };
}

/** 📦 Sản phẩm: mỗi sản phẩm một dòng tổng (bản chụp số liệu) + mã creative / camp để trình duyệt áp số liệu sống. */
export async function dsSanPhamTong(): Promise<DongSanPham[]> {
  return nhomPhim(await dsPhim(), { kieu: 'quang_cao' }).filter((g) => g.key.startsWith('sp:')).map(dongSanPham);
}
