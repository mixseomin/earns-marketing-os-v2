// BỘ CHẤM PROMPT (anh 17/10/2026: "có vẻ prompt cũng đang chưa được chấm và kiểm soát đầy đủ?", "trên timeline cũng show điểm của prompt"). Cổng 3D
// chỉ kiểm HÌNH; chữ gửi model là kênh thứ hai mà model bám — chữ sai thì ảnh sai dù 3D đúng (tập 122: #15 không nói vest trắng → Hạ vest đen; #22 cận
// cổ tay mà tả hàm, mắt → model vẽ mặt; "bracelet hidden under the cuff" ngược khung 3D; tên khối tiếng Việt lọt vào; chữ hoạt hình trong phim người
// thật; bước 1 dài quá giới hạn FLUX). Chấm theo KHỐI (prompt-khoi.ts): khuôn của đường sinh khai khối bắt buộc → thiếu là lỗi; rồi soi chữ đã ghép.
// Mỗi lỗi có mức PHẠT; điểm = 100 − tổng phạt; lỗi phạt ≥ NGUONG_CHAN thì CHẶN sinh (lyChanKeyframe / cổng video), lỗi nhẹ chỉ trừ điểm.
// Thuần, 0đ. Tự kiểm: kiem-prompt.test.mts
import { coTiengViet } from './kieu';   // MỘT luật nhận tiếng Việt với cổng ngôn ngữ (kieu.ts › shotLechNgonNgu) — không bắt oan 'Café'
import { CHAT_LIEU, ghep, KHUON, MAT, thieuKhoi, type ChatLieu, type DuongSinh, type Khoi } from './prompt-khoi';
export { boDo, boMat, dauBoiCanh, MAT } from './prompt-khoi';

/** Bước 1 FLUX đọc tối đa ~512 token T5: quá ~300 từ thì phần cuối (phong cách, "No text") bị cắt. */
export const TU_TOI_DA_FLUX = 300;
/** Lỗi phạt từ mức này trở lên thì chặn sinh. */
export const NGUONG_CHAN = 20;
const PHAT = { tieng_viet: 30, thieu_khoi: 30, thieu_do: 30, chat_lieu: 40, can_mat: 30, nguoc_3d: 30, nguoc_huong: 30, dai: 20, lap: 10, ngoai_khung: 10, the_tho: 40, noi_chon: 10, liet_ke_cam: 30 } as const;
export type MaLoiPrompt = keyof typeof PHAT;
/** ĐỒ CỦA MỘT NƠI trong câu PHONG CÁCH PHIM (anh 22/10/2026, phim #132: phong cách "daylight from floor-to-ceiling windows" đi vào mọi shot, kể cả sảnh
 *  thang máy đá đen không có cửa sổ → nền sau lưng người đổi giữa các shot). Phong cách chỉ nói chất ảnh / ống kính / tông; đồ đạc là của bối cảnh.
 *  Trả các từ có trong phong cách mà mô tả bối cảnh của shot không có. Thuần — kiểm ở kiem-prompt.test. */
const DO_NOI_CHON = /\b(windows?|skyline|desks?|monitors?|elevators?|lobby|corridors?|street|beach|forest|kitchen|bedroom|office|boardroom|staircase|curtains?)\b/gi;
export const noiChonPhongCach = (phongCach: string, boiCanh: string): string[] =>
  [...new Set((phongCach.match(DO_NOI_CHON) ?? []).map((x) => x.toLowerCase().replace(/s$/, '')))].filter((w) => !new RegExp(`\\b${w}`, 'i').test(boiCanh));
const AN = /\b(hidden|covered|covering|concealed|out of sight|not visible|tucked under)\b/i;
const TU_CHUNG = new Set(['small', 'thin', 'black', 'white', 'light', 'large', 'under', 'with', 'their', 'which', 'little', 'round', 'dark', 'long', 'short']);

/** Một bước sẽ gửi: theo khối (khoi + duong — chấm được khối thiếu) hoặc chuỗi đã ghép (chu). */
export type BuocPrompt = { ten: string; chu?: string; khoi?: Khoi[]; duong?: DuongSinh; flux?: boolean };
export type SoatPrompt = {
  co_canh?: string;
  /** người trong khung + bộ đồ sổ trang phục (mô tả biến thể) — mọi bước phải nói bộ đồ */ nguoi: { ten: string; trang_phuc?: string }[];
  /** đồ CHỦ THỂ đang thấy trong khung 3D — chữ không được nói nó bị che / giấu */ vat: { ten: string; mo_ta: string }[];
  /** chất liệu phim: chữ cấm của chất liệu (CHAT_LIEU.cam) */ chat_lieu?: ChatLieu;
  /** tên riêng được phép giữ dấu (nhân vật, đạo cụ có tên) */ ten_rieng?: string[];
  /** nhân vật NGOÀI KHUNG cả shot (3D không thấy, không đi vào) — chữ diễn cho họ làm gì thì model vẽ họ vào */ ngoai?: string[];
  /** chuyển động trên màn đo từ khung 3D (khung_xam.di: dx > 0 = sang phải màn) — chữ "walks screen-left" ngược số này là lỗi */ di?: { ten: string; dx: number }[];
};
export type LoiPrompt = { buoc: string; ma: MaLoiPrompt; phat: number; chu: string };

