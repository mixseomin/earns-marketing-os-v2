// KIỂU NÚT 💬 CHUẨN (CHUAN.md mục 1) — MỘT bản cho mọi nơi: hòm React (client.tsx) và script trang tĩnh (apps/web api/gop-y-ngoai/nut,
// castle / worlds / studio2 / ngatu / dantranh…). Anh 25/11/2026: "nếu có task kẹt thì hiện 1 hình tròn đỏ ở góc! Nếu đang làm thì sáng nhấp nhô.
// Áp dụng chung cho mọi chỗ dùng gopy."
//  · .gy-dang-lam  = AI đang làm → viền + quầng xanh sáng nhấp nhô (gy-sang)
//  · .gy-cham-do   = có việc kẹt (broken / claimed quá trần) → chấm tròn đỏ góc phải-trên
//  · .gy-so-do     = số card đang chờ ý kiến của chính người xem → số đỏ góc trái-trên
import type { DemGopY } from './dem';

export const GY_NUT_CSS = `.gy-nut.gy-dang-lam{border-color:#22d3ee!important;color:#22d3ee!important;animation:gy-sang 1.6s ease-in-out infinite}
@keyframes gy-sang{0%,100%{box-shadow:0 0 0 0 rgba(34,211,238,.55),0 0 6px 1px rgba(34,211,238,.35)}50%{box-shadow:0 0 0 5px rgba(34,211,238,0),0 0 18px 5px rgba(34,211,238,.75)}}
@media (prefers-reduced-motion:reduce){.gy-nut.gy-dang-lam{animation:none;box-shadow:0 0 12px 3px rgba(34,211,238,.6)}}
.gy-cham-do{position:absolute;top:-3px;right:-3px;width:12px;height:12px;border-radius:50%;background:#ef4444;box-shadow:0 0 0 2px var(--bg-1,#111);pointer-events:none}
.gy-so-do{position:absolute;top:-6px;left:-6px;min-width:18px;height:18px;padding:0 4px;border-radius:999px;background:var(--red,#ef4444);color:#fff;font-size:11px;font-weight:700;line-height:18px;text-align:center;box-shadow:0 0 0 2px var(--bg-1,#111);pointer-events:none}`;

/** Chữ khi rê chuột lên nút 💬: vừa gửi · kẹt · số chờ ý kiến · "AI đang làm: <tiêu đề việc>". */
export function tieuDeNut(vuaGui: number | null, dem: DemGopY): string {
  if (vuaGui) return `Đã gửi card #${vuaGui}`;
  const dong = [
    dem.ket ? `🔴 ${dem.ket} việc kẹt: ${(dem.ketDs ?? []).join(' · ')}` : '',
    dem.can_y_kien ? `${dem.can_y_kien} góp ý đang chờ ý kiến của bạn (mở tab Của tôi)` : '',
    dem.working ? `AI đang làm: ${dem.dangLam.join(' · ') || `${dem.working} việc`}` : '',
  ].filter(Boolean);
  return dong.length ? dong.join('\n') : 'Góp ý / báo lỗi về màn đang xem';
}
export type { DemGopY };
