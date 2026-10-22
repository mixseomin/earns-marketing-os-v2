// BỘ KIỂM 3D RIÊNG CHO PHIM AI (anh 17/10/2026: "phim thường chỉ cần đủ và đúng vị trí là tự lên hình; làm AI nó bất ổn nên mọi thứ từ đạo cụ, màu
// sắc… trong bản 3D phải đầy đủ nhất để AI không bị ngáo — cảnh nhắc vật gì thì 3D phải sinh sẵn, đặt sẵn; nhưng cũng phải đề phòng AI tự bịa thêm").
// Phim thường: đạo cụ có mặt ở trường quay là lên hình. Phim AI: thứ gì KHÔNG có trong bản 3D thì model tự vẽ (mỗi góc một kiểu), thứ gì có mà không
// được gọi tên thì model tự đổi. Bộ kiểm này đặt hai chiều đó thành luật CHẶN, đọc dữ liệu shot + set + khung 3D (không gọi AI, 0đ):
//   ĐỦ   — vật được nhắc trong chữ của shot (hành động, bố cục, mở / kết, diễn xuất) phải có khối 3D tương ứng; shot cận phải THẤY nó trong khung.
//   NGƯỜI — người đang nói (chủ thể trong khung) phải thấy mặt · vật đeo / cầm là chủ thể cú cận thì khung phải có cả người đeo · hai người không chồng hình · dáng tựa phải có mặt đỡ.
// MỘT chỗ cho cổng keyframe (sinh-anh.ts › lyChanKeyframe) và bộ chấm tại chỗ (scripts/du-lieu/tong-tai/kiem.mts). Thuần — tự kiểm: kiem-ai-3d.test.mts
import { hopVat } from './duong-may';
import type { BoSet, Canh, May3d, NhanVat } from './kieu';
import { chuThe, huongVoiMay, nguoiNoiTrongKhung } from './bo-set-3d';
import { vatHien } from './kieu';
import { theTrong } from './prompt-khoi';

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
type NvAi = Pick<NhanVat, 'ten' | 'loai' | 'mo_ta'> & { bien_the?: { ten: string; mo_ta: string }[]; khoi_3d?: NhanVat['khoi_3d'] };
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
  // THẤY = chiếm ≥ 1% khung (lưới tia), HOẶC món có chỗ đứng 3D mà tâm nằm trong khung (khung_xam.kiem) — toàn cảnh: ly trong tay Vivian < 1% khung vẫn là thấy (#1)
  const thay = new Set([...(c.khung_xam?.thay ?? []).filter((t) => t.pt >= 1).map((t) => t.ten), ...(c.khung_xam?.kiem ?? []).filter((k) => k.trong_khung).map((k) => k.nhan_vat)]);
  for (const g of vatDuocNhacAi(c)) {
    const co = khoi.filter((k) => coTu(g.tu, k.chu));
    if (!co.length) { out.push(`chữ shot nhắc ${g.ten} mà bản 3D không có khối nào là ${g.ten} — AI sẽ tự vẽ: thêm đạo cụ / đồ set (đặt đúng chỗ), hoặc bỏ chữ nhắc`); continue; }
    // KHOẢNH KHẮC MỞ nhắc vật thì vật PHẢI thấy trong khung 3D ở MỌI cỡ cảnh — keyframe chính là khung mở (tập 122 #3 "Vivian raises the folder", #11 "dangling
    // the lanyard": cú qua vai, máy gần, tập hồ sơ / dây thẻ ngoài khung → keyframe vẽ tay buông). Chữ khác (bố cục, diễn) chỉ bắt ở shot cận.
    const moNhac = coTu(g.tu, c.dan_dung?.mo ?? '');
    if (c.khung_xam?.thay && (moNhac || CAN.has(c.ky_thuat?.co_canh ?? '')) && !co.some((k) => thay.has(k.ten) || nhanVat.some((a) => a.ten === k.ten && a.loai === 'nhan_vat' && thay.has(k.ten))))
      out.push(`${moNhac ? 'khoảnh khắc mở' : 'chữ shot cận'} nhắc ${g.ten} (${co.map((k) => k.ten).join(', ')}) mà khung 3D không thấy — dời máy / khai vào may_3d.khung cho nó lọt khung`);
    // QUÁ NHỎ ĐỂ AI GIỮ: món khoảnh khắc mở nhắc (không phải người) trải < 5% khung ở shot không phải toàn cảnh → AI bỏ qua (#11 dây thẻ trong tay Vivian, cú qua vai)
    else if (moNhac && c.khung_xam?.thay && [...CAN, 'ots'].includes(c.ky_thuat?.co_canh ?? '')) {   // cận + qua vai; trung / toàn cảnh đồ cầm tay nhỏ là bình thường (#19 bút)
      const trai = Math.max(0, ...c.khung_xam.thay.filter((t) => co.some((k) => k.ten === t.ten) && !nhanVat.some((a) => a.ten === t.ten && a.loai === 'nhan_vat')).map((t) => Math.max(t.hop[2]! - t.hop[0]!, t.hop[3]! - t.hop[1]!)));
      if (co.every((k) => !nhanVat.some((a) => a.ten === k.ten && a.loai === 'nhan_vat')) && trai < 0.05)
        out.push(`khoảnh khắc mở nhắc ${g.ten} mà trong khung 3D nó chỉ trải ${Math.round(trai * 100)}% khung — quá nhỏ, AI sẽ bỏ qua: máy gần hơn / ống dài hơn cho món đó rõ`);
    }
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
 *  Chỉ xét hai người CÙNG CỠ trên khung (cùng độ sâu) — người trước to hẳn người sau là bố cục tiền – hậu cảnh, không phải chồng.
 *  Phim thường: diễn viên tự tách ra khi máy chạy; phim AI: 3D chồng là ảnh chồng. Đọc khung_xam.kiem[].khung (dung-set.py › kiem_hinh_hoc). */
export const CHONG_NGUOI = 0.6; export const CUNG_CO = 0.85;
export function chongNguoi(c: ShotAi, nhanVat: Pick<NvAi, 'ten' | 'loai'>[]): string[] {
  const nguoi = new Set(nhanVat.filter((a) => a.loai === 'nhan_vat').map((a) => a.ten));
  const ds = (c.khung_xam?.kiem ?? []).filter((k) => k.bat_buoc && k.trong_khung && nguoi.has(k.nhan_vat) && k.khung?.length === 4);
  const out: string[] = [];
  for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) {
    const [a, b] = [ds[i]!.khung!, ds[j]!.khung!];
    const ngang = Math.min(a[2]!, b[2]!) - Math.max(a[0]!, b[0]!); const doc = Math.min(a[3]!, b[3]!) - Math.max(a[1]!, b[1]!);
    const hep = Math.min(a[2]! - a[0]!, b[2]! - b[0]!); const thap = Math.min(a[3]! - a[1]!, b[3]! - b[1]!);
    // cỡ gần bằng nhau = cùng độ sâu; người trước to hẳn người sau (qua vai, tiền – hậu cảnh: #6 28% / 21%, #13 81% / 60%) là bố cục chiều sâu AI vẽ được
    const co = Math.min(ds[i]!.cao_khung_pt, ds[j]!.cao_khung_pt) / Math.max(ds[i]!.cao_khung_pt, ds[j]!.cao_khung_pt, 0.1);
    if (hep > 0 && thap > 0 && ngang / hep >= CHONG_NGUOI && doc / thap >= 0.5 && co >= CUNG_CO)
      out.push(`${ds[i]!.nhan_vat} và ${ds[j]!.nhan_vat} chồng hình trên khung (trùng ${Math.round((ngang / hep) * 100)}% bề ngang) — AI sẽ vẽ thành một người: tách hai người ra hai bên trục máy, hoặc đổi góc máy`);
  }
  return out;
}

