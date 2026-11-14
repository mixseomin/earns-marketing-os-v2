'use client';
// TOÀ NHÀ PHIM (anh 15/11/2026: "giống kiểu hình một toà nhà. Nếu nhiều camp ROAS thắng thì sẽ cao hơn. Các camp thử nghiệm nằm ở tầng đáy,
// đến khi có lãi thì lên dần… Các hướng đi, đề xuất cũng show gọn trong đó… mô hình 3D để xoay").
// THÂN TOÀ ĐẶC, mỗi camp đang chạy = MỘT Ô CỬA SỔ SÁNG trên mặt tường (anh 15/11/2026 "nhìn giống tủ để hàng siêu thị" — bỏ kiểu khối đặt trên sàn hở): cửa in ngân sách ($30 / ★$20),
// màu theo lãi / lỗ 7 ngày; ô chưa có camp = kính tối. Tầng = chặng của camp (xepTang), mỗi sàn ≤ O_TANG cửa (3 mặt trước + 2 phải + 2 trái + 3 sau), nhiều hơn thì thêm sàn → toà cao lên.
// Móng = khối đế rộng hơn thân: camp hẹn giờ / creative chờ (xanh) · đang sản xuất (vàng SX) · kế hoạch (KH nét đứt).
// MỘT bộ dựng cho hai chỗ: dungToa (một toà) + useCanh3D (renderer · xoay · phóng · trượt · rê · bấm) — ToaNha (khung phim) và ThanhPho (widget Tổng quan) cùng gọi.
// three nạp động khi mở (không nặng trang). Điều khiển như city.on.tc: kéo = xoay · Shift + lăn = phóng · chuột phải / Shift + kéo = trượt · điện thoại 1 ngón xoay, 2 ngón chụm phóng.
import React, { useEffect, useRef, useState } from 'react';
import type { CampToa } from '@/lib/etp-toa-sql';

type T3 = typeof import('three');
export const TANG = ['Móng', 'Thử', 'Lãi', 'Scale', '★ ROAS'] as const;
const XANH = '#4ade80', DO = '#f87171', XAM = '#6b7280', TIM = '#a78bfa', VANG = '#facc15', LAM = '#60a5fa';
const COT = 3, HANG = 2, O_TANG = 2 * COT + 2 * HANG, CAO = 0.7, MONG_TOI_DA = O_TANG, RONG = COT * 1.0, SAU = HANG * 1.0;

/** tầng của camp: hẹn giờ → Móng · ★ ROAS → mái · đã lên bậc (> $1) → Scale · $1 lãi 7 ngày → Lãi · còn lại → Thử */
export function xepTang(c: CampToa) {
  const lai = c.chi7 >= 1 && c.thu7 > c.chi7;
  return c.cho ? 0 : c.roas ? 4 : c.ns > 1 ? 3 : lai ? 2 : 1;
}
export const mauCamp = (c: CampToa) => (c.cho ? LAM : c.chi7 < 1 ? XAM : c.thu7 > c.chi7 ? (c.roas ? TIM : XANH) : DO);
export const roiCamp = (c: CampToa) => (c.chi7 >= 1 ? Math.round((c.thu7 - c.chi7) / c.chi7 * 100) : null);
/** CẤP TOÀ (anh 15/11/2026 "mỗi toà nhà sẽ có hình dáng, level khác nhau nếu có nhiều camp ổn định hơn"): camp ổn định = lãi ≥ ON_DINH trong 7 ngày Ethopex đã khép.
 *  Lán thử → Nhà phố (mái ngói) → Văn phòng (mái bằng + tum) → Cao ốc (đỉnh thụt cấp) → Tháp (hai cấp đỉnh + chóp vàng). */
