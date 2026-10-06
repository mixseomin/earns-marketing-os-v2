// ÁP PHƯƠNG PHÁP LÊN MỌI SẢN PHẨM — phần THUẦN (không DB), server tính rồi đưa cho panel Kênh kéo khách.
//
// Vì sao tính lúc đọc chứ không có job sinh dòng: 75 sản phẩm × N phương pháp mà đẻ dòng DB "chưa làm" cho từng ô thì sổ đầy
// dòng không ai ghi, và sửa nhắm trong thư viện lại phải dọn/đẻ lại. Ô CHƯA CÓ DÒNG = "chưa làm", số để TRỐNG (null — chưa đo,
// không phải 0). Sổ `kenh_sp` chỉ giữ dòng có việc thật (máy repo ghi hoặc sửa tay ở drawer).
//
// TỰA = đơn vị kéo khách. Một cuốn bán ở 3 shop (KDP · Gumroad · Etsy) là MỘT tựa, ghim Pinterest làm cho cuốn chứ không cho
// từng listing. Tựa khai bởi repo sản phẩm qua kenh_sp (san_pham + khop = chuỗi con của tên listing); sản phẩm không khớp tựa nào
// thì chính nó là một tựa. Tự kiểm: node_modules/.bin/tsx apps/web/src/lib/tai-san/ap-dung.test.mts
import type { KenhO, KenhSp, PhuongPhap, ShopNut, TrangThaiSp } from './kieu';

export type BanO = { noi: string; shop: string; trangThai: TrangThaiSp };
export type Tua = { khoa: string; ten: string; /** project của máy repo ghi tựa này (kenh.mjs); null = tựa sửa tay */ may: string | null;
  /** sản phẩm trên cây thuộc tựa này (shop nào, trạng thái gì) */ ban: BanO[];
  /** một ô cho MỖI phương pháp nhắm trúng shop của tựa; thiếu dòng sổ thì ô ảo (ao: true) */ o: Record<string, KenhO> };
export type ThieuPp = { shop: string; ten: string; soSp: number };
export type ApDung = { tua: Tua[]; /** shop có sản phẩm mà không phương pháp nào trong thư viện nhắm tới */ thieu: ThieuPp[] };

/** Phương pháp có nhắm shop này không: khoá shop đầy đủ, nền của shop, hay '*'. */
export const nhamTrung = (pp: PhuongPhap, shopKhoa: string) =>
  pp.nham.includes('*') || pp.nham.includes(shopKhoa) || pp.nham.includes(shopKhoa.split(':')[0] ?? '');

/** Ô ảo — chưa có dòng sổ: bước 0, mọi số null. */
export const oAo = (kenh: string): KenhO => ({ kenh, muc: 0, xong: null, tong: null, dich: null, canhBao: null, the: null, capNhat: null, ngayDang: null, ao: true });

export function apDung(shops: ShopNut[], lib: PhuongPhap[], rows: KenhSp[]): ApDung {
  const bat = lib.filter((p) => p.bat).sort((a, b) => a.thuTu - b.thuTu || a.key.localeCompare(b.key));
  const tua = new Map<string, Tua>();
  for (const r of rows) tua.set(r.sanPham, { khoa: r.sanPham, ten: r.ten, may: r.project ?? null, ban: [], o: { ...r.o } });
  const thieu = new Map<string, ThieuPp>();
  for (const s of shops) {
    const pps = bat.filter((p) => nhamTrung(p, s.khoa));
    for (const x of s.sp) {
      const ten = x.ten.toLowerCase();
      const goc = rows.find((r) => r.khop && ten.includes(r.khop.toLowerCase()));
      const k = goc?.sanPham ?? x.khoa;
      const t = tua.get(k) ?? { khoa: k, ten: x.ten, may: null, ban: [], o: {} };
      // Nhãn ngắn "KDP paperback" / "Etsy" (tên nền + định dạng khi khác pdf) — như dòng tóm tắt cũ của panel.
      t.ban.push({ noi: `${s.ten.split(' · ')[0]}${x.phu && x.phu !== 'pdf' ? ` ${x.phu}` : ''}`, shop: s.khoa, trangThai: x.trangThai });
      for (const p of pps) t.o[p.key] ??= oAo(p.key);
      tua.set(k, t);
      if (!pps.length) {
        const th = thieu.get(s.khoa) ?? { shop: s.khoa, ten: s.ten, soSp: 0 };
        th.soSp++; thieu.set(s.khoa, th);
      }
    }
  }
  // Tựa có dòng sổ nhưng không nhắm trúng (thư viện bỏ shop, hay chưa lên sàn): vẫn hiện dòng thật, không hiện ô ảo thừa.
  const ds = [...tua.values()].filter((t) => Object.keys(t.o).length)
    .sort((a, b) => (b.ban.length - a.ban.length) || a.ten.localeCompare(b.ten));
  return { tua: ds, thieu: [...thieu.values()].sort((a, b) => b.soSp - a.soSp) };
}

/** Đếm cho tiêu đề panel: bao nhiêu ô chưa làm (ảo), bao nhiêu ô có việc. */
export const demO = (ap: ApDung) => {
  let ao = 0, that = 0;
  for (const t of ap.tua) for (const o of Object.values(t.o)) (o.ao ? ao++ : that++);
  return { ao, that, sp: ap.thieu.reduce((n, x) => n + x.soSp, 0) };
};