/** DÁNG TỰA KHÔNG CÓ MẶT ĐỠ: người đang chống tay / tựa (dung-set.py › DANG_TUA) mà điểm chạm lơ lửng ở khung mở — AI tự bịa chỗ tựa (tập 122 #20:
 *  "chống bàn" ở chỗ không có bàn → keyframe chống lên lưng ghế; #22 cận cổ tay thành bàn tay giữa không trung). Đọc khung_xam.kiem[].tua_hong. */
export function tuaHong(c: ShotAi): string[] {
  return (c.khung_xam?.kiem ?? []).filter((k) => k.tua_hong && k.trong_khung)
    .map((k) => `${k.nhan_vat} đang chống / tựa mà tay cách mặt đỡ ${k.tua_hong} cm ở khung mở — AI sẽ tự bịa chỗ tựa: dời người tới sát mặt bàn / mặt tựa, hoặc đổi dáng`);
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

/** THẺ LIÊN KẾT SAI (prompt-khoi.ts › THE): {Tên} không trỏ tới nhân vật / đạo cụ / đồ set nào (gõ sai, vật đã đổi tên) · đạo cụ được thẻ nhắc mà shot không đặt
 *  trong 3D · đồ set tuỳ chọn được nhắc mà shot không bật (them). Nhân vật được nhắc khi ngoài khung ("looks at {Lục Thần}") là đúng — không bắt. */
export function theSai(c: ShotAi, nhanVat: NvAi[], set: Pick<BoSet, 'du_lieu'> | null): string[] {
  const dd = c.dan_dung ?? {}; const chu = [dd.bo_cuc, dd.mo, dd.ket, dd.huong, dd.dien, c.prompt_anh, (c as { prompt_video?: string }).prompt_video].filter(Boolean).join('\n');
  const vat = set?.du_lieu.vat ?? []; const hien = new Set(vatHien(vat, c.may_3d?.them).map((v) => v.ten.toLowerCase()));
  const out: string[] = [];
  for (const t of [...new Set(theTrong(chu))]) {
    const k = t.toLowerCase(); const a = nhanVat.find((x) => x.ten.toLowerCase() === k); const v = vat.find((x) => x.ten.toLowerCase() === k);
    if (!a && !v) { out.push(`thẻ {${t}} không trỏ tới nhân vật / đạo cụ / đồ set nào — sửa đúng tên`); continue; }
    // ĐỒ CỐ ĐỊNH CỦA SET có đối tượng cùng tên (đối tượng xuyên suốt — bo-set-3d.ts › doiTuongThieu: cửa thang máy, logo, bàn): chỗ đứng do bộ set đặt, không
    // đòi may_3d.vi_tri như đạo cụ cầm tay (#132 #15: "Thang máy 1" vừa là vật set vừa là đối tượng → từng bị chặn "không đặt trong 3D").
    if (a && !v && a.loai !== 'nhan_vat' && a.loai !== 'boi_canh' && !c.may_3d?.vi_tri.some((x) => x.ten.toLowerCase() === k)) out.push(`thẻ {${t}} nhắc đạo cụ mà shot không đặt nó trong 3D (may_3d.vi_tri) — thêm chỗ đứng hoặc bỏ thẻ`);
    if (v && !hien.has(k)) out.push(`thẻ {${t}} nhắc đồ set mà shot không bật (đồ tuỳ chọn / bị thay) — khai may_3d.them`);
  }
  return out;
}

/** NGƯỜI / VẬT ĐI XUYÊN ĐỒ RẮN (anh 22/10/2026, phim #132 #19 "bước vào thang máy đéo ngửi được"): bộ set chỉ có tấm cửa thép đóng, Hạ được cho đi từ sảnh
 *  vào y=520 → khung 3D kết cho thấy người và thùng xuyên qua cửa, mô hình video phải bịa cảnh bước vào và làm thùng biến mất. Đường đi tam → den (và chỗ
 *  đứng mở) không được cắt hộp bao của đồ set rắn (hopVat đã bỏ mặt nền, đồ tuỳ chọn không bật) ở tầm thân người (30–150 cm). Thuần — kiểm ở kiem-ai-3d.test. */
export function xuyenVat(c: ShotAi, set: Pick<BoSet, 'du_lieu'> | null): string[] {
  if (!set || !c.may_3d) return [];
  const hop = hopVat(set.du_lieu.vat, c.may_3d.them ?? []).filter((h) => h.max[2] > 30 && h.min[2] < 150);
  const out: string[] = [];
  for (const v of c.may_3d.vi_tri) {
    if (v.cam || v.an) continue;
    const a = v.tam, b = v.den ?? v.tam;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const x = a[0]! + (b[0]! - a[0]!) * t, y = a[1]! + (b[1]! - a[1]!) * t;
      const h = hop.find((k) => x > k.min[0] && x < k.max[0] && y > k.min[1] && y < k.max[1]);
      if (h) { out.push(`${v.ten} ${v.den ? `đi từ [${a.slice(0, 2)}] tới [${b.slice(0, 2)}] xuyên qua` : `đứng trong`} đồ set "${h.ten}" — set thiếu trạng thái / khoảng trống thật (cửa mở, buồng thang, lối đi): thêm đồ tuỳ chọn thay_cho hoặc dời chỗ`); break; }
    }
  }
  return out;
}
/** MÓN ĐỔI TAY / ĐỔI CHỖ TRONG SHOT quá nhỏ (phim #132 #15: giật thẻ 9 cm ở toàn cảnh cách 5,8 m → thẻ ~1% khung; Veo kéo Hạ lại gần máy để vẽ cú giật →
 *  hai Hạ, thẻ vẫn trên cổ). Đạo cụ có `den` (đổi chỗ / sang tay) phải trải ≥ 2,5% cạnh dài khung ở CẢ chỗ mở lẫn chỗ kết, tính bằng hình học
 *  (cỡ lớn nhất của khối × tiêu cự ÷ khoảng cách tới máy ÷ cạnh dài cảm biến 36 mm) — bản đo khung bỏ qua đồ đeo trên người, hình học thì không. */
