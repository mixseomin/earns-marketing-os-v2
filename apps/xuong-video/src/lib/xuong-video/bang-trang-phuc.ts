// BẢNG TRANG PHỤC THEO NGÀY TRUYỆN (costume plot — anh 17/10/2026: "nhân vật có nhiều trang phục ở từng hoàn cảnh khác nhau; chuyển thời điểm đã có bộ
// chấm trang phục tự động chưa"). Ngành: phòng phục trang lập bảng nhân vật × ngày truyện × lần thay đồ (Change 1, 2…), thư ký trường quay đối chiếu
// từng cảnh. Ở đây bảng nằm trong kinh thánh phim (kinh_thanh.bang_trang_phuc): mỗi dòng = từ cảnh `tu_canh` của ngày `ngay`, nhân vật `nv` mặc
// biến thể `bien_the` (sổ trang phục — bo-set-3d.ts › lookChuaChuan) cho tới dòng kế. Máy chặn (người thật):
//   · phim chưa có bảng / nhân vật thiếu dòng cho ngày truyện của cảnh;
//   · shot mặc bộ khác bảng ghi cho cảnh đó (đổi đồ chỉ được ở cảnh bảng có dòng đổi);
//   · bộ đồ khai `dung_cho` (văn phòng, ở nhà, tiệc, đêm…) mà nơi / lúc của cảnh không khớp — vest công sở trong cảnh ngủ.
// MỘT chỗ cho cổng keyframe (sinh-anh.ts › lyChanKeyframe) và bộ chấm tại chỗ (kiem.mts). Thuần — tự kiểm: bang-trang-phuc.test.mts
import type { BienThe, May3d, NhanVat, PhanCanh } from './kieu';
import { ngoaiKet, ngoaiMo } from './bo-set-3d';

export type DongTrangPhuc = { nv: string; ngay: string; tu_canh: string; bien_the: string };
export type BienTheDungCho = BienThe & { dung_cho?: string[] | null };
export const docBangTrangPhuc = (kt: unknown): DongTrangPhuc[] => {
  const b = (kt as { bang_trang_phuc?: unknown } | null)?.bang_trang_phuc;
  return Array.isArray(b) ? (b as DongTrangPhuc[]).filter((d) => d && d.nv && d.ngay && d.tu_canh && d.bien_the) : [];
};
const chu = (t: string) => t.trim().toLowerCase();

/** Lỗi bảng trang phục của MỘT shot. m = máy ĐẦY ĐỦ (sổ đã nối — doc-db.ts › mayDu) để đọc đúng đồ đang mặc lúc mở / kết. */
export function kiemBangTrangPhuc(c: { phan_doan?: string }, m: May3d | null | undefined, phanCanh: Pick<PhanCanh, 'ten' | 'ngay' | 'noi' | 'luc'>[],
  bang: DongTrangPhuc[], nhanVat: (Pick<NhanVat, 'ten' | 'loai' | 'khoi_3d'> & { bien_the?: BienTheDungCho[] })[]): string[] {
  if (!m) return [];
  const iPc = phanCanh.findIndex((p) => p.ten === c.phan_doan); const pc = phanCanh[iPc]; if (!pc) return [];
  const out = new Set<string>(); const iCanh = (t: string) => phanCanh.findIndex((p) => p.ten === t);
  for (const v of m.vi_tri) {
    const a = nhanVat.find((x) => chu(x.ten) === chu(v.ten));
    if (v.an || a?.loai !== 'nhan_vat' || a.khoi_3d?.hinh !== 'nguoi') continue;
    if (!bang.length) { out.add('bảng trang phục: phim người thật chưa có bảng trang phục theo ngày truyện (kinh_thanh.bang_trang_phuc: nhân vật × ngày × từ cảnh → biến thể)'); continue; }
    const dong = bang.filter((d) => chu(d.nv) === chu(v.ten) && d.ngay === pc.ngay);
    if (!dong.length) { out.add(`bảng trang phục: ${v.ten} chưa có dòng cho ngày ${pc.ngay ?? '?'} — khai bộ đồ từ cảnh đầu ${v.ten} xuất hiện trong ngày`); continue; }
    const truoc = dong.filter((d) => iCanh(d.tu_canh) >= 0 && iCanh(d.tu_canh) < iPc); const trong = dong.filter((d) => iCanh(d.tu_canh) === iPc);
    const cuoiTruoc = truoc.length ? truoc.reduce((x, y) => (iCanh(y.tu_canh) >= iCanh(x.tu_canh) ? y : x)) : null;
    const duoc = [...new Set([...(cuoiTruoc ? [cuoiTruoc.bien_the] : []), ...trong.map((d) => d.bien_the)])];
    if (!duoc.length) { out.add(`bảng trang phục: ${v.ten} xuất hiện ở cảnh "${pc.ten}" trước dòng đầu của ngày ${pc.ngay} — dời dòng bảng về cảnh này`); continue; }
    for (const t of new Set([ngoaiMo(v as never, 'trang_phuc'), ngoaiKet(v as never, 'trang_phuc')].filter((x): x is string => !!x))) {
      if (!duoc.some((d) => chu(d) === chu(t))) out.add(`bảng trang phục: ${v.ten} mặc "${t}" ở cảnh "${pc.ten}" (ngày ${pc.ngay}) mà bảng ghi ${duoc.map((d) => `"${d}"`).join(' / ')} — sửa sổ người hoặc thêm dòng đổi đồ vào bảng`);
      const b = (a.bien_the ?? []).find((x) => chu(x.ten) === chu(t));
      const noi = `${pc.noi ?? ''} ${pc.luc ?? ''}`.toLowerCase();
      if (b?.dung_cho?.length && !b.dung_cho.some((k) => noi.includes(k.toLowerCase())))
        out.add(`bảng trang phục: "${t}" của ${v.ten} dùng cho ${b.dung_cho.join(', ')} mà cảnh "${pc.ten}" ở ${pc.noi ?? '?'} · ${pc.luc ?? '?'} — sai hoàn cảnh`);
    }
  }
  return [...out];
}
