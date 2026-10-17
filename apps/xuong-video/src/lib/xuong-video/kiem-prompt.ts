// BỘ CHẤM PROMPT (anh 17/10/2026: "có vẻ prompt cũng đang chưa được chấm và kiểm soát đầy đủ?"). Cổng 3D chỉ kiểm HÌNH; chữ gửi model là kênh thứ
// hai mà model bám — chữ sai thì ảnh sai dù 3D đúng (tập 122: #15 bước 1 không nói vest trắng → Hạ vest đen; #22 cận cổ tay mà tả cả hàm, mắt → model
// vẽ mặt Thần; chữ "bracelet hidden under the cuff" ngược khung 3D; tên khối tiếng Việt "Màn trình chiếu anh sau" lọt vào prompt; bước 1 dài quá
// giới hạn FLUX nên câu "No text" cuối bị cắt). Luật thuần, 0đ, đọc đúng chuỗi SẼ gửi (sinh-anh.ts › chuanBiKeyframe) — chặn ở lyChanKeyframe trước
// khi tiêu tiền, in ở sinh-anh-phim.mts --xem-prompt. Tự kiểm: kiem-prompt.test.mts
/** Chữ có dấu tiếng Việt (model ảnh / video đọc tiếng Anh — tên khối, ghi chú đạo diễn tiếng Việt lọt vào là lời rác). */
export const CO_TIENG_VIET = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
/** Bước 1 FLUX đọc tối đa ~512 token T5: quá ~300 từ thì phần cuối (phong cách, "No text") bị cắt. */
export const TU_TOI_DA_FLUX = 300;
/** chữ tả mặt / đầu — trừ 'eye-level' (góc máy) và 'face out of frame' (chính câu dặn không vẽ mặt) */
export const MAT = /\b(jawline|eyes|face(?! out of frame)|faces|hair|makeup|eyebrows?|lips|smile|stare)\b/i;
/** Bỏ các vế tả mặt / tóc khỏi một mô tả (bộ đồ có 'loose hair, light makeup') — dùng cho cận chèn chỉ thấy tay. */
export const boMat = (t: string) => t.split(/,\s*/).filter((x) => !MAT.test(x)).join(', ');
const AN = /\b(hidden|covered|covering|concealed|out of sight|not visible|tucked under)\b/i;
const TU_CHUNG = new Set(['small', 'thin', 'black', 'white', 'light', 'large', 'under', 'with', 'their', 'which', 'little', 'round', 'dark', 'long', 'short']);

export type BuocPrompt = { ten: string; chu: string; flux?: boolean };
export type SoatPrompt = {
  co_canh?: string;
  /** người trong khung + bộ đồ sổ trang phục (mô tả biến thể) — mọi bước phải nói bộ đồ */ nguoi: { ten: string; trang_phuc?: string }[];
  /** đồ CHỦ THỂ đang thấy trong khung 3D — chữ không được nói nó bị che / giấu */ vat: { ten: string; mo_ta: string }[];
  /** tên riêng được phép giữ dấu (nhân vật, đạo cụ có tên) — "Lâm Hạ" là tên, không phải chữ tiếng Việt lọt vào */ ten_rieng?: string[];
};

const doan = (chu: string, re: RegExp) => { const m = chu.match(new RegExp(`[^.;|]{0,40}${re.source}[^.;|]{0,30}`, 'gi')) ?? []; return m.slice(0, 2).map((x) => `"…${x.trim()}…"`).join(', '); };

/** Lỗi của bộ prompt một shot (rỗng = qua). */
export function loiPrompt(buoc: BuocPrompt[], s: SoatPrompt): string[] {
  const out: string[] = [];
  // tên đủ + tên gọi tắt (chữ cuối: 'Lâm Hạ' → 'Hạ', 'Luật sư Trần' → 'Trần') — câu mở shot gọi nhân vật bằng tên tắt
  const du = [...(s.ten_rieng ?? []), ...s.nguoi.map((n) => n.ten), ...s.vat.map((v) => v.ten)].filter(Boolean);
  const rieng = [...new Set([...du, ...du.map((t) => t.trim().split(/\s+/).pop() ?? '')])].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const b of buoc) {
    // bỏ tên riêng trước khi soi dấu: tên khai (cả tên tắt) + mọi chữ VIẾT HOA đầu (tên nhân vật ngoài khung được nhắc: 'turns from Hạ to Thần');
    // chữ thường có dấu mới là tiếng Việt lọt vào ('Màn trình chiếu' → 'trình chiếu', 'khẽ, chắc nịch')
    const tron = rieng.reduce((c, t) => c.split(t).join(' '), b.chu).replace(/(^|[^\p{L}])\p{Lu}[\p{L}]*/gu, '$1');
    if (CO_TIENG_VIET.test(tron)) out.push(`${b.ten}: lẫn tiếng Việt ${doan(tron, /[^\s,.:;|]*[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ][^\s,.:;|]*/)} — model đọc tiếng Anh: dùng tên en của vật / bỏ ghi chú tiếng Việt`);
    const tu = b.chu.split(/\s+/).filter(Boolean).length;
    if (b.flux && tu > TU_TOI_DA_FLUX) out.push(`${b.ten}: dài ${tu} từ — FLUX đọc ~${TU_TOI_DA_FLUX} từ, phần cuối bị cắt (thường là câu phong cách / "No text"): rút gọn hậu cảnh, bỏ lặp`);
    for (const n of s.nguoi) {
      if (!n.trang_phuc) continue;
      const dau = n.trang_phuc.slice(0, 40).toLowerCase();
      if (!b.chu.toLowerCase().includes(dau)) out.push(`${b.ten}: không nói bộ đồ của ${n.ten} ("${n.trang_phuc.slice(0, 50)}…") — model tự chọn đồ (tập 122 #15: vest đen thay vest trắng)`);
    }
    if (s.co_canh === 'insert' && s.nguoi.length && MAT.test(b.chu)) out.push(`${b.ten}: cận chèn mà tả mặt / tóc ${doan(b.chu, MAT)} — model sẽ vẽ mặt người vào cú cận đồ (tập 122 #22): chỉ tả phần thân trong khung`);
    for (const v of s.vat) {
      const tuVat = v.mo_ta.toLowerCase().match(/[a-z-]{5,}/g)?.filter((w) => !TU_CHUNG.has(w)) ?? [];
      const cau = b.chu.split(/[.;|]/).find((c) => AN.test(c) && tuVat.some((w) => c.toLowerCase().includes(w)));
      if (cau) out.push(`${b.ten}: chữ nói ${v.ten} bị che / giấu ("${cau.trim().slice(0, 90)}") mà khung 3D cho thấy nó — sửa chữ (sổ người / mở shot) cho khớp 3D`);
    }
  }
  return out;
}