export const PT_MON_DOI = 0.025;
export function monDoiTayNho(c: ShotAi, nhanVat: NvAi[]): string[] {
  const m = c.may_3d; if (!m?.dat) return [];
  const out: string[] = [];
  for (const v of m.vi_tri) {
    if (!v.den || v.an) continue;
    const a = nhanVat.find((x) => x.ten === v.ten); if (!a || a.loai === 'nhan_vat' || !a.khoi_3d?.co) continue;
    const co = Math.max(a.khoi_3d.co[0] ?? 0, a.khoi_3d.co[2] ?? 0); if (!co) continue;
    const kc = (p: number[]) => Math.hypot((p[0] ?? 0) - m.dat[0]!, (p[1] ?? 0) - m.dat[1]!, (p[2] ?? 0) - (m.dat[2] ?? 0)) || 1;
    const trai = Math.min(...[v.tam, v.den].map((p) => (co * m.ong_kinh) / kc(p) / 36));
    if (trai < PT_MON_DOI) out.push(`${v.ten} đổi chỗ / sang tay trong shot mà chỉ trải ~${Math.round(trai * 1000) / 10}% khung (cỡ ${co} cm, ống ${m.ong_kinh} mm, cách máy ${Math.round(Math.max(kc(v.tam), kc(v.den)))} cm) — AI không giữ được món nhỏ thế khi nó di chuyển: máy gần hơn, ống dài hơn, hoặc tách cú đổi tay thành shot riêng`);
  }
  return out;
}
/** CHỮ BỐ CỤC GỌI TÊN NHÂN VẬT mà khung 3D không có người đó: bố cục là thứ khung PHẢI cho thấy ("over Vivian's shoulder") — 3D không có Vivian thì
 *  AI tự bịa một Vivian (#12: áo be thay đầm đỏ đô). Hướng nhìn ở khoảnh khắc mở / diễn ("looks at Vivian") là đúng — chỉ xét bố cục. */
