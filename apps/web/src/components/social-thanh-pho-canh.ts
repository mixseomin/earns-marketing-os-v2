'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// CẢNH THÀNH PHỐ SOCIAL — vẽ PhoMoHinh (lib/social-thanh-pho.ts) bằng three.js r128 (bản global + MapControls nạp từ CDN, cùng bản đã duyệt ở demo
// artifact 22/10/2026). Thành phố đêm low-poly học CodeCity / GitHub Skyline: cụm = quảng trường + toà trung tâm, toà vệ tinh quanh đó.
// Cửa sổ sáng = bài đang chạy · thùng tím ở chân = bài sắp đăng · cột sáng xanh = lượt xem · xe trên phố = khách về site · đèn đỏ + khói = hỏng ·
// toà mờ = dừng. Chữ trong cảnh chỉ có tên dọc thân toà trung tâm / toà đích; favicon site trên nóc.
// Điều hướng kiểu bản đồ: kéo một ngón / chuột trái = trượt · hai ngón / chuột phải = xoay · chụm / lăn = phóng · nút ⟲ ⟳ ＋ － ⌂ cho một tay.
import type { PhoMoHinh, PhoNen, PhoTk } from '@/lib/social-thanh-pho';
type Nen = PhoNen | 'tim';

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

const P: Record<PhoNen | 'tim', string> = {
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
const NEN: Record<PhoNen | 'tim', [string, string]> = { tim: ['#3a4f7a', 'Tìm kiếm'], yt: ['#ff2a4d', 'YouTube'], tt: ['#1b1b22', 'TikTok'], fb: ['#2f7cf6', 'Facebook'], ig: ['#e1306c', 'Instagram'], x: ['#20232b', 'X'], pin: ['#e60023', 'Pinterest'], dm: ['#1f47c4', 'Dailymotion'], th: ['#101010', 'Threads'], qu: ['#b92b27', 'Quora'] };
const svgLogo = (k: PhoNen | 'tim', c?: number) => `<svg viewBox="0 0 24 24" fill="#fff"${c ? ` width="${c}" height="${c}"` : ''}>${P[k]}</svg>`;
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
.tp .ngan { position: absolute; right: 12px; top: 12px; width: 220px; z-index: 6; background: color-mix(in srgb, var(--nen2) 95%, transparent); border: 1px solid var(--vien); border-radius: 12px; padding: 10px; max-height: calc(100% - 140px); overflow: auto; }
.tp .ngan .dong { position: absolute; top: 6px; right: 8px; background: none; border: 0; color: var(--chu2); font-size: 16px; cursor: pointer; }
.tp .meo { position: absolute; z-index: 7; pointer-events: none; min-width: 190px; max-width: 280px; background: color-mix(in srgb, var(--nen2) 96%, transparent); border: 1px solid var(--vien); border-radius: 10px; padding: 8px 10px; box-shadow: 0 8px 24px #0008; }
.tp .dau { display: flex; align-items: center; gap: 8px; font-weight: 700; margin-bottom: 6px; padding-right: 14px; }
.tp .h { display: flex; justify-content: space-between; padding: 3px 0; color: var(--chu2); gap: 12px; } .tp .h b { color: var(--chu); font: 700 12px ui-monospace, monospace; text-align: right; }
.tp .dieu { position: absolute; right: 12px; bottom: 12px; z-index: 5; display: grid; grid-template-columns: repeat(2, 40px); gap: 6px; }
.tp .dieu button { width: 40px; height: 40px; border-radius: 10px; border: 1px solid var(--vien); background: color-mix(in srgb, var(--nen2) 92%, transparent); color: var(--chu); font: 600 18px system-ui; cursor: pointer; }
.tp .dieu .rong { grid-column: span 2; width: auto; }
.tp .nho { color: var(--chu2); font-size: 10px; }
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
      <b>Gom cụm</b><div class="seg" role="group" aria-label="Gom cụm"><button data-gom="sp" aria-pressed="true">Sản phẩm</button><button data-gom="nen" aria-pressed="false">Nền</button></div>
      <b>Lớp</b><div class="hang" data-o="lop"></div>
      <b>Lọc</b><div class="hang" data-o="loc-sp"></div><div class="hang" data-o="loc-nen"></div>
      <button class="lop" data-o="an-trong" aria-pressed="true" title="Ẩn cụm chưa có bài, chưa có lịch">🫥 ẩn cụm trống</button></aside>
    <aside class="ngan" hidden></aside>
    <div class="dieu" role="group" aria-label="Điều hướng">
      <button data-d="trai" aria-label="Xoay trái" title="Xoay trái">⟲</button><button data-d="phai" aria-label="Xoay phải" title="Xoay phải">⟳</button>
      <button data-d="vao" aria-label="Phóng to" title="Phóng to">＋</button><button data-d="ra" aria-label="Thu nhỏ" title="Thu nhỏ">－</button>
      <button data-d="goc" aria-label="Về toàn cảnh" title="Về toàn cảnh">⌂</button><button data-d="full" aria-label="Toàn màn hình" title="Toàn màn hình">⛶</button><button data-d="ngay" class="rong" aria-label="Ngày / đêm">🌙</button></div>
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
  const cumCua = (k: string) => mh.cum.find((c) => c.khoa === k)!;
  const texNen = (k: Nen) => texIc(`n:${k}`, NEN[k][0], P[k]);
  const texCum = (k: string) => { if (k === 'tim') return texNen('tim'); const c = cumCua(k); return c.site ? texFav(c.site, c.mau) : texIc(`c:${k}`, c.mau, c.ten[0]!.toUpperCase()); };

  // ── toà tài khoản
  // máy tìm kiếm: màu hãng + favicon trên nóc; tài khoản mạng xã hội: màu + logo nền tảng
  const mauTk = (tk: PhoTk) => tk.mau ?? NEN[tk.nen][0];
  const maiTk = (tk: PhoTk) => (tk.loai === 'tim' && tk.host ? texFav(tk.host, tk.mau) : texNen(tk.nen));
  const CUA_SANG = new THREE.Color('#ffd27a'), CUA_TOI = new THREE.Color('#1c2440');
  const cuaGeo = new THREE.PlaneGeometry(3.2, 2.6), cuaMat = new THREE.MeshBasicMaterial();
  const ds: Record<string, any[]> = { nha: [], cua: [], thung: [], cot: [], xe: [], xu: [], hong: [], khoi: [] };
  const texKhoi = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!, gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  function khoi(x: number, y: number, z: number, tk: PhoTk, chu: any) {
    for (let k = 0; k < 22; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texKhoi, color: k % 3 ? '#5b5f6e' : '#8a8f9e', transparent: true, depthWrite: false, opacity: 0 }));
      sp.userData = { tk, chu, goc: new THREE.Vector3(x, y, z), pha: k / 22, toc: .0035 + Math.random() * .002, lech: Math.random() * 6.28 }; the.add(sp); ds.khoi!.push(sp); }
  }
  function toaNha(x: number, z: number, tk: PhoTk, mai: any) {
    const w = 16 + 3.2 * Math.log2(1 + (tk.xem ?? 0) / 40 + tk.phien);   // to theo lượt xem + khách đẩy về site
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
    return { m, cua: new THREE.Vector3(x, 1.5, z) };
  }

  // ── dựng theo chế độ gom
  let gom: 'sp' | 'nen' = 'sp', anTrong = true;
  const chonSp = new Set<string>(), chonNen = new Set<Nen>(), bat = new Set(['cua', 'thung', 'cot', 'xe', 'xu']);
  const khop = (tk: PhoTk) => (!chonSp.size || chonSp.has(tk.cum)) && (!chonNen.size || chonNen.has(tk.nen));
  const cumHien = () => mh.cum.filter((c) => !anTrong || !c.trong);
  // ── KHU ĐÔ THỊ NỀN (anh 22/10/2026 "thêm khu đô thị xung quanh cho sinh động, dòng xe, dòng người"): nhà thấp, phố lưới, xe và người qua lại —
  //    chỉ để cảnh sống động, KHÔNG mang số nào và không bấm được (nằm ngoài nhóm 'the' nên tia chuột không chạm)
  let nen = new THREE.Group(); scene.add(nen);
  const amb: { xe: any; nguoi: any; xeD: { duong: any; t: number; toc: number }[]; nguoiD: { a: any; b: any; t: number; toc: number }[]; cuaSo: any[]; than: any } = { xe: null, nguoi: null, xeD: [], nguoiD: [], cuaSo: [], than: null };
  let rand = 1; const ngau = () => { rand = (rand * 16807) % 2147483647; return rand / 2147483647; };   // ngẫu nhiên cố định: cùng số liệu → cùng thành phố
  function khuNen(x0: number, x1: number, zTrong: number) {
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
    dat.scale.set((xb - xa + 400) / 2000, (2 * zN + 400) / 1200, 1); dat.position.x = (xa + xb) / 2;
    Object.assign(trang.shadow.camera, { left: xa - (xa + xb) / 2, right: xb - (xa + xb) / 2, top: zN + 60, bottom: -zN - 60 }); trang.shadow.camera.updateProjectionMatrix();
    return { xa, xb, zN };
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
    const hien = new Set(cumHien().map((c) => c.khoa)), tks = mh.tk.filter((t) => hien.has(t.cum));
    const cum = gom === 'sp' ? cumHien().map((c) => ({ khoa: c.khoa, ten: c.ten, mau: c.mau, mai: texCum(c.khoa), tks: tks.filter((t) => t.cum === c.khoa) }))
      : (Object.keys(NEN) as Nen[]).map((k) => ({ khoa: k, ten: NEN[k][1], mau: NEN[k][0], mai: texNen(k), tks: tks.filter((t) => t.nen === k) })).filter((c) => c.tks.length);
    const dichs = mh.dich.filter((d) => d.cum.some((c) => hien.has(c)) || (d.phien30 ?? 0) > 0);
    const cumS = mh.cumSite.map((c) => ({ ...c, ds: dichs.filter((d) => d.cumSite === c.khoa) })).filter((c) => c.ds.length);
    // BỐ CỤC: NGUỒN (cụm social + Tìm kiếm) bên trái, ĐÍCH (cụm site theo dự án) bên phải; mỗi bên xếp vào hai dãy hai phía đại lộ, dãy nào ngắn nhận cụm kế
    type O = { r: number; cx: number; cz: number; phia: number };
    const xep = (os: O[], x0: number, sau: (o: O) => number) => { const day: [number, number] = [x0, x0]; for (const o of os) { const h = day[0] <= day[1] ? 0 : 1; o.phia = h ? 1 : -1; o.cx = day[h] + o.r; o.cz = o.phia * sau(o); day[h] += 2 * o.r + 36; } return Math.max(...day); };
    const oN: O[] = cum.map((c) => ({ r: 70 + c.tks.length * 4 + 24, cx: 0, cz: 0, phia: 1 }));
    const banS = (n: number) => Math.max(58, (n * 46) / (2 * Math.PI));
    const oD: O[] = cumS.map((c) => ({ r: banS(c.ds.length) + 26, cx: 0, cz: 0, phia: 1 }));
    const xN = xep(oN, 0, () => 150), xD = xep(oD, xN + 120, (o) => o.r + 40), lech = -xD / 2;
    for (const o of [...oN, ...oD]) o.cx += lech;
    const zTrong = Math.max(240, ...oN.map((o) => Math.abs(o.cz) + o.r), ...oD.map((o) => Math.abs(o.cz) + o.r));
    pho(lech - 40, 0, xD + lech + 40, 0, 20);
    // quảng trường + toà trung tâm (dùng chung cho cụm nguồn và cụm site)
    const quangTruong = (cx: number, cz: number, phia: number, ten: string, mau: string, mai: any, luu: number, cao: number, userData: any) => {
      pho(cx, 0, cx, cz - phia * 26, 12);
      const qt = add(new THREE.CylinderGeometry(26, 26, .8, 40), GACH, false); qt.position.set(cx, .4, cz);
      const vien = add(new THREE.TorusGeometry(26, .7, 6, 48), M({ color: '#3a4570' }), false); vien.rotation.x = Math.PI / 2; vien.position.set(cx, .8, cz);
      const rTT = 7 + 2.6 * Math.log2(1 + luu), hTT = 28 + 6 * Math.log2(1 + cao);   // to theo lưu lượng cả cụm, cao theo bài / phiên
      const tt = add(new THREE.CylinderGeometry(rTT * .75, rTT, hTT, 8), [M({ color: new THREE.Color(mau).lerp(new THREE.Color('#ffffff'), .1), roughness: .5 }), M({ map: mai, emissive: '#fff', emissiveMap: mai, emissiveIntensity: .5 }), M({ color: mau })]);
      tt.position.set(cx, hTT / 2 + .8, cz); tt.userData = userData; qt.userData = { chu: tt }; vien.userData = { chu: tt };
      chuDoc(ten, mau, cx, cz, rTT, rTT * .75, hTT, tt, .8);
      return tt;
    };
    cum.forEach((c, i) => {
      const { cx, cz, phia } = oN[i]!;
      quangTruong(cx, cz, phia, c.ten, c.mau, c.mai, c.tks.reduce((a, t) => a + t.phien, 0), c.tks.reduce((a, t) => a + t.chay, 0), { loai: 'tt', khoa: c.khoa, ten: c.ten });
      const ban = 70 + c.tks.length * 4;
      c.tks.forEach((tk, k) => {
        const goc = (phia < 0 ? -Math.PI / 2 : Math.PI / 2) + (k - (c.tks.length - 1) / 2) * Math.min(.9, 4.4 / Math.max(1, c.tks.length));
        const x = cx + Math.cos(goc) * ban, z = cz + Math.sin(goc) * ban * .9;
        pho(x, z, cx + Math.cos(goc) * 26, cz + Math.sin(goc) * 26 * .9, 9);
        const t = toaNha(x, z, tk, gom === 'sp' ? maiTk(tk) : tk.loai === 'tim' ? maiTk(tk) : texCum(tk.cum));
        viTri[`tk:${tk.id}`] = { m: t.m, cua: t.cua, qt: new THREE.Vector3(cx, 1.5, cz), cx, phia };
      });
    });
    cumS.forEach((c, i) => {
      const { cx, cz, phia } = oD[i]!, ban = banS(c.ds.length);
      const mai = c.site ? texFav(c.site, c.mau) : texIc(`cs:${c.khoa}`, c.mau, '?');
      quangTruong(cx, cz, phia, c.ten, c.mau, mai, c.ds.reduce((a, d) => a + (d.phien30 ?? 0), 0) / 10, c.ds.length * 6, { loai: 'ts', khoa: c.khoa, ten: c.ten });
      c.ds.forEach((d, k) => {
        // vòng tròn quanh quảng trường, chừa khe phía đại lộ cho phố vào
        const goc = (phia < 0 ? Math.PI / 2 : -Math.PI / 2) + .5 + (k / Math.max(1, c.ds.length)) * (2 * Math.PI - 1), x = cx + Math.cos(goc) * ban, z = cz + Math.sin(goc) * ban;
        pho(x, z, cx + Math.cos(goc) * 26, cz + Math.sin(goc) * 26, 7);
        let m: any;
        if (d.laShop) {   // cửa hàng: khối hộp + đồng xu = đơn 30 ngày
          m = add(new THREE.BoxGeometry(30, 18, 24), M({ color: '#d77fc4', emissive: '#ff90e8', emissiveIntensity: .18 })); m.position.set(x, 9, z);
          const fv = add(new THREE.CircleGeometry(8, 40), new THREE.MeshBasicMaterial({ map: texFav(d.site) }), false); fv.rotation.x = -Math.PI / 2; fv.position.set(x, 18.15, z); fv.userData = { chu: m };
          for (const [dx, dz, g] of [[0, 12.1, 0], [15.1, 0, Math.PI / 2], [0, -12.1, Math.PI], [-15.1, 0, -Math.PI / 2]] as const) { const p = add(new THREE.PlaneGeometry(2.4, 16), new THREE.MeshBasicMaterial({ map: texDoc(d.site.split('.').slice(-2).join('.'), '#ff90e8'), transparent: true, depthWrite: false }), false); p.position.set(x + dx, 9, z + dz); p.rotation.y = g; p.userData = { chu: m }; }
          for (let j = 0; j < Math.min(20, d.don ?? 0); j++) { const xu = add(new THREE.CylinderGeometry(4.5, 4.5, 1.6, 24), M({ color: '#ffd166', emissive: '#ffd166', emissiveIntensity: .7, metalness: .5 })); xu.position.set(x + 8, 20 + j * 2, z); xu.userData = { chu: m }; ds.xu!.push(xu); }
        } else {
          // toà xanh sáng = site có nguồn (social / tìm kiếm); toà xám tối, không quầng = site chưa gắn nguồn traffic nào
          const phien = d.phien30 ?? 0, h = 12 + 9 * Math.log2(1 + phien), rT = Math.min(16, 5 + 2.4 * Math.log2(1 + phien));
          m = add(new THREE.CylinderGeometry(rT * .8, rT, h, 8), d.coNguon ? M({ color: '#2a9c7a', emissive: '#1f8f6c', emissiveIntensity: .25, roughness: .4 }) : M({ color: '#3a4058', emissive: '#000000', emissiveIntensity: 0, roughness: .8 })); m.position.set(x, h / 2, z);
          if (d.coNguon) { const sang = add(new THREE.CylinderGeometry(rT * .8 + .2, rT + .2, h * .7, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#5effc4', wireframe: true, transparent: true, opacity: .18 }), false); sang.position.set(x, h * .35 + 2, z); sang.userData = { chu: m }; }
          chuDoc(d.site, d.coNguon ? '#5effc4' : '#8e9abd', x, z, rT, rT * .8, h, m);
          const fv = add(new THREE.CircleGeometry(rT * .62, 40), new THREE.MeshBasicMaterial({ map: texFav(d.site) }), false); fv.rotation.x = -Math.PI / 2; fv.position.set(x, h + .15, z); fv.userData = { chu: m };
        }
        m.userData = { loai: 'dich', d };
        viTri[`d:${d.site}`] = { cua: new THREE.Vector3(x, 1.5, z), qt: new THREE.Vector3(cx, 1.5, cz), cx, phia };
      });
    });
    // xe: toà nguồn → quảng trường nguồn → đại lộ → quảng trường cụm site → toà site; số xe theo lượt khách (một dòng mỗi cặp nguồn × site)
    for (const l of mh.luong) {
      const tk = tks.find((t) => t.id === l.tu), a = viTri[`tk:${l.tu}`], b = viTri[`d:${l.den}`]; if (!tk || !a || !b || !l.so) continue; const lan = a.phia * 4.5;
      const pts = [a.cua, a.qt, new THREE.Vector3(a.cx, 1.5, lan), new THREE.Vector3(b.cx, 1.5, lan), b.qt, b.cua];
      const duong = new THREE.CurvePath(); for (let i = 0; i < pts.length - 1; i++) duong.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
      const mau = mauTk(tk), soXe = Math.min(14, 1 + Math.round(Math.log2(l.so + 1) * 1.6));
      for (let k = 0; k < soXe; k++) { const xe = add(new THREE.BoxGeometry(4.4, 2.2, 2.6), M({ color: ['#20232b', '#1b1b22', '#101010'].includes(mau) ? '#dfe4f2' : mau, emissive: mau, emissiveIntensity: .6 })); xe.userData = { duong, t: k / soXe, toc: .0009 + Math.log10(l.so + 1) * .00035, tk, chu: a.m }; ds.xe!.push(xe); }
    }
    const k = khuNen(lech - 40, xD + lech + 40, zTrong);
    gioiHan = { x0: k.xa, x1: k.xb, z: k.zN };
    const rong = k.xb - k.xa;
    if (doc) { CAM0.set(-rong * .62, rong * .7, 0); TAM0.set(0, 0, 0); scene.fog.near = rong * .9; scene.fog.far = rong * 2.2; ctl.maxDistance = rong * 1.6; }
    else { CAM0.set(0, rong * .42, rong * .5); TAM0.set(0, 0, 10); scene.fog.near = rong * .7; scene.fog.far = rong * 1.8; ctl.maxDistance = rong * 1.1; }
    cam.far = rong * 3; cam.updateProjectionMatrix();
    if (!daDatCam) { cam.position.copy(CAM0); ctl.target.copy(TAM0); daDatCam = true; }
    apNgayDem(); apLop();
  }

  // ── bảng điều khiển
  const LOP: Record<string, [string, string]> = { cua: ['🪟', 'Bài đang chạy'], thung: ['📦', 'Bài sắp đăng'], cot: ['🔦', 'Lượt xem'], xe: ['🚗', 'Khách về site'], xu: ['🪙', 'Đơn'] };
  for (const [k, [ic, ten]] of Object.entries(LOP)) { const b = document.createElement('button'); b.className = 'lop'; b.title = ten; b.textContent = ic; b.setAttribute('aria-pressed', 'true'); b.setAttribute('aria-label', ten);
    b.onclick = () => { if (bat.has(k)) bat.delete(k); else bat.add(k); b.setAttribute('aria-pressed', String(bat.has(k))); apLop(); }; q('[data-o="lop"]').appendChild(b); }
  const chip = (o: string, set: Set<any>, id: string, mau: string, ic: string, ten: string) => { const b = document.createElement('button'); b.className = 'chip'; b.title = ten; b.setAttribute('aria-label', ten); b.style.background = mau; b.innerHTML = ic; b.setAttribute('aria-pressed', 'false');
    b.onclick = () => { if (set.has(id)) set.delete(id); else set.add(id); b.setAttribute('aria-pressed', String(set.has(id))); apLop(); }; q(`[data-o="${o}"]`).appendChild(b); return b; };
  const chipSp = mh.cum.map((c) => ({ c, b: chip('loc-sp', chonSp, c.khoa, c.mau, c.khoa === 'tim' ? svgLogo('tim') : c.site && mh.fav[c.site] ? `<img src="${mh.fav[c.site]}" alt="">` : esc(c.ten[0]!.toUpperCase()), c.ten) }));
  for (const k of [...new Set(mh.tk.map((t) => t.nen))]) chip('loc-nen', chonNen, k, NEN[k][0], svgLogo(k), NEN[k][1]);
  const anTrongBtn = q<HTMLButtonElement>('[data-o="an-trong"]');
  const hienChipSp = () => { for (const { c, b } of chipSp) b.hidden = anTrong && c.trong; };
  anTrongBtn.onclick = () => { anTrong = !anTrong; anTrongBtn.setAttribute('aria-pressed', String(anTrong)); hienChipSp(); dung(); };
  hienChipSp();
  function apLop() {
    for (const m of ds.nha!) m.visible = khop(m.userData.tk);
    for (const k of ['cua', 'thung', 'cot', 'xe']) for (const m of ds[k]!) m.visible = bat.has(k) && khop(m.userData.tk);
    for (const m of [...ds.hong!, ...ds.khoi!]) m.visible = khop(m.userData.tk);
    for (const m of ds.xu!) m.visible = bat.has('xu');
  }
  for (const b of host.querySelectorAll<HTMLButtonElement>('[data-gom]')) b.onclick = () => { gom = b.dataset.gom as 'sp' | 'nen'; for (const x of host.querySelectorAll('[data-gom]')) x.setAttribute('aria-pressed', String(x === b)); dung(); };
  const datThu = (gon: boolean) => { ben.classList.toggle('gon', gon); thuBtn.textContent = gon ? '☰' : '‹'; thuBtn.setAttribute('aria-expanded', String(!gon)); thuBtn.setAttribute('aria-label', gon ? 'Mở bảng' : 'Thu nhỏ bảng'); try { localStorage.setItem('tp-ben-gon', gon ? '1' : '0'); } catch { /* chế độ riêng tư */ } };
  let gonDau = W() < 600; try { const v = localStorage.getItem('tp-ben-gon'); if (v != null) gonDau = v === '1'; } catch { /* chế độ riêng tư */ }
  datThu(gonDau); thuBtn.onclick = () => datThu(!ben.classList.contains('gon'));

  // ── thông tin thực thể: hover (ô nổi) và chạm (ngăn bên) dùng chung
  const oNen = (k: Nen, c = 14) => `<span style="display:inline-grid;place-items:center;width:${c + 8}px;height:${c + 8}px;border-radius:50%;background:${NEN[k][0]};vertical-align:middle;flex:none">${svgLogo(k, c)}</span>`;
  const oTk = (t: PhoTk, c = 14) => (t.loai === 'tim' && t.host ? oFav(t.host, c + 4) : oNen(t.nen, c));
  const oFav = (site: string, c = 18) => (mh.fav[site] ? `<img src="${mh.fav[site]}" width="${c}" height="${c}" style="vertical-align:middle;border-radius:4px;background:#fff;flex:none" alt="">` : '🌐');
  const cong = (xs: PhoTk[], f: (t: PhoTk) => number) => xs.reduce((a, t) => a + f(t), 0);
  const cong2 = (ls: { so: number }[]) => ls.reduce((a, l) => a + l.so, 0);
  function thongTin(chu: any): { dau: string; h: [string, string | number][] } {
    const u = chu.userData;
    if (u.loai === 'tk' && u.tk.loai === 'tim') { const t = u.tk as PhoTk, ve = mh.luong.filter((l) => l.tu === t.id).sort((a, b) => b.so - a.so);
      return { dau: `${oTk(t)} ${esc(t.ten)}`, h: [['Nguồn', 'Tìm kiếm tự nhiên'], ['🚗 Khách về site (30 ngày)', t.phien], ['Số site nhận khách', ve.length],
        ...ve.slice(0, 8).map((l) => [`↳ ${esc(l.den)}`, l.so] as [string, number]), ...(ve.length > 8 ? [[`… ${ve.length - 8} site khác`, ''] as [string, string]] : [])] };
    }
    if (u.loai === 'tk') { const t = u.tk as PhoTk;
      return { dau: `${oNen(t.nen)} ${esc(t.ten)}`, h: [['Nền', NEN[t.nen][1]], ['Sản phẩm', esc(cumCua(t.cum).ten)], ['🪟 Bài đã đăng', t.chay], ['📦 Sắp đăng 7 ngày', t.sap], ['🔦 Lượt xem', so(t.xem)],
        [`🚗 Khách về site (${t.phienKy})`, t.phien], ...(t.dich ? [['🌐 Site đích', esc(t.dich)] as [string, string]] : []), ['Trạng thái', t.dung ? '⏸ dừng' : t.hong ? `🔴 ${esc(t.hong)}` : '🟢 chạy']] };
    }
    if (u.loai === 'tt') { const tks = mh.tk.filter((t) => (gom === 'sp' ? t.cum : t.nen) === u.khoa && cumHien().some((c) => c.khoa === t.cum)), xem = tks.filter((t) => t.xem != null);
      const site = gom === 'sp' ? cumCua(u.khoa).site : null;
      return { dau: gom === 'sp' ? `${site ? oFav(site) : ''} ${esc(u.ten)}` : `${oNen(u.khoa)} ${esc(u.ten)}`, h: [
        ['Tài khoản', `${tks.length} ${gom === 'sp' ? [...new Set(tks.map((t) => t.nen))].map((k) => oNen(k, 10)).join('') : ''}`], ['🪟 Bài đã đăng', cong(tks, (t) => t.chay)], ['📦 Sắp đăng 7 ngày', cong(tks, (t) => t.sap)],
        ['🔦 Lượt xem', xem.length ? so(cong(xem, (t) => t.xem!)) : 'chưa đo'], ['🚗 Khách về site', cong(tks, (t) => t.phien)], ['🔴 Đang hỏng', tks.filter((t) => t.hong).length], ['⏸ Dừng', tks.filter((t) => t.dung).length],
        ...(site ? [['🌐 Site đích', esc(site)] as [string, string]] : [])] };
    }
    if (u.loai === 'ts') { const ds_ = mh.dich.filter((d) => d.cumSite === u.khoa).sort((a, b) => (b.phien30 ?? -1) - (a.phien30 ?? -1)), ve = mh.luong.filter((l) => ds_.some((d) => d.site === l.den));
      const tuTim = cong2(ve.filter((l) => l.tu.startsWith('tim:'))), tuMxh = cong2(ve.filter((l) => !l.tu.startsWith('tim:')));
      return { dau: `${ds_[0] ? oFav(ds_[0].site) : ''} ${esc(u.ten)}`, h: [['Site', ds_.length], ['Phiên 30 ngày (mọi nguồn)', so(ds_.reduce((a, d) => a + (d.phien30 ?? 0), 0))],
        ['🔍 Từ tìm kiếm (30 ngày)', tuTim], ['📱 Từ social', tuMxh], ['⚪ Site chưa gắn nguồn', ds_.filter((d) => !d.coNguon).length],
        ...ds_.slice(0, 10).map((d) => [`${d.coNguon ? '🟢' : '⚪'} ${esc(d.site)}`, d.laShop ? `${so(d.don)} đơn` : so(d.phien30)] as [string, string]), ...(ds_.length > 10 ? [[`… ${ds_.length - 10} site khác`, ''] as [string, string]] : [])] };
    }
    if (u.loai === 'dich') { const d = u.d as typeof mh.dich[number], ve = mh.luong.filter((l) => l.den === d.site).sort((a, b) => b.so - a.so);
      const tkCua = (id: string) => mh.tk.find((t) => t.id === id);
      return { dau: `${oFav(d.site)} ${esc(d.site)}`, h: [['Sản phẩm', esc(d.cum.map((c) => cumCua(c).ten).join(' · ') || '—')],
        ...(d.laShop ? [['🪙 Đơn 30 ngày', so(d.don)] as [string, string]] : [['Phiên 30 ngày (mọi nguồn)', so(d.phien30)] as [string, string]]),
        ['Nguồn', d.coNguon ? `${ve.length} nguồn` : '⚪ chưa gắn nguồn traffic'],
        ...ve.slice(0, 10).map((l) => { const t = tkCua(l.tu); return [t ? `${oTk(t, 10)} ${esc(t.ten)}` : esc(l.tu), l.so] as [string, number]; })] };
    }
    return { dau: '', h: [] };
  }
  const veO = (x: { dau: string; h: [string, string | number][] }) => `<div class="dau">${x.dau}</div>` + x.h.map(([k, v]) => `<div class="h"><span>${k}</span><b>${v}</b></div>`).join('');

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
  function cham(e: PointerEvent) {
    datChuot(e); const chu = chuDuoiChuot(); if (!chu) return;
    meo.hidden = true; ngan.innerHTML = `<button class="dong" aria-label="Đóng">×</button>${veO(thongTin(chu))}`; ngan.hidden = false;
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
  const toanMan = () => {
    if (document.fullscreenElement) { void document.exitFullscreen(); return; }
    if (host.classList.contains('tp-full')) { host.classList.remove('tp-full'); document.documentElement.style.overflow = ''; datNutFull(false); return; }
    if (host.requestFullscreen && document.fullscreenEnabled) { void host.requestFullscreen(); return; }
    host.classList.add('tp-full'); document.documentElement.style.overflow = 'hidden'; datNutFull(true);
  };
  const onFs = () => datNutFull(document.fullscreenElement === host);
  document.addEventListener('fullscreenchange', onFs);
  for (const b of host.querySelectorAll<HTMLButtonElement>('[data-d]')) b.onclick = () => NUT[b.dataset.d!]!();

  // ── vòng vẽ
  const huong = new THREE.Vector3(), huong2 = new THREE.Vector3(), oA = new THREE.Object3D(); let dem = 0, raf = 0;
  function vong() {
    raf = requestAnimationFrame(vong); dem++;
    if (bay) { bay.t = Math.min(1, bay.t + .04); const e = 1 - Math.pow(1 - bay.t, 3); ctl.target.lerpVectors(bay.tu, bay.den, e); cam.position.lerpVectors(bay.camTu, bay.camDen, e); if (bay.t >= 1) bay = null; }
    for (const xe of ds.xe!) { if (!xe.visible) continue; const u = xe.userData; u.t = (u.t + u.toc) % 1; u.duong.getPointAt(u.t, xe.position); u.duong.getTangentAt(u.t, huong); xe.rotation.y = Math.atan2(-huong.z, huong.x); xe.position.y = 2.4; }
    if (amb.xe) { for (let i = 0; i < amb.xeD.length; i++) { const u = amb.xeD[i]!; u.t = (u.t + u.toc) % 1; u.duong.getPointAt(u.t, huong2); u.duong.getTangentAt(u.t, huong); oA.position.copy(huong2); oA.rotation.set(0, Math.atan2(-huong.z, huong.x), 0); oA.scale.set(1, 1, 1); oA.updateMatrix(); amb.xe.setMatrixAt(i, oA.matrix); } amb.xe.instanceMatrix.needsUpdate = true; }
    if (amb.nguoi) { for (let i = 0; i < amb.nguoiD.length; i++) { const u = amb.nguoiD[i]!; u.t = (u.t + u.toc) % 2; const p = u.t < 1 ? u.t : 2 - u.t; oA.position.lerpVectors(u.a, u.b, p); oA.position.y = 1.1 + Math.abs(Math.sin(dem / 6 + i)) * .25; oA.rotation.set(0, 0, 0); oA.scale.set(1, 1, 1); oA.updateMatrix(); amb.nguoi.setMatrixAt(i, oA.matrix); } amb.nguoi.instanceMatrix.needsUpdate = true; }
    if (dem % 1800 === 0) apNgayDem();
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
