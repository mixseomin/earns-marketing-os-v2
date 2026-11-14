'use client';
// TOÀ NHÀ PHIM (anh 15/11/2026: "giống kiểu hình một toà nhà. Nếu nhiều camp ROAS thắng thì sẽ cao hơn. Các camp thử nghiệm nằm ở tầng đáy,
// đến khi có lãi thì lên dần… Các hướng đi, đề xuất cũng show gọn trong đó… mô hình 3D để xoay").
// Mỗi camp đang chạy = một khối; tầng = chặng của camp (xepTang). Khối rộng theo ngân sách ($1 nhỏ → $30 kín ô), màu theo lãi / lỗ 7 ngày.
// Móng = việc chưa chạy: camp hẹn giờ (khối mờ) · đang sản xuất (giàn giáo vàng) · kế hoạch (khung nét đứt). Mỗi tầng chứa ≤ O_TANG khối, nhiều hơn thì thêm tầng → toà cao lên.
// three nạp động khi mở tab (không nặng trang). Điều khiển: kéo = xoay · Shift + lăn = phóng (giống city.on.tc) · điện thoại 1 ngón xoay, 2 ngón chụm phóng.
import React, { useEffect, useRef, useState } from 'react';
import type { CampToa } from '@/lib/actions/etp-lich-phim';

export const TANG = ['Móng', 'Thử', 'Lãi', 'Scale', '★ ROAS'] as const;
const XANH = '#4ade80', DO = '#f87171', XAM = '#6b7280', TIM = '#a78bfa', VANG = '#facc15', LAM = '#60a5fa';
const COT = 3, HANG = 2, O_TANG = COT * HANG, CAO = 0.8, MONG_TOI_DA = 12;

/** tầng của camp: hẹn giờ → Móng · ★ ROAS → mái · đã lên bậc (> $1) → Scale · $1 lãi 7 ngày → Lãi · còn lại → Thử */
export function xepTang(c: CampToa) {
  const lai = c.chi7 >= 1 && c.thu7 > c.chi7;
  return c.cho ? 0 : c.roas ? 4 : c.ns > 1 ? 3 : lai ? 2 : 1;
}
export const mauCamp = (c: CampToa) => (c.cho ? LAM : c.chi7 < 1 ? XAM : c.thu7 > c.chi7 ? (c.roas ? TIM : XANH) : DO);
export const roiCamp = (c: CampToa) => (c.chi7 >= 1 ? Math.round((c.thu7 - c.chi7) / c.chi7 * 100) : null);

type Khoi = { kieu: 'camp'; c: CampToa } | { kieu: 'sx' | 'ke' | 'cho'; chu: string };
export type MongToa = { sx: number; ke: number; cho: number };   // đang sản xuất · kế hoạch · creative chờ lên chưa có camp