export function boCucNguoiNgoai(c: ShotAi, nhanVat: NvAi[]): string[] {
  const bo = c.dan_dung?.bo_cuc ?? ''; const kiem = c.khung_xam?.kiem; if (!bo || !kiem) return [];
  const thay = new Set(kiem.filter((k) => k.trong_khung).map((k) => k.nhan_vat));
  const goi = (t: string) => { const e = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return new RegExp(`(?<!\\b(?:at|toward|towards|from|to|after|on)\\s+(?:\\p{L}+\\s+)?)(?<!\\p{L})${e}(?!\\p{L})`, 'iu'); };   // "from Thần's side" (chỗ máy), "looking at Hạ" (hướng nhìn): không phải người trong khung
  return nhanVat.filter((a) => a.loai === 'nhan_vat' && !thay.has(a.ten) && [a.ten, a.ten.trim().split(/\s+/).pop() ?? ''].some((t) => t.length >= 2 && goi(t).test(bo)) && !/off[- ]?screen|ngoài khung/i.test(bo))
    .map((a) => `bố cục gọi tên ${a.ten} mà khung 3D không có ${a.ten} — AI sẽ tự vẽ một ${a.ten} (đồ, dáng tuỳ ý): dời máy cho thấy, hoặc bỏ tên khỏi bố cục`);
}

