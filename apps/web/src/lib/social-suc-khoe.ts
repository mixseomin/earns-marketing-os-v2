// SỨC KHOẺ ĐĂNG — đầu trang Social › Tổng quan (anh 20/10/2026: "sửa lại page tổng quan này để vào là nhìn thấy vấn đề, thấy cả hiện trạng").
// Hai khối, cùng một nguồn: (1) SỰ CỐ đang chặn đăng — lỗi đăng gần nhất mỗi nền chưa có lần đăng thành công nào sau nó (xv_may_nhat_ky), tài khoản
// có cảnh báo rủi ro 7 ngày (platform_alerts — máy đăng dừng tài khoản đó), nền im lặng ≥ 2 ngày không lỗi không bài, kho sắp cạn; gom theo NGUYÊN NHÂN
// để một lỗi chung (vd br chặn nút) hiện một dòng kèm các kênh dính, không N dòng. (2) HIỆN TRẠNG — mỗi nơi đăng × 4 ngày gần nhất: ✓ đã đăng (link) ·
// ✗ hỏng (lý do) · ⏳ còn chờ hôm nay · đăng cuối · kho đủ tới (lịch 90 ngày của dang-may, xv_lich_du_kien).
// Tính thuần ở tinhSucKhoe (tự kiểm: social-suc-khoe.test.mts); docSucKhoe chỉ đọc DB.

export type OTrangThai = 'da' | 'hong' | 'cho' | 'khong';
export interface StSucO { ngay: string; tt: OTrangThai; url?: string | null; loi?: string }
export interface StSucDong { may: string; mayTen: string; nen: string; nenTen: string; tk: string; gio: string; mayMac: string; o: StSucO[]; cuoiOk: string | null; khoDen: string | null }
export interface StSuCo { muc: 'bad' | 'warn'; tieuDe: string; chiTiet: string; kenh: string[]; luc: string | null }
export interface StSucKhoe { hom: string; ngay: string[]; dong: StSucDong[]; suCo: StSuCo[] }

export interface VaoSuc {
  bay: number;   // epoch ms
  noi: { may: string; mayTen: string; nen: string; nenTen: string; tk: string; gio: string; mayMac: string; acct: string | null }[];
  da: { may: string; nen: string; ngay: string; luc: string | null; url: string | null }[];
  hong: { may: string; nen: string; luc: string; chu: string }[];   // xv_may_nhat_ky ok=false, buoc='dang'
  canhBao: { acct: string; loai: string; luc: string; chu: string }[];   // platform_alerts 7 ngày có account_id
  lich: { may: string; nen: string; ngay: string; gio: string }[];
}

