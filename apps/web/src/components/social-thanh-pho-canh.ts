'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// CẢNH THÀNH PHỐ SOCIAL — vẽ PhoMoHinh (lib/social-thanh-pho.ts) bằng three.js r128 (bản global + MapControls nạp từ CDN, cùng bản đã duyệt ở demo
// artifact 22/10/2026). Thành phố đêm low-poly học CodeCity / GitHub Skyline: cụm = quảng trường + toà trung tâm, toà vệ tinh quanh đó.
// Cửa sổ sáng = bài đang chạy · thùng tím ở chân = bài sắp đăng · cột sáng xanh = lượt xem · xe trên phố = khách về site · đèn đỏ + khói = hỏng ·
// toà mờ = dừng. Chữ trong cảnh chỉ có tên dọc thân toà trung tâm / toà đích; favicon site trên nóc.
// Điều hướng kiểu bản đồ: kéo một ngón / chuột trái = trượt · hai ngón / chuột phải = xoay · chụm / lăn = phóng · nút ⟲ ⟳ ＋ － ⌂ cho một tay.
import { KHU_XUONG, LINH_VUC, TEN_BAN, TRANG_THAI_VN, type PhoDich, type PhoMoHinh, type PhoNen, type PhoTk } from '@/lib/social-thanh-pho';
import { wrapExternalUrl } from '@/lib/external-url';
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
.tp .thu { position: absolute; top: 4px; right: 4px; width: 26px; height: 26px; border: 0; border-radius: 6px; background: transparent; color: var(--chu2); font: 700 16px system-ui; cursor: pointer; }
.tp .ben.gon { width: auto; padding: 0; } .tp .ben.gon > :not(.thu) { display: none; } .tp .ben.gon .thu { position: static; width: 38px; height: 38px; font-size: 18px; }
.tp .ngan { position: absolute; right: 12px; top: 12px; width: 320px; z-index: 6; background: color-mix(in srgb, var(--nen2) 95%, transparent); border: 1px solid var(--vien); border-radius: 12px; padding: 10px; max-height: calc(100% - 140px); overflow: auto; }
.tp .ngan .dong { position: absolute; top: 6px; right: 8px; background: none; border: 0; color: var(--chu2); font-size: 16px; cursor: pointer; }
.tp .meo { position: absolute; z-index: 7; pointer-events: none; min-width: 200px; max-width: 340px; background: color-mix(in srgb, var(--nen2) 96%, transparent); border: 1px solid var(--vien); border-radius: 10px; padding: 8px 10px; box-shadow: 0 8px 24px #0008; }
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
.tp .tim { position: relative; } .tp .tim input { width: 100%; box-sizing: border-box; background: var(--nen); border: 1px solid var(--vien); border-radius: 8px; color: var(--chu); padding: 6px 8px; font: 12px system-ui; }
.tp .tim-ds { position: absolute; left: 0; right: 0; top: 34px; z-index: 9; background: var(--nen2); border: 1px solid var(--vien); border-radius: 8px; max-height: 240px; overflow: auto; }
.tp .tim-ds button { display: flex; gap: 6px; align-items: center; width: 100%; text-align: left; background: none; border: 0; color: var(--chu); padding: 6px 8px; font: 12px system-ui; cursor: pointer; } .tp .tim-ds button:hover, .tp .tim-ds button:focus-visible { background: #23305a; outline: none; }
.tp .tim-ds .nho { margin-left: auto; }
.tp .mini { position: absolute; left: 12px; bottom: 12px; z-index: 5; width: 200px; height: 110px; border: 1px solid var(--vien); border-radius: 10px; background: rgba(8,12,26,.85); cursor: crosshair; }
.tp .ngan .nut-mo { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; } .tp .ngan .nut-mo a { flex: 1; text-align: center; text-decoration: none; color: #fff; background: #23305a; border: 1px solid #4a5a8f; border-radius: 8px; padding: 6px 8px; font: 600 11px system-ui; white-space: nowrap; }
@media (max-width: 600px) { .tp .mini { display: none; } }
.tp .tua { position: absolute; left: 50%; transform: translateX(-50%); bottom: 34px; z-index: 5; display: flex; align-items: center; gap: 8px; background: color-mix(in srgb, var(--nen2) 92%, transparent); border: 1px solid var(--vien); border-radius: 999px; padding: 4px 10px; }
.tp .tua input { width: min(46vw, 320px); accent-color: #ffd27a; } .tp .tua button { border: 0; background: transparent; color: var(--chu); font-size: 15px; cursor: pointer; width: 28px; height: 28px; } .tp .tua-ngay { font: 600 11px system-ui; color: #ffd27a; min-width: 62px; text-align: center; }
@media (max-width: 600px) { .tp .tua { top: 12px; bottom: auto; left: 62px; right: 12px; transform: none; } .tp .tua input { width: auto; flex: 1; min-width: 0; } }
/* toàn màn giả cho iPhone (Safari iOS không cho phóng toàn màn một khối thường) — phủ kín khung nhìn, chừa tai thỏ */
.tp.tp-full { position: fixed !important; inset: 0; z-index: 9999; width: 100vw !important; height: 100dvh !important; border-radius: 0 !important; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); box-sizing: border-box; }
@media (max-width: 600px) { .tp .ngan { top: auto; bottom: 12px; left: 12px; right: 12px; width: auto; max-height: 55%; } .tp .ngan:not([hidden]) ~ .dieu { display: none; } .tp .ben { width: 156px; } }
@media (pointer: coarse) { .tp .chip { width: 32px; height: 32px; } .tp .lop { padding: 6px 10px; } .tp .seg button { padding: 9px 0; } }
`;

/** Dựng thành phố vào host; trả { don: dọn sạch, capNhat: thay số mới và dựng lại tại chỗ — giữ góc nhìn, bộ lọc, ngăn đang mở } */
export function dungThanhPho(host: HTMLElement, mh0: PhoMoHinh, THREE: any): { don: () => void; capNhat: (mh: PhoMoHinh) => void } {
  let mh = mh0;
  host.classList.add('tp'); host.innerHTML = `<style>${CSS}</style>
    <aside class="ben"><button class="thu" aria-expanded="true" aria-label="Thu nhỏ bảng" title="Thu nhỏ / mở bảng">‹</button>
      <b>Tìm</b><div class="tim"><input type="search" placeholder="site, app, kênh, dự án…" aria-label="Tìm trong thành phố" /><div class="tim-ds" hidden></div></div>
      <b>Lớp</b><div class="hang" data-o="lop"></div>
      <b>Nguồn</b><div class="hang" data-o="loc-nen"></div>
      <b>Phường</b><div class="hang" data-o="loc-lv"></div>
      <b>Khu</b><div class="hang" data-o="loc-sp"></div></aside>
    <aside class="ngan" hidden></aside>
    <div class="dieu" role="group" aria-label="Điều hướng">
      <button data-d="trai" aria-label="Xoay trái" title="Xoay trái">⟲</button><button data-d="phai" aria-label="Xoay phải" title="Xoay phải">⟳</button>
      <button data-d="vao" aria-label="Phóng to" title="Phóng to">＋</button><button data-d="ra" aria-label="Thu nhỏ" title="Thu nhỏ">－</button>
      <button data-d="goc" aria-label="Về toàn cảnh" title="Về toàn cảnh">⌂</button><button data-d="full" aria-label="Toàn màn hình" title="Toàn màn hình">⛶</button><button data-d="ngay" class="rong" aria-label="Ngày / đêm">🌙</button></div>
    <div class="tua"><button data-tua="choi" aria-label="Tua 30 ngày" title="Tua lại 30 ngày">▶</button><input type="range" min="0" max="29" value="29" aria-label="Ngày" /><span class="tua-ngay">bây giờ</span><button data-tua="nay" aria-label="Về bây giờ" title="Về bây giờ">⟳</button></div>
    <canvas class="mini" width="200" height="110" aria-label="Bản đồ nhỏ — bấm để bay tới"></canvas>
    <div class="meo" hidden></div>`;
  const q = <T extends HTMLElement>(s: string) => host.querySelector(s) as T;
  const ben = q<HTMLElement>('.ben'), thuBtn = q<HTMLButtonElement>('.thu'), ngan = q<HTMLElement>('.ngan'), meo = q<HTMLElement>('.meo');
  const W = () => host.clientWidth, H = () => host.clientHeight;

  const r = new THREE.WebGLRenderer({ antialias: true }); r.setPixelRatio(Math.min(2, devicePixelRatio)); r.setSize(W(), H()); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  host.prepend(r.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#060914'); // màn dọc (điện thoại): nhìn từ đầu phố để đại lộ chạy dọc màn, lùi xa cho vừa bề ngang hẹp; sương mù lùi theo
  const doc = H() > W();
  scene.fog = doc ? new THREE.Fog('#060914', 2400, 4400) : new THREE.Fog('#060914', 1300, 2600);
  const cam = new THREE.PerspectiveCamera(40, W() / H(), 1, 6000);
  const CAM0 = doc ? new THREE.Vector3(60 - 1500, 1750, 20) : new THREE.Vector3(60, 760, 860), TAM0 = new THREE.Vector3(60, 0, 20); cam.position.copy(CAM0);
  const ctl = new THREE.MapControls(cam, r.domElement); ctl.screenSpacePanning = false; ctl.panSpeed = 1.2; ctl.rotateSpeed = .6; ctl.dampingFactor = .12; ctl.enableDamping = true;
  ctl.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }; ctl.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  ctl.maxPolarAngle = Math.PI * 0.47; ctl.minDistance = 60; ctl.maxDistance = doc ? 3200 : 1600; ctl.zoomSpeed = 1.6; ctl.target.copy(TAM0);
  ctl.addEventListener('change', () => { ctl.target.x = Math.max(gioiHan.x0, Math.min(gioiHan.x1, ctl.target.x)); ctl.target.z = Math.max(-gioiHan.z, Math.min(gioiHan.z, ctl.target.z)); ctl.target.y = 0; });
  const hemi = new THREE.HemisphereLight('#8ea4ff', '#090c18', 0.5); scene.add(hemi);
  let gioiHan = { x0: -700, x1: 700, z: 400 }, daDatCam = false;
  // GÓC NHÌN NHỚ QUA F5 (anh 22/10/2026): vị trí camera + tâm nhìn lưu ở trình duyệt mỗi lần dừng kéo / phóng / xoay và mỗi lần bay xong;
  // mở lại thì về đúng chỗ đó. Nút ⌂ vẫn về góc toàn cảnh. Riêng từng máy (localStorage), hỏng / chế độ riêng tư thì mở góc toàn cảnh như cũ.
  const KHOA_CAM = 'tp-cam';
  const luuCam = () => { try { localStorage.setItem(KHOA_CAM, JSON.stringify({ p: cam.position.toArray(), t: ctl.target.toArray() })); } catch { /* chế độ riêng tư */ } };
  const camDaLuu: { p: number[]; t: number[] } | null = (() => { try { const v = JSON.parse(localStorage.getItem(KHOA_CAM) ?? 'null'); const so = v ? [...v.p, ...v.t] : []; return so.length === 6 && so.every(Number.isFinite) ? v : null; } catch { return null; } })();
  ctl.addEventListener('end', luuCam);
  const trang = new THREE.DirectionalLight('#cfd8ff', 0.55); trang.position.set(-260, 420, 180); trang.castShadow = true; trang.shadow.mapSize.set(2048, 2048);
  Object.assign(trang.shadow.camera, { left: -700, right: 700, top: 450, bottom: -450 }); scene.add(trang);
  const dat = new THREE.Mesh(new THREE.PlaneGeometry(2000, 1200), new THREE.MeshStandardMaterial({ color: '#0b1022', roughness: 1 })); dat.rotation.x = -Math.PI / 2; dat.receiveShadow = true; scene.add(dat);

  let the = new THREE.Group(); scene.add(the);
  const M = (o: any) => new THREE.MeshStandardMaterial(o);
  const NHUA = M({ color: '#1a2036', roughness: .95 }), VACH = new THREE.MeshBasicMaterial({ color: '#7e8bb3' }), GACH = M({ color: '#2a3352', roughness: .9 });
  const add = (g: any, m: any, bong = true) => { const x = new THREE.Mesh(g, m); x.castShadow = bong; x.receiveShadow = true; the.add(x); return x; };
  function pho(x1: number, z1: number, x2: number, z2: number, rong = 12) {
    const dai = Math.hypot(x2 - x1, z2 - z1); if (dai < 1) return; const goc = -Math.atan2(z2 - z1, x2 - x1);
    const m = add(new THREE.PlaneGeometry(dai, rong), NHUA, false); m.rotation.set(-Math.PI / 2, 0, goc); m.position.set((x1 + x2) / 2, .3, (z1 + z2) / 2);
    for (let d = 5; d < dai - 5; d += 12) { const v = add(new THREE.PlaneGeometry(5, .6), VACH, false); v.rotation.set(-Math.PI / 2, 0, goc); const t = d / dai; v.position.set(x1 + (x2 - x1) * t, .35, z1 + (z2 - z1) * t); }
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
    for (let i = 0; i < 4; i++) { const goc = Math.PI / 8 + i * Math.PI / 2, p = add(new THREE.PlaneGeometry(rong, cao), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }), false);
      p.position.set(x + Math.sin(goc) * rGiua, y0 + h / 2, z + Math.cos(goc) * rGiua); p.rotation.set(0, goc, 0, 'YXZ'); p.rotateX(-nghieng); p.userData = { chu }; }
  }
  // BẢNG TÊN TRÊN TƯỜNG (anh 22/10/2026 "phải tận dụng thân toà để điền tên và thông tin, nhìn vào biết ai"): dải biển sát mái, 4 mặt,
  // dòng 1 = tên, dòng 2 = số chính; chữ trắng viền tối cho đọc được cả ngày lẫn đêm
  const texBang = (d1: string, d2: string, mau: string) => {
    const k = `b:${d1}|${d2}|${mau}`; if (tex[k]) return tex[k];
    const c = document.createElement('canvas'); c.width = 512; c.height = 176; const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(8,12,26,.88)'; g.beginPath(); g.roundRect(0, 0, 512, 176, 18); g.fill(); g.fillStyle = mau; g.fillRect(0, 0, 512, 12);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; let co = 68; g.font = `800 ${co}px system-ui, sans-serif`; while (g.measureText(d1).width > 490 && co > 30) { co -= 4; g.font = `800 ${co}px system-ui, sans-serif`; } g.fillText(d1, 256, 70);
    if (d2) { g.fillStyle = '#ffd27a'; let c2 = 50; g.font = `700 ${c2}px system-ui, "Apple Color Emoji", sans-serif`; while (g.measureText(d2).width > 490 && c2 > 24) { c2 -= 3; g.font = `700 ${c2}px system-ui, "Apple Color Emoji", sans-serif`; } g.fillText(d2, 256, 136); }
    return (tex[k] = new THREE.CanvasTexture(c));
  };
  function bangTen(x: number, z: number, w: number, yTren: number, d1: string, d2: string, mau: string, chu: any) {
    const t = texBang(d1, d2, mau), rong = w * .98, cao = Math.min(rong * .36, Math.max(4, yTren * .5));
    for (let i = 0; i < 4; i++) { const g = (i * Math.PI) / 2, p = add(new THREE.PlaneGeometry(rong, cao), new THREE.MeshBasicMaterial({ map: t, transparent: true }), false);
      p.position.set(x + Math.sin(g) * (w / 2 + .12), yTren - cao / 2 - .4, z + Math.cos(g) * (w / 2 + .12)); p.rotation.y = g; p.userData = { chu }; }
  }
  const gon = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k` : String(Math.round(n)));
  // vân vạch đứt (dải đường ngầm): khúc sáng – khúc trống, lặp theo chiều dài
  const texVach = () => { if (tex.vach) return tex.vach; const c = document.createElement('canvas'); c.width = 64; c.height = 8; const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, 40, 8);
    const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return (tex.vach = t); };
  // ĐƯỜNG NGẦM — MỘT hàm cho mọi đường dưới đất (social → site, máy chủ → site, khu có tiền → Kho bạc): dải vạch đứt sát đất theo từng đoạn
  // + nhịp sáng chạy dọc (tốc độ theo độ dài, đường dài không chạy vọt). them = userData thêm (tk để lọc theo nền)
  function duongNgam(pts: any[], mau: string, rong: number, lop: any[], them: Record<string, unknown> = {}, soNhip = 1, toc = .006) {
    const duong = new THREE.CurvePath();
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], dai = a.distanceTo(b); if (dai < .5) continue;
      duong.add(new THREE.LineCurve3(a, b));
      const t2 = texVach().clone(); t2.needsUpdate = true; t2.repeat.set(dai / 4, 1);
      const day = add(new THREE.PlaneGeometry(dai, rong), new THREE.MeshBasicMaterial({ color: mau, map: t2, transparent: true, opacity: .95, depthWrite: false }), false);
      day.rotation.set(-Math.PI / 2, 0, -Math.atan2(b.z - a.z, b.x - a.x)); day.position.set((a.x + b.x) / 2, .45, (a.z + b.z) / 2); day.userData = { chu: null, ...them }; lop.push(day); }
    if (!duong.curves.length) return;
    const tocT = toc * 50 / Math.max(50, duong.getLength());
    for (let j = 0; j < soNhip; j++) { const n = add(new THREE.SphereGeometry(Math.max(1, rong * .8), 10, 10), new THREE.MeshBasicMaterial({ color: mau }), false); n.userData = { chu: null, ...them, duong, t: (j / soNhip + Math.random() * .08) % 1, toc: tocT, nhip: true }; lop.push(n); }
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
  const rao: { cot: any[]; thanh: any[]; mau: any[]; mauT: any[] } = { cot: [], thanh: [], mau: [], mauT: [] };
  function raoQuanh(dinh: any[], mau: string, cong: any | null) {
    const c = new THREE.Color(mau), o = new THREE.Object3D();
    for (let k = 0; k < dinh.length; k++) { const a = dinh[k], b = dinh[(k + 1) % dinh.length], dai = a.distanceTo(b), n = Math.max(1, Math.round(dai / 7));
      for (let i = 0; i < n; i++) { const p = a.clone().lerp(b, i / n), q2 = a.clone().lerp(b, (i + 1) / n), giua = p.clone().lerp(q2, .5);
        if (cong && giua.distanceTo(cong) < 13) continue;
        o.position.set(p.x, 2.6, p.z); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); o.updateMatrix(); rao.cot.push(o.matrix.clone()); rao.mau.push(c);
        for (const y of [1.6, 4]) { o.position.set(giua.x, y, giua.z); o.rotation.set(0, -Math.atan2(q2.z - p.z, q2.x - p.x), 0); o.scale.set(p.distanceTo(q2), 1, 1); o.updateMatrix(); rao.thanh.push(o.matrix.clone()); rao.mauT.push(c); } } }
  }
  function dungRao() {
    for (const [ds2, mau2, geo] of [[rao.cot, rao.mau, new THREE.BoxGeometry(.9, 5.2, .9)], [rao.thanh, rao.mauT, new THREE.BoxGeometry(1, .45, .45)]] as const) {
      if (!ds2.length) continue; const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: .6 }), ds2.length);
      ds2.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, mau2[i]); }); im.instanceColor.needsUpdate = true; im.userData = { chu: null }; the.add(im); }
    rao.cot = []; rao.thanh = []; rao.mau = []; rao.mauT = [];
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
  const ds: Record<string, any[]> = { nha: [], cua: [], thung: [], cot: [], xe: [], xu: [], hong: [], khoi: [], onl: [], dien: [], thap: [], ngam: [] };
  const texKhoi = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!, gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  function khoi(x: number, y: number, z: number, tk: PhoTk, chu: any) {
    for (let k = 0; k < 22; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texKhoi, color: k % 3 ? '#5b5f6e' : '#8a8f9e', transparent: true, depthWrite: false, opacity: 0 }));
      sp.userData = { tk, chu, goc: new THREE.Vector3(x, y, z), pha: k / 22, toc: .0035 + Math.random() * .002, lech: Math.random() * 6.28 }; the.add(sp); ds.khoi!.push(sp); }
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
    im.instanceColor.needsUpdate = true; im.userData = { tk, chu: m }; the.add(im); ds.cua!.push(im);
    for (let k = 0; k < Math.min(14, tk.sap); k++) { const t = add(new THREE.BoxGeometry(3.6, 3.6, 3.6), M({ color: '#9b7bff', emissive: '#7c5cff', emissiveIntensity: .45 })); t.position.set(x + w / 2 + 4 + (k % 2) * 4.2, 1.8 + (Math.floor(k / 2) % 2) * 3.8, z - w / 2 + 3 + Math.floor(k / 4) * 4.2); t.userData = { tk, chu: m }; ds.thung!.push(t); }
    if (tk.xem) { const hc = 10 + 14 * Math.log10(1 + tk.xem), c = add(new THREE.CylinderGeometry(1.4, 3.2, hc, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#6ea8ff', transparent: true, opacity: .45, side: THREE.DoubleSide }), false); c.position.set(x, h + hc / 2, z); c.userData = { tk, chu: m }; ds.cot!.push(c); }
    if (tk.hong) { const d = add(new THREE.SphereGeometry(2.2, 12, 12), new THREE.MeshBasicMaterial({ color: '#ff3b4e' }), false); d.position.set(x, h + 2.5, z); d.userData = { tk, chu: m }; ds.hong!.push(d); khoi(x, h + 3, z, tk, m); }
    const so2 = tk.loai === 'mxh' ? [`🪟${tk.chay}`, tk.sap ? `📦${tk.sap}` : '', tk.xem ? `👁${gon(tk.xem)}` : '', tk.phien ? `🚗${gon(tk.phien)}` : ''].filter(Boolean).join(' ')
      : tk.chiTiet ? `👁${gon(tk.chiTiet.hien)} · ⬇${tk.chiTiet.tai}` : `🚗 ${gon(tk.phien)} khách`;
    bangTen(x, z, w, h, tk.loai === 'mxh' ? `${NEN[tk.nen][1]} · ${tk.ten}` : tk.ten, so2, mauTk(tk), m);
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
    than.instanceColor.needsUpdate = true; than.castShadow = true; than.receiveShadow = true; nen.add(than, cuaSo); amb.than = than; amb.cuaSo = [cuaSo];
    // dòng xe nền: chạy vòng vành đai + dọc đại lộ, hai chiều
    const vong = new THREE.CurvePath(); const goc4 = [[xa, -zN], [xb, -zN], [xb, zN], [xa, zN], [xa, -zN]].map(([x, z]) => new THREE.Vector3(x, 1.2, z));
    for (let i = 0; i < 4; i++) vong.add(new THREE.LineCurve3(goc4[i], goc4[i + 1]));
    const dai = (z: number, nguoc: boolean) => { const c = new THREE.CurvePath(); const p = [new THREE.Vector3(xa, 1.2, z), new THREE.Vector3(xb, 1.2, z)]; if (nguoc) p.reverse(); c.add(new THREE.LineCurve3(p[0], p[1])); return c; };
    const tuyen = [vong, dai(-6.5, false), dai(6.5, true), dai(-zTrong - 30, false), dai(zTrong + 30, true)];
    const soXe = 150; amb.xe = new THREE.InstancedMesh(new THREE.BoxGeometry(3.6, 1.8, 2), new THREE.MeshBasicMaterial({ color: '#ffffff' }), soXe);
    for (let i = 0; i < soXe; i++) { amb.xeD.push({ duong: tuyen[i % tuyen.length], t: ngau(), toc: .0004 + ngau() * .0006 }); amb.xe.setColorAt(i, new THREE.Color(['#c9d2e6', '#ffcf6b', '#ff6b6b', '#8fb3ff', '#e8e8e8'][i % 5])); }
    amb.xe.instanceColor.needsUpdate = true; nen.add(amb.xe);
    // dòng người: đi bộ hai bên vỉa hè đại lộ và quanh khu nền
    const soNguoi = 260; amb.nguoi = new THREE.InstancedMesh(new THREE.CylinderGeometry(.55, .55, 2.2, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), soNguoi);
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
  }

  function dung() {
    scene.remove(the); the = new THREE.Group(); scene.add(the); for (const k of Object.keys(ds)) ds[k] = [];
    const viTri: Record<string, any> = {};
    chiMuc.length = 0;
    const khus = mh.duAn.filter((k) => (!chonSp.size || chonSp.has(k.khoa)) && (!chonLv.size || chonLv.has(k.linhVuc)));
    const nguonCua = (khoa: string) => mh.tk.filter((t) => t.dich === khoa);
    // ── kích thước: quảng trường site = tháp site ở tâm + vòng nguồn; khu dự án = toà DỰ ÁN ở tâm + vòng sản phẩm + vòng quảng trường site
    const vongCua = (d: typeof mh.dich[number]): (PhoTk | PhoDich)[] => (d.loai === 'app' || d.loai === 'nen' ? banCua(d.khoa).flatMap((b) => [b, ...nguonCua(b.khoa)]) : nguonCua(d.khoa));
    const rSite = (d: typeof mh.dich[number]) => 30 + Math.min(40, vongCua(d).length * 3.2);
    // quảng trường vuông: toà vòng quanh đứng trên chu vi hình vuông (cạnh cách tâm rSite) → góc xa tâm hơn; rNgoai = tầm chiếm chỗ để xếp khu
    const rNgoai = (d: typeof mh.dich[number]) => ngoaiTiep(rSite(d), 4) + 14;
    const banCua = (app: string) => mh.dich.filter((b) => b.cha === app);
    const coQt = (d: typeof mh.dich[number]) => (d.loai !== 'sp' && d.loai !== 'camp') || nguonCua(d.khoa).length > 0;   // site, app, hoặc sản phẩm có nguồn (Gumroad) → quảng trường riêng
    type Khu = { k: typeof mh.duAn[number]; sites: typeof mh.dich; sps: typeof mh.dich; rSp: number; rVong: number; D: number; n: number; cx: number; cz: number; phia: number };
    // khu đa giác n cạnh: vòng sản phẩm và vòng quảng trường là hai đa giác đồng tâm (bán kính ngoại tiếp); D = bán kính ngoại tiếp của rào
    const ks: Khu[] = khus.map((k) => {
      const ds_ = mh.dich.filter((d) => d.duAn === k.khoa && !d.cha), sites = ds_.filter(coQt), sps = ds_.filter((d) => !coQt(d)), n = soCanh(k.khoa);
      const rSp = sps.length ? ngoaiTiep(34 + Math.min(30, sps.length * 2.4), n) : 0, maxR = Math.max(0, ...sites.map(rNgoai));
      if (!k.laDuAn && sites.length === 1 && !sps.length) return { k, sites, sps, rSp: 0, rVong: 0, D: maxR + 4, n: 4, cx: 0, cz: 0, phia: 1 };
      const chuVi = sites.reduce((a, d) => a + 2 * rNgoai(d) + 10, 0), rVong = sites.length ? Math.max(ngoaiTiep(rSp + maxR + 26, n), chuVi / (2 * n * Math.sin(Math.PI / n))) : 0;
      return { k, sites, sps, rSp, rVong, D: ngoaiTiep(Math.max(rSp + 18, rVong + maxR + 6, 50), n), n, cx: 0, cz: 0, phia: 1 };
    });
    // XƯỞNG SX đứng riêng cạnh Công ty AI — không vào dãy khu của đại lộ
    const xuongK = ks.find((o) => o.k.khoa === KHU_XUONG);
    if (xuongK) ks.splice(ks.indexOf(xuongK), 1);
    // ── BỐ CỤC: khu đang chạy xếp hai dãy hai phía đại lộ (dãy ngắn nhận khu kế); khu dự án ngừng ra dãy ngoài cùng, sau khu dân cư
    const xep = (os: Khu[], x0: number, z: (o: Khu) => number) => { const day: [number, number] = [x0, x0]; for (const o of os) { const h = day[0] <= day[1] ? 0 : 1; o.phia = h ? 1 : -1; o.cx = day[h] + o.D; o.cz = o.phia * z(o); day[h] += 2 * o.D + 40; } return Math.max(...day); };
    const chay = ks.filter((o) => !o.k.ngung), ngung = ks.filter((o) => o.k.ngung);
    // PHƯỜNG: mỗi lĩnh vực xếp liền một đoạn đại lộ, cách nhau một khoảng có cổng
    const phuong: { lv: string; x0: number; x1: number; z: number }[] = [];
    let xChay = 0;
    for (const lv of [...new Set(chay.map((o) => o.k.linhVuc))]) { const os = chay.filter((o) => o.k.linhVuc === lv), x0 = xChay + 30, x1 = xep(os, x0 + 20, (o) => o.D + 30); phuong.push({ lv, x0, x1, z: Math.max(...os.map((o) => Math.abs(o.cz) + o.D)) + 20 }); xChay = x1 + 50; }
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
    const thapSite = (d: typeof mh.dich[number], x: number, z: number) => {
      let m: any;
      if (d.laShop) {
        m = add(new THREE.BoxGeometry(26, 16, 20), M({ color: '#d77fc4', emissive: '#ff90e8', emissiveIntensity: .18 })); m.position.set(x, 8, z);
        const fv = add(new THREE.CircleGeometry(7, 40), new THREE.MeshBasicMaterial({ map: texFav(d.site!) }), false); fv.rotation.x = -Math.PI / 2; fv.position.set(x, 16.15, z); fv.userData = { chu: m };
        for (const [dx, dz, g] of [[0, 10.1, 0], [13.1, 0, Math.PI / 2], [0, -10.1, Math.PI], [-13.1, 0, -Math.PI / 2]] as const) { const p = add(new THREE.PlaneGeometry(2.2, 14), new THREE.MeshBasicMaterial({ map: texDoc(d.site!.split('.').slice(-2).join('.'), '#ff90e8'), transparent: true, depthWrite: false }), false); p.position.set(x + dx, 8, z + dz); p.rotation.y = g; p.userData = { chu: m }; }
        for (let j = 0; j < Math.min(20, d.don ?? 0); j++) { const xu = add(new THREE.CylinderGeometry(4, 4, 1.4, 24), M({ color: '#ffd166', emissive: '#ffd166', emissiveIntensity: .7, metalness: .5 })); xu.position.set(x + 7, 18 + j * 1.8, z); xu.userData = { chu: m }; ds.xu!.push(xu); }
      } else {
        const phien = d.phien30 ?? 0, h = 14 + 8 * Math.log2(1 + phien), rT = Math.min(14, 5 + 2 * Math.log2(1 + phien));
        m = add(new THREE.CylinderGeometry(rT * .8, rT, h, 8), d.coNguon ? M({ color: '#2a9c7a', emissive: '#1f8f6c', emissiveIntensity: .25, roughness: .4 }) : M({ color: '#3a4058', emissive: '#000000', emissiveIntensity: 0, roughness: .8 })); m.position.set(x, h / 2, z);
        if (d.coNguon) { const sang = add(new THREE.CylinderGeometry(rT * .8 + .2, rT + .2, h * .7, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#5effc4', wireframe: true, transparent: true, opacity: .18 }), false); sang.position.set(x, h * .35 + 2, z); sang.userData = { chu: m }; }
        chuDoc(`${d.site} · ${gon(phien)} phiên${d.tien30 ? ` · $${d.tien30.toFixed(0)}` : ''}`, d.coNguon ? '#5effc4' : '#8e9abd', x, z, rT, rT * .8, h, m);
        const fv = add(new THREE.CircleGeometry(rT * .62, 40), new THREE.MeshBasicMaterial({ map: texFav(d.site!) }), false); fv.rotation.x = -Math.PI / 2; fv.position.set(x, h + .15, z); fv.userData = { chu: m };
      }
      m.userData = { loai: 'dich', d }; vongLai(d, x, z, 16); chiMuc.push({ ten: d.ten, nhan: 'site', obj: m });
      const dinh = m.position.y * 2;
      viTri[d.khoa] = { cua: new THREE.Vector3(x, 1.5, z), dinh: new THREE.Vector3(x, dinh, z) };
      ds.thap!.push(m);
      // cảnh báo hạ tầng (tên miền sắp hết hạn): đèn đỏ + khói như toà hỏng
      if (d.canhBao) { const dd = add(new THREE.SphereGeometry(2.4, 12, 12), new THREE.MeshBasicMaterial({ color: '#ff3b4e' }), false); dd.position.set(x, dinh + 3, z); dd.userData = { chu: m }; ds.hong!.push(dd); khoi(x, dinh + 3, z, undefined as unknown as PhoTk, m); }
      // KHÁCH ĐANG XEM: mỗi người một hình sáng đi từ mép quảng trường vào toà, lặp liên tục (số người = khách online, tối đa 16)
      for (let i = 0; i < Math.min(16, d.online ?? 0); i++) {
        const g = (i / Math.max(1, Math.min(16, d.online ?? 0))) * Math.PI * 2 + i, a = new THREE.Vector3(x + Math.cos(g) * 19, 1.3, z + Math.sin(g) * 19), b = new THREE.Vector3(x + Math.cos(g) * 5, 1.3, z + Math.sin(g) * 5);
        const ng = add(new THREE.CylinderGeometry(.7, .7, 2.6, 8), new THREE.MeshBasicMaterial({ color: '#7dffb2' }), false); ng.userData = { chu: m, a, b, t: i / 16, toc: .004 + (i % 5) * .0008 }; ng.position.copy(a); ds.onl!.push(ng);
      }
    };
    // quảng trường site: tháp ở tâm, nguồn đứng vòng quanh (máy tìm kiếm, quảng cáo, giới thiệu, tài khoản social), phố nan hoa nối vào tâm
    const quangTruongSite = (d: typeof mh.dich[number], x: number, z: number) => {
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
    const toaDuAn = (k: typeof mh.duAn[number], x: number, z: number, luu: number) => {
      const mau = k.ngung ? '#4a4f60' : k.mau, s1 = 34 + Math.min(16, Math.log2(1 + luu) * 1.6);
      const m = add(new THREE.BoxGeometry(s1, 12, s1), M({ color: new THREE.Color(mau).lerp(new THREE.Color('#ffffff'), .08), roughness: .55 })); m.position.set(x, 6, z);
      const b2 = add(new THREE.BoxGeometry(s1 * .7, 12, s1 * .7), M({ color: mau, roughness: .55 })); b2.position.set(x, 18, z); b2.userData = { chu: m };
      const mai = texKhu(k.khoa), b3 = add(new THREE.BoxGeometry(s1 * .42, 12, s1 * .42), [M({ color: mau }), M({ color: mau }), M({ map: mai, emissive: '#fff', emissiveMap: mai, emissiveIntensity: .45 }), M({ color: mau }), M({ color: mau }), M({ color: mau })]); b3.position.set(x, 30, z); b3.userData = { chu: m };
      const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d')!;
      g.fillStyle = k.ngung ? 'rgba(60,64,80,.92)' : 'rgba(17,24,48,.92)'; g.beginPath(); g.roundRect(4, 4, 504, 152, 22); g.fill(); g.strokeStyle = k.ngung ? '#8e9abd' : '#ffd27a'; g.lineWidth = 5; g.stroke();
      g.fillStyle = k.ngung ? '#c8cede' : '#ffd27a'; g.font = '800 40px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(k.nhan, 256, 58);
      g.fillStyle = '#ffffff'; let co = 54; g.font = `800 ${co}px system-ui, sans-serif`; while (g.measureText(k.ten).width > 470 && co > 26) { co -= 3; g.font = `800 ${co}px system-ui, sans-serif`; } g.fillText(k.ten, 256, 122);
      const bien = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false })); bien.scale.set(84, 26, 1); bien.position.set(x, 62, z); bien.userData = { chu: m }; the.add(bien);
      const cot = add(new THREE.CylinderGeometry(.5, .5, 8, 6), M({ color: '#9aa3b8' }), false); cot.position.set(x, 42, z); cot.userData = { chu: m };
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
      bangTen(x, z, w, h, d.cha ? (TEN_BAN[d.nenBan ?? ''] ?? d.nenBan ?? d.ten) : d.ten, [d.sapLen ? '🏗 sắp lên' : '', d.xem7 != null ? `👁${gon(d.xem7)}` : '', d.tai ? `⬇${d.tai}` : '', d.tien30 ? `💵$${d.tien30.toFixed(0)}` : ''].filter(Boolean).join(' '), '#b48cff', m);
    }
    // toà APP: thân dáng điện thoại (khối mảnh, mặt trước là màn hình sáng) + tên dọc; các bản cửa hàng đứng quanh
    function toaApp(d: typeof mh.dich[number], x: number, z: number) {
      queueMicrotask(() => { const o = the.children.find((c: any) => c.userData?.d === d); if (o) chiMuc.push({ ten: d.ten, nhan: 'app', obj: o }); });
      const ban = banCua(d.khoa), so = ban.reduce((a, b) => a + (b.xem7 ?? 0) + (b.tai ?? 0) * 3, 0), h = 26 + Math.min(30, Math.log2(1 + so) * 3);
      const than = M({ color: '#1d2433', roughness: .35, metalness: .4, transparent: !!d.sapLen, opacity: d.sapLen ? .5 : 1 }), man = M({ color: '#3a6ff0', emissive: '#3a6ff0', emissiveIntensity: .55 });
      const m = add(new THREE.BoxGeometry(12, h, 6), [than, than, than, than, man, man]); m.position.set(x, h / 2, z); m.userData = { loai: 'dich', d };
      chuDoc(`${d.ten}${d.tien30 ? ` · $${d.tien30.toFixed(2)}` : ''}`, '#3a6ff0', x, z, 6.4, 6.4, h, m); vongLai(d, x, z, 11);
      viTri[d.khoa] = { cua: new THREE.Vector3(x, 1.5, z) };
    }
    // toà NỀN TẢNG (Ethopex): tháp kính xanh Meta ở tâm khu, cao theo tiền; tên + thu / chi dọc thân; các camp đứng quanh
    function toaNen(d: typeof mh.dich[number], x: number, z: number) {
      const tien = (d.tien30 ?? 0) + (d.chi30 ?? 0), h = 40 + Math.min(50, Math.log2(1 + tien) * 5);
      const m = add(new THREE.CylinderGeometry(9, 12, h, 8), M({ color: '#0b3a8f', emissive: '#0866ff', emissiveIntensity: .35, roughness: .2, metalness: .6 })); m.position.set(x, h / 2, z); m.userData = { loai: 'dich', d };
      const fv = add(new THREE.CircleGeometry(7, 40), new THREE.MeshBasicMaterial({ map: texFav(d.hostBan ?? 'facebook.com', '#0866ff') }), false); fv.rotation.x = -Math.PI / 2; fv.position.set(x, h + .15, z); fv.userData = { chu: m };
      chuDoc(`${d.ten} · +$${(d.tien30 ?? 0).toFixed(0)} · −$${(d.chi30 ?? 0).toFixed(0)}`, '#6ea8ff', x, z, 12, 9, h, m); vongLai(d, x, z, 17);
      viTri[d.khoa] = { cua: new THREE.Vector3(x, 1.5, z), dinh: new THREE.Vector3(x, h, z) }; chiMuc.push({ ten: d.ten, nhan: 'nền tảng', obj: m });
    }
    // toà CAMP: khối màn hình (mặt trước sáng xanh = lãi, đỏ = lỗ), cao theo thu + chi 30 ngày; camp không chạy mờ
    function toaCamp(d: typeof mh.dich[number], x: number, z: number) {
      const thu = d.tien30 ?? 0, chi = d.chi30 ?? 0, lai = thu - chi, h = 10 + Math.min(22, Math.log2(1 + thu + chi) * 3), chay = d.trangThai === 'active';
      const than = M({ color: '#1d2433', roughness: .4, transparent: !chay, opacity: chay ? 1 : .45 }), man = M({ color: lai >= 0 ? '#1f8f5c' : '#8f1f2c', emissive: lai >= 0 ? '#3fd68a' : '#ff4d5e', emissiveIntensity: chay ? .5 : .15 });
      const m = add(new THREE.BoxGeometry(15, h, 15), [than, than, than, than, man, man]); m.position.set(x, h / 2, z); m.userData = { loai: 'dich', d };
      bangTen(x, z, 15, h, d.phim ?? d.ten, `💵$${thu.toFixed(0)} 💸$${chi.toFixed(0)}${d.ngonNgu ? ` · ${d.ngonNgu.toUpperCase()}` : ''}`, lai >= 0 ? '#3fd68a' : '#ff4d5e', m);
      viTri[d.khoa] = { cua: new THREE.Vector3(x, 1.5, z) }; chiMuc.push({ ten: d.phim ?? d.ten, nhan: 'camp', obj: m });
    }
    // TIỀN: đồng xu chồng cạnh đích có tiền 30 ngày; xe vàng chở về Kho bạc
    const coTien: { d: typeof mh.dich[number]; khu: { cx: number; cz: number; phia: number } }[] = [];
    const khuPos: Record<string, { cx: number; cz: number; phia: number }> = {};
    for (const o of ks) {
      const { k, cx, cz } = o; khuPos[k.khoa] = o;
      pho(cx, 0, cx, cz, 12);
      const mauRao = k.ngung ? '#5a5f70' : new THREE.Color(LINH_VUC[k.linhVuc]!.mau).lerp(new THREE.Color('#ffffff'), .25).getStyle(), cong = new THREE.Vector3(cx, 0, cz - o.phia * o.D);
      if (!k.laDuAn && o.sites.length === 1 && !o.sps.length) { quangTruongSite(o.sites[0]!, cx, cz); raoQuanh(dinhDa(4, cx, cz, o.D), mauRao, cong); continue; }   // site đứng riêng: tự là một khu
      const nen_ = add(new THREE.CylinderGeometry(o.D, o.D, .4, o.n, 1, false, Math.PI / 2 - Math.PI / o.n), M({ color: k.ngung ? '#14161f' : new THREE.Color('#121a30').lerp(new THREE.Color(LINH_VUC[k.linhVuc]!.mau), .22), roughness: 1 }), false); nen_.position.set(cx, .2, cz);
      raoQuanh(dinhDa(o.n, cx, cz, o.D), mauRao, cong);
      const luu = o.sites.reduce((a, d) => a + (d.phien30 ?? 0), 0) + o.sps.reduce((a, d) => a + (d.xem7 ?? 0), 0);
      if (k.laDuAn) toaDuAn(k, cx, cz, luu);
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
      for (let k = 0; k < soXe; k++) { const xe = add(new THREE.BoxGeometry(3.4, 1.8, 2), M({ color: ['#20232b', '#1b1b22', '#101010'].includes(mau) ? '#dfe4f2' : mau, emissive: mau, emissiveIntensity: .6 })); xe.userData = { duong, t: k / soXe, toc: .003 + Math.log10(l.so + 1) * .0012, tk, chu: a.m, den: l.den, k, n: soXe }; ds.xe!.push(xe); }
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
        for (let k2 = 0; k2 < Math.min(24, p.viec24); k2++) { const w = add(new THREE.PlaneGeometry(2.4, 1.8), new THREE.MeshBasicMaterial({ color: '#ffe08a' }), false); const tang = Math.floor(k2 / 3), cot = k2 % 3; w.position.set(x - 3.6 + cot * 3.6, 3 + tang * 2.6, z + 6.05); w.userData = { chu: m }; }
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
    // XƯỞNG SX (anh 22/10/2026): lô chữ nhật có rào phía đối diện Công ty AI qua đại lộ — nhà xưởng mái răng cưa ở đáy lô, sản phẩm / app chưa lên
    // xếp hàng theo dự án gốc (biển đầu hàng); lên xong máy tự đưa về khu dự án của nó
    let zXuong = 0;
    if (xuongK) {
      const xs = xuongK.sites.concat(xuongK.sps), nhom = [...new Set(xs.map((d) => d.duAnGocTen ?? '—'))].sort();
      const buoc = (d: typeof mh.dich[number]) => (coQt(d) ? 2 * rNgoai(d) : 22), dai = Math.max(160, ...nhom.map((g) => xs.filter((d) => (d.duAnGocTen ?? '—') === g).reduce((a, d) => a + buoc(d), 30)));
      const sau = (g: string) => Math.max(34, ...xs.filter((d) => (d.duAnGocTen ?? '—') === g).map((d) => (coQt(d) ? 2 * rNgoai(d) : 34)));
      const x0 = (coCty ? xCty : xKho + 150) - dai / 2, z0 = -40, cao = nhom.reduce((a, g) => a + sau(g), 0) + 70;
      pho(x0 + dai / 2, 0, x0 + dai / 2, z0, 12);
      const nenX = add(new THREE.BoxGeometry(dai + 20, .4, cao), M({ color: '#2a2216', roughness: 1 }), false); nenX.position.set(x0 + dai / 2, .2, z0 - cao / 2);
      raoQuanh([new THREE.Vector3(x0 - 10, 0, z0), new THREE.Vector3(x0 + dai + 10, 0, z0), new THREE.Vector3(x0 + dai + 10, 0, z0 - cao), new THREE.Vector3(x0 - 10, 0, z0 - cao)], '#c98a2f', new THREE.Vector3(x0 + dai / 2, 0, z0));
      let z = z0 - 20;
      for (const g of nhom) { const hang = xs.filter((d) => (d.duAnGocTen ?? '—') === g), sz = sau(g); z -= sz / 2; let x = x0 + 30;
        const c = document.createElement('canvas'); c.width = 512; c.height = 96; const gc = c.getContext('2d')!; gc.fillStyle = 'rgba(40,28,8,.92)'; gc.beginPath(); gc.roundRect(4, 4, 504, 88, 16); gc.fill(); gc.fillStyle = '#ffd27a'; gc.font = '800 44px system-ui, sans-serif'; gc.textAlign = 'center'; gc.textBaseline = 'middle'; gc.fillText(g.slice(0, 22), 256, 50, 490);
        const bien = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false })); bien.scale.set(30, 6, 1); bien.position.set(x0 + 8, 9, z); bien.userData = { chu: null }; the.add(bien);
        for (const d of hang) { const b = buoc(d); x += b / 2; if (coQt(d)) quangTruongSite(d, x, z); else toaSp(d, x, z); x += b / 2; }
        z -= sz / 2 + 4; }
      // nhà xưởng: thân thấp + mái răng cưa
      const xx = x0 + dai / 2, zz = z0 - cao + 18, than = add(new THREE.BoxGeometry(70, 14, 24), M({ color: '#6b5636', roughness: .7 })); than.position.set(xx, 7, zz); than.userData = { loai: 'khu', khoa: KHU_XUONG };
      for (let i = 0; i < 5; i++) { const r2 = add(new THREE.CylinderGeometry(7, 7, 24, 3), M({ color: '#c98a2f', emissive: '#7a4f12', emissiveIntensity: .25 })); r2.rotation.set(-Math.PI / 2, 0, 0); r2.position.set(xx - 28 + i * 14, 17, zz); r2.userData = { chu: than }; }
      const c = document.createElement('canvas'); c.width = 512; c.height = 140; const gc = c.getContext('2d')!; gc.fillStyle = 'rgba(40,28,8,.92)'; gc.beginPath(); gc.roundRect(4, 4, 504, 132, 20); gc.fill(); gc.strokeStyle = '#ffd27a'; gc.lineWidth = 5; gc.stroke();
      gc.fillStyle = '#ffd27a'; gc.font = '800 52px system-ui, "Apple Color Emoji", sans-serif'; gc.textAlign = 'center'; gc.fillText('🏭 XƯỞNG SX', 256, 62); gc.fillStyle = '#fff'; gc.font = '700 34px system-ui, sans-serif'; gc.fillText(`${xs.length} sản phẩm chờ lên`, 256, 112);
      const bien = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false })); bien.scale.set(60, 16, 1); bien.position.set(xx, 38, zz); bien.userData = { chu: than }; the.add(bien);
      chiMuc.push({ ten: 'Xưởng SX', nhan: 'khu', obj: than }); khuPos[KHU_XUONG] = { cx: xx, cz: zz, phia: -1 }; zXuong = cao - z0;
    }
    dungRao();
    const kn = khuNen(Math.min(lech - 40, xMay - Math.ceil(mh.nhaMay.length / 2) * 90 - 30), coCty ? xCty + 110 : xKho + 60, Math.max(zTrong, coCty ? 260 : 0, zXuong + 20), zNgoai);
    gioiHan = { x0: kn.xa, x1: kn.xb, z: kn.zDat };
    const rong = kn.xb - kn.xa;
    if (doc) { CAM0.set(-rong * .62, rong * .7, 0); TAM0.set(0, 0, 0); scene.fog.near = rong * .9; scene.fog.far = rong * 2.2; ctl.maxDistance = rong * 1.6; }
    else { const vua = (rong / 2) / Math.tan(Math.atan(Math.tan(Math.PI / 9) * (W() / H())));   // lùi đủ xa để bề ngang thành phố vừa khung
      CAM0.set(0, vua * .62, vua * .72); TAM0.set(0, 0, 10); scene.fog.near = vua * 1.1; scene.fog.far = vua * 2.6; ctl.maxDistance = vua * 1.6; }
    cam.far = rong * 3; cam.updateProjectionMatrix();
    if (!daDatCam) { if (camDaLuu) { cam.position.fromArray(camDaLuu.p); ctl.target.fromArray(camDaLuu.t); } else { cam.position.copy(CAM0); ctl.target.copy(TAM0); } daDatCam = true; }
    apNgayDem(); apLop();
  }

  // ── bảng điều khiển
  const LOP: Record<string, [string, string]> = { cua: ['🪟', 'Bài đang chạy'], thung: ['📦', 'Bài sắp đăng'], cot: ['🔦', 'Lượt xem'], xe: ['🚗', 'Khách về site'], xu: ['🪙', 'Tiền về kho bạc · đường tiền ngầm'], onl: ['🟢', 'Khách đang xem'], dien: ['⚡', 'Máy chủ · cáp ngầm'], ngam: ['🔗', 'Đường ngầm social → site'] };
  for (const [k, [ic, ten]] of Object.entries(LOP)) { const b = document.createElement('button'); b.className = 'lop'; b.title = ten; b.textContent = ic; b.setAttribute('aria-pressed', 'true'); b.setAttribute('aria-label', ten);
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
    apTua();
  }
  const datThu = (gon: boolean) => { ben.classList.toggle('gon', gon); thuBtn.textContent = gon ? '☰' : '‹'; thuBtn.setAttribute('aria-expanded', String(!gon)); thuBtn.setAttribute('aria-label', gon ? 'Mở bảng' : 'Thu nhỏ bảng'); try { localStorage.setItem('tp-ben-gon', gon ? '1' : '0'); } catch { /* chế độ riêng tư */ } };
  let gonDau = W() < 600; try { const v = localStorage.getItem('tp-ben-gon'); if (v != null) gonDau = v === '1'; } catch { /* chế độ riêng tư */ }
  datThu(gonDau); thuBtn.onclick = () => datThu(!ben.classList.contains('gon'));

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
  type TheTin = { dau: string; h: [string, string | number][]; bang?: { cot: string[]; dong: (string | number)[][] } };
  const tienO = (n: number | null | undefined) => (n == null ? '—' : `$${n.toFixed(n >= 100 ? 0 : 2)}`);
  function thongTin(chu: any): TheTin {
    const u = chu.userData;
    const tenDich = (k: string | null) => { const d = k ? dichCua(k) : null; return d ? esc(d.ten) : '—'; };
    if (u.loai === 'tk' && u.tk.loai !== 'mxh') { const t = u.tk as PhoTk;
      const nhan = t.loai === 'tim' ? 'Tìm kiếm tự nhiên' : t.loai === 'qc' ? 'Quảng cáo' : t.loai === 'ch' ? 'Trong cửa hàng' : 'Trang giới thiệu';
      if (t.chiTiet) return { dau: `${oTk(t)} ${esc(t.ten)}`, h: [['Nguồn', nhan], ['Đổ vào', tenDich(t.dich)], ['👁 Hiển thị 30 ngày', t.chiTiet.hien], ['📄 Xem trang', t.chiTiet.xem], ['⬇ Tải lần đầu', t.chiTiet.tai]] };
      return { dau: `${oTk(t)} ${esc(t.ten)}`, h: [['Nguồn', nhan], ['Đổ vào', tenDich(t.dich)], [`🚗 Khách (${t.phienKy})`, t.phien]] };
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
      const khuTen = (x: typeof d) => esc(x.duAn === KHU_XUONG ? `Xưởng SX · ${x.duAnGocTen ?? ''}` : khuCua(x.duAn)?.ten ?? '—');
      if (d.loai === 'app') { const ban = mh.dich.filter((b) => b.cha === d.khoa);
        return { dau: `📱 ${esc(d.ten)}`, h: [['Dự án', khuTen(d)], ...tienH],
          bang: { cot: ['Cửa hàng', '👁 7 ngày', '⬇ 30 ngày', '💵 30 ngày'], dong: ban.map((b) => [`${b.hostBan ? oFav(b.hostBan, 14) : ''} ${esc(TEN_BAN[b.nenBan ?? ''] ?? b.nenBan ?? '')}`,
            ...(b.sapLen ? [`🏗 ${esc(TRANG_THAI_VN[b.trangThai ?? ''] ?? b.trangThai ?? 'đang duyệt')}`] : [b.xem7 ?? '—', b.tai ?? '—', tienO(b.net)])]) } };
      }
      if (d.loai === 'nen') { const cs = mh.dich.filter((b) => b.cha === d.khoa);
        return { dau: `${oFav(d.hostBan ?? 'facebook.com')} ${esc(d.ten)}`, h: [['Dự án', khuTen(d)], ...tienH, ['Camp (toà quanh)', `${cs.length} · ${cs.filter((c) => c.trangThai === 'active').length} đang chạy`]],
          bang: { cot: ['Camp', '💵 Thu 30n', '💸 Chi 30n', 'Lãi'], dong: cs.slice(0, 12).map((c) => [esc((c.phim ?? c.ten).slice(0, 26)), tienO(c.tien30), tienO(c.chi30), `${(c.tien30 ?? 0) >= (c.chi30 ?? 0) ? '🟢' : '🔴'} ${tienO((c.tien30 ?? 0) - (c.chi30 ?? 0))}`]) } };
      }
      if (d.loai === 'camp') return { dau: `🎬 ${esc(d.phim ?? d.ten)}`, h: [['Camp', esc(d.ten)], ['Ngôn ngữ', esc((d.ngonNgu ?? '—').toUpperCase())], ['Trạng thái', d.trangThai === 'active' ? '🟢 đang chạy' : `⏸ ${esc(d.trangThai ?? '')}`], ...tienH] };
      if (d.loai === 'sp') return { dau: `${d.hostBan ? oFav(d.hostBan) : '🛍'} ${esc(d.ten)}`, h: [['Cửa bán', esc(TEN_BAN[d.nenBan ?? ''] ?? d.nenBan ?? '—')], ['Dự án', khuTen(d)], ['Trạng thái', d.sapLen ? `🏗 ${esc(TRANG_THAI_VN[d.trangThai ?? ''] ?? d.trangThai ?? 'sắp lên')}` : '🟢 đang bán'],
        ['👁 Lượt xem trang 7 ngày', so(d.xem7 ?? null)], ['⬇ Lượt tải 30 ngày', so(d.tai ?? null)], ['💵 Thực nhận 30 ngày', d.net == null ? 'chưa đo' : `$${d.net.toFixed(2)}`]] };
      const ve = mh.luong.filter((l) => l.den === d.khoa).sort((a, b) => b.so - a.so);
      const may_ = mh.nhaMay.find((x) => x.sites.includes(d.site!));
      return { dau: `${oFav(d.site!)} ${esc(d.site!)}`, h: [['Khu', esc(khuCua(d.duAn)?.ten ?? '—')], ...(d.online ? [['🟢 Đang xem', d.online] as [string, number]] : []), ...(d.canhBao ? [['⚠️', esc(d.canhBao)] as [string, string]] : []), ...(may_ ? [['⚡ Máy chủ', esc(may_.ten)] as [string, string]] : []),
        ...(d.laShop ? [['🪙 Đơn 30 ngày', so(d.don)] as [string, string]] : [['Phiên 30 ngày (mọi nguồn)', so(d.phien30)] as [string, string]]), ...tienH,
        ['Nguồn', d.coNguon ? `${ve.length} nguồn` : '⚪ chưa gắn nguồn traffic']],
        bang: ve.length ? { cot: ['Nguồn', '🚗 Khách', 'Kỳ'], dong: ve.slice(0, 10).map((l) => { const t = mh.tk.find((x) => x.id === l.tu); return [t ? `${oTk(t, 10)} ${esc(t.ten)}` : esc(l.tu), l.so, t?.phienKy ?? '']; }) } : undefined };
    }
    return { dau: '', h: [] };
  }
  const veO = (x: TheTin) => `<div class="dau">${x.dau}</div>` + x.h.map(([k, v]) => `<div class="h"><span>${k}</span><b>${v}</b></div>`).join('')
    + (x.bang ? `<div class="bang" style="grid-template-columns:minmax(0,1fr) repeat(${x.bang.cot.length - 1},auto)">${x.bang.cot.map((c) => `<i>${c}</i>`).join('')}`
      + x.bang.dong.map((r) => `<span class="ten">${r[0]}</span>${r.length === 2 && x.bang!.cot.length > 2 ? `<b style="grid-column:span ${x.bang!.cot.length - 1}">${r[1]}</b>` : r.slice(1).map((v) => `<b>${v}</b>`).join('')}`).join('') + '</div>' : '');

  const ray = new THREE.Raycaster(), chuot = new THREE.Vector2(); let bay: any = null;
  const datChuot = (e: PointerEvent) => { const b = r.domElement.getBoundingClientRect(); chuot.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); return b; };
  function chuDuoiChuot() {
    ray.setFromCamera(chuot, cam);
    for (const h of ray.intersectObjects(the.children.filter((o: any) => o.visible), false)) { const o = h.object.userData.chu ?? (h.object.userData.loai ? h.object : null); if (o && o.visible !== false) return o; }
    return null;
  }
  let dangSang: any = null;
  const sangLen = (o: any, on: boolean) => { for (const m of [].concat(o.material) as any[]) if (m.emissiveIntensity != null) { m.userData.goc ??= m.emissiveIntensity; m.emissiveIntensity = on ? m.userData.goc + .55 : m.userData.goc; } };
  const onMove = (e: PointerEvent) => {
    const b = datChuot(e), o = chuDuoiChuot();
    if (o !== dangSang) { if (dangSang) sangLen(dangSang, false); if (o) sangLen(o, true); dangSang = o; r.domElement.style.cursor = o ? 'pointer' : '';
      if (o && e.pointerType === 'mouse') { meo.innerHTML = veO(thongTin(o)); meo.hidden = false; } else meo.hidden = true; }
    if (!meo.hidden) { meo.style.left = `${Math.min(e.clientX - b.left + 16, W() - meo.offsetWidth - 8)}px`; meo.style.top = `${Math.min(e.clientY - b.top + 16, H() - meo.offsetHeight - 8)}px`; }
  };
  const onLeave = () => { meo.hidden = true; };
  // chạm / bấm = nhả trong 450ms, kéo dưới 10px (bộ điều hướng chặn "click" sinh từ cú chạm)
  let xuong: { x: number; y: number; t: number } | null = null;
  const onDown = (e: PointerEvent) => { xuong = { x: e.clientX, y: e.clientY, t: performance.now() }; };
  const onUp = (e: PointerEvent) => { if (!xuong) return; const keo = Math.hypot(e.clientX - xuong.x, e.clientY - xuong.y), lau = performance.now() - xuong.t; xuong = null; if (keo < 10 && lau < 450) cham(e); };
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
    if (u.loai === 'phong' || u.loai === 'cty') ds_.push(a('https://cty.on.tc', '🏢 Mở cty'));
    return ds_.length ? `<div class="nut-mo">${ds_.join('')}</div>` : '';
  }
  // TÌM + BAY TỚI: gõ tên → danh sách → chọn là camera bay tới và mở ngăn
  const chiMuc: { ten: string; nhan: string; obj: any }[] = [];
  const timIn = q<HTMLInputElement>('.tim input'), timDs = q<HTMLElement>('.tim-ds');
  const bayToiObj = (o: any) => { const p = o.position.clone().setY(0); bayToi(p.clone().add(cam.position.clone().sub(ctl.target).setLength(220)), p);
    ngan.innerHTML = `<button class="dong" aria-label="Đóng">×</button>${veO(thongTin(o))}${nutMo(o)}`; ngan.hidden = false; (ngan.querySelector('.dong') as HTMLButtonElement).onclick = () => { ngan.hidden = true; }; };
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
  function cham(e: PointerEvent) {
    datChuot(e); const chu = chuDuoiChuot(); if (!chu) return;
    meo.hidden = true; ngan.innerHTML = `<button class="dong" aria-label="Đóng">×</button>${veO(thongTin(chu))}${nutMo(chu)}`; ngan.hidden = false;
    (ngan.querySelector('.dong') as HTMLButtonElement).onclick = () => { ngan.hidden = true; };
    const dich = chu.position.clone().setY(0); bayToi(dich.clone().add(cam.position.clone().sub(ctl.target).setLength(240)), dich);
  }
  r.domElement.addEventListener('pointermove', onMove); r.domElement.addEventListener('pointerleave', onLeave); r.domElement.addEventListener('pointerdown', onDown);
  r.domElement.addEventListener('pointerup', onUp); r.domElement.addEventListener('contextmenu', onMenu);

  // ── nút điều hướng một tay
  function bayToi(camDen: any, den = ctl.target.clone()) { bay = { t: 0, tu: ctl.target.clone(), den, camTu: cam.position.clone(), camDen }; }
  const xoay = (goc: number) => bayToi(ctl.target.clone().add(cam.position.clone().sub(ctl.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), goc)));
  const phong = (k: number) => { const v = cam.position.clone().sub(ctl.target); v.setLength(Math.max(ctl.minDistance, Math.min(ctl.maxDistance, v.length() * k))); bayToi(ctl.target.clone().add(v)); };
  const NUT: Record<string, () => void> = { trai: () => xoay(Math.PI / 6), phai: () => xoay(-Math.PI / 6), vao: () => phong(.7), ra: () => phong(1.4), goc: () => bayToi(CAM0.clone(), TAM0.clone()),
    full: () => toanMan(), ngay: () => { cheDo = cheDo === 'tu' ? 'ngay' : cheDo === 'ngay' ? 'dem' : 'tu'; apNgayDem(); } };
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
  const huong = new THREE.Vector3(), huong2 = new THREE.Vector3(), oA = new THREE.Object3D(); let dem = 0, raf = 0;
  function vong() {
    raf = requestAnimationFrame(vong); dem++;
    if (bay) { bay.t = Math.min(1, bay.t + .04); const e = 1 - Math.pow(1 - bay.t, 3); ctl.target.lerpVectors(bay.tu, bay.den, e); cam.position.lerpVectors(bay.camTu, bay.camDen, e); if (bay.t >= 1) { bay = null; luuCam(); } }
    for (const ng of ds.onl!) { if (!ng.visible) continue; const u = ng.userData; u.t = (u.t + u.toc) % 1; ng.position.lerpVectors(u.a, u.b, u.t); ng.position.y = 1.3 + Math.abs(Math.sin(dem / 5 + u.t * 20)) * .3; ng.material.opacity = 1; }
    for (const lop of [ds.ngam!, ds.dien!, ds.xu!]) for (const n of lop) { if (!n.visible || !n.userData.nhip) continue; const u = n.userData; u.t = (u.t + u.toc) % 1; u.duong.getPointAt(u.t, n.position); n.position.y = .6; }
    for (const xe of ds.xu!) { if (!xe.visible || !xe.userData.duong || xe.userData.nhip) continue; const u = xe.userData; u.t = (u.t + u.toc) % 1; u.duong.getPointAt(u.t, xe.position); u.duong.getTangentAt(u.t, huong); xe.rotation.y = Math.atan2(-huong.z, huong.x); xe.position.y = 2.6; }
    for (const xe of ds.xe!) { if (!xe.visible) continue; const u = xe.userData; u.t = (u.t + u.toc) % 1; u.duong.getPointAt(u.t, xe.position); u.duong.getTangentAt(u.t, huong); xe.rotation.y = Math.atan2(-huong.z, huong.x); xe.position.y = 2.4; }
    if (amb.xe) { for (let i = 0; i < amb.xeD.length; i++) { const u = amb.xeD[i]!; u.t = (u.t + u.toc) % 1; u.duong.getPointAt(u.t, huong2); u.duong.getTangentAt(u.t, huong); oA.position.copy(huong2); oA.rotation.set(0, Math.atan2(-huong.z, huong.x), 0); oA.scale.set(1, 1, 1); oA.updateMatrix(); amb.xe.setMatrixAt(i, oA.matrix); } amb.xe.instanceMatrix.needsUpdate = true; }
    if (amb.nguoi) { for (let i = 0; i < amb.nguoiD.length; i++) { const u = amb.nguoiD[i]!; u.t = (u.t + u.toc) % 2; const p = u.t < 1 ? u.t : 2 - u.t; oA.position.lerpVectors(u.a, u.b, p); oA.position.y = 1.1 + Math.abs(Math.sin(dem / 6 + i)) * .25; oA.rotation.set(0, 0, 0); oA.scale.set(1, 1, 1); oA.updateMatrix(); amb.nguoi.setMatrixAt(i, oA.matrix); } amb.nguoi.instanceMatrix.needsUpdate = true; }
    if (dem % 1800 === 0) apNgayDem();
    if (dem % 15 === 0) veMini();
    for (const d of ds.hong!) d.material.color.setHex(Math.floor(dem / 30) % 2 ? 0xff3b4e : 0x5a1018);
    for (const sp of ds.khoi!) { if (!sp.visible) continue; const u = sp.userData; u.pha = (u.pha + u.toc) % 1; const p = u.pha;
      sp.position.set(u.goc.x + Math.sin(u.lech + p * 3) * (2 + p * 9) + p * 10, u.goc.y + p * 55, u.goc.z + Math.cos(u.lech + p * 3) * (2 + p * 6));
      sp.scale.setScalar(5 + p * 22); sp.material.opacity = Math.min(1, p * 12) * (1 - p) * .95; }
    for (const c of ds.cot!) c.material.opacity = .32 + Math.sin(dem / 25) * .1;
    ctl.update(); r.render(scene, cam);
  }
  const ro = new ResizeObserver(() => { if (!W() || !H()) return; cam.aspect = W() / H(); cam.updateProjectionMatrix(); r.setSize(W(), H()); });
  ro.observe(host);
  dung(); vong();
  const capNhat = (moi: PhoMoHinh) => { mh = moi; dung(); };
  const don = () => {
    cancelAnimationFrame(raf); ro.disconnect(); ctl.dispose(); document.removeEventListener('fullscreenchange', onFs); document.documentElement.style.overflow = '';
    r.domElement.removeEventListener('pointermove', onMove); r.domElement.removeEventListener('pointerleave', onLeave); r.domElement.removeEventListener('pointerdown', onDown);
    r.domElement.removeEventListener('pointerup', onUp); r.domElement.removeEventListener('contextmenu', onMenu);
    scene.traverse((o: any) => { o.geometry?.dispose?.(); for (const m of [].concat(o.material ?? []) as any[]) m.dispose?.(); });
    for (const t of Object.values(tex)) t.dispose?.(); r.dispose(); host.innerHTML = ''; host.classList.remove('tp');
  };
  return { don, capNhat };
}