export const ON_DINH = 5;
export const laOnDinh = (c: CampToa) => !c.cho && c.ngay_lai >= ON_DINH;
export const CAP = ['Lán thử', 'Nhà phố', 'Văn phòng', 'Cao ốc', 'Tháp'] as const;
export const GIAI_CAP = `Lán thử: chưa camp nào lãi 7 ngày · Nhà phố: có camp lãi · Văn phòng: có camp Scale (> $1) lãi · Cao ốc: có ★ ROAS lãi hoặc ≥ 3 camp ổn định · Tháp: ★ ROAS lãi + ≥ 5 camp ổn định\nCamp ổn định = lãi ≥ ${ON_DINH} trong 7 ngày Ethopex đã khép`;
export function capToa(camp: CampToa[]) {
  const lai = (c: CampToa) => !c.cho && c.chi7 >= 1 && c.thu7 > c.chi7, od = camp.filter(laOnDinh).length;
  const roasLai = camp.some((c) => c.roas && lai(c)), scaleLai = camp.some((c) => !c.roas && c.ns > 1 && lai(c));
  const cap = roasLai && od >= 5 ? 4 : roasLai || od >= 3 ? 3 : scaleLai ? 2 : camp.some(lai) ? 1 : 0;
  return { cap, ten: CAP[cap]!, od };
}
const chuCamp = (c: CampToa) => { const r7 = roiCamp(c);
  return `#${c.id} · ${c.roas ? '★ ROAS' : c.dang} · $${c.ns}/ngày${c.cho ? ' · hẹn giờ, chưa chạy' : ` · 7 ngày chi $${c.chi7.toFixed(0)} · thu $${c.thu7.toFixed(0)}${r7 != null ? ` · ROI ${r7 > 0 ? '+' : ''}${r7}%` : ' · chưa đủ số'}`}${c.cho ? '' : ` · lãi ${c.ngay_lai}/${c.ngay_chay} ngày đã khép${laOnDinh(c) ? ' (ổn định)' : ''}`}`; };

type Khoi = { kieu: 'camp'; c: CampToa } | { kieu: 'sx' | 'ke' | 'cho'; chu: string };
export type MongToa = { sx: number; ke: number; cho: number };   // đang sản xuất · kế hoạch · creative chờ lên chưa có camp
/** vật bấm / rê được trong cảnh: m = mặt bị tia chạm · vien = vật để vẽ khung chọn · id = thứ trả về khi bấm */
type Vat = { m: import('three').Object3D; vien: import('three').Object3D; id: number | null; chu: string };

/** nhãn chữ cỡ cố định trên màn (sizeAttenuation tắt), nền tối để đọc được trên mọi mặt tường */
function nhan(T: T3, chu: string, mau: string, to = 1, theoMan = true) {
  const cv = document.createElement('canvas'), g = cv.getContext('2d')!; const fs = 44;
  g.font = `600 ${fs}px system-ui, sans-serif`; cv.width = Math.ceil(g.measureText(chu).width) + 24; cv.height = fs + 20;
  g.fillStyle = 'rgba(15,23,42,0.88)'; g.beginPath(); g.roundRect(0, 0, cv.width, cv.height, 14); g.fill();
  g.font = `600 ${fs}px system-ui, sans-serif`; g.fillStyle = mau; g.textBaseline = 'middle'; g.fillText(chu, 12, cv.height / 2);
  const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace;
  const sp = new T.Sprite(new T.SpriteMaterial({ map: tx, depthTest: !theoMan, transparent: true, sizeAttenuation: !theoMan })); sp.renderOrder = 10;
  /* theoMan: cỡ cố định trên màn (một toà) · không: cỡ theo thế giới, toà xa chữ nhỏ (thành phố — hàng chục biển không chồng thành mảng) */
  const h = theoMan ? 0.042 * to : 1.0 * to; sp.scale.set(h * cv.width / cv.height, h, 1); return sp;
}

