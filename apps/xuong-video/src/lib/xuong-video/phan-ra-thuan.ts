// PHÂN RÃ KỊCH BẢN (script breakdown) — phần THUẦN: khuôn trả lời AI, câu hệ thống, dựng đầu vào, mã băm, kế hoạch tạo món thiếu, gắn shot, báo cáo chuẩn bị.
// Cách đoàn phim thật làm (anh 31/10/2026: "tóc, giày, đồng hồ… làm sao có đủ ở đây? Làm sao để nó tự sinh ra và báo nếu thiếu? Thêm 1000 tập mới thì sao?"):
// trợ lý đạo diễn + phục trang + giám sát kịch bản đọc TỪNG cảnh, gắn thẻ mọi yếu tố theo hạng mục (phục trang gồm giày, tóc, trang điểm, từng phụ kiện,
// vết, trạng thái cơ thể, đạo cụ, bối cảnh, bày trí) → gộp thành bảng phục trang từng nhân vật → món nào chưa chuẩn bị thì báo. Chạy theo TẬP, tăng dần
// theo mã băm (tập không đổi thì không chạy lại). Không đọc DB, không gọi AI — phan-ra.ts lo. Tự kiểm: phan-ra-thuan.test.mts
import { z } from 'zod/v4';   // zodOutputFormat của SDK cần zod v4 (claude.ts)
import { thieuAnchor, type BienThe, type Canh, type NhanVat, type Tap } from './kieu';

/** Đổi câu hệ thống / khuôn / luật gắn → tăng số này: mọi tập đã phân rã thành "cũ", báo cáo nhắc chạy lại. */
export const PHIEN_PHAN_RA = 1;
/** Nhóm look-book (khớp KHOA_LOOK ở bo-set-3d.ts — giữ cạnh đây cho phần thuần dùng được cả phía trình duyệt). */
export const NHOM_LOOK = ['trang_phuc', 'toc', 'trang_diem', 'do_deo', 'vet', 'trang'] as const;
const LA_LOOK = new Set<string>(NHOM_LOOK);
export const LOAI_THANH_PHAN = ['look', 'dao_cu', 'boi_canh', 'cau_kien', 'nhan_vat'] as const;

export const PhanRaSchema = z.object({
  thanh_phan: z.array(z.object({
    loai: z.string().describe(`Một trong: ${LOAI_THANH_PHAN.join(' · ')}`),
    cua: z.string().describe('look: tên CHÍNH XÁC nhân vật mang món · cau_kien: tên CHÍNH XÁC bối cảnh chứa món · loại khác: để rỗng'),
    nhom: z.string().describe(`Chỉ cho look: một trong ${NHOM_LOOK.join(' · ')}; loại khác để rỗng`),
    ten: z.string().describe('Tên ngắn tiếng Việt, DUY NHẤT trong nhóm của nhân vật/bối cảnh đó; món đã có thì chép ĐÚNG tên cũ'),
    co_san: z.boolean().describe('true nếu món ĐÃ CÓ trong danh sách thành phần (chép đúng tên); false nếu là món MỚI cần chuẩn bị'),
    mo_ta: z.string().describe('Mô tả TIẾNG ANH đủ để vẽ ảnh mẫu không phải đoán (màu, chất liệu, kiểu dáng, chi tiết; phụ kiện ghi tay/tai nào; vết ghi hình dạng, màu, cỡ cm, vị trí). Món đã có: có thể để rỗng'),
    ly_do: z.string().describe('Shot / dòng kịch bản nào đòi món này, tiếng Việt (vd "S3: Vivian hắt cà phê lên áo Hạ")'),
  })).describe('MỌI thành phần tập này cần — cả món ĐÃ CÓ (co_san=true) lẫn món MỚI'),
  shot: z.array(z.object({
    ma: z.string().describe('Mã shot đúng như đầu vào (S1, S2…)'),
    dung: z.array(z.string()).describe('MỌI thành phần NHÌN THẤY TRONG KHUNG shot này: tên nhân vật; với MỖI nhân vật trong khung là TOÀN BỘ look đang thấy dạng "Tên nhân vật · tên món" (bộ đồ, tóc, trang điểm, từng phụ kiện, từng vết, trạng thái); tên đạo cụ; tên bối cảnh; cấu kiện thấy được dạng "Tên bối cảnh · tên món". Thứ ngoài khung / vết chưa xảy ra KHÔNG ghi'),
  })).describe('Đủ MỌI shot đầu vào, mỗi mã đúng một lần'),
  ghi_chu: z.array(z.string()).describe('Mâu thuẫn liền mạch / thiếu sót phát hiện, mỗi dòng một ý, tiếng Việt (vd "S2 prompt đã tả vết cà phê nhưng S3 mới hắt cà phê")'),
});
export type PhanRaKq = z.infer<typeof PhanRaSchema>;

