// Báo cáo chi tiết một app App Store (drawer sản phẩm, tab Tài sản) — anh hỏi 12/10/2026 "1 đơn MilitaryCalc có phải tao tải không":
// cần thấy TỪNG lượt tải đến từ nước nào, nguồn nào, máy nào. Dữ liệu = product_stats.raw_data do scripts/app-store-so.mjs ghi
// (Analytics Reports API của Apple, mỗi ngày): tổng theo ngày + chiTiet[] từng dòng báo cáo. Phần THUẦN (không DB) để tự kiểm được.
// Tự kiểm: node_modules/.bin/tsx apps/web/src/lib/tai-san/bao-cao-app.test.mts

export type DongChiTiet = { su: string; nguon: string | null; trang?: string | null; may: string | null; os: string | null; nuoc: string | null; n: number; ban?: string | null; kieu?: string };
export type NgayApp = { date: string; raw_data: { impressions?: number; pageViews?: number; firstTime?: number; redownloads?: number; updates?: number; chiTiet?: DongChiTiet[] } | null };
export type LuotTai = { ngay: string; loai: 'moi' | 'lai' | 'capNhat'; nuoc: string | null; nguon: string | null; may: string | null; os: string | null; ban: string | null; n: number };
export type DongGop = { khoa: string; hienThi: number; xemTrang: number; tai: number };
export type BaoCaoApp = {
  tu: string | null; den: string | null;
  tong: { hienThi: number; xemTrang: number; taiMoi: number; taiLai: number; capNhat: number };
  /** lượt tải lần đầu từ ngoài Việt Nam — app nhắm thị trường toàn cầu, máy của nhà mình đều ở VN */
  taiMoiNgoaiVN: number;
  tai: LuotTai[]; theoNuoc: DongGop[]; theoNguon: DongGop[];
  /** số ngày chỉ có tổng, chưa có chiTiet (ghi trước 12/10/2026, script chạy lại 35 ngày thì tự đầy) */
  ngayThieuChiTiet: number;
};

const loaiTai = (su: string): LuotTai['loai'] | null =>
  /first/i.test(su) ? 'moi' : /redownload|restore/i.test(su) ? 'lai' : /update/i.test(su) ? 'capNhat' : null;

export function tomTatApp(ds: NgayApp[]): BaoCaoApp {
  const tong = { hienThi: 0, xemTrang: 0, taiMoi: 0, taiLai: 0, capNhat: 0 };
  const tai: LuotTai[] = [], nuoc = new Map<string, DongGop>(), nguon = new Map<string, DongGop>();
  let thieu = 0, taiMoiNgoaiVN = 0;
  const gop = (m: Map<string, DongGop>, k: string, f: 'hienThi' | 'xemTrang' | 'tai', n: number) => {
    const x = m.get(k) ?? { khoa: k, hienThi: 0, xemTrang: 0, tai: 0 }; x[f] += n; m.set(k, x);
  };
  const ngays = ds.filter((d) => d.raw_data).map((d) => d.date).sort();
  for (const d of ds) {
    const r = d.raw_data; if (!r) continue;
    tong.hienThi += r.impressions ?? 0; tong.xemTrang += r.pageViews ?? 0;
    tong.taiMoi += r.firstTime ?? 0; tong.taiLai += r.redownloads ?? 0; tong.capNhat += r.updates ?? 0;
    if (!r.chiTiet) { thieu++; continue; }
    for (const c of r.chiTiet) {
      const k = loaiTai(c.su), nc = c.nuoc ?? '?', ng = c.nguon ?? '?';
      if (c.su === 'Impression') { gop(nuoc, nc, 'hienThi', c.n); gop(nguon, ng, 'hienThi', c.n); }
      else if (c.su === 'Page view') { gop(nuoc, nc, 'xemTrang', c.n); gop(nguon, ng, 'xemTrang', c.n); }
      else if (k) {
        tai.push({ ngay: d.date, loai: k, nuoc: c.nuoc, nguon: c.nguon, may: c.may, os: c.os, ban: c.ban ?? null, n: c.n });
        if (k !== 'capNhat') { gop(nuoc, nc, 'tai', c.n); gop(nguon, ng, 'tai', c.n); }
        if (k === 'moi' && c.nuoc !== 'VN') taiMoiNgoaiVN += c.n;
      }
    }
  }
  const xep = (m: Map<string, DongGop>) => [...m.values()].sort((a, b) => b.tai - a.tai || b.xemTrang - a.xemTrang || b.hienThi - a.hienThi);
  tai.sort((a, b) => b.ngay.localeCompare(a.ngay));
  return { tu: ngays[0] ?? null, den: ngays.at(-1) ?? null, tong, taiMoiNgoaiVN, tai, theoNuoc: xep(nuoc), theoNguon: xep(nguon), ngayThieuChiTiet: thieu };
}