const doan = (chu: string, re: RegExp) => { const m = chu.match(new RegExp(`[^.;|]{0,40}${re.source}[^.;|]{0,30}`, 'gi')) ?? []; return m.slice(0, 2).map((x) => `"…${x.trim()}…"`).join(', '); };
const VIET = /[^\s,.:;|]*[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ][^\s,.:;|]*/;

/** Chấm bộ prompt một shot: điểm 0..100 + từng lỗi (có mức phạt). */
export function chamPrompt(buoc: BuocPrompt[], s: SoatPrompt): { diem: number; loi: LoiPrompt[] } {
  const loi: LoiPrompt[] = []; const them = (b: string, ma: MaLoiPrompt, chu: string) => loi.push({ buoc: b, ma, phat: PHAT[ma], chu: `${b}: ${chu}` });
  // tên đủ + tên gọi tắt (chữ cuối: 'Lâm Hạ' → 'Hạ') — câu mở shot gọi nhân vật bằng tên tắt
  const du = [...(s.ten_rieng ?? []), ...s.nguoi.map((n) => n.ten), ...s.vat.map((v) => v.ten)].filter(Boolean);
  const rieng = [...new Set([...du, ...du.map((t) => t.trim().split(/\s+/).pop() ?? '')])].filter(Boolean).sort((a, b) => b.length - a.length);
  const cam = s.chat_lieu ? CHAT_LIEU[s.chat_lieu].cam : null;
  for (const b of buoc) {
    const chu = b.chu ?? ghep(b.khoi ?? []);
    // khối THOẠI cố ý đúng ngôn ngữ phim (Veo khớp môi câu tiếng Việt) — không soi tiếng Việt; khối BỐ TRÍ / KHUNG liệt kê từng món theo vị trí, nhiều món
    // cùng loại (ghế, món bị mép cắt) là thật — không soi lặp
    const chuViet = b.khoi ? ghep(b.khoi.filter((k) => k.ma !== 'thoai')) : chu;
    const chuLap = b.khoi ? ghep(b.khoi.filter((k) => k.ma !== 'bo_tri' && k.ma !== 'khung')) : chu;
    const flux = b.flux ?? (b.duong ? !!KHUON[b.duong].flux : false);
    if (b.khoi && b.duong) for (const m of thieuKhoi(b.duong, b.khoi, s.nguoi.length > 0)) them(b.ten, 'thieu_khoi', `thiếu khối "${m}" mà khuôn ${KHUON[b.duong].ten} bắt buộc — model tự đoán phần đó`);
    // KHỐI KHÔNG THÊM phải là DANH SÁCH TRẮNG (prompt-khoi.ts › KHONG_THEM_ANH): liệt kê thứ cấm ("no phone, smoke, cups…", "nobody films") = vá từng ca,
    // không bao giờ đủ, lại gợi ý cho model vẽ đúng thứ bị nêu tên
    { const kt = (b.khoi ?? []).filter((k) => k.ma === 'khong_them').map((k) => k.chu).join(' ');
      const lk = kt.match(/\b(no|without|nobody)\b[^.;]*?,[^.;]*?,[^.;]*/i); if (lk) them(b.ten, 'liet_ke_cam', `khối không thêm đang LIỆT KÊ thứ cấm "${lk[0].slice(0, 80)}…" — viết danh sách trắng: chỉ cái được nêu mới có / mới đổi, còn lại giữ nguyên`); }
    // bỏ tên riêng trước khi soi dấu: tên khai (cả tên tắt) + chữ VIẾT HOA đầu (tên nhân vật ngoài khung được nhắc); chữ thường có dấu mới là tiếng Việt lọt vào
    const tron = rieng.reduce((c, t) => c.split(t).join(' '), chuViet).replace(/(^|[^\p{L}])\p{Lu}[\p{L}]*/gu, '$1');
    if (coTiengViet(tron)) them(b.ten, 'tieng_viet', `lẫn tiếng Việt ${doan(tron, VIET)} — model đọc tiếng Anh: dùng mô tả en (biến thể, vật), không dùng tên / ghi chú tiếng Việt`);
    { const tho = chu.match(/\{[^{}\n]+\}/); if (tho) them(b.ten, 'the_tho', `thẻ ${tho[0]} chưa được thay — tên không trỏ tới vật nào (prompt-khoi.ts › goiThe)`); }
    if (cam?.test(chu)) them(b.ten, 'chat_lieu', `chữ sai chất liệu phim ${doan(chu, cam)} — dùng CHAT_LIEU (prompt-khoi.ts) thay vì chữ ghi cứng`);
    const tu = chu.split(/\s+/).filter(Boolean).length;
    if (flux && tu > TU_TOI_DA_FLUX) them(b.ten, 'dai', `dài ${tu} từ — FLUX đọc ~${TU_TOI_DA_FLUX} từ, phần cuối bị cắt: rút gọn hậu cảnh, bỏ lặp`);
    for (const n of s.nguoi) {
      if (!n.trang_phuc) continue;
      if (!chu.toLowerCase().includes(n.trang_phuc.slice(0, 40).toLowerCase())) them(b.ten, 'thieu_do', `không nói bộ đồ của ${n.ten} ("${n.trang_phuc.slice(0, 50)}…") — model tự chọn đồ (tập 122 #15: vest đen thay vest trắng)`);
    }
    if (s.co_canh === 'insert' && s.nguoi.length && MAT.test(chu)) them(b.ten, 'can_mat', `cận chèn mà tả mặt / tóc ${doan(chu, MAT)} — model sẽ vẽ mặt vào cú cận đồ (tập 122 #22): chỉ tả phần thân trong khung`);
    for (const v of s.vat) {
      const tuVat = v.mo_ta.toLowerCase().match(/[a-z-]{5,}/g)?.filter((w) => !TU_CHUNG.has(w)) ?? [];
      const cau = chu.split(/[.;|]/).find((c) => AN.test(c) && tuVat.some((w) => c.toLowerCase().includes(w)));
      if (cau) them(b.ten, 'nguoc_3d', `chữ nói ${v.ten} bị che / giấu ("${cau.trim().slice(0, 90)}") mà khung 3D cho thấy nó — sửa chữ (sổ người / mở shot) cho khớp 3D`);
    }
    // HƯỚNG ĐI NGƯỢC 3D: chữ "Hạ walks screen-right" mà khung 3D đo Hạ đi sang trái màn (tập 122 #15 sau khi đổi máy) — video đi lung tung
    for (const d of s.di ?? []) {
      if (Math.abs(d.dx) < 0.08) continue;
      const tat = d.ten.trim().split(/\s+/).pop() ?? d.ten; const doi = d.dx > 0 ? 'left' : 'right';
      const ten_ = tat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');   // ranh giới theo chữ Unicode — \\b của JS không hiểu 'Hạ'
      const m = chu.match(new RegExp(`(?<!\\p{L})${ten_}(?!\\p{L})[^.;|]{0,40}?\\b(walks|moves|runs|strides|steps|heads|crosses|goes|rushes|drifts)\\b[^.;|]{0,30}?screen-${doi}`, 'iu'));
      if (m) them(b.ten, 'nguoc_huong', `chữ nói "${m[0].trim()}" mà khung 3D đo ${d.ten} đi sang ${d.dx > 0 ? 'PHẢI' : 'TRÁI'} màn — sửa câu hướng (dan_dung.huong) cho khớp 3D`);
    }
    // NGƯỜI NGOÀI KHUNG làm chủ ngữ hành động ("Thần slams the table" khi 3D không thấy Thần): model vẽ họ vào. Hướng nhìn "looks at Thần" là đúng — bỏ qua
    // khi tên đứng sau at / to / toward / from / with / of / on / into / after. Khối thoại + chuyển động 3D không soi.
    const chuDien = b.khoi ? ghep(b.khoi.filter((k) => k.ma !== 'thoai' && k.ma !== 'chuyen_dong')) : chu;
    for (const t of s.ngoai ?? []) {
      const tat = (t.trim().split(/\s+/).pop() ?? t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const m = chuDien.match(new RegExp(`(?<!\\b(?:at|to|toward|towards|from|with|of|on|into|after|beside|near)\\s+(?:\\p{L}+\\s+)?)(?<!\\p{L})${tat}(?!\\p{L})(?:'s)?\\s+\\p{L}+`, 'iu'));
      if (m) them(b.ten, 'ngoai_khung', `chữ cho "${m[0]}" mà ${t} ngoài khung cả shot — model vẽ thêm người: chỉ tả người trong khung (hướng nhìn "looks at ${tat}" thì được)`);
    }
    // CÂU LẶP: một vế ≥ 4 từ nằm trọn trong một vế khác (#15 "jade bangle on the left wrist" hai lần)
    const ve = chuLap.toLowerCase().split(/[,.;|]/).map((x) => x.trim()).filter((x) => x.split(/\s+/).length >= 4);
    const lap = ve.find((x, i) => ve.some((y, j) => j !== i && (y === x ? j < i : y.includes(x))));
    if (lap) them(b.ten, 'lap', `lặp "${lap.slice(0, 60)}" — bỏ vế trùng (model hiểu thành hai món)`);
  }
  return { diem: Math.max(0, 100 - loi.reduce((t, l) => t + l.phat, 0)), loi };
}
/** Lỗi CHẶN (phạt ≥ NGUONG_CHAN) dạng câu — cổng dùng. */
export const loiPrompt = (buoc: BuocPrompt[], s: SoatPrompt): string[] => chamPrompt(buoc, s).loi.filter((l) => l.phat >= NGUONG_CHAN).map((l) => l.chu);
