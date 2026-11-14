'use client';
// TOÀ NHÀ PHIM (anh 15/11/2026: "giống kiểu hình một toà nhà. Nếu nhiều camp ROAS thắng thì sẽ cao hơn. Các camp thử nghiệm nằm ở tầng đáy,
// đến khi có lãi thì lên dần… Các hướng đi, đề xuất cũng show gọn trong đó… mô hình 3D để xoay").
// THÂN TOÀ ĐẶC, mỗi camp đang chạy = MỘT Ô CỬA SỔ SÁNG trên mặt tường (anh 15/11/2026 "nhìn giống tủ để hàng siêu thị" — bỏ kiểu khối đặt trên sàn hở): cửa in ngân sách ($30 / ★$20),
// màu theo lãi / lỗ 7 ngày; ô chưa có camp = kính tối. Tầng = chặng của camp (xepTang), mỗi sàn ≤ O_TANG cửa (3 mặt trước + 2 phải + 2 trái + 3 sau), nhiều hơn thì thêm sàn → toà cao lên.
// Móng = khối đế rộng hơn thân: camp hẹn giờ / creative chờ (xanh) · đang sản xuất (vàng SX) · kế hoạch (KH nét đứt).
// three nạp động khi mở tab (không nặng trang). Điều khiển: kéo = xoay · Shift + lăn = phóng (giống city.on.tc) · điện thoại 1 ngón xoay, 2 ngón chụm phóng.
import React, { useEffect, useRef, useState } from 'react';
import type { CampToa } from '@/lib/actions/etp-lich-phim';

export const TANG = ['Móng', 'Thử', 'Lãi', 'Scale', '★ ROAS'] as const;
const XANH = '#4ade80', DO = '#f87171', XAM = '#6b7280', TIM = '#a78bfa', VANG = '#facc15', LAM = '#60a5fa';
const COT = 3, HANG = 2, O_TANG = 2 * COT + 2 * HANG, CAO = 0.7, MONG_TOI_DA = O_TANG;

/** tầng của camp: hẹn giờ → Móng · ★ ROAS → mái · đã lên bậc (> $1) → Scale · $1 lãi 7 ngày → Lãi · còn lại → Thử */
export function xepTang(c: CampToa) {
  const lai = c.chi7 >= 1 && c.thu7 > c.chi7;
  return c.cho ? 0 : c.roas ? 4 : c.ns > 1 ? 3 : lai ? 2 : 1;
}
export const mauCamp = (c: CampToa) => (c.cho ? LAM : c.chi7 < 1 ? XAM : c.thu7 > c.chi7 ? (c.roas ? TIM : XANH) : DO);
export const roiCamp = (c: CampToa) => (c.chi7 >= 1 ? Math.round((c.thu7 - c.chi7) / c.chi7 * 100) : null);

type Khoi = { kieu: 'camp'; c: CampToa } | { kieu: 'sx' | 'ke' | 'cho'; chu: string };
export type MongToa = { sx: number; ke: number; cho: number };   // đang sản xuất · kế hoạch · creative chờ lên chưa có camp