/** DỰNG MỘT TOÀ vào nhóm g (gốc toà ở (0,0,0)). nhanTang: nhãn tầng bên trái (khung phim) · bien: biển trên cột ăng-ten. Trả chiều cao + các cửa bấm được. */
function dungToa(T: T3, g: import('three').Group, o: { camp: CampToa[]; mong: MongToa; bien: { chu: string; mau: string } | null; nhanTang: boolean; bienTheoMan?: boolean; kho: Map<string, import('three').CanvasTexture> }) {
  const theoTang: Khoi[][] = TANG.map(() => []);
  for (const c of o.camp) theoTang[xepTang(c)]!.push({ kieu: 'camp', c });
  theoTang[1]!.sort((a, b) => (a.kieu === 'camp' && b.kieu === 'camp' ? (roiCamp(b.c) ?? -999) - (roiCamp(a.c) ?? -999) : 0));
  for (let i = 0; i < o.mong.cho && theoTang[0]!.length < MONG_TOI_DA; i++) theoTang[0]!.push({ kieu: 'cho', chu: 'creative sạch chờ lên camp' });
  for (let i = 0; i < o.mong.sx && theoTang[0]!.length < MONG_TOI_DA; i++) theoTang[0]!.push({ kieu: 'sx', chu: 'đang sản xuất' });
  for (let i = 0; i < o.mong.ke && theoTang[0]!.length < MONG_TOI_DA; i++) theoTang[0]!.push({ kieu: 'ke', chu: 'kế hoạch, chưa làm' });
  const vat: Vat[] = [];
  // CỬA SỔ: kính có khung chia ô + số; cửa sáng tự phát quang nhẹ (đèn trong phòng), cửa tối = kính phản chiếu trời. Vân kính dùng chung cả cảnh (kho).
  const kinh = (mau: string | null, chu: string, net = false) => {
    const k = `${mau}|${chu}|${net}`; let tx = o.kho.get(k);
    if (!tx) {
      const cv = document.createElement('canvas'); cv.width = 160; cv.height = 112; const x = cv.getContext('2d')!;
      if (mau) { x.fillStyle = mau; x.fillRect(0, 0, 160, 112); }
      else { const gr = x.createLinearGradient(0, 0, 160, 112); gr.addColorStop(0, '#334155'); gr.addColorStop(0.55, '#0f172a'); gr.addColorStop(1, '#1e293b'); x.fillStyle = gr; x.fillRect(0, 0, 160, 112); }
      x.strokeStyle = 'rgba(15,23,42,0.55)'; x.lineWidth = 5; x.strokeRect(2.5, 2.5, 155, 107); x.beginPath(); x.moveTo(80, 0); x.lineTo(80, 112); x.stroke();   // khung + đố cửa
      if (net) { x.setLineDash([12, 8]); x.strokeStyle = '#e2e8f0'; x.lineWidth = 4; x.strokeRect(8, 8, 144, 96); x.setLineDash([]); }
      if (chu) { x.font = '800 56px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 7; x.strokeStyle = 'rgba(15,23,42,0.8)';
        x.strokeText(chu, 80, 58); x.fillStyle = '#ffffff'; x.fillText(chu, 80, 58); }
      tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace; o.kho.set(k, tx);
    }
    return new T.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: mau ? 0xffffff : 0x000000, emissiveIntensity: mau ? 0.35 : 0, roughness: mau ? 0.5 : 0.15, metalness: mau ? 0 : 0.4 });
  };
  // vị trí ô (0..O_TANG-1) quanh thân: 3 mặt trước · 2 mặt phải · 2 mặt trái · 3 mặt sau; ra = khoảng nhô của mặt tường (đế rộng hơn thân)
  const o2 = (i: number, ra: number): [number, number, number] => {
    const nx = RONG / 2 + ra + 0.012, nz = SAU / 2 + ra + 0.012;
    if (i < COT) return [-RONG / 2 + 0.5 + i, nz, 0];
    if (i < COT + HANG) return [nx, SAU / 2 - 0.5 - (i - COT), Math.PI / 2];
    if (i < COT + 2 * HANG) return [-nx, SAU / 2 - 0.5 - (i - COT - HANG), -Math.PI / 2];
    return [RONG / 2 - 0.5 - (i - COT - 2 * HANG), -nz, Math.PI];
  };
  const be = (rong: number, cao: number, sau: number, mau: number, yy: number, x = 0) => { const m = new T.Mesh(new T.BoxGeometry(rong, cao, sau), new T.MeshStandardMaterial({ color: mau, roughness: 0.85 })); m.position.set(x, yy, 0); g.add(m); return m; };
  const cap = capToa(o.camp).cap, THAN = [0x8a8f98, 0xd6c3a0, 0x9fb3c8, 0xcbd5e1, 0xeef2f6][cap]!, GO = cap === 4 ? 0xd4a017 : cap === 1 ? 0x9a6b3c : 0x94a3b8;
  let y = 0;
  theoTang.forEach((ds, t) => {
    const mong = t === 0, ra = mong ? 0.25 : 0, san = Math.max(1, Math.ceil(ds.length / O_TANG)), caoSan = ds.length ? CAO : CAO * 0.6, cao = san * caoSan;
    be(RONG + 2 * ra, cao, SAU + 2 * ra, mong ? 0x475569 : THAN, y + cao / 2);   // thân (đế xám đậm · thân bê tông sáng)
    be(RONG + 2 * ra + 0.08, 0.05, SAU + 2 * ra + 0.08, mong ? 0x334155 : GO, y + cao);   // gờ sàn giữa hai tầng
    for (let s2 = 0; s2 < san; s2++) for (let i = 0; i < O_TANG; i++) {
      const k = ds[s2 * O_TANG + i], [cx, cz, quay] = o2(i, ra), cy = y + s2 * caoSan + caoSan / 2;
      const geo = new T.PlaneGeometry(0.8, caoSan * 0.68);
      let m: import('three').Mesh;
      if (!k) m = new T.Mesh(geo, kinh(null, ''));
      else if (k.kieu === 'camp') { m = new T.Mesh(geo, kinh(mauCamp(k.c), k.c.cho ? 'hẹn' : `${k.c.roas ? '★' : ''}$${k.c.ns}`)); vat.push({ m, vien: m, id: k.c.id, chu: chuCamp(k.c) }); }
      else { m = new T.Mesh(geo, k.kieu === 'cho' ? kinh(LAM, 'chờ') : k.kieu === 'sx' ? kinh(VANG, 'SX') : kinh('#64748b', 'KH', true)); vat.push({ m, vien: m, id: null, chu: k.chu }); }
      m.position.set(cx, cy, cz); m.rotation.y = quay; g.add(m);
    }
    if (o.nhanTang) {
      const n = t ? ds.length : o.camp.filter((c) => c.cho).length + o.mong.sx + o.mong.ke + o.mong.cho, sp = nhan(T, `${TANG[t]}${n ? ` ${n}` : ''}`, t === 4 ? TIM : '#cbd5e1', 0.9);
      sp.center.set(1, 0.5); sp.position.set(-RONG / 2 - ra - 0.15, y + Math.min(cao, caoSan) / 2, SAU / 2 + ra + 0.05); g.add(sp);
    }
    y += cao + 0.05;
  });
  // MÁI THEO CẤP — hình dáng toà nói cấp: lán mái tôn thấp · nhà phố mái ngói · văn phòng mái bằng + tum · cao ốc đỉnh thụt cấp · tháp hai cấp đỉnh + chóp vàng
  let dinh = y;
  if (cap === 0) { be(RONG + 0.1, 0.06, SAU + 0.1, 0x52525b, y + 0.03); dinh = y + 0.06; }
  else if (cap === 1) {
    const hinh = new T.Shape(); hinh.moveTo(-SAU / 2 - 0.12, 0); hinh.lineTo(SAU / 2 + 0.12, 0); hinh.lineTo(0, 0.6); hinh.closePath();
    const ngoi = new T.Mesh(new T.ExtrudeGeometry(hinh, { depth: RONG + 0.2, bevelEnabled: false }), new T.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.8 }));
    ngoi.rotation.y = Math.PI / 2; ngoi.position.set(-RONG / 2 - 0.1, y, 0); g.add(ngoi); dinh = y + 0.6;
  } else {
    be(RONG + 0.14, 0.1, SAU + 0.14, cap === 4 ? 0xd4a017 : 0x64748b, y + 0.05); dinh = y + 0.1;
    if (cap === 2) { be(1.0, 0.3, 0.8, 0x94a3b8, dinh + 0.15, -0.6); }
    else {
      // đỉnh thụt cấp: khối nhỏ hơn có dải kính sáng (cao ốc 1 cấp, tháp 2 cấp)
      const capDinh = cap === 4 ? 2 : 1;
      for (let k = 0; k < capDinh; k++) {
        const r = RONG - 0.7 - k * 0.6, d = SAU - 0.5 - k * 0.4, h = 0.5;
        be(r, h, d, THAN, dinh + h / 2);
        const dai = new T.Mesh(new T.BoxGeometry(r + 0.02, 0.12, d + 0.02), new T.MeshStandardMaterial({ color: cap === 4 ? 0xfacc15 : 0x93c5fd, emissive: cap === 4 ? 0xfacc15 : 0x60a5fa, emissiveIntensity: 0.6 }));
        dai.position.set(0, dinh + h * 0.62, 0); g.add(dai);
        dinh += h;
      }
      if (cap === 4) { const chop = new T.Mesh(new T.ConeGeometry(0.16, 1.5, 12), new T.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xd4a017, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.3 }));
        chop.position.set(0, dinh + 0.75, 0); g.add(chop); }
    }
  }
  // cột ăng-ten cắm biển (tháp: biển trên chóp)
  const xCot = cap === 4 ? 0 : RONG / 2 - 0.4, cCot = cap === 4 ? 1.5 : 0.9, yCot = cap === 4 ? dinh : dinh;
  if (cap !== 4) { const cot = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, cCot), new T.MeshStandardMaterial({ color: 0x94a3b8 })); cot.position.set(xCot, yCot + cCot / 2, cap === 1 ? 0 : 0); g.add(cot); }
  if (o.bien) { const sp = nhan(T, o.bien.chu, o.bien.mau, 1.1, o.bienTheoMan ?? true); sp.center.set(0.5, 0); sp.position.set(xCot, yCot + cCot + 0.12, 0); g.add(sp); }
  return { cao: yCot + cCot + 0.1, vat };
}

