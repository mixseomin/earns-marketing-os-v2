// PHÂN LOẠI SỰ KIỆN LĂN (anh 23/10/2026 "tao dùng chuột thường không phải lúc nào cũng touchpad"): trình duyệt gửi chung một sự kiện `wheel` cho
// bánh xe chuột và vuốt 2 ngón touchpad. Bánh xe → PHÓNG, vuốt touchpad → TRƯỢT, chụm touchpad (ctrlKey) → PHÓNG.
// Chuột thường trên macOS có thể gửi deltaY nhỏ (4, 8, 12… theo gia tốc) — trông y như vuốt touchpad thẳng đứng; nên ca mơ hồ đi theo
// thiết bị đã nhận ra CHẮC CHẮN gần nhất (nhớ qua phiên), và giữ nguyên quyết định suốt một cú cuộn liền (các sự kiện cách nhau < 250 ms).

export type SuKienLan = { deltaMode: number; deltaX: number; deltaY: number; ctrlKey: boolean; wheelDeltaY?: number; timeStamp: number };
export type NhoLan = { thietBi: 'chuot' | 'pad' | null; cuCuon: 'phong' | 'truot' | null; tCuoi: number };
export const nhoLanMoi = (thietBi: NhoLan['thietBi'] = null): NhoLan => ({ thietBi, cuCuon: null, tCuoi: -1e9 });

/** dấu hiệu chắc chắn của thiết bị, null = mơ hồ */
export function dauHieu(e: SuKienLan): 'chuot' | 'pad' | null {
  if (e.deltaMode !== 0) return 'chuot';                                         // Firefox: chuột cuộn theo dòng / trang
  if (e.deltaX !== 0 || !Number.isInteger(e.deltaY)) return 'pad';               // có trục ngang hoặc delta lẻ = vuốt mịn
  const w = e.wheelDeltaY ?? 0;
  if (w !== 0 && w % 120 === 0 && w !== -3 * e.deltaY) return 'chuot';          // nấc bánh xe kiểu cũ = bội 120 (touchpad Chrome/Safari: wheelDelta = −3·deltaY)
  if (Math.abs(e.deltaY) >= 40) return 'chuot';                                  // Windows / Linux: một nấc ~100 px
  return null;
}

/** quyết định phóng / trượt cho một sự kiện lăn; `luonPhong` = người dùng chọn "lăn luôn là phóng" */
export function phanLoaiLan(e: SuKienLan, nho: NhoLan, luonPhong = false): 'phong' | 'truot' {
  if (e.ctrlKey) return 'phong';
  const dh = dauHieu(e); if (dh) nho.thietBi = dh;
  const lienCu = e.timeStamp - nho.tCuoi < 250; nho.tCuoi = e.timeStamp;
  let kq: 'phong' | 'truot';
  if (e.deltaX !== 0 && dh === 'pad') kq = 'truot';                              // có trục ngang thì chắc chắn là vuốt
  else if (luonPhong) kq = 'phong';
  else if (dh) kq = dh === 'chuot' ? 'phong' : 'truot';
  else if (lienCu && nho.cuCuon) kq = nho.cuCuon;                                // giữa một cú cuộn liền: giữ nguyên
  else kq = nho.thietBi === 'pad' ? 'truot' : 'phong';                           // mơ hồ: theo thiết bị chắc gần nhất, chưa biết thì coi là chuột
  nho.cuCuon = kq; return kq;
}