/** Lỗi thô → nguyên nhân người đọc hiểu (gom các kênh dính cùng một gốc). Không khớp mẫu nào thì giữ câu đầu của lỗi. */
const NGUYEN_NHAN: [RegExp, string, string][] = [
  [/nut-nhay-cam[^]*Publish|click Publish/i, 'br chặn bấm nút Publish', 'Gác nút nhạy cảm của br coi Publish là nút cấm — máy chọn xong mọi thứ nhưng không bấm đăng được.'],
  [/URL không có nguồn/i, 'br chặn mở trang đăng (URL không có nguồn)', 'Luật chặn bịa URL của br từ chối trang soạn bài — máy đăng phải khai nguồn URL.'],
  [/Studio đang ở kênh khác/i, 'YouTube Studio đứng nhầm kênh', 'Gmail giữ nhiều kênh; đổi kênh qua menu không ăn nên máy dừng để không đăng nhầm kênh.'],
  [/boot không lên|os up|máy ảo/i, 'Máy ảo không lên', 'Lệnh bật máy ảo Android treo / quá giờ trước khi đăng.'],
  [/Confirm your identity|xác minh danh tính|verify (it.s you|your identity)/i, 'Nền tảng đòi xác minh danh tính', 'Chỉ chủ tài khoản xác minh được (app trên điện thoại).'],
  [/is not a function|TypeError|ReferenceError|SyntaxError/i, 'Lỗi mã máy đăng', 'Script đăng vỡ trước khi tới nền tảng.'],
  [/oembed|chưa công khai/i, 'Đăng xong nhưng chưa công khai', 'Bài lên nhưng kiểm công khai không qua.'],
  [/Hết video|hết video/i, 'Hết bài đã duyệt', 'Kho không còn bài DUYỆT chưa đăng cho nền này.'],
];
export function nguyenNhan(chu: string): { ten: string; giai: string } {
  for (const [re, ten, giai] of NGUYEN_NHAN) if (re.test(chu)) return { ten, giai };
  const dau = chu.replace(/^Đăng hỏng:\s*/, '').split(/[|\n]/)[0]!.trim().slice(0, 120);
  return { ten: dau || 'Lỗi không rõ', giai: '' };
}
const LOAI_CB: Record<string, string> = { han_che: 'bị hạn chế', khoa: 'bị khoá', xac_minh: 'bị đòi xác minh', tu_choi: 'bị từ chối thao tác', canh_bao: 'có cảnh báo' };
const dm = (n: string) => `${n.slice(8, 10)}/${n.slice(5, 7)}`;
const cong = (ngay: string, n: number) => new Date(Date.parse(`${ngay}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const vn = (ms: number) => new Date(ms + 7 * 3600e3).toISOString();

export function tinhSucKhoe(v: VaoSuc, soNgay = 4): StSucKhoe {
  const bayVn = vn(v.bay), hom = bayVn.slice(0, 10), gioNay = bayVn.slice(11, 16);
  const ngay = Array.from({ length: soNgay }, (_, i) => cong(hom, i - soNgay + 1));
  const ngayHong = (luc: string) => vn(Date.parse(luc)).slice(0, 10);
  const ten = (x: { may: string; nen: string }) => { const n = v.noi.find((y) => y.may === x.may && y.nen === x.nen); return n ? `${n.mayTen.split(' · ')[0]} · ${n.nenTen}` : `${x.may} · ${x.nen}`; };
  const dong: StSucDong[] = v.noi.map((n) => {
    const da = v.da.filter((x) => x.may === n.may && x.nen === n.nen), hong = v.hong.filter((x) => x.may === n.may && x.nen === n.nen);
    const o = ngay.map((d): StSucO => {
      const ok = da.filter((x) => x.ngay === d).sort((a, b) => String(b.luc).localeCompare(String(a.luc)))[0];
      if (ok) return { ngay: d, tt: 'da', url: ok.url };
      const h = hong.filter((x) => ngayHong(x.luc) === d).sort((a, b) => b.luc.localeCompare(a.luc))[0];
      if (h) return { ngay: d, tt: 'hong', loi: nguyenNhan(h.chu).ten };
      if (d === hom && v.lich.some((x) => x.may === n.may && x.nen === n.nen && x.ngay === hom && x.gio > gioNay)) return { ngay: d, tt: 'cho' };
      return { ngay: d, tt: 'khong' };
    });
    const cuoiOk = da.map((x) => x.ngay).sort().pop() ?? null;
    const khoDen = v.lich.filter((x) => x.may === n.may && x.nen === n.nen).map((x) => x.ngay).sort().pop() ?? null;
    return { may: n.may, mayTen: n.mayTen, nen: n.nen, nenTen: n.nenTen, tk: n.tk, gio: n.gio, mayMac: n.mayMac, o, cuoiOk, khoDen };
  });

  // SỰ CỐ: lỗi gần nhất của mỗi nền mà sau nó chưa có lần đăng thành công → gom theo nguyên nhân
  const gom = new Map<string, StSuCo>();
  const them = (khoa: string, muc: StSuCo['muc'], tieuDe: string, chiTiet: string, kenh: string, luc: string | null) => {
    const g = gom.get(khoa) ?? { muc, tieuDe, chiTiet, kenh: [], luc: null };
    if (!g.kenh.includes(kenh)) g.kenh.push(kenh); if (luc && (!g.luc || luc > g.luc)) g.luc = luc; gom.set(khoa, g);
  };
  for (const n of v.noi) {
    const hong = v.hong.filter((x) => x.may === n.may && x.nen === n.nen).sort((a, b) => b.luc.localeCompare(a.luc))[0];
    const okLuc = v.da.filter((x) => x.may === n.may && x.nen === n.nen).map((x) => x.luc ?? `${x.ngay}T00:00:00Z`).sort().pop();
    if (hong && (!okLuc || okLuc < hong.luc)) { const nn = nguyenNhan(hong.chu); them(`loi|${nn.ten}`, 'bad', nn.ten, nn.giai, ten(n), hong.luc); }
  }
  // cảnh báo rủi ro 7 ngày trên tài khoản của nơi đăng → máy đăng dừng tài khoản đó (nhip-an-toan › canhBaoDung)
  for (const n of v.noi) for (const c of v.canhBao.filter((x) => n.acct && x.acct === n.acct)) {
    const het = new Date(Date.parse(c.luc) + 7 * 864e5 + 7 * 3600e3).toISOString();
    them(`cb|${c.acct}|${c.loai}`, 'bad', `Tài khoản ${n.tk || n.acct} ${LOAI_CB[c.loai] ?? c.loai} — máy dừng đăng tới ${dm(het)}`, c.chu.replace(/\s+/g, ' ').slice(0, 220), ten(n), c.luc);
  }
  // im lặng: ≥ 2 ngày không bài, không lỗi (không có lượt chạy / máy Mac tắt / bị trần chặn)
  for (const d of dong) {
    const coLoi = [...gom.values()].some((g) => g.kenh.includes(`${d.mayTen.split(' · ')[0]} · ${d.nenTen}`));
    if (!coLoi && d.o.slice(-3, -1).every((x) => x.tt === 'khong') && d.o.at(-1)!.tt !== 'da' && d.o.at(-1)!.tt !== 'cho')
      them('im', 'warn', 'Không đăng mà không báo lỗi', 'Hai ngày qua không bài, không lỗi: không có lượt chạy, máy Mac tắt, hoặc nhịp an toàn chặn. Xem nhật ký máy đăng.', ten(d), null);
  }
  // kho sắp cạn (lịch còn ≤ 7 ngày)
  for (const d of dong) if (d.khoDen && d.khoDen <= cong(hom, 7)) them(`kho|${d.may}`, 'warn', `Kho ${d.mayTen.split(' · ')[0]} chỉ đủ tới ${dm(d.khoDen)}`, 'Cần thêm đề / dạng bài mới — nhịp an toàn không cho dồn bài.', ten(d), null);
  const suCo = [...gom.values()].sort((a, b) => (a.muc === b.muc ? b.kenh.length - a.kenh.length : a.muc === 'bad' ? -1 : 1));
  return { hom, ngay, dong, suCo };
}