/** CẢNH 3D DÙNG CHUNG: renderer + đèn + camera quỹ đạo + chuột / chạm + thẻ rê 450 ms + khung chọn. dung() dựng vật vào cảnh, trả vật bấm được + tâm nhìn + khoảng xa. */
function useCanh3D(hop: React.RefObject<HTMLDivElement | null>, dung: (T: T3, canh: import('three').Scene) => { vat: Vat[]; tam: [number, number, number]; xa: number },
  deps: unknown[], chon: number | null, onChon: (id: number | null) => void) {
  const [re, setRe] = useState<{ x: number; y: number; chu: string } | null>(null), [loi, setLoi] = useState<string | null>(null);
  const chonRef = useRef(chon); chonRef.current = chon;
  const onChonRef = useRef(onChon); onChonRef.current = onChon;
  const capNhatChon = useRef<(id: number | null) => void>(() => {});
  useEffect(() => { capNhatChon.current(chon); }, [chon]);
  useEffect(() => {
    let huy = false, don = () => {};
    import('three').then((T) => {
      if (huy || !hop.current) return;
      const el = hop.current, W = el.clientWidth || 456, Hh = el.clientHeight || 340;
      const r = new T.WebGLRenderer({ antialias: true, alpha: true });
      r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.setSize(W, Hh); el.appendChild(r.domElement);
      const canh = new T.Scene(), cam = new T.PerspectiveCamera(38, W / Hh, 0.1, 400);
      canh.add(new T.HemisphereLight(0xffffff, 0x334155, 1.6));
      const den = new T.DirectionalLight(0xffffff, 1.4); den.position.set(5, 9, 6); canh.add(den);
      const { vat, tam: t0, xa: xa0 } = dung(T, canh);
      const tam = new T.Vector3(...t0);
      let goc = -0.6, nghieng = 0.3, xa = xa0;
      const dat3 = () => { cam.position.set(tam.x + xa * Math.cos(nghieng) * Math.sin(goc), tam.y + xa * Math.sin(nghieng), tam.z + xa * Math.cos(nghieng) * Math.cos(goc)); cam.lookAt(tam); };
      let khung: import('three').BoxHelper | null = null;
      const veChon = (id: number | null) => {
        if (khung) { canh.remove(khung); khung.geometry.dispose(); khung = null; }
        const k = vat.find((x) => x.id != null && x.id === id); if (!k) return;
        khung = new T.BoxHelper(k.vien, 0xffffff); canh.add(khung);
      };
      let can = true; const ve = () => { can = true; };
      capNhatChon.current = (id) => { veChon(id); ve(); };
      veChon(chonRef.current);
      let raf = 0; const lap = () => { if (can) { can = false; dat3(); r.render(canh, cam); } raf = requestAnimationFrame(lap); }; lap();

      const ray = new T.Raycaster(), p2 = new T.Vector2(), mat = vat.map((k) => k.m);
      const trung = (cx: number, cy: number) => { const b = r.domElement.getBoundingClientRect(); p2.set(((cx - b.left) / b.width) * 2 - 1, -((cy - b.top) / b.height) * 2 + 1); ray.setFromCamera(p2, cam);
        const h = ray.intersectObjects(mat)[0]; return h ? vat.find((k) => k.m === h.object) ?? null : null; };
      const cham = new Map<number, { x: number; y: number }>(); let keo = 0, d0 = 0, truot = false, hen: ReturnType<typeof setTimeout> | null = null;
      const xuong = (e: PointerEvent) => { r.domElement.setPointerCapture(e.pointerId); cham.set(e.pointerId, { x: e.clientX, y: e.clientY }); keo = 0; truot = e.button === 2 || e.shiftKey;
        if (cham.size === 2) { const [a, b] = [...cham.values()]; d0 = Math.hypot(a!.x - b!.x, a!.y - b!.y); } };
      const di = (e: PointerEvent) => {
        const p = cham.get(e.pointerId);
        if (p) {
          if (cham.size === 1) { const dx = e.clientX - p.x, dy = e.clientY - p.y; keo += Math.abs(dx) + Math.abs(dy);
            if (truot) { const k = xa * 0.0016, sx = Math.cos(goc), sz = -Math.sin(goc), fx = Math.sin(goc), fz = Math.cos(goc);   // trượt neo mặt đất theo hướng nhìn
              tam.x -= (dx * sx - dy * fx) * k; tam.z -= (dx * sz - dy * fz) * k; }
            else { goc -= dx * 0.008; nghieng = Math.max(0.05, Math.min(1.35, nghieng + dy * 0.006)); } }
          cham.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (cham.size === 2) { const [a, b] = [...cham.values()]; const d = Math.hypot(a!.x - b!.x, a!.y - b!.y); if (d0) xa = Math.max(3, Math.min(xa0 * 3, xa * d0 / d)); d0 = d; keo += 10; }
          setRe(null); ve(); return;
        }
        // thẻ rê chỉ hiện khi chuột dừng 450 ms (giống city.on.tc)
        if (hen) clearTimeout(hen); setRe(null);
        const cx = e.clientX, cy = e.clientY;
        hen = setTimeout(() => { const k = trung(cx, cy); const b = el.getBoundingClientRect(); if (k) setRe({ x: cx - b.left, y: cy - b.top, chu: k.chu }); }, 450);
      };
      const len = (e: PointerEvent) => { cham.delete(e.pointerId); if (cham.size < 2) d0 = 0;
        if (keo < 6 && !cham.size) { const k = trung(e.clientX, e.clientY); onChonRef.current(k?.id ?? null); if (k && e.pointerType !== 'mouse') { const b = el.getBoundingClientRect(); setRe({ x: e.clientX - b.left, y: e.clientY - b.top, chu: k.chu }); } } };
      const lan = (e: WheelEvent) => { if (!e.shiftKey) return; e.preventDefault(); const d = e.deltaY || e.deltaX; xa = Math.max(3, Math.min(xa0 * 3, xa * (d > 0 ? 1.1 : 0.9))); ve(); };
      const roi = () => { if (hen) clearTimeout(hen); setRe(null); };
      const menu = (e: Event) => e.preventDefault();
      const cv = r.domElement; cv.style.touchAction = 'none'; cv.style.cursor = 'grab';
      cv.addEventListener('pointerdown', xuong); cv.addEventListener('pointermove', di); cv.addEventListener('pointerup', len); cv.addEventListener('pointercancel', len);
      cv.addEventListener('wheel', lan, { passive: false }); cv.addEventListener('pointerleave', roi); cv.addEventListener('contextmenu', menu);
      // ô đổi cỡ (widget kéo giãn) → đổi khung vẽ, không dựng lại
      const doiCo = new ResizeObserver(() => { const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return; r.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); ve(); }); doiCo.observe(el);
      don = () => { cancelAnimationFrame(raf); if (hen) clearTimeout(hen); doiCo.disconnect(); cv.removeEventListener('wheel', lan);
        canh.traverse((x0) => { const x = x0 as unknown as { geometry?: { dispose(): void }; material?: { dispose(): void; map?: { dispose(): void } } }; x.geometry?.dispose(); x.material?.map?.dispose(); x.material?.dispose(); });
        r.dispose(); cv.remove(); };
    }).catch((e) => setLoi(`không mở được 3D: ${String(e?.message ?? e)}`));
    return () => { huy = true; don(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { re, loi };
}

function KhungCanh({ hop, re, loi, cao }: { hop: React.RefObject<HTMLDivElement | null>; re: { x: number; y: number; chu: string } | null; loi: string | null; cao: number | string }) {
  return <div ref={hop} style={{ position: 'relative', width: '100%', height: cao, borderRadius: 8, background: 'color-mix(in srgb, var(--fg-3) 6%, transparent)', overflow: 'hidden' }}>
    {loi ? <div style={{ padding: 12, color: DO }}>{loi}</div> : null}
    {re ? <div style={{ position: 'absolute', left: re.x + 10, top: re.y + 12, maxWidth: 240, padding: '4px 7px', borderRadius: 6, fontSize: 11, background: 'var(--bg-1, #0f172a)', border: '1px solid var(--line)', color: 'var(--fg-1)', pointerEvents: 'none', transform: re.x > 260 ? 'translateX(calc(-100% - 20px))' : undefined }}>{re.chu}</div> : null}
    <div style={{ position: 'absolute', right: 6, bottom: 4, fontSize: 10, color: 'var(--fg-3)', pointerEvents: 'none' }}>kéo = xoay · Shift + lăn = phóng · chuột phải = trượt</div>
  </div>;
}

/** MỘT TOÀ (khung phim, tab Toà nhà): có nhãn tầng + biển hướng đi */
export function ToaNha({ camp, mong, bien, chon, onChon }: { camp: CampToa[]; mong: MongToa; bien: { chu: string; mau: string } | null; chon: number | null; onChon: (id: number | null) => void }) {
  const hop = useRef<HTMLDivElement>(null);
  const { re, loi } = useCanh3D(hop, (T, canh) => {
    const g = new T.Group(); canh.add(g);
    const { cao, vat } = dungToa(T, g, { camp, mong, bien, nhanTang: true, kho: new Map() });
    const dat = new T.Mesh(new T.CircleGeometry(Math.max(RONG, SAU) * 1.2, 48), new T.MeshStandardMaterial({ color: 0x1e293b, transparent: true, opacity: 0.4 }));
    dat.rotation.x = -Math.PI / 2; dat.position.y = -0.01; canh.add(dat);
    return { vat, tam: [0, (cao + 0.2) / 2, 0], xa: Math.max(8, cao * 1.45 + 4) };
  }, [camp, mong.sx, mong.ke, mong.cho, bien?.chu], chon, onChon);
  return <KhungCanh hop={hop} re={re} loi={loi} cao={340} />;
}

/** THÀNH PHỐ (widget Tổng quan, anh 15/11/2026 bước 2): mỗi phim nhà đang có camp chạy = một toà, xếp theo lãi 7 ngày (cao nhất ở góc trước).
 *  Không có nhãn tầng (rối); biển tên chỉ cắm trên các toà đứng đầu. Bấm một cửa = chọn phim của toà đó. */
export type ToaPhim = { p: number; ten: string; camp: CampToa[] };
export const laiPhim = (x: ToaPhim) => x.camp.reduce((a, c) => a + c.thu7 - c.chi7, 0);
export function ThanhPho({ ds, chon, onChon, cao, bienToiDa = 6 }: { ds: ToaPhim[]; chon: number | null; onChon: (p: number | null) => void; cao: number; bienToiDa?: number }) {
  const hop = useRef<HTMLDivElement>(null);
  const { re, loi } = useCanh3D(hop, (T, canh) => {
    const kho = new Map<string, import('three').CanvasTexture>(), vat: Vat[] = [];
    const n = ds.length, cot = Math.max(1, Math.ceil(Math.sqrt(n * 1.4))), BX = RONG + 1.6, BZ = SAU + 1.8;
    const dauBien = new Set(ds.slice(0, bienToiDa).map((x) => x.p));
    let caoMax = 1;
    ds.forEach((ph, i) => {
      const g = new T.Group(); canh.add(g);
      const ten = ph.ten.length > 22 ? `${ph.ten.slice(0, 21)}…` : ph.ten, ngan = ph.ten.length > 16 ? `${ph.ten.slice(0, 15)}…` : ph.ten, lai = laiPhim(ph);
      const r = dungToa(T, g, { camp: ph.camp, mong: { sx: 0, ke: 0, cho: 0 }, bien: dauBien.has(ph.p) ? { chu: ngan, mau: lai >= 0 ? XANH : DO } : null, nhanTang: false, bienTheoMan: false, kho });
      g.position.set((i % cot - (cot - 1) / 2) * BX, 0, ((Math.ceil(n / cot) - 1) / 2 - Math.floor(i / cot)) * BZ);   // hàng đầu (lãi nhất) ở phía camera (+z)
      caoMax = Math.max(caoMax, r.cao);
      for (const v of r.vat) vat.push({ m: v.m, vien: g, id: ph.p, chu: `${ten} · ${v.chu}` });
      // khối bấm vô hình lọt trong thân (cửa sáng nằm ngoài nên vẫn bắt tia trước): bấm vào tường / kính tối cũng chọn được toà
      const k7 = ph.camp.reduce((a, c) => ({ chi: a.chi + c.chi7, thu: a.thu + c.thu7 }), { chi: 0, thu: 0 }), caoBat = Math.max(0.5, r.cao - 1.0);
      const bat = new T.Mesh(new T.BoxGeometry(RONG, caoBat, SAU), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      bat.position.set(0, caoBat / 2, 0); g.add(bat);
      vat.push({ m: bat, vien: g, id: ph.p, chu: `${ten} · ${ph.camp.length} camp · 7 ngày lãi ${lai >= 0 ? '' : '−'}$${Math.abs(k7.thu - k7.chi).toFixed(0)}` });
    });
    const hang = Math.ceil(n / cot), rongTp = cot * BX, sauTp = hang * BZ;
    const dat = new T.Mesh(new T.PlaneGeometry(rongTp + 2, sauTp + 2), new T.MeshStandardMaterial({ color: 0x1e293b, transparent: true, opacity: 0.45 }));
    dat.rotation.x = -Math.PI / 2; dat.position.y = -0.01; canh.add(dat);
    return { vat, tam: [0, caoMax * 0.3, 0], xa: Math.max(10, Math.max(rongTp, sauTp) * 1.15 + caoMax * 0.6) };
  }, [ds], chon, onChon);
  return <KhungCanh hop={hop} re={re} loi={loi} cao={cao} />;
}
