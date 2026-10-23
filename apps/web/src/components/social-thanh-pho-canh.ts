'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// CẢNH THÀNH PHỐ SOCIAL — vẽ PhoMoHinh (lib/social-thanh-pho.ts) bằng three.js r128 (bản global + MapControls nạp từ CDN, cùng bản đã duyệt ở demo
// artifact 22/10/2026). Thành phố đêm low-poly học CodeCity / GitHub Skyline: cụm = quảng trường + toà trung tâm, toà vệ tinh quanh đó.
// Cửa sổ sáng = bài đang chạy · thùng tím ở chân = bài sắp đăng · cột sáng xanh = lượt xem · xe trên phố = khách về site · đèn đỏ + khói = hỏng ·
// toà mờ = dừng. Chữ trong cảnh chỉ có tên dọc thân toà trung tâm / toà đích; favicon site trên nóc.
// Điều hướng kiểu bản đồ: kéo một ngón / chuột trái = trượt · hai ngón / chuột phải = xoay · chụm / lăn = phóng · nút ⟲ ⟳ ＋ － ⌂ cho một tay.
import { KHU_XUONG, LINH_VUC, TEN_BAN, laDichSong, TRANG_THAI_VN, TT_TK, VUNG_SX, type TtTk, type PhoDich, type PhoMoHinh, type PhoNen, type PhoTk } from '@/lib/social-thanh-pho';
import { wrapExternalUrl } from '@/lib/external-url';
import { nhoLanMoi, phanLoaiLan } from '@/lib/loai-lan';
type Nen = PhoNen | 'tim' | 'qc' | 'gt' | 'ch';

const CDN = ['https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js', 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'];
let dangNap: Promise<any> | null = null;
/** nạp three r128 + MapControls một lần cho cả phiên trang */
export function napThree(): Promise<any> {
  const w = window as any;
  if (w.THREE?.MapControls) return Promise.resolve(w.THREE);
  dangNap ??= CDN.reduce((p, src) => p.then(() => new Promise<void>((xong, loi) => {
    if (src.includes('three.min') && w.THREE) return xong();
    const s = document.createElement('script'); s.src = src; s.async = false; s.onload = () => xong(); s.onerror = () => loi(new Error(`không tải được ${src}`)); document.head.appendChild(s);
  })), Promise.resolve()).then(() => w.THREE);
  return dangNap.catch((e) => { dangNap = null; throw e; });
}

const P: Record<Nen, string> = {
  ch: '<path d="M6 8h12l-1 12H7L6 8z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="#fff" stroke-width="2"/>',
  qc: '<path d="M4 10v4h3l5 4V6L7 10H4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>',
  gt: '<path d="M10 14a4 4 0 0 1 0-5.6l2.8-2.8a4 4 0 0 1 5.6 5.6l-1.4 1.4M14 10a4 4 0 0 1 0 5.6l-2.8 2.8a4 4 0 0 1-5.6-5.6l1.4-1.4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
  tim: '<circle cx="10.5" cy="10.5" r="6" fill="none" stroke="#fff" stroke-width="2.6"/><path d="M15 15l5.5 5.5" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/>',
  yt: '<path d="M9.5 7.5v9l7.5-4.5z"/>', tt: '<path d="M14 3h3a4 4 0 0 0 4 4v3a7 7 0 0 1-4-1.3V15a6 6 0 1 1-6-6v3.2A2.8 2.8 0 1 0 14 15z"/>',
  fb: '<path d="M13.5 21v-7h2.4l.4-2.9h-2.8V9.3c0-.8.3-1.4 1.4-1.4h1.5V5.3a19 19 0 0 0-2.2-.1c-2.2 0-3.6 1.3-3.6 3.7v2.2H8.2V14h2.4v7z"/>',
  ig: '<rect x="4" y="4" width="16" height="16" rx="5" fill="none" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12" r="3.6" fill="none" stroke="#fff" stroke-width="2"/><circle cx="17" cy="7" r="1.2"/>',
  x: '<path d="M4 4h4.5l4 5.6L17 4h2.5l-5.8 7.3L20 20h-4.5l-4.3-6-4.8 6H4l6.2-7.6z"/>',
  pin: '<path d="M12 3a9 9 0 0 0-3.3 17.4c-.1-.7-.1-1.8 0-2.6l1-4.4s-.3-.6-.3-1.4c0-1.3.8-2.3 1.7-2.3.8 0 1.2.6 1.2 1.3 0 .8-.5 2-.8 3.1-.2 1 .5 1.7 1.4 1.7 1.7 0 3-1.8 3-4.4 0-2.3-1.6-3.9-4-3.9-2.7 0-4.3 2-4.3 4.2 0 .8.3 1.7.7 2.2l.1.3-.3 1.1c0 .2-.2.2-.4.1-1.2-.6-2-2.4-2-3.8 0-3.1 2.3-6 6.5-6 3.4 0 6.1 2.4 6.1 5.7 0 3.4-2.1 6.1-5.1 6.1-1 0-2-.5-2.3-1.1l-.6 2.4c-.2.9-.8 2-1.3 2.6A9 9 0 1 0 12 3z"/>',
  dm: '<path d="M15 4h3v16h-3v-1a5 5 0 1 1 0-8zm-3 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/>',
  th: '<path d="M16.6 11.2c-.1 0-.2-.1-.3-.1-.2-3-1.8-4.7-4.6-4.7-1.6 0-3 .7-3.9 2l1.5 1c.6-.9 1.6-1.1 2.4-1.1 1 0 1.7.3 2.2.9.3.4.6 1 .7 1.7-.8-.1-1.6-.2-2.5-.1-2.5.1-4.1 1.6-4 3.6.1 1 .6 1.9 1.4 2.5.7.5 1.6.7 2.6.6 1.3-.1 2.3-.6 3-1.5.5-.7.9-1.6 1-2.7.6.4 1.1.9 1.3 1.5.4 1 .4 2.7-1 4.1-1.2 1.2-2.7 1.8-5 1.8-2.5 0-4.4-.8-5.6-2.4C4.7 16.8 4.1 14.7 4 12c.1-2.7.7-4.8 1.9-6.3C7.1 4.1 9 3.3 11.5 3.3s4.5.8 5.8 2.4c.6.8 1.1 1.7 1.4 2.8l1.8-.5c-.4-1.4-1-2.6-1.8-3.6C17 2.4 14.6 1.4 11.5 1.4 8.4 1.4 6 2.4 4.4 4.4 3 6.2 2.2 8.7 2.2 12c0 3.3.8 5.8 2.2 7.6 1.6 2 4 3 7.1 3 2.8 0 4.7-.7 6.3-2.3 2.1-2.1 2-4.7 1.3-6.3-.5-1.2-1.4-2.1-2.5-2.8zm-4.3 4.6c-1.1.1-2.1-.4-2.2-1.4 0-.7.5-1.5 2.2-1.6h.6c.6 0 1.2.1 1.7.2-.2 2.3-1.3 2.7-2.3 2.8z"/>',
  qu: '<path d="M12 3a8.5 8.5 0 0 0 0 17c.9 0 1.8-.2 2.6-.4.6 1 1.4 1.9 3.1 1.9 1.8 0 2.6-1.6 2.6-2.6h-1.3c0 .6-.4 1-1 1-.8 0-1.4-.7-1.9-1.6A8.5 8.5 0 0 0 12 3zm2.2 13.9c-.5-.9-1.2-1.8-2.6-1.8-.9 0-1.6.4-2 .8l.6 1c.2-.1.4-.2.7-.2.6 0 1 .5 1.4 1.1A5.4 5.4 0 0 1 6.6 11.5C6.6 7.9 8.9 5.6 12 5.6s5.4 2.3 5.4 5.9c0 2.4-1.2 4.4-3.2 5.4z"/>',
};
const NEN: Record<Nen, [string, string]> = { ch: ['#0a84ff', 'Trong cửa hàng'], tim: ['#3a4f7a', 'Tìm kiếm'], qc: ['#b8860b', 'Quảng cáo'], gt: ['#5a6a8f', 'Giới thiệu'], yt: ['#ff2a4d', 'YouTube'], tt: ['#1b1b22', 'TikTok'], fb: ['#2f7cf6', 'Facebook'], ig: ['#e1306c', 'Instagram'], x: ['#20232b', 'X'], pin: ['#e60023', 'Pinterest'], dm: ['#1f47c4', 'Dailymotion'], th: ['#101010', 'Threads'], qu: ['#b92b27', 'Quora'] };
const svgLogo = (k: Nen, c?: number) => `<svg viewBox="0 0 24 24" fill="#fff"${c ? ` width="${c}" height="${c}"` : ''}>${P[k]}</svg>`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const so = (n: number | null) => (n == null ? 'chưa đo' : n.toLocaleString('vi-VN'));

const CSS = `
.tp { position: relative; overflow: hidden; background: #060914; color: #e8ecf8; font: 12px system-ui, sans-serif; --nen: #060914; --nen2: #111830; --vien: #252f4e; --chu: #e8ecf8; --chu2: #8e9abd; --l3: #6ea8ff; color-scheme: dark; }
.tp canvas { display: block; touch-action: none; }
.tp { -webkit-user-select: none; user-select: none; } .tp input, .tp select, .tp .ngan { -webkit-user-select: text; user-select: text; }   /* nhấp đúp không bôi xanh chữ trên cảnh */
.tp [hidden] { display: none !important; }
.tp button { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.tp .ben { position: absolute; left: 12px; top: 12px; width: 184px; background: color-mix(in srgb, var(--nen2) 92%, transparent); border: 1px solid var(--vien); border-radius: 12px; padding: 10px; display: grid; gap: 8px; z-index: 5; max-height: calc(100% - 24px); overflow: auto; }
.tp .ben b { font: 700 9px system-ui; letter-spacing: .08em; text-transform: uppercase; color: var(--chu2); }
.tp .hang { display: flex; flex-wrap: wrap; gap: 4px; }
.tp .seg { display: flex; border: 1px solid var(--vien); border-radius: 8px; overflow: hidden; }
.tp .seg button { flex: 1; border: 0; background: var(--nen); color: var(--chu2); font: 600 11px system-ui; padding: 6px 0; cursor: pointer; }
.tp .seg button[aria-pressed="true"] { background: #23305a; color: #fff; }
.tp .lop { display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--vien); background: var(--nen); color: var(--chu2); font: 13px system-ui; padding: 3px 7px; border-radius: 999px; cursor: pointer; opacity: .5; }
.tp .lop[aria-pressed="true"] { opacity: 1; border-color: #4a5a8f; color: var(--chu); }
.tp .chip { width: 24px; height: 24px; border-radius: 50%; border: 2px solid transparent; display: grid; place-items: center; font: 700 11px system-ui; color: #fff; cursor: pointer; padding: 0; opacity: .45; overflow: hidden; }
.tp .chip svg { width: 60%; height: 60%; } .tp .chip img { width: 100%; height: 100%; object-fit: cover; background: #fff; } .tp .chip[aria-pressed="true"] { opacity: 1; border-color: #fff; }
.tp .seg button:focus-visible, .tp .lop:focus-visible, .tp .chip:focus-visible, .tp .dieu button:focus-visible, .tp .thu:focus-visible { outline: 2px solid var(--l3); outline-offset: 2px; }
/* WIDGET CHUẨN (anh 23/10/2026 "các widget phải chuẩn hoá: header sticky, nút close, resize từ 4 phía 4 góc"): mọi bảng nổi (.wg) = đầu cố định
   (tên + kéo để dời + nút ×) · thân cuộn riêng · 8 tay cầm đổi cỡ (4 cạnh, 4 góc) · chỗ + cỡ nhớ theo máy; ↺ Đặt lại màn trả về chỗ cũ */
.tp .wg { box-sizing: border-box; display: flex !important; flex-direction: column; padding: 0 !important; overflow: hidden !important; min-width: 180px; min-height: 120px; max-width: calc(100% - 8px); }
.tp .wg-dau { flex: none; display: flex; align-items: center; gap: 6px; padding: 5px 5px 5px 10px; border-bottom: 1px solid var(--vien); background: var(--nen2); cursor: move; user-select: none; touch-action: none; font: 700 11px system-ui; color: var(--chu); }
.tp .wg-dau::before { content: '⠿'; color: var(--chu2); }
.tp .wg-ten { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; align-items: center; gap: 6px; }
.tp .wg-x { flex: none; width: 26px; height: 26px; border: 0; border-radius: 6px; background: transparent; color: var(--chu2); font: 700 16px system-ui; cursor: pointer; } .tp .wg-x:hover { background: #ffffff14; color: var(--chu); }
.tp .wg-than { flex: 1; min-height: 0; overflow: auto; padding: 10px; }
.tp .ben .wg-than { display: grid; gap: 8px; align-content: start; }
.tp .wg-k { position: absolute; z-index: 3; touch-action: none; }
.tp .wg-k[data-h=n] { top: -3px; left: 10px; right: 10px; height: 7px; cursor: ns-resize; } .tp .wg-k[data-h=s] { bottom: -3px; left: 10px; right: 10px; height: 7px; cursor: ns-resize; }
.tp .wg-k[data-h=e] { right: -3px; top: 10px; bottom: 10px; width: 7px; cursor: ew-resize; } .tp .wg-k[data-h=w] { left: -3px; top: 10px; bottom: 10px; width: 7px; cursor: ew-resize; }
.tp .wg-k[data-h=nw] { top: -3px; left: -3px; width: 14px; height: 14px; cursor: nwse-resize; } .tp .wg-k[data-h=se] { bottom: -3px; right: -3px; width: 14px; height: 14px; cursor: nwse-resize; }
.tp .wg-k[data-h=ne] { top: -3px; right: -3px; width: 14px; height: 14px; cursor: nesw-resize; } .tp .wg-k[data-h=sw] { bottom: -3px; left: -3px; width: 14px; height: 14px; cursor: nesw-resize; }
.tp .ben.gon, .tp .wg[hidden] { display: none !important; }   /* .wg dùng display:flex !important nên phải nhắc lại [hidden] */
.tp .thu { position: absolute; left: 12px; top: 12px; z-index: 5; width: 40px; height: 40px; border-radius: 10px; border: 1px solid var(--vien); background: color-mix(in srgb, var(--nen2) 92%, transparent); color: var(--chu); font: 700 18px system-ui; cursor: pointer; }
.tp .ben:not(.gon) ~ .thu { display: none; }
.tp .dk label { flex-wrap: wrap; } .tp .dk select { max-width: 100%; min-width: 0; }
.tp .ngan { position: absolute; right: 12px; top: 12px; width: 320px; z-index: 6; background: color-mix(in srgb, var(--nen2) 95%, transparent); border: 1px solid var(--vien); border-radius: 12px; padding: 10px; max-height: calc(100% - 140px); overflow: auto; }
.tp .meo { position: absolute; z-index: 7; min-width: 200px; max-width: 340px; max-height: calc(100% - 24px); overflow: auto; background: color-mix(in srgb, var(--nen2) 96%, transparent); border: 1px solid var(--vien); border-radius: 10px; padding: 8px 10px; box-shadow: 0 8px 24px #0008; }
.tp .dau { display: flex; align-items: center; gap: 8px; font-weight: 700; margin-bottom: 6px; padding-right: 14px; }
.tp .h { display: flex; justify-content: space-between; padding: 3px 0; color: var(--chu2); gap: 12px; } .tp .h span { flex: none; } .tp .h b { color: var(--chu); font: 700 12px system-ui, sans-serif; font-variant-numeric: tabular-nums; text-align: right; }
.tp .bang { display: grid; column-gap: 10px; row-gap: 4px; margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--vien); align-items: center; }
.tp .bang i { font: 600 10px system-ui; font-style: normal; color: var(--chu2); text-align: right; white-space: nowrap; } .tp .bang i:first-child { text-align: left; }
.tp .bang .ten { display: flex; align-items: center; gap: 5px; min-width: 0; color: var(--chu); line-height: 1.25; }
.tp .bang b { font: 700 12px system-ui; font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; color: var(--chu); }
.tp .dieu { position: absolute; right: 12px; bottom: 12px; z-index: 5; display: grid; grid-template-columns: repeat(2, 40px); gap: 6px; }
.tp .dieu button { width: 40px; height: 40px; border-radius: 10px; border: 1px solid var(--vien); background: color-mix(in srgb, var(--nen2) 92%, transparent); color: var(--chu); font: 600 18px system-ui; cursor: pointer; }
.tp .dieu .rong { grid-column: span 2; width: auto; }
.tp .nho { color: var(--chu2); font-size: 10px; }
.tp .dk { display: grid; gap: 5px; font: 11px system-ui; color: var(--chu2); } .tp .dk label { display: flex; align-items: center; gap: 6px; justify-content: space-between; } .tp .dk input[type=range] { width: 80px; accent-color: #6ea8ff; } .tp .dk select { background: var(--nen); color: var(--chu); border: 1px solid var(--vien); border-radius: 6px; font: 11px system-ui; }
.tp .goi-y { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); z-index: 8; background: #111830ee; border: 1px solid #4a5a8f; color: #e8ecf8; border-radius: 999px; padding: 6px 14px; font: 600 12px system-ui; pointer-events: none; white-space: nowrap; }
.tp .cb { border-top: 1px solid var(--vien); padding: 7px 0; } .tp .cb .nho { display: block; margin: 3px 0 5px; white-space: normal; }
.tp .cb .nut-cb { display: flex; gap: 5px; flex-wrap: wrap; } .tp .cb .nut-cb a, .tp .cb .nut-cb button { text-decoration: none; color: #fff; background: #23305a; border: 1px solid #4a5a8f; border-radius: 7px; padding: 4px 8px; font: 600 11px system-ui; cursor: pointer; }
.tp .cb .nut-cb button { background: #1f5c3f; border-color: #3fd68a; } .tp .cb.xong { opacity: .45; }
.tp .tim { position: relative; } .tp .tim input { width: 100%; box-sizing: border-box; background: var(--nen); border: 1px solid var(--vien); border-radius: 8px; color: var(--chu); padding: 6px 8px; font: 12px system-ui; }
.tp .tim-ds { position: absolute; left: 0; right: 0; top: 34px; z-index: 9; background: var(--nen2); border: 1px solid var(--vien); border-radius: 8px; max-height: 240px; overflow: auto; }
.tp .tim-ds button { display: flex; gap: 6px; align-items: center; width: 100%; text-align: left; background: none; border: 0; color: var(--chu); padding: 6px 8px; font: 12px system-ui; cursor: pointer; } .tp .tim-ds button:hover, .tp .tim-ds button:focus-visible { background: #23305a; outline: none; }
.tp .tim-ds .nho { margin-left: auto; }
.tp .song .muc { display: flex; gap: 4px; flex-wrap: wrap; } .tp .song .tong { font: 12px system-ui; margin-bottom: 5px; } .tp .song .muc button { flex: 1 1 40%; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; background: var(--nen); border: 1px solid var(--vien); border-radius: 8px; color: var(--chu); padding: 4px 4px; font: 11px system-ui; letter-spacing: -.1px; cursor: pointer; text-align: left; }
.tp .song .muc button[aria-pressed="true"] { border-color: #5effc4; } .tp .song .muc b { font-size: 14px; margin-left: 2px; }
.tp .song .ds { margin-top: 6px; max-height: 220px; overflow: auto; border: 1px solid var(--vien); border-radius: 8px; } .tp .song .ds button { display: block; width: 100%; background: none; border: 0; border-bottom: 1px solid var(--vien); color: var(--chu); padding: 5px 8px; font: 12px system-ui; cursor: pointer; text-align: left; }
.tp .song .ds button:hover { background: var(--nen2); } .tp .song .ds .nho { display: block; font-size: 11px; color: var(--mo, #8e9abd); } .tp .song .ray { margin-top: 6px; font: 11px system-ui; color: var(--mo, #8e9abd); cursor: pointer; background: none; border: 0; padding: 0; text-align: left; } .tp .song .loc { width: 100%; box-sizing: border-box; margin-top: 6px; background: var(--nen); border: 1px solid var(--vien); border-radius: 8px; color: var(--chu); padding: 4px 6px; font: 11px system-ui; }
.tp .mini { position: absolute; left: 12px; bottom: 12px; z-index: 5; width: 200px; height: 110px; border: 1px solid var(--vien); border-radius: 10px; background: rgba(8,12,26,.85); cursor: crosshair; }
.tp .xg { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; font: 12px system-ui; } .tp .xg > * { min-width: 0; }   /* tên phim dài (một dòng, cắt …) không được kéo rộng lưới */
.tp .xg-chi { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 2px 8px; } .tp .xg-chi b { justify-self: end; font-size: 14px; } .tp .xg-chi i, .tp .xg-tram i { grid-column: 1 / -1; height: 6px; border-radius: 3px; background: #22304d; overflow: hidden; } .tp .xg-chi em, .tp .xg-tram em { display: block; height: 100%; background: #3fd68a; }
.tp .xg-tram { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; } .tp .xg-tram > div { display: grid; justify-items: center; gap: 2px; padding: 6px 4px; border: 1px solid var(--vien); border-radius: 10px; background: var(--nen); text-align: center; }
.tp .xg-tram > div.on { border-color: #59a8ff; background: #16294a; } .tp .xg-tram > div.loi { border-color: #ff4d5e; background: #3a1620; } .tp .xg-tram span { font-size: 18px; } .tp .xg-tram b { font-size: 16px; } .tp .xg-tram small { font-size: 10.5px; color: var(--mo, #8e9abd); line-height: 1.2; } .tp .xg-tram i { width: 100%; height: 4px; }
.tp .xg-dang { padding: 6px 8px; border-radius: 8px; background: #16294a; } .tp .xg-dang.loi { background: #3a1620; color: #ff8a80; } .tp .xg-may { color: var(--mo, #8e9abd); font-size: 11px; }
.tp .xg-ds summary { cursor: pointer; padding: 4px 0; display: flex; gap: 6px; align-items: center; position: sticky; top: 0; background: var(--nen2); z-index: 1; } .tp .xg-loc { width: 100%; box-sizing: border-box; background: var(--nen); border: 1px solid var(--vien); border-radius: 8px; color: var(--chu); padding: 5px 8px; font: 12px system-ui; } .tp .xg-ds summary b { font-size: 12px; } .tp .xg-ds > div { display: flex; gap: 6px; align-items: center; padding: 3px 0 3px 18px; border-top: 1px solid var(--vien); }
.tp .xg-ds > div > span:first-child { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .tp .xg-tag { margin-left: auto; font-size: 10px; padding: 1px 6px; border-radius: 6px; background: #22304d; color: #9ecbff; white-space: nowrap; }
.tp .ngan .nut-mo { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; } .tp .ngan .nut-mo a { flex: 1; text-align: center; text-decoration: none; color: #fff; background: #23305a; border: 1px solid #4a5a8f; border-radius: 8px; padding: 6px 8px; font: 600 11px system-ui; white-space: nowrap; }
@media (max-width: 600px) { .tp .mini { display: none; } }
.tp .tua { position: absolute; left: 50%; transform: translateX(-50%); bottom: 34px; z-index: 5; display: flex; align-items: center; gap: 8px; background: color-mix(in srgb, var(--nen2) 92%, transparent); border: 1px solid var(--vien); border-radius: 999px; padding: 4px 10px; }
.tp .tua input { width: min(46vw, 320px); accent-color: #ffd27a; } .tp .tua button { border: 0; background: transparent; color: var(--chu); font-size: 15px; cursor: pointer; width: 28px; height: 28px; } .tp .tua-ngay { font: 600 11px system-ui; color: #ffd27a; min-width: 62px; text-align: center; }
/* điện thoại: thanh tua xuống đáy bên trái — trên đỉnh nó đè nút thu bảng (góp ý #1434); chừa cụm nút điều hướng + nút 💬 bên phải */
@media (max-width: 600px) { .tp .tua { top: auto; bottom: calc(12px + env(safe-area-inset-bottom)); left: 12px; right: 160px; transform: none; } .tp .tua input { width: auto; flex: 1; min-width: 0; } .tp .ngan:not([hidden]) ~ .tua, .tp .ben:not(.gon) ~ .tua { display: none; } }
/* toàn màn giả cho iPhone (Safari iOS không cho phóng toàn màn một khối thường) — phủ kín khung nhìn, chừa tai thỏ */
.tp.tp-full { position: fixed !important; inset: 0; z-index: 9999; width: 100vw !important; height: 100dvh !important; border-radius: 0 !important; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); box-sizing: border-box; }
.tp .ngan { --wg-tran: 75%; }
@media (max-width: 600px) { .tp .ngan { top: auto; bottom: 12px; left: 12px; right: 12px; width: auto; max-height: 55%; --wg-tran: 55%; } .tp .ngan:not([hidden]) ~ .dieu { display: none; } .tp .ben { width: 156px; } }
@media (pointer: coarse) { .tp .chip { width: 32px; height: 32px; } .tp .lop { padding: 6px 10px; } .tp .seg button { padding: 9px 0; } }
`;

/** Dựng thành phố vào host; trả { don: dọn sạch, capNhat: thay số mới và dựng lại tại chỗ — giữ góc nhìn, bộ lọc, ngăn đang mở } */
// XƯỞNG PHIM MỚI ETHOPEX (anh 23/10/2026: "quá trình sản xuất phải nhìn được realtime trên city"): băng chuyền 6 trạm, trạm đang chạy sáng + thanh tiến độ,
// nhịp gần nhất (bước · lô · phim · x/y · bao lâu) + sức máy iMac. Số từ /api/social/thanh-pho/xuong (5 giây/lần).
export type XuongEtp = { luc: string; nhip: { buoc: string; lo?: string | null; phim?: string | null; xong?: number | null; tong?: number | null; loi?: string | null; bat_dau?: string | null; luc: string; may?: { tai: number | null; nhan: number; trong_gb: number; che_do: string; ten: string } } | null;
  tram: Record<'kho' | 'poster' | 'soat' | 'len' | 'loai' | 'da_len', { so: number; nhan: string; loai?: number; ds?: { id: string; ten: string; ghi: string; luc: string }[] }>; chi_tieu: { ngay: string; da: number; can: number }; tong: number };
const BUOC_TRAM: Record<string, number> = { tai: 2, cat: 2, soat: 3, day: 4, len: 5, sua: 5 };
/** trạm đang chạy theo nhịp xưởng (-1 = nghỉ / chưa có nhịp) — một chỗ cho bảng nổi, thẻ, nhà máy 3D */
const tramDangChay = (n: XuongEtp['nhip'] | undefined): number => (n && n.buoc !== 'nghi' ? BUOC_TRAM[n.buoc] ?? -1 : -1);
/** phim chờ ở trạm nào thì rời trạm khi BƯỚC nào chạy: chờ cắt (1) ← cắt (2) · chờ soát luật FB (3) ← chính bước soát (3) · chờ lên camp (4) ← tạo camp (5) */
const BUOC_DI: Record<number, number> = { 1: 2, 3: 3, 4: 5 };
const TEN_BUOC: Record<string, string> = { tai: 'tải tập phim', cat: 'chọn khung + dựng đoạn', soat: 'soát luật FB (18+, bạo lực, máu…)', day: 'đẩy creative + cổng chữ', len: 'tạo camp', sua: 'sửa CTA / góc mới', nghi: 'nghỉ' };
function veXuong(cv: HTMLCanvasElement, x: XuongEtp | null, bay = performance.now()) {
  const g = cv.getContext('2d')!, W = cv.width, H = cv.height; g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(12,16,28,.92)'; g.beginPath(); g.roundRect(4, 4, W - 8, H - 8, 28); g.fill(); g.strokeStyle = '#3a6ff0'; g.lineWidth = 4; g.stroke();
  g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.font = '800 46px system-ui, "Apple Color Emoji", sans-serif'; g.textAlign = 'left'; g.fillText('🏭 XƯỞNG PHIM MỚI · ETHOPEX', 36, 56);
  if (!x) { g.font = '500 34px system-ui'; g.fillStyle = '#9aa3b8'; g.fillText('đang đọc số xưởng…', 36, 140); return; }
  const ct = x.chi_tieu, du = ct.da >= ct.can; g.textAlign = 'right'; g.font = '800 44px system-ui'; g.fillStyle = du ? '#3fd68a' : '#ffd166'; g.fillText(`hôm nay ${ct.da}/${ct.can} phim`, W - 36, 56);
  const n = x.nhip, sang = tramDangChay(n), cu = n ? (Date.now() - Date.parse(n.luc)) / 1000 : 1e9;
  const t = x.tram, tr: [string, string, string][] = [['📚', 'Kho phim', `${t.kho.so} chờ`], ['🖼', 'Soát poster', `${t.poster.so} đạt`], ['✂️', 'Cắt đoạn', ''], ['🚫', 'Soát luật FB', `${t.soat.so} chờ`], ['🔤', 'Cổng chữ', `${t.len.so} chờ lên`], ['🚀', 'Lên camp', `${t.da_len.so} đã lên`]];
  const bw = 236, gap = 24, x0 = (W - (bw * 6 + gap * 5)) / 2, y0 = 110, bh = 210;
  // BĂNG CHUYỀN CHẠY (góp ý #1446 "show flow như đang triển khai: xe chở, nhân viên đi lại bê vác"): dải băng dưới các trạm, vạch băng trôi;
  // xe 🚚 chạy từ trạm có hàng sang trạm kế (đoạn nào còn hàng chờ chuyển / trạm sau đang chạy) · người 🧑‍🏭 bê 📦 đi lại trong trạm đang chạy
  const yB = y0 + bh + 26, xa = x0 + bw / 2, xb = x0 + 5 * (bw + gap) + bw / 2;
  g.strokeStyle = '#26324d'; g.lineWidth = 16; g.lineCap = 'round'; g.beginPath(); g.moveTo(xa, yB); g.lineTo(xb, yB); g.stroke();
  g.strokeStyle = '#3d5280'; g.lineWidth = 3; g.setLineDash([18, 18]); g.lineDashOffset = -(bay / 40) % 36; g.beginPath(); g.moveTo(xa, yB); g.lineTo(xb, yB); g.stroke(); g.setLineDash([]); g.lineCap = 'butt';
  const coHang = [t.kho.so, t.poster.so, sang === 2 ? 1 : 0, t.soat.so, t.len.so, 0];
  g.font = '34px "Apple Color Emoji", system-ui'; g.textAlign = 'center';
  // xe đỗ ở cửa trạm có hàng chờ (không chạy vòng — xe thật chạy trong nhà máy 3D khi phim xong bước)
  for (let i = 0; i < 5; i++) { if (!(coHang[i]! > 0)) continue; const ax = x0 + i * (bw + gap) + bw - 20; g.save(); g.translate(ax, yB - 4); g.scale(-1, 1); g.fillText('🚚', 0, 0); g.restore(); }
  tr.forEach(([ic, ten, so], i) => {
    const bx = x0 + i * (bw + gap), on = i === sang, loi = on && !!n?.loi; if (on) g.globalAlpha = .82 + .18 * Math.sin(bay / 300);
    g.fillStyle = loi ? '#4a1a22' : on ? '#1d3a66' : '#1a2132'; g.beginPath(); g.roundRect(bx, y0, bw, bh, 18); g.fill();
    g.strokeStyle = loi ? '#ff4d5e' : on ? '#59a8ff' : '#33405e'; g.lineWidth = on ? 6 : 3; g.stroke(); g.globalAlpha = 1;
    g.textAlign = 'center'; g.font = '48px "Apple Color Emoji", system-ui'; g.fillText(ic, bx + bw / 2, y0 + 48);
    g.fillStyle = '#fff'; g.font = '700 30px system-ui'; g.fillText(ten, bx + bw / 2, y0 + 104);
    g.fillStyle = on ? '#9ecbff' : '#c7cede'; g.font = '600 28px system-ui';
    if (on && n?.tong) { g.fillText(`${n.xong ?? 0}/${n.tong}`, bx + bw / 2, y0 + 146); const p = Math.min(1, (n.xong ?? 0) / n.tong); g.fillStyle = '#22304d'; g.fillRect(bx + 20, y0 + 172, bw - 40, 14); g.fillStyle = '#3fd68a'; g.fillRect(bx + 20, y0 + 172, (bw - 40) * p, 14); }
    else g.fillText(i === 2 ? (on ? '▶ đang chạy' : '—') : so, bx + bw / 2, y0 + (on ? 140 : 150));
  });
  // người bê thùng: vẽ SAU ô trạm (trên cùng), ở dải đáy ô dưới dòng số — không bị nền ô che, không đè chữ
  if (sang >= 0 && !(n?.tong)) { const bx = x0 + sang * (bw + gap); g.font = '26px "Apple Color Emoji", system-ui'; g.textAlign = 'center'; g.globalAlpha = 1;
    for (let k = 0; k < 2; k++) { const p = (Math.sin(bay / 700 + k * Math.PI) + 1) / 2, px = bx + 30 + (bw - 60) * p, py = y0 + bh - 18 - Math.abs(Math.sin(bay / 160 + k)) * 4;
      g.fillText('🧑‍🏭', px, py); g.font = '20px "Apple Color Emoji", system-ui'; g.fillText('📦', px + (Math.cos(bay / 700 + k * Math.PI) > 0 ? 18 : -18), py - 12); g.font = '26px "Apple Color Emoji", system-ui'; } }
  g.textAlign = 'left'; g.font = '600 30px system-ui'; g.fillStyle = n?.loi ? '#ff8a80' : '#e6ebf5'; g.textBaseline = 'middle';
  const lau = n?.bat_dau ? Math.round((Date.now() - Date.parse(n.bat_dau)) / 60000) : null;
  g.fillText(n ? `▶ ${TEN_BUOC[n.buoc] ?? n.buoc}${n.lo ? ` · lô ${n.lo}` : ''}${n.phim ? ` · ${n.phim}` : ''}${lau != null && n.buoc !== 'nghi' ? ` · ${lau} phút` : ''}${n.loi ? ` · ⚠ ${n.loi}` : ''}`.slice(0, 95) : '▶ chưa có nhịp', 36, 372);
  const m = n?.may; g.fillStyle = '#9aa3b8'; g.font = '500 28px system-ui';
  g.fillText(m ? `💻 ${m.ten} · tải ${m.tai ?? '?'}/${m.nhan} lõi · ổ trống ${m.trong_gb} GB · ${m.che_do}` : '', 36, 420);
  g.fillText(`loại ${t.loai.so} phim · poster loại ${t.poster.loai ?? 0} · danh sách ${x.tong} phim`, 36, 464);
  g.textAlign = 'right'; g.fillStyle = cu > 900 && n?.buoc !== 'nghi' ? '#ff8a80' : '#6f7891'; g.fillText(cu < 90 ? `nhịp ${Math.round(cu)} giây trước` : `nhịp ${Math.round(cu / 60)} phút trước${cu > 900 && n?.buoc !== 'nghi' ? ' · có thể đã dừng' : ''}`, W - 36, 464);
}

export function dungThanhPho(host: HTMLElement, mh0: PhoMoHinh, THREE: any): { don: () => void; capNhat: (mh: PhoMoHinh) => void; capNhatXuong: (x: XuongEtp) => void } {
  let xuongData: XuongEtp | null = null, xuongVe: ((x: XuongEtp | null) => void) | null = null, xuongDong: { cv: HTMLCanvasElement; tx: any; bien: any } | null = null, mocXuong = 0;
  let mh = mh0;
  host.classList.add('tp'); host.innerHTML = `<style>${CSS}</style>
    <aside class="ben wg"><div class="wg-dau" title="Kéo để dời · kéo cạnh / góc để đổi cỡ"><span class="wg-ten">Bảng</span><button class="wg-x" aria-label="Đóng bảng" title="Đóng bảng">×</button></div><div class="wg-than">
      <b>Tìm</b><div class="tim"><input type="search" placeholder="site, app, kênh, dự án…" aria-label="Tìm trong thành phố" /><div class="tim-ds" hidden></div></div>
      <b>Sức sống</b><div class="song" data-o="song"></div>
      <b>Lớp</b><div class="hang" data-o="lop"></div>
      <b>Điều khiển</b><div class="dk">
        <label><input type="checkbox" data-dk="daoTruot"> Đảo chiều vuốt 2 ngón</label>
        <label><input type="checkbox" data-dk="daoPhong"> Đảo chiều phóng (lăn / chụm)</label>
        <label>Lăn chuột <select data-dk="lan"><option value="truot">trượt · Shift + lăn = phóng</option><option value="phong">phóng</option></select></label>
        <label>Kéo chuột / 1 ngón <select data-dk="keo"><option value="xoay">xoay</option><option value="truot">trượt</option></select></label>
        <label>Tốc độ xoay <input type="range" min="0.4" max="2" step="0.1" data-dk="tocXoay"></label></div>
      <b>Traffic</b><div class="hang" data-o="loc-nen"></div>
      <b>Phường</b><div class="hang" data-o="loc-lv"></div>
      <b>Khu</b><div class="hang" data-o="loc-sp"></div></div></aside>
    <button class="thu" aria-label="Mở bảng" title="Mở bảng">☰</button>
    <aside class="ngan wg" hidden><div class="wg-dau" title="Kéo để dời · kéo cạnh / góc để đổi cỡ"><span class="wg-ten">Chi tiết</span><button class="wg-x" aria-label="Đóng" title="Đóng">×</button></div><div class="wg-than"></div></aside>
    <div class="dieu" role="group" aria-label="Điều hướng">
      <button data-d="trai" aria-label="Xoay trái" title="Xoay trái">⟲</button><button data-d="phai" aria-label="Xoay phải" title="Xoay phải">⟳</button>
      <button data-d="vao" aria-label="Phóng to" title="Phóng to">＋</button><button data-d="ra" aria-label="Thu nhỏ" title="Thu nhỏ">－</button>
      <button data-d="goc" aria-label="Đi qua các nơi đang có khách" title="Đi qua các nơi đang có khách (mỗi lần bấm một nơi) · hết vòng về toàn cảnh">⌂</button><button data-d="full" aria-label="Toàn màn hình" title="Toàn màn hình">⛶</button><button data-d="ngay" class="rong" aria-label="Ngày / đêm">🌙</button><button data-d="datLai" class="rong" aria-label="Đặt lại màn" title="Đặt lại màn: về toàn cảnh, bảng / ngăn về chỗ cũ, đóng thẻ">↺</button></div>
    <!-- thanh tua 30 ngày: ẩn theo lời anh 23/10/2026 ("giờ chưa cần dùng") — bỏ hidden là hiện lại, mã tua vẫn nguyên -->
    <div class="tua" hidden><button data-tua="choi" aria-label="Tua 30 ngày" title="Tua lại 30 ngày">▶</button><input type="range" min="0" max="29" value="29" aria-label="Ngày" /><span class="tua-ngay">bây giờ</span><button data-tua="nay" aria-label="Về bây giờ" title="Về bây giờ">⟳</button></div>
    <canvas class="mini" width="200" height="110" aria-label="Bản đồ nhỏ — bấm để bay tới"></canvas>
    <div class="meo" hidden></div>`;
  const q = <T extends HTMLElement>(s: string) => host.querySelector(s) as T;
  const ben = q<HTMLElement>('.ben'), thuBtn = q<HTMLButtonElement>('.thu'), ngan = q<HTMLElement>('.ngan'), meo = q<HTMLElement>('.meo');
  // WIDGET CHUẨN (góp ý city #1441 + anh 23/10/2026 "header sticky, nút close, resize 4 phía 4 góc"): một hàm cho mọi bảng nổi — đầu .wg-dau kéo để dời
  // (kẹp trong khung), nút × gọi `dong`, 8 tay cầm .wg-k đổi cỡ từ 4 cạnh + 4 góc; chỗ + cỡ nhớ theo máy, ↺ Đặt lại màn xoá. Nội dung vẽ lại vào .wg-than.
  const widgetRo: ResizeObserver[] = [];
  function widget(el: HTMLElement, khoa: string, dong: () => void) {
    if (el.dataset.w) return; el.dataset.w = '1';
    for (const h of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) { const k = document.createElement('div'); k.className = 'wg-k'; k.dataset.h = h; el.appendChild(k); }
    (el.querySelector('.wg-x') as HTMLButtonElement).onclick = (e) => { e.stopPropagation(); dong(); };
    // chưa đặt cỡ cao riêng thì trần cao = phần khung còn lại dưới mép trên → dời xuống không bị lòi đáy (tay cầm đáy luôn trong màn)
    const ap = (v: { x?: number; y?: number; w?: number; h?: number }) => { if (v.x != null && v.y != null) Object.assign(el.style, { left: `${v.x}px`, top: `${v.y}px`, right: 'auto', bottom: 'auto' });
      if (v.w) el.style.width = `${v.w}px`; if (v.h) { el.style.height = `${Math.min(v.h, host.clientHeight - el.offsetTop - 4)}px`; el.style.maxHeight = 'none'; }
      else if (v.y != null && !el.style.height) el.style.maxHeight = `min(calc(100% - ${v.y + 8}px), var(--wg-tran, 100%))`; };   // trần riêng của bảng (--wg-tran: ngăn chi tiết 75%, điện thoại 55%) — góp ý #1444 ngăn cao hết màn
    const doc_ = () => { try { return JSON.parse(localStorage.getItem(khoa) ?? '{}'); } catch { return {}; } };
    const ghi = () => { try { localStorage.setItem(khoa, JSON.stringify({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight })); } catch { /* chế độ riêng tư */ } };
    ap(doc_());
    let keo: { id: number; h: string | null; x0: number; y0: number; l: number; t: number; w: number; hh: number } | null = null;
    el.addEventListener('pointerdown', (e) => { const t = e.target as HTMLElement; if (t.closest('.wg-x')) return; const tay = t.closest('.wg-k') as HTMLElement | null;
      if (!tay && !t.closest('.wg-dau')) return; keo = { id: e.pointerId, h: tay?.dataset.h ?? null, x0: e.clientX, y0: e.clientY, l: el.offsetLeft, t: el.offsetTop, w: el.offsetWidth, hh: el.offsetHeight };
      el.setPointerCapture(e.pointerId); e.preventDefault(); });
    el.addEventListener('pointermove', (e) => { if (!keo || e.pointerId !== keo.id) return; const dx = e.clientX - keo.x0, dy = e.clientY - keo.y0, HW = host.clientWidth, HH = host.clientHeight;
      if (!keo.h) { ap({ x: Math.max(0, Math.min(HW - 60, keo.l + dx)), y: Math.max(0, Math.min(HH - 30, keo.t + dy)) }); return; }
      const MW = 180, MH = 120; let { l, t, w, hh } = keo; hh = Math.min(hh, HH - t);
      if (keo.h.includes('e')) w = Math.max(MW, Math.min(HW - l, w + dx));
      if (keo.h.includes('s')) hh = Math.max(MH, Math.min(HH - t, hh + dy));
      if (keo.h.includes('w')) { const w2 = Math.max(MW, Math.min(l + w, w - dx)); l += w - w2; w = w2; }
      if (keo.h.includes('n')) { const h2 = Math.max(MH, Math.min(t + hh, hh - dy)); t += hh - h2; hh = h2; }
      ap({ x: l, y: t, w, h: hh }); });
    const tha = (e: PointerEvent) => { if (!keo || e.pointerId !== keo.id) return; keo = null; ghi(); };
    el.addEventListener('pointerup', tha); el.addEventListener('pointercancel', tha);
  }
  const datLaiWidget = () => { for (const [el, k] of [[ben, 'tp-w-ben'], [ngan, 'tp-w-ngan']] as const) { try { localStorage.removeItem(k); } catch { /* chế độ riêng tư */ } for (const p_ of ['left', 'top', 'right', 'bottom', 'width', 'height', 'maxHeight'] as const) el.style[p_] = ''; } };
  const W = () => host.clientWidth, H = () => host.clientHeight;

  // máy cảm ứng (điện thoại / máy tính bảng) nóng máy khi vẽ liên tục (góp ý 23/10/2026): giảm mật độ điểm ảnh + bản đồ bóng nhỏ hơn
  const camUng = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: camUng ? 'low-power' : 'default' }); r.setPixelRatio(Math.min(camUng ? 1.25 : 1.5, devicePixelRatio)); r.setSize(W(), H()); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.shadowMap.autoUpdate = false;   // bóng toà đứng yên: chỉ tính lại khi dựng / đổi ngày đêm (needsUpdate), không tính lại mỗi khung
  host.prepend(r.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#060914'); // màn dọc (điện thoại): nhìn từ đầu phố để đại lộ chạy dọc màn, lùi xa cho vừa bề ngang hẹp; sương mù lùi theo
  const doc = H() > W();
  scene.fog = doc ? new THREE.Fog('#060914', 2400, 4400) : new THREE.Fog('#060914', 1300, 2600);
  const cam = new THREE.PerspectiveCamera(40, W() / H(), 1, 6000);
  const CAM0 = doc ? new THREE.Vector3(60 - 1500, 1750, 20) : new THREE.Vector3(60, 760, 860), TAM0 = new THREE.Vector3(60, 0, 20); cam.position.copy(CAM0);
  const ctl = new THREE.MapControls(cam, r.domElement); ctl.screenSpacePanning = false; ctl.panSpeed = 1.2; ctl.rotateSpeed = .6; ctl.dampingFactor = .12; ctl.enableDamping = true;
  // ĐIỀU KHIỂN CHUẨN 3D (anh 23/10/2026 "muốn xoay phải bấm 2 lần touchpad rồi di 3 phím — chuẩn 3D control thế nào thì dùng"): như Sketchfab / Google Earth / three.js OrbitControls —
  // chuột / touchpad: kéo = XOAY · Shift / Ctrl / ⌘ + kéo hoặc chuột phải = TRƯỢT · lăn chuột hoặc chụm 2 ngón = PHÓNG · vuốt 2 ngón touchpad = TRƯỢT (như bản đồ) · xoay 2 ngón (Safari) = XOAY
  // màn cảm ứng giữ kiểu bản đồ: 1 ngón trượt, 2 ngón chụm phóng + xoay
  // enableZoom PHẢI bật: cờ này cũng mở chụm 2 ngón trên màn cảm ứng (góp ý #1435 — tắt nó để tự xử lăn chuột làm iPhone mất phóng);
  // lăn chuột / touchpad thì chặn ở khung chứa (bắt sớm, stopPropagation) trước khi tới bộ điều khiển — xem onWheel
  // 2 ngón trên màn cảm ứng KHÔNG giao cho bộ điều khiển (góp ý 23/10/2026 "zoom không focus vào điểm giữa 2 ngón, thỉnh thoảng bị lệch"): bản r128 phóng về tâm nhìn,
  // còn iPhone bắn thêm gesturechange khiến xoay hai lần → tự xử ở onCham2 (phóng + xoay + trượt quanh điểm mặt đất dưới giữa hai ngón, như bản đồ)
  // TRƯỢT + PHÓNG + CHỤM đều tự xử, neo vào điểm mặt đất dưới tay (keoDat / onCham2 / onWheel); bộ điều khiển chỉ còn XOAY
  // (anh 23/10/2026 "không zoom, pan đúng chỗ cần": trượt của r128 đi theo tỉ lệ khoảng cách tâm nhìn → điểm dưới ngón trôi khỏi ngón khi nhìn nghiêng)
  ctl.touches = { ONE: -1 as any, TWO: -1 as any }; ctl.enablePan = false; ctl.enableZoom = false;
  // CÀI ĐẶT ĐIỀU KHIỂN (anh 23/10/2026 "chỗ config control như invert scroll — giống các app 3D"): đảo chiều vuốt, đảo chiều phóng, kéo = xoay / trượt, tốc độ xoay; nhớ theo máy
  type CaiDk = { daoTruot: boolean; daoPhong: boolean; keo: 'xoay' | 'truot'; tocXoay: number; lan: 'truot' | 'phong' };
  const DK0: CaiDk = { daoTruot: false, daoPhong: false, keo: 'xoay', tocXoay: 1, lan: 'truot' };
  let dk: CaiDk = (() => { try { const v = { ...DK0, ...JSON.parse(localStorage.getItem('tp-dk') ?? '{}') }; if (v.lan !== 'phong') v.lan = 'truot'; return v; } catch { return { ...DK0 }; } })();
  const apDk = () => { ctl.mouseButtons = dk.keo === 'xoay' ? { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN } : { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }; ctl.rotateSpeed = .6 * dk.tocXoay; };
  apDk();
  ctl.maxPolarAngle = Math.PI * 0.47; ctl.minDistance = 60; ctl.maxDistance = doc ? 3200 : 1600; ctl.zoomSpeed = 1.6; ctl.target.copy(TAM0);
  // KẸP TÂM NHÌN trong thành phố (+ lề 25%) bằng cách DỜI CẢ camera theo cùng một đoạn — trước đây chỉ kéo tâm nhìn về, camera đứng nguyên → hướng nhìn
  // quay ngoắt tới 34° mỗi lần phóng / chụm / trượt chạm mép (anh 23/10/2026 "không điều khiển nổi, không zoom / pan đúng chỗ"; đo ở thu-lech)
  ctl.addEventListener('change', () => { const lx = (gioiHan.x1 - gioiHan.x0) * .25, lz = gioiHan.z * .5;
    const tx = Math.max(gioiHan.x0 - lx, Math.min(gioiHan.x1 + lx, ctl.target.x)), tz = Math.max(-gioiHan.z - lz, Math.min(gioiHan.z + lz, ctl.target.z));
    const dx = tx - ctl.target.x, dy = -ctl.target.y, dz = tz - ctl.target.z; if (dx || dy || dz) { ctl.target.set(tx, 0, tz); cam.position.x += dx; cam.position.y += dy; cam.position.z += dz; } });
  const hemi = new THREE.HemisphereLight('#8ea4ff', '#090c18', 0.5); scene.add(hemi);
  let gioiHan = { x0: -700, x1: 700, z: 400 }, daDatCam = false;
  const banKinhKhu: Record<string, number> = {};   // bán kính rào mỗi khu — bay tới khu lùi đủ xa để thấy trọn khu, cổng, poster
  // GÓC NHÌN NHỚ QUA F5 (anh 22/10/2026): vị trí camera + tâm nhìn lưu ở trình duyệt mỗi lần dừng kéo / phóng / xoay và mỗi lần bay xong;
  // mở lại thì về đúng chỗ đó. Nút ⌂ vẫn về góc toàn cảnh. Riêng từng máy (localStorage), hỏng / chế độ riêng tư thì mở góc toàn cảnh như cũ.
  const KHOA_CAM = 'tp-cam';
  const luuCam = () => { try { localStorage.setItem(KHOA_CAM, JSON.stringify({ p: cam.position.toArray(), t: ctl.target.toArray() })); } catch { /* chế độ riêng tư */ } };
  const camDaLuu: { p: number[]; t: number[] } | null = (() => { try { const v = JSON.parse(localStorage.getItem(KHOA_CAM) ?? 'null'); const so = v ? [...v.p, ...v.t] : []; return so.length === 6 && so.every(Number.isFinite) ? v : null; } catch { return null; } })();
  ctl.addEventListener('end', luuCam);
  const trang = new THREE.DirectionalLight('#cfd8ff', 0.55); trang.position.set(-260, 420, 180); trang.castShadow = true; trang.shadow.mapSize.set(camUng ? 1024 : 2048, camUng ? 1024 : 2048);
  Object.assign(trang.shadow.camera, { left: -700, right: 700, top: 450, bottom: -450 }); scene.add(trang);
  const dat = new THREE.Mesh(new THREE.PlaneGeometry(2000, 1200), new THREE.MeshStandardMaterial({ color: '#0b1022', roughness: 1 })); dat.rotation.x = -Math.PI / 2; dat.receiveShadow = true; scene.add(dat);

  let the = new THREE.Group(); scene.add(the);
  const M = (o: any) => new THREE.MeshStandardMaterial(o);
  const NHUA = M({ color: '#1a2036', roughness: .95 }), GACH = M({ color: '#2a3352', roughness: .9 });
  // CỠ NGƯỜI / XE (anh 24/10/2026 "người, xe bé quá, nhìn như con kiến"): một chỗ phóng cho mọi người đi bộ (khách thật + người nền) và mọi xe (luồng khách, xe ra vào khu, xe nền)
  const CO_NGUOI = 2.2, CO_XE = 2.2, Y_XE = .9 * CO_XE + .4;
  let ongDs: { cv: any; t: number; toc: number; mau: any }[] = [], ongXung: any = null;
  // chuyến trong nhà máy phim: xe giữa các trạm (mang biển tên phim đang chở) + xe tới toà camp vừa lên + người bê thùng ở trạm đang chạy
  const khuXuongPhim = () => (mh.duAn.some((x) => x.khoa === 'd:ethopex~2') ? 'd:ethopex~2' : 'd:ethopex'), congSauKhu = new Map<string, any>(); let duongChuyen: any[] = [];
  let xuongPhim: { tram: any[]; cong: any | null; cuaZ: number; zF: number; phia: number } | null = null, chuyenDs: { o: any; a: any; b: any; t: number; toc: number; di?: boolean; duong?: any; mot?: () => void; nguoi?: boolean }[] = [], khoaBienDem = ''; const viTriCamp = new Map<string, any>();
  const TRAM_XP: [string, string, string][] = [['📚', 'Kho phim', '#3a4a6e'], ['🖼', 'Soát poster', '#3d5a7a'], ['✂️', 'Cắt đoạn', '#5a4a7a'], ['🚫', 'Soát luật FB', '#7a3d4a'], ['🔤', 'Cổng chữ', '#3d6a5a'], ['🚀', 'Lên camp', '#7a5a2a']];
  const bienXe = (chu: string, mau: string) => { const cv = document.createElement('canvas'); cv.width = 640; cv.height = 96; const g = cv.getContext('2d')!; g.font = '700 44px system-ui, "Apple Color Emoji", sans-serif';
    let t = chu; while (g.measureText(t).width > 600 && t.length > 8) t = t.slice(0, -2); if (t !== chu) t = t.trimEnd() + '…';
    const w = Math.min(632, g.measureText(t).width + 36); g.fillStyle = 'rgba(10,14,24,.9)'; g.beginPath(); g.roundRect((640 - w) / 2, 6, w, 84, 18); g.fill(); g.strokeStyle = mau; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 320, 50);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthWrite: false })); sp.scale.set(36, 5.4, 1); sp.userData = { chu: null }; return sp; };
  /** ĐƯỜNG XE NHÀ MÁY (anh 24/10/2026 "phải vẽ đường đi chứ không để xe chạy bừa bãi"): dải đường + vạch vàng giữa theo một tuyến gấp khúc; trả tuyến (CurvePath) cho xe chạy theo */
  const veDuongXe = (pts: any[], ra: any[] = duongChuyen) => { const tuyen = new THREE.CurvePath(), q: number[] = [], vach: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i]!, b = pts[i + 1]!; if (a.distanceTo(b) < .5) continue; tuyen.add(new THREE.LineCurve3(a.clone().setY(0), b.clone().setY(0)));
      const d = b.clone().sub(a).setY(0).normalize(), n = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(5.5), a2 = a.clone().addScaledVector(d, -5.5), b2 = b.clone().addScaledVector(d, 5.5);
      for (const v of [a2.clone().add(n), a2.clone().sub(n), b2.clone().add(n), a2.clone().sub(n), b2.clone().sub(n), b2.clone().add(n)]) q.push(v.x, .42, v.z);
      vach.push(a.x, .5, a.z, b.x, .5, b.z); }
    if (q.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(q, 3)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#2b3142', side: THREE.DoubleSide })); m.userData = { chu: null, luonVe: true }; the.add(m); ra.push(m);
      const gv = new THREE.BufferGeometry(); gv.setAttribute('position', new THREE.Float32BufferAttribute(vach, 3)); const lv = new THREE.LineSegments(gv, new THREE.LineDashedMaterial({ color: '#ffd166', dashSize: 4, gapSize: 4 })); lv.computeLineDistances(); lv.userData = { chu: null, luonVe: true }; the.add(lv); ra.push(lv); }
    return tuyen; };
  // XE THEO SỰ KIỆN THẬT (anh 24/10/2026: "không chuyển động miễn cưỡng — đang chờ render / duyệt thì để sẵn xe ở cửa, xong thì xe đó chạy thật sang bước tiếp"):
  // mỗi phim một xe, đỗ ở cửa trạm nó đang chờ; lượt số mới (5 giây) thấy phim đã sang trạm sau → đúng xe đó chạy MỘT LẦN theo đường tới cửa trạm mới rồi đỗ;
  // vừa lên camp → chạy qua cổng sau tới đúng toà camp, giao xong thì biến mất. Lần đầu mở trang: mọi xe đỗ sẵn, không chạy.
  /** "HH:MM DD/MM/YYYY" (giờ VN, cách xưởng ghi) → "1 giờ 20 phút" tính tới bây giờ; không đọc được thì trả lại nguyên chữ */
  const thoiGianCho = (luc: string) => { const m = /^(\d{1,2}):(\d{2}) (\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(luc ?? ''); if (!m) return luc ?? '';
    const ph = Math.max(0, Math.round((Date.now() - Date.UTC(+m[5]!, +m[4]! - 1, +m[3]!, +m[1]! - 7, +m[2]!)) / 60000)); return ph < 60 ? `${ph} phút` : ph < 1440 ? `${Math.floor(ph / 60)} giờ ${ph % 60} phút` : `${Math.floor(ph / 1440)} ngày ${Math.floor((ph % 1440) / 60)} giờ`; };
  /** một mục danh sách phim của xưởng (gập được, lô chung ghi ở đầu mục, choLau = ghi đã chờ bao lâu) — thẻ cả xưởng lẫn thẻ từng trạm dùng chung */
  const dsXuong = (x: XuongEtp, ic: string, ten: string, k: 'poster' | 'soat' | 'len' | 'da_len' | 'loai', mo: boolean, cuoi = 0, choLau = false) => { let ds = x.tram[k].ds ?? []; if (cuoi) ds = ds.slice(-cuoi); if (!ds.length) return '';
    const ghi = new Set(ds.map((p) => p.ghi)), chung = ghi.size === 1 ? [...ghi][0] : '';
    return `<details class="xg-ds"${mo ? ' open' : ''}><summary>${ic} ${ten} <b>${ds.length}</b>${chung ? `<span class="xg-tag">${esc(chung)}</span>` : ''}</summary>${ds.map((p) => `<div title="${esc(p.ten)}"><span>${esc(p.ten)}</span>${chung ? '' : `<span class="xg-tag">${esc(p.ghi)}</span>`}${choLau ? `<span class="xg-tag">⏳ ${thoiGianCho(p.luc)}</span>` : ''}</div>`).join('')}</details>`; };
  const XE_DO = 4;   // mỗi cửa trạm đỗ tối đa 4 xe, còn lại ghi số trên biển đếm
  let phimO = new Map<string, { s: number; ten: string; ghi: string; luc: string }>(), xeO = new Map<string, any>(), theCuaXe: any = null, bienDem: any[] = [];
  const TRAM_DS: [number, 'poster' | 'soat' | 'len' | 'da_len', string][] = [[1, 'poster', 'poster đạt, chờ cắt'], [3, 'soat', 'đã cắt, chờ soát luật FB'], [4, 'len', 'soát đạt, chờ lên camp'], [5, 'da_len', 'đã lên camp']];
  const MAU_TRAM = ['#6ea8ff', '#59a8ff', '#b48cff', '#ff8fa3', '#3fd68a', '#ffd166'];
  function dungChuyen() {
    const x = xuongData, xp = xuongPhim; if (!x || !xp) return;
    const t = x.tram, n = x.nhip, sang = tramDangChay(n), dauTien = theCuaXe !== the;
    if (dauTien) { theCuaXe = the; xeO = new Map(); chuyenDs = []; duongChuyen = []; bienDem = []; khoaBienDem = ''; }   // dựng lại cảnh: xe cũ đi theo cảnh cũ, đỗ lại từ đầu
    // bãi đỗ TRƯỚC cửa trạm (phía ngoài, camera nhìn thấy); khởi hành thì vòng hông trạm ra đường xưởng, tới trạm sau vòng hông vào bãi
    const cua = (st: number) => new THREE.Vector3(xp.tram[st].x, 0, xp.zF + xp.phia * 19), duongO = (st: number) => new THREE.Vector3(xp.tram[st].x, 0, xp.cuaZ);
    const hong = (st: number) => [new THREE.Vector3(xp.tram[st].x + 17, 0, xp.zF + xp.phia * 19), new THREE.Vector3(xp.tram[st].x + 17, 0, xp.cuaZ)];
    const theTin = (id: string, v: { s: number; ten: string; ghi: string; luc: string }) => ({ 'Phim': esc(v.ten), ...(v.ghi ? { 'Ghi': esc(v.ghi) } : {}), 'Đang ở': `${TRAM_XP[v.s]![0]} ${TRAM_XP[v.s]![1]} — ${TRAM_DS.find((d) => d[0] === v.s)?.[2] ?? ''}`, 'Đã chờ': thoiGianCho(v.luc), 'Từ lúc': esc(v.luc), 'Mã': id });
    const taoXe = (id: string, v: { s: number; ten: string; ghi: string; luc: string }) => {
      const mau = MAU_TRAM[v.s]!, m = add(new THREE.BoxGeometry(4.2 * CO_XE, 2.2 * CO_XE, 2.4 * CO_XE), M({ color: mau, emissive: mau, emissiveIntensity: .3 }), false);
      const thung = new THREE.Mesh(new THREE.BoxGeometry(2.2 * CO_XE, 1.6 * CO_XE, 2 * CO_XE), M({ color: '#d9b77a', roughness: .8 })); thung.position.set(-.8 * CO_XE, 1.9 * CO_XE, 0); m.add(thung);
      const bn = bienXe(`${TRAM_XP[v.s]![0]} ${v.ten}`, mau); bn.position.set(0, 9, 0); bn.visible = false; m.add(bn); m.userData = { loai: 'chuyen', tt: { 'Chở': `xe phim ${v.ten}`, ...theTin(id, v) }, bien: bn };
      m.position.copy(cua(v.s)).setY(Y_XE); m.rotation.y = Math.PI / 2 * xp.phia; xeO.set(id, m); return m; };
    const chay = (m: any, pts: any[], xong: () => void) => { const rieng: any[] = [], duong = veDuongXe(pts, rieng); m.userData.bien.visible = true;   // đường của chuyến vẽ khi xe chạy, tới nơi thì gỡ
      chuyenDs.push({ o: m, a: pts[0], b: pts[pts.length - 1], t: 0, toc: 1 / Math.max(60, duong.getLength()), duong, mot: () => { for (const o of rieng) the.remove(o); xong(); } }); };
    const moi = new Map<string, { s: number; ten: string; ghi: string; luc: string }>();
    for (const [st, k] of TRAM_DS) for (const p of t[k].ds ?? []) moi.set(p.id, { s: st, ten: p.ten, ghi: p.ghi, luc: p.luc });
    for (const [id, v] of moi) { const cu = phimO.get(id), m0 = xeO.get(id);
      if (dauTien || !cu) { if (v.s < 5) taoXe(id, v); continue; }              // lần đầu / phim mới vào danh sách: đỗ sẵn ở cửa, không chạy
      if (cu.s === v.s) { if (m0) m0.userData.tt = { 'Chở': `xe phim ${v.ten}`, ...theTin(id, v) }; continue; }
      // phim vừa xong bước → xe của nó chạy thật sang trạm mới
      const m = m0 ?? taoXe(id, cu); m.userData.tt = { 'Chở': `xe phim ${v.ten}`, ...theTin(id, v) }; m.userData.dangChay = true;
      if (v.s < 5) chay(m, [m.position.clone().setY(0), ...hong(cu.s), ...hong(v.s).reverse(), cua(v.s)], () => { m.userData.dangChay = false; m.userData.bien.visible = false; xepDo(); });
      else { const ids = (v.ghi.match(/#\d+/g) ?? []).map((c) => viTriCamp.get(`c:${c.slice(1)}`)).filter(Boolean), dich = ids[0], g0 = xp.cong;
        const pts = [m.position.clone().setY(0), ...hong(cu.s), duongO(5), ...(dich && g0 ? [new THREE.Vector3(g0.x, 0, xp.cuaZ), g0, new THREE.Vector3(g0.x, 0, dich.z), dich] : [cua(5)])];
        m.userData.tt['Đến'] = dich ? `toà camp ${esc(v.ghi)}` : '🚀 Lên camp (camp chưa có toà trên city)';
        chay(m, pts, () => { the.remove(m); xeO.delete(id); xepDo(); }); } }
    for (const [id, m] of xeO) if (!moi.has(id) && !m.userData.dangChay) { the.remove(m); xeO.delete(id); }   // bị loại / rời danh sách
    phimO = moi; xepDo();
    // người bê thùng ở trạm đang chạy (việc đang làm thật) — đi lại trong lối trước cửa trạm
    for (const c of [...chuyenDs]) if (c.nguoi) { the.remove(c.o); chuyenDs.splice(chuyenDs.indexOf(c), 1); }
    if (sang >= 0) for (let k = 0; k < 2; k++) { const a = cua(sang).add(new THREE.Vector3(-10 + k * 20, 0, xp.phia * 6)), m = add(new THREE.CylinderGeometry(.55 * CO_NGUOI, .55 * CO_NGUOI, 2.2 * CO_NGUOI, 7), M({ color: '#ffd27a' }), false);
      const th = new THREE.Mesh(new THREE.BoxGeometry(1.3 * CO_NGUOI, 1 * CO_NGUOI, 1 * CO_NGUOI), M({ color: '#d9b77a' })); th.position.set(0, 1.5 * CO_NGUOI, .8 * CO_NGUOI); m.add(th);
      m.userData = { loai: 'chuyen', tt: { 'Người': 'bê thùng', 'Việc': esc(TEN_BUOC[n!.buoc] ?? n!.buoc), ...(n?.lo ? { 'Lô': esc(n.lo) } : {}), 'Trạm': `${TRAM_XP[sang]![0]} ${TRAM_XP[sang]![1]}` } };
      chuyenDs.push({ o: m, a, b: a.clone().add(new THREE.Vector3(0, 0, xp.phia * 9)), t: k * .7, toc: .006, di: true, nguoi: true }); }
  }
  /** xếp xe đang đỗ ở từng cửa trạm (tối đa XE_DO, cũ trước) + biển đếm số phim chờ ở trạm */
  function xepDo() { const xp = xuongPhim, x = xuongData; if (!xp || !x) return;

    const theoTram = new Map<number, string[]>(); for (const [id, v] of phimO) if (xeO.has(id) && !xeO.get(id).userData.dangChay) (theoTram.get(v.s) ?? theoTram.set(v.s, []).get(v.s)!).push(id);
    // xe đang chờ: biển nhỏ trên mỗi xe ghi ĐÃ CHỜ bao lâu (góp ý #1447), hoặc "sắp khởi hành x/y" khi bước đưa phim rời trạm đang chạy (BUOC_DI)
    // biển chờ so le cao thấp (k lẻ cao hơn) — xe kề nhau không chồng biển
    const n = x.nhip, sang = tramDangChay(n);
    for (const [st, ids] of theoTram) ids.forEach((id, k) => { const m = xeO.get(id); m.visible = k < XE_DO; const nn = Math.min(XE_DO, ids.length);
      m.position.set(xp.tram[st].x + (k - (nn - 1) / 2) * 9.5, Y_XE, xp.zF + xp.phia * 19); m.rotation.y = Math.PI / 2 * xp.phia;
      if (!m.visible) return; const v = phimO.get(id)!, chu = sang === BUOC_DI[st] ? `▶ sắp khởi hành${n?.tong ? ` ${n.xong ?? 0}/${n.tong}` : ''}` : `⏳ chờ ${thoiGianCho(v.luc)}`;
      if (m.userData.chuCho !== chu || m.userData.bienCho?.position.y !== (k % 2 ? 9.5 : 6.5)) { if (m.userData.bienCho) m.remove(m.userData.bienCho); const bc = bienXe(chu, sang === BUOC_DI[st] ? '#3fd68a' : '#8e9abd'); bc.scale.set(15, 2.25, 1); bc.position.set(0, k % 2 ? 9.5 : 6.5, 0); m.add(bc); m.userData.bienCho = bc; m.userData.chuCho = chu; } });
    const dem: [number, string][] = [[0, `📚 ${x.tram.kho.so} phim chờ soát poster`], ...TRAM_DS.filter(([st]) => st < 5).map(([st, k, nh]) => [st, `${x.tram[k].so} phim · ${nh}`] as [number, string])];
    const khoa = JSON.stringify(dem); if (khoa === khoaBienDem && bienDem.length) return; khoaBienDem = khoa;   // chữ không đổi thì giữ biển cũ (khỏi đẻ ảnh mới mỗi 5 giây)
    for (const b of bienDem) { the.remove(b); b.material.map?.dispose(); b.material.dispose(); } bienDem = [];
    // biển đếm trên mái trạm, dưới biển tên — không đè dãy xe chờ (góp ý #1447)
    for (const [st, chu] of dem) { const b = bienXe(chu, MAU_TRAM[st]!); b.position.set(xp.tram[st].x, 27, xp.zF); b.scale.set(30, 4.5, 1); b.userData = { loai: 'tram-xp', st }; the.add(b); bienDem.push(b); }
  }

  const MAU_CAMP = { lai: '#3fd68a', lo: '#ff4d5e', viPham: '#b44dff', cho: '#4fd1ff' };
  // SỨC SỐNG (mô hình tinhSucSong — mọi nguồn traffic ngang nhau): đơ = đóng băng xám xanh, tắt đèn, không xe · thoi thóp = mờ · sôi động = vòng sáng trên nóc
  const SUC_SONG = [{ ic: '❄', ten: 'đơ — chưa gắn nguồn traffic nào' }, { ic: '💤', ten: 'thoi thóp — có nguồn mà 7 ngày không khách' }, { ic: '🌱', ten: 'sống — có khách 7 ngày' }, { ic: '🔥', ten: 'sôi động — đang có khách' }] as const;
  const BANG = '#3a4660', BANG_RAO = '#6f7f9c', BANG_NEN = '#151b28';
  const dongBang = (k: { ngung: boolean; sucSong?: number }) => !k.ngung && k.sucSong === 0;
  const dongSucSong = (d: { sucSong?: number; soNguon?: number; khach7?: number }): [string, string] => { const v = SUC_SONG[d.sucSong ?? 0]!; return ['Sức sống', `${v.ic} ${v.ten} · ${d.soNguon ?? 0} nguồn · ${(d.khach7 ?? 0).toLocaleString('en-US')} khách 7 ngày`]; };
  const add = (g: any, m: any, bong = true) => { const x = new THREE.Mesh(g, m); x.castShadow = bong; x.receiveShadow = true; the.add(x); return x; };
  // GỘP VẬT (anh 23/10/2026 "city đang khiến máy tính nóng"): mỗi vật riêng là một lệnh vẽ mỗi khung — cảnh từng có ~5.900 vật.
  // Mảnh phẳng một màu (vạch đường, cửa sổ phòng ban) gom vào MỘT khối vẽ chung dựng cuối lượt (dungGop); bảng chữ nhiều mặt gộp thành một vật.
  const phang: { m: any[]; c: any[] } = { m: [], c: [] }, oP = new THREE.Object3D();
  const oPhang = (x: number, y: number, z: number, w: number, h: number, rx: number, ry: number, rz: number, mau: string) => {
    oP.position.set(x, y, z); oP.rotation.set(rx, ry, rz); oP.scale.set(w, h, 1); oP.updateMatrix(); phang.m.push(oP.matrix.clone()); phang.c.push(new THREE.Color(mau)); };
  /** gộp nhiều mặt phẳng (mỗi mặt một ma trận đặt chỗ) thành một hình — một vật, một lệnh vẽ */
  const gopMat = (rong: number, cao: number, datCho: ((o: any) => void)[]) => {
    const pos: number[] = [], uv: number[] = [], nor: number[] = [], idx: number[] = []; let n = 0;
    for (const dat of datCho) { const g = new THREE.PlaneGeometry(rong, cao); oP.position.set(0, 0, 0); oP.rotation.set(0, 0, 0, 'XYZ'); oP.scale.set(1, 1, 1); dat(oP); oP.updateMatrix(); g.applyMatrix4(oP.matrix);
      const a = g.attributes.position, u = g.attributes.uv, q = g.attributes.normal;
      for (let i = 0; i < a.count; i++) { pos.push(a.getX(i), a.getY(i), a.getZ(i)); uv.push(u.getX(i), u.getY(i)); nor.push(q.getX(i), q.getY(i), q.getZ(i)); }
      for (const i of g.index.array) idx.push(i + n); n += a.count; g.dispose(); }
    const h = new THREE.BufferGeometry(); h.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); h.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); h.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); h.setIndex(idx); return h;
  };
  function pho(x1: number, z1: number, x2: number, z2: number, rong = 12) {
    const dai = Math.hypot(x2 - x1, z2 - z1); if (dai < 1) return; const goc = -Math.atan2(z2 - z1, x2 - x1);
    const m = add(new THREE.PlaneGeometry(dai, rong), NHUA, false); m.rotation.set(-Math.PI / 2, 0, goc); m.position.set((x1 + x2) / 2, .3, (z1 + z2) / 2);
    for (let d = 5; d < dai - 5; d += 12) { const t = d / dai; oPhang(x1 + (x2 - x1) * t, .35, z1 + (z2 - z1) * t, 5, .6, -Math.PI / 2, 0, goc, '#7e8bb3'); }
  }
  // ── vân: logo nền tảng, favicon site, chữ dọc
  const tex: Record<string, any> = {};
  function texIc(khoa: string, nen: string, ve: string) {
    if (tex[khoa]) return tex[khoa];
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!, t = new THREE.CanvasTexture(c); g.fillStyle = nen; g.fillRect(0, 0, 128, 128);
    if (ve.startsWith('<')) { const img = new Image(); img.onload = () => { g.drawImage(img, 24, 24, 80, 80); t.needsUpdate = true; }; img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#fff">${ve}</svg>`)}`; }
    else { g.fillStyle = '#fff'; g.font = '800 70px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ve, 64, 70); }
    return (tex[khoa] = t);
  }
  function texDoc(ten: string, mau: string) {
    const k = `d:${ten}`; if (tex[k]) return tex[k];
    const c = document.createElement('canvas'); c.width = 128; c.height = 1024; const g = c.getContext('2d')!;
    g.translate(64, 512); g.rotate(Math.PI / 2); let co = 92; g.font = `800 ${co}px system-ui, sans-serif`;
    while (g.measureText(ten).width > 980 && co > 30) { co -= 4; g.font = `800 ${co}px system-ui, sans-serif`; }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = co * .12; g.strokeStyle = 'rgba(4,8,20,.85)'; g.strokeText(ten, 0, 4); g.shadowColor = mau; g.shadowBlur = 4; g.fillStyle = '#ffffff'; g.fillText(ten, 0, 4);
    return (tex[k] = new THREE.CanvasTexture(c));
  }
  function texFav(site: string, mau = '#1f8f6c') {
    const k = `f:${site}`; if (tex[k]) return tex[k];
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!, t = new THREE.CanvasTexture(c);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill();
    const f = mh.fav[site];
    if (f) { const img = new Image(); img.onload = () => { g.drawImage(img, 48, 48, 160, 160); t.needsUpdate = true; }; img.src = f; }
    else { g.fillStyle = mau; g.font = '800 150px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(site[0]!.toUpperCase(), 128, 138); }
    return (tex[k] = t);
  }
  /** chữ dán phẳng lên 4 mặt của toà bát giác (mặt, không phải cạnh), nghiêng theo độ thuôn của thân */
  function chuDoc(ten: string, mau: string, x: number, z: number, rDuoi: number, rTren: number, h: number, chu: any, y0 = 0) {
    const t = texDoc(ten, mau), cao = h * .82, ap = Math.cos(Math.PI / 8), rGiua = (rDuoi + rTren) / 2 * ap + .25, rong = Math.min(2 * rTren * Math.sin(Math.PI / 8) * .9, cao / 8 * 1.15), nghieng = Math.atan2((rDuoi - rTren) * ap, h);
    const p = add(gopMat(rong, cao, [0, 1, 2, 3].map((i) => (o: any) => { const goc = Math.PI / 8 + i * Math.PI / 2; o.position.set(x + Math.sin(goc) * rGiua, y0 + h / 2, z + Math.cos(goc) * rGiua); o.rotation.set(0, goc, 0, 'YXZ'); o.rotateX(-nghieng); })),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }), false); p.userData = { chu };
  }
  // BẢNG TÊN TRÊN TƯỜNG (anh 22/10/2026 "phải tận dụng thân toà để điền tên và thông tin, nhìn vào biết ai"): dải biển sát mái, 4 mặt,
  // dòng 1 = tên, dòng 2 = số chính; chữ trắng viền tối cho đọc được cả ngày lẫn đêm
  const texBang = (d1: string, d2: string, mau: string) => {
    const k = `b:${d1}|${d2}|${mau}`; if (tex[k]) return tex[k];
    const c = document.createElement('canvas'); c.width = 512; c.height = 176; const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(8,12,26,.88)'; g.beginPath(); g.roundRect(0, 0, 512, 176, 18); g.fill(); g.fillStyle = mau; g.fillRect(0, 0, 512, 12);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; let co = d2 ? 68 : 84; g.font = `800 ${co}px system-ui, sans-serif`; while (g.measureText(d1).width > 490 && co > 30) { co -= 4; g.font = `800 ${co}px system-ui, sans-serif`; } g.fillText(d1, 256, d2 ? 70 : 96);
    if (d2) { g.fillStyle = '#ffd27a'; let c2 = 50; g.font = `700 ${c2}px system-ui, "Apple Color Emoji", sans-serif`; while (g.measureText(d2).width > 490 && c2 > 24) { c2 -= 3; g.font = `700 ${c2}px system-ui, "Apple Color Emoji", sans-serif`; } g.fillText(d2, 256, 136); }
    return (tex[k] = new THREE.CanvasTexture(c));
  };
  function bangTen(x: number, z: number, w: number, yTren: number, d1: string, d2: string, mau: string, chu: any) {
    const t = texBang(d1, d2, mau), rong = w * .98, cao = Math.min(rong * .36, Math.max(4, yTren * .5));
    const p = add(gopMat(rong, cao, [0, 1, 2, 3].map((i) => (o: any) => { const g = (i * Math.PI) / 2; o.position.set(x + Math.sin(g) * (w / 2 + .12), yTren - cao / 2 - .4, z + Math.cos(g) * (w / 2 + .12)); o.rotation.y = g; })),
      new THREE.MeshBasicMaterial({ map: t, transparent: true }), false); p.userData = { chu };
  }
  const gon = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k` : String(Math.round(n)));
  // vân vạch đứt (dải đường ngầm): khúc sáng – khúc trống, lặp theo chiều dài
  const texVach = () => { if (tex.vach) return tex.vach; const c = document.createElement('canvas'); c.width = 64; c.height = 8; const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, 40, 8);
    const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return (tex.vach = t); };
  // ĐƯỜNG NGẦM — MỘT hàm cho mọi đường dưới đất (social → site, máy chủ → site, khu có tiền → Kho bạc): dải vạch đứt sát đất theo từng đoạn
  // + nhịp sáng chạy dọc (tốc độ theo độ dài, đường dài không chạy vọt). them = userData thêm (tk để lọc theo nền)
  // TẦNG NGẦM (anh 23/10/2026 "làm đường ngầm như đề xuất"): mọi đường ngầm chạy ở độ sâu Y_HAM, hai đầu có trục đứng lên mặt đất;
  // chỉ thấy khi bật lớp 🕳 Tầng ngầm (mặt đất trong suốt) — mặt đất thường gọn, không vạch chồng lên phố
  function duongNgam(pts: any[], mau: string, rong: number, lop: any[], them: Record<string, unknown> = {}, soNhip = 1, toc = .006) {
    const sau = pts.map((p) => new THREE.Vector3(p.x, Y_HAM, p.z)), duong = new THREE.CurvePath();
    for (let i = 0; i < sau.length - 1; i++) { const a = sau[i], b = sau[i + 1], dai = a.distanceTo(b); if (dai < .5) continue;
      duong.add(new THREE.LineCurve3(a, b));
      const t2 = texVach().clone(); t2.needsUpdate = true; t2.repeat.set(dai / 4, 1);
      const day = add(new THREE.PlaneGeometry(dai, rong * 1.4), new THREE.MeshBasicMaterial({ color: mau, map: t2, transparent: true, opacity: .95, depthWrite: false, side: THREE.DoubleSide }), false);
      day.rotation.set(-Math.PI / 2, 0, -Math.atan2(b.z - a.z, b.x - a.x)); day.position.set((a.x + b.x) / 2, Y_HAM, (a.z + b.z) / 2); day.userData = { chu: null, ham: true, ...them }; lop.push(day); }
    if (!duong.curves.length) return;
    for (const p of [sau[0], sau[sau.length - 1]]) { const tr = add(new THREE.CylinderGeometry(rong * .35, rong * .35, -Y_HAM, 6), new THREE.MeshBasicMaterial({ color: mau, transparent: true, opacity: .7 }), false); tr.position.set(p.x, Y_HAM / 2, p.z); tr.userData = { chu: null, ham: true, ...them }; lop.push(tr); }
    const tocT = toc * 50 / Math.max(50, duong.getLength());
    for (let j = 0; j < soNhip; j++) { const n = add(new THREE.SphereGeometry(Math.max(1, rong * .8), 10, 10), new THREE.MeshBasicMaterial({ color: mau }), false); n.userData = { chu: null, ham: true, ...them, duong, t: (j / soNhip + Math.random() * .08) % 1, toc: tocT, nhip: true, y: Y_HAM + .4 }; lop.push(n); }
  }

  // HÌNH KHU (anh 22/10/2026 "đổi cụm tròn thành cụm vuông / hình học đa dạng với hàng rào"): khu dự án = đa giác (vuông · lục giác · bát giác, chọn theo khoá
  // để mỗi lần dựng ra cùng hình), vật trong khu xếp theo chu vi đa giác; quảng trường site = hình vuông. Rào: cọc + hai thanh ngang, chừa cổng phía đại lộ.
  const CANH_KHU = [4, 6, 8];
  const soCanh = (khoa: string) => CANH_KHU[[...khoa].reduce((a, c) => a + c.charCodeAt(0), 0) % CANH_KHU.length]!;
  const dinhDa = (n: number, cx: number, cz: number, R: number) => Array.from({ length: n }, (_, k) => { const g = Math.PI / n + (k * 2 * Math.PI) / n; return new THREE.Vector3(cx + Math.cos(g) * R, 0, cz + Math.sin(g) * R); });
  /** điểm ở tham số t ∈ [0,1) trên chu vi đa giác đều (bán kính ngoại tiếp R) */
  const diemDa = (t: number, n: number, cx: number, cz: number, R: number) => { const v = dinhDa(n, cx, cz, R), u = (((t % 1) + 1) % 1) * n, k = Math.floor(u); return v[k]!.clone().lerp(v[(k + 1) % n]!, u - k); };
  /** bán kính ngoại tiếp để cạnh đa giác (khoảng cách gần nhất tới tâm) không nhỏ hơn r */
  const ngoaiTiep = (r: number, n: number) => r / Math.cos(Math.PI / n);
  // rào cao ~ một tầng toà nhỏ (anh 22/10/2026 "hàng rào nhìn bé và thấp quá"): cọc 1,8 × 11, ba thanh ngang dày, sáng nhẹ để đêm vẫn thấy
  const RAO_CAO = 11;
  const Y_HAM = -16;   // độ sâu tầng ngầm
  let khachDs: { a: any; b: any; t: number; toc: number; onl: boolean }[] = [], imKhach: any = null;
  /** người: thân + đầu gộp một hình, một khối vẽ cho mọi khách mọi site */
  function dungKhach() {
    imKhach = null; if (!khachDs.length) return;
    const than = new THREE.CylinderGeometry(.55, .7, 2.2, 7); than.translate(0, 1.1, 0); const dau = new THREE.SphereGeometry(.55, 8, 6); dau.translate(0, 2.75, 0);
    const g = new THREE.BufferGeometry(), gom = [than.toNonIndexed(), dau.toNonIndexed()];
    for (const k of ['position', 'normal']) g.setAttribute(k, new THREE.Float32BufferAttribute(gom.flatMap((x) => [...x.attributes[k].array]), 3)); g.scale(CO_NGUOI, CO_NGUOI, CO_NGUOI);
    imKhach = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial(), khachDs.length);
    khachDs.forEach((k, i) => imKhach.setColorAt(i, new THREE.Color(k.onl ? '#7dffb2' : '#cfe0ff'))); imKhach.instanceColor.needsUpdate = true; imKhach.userData = { chu: null }; the.add(imKhach); ds.onl!.push(imKhach);
  }
  const rao: { cot: any[]; thanh: any[]; mau: any[]; mauT: any[]; vien: number[]; mauV: number[] } = { cot: [], thanh: [], mau: [], mauT: [], vien: [], mauV: [] };
  /** điểm tia từ tâm (cx, cz) theo hướng (dx, dz) cắt chu vi đa giác — chỗ đặt cổng (mép rào thật, không phải góc ngoại tiếp) + hướng cạnh tại đó */
  const giaoCanh = (dinh: any[], cx: number, cz: number, dx: number, dz: number) => {
    for (let k = 0; k < dinh.length; k++) { const a = dinh[k], b = dinh[(k + 1) % dinh.length], ex = b.x - a.x, ez = b.z - a.z, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue;
      const t = ((a.x - cx) * ez - (a.z - cz) * ex) / den, s2 = ((a.x - cx) * dz - (a.z - cz) * dx) / den;
      if (t > 0 && s2 >= -1e-6 && s2 <= 1 + 1e-6) return { p: new THREE.Vector3(cx + t * dx, 0, cz + t * dz), canh: new THREE.Vector3(ex, 0, ez).normalize() }; }
    return null;
  };
  /** điểm cách một điểm trên chu vi một quãng d (âm = ngược chiều) đi dọc rào */
  const docRao = (dinh: any[], goc: any, d: number) => {
    const dai = dinh.map((a, k) => a.distanceTo(dinh[(k + 1) % dinh.length])), P = dai.reduce((x, y) => x + y, 0); let t0 = 0;
    for (let k = 0, acc = 0; k < dinh.length; acc += dai[k]!, k++) { const a = dinh[k], b = dinh[(k + 1) % dinh.length], ab = a.distanceTo(b), ag = a.distanceTo(goc), gb = goc.distanceTo(b); if (Math.abs(ag + gb - ab) < .5) { t0 = acc + ag; break; } }
    let t = (((t0 + d) % P) + P) % P;
    for (let k = 0; k < dinh.length; k++) { if (t <= dai[k]!) { const a = dinh[k], b = dinh[(k + 1) % dinh.length]; return { p: a.clone().lerp(b, t / dai[k]!), canh: b.clone().sub(a).normalize() }; } t -= dai[k]!; }
    return { p: goc.clone(), canh: new THREE.Vector3(1, 0, 0) };
  };
  /** ma = chỉ số poster nói (hover poster → bảng chi tiết đúng chỉ số đó theo từng đích / nền) */
  type Poster = { ic: string; so: string; nhan: string; ma: string };
  const texPoster = (x: Poster, mau: string) => { const k = `po:${x.ic}|${x.so}|${x.nhan}|${mau}`; if (tex[k]) return tex[k];
    const c = document.createElement('canvas'); c.width = 384; c.height = 256; const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(10,14,30,.94)'; g.beginPath(); g.roundRect(0, 0, 384, 256, 22); g.fill(); g.fillStyle = mau; g.fillRect(0, 0, 384, 16); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '64px "Apple Color Emoji", system-ui'; g.fillText(x.ic, 192, 72); g.fillStyle = '#fff'; let co = 76; g.font = `800 ${co}px system-ui, sans-serif`; while (g.measureText(x.so).width > 360 && co > 34) { co -= 4; g.font = `800 ${co}px system-ui, sans-serif`; } g.fillText(x.so, 192, 152);
    g.fillStyle = '#ffd27a'; g.font = '600 32px system-ui, sans-serif'; g.fillText(x.nhan, 192, 222, 360); return (tex[k] = new THREE.CanvasTexture(c)); };
  /** RÀO + CỔNG + POSTER (anh 22/10/2026 "hàng rào phải có cổng vào, xe ra xe vào" · "metric ghi thành poster cắm quanh hàng rào"):
   *  cổng ở chỗ tia từ tâm ra đại lộ cắt rào (hai trụ, xà, biển tên khu); poster số liệu cắm ngoài rào hai bên cổng; trả điểm cổng cho xe ra vào */
  function raoQuanh(dinh: any[], mau: string, cx: number, cz: number, phia: number, ten = '', posters: Poster[] = [], khoa = '', congSau: any = null) {
    const c = new THREE.Color(mau), o = new THREE.Object3D(), g = giaoCanh(dinh, cx, cz, 0, -phia), cong = g?.p ?? null, RONG_CONG = 13;
    for (let k = 0; k < dinh.length; k++) { const a = dinh[k], b = dinh[(k + 1) % dinh.length], dai = a.distanceTo(b), n = Math.max(1, Math.round(dai / 9));
      for (let i = 0; i < n; i++) { const p = a.clone().lerp(b, i / n), q2 = a.clone().lerp(b, (i + 1) / n), giua = p.clone().lerp(q2, .5);
        if ((cong && giua.distanceTo(cong) < RONG_CONG + 3) || (congSau && giua.distanceTo(congSau) < RONG_CONG + 3)) continue;   // cổng chính + cổng sau (đường xe nhà máy phim)
        o.position.set(p.x, RAO_CAO / 2, p.z); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); o.updateMatrix(); rao.cot.push(o.matrix.clone()); rao.mau.push(c);
        for (const y of [RAO_CAO * .28, RAO_CAO * .58, RAO_CAO * .88]) { o.position.set(giua.x, y, giua.z); o.rotation.set(0, -Math.atan2(q2.z - p.z, q2.x - p.x), 0); o.scale.set(p.distanceTo(q2), 1, 1); o.updateMatrix(); rao.thanh.push(o.matrix.clone()); rao.mauT.push(c); }
        rao.vien.push(p.x, RAO_CAO * .88, p.z, q2.x, RAO_CAO * .88, q2.z); rao.mauV.push(c.r, c.g, c.b, c.r, c.g, c.b); } }
    if (!g || !cong) return null;
    // cổng: hai trụ cao 1,7 lần rào, xà ngang, biển tên khu quay ra ngoài
    const ra = cong.clone().sub(new THREE.Vector3(cx, 0, cz)).setY(0).normalize(), cot2 = new THREE.Color(mau).lerp(new THREE.Color('#ffffff'), .35), H = RAO_CAO * 1.7;
    for (const s2 of [-1, 1]) { const q = cong.clone().addScaledVector(g.canh, s2 * RONG_CONG); o.position.set(q.x, H / 2, q.z); o.rotation.set(0, 0, 0); o.scale.set(1.8, H / RAO_CAO, 1.8); o.updateMatrix(); rao.cot.push(o.matrix.clone()); rao.mau.push(cot2); }
    o.position.set(cong.x, H, cong.z); o.rotation.set(0, -Math.atan2(g.canh.z, g.canh.x), 0); o.scale.set(RONG_CONG * 2 + 4, 2.2, 1.6); o.updateMatrix(); rao.thanh.push(o.matrix.clone()); rao.mauT.push(cot2);
    if (ten) { const b = add(new THREE.PlaneGeometry(RONG_CONG * 2, RONG_CONG * 2 * 176 / 512), new THREE.MeshBasicMaterial({ map: texBang(ten, '', mau), transparent: true, side: THREE.DoubleSide }), false);
      b.position.set(cong.x + ra.x * .9, H - 3.6, cong.z + ra.z * .9); b.rotation.y = Math.atan2(ra.x, ra.z); b.userData = khoa && khoa !== 'tai-nguyen' ? { loai: 'khu', khoa } : { chu: null }; }
    // poster: dọc rào ra hai phía cổng, lệch ra ngoài rào 5 đơn vị, mặt quay ra ngoài
    // mặt poster vuông góc cạnh rào (pháp tuyến quay ra ngoài tâm), không chéo ở góc
    posters.forEach((x, i) => { const phiaP = i % 2 ? 1 : -1, d = RONG_CONG + 18 + Math.floor(i / 2) * 26, v = docRao(dinh, cong, phiaP * d);
      let ngoai = new THREE.Vector3(v.canh.z, 0, -v.canh.x); if (ngoai.dot(v.p.clone().sub(new THREE.Vector3(cx, 0, cz))) < 0) ngoai.negate(); const q = v.p.clone().addScaledVector(ngoai, 6);
      for (const s2 of [-1, 1]) { const ch = q.clone().addScaledVector(v.canh, s2 * 8); o.position.set(ch.x, 7, ch.z); o.rotation.set(0, 0, 0); o.scale.set(.45, 14 / RAO_CAO, .45); o.updateMatrix(); rao.cot.push(o.matrix.clone()); rao.mau.push(cot2); }
      const b = add(new THREE.PlaneGeometry(20, 13.3), new THREE.MeshBasicMaterial({ map: texPoster(x, mau), side: THREE.DoubleSide }), false); b.position.set(q.x, 19, q.z); b.rotation.y = Math.atan2(ngoai.x, ngoai.z); b.userData = { loai: 'poster', khoa, p: x }; });   // hover poster → chi tiết chỉ số (card #1430)
    return { cong, ra };
  }
  /** XE RA VÀO CỔNG: hai làn (vào lệch phải, ra lệch trái) đại lộ → cổng → sân giữa khu → cổng → đại lộ; số xe theo quy mô khu */
  function xeRaVao(cx: number, cz: number, phia: number, cong: any, ra: any, soXe: number) {
    const ngang = new THREE.Vector3(-ra.z, 0, ra.x), y = 1.5, pts = [new THREE.Vector3(cx, y, phia * 5), cong.clone().setY(y), new THREE.Vector3(cx, y, cz).addScaledVector(ra, 16)];
    const vao = pts.map((q) => q.clone().addScaledVector(ngang, 3)), ve = [...pts].reverse().map((q) => q.clone().addScaledVector(ngang, -3));
    const duong = new THREE.CurvePath(), all = [...vao, ...ve, vao[0]]; for (let i = 0; i < all.length - 1; i++) if (all[i].distanceTo(all[i + 1]) > .5) duong.add(new THREE.LineCurve3(all[i], all[i + 1]));
    for (let j = 0; j < soXe; j++) { const xe = add(new THREE.BoxGeometry(4.2 * CO_XE, 2.2 * CO_XE, 2.4 * CO_XE), M({ color: ['#e8ecf8', '#ffd27a', '#6ea8ff', '#ff8fa3'][j % 4], emissive: '#ffffff', emissiveIntensity: .25 })); xe.userData = { duong, t: j / soXe, toc: .0016 * 300 / Math.max(300, duong.getLength()), chu: null }; ds.xe!.push(xe); }
  }
  // CHỈ VẼ PHẦN TRONG KHUNG NHÌN (23/10/2026): three r128 không tự loại InstancedMesh ngoài màn (frustumCulled=false vì không biết vùng của các bản sao)
  // → rào 14.600 cột, sân, toà nền, cửa sổ luôn vẽ cả thành phố (~280 nghìn tam giác dù phóng vào một góc). Cắt mỗi khối thành ô đất O_CAT, mỗi ô một quả cầu bao;
  // mỗi khung ô nào ngoài khung nhìn thì chuyển sang lớp 1 (camera chỉ vẽ lớp 0). Dùng lớp chứ không dùng .visible để không đụng bộ lọc / bật tắt lớp đang giữ .visible.
  const O_CAT = 800, oCat: { im: any; cau: any; rI: number }[] = [];   // rI = bề dày lớn nhất của một bản sao trong ô (cạnh mỏng nhất, không phải bán kính: thanh rào dài 9 mà dày 0,8 thì xa trông như sợi chỉ)
  function chiaO(im: any, cha: any) {
    const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), tl = new THREE.Vector3(), q = new THREE.Quaternion(), nhom = new Map<string, number[]>(); im.geometry.computeBoundingSphere(); im.geometry.computeBoundingBox(); const r0 = im.geometry.boundingSphere.radius, kt = im.geometry.boundingBox.getSize(new THREE.Vector3());
    for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, m4); p.setFromMatrixPosition(m4); const k = `${Math.floor(p.x / O_CAT)}|${Math.floor(p.z / O_CAT)}`; (nhom.get(k) ?? nhom.set(k, []).get(k)!).push(i); }
    const mot = nhom.size === 1;
    for (const ds2 of nhom.values()) {
      const c = mot ? im : new THREE.InstancedMesh(im.geometry, im.material, ds2.length), hop = new THREE.Box3(), mau = new THREE.Color(); let rI = 0;
      ds2.forEach((i, j) => { im.getMatrixAt(i, m4); p.setFromMatrixPosition(m4); const rr = r0 * m4.getMaxScaleOnAxis(); m4.decompose(p, q, tl); const day = Math.min(...[kt.x * tl.x, kt.y * tl.y, kt.z * tl.z].filter((v) => v > 1e-3)); rI = Math.max(rI, day); p.setFromMatrixPosition(m4); hop.expandByPoint(p.clone().addScalar(rr)); hop.expandByPoint(p.clone().addScalar(-rr));
        if (!mot) { c.setMatrixAt(j, m4); if (im.instanceColor) { im.getColorAt(i, mau); c.setColorAt(j, mau); } } });
      if (!mot) { if (c.instanceColor) c.instanceColor.needsUpdate = true; c.castShadow = im.castShadow; c.receiveShadow = im.receiveShadow; c.userData = im.userData; }
      cha.add(c); oCat.push({ im: c, cau: hop.getBoundingSphere(new THREE.Sphere()), rI }); }
  }
  function dungGop() {
    if (phang.m.length) { const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), phang.m.length);
      phang.m.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, phang.c[i]); }); im.instanceColor.needsUpdate = true; im.userData = { chu: null }; chiaO(im, the); }
    phang.m = []; phang.c = []; dungRao(); dungKhach();
  }
  function dungRao() {
    for (const [ds2, mau2, geo] of [[rao.cot, rao.mau, new THREE.BoxGeometry(1.8, RAO_CAO, 1.8)], [rao.thanh, rao.mauT, new THREE.BoxGeometry(1, 1, .8)]] as const) {
      if (!ds2.length) continue; const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: .5, emissive: '#30384f', emissiveIntensity: .5 }), ds2.length);
      ds2.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, mau2[i]); }); im.instanceColor.needsUpdate = true; im.userData = { chu: null }; chiaO(im, the); }
    // viền rào 1 nét: lùi xa thì cột / thanh rào mảnh dưới 1 điểm ảnh bị bỏ (catVe) — nét này giữ đường biên khu, cả thành phố chỉ một lệnh vẽ
    if (rao.vien.length) { const gv = new THREE.BufferGeometry(); gv.setAttribute('position', new THREE.Float32BufferAttribute(rao.vien, 3)); gv.setAttribute('color', new THREE.Float32BufferAttribute(rao.mauV, 3));
      const lv = new THREE.LineSegments(gv, new THREE.LineBasicMaterial({ vertexColors: true })); lv.userData = { chu: null, luonVe: true }; the.add(lv); }
    rao.cot = []; rao.thanh = []; rao.mau = []; rao.mauT = []; rao.vien = []; rao.mauV = [];
  }
  const khuCua = (k: string) => mh.duAn.find((c) => c.khoa === k);
  const dichCua = (k: string) => mh.dich.find((d) => d.khoa === k);
  const texNen = (k: Nen) => texIc(`n:${k}`, NEN[k][0], P[k]);
  const texKhu = (k: string) => { const c = khuCua(k); return c?.site ? texFav(c.site, c.mau) : texIc(`k:${k}`, c?.mau ?? '#3a4058', (c?.ten ?? '?')[0]!.toUpperCase()); };

  // ── toà tài khoản
  // máy tìm kiếm: màu hãng + favicon trên nóc; tài khoản mạng xã hội: màu + logo nền tảng
  const mauTk = (tk: PhoTk) => tk.mau ?? NEN[tk.nen][0];
  const maiTk = (tk: PhoTk) => (tk.loai !== 'mxh' && tk.host ? texFav(tk.host, tk.mau) : texNen(tk.nen));
  const CUA_SANG = new THREE.Color('#ffd27a'), CUA_TOI = new THREE.Color('#1c2440');
  const cuaGeo = new THREE.PlaneGeometry(3.2, 2.6), cuaMat = new THREE.MeshBasicMaterial();
  const ds: Record<string, any[]> = { nha: [], cua: [], thung: [], cot: [], xe: [], xu: [], hong: [], khoi: [], onl: [], dien: [], thap: [], ngam: [], san: [], ham: [], cho: [] };
  const texKhoi = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!, gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  function khoi(x: number, y: number, z: number, tk: PhoTk, chu: any, n = 22) {
    for (let k = 0; k < n; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texKhoi, color: k % 3 ? '#5b5f6e' : '#8a8f9e', transparent: true, depthWrite: false, opacity: 0 }));
      sp.userData = { tk, chu, goc: new THREE.Vector3(x, y, z), pha: k / n, toc: .0035 + Math.random() * .002, lech: Math.random() * 6.28 }; the.add(sp); ds.khoi!.push(sp); }
  }
  function toaNha(x: number, z: number, tk: PhoTk, mai: any) {
    const w = Math.min(28, 15 + 1.8 * Math.log2(1 + (tk.xem ?? 0) / 40 + tk.phien));   // to theo lượt xem + khách đẩy về đích; tối thiểu 15 để bảng tên trên tường đọc được
    const tang = Math.max(3, Math.min(20, Math.ceil(tk.chay / 12) + 1)), h = tang * 5 + 3, mau = new THREE.Color(mauTk(tk)).lerp(new THREE.Color('#2a3150'), .35);
    const than = M({ color: mau, roughness: .6, transparent: tk.dung, opacity: tk.dung ? .35 : 1 });
    const noc = M({ map: mai, emissive: '#ffffff', emissiveMap: mai, emissiveIntensity: .4, transparent: tk.dung, opacity: tk.dung ? .35 : 1 });
    const m = add(new THREE.BoxGeometry(w, h, w), [than, than, noc, than, than, than]); m.position.set(x, h / 2, z); m.userData = { loai: 'tk', tk }; ds.nha!.push(m);
    const tong = tang * 12, im = new THREE.InstancedMesh(cuaGeo, cuaMat, tong), o = new THREE.Object3D(); let i = 0;
    for (let f = 0; f < tang; f++) for (let mat = 0; mat < 4; mat++) for (let c = 0; c < 3; c++) {
      const goc = mat * Math.PI / 2, lech = (c - 1) * (w / 3.6), y = 4 + f * 5;
      o.position.set(x + Math.sin(goc) * (w / 2 + .05) + Math.cos(goc) * lech, y, z + Math.cos(goc) * (w / 2 + .05) - Math.sin(goc) * lech); o.rotation.set(0, goc, 0); o.updateMatrix();
      im.setMatrixAt(i, o.matrix); im.setColorAt(i, i < tk.chay ? CUA_SANG : CUA_TOI); i++;
    }
    im.instanceColor.needsUpdate = true; im.userData = { tk, chu: m }; chiaO(im, the); ds.cua!.push(im);
    for (let k = 0; k < Math.min(14, tk.sap); k++) { const t = add(new THREE.BoxGeometry(3.6, 3.6, 3.6), M({ color: '#9b7bff', emissive: '#7c5cff', emissiveIntensity: .45 })); t.position.set(x + w / 2 + 4 + (k % 2) * 4.2, 1.8 + (Math.floor(k / 2) % 2) * 3.8, z - w / 2 + 3 + Math.floor(k / 4) * 4.2); t.userData = { tk, chu: m }; ds.thung!.push(t); }
    if (tk.xem) { const hc = 10 + 14 * Math.log10(1 + tk.xem), c = add(new THREE.CylinderGeometry(1.4, 3.2, hc, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#6ea8ff', transparent: true, opacity: .45, side: THREE.DoubleSide }), false); c.position.set(x, h + hc / 2, z); c.userData = { tk, chu: m }; ds.cot!.push(c); }
    if (tk.hong) { const d = add(new THREE.SphereGeometry(2.2, 12, 12), new THREE.MeshBasicMaterial({ color: '#ff3b4e' }), false); d.position.set(x, h + 2.5, z); d.userData = { tk, chu: m }; ds.hong!.push(d); khoi(x, h + 3, z, tk, m); }
    bangTen(x, z, w, h, tk.loai === 'mxh' ? `${NEN[tk.nen][1]} · ${tk.ten}` : tk.ten, '', mauTk(tk), m);   // chỉ tên — số ở thẻ hover / poster rào
    return { m, cua: new THREE.Vector3(x, 1.5, z) };
  }

  // ── bộ lọc: nguồn (nền / tìm kiếm / quảng cáo / giới thiệu) ẩn hiện tại chỗ; khu chọn → dựng lại chỉ các khu đó
  const chonLv = new Set<string>(), chonSp = new Set<string>(), chonNen = new Set<Nen>(), bat = new Set(['cua', 'thung', 'cot', 'xe', 'xu', 'onl', 'dien', 'ngam']);
  const khop = (tk: PhoTk | undefined) => !tk || !chonNen.size || chonNen.has(tk.nen);
  // ── KHU ĐÔ THỊ NỀN (anh 22/10/2026 "thêm khu đô thị xung quanh cho sinh động, dòng xe, dòng người"): nhà thấp, phố lưới, xe và người qua lại —
  //    chỉ để cảnh sống động, KHÔNG mang số nào và không bấm được (nằm ngoài nhóm 'the' nên tia chuột không chạm)
  let nen = new THREE.Group(); scene.add(nen);
  const amb: { xe: any; nguoi: any; xeD: { duong: any; t: number; toc: number }[]; nguoiD: { a: any; b: any; t: number; toc: number }[]; cuaSo: any[]; than: any } = { xe: null, nguoi: null, xeD: [], nguoiD: [], cuaSo: [], than: null };
  let rand = 1; const ngau = () => { rand = (rand * 16807) % 2147483647; return rand / 2147483647; };   // ngẫu nhiên cố định: cùng số liệu → cùng thành phố
  function khuNen(x0: number, x1: number, zTrong: number, zNgoai = 0) {
    scene.remove(nen); nen = new THREE.Group(); scene.add(nen); rand = 7; amb.xeD = []; amb.nguoiD = []; amb.cuaSo = [];
    const phoN = (xa: number, za: number, xb: number, zb: number, rong: number) => { const dai = Math.hypot(xb - xa, zb - za), m = new THREE.Mesh(new THREE.PlaneGeometry(dai, rong), NHUA); m.rotation.set(-Math.PI / 2, 0, -Math.atan2(zb - za, xb - xa)); m.position.set((xa + xb) / 2, .25, (za + zb) / 2); m.receiveShadow = true; nen.add(m); };
    const zN = zTrong + 260, xa = x0 - 260, xb = x1 + 260;
    // đường vành đai bao cả thành phố + phố lưới trong khu nền
    for (const z of [-zN, zN, -zTrong - 30, zTrong + 30]) phoN(xa, z, xb, z, 14);
    for (const x of [xa, xb]) phoN(x, -zN, x, zN, 14);
    const o: { x: number; z: number; w: number; d: number; h: number }[] = [];
    for (let x = xa + 30; x < xb - 30; x += 46) for (const phia of [-1, 1]) for (let z = zTrong + 50; z < zN - 20; z += 42) {
      if (ngau() < .18) continue; o.push({ x: x + (ngau() - .5) * 6, z: phia * z, w: 18 + ngau() * 14, d: 16 + ngau() * 12, h: 6 + Math.pow(ngau(), 2) * 46 });
    }
    for (const x0b of [xa + 20, xb - 20]) for (let z = -zTrong; z <= zTrong; z += 44) for (const dx of [-1, 1]) { if (ngau() < .25) continue; o.push({ x: x0b + dx * (40 + ngau() * 120), z, w: 18 + ngau() * 12, d: 18 + ngau() * 12, h: 6 + Math.pow(ngau(), 2) * 30 }); }
    for (let x = xa + 46; x < xb; x += 184) for (const phia of [-1, 1]) phoN(x, phia * (zTrong + 30), x, phia * zN, 9);
    const than = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M({ color: '#ffffff', roughness: .85 }), o.length), q3 = new THREE.Object3D();
    const cuaSo = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: .8 }), o.length * 2);
    o.forEach((b, i) => {
      q3.position.set(b.x, b.h / 2, b.z); q3.rotation.set(0, 0, 0); q3.scale.set(b.w, b.h, b.d); q3.updateMatrix(); than.setMatrixAt(i, q3.matrix);
      than.setColorAt(i, new THREE.Color().setHSL(.6 + ngau() * .08, .12 + ngau() * .1, .22 + ngau() * .18));
      for (const [k, mat] of [[0, 1], [1, -1]] as const) { q3.position.set(b.x, b.h * .55, b.z + mat * (b.d / 2 + .06)); q3.rotation.set(0, mat > 0 ? 0 : Math.PI, 0); q3.scale.set(b.w * .7, b.h * .6, 1); q3.updateMatrix(); cuaSo.setMatrixAt(i * 2 + k, q3.matrix); }
    });
    than.instanceColor.needsUpdate = true; than.castShadow = true; than.receiveShadow = true; chiaO(than, nen); chiaO(cuaSo, nen); amb.than = than; amb.cuaSo = [cuaSo];
    // dòng xe nền: chạy vòng vành đai + dọc đại lộ, hai chiều
    const vong = new THREE.CurvePath(); const goc4 = [[xa, -zN], [xb, -zN], [xb, zN], [xa, zN], [xa, -zN]].map(([x, z]) => new THREE.Vector3(x, 1.2, z));
    for (let i = 0; i < 4; i++) vong.add(new THREE.LineCurve3(goc4[i], goc4[i + 1]));
    const dai = (z: number, nguoc: boolean) => { const c = new THREE.CurvePath(); const p = [new THREE.Vector3(xa, 1.2, z), new THREE.Vector3(xb, 1.2, z)]; if (nguoc) p.reverse(); c.add(new THREE.LineCurve3(p[0], p[1])); return c; };
    const tuyen = [vong, dai(-6.5, false), dai(6.5, true), dai(-zTrong - 30, false), dai(zTrong + 30, true)];
    const soXe = 150; amb.xe = new THREE.InstancedMesh(new THREE.BoxGeometry(3.6 * CO_XE, 1.8 * CO_XE, 2 * CO_XE).translate(0, .9 * CO_XE - .8, 0), new THREE.MeshBasicMaterial({ color: '#ffffff' }), soXe);
    for (let i = 0; i < soXe; i++) { amb.xeD.push({ duong: tuyen[i % tuyen.length], t: ngau(), toc: .0004 + ngau() * .0006 }); amb.xe.setColorAt(i, new THREE.Color(['#c9d2e6', '#ffcf6b', '#ff6b6b', '#8fb3ff', '#e8e8e8'][i % 5])); }
    amb.xe.instanceColor.needsUpdate = true; nen.add(amb.xe);
    // dòng người: đi bộ hai bên vỉa hè đại lộ và quanh khu nền
    const soNguoi = 260; amb.nguoi = new THREE.InstancedMesh(new THREE.CylinderGeometry(.55 * CO_NGUOI, .55 * CO_NGUOI, 2.2 * CO_NGUOI, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), soNguoi);
    for (let i = 0; i < soNguoi; i++) {
      const z = (i % 2 ? 1 : -1) * (i % 3 === 0 ? zTrong + 40 : 13.5), x1b = xa + ngau() * (xb - xa), x2b = x1b + (ngau() - .5) * 260;
      amb.nguoiD.push({ a: new THREE.Vector3(x1b, 1.1, z + (ngau() - .5) * 3), b: new THREE.Vector3(x2b, 1.1, z + (ngau() - .5) * 3), t: ngau(), toc: .0006 + ngau() * .0012 });
      amb.nguoi.setColorAt(i, new THREE.Color().setHSL(ngau(), .5, .62));
    }
    amb.nguoi.instanceColor.needsUpdate = true; nen.add(amb.nguoi);
    const zDat = Math.max(zN, zNgoai) + 60;
    dat.scale.set((xb - xa + 400) / 2000, (2 * zDat + 400) / 1200, 1); dat.position.x = (xa + xb) / 2;
    Object.assign(trang.shadow.camera, { left: xa - (xa + xb) / 2, right: xb - (xa + xb) / 2, top: zDat, bottom: -zDat }); trang.shadow.camera.updateProjectionMatrix();
    return { xa, xb, zN, zDat };
  }

  // ── NGÀY / ĐÊM theo giờ thật của máy đang xem (anh 22/10/2026); nút 🌓 đổi tự động → ngày → đêm
  let cheDo: 'tu' | 'ngay' | 'dem' = 'tu';
  const MAU = { demNen: new THREE.Color('#060914'), ngayNen: new THREE.Color('#a9c8ec'), hoang: new THREE.Color('#e9906a'), demDat: new THREE.Color('#0b1022'), ngayDat: new THREE.Color('#6f7f72'), demPho: new THREE.Color('#1a2036'), ngayPho: new THREE.Color('#454b57') };
  function apNgayDem() {
    const bay = new Date(), gio = bay.getHours() + bay.getMinutes() / 60;
    const f = cheDo === 'ngay' ? 1 : cheDo === 'dem' ? 0 : Math.max(0, Math.min(1, Math.sin(((gio - 5.5) / 13) * Math.PI) * 1.6));   // 5:30 sáng → 18:30 tối
    const hoang = cheDo === 'tu' ? Math.max(0, 1 - Math.abs(f - .25) * 5) * .6 : 0;   // bình minh / hoàng hôn ửng cam
    const nenM = MAU.demNen.clone().lerp(MAU.ngayNen, f).lerp(MAU.hoang, hoang);
    scene.background = nenM; scene.fog.color = nenM;
    hemi.intensity = .45 + .55 * f; trang.intensity = .45 + .75 * f;
    const gocMt = ((gio - 6) / 12) * Math.PI; trang.position.set(Math.cos(gocMt) * 520, 140 + 380 * Math.max(.15, Math.sin(gocMt)), 200);
    trang.color.set(f > .3 ? '#fff6e6' : '#cfd8ff');
    dat.material.color.copy(MAU.demDat.clone().lerp(MAU.ngayDat, f)); NHUA.color.copy(MAU.demPho.clone().lerp(MAU.ngayPho, f));
    for (const c of amb.cuaSo) c.material.opacity = .85 * (1 - f) + .05;
    if (amb.than) amb.than.material.emissive?.set(f < .3 ? '#141a33' : '#000000');
    const nut = host.querySelector('[data-d="ngay"]') as HTMLButtonElement | null;
    if (nut) { nut.textContent = cheDo === 'tu' ? (f > .5 ? '☀' : '🌙') : cheDo === 'ngay' ? '☀' : '🌙'; nut.title = `${cheDo === 'tu' ? 'Theo giờ thật' : cheDo === 'ngay' ? 'Luôn ngày' : 'Luôn đêm'} — bấm để đổi`; nut.setAttribute('aria-label', nut.title); nut.style.outline = cheDo === 'tu' ? '' : '2px solid #6ea8ff'; }
    r.shadowMap.needsUpdate = true;
  }

  // bố cục cụm phim của mỗi toà nền tảng — dựng lại mỗi lần dung(), thẻ hover đọc lại
  type CumP = { cum: string; ten: string; goc: PhoDich[]; nb: Map<string, PhoDich[]>; cho: PhoDich[]; kho: PhoDich | null; cot: number; O: number; w: number; h: number; x: number; z: number; tien: number };
  const boCumP = new Map<string, { nua: number; cum: CumP[]; hub: { x: number; z: number } }>();
  // BẬT / TẮT BẢNG HIỆU PHIM (anh 23/10/2026 "khu nhiều bảng hiệu như Ethopex bị rối — thêm nút trong trại bấm để mở / tắt; đang tắt thì hover vào hiện bảng đó,
  // hover ra lại ẩn"): nút là một cột bấm được cạnh bảng xếp hạng; trạng thái nhớ theo máy; đang tắt thì rê lên sân / camp / bảng của phim nào hiện biển phim đó
  const bienPhim = new Map<string, any[]>();   // khoá 'hub|cum' → [biển, cột]
  const bangXhCua = new Map<string, any>(); let bangXhMo: any = null;   // bảng xếp hạng phim mỗi khu (gọn / mở theo hover)
  const datBangXh = (sp: any, mo: boolean) => { const u = sp.userData.bangXh, h = mo ? u.HbDu : u.HbGon; sp.material.map = mo ? u.texDu : u.texGon; sp.material.needsUpdate = true; sp.scale.y = h; sp.position.y = u.day + h / 2; };
  let tatBien: Record<string, boolean> = (() => { try { return JSON.parse(localStorage.getItem('tp-tat-bien') ?? '{}'); } catch { return {}; } })();
  let bienDangLo: string | null = null;
  const datBien = (khoa: string, hien: boolean) => { for (const o of bienPhim.get(khoa) ?? []) o.visible = hien; };
  const apTatBien = (hub: string) => { for (const k of bienPhim.keys()) if (k.startsWith(`${hub}|`)) datBien(k, !tatBien[hub]); bienDangLo = null; };
  // SỐ MỖI PHIM (anh 23/10/2026 "làm sao nhìn được ROI · profit · cost · revenue của từng phim, từng camp trên city"): cộng mọi camp của cụm (kể cả kho camp tắt);
  // hôm nay = ngày báo cáo mới nhất của Ethopex (cùng số với bảng Content), ROI = (thu − chi) / chi như bảng đó
  type SoPhim = { tH: number; cH: number; t30: number; c30: number };
  const campCum = (o: CumP) => [...o.goc, ...[...o.nb.values()].flat(), ...o.cho, ...(o.kho ? [o.kho] : [])];
  const soCum = (o: CumP): SoPhim => campCum(o).reduce((a, c) => ({ tH: a.tH + (c.thuHom ?? 0), cH: a.cH + (c.chiHom ?? 0), t30: a.t30 + (c.tien30 ?? 0), c30: a.c30 + (c.chi30 ?? 0) }), { tH: 0, cH: 0, t30: 0, c30: 0 });
  const roiCua = (thu: number, chi: number) => (chi > 0 ? (thu - chi) / chi : null);
  const roiChu = (r: number | null) => (r == null ? '—' : `${Math.round(r * 100)}%`);
  const usd = (n: number) => `$${Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(2)}`;
  const ngayNgan = (s: string | null | undefined) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : 'hôm nay');
  /** phủ sức sống lên mọi phần của site / app / sản phẩm (toà chính + phần con chu → toà chính): đơ = đóng băng, thoi thóp = mờ, sôi động = vòng sáng.
   *  Làm một lượt sau khi dựng — mọi kiểu toà (tháp site, cửa hàng, sản phẩm, app) đi chung một chỗ, không rải điều kiện vào từng hàm vẽ. */
  const demDongBang = [0, 0];   // bộ kiểm: số phần đã phủ đơ / thoi thóp
  function apSucSong() {
    demDongBang[0] = 0; demDongBang[1] = 0;
    const mucCua = (d: any) => (d.cha ? mh.dich.find((x) => x.khoa === d.cha)?.sucSong : d.sucSong) ?? 2;
    const lam = (mat: any, muc: number) => { const m = mat.clone(); const t = muc === 0 ? .82 : .45;
      if (m.map && !m.emissiveMap) m.color?.set(muc === 0 ? '#5a6680' : '#9aa3b8'); else m.color?.lerp(new THREE.Color(BANG), t);
      if (m.emissive) { m.emissiveIntensity = (m.emissiveIntensity ?? 0) * (muc === 0 ? 0 : .4); }
      if (m.transparent && m.wireframe) m.opacity = (m.opacity ?? 1) * (muc === 0 ? 0 : .4); return m; };
    for (const o of [...the.children]) { const chu = o.userData?.loai === 'dich' ? o : o.userData?.chu, d = chu?.userData?.loai === 'dich' ? chu.userData.d : null;
      if (!d || !laDichSong(d)) continue; const muc = mucCua(d); if (muc >= 2) continue;
      o.material = Array.isArray(o.material) ? o.material.map((m: any) => lam(m, muc)) : lam(o.material, muc); demDongBang[muc]!++; }
    for (const o of ds.thap!.concat([...the.children].filter((x: any) => x.userData?.loai === 'dich' && x.userData.d.loai !== 'site' && ['app', 'sp'].includes(x.userData.d.loai)))) {
      const d = o.userData.d; if (mucCua(d) !== 3 || d.cha) continue; const hop = new THREE.Box3().setFromObject(o), r0 = Math.max(hop.max.x - hop.min.x, hop.max.z - hop.min.z) * .7 + 3;
      const v = add(new THREE.TorusGeometry(r0, .7, 6, 40), new THREE.MeshBasicMaterial({ color: '#5effc4', transparent: true, opacity: .4, depthWrite: false }), false); v.rotation.x = Math.PI / 2; v.position.set((hop.min.x + hop.max.x) / 2, hop.max.y + 2, (hop.min.z + hop.max.z) / 2); v.userData = { chu: o }; ds.cot!.push(v); }
  }
  /** bảng SỨC SỐNG: đếm 4 mức (mọi nguồn traffic ngang nhau) + bấm một mức → danh sách, bấm một dòng → bay tới · kênh mạng xã hội chưa gắn đích (vốn dự phòng — gắn là việc anh quyết) */
  let mucMo: number | null = null, locSong = '', moRanh = false;   // panel phụ trên cảnh 3D: danh sách gập mặc định (YDNI luật lõi 5)
  function veSong() {
    const o = q('[data-o="song"]'); if (!o) return;
    const ds = mh.dich.filter((d) => laDichSong(d) && !d.cha), dem = [0, 1, 2, 3].map((m) => ds.filter((d) => (d.sucSong ?? 0) === m).length);
    const ranh = mh.tk.filter((t) => t.loai === 'mxh' && !t.dich);
    const tenKhu = (d: typeof ds[number]) => esc(khuCua(d.duAn)?.ten ?? '');
    const khop = (d: typeof ds[number]) => !locSong || `${d.ten} ${tenKhu(d)}`.toLowerCase().includes(locSong.toLowerCase());
    const dong = mucMo == null ? [] : ds.filter((d) => (d.sucSong ?? 0) === mucMo && khop(d)).sort((a, b) => (b.khach7 ?? 0) - (a.khach7 ?? 0) || (b.soNguon ?? 0) - (a.soNguon ?? 0) || tenKhu(a).localeCompare(tenKhu(b)));
    // chip chỉ ghi tên mức, số đếm ở hover (luật nhãn không mang số); tổng là một dòng chữ riêng
    o.innerHTML = `<div class="tong">${[3, 2, 1, 0].map((m) => `${SUC_SONG[m]!.ic} ${dem[m]}`).join(' · ')} <span class="nho">/ ${ds.length}</span></div><div class="muc">${[3, 2, 1, 0].map((m) => `<button data-m="${m}" aria-pressed="${mucMo === m}" title="${dem[m]} — ${SUC_SONG[m]!.ten}">${SUC_SONG[m]!.ic} ${SUC_SONG[m]!.ten.split(' — ')[0]}</button>`).join('')}</div>`
      + (mucMo != null ? `<input class="loc" type="search" placeholder="lọc tên / khu…" value="${esc(locSong)}" aria-label="Lọc danh sách sức sống" /><div class="ds">${dong.map((d, i) => `<button data-i="${i}"><span>${esc(d.ten)}</span><span class="nho">${tenKhu(d)}${d.soNguon ? ` · ${d.soNguon} nguồn` : ''}${d.khach7 ? ` · ${d.khach7} khách` : ''}</span></button>`).join('') || '<span class="nho" style="padding:6px 8px;display:block">không có dòng khớp</span>'}</div>` : '')
      + (ranh.length ? `<button class="ray" aria-expanded="${moRanh}">📡 ${ranh.length} kênh mạng xã hội chưa gắn sản phẩm nào ${moRanh ? '▾' : '▸'}</button>${moRanh ? `<div class="ds">${ranh.map((t, i) => `<button data-r="${i}"><span>${NEN[t.nen][1]} ${esc(t.ten)}</span><span class="nho">bấm để bay tới toà kênh</span></button>`).join('')}</div>` : ''}` : '');
    for (const b of o.querySelectorAll<HTMLButtonElement>('.muc button')) b.onclick = () => { const m = Number(b.dataset.m); mucMo = mucMo === m ? null : m; veSong(); };
    const loc = o.querySelector<HTMLInputElement>('.loc'); if (loc) loc.oninput = () => { locSong = loc.value; const pos = loc.selectionStart; veSong(); const l2 = o.querySelector<HTMLInputElement>('.loc'); l2?.focus(); l2?.setSelectionRange(pos, pos); };
    const ray = o.querySelector<HTMLButtonElement>('.ray'); if (ray) ray.onclick = () => { moRanh = !moRanh; veSong(); };
    for (const b of o.querySelectorAll<HTMLButtonElement>('.ds button[data-r]')) b.onclick = () => { const t = ranh[Number(b.dataset.r)], vat = chiMuc.find((c) => c.ten === t?.ten)?.obj; if (vat) bayToiObj(vat); };
    for (const b of o.querySelectorAll<HTMLButtonElement>('.ds button[data-i]')) b.onclick = () => { const d = dong[Number(b.dataset.i)]; const vat = d && the.children.find((c: any) => c.userData?.loai === 'dich' && c.userData.d.khoa === d.khoa); if (vat) bayToiObj(vat); };
  }
  function dung() {
    boCumP.clear(); bienPhim.clear(); bienDangLo = null; bangXhCua.clear(); bangXhMo = null;
    scene.remove(the); the = new THREE.Group(); scene.add(the); for (const k of Object.keys(ds)) ds[k] = []; khachDs = [];
    const viTri: Record<string, any> = {};
    chiMuc.length = 0;
    const khus = mh.duAn.filter((k) => (!chonSp.size || chonSp.has(k.khoa)) && (!chonLv.size || chonLv.has(k.linhVuc)));
    const nguonCua = (khoa: string) => mh.tk.filter((t) => t.dich === khoa);
    // ── kích thước: quảng trường site = tháp site ở tâm + vòng nguồn; khu dự án = toà DỰ ÁN ở tâm + vòng sản phẩm + vòng quảng trường site
    const vongCua = (d: typeof mh.dich[number]): (PhoTk | PhoDich)[] => (d.loai === 'app' ? banCua(d.khoa).flatMap((b) => [b, ...nguonCua(b.khoa)]) : d.loai === 'nen' ? [] : nguonCua(d.khoa));
    const rSite = (d: typeof mh.dich[number]) => (d.loai === 'nen' ? cumPhimCua(d).nua : 30 + Math.min(40, vongCua(d).length * 3.2));
    // CỤM PHIM ETHOPEX (góp ý city #1439): mỗi phim một sân — camp gốc lưới giữa sân, bản nhân bản (nhỏ) vòng quanh gốc, cột bên phải = camp chờ public
    // + MỘT toà kho camp đã tắt; tên phim in dưới nền mép trước. Sân xếp kệ quanh toà nền tảng (ô giữa danh sách chừa cho toà dự án + tháp nền tảng).
    const O_HUB = 140, LECH_THAP = 52;   // ô giữa khối cụm phim: toà dự án ở tâm ô, tháp nền tảng lệch về góc
    const motNen = (sites: typeof mh.dich, sps: typeof mh.dich) => sites.length === 1 && sites[0]!.loai === 'nen' && !sps.length;
    function cumPhimCua(hub: typeof mh.dich[number]) {
      const co = boCumP.get(hub.khoa); if (co) return co;
      const g = new Map<string, CumP>();
      for (const c of banCua(hub.khoa)) { const k = c.cumPhim ?? c.khoa; const o = g.get(k) ?? { cum: k, ten: c.phim ?? c.ten, goc: [], nb: new Map(), cho: [], kho: null, cot: 1, O: 24, w: 0, h: 0, x: 0, z: 0, tien: 0 } as CumP;
        o.tien += (c.tien30 ?? 0) + (c.chi30 ?? 0);
        if (c.campLoai === 'tat') o.kho = c; else if (c.campLoai === 'cho') o.cho.push(c); else if (c.campGoc) o.nb.set(c.campGoc, [...(o.nb.get(c.campGoc) ?? []), c]); else o.goc.push(c);
        g.set(k, o); }
      const ds2 = [...g.values()].sort((a, b) => b.tien - a.tien);
      for (const o of ds2) for (const [k, ds3] of [...o.nb]) if (!o.goc.some((c) => c.khoa === k)) { o.goc.push(...ds3); o.nb.delete(k); }   // gốc cũng là bản nhân bản → đứng lưới
      const tienC = (c: PhoDich) => (c.tien30 ?? 0) + (c.chi30 ?? 0);
      for (const o of ds2) o.goc.sort((a, b) => tienC(b) - tienC(a));   // camp nhiều tiền đứng đầu sân
      for (const o of ds2) { o.cot = Math.max(1, Math.min(5, Math.ceil(Math.sqrt(o.goc.length)))); o.O = o.nb.size ? 36 : 26; const hang = Math.ceil(o.goc.length / o.cot);
        const ben = o.cho.length || o.kho ? 24 : 0; o.w = Math.max(84, o.cot * o.O + ben + 12); o.h = Math.max(hang * o.O, o.cho.length * 13 + (o.kho ? 26 : 0)) + 30; }
      // xếp kệ: chiều rộng kệ ≈ cạnh hình vuông cùng diện tích; ô toà nền tảng chen giữa danh sách
      const oHub = { w: O_HUB, h: O_HUB, x: 0, z: 0 } as { w: number; h: number; x: number; z: number }, hop = [...ds2] as { w: number; h: number; x: number; z: number }[];
      hop.splice(Math.floor(hop.length / 2), 0, oHub);
      const S = Math.sqrt(hop.reduce((a, o) => a + (o.w + 10) * (o.h + 10), 0)) * 1.05;
      let x = 0, z = 0, hangCao = 0, rongMax = 0;
      for (const o of hop) { if (x > 0 && x + o.w > S) { x = 0; z += hangCao + 10; hangCao = 0; } o.x = x + o.w / 2; o.z = z + o.h / 2; x += o.w + 10; hangCao = Math.max(hangCao, o.h); rongMax = Math.max(rongMax, x - 10); }
      // toạ độ sân tính từ TÂM KHỐI (toà nền tảng đứng ở ô của nó, lệch tâm một chút — quảng trường đặt toà ở tâm, nên dời toà theo)
      const cx0 = rongMax / 2, cz0 = (z + hangCao) / 2;
      for (const o of hop) { o.x -= cx0; o.z -= cz0; }
      const nua = Math.max(40, ...hop.map((o) => Math.max(Math.abs(o.x) + o.w / 2, Math.abs(o.z) + o.h / 2))) + 8;
      const kq = { nua, cum: ds2, hub: { x: oHub.x, z: oHub.z } }; boCumP.set(hub.khoa, kq); return kq;
    }
    // quảng trường vuông: toà vòng quanh đứng trên chu vi hình vuông (cạnh cách tâm rSite) → góc xa tâm hơn; rNgoai = tầm chiếm chỗ để xếp khu
    const rNgoai = (d: typeof mh.dich[number]) => ngoaiTiep(rSite(d), 4) + 14;
    const banCua = (app: string) => mh.dich.filter((b) => b.cha === app);
    const coQt = (d: typeof mh.dich[number]) => (d.loai !== 'sp' && d.loai !== 'camp') || nguonCua(d.khoa).length > 0;   // site, app, hoặc sản phẩm có nguồn (Gumroad) → quảng trường riêng
    type Khu = { k: typeof mh.duAn[number]; sites: typeof mh.dich; sps: typeof mh.dich; rSp: number; rVong: number; D: number; n: number; cx: number; cz: number; phia: number; dd?: number };
    // khu đa giác n cạnh: vòng sản phẩm và vòng quảng trường là hai đa giác đồng tâm (bán kính ngoại tiếp); D = bán kính ngoại tiếp của rào
    const ks: Khu[] = khus.map((k) => {
      const ds_ = mh.dich.filter((d) => d.duAn === k.khoa && !d.cha), sites = ds_.filter(coQt), sps = ds_.filter((d) => !coQt(d)), n = soCanh(k.khoa);
      const rSp = sps.length ? ngoaiTiep(26 + Math.min(26, sps.length * 2.2), n) : 0,   // KHU VỪA ĐỦ CHỨA VẬT (24/10/2026): không nở theo quy mô tiền — tiền nằm ở dáng / độ cao toà dự án
        maxR = Math.max(0, ...sites.map(rNgoai));
      if (!k.laDuAn && sites.length === 1 && !sps.length) return { k, sites, sps, rSp: 0, rVong: 0, D: maxR + 4, n: 4, cx: 0, cz: 0, phia: 1 };
      if (motNen(sites, sps)) return { k, sites, sps, rSp: 0, rVong: 0, D: ngoaiTiep((rSite(sites[0]!) + 12) * Math.SQRT2, n), n, cx: 0, cz: 0, phia: 1 };   // khối cụm phim (vuông) nằm trọn trong rào
      // khu dự án MỘT site (đa số): toà dự án (+ vòng sản phẩm) và site đứng CẠNH NHAU, rào bao vừa khít hai cụm — không xếp vòng quanh tâm (bỏ trống mấy phía)
      if (k.laDuAn && sites.length === 1) { const R1 = Math.max(rSp, 20), dd = R1 + maxR + 6; return { k, sites, sps, rSp, rVong: 0, D: ngoaiTiep(dd / 2 + Math.max(R1, maxR) + 6, n), n, cx: 0, cz: 0, phia: 1, dd }; }
      const chuVi = sites.reduce((a, d) => a + 2 * rNgoai(d) + 6, 0), rVong = sites.length ? Math.max(ngoaiTiep(Math.max(rSp, 20) + maxR + 6, n), chuVi / (2 * n * Math.sin(Math.PI / n))) : 0;
      return { k, sites, sps, rSp, rVong, D: ngoaiTiep(Math.max(rSp + 12, rVong + maxR + 4, 40), n), n, cx: 0, cz: 0, phia: 1 };
    });
    // XƯỞNG SX đứng riêng cạnh Công ty AI — không vào dãy khu của đại lộ
    const xuongK = ks.find((o) => o.k.khoa === KHU_XUONG);
    if (xuongK) ks.splice(ks.indexOf(xuongK), 1);
    // ── BỐ CỤC: khu đang chạy xếp hai dãy hai phía đại lộ (dãy ngắn nhận khu kế); khu dự án ngừng ra dãy ngoài cùng, sau khu dân cư
    const xep = (os: Khu[], x0: number, z: (o: Khu) => number) => { const day: [number, number] = [x0, x0]; for (const o of os) { const h = day[0] <= day[1] ? 0 : 1; o.phia = h ? 1 : -1; o.cx = day[h] + o.D; o.cz = o.phia * z(o); day[h] += 2 * o.D + 24; } return Math.max(...day); };
    const chay = ks.filter((o) => !o.k.ngung && !o.k.raRia), ngung = ks.filter((o) => o.k.ngung || o.k.raRia);   // dãy rìa: dự án ngừng + dự án cắm cờ rìa (Adfond)
    // PHƯỜNG: mỗi lĩnh vực xếp liền một đoạn đại lộ, cách nhau một khoảng có cổng
    const phuong: { lv: string; x0: number; x1: number; z: number }[] = [];
    let xChay = 0;
    for (const lv of [...new Set(chay.map((o) => o.k.linhVuc))]) { const os = chay.filter((o) => o.k.linhVuc === lv), x0 = xChay + 20, x1 = xep(os, x0 + 12, (o) => o.D + 20); phuong.push({ lv, x0, x1, z: Math.max(...os.map((o) => Math.abs(o.cz) + o.D)) + 20 }); xChay = x1 + 30; }
    const lech = -xChay / 2;
    for (const o of chay) o.cx += lech;
    for (const p of phuong) { p.x0 += lech; p.x1 += lech; }
    const zTrong = Math.max(200, ...chay.map((o) => Math.abs(o.cz) + o.D));
    const zN = zTrong + 260;   // = vành đai khu dân cư (khuNen)
    const xNgung = xep(ngung, 0, (o) => zN + 70 + o.D);
    for (const o of ngung) o.cx += lech + (xChay - xNgung) / 2;
    const zNgoai = Math.max(0, ...ngung.map((o) => Math.abs(o.cz) + o.D));
    const xKho = xChay + lech + 90;   // Kho bạc ở cuối đại lộ
    const xCty = xKho + 150, coCty = mh.congTy.length > 0;   // khu Công ty AI sau Kho bạc
    pho(lech - 40, 0, (coCty ? xCty + 110 : xKho + 60), 0, 20);
    // nền phường (màu lĩnh vực) + cổng chào trên đại lộ
    for (const p of phuong) {
      const lv = LINH_VUC[p.lv]!, nenP = add(new THREE.PlaneGeometry(p.x1 - p.x0 + 20, p.z * 2), new THREE.MeshBasicMaterial({ color: lv.mau, transparent: true, opacity: .07, depthWrite: false }), false);
      nenP.rotation.x = -Math.PI / 2; nenP.position.set((p.x0 + p.x1) / 2, .12, 0);
      for (const z of [-15, 15]) { const cot = add(new THREE.BoxGeometry(2.4, 22, 2.4), M({ color: lv.mau, emissive: lv.mau, emissiveIntensity: .35 })); cot.position.set(p.x0, 11, z); }
      const xa = add(new THREE.BoxGeometry(2.4, 3, 33), M({ color: lv.mau, emissive: lv.mau, emissiveIntensity: .35 })); xa.position.set(p.x0, 22, 0);
      const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d')!;
      g.fillStyle = lv.mau; g.beginPath(); g.roundRect(4, 4, 504, 120, 20); g.fill(); g.fillStyle = '#fff'; g.font = '800 52px system-ui, "Apple Color Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`${lv.ic} ${lv.ten.toUpperCase()}`, 256, 68, 490);
      const bien = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false })); bien.scale.set(60, 15, 1); bien.position.set(p.x0, 34, 0); bien.userData = { loai: 'lv', lv: p.lv }; the.add(bien);
    }

    // tháp site (tâm quảng trường site): xanh sáng = có nguồn; xám = chưa gắn nguồn traffic nào; hộp hồng + xu = cửa hàng Gumroad / Etsy
    // LÃI / LỖ: đích có tiền hoặc có chi → vòng sáng dưới chân: xanh = thu ≥ chi, đỏ = chi > thu
    const vongLai = (d: typeof mh.dich[number], x: number, z: number, r: number) => {
      if (d.chi30 == null && !(d.tien30 ?? 0)) return;
      const lai = (d.tien30 ?? 0) - (d.chi30 ?? 0), v = add(new THREE.TorusGeometry(r, .9, 8, 40), new THREE.MeshBasicMaterial({ color: lai >= 0 ? '#3fd68a' : '#ff4d5e', transparent: true, opacity: .85 }), false);
      v.rotation.x = Math.PI / 2; v.position.set(x, .9, z); v.userData = { chu: null }; ds.xu!.push(v);
    };
    // chữ in dưới nền (tên khu nhà máy Xưởng SX, tên cụm phim Ethopex) — không che toà như biển nổi
    const chuNen = (chu: string, x: number, z: number, rong: number, mau: string) => { const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 128; const gc = cv.getContext('2d')!; gc.fillStyle = mau; gc.textAlign = 'center'; gc.textBaseline = 'middle';
      let co = 84; gc.font = `800 ${co}px system-ui, "Apple Color Emoji", sans-serif`; while (gc.measureText(chu).width > 990 && co > 30) { co -= 4; gc.font = `800 ${co}px system-ui, "Apple Color Emoji", sans-serif`; } gc.fillText(chu, 512, 66);
      const pl = add(new THREE.PlaneGeometry(rong, rong / 8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }), false); pl.rotation.x = -Math.PI / 2; pl.position.set(x, 1.1, z); pl.userData = { chu: null }; };   // cách mặt sân (.7) đủ xa để không nháy khi nhìn từ xa
    const thapSite = (d: typeof mh.dich[number], x: number, z: number) => {
      let m: any;
      if (d.laShop) {
        m = add(new THREE.BoxGeometry(26, 16, 20), M({ color: '#d77fc4', emissive: '#ff90e8', emissiveIntensity: .18 })); m.position.set(x, 8, z);
        const fv = add(new THREE.CircleGeometry(7, 40), new THREE.MeshBasicMaterial({ map: texFav(d.site!) }), false); fv.rotation.x = -Math.PI / 2; fv.position.set(x, 16.15, z); fv.userData = { chu: m };
        for (const [dx, dz, g] of [[0, 10.1, 0], [13.1, 0, Math.PI / 2], [0, -10.1, Math.PI], [-13.1, 0, -Math.PI / 2]] as const) { const p = add(new THREE.PlaneGeometry(2.2, 14), new THREE.MeshBasicMaterial({ map: texDoc(d.site!.split('.').slice(-2).join('.'), '#ff90e8'), transparent: true, depthWrite: false }), false); p.position.set(x + dx, 8, z + dz); p.rotation.y = g; p.userData = { chu: m }; }
        for (let j = 0; j < Math.min(20, d.don ?? 0); j++) { const xu = add(new THREE.CylinderGeometry(4, 4, 1.4, 24), M({ color: '#ffd166', emissive: '#ffd166', emissiveIntensity: .7, metalness: .5 })); xu.position.set(x + 7, 18 + j * 1.8, z); xu.userData = { chu: m }; ds.xu!.push(xu); }
      } else {
        const phien = d.phien30 ?? 0, lgT = Math.log2(1 + (d.tien30 ?? 0)), h = 14 + 8 * Math.log2(1 + phien) + 5 * lgT, rT = Math.min(18, 5 + 2 * Math.log2(1 + phien) + .5 * lgT);   // cao theo khách + tiền
        m = add(new THREE.CylinderGeometry(rT * .8, rT, h, 8), d.coNguon ? M({ color: '#2a9c7a', emissive: '#1f8f6c', emissiveIntensity: .25, roughness: .4 }) : M({ color: '#3a4058', emissive: '#000000', emissiveIntensity: 0, roughness: .8 })); m.position.set(x, h / 2, z);
        if (d.coNguon) { const sang = add(new THREE.CylinderGeometry(rT * .8 + .2, rT + .2, h * .7, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#5effc4', wireframe: true, transparent: true, opacity: .18 }), false); sang.position.set(x, h * .35 + 2, z); sang.userData = { chu: m }; }
        chuDoc(d.site!, d.coNguon ? '#5effc4' : '#8e9abd', x, z, rT, rT * .8, h, m);
        const fv = add(new THREE.CircleGeometry(rT * .62, 40), new THREE.MeshBasicMaterial({ map: texFav(d.site!) }), false); fv.rotation.x = -Math.PI / 2; fv.position.set(x, h + .15, z); fv.userData = { chu: m };
      }
      m.userData = { loai: 'dich', d }; vongLai(d, x, z, 16); chiMuc.push({ ten: d.ten, nhan: 'site', obj: m });
      const dinh = m.position.y * 2;
      viTri[d.khoa] = { cua: new THREE.Vector3(x, 1.5, z), dinh: new THREE.Vector3(x, dinh, z) };
      ds.thap!.push(m);
      // cảnh báo hạ tầng (tên miền sắp hết hạn): đèn đỏ + khói như toà hỏng
      if (d.canhBao) { const dd = add(new THREE.SphereGeometry(2.4, 12, 12), new THREE.MeshBasicMaterial({ color: '#ff3b4e' }), false); dd.position.set(x, dinh + 3, z); dd.userData = { chu: m }; ds.hong!.push(dd); khoi(x, dinh + 3, z, undefined as unknown as PhoTk, m); }
      // KHÁCH THẬT (anh 23/10/2026 "mô phỏng người thực vào từng site như cột ● / 30M"): xanh = đang online (đi vào rồi đứng quanh cửa toà),
      // trắng = khách 30 phút qua (đi vào rồi ra lại mép quảng trường); gom một khối vẽ chung (khachDs → dungKhach)
      const onl = Math.min(14, d.online ?? 0), k30 = Math.min(18, Math.max(0, (d.khach30p ?? 0) - (d.online ?? 0)));
      for (let i = 0; i < onl + k30; i++) { const g = (i / Math.max(1, onl + k30)) * Math.PI * 2 + i * .7, r0 = 26 + (i % 3) * 3;
        khachDs.push({ a: new THREE.Vector3(x + Math.cos(g) * r0, 0, z + Math.sin(g) * r0), b: new THREE.Vector3(x + Math.cos(g) * 7, 0, z + Math.sin(g) * 7), t: (i * .37) % 2, toc: .0035 + (i % 5) * .0006, onl: i < onl }); }
    };
    // quảng trường site: tháp ở tâm, nguồn đứng vòng quanh (máy tìm kiếm, quảng cáo, giới thiệu, tài khoản social), phố nan hoa nối vào tâm
    const quangTruongSite = (d: typeof mh.dich[number], x0: number, z0: number) => {
      // nền tảng (Ethopex): toà dời về ô của nó trong khối cụm phim, các sân phim dựng quanh
      const bo = d.loai === 'nen' ? cumPhimCua(d) : null, x = x0 + (bo ? bo.hub.x + LECH_THAP : 0), z = z0 + (bo ? bo.hub.z + LECH_THAP : 0);
      if (bo) { for (const o of bo.cum) sanPhim(o, x0 + o.x, z0 + o.z, d); bangXepHang(d, bo, x0 + bo.hub.x - LECH_THAP, z0 + bo.hub.z + LECH_THAP); }
      const qt = add(new THREE.BoxGeometry(40, .7, 40), GACH, false); qt.position.set(x, .35, z);
      if (d.loai === 'site') thapSite(d, x, z); else if (d.loai === 'app') toaApp(d, x, z); else if (d.loai === 'nen') toaNen(d, x, z); else toaSp(d, x, z);
      qt.userData = { chu: null };
      // vòng quanh: site / sản phẩm → các nguồn; app → các bản cửa hàng, mỗi bản kèm nguồn của nó đứng liền sau
      const vong = d.loai === 'app' || d.loai === 'nen' ? vongCua(d) : nguonCua(d.khoa).sort((a, b) => (a.loai === b.loai ? b.phien - a.phien : a.loai.localeCompare(b.loai))), R = ngoaiTiep(rSite(d), 4);
      vong.forEach((v, i) => {
        const p = diemDa((i + .5) / Math.max(1, vong.length), 4, x, z, R), sx = p.x, sz = p.z, g = Math.atan2(sz - z, sx - x);
        pho(sx, sz, x + Math.cos(g) * 18, z + Math.sin(g) * 18, 6);
        if ('khoa' in v) { if (v.loai === 'camp') toaCamp(v, sx, sz); else toaSp(v, sx, sz); return; }
        const tk = v as PhoTk, t = toaNha(sx, sz, tk, maiTk(tk)); viTri[`tk:${tk.id}`] = { m: t.m, cua: t.cua }; if (tk.loai === 'mxh') chiMuc.push({ ten: tk.ten, nhan: NEN[tk.nen][1], obj: t.m });
        // ĐƯỜNG NGẦM tài khoản social → site nó trỏ về (anh 22/10/2026): luôn có, kể cả khi chưa có khách — nét đứt màu nền tảng sát đất + nhịp sáng chạy về site
        if (tk.loai === 'mxh') duongNgam([new THREE.Vector3(sx, .3, sz), new THREE.Vector3(x, .3, z)], ['#20232b', '#1b1b22', '#101010'].includes(mauTk(tk)) ? '#dfe4f2' : mauTk(tk), 1.6, ds.ngam!, { tk });
      });
      viTri[`khu-cua:${d.khoa}`] = new THREE.Vector3(x, 1.5, z);
    };
    // toà DỰ ÁN: khối bậc thang (khác hẳn tháp site) + biển "DỰ ÁN · tên" trên nóc; dự án ngừng = xám, biển ghi NGỪNG
    // toà DỰ ÁN to / cao theo QUY MÔ TIỀN của khu (thu + ROI, mô hình tính): khu kiếm nhiều tiền nhìn là thấy; khu có tiền đội vương miện vàng
    // QUY MÔ TIỀN = DÁNG + ĐỘ CAO CÔNG TRÌNH (anh 24/10/2026: "quy mô tiền có thể ở cả hình dáng công trình kiểu hiện đại"; khu không còn nở rộng theo tiền):
    // quy mô < 0,3 = khối bậc thang cổ điển thấp · 0,3–0,65 = tháp kính hiện đại có dải đèn tầng · ≥ 0,65 = toà chọc trời xoắn, chóp + vành sáng — càng nhiều tiền càng cao.
    // Chân toà gọn theo lưu lượng (khu chỉ rộng vừa đủ chứa vật), khu có tiền đội vương miện vàng trên đỉnh.
    const toaDuAn = (k: typeof mh.duAn[number], x: number, z: number, luu: number) => {
      const q = k.quyMo ?? 0, mau = k.ngung ? '#4a4f60' : dongBang(k) ? BANG : k.mau, s1 = 22 + Math.min(12, Math.log2(1 + luu) * 1.2), mai = texKhu(k.khoa);
      const kinh = (h: number) => M({ color: new THREE.Color(mau).lerp(new THREE.Color('#bcd6ff'), .45), metalness: .65, roughness: .18, emissive: mau, emissiveIntensity: .12 + .1 * h });
      const daiDen = (cao: number, w: number, d: number, buoc: number, y0: number, xoay = 0) => { const n = Math.max(1, Math.floor(cao / buoc)), im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: k.ngung || dongBang(k) ? '#4a5368' : '#ffe2a8' }), n);
        for (let i = 0; i < n; i++) { oA.position.set(x, y0 + (i + .6) * buoc, z); oA.rotation.set(0, xoay ? xoay * (i * buoc) / cao : 0, 0); oA.scale.set(w + .3, .7, d + .3); oA.updateMatrix(); im.setMatrixAt(i, oA.matrix); } im.userData = { chu: null }; the.add(im); return im; };
      let m: any, dinh: number;
      if (q < .3) {   // cổ điển: ba khối bậc thang
        const th = 9 + 10 * q; m = add(new THREE.BoxGeometry(s1, th, s1), M({ color: new THREE.Color(mau).lerp(new THREE.Color('#ffffff'), .08), roughness: .55 })); m.position.set(x, th / 2, z);
        const b2 = add(new THREE.BoxGeometry(s1 * .7, th, s1 * .7), M({ color: mau, roughness: .55 })); b2.position.set(x, th * 1.5, z); b2.userData = { chu: m };
        const b3 = add(new THREE.BoxGeometry(s1 * .42, th, s1 * .42), [M({ color: mau }), M({ color: mau }), M({ map: mai, emissive: '#fff', emissiveMap: mai, emissiveIntensity: .45 }), M({ color: mau }), M({ color: mau }), M({ color: mau })]); b3.position.set(x, th * 2.5, z); b3.userData = { chu: m };
        dinh = th * 3;
      } else if (q < .65) {   // tháp kính hiện đại: thân kính vát + dải đèn tầng + mái phẳng mang logo
        const H = 42 + 120 * (q - .3) / .35, w = s1 * .62; m = add(new THREE.BoxGeometry(w, H, w * .8), kinh(q)); m.position.set(x, H / 2, z);
        const de = add(new THREE.BoxGeometry(s1, 6, s1), M({ color: new THREE.Color(mau).lerp(new THREE.Color('#ffffff'), .1), roughness: .5 })); de.position.set(x, 3, z); de.userData = { chu: m };
        daiDen(H - 6, w, w * .8, 7, 6);
        const nap = add(new THREE.BoxGeometry(w * .9, 2.4, w * .72), [M({ color: mau }), M({ color: mau }), M({ map: mai, emissive: '#fff', emissiveMap: mai, emissiveIntensity: .5 }), M({ color: mau }), M({ color: mau }), M({ color: mau })]); nap.position.set(x, H + 1.2, z); nap.userData = { chu: m };
        dinh = H + 2.4;
      } else {   // chọc trời xoắn: 8 đốt kính xoay dần + thu nhỏ, dải đèn ở mỗi khớp, chóp + vành sáng
        const H = 150 + 130 * Math.min(1, (q - .65) / .35), w0 = s1 * 1.05, so = 8, hD = H / so;
        const de = add(new THREE.BoxGeometry(s1 + 4, 7, s1 + 4), M({ color: new THREE.Color(mau).lerp(new THREE.Color('#ffffff'), .1), roughness: .5 })); de.position.set(x, 3.5, z);
        m = de;
        for (let i = 0; i < so; i++) { const f = 1 - i * .05, d = add(new THREE.BoxGeometry(w0 * f, hD - 1.2, w0 * f), kinh(q)); d.position.set(x, 7 + hD * (i + .5), z); d.rotation.y = i * .1; d.userData = { chu: m };
          const khop = add(new THREE.BoxGeometry(w0 * f + .6, 1.2, w0 * f + .6), new THREE.MeshBasicMaterial({ color: k.ngung || dongBang(k) ? '#4a5368' : '#ffe2a8' }), false); khop.position.set(x, 7 + hD * (i + 1) - .6, z); khop.rotation.y = i * .1; khop.userData = { chu: m }; }   // khớp đốt sáng (đèn tầng), xoay cùng đốt
        const nap = add(new THREE.CylinderGeometry(w0 * .5 * (1 - so * .05), w0 * .5 * (1 - so * .05), 3, 16), [M({ map: mai, emissive: '#fff', emissiveMap: mai, emissiveIntensity: .5 }), M({ map: mai, emissive: '#fff', emissiveMap: mai, emissiveIntensity: .5 }), M({ color: mau })]); nap.position.set(x, 7 + H + 1.5, z); nap.userData = { chu: m };
        const chop = add(new THREE.CylinderGeometry(.4, 1.6, 28, 8), M({ color: '#dfe6f5', metalness: .8, roughness: .2 }), false); chop.position.set(x, 7 + H + 17, z); chop.userData = { chu: m };
        const vanh = add(new THREE.TorusGeometry(w0 * .55, .7, 8, 40), new THREE.MeshBasicMaterial({ color: '#7fd8ff', transparent: true, opacity: .55, depthWrite: false }), false); vanh.rotation.x = Math.PI / 2; vanh.position.set(x, 7 + H * .62, z); vanh.userData = { chu: m }; ds.cot!.push(vanh);
        dinh = 7 + H + 31;
      }
      const th = dinh / 3;   // các phần dưới (vương miện, biển, cột biển) đọc theo đỉnh toà
      if ((k.tien30 ?? 0) > 0) { const vm = add(new THREE.TorusGeometry(s1 * .3, .9 + 1.6 * q, 8, 32), M({ color: '#ffd166', emissive: '#ffb703', emissiveIntensity: .6 + .6 * q, metalness: .5 }), false); vm.rotation.x = Math.PI / 2; vm.position.set(x, dinh + 1, z); vm.userData = { chu: m }; }
      const yB = th * 3 + 20 + 10 * q, coB = 1 + .6 * q;
      const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d')!;
      g.fillStyle = k.ngung ? 'rgba(60,64,80,.92)' : 'rgba(17,24,48,.92)'; g.beginPath(); g.roundRect(4, 4, 504, 152, 22); g.fill(); g.strokeStyle = k.ngung ? '#8e9abd' : '#ffd27a'; g.lineWidth = 5; g.stroke();
      g.fillStyle = k.ngung ? '#c8cede' : '#ffd27a'; g.font = '800 40px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(k.nhan, 256, 58);
      g.fillStyle = '#ffffff'; let co = 54; g.font = `800 ${co}px system-ui, sans-serif`; while (g.measureText(k.ten).width > 470 && co > 26) { co -= 3; g.font = `800 ${co}px system-ui, sans-serif`; } g.fillText(k.ten, 256, 122);
      const bien = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false })); bien.scale.set(84 * coB, 26 * coB, 1); bien.position.set(x, yB, z); bien.userData = { chu: m }; the.add(bien);
      const cot = add(new THREE.CylinderGeometry(.5, .5, 8, 6), M({ color: '#9aa3b8' }), false); cot.position.set(x, th * 3 + 4, z); cot.userData = { chu: m };
      m.userData = { loai: 'khu', khoa: k.khoa }; chiMuc.push({ ten: k.ten, nhan: 'dự án', obj: m }); return m;
    };
    // toà SẢN PHẨM: hộp nhỏ, nóc là logo cửa bán (App Store, Microsoft Store, Gumroad, Etsy, KDP, Udemy…); sắp lên (đang duyệt / sẵn sàng) = khung mờ
    function toaSp(d: typeof mh.dich[number], x: number, z: number) {
      queueMicrotask(() => { const o = the.children.find((c: any) => c.userData?.d === d); if (o) chiMuc.push({ ten: d.ten, nhan: d.nenBan ?? 'sản phẩm', obj: o }); });
      const so = (d.xem7 ?? 0) + (d.tai ?? 0) * 3 + (d.net ?? 0) * 5, w = 14 + Math.min(8, Math.log2(1 + so) * 1.4), h = 12 + Math.min(18, Math.log2(1 + so) * 2.4);
      const mai = texFav(d.hostBan ?? 'shop', '#6a3f8f'), than = M({ color: '#6a5a9f', roughness: .5, transparent: !!d.sapLen, opacity: d.sapLen ? .4 : 1 });
      const m = add(new THREE.BoxGeometry(w, h, w), [than, than, M({ map: mai, emissive: '#fff', emissiveMap: mai, emissiveIntensity: .4, transparent: !!d.sapLen, opacity: d.sapLen ? .6 : 1 }), than, than, than]); m.position.set(x, h / 2, z);
      if (d.sapLen) { const khung = add(new THREE.BoxGeometry(w + 1, h + 1, w + 1), new THREE.MeshBasicMaterial({ color: '#b48cff', wireframe: true, transparent: true, opacity: .5 }), false); khung.position.copy(m.position); khung.userData = { chu: m }; }
      m.userData = { loai: 'dich', d }; viTri[d.khoa] = { cua: new THREE.Vector3(x, 1.5, z), dinh: new THREE.Vector3(x, h, z) }; vongLai(d, x, z, w * .9);
      bangTen(x, z, w, h, d.cha ? (TEN_BAN[d.nenBan ?? ''] ?? d.nenBan ?? d.ten) : d.ten, d.sapLen ? '🏗 sắp lên' : '', '#b48cff', m);
    }
    // toà APP: thân dáng điện thoại (khối mảnh, mặt trước là màn hình sáng) + tên dọc; các bản cửa hàng đứng quanh
    function toaApp(d: typeof mh.dich[number], x: number, z: number) {
      queueMicrotask(() => { const o = the.children.find((c: any) => c.userData?.d === d); if (o) chiMuc.push({ ten: d.ten, nhan: 'app', obj: o }); });
      const ban = banCua(d.khoa), so = ban.reduce((a, b) => a + (b.xem7 ?? 0) + (b.tai ?? 0) * 3, 0), h = 26 + Math.min(30, Math.log2(1 + so) * 3);
      const than = M({ color: '#1d2433', roughness: .35, metalness: .4, transparent: !!d.sapLen, opacity: d.sapLen ? .5 : 1 }), man = M({ color: '#3a6ff0', emissive: '#3a6ff0', emissiveIntensity: .55 });
      const m = add(new THREE.BoxGeometry(12, h, 6), [than, than, than, than, man, man]); m.position.set(x, h / 2, z); m.userData = { loai: 'dich', d };
      chuDoc(d.ten, '#3a6ff0', x, z, 6.4, 6.4, h, m); vongLai(d, x, z, 11);
      viTri[d.khoa] = { cua: new THREE.Vector3(x, 1.5, z) };
    }
    // toà NỀN TẢNG (Ethopex): tháp kính xanh Meta ở tâm khu, cao theo tiền; tên + thu / chi dọc thân; các camp đứng quanh
    function toaNen(d: typeof mh.dich[number], x: number, z: number) {
      const tien = (d.tien30 ?? 0) + (d.chi30 ?? 0), h = 40 + Math.min(50, Math.log2(1 + tien) * 5);
      const m = add(new THREE.CylinderGeometry(9, 12, h, 8), M({ color: '#0b3a8f', emissive: '#0866ff', emissiveIntensity: .35, roughness: .2, metalness: .6 })); m.position.set(x, h / 2, z); m.userData = { loai: 'dich', d };
      const fv = add(new THREE.CircleGeometry(7, 40), new THREE.MeshBasicMaterial({ map: texFav(d.hostBan ?? 'facebook.com', '#0866ff') }), false); fv.rotation.x = -Math.PI / 2; fv.position.set(x, h + .15, z); fv.userData = { chu: m };
      chuDoc(d.ten, '#6ea8ff', x, z, 12, 9, h, m); vongLai(d, x, z, 17);
      viTri[d.khoa] = { cua: new THREE.Vector3(x, 1.5, z), dinh: new THREE.Vector3(x, h, z) }; chiMuc.push({ ten: d.ten, nhan: 'nền tảng', obj: m });
    }
    // SÂN PHIM: nền + tên phim in dưới nền mép trước; camp gốc lưới, bản nhân bản vòng quanh gốc, cột phải = camp chờ public rồi kho camp tắt
    function sanPhim(o: CumP, cx: number, cz: number, hub: typeof mh.dich[number]) {
      const san = add(new THREE.BoxGeometry(o.w, .5, o.h), M({ color: '#15213a', roughness: .9 }), false); san.position.set(cx, .45, cz); san.userData = { loai: 'cum-phim', cum: o.cum, hub: hub.khoa }; ds.san!.push(san);
      const nb = [...o.nb.values()].reduce((a, x) => a + x.length, 0), chay = o.goc.length + nb;
      bangHieuPhim(o, `${chay} chạy${o.cho.length ? ` · ${o.cho.length} chờ public` : ''}${o.kho ? ` · ${o.kho.soTat} tắt` : ''}`, cx, cz + o.h / 2, hub);
      const gx = cx - o.w / 2 + 6 + o.O / 2, gz = cz - o.h / 2 + o.O / 2 + 2;
      o.goc.forEach((c, n) => { const px = gx + (n % o.cot) * o.O, pz = gz + Math.floor(n / o.cot) * o.O; toaCamp(c, px, pz, 'goc');
        (o.nb.get(c.khoa) ?? []).forEach((b2, i, a) => { const g2 = (i / a.length) * Math.PI * 2 + Math.PI / 4; toaCamp(b2, px + Math.cos(g2) * 12, pz + Math.sin(g2) * 12, 'nb'); }); });
      const bx = cx + o.w / 2 - 13; let bz = cz - o.h / 2 + 9;
      for (const c of o.cho) { toaCamp(c, bx, bz, 'cho'); bz += 13; }
      if (o.kho) toaKho(o.kho, bx, bz + 9);
      chiMuc.push({ ten: `${o.ten} (cụm phim)`, nhan: 'phim Ethopex', obj: san });
    }
    // BẢNG HIỆU PHIM (anh 23/10/2026 "chữ tên phim viết dưới nền bé và khó đọc — làm cái bảng hiệu"): biển đứng trên cột ở mép trước sân phim, luôn quay mặt
    // về camera (sprite) nên đọc được ở mọi góc xoay; ghi tên phim + ROI / lãi / chi / thu ngày báo cáo mới nhất + ROI / lãi 30 ngày; viền xanh lãi · đỏ lỗ.
    // Rê chuột lên biển = thẻ bảng camp của phim (cùng thẻ với sân).
    function bangHieuPhim(o: CumP, phu: string, x: number, z: number, hub: typeof mh.dich[number]) {
      const so = soCum(o), r = roiCua(so.tH, so.cH), r30 = roiCua(so.t30, so.c30), mau = so.cH <= 0 && so.tH <= 0 ? '#6b7592' : so.tH >= so.cH ? '#3fd68a' : '#ff4d5e';
      const cv = document.createElement('canvas'); cv.width = 640; cv.height = 300; const g = cv.getContext('2d')!;
      g.fillStyle = '#0c1326ee'; g.strokeStyle = mau; g.lineWidth = 10; g.beginPath(); (g as any).roundRect ? (g as any).roundRect(6, 6, 628, 288, 22) : g.rect(6, 6, 628, 288); g.fill(); g.stroke();
      const vua = (chu: string, co: number, max: number, nang = 800) => { let c = co; g.font = `${nang} ${c}px system-ui, sans-serif`; while (g.measureText(chu).width > max && c > 18) { c -= 2; g.font = `${nang} ${c}px system-ui, sans-serif`; } };
      g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = '#ffffff'; vua(o.ten, 46, 596); g.fillText(o.ten, 22, 52);
      g.fillStyle = '#8e9abd'; g.font = '700 22px system-ui, sans-serif'; g.fillText(ngayNgan(hub.ngayHom).toUpperCase(), 22, 108);
      g.fillStyle = mau; g.font = '900 64px system-ui, sans-serif'; g.fillText(roiChu(r), 22, 150);
      g.textAlign = 'right'; g.fillStyle = mau; vua(`lãi ${usd(so.tH - so.cH)}`, 46, 330); g.fillText(`lãi ${usd(so.tH - so.cH)}`, 616, 116);
      g.fillStyle = '#d6def5'; vua(`chi ${usd(so.cH)} · thu ${usd(so.tH)}`, 32, 360, 700); g.fillText(`chi ${usd(so.cH)} · thu ${usd(so.tH)}`, 616, 166);
      g.textAlign = 'left'; g.fillStyle = '#b8c3e0'; vua(`30 ngày: ROI ${roiChu(r30)} · lãi ${usd(so.t30 - so.c30)} · chi ${usd(so.c30)}`, 28, 596, 700); g.fillText(`30 ngày: ROI ${roiChu(r30)} · lãi ${usd(so.t30 - so.c30)} · chi ${usd(so.c30)}`, 22, 222);
      g.fillStyle = '#7f8db5'; vua(`🎬 ${phu}`, 26, 596, 700); g.fillText(`🎬 ${phu}`, 22, 264);
      const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
      const Wb = Math.max(58, Math.min(96, o.w * .8)), Hb = Wb * 300 / 640, day = 16;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex })); sp.scale.set(Wb, Hb, 1); sp.position.set(x, day + Hb / 2, z); sp.userData = { loai: 'cum-phim', cum: o.cum, hub: hub.khoa }; the.add(sp);
      const cot = add(new THREE.CylinderGeometry(.8, .8, day, 6), M({ color: '#9aa3b8' }), false); cot.position.set(x, day / 2, z); cot.userData = { chu: null };
      const kb = `${hub.khoa}|${o.cum}`; bienPhim.set(kb, [sp, cot]); if (tatBien[hub.khoa]) datBien(kb, false);
    }
    // BẢNG XẾP HẠNG PHIM cạnh toà nền tảng: như bảng Content của Ethopex — phim có tiêu tiền ngày báo cáo mới nhất, xếp theo ROI, dòng TỔNG cuối
    function bangXepHang(hub: typeof mh.dich[number], bo: { cum: CumP[] }, x: number, z: number) {
      const ds_ = bo.cum.map((o) => ({ o, so: soCum(o) })).filter((v) => v.so.cH > 0 || v.so.tH > 0).sort((a, b) => (roiCua(b.so.tH, b.so.cH) ?? 9) - (roiCua(a.so.tH, a.so.cH) ?? 9));
      const tong = ds_.reduce((a, v) => ({ t: a.t + v.so.tH, c: a.c + v.so.cH }), { t: 0, c: 0 }), hien = ds_.slice(0, 18), cao = 96 + (hien.length + 1) * 34 + 16;   // TỔNG cộng mọi phim, bảng hiện 18 dòng đầu
      const cv = document.createElement('canvas'); cv.width = 720; cv.height = cao; const g = cv.getContext('2d')!;
      g.fillStyle = '#0c1326f0'; g.fillRect(0, 0, 720, cao); g.strokeStyle = '#4fd1ff'; g.lineWidth = 8; g.strokeRect(4, 4, 712, cao - 8);
      g.textBaseline = 'middle'; g.fillStyle = '#ffffff'; g.font = '800 34px system-ui, sans-serif'; g.textAlign = 'left'; g.fillText(`🎬 Phim · ${ngayNgan(hub.ngayHom)}`, 20, 38);
      const COT = [['ROI', 430], ['Lãi', 530], ['Chi', 620], ['Thu', 704]] as const;
      g.font = '700 20px system-ui, sans-serif'; g.fillStyle = '#8e9abd'; g.fillText('PHIM', 20, 80); g.textAlign = 'right'; for (const [t, cx] of COT) g.fillText(t.toUpperCase(), cx, 80);
      const dong = (y: number, ten: string, t: number, c: number, dam = false) => { const r = roiCua(t, c), mau = t >= c ? '#3fd68a' : '#ff4d5e';
        g.textAlign = 'left'; g.fillStyle = '#e6ecff'; g.font = `${dam ? 800 : 600} 22px system-ui, sans-serif`; let tt = ten; while (g.measureText(tt).width > 310 && tt.length > 4) tt = tt.slice(0, -2); g.fillText(tt === ten ? ten : `${tt}…`, 20, y);
        g.textAlign = 'right'; g.fillStyle = mau; g.fillText(roiChu(r), 430, y); g.fillText(usd(t - c), 530, y); g.fillStyle = '#d6def5'; g.fillText(usd(c), 620, y); g.fillText(usd(t), 704, y); };
      hien.forEach((v, i) => dong(114 + i * 34, v.o.ten, v.so.tH, v.so.cH));
      g.fillStyle = '#2a3352'; g.fillRect(16, 96 + hien.length * 34, 688, 2); dong(114 + hien.length * 34, ds_.length > hien.length ? `TỔNG ${ds_.length} phim` : 'TỔNG', tong.t, tong.c, true);
      const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4; const Wb = 120, Hb = Wb * cao / 720, day = 14;
      // GỌN MẶC ĐỊNH (anh 23/10/2026 "bảng này chỉ hover vào mới hiện ra"): bình thường chỉ là biển một dòng (tên + ROI / lãi tổng);
      // rê chuột lên biển hoặc toà nền tảng thì mở đủ bảng, rời ra thì gọn lại (datBangXh trong onMove)
      const cg = document.createElement('canvas'); cg.width = 720; cg.height = 120; const gg = cg.getContext('2d')!; const rT = roiCua(tong.t, tong.c), mT = tong.t >= tong.c ? '#3fd68a' : '#ff4d5e';
      gg.fillStyle = '#0c1326f0'; gg.fillRect(0, 0, 720, 120); gg.strokeStyle = '#4fd1ff'; gg.lineWidth = 8; gg.strokeRect(4, 4, 712, 112); gg.textBaseline = 'middle';
      gg.textAlign = 'left'; gg.fillStyle = '#fff'; gg.font = '800 34px system-ui, sans-serif'; gg.fillText(`🎬 ${ds_.length} phim · ${ngayNgan(hub.ngayHom)}`, 22, 42);
      const nCho = bo.cum.reduce((n, o) => n + o.cho.length, 0); gg.font = '700 24px system-ui, sans-serif'; gg.fillStyle = nCho ? '#4fd1ff' : '#8e9abd'; gg.fillText(`${nCho ? `⏳ ${nCho} camp chờ public · ` : ''}rê chuột xem bảng`, 22, 88);
      gg.textAlign = 'right'; gg.fillStyle = mT; gg.font = '900 40px system-ui, sans-serif'; gg.fillText(roiChu(rT), 700, 42); gg.font = '700 24px system-ui, sans-serif'; gg.fillText(`lãi ${usd(tong.t - tong.c)}`, 700, 88);
      const texGon = new THREE.CanvasTexture(cg); texGon.anisotropy = 4; const HbGon = Wb * 120 / 720;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGon })); sp.scale.set(Wb, HbGon, 1); sp.position.set(x, day + HbGon / 2, z);
      sp.userData = { loai: 'dich', d: hub, bangXh: { texDu: tex, texGon, HbDu: Hb, HbGon, day } }; the.add(sp); bangXhCua.set(hub.khoa, sp);
      for (const dx of [-Wb * .3, Wb * .3]) { const cot = add(new THREE.CylinderGeometry(1, 1, day, 6), M({ color: '#9aa3b8' }), false); cot.position.set(x + dx, day / 2, z); cot.userData = { chu: null }; }
      // TRẠM ĐIỆN BẢNG HIỆU (anh 23/10/2026 "phải thiết kế như một công trình liên quan, không phải cái nút"): nhà trạm bên trái bảng xếp hạng (bên phải là toà nền tảng), cầu dao lớn ở mặt trước,
      // đèn tín hiệu trên mái, biển tên gắn tường; dây điện chạy trên mặt đất tới chân từng bảng hiệu phim. Bật: đèn + dây sáng xanh, cần gạt hướng lên;
      // tắt: đèn + dây tối, cần gạt hướng xuống, bảng hiệu tắt hết (rê lên phim vẫn lộ biển phim đó). Bấm vào bất cứ phần nào của trạm = gạt cầu dao.
      const K = 1.9, nx = x - Wb / 2 - 26 * K, nz = z, bat = !tatBien[hub.khoa], nut = { loai: 'nut-bien', hub: hub.khoa }, dau0 = the.children.length;   // K = cỡ trạm so với bảng hiệu
      const vat = (g: any, m: any, px: number, py: number, pz: number, bong = true) => { const o = add(g, m, bong); o.position.set(px, py, pz); o.userData = nut; return o; };
      vat(new THREE.BoxGeometry(26, 1, 22), GACH, nx, .5, nz, false);
      vat(new THREE.BoxGeometry(16, 13, 12), M({ color: '#2b3550', roughness: .7, metalness: .2 }), nx, 7.5, nz);
      vat(new THREE.BoxGeometry(18, 1.2, 14), M({ color: '#3d4a6e', roughness: .6 }), nx, 14.6, nz);
      // sọc cảnh báo vàng đen chân trạm
      vat(new THREE.BoxGeometry(16.2, 1.4, 12.2), M({ color: '#e0b020', roughness: .6 }), nx, 1.7, nz, false);
      // đèn tín hiệu trên mái
      vat(new THREE.CylinderGeometry(.6, .6, 3, 8), M({ color: '#9aa3b8' }), nx, 16.7, nz, false);
      vat(new THREE.SphereGeometry(2.4, 16, 12), M({ color: bat ? '#3fd68a' : '#3a4260', emissive: bat ? '#3fd68a' : '#000000', emissiveIntensity: bat ? 1.2 : 0, roughness: .3 }), nx, 19.6, nz, false);
      // cầu dao ở mặt trước (+z) và mặt bên (−x) — hai hướng nhìn mặc định của máy tính và điện thoại
      for (const [fx, fz, quay] of [[0, 6.05, 0], [-8.05, 0, -Math.PI / 2]] as const) {
        const tam = new THREE.Group(); tam.position.set(nx + fx, 7, nz + fz); tam.rotation.y = quay; the.add(tam);
        const hop = new THREE.Mesh(new THREE.BoxGeometry(6, 8, .8), M({ color: '#151b2e', roughness: .5 })); hop.position.set(0, 0, .4); hop.userData = nut; tam.add(hop);
        const can = new THREE.Mesh(new THREE.BoxGeometry(1, 5, 1), M({ color: '#c9d2e6', metalness: .6, roughness: .3 })); can.geometry.translate(0, 2.5, 0); can.position.set(0, 0, 1.3); can.rotation.x = bat ? .5 : Math.PI - .5; can.userData = nut; tam.add(can);
        const num = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), M({ color: '#e0303f', roughness: .4 })); num.userData = nut;   // núm đỏ ở đầu cần gạt
        num.position.set(0, bat ? 5 * Math.cos(.5) : -5 * Math.cos(.5), 1.3 + 5 * Math.sin(.5)); tam.add(num);
        // biển tên gắn tường phía trên cầu dao
        const cv2 = document.createElement('canvas'); cv2.width = 512; cv2.height = 160; const g2 = cv2.getContext('2d')!; g2.fillStyle = '#0c1326'; g2.fillRect(0, 0, 512, 160); g2.strokeStyle = bat ? '#3fd68a' : '#8e9abd'; g2.lineWidth = 10; g2.strokeRect(5, 5, 502, 150);
        g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillStyle = '#fff'; g2.font = '800 44px system-ui, sans-serif'; g2.fillText('⚡ TRẠM BẢNG HIỆU', 256, 56); g2.fillStyle = bat ? '#3fd68a' : '#8e9abd'; g2.font = '900 46px system-ui, sans-serif'; g2.fillText(bat ? 'ĐANG BẬT' : 'ĐANG TẮT', 256, 116);
        const bien = new THREE.Mesh(new THREE.PlaneGeometry(13, 4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv2) })); bien.position.set(0, 4.3, .05); bien.userData = nut; tam.add(bien);
        tam.updateMatrixWorld(true); for (const c of [...tam.children]) the.attach(c); the.remove(tam); }   // bắt chuột chỉ quét con trực tiếp của `the`
      for (const o of the.children.slice(dau0)) { o.position.set(nx + (o.position.x - nx) * K, o.position.y * K, nz + (o.position.z - nz) * K); o.scale.multiplyScalar(K); }   // phóng cả trạm quanh chân
      // dây điện trên mặt đất: từ trạm tới chân từng bảng hiệu phim (một khối vẽ)
      const dayDien: number[] = [];
      for (const [k, ds_] of bienPhim) if (k.startsWith(`${hub.khoa}|`)) { const q = ds_[0].position; dayDien.push(nx, .9, nz, nx, .9, q.z, nx, .9, q.z, q.x, .9, q.z); }
      if (dayDien.length) { const gd = new THREE.BufferGeometry(); gd.setAttribute('position', new THREE.Float32BufferAttribute(dayDien, 3));
        const ld = new THREE.LineSegments(gd, new THREE.LineBasicMaterial({ color: bat ? '#3fd68a' : '#3a4260', transparent: true, opacity: bat ? .7 : .45 })); ld.userData = { chu: null }; the.add(ld); }
    }
    // toà CAMP (góp ý #1439): hình theo dạng creative (kể chuyện = trụ tròn · cảnh thật = khối vuông · cảnh cuối = khối mái chóp · phim dài = khối dẹt dài ·
    // khác = trụ lục giác), màu theo trạng thái (xanh lãi · đỏ lỗ · tím vi phạm · xanh nhạt khung sáng = chờ public), cao theo thu + chi 30 ngày;
    // bản nhân bản bằng nửa; đủ luật nhân bản = viên kim cương vàng trên nóc; lỗ sâu chạm luật tắt = bốc khói
    function toaCamp(d: typeof mh.dich[number], x: number, z: number, vai: 'goc' | 'nb' | 'cho' = 'goc') {
      const thu = d.tien30 ?? 0, chi = d.chi30 ?? 0, s = vai === 'nb' ? 6 : vai === 'cho' ? 9 : 12, k = s / 12, h0 = k * (8 + Math.min(20, Math.log2(1 + thu + chi) * 3));
      const mau = d.campLoai === 'vi-pham' ? MAU_CAMP.viPham : vai === 'cho' ? MAU_CAMP.cho : thu >= chi ? MAU_CAMP.lai : MAU_CAMP.lo, cho = vai === 'cho';
      const vl = M({ color: new THREE.Color(mau).multiplyScalar(.45), emissive: mau, emissiveIntensity: cho ? .25 : .38, roughness: .4, transparent: cho, opacity: cho ? .5 : 1 });
      const dai = d.dangCr === 'phim dài', h = dai ? h0 * .6 : h0;
      const geo = d.dangCr === 'kể chuyện' ? new THREE.CylinderGeometry(s * .5, s * .5, h, 14) : dai ? new THREE.BoxGeometry(s * 1.5, h, s * .7)
        : d.dangCr === 'cảnh thật' || d.dangCr === 'cảnh cuối' ? new THREE.BoxGeometry(s, h, s) : new THREE.CylinderGeometry(s * .55, s * .55, h, 6);
      const m = add(geo, vl); m.position.set(x, h / 2, z); m.userData = { loai: 'dich', d };
      if (d.dangCr === 'cảnh cuối') { const mai = add(new THREE.ConeGeometry(s * .72, s * .55, 4), vl); mai.rotation.y = Math.PI / 4; mai.position.set(x, h + s * .27, z); mai.userData = { chu: m }; }
      // CHỜ PUBLIC nổi bật (anh 23/10/2026 "chờ là quan trọng"): khung sáng nhấp nháy + cột sáng xanh dựng đứng trên nóc, phóng xa vẫn thấy (nhịp ở vòng vẽ, ds.cho)
      if (cho) { const kh = add(new THREE.BoxGeometry(s + 1, h + 1, s + 1), new THREE.MeshBasicMaterial({ color: MAU_CAMP.cho, wireframe: true, transparent: true, opacity: .55 }), false); kh.position.copy(m.position); kh.userData = { chu: m };
        const cot = add(new THREE.CylinderGeometry(.9, .9, 40, 8, 1, true), new THREE.MeshBasicMaterial({ color: MAU_CAMP.cho, transparent: true, opacity: .45, depthWrite: false }), false); cot.position.set(x, h + 20, z); cot.userData = { chu: m };
        ds.cho!.push(kh, cot); }
      if (d.nhanBanDuoc) { const kc = add(new THREE.OctahedronGeometry(s * .32 + 1), M({ color: '#ffd166', emissive: '#ffb703', emissiveIntensity: .9, metalness: .5 }), false); kc.position.set(x, h + s * .6 + 3, z); kc.userData = { chu: m }; }
      if (d.sapTat) khoi(x, h + 1, z, undefined as unknown as PhoTk, m, 10);
      viTri[d.khoa] = { cua: new THREE.Vector3(x, 1.5, z) }; chiMuc.push({ ten: d.ten, nhan: 'camp', obj: m });
    }
    // KHO CAMP ĐÃ TẮT: mọi camp tắt của một phim gộp một toà xám thấp, biển ghi số camp
    function toaKho(d: typeof mh.dich[number], x: number, z: number) {
      const m = add(new THREE.BoxGeometry(18, 7, 14), M({ color: '#3a3f50', roughness: .8 })); m.position.set(x, 3.5, z); m.userData = { loai: 'dich', d };
      bangTen(x, z, 18, 7, `⏸ ${d.soTat} tắt`, '', '#8e9abd', m);
    }
    // TIỀN: đồng xu chồng cạnh đích có tiền 30 ngày; xe vàng chở về Kho bạc
    const coTien: { d: typeof mh.dich[number]; khu: { cx: number; cz: number; phia: number } }[] = [];
    const khuPos: Record<string, { cx: number; cz: number; phia: number }> = {};
    for (const o of ks) {
      const { k, cx, cz } = o; khuPos[k.khoa] = o; banKinhKhu[k.khoa] = o.D;
      pho(cx, 0, cx, cz, 12);
      const mauRao = k.ngung ? '#5a5f70' : dongBang(k) ? BANG_RAO : new THREE.Color(LINH_VUC[k.linhVuc]!.mau).lerp(new THREE.Color('#ffffff'), .25).getStyle();
      // poster số liệu của khu (thân toà chỉ còn tên — anh 22/10/2026)
      const dsKhu = mh.dich.filter((d) => d.duAn === k.khoa && !d.cha), cs = mh.dich.filter((d) => d.duAn === k.khoa && d.loai === 'camp' && d.trangThai === 'active');
      const phienK = dsKhu.reduce((a, d) => a + (d.phien30 ?? 0), 0), xemK = dsKhu.reduce((a, d) => a + (d.xem7 ?? 0), 0), onlK = dsKhu.reduce((a, d) => a + (d.online ?? 0), 0), thuK = k.tien30 ?? 0, chiK = k.chi30 ?? 0;
      const posters: Poster[] = [
        ...(dongBang(k) ? [{ ic: '❄', so: 'ĐƠ', nhan: 'chưa gắn nguồn traffic', ma: 'do' }] : []),
        ...(thuK ? [{ ic: '💵', so: `$${Math.round(thuK).toLocaleString('en-US')}`, nhan: 'thu 30 ngày', ma: 'thu' }] : []),
        ...(chiK ? [{ ic: thuK >= chiK ? '📈' : '📉', so: `${thuK >= chiK ? '+' : '−'}$${Math.round(Math.abs(thuK - chiK)).toLocaleString('en-US')}`, nhan: thuK >= chiK ? 'lãi 30 ngày' : 'lỗ 30 ngày', ma: 'lai' }] : []),
        ...(phienK ? [{ ic: '🚗', so: gon(phienK), nhan: 'phiên 30 ngày', ma: 'phien' }] : []),
        ...(onlK ? [{ ic: '🟢', so: String(onlK), nhan: 'đang xem', ma: 'onl' }] : []),
        ...(xemK ? [{ ic: '👁', so: gon(xemK), nhan: 'xem 7 ngày', ma: 'xem' }] : []),
        ...(cs.length ? [{ ic: '🎬', so: String(cs.length), nhan: 'camp đang chạy', ma: 'camp' }] : []),
      ].slice(0, 6);
      const ganXe = (r2: { cong: any; ra: any } | null) => { if (r2 && !k.ngung && !dongBang(k)) xeRaVao(cx, cz, o.phia, r2.cong, r2.ra, 2 + Math.round(4 * (k.quyMo ?? 0))); };
      if (!k.laDuAn && o.sites.length === 1 && !o.sps.length) { quangTruongSite(o.sites[0]!, cx, cz); ganXe(raoQuanh(dinhDa(4, cx, cz, o.D), mauRao, cx, cz, o.phia, k.ten, posters, k.khoa)); continue; }   // site đứng riêng: tự là một khu
      const nen_ = add(new THREE.CylinderGeometry(o.D, o.D, .4, o.n, 1, false, Math.PI / 2 - Math.PI / o.n), M({ color: k.ngung ? '#14161f' : dongBang(k) ? BANG_NEN : new THREE.Color('#121a30').lerp(new THREE.Color(LINH_VUC[k.linhVuc]!.mau), .22), roughness: 1 }), false); nen_.position.set(cx, .2, cz); ds.san!.push(nen_);
      { const dinh = dinhDa(o.n, cx, cz, o.D), sau = k.khoa === khuXuongPhim() ? giaoCanh(dinh, cx, cz, 0, o.phia)?.p ?? null : null; if (sau) congSauKhu.set(k.khoa, sau.clone());
        ganXe(raoQuanh(dinh, mauRao, cx, cz, o.phia, k.ten, posters, k.khoa, sau)); }
      const luu = o.sites.reduce((a, d) => a + (d.phien30 ?? 0), 0) + o.sps.reduce((a, d) => a + (d.xem7 ?? 0), 0);
      const boN = motNen(o.sites, o.sps) ? cumPhimCua(o.sites[0]!).hub : null;   // khu một nền tảng: toà dự án vào ô giữa khối cụm phim
      if (o.dd != null && !boN) { const tx = cx - o.dd / 2, sx = cx + o.dd / 2; toaDuAn(k, tx, cz, luu); o.sps.forEach((d, i) => { const p = diemDa((i + .5) / Math.max(1, o.sps.length), o.n, tx, cz, o.rSp); toaSp(d, p.x, p.z); });
        pho(tx, cz, sx, cz, 8); quangTruongSite(o.sites[0]!, sx, cz); continue; }
      if (k.laDuAn) toaDuAn(k, cx + (boN?.x ?? 0), cz + (boN?.z ?? 0), luu);
      if (boN) { quangTruongSite(o.sites[0]!, cx, cz); continue; }
      o.sps.forEach((d, i) => { const p = diemDa((i + .5) / Math.max(1, o.sps.length), o.n, cx, cz, o.rSp); toaSp(d, p.x, p.z); });
      // quảng trường site rải trên chu vi đa giác ngoài, mỗi cái chiếm phần chu vi theo cỡ của nó
      const chuVi = o.n * 2 * o.rVong * Math.sin(Math.PI / o.n), tong = Math.max(chuVi, o.sites.reduce((a, d) => a + 2 * rNgoai(d) + 10, 0)); let t = .02;
      for (const d of o.sites) { const phan = (2 * rNgoai(d) + 10) / tong; t += phan / 2; const p = diemDa(t, o.n, cx, cz, o.rVong); pho(cx, cz, p.x, p.z, 8); quangTruongSite(d, p.x, p.z); t += phan / 2; }
    }
    for (const o of ks) for (const d of mh.dich.filter((y) => y.duAn === o.k.khoa && !y.cha && (y.tien30 ?? 0) > 0)) coTien.push({ d, khu: o });
    // xe: toà nguồn → tháp đích (theo nan hoa quảng trường); số xe theo lượt khách
    for (const l of mh.luong) {
      const tk = mh.tk.find((t) => t.id === l.tu), a = viTri[`tk:${l.tu}`], b = viTri[l.den]; if (!tk || !a || !b || !l.so) continue;
      const duong = new THREE.CurvePath(); duong.add(new THREE.LineCurve3(a.cua, b.cua));
      const mau = mauTk(tk), soXe = Math.min(8, 1 + Math.round(Math.log2(l.so + 1) * 1.1));
      for (let k = 0; k < soXe; k++) { const xe = add(new THREE.BoxGeometry(3.4 * CO_XE, 1.8 * CO_XE, 2 * CO_XE), M({ color: ['#20232b', '#1b1b22', '#101010'].includes(mau) ? '#dfe4f2' : mau, emissive: mau, emissiveIntensity: .6 })); xe.userData = { duong, t: k / soXe, toc: .003 + Math.log10(l.so + 1) * .0012, tk, chu: a.m, den: l.den, k, n: soXe }; ds.xe!.push(xe); }
    }
    // ỐNG DẪN SÁNG (plan sức sống 24/10/2026): mỗi nguồn đang gắn vào đích (mọi loại — mạng xã hội, máy tìm, quảng cáo, giới thiệu, kênh) là một ống cong
    // từ nóc toà nguồn tới đỉnh toà đích; có khách = ống sáng + chấm sáng chạy dọc ống (nhanh theo số khách), đã gắn mà chưa ra khách = ống mờ, không chấm.
    // Cả thành phố một khối nét (LineSegments) + một khối chấm (InstancedMesh) — không thêm vật lẻ.
    { const nv: number[] = [], mv: number[] = [], hop = new THREE.Box3(), c3 = new THREE.Color(); ongDs = [];
      for (const tk of mh.tk) { if (!tk.dich) continue; const a = viTri[`tk:${tk.id}`], b = viTri[tk.dich]; if (!a?.m || !b) continue;
        hop.setFromObject(a.m); const p0 = new THREE.Vector3((hop.min.x + hop.max.x) / 2, hop.max.y + 1, (hop.min.z + hop.max.z) / 2), p2 = (b.dinh ?? b.cua).clone().setY(Math.max(6, (b.dinh ?? b.cua).y));
        const so = mh.luong.filter((l) => l.tu === tk.id && l.den === tk.dich).reduce((s2, l) => s2 + (l.so ?? 0), 0), dai = p0.distanceTo(p2);
        const cv = new THREE.QuadraticBezierCurve3(p0, p0.clone().lerp(p2, .5).setY(Math.max(p0.y, p2.y) + 12 + dai * .25), p2), diem = cv.getPoints(18);
        c3.set(['#20232b', '#1b1b22', '#101010'].includes(mauTk(tk)) ? '#dfe4f2' : mauTk(tk)).multiplyScalar(so ? 1 : .35);
        for (let i = 0; i < diem.length - 1; i++) { nv.push(diem[i]!.x, diem[i]!.y, diem[i]!.z, diem[i + 1]!.x, diem[i + 1]!.y, diem[i + 1]!.z); mv.push(c3.r, c3.g, c3.b, c3.r, c3.g, c3.b); }
        if (so) for (let k = 0; k < Math.min(3, 1 + Math.floor(Math.log10(so + 1))); k++) ongDs.push({ cv, t: k / 3, toc: (.0025 + Math.log10(so + 1) * .0015) * 300 / Math.max(300, dai), mau: c3.clone() }); }
      if (nv.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(nv, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(mv, 3));
        const ln = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .7, depthWrite: false })); ln.userData = { chu: null, luonVe: true }; the.add(ln); }
      ongXung = null; if (ongDs.length) { ongXung = new THREE.InstancedMesh(new THREE.SphereGeometry(1.6, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), ongDs.length);
        ongDs.forEach((o, i) => ongXung.setColorAt(i, o.mau.clone().lerp(new THREE.Color('#ffffff'), .35))); ongXung.instanceColor.needsUpdate = true; ongXung.userData = { chu: null, luonVe: true }; ongXung.frustumCulled = false; the.add(ongXung); }
    }
    // KHO BẠC: toà cột kiểu ngân hàng ở cuối đại lộ, biển ghi tổng tiền 30 ngày
    {
      const nenK = add(new THREE.BoxGeometry(56, 4, 40), M({ color: '#d9c38a', roughness: .6 })); nenK.position.set(xKho, 2, 0);
      const than = add(new THREE.BoxGeometry(48, 22, 32), M({ color: '#efe3c0', roughness: .5 })); than.position.set(xKho, 15, 0); than.userData = { loai: 'kho' };
      for (let i = 0; i < 6; i++) { const cot = add(new THREE.CylinderGeometry(1.6, 1.8, 22, 12), M({ color: '#fff7dc' })); cot.position.set(xKho - 20 + i * 8, 15, -18); cot.userData = { chu: than }; }
      const mai = add(new THREE.CylinderGeometry(0, 30, 10, 4, 1), M({ color: '#ffd166', emissive: '#c99a2e', emissiveIntensity: .35, metalness: .4 })); mai.rotation.y = Math.PI / 4; mai.scale.set(1, 1, .7); mai.position.set(xKho, 31, 0); mai.userData = { chu: than };
      const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d')!;
      g.fillStyle = 'rgba(40,30,8,.92)'; g.beginPath(); g.roundRect(4, 4, 504, 152, 22); g.fill(); g.strokeStyle = '#ffd166'; g.lineWidth = 5; g.stroke();
      g.fillStyle = '#ffd166'; g.font = '800 40px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('🏦 KHO BẠC · 30 NGÀY', 256, 58); g.fillStyle = '#fff'; g.font = '800 54px system-ui, sans-serif'; g.fillText(`+$${Math.round(mh.tien.tong).toLocaleString('en-US')}  −$${Math.round(mh.tien.chi.tong).toLocaleString('en-US')}`, 256, 126, 490);
      const bien = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false })); bien.scale.set(70, 22, 1); bien.position.set(xKho, 54, 0); bien.userData = { chu: than }; the.add(bien);
      const cua = new THREE.Vector3(xKho - 30, 1.5, 0);
      for (const { d, khu } of coTien) {
        const p = viTri[d.khoa]; if (!p) continue;
        for (let j = 0; j < Math.min(10, Math.ceil(Math.log2(1 + d.tien30!) * 1.3)); j++) { const xu = add(new THREE.CylinderGeometry(2.6, 2.6, 1, 18), M({ color: '#ffd166', emissive: '#ffd166', emissiveIntensity: .7, metalness: .5 }), false); xu.position.set(p.cua.x + 9, 1 + j * 1.1, p.cua.z + 9); xu.userData = { chu: null }; ds.xu!.push(xu); }
        const lan = khu.phia * 8, pts = [p.cua, new THREE.Vector3(khu.cx, 1.5, khu.cz), new THREE.Vector3(khu.cx, 1.5, lan), new THREE.Vector3(cua.x, 1.5, lan), cua];
        const duong = new THREE.CurvePath(); for (let i = 0; i < pts.length - 1; i++) duong.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
        const soXe = Math.min(6, 1 + Math.round(Math.log2(1 + d.tien30!)));
        for (let j = 0; j < soXe; j++) { const xe = add(new THREE.BoxGeometry(5, 2.6, 2.8), M({ color: '#ffd166', emissive: '#ffb703', emissiveIntensity: .8, metalness: .3 })); xe.userData = { duong, t: j / soXe, toc: .0012 + Math.log10(1 + d.tien30!) * .0005, chu: than, tien: true }; ds.xu!.push(xe); }
      }
      // ĐƯỜNG TIỀN NGẦM (anh 22/10/2026 "dự án có doanh thu thật phải có line ngầm riêng đến Ngân hàng"): mỗi khu có thu một dải vàng dưới đất tới Kho bạc,
      // rộng + số nhịp theo tiền 30 ngày; làn riêng sát giữa đại lộ (không đè cáp điện ±11, làn xe tiền ±8)
      const tienKhu = new Map<any, number>(); for (const { d, khu } of coTien) tienKhu.set(khu, (tienKhu.get(khu) ?? 0) + d.tien30!);
      [...tienKhu].forEach(([khu, usd], i) => { const lan = khu.phia * (3.6 + (i % 4) * .7), y = .3;
        duongNgam([new THREE.Vector3(khu.cx, y, khu.cz), new THREE.Vector3(khu.cx, y, lan), new THREE.Vector3(cua.x, y, lan), new THREE.Vector3(cua.x, y, 0)], '#ffd166', 1 + Math.min(2.2, Math.log10(1 + usd) * .7), ds.xu!, {}, Math.min(4, 1 + Math.round(Math.log10(1 + usd))), .008); });
    }
    // NHÀ MÁY ĐIỆN = máy chủ: khu công nghiệp đầu đại lộ; dây điện vàng nối tới đỉnh từng toà site nó chạy; máy sắp hết hạn bốc khói
    const xMay = lech - 150;
    mh.nhaMay.forEach((nm, i) => {
      const x = xMay - Math.floor(i / 2) * 90, z = (i % 2 ? 1 : -1) * 70;
      pho(x, 0, x, z, 8);
      const nenM = add(new THREE.BoxGeometry(44, 10, 30), M({ color: '#3b3f4c', roughness: .7 })); nenM.position.set(x, 5, z); nenM.userData = { loai: 'may', nm };
      for (const dx of [-10, 10]) { const thap = add(new THREE.CylinderGeometry(5, 8, 26, 20, 1, true), M({ color: '#9aa3b8', roughness: .6, side: THREE.DoubleSide })); thap.position.set(x + dx, 23, z); thap.userData = { chu: nenM };
        if (nm.canhBao) khoi(x + dx, 36, z, undefined as unknown as PhoTk, nenM); }
      const den = add(new THREE.SphereGeometry(1.6, 10, 10), new THREE.MeshBasicMaterial({ color: nm.canhBao ? '#ff3b4e' : nm.tai != null && nm.nhan && nm.tai / nm.nhan > .7 ? '#ffb703' : '#3fd68a' }), false); den.position.set(x, 12, z - 15.5);   // đèn: xanh = khoẻ, vàng = tải > 70%, đỏ = cảnh báo den.userData = { chu: nenM };
      const c = document.createElement('canvas'); c.width = 512; c.height = 120; const g = c.getContext('2d')!;
      g.fillStyle = 'rgba(20,22,30,.9)'; g.beginPath(); g.roundRect(4, 4, 504, 112, 18); g.fill(); g.strokeStyle = nm.canhBao ? '#ff3b4e' : '#ffd27a'; g.lineWidth = 4; g.stroke();
      g.fillStyle = '#ffd27a'; g.font = '800 34px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(`⚡ ${nm.ten}`.slice(0, 34), 256, 52, 490); g.fillStyle = '#fff'; g.font = '600 30px system-ui, sans-serif'; g.fillText(`${nm.sites.length} site${nm.tai != null ? ` · tải ${nm.tai}/${nm.nhan}` : ''}`, 256, 96);
      const bien = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false })); bien.scale.set(52, 12, 1); bien.position.set(x, 46, z); bien.userData = { chu: nenM }; the.add(bien);
      // TRẠM NGẦM của máy: khối dưới đất ngay dưới nhà máy — bơm xanh = việc chạy theo giờ (systemd timer, tối đa 16), khối đỏ = dịch vụ đang lỗi; trục đứng nối lên nhà máy
      { const loi = nm.loiDv ?? [], tram = add(new THREE.BoxGeometry(46, 8, 30), M({ color: loi.length ? '#4a1a22' : '#1c2a3a', emissive: loi.length ? '#ff3b4e' : '#3a6ff0', emissiveIntensity: .25, roughness: .6 }), false); tram.position.set(x, Y_HAM - 6, z); tram.userData = { loai: 'tram', nm, ham: true }; ds.ham!.push(tram);
        const truc = add(new THREE.CylinderGeometry(2.2, 2.2, -Y_HAM, 10), M({ color: '#9aa3b8' }), false); truc.position.set(x, Y_HAM / 2, z); truc.userData = { chu: tram, ham: true }; ds.ham!.push(truc);
        for (let k = 0; k < Math.min(16, nm.henGio ?? 0); k++) { const b2 = add(new THREE.CylinderGeometry(1, 1, 4, 8), M({ color: '#3fd68a', emissive: '#3fd68a', emissiveIntensity: .5 }), false); b2.position.set(x - 19 + (k % 8) * 5.4, Y_HAM - 0, z - 10 + Math.floor(k / 8) * 6); b2.userData = { chu: tram, ham: true }; ds.ham!.push(b2); }
        loi.slice(0, 8).forEach((_, k) => { const b2 = add(new THREE.BoxGeometry(3.6, 3.6, 3.6), M({ color: '#ff4d5e', emissive: '#ff3b4e', emissiveIntensity: .8 }), false); b2.position.set(x - 19 + k * 5.4, Y_HAM, z + 10); b2.userData = { chu: tram, ham: true }; ds.ham!.push(b2); }); }
      // CÁP NGẦM (anh 22/10/2026 "đổi thành đường chạy ngầm dưới lòng đất"): nét đứt sáng sát mặt đất theo phố — nhà máy → làn cáp cạnh đại lộ → tới site; tia điện chạy dọc cáp
      nm.sites.forEach((s2, j) => { const p = viTri[`s:${s2}`]; if (!p?.cua) return;
        const lan = (p.cua.z >= 0 ? 1 : -1) * (11 + (i % 3) * 1.2), y = .32;
        const pts = [new THREE.Vector3(x, y, z), new THREE.Vector3(x, y, lan), new THREE.Vector3(p.cua.x, y, lan), new THREE.Vector3(p.cua.x, y, p.cua.z)];
        duongNgam(pts, j % 2 ? '#ffe08a' : '#ffd27a', .9, ds.dien!, {}, 1, .005);
      });
    });
    // CÔNG TY AI: toà trụ sở ở giữa, mỗi phòng một toà kính quanh đó (biển "Phòng · trưởng"); cửa sổ sáng = việc nền 24 giờ; phòng chưa hoạt động mờ;
    // phòng có việc 24 giờ qua → xe công trình chạy từ văn phòng tới khu dự án nó phụ trách
    if (coCty) {
      const zc = 150, ts = add(new THREE.CylinderGeometry(9, 12, 46, 6), M({ color: '#2a3a66', emissive: '#3a6ff0', emissiveIntensity: .35, roughness: .3, metalness: .5 })); ts.position.set(xCty, 23, zc); ts.userData = { loai: 'cty' };
      pho(xCty, 0, xCty, zc, 12);
      const c0 = document.createElement('canvas'); c0.width = 512; c0.height = 110; const g0 = c0.getContext('2d')!; g0.fillStyle = 'rgba(17,24,48,.92)'; g0.beginPath(); g0.roundRect(4, 4, 504, 102, 20); g0.fill(); g0.fillStyle = '#9fc0ff'; g0.font = '800 50px system-ui, sans-serif'; g0.textAlign = 'center'; g0.fillText('🏢 CÔNG TY AI', 256, 72);
      const b0 = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c0), depthWrite: false })); b0.scale.set(56, 12, 1); b0.position.set(xCty, 58, zc); b0.userData = { chu: ts }; the.add(b0);
      const n = mh.congTy.length, R = 46 + n * 2.6;
      mh.congTy.forEach((p, i) => {
        const g = (i / n) * Math.PI * 2, x = xCty + Math.cos(g) * R, z = zc + Math.sin(g) * R * .8, h = 16 + Math.min(24, p.viec24 * 1.5);
        pho(x, z, xCty + Math.cos(g) * 14, zc + Math.sin(g) * 11, 5);
        const than = M({ color: p.hoatDong ? '#3b5a8f' : '#3a3f50', emissive: p.hoatDong ? '#6ea8ff' : '#000', emissiveIntensity: p.hoatDong ? .2 : 0, roughness: .25, metalness: .45, transparent: !p.hoatDong, opacity: p.hoatDong ? 1 : .55 });
        const m = add(new THREE.BoxGeometry(12, h, 12), than); m.position.set(x, h / 2, z); m.userData = { loai: 'phong', p };
        // cửa sổ sáng = số việc nền 24 giờ (tối đa 24 ô)
        for (let k2 = 0; k2 < Math.min(24, p.viec24); k2++) { const tang = Math.floor(k2 / 3), cot = k2 % 3; oPhang(x - 3.6 + cot * 3.6, 3 + tang * 2.6, z + 6.05, 2.4, 1.8, 0, 0, 0, '#ffe08a'); }
        const c = document.createElement('canvas'); c.width = 512; c.height = 120; const gc = c.getContext('2d')!;
        gc.fillStyle = p.hoatDong ? 'rgba(20,30,60,.92)' : 'rgba(50,54,66,.9)'; gc.beginPath(); gc.roundRect(4, 4, 504, 112, 18); gc.fill();
        gc.fillStyle = '#fff'; gc.textAlign = 'center'; gc.font = '800 36px system-ui, sans-serif'; gc.fillText(p.ten.replace(/^Phòng\s+/, '').split(/[(·]/)[0]!.trim().slice(0, 26), 256, 52, 490);
        gc.fillStyle = p.hoatDong ? '#9fc0ff' : '#a0a6b8'; gc.font = '600 28px system-ui, sans-serif'; gc.fillText(`${p.truong.split(/[(·]/)[0]!.trim()}${p.viec24 ? ` · ${p.viec24} việc/24h` : ''}`, 256, 96, 490);
        const bien = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false })); bien.scale.set(34, 8, 1); bien.position.set(x, h + 7, z); bien.userData = { chu: m }; the.add(bien);
        chiMuc.push({ ten: p.ten, nhan: 'phòng ban', obj: m });
        if (!p.viec24) return;
        for (const da of p.duAn) { const kp = khuPos[`d:${da}`]; if (!kp) continue;
          const lan = -2.5, pts = [new THREE.Vector3(x, 1.5, z), new THREE.Vector3(xCty, 1.5, zc), new THREE.Vector3(xCty, 1.5, lan), new THREE.Vector3(kp.cx, 1.5, lan), new THREE.Vector3(kp.cx, 1.5, kp.cz)];
          const duong = new THREE.CurvePath(); for (let k2 = 0; k2 < pts.length - 1; k2++) duong.add(new THREE.LineCurve3(pts[k2], pts[k2 + 1]));
          for (let j = 0; j < Math.min(3, 1 + Math.floor(p.viec24 / 8)); j++) { const xe = add(new THREE.BoxGeometry(5.5, 3.2, 3), M({ color: '#ff9f1c', emissive: '#ff7b00', emissiveIntensity: .6 })); xe.userData = { duong, t: j / 3, toc: .0011, chu: m }; ds.xu!.push(xe); }
        }
      });
    }
    // KHU TÀI NGUYÊN (anh 23/10/2026 "bộ phận quản lý tài nguyên, tài khoản, ngân sách, trạng thái; các bộ quản lý br"): lô có rào + cổng cạnh Công ty AI.
    // Mỗi nền một kho tài khoản (cửa sổ = từng tài khoản, màu = trạng thái; đèn đỏ + khói = có cảnh báo chưa xử), trạm br (cửa sổ = hồ sơ trình duyệt,
    // sáng = mở trong 7 ngày) + máy ảo Android, cột proxy (màu = sức khoẻ), két ngân sách. Số chi tiết ở thẻ hover; poster số tổng ở cổng.
    const tn = mh.taiNguyen; let xTnPhai = 0;
    if (tn && (tn.tk.length || tn.hoSo.length)) {
      const COT = 5, BX = 32, BZ = 36, soHang = Math.ceil(tn.tk.length / COT), rongL = COT * BX + 50, sauL = soHang * BZ + 110, xTn = (coCty ? xCty : xKho + 150) + 280, zA = 60, x0 = xTn - rongL / 2;
      xTnPhai = xTn + rongL / 2 + 40;
      pho(xTn, 0, xTn, zA, 12);
      const nenT = add(new THREE.BoxGeometry(rongL + 16, .4, sauL), M({ color: '#141c33', roughness: 1 }), false); nenT.position.set(xTn, .2, zA + sauL / 2); ds.san!.push(nenT);
      const dem2 = (k: TtTk) => tn.tk.reduce((a, t) => a + t.theo[k], 0), cbTong = tn.canhBao.reduce((a, c) => a + c.n, 0), hsTong = tn.hoSo.reduce((a, h) => a + h.n, 0);
      raoQuanh([new THREE.Vector3(x0 - 8, 0, zA), new THREE.Vector3(x0 + rongL + 8, 0, zA), new THREE.Vector3(x0 + rongL + 8, 0, zA + sauL), new THREE.Vector3(x0 - 8, 0, zA + sauL)], '#6ea8ff', xTn, zA + sauL / 2, 1, 'Tài nguyên', [
        { ic: '🟢', so: String(dem2('song')), nhan: 'tài khoản đang dùng', ma: 'song' }, { ic: '⛔', so: String(dem2('khoa') + dem2('han')), nhan: 'bị khoá / hạn chế', ma: 'khoa' },
        ...(cbTong ? [{ ic: '🚨', so: String(cbTong), nhan: 'cảnh báo chưa xử', ma: 'cb' }] : []), ...(hsTong ? [{ ic: '🖥', so: String(hsTong), nhan: 'hồ sơ br · máy ảo', ma: 'hs' }] : [])], 'tai-nguyen');
      const NEN_LOGO: Record<string, Nen> = { facebook: 'fb', youtube: 'yt', instagram: 'ig', tiktok: 'tt', twitter: 'x', pinterest: 'pin', dailymotion: 'dm', threads: 'th', quora: 'qu' };
      const THU_TT: TtTk[] = ['song', 'nuoi', 'han', 'khoa', 'dong'];
      tn.tk.forEach((t, i) => {
        const x = x0 + 35 + (i % COT) * BX, z = zA + 34 + Math.floor(i / COT) * BZ, f = Math.min(1, 48 / Math.max(1, t.tong));
        const mau: string[] = []; for (const k of THU_TT) { const n = t.theo[k] ? Math.max(1, Math.round(t.theo[k] * f)) : 0; for (let j = 0; j < n; j++) mau.push(TT_TK[k].mau); }
        const tang = Math.max(2, Math.ceil(mau.length / 4)), h = 6 + tang * 3.2, w = 18;
        const logo = NEN_LOGO[t.nen] ? texNen(NEN_LOGO[t.nen]!) : texIc(`tn:${t.nen}`, '#3a4f7a', t.ten[0]!.toUpperCase());
        const than = M({ color: '#26304d', roughness: .6 }), m = add(new THREE.BoxGeometry(w, h, w * .7), [than, than, M({ map: logo, emissive: '#fff', emissiveMap: logo, emissiveIntensity: .35 }), than, than, than]); m.position.set(x, h / 2, z); m.userData = { loai: 'tn-tk', t };
        mau.forEach((c, j) => { const tg = Math.floor(j / 4), co = j % 4; for (const mat of [-1, 1]) oPhang(x - 6 + co * 4, 4 + tg * 3.2, z + mat * (w * .35 + .06), 2.6, 2, 0, mat > 0 ? 0 : Math.PI, 0, c); });
        bangTen(x, z, w * .7, h, t.ten, '', '#6ea8ff', m);
        if (t.canhBao) { const d = add(new THREE.SphereGeometry(2, 12, 12), new THREE.MeshBasicMaterial({ color: '#ff3b4e' }), false); d.position.set(x, h + 2.5, z); d.userData = { chu: m }; ds.hong!.push(d); khoi(x, h + 3, z, undefined as unknown as PhoTk, m); }
        chiMuc.push({ ten: `Tài khoản ${t.ten}`, nhan: 'tài nguyên', obj: m });
      });
      // dãy cuối: trạm br + máy ảo · cột proxy · két ngân sách
      const zC = zA + 34 + soHang * BZ + 14, chrome = tn.hoSo.find((h) => h.tool === 'chrome'), emu = tn.hoSo.find((h) => h.tool === 'emulator');
      if (chrome) { const n = Math.min(64, chrome.n), tang = Math.ceil(n / 8), h = 8 + tang * 3, br = add(new THREE.BoxGeometry(40, h, 14), M({ color: '#1d2b24', emissive: '#1f8f5c', emissiveIntensity: .15, roughness: .4 })); br.position.set(x0 + 40, h / 2, zC); br.userData = { loai: 'tn-br' };
        for (let j = 0; j < n; j++) oPhang(x0 + 40 - 16.5 + (j % 8) * 4.7, 4 + Math.floor(j / 8) * 3, zC - 7.06, 3.4, 2.1, 0, Math.PI, 0, j < chrome.gan7 ? '#ffd27a' : '#2a3350');
        bangTen(x0 + 40, zC, 14, h, 'br · trình duyệt', '', '#3fd68a', br); chiMuc.push({ ten: 'br · hồ sơ trình duyệt', nhan: 'tài nguyên', obj: br }); }
      if (emu) for (let j = 0; j < Math.min(6, emu.n); j++) { const ph = add(new THREE.BoxGeometry(3.6, 7, 1.6), [M({ color: '#111' }), M({ color: '#111' }), M({ color: '#111' }), M({ color: '#111' }), M({ color: '#3ddc84', emissive: '#3ddc84', emissiveIntensity: .5 }), M({ color: '#111' })]); ph.position.set(x0 + 68 + j * 5, 3.5, zC); ph.userData = { loai: 'tn-br' }; }
      let xp = x0 + 100; for (const px of tn.proxy) for (let j = 0; j < Math.min(8, px.n); j++) { const c = add(new THREE.CylinderGeometry(.8, 1.4, 22, 8), M({ color: '#9aa3b8', roughness: .5 })); c.position.set(xp, 11, zC); c.userData = { loai: 'tn-px' };
        const dn = add(new THREE.SphereGeometry(1.8, 10, 10), new THREE.MeshBasicMaterial({ color: px.suc === 'ok' ? '#3fd68a' : px.suc === 'dead' ? '#ff4d5e' : '#8e9abd' }), false); dn.position.set(xp, 23, zC); dn.userData = { chu: c }; xp += 6; }
      const ket = add(new THREE.CylinderGeometry(9, 10, 16, 24), M({ color: '#ffd166', emissive: '#c99a2e', emissiveIntensity: .3, metalness: .6, roughness: .3 })); ket.position.set(x0 + rongL - 30, 8, zC); ket.userData = { loai: 'tn-ns' };
      bangTen(x0 + rongL - 30, zC, 16, 16, 'Ngân sách', '', '#ffd166', ket); chiMuc.push({ ten: 'Ngân sách', nhan: 'tài nguyên', obj: ket });
    }
    // XƯỞNG SX (anh 22/10/2026): lô chữ nhật có rào phía đối diện Công ty AI qua đại lộ — nhà xưởng mái răng cưa ở đáy lô, sản phẩm / app chưa lên
    // xếp hàng theo dự án gốc (biển đầu hàng); lên xong máy tự đưa về khu dự án của nó
    let zXuong = 0;
    // XƯỞNG SX = TỔ HỢP NHÀ MÁY (góp ý city #1437): mỗi loại sản phẩm một khu nhà máy (App, Sách, Sản phẩm số, Plugin…) — sản phẩm đang làm / sẵn sàng
    // chưa nộp đứng trong sân khu; PHÒNG THẨM ĐỊNH cạnh đó giữ mọi thứ đã nộp chờ duyệt (cửa hàng / anh), xếp hàng trước cửa. Tên khu in dưới nền.
    if (xuongK) {
      const xs = xuongK.sites.concat(xuongK.sps), sx = xs.filter((d) => d.giaiDoan !== 'tham-dinh'), td = xs.filter((d) => d.giaiDoan === 'tham-dinh');
      for (const d of xs) if (d.loai === 'app' && !d.hostBan) d.hostBan = mh.dich.find((b2) => b2.cha === d.khoa)?.hostBan;
      const O = 25, vung = Object.keys(VUNG_SX).filter((v) => sx.some((d) => d.vungSx === v)).map((v) => { const ds2 = sx.filter((d) => d.vungSx === v), cot = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(ds2.length)))); return { v, ds2, cot, rong: cot * O + 14, sau: Math.ceil(ds2.length / cot) * O + 40 }; });
      const cotTd = Math.min(5, Math.max(2, Math.ceil(Math.sqrt(td.length)))), rongTd = Math.max(70, cotTd * O + 16), sauTd = Math.ceil(td.length / cotTd) * O + 70;
      const rongSx = vung.reduce((a, c) => a + c.rong + 14, 0), dai = Math.max(160, rongSx + rongTd + 30), sauMax = Math.max(sauTd, ...vung.map((c) => c.sau));
      const cao = sauMax + 70, x0 = (coCty ? xCty : xKho + 150) - dai / 2, z0 = -40;
      pho(x0 + dai / 2, 0, x0 + dai / 2, z0, 12);
      const nenX = add(new THREE.BoxGeometry(dai + 20, .4, cao), M({ color: '#2a2216', roughness: 1 }), false); nenX.position.set(x0 + dai / 2, .2, z0 - cao / 2); ds.san!.push(nenX);
      raoQuanh([new THREE.Vector3(x0 - 10, 0, z0), new THREE.Vector3(x0 + dai + 10, 0, z0), new THREE.Vector3(x0 + dai + 10, 0, z0 - cao), new THREE.Vector3(x0 - 10, 0, z0 - cao)], '#c98a2f', x0 + dai / 2, z0 - cao / 2, -1, 'Xưởng SX',
        [{ ic: '🏭', so: String(sx.length), nhan: 'đang sản xuất', ma: 'xuong' }, { ic: '🔍', so: String(td.length), nhan: 'chờ thẩm định', ma: 'xuong' }], KHU_XUONG);
      // khu nhà máy: sân + nhà xưởng mái răng cưa ở đáy sân, sản phẩm lưới phía trước, tên khu in dưới nền
      let xv = x0 + 6; let thanDau: any = null;
      for (const c of vung) { const zA = z0 - 14, cx3 = xv + c.rong / 2;
        const san = add(new THREE.BoxGeometry(c.rong, .5, c.sau), M({ color: '#3a2e1c', roughness: .9 }), false); san.position.set(cx3, .45, zA - c.sau / 2); ds.san!.push(san);
        const than = add(new THREE.BoxGeometry(c.rong - 6, 10, 12), M({ color: '#6b5636', roughness: .7 })); than.position.set(cx3, 5, zA - c.sau + 8); than.userData = { loai: 'xuong-vung', vung: c.v }; thanDau ??= than;
        for (let k = 0; k < Math.max(2, Math.floor((c.rong - 6) / 12)); k++) { const r2 = add(new THREE.CylinderGeometry(5, 5, 12, 3), M({ color: '#c98a2f', emissive: '#7a4f12', emissiveIntensity: .25 }), false); r2.rotation.set(-Math.PI / 2, 0, 0); r2.position.set(xv + 9 + k * 12, 12.5, zA - c.sau + 8); r2.userData = { chu: than }; }
        chuNen(`${VUNG_SX[c.v]!.ic} ${VUNG_SX[c.v]!.ten} · ${c.ds2.length}`, cx3, zA - 6, c.rong - 2, '#ffd27a');
        c.ds2.forEach((d, n) => toaSp(d, xv + 7 + O / 2 + (n % c.cot) * O, zA - 20 - Math.floor(n / c.cot) * O));
        chiMuc.push({ ten: `Xưởng SX · ${VUNG_SX[c.v]!.ten}`, nhan: 'khu nhà máy', obj: than }); xv += c.rong + 14; }
      // PHÒNG THẨM ĐỊNH: toà kính xanh + con dấu, hàng chờ duyệt trước cửa
      const xT = x0 + dai - rongTd / 2 - 6, zT = z0 - 14;
      const sanT = add(new THREE.BoxGeometry(rongTd, .5, sauTd), M({ color: '#1c2a3a', roughness: .9 }), false); sanT.position.set(xT, .45, zT - sauTd / 2); ds.san!.push(sanT);
      const tdToa = add(new THREE.BoxGeometry(rongTd - 10, 20, 16), M({ color: '#1d3a66', emissive: '#3a6ff0', emissiveIntensity: .3, roughness: .25, metalness: .5 })); tdToa.position.set(xT, 10, zT - sauTd + 10); tdToa.userData = { loai: 'tham-dinh' };
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 140; const gc = cv.getContext('2d')!; gc.fillStyle = 'rgba(12,24,48,.94)'; gc.beginPath(); gc.roundRect(4, 4, 504, 132, 20); gc.fill(); gc.strokeStyle = '#6ea8ff'; gc.lineWidth = 5; gc.stroke();
      gc.fillStyle = '#9fc0ff'; gc.font = '800 46px system-ui, "Apple Color Emoji", sans-serif'; gc.textAlign = 'center'; gc.fillText('🔍 PHÒNG THẨM ĐỊNH', 256, 62); gc.fillStyle = '#fff'; gc.font = '700 34px system-ui, sans-serif'; gc.fillText(`${td.length} chờ duyệt`, 256, 112);
      const bienT = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthWrite: false })); bienT.scale.set(52, 14, 1); bienT.position.set(xT, 34, zT - sauTd + 10); bienT.userData = { chu: tdToa }; the.add(bienT);
      chuNen(`🔍 Chờ duyệt · ${td.length}`, xT, zT - 6, rongTd - 2, '#9fc0ff');
      td.forEach((d, n) => toaSp(d, xT - (cotTd - 1) * O / 2 + (n % cotTd) * O, zT - 20 - Math.floor(n / cotTd) * O));
      chiMuc.push({ ten: 'Phòng thẩm định', nhan: 'xưởng sx', obj: tdToa });
      // biển XƯỞNG SX nổi trên tổ hợp nhà máy
      const cv2 = document.createElement('canvas'); cv2.width = 512; cv2.height = 140; const g2 = cv2.getContext('2d')!; g2.fillStyle = 'rgba(40,28,8,.92)'; g2.beginPath(); g2.roundRect(4, 4, 504, 132, 20); g2.fill(); g2.strokeStyle = '#ffd27a'; g2.lineWidth = 5; g2.stroke();
      g2.fillStyle = '#ffd27a'; g2.font = '800 52px system-ui, "Apple Color Emoji", sans-serif'; g2.textAlign = 'center'; g2.fillText('🏭 XƯỞNG SX', 256, 62); g2.fillStyle = '#fff'; g2.font = '700 34px system-ui, sans-serif'; g2.fillText(`${sx.length} đang SX · ${td.length} chờ duyệt`, 256, 112);
      const xx = x0 + 6 + rongSx / 2, zz = z0 - cao + 20, than0 = add(new THREE.BoxGeometry(Math.max(40, rongSx * .5), 1, 1), new THREE.MeshBasicMaterial({ visible: false }), false); than0.position.set(xx, 30, zz); than0.userData = { loai: 'khu', khoa: KHU_XUONG };
      const bien = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv2), depthWrite: false })); bien.scale.set(60, 16, 1); bien.position.set(xx, 40, z0 - sauMax - 10); bien.userData = { loai: 'khu', khoa: KHU_XUONG }; the.add(bien);
      chiMuc.push({ ten: 'Xưởng SX', nhan: 'khu', obj: thanDau ?? than0 }); khuPos[KHU_XUONG] = { cx: x0 + dai / 2, cz: z0 - cao / 2, phia: -1 }; banKinhKhu[KHU_XUONG] = Math.max(dai, cao) / 2; zXuong = cao - z0;
    }
    dungGop();
    // NHÀ MÁY PHIM MỚI trên mặt đất cạnh khu bộ 2 (anh 24/10/2026: "phải là dòng người đi trong nhà máy — đi từ đâu đến khu của phim nào, camp nào, creative nào, chở cái gì"):
    // 6 trạm thật nối bằng đường xưởng, bảng số nổi trên nhà máy; xe / người chạy giữa trạm và tới đúng toà camp (dungChuyen, dựng lại khi số xưởng đổi)
    { const kh = khuXuongPhim(), kp = khuPos[kh], R = banKinhKhu[kh] ?? 200;
      viTriCamp.clear(); for (const o of the.children) if (o.userData?.loai === 'dich' && o.userData.d.loai === 'camp') viTriCamp.set(o.userData.d.khoa, o.position.clone());
      if (kp) {
        const BUOC = 40, zF = kp.cz + kp.phia * (R + 44), x0F = kp.cx - BUOC * 2.5, cuaZ = zF - kp.phia * 26;   // đường xưởng chạy cách dãy trạm một quãng — xe không bị toà trạm che
        const duongX = add(new THREE.PlaneGeometry(BUOC * 5 + 50, 12), M({ color: '#2a2f3f', roughness: 1 }), false); duongX.rotation.x = -Math.PI / 2; duongX.position.set(kp.cx, .35, cuaZ); duongX.userData = { chu: null };
        const tram = TRAM_XP.map(([ic, ten, mau], i) => { const x = x0F + i * BUOC;
          const m = add(new THREE.BoxGeometry(26, 11, 18), M({ color: mau, roughness: .6 })); m.position.set(x, 5.5, zF); m.userData = { loai: 'tram-xp', st: i };
          const mai = add(new THREE.BoxGeometry(28, 2, 20), M({ color: '#ffd166', emissive: '#ffb703', emissiveIntensity: .25 })); mai.position.set(x, 12, zF); mai.userData = { chu: m };
          const loi = add(new THREE.PlaneGeometry(10, 26 - 9), M({ color: '#2b3142', roughness: 1 }), false); loi.rotation.x = -Math.PI / 2; loi.position.set(x, .4, zF - kp.phia * (9 + (26 - 9) / 2)); loi.userData = { chu: null };   // lối từ cửa trạm ra đường xưởng
          const b = bienXe(`${ic} ${ten}`, '#59a8ff'); b.scale.set(30, 4.5, 1); b.position.set(x, 34, zF); b.userData = { loai: 'tram-xp', st: i }; the.add(b);
          return new THREE.Vector3(x, 0, cuaZ); });
        const cv = document.createElement('canvas'); cv.width = 1600; cv.height = 500; const tx = new THREE.CanvasTexture(cv); tx.anisotropy = 4;
        const bien = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, depthWrite: false })); bien.scale.set(150, 47, 1); bien.position.set(x0F + BUOC * 5 + 110, 34, zF);   // đứng bên phải dãy trạm — không che trạm, cổng sau và đường xe
        bien.userData = { loai: 'xuong-etp' }; the.add(bien); chiMuc.push({ ten: 'Xưởng phim mới Ethopex', nhan: 'xưởng', obj: bien });
        // mốc tìm "Nhà máy phim": khối ẩn dưới đất giữa dãy trạm, mở thẻ cả xưởng (không trúng chuột vì nằm dưới mặt đất)
        const moc = add(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial({ visible: false }), false); moc.position.set(kp.cx, -6, zF); moc.userData = { loai: 'xuong-etp' }; chiMuc.push({ ten: 'Nhà máy phim mới (6 trạm)', nhan: 'xưởng', obj: moc });
        xuongVe = (x) => { veXuong(cv, x); tx.needsUpdate = true; dungChuyen(); }; xuongDong = { cv, tx, bien }; xuongPhim = { tram, cong: congSauKhu.get(kh) ?? null, cuaZ, zF, phia: kp.phia }; khoaBienDem = '';
        // đường cố định: đường xưởng → cổng sau → trục giữa khu
        { const g0 = xuongPhim.cong; if (g0) veDuongXe([new THREE.Vector3(g0.x, 0, cuaZ), g0, new THREE.Vector3(g0.x, 0, kp.cz)], []); }
        xuongVe(xuongData);
      } else { xuongVe = null; xuongDong = null; xuongPhim = null; } }
    const kn = khuNen(Math.min(lech - 40, xMay - Math.ceil(mh.nhaMay.length / 2) * 90 - 30), Math.max(coCty ? xCty + 110 : xKho + 60, xTnPhai), Math.max(zTrong, coCty ? 260 : 0, zXuong + 20), zNgoai);
    gioiHan = { x0: kn.xa, x1: kn.xb, z: kn.zDat };
    const rong = kn.xb - kn.xa;
    if (doc) { CAM0.set(-rong * .62, rong * .7, 0); TAM0.set(0, 0, 0); scene.fog.near = rong * .9; scene.fog.far = rong * 2.2; ctl.maxDistance = rong * 1.6; }
    else { const vua = (rong / 2) / Math.tan(Math.atan(Math.tan(Math.PI / 9) * (W() / H())));   // lùi đủ xa để bề ngang thành phố vừa khung
      CAM0.set(0, vua * .62, vua * .72); TAM0.set(0, 0, 10); scene.fog.near = vua * 1.1; scene.fog.far = vua * 2.6; ctl.maxDistance = vua * 1.6; }
    cam.far = rong * 3; cam.updateProjectionMatrix();
    if (!daDatCam) { if (camDaLuu) { cam.position.fromArray(camDaLuu.p); ctl.target.fromArray(camDaLuu.t); } else { cam.position.copy(CAM0); ctl.target.copy(TAM0); } daDatCam = true; }
    apSucSong(); queueMicrotask(veSong); apNgayDem(); apLop(); r.shadowMap.needsUpdate = true;
  }

  // ── bảng điều khiển
  const LOP: Record<string, [string, string]> = { cua: ['🪟', 'Bài đang chạy'], thung: ['📦', 'Bài sắp đăng'], cot: ['🔦', 'Lượt xem'], xe: ['🚗', 'Khách về site'], xu: ['🪙', 'Tiền về kho bạc · đường tiền ngầm'], onl: ['🟢', 'Khách đang xem'], dien: ['⚡', 'Máy chủ · cáp ngầm'], ngam: ['🔗', 'Đường ngầm social → site'], ham: ['🕳', 'Tầng ngầm — nhìn xuyên đất: đường social, cáp điện, đường tiền, trạm máy chủ'] };
  for (const [k, [ic, ten]] of Object.entries(LOP)) { const b = document.createElement('button'); b.className = 'lop'; b.title = ten; b.textContent = ic; b.setAttribute('aria-pressed', String(bat.has(k))); b.setAttribute('aria-label', ten);
    b.onclick = () => { if (bat.has(k)) bat.delete(k); else bat.add(k); b.setAttribute('aria-pressed', String(bat.has(k))); apLop(); }; q('[data-o="lop"]').appendChild(b); }
  const chip = (o: string, set: Set<any>, id: string, mau: string, ic: string, ten: string) => { const b = document.createElement('button'); b.className = 'chip'; b.title = ten; b.setAttribute('aria-label', ten); b.style.background = mau; b.innerHTML = ic; b.setAttribute('aria-pressed', 'false');
    b.onclick = () => { if (set.has(id)) set.delete(id); else set.add(id); b.setAttribute('aria-pressed', String(set.has(id))); apLop(); }; q(`[data-o="${o}"]`).appendChild(b); return b; };
  const chipKhu = () => { const o = q('[data-o="loc-sp"]'); o.innerHTML = ''; for (const c of mh.duAn) chip('loc-sp', chonSp, c.khoa, c.ngung ? '#4a4f60' : c.mau, c.site && mh.fav[c.site] ? `<img src="${mh.fav[c.site]}" alt="">` : esc(c.ten[0]!.toUpperCase()), `${c.laDuAn ? 'Dự án' : 'Site'} ${c.ten}${c.ngung ? ' (ngừng)' : ''}`).onclick = (e) => { const b = e.currentTarget as HTMLButtonElement; if (chonSp.has(c.khoa)) chonSp.delete(c.khoa); else chonSp.add(c.khoa); b.setAttribute('aria-pressed', String(chonSp.has(c.khoa))); dung(); }; };
  const chipNen = () => { q('[data-o="loc-nen"]').innerHTML = ''; for (const k of [...new Set(mh.tk.map((t) => t.nen))] as Nen[]) chip('loc-nen', chonNen, k, NEN[k][0], svgLogo(k), NEN[k][1]); };
  const chipLv = () => { q('[data-o="loc-lv"]').innerHTML = ''; for (const lv of Object.keys(LINH_VUC).filter((l) => mh.duAn.some((k) => k.linhVuc === l))) chip('loc-lv', chonLv, lv, LINH_VUC[lv]!.mau, LINH_VUC[lv]!.ic, LINH_VUC[lv]!.ten).onclick = (e) => { const b = e.currentTarget as HTMLButtonElement; if (chonLv.has(lv)) chonLv.delete(lv); else chonLv.add(lv); b.setAttribute('aria-pressed', String(chonLv.has(lv))); dung(); }; };
  chipKhu(); chipNen(); chipLv();
  function apLop() {
    for (const m of ds.nha!) m.visible = khop(m.userData.tk);
    for (const k of ['cua', 'thung', 'cot', 'xe']) for (const m of ds[k]!) m.visible = bat.has(k) && khop(m.userData.tk);
    for (const m of [...ds.hong!, ...ds.khoi!]) m.visible = khop(m.userData.tk);
    for (const m of ds.xu!) m.visible = bat.has('xu');
    for (const m of ds.onl!) m.visible = bat.has('onl') && tua == null;
    for (const m of ds.dien!) m.visible = bat.has('dien');
    for (const m of ds.ngam!) m.visible = bat.has('ngam') && khop(m.userData.tk);
    // tầng ngầm: đồ dưới đất chỉ hiện khi bật 🕳; bật thì mặt đất / phố / sân khu trong suốt để nhìn xuyên
    const ham = bat.has('ham');
    for (const lop of [ds.ngam!, ds.dien!, ds.xu!]) for (const m of lop) if (m.userData.ham && !ham) m.visible = false;
    for (const m of ds.ham!) m.visible = ham;
    for (const mt of [dat.material, NHUA, GACH, ...ds.san!.map((m) => m.material)]) { mt.transparent = ham; mt.opacity = ham ? (mt === dat.material ? .12 : .3) : 1; mt.depthWrite = !ham; mt.needsUpdate = true; }
    apTua();
  }
  const datThu = (gon: boolean) => { ben.classList.toggle('gon', gon); thuBtn.setAttribute('aria-expanded', String(!gon)); try { localStorage.setItem('tp-ben-gon', gon ? '1' : '0'); } catch { /* chế độ riêng tư */ } };
  let gonDau = W() < 600; try { const v = localStorage.getItem('tp-ben-gon'); if (v != null) gonDau = v === '1'; } catch { /* chế độ riêng tư */ }
  datThu(gonDau); thuBtn.onclick = () => datThu(false); widget(ben, 'tp-w-ben', () => datThu(true)); widget(ngan, 'tp-w-ngan', () => dongNgan());

  // ── TUA LẠI 30 NGÀY: kéo thanh / bấm ▶ — xe vào từng site theo phiên của ngày đó (so với ngày đông nhất của site), toà sáng theo; ⟳ về bây giờ
  let tua: string | null = null, choiTua = 0;
  const ngay30 = Array.from({ length: 30 }, (_, i) => new Date(Date.now() + 7 * 3600e3 - (29 - i) * 864e5).toISOString().slice(0, 10));
  const tuaIn = q<HTMLInputElement>('.tua input'), tuaNhan = q<HTMLElement>('.tua-ngay');
  function apTua() {
    const tiLe = (khoa: string) => { const d = dichCua(khoa); if (!d?.ngay || tua == null) return 1; const max = Math.max(1, ...Object.values(d.ngay)); return (d.ngay[tua] ?? 0) / max; };
    for (const xe of ds.xe!) { const u = xe.userData; if (tua != null && u.den) xe.visible = bat.has('xe') && khop(u.tk) && u.k < Math.round(u.n * tiLe(u.den)); }
    for (const m of ds.thap!) { const d = m.userData.d, mat = m.material; if (mat.emissiveIntensity == null || !d.coNguon) continue; mat.emissiveIntensity = tua == null ? .25 : .05 + .9 * tiLe(d.khoa); }
    tuaNhan.textContent = tua == null ? 'bây giờ' : `${tua.slice(8)}/${tua.slice(5, 7)} · ${mh.dich.reduce((a, d) => a + (d.ngay?.[tua!] ?? 0), 0)} phiên`;
  }
  const datTua = (i: number | null) => { tua = i == null || i >= 29 ? null : ngay30[i]!; tuaIn.value = String(i ?? 29); apLop(); };
  tuaIn.oninput = () => { clearInterval(choiTua); datTua(Number(tuaIn.value)); };
  q<HTMLButtonElement>('[data-tua="nay"]').onclick = () => { clearInterval(choiTua); datTua(null); };
  q<HTMLButtonElement>('[data-tua="choi"]').onclick = () => { clearInterval(choiTua); let i = 0; datTua(0); choiTua = window.setInterval(() => { i++; if (i >= 29) { clearInterval(choiTua); datTua(null); return; } datTua(i); }, 700); };

  // ── thông tin thực thể: hover (ô nổi) và chạm (ngăn bên) dùng chung
  const oNen = (k: Nen, c = 14) => `<span style="display:inline-grid;place-items:center;width:${c + 8}px;height:${c + 8}px;border-radius:50%;background:${NEN[k][0]};vertical-align:middle;flex:none">${svgLogo(k, c)}</span>`;
  const oTk = (t: PhoTk, c = 14) => (t.loai === 'tim' && t.host ? oFav(t.host, c + 4) : oNen(t.nen, c));
  const oFav = (site: string, c = 18) => (mh.fav[site] ? `<img src="${mh.fav[site]}" width="${c}" height="${c}" style="vertical-align:middle;border-radius:4px;background:#fff;flex:none" alt="">` : '🌐');
  const cong = (xs: PhoTk[], f: (t: PhoTk) => number) => xs.reduce((a, t) => a + f(t), 0);
  const cong2 = (ls: { so: number }[]) => ls.reduce((a, l) => a + l.so, 0);
  /** thẻ thông tin: dòng nhãn–giá trị (h) + bảng gọn (bang: tiêu đề cột ghi KỲ, mỗi thực thể một hàng) cho thứ là danh sách */
  type TheTin = { dau: string; h: [string, string | number][]; bang?: { cot: string[]; dong: (string | number)[][] }; them?: string };
  const tienO = (n: number | null | undefined) => (n == null ? '—' : `$${n.toFixed(n >= 100 ? 0 : 2)}`);
  function thongTin(chu: any): TheTin {
    const u = chu.userData;
    const tenDich = (k: string | null) => { const d = k ? dichCua(k) : null; return d ? esc(d.ten) : '—'; };
    if (u.loai === 'tk' && u.tk.loai !== 'mxh') { const t = u.tk as PhoTk;
      const nhan = t.loai === 'tim' ? 'Tìm kiếm tự nhiên' : t.loai === 'qc' ? 'Quảng cáo' : t.loai === 'ch' ? 'Trong cửa hàng' : 'Trang giới thiệu';
      if (t.chiTiet) return { dau: `${oTk(t)} ${esc(t.ten)}`, h: [['Traffic', nhan], ['Đổ vào', tenDich(t.dich)], ['👁 Hiển thị 30 ngày', t.chiTiet.hien], ['📄 Xem trang', t.chiTiet.xem], ['⬇ Tải lần đầu', t.chiTiet.tai]] };
      return { dau: `${oTk(t)} ${esc(t.ten)}`, h: [['Traffic', nhan], ['Đổ vào', tenDich(t.dich)], [`🚗 Khách (${t.phienKy})`, t.phien]] };
    }
    if (u.loai === 'tk') { const t = u.tk as PhoTk;
      return { dau: `${oNen(t.nen)} ${esc(t.ten)}`, h: [['Nền', NEN[t.nen][1]], ['Đổ vào', tenDich(t.dich)], ['🪟 Bài đã đăng', t.chay], ['📦 Sắp đăng 7 ngày', t.sap], ['🔦 Lượt xem', so(t.xem)],
        [`🚗 Khách về đích (${t.phienKy})`, t.phien], ['Trạng thái', t.dung ? '⏸ dừng' : t.hong ? `🔴 ${esc(t.hong)}` : '🟢 chạy']] };
    }
    if (u.loai === 'phong') { const p = u.p as typeof mh.congTy[number], gio = (iso: string) => new Date(Date.parse(iso) + 7 * 3600e3).toISOString().slice(11, 16) + ' ' + iso.slice(8, 10) + '/' + iso.slice(5, 7);
      return { dau: `🏢 ${esc(p.ten)}`, h: [['Trưởng phòng', esc(p.truong)], ['Trạng thái', esc(p.trangThai || '—')], ['Dự án', esc(p.duAn.join(', ') || '—')], ['Việc nền 24 giờ', p.viec24],
        ...(p.cuoi ? [['Việc gần nhất', `${esc(p.cuoi.viec)} · ${gio(p.cuoi.luc)}`] as [string, string], ['Kết quả', esc((p.cuoi.ket ?? '').slice(0, 90))] as [string, string]] : [])] };
    }
    if (u.loai === 'cty') return { dau: '🏢 Công ty AI', h: [['Phòng ban', mh.congTy.length], ['Đang hoạt động', mh.congTy.filter((p) => p.hoatDong).length], ['Việc nền 24 giờ', mh.congTy.reduce((a, p) => a + p.viec24, 0)]] };
    if (u.loai === 'tram') { const nm = u.nm as typeof mh.nhaMay[number], loi = nm.loiDv ?? [];
      return { dau: `🕳 Trạm ngầm · ${esc(nm.ten)}`, h: [['⏱ Việc chạy theo giờ', nm.henGio ?? 'chưa đo'], ['🔴 Dịch vụ đang lỗi', loi.length], ['⚡ Site cấp điện', nm.sites.length]],
        bang: loi.length ? { cot: ['Dịch vụ lỗi', 'Máy'], dong: loi.map((x) => [esc(x), esc(nm.ten.split(' · ')[0]!)]) } : undefined };
    }
    // thẻ XƯỞNG PHIM MỚI (góp ý #1445 "trình bày lại, nhìn kinh quá, toàn chữ"): thanh chỉ tiêu hôm nay · 6 ô trạm (số to, trạm đang chạy sáng + tiến độ) ·
    // dòng đang làm · danh sách phim gập được, mỗi phim một dòng (lô chung ghi ở đầu mục, không lặp từng dòng)
    // thẻ TỪNG TRẠM (góp ý #1448 "bấm / hover khu nào thì chỉ hiện nội dung của khu đó"): chỉ phim đang ở trạm này + đã chờ bao lâu, ô lọc
    if (u.loai === 'tram-xp') { const x = xuongData, [ic, ten] = TRAM_XP[u.st]!; if (!x) return { dau: `${ic} ${ten}`, h: [['', 'đang đọc số…']] };
      const n = x.nhip, sang = tramDangChay(n), d = TRAM_DS.find((q2) => q2[0] === u.st), h: [string, string | number][] = [];
      if (sang === u.st && n) h.push(['▶ Đang làm', esc(`${TEN_BUOC[n.buoc] ?? n.buoc}${n.lo ? ` · lô ${n.lo}` : ''}${n.tong ? ` · ${n.xong ?? 0}/${n.tong}` : ''}`)]);
      if (u.st === 0) h.push(['📚 Chờ soát poster', x.tram.kho.so]);
      if (u.st === 2 && sang !== 2) h.push(['Trạng thái', 'đang nghỉ — phim poster đạt chờ ở trạm Soát poster']);
      if (d) h.push([d[2], x.tram[d[1]].so]);
      if (u.st === 3) h.push(['🗑 Loại (18+, bạo lực, máu, cổng chữ…)', x.tram.loai.so]);
      const ds = (d ? dsXuong(x, ic, d[2], d[1], true, d[1] === 'da_len' ? 16 : 0, d[1] !== 'da_len') : '') + (u.st === 3 ? dsXuong(x, '🗑', 'Loại gần nhất', 'loai', false, 10) : '');
      return { dau: `${ic} ${ten}`, h, them: ds ? `<div class="xg"><input class="xg-loc" type="search" placeholder="lọc tên phim / lô…" aria-label="Lọc phim ở trạm" />${ds}</div>` : undefined }; }
    if (u.loai === 'chuyen') return { dau: u.tt['Người'] ? '🧑‍🏭 Người trong nhà máy phim' : `🚚 ${u.tt['Chở']}`, h: Object.entries(u.tt as Record<string, string>).filter(([k]) => k !== 'Chở' && k !== 'Người') };
    if (u.loai === 'xuong-etp') { const x = xuongData, n = x?.nhip;
      if (!x) return { dau: '🏭 Xưởng phim mới', h: [['', 'đang đọc số…']] };
      const sang = tramDangChay(n), t = x.tram, ct = x.chi_tieu;
      const tram: [string, string, number | null, string][] = [['📚', 'Kho phim', t.kho.so, 'chờ'], ['🖼', 'Soát poster', t.poster.so, 'đạt'], ['✂️', 'Cắt đoạn', null, ''], ['🚫', 'Soát luật FB', t.soat.so, 'chờ'], ['🔤', 'Cổng chữ', t.len.so, 'chờ lên'], ['🚀', 'Lên camp', t.da_len.so, 'đã lên']];
      const lau = n?.bat_dau ? Math.round((Date.now() - Date.parse(n.bat_dau)) / 60000) : null;
      const muc = (ic: string, ten: string, k: 'soat' | 'len' | 'da_len' | 'loai', mo: boolean, cuoi = 0) => dsXuong(x, ic, ten, k, mo, cuoi);
      return { dau: '🏭 Xưởng phim mới · Ethopex', h: [], them: `<div class="xg">
        <div class="xg-chi"><span>Hôm nay</span><b style="color:${ct.da >= ct.can ? '#3fd68a' : '#ffd166'}">${ct.da}/${ct.can} phim</b><i><em style="width:${Math.min(100, Math.round(ct.da / Math.max(1, ct.can) * 100))}%"></em></i></div>
        <div class="xg-tram">${tram.map(([ic, ten, so, nh], i) => `<div class="${i === sang ? (n?.loi ? 'loi' : 'on') : ''}"><span>${ic}</span><b>${i === sang && n?.tong ? `${n.xong ?? 0}/${n.tong}` : so ?? (i === sang ? '▶' : '—')}</b><small>${ten}${so != null && i !== sang ? ` · ${nh}` : ''}</small>${i === sang && n?.tong ? `<i><em style="width:${Math.round(Math.min(1, (n.xong ?? 0) / n.tong) * 100)}%"></em></i>` : ''}</div>`).join('')}</div>
        <div class="xg-dang${n?.loi ? ' loi' : ''}">${n ? `▶ ${esc(TEN_BUOC[n.buoc] ?? n.buoc)}${n.lo ? ` · lô ${esc(n.lo)}` : ''}${lau != null && n.buoc !== 'nghi' ? ` · ${lau} phút` : ''}${n.loi ? `<br>⚠ ${esc(n.loi)}` : ''}` : '▶ chưa có nhịp'}</div>
        ${n?.may ? `<div class="xg-may">💻 ${esc(n.may.ten)} · tải ${n.may.tai ?? '?'}/${n.may.nhan} lõi · ổ trống ${n.may.trong_gb} GB · ${esc(n.may.che_do)}</div>` : ''}
        <input class="xg-loc" type="search" placeholder="lọc tên phim / lô…" aria-label="Lọc phim trong xưởng" />
        ${muc('🚫', 'Chờ soát luật FB (18+, bạo lực, máu…)', 'soat', true)}${muc('⏳', 'Chờ lên camp', 'len', true)}${muc('🚀', 'Đã lên gần nhất', 'da_len', false, 12)}${muc('🗑', 'Loại gần nhất', 'loai', false, 8)}</div>` };
    }
    if (u.loai === 'may') { const nm = u.nm as typeof mh.nhaMay[number];
      return { dau: `⚡ ${esc(nm.ten)}`, h: [['Site đang chạy', nm.sites.length], ...(nm.tai != null ? [['⚙ Tải CPU', `${nm.tai} / ${nm.nhan} nhân`] as [string, string], ['🧠 RAM trống', `${nm.ramMB} MB`] as [string, string], ['💾 Đĩa', `${nm.diaPct}%`] as [string, string]] : []), ...(nm.chiThang ? [['Chi tháng', esc(nm.chiThang)] as [string, string]] : []), ...(nm.het ? [['Hạn', `${nm.het.slice(8)}/${nm.het.slice(5, 7)}/${nm.het.slice(0, 4)}`] as [string, string]] : []),
        ...(nm.canhBao ? [['⚠️', esc(nm.canhBao)] as [string, string]] : []), ...nm.sites.slice(0, 12).map((x) => [`↳ ${esc(x)}`, ''] as [string, string])] };
    }
    if (u.loai === 'kho') { const top = mh.dich.filter((d) => !d.cha && (d.tien30 ?? 0) > 0).sort((a, b) => b.tien30! - a.tien30!);
      return { dau: '🏦 Kho bạc · 30 ngày', h: [['Tổng tiền thật', `$${mh.tien.tong.toFixed(2)}`], ...mh.tien.theo.map((x) => [x.ten, `$${x.so.toFixed(2)}`] as [string, string]),
        ...top.slice(0, 8).map((d) => [`↳ ${esc(d.ten.slice(0, 30))}`, `$${d.tien30!.toFixed(2)}`] as [string, string]),
        ['💸 Chi quảng cáo', `$${mh.tien.chi.tong.toFixed(2)}`], ...mh.tien.chi.theo.map((x) => [`↳ ${esc(x.ten)}`, `$${x.so.toFixed(2)}`] as [string, string]),
        ['Còn lại', `$${(mh.tien.tong - mh.tien.chi.tong).toFixed(2)}`], ['Chưa nối', 'Travelpayouts · chi Google Ads (adfond)']] };
    }
    if (u.loai === 'lv') { const lv = LINH_VUC[u.lv]!, ks_ = mh.duAn.filter((k) => k.linhVuc === u.lv), ds_ = mh.dich.filter((d) => ks_.some((k) => k.khoa === d.duAn) && !d.cha);
      return { dau: `${lv.ic} Phường ${esc(lv.ten)}`, h: [['Khu', ks_.length], ['Site', ds_.filter((d) => d.loai === 'site').length], ['App · sản phẩm', ds_.filter((d) => d.loai !== 'site').length],
        ['Phiên 30 ngày', so(ds_.reduce((a, d) => a + (d.phien30 ?? 0), 0))], ['💵 Tiền 30 ngày', `$${ds_.reduce((a, d) => a + (d.tien30 ?? 0), 0).toFixed(2)}`]] };
    }
    if (u.loai === 'tn-tk') { const t = u.t as typeof mh.taiNguyen.tk[number];
      // CẢNH BÁO xử được tại chỗ (anh 23/10/2026 "tài khoản đang bị cảnh báo khi nhìn thấy thì có thể làm gì ở city?"): mở đúng trang cần xử, mở sổ tài khoản, đánh dấu đã xử
      const ds2 = mh.taiNguyen.canhBaoDs.filter((c) => c.nen === t.nen), coGhi = /(^|\.)on\.tc$/.test(location.hostname);
      const gioCb = (iso: string) => new Date(Date.parse(iso) + 7 * 3600e3).toISOString().slice(11, 16) + ' ' + iso.slice(8, 10) + '/' + iso.slice(5, 7);
      const them = ds2.length ? `<div class="bang" style="display:block"><i>Cảnh báo chưa xử · bấm vào toà để mở ngăn rồi xử</i>${ds2.slice(0, 12).map((c) => `<div class="cb" data-cb="${c.id}"><b>${esc(LOAI_CB[c.loai] ?? c.loai)}</b> ${esc(c.handle ?? '')} · ${gioCb(c.luc)}<span class="nho">${esc((c.noiDung ?? '').replace(/\\n|\s+/g, ' ').slice(0, 120))}</span>`
        + `<div class="nut-cb">${c.url ? `<a href="${wrapExternalUrl(c.url)}" target="_blank" rel="noreferrer">↗ Mở chỗ cần xử</a>` : ''}<a href="${MOS2}/platforms" target="_blank" rel="noreferrer">🗂 Sổ tài khoản</a>${coGhi ? `<button data-xu="${c.id}">✅ Đã xử</button>` : ''}</div></div>`).join('')}</div>` : '';
      return { dau: `🗂 Tài khoản ${esc(t.ten)}`, them, h: [['Tổng', t.tong], ...(t.canhBao ? [['🚨 Cảnh báo chưa xử', t.canhBao] as [string, number]] : [])],
        bang: { cot: ['Trạng thái', 'Số'], dong: (Object.keys(TT_TK) as TtTk[]).filter((k) => t.theo[k]).map((k) => [`<span style="color:${TT_TK[k].mau}">●</span> ${TT_TK[k].ten}`, t.theo[k]]) } };
    }
    if (u.loai === 'tn-br') { const gio = (iso: string | null) => (iso ? new Date(Date.parse(iso) + 7 * 3600e3).toISOString().slice(11, 16) + ' ' + iso.slice(8, 10) + '/' + iso.slice(5, 7) : '—');
      return { dau: '🖥 br · hồ sơ trình duyệt', h: [['Ghi chú', 'phiên đang mở trên Mac không đọc được từ máy chủ — số theo sổ hồ sơ']],
        bang: { cot: ['Loại', 'Hồ sơ', 'Mở 7 ngày', 'Lần mở cuối'], dong: mh.taiNguyen.hoSo.map((x) => [x.tool === 'chrome' ? 'Chrome (br)' : x.tool === 'emulator' ? 'Máy ảo Android (os)' : esc(x.tool), x.n, x.gan7, gio(x.cuoi)]) } };
    }
    if (u.loai === 'tn-px') return { dau: '📡 Proxy', h: [['Tổng', mh.taiNguyen.proxy.reduce((a, x) => a + x.n, 0)]], bang: { cot: ['Sức khoẻ', 'Số'], dong: mh.taiNguyen.proxy.map((x) => [esc(x.suc), x.n]) } };
    if (u.loai === 'tn-ns') return { dau: '💰 Ngân sách', h: mh.taiNguyen.chuaNoi.map((x) => ['Chưa nối', esc(x)] as [string, string]),
      bang: { cot: ['Khoản', 'Kỳ', 'Số'], dong: mh.taiNguyen.nganSach.map((x) => [esc(x.ten.slice(0, 34)), x.ky, `${x.tienTe === 'USD' ? '$' : ''}${Math.round(x.so).toLocaleString('vi-VN')}${x.tienTe === 'USD' ? '' : ` ${x.tienTe}`}`]) } };
    // POSTER RÀO (card góp ý #1430 "hover vào biển này thì phải show chi tiết"): bảng chi tiết đúng chỉ số poster nói, theo từng đích của khu / từng nền tài khoản
    if (u.loai === 'poster') { const p = u.p as Poster;
      if (p.ma === 'xuong') return thongTin({ userData: { loai: 'khu', khoa: KHU_XUONG } });
      if (u.khoa === 'tai-nguyen') { const tn = mh.taiNguyen;
        if (p.ma === 'hs') return thongTin({ userData: { loai: 'tn-br' } });
        const cot = p.ma === 'cb' ? 'Cảnh báo' : p.ma === 'khoa' ? 'Khoá / hạn chế' : 'Đang dùng', so2 = (t: typeof tn.tk[number]) => (p.ma === 'cb' ? t.canhBao : p.ma === 'khoa' ? t.theo.khoa + t.theo.han : t.theo.song);
        return { dau: `${p.ic} ${esc(p.so)} ${esc(p.nhan)}`, h: [['Khu', 'Tài nguyên']], bang: { cot: ['Nền', cot], dong: tn.tk.filter((t) => so2(t)).sort((a, b) => so2(b) - so2(a)).map((t) => [esc(t.ten), so2(t)]) } };
      }
      const k = khuCua(u.khoa), ds2 = mh.dich.filter((d) => d.duAn === u.khoa && (p.ma === 'camp' ? d.loai === 'camp' && d.trangThai === 'active' : !d.cha));
      const ten = (d: typeof ds2[number]) => esc((d.phim ?? d.site ?? d.ten).slice(0, 30));
      const bang: TheTin['bang'] = p.ma === 'thu' ? { cot: ['Đích', '💵 Thu 30 ngày'], dong: ds2.filter((d) => d.tien30).sort((a, b) => b.tien30! - a.tien30!).map((d) => [ten(d), tienO(d.tien30)]) }
        : p.ma === 'lai' ? { cot: ['Đích', 'Thu', 'Chi', 'Lãi'], dong: ds2.filter((d) => d.tien30 || d.chi30).map((d) => [ten(d), tienO(d.tien30 ?? 0), tienO(d.chi30 ?? 0), tienO((d.tien30 ?? 0) - (d.chi30 ?? 0))]) }
        : p.ma === 'phien' ? { cot: ['Site', '🚗 Phiên 30 ngày', '30 phút'], dong: ds2.filter((d) => d.phien30).sort((a, b) => b.phien30! - a.phien30!).map((d) => [ten(d), d.phien30!, d.khach30p ?? 0]) }
        : p.ma === 'onl' ? { cot: ['Site', '🟢 Đang xem', '30 phút'], dong: ds2.filter((d) => d.online || d.khach30p).map((d) => [ten(d), d.online ?? 0, d.khach30p ?? 0]) }
        : p.ma === 'xem' ? { cot: ['Sản phẩm', '👁 Xem 7 ngày'], dong: ds2.filter((d) => d.xem7).sort((a, b) => b.xem7! - a.xem7!).map((d) => [ten(d), d.xem7!]) }
        : { cot: ['Camp', '💵 Thu 30n', '💸 Chi 30n'], dong: ds2.sort((a, b) => (b.chi30 ?? 0) - (a.chi30 ?? 0)).slice(0, 14).map((d) => [ten(d), tienO(d.tien30), tienO(d.chi30)]) };
      return { dau: `${p.ic} ${esc(p.so)} ${esc(p.nhan)}`, h: [['Khu', esc(k?.ten ?? '—')]], bang };
    }
    if (u.loai === 'nut-bien') return { dau: '🪧 Bảng hiệu phim', h: [['Đang', tatBien[u.hub] ? 'TẮT — rê lên sân phim để xem biển phim đó' : 'BẬT'], ['Bấm', tatBien[u.hub] ? 'bật lại mọi bảng hiệu' : 'tắt mọi bảng hiệu cho đỡ rối']] };
    if (u.loai === 'cum-phim') { const hub = mh.dich.find((x) => x.khoa === u.hub), o = hub ? boCumP.get(hub.khoa)?.cum.find((c) => c.cum === u.cum) : null;
      if (o) { const ds3 = [...o.goc.flatMap((c) => [c, ...(o.nb.get(c.khoa) ?? [])]), ...o.cho, ...(o.kho ? [o.kho] : [])];
        const v = soCum(o), mauV = v.tH >= v.cH ? '#3fd68a' : '#ff4d5e', ng = ngayNgan(hub?.ngayHom);
        return { dau: `🎬 ${esc(o.ten)}`, h: [['Camp', `${o.goc.length + [...o.nb.values()].flat().length} chạy · ${o.cho.length} chờ public · ${o.kho?.soTat ?? 0} tắt`],
          [`📅 ${ng}`, `ROI <b style="color:${mauV}">${roiChu(roiCua(v.tH, v.cH))}</b> · lãi ${usd(v.tH - v.cH)} · chi ${usd(v.cH)} · thu ${usd(v.tH)}`],
          ['30 ngày', `ROI ${roiChu(roiCua(v.t30, v.c30))} · lãi ${usd(v.t30 - v.c30)} · chi ${usd(v.c30)} · thu ${usd(v.t30)}`]],
          bang: { cot: ['Camp', `ROI ${ng}`, 'Lãi', 'Chi', 'Thu'], dong: ds3.slice(0, 14).map((c) => [`${c.campLoai === 'tat' ? '⏸' : c.campLoai === 'cho' ? '⏳' : c.campLoai === 'vi-pham' ? '⛔' : c.campGoc ? '↳' : '🎬'}${c.sapTat ? '💨' : ''}${c.nhanBanDuoc ? '⧉' : ''} ${esc((c.ten.split(' - ').slice(1).join(' - ') || c.ten).replace(/\s*\(nhan ban \d+ cua \d+\)$/, '').slice(0, 30))}`,
            ...((t, c2) => { const mau = t >= c2 ? '#3fd68a' : '#ff4d5e'; return [`<span style="color:${mau}">${roiChu(roiCua(t, c2))}</span>`, `<span style="color:${mau}">${usd(t - c2)}</span>`, usd(c2), usd(t)]; })(c.thuHom ?? 0, c.chiHom ?? 0)]) } }; } }
    if (u.loai === 'xuong-vung' || u.loai === 'tham-dinh') { const xs = mh.dich.filter((d) => d.duAn === KHU_XUONG && !d.cha && (u.loai === 'tham-dinh' ? d.giaiDoan === 'tham-dinh' : d.giaiDoan !== 'tham-dinh' && d.vungSx === u.vung));
      return { dau: u.loai === 'tham-dinh' ? '🔍 Phòng thẩm định' : `🏭 Xưởng SX · ${VUNG_SX[u.vung]!.ic} ${VUNG_SX[u.vung]!.ten}`, h: [[u.loai === 'tham-dinh' ? 'Đã nộp, chờ duyệt' : 'Đang làm / sẵn sàng', xs.length]],
        bang: { cot: ['Sản phẩm', 'Dự án', 'Trạng thái'], dong: xs.map((d) => [`${d.hostBan ? oFav(d.hostBan, 14) : d.loai === 'app' ? '📱' : '🛍'} ${esc(d.ten.slice(0, 28))}`, esc((d.duAnGocTen ?? '—').slice(0, 16)), esc(TRANG_THAI_VN[d.trangThai ?? ''] ?? d.trangThai ?? (d.giaiDoan === 'tham-dinh' ? 'đang duyệt' : 'đang làm'))]) } };
    }
    // XƯỞNG SX: thẻ riêng — không có phường / nguồn; mỗi đích chưa lên một hàng kèm dự án gốc và trạng thái duyệt
    if (u.loai === 'khu' && u.khoa === KHU_XUONG) { const xs = mh.dich.filter((d) => d.duAn === KHU_XUONG && !d.cha);
      return { dau: '🏭 Xưởng SX', h: [['Chờ lên', `${xs.length} sản phẩm · app`], ['Dự án', [...new Set(xs.map((d) => d.duAnGocTen ?? '—'))].length]],
        bang: { cot: ['Sản phẩm', 'Dự án', 'Trạng thái'], dong: xs.map((d) => [`${d.hostBan ? oFav(d.hostBan, 14) : d.loai === 'app' ? '📱' : '🛍'} ${esc(d.ten.slice(0, 28))}`, esc((d.duAnGocTen ?? '—').slice(0, 16)), esc(TRANG_THAI_VN[d.trangThai ?? ''] ?? d.trangThai ?? 'đang duyệt')]) } };
    }
    // khu dự án: chỉ hiện dòng có nghĩa với khu đó (khu không site thì không có dòng phiên / nguồn; khu có nền tảng thì có camp + chi + lãi)
    if (u.loai === 'khu') { const k = khuCua(u.khoa)!, ds_ = mh.dich.filter((d) => d.duAn === k.khoa), sites = ds_.filter((d) => d.loai === 'site'), sps = ds_.filter((d) => d.loai === 'sp'), cs = ds_.filter((d) => d.loai === 'camp');
      const ve = mh.luong.filter((l) => ds_.some((d) => d.khoa === l.den)), theo = (lo: string) => cong2(ve.filter((l) => mh.tk.find((t) => t.id === l.tu)?.loai === lo));
      const thu = ds_.filter((d) => !d.cha).reduce((a, d) => a + (d.tien30 ?? 0), 0), chi = ds_.filter((d) => !d.cha).reduce((a, d) => a + (d.chi30 ?? 0), 0);
      const h: [string, string | number][] = [['Phường', `${LINH_VUC[k.linhVuc]!.ic} ${LINH_VUC[k.linhVuc]!.ten}`], ['Trạng thái', k.ngung ? '⏸ ngừng hoạt động' : '🟢 đang chạy'], ['💵 Thu 30 ngày', tienO(thu)]];
      if (chi) h.push(['💸 Chi 30 ngày', tienO(chi)], [thu >= chi ? '🟢 Lãi 30 ngày' : '🔴 Lỗ 30 ngày', tienO(thu - chi)]);
      if (cs.length) h.push(['🎬 Camp', `${cs.length} toà · ${cs.filter((c) => c.trangThai === 'active').length} đang chạy`]);
      if (sites.length) h.push(['🌐 Site', sites.length], ['Phiên 30 ngày (mọi site)', so(sites.reduce((a, d) => a + (d.phien30 ?? 0), 0))], ...([['🔍 Từ tìm kiếm', 'tim'], ['📣 Từ quảng cáo', 'qc'], ['🔗 Từ giới thiệu', 'gt'], ['📱 Từ social', 'mxh']] as const).filter(([, lo]) => theo(lo)).map(([n, lo]) => [n, theo(lo)] as [string, number]));
      if (sps.length) h.push(['🛍 Sản phẩm', `${sps.filter((d) => !d.sapLen).length} đang bán`]);
      return { dau: `${k.site ? oFav(k.site) : ''} DỰ ÁN · ${esc(k.ten)}`, h,
        bang: sps.length ? { cot: ['Sản phẩm', '👁 7 ngày', '💵 30 ngày'], dong: sps.slice(0, 10).map((d) => [`${d.hostBan ? oFav(d.hostBan, 14) : '🛍'} ${esc(d.ten.slice(0, 30))}`, d.xem7 ?? '—', tienO(d.tien30)]) } : undefined };
    }
    if (u.loai === 'dich') { const d = u.d as typeof mh.dich[number];
      const tienH: [string, string][] = [...(d.tien30 != null ? [['💵 Thu 30 ngày', `$${d.tien30.toFixed(2)} · ${esc(d.tienPhan?.map((p) => p.loai).join(' + ') || d.loaiTien || '')}`] as [string, string]] : []),
        ...(d.chi30 != null ? [['💸 Chi 30 ngày', `$${d.chi30.toFixed(2)}`] as [string, string], [(d.tien30 ?? 0) >= d.chi30 ? '🟢 Lãi' : '🔴 Lỗ', `$${((d.tien30 ?? 0) - d.chi30).toFixed(2)}`] as [string, string]] : [])];
      const homH: [string, string][] = d.thuHom != null || d.chiHom != null ? [[`📅 ${ngayNgan(mh.dich.find((x) => x.khoa === d.cha)?.ngayHom ?? d.ngayHom)}`,
        `ROI <b style="color:${(d.thuHom ?? 0) >= (d.chiHom ?? 0) ? '#3fd68a' : '#ff4d5e'}">${roiChu(roiCua(d.thuHom ?? 0, d.chiHom ?? 0))}</b> · lãi ${usd((d.thuHom ?? 0) - (d.chiHom ?? 0))} · chi ${usd(d.chiHom ?? 0)} · thu ${usd(d.thuHom ?? 0)}`]] : [];
      const khuTen = (x: typeof d) => esc(x.duAn === KHU_XUONG ? `Xưởng SX · ${x.duAnGocTen ?? ''}` : khuCua(x.duAn)?.ten ?? '—');
      if (d.loai === 'app') { const ban = mh.dich.filter((b) => b.cha === d.khoa);
        return { dau: `📱 ${esc(d.ten)}`, h: [['Dự án', khuTen(d)], ...tienH],
          bang: { cot: ['Cửa hàng', '👁 7 ngày', '⬇ 30 ngày', '💵 30 ngày'], dong: ban.map((b) => [`${b.hostBan ? oFav(b.hostBan, 14) : ''} ${esc(TEN_BAN[b.nenBan ?? ''] ?? b.nenBan ?? '')}`,
            ...(b.sapLen ? [`🏗 ${esc(TRANG_THAI_VN[b.trangThai ?? ''] ?? b.trangThai ?? 'đang duyệt')}`] : [b.xem7 ?? '—', b.tai ?? '—', tienO(b.net)])]) } };
      }
      if (d.loai === 'nen') { const cs = mh.dich.filter((b) => b.cha === d.khoa), song = cs.filter((c) => c.campLoai !== 'tat'), phim = boCumP.get(d.khoa)?.cum ?? [];
        return { dau: `${oFav(d.hostBan ?? 'facebook.com')} ${esc(d.ten)}`, h: [['Dự án', khuTen(d)], ...tienH, ['Cụm phim', String(phim.length)],
          ['Camp', `${song.filter((c) => c.campLoai === 'chay').length} chạy · ${song.filter((c) => c.campLoai === 'cho').length} chờ public · ${song.filter((c) => c.campLoai === 'vi-pham').length} vi phạm · ${cs.reduce((a, c) => a + (c.soTat ?? 0), 0)} tắt`]],
          // bảng như Content của Ethopex: phim tiêu tiền ngày báo cáo mới nhất, xếp theo ROI
          bang: { cot: [`Phim · ${ngayNgan(d.ngayHom)}`, 'ROI', 'Lãi', 'Chi', 'Thu'], dong: phim.map((o) => ({ o, so: soCum(o) })).filter((v) => v.so.cH || v.so.tH).sort((a, b) => (roiCua(b.so.tH, b.so.cH) ?? 9) - (roiCua(a.so.tH, a.so.cH) ?? 9)).slice(0, 16)
            .map(({ o, so: v }) => { const mau = v.tH >= v.cH ? '#3fd68a' : '#ff4d5e'; return [esc(o.ten.slice(0, 28)), `<span style="color:${mau}">${roiChu(roiCua(v.tH, v.cH))}</span>`, `<span style="color:${mau}">${usd(v.tH - v.cH)}</span>`, usd(v.cH), usd(v.tH)]; }) } };
      }
      if (d.loai === 'camp' && d.campLoai === 'tat') return { dau: `⏸ Kho camp đã tắt · ${esc(d.phim ?? '')}`, h: [['Số camp tắt', String(d.soTat ?? 0)], ...homH, ...tienH] };
      if (d.loai === 'camp') return { dau: `🎬 ${esc(d.phim ?? d.ten)}`, h: [['Camp', esc(d.ten)], ['Dạng creative', esc(d.dangCr ?? '—')], ['Ngôn ngữ', esc((d.ngonNgu ?? '—').toUpperCase())],
        ['Trạng thái', { chay: '🟢 đang chạy', cho: '⏳ chờ public — đã dựng, chưa chạy đồng nào', 'vi-pham': '⛔ ad bị Meta từ chối', tat: '⏸ đã tắt' }[d.campLoai ?? 'chay'] ?? esc(d.trangThai ?? '')],
        ...(d.campGoc ? [['Nhân bản của', esc(mh.dich.find((x) => x.khoa === d.campGoc)?.ten ?? d.campGoc)] as [string, string]] : []),
        ...(d.nhanBanDuoc ? [['⧉ Nhân bản', 'đủ luật NB — máy tự nhân bản ở nhịp kế'] as [string, string]] : []),
        ...(d.sapTat ? [['💨 Lỗ sâu', 'chạm luật tắt (ROI < −50%, tiêu > $10) — chờ anh duyệt'] as [string, string]] : []), ...homH, ...tienH] };
      if (d.loai === 'sp') return { dau: `${d.hostBan ? oFav(d.hostBan) : '🛍'} ${esc(d.ten)}`, h: [['Cửa bán', esc(TEN_BAN[d.nenBan ?? ''] ?? d.nenBan ?? '—')], ['Dự án', khuTen(d)], ['Trạng thái', d.sapLen ? `🏗 ${esc(TRANG_THAI_VN[d.trangThai ?? ''] ?? d.trangThai ?? 'sắp lên')}` : '🟢 đang bán'],
        ['👁 Lượt xem trang 7 ngày', so(d.xem7 ?? null)], ['⬇ Lượt tải 30 ngày', so(d.tai ?? null)], ['💵 Thực nhận 30 ngày', d.net == null ? 'chưa đo' : `$${d.net.toFixed(2)}`], dongSucSong(d.cha ? mh.dich.find((x) => x.khoa === d.cha) ?? d : d)] };
      const ve = mh.luong.filter((l) => l.den === d.khoa).sort((a, b) => b.so - a.so);
      const may_ = mh.nhaMay.find((x) => x.sites.includes(d.site!));
      return { dau: `${oFav(d.site!)} ${esc(d.site!)}`, h: [['Khu', esc(khuCua(d.duAn)?.ten ?? '—')], ...(d.online ? [['🟢 Đang xem', d.online] as [string, number]] : []), ...(d.canhBao ? [['⚠️', esc(d.canhBao)] as [string, string]] : []), ...(may_ ? [['⚡ Máy chủ', esc(may_.ten)] as [string, string]] : []),
        ...(d.laShop ? [['🪙 Đơn 30 ngày', so(d.don)] as [string, string]] : [['Phiên 30 ngày (mọi nguồn)', so(d.phien30)] as [string, string]]), ...tienH,
        dongSucSong(d)],
        bang: ve.length ? { cot: ['Traffic', '🚗 Khách', 'Kỳ'], dong: ve.slice(0, 10).map((l) => { const t = mh.tk.find((x) => x.id === l.tu); return [t ? `${oTk(t, 10)} ${esc(t.ten)}` : esc(l.tu), l.so, t?.phienKy ?? '']; }) } : undefined };
    }
    return { dau: '', h: [] };
  }
  const LOAI_CB: Record<string, string> = { xac_minh: 'Cần xác minh', han_che: 'Bị hạn chế', khoa: 'Bị khoá', tu_choi: 'Bị từ chối' };
  const veO = (x: TheTin, coDau = true) => (coDau ? `<div class="dau">${x.dau}</div>` : '') + x.h.map(([k, v]) => `<div class="h"><span>${k}</span><b>${v}</b></div>`).join('')
    + (x.bang ? `<div class="bang" style="grid-template-columns:minmax(0,1fr) repeat(${x.bang.cot.length - 1},auto)">${x.bang.cot.map((c) => `<i>${c}</i>`).join('')}`
      + x.bang.dong.map((r) => `<span class="ten">${r[0]}</span>${r.length === 2 && x.bang!.cot.length > 2 ? `<b style="grid-column:span ${x.bang!.cot.length - 1}">${r[1]}</b>` : r.slice(1).map((v) => `<b>${v}</b>`).join('')}`).join('') + '</div>' : '') + (x.them ?? '');

  const ray = new THREE.Raycaster(), chuot = new THREE.Vector2(); let bay: any = null;
  const datChuot = (e: PointerEvent) => { const b = r.domElement.getBoundingClientRect(); chuot.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); return b; };
  function chuDuoiChuot() {
    ray.setFromCamera(chuot, cam);
    for (const h of ray.intersectObjects(the.children.filter((o: any) => o.visible), false)) { const o = h.object.userData.chu ?? (h.object.userData.loai ? h.object : null); if (o && o.visible !== false) return o; }
    return null;
  }
  let dangSang: any = null, vatChon: any = null;
  const sangLen = (o: any, on: boolean) => { for (const m of [].concat(o.material) as any[]) if (m.emissiveIntensity != null) { m.userData.goc ??= m.emissiveIntensity; m.emissiveIntensity = on ? m.userData.goc + .55 : m.userData.goc; } };
  // THẺ HOVER BẤM ĐƯỢC (góp ý city #1440 "nhìn thấy mà không bấm vào được, di vào là mất"): thẻ đứng yên tại chỗ hiện (không bám con trỏ nữa);
  // rời vật thì còn 350 ms để đưa chuột vào thẻ — vào thẻ thì thẻ ở lại, cuộn / bấm nút trong thẻ được; ra khỏi thẻ thì tắt hoặc chuyển sang vật đang trỏ
  // HIỆN CHẬM (anh 23/10/2026 "không hiện ngay, phải delay vì có thể chỉ là hover nhầm / hover qua, chưa có chủ ý"): chuột phải DỪNG (nhích dưới 4 px)
  // trên cùng một vật HOVER_CHO ms thẻ mới hiện — lướt ngang qua vật (kể cả sân / khu to) không bật thẻ
  // 450 ms anh vẫn thấy như hiện ngay (góp ý #1449) → 900 ms, chuột vẫn phải đứng yên
  const HOVER_CHO = 900;
  let henLo = 0, muonLo: { kb: string | null; bx: any } = { kb: null, bx: null };
  let meoCua: any = null, henAn = 0, henHien = 0, choHien: any = null, trongMeo = false, chuotCuoi = { x: 0, y: 0 }, moc = { x: 0, y: 0 };
  const henHienMeo = (o: any) => { if (choHien === o && Math.hypot(chuotCuoi.x - moc.x, chuotCuoi.y - moc.y) < 4) return; clearTimeout(henHien); choHien = o; moc = { ...chuotCuoi };
    henHien = window.setTimeout(() => { henHien = 0; choHien = null; if (dangSang === o && !trongMeo) hienMeo(o); }, HOVER_CHO); };
  const boHenHien = () => { clearTimeout(henHien); henHien = 0; choHien = null; };
  const hienMeo = (o: any) => { if (o.userData?.bangXh) return; const b = r.domElement.getBoundingClientRect(); meo.innerHTML = veO(thongTin(o)); meo.hidden = false; meo.scrollTop = 0; meoCua = o;
    meo.style.left = `${Math.max(8, Math.min(chuotCuoi.x - b.left + 16, W() - meo.offsetWidth - 8))}px`; meo.style.top = `${Math.max(8, Math.min(chuotCuoi.y - b.top + 16, H() - meo.offsetHeight - 8))}px`; };
  const anMeo = () => { clearTimeout(henAn); henAn = 0; boHenHien(); meo.hidden = true; meoCua = null; };
  const henAnMeo = () => { if (henAn) return; henAn = window.setTimeout(() => { henAn = 0; if (trongMeo) return; meo.hidden = true; meoCua = null; if (dangSang) henHienMeo(dangSang); }, 350); };
  meo.addEventListener('pointerenter', () => { trongMeo = true; clearTimeout(henAn); henAn = 0; });
  meo.addEventListener('pointerleave', () => { trongMeo = false; henAnMeo(); });
  const onMove = (e: PointerEvent) => {
    datChuot(e); const o = chuDuoiChuot(); chuotCuoi = { x: e.clientX, y: e.clientY };
    if (o !== dangSang) { if (dangSang && dangSang !== vatChon) sangLen(dangSang, false); if (o) sangLen(o, true); dangSang = o; r.domElement.style.cursor = o ? 'pointer' : '';
      // bảng hiệu đang tắt: rê lên sân / biển / camp của phim → lộ biển phim đó, rời ra thì ẩn lại
      const u = o?.userData, hubK = u?.hub ?? u?.d?.cha, cum = u?.cum ?? u?.d?.cumPhim, kb = hubK && cum && tatBien[hubK] ? `${hubK}|${cum}` : null;
      const bx = u?.bangXh ? o : u?.loai === 'dich' && u.d?.loai === 'nen' ? bangXhCua.get(u.d.khoa) : null;
      // biển phim lộ ra / bảng xếp hạng mở rộng cũng CHỜ như thẻ hover (anh 24/10/2026 "cái bảng này quá nhanh"): rời ra thì tắt ngay, vào thì đứng HOVER_CHO ms mới bật
      if (bienDangLo && kb !== bienDangLo) { datBien(bienDangLo, false); bienDangLo = null; }
      if (bangXhMo && bx !== bangXhMo) { datBangXh(bangXhMo, false); bangXhMo = null; }
      muonLo = { kb, bx }; clearTimeout(henLo);
      if ((kb && kb !== bienDangLo) || (bx && bx !== bangXhMo)) henLo = window.setTimeout(() => { if (muonLo.kb === kb && kb && kb !== bienDangLo) { datBien(kb, true); bienDangLo = kb; }
        if (muonLo.bx === bx && bx && bx !== bangXhMo) { datBangXh(bx, true); bangXhMo = bx; } danhThuc(); }, HOVER_CHO); }
    if (e.pointerType !== 'mouse') { anMeo(); return; }
    if (o && o === meoCua) { clearTimeout(henAn); henAn = 0; return; }
    if (!o) boHenHien();
    if (o && !meoCua) henHienMeo(o); else if (meoCua) henAnMeo();
  };
  const onLeave = () => { if (!trongMeo) henAnMeo(); clearTimeout(henLo); muonLo = { kb: null, bx: null }; if (bangXhMo) { datBangXh(bangXhMo, false); bangXhMo = null; } };
  // chạm / bấm = nhả trong 450ms, kéo dưới 10px (bộ điều hướng chặn "click" sinh từ cú chạm)
  let xuong: { x: number; y: number; t: number } | null = null;
  const onDown = (e: PointerEvent) => { xuong = { x: e.clientX, y: e.clientY, t: performance.now() }; };
  const onUp = (e: PointerEvent) => { if (!xuong) return; const keo = Math.hypot(e.clientX - xuong.x, e.clientY - xuong.y), lau = performance.now() - xuong.t; xuong = null; if (keo < 10 && lau < 450) { if (henCham) { clearTimeout(henCham); henCham = 0; return; } henCham = window.setTimeout(() => { henCham = 0; cham(e); }, 260); } };
  // NHẤP ĐÚP KHÔNG THÀNH CHỌN (anh 23/10/2026 "bấm double là thành select"): nhấp đơn chờ 260 ms — có nhấp thứ hai thì huỷ chọn, chỉ phóng (onDup)
  let henCham = 0;
  const onMenu = (e: Event) => e.preventDefault();
  // nút mở nhanh trong ngăn: site / sản phẩm mở thẳng (qua href.li, không lộ nguồn), chi tiết mở đúng tab mos2
  const MOS2 = 'https://mos2.on.tc';
  function nutMo(chu: any): string {
    const u = chu.userData, a = (href: string, nhan: string, ngoai = false) => `<a href="${ngoai ? wrapExternalUrl(href) : href}" target="_blank" rel="noreferrer">${nhan}</a>`;
    const ds_: string[] = [];
    if (u.loai === 'dich') { const d = u.d as typeof mh.dich[number];
      if (d.loai === 'site') { ds_.push(a(`https://${d.site}`, '↗ Mở site', true), a(`${MOS2}/?tab=social&sts=landing`, '🛬 Landing')); }
      else if (d.loai === 'nen' || d.loai === 'camp') ds_.push(a(`${MOS2}/?tab=ethopex`, '🎬 Tab Ethopex'));
      else { if (d.url) ds_.push(a(d.url, '↗ Mở trang bán', true)); ds_.push(a(`${MOS2}/?tab=taisan`, '🗂 Tài sản')); } }
    if (u.loai === 'tk' && u.tk.loai === 'mxh') ds_.push(a(`${MOS2}/?tab=social&sts=kenh`, '📺 Kênh'), a(`${MOS2}/?tab=social&sts=lich`, '🗓 Lịch'));
    if (u.loai === 'khu' && u.khoa.startsWith('d:')) ds_.push(a(`${MOS2}/p/${encodeURIComponent(u.khoa.slice(2))}`, '📁 Mở dự án'));
    if (u.loai === 'kho') ds_.push(a(`${MOS2}/?tab=doanhthu`, '💵 Doanh thu'));
    if (u.loai === 'tn-tk') ds_.push(a(`${MOS2}/platforms`, '🗂 Tài khoản'));
    if (u.loai === 'phong' || u.loai === 'cty') ds_.push(a('https://cty.on.tc', '🏢 Mở cty'));
    return ds_.length ? `<div class="nut-mo">${ds_.join('')}</div>` : '';
  }
  // TÌM + BAY TỚI: gõ tên → danh sách → chọn là camera bay tới và mở ngăn
  const chiMuc: { ten: string; nhan: string; obj: any }[] = [];
  const timIn = q<HTMLInputElement>('.tim input'), timDs = q<HTMLElement>('.tim-ds');
  /** khoảng cách bay tới: khu → theo bán kính rào; vật khác → theo cỡ thật của nó (toà to không bị dí sát mặt) */
  const hopDo = new THREE.Box3(), coDo = new THREE.Vector3();
  const kcNhin = (o: any) => (o.userData?.loai === 'khu' && banKinhKhu[o.userData.khoa] ? Math.max(260, banKinhKhu[o.userData.khoa]! * 2.6) : Math.max(220, hopDo.setFromObject(o).getSize(coDo).length() * 2.2));
  const bayToiObj = (o: any) => { const p = o.position.clone().setY(0); bayToi(p.clone().add(cam.position.clone().sub(ctl.target).setLength(kcNhin(o))), p);
    moNgan(o); };
  /** mở ngăn chi tiết (bấm toà / chọn trong ô tìm) — một chỗ dựng; nút "Đã xử" ghi platform_alerts.xong_luc qua /api/social/canh-bao rồi nạp số mới */
  // ô lọc trong thẻ xưởng (và mọi .xg-loc sau này): một bộ nghe chung trên ngăn, không gắn handler nội tuyến vào HTML
  ngan.addEventListener('input', (e) => { const t = e.target as HTMLInputElement; if (!t.classList?.contains('xg-loc')) return; const q2 = t.value.toLowerCase();
    t.closest('.xg')?.querySelectorAll<HTMLElement>('.xg-ds > div').forEach((r) => { r.hidden = !!q2 && !(r.textContent ?? '').toLowerCase().includes(q2); }); });
  function moNgan(o: any) {
    const tt = thongTin(o); (ngan.querySelector('.wg-ten') as HTMLElement).innerHTML = tt.dau; (ngan.querySelector('.wg-than') as HTMLElement).innerHTML = `${veO(tt, false)}${nutMo(o)}`; ngan.hidden = false;
    chonVat(o);
    for (const b of ngan.querySelectorAll<HTMLButtonElement>('[data-xu]')) b.onclick = async () => {
      if (!confirm('Đánh dấu cảnh báo này ĐÃ XỬ? (không xoá — chỉ ghi giờ xử)')) return;
      b.disabled = true; b.textContent = '…';
      try { const r2 = await fetch('/api/social/canh-bao', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: Number(b.dataset.xu) }) }); const j = await r2.json();
        if (!r2.ok || !j.ok) throw new Error(j.error || 'đã xử từ trước'); b.closest('.cb')?.classList.add('xong'); b.textContent = '✓ đã xử';
        const moi = await (await fetch('/api/social/thanh-pho', { cache: 'no-store' })).json(); if (moi?.mh) capNhat(moi.mh); }
      catch (e) { b.disabled = false; b.textContent = '✅ Đã xử'; alert(`Không ghi được: ${(e as Error).message}`); } };
  }
  timIn.oninput = () => { const t = timIn.value.trim().toLowerCase(); if (!t) { timDs.hidden = true; return; }
    const kq = chiMuc.filter((x) => x.ten.toLowerCase().includes(t)).slice(0, 12);
    timDs.innerHTML = kq.length ? kq.map((x, i) => `<button data-i="${chiMuc.indexOf(x)}" tabindex="0">${esc(x.ten)}<span class="nho">${esc(x.nhan)}</span></button>`).join('') : '<span class="nho" style="display:block;padding:6px 8px">Không thấy</span>';
    timDs.hidden = false; for (const b of timDs.querySelectorAll<HTMLButtonElement>('button')) b.onclick = () => { timDs.hidden = true; timIn.value = ''; bayToiObj(chiMuc[Number(b.dataset.i)]!.obj); }; };
  timIn.onkeydown = (e) => { if (e.key === 'Enter') (timDs.querySelector('button') as HTMLButtonElement | null)?.click(); if (e.key === 'Escape') { timDs.hidden = true; timIn.value = ''; } };
  // BẢN ĐỒ NHỎ: chấm khu (màu phường), khung đang nhìn; bấm để bay tới
  const mini = q<HTMLCanvasElement>('.mini'), mg = mini.getContext('2d')!;
  const veMini = () => {
    const W2 = mini.width, H2 = mini.height, rx = gioiHan.x1 - gioiHan.x0 || 1, rz = 2 * gioiHan.z || 1, sx = (x: number) => ((x - gioiHan.x0) / rx) * W2, sz = (z: number) => ((z + gioiHan.z) / rz) * H2;
    mg.clearRect(0, 0, W2, H2); mg.fillStyle = 'rgba(126,139,179,.35)'; mg.fillRect(0, sz(0) - 1, W2, 2);
    for (const o of chiMuc) { const k = o.obj.userData?.loai === 'khu' ? khuCua(o.obj.userData.khoa) : null; mg.fillStyle = k ? LINH_VUC[k.linhVuc]!.mau : o.nhan === 'site' ? '#5effc4' : 'rgba(200,210,240,.5)'; const r = k ? 3 : 1.6; mg.beginPath(); mg.arc(sx(o.obj.position.x), sz(o.obj.position.z), r, 0, 7); mg.fill(); }
    mg.strokeStyle = '#ffd27a'; mg.lineWidth = 1.5; const t = ctl.target, d = cam.position.distanceTo(t) * .5; mg.strokeRect(sx(t.x - d), sz(t.z - d * .55), (d * 2 / rx) * W2, (d * 1.1 / rz) * H2);
  };
  mini.onclick = (e) => { const b = mini.getBoundingClientRect(), x = gioiHan.x0 + ((e.clientX - b.left) / b.width) * (gioiHan.x1 - gioiHan.x0), z = -gioiHan.z + ((e.clientY - b.top) / b.height) * 2 * gioiHan.z, p = new THREE.Vector3(x, 0, z); bayToi(p.clone().add(cam.position.clone().sub(ctl.target)), p); };
  // CHỌN (góp ý #1438): bấm vật = viền vàng quanh nó + mở ngăn, camera đứng yên (chỉ ô tìm mới bay tới, vì vật có thể ở ngoài màn);
  // bấm chỗ trống / Esc = đóng ngăn + bỏ viền. Một viền dùng lại, nằm ngoài nhóm `the` nên không bị dựng lại hay bắt tia.
  const hopChon = new THREE.Box3(), vienChon = new THREE.Box3Helper(hopChon, 0xffd27a); vienChon.visible = false; scene.add(vienChon);
  function chonVat(o: any) { if (vatChon && vatChon !== o && vatChon !== dangSang) sangLen(vatChon, false); vatChon = o; sangLen(o, true);
    if (o.isSprite) vienChon.visible = false; else { hopChon.setFromObject(o).expandByScalar(1.5); vienChon.visible = true; } danhThuc(); }   // bảng nổi (sprite) quay theo camera: hộp bao trục thẳng thành khung dài xuyên qua bảng (góp ý #1443) — chỉ sáng lên, không viền
  function dongNgan() { ngan.hidden = true; vienChon.visible = false; if (vatChon && vatChon !== dangSang) sangLen(vatChon, false); vatChon = null; danhThuc(); }
  const onPhim = (e: KeyboardEvent) => { if (e.key === 'Escape' && !ngan.hidden) dongNgan(); };
  window.addEventListener('keydown', onPhim);
  function cham(e: PointerEvent) {
    datChuot(e); const chu = chuDuoiChuot(); anMeo();
    if (chu?.userData?.loai === 'nut-bien') { const h = chu.userData.hub; tatBien = { ...tatBien, [h]: !tatBien[h] }; try { localStorage.setItem('tp-tat-bien', JSON.stringify(tatBien)); } catch { /* chế độ riêng tư */ } dung(); return; }
    if (chu) moNgan(chu); else if (!ngan.hidden) dongNgan();
  }
  r.domElement.addEventListener('pointermove', onMove); r.domElement.addEventListener('pointerleave', onLeave); r.domElement.addEventListener('pointerdown', onDown);
  r.domElement.addEventListener('pointerup', onUp); r.domElement.addEventListener('contextmenu', onMenu);

  // ── nút điều hướng một tay
  function bayToi(camDen: any, den = ctl.target.clone()) { phongCon = 0; bay = { t: 0, tu: ctl.target.clone(), den, camTu: cam.position.clone(), camDen }; }
  const xoay = (goc: number) => bayToi(ctl.target.clone().add(cam.position.clone().sub(ctl.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), goc)));
  const phong = (k: number) => { const v = cam.position.clone().sub(ctl.target); v.setLength(Math.max(ctl.minDistance, Math.min(ctl.maxDistance, v.length() * k))); bayToi(ctl.target.clone().add(v)); };
  // ⌂ (plan sức sống 24/10/2026): đi LẦN LƯỢT qua các nơi đang SÔI ĐỘNG (có khách ngay lúc này, đông nhất trước) — mỗi lần bấm bay tới một nơi + mở thẻ;
  // hết vòng thì về toàn cảnh. (Cụm "đang sống" rải khắp thành phố nên bay về hộp bao của nó gần như trùng toàn cảnh.) Tự dời camera thì vòng bắt đầu lại.
  let buocSoi = -1; r.domElement.addEventListener('pointerdown', () => { buocSoi = -1; }); host.addEventListener('wheel', () => { buocSoi = -1; }, { passive: true });
  function diQuaNoiSoi() {
    const soi = the.children.filter((o: any) => o.userData?.loai === 'dich' && laDichSong(o.userData.d) && o.userData.d.sucSong === 3).sort((a: any, b: any) => (b.userData.d.online ?? 0) - (a.userData.d.online ?? 0));
    buocSoi++; if (buocSoi >= soi.length) { buocSoi = -1; dongNgan(); bayToi(CAM0.clone(), TAM0.clone()); return; }
    bayToiObj(soi[buocSoi]);
  }
  const NUT: Record<string, () => void> = { trai: () => xoay(Math.PI / 6), phai: () => xoay(-Math.PI / 6), vao: () => phong(.7), ra: () => phong(1.4), goc: diQuaNoiSoi,
    full: () => toanMan(), datLai: () => { datLaiWidget(); dongNgan(); anMeo(); phongCon = 0; bayToi(CAM0.clone(), TAM0.clone()); }, ngay: () => { cheDo = cheDo === 'tu' ? 'ngay' : cheDo === 'ngay' ? 'dem' : 'tu'; apNgayDem(); } };
  // toàn màn: máy tính / Android dùng Fullscreen API; iPhone không có → phủ kín khung nhìn bằng CSS (khoá cuộn trang phía sau)
  const fullBtn = q<HTMLButtonElement>('[data-d="full"]');
  const datNutFull = (on: boolean) => { fullBtn.textContent = on ? '✕' : '⛶'; fullBtn.setAttribute('aria-label', on ? 'Thoát toàn màn hình' : 'Toàn màn hình'); fullBtn.title = fullBtn.getAttribute('aria-label')!; };
  // điện thoại: toàn màn = phủ kín khung nhìn bằng CSS và NHỚ qua F5 (anh 22/10/2026 "F5 phải mở lại đúng màn hình city fullscreen") — Fullscreen API
  // không tự bật lại được khi tải trang (cần cú chạm), còn lớp phủ thì được; URL ?sts=pho giữ đúng tab
  const laDt = matchMedia('(pointer: coarse)').matches || W() < 700;
  const phuKin = (on: boolean) => { host.classList.toggle('tp-full', on); document.documentElement.style.overflow = on ? 'hidden' : ''; datNutFull(on); try { localStorage.setItem('tp-full', on ? '1' : '0'); } catch { /* chế độ riêng tư */ } };
  const toanMan = () => {
    if (document.fullscreenElement) { void document.exitFullscreen(); return; }
    if (host.classList.contains('tp-full')) { phuKin(false); return; }
    if (host.requestFullscreen && document.fullscreenEnabled && !laDt) { void host.requestFullscreen(); return; }
    phuKin(true);
  };
  const onFs = () => datNutFull(document.fullscreenElement === host);
  document.addEventListener('fullscreenchange', onFs);
  try { if (laDt && localStorage.getItem('tp-full') === '1') phuKin(true); } catch { /* chế độ riêng tư */ }
  for (const b of host.querySelectorAll<HTMLButtonElement>('[data-d]')) b.onclick = () => NUT[b.dataset.d!]!();

  // ── vòng vẽ
  // NHỊP VẼ TIẾT KIỆM (anh 23/10/2026 "city đang khiến máy tính nóng"): đang kéo / phóng / bay / rê chuột → mọi khung (~60/giây); để yên → ~20/giây;
  // cửa sổ không được chọn → ~5/giây; tab ẩn → trình duyệt tự dừng. Chuyển động tính theo thời gian thật (nhan = số khung 60 Hz đã trôi)
  // nên xe / nhịp sáng vẫn chạy đúng tốc độ khi vẽ thưa.
  const huong = new THREE.Vector3(), huong2 = new THREE.Vector3(), oA = new THREE.Object3D(); let dem = 0, raf = 0, tCuoi = performance.now(), nhanhDen = 0, mocNgay = 0, mocMini = 0;
  let tacCuoi = performance.now(), soKhung = 0; const viTriX = new THREE.Vector3(); const khungNhin = new THREE.Frustum(), m4Nhin = new THREE.Matrix4(); let khongCat = false;
  const danhThuc = () => { const t = performance.now(); nhanhDen = t + 1500; tacCuoi = t; };
  ctl.addEventListener('change', danhThuc); r.domElement.addEventListener('pointermove', danhThuc); r.domElement.addEventListener('pointerdown', danhThuc);
  // lăn: chụm touchpad (ctrlKey) hoặc chuột có nấc → phóng; vuốt 2 ngón touchpad (delta mịn, có ngang) → trượt theo mặt đất
  const vPhai = new THREE.Vector3(), vTruoc = new THREE.Vector3(); let henLuu = 0;
  // phóng quanh một điểm mặt đất: camera + tâm nhìn cùng co giãn quanh G (log tỉ lệ, kẹp trong min / max khoảng cách); trả về phần đã dùng
  const phongG = new THREE.Vector3(); let phongCon = 0;
  const phongQuanh = (G: any, logK: number) => { const kc = cam.position.distanceTo(ctl.target), kc2 = Math.max(ctl.minDistance, Math.min(ctl.maxDistance, kc * Math.exp(logK))), k = kc2 / kc;
    cam.position.sub(G).multiplyScalar(k).add(G); ctl.target.sub(G).multiplyScalar(k).add(G); return Math.log(k); };
  // thiết bị lăn nhận ra chắc chắn gần nhất, nhớ qua F5 — ca mơ hồ (chuột macOS delta nhỏ, vuốt touchpad thẳng đứng) đi theo nó
  let tbDaLuu: 'chuot' | 'pad' | null = (() => { try { const v = localStorage.getItem('tp-lan'); return v === 'chuot' || v === 'pad' ? v : null; } catch { return null; } })();
  const nhoLan = nhoLanMoi(tbDaLuu);
  const onWheel = (e: WheelEvent) => {
    if ((e.target as Element | null)?.closest?.('.meo, .ben, .ngan')) return;   // lăn trên bảng / ngăn / thẻ = cuộn nội dung, không phóng cảnh
    e.preventDefault(); e.stopPropagation(); danhThuc(); bay = null;
    // LUẬT LĂN (anh chốt 23/10/2026 "để zoom thì giữ phím Shift và scroll chuột — scroll lên là zoom in"):
    //   Shift + lăn = PHÓNG (lên = vào) · chụm touchpad (ctrlKey) = PHÓNG · lăn thường = TRƯỢT · Điều khiển › Lăn chuột = phóng thì lăn thường cũng phóng.
    // Trình duyệt trên Mac đổi lăn dọc thành ngang khi giữ Shift → lấy deltaY, rỗng thì deltaX.
    const d = e.deltaY || (e.shiftKey ? e.deltaX : 0), phongLan = e.ctrlKey || e.shiftKey || dk.lan === 'phong';
    // cỡ bước: nấc bánh xe = một bước ×1,25 đều nhau, dồn vào phongCon rồi trôi ~0,2 giây quanh điểm dưới con trỏ; touchpad theo đúng độ vuốt / chụm (lib/loai-lan.ts nhận thiết bị)
    phanLoaiLan({ ...e, deltaMode: e.deltaMode, deltaX: e.shiftKey ? 0 : e.deltaX, deltaY: d, ctrlKey: e.ctrlKey, timeStamp: e.timeStamp, wheelDeltaY: (e as any).wheelDeltaY || (e.shiftKey ? (e as any).wheelDeltaX : 0) }, nhoLan);
    if (nhoLan.thietBi && nhoLan.thietBi !== tbDaLuu) { tbDaLuu = nhoLan.thietBi; try { localStorage.setItem('tp-lan', tbDaLuu); } catch { /* chế độ riêng tư */ } }
    const buoc = e.ctrlKey ? d * .012 : nhoLan.thietBi === 'pad' ? d * .0022 : Math.sign(d) * .22;
    // PHÓNG VỀ CHỖ CON TRỎ (anh 23/10/2026 "trên pc làm sao zoom"): như Google Maps / Blender "Zoom to Mouse Position" — điểm mặt đất dưới con trỏ đứng yên,
    // camera và tâm nhìn cùng co giãn quanh điểm đó (cùng cách chụm 2 ngón trên điện thoại ở onCham2)
    if (phongLan) { datDuoi(e.clientX, e.clientY, phongG); const b2 = (dk.daoPhong ? -1 : 1) * buoc;
      if (e.ctrlKey) phongQuanh(phongG, b2); else phongCon = Math.max(-3, Math.min(3, phongCon + b2)); }
    else { const kc = cam.position.distanceTo(ctl.target) * .0016; vPhai.setFromMatrixColumn(cam.matrix, 0).setY(0).normalize(); vTruoc.copy(ctl.target).sub(cam.position).setY(0).normalize();
      // mặc định: cảnh đi theo ngón tay như kéo bản đồ (vuốt lên = phố trôi lên = nhìn xa hơn theo trục phố); 'đảo chiều' lật cả hai trục
      const s2 = dk.daoTruot ? -1 : 1, d = vPhai.multiplyScalar(s2 * e.deltaX * kc).add(vTruoc.multiplyScalar(-s2 * e.deltaY * kc)); ctl.target.add(d); cam.position.add(d); }
    ctl.update(); clearTimeout(henLuu); henLuu = window.setTimeout(luuCam, 400);
  };
  host.addEventListener('wheel', onWheel, { passive: false, capture: true });
  // NHẤP ĐÚP = phóng ×2 vào đúng chỗ nhấp (Shift + nhấp đúp = lùi ×2), như Google Maps
  const onDup = (e: MouseEvent) => { e.preventDefault(); clearTimeout(henCham); henCham = 0; window.getSelection?.()?.removeAllRanges(); datDuoi(e.clientX, e.clientY, phongG); bay = null; phongCon = Math.max(-3, Math.min(3, phongCon + (e.shiftKey ? .69 : -.69))); danhThuc(); };
  r.domElement.addEventListener('dblclick', onDup);   // bắt ở pha capture của khung chứa → bộ điều khiển không nhận lăn (không phóng đôi)
  // Safari trên Mac: cử chỉ xoay 2 ngón (gesture*) → xoay quanh tâm nhìn
  let gocCu = 0;
  const onGStart = (e: any) => { e.preventDefault(); gocCu = e.rotation ?? 0; };
  const onGChange = (e: any) => { e.preventDefault(); if (cham2) return;   // iPhone: chụm cũng bắn gesture* — xoay đã tính ở onCham2
    const d = ((e.rotation ?? 0) - gocCu) * Math.PI / 180; gocCu = e.rotation ?? 0; cam.position.sub(ctl.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), -d).add(ctl.target); danhThuc(); ctl.update(); };
  r.domElement.addEventListener('gesturestart', onGStart); r.domElement.addEventListener('gesturechange', onGChange);
  // CHỤM 2 NGÓN (màn cảm ứng): điểm mặt đất G dưới giữa hai ngón đứng yên dưới tay — phóng theo tỉ lệ khoảng cách ngón quanh G, xoay theo góc hai ngón quanh trục đứng
  // qua G; hai ngón cùng cuộn dọc thì nâng / hạ camera (đổi góc nghiêng). Phóng / xoay dời cả camera lẫn tâm nhìn, nên không còn chỗ "nhảy" về tâm nhìn cũ.
  let cham2: { x: number; y: number; d: number; a: number } | null = null;
  const oG = new THREE.Vector3(), oG2 = new THREE.Vector3(), matDat = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), vTam = new THREE.Vector2(), TRUC_Y = new THREE.Vector3(0, 1, 0);
  const datDuoi = (x: number, y: number, ra: any) => { const b = r.domElement.getBoundingClientRect(); vTam.set(((x - b.left) / b.width) * 2 - 1, -((y - b.top) / b.height) * 2 + 1);
    cam.updateMatrixWorld(); ray.setFromCamera(vTam, cam); const kc = cam.position.distanceTo(ctl.target);
    // tia gần chân trời (không cắt đất / cắt quá xa) → lấy tâm nhìn, tránh cú trượt khổng lồ
    if (!ray.ray.intersectPlane(matDat, ra) || ra.distanceTo(cam.position) > kc * 4) ra.copy(ctl.target); return ra; };
  const doc2 = (e: TouchEvent) => { const [a, b] = [e.touches[0]!, e.touches[1]!]; return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2, d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), a: Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) }; };
  const onCham2 = (e: TouchEvent) => {
    if (e.touches.length !== 2) { if (cham2) { cham2 = null; luuCam(); } return; }
    e.preventDefault(); keoDat = null; const m = doc2(e); if (e.type === 'touchstart' || !cham2) { cham2 = m; bay = null; return; }
    datDuoi(cham2.x, cham2.y, oG);
    const kc = cam.position.distanceTo(ctl.target), k = Math.max(ctl.minDistance, Math.min(ctl.maxDistance, kc * (cham2.d / Math.max(1, m.d)))) / kc;
    cam.position.sub(oG).multiplyScalar(k).add(oG); ctl.target.sub(oG).multiplyScalar(k).add(oG);
    let da = m.a - cham2.a; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
    cam.position.sub(oG).applyAxisAngle(TRUC_Y, da).add(oG); ctl.target.sub(oG).applyAxisAngle(TRUC_Y, da).add(oG);
    // HAI NGÓN CÙNG CUỘN LÊN / XUỐNG = NÂNG / HẠ CAMERA (anh 23/10/2026, như Google Maps): điểm giữa hai ngón đi dọc → đổi góc nghiêng quanh tâm nhìn
    // (lên = hạ camera nhìn ngang hơn, xuống = nâng camera nhìn thẳng xuống); hai ngón không còn trượt cảnh — trượt là việc của 1 ngón
    const dy = m.y - cham2.y; if (dy) { const off = cam.position.clone().sub(ctl.target), sp = new THREE.Spherical().setFromVector3(off);
      sp.phi = Math.max(.05, Math.min(ctl.maxPolarAngle, sp.phi - dy * .006)); off.setFromSpherical(sp); cam.position.copy(ctl.target).add(off); }
    cham2 = m; danhThuc(); ctl.update();
  };
  for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) r.domElement.addEventListener(ev, onCham2 as any, { passive: false });
  // KÉO TRƯỢT NEO ĐẤT (như Google Maps): điểm đất dưới ngón / con trỏ lúc bấm luôn nằm dưới ngón / con trỏ khi kéo.
  // Điện thoại: 1 ngón. Máy tính: chuột phải, Shift / Ctrl / ⌘ + kéo trái, hoặc kéo trái khi Điều khiển › Kéo chuột = trượt.
  let keoDat: { id: number; G: any } | null = null; const soCham = new Set<number>();
  const onKeoXuong = (e: PointerEvent) => {
    if (e.pointerType === 'touch') { soCham.add(e.pointerId); if (soCham.size !== 1) { keoDat = null; return; } }
    else { const truot = e.button === 2 || (e.button === 0 && (e.shiftKey || e.ctrlKey || e.metaKey || dk.keo === 'truot')); if (!truot) return; }
    keoDat = { id: e.pointerId, G: datDuoi(e.clientX, e.clientY, new THREE.Vector3()) }; bay = null; phongCon = 0;
  };
  const onKeoDi = (e: PointerEvent) => { if (!keoDat || e.pointerId !== keoDat.id || soCham.size > 1) return;
    datDuoi(e.clientX, e.clientY, oG2); const d = keoDat.G.clone().sub(oG2).setY(0); if (d.lengthSq() > 1e8) return;   // tia sát chân trời: bỏ nhịp đó
    cam.position.add(d); ctl.target.add(d); danhThuc(); ctl.update(); };
  const onKeoLen = (e: PointerEvent) => { soCham.delete(e.pointerId); if (keoDat && e.pointerId === keoDat.id) { keoDat = null; luuCam(); } };
  r.domElement.addEventListener('pointerdown', onKeoXuong); window.addEventListener('pointermove', onKeoDi); window.addEventListener('pointerup', onKeoLen); window.addEventListener('pointercancel', onKeoLen);
  for (const el of host.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-dk]')) { const k = el.dataset.dk as keyof CaiDk;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = !!dk[k]; else el.value = String(dk[k]);
    el.onchange = () => { dk = { ...dk, [k]: el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el instanceof HTMLInputElement ? Number(el.value) : el.value } as CaiDk; apDk(); try { localStorage.setItem('tp-dk', JSON.stringify(dk)); } catch { /* chế độ riêng tư */ } }; }
  // gợi ý điều khiển: hiện lần đầu trên máy có chuột / touchpad, tự tắt sau 9 giây
  try { if (!matchMedia('(pointer: coarse)').matches && !localStorage.getItem('tp-goi-y-dk')) { const gy = document.createElement('div'); gy.className = 'goi-y'; gy.textContent = dk.keo === 'xoay' ? 'Shift + lăn: phóng (lên = vào) · Lăn: trượt · Kéo: xoay · Chuột phải / Shift + kéo: trượt · Nhấp đúp: phóng ×2 · ↺ đặt lại màn' : 'Kéo: trượt · Chuột phải: xoay · Vuốt 2 ngón: trượt · Chụm / lăn: phóng'; host.appendChild(gy); setTimeout(() => gy.remove(), 9000); localStorage.setItem('tp-goi-y-dk', '1'); } } catch { /* chế độ riêng tư */ }
  // BỎ CHI TIẾT QUÁ NHỎ KHI NHÌN XA (23/10/2026): vật nào hiện trên màn nhỏ hơn ~2 điểm ảnh thì không vẽ (cửa sổ, cột rào, người, xe, chữ nền khi lùi xa) —
  // mắt không thấy mà máy vẫn phải vẽ. Cùng cơ chế lớp 1 với cắt ô; phóng vào lại là tự hiện. Lớp 1 cũng không bắt chuột: vật < 2 điểm ảnh vốn không trỏ trúng được.
  const NHO_PX = 1, DAY_PX = .6;   // vật lẻ: bán kính trên màn (điểm ảnh CSS) dưới 1 thì bỏ · khối hàng loạt: bề dày trên màn dưới 0,6 thì bỏ
  let vatNho: any[] = [], khoaNho = '';
  const cauO = new THREE.Sphere(), viTri = new THREE.Vector3();
  function catVe() {
    for (let i = oCat.length - 1; i >= 0; i--) if (oCat[i]!.im.parent?.parent !== scene) oCat.splice(i, 1);
    const khoa = the.uuid + nen.uuid + the.children.length + nen.children.length;
    if (khoa !== khoaNho) { khoaNho = khoa; const trongO = new Set(oCat.map((x) => x.im)); vatNho = [];
      for (const g of [the, nen]) g.traverse((o: any) => { if ((o.isMesh || o.isSprite) && !trongO.has(o) && !o.userData?.luonVe) vatNho.push(o); }); }
    const du = khongCat || r.shadowMap.needsUpdate;   // khung tính lại bóng / bộ kiểm so ảnh: vẽ đủ
    if (du) { for (const x of oCat) x.im.layers.set(0); for (const o of vatNho) o.layers.set(0); return; }
    cam.updateMatrixWorld(); khungNhin.setFromProjectionMatrix(m4Nhin.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const k = H() / (2 * Math.tan(cam.fov * Math.PI / 360)), cp = cam.position;
    for (const x of oCat) { const kc = Math.max(1, x.cau.center.distanceTo(cp) - x.cau.radius); x.im.layers.set(khungNhin.intersectsSphere(x.cau) && x.rI * k / kc >= DAY_PX ? 0 : 1); }
    for (const o of vatNho) { let rr: number;
      if (o.isSprite) { viTri.setFromMatrixPosition(o.matrixWorld); rr = Math.max(o.scale.x, o.scale.y) / 2; }
      else if (o.isInstancedMesh) { viTri.copy(cp).setY(0); rr = (o.geometry.boundingSphere ?? (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere)).radius * 1.5; }   // xe / người / khách chạy khắp nơi: lấy khoảng cách gần nhất có thể = độ cao camera
      else { const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); cauO.copy(g.boundingSphere).applyMatrix4(o.matrixWorld); viTri.copy(cauO.center); rr = cauO.radius; }
      o.layers.set(rr * k / Math.max(1, viTri.distanceTo(cp) - rr) >= NHO_PX ? 0 : 1); }
  }
  function vong(now = performance.now()) {
    raf = requestAnimationFrame(vong);
    // NHỊP VẼ THEO MỨC TƯƠNG TÁC: đang thao tác / bay = mọi khung · vừa thao tác (< 12 s) = ~20 khung/s · ngồi nhìn lâu = ~4 khung/s
    // (xe, người, cột sáng vẫn chạy nhưng thưa) · cửa sổ không tập trung = ~2 khung/s. Chạm / rê chuột là tỉnh lại ngay (danhThuc).
    const coChuyen = chuyenDs.some((c) => c.mot);   // có xe phim đang chạy thật → giữ ~20 khung/s cho tới khi tới nơi (chuyến ngắn, không phải vòng lặp)
    const cach = bay || phongCon || now < nhanhDen ? 0 : !document.hasFocus() ? 500 : now - tacCuoi < 12_000 || coChuyen ? (camUng ? 66 : 48) : 250;
    if (now - tCuoi < cach) return;
    const nhan = Math.min(6, (now - tCuoi) / 16.67); tCuoi = now; dem += nhan;
    if (phongCon && !bay) { const buoc = phongCon * (1 - Math.pow(.72, nhan)), daDung = phongQuanh(phongG, Math.abs(phongCon) < .004 ? phongCon : buoc);
      phongCon = Math.abs(daDung) < 1e-6 || Math.abs(phongCon) < .004 ? 0 : phongCon - daDung; danhThuc(); if (!phongCon) luuCam(); }
    if (bay) { bay.t = Math.min(1, bay.t + .04 * nhan); const e = 1 - Math.pow(1 - bay.t, 3); ctl.target.lerpVectors(bay.tu, bay.den, e); cam.position.lerpVectors(bay.camTu, bay.camDen, e); if (bay.t >= 1) { bay = null; luuCam(); } }
    if (imKhach?.visible) { for (let i = 0; i < khachDs.length; i++) { const k = khachDs[i]!; k.t = (k.t + k.toc * nhan) % 2;
        // online: đi vào (0→1) rồi đứng quanh cửa, nhún nhẹ · 30 phút: vào (0→1) rồi ra (1→2)
        const p = k.onl ? Math.min(1, k.t) : k.t < 1 ? k.t : 2 - k.t; oA.position.lerpVectors(k.a, k.b, p); oA.position.y = Math.abs(Math.sin(dem / 6 + i)) * .25 * CO_NGUOI;
        oA.rotation.set(0, Math.atan2(k.b.x - k.a.x, k.b.z - k.a.z) + (k.onl || k.t < 1 ? 0 : Math.PI), 0); oA.scale.set(1, 1, 1); oA.updateMatrix(); imKhach.setMatrixAt(i, oA.matrix); } imKhach.instanceMatrix.needsUpdate = true; }
    for (const lop of [ds.ngam!, ds.dien!, ds.xu!]) for (const n of lop) { if (!n.visible || !n.userData.nhip) continue; const u = n.userData; u.t = (u.t + u.toc * nhan) % 1; u.duong.getPointAt(u.t, n.position); n.position.y = u.y ?? .6; }
    for (const xe of ds.xu!) { if (!xe.visible || !xe.userData.duong || xe.userData.nhip) continue; const u = xe.userData; u.t = (u.t + u.toc * nhan) % 1; u.duong.getPointAt(u.t, xe.position); u.duong.getTangentAt(u.t, huong); xe.rotation.y = Math.atan2(-huong.z, huong.x); xe.position.y = 2.6; }
    for (const xe of ds.xe!) { if (!xe.visible) continue; const u = xe.userData; u.t = (u.t + u.toc * nhan) % 1; u.duong.getPointAt(u.t, xe.position); u.duong.getTangentAt(u.t, huong); xe.rotation.y = Math.atan2(-huong.z, huong.x); xe.position.y = Y_XE + .3; }
    if (amb.xe) { for (let i = 0; i < amb.xeD.length; i++) { const u = amb.xeD[i]!; u.t = (u.t + u.toc * nhan) % 1; u.duong.getPointAt(u.t, huong2); u.duong.getTangentAt(u.t, huong); oA.position.copy(huong2); oA.rotation.set(0, Math.atan2(-huong.z, huong.x), 0); oA.scale.set(1, 1, 1); oA.updateMatrix(); amb.xe.setMatrixAt(i, oA.matrix); } amb.xe.instanceMatrix.needsUpdate = true; }
    if (amb.nguoi) { for (let i = 0; i < amb.nguoiD.length; i++) { const u = amb.nguoiD[i]!; u.t = (u.t + u.toc * nhan) % 2; const p = u.t < 1 ? u.t : 2 - u.t; oA.position.lerpVectors(u.a, u.b, p); oA.position.y = 1.1 * CO_NGUOI + Math.abs(Math.sin(dem / 6 + i)) * .25 * CO_NGUOI; oA.rotation.set(0, 0, 0); oA.scale.set(1, 1, 1); oA.updateMatrix(); amb.nguoi.setMatrixAt(i, oA.matrix); } amb.nguoi.instanceMatrix.needsUpdate = true; }
    if (now - mocNgay > 30_000) { mocNgay = now; apNgayDem(); }
    if (now - mocMini > 250) { mocMini = now; veMini(); }
    // băng chuyền xưởng chạy: chỉ vẽ lại khi bảng đang trong khung nhìn và đủ to trên màn (> ~220 điểm ảnh ngang) — xa / ngoài màn thì đứng yên, khỏi nạp lại ảnh
    if (xuongDong && xuongData && now - mocXuong > 110) { const bn = xuongDong.bien; viTriX.setFromMatrixPosition(bn.matrixWorld);
      const ngang = bn.scale.x * H() / (2 * Math.tan(cam.fov * Math.PI / 360)) / Math.max(1, viTriX.distanceTo(cam.position));
      if (ngang > 220 && khungNhin.containsPoint(viTriX)) { mocXuong = now; veXuong(xuongDong.cv, xuongData, now); xuongDong.tx.needsUpdate = true; } }
    for (const d of ds.hong!) d.material.color.setHex(Math.floor(dem / 30) % 2 ? 0xff3b4e : 0x5a1018);
    for (const sp of ds.khoi!) { if (!sp.visible) continue; const u = sp.userData; u.pha = (u.pha + u.toc * nhan) % 1; const p = u.pha;
      sp.position.set(u.goc.x + Math.sin(u.lech + p * 3) * (2 + p * 9) + p * 10, u.goc.y + p * 55, u.goc.z + Math.cos(u.lech + p * 3) * (2 + p * 6));
      sp.scale.setScalar(5 + p * 22); sp.material.opacity = Math.min(1, p * 12) * (1 - p) * .95; }
    for (const c of ds.cot!) c.material.opacity = .32 + Math.sin(dem / 25) * .1;
    for (const c of ds.cho!) c.material.opacity = .35 + Math.abs(Math.sin(dem / 18)) * .5;
    for (let i = chuyenDs.length - 1; i >= 0; i--) { const c = chuyenDs[i]!; if (c.mot && c.t + c.toc * nhan >= 1) { chuyenDs.splice(i, 1); c.mot(); } }   // chuyến một lần tới nơi: gỡ khỏi danh sách chạy, đỗ / giao
    for (const c of chuyenDs) { c.t = c.mot ? c.t + c.toc * nhan : (c.t + c.toc * nhan) % (c.di ? 2 : 1); const p = c.di ? (c.t < 1 ? c.t : 2 - c.t) : c.t;
      if (c.duong) { const pp = c.mot ? Math.min(1, c.t) : p; c.duong.getPointAt(pp, c.o.position); c.duong.getTangentAt(pp, huong); c.o.position.y = Y_XE; c.o.rotation.y = Math.atan2(-huong.z, huong.x); continue; }
      c.o.position.lerpVectors(c.a, c.b, p);
      c.o.position.y = c.di ? 1.1 * CO_NGUOI + Math.abs(Math.sin(dem / 5 + c.t * 9)) * .3 * CO_NGUOI : Y_XE; c.o.rotation.y = Math.atan2(-(c.b.z - c.a.z), c.b.x - c.a.x) + (c.di ? 0 : 0); }
    if (ongXung) { for (let i = 0; i < ongDs.length; i++) { const o = ongDs[i]!; o.t = (o.t + o.toc * nhan) % 1; o.cv.getPoint(o.t, oA.position); oA.rotation.set(0, 0, 0); oA.scale.set(1, 1, 1); oA.updateMatrix(); ongXung.setMatrixAt(i, oA.matrix); } ongXung.instanceMatrix.needsUpdate = true; }
    ctl.update();
    // MẶT PHẲNG GẦN THEO KHOẢNG CÁCH (góp ý 23/10/2026 "để ở mức này nền cứ bị nháy"): near cố định 1 với camera lùi ~2.500 thì bộ đệm sâu chỉ phân biệt được
    // ~0,4 đơn vị → mặt sân / nền khu / chữ nền cách nhau 0,1–0,3 tranh nhau từng khung. Đẩy near theo khoảng cách (4%) cho độ phân giải sâu ~0,01 ở mọi mức phóng.
    const kcCam = cam.position.distanceTo(ctl.target), gan = Math.max(1, kcCam * .04), xa = Math.max(6000, kcCam * 3);
    if (Math.abs(cam.near - gan) > gan * .1 || cam.far !== xa) { cam.near = gan; cam.far = xa; cam.updateProjectionMatrix(); }
    catVe();
    r.render(scene, cam); soKhung++;
  }
  // móc cho bộ kiểm scripts/thanh-pho/kiem-dieu-khien: toạ độ màn của vật đầu tiên mang userData.loai · đếm biển đang hiện (chỉ đọc, không đổi cảnh)
  (host as any).__toaDoVat = (loai: string, hub?: string) => { let o: any = null; the.traverse((x: any) => { if (!o && x.visible && x.userData?.loai === loai && (!hub || x.userData.hub === hub)) o = x; }); if (!o) return null;
    const v = new THREE.Vector3(); o.getWorldPosition(v); v.project(cam); const b = r.domElement.getBoundingClientRect(); return { x: b.left + (v.x + 1) / 2 * b.width, y: b.top + (1 - v.y) / 2 * b.height }; };
  (host as any).__demBien = (hub?: string) => { let n = 0; the.traverse((x: any) => { if (x.visible && x.isSprite && x.userData?.loai === 'cum-phim' && (!hub || x.userData.hub === hub)) n++; }); return n; };
  (host as any).__hubNut = () => { let h: string | null = null; the.traverse((x: any) => { if (!h && x.userData?.loai === 'nut-bien') h = x.userData.hub; }); return h; };
  (host as any).__bangXh = (hub: string) => { const sp = bangXhCua.get(hub); if (!sp) return null; const v = new THREE.Vector3(); sp.getWorldPosition(v); v.project(cam); const b = r.domElement.getBoundingClientRect();
    return { x: b.left + (v.x + 1) / 2 * b.width, y: b.top + (1 - v.y) / 2 * b.height, mo: sp.material.map === sp.userData.bangXh.texDu }; };
  (host as any).__soKhung = () => soKhung;
  (host as any).__anhXuong = (t?: number) => { if (!xuongDong) return null; veXuong(xuongDong.cv, xuongData, t ?? performance.now()); xuongDong.tx.needsUpdate = true; return xuongDong.cv.toDataURL('image/png'); };   // bộ kiểm: chụp bảng xưởng ở thời điểm t
  (host as any).__xeXuong = () => [...xeO].map(([id, m]) => ({ id, x: Math.round(m.position.x), z: Math.round(m.position.z), chay: !!m.userData.dangChay, cho: m.userData.chuCho ?? '', tram: phimO.get(id)?.s ?? -1, hien: m.visible && m.parent === the && m.layers.test(cam.layers) }));   // bộ kiểm: xe phim trong nhà máy
  (host as any).__dungLai = () => capNhat(mh);   // bộ kiểm: dựng lại cả cảnh như lượt làm mới mỗi phút
  (host as any).__xuong = (x: XuongEtp) => { xuongData = x; xuongVe?.(x); };   // bộ kiểm: nạp số xưởng như /api/social/thanh-pho/xuong
  (host as any).__sucSong = () => ({ phu: [...demDongBang], dich: mh.dich.filter((d) => laDichSong(d)).map((d) => d.sucSong ?? null).reduce((a: any, v) => { a[String(v)] = (a[String(v)] ?? 0) + 1; return a; }, {}) });
  (host as any).__khongCat = (b: boolean) => { khongCat = b; };   // bộ kiểm so ảnh có / không cắt ô
  (host as any).__thongKe = () => { const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let vat = 0, ngoai = 0, imSai = 0; const m4 = new THREE.Matrix4(), v = new THREE.Vector3();
    scene.traverseVisible((o: any) => { if (!(o.isMesh || o.isLine || o.isSprite || o.isPoints)) return; vat++; const thay = !o.frustumCulled || (o.isSprite ? fr.intersectsSprite(o) : fr.intersectsObject(o)); if (!thay) ngoai++;
      if (o.isInstancedMesh && !thay) for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); v.setFromMatrixPosition(m4).applyMatrix4(o.matrixWorld); if (fr.containsPoint(v)) { imSai++; break; } } });
    return { lenh: r.info.render.calls, tamGiac: r.info.render.triangles, vat, ngoai, imSai }; };
  (host as any).__cam = () => ({ p: cam.position.toArray(), t: ctl.target.toArray() });
  const ro = new ResizeObserver(() => { if (!W() || !H()) return; cam.aspect = W() / H(); cam.updateProjectionMatrix(); r.setSize(W(), H()); });
  ro.observe(host);
  dung(); vong();
  const capNhat = (moi: PhoMoHinh) => { mh = moi; dung(); };
  const don = () => {
    cancelAnimationFrame(raf); ro.disconnect(); for (const x of widgetRo) x.disconnect(); ctl.dispose(); document.removeEventListener('fullscreenchange', onFs); document.documentElement.style.overflow = '';
    r.domElement.removeEventListener('pointermove', onMove); r.domElement.removeEventListener('pointerleave', onLeave); r.domElement.removeEventListener('pointerdown', onDown);
    r.domElement.removeEventListener('pointerup', onUp); window.removeEventListener('keydown', onPhim); r.domElement.removeEventListener('pointermove', danhThuc); r.domElement.removeEventListener('pointerdown', danhThuc); host.removeEventListener('wheel', onWheel, { capture: true } as any); r.domElement.removeEventListener('dblclick', onDup); r.domElement.removeEventListener('pointerdown', onKeoXuong); window.removeEventListener('pointermove', onKeoDi); window.removeEventListener('pointerup', onKeoLen); window.removeEventListener('pointercancel', onKeoLen); r.domElement.removeEventListener('gesturestart', onGStart); r.domElement.removeEventListener('gesturechange', onGChange); for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) r.domElement.removeEventListener(ev, onCham2 as any); r.domElement.removeEventListener('contextmenu', onMenu);
    scene.traverse((o: any) => { o.geometry?.dispose?.(); for (const m of [].concat(o.material ?? []) as any[]) m.dispose?.(); });
    for (const t of Object.values(tex)) t.dispose?.(); r.dispose(); host.innerHTML = ''; host.classList.remove('tp');
  };
  return { don, capNhat, capNhatXuong: (x: XuongEtp) => { xuongData = x; xuongVe?.(x); } };
}