export const HE_PHAN_RA = `Bạn là tổ chuẩn bị của một đoàn phim: trợ lý đạo diễn (lập bảng phân rã kịch bản), phụ trách phục trang – hoá trang – đạo cụ, và giám sát kịch bản (script supervisor). Việc của bạn: PHÂN RÃ KỊCH BẢN một tập — đọc kịch bản và TỪNG shot, gắn thẻ MỌI yếu tố nhìn thấy để đoàn chuẩn bị đủ trước khi quay và để mọi shot đồng nhất. Bỏ sót một món = keyframe tự vẽ bừa món đó, mỗi shot một kiểu.

HẠNG MỤC (loai · nhom):
- look · trang_phuc — MỘT bộ phục trang hoàn chỉnh của một nhân vật (một "lần thay đồ"): tả từ trên xuống GỒM GIÀY/DÉP (áo, quần/váy, áo khoác, tất, giày). Nhân vật thay đồ → bộ mới.
- look · toc — kiểu tóc (dáng, độ dài, màu, búi/xõa/buộc, kẹp/băng đô).
- look · trang_diem — kiểu trang điểm (nhẹ tự nhiên, dự tiệc, màu son, lem sau khóc…).
- look · do_deo — TỪNG phụ kiện đeo trên người là MỘT món riêng: đồng hồ, kính, khuyên tai, dây chuyền, nhẫn, vòng tay, túi xách, mũ, khăn, thắt lưng, cà vạt, kẹp cà vạt… Vật được cầm trao / làm rơi / bị giật trong truyện là ĐẠO CỤ, không phải phụ kiện.
- look · vet — TỪNG vết / dấu trên người hoặc trang phục: vết bẩn, vết cà phê, vết son, vết thương, băng, sẹo… CHỈ có từ shot SỰ KIỆN gây ra nó trở về sau, KHÔNG BAO GIỜ trước; vết trên quần áo hết khi thay bộ đó; vết thương còn tới khi lành / băng lại.
- look · trang — trạng thái cơ thể nhìn thấy: ướt mưa, mồ hôi, tóc rối, mặt lem nước mắt… từ shot sự kiện.
- dao_cu — mọi đồ vật nhân vật cầm / dùng / trao / làm rơi, hoặc quan trọng với truyện.
- boi_canh — nơi chốn (mỗi địa điểm một món).
- cau_kien — đồ cố định / bày trí của MỘT bối cảnh thấy trong khung (logo tường, tranh, cửa, ghế, bục, cây…); cua = tên bối cảnh.
- nhan_vat — nhân vật CÓ TÊN xuất hiện mà danh sách chưa có (vai quần chúng không tạo).

QUY TẮC:
1. DÙNG LẠI món đã có: món trong THÀNH PHẦN ĐÃ CÓ khớp thì co_san=true và chép ĐÚNG tên cũ (cả tên nhân vật / bối cảnh trong cua). Chỉ tạo mới khi không món nào khớp. CẤM bản gần trùng ("Áo sơ mi trắng" khi đã có "Sơ mi trắng").
2. ten: tiếng Việt, ngắn, rõ, DUY NHẤT trong nhóm của nhân vật / bối cảnh đó (vd "Đồng hồ bạc dây kim loại", "Búi thấp", "Vest đen công sở").
3. mo_ta (món MỚI bắt buộc): tiếng ANH, đủ để vẽ ảnh mẫu không phải đoán — màu, chất liệu, kiểu dáng, chi tiết; phụ kiện ghi đeo tay / tai nào; vết ghi đúng hình dạng, màu, cỡ (cm), vị trí trên người / áo.
4. Liền mạch: cùng ngày truyện, cùng phân cảnh → cùng bộ đồ / tóc / phụ kiện, trừ khi kịch bản cho thấy thay. Nối với tập trước nếu tóm tắt cho thấy cùng ngày.
5. MỖI shot (đủ mọi mã S…): dung = MỌI thành phần NHÌN THẤY TRONG KHUNG — tên nhân vật, và với MỖI nhân vật trong khung là TOÀN BỘ look đang thấy dạng "Tên nhân vật · tên món" (bộ đồ, tóc, trang điểm, từng phụ kiện, từng vết, trạng thái — đủ cả, vì danh sách này THAY look cũ của nhân vật ở shot đó); tên đạo cụ; tên bối cảnh; cấu kiện thấy được dạng "Tên bối cảnh · tên món". Ngoài khung KHÔNG ghi. Vết chưa xảy ra KHÔNG ghi.
6. Chỉ ghi điều kịch bản / shot nói ra hoặc suy ra chắc chắn theo vai (nhân viên văn phòng đi làm có giày công sở). Không bịa chi tiết lạ không căn cứ.
7. ghi_chu: mâu thuẫn liền mạch phát hiện, thiếu sót kịch bản, điểm cần chú ý khi quay.
Trả JSON đúng khuôn: ten / ly_do / ghi_chu tiếng Việt, mo_ta tiếng Anh.`;

