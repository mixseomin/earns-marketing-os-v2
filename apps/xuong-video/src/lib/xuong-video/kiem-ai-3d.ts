// BỘ KIỂM 3D RIÊNG CHO PHIM AI (anh 17/10/2026: "phim thường chỉ cần đủ và đúng vị trí là tự lên hình; làm AI nó bất ổn nên mọi thứ từ đạo cụ, màu
// sắc… trong bản 3D phải đầy đủ nhất để AI không bị ngáo — cảnh nhắc vật gì thì 3D phải sinh sẵn, đặt sẵn; nhưng cũng phải đề phòng AI tự bịa thêm").
// Phim thường: đạo cụ có mặt ở trường quay là lên hình. Phim AI: thứ gì KHÔNG có trong bản 3D thì model tự vẽ (mỗi góc một kiểu), thứ gì có mà không
// được gọi tên thì model tự đổi. Bộ kiểm này đặt hai chiều đó thành luật CHẶN, đọc dữ liệu shot + set + khung 3D (không gọi AI, 0đ):
//   ĐỦ   — vật được nhắc trong chữ của shot (hành động, bố cục, mở / kết, diễn xuất) phải có khối 3D tương ứng; shot cận phải THẤY nó trong khung.
//   NGƯỜI — người đang nói (chủ thể trong khung) phải thấy mặt · vật đeo / cầm là chủ thể cú cận thì khung phải có cả người đeo · hai người không chồng hình.
// MỘT chỗ cho cổng keyframe (sinh-anh.ts › lyChanKeyframe) và bộ chấm tại chỗ (scripts/du-lieu/tong-tai/kiem.mts). Thuần — tự kiểm: kiem-ai-3d.test.mts
import type { BoSet, Canh, May3d, NhanVat } from './kieu';
import { chuThe, huongVoiMay, nguoiNoiTrongKhung } from './bo-set-3d';
import { vatHien } from './kieu';

/** DANH MỤC VẬT: nhóm từ (Việt + Anh) chỉ cùng một loại đồ. KHÔNG dùng từ hai nghĩa (plant = đặt mình, watch = nhìn, key = then chốt, screen-left,
 *  cặp = đôi, tách = chia) — báo nhầm làm luật mất tin. Chữ của shot nhắc một từ → bản 3D phải có khối mà tên / mô tả chứa một từ cùng nhóm.
 *  Chỉ đồ cầm / đặt / treo (không quần áo — "no tie" không phải đồ). Thêm loại đồ mới: thêm một dòng. */
