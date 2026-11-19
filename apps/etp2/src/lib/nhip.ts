// NHỊP TỰ LÀM MỚI (anh 12/11/2026: một tab etp2 để mở 18 giờ ăn 53% CPU iMac; góp ý #1566: tăng chu kỳ, không focus đủ lâu thì không làm mới).
// Cùng luật với mos2 (apps/web/src/lib/nhip-lam-moi.ts):
// - nhịp >= 3s: chu kỳ nhân đôi, tối thiểu 30s (nhịp < 3s như đồng hồ đếm giây giữ nguyên);
// - tab ẩn, hoặc cửa sổ mất focus quá 60s: bỏ lượt, không gọi máy chủ;
// - tab hiện lại / focus lại: chạy bù một lượt cho số liệu mới.
// Trả về hàm huỷ, dùng y như clearInterval: `const t = nhip(f, 15_000); return () => t();`
const MAT_FOCUS_TOI_DA = 60_000;
let matFocusLuc: number | null = null;
if (typeof window !== 'undefined') {
  if (!document.hasFocus()) matFocusLuc = Date.now();
  window.addEventListener('blur', () => { matFocusLuc = Date.now(); });
  window.addEventListener('focus', () => { matFocusLuc = null; });
}
function nghi(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.hidden) return true;
  return matFocusLuc !== null && Date.now() - matFocusLuc > MAT_FOCUS_TOI_DA;
}
export function chuKy(ms: number): number { return ms < 3_000 ? ms : Math.max(30_000, ms * 2); }
export function nhip(f: () => unknown, ms: number): () => void {
  let boLuot = false;
  const chay = () => { if (nghi()) { boLuot = true; return; } void f(); };
  const id = window.setInterval(chay, chuKy(ms));
  const ve = () => { if (!document.hidden && boLuot) { boLuot = false; void f(); } };
  document.addEventListener('visibilitychange', ve);
  window.addEventListener('focus', ve);
  return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', ve); window.removeEventListener('focus', ve); };
}