export function ToaNha({ camp, mong, bien, chon, onChon }: { camp: CampToa[]; mong: MongToa; bien: { chu: string; mau: string } | null; chon: number | null; onChon: (id: number | null) => void }) {
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

      // ── xếp khối theo tầng: mỗi tầng ≥ 1 sàn (tầng trống = sàn mỏng có nhãn), O_TANG khối / sàn
      const theoTang: Khoi[][] = TANG.map(() => []);
      for (const c of camp) theoTang[xepTang(c)]!.push({ kieu: 'camp', c });
      theoTang[1]!.sort((a, b) => (a.kieu === 'camp' && b.kieu === 'camp' ? (roiCamp(b.c) ?? -999) - (roiCamp(a.c) ?? -999) : 0));
      for (let i = 0; i < mong.cho && theoTang[0]!.length < MONG_TOI_DA; i++) theoTang[0]!.push({ kieu: 'cho', chu: 'creative sạch chờ lên camp' });
      for (let i = 0; i < mong.sx && theoTang[0]!.length < MONG_TOI_DA; i++) theoTang[0]!.push({ kieu: 'sx', chu: 'đang sản xuất' });
      for (let i = 0; i < mong.ke && theoTang[0]!.length < MONG_TOI_DA; i++) theoTang[0]!.push({ kieu: 'ke', chu: 'kế hoạch, chưa làm' });
      const RONG = COT * 1.1, SAU = HANG * 1.1, x0 = -RONG / 2 + 0.55, z0 = -SAU / 2 + 0.55;
      const khoi: { m: InstanceType<typeof T.Mesh>; id: number | null; chu: string }[] = [];
      const nhan = (chu: string, mau: string, to = 1) => {
        const cv = document.createElement('canvas'), g = cv.getContext('2d')!; const fs = 44;
        g.font = `600 ${fs}px system-ui, sans-serif`; cv.width = Math.ceil(g.measureText(chu).width) + 24; cv.height = fs + 20;
        g.font = `600 ${fs}px system-ui, sans-serif`; g.fillStyle = mau; g.textBaseline = 'middle'; g.fillText(chu, 12, cv.height / 2);
        const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace;
        const sp = new T.Sprite(new T.SpriteMaterial({ map: tx, depthTest: false, transparent: true })); sp.renderOrder = 10;
        const h = 0.32 * to; sp.scale.set(h * cv.width / cv.height, h, 1); return sp;
      };
      const mauNhan = getComputedStyle(el).getPropertyValue('--fg-2').trim() || '#94a3b8';
      let y = 0;
      theoTang.forEach((ds, t) => {
        const san = Math.max(1, Math.ceil(ds.length / O_TANG)), cao = ds.length ? san * CAO : 0.22;
        // sàn kính của tầng
        const sanM = new T.Mesh(new T.BoxGeometry(RONG + 0.2, 0.04, SAU + 0.2), new T.MeshStandardMaterial({ color: t === 0 ? 0x475569 : 0x94a3b8, transparent: true, opacity: t === 0 ? 0.55 : 0.25 }));
        sanM.position.set(0, y, 0); canh.add(sanM);
        ds.forEach((k, i) => {
          const s = Math.floor(i / O_TANG), o = i % O_TANG, cx = x0 + (o % COT) * 1.1, cz = z0 + Math.floor(o / COT) * 1.1, cy = y + s * CAO + CAO / 2 + 0.03;
          if (k.kieu === 'camp') {
            const c = k.c, w = 0.5 + 0.45 * Math.min(1, c.ns / 30), mau = new T.Color(mauCamp(c));
            const m = new T.Mesh(new T.BoxGeometry(w, CAO * 0.86, w), new T.MeshStandardMaterial({ color: mau, transparent: c.cho, opacity: c.cho ? 0.45 : 1, roughness: 0.55 }));
            m.position.set(cx, cy, cz); canh.add(m);
            const r7 = roiCamp(c);
            khoi.push({ m, id: c.id, chu: `#${c.id} · ${c.roas ? '★ ROAS' : c.dang} · $${c.ns}/ngày${c.cho ? ' · hẹn giờ, chưa chạy' : ` · 7 ngày chi $${c.chi7.toFixed(0)} · thu $${c.thu7.toFixed(0)}${r7 != null ? ` · ROI ${r7 > 0 ? '+' : ''}${r7}%` : ' · chưa đủ số'}`}` });
          } else {
            const g = new T.BoxGeometry(0.7, CAO * 0.8, 0.7), vien = new T.EdgesGeometry(g);
            const dong = k.kieu === 'ke' ? new T.LineSegments(vien, new T.LineDashedMaterial({ color: XAM, dashSize: 0.08, gapSize: 0.06 }))
              : new T.LineSegments(vien, new T.LineBasicMaterial({ color: k.kieu === 'sx' ? VANG : LAM }));
            if (k.kieu === 'ke') dong.computeLineDistances();
            dong.position.set(cx, cy, cz); canh.add(dong);
            if (k.kieu === 'sx') { const cheo = new T.LineSegments(new T.WireframeGeometry(new T.BoxGeometry(0.7, CAO * 0.8, 0.7, 1, 2, 1)), new T.LineBasicMaterial({ color: VANG, transparent: true, opacity: 0.5 })); cheo.position.copy(dong.position); canh.add(cheo); }
            const bat = new T.Mesh(g, new T.MeshBasicMaterial({ transparent: true, opacity: k.kieu === 'cho' ? 0.18 : 0.04, color: k.kieu === 'cho' ? LAM : 0xffffff, depthWrite: false }));
            bat.position.set(cx, cy, cz); canh.add(bat); khoi.push({ m: bat, id: null, chu: k.chu });
          }
        });
        const n = ds.length, sp = nhan(`${TANG[t]}${n ? ` ${n}` : ''}`, t === 4 ? TIM : mauNhan, 0.9);
        sp.position.set(-RONG / 2 - 0.25 - sp.scale.x / 2, y + Math.min(cao, CAO) / 2 + 0.05, SAU / 2 + 0.1); canh.add(sp);
        y += cao + 0.06;
      });
      // mái + biển hướng đi (dòng "Hướng" của bảng phim) cắm trên nóc
      const cot = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.7), new T.MeshStandardMaterial({ color: 0x94a3b8 })); cot.position.set(RONG / 2 - 0.3, y + 0.35, 0); canh.add(cot);
      if (bien) { const sp = nhan(bien.chu, bien.mau, 1.1); sp.position.set(RONG / 2 - 0.3, y + 0.95, 0); canh.add(sp); }
      const dat = new T.Mesh(new T.CircleGeometry(Math.max(RONG, SAU) * 1.1, 48), new T.MeshStandardMaterial({ color: 0x1e293b, transparent: true, opacity: 0.35 }));
      dat.rotation.x = -Math.PI / 2; dat.position.y = -0.03; canh.add(dat);

      // ── camera quỹ đạo quanh giữa toà
      const tam = new T.Vector3(0, y / 2, 0);
      let goc = -0.6, nghieng = 0.42, xa = Math.max(7, y * 1.25 + 4);
      const dat3 = () => { cam.position.set(tam.x + xa * Math.cos(nghieng) * Math.sin(goc), tam.y + xa * Math.sin(nghieng), tam.z + xa * Math.cos(nghieng) * Math.cos(goc)); cam.lookAt(tam); };
      const vien0 = new Map<number, InstanceType<typeof T.LineSegments>>();
      const veChon = (id: number | null) => {
        for (const [, v] of vien0) canh.remove(v); vien0.clear();
        const k = khoi.find((x) => x.id != null && x.id === id); if (!k) return;
        const v = new T.LineSegments(new T.EdgesGeometry((k.m.geometry as InstanceType<typeof T.BoxGeometry>)), new T.LineBasicMaterial({ color: 0xffffff }));
        v.position.copy(k.m.position); v.scale.setScalar(1.08); canh.add(v); vien0.set(k.id!, v);
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
  }, [camp, mong.sx, mong.ke, mong.cho, bien?.chu]);

  return <div ref={hop} style={{ position: 'relative', width: '100%', height: 340, borderRadius: 8, background: 'color-mix(in srgb, var(--fg-3) 6%, transparent)', overflow: 'hidden' }}>
    {loi ? <div style={{ padding: 12, color: DO }}>{loi}</div> : null}
    {re ? <div style={{ position: 'absolute', left: Math.min(re.x + 10, 240), top: re.y + 12, maxWidth: 220, padding: '4px 7px', borderRadius: 6, fontSize: 11, background: 'var(--bg-1, #0f172a)', border: '1px solid var(--line)', color: 'var(--fg-1)', pointerEvents: 'none' }}>{re.chu}</div> : null}
    <div style={{ position: 'absolute', right: 6, bottom: 4, fontSize: 10, color: 'var(--fg-3)', pointerEvents: 'none' }}>kéo = xoay · Shift + lăn = phóng</div>
  </div>;
}