export const TU_VAT: { ma: string; ten: string; tu: string[] }[] = [
  { ma: 'but', ten: 'bút', tu: ['bút', 'pen', 'pens'] },
  { ma: 'coc', ten: 'ly / cốc', tu: ['ly', 'cốc', 'cup', 'cups', 'mug', 'mugs', 'water glass', 'water glasses'] },
  { ma: 'so', ten: 'sổ', tu: ['sổ', 'sổ tay', 'notebook', 'notebooks', 'notepad', 'notepads'] },
  { ma: 'dien_thoai', ten: 'điện thoại', tu: ['điện thoại', 'phone', 'phones', 'smartphone'] },
  { ma: 'laptop', ten: 'laptop', tu: ['laptop', 'laptops', 'máy tính xách tay'] },
  { ma: 'giay', ten: 'giấy / tài liệu', tu: ['giấy', 'xấp giấy', 'tờ giấy', 'tài liệu', 'paper', 'papers', 'document', 'documents', 'sheet of paper', 'sheets'] },
  { ma: 'ho_so', ten: 'hồ sơ / bìa', tu: ['hồ sơ', 'bìa hồ sơ', 'folder', 'folders'] },
  { ma: 'thung', ten: 'thùng / hộp', tu: ['thùng', 'hộp', 'box', 'boxes'] },
  { ma: 'the', ten: 'thẻ', tu: ['thẻ', 'badge', 'lanyard', 'id card'] },
  { ma: 'tui', ten: 'túi / cặp', tu: ['túi', 'cặp da', 'cặp tài liệu', 'bag', 'handbag', 'briefcase'] },
  { ma: 'chia_khoa', ten: 'chìa khoá', tu: ['chìa khoá', 'chìa khóa', 'keys', 'car key', 'door key'] },
  { ma: 'hoa', ten: 'hoa', tu: ['hoa', 'bình hoa', 'flower', 'flowers', 'orchid', 'orchids', 'vase'] },
  { ma: 'chai', ten: 'chai', tu: ['chai', 'bottle', 'bottles'] },
  { ma: 'dong_ho', ten: 'đồng hồ', tu: ['đồng hồ', 'wristwatch', 'clock'] },
  { ma: 'vong', ten: 'vòng / chuỗi hạt', tu: ['vòng tay', 'chuỗi hạt', 'bracelet', 'bangle', 'beads'] },
  { ma: 'tranh', ten: 'tranh / khung ảnh', tu: ['tranh', 'khung ảnh', 'painting', 'paintings', 'picture frame', 'framed photo', 'artwork'] },
  { ma: 'man_hinh', ten: 'màn hình', tu: ['màn hình', 'màn chiếu', 'monitor', 'monitors', 'tv', 'projection screen', 'presentation screen'] },
  { ma: 'cay', ten: 'cây cảnh', tu: ['cây cảnh', 'chậu cây', 'potted plant', 'houseplant', 'indoor tree'] },
];
const re = (t: string) => new RegExp(`(^|[^\\p{L}])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'iu');
const coTu = (tu: string[], chu: string) => tu.some((t) => re(t).test(chu));

type ShotAi = Pick<Canh, 'hanh_dong' | 'prompt_anh'> & Partial<Pick<Canh, 'hanh_dong_vi' | 'dan_dung' | 'ky_thuat' | 'thoai' | 'khung_xam'>> & { may_3d?: May3d | null };
type NvAi = Pick<NhanVat, 'ten' | 'loai' | 'mo_ta'> & { bien_the?: { ten: string; mo_ta: string }[] };
/** Chữ của shot mà model đọc / người viết dùng để tả khung — nơi một vật "được nhắc". */
export const chuShot = (c: ShotAi) => [c.hanh_dong, c.hanh_dong_vi, c.prompt_anh, c.dan_dung?.bo_cuc, c.dan_dung?.mo, c.dan_dung?.ket, c.dan_dung?.dien].filter(Boolean).join(' \n ');
/** Nhóm vật mà chữ của shot nhắc tới. */
export const vatDuocNhacAi = (c: ShotAi) => { const chu = chuShot(c); return TU_VAT.filter((g) => coTu(g.tu, chu)); };

/** Các khối 3D của shot kèm chữ nhận dạng: đồ set (tên + en + anchor), món ở chỗ đứng (tên + mô tả anchor), người (đồ đeo + mô tả biến thể đang mặc). */
function khoi3d(c: ShotAi, nhanVat: NvAi[], set: Pick<BoSet, 'du_lieu'> | null): { ten: string; chu: string }[] {
  const out = vatHien(set?.du_lieu.vat ?? [], c.may_3d?.them).map((v) => ({ ten: v.ten, chu: [v.ten, v.en ?? '', v.anchor ?? ''].join(' ') }));
  for (const v of c.may_3d?.vi_tri ?? []) {
    const a = nhanVat.find((x) => x.ten.trim().toLowerCase() === v.ten.trim().toLowerCase());
    const mac = (a?.bien_the ?? []).filter((b) => [v.trang_phuc, v.trang_phuc_den, v.trang, v.trang_den].some((t) => t && t.trim().toLowerCase() === b.ten.trim().toLowerCase())).map((b) => b.mo_ta);
    out.push({ ten: v.ten, chu: [v.ten, a?.loai === 'nhan_vat' ? '' : a?.mo_ta ?? '', v.do_deo ?? '', v.do_deo_den ?? '', ...mac].join(' ') });
  }
  return out;
}

const CAN = new Set(['cu', 'ecu', 'insert', 'mcu']);
/** ĐỦ: chữ của shot nhắc vật mà bản 3D không có khối nào là vật đó → model sẽ tự vẽ (mỗi góc một kiểu). Có rồi mà shot CẬN không thấy trong khung
 *  (khung_xam.thay) → keyframe vẽ theo chữ, lệch 3D. Trả câu chặn. */
export function thieuVat3d(c: ShotAi, nhanVat: NvAi[], set: Pick<BoSet, 'du_lieu'> | null): string[] {
  const out: string[] = []; const khoi = khoi3d(c, nhanVat, set);
  const thay = new Set((c.khung_xam?.thay ?? []).filter((t) => t.pt >= 1).map((t) => t.ten));
  for (const g of vatDuocNhacAi(c)) {
    const co = khoi.filter((k) => coTu(g.tu, k.chu));
    if (!co.length) { out.push(`chữ shot nhắc ${g.ten} mà bản 3D không có khối nào là ${g.ten} — AI sẽ tự vẽ: thêm đạo cụ / đồ set (đặt đúng chỗ), hoặc bỏ chữ nhắc`); continue; }
    if (c.khung_xam?.thay && CAN.has(c.ky_thuat?.co_canh ?? '') && !co.some((k) => thay.has(k.ten) || nhanVat.some((a) => a.ten === k.ten && a.loai === 'nhan_vat' && thay.has(k.ten))))
      out.push(`chữ shot cận nhắc ${g.ten} (${co.map((k) => k.ten).join(', ')}) mà khung 3D không thấy — dời máy / khai vào may_3d.khung cho nó lọt khung`);
  }
  return out;
}

/** NGƯỜI NÓI phải thấy mặt: người có thoại trong shot mà là CHỦ THỂ trong khung (không phải giọng ngoài khung) — máy thấy gáy thì keyframe vẽ lưng,
 *  khớp môi không có miệng để khớp (tập 122 #18: Hạ tuyên bố rút vốn mà máy sau lưng). Ngưỡng như luật mặt shot phản ứng: thấy ít nhất 3/4 mặt. */
export function matNguoiNoi(c: ShotAi): string[] {
  // Shot CHỦ QUAN (mắt nhân vật A nhìn B đang nói) vẫn phải thấy mặt B — A không ở trong khung, B mới là chủ thể (tập 122 #7: POV Thần, Vivian quay lưng).
  const m = c.may_3d; if (!m) return [];
  return nguoiNoiTrongKhung(c).flatMap((t) => {
    const v = m.vi_tri.find((x) => x.ten === t && !x.an); if (!v) return [];
    // KHUNG MỞ phải thấy mặt: keyframe AI = khung mở; quay mặt về máy giữa shot không cứu được ảnh đầu (tập 122 #18: mở 115°, kết 45° → keyframe vẽ gáy)
    const a = huongVoiMay(m, v);
    const ng = ['ws', 'ews', 'two'].includes(c.ky_thuat?.co_canh ?? '') ? 100 : 80;   // toàn cảnh / hai người đối mặt (50/50): nghiêng mặt vẫn đọc được ai đang nói
    return a && a.lech > ng ? [`${t} đang nói mà khung mở không thấy mặt (lệch ${a.lech}°) — đặt máy phía trước mặt, hoặc cho người quay về máy từ đầu shot`] : [];
  });
}

/** VẬT ĐEO / CẦM là chủ thể cú cận thì khung phải có cả người đeo (bàn tay, cổ tay…) — chỉ có món đồ thì AI không biết nó nằm trên ai, ở đâu
 *  (tập 122 #22: chuỗi hạt trên cổ tay Thần → khối lơ lửng, AI vẽ thành một cận Thần khác). */
export function vatDeoThieuNguoi(c: ShotAi): string[] {
  const m = c.may_3d; if (!m || !CAN.has(c.ky_thuat?.co_canh ?? '')) return [];
  const ct = new Set(chuThe(m));
  return m.vi_tri.filter((v) => ct.has(v.ten) && v.cam && !ct.has(v.cam)).map((v) => `${v.ten} đang trên người ${v.cam} mà khung cận chỉ khai món đồ — khai cả ${v.cam} vào may_3d.khung để thấy chỗ đeo / cầm`);
}

/** HAI NGƯỜI CHỒNG HÌNH: hai chủ thể người đứng gần như thẳng hàng với máy (hộp bao trên màn trùng ≥ 60 % bề ngang người hẹp hơn, và cùng tầm cao) —
 *  ảnh độ sâu chỉ còn MỘT dáng người, AI vẽ một người (tập 122 #15: Trần "theo sau một bước" đứng ngay sau lưng Hạ dọc trục máy → keyframe mất Trần).
 *  Phim thường: diễn viên tự tách ra khi máy chạy; phim AI: 3D chồng là ảnh chồng. Đọc khung_xam.kiem[].khung (dung-set.py › kiem_hinh_hoc). */
export const CHONG_NGUOI = 0.6;
export function chongNguoi(c: ShotAi, nhanVat: Pick<NvAi, 'ten' | 'loai'>[]): string[] {
  const nguoi = new Set(nhanVat.filter((a) => a.loai === 'nhan_vat').map((a) => a.ten));
  const ds = (c.khung_xam?.kiem ?? []).filter((k) => k.bat_buoc && k.trong_khung && nguoi.has(k.nhan_vat) && k.khung?.length === 4);
  const out: string[] = [];
  for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) {
    const [a, b] = [ds[i]!.khung!, ds[j]!.khung!];
    const ngang = Math.min(a[2]!, b[2]!) - Math.max(a[0]!, b[0]!); const doc = Math.min(a[3]!, b[3]!) - Math.max(a[1]!, b[1]!);
    const hep = Math.min(a[2]! - a[0]!, b[2]! - b[0]!); const thap = Math.min(a[3]! - a[1]!, b[3]! - b[1]!);
    if (hep > 0 && thap > 0 && ngang / hep >= CHONG_NGUOI && doc / thap >= 0.5)
      out.push(`${ds[i]!.nhan_vat} và ${ds[j]!.nhan_vat} chồng hình trên khung (trùng ${Math.round((ngang / hep) * 100)}% bề ngang) — AI sẽ vẽ thành một người: tách hai người ra hai bên trục máy, hoặc đổi góc máy`);
  }
  return out;
}

/** ĐỒ NHẬN DẠNG (tranh, thư pháp, ảnh, poster, màn chiếu có nội dung, bảng chỉ dẫn): chỉ có chữ tả thì mỗi góc máy AI vẽ một bức khác (anh 17/10/2026:
 *  "tranh trên tường lúc hình A lúc tranh B"). Phải có ẢNH CHUẨN (vat.anh — scripts/sinh-anh-set.mts) dán lên mặt vật trong 3D. Đã có khung 3D: chỉ xét
 *  đồ LỌT KHUNG; chưa có: mọi đồ nhận dạng của set (chặn sớm, trước khi dựng). Màn hình tắt / logo chữ không tính. */
export const LA_NHAN_DANG = /\b(painting|calligraph\w*|photograph|framed photo|poster|artwork|mural|showing|chart|directory sign|map of)\b/i;   // đọc en (tên Việt 'Máy photo' = máy in, không phải ảnh)
export function doNhanDangChuaAnh(c: ShotAi, set: Pick<BoSet, 'du_lieu'> | null): string[] {
  const thay = c.khung_xam?.thay ? new Set(c.khung_xam.thay.filter((t) => t.pt >= 0.5).map((t) => t.ten)) : null;
  return (set?.du_lieu.vat ?? []).filter((v) => LA_NHAN_DANG.test(v.en ?? '') && !(v as { anh?: string }).anh && (!thay || thay.has(v.ten)))
    .map((v) => `đồ nhận dạng "${v.ten}" chưa có ảnh chuẩn — AI vẽ mỗi góc một bức: chạy scripts/sinh-anh-set.mts (ảnh dán lên mặt vật trong 3D)`);
}

/** Mọi luật của bộ kiểm AI cho một shot (rỗng = qua). Phần "thấy trong khung" chỉ chạy khi đã có khung 3D (khung_xam.thay). */
export function loiAi3d(c: ShotAi, nhanVat: NvAi[], set: Pick<BoSet, 'du_lieu'> | null): string[] {
  return [...thieuVat3d(c, nhanVat, set), ...matNguoiNoi(c), ...vatDeoThieuNguoi(c), ...doNhanDangChuaAnh(c, set), ...chongNguoi(c, nhanVat)];
}