/** ĐỒ LẬT / RƠI mà 3D để đứng thẳng: khoảnh khắc mở tả đồ đang lật, đổ, rơi, nghiêng (tumbling, tipping, spilling…) mà không món nào trong 3D khai nghieng
 *  → bản đồ độ sâu là cái ly đứng thẳng, AI vẽ ly đứng (#17 "cup tumbling… coffee spilling"). */
const LAT = /\b(tumbl\w*|tipping|tips over|topples?|upside[- ]down|spill\w*|falling|falls|tilt\w*|knocked over|overturned)\b/i;
export function datLat(c: ShotAi): string[] {
  const mo = c.dan_dung?.mo ?? ''; if (!LAT.test(mo) || !c.may_3d) return [];
  return c.may_3d.vi_tri.some((v) => v.nghieng || v.nghieng_den) ? [] : [`khoảnh khắc mở tả đồ "${mo.match(LAT)![0]}" mà 3D không món nào nghiêng (vi_tri.nghieng) — AI sẽ vẽ đồ đứng thẳng: khai góc nghiêng cho món đó`];
}

/** VÙNG TRỐNG: khung 3D có > 8% không thuộc vật nào (máy trên trần, nhìn ra ngoài bộ set) — chỗ trống thì AI TỰ VẼ một thứ (tập 122 #14: máy cao 485 cm
 *  trên trần 300, nền lộ ảnh HDRI → keyframe mọc thêm một căn phòng có bàn, laptop). Đọc tổng % khung của khung_xam.thay. */
export const TRONG_TOI_DA = 8;
export function vungTrong(c: ShotAi): string[] {
  const t = c.khung_xam?.thay; if (!t?.length) return [];
  const trong = 100 - t.reduce((a, x) => a + x.pt, 0);
  return trong > TRONG_TOI_DA ? [`khung 3D trống ${Math.round(trong)}% (không vật nào — máy trên trần / nhìn ra ngoài bộ set) — AI sẽ tự vẽ thứ không có: hạ máy dưới trần, đổi hướng, hoặc dựng thêm phần set`] : [];
}

/** Mọi luật của bộ kiểm AI cho một shot (rỗng = qua). Phần "thấy trong khung" chỉ chạy khi đã có khung 3D (khung_xam.thay). */
export function loiAi3d(c: ShotAi, nhanVat: NvAi[], set: Pick<BoSet, 'du_lieu'> | null): string[] {
  return [...thieuVat3d(c, nhanVat, set), ...xuyenVat(c, set), ...monDoiTayNho(c, nhanVat), ...matNguoiNoi(c), ...vatDeoThieuNguoi(c), ...doNhanDangChuaAnh(c, set), ...chongNguoi(c, nhanVat), ...tuaHong(c), ...vungTrong(c), ...datLat(c), ...theSai(c, nhanVat, set), ...boCucNguoiNgoai(c, nhanVat)];
}