/** So tên: chuẩn Unicode, thường, gọn khoảng trắng, bỏ ngoặc kép bao ngoài. */
export const chuan = (s: string) => (s ?? '').normalize('NFC').toLowerCase().replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '').replace(/\s+/g, ' ').trim();
/** "Lâm Hạ · Sơ mi trắng" → ['Lâm Hạ', 'Sơ mi trắng']; tên trơn → [tên]. Cắt ở dấu · / • ĐẦU TIÊN (tên món được phép chứa dấu khác). */
export function tachTen(s: string): [string] | [string, string] {
  const m = (s ?? '').match(/^(.*?)\s*[·•]\s*(.+)$/);
  return m && m[1]!.trim() ? [m[1]!.trim(), m[2]!.trim()] : [(s ?? '').trim()];
}
/** Khớp tên: đúng chuẩn trước; không có thì "chứa nhau" (≥ 4 ký tự) — bắt "Sơ mi trắng" ↔ "Sơ mi trắng (có thẻ)" khi AI rút gọn. Nhiều ứng viên chứa nhau → chọn tên ngắn nhất. */
function khopTen<T extends { ten: string }>(ds: T[], ten: string): T | undefined {
  const k = chuan(ten); if (!k) return undefined;
  const dung = ds.find((x) => chuan(x.ten) === k); if (dung) return dung;
  if (k.length < 4) return undefined;
  return ds.filter((x) => { const t = chuan(x.ten); return t.length >= 4 && (t.includes(k) || k.includes(t)); }).sort((a, b) => a.ten.length - b.ten.length)[0];
}

/** Trường chữ của một shot đưa vào phân rã + mã băm. */
export type CanhVao = Pick<Canh, 'id' | 'thu_tu' | 'nhanh' | 'canh' | 'phan_doan' | 'goc_may' | 'hanh_dong' | 'loi_thoai' | 'thoai' | 'trang_phuc' | 'prompt_anh' | 'nhan_vat' | 'bien_the'>;
const chuThoai = (c: Pick<Canh, 'thoai' | 'loi_thoai'>) => (c.thoai?.length ? c.thoai.map((d) => `${d.nhan_vat}: "${d.loi}"`).join(' | ') : c.loi_thoai || '');