export function ToaNha({ camp, mong: mong_, bien, chon, onChon }: { camp: CampToa[]; mong: MongToa; bien: { chu: string; mau: string } | null; chon: number | null; onChon: (id: number | null) => void }) {
  const hop = useRef<HTMLDivElement>(null);
  const [re, setRe] = useState<{ x: number; y: number; chu: string } | null>(null), [loi, setLoi] = useState<string | null>(null);
  const chonRef = useRef(chon); chonRef.current = chon;
  const capNhatChon = useRef<(id: number | null) => void>(() => {});
  useEffect(() => { capNhatChon.current(chon); }, [chon]);

  useEffect(() => {
    let huy = false, don = () => {};
    import('three').then((T) => {
      if (huy || !hop.current) return;
      const el = hop.current, W = el.clientWidth || 456, Hh = el.clientHeight || 340;
      const r = new T.WebGLRenderer({ antialias: true, alpha: true });
      r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.setSize(W, Hh); el.appendChild(r.domElement);
      const canh = new T.Scene(), cam = new T.PerspectiveCamera(38, W / Hh, 0.1, 200);
      canh.add(new T.HemisphereLight(0xffffff, 0x334155, 1.6));
      const den = new T.DirectionalLight(0xffffff, 1.4); den.position.set(5, 9, 6); canh.add(den);

      // ── xếp cửa theo tầng: mỗi tầng ≥ 1 sàn (tầng trống = sàn thấp toàn kính tối), O_TANG cửa / sàn
      const theoTang: Khoi[][] = TANG.map(() => []);
      for (const c of camp) theoTang[xepTang(c)]!.push({ kieu: 'camp', c });
      theoTang[1]!.sort((a, b) => (a.kieu === 'camp' && b.kieu === 'camp' ? (roiCamp(b.c) ?? -999) - (roiCamp(a.c) ?? -999) : 0));
      for (let i = 0; i < mong_.cho && theoTang[0]!.length < MONG_TOI_DA; i++) theoTang[0]!.push({ kieu: 'cho', chu: 'creative sạch chờ lên camp' });
      for (let i = 0; i < mong_.sx && theoTang[0]!.length < MONG_TOI_DA; i++) theoTang[0]!.push({ kieu: 'sx', chu: 'đang sản xuất' });
      for (let i = 0; i < mong_.ke && theoTang[0]!.length < MONG_TOI_DA; i++) theoTang[0]!.push({ kieu: 'ke', chu: 'kế hoạch, chưa làm' });
      const RONG = COT * 1.0, SAU = HANG * 1.0;
      const khoi: { m: InstanceType<typeof T.Mesh>; id: number | null; chu: string }[] = [];
      const nhan = (chu: string, mau: string, to = 1) => {
        const cv = document.createElement('canvas'), g = cv.getContext('2d')!; const fs = 44;
        g.font = `600 ${fs}px system-ui, sans-serif`; cv.width = Math.ceil(g.measureText(chu).width) + 24; cv.height = fs + 20;
        g.fillStyle = 'rgba(15,23,42,0.88)'; g.beginPath(); g.roundRect(0, 0, cv.width, cv.height, 14); g.fill();   // nền tối: nhãn đọc được trên mọi mặt tường
        g.font = `600 ${fs}px system-ui, sans-serif`; g.fillStyle = mau; g.textBaseline = 'middle'; g.fillText(chu, 12, cv.height / 2);
        const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace;
        const sp = new T.Sprite(new T.SpriteMaterial({ map: tx, depthTest: false, transparent: true, sizeAttenuation: false })); sp.renderOrder = 10;
        /* cỡ cố định trên màn (sizeAttenuation tắt): toà cao kéo camera xa thì chữ không teo */ const h = 0.042 * to; sp.scale.set(h * cv.width / cv.height, h, 1); return sp;
      };
      const mauNhan = '#cbd5e1';   // nhãn nằm trên nền tối riêng → chữ sáng cố định, không theo theme
      // CỬA SỔ: kính có khung chia ô + số; cửa sáng tự phát quang nhẹ (đèn trong phòng), cửa tối = kính phản chiếu trời
      const kho = new Map<string, InstanceType<typeof T.CanvasTexture>>();
      const kinh = (mau: string | null, chu: string, net = false) => {
        const k = `${mau}|${chu}|${net}`; let tx = kho.get(k);
        if (!tx) {
          const cv = document.createElement('canvas'); cv.width = 160; cv.height = 112; const g = cv.getContext('2d')!;
          if (mau) { g.fillStyle = mau; g.fillRect(0, 0, 160, 112); }
          else { const gr = g.createLinearGradient(0, 0, 160, 112); gr.addColorStop(0, '#334155'); gr.addColorStop(0.55, '#0f172a'); gr.addColorStop(1, '#1e293b'); g.fillStyle = gr; g.fillRect(0, 0, 160, 112); }
          g.strokeStyle = 'rgba(15,23,42,0.55)'; g.lineWidth = 5; g.strokeRect(2.5, 2.5, 155, 107); g.beginPath(); g.moveTo(80, 0); g.lineTo(80, 112); g.stroke();   // khung + đố cửa
          if (net) { g.setLineDash([12, 8]); g.strokeStyle = '#e2e8f0'; g.lineWidth = 4; g.strokeRect(8, 8, 144, 96); g.setLineDash([]); }
          if (chu) { g.font = '800 56px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 7; g.strokeStyle = 'rgba(15,23,42,0.8)';
            g.strokeText(chu, 80, 58); g.fillStyle = '#ffffff'; g.fillText(chu, 80, 58); }
          tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace; kho.set(k, tx);
        }
        return new T.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: mau ? 0xffffff : 0x000000, emissiveIntensity: mau ? 0.35 : 0, roughness: mau ? 0.5 : 0.15, metalness: mau ? 0 : 0.4 });
      };
      // vị trí ô o (0..O_TANG-1) quanh thân: 3 mặt trước · 2 mặt phải · 2 mặt trái · 3 mặt sau; ra = khoảng nhô của mặt tường (đế rộng hơn thân)
      const o2 = (o: number, ra: number): [number, number, number] => {
        const nx = RONG / 2 + ra + 0.012, nz = SAU / 2 + ra + 0.012;
        if (o < COT) return [-RONG / 2 + 0.5 + o, nz, 0];
        if (o < COT + HANG) return [nx, SAU / 2 - 0.5 - (o - COT), Math.PI / 2];
        if (o < COT + 2 * HANG) return [-nx, SAU / 2 - 0.5 - (o - COT - HANG), -Math.PI / 2];
        return [RONG / 2 - 0.5 - (o - COT - 2 * HANG), -nz, Math.PI];
      };
      const be = (rong: number, cao: number, sau: number, mau: number, yy: number) => { const m = new T.Mesh(new T.BoxGeometry(rong, cao, sau), new T.MeshStandardMaterial({ color: mau, roughness: 0.85 })); m.position.set(0, yy, 0); canh.add(m); return m; };
      let y = 0;
      theoTang.forEach((ds, t) => {
        const mong = t === 0, ra = mong ? 0.25 : 0, san = Math.max(1, Math.ceil(ds.length / O_TANG)), caoSan = ds.length ? CAO : CAO * 0.6, cao = san * caoSan;
        be(RONG + 2 * ra, cao, SAU + 2 * ra, mong ? 0x475569 : 0xcbd5e1, y + cao / 2);   // thân (đế xám đậm · thân bê tông sáng)
        be(RONG + 2 * ra + 0.08, 0.05, SAU + 2 * ra + 0.08, mong ? 0x334155 : 0x94a3b8, y + cao);   // gờ sàn giữa hai tầng
        for (let s2 = 0; s2 < san; s2++) for (let o = 0; o < O_TANG; o++) {
          const k = ds[s2 * O_TANG + o], [cx, cz, quay] = o2(o, ra), cy = y + s2 * caoSan + caoSan / 2;
          const g = new T.PlaneGeometry(0.8, caoSan * 0.68);
          let m: InstanceType<typeof T.Mesh>;
          if (!k) { m = new T.Mesh(g, kinh(null, '')); }
          else if (k.kieu === 'camp') {
            const c = k.c, r7 = roiCamp(c);
            m = new T.Mesh(g, kinh(mauCamp(c), c.cho ? 'hẹn' : `${c.roas ? '★' : ''}$${c.ns}`));
            khoi.push({ m, id: c.id, chu: `#${c.id} · ${c.roas ? '★ ROAS' : c.dang} · $${c.ns}/ngày${c.cho ? ' · hẹn giờ, chưa chạy' : ` · 7 ngày chi $${c.chi7.toFixed(0)} · thu $${c.thu7.toFixed(0)}${r7 != null ? ` · ROI ${r7 > 0 ? '+' : ''}${r7}%` : ' · chưa đủ số'}`}` });
          } else {
            m = new T.Mesh(g, k.kieu === 'cho' ? kinh(LAM, 'chờ') : k.kieu === 'sx' ? kinh(VANG, 'SX') : kinh('#64748b', 'KH', true));
            khoi.push({ m, id: null, chu: k.chu });
          }
          m.position.set(cx, cy, cz); m.rotation.y = quay; canh.add(m);
        }
        const n = t ? ds.length : camp.filter((c) => c.cho).length + mong_.sx + mong_.ke + mong_.cho, sp = nhan(`${TANG[t]}${n ? ` ${n}` : ''}`, t === 4 ? TIM : mauNhan, 0.9);
        sp.center.set(1, 0.5); sp.position.set(-RONG / 2 - ra - 0.15, y + Math.min(cao, caoSan) / 2, SAU / 2 + ra + 0.05); canh.add(sp);
        y += cao + 0.05;
      });
      // mái: sàn mái nhô · tum kỹ thuật · cột ăng-ten cắm biển hướng đi (dòng "Hướng" của bảng phim)
      be(RONG + 0.14, 0.1, SAU + 0.14, 0x64748b, y + 0.05);
      const tum = new T.Mesh(new T.BoxGeometry(1.0, 0.3, 0.8), new T.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 })); tum.position.set(-0.6, y + 0.25, 0); canh.add(tum);
      const cot = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.9), new T.MeshStandardMaterial({ color: 0x94a3b8 })); cot.position.set(RONG / 2 - 0.4, y + 0.55, 0); canh.add(cot);
      if (bien) { const sp = nhan(bien.chu, bien.mau, 1.1); sp.center.set(0.5, 0); sp.position.set(RONG / 2 - 0.4, y + 1.02, 0); canh.add(sp); }
      const dat = new T.Mesh(new T.CircleGeometry(Math.max(RONG, SAU) * 1.2, 48), new T.MeshStandardMaterial({ color: 0x1e293b, transparent: true, opacity: 0.4 }));
      dat.rotation.x = -Math.PI / 2; dat.position.y = -0.01; canh.add(dat);

      // ── camera quỹ đạo quanh giữa toà
      const tam = new T.Vector3(0, (y + 1.2) / 2, 0);
      let goc = -0.6, nghieng = 0.3, xa = Math.max(8, y * 1.45 + 5);
      const dat3 = () => { cam.position.set(tam.x + xa * Math.cos(nghieng) * Math.sin(goc), tam.y + xa * Math.sin(nghieng), tam.z + xa * Math.cos(nghieng) * Math.cos(goc)); cam.lookAt(tam); };
      const vien0 = new Map<number, InstanceType<typeof T.LineSegments>>();
      const veChon = (id: number | null) => {
        for (const [, v] of vien0) canh.remove(v); vien0.clear();
        const k = khoi.find((x) => x.id != null && x.id === id); if (!k) return;
        const v = new T.LineSegments(new T.EdgesGeometry(k.m.geometry), new T.LineBasicMaterial({ color: 0xffffff }));
        v.position.copy(k.m.position); v.rotation.copy(k.m.rotation); v.scale.setScalar(1.12); canh.add(v); vien0.set(k.id!, v);
      };
      let can = true; const ve = () => { can = true; };
      capNhatChon.current = (id) => { veChon(id); ve(); };
      veChon(chonRef.current);
      let raf = 0; const lap = () => { if (can) { can = false; dat3(); r.render(canh, cam); } raf = requestAnimationFrame(lap); }; lap();

      // ── chuột / chạm
      const ray = new T.Raycaster(), p2 = new T.Vector2();
      const trung = (cx: number, cy: number) => { const b = r.domElement.getBoundingClientRect(); p2.set(((cx - b.left) / b.width) * 2 - 1, -((cy - b.top) / b.height) * 2 + 1); ray.setFromCamera(p2, cam);
        const h = ray.intersectObjects(khoi.map((k) => k.m))[0]; return h ? khoi.find((k) => k.m === h.object) ?? null : null; };
      const cham = new Map<number, { x: number; y: number }>(); let keo = 0, d0 = 0, hen: ReturnType<typeof setTimeout> | null = null;
      const xuong = (e: PointerEvent) => { r.domElement.setPointerCapture(e.pointerId); cham.set(e.pointerId, { x: e.clientX, y: e.clientY }); keo = 0;
        if (cham.size === 2) { const [a, b] = [...cham.values()]; d0 = Math.hypot(a!.x - b!.x, a!.y - b!.y); } };
      const di = (e: PointerEvent) => {
        const p = cham.get(e.pointerId);
        if (p) {
          if (cham.size === 1) { const dx = e.clientX - p.x, dy = e.clientY - p.y; keo += Math.abs(dx) + Math.abs(dy); goc -= dx * 0.008; nghieng = Math.max(0.05, Math.min(1.35, nghieng + dy * 0.006)); }
          cham.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (cham.size === 2) { const [a, b] = [...cham.values()]; const d = Math.hypot(a!.x - b!.x, a!.y - b!.y); if (d0) xa = Math.max(3, Math.min(40, xa * d0 / d)); d0 = d; keo += 10; }
          setRe(null); ve(); return;
        }
        // thẻ rê chỉ hiện khi chuột dừng 450 ms (giống city.on.tc)
        if (hen) clearTimeout(hen); setRe(null);
        const cx = e.clientX, cy = e.clientY;
        hen = setTimeout(() => { const k = trung(cx, cy); const b = el.getBoundingClientRect(); if (k) setRe({ x: cx - b.left, y: cy - b.top, chu: k.chu }); }, 450);
      };
      const len = (e: PointerEvent) => { cham.delete(e.pointerId); if (cham.size < 2) d0 = 0;
        if (keo < 6 && !cham.size) { const k = trung(e.clientX, e.clientY); onChon(k?.id ?? null); if (k && e.pointerType !== 'mouse') { const b = el.getBoundingClientRect(); setRe({ x: e.clientX - b.left, y: e.clientY - b.top, chu: k.chu }); } } };
      const lan = (e: WheelEvent) => { if (!e.shiftKey) return; e.preventDefault(); const d = e.deltaY || e.deltaX; xa = Math.max(3, Math.min(40, xa * (d > 0 ? 1.1 : 0.9))); ve(); };
      const roi = () => { if (hen) clearTimeout(hen); setRe(null); };
      const cv = r.domElement; cv.style.touchAction = 'none'; cv.style.cursor = 'grab';
      cv.addEventListener('pointerdown', xuong); cv.addEventListener('pointermove', di); cv.addEventListener('pointerup', len); cv.addEventListener('pointercancel', len);
      cv.addEventListener('wheel', lan, { passive: false }); cv.addEventListener('pointerleave', roi);
      don = () => { cancelAnimationFrame(raf); if (hen) clearTimeout(hen); cv.removeEventListener('wheel', lan);
        canh.traverse((o) => { const x = o as unknown as { geometry?: { dispose(): void }; material?: { dispose(): void; map?: { dispose(): void } } }; x.geometry?.dispose(); x.material?.map?.dispose(); x.material?.dispose(); });
        r.dispose(); cv.remove(); };
    }).catch((e) => setLoi(`không mở được 3D: ${String(e?.message ?? e)}`));
    return () => { huy = true; don(); };
    // dựng lại khi số liệu đổi; onChon đi qua closure lúc dựng (hàm setState ổn định ở bên gọi)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camp, mong_.sx, mong_.ke, mong_.cho, bien?.chu]);

  return <div ref={hop} style={{ position: 'relative', width: '100%', height: 340, borderRadius: 8, background: 'color-mix(in srgb, var(--fg-3) 6%, transparent)', overflow: 'hidden' }}>
    {loi ? <div style={{ padding: 12, color: DO }}>{loi}</div> : null}
    {re ? <div style={{ position: 'absolute', left: Math.min(re.x + 10, 240), top: re.y + 12, maxWidth: 220, padding: '4px 7px', borderRadius: 6, fontSize: 11, background: 'var(--bg-1, #0f172a)', border: '1px solid var(--line)', color: 'var(--fg-1)', pointerEvents: 'none' }}>{re.chu}</div> : null}
    <div style={{ position: 'absolute', right: 6, bottom: 4, fontSize: 10, color: 'var(--fg-3)', pointerEvents: 'none' }}>kéo = xoay · Shift + lăn = phóng</div>
  </div>;
}
