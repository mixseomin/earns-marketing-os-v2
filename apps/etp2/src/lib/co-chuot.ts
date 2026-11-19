// Máy có chuột (pointer: fine) mới được TỰ focus ô gõ khi mở ô chọn / ngăn tìm.
// Màn cảm ứng (điện thoại, iPad) tự focus = bật bàn phím che danh sách (anh 01/11/2026 etp #1502
// "Ko tự ý focus vào input như vậy. Trên mobile khó chịu"). Dùng: <input autoFocus={coChuot()} …/>.
export function coChuot(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches;
}