/** MÃ BĂM chữ của tập (kịch bản + chữ từng shot) — đổi = phân rã CŨ. KHÔNG băm phần gắn (nhan_vat / bien_the) để chính lượt phân rã gắn xong không tự làm mình cũ. FNV-1a. */
export function bamPhanRa(tap: Pick<Tap, 'kich_ban'>, canh: Pick<CanhVao, 'thu_tu' | 'nhanh' | 'canh' | 'phan_doan' | 'hanh_dong' | 'loi_thoai' | 'thoai' | 'trang_phuc' | 'prompt_anh'>[]): string {
  const s = [`v${PHIEN_PHAN_RA}`, tap.kich_ban ?? '', ...[...canh].sort((a, b) => (a.nhanh || '').localeCompare(b.nhanh || '') || a.thu_tu - b.thu_tu)
    .map((c) => [c.thu_tu, c.nhanh || '', c.canh, c.phan_doan, c.hanh_dong, chuThoai(c), c.trang_phuc, c.prompt_anh].join('\u0001'))].join('\u0002');
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) { const ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 16777619); h2 = Math.imul(h2 ^ ch, 2246822519); }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

const NHAN_LOAI: Record<string, string> = { nhan_vat: 'nhân vật', san_pham: 'sản phẩm', boi_canh: 'bối cảnh', dao_cu: 'đạo cụ', cau_kien: 'cấu kiện', phong_cach: 'phong cách' };
/** Danh sách THÀNH PHẦN ĐÃ CÓ đưa cho AI dùng lại đúng tên: nhân vật + look-book từng nhóm (kèm tập), bối cảnh + cấu kiện, đạo cụ, sản phẩm. */
export function taThanhPhan(nhanVat: NhanVat[]): string {
  const cat = (s: string, n: number) => { const t = (s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };
  const thu = ['nhan_vat', 'san_pham', 'boi_canh', 'dao_cu'];
  const dong: string[] = [];
  for (const loai of thu) for (const a of nhanVat.filter((v) => v.loai === loai)) {
    dong.push(`[${NHAN_LOAI[loai]}] ${a.ten} — ${cat(a.mo_ta, 180) || '(chưa tả)'}`);
    const look = (a.bien_the ?? []).filter((b) => LA_LOOK.has(b.nhom));
    for (const n of NHOM_LOOK) { const bs = look.filter((b) => b.nhom === n); if (bs.length) dong.push(`    · ${n}: ${bs.map((b) => `"${b.ten}"${b.dung_tap?.length ? ` [tập ${b.dung_tap.join(',')}]` : ''} — ${cat(b.mo_ta, 90)}`).join('; ')}`); }
    if (loai === 'boi_canh') { const ck = nhanVat.filter((v) => v.loai === 'cau_kien' && v.thuoc_id === a.id); if (ck.length) dong.push(`    · cấu kiện: ${ck.map((v) => `"${v.ten}"`).join(', ')}`); }
  }
  const ckMoCoi = nhanVat.filter((v) => v.loai === 'cau_kien' && !nhanVat.some((p) => p.id === v.thuoc_id));
  if (ckMoCoi.length) dong.push(`[cấu kiện chưa gắn bối cảnh] ${ckMoCoi.map((v) => `"${v.ten}"`).join(', ')}`);
  return dong.join('\n') || '(chưa có thành phần nào)';
}

/** Dựng câu người dùng cho lượt phân rã + bảng mã shot (S1… → id shot; mã tránh trùng số thứ tự giữa các nhánh hook). */
export function taPhanRa(o: { tenPhim: string; loai: string; phongCach: string; tap: Pick<Tap, 'so' | 'ten' | 'kich_ban'>; tomTatTruoc: string[]; nhanVat: NhanVat[]; canh: CanhVao[] }): { user: string; ma: Map<string, number> } {
  const ma = new Map<string, number>();
  const tenCua = (ids: number[]) => ids.map((id) => o.nhanVat.find((v) => v.id === id)?.ten).filter(Boolean).join(', ');
  const btCua = (ids: number[]) => o.nhanVat.flatMap((v) => (v.bien_the ?? []).filter((b) => ids.includes(b.id)).map((b) => `${v.ten} · ${b.ten}`)).join(', ');
  const ds = [...o.canh].sort((a, b) => (a.nhanh || '').localeCompare(b.nhanh || '') || a.thu_tu - b.thu_tu);
  const shot = ds.map((c, i) => {
    const m = `S${i + 1}`; ma.set(m, c.id);
    return [`${m} · shot #${c.thu_tu}${c.nhanh ? ` (nhánh hook ${c.nhanh})` : ''} · phân cảnh: ${c.phan_doan || '—'} · cảnh: ${c.canh || '—'}`,
      c.goc_may ? `  góc máy: ${c.goc_may}` : '', `  hành động: ${c.hanh_dong || '—'}`, chuThoai(c) ? `  thoại: ${chuThoai(c)}` : '',
      c.trang_phuc ? `  ghi chú phục trang: ${c.trang_phuc}` : '', c.prompt_anh ? `  prompt ảnh: ${c.prompt_anh.replace(/\s+/g, ' ').slice(0, 700)}` : '',
      `  đang gắn: ${tenCua(c.nhan_vat) || '—'}${c.bien_the.length ? ` · biến thể: ${btCua(c.bien_the)}` : ''}`].filter(Boolean).join('\n');
  });
  const kb = (o.tap.kich_ban ?? '').trim();
  const user = [`PHIM: ${o.tenPhim} · loại ${o.loai}${o.phongCach ? ` · phong cách: ${o.phongCach.slice(0, 300)}` : ''}`,
    o.tomTatTruoc.length ? `TÓM TẮT CÁC TẬP TRƯỚC:\n${o.tomTatTruoc.slice(-3).map((t, i) => `- ${t.slice(0, 400)}`).join('\n')}` : '',
    `TẬP ${o.tap.so}: ${o.tap.ten || ''}`, kb ? `KỊCH BẢN TẬP:\n${kb.length > 14000 ? `${kb.slice(0, 14000)}\n…(cắt)` : kb}` : '(tập chưa có kịch bản chữ — phân rã theo các shot)',
    `THÀNH PHẦN ĐÃ CÓ (dùng lại ĐÚNG tên):\n${taThanhPhan(o.nhanVat)}`,
    `CÁC SHOT (${ds.length}, theo thứ tự phát):\n${shot.join('\n')}`,
    'Phân rã đủ MỌI hạng mục cho tập này theo khuôn.'].filter(Boolean).join('\n\n');
  return { user, ma };
}

export type KeHoach = {
  taoAnchor: { loai: 'dao_cu' | 'boi_canh' | 'cau_kien' | 'nhan_vat'; ten: string; mo_ta: string; cha: string | null; ly_do: string }[];
  taoBienThe: { cua: string; nhom: string; ten: string; mo_ta: string; dung_tap: number[]; ly_do: string }[];
  /** biến thể SẴN CÓ đã gắn tập (dung_tap không rỗng) mà tập này cũng dùng → thêm số tập */
  themTap: { id: number; dung_tap: number[] }[];
  khongKhop: string[];
};
/** KẾ HOẠCH tạo món thiếu từ kết quả AI (thuần). Món đã có (khớp tên) → không tạo, chỉ ghi thêm tập nếu biến thể đang gắn tập. Món mới gắn đúng tập này. */
export function keHoach(kq: Pick<PhanRaKq, 'thanh_phan'>, nhanVat: NhanVat[], tapSo: number): KeHoach {
  const kh: KeHoach = { taoAnchor: [], taoBienThe: [], themTap: [], khongKhop: [] };
  const anchorCo = nhanVat.filter((v) => v.loai !== 'cau_kien');
  const planAnchor = (loai: string, ten: string) => kh.taoAnchor.find((a) => a.loai === loai && chuan(a.ten) === chuan(ten));
  const timBc = (ten: string) => khopTen(anchorCo.filter((v) => v.loai === 'boi_canh'), ten) ?? planAnchor('boi_canh', ten);
  // nhân vật / bối cảnh MỚI xử trước để look / cấu kiện của chúng tìm được cha trong kế hoạch
  const hang = (loai: string) => (chuan(loai) === 'nhan_vat' ? 0 : chuan(loai) === 'boi_canh' ? 1 : 2);
  const xep = [...kq.thanh_phan].sort((a, b) => hang(a.loai) - hang(b.loai));
  for (const t of xep) {
    const loai = chuan(t.loai), ten = (t.ten ?? '').trim(); if (!ten) continue;
    const mo_ta = (t.mo_ta ?? '').trim(), ly_do = (t.ly_do ?? '').trim();
    if (loai === 'look') {
      const nhom = chuan(t.nhom);
      if (!LA_LOOK.has(nhom)) { kh.khongKhop.push(`look "${ten}" nhóm lạ "${t.nhom}"`); continue; }
      const nv = khopTen(nhanVat.filter((v) => v.loai === 'nhan_vat'), t.cua);   // nhân vật đã có; không có thì phải là nhân vật MỚI trong kế hoạch
      if (!nv && !planAnchor('nhan_vat', t.cua)) { kh.khongKhop.push(`look "${ten}" của "${t.cua}" — không thấy nhân vật`); continue; }
      const co = nv ? khopTen((nv.bien_the ?? []).filter((b) => b.nhom === nhom), ten) : undefined;
      if (co) {
        if (co.dung_tap?.length && !co.dung_tap.includes(tapSo) && !kh.themTap.some((x) => x.id === co.id)) kh.themTap.push({ id: co.id, dung_tap: [...co.dung_tap, tapSo].sort((a, b) => a - b) });
        continue;
      }
      const tenCha = nv?.ten ?? t.cua.trim();
      if (kh.taoBienThe.some((b) => chuan(b.cua) === chuan(tenCha) && b.nhom === nhom && chuan(b.ten) === chuan(ten))) continue;
      if (t.co_san) kh.khongKhop.push(`AI ghi "${tenCha} · ${ten}" có sẵn nhưng không tìm thấy — đã tạo mới`);
      kh.taoBienThe.push({ cua: tenCha, nhom, ten, mo_ta: mo_ta || ten, dung_tap: [tapSo], ly_do });
    } else if (loai === 'dao_cu' || loai === 'boi_canh' || loai === 'nhan_vat') {
      if (khopTen(anchorCo, ten) || planAnchor(loai, ten)) continue;
      if (t.co_san) kh.khongKhop.push(`AI ghi ${NHAN_LOAI[loai]} "${ten}" có sẵn nhưng không tìm thấy — đã tạo mới`);
      kh.taoAnchor.push({ loai, ten, mo_ta, cha: null, ly_do });
    } else if (loai === 'cau_kien') {
      const bc = timBc(t.cua); if (!bc) { kh.khongKhop.push(`cấu kiện "${ten}" — không thấy bối cảnh "${t.cua}"`); continue; }
      const daCo = nhanVat.filter((v) => v.loai === 'cau_kien');
      if (khopTen(daCo, ten) || planAnchor('cau_kien', ten)) continue;
      kh.taoAnchor.push({ loai: 'cau_kien', ten, mo_ta, cha: bc.ten, ly_do });
    } else kh.khongKhop.push(`thành phần "${ten}" loại lạ "${t.loai}"`);
  }
  return kh;
}

export type LienKet = { id: number; nhan_vat: number[]; bien_the: number[]; dung: string[]; khong_khop: string[]; doi: boolean };
const cungTap = (a: number[], b: number[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
/** GẮN SHOT theo phân rã (thuần): thêm anchor thấy trong khung (không bao giờ bỏ anchor đã gắn); với nhân vật mà phân rã có kê look ở shot đó →
 *  bộ look của nhân vật ấy THAY bằng bộ phân rã (costume plot là nguồn đúng: vết chỉ từ shot sự kiện, phụ kiện đủ món); nhân vật không kê look → giữ nguyên.
 *  Biến thể không phải look (biểu cảm, tư thế, góc sản phẩm) luôn giữ. Cấu kiện không gắn vào shot (vị trí theo sơ đồ bối cảnh) — chỉ ghi dung. */
export function lienKetShot(kq: Pick<PhanRaKq, 'shot'>, ma: Map<string, number>, canh: Pick<CanhVao, 'id' | 'nhan_vat' | 'bien_the'>[], nhanVat: NhanVat[]): LienKet[] {
  const anchorCo = nhanVat.filter((v) => v.loai !== 'cau_kien');
  const btTheoId = new Map<number, BienThe>(); for (const v of nhanVat) for (const b of v.bien_the ?? []) btTheoId.set(b.id, b);
  const out: LienKet[] = [];
  for (const s of kq.shot) {
    const id = ma.get((s.ma ?? '').trim().toUpperCase()); const c = id == null ? undefined : canh.find((x) => x.id === id); if (!c) continue;
    const anchor = new Set<number>(); const look = new Map<number, number[]>(); const btKhac: number[] = []; const kk: string[] = [];
    for (const raw of s.dung ?? []) {
      const t = tachTen(raw);
      if (t.length === 2) {
        const cha = khopTen(anchorCo, t[0]); if (!cha) { kk.push(raw); continue; }
        if (cha.loai === 'nhan_vat') {
          const b = khopTen((cha.bien_the ?? []).filter((x) => LA_LOOK.has(x.nhom)), t[1]); if (!b) { kk.push(raw); continue; }
          anchor.add(cha.id); look.set(cha.id, [...(look.get(cha.id) ?? []), b.id]);
        } else if (cha.loai === 'boi_canh') anchor.add(cha.id);   // "Bối cảnh · cấu kiện": chỉ ghi nhận, cấu kiện đặt theo sơ đồ
        else { const b = khopTen(cha.bien_the ?? [], t[1]); if (b) { anchor.add(cha.id); btKhac.push(b.id); } else kk.push(raw); }
      } else { const a = khopTen(anchorCo, t[0]); if (a) anchor.add(a.id); else kk.push(raw); }
    }
    const nv = [...new Set([...c.nhan_vat, ...anchor])];
    const giu = c.bien_the.filter((bid) => { const b = btTheoId.get(bid); return !(b && LA_LOOK.has(b.nhom) && look.has(b.nhan_vat_id)); });
    const bt = [...new Set([...giu, ...[...look.values()].flat(), ...btKhac])];
    out.push({ id: c.id, nhan_vat: nv, bien_the: bt, dung: s.dung ?? [], khong_khop: kk, doi: !cungTap(nv, c.nhan_vat) || !cungTap(bt, c.bien_the) });
  }
  return out;
}

/** Lượt phân rã đã lưu của một tập (xv_tap.phan_ra). */
export type PhanRaTapLuu = { phien: number; luc: string; bam: string; model?: string; vnd?: number; moi?: number; shot_doi?: number; ghi_chu?: string[]; khong_khop?: string[] };
export type TrangThaiPhanRa = 'trong' | 'chua' | 'cu' | 'xong';
export type TapBaoCao = { id: number; so: number; ten: string; trang_thai: TrangThaiPhanRa; luc: string | null; so_shot: number; can: number; thieu: number; ghi_chu: string[]; khong_khop: string[]; /** độ dài chữ đầu vào (ước token / tiền lượt phân rã) */ ky_tu: number };
export type MonThieu = { loai: 'anchor' | 'bien_the'; id: number; ten: string; cua: string | null; nhom: string | null; ly_do: string; tap: number[]; so_shot: number };
export type BaoCaoChuanBi = { tong: { tap: number; tap_chua: number; tap_cu: number; can: number; du: number; thieu: number }; tap: TapBaoCao[]; thieu: MonThieu[] };

/** BÁO CÁO CHUẨN BỊ (thuần): mỗi tập — trạng thái phân rã (chưa / cũ / xong), số món shot cần, số món thiếu; cả phim — danh sách món THIẾU (chưa tả,
 *  chưa ảnh gốc, chưa ảnh mẫu) kèm tập + số shot dùng. "Cần" = anchor + biến thể gắn ở shot (sau phân rã là đủ thứ kịch bản đòi). */
export function baoCaoChuanBi(o: { tap: (Pick<Tap, 'id' | 'so' | 'ten' | 'kich_ban'> & { phan_ra?: PhanRaTapLuu | null })[]; canh: (CanhVao & { tap_id: number })[]; nhanVat: NhanVat[] }): BaoCaoChuanBi {
  const anchorTheoId = new Map(o.nhanVat.map((v) => [v.id, v]));
  const btTheoId = new Map<number, { b: BienThe; nv: NhanVat }>(); for (const v of o.nhanVat) for (const b of v.bien_the ?? []) btTheoId.set(b.id, { b, nv: v });
  const thieu = new Map<string, MonThieu & { tapSet: Set<number> }>();
  const canAll = new Set<string>(); const thieuAll = new Set<string>();
  const tap: TapBaoCao[] = [...o.tap].sort((a, b) => a.so - b.so).map((t) => {
    const cs = o.canh.filter((c) => c.tap_id === t.id);
    const pr = t.phan_ra ?? null;
    const trang_thai: TrangThaiPhanRa = !cs.length ? 'trong' : !pr ? 'chua' : pr.phien !== PHIEN_PHAN_RA || pr.bam !== bamPhanRa(t, cs) ? 'cu' : 'xong';
    const can = new Set<string>(); const thieuTap = new Set<string>();
    const ghi = (k: string, m: Omit<MonThieu, 'tap' | 'so_shot'>) => { thieuTap.add(k); thieuAll.add(k); const x = thieu.get(k) ?? { ...m, tap: [], so_shot: 0, tapSet: new Set<number>() }; x.tapSet.add(t.so); x.so_shot++; thieu.set(k, x); };
    for (const c of cs) {
      for (const id of c.nhan_vat) {
        const a = anchorTheoId.get(id); if (!a) continue; const k = `a:${id}`; can.add(k); canAll.add(k);
        const lo = thieuAnchor(a); if (lo.length) ghi(k, { loai: 'anchor', id, ten: a.ten, cua: null, nhom: a.loai, ly_do: lo.join(', ') });
      }
      for (const id of c.bien_the) {
        const x = btTheoId.get(id); if (!x) continue; const k = `b:${id}`; can.add(k); canAll.add(k);
        if (!x.b.anh_url) ghi(k, { loai: 'bien_the', id, ten: x.b.ten, cua: x.nv.ten, nhom: x.b.nhom, ly_do: 'chưa có ảnh mẫu' });
      }
    }
    const ky_tu = (t.kich_ban ?? '').length + cs.reduce((s, c) => s + (c.hanh_dong?.length ?? 0) + (c.prompt_anh?.length ?? 0) + chuThoai(c).length + (c.canh?.length ?? 0) + 120, 0);
    return { id: t.id, so: t.so, ten: t.ten, trang_thai, luc: pr?.luc ?? null, so_shot: cs.length, can: can.size, thieu: thieuTap.size, ghi_chu: pr?.ghi_chu ?? [], khong_khop: pr?.khong_khop ?? [], ky_tu };
  });
  const ds = [...thieu.values()].map(({ tapSet, ...m }) => ({ ...m, tap: [...tapSet].sort((a, b) => a - b) })).sort((a, b) => b.so_shot - a.so_shot || a.ten.localeCompare(b.ten));
  return { tong: { tap: tap.length, tap_chua: tap.filter((t) => t.trang_thai === 'chua').length, tap_cu: tap.filter((t) => t.trang_thai === 'cu').length, can: canAll.size, du: canAll.size - thieuAll.size, thieu: thieuAll.size }, tap, thieu: ds };
}
