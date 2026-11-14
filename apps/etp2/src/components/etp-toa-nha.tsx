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
import { KeToan } from '@/components/etp-so';

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
 *  Túp lều (mái tranh nhọn) → Nhà cấp 4 (một tầng, mái tôn) → Nhà phố (mái ngói) → Văn phòng (mái bằng + tum) → Cao ốc (đỉnh thụt cấp) → Tháp (hai cấp đỉnh + chóp vàng). */
export const ON_DINH = 5;
export const laOnDinh = (c: CampToa) => !c.cho && c.ngay_lai >= ON_DINH;
export const CAP = ['Túp lều', 'Nhà cấp 4', 'Nhà phố', 'Văn phòng', 'Cao ốc', 'Tháp'] as const;
export const GIAI_CAP = `Túp lều: phim mới, chưa camp nào chi đủ $1 / 7 ngày · Nhà cấp 4: đang chi, chưa camp nào ổn định · Nhà phố: ≥ 1 camp ổn định · Văn phòng: có camp Scale (> $1) ổn định · Cao ốc: có ★ ROAS lãi hoặc ≥ 3 camp ổn định · Tháp: ★ ROAS lãi + ≥ 5 camp ổn định\nCamp ổn định = lãi ≥ ${ON_DINH} trong 7 ngày Ethopex đã khép · 🟢 đèn xanh = có camp lãi 7 ngày nhưng chưa ổn định (tín hiệu) — toà đứng yên ở khu cũ, chỉ lên cấp mới chuyển khu`;
export function capToa(camp: CampToa[]) {
  // CẤP = điều đã chứng minh (camp ổn định / ★ ROAS lãi) — đổi khu; TÍN HIỆU = camp lãi 7 ngày mà chưa ổn định — chỉ bật đèn xanh, KHÔNG đổi khu
  // (anh 15/11/2026 "các nhà có tín hiệu có lãi thì vẫn nằm ở đó và có đèn xanh riêng. Chỉ đến khi đạt level mới thì mới chuyển sang khu cao cấp hơn")
  const lai = (c: CampToa) => !c.cho && c.chi7 >= 1 && c.thu7 > c.chi7, od = camp.filter(laOnDinh).length;
  const roasLai = camp.some((c) => c.roas && lai(c)), scaleOD = camp.some((c) => !c.roas && c.ns > 1 && laOnDinh(c));
  const cap = roasLai && od >= 5 ? 5 : roasLai || od >= 3 ? 4 : scaleOD ? 3 : od >= 1 ? 2 : camp.some((c) => !c.cho && c.chi7 >= 1) ? 1 : 0;
  const tinHieu = cap < 4 ? camp.filter((c) => lai(c) && !laOnDinh(c)).length : 0;   // khu thượng lưu (Cao ốc, Tháp) không bật đèn — đèn chỉ báo nhà ở khu ven / trung lưu đang có lãi
  return { cap, ten: CAP[cap]!, od, tinHieu };
}
const chuCamp = (c: CampToa) => { const r7 = roiCamp(c);
  return `#${c.id} · ${c.roas ? '★ ROAS' : c.dang} · $${c.ns}/ngày${c.cho ? ' · hẹn giờ, chưa chạy' : ` · 7 ngày chi $${c.chi7.toFixed(0)} · thu $${c.thu7.toFixed(0)}${r7 != null ? ` · ROI ${r7 > 0 ? '+' : ''}${r7}%` : ' · chưa đủ số'}`}${c.cho ? '' : ` · lãi ${c.ngay_lai}/${c.ngay_chay} ngày đã khép${laOnDinh(c) ? ' (ổn định)' : ''}`}`; };

type Khoi = { kieu: 'camp'; c: CampToa } | { kieu: 'sx' | 'ke' | 'cho'; chu: string };
export type MongToa = { sx: number; ke: number; cho: number };   // đang sản xuất · kế hoạch · creative chờ lên chưa có camp
/** vật bấm / rê được trong cảnh: m = mặt bị tia chạm · vien = vật để vẽ khung chọn · id = thứ trả về khi bấm */
type Vat = { m: import('three').Object3D; vien: import('three').Object3D; id: number | null; chu: string; bien?: import('three').Sprite | null };

/** nhãn chữ cỡ cố định trên màn (sizeAttenuation tắt), nền tối để đọc được trên mọi mặt tường */
function nhan(T: T3, chu: string, mau: string, to = 1, theoMan = true) {
  const cv = document.createElement('canvas'), g = cv.getContext('2d')!; const fs = 44;
  g.font = `600 ${fs}px system-ui, sans-serif`; cv.width = Math.ceil(g.measureText(chu).width) + 24; cv.height = fs + 20;
  g.fillStyle = 'rgba(15,23,42,0.88)'; g.beginPath(); g.roundRect(0, 0, cv.width, cv.height, 14); g.fill();
  g.font = `600 ${fs}px system-ui, sans-serif`; g.fillStyle = mau; g.textBaseline = 'middle'; g.fillText(chu, 12, cv.height / 2);
  const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace;
  const sp = new T.Sprite(new T.SpriteMaterial({ map: tx, depthTest: !theoMan, transparent: true, sizeAttenuation: !theoMan })); sp.renderOrder = 10;
  /* theoMan: cỡ cố định trên màn (một toà) · không: cỡ theo thế giới, toà xa chữ nhỏ (thành phố — hàng chục biển không chồng thành mảng) */
  const h = theoMan ? 0.042 * to : 0.65 * to; sp.scale.set(h * cv.width / cv.height, h, 1); return sp;
}

/** DỰNG MỘT TOÀ vào nhóm g (gốc toà ở (0,0,0)). nhanTang: nhãn tầng bên trái (khung phim) · bien: biển trên cột ăng-ten. Trả chiều cao + các cửa bấm được. */
function dungThan(T: T3, g: import('three').Group, o: { bienCo?: number; tat?: CampToa[]; camp: CampToa[]; mong: MongToa; bien: { chu: string; mau: string } | null; nhanTang: boolean; bienTheoMan?: boolean; kho: Map<string, import('three').CanvasTexture> }) {
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
  const cap = capToa(o.camp).cap, THAN = [0xa47148, 0xb8b2a6, 0xd6c3a0, 0x9fb3c8, 0xcbd5e1, 0xeef2f6][cap]!, GO = cap === 5 ? 0xd4a017 : cap === 2 ? 0x9a6b3c : 0x94a3b8;
  /** một ô cửa: camp (sáng, in $) · việc móng (chờ / SX / KH) · trống (kính tối) */
  const cua = (k: Khoi | undefined, i: number, cy: number, caoSan: number, ra: number) => {
    const [cx, cz, quay] = o2(i, ra), geo = new T.PlaneGeometry(0.8, caoSan * 0.68);
    let m: import('three').Mesh;
    if (!k) m = new T.Mesh(geo, kinh(null, ''));
    else if (k.kieu === 'camp') { m = new T.Mesh(geo, kinh(mauCamp(k.c), k.c.cho ? 'hẹn' : `${k.c.roas ? '★' : ''}$${k.c.ns}`)); vat.push({ m, vien: m, id: k.c.id, chu: chuCamp(k.c) }); }
    else { m = new T.Mesh(geo, k.kieu === 'cho' ? kinh(LAM, 'chờ') : k.kieu === 'sx' ? kinh(VANG, 'SX') : kinh('#64748b', 'KH', true)); vat.push({ m, vien: m, id: null, chu: k.chu }); }
    m.position.set(cx, cy, cz); m.rotation.y = quay; g.add(m);
  };
  let spBien: import('three').Sprite | null = null;
  const cotBien = (yCot: number, cCot: number, xCot: number) => {
    const cot = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, cCot), new T.MeshStandardMaterial({ color: 0x94a3b8 })); cot.position.set(xCot, yCot + cCot / 2, 0); g.add(cot);
    if (o.bien) { const sp = nhan(T, o.bien.chu, o.bien.mau, o.bienCo ?? 1.1, o.bienTheoMan ?? true); spBien = sp; sp.center.set(0.5, 0); sp.position.set(xCot, yCot + cCot + 0.12, 0); g.add(sp); }
    return yCot + cCot + 0.1;
  };

  // ── TÚP LỀU / NHÀ CẤP 4 = THỬA ĐẤT ĐANG TRỒNG CÂY (anh 15/11/2026 "Nhà kiểu túp lều phải bé và nằm trong 1 thửa đất trống đang trồng cây. Mỗi cây là 1 camp nhỏ.
  //    Nếu xanh thì sáng. Đỏ thì khác đi. Còn đã tắt thì héo và để ở 1 góc"): nhà nhỏ góc sau-trái · cây = camp đang chạy (lãi: tán xanh sáng · lỗ: tán đỏ nhọn ·
  //    chưa đủ số: tán xám nhỏ · hẹn giờ: cây non xanh lam) · việc móng = cọc (chờ xanh lam · SX vàng · KH xám) · camp đã tắt = cây héo nghiêng dồn góc trước-phải
  if (cap <= 1) {
    const dat = new T.Mesh(new T.BoxGeometry(RONG, 0.06, SAU), new T.MeshStandardMaterial({ color: 0x5b4127, roughness: 1 })); dat.position.y = 0.03; g.add(dat);
    for (let k = 0; k < 4; k++) { const l = new T.Mesh(new T.BoxGeometry(RONG - 1.2, 0.012, 0.05), new T.MeshStandardMaterial({ color: 0x3f2c19 })); l.position.set(0.45, 0.066, -SAU / 2 + 0.45 + k * 0.38); g.add(l); }   // luống
    const nw = 0.75, nd = 0.55, nh = cap === 0 ? 0.3 : 0.42, hx = -RONG / 2 + 0.5, hz = -SAU / 2 + 0.42;
    be(nw, nh, nd, THAN, 0.06 + nh / 2, hx).position.z = hz;
    const caoMai = cap === 0 ? 0.42 : 0.22, R0 = Math.SQRT1_2 * (nw + 0.16);
    const mai = new T.Mesh(new T.ConeGeometry(R0, caoMai, 4), new T.MeshStandardMaterial({ color: cap === 0 ? 0xc8a96a : 0x7c8794, roughness: cap === 0 ? 1 : 0.5, metalness: cap === 0 ? 0 : 0.4 }));
    mai.rotation.y = Math.PI / 4; mai.scale.set(1, 1, (nd + 0.16) / (nw + 0.16)); mai.position.set(hx, 0.06 + nh + caoMai / 2, hz); g.add(mai);
    const cuaNha = new T.Mesh(new T.PlaneGeometry(0.16, nh * 0.6), new T.MeshStandardMaterial({ color: 0x3f2c19 })); cuaNha.position.set(hx, 0.06 + nh * 0.3, hz + nd / 2 + 0.005); g.add(cuaNha);
    // ô trồng: lưới 0,42 trên thửa, tránh nền nhà và góc héo
    const GOC_HEO = (x: number, z: number) => x > RONG / 2 - 0.95 && z > SAU / 2 - 0.62, NEN = (x: number, z: number) => x < hx + nw / 2 + 0.15 && z < hz + nd / 2 + 0.15;
    const o_: [number, number][] = [];
    for (let z = -SAU / 2 + 0.25; z < SAU / 2 - 0.1; z += 0.42) for (let x = -RONG / 2 + 0.25; x < RONG / 2 - 0.1; x += 0.42) if (!GOC_HEO(x, z) && !NEN(x, z)) o_.push([x, z]);
    const goc = new T.MeshStandardMaterial({ color: 0x6b4423, roughness: 1 });
    const cay = (x: number, z: number, c: CampToa) => {
      const lai = c.chi7 >= 1 && c.thu7 > c.chi7, lo = c.chi7 >= 1 && !lai, cao0 = c.cho ? 0.1 : 0.2;
      const than = new T.Mesh(new T.CylinderGeometry(0.025, 0.035, cao0, 6), goc); than.position.set(x, 0.06 + cao0 / 2, z); g.add(than);
      const tan = c.cho ? new T.Mesh(new T.SphereGeometry(0.07, 10, 8), new T.MeshStandardMaterial({ color: 0x93c5fd, emissive: 0x3b82f6, emissiveIntensity: 0.3 }))
        : lai ? new T.Mesh(new T.SphereGeometry(0.16, 14, 10), new T.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x22c55e, emissiveIntensity: 0.9 }))
        : lo ? new T.Mesh(new T.ConeGeometry(0.14, 0.3, 8), new T.MeshStandardMaterial({ color: 0xef4444, emissive: 0x7f1d1d, emissiveIntensity: 0.4, roughness: 0.8 }))
        : new T.Mesh(new T.SphereGeometry(0.11, 10, 8), new T.MeshStandardMaterial({ color: 0x7c8f80, roughness: 1 }));
      tan.position.set(x, 0.06 + cao0 + (lo ? 0.13 : c.cho ? 0.05 : 0.11), z); g.add(tan);
      vat.push({ m: tan, vien: tan, id: c.id, chu: chuCamp(c) });
    };
    const song = [...o.camp].sort((a, b) => Number(b.chi7 >= 1 && b.thu7 > b.chi7) - Number(a.chi7 >= 1 && a.thu7 > a.chi7));
    song.slice(0, o_.length).forEach((c, k) => cay(o_[k]![0], o_[k]![1], c));
    // việc móng: cọc nhỏ có màu sau các cây
    const coc: [number, string][] = [...Array(o.mong.cho).fill([0x60a5fa, 'creative sạch chờ lên camp']), ...Array(o.mong.sx).fill([0xfacc15, 'đang sản xuất']), ...Array(o.mong.ke).fill([0x94a3b8, 'kế hoạch, chưa làm'])];
    coc.slice(0, Math.max(0, o_.length - song.length)).forEach(([mau, chu], k) => { const [x, z] = o_[song.length + k]!;
      const m = new T.Mesh(new T.BoxGeometry(0.05, 0.2, 0.05), new T.MeshStandardMaterial({ color: mau, emissive: mau, emissiveIntensity: 0.3 })); m.position.set(x, 0.16, z); g.add(m); vat.push({ m, vien: m, id: null, chu }); });
    // góc héo: camp đã tắt (còn chi trong 30 ngày), tối đa 12 cây — THÂN TRƠ + 2 CÀNH KHÔ, KHÔNG TÁN (anh 15/11/2026 "Cây héo thì hiện tán làm đéo gì")
    const heo = (o.tat ?? []).slice(0, 12);
    heo.forEach((c, k) => {
      const x = RONG / 2 - 0.15 - (k % 4) * 0.2, z = SAU / 2 - 0.12 - Math.floor(k / 4) * 0.18;
      const gh = new T.Group(); gh.position.set(x, 0.06, z); gh.rotation.z = (k % 2 ? 1 : -1) * 0.45; g.add(gh);
      const than = new T.Mesh(new T.CylinderGeometry(0.018, 0.028, 0.16, 5), new T.MeshStandardMaterial({ color: 0x57534e, roughness: 1 })); than.position.y = 0.08; gh.add(than);
      for (const [yy, rz] of [[0.11, 0.9], [0.14, -0.8]] as const) { const canh = new T.Mesh(new T.CylinderGeometry(0.006, 0.01, 0.07, 4), than.material); canh.position.set(rz > 0 ? -0.02 : 0.02, yy, 0); canh.rotation.z = rz; gh.add(canh); }
      vat.push({ m: than, vien: than, id: c.id, chu: `#${c.id} · ${c.roas ? '★ ROAS' : c.dang} · đã tắt (cây héo)` });
    });
    if (o.nhanTang) { const sp = nhan(T, `${CAP[cap]} · ${o.camp.length} cây · ${(o.tat ?? []).length} héo`, '#cbd5e1', 0.9); sp.center.set(1, 0.5); sp.position.set(-RONG / 2 - 0.15, 0.3, SAU / 2 + 0.05); g.add(sp); }
    return { cao: cotBien(0.06 + nh + caoMai, 0.4, hx), vat, bienSp: spBien, than: [RONG, 0.06 + nh + caoMai, SAU] as [number, number, number] };
  }

  let y = 0;
  theoTang.forEach((ds, t) => {
    const mong = t === 0, ra = mong ? 0.25 : 0, san = Math.max(1, Math.ceil(ds.length / O_TANG)), caoSan = ds.length ? CAO : CAO * 0.6, cao = san * caoSan;
    be(RONG + 2 * ra, cao, SAU + 2 * ra, mong ? 0x475569 : THAN, y + cao / 2);   // thân (đế xám đậm · thân theo cấp)
    be(RONG + 2 * ra + 0.08, 0.05, SAU + 2 * ra + 0.08, mong ? 0x334155 : GO, y + cao);   // gờ sàn giữa hai tầng
    for (let s2 = 0; s2 < san; s2++) for (let i = 0; i < O_TANG; i++) cua(ds[s2 * O_TANG + i], i, y + s2 * caoSan + caoSan / 2, caoSan, ra);
    if (o.nhanTang) {
      const n = t ? ds.length : o.camp.filter((c) => c.cho).length + o.mong.sx + o.mong.ke + o.mong.cho, sp = nhan(T, `${TANG[t]}${n ? ` ${n}` : ''}`, t === 4 ? TIM : '#cbd5e1', 0.9);
      sp.center.set(1, 0.5); sp.position.set(-RONG / 2 - ra - 0.15, y + Math.min(cao, caoSan) / 2, SAU / 2 + ra + 0.05); g.add(sp);
    }
    y += cao + 0.05;
  });
  // MÁI THEO CẤP — nhà phố mái ngói · văn phòng mái bằng + tum · cao ốc đỉnh thụt cấp · tháp hai cấp đỉnh + chóp vàng
  let dinh = y;
  if (cap === 2) {
    const hinh = new T.Shape(); hinh.moveTo(-SAU / 2 - 0.12, 0); hinh.lineTo(SAU / 2 + 0.12, 0); hinh.lineTo(0, 0.6); hinh.closePath();
    const ngoi = new T.Mesh(new T.ExtrudeGeometry(hinh, { depth: RONG + 0.2, bevelEnabled: false }), new T.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.8 }));
    ngoi.rotation.y = Math.PI / 2; ngoi.position.set(-RONG / 2 - 0.1, y, 0); g.add(ngoi); dinh = y + 0.6;
  } else {
    be(RONG + 0.14, 0.1, SAU + 0.14, cap === 5 ? 0xd4a017 : 0x64748b, y + 0.05); dinh = y + 0.1;
    if (cap === 3) { be(1.0, 0.3, 0.8, 0x94a3b8, dinh + 0.15, -0.6); }
    else {
      // đỉnh thụt cấp: khối nhỏ hơn có dải kính sáng (cao ốc 1 cấp, tháp 2 cấp)
      for (let k = 0; k < (cap === 5 ? 2 : 1); k++) {
        const r = RONG - 0.7 - k * 0.6, d = SAU - 0.5 - k * 0.4, h = 0.5;
        be(r, h, d, THAN, dinh + h / 2);
        const dai = new T.Mesh(new T.BoxGeometry(r + 0.02, 0.12, d + 0.02), new T.MeshStandardMaterial({ color: cap === 5 ? 0xfacc15 : 0x93c5fd, emissive: cap === 5 ? 0xfacc15 : 0x60a5fa, emissiveIntensity: 0.6 }));
        dai.position.set(0, dinh + h * 0.62, 0); g.add(dai);
        dinh += h;
      }
    }
  }
  if (cap === 5) {   // tháp: chóp vàng, biển cắm trên chóp
    const chop = new T.Mesh(new T.ConeGeometry(0.16, 1.5, 12), new T.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xd4a017, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.3 }));
    chop.position.set(0, dinh + 0.75, 0); g.add(chop);
    if (o.bien) { const sp = nhan(T, o.bien.chu, o.bien.mau, o.bienCo ?? 1.1, o.bienTheoMan ?? true); spBien = sp; sp.center.set(0.5, 0); sp.position.set(0, dinh + 1.62, 0); g.add(sp); }
    return { cao: dinh + 1.6, vat, bienSp: spBien, than: [RONG + 0.5, dinh, SAU + 0.5] as [number, number, number] };
  }
  return { cao: cotBien(dinh, 0.9, RONG / 2 - 0.4), vat, bienSp: spBien, than: [RONG + 0.5, dinh, SAU + 0.5] as [number, number, number] };
}

/** DỰNG TOÀ + ĐÈN XANH TÍN HIỆU: cột sáng xanh + đèn tròn trên mái khi toà có camp lãi chưa ổn định (đứng yên ở khu, chờ lên cấp) */
function dungToa(...a: Parameters<typeof dungThan>) {
  const [T, g, o] = a, r0 = dungThan(...a), { tinHieu } = capToa(o.camp);
  // túp lều / nhà cấp 4 giờ là nhà nhỏ trong thửa trồng cây (dungThan) — không thu cả nhóm nữa
  const r = r0;
  if (!tinHieu) return r;
  const x = -RONG / 2 + 0.35, z = SAU / 2 - 0.35, top = r0.than[1];   // nóc thân
  const cot = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 1.4, 8), new T.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.55 })); cot.position.set(x, top + 0.7, z); g.add(cot);
  const den = new T.Mesh(new T.SphereGeometry(0.2, 16, 12), new T.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x22c55e, emissiveIntensity: 1.4 })); den.position.set(x, top + 1.45, z); g.add(den);
  const quang = new T.Mesh(new T.SphereGeometry(0.42, 16, 12), new T.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.18, depthWrite: false })); quang.position.copy(den.position); g.add(quang);
  return { ...r, cao: Math.max(r.cao, top + 1.7) };
}

/** CẢNH 3D DÙNG CHUNG: renderer + đèn + camera + điều khiển + thẻ rê 450 ms + khung chọn. dung() dựng vật vào cảnh, trả vật bấm được + tâm nhìn + khoảng xa.
 *  ĐIỀU KHIỂN CHUẨN APP LỚN (anh 15/11/2026 "controller đang hơi khó dùng. Các game, app lớn họ control kiểu gì thì kế thừa lại"): dùng thẳng bộ điều khiển chuẩn của three.js, không tự chế —
 *  · thành phố = MapControls (kiểu Google Maps 3D / game xây thành phố): kéo trái = trượt · kéo phải = xoay + nghiêng · lăn / chụm touchpad = phóng vào con trỏ · WASD / mũi tên = đi · Q / E = xoay
 *    · điện thoại 1 ngón trượt, 2 ngón chụm phóng + vặn xoay;
 *  · một toà = OrbitControls (kiểu Sketchfab / trình xem 3D): kéo trái = xoay · kéo phải = trượt · lăn = phóng · điện thoại 1 ngón xoay, 2 ngón phóng + trượt.
 *  Shift + vuốt 2 ngón touchpad / Shift + lăn = xoay quanh tâm (anh 15/11/2026). Cả hai có quán tính (damping), nhấp đúp = phóng vào điểm đó (nhấp đơn hoãn 260 ms để không chọn nhầm), nút + / − / ⟲. */
type DieuKhien = { phong: (f: number) => void; veGoc: () => void };
function useCanh3D(hop: React.RefObject<HTMLDivElement | null>, dung: (T: T3, canh: import('three').Scene) => { vat: Vat[]; tam: [number, number, number]; xa: number },
  deps: unknown[], chon: number | null, onChon: (id: number | null, xy?: { x: number; y: number }) => void, kieu: 'pho' | 'toa' = 'pho') {
  const [re, setRe] = useState<{ x: number; y: number; chu: string } | null>(null), [loi, setLoi] = useState<string | null>(null);
  const chonRef = useRef(chon); chonRef.current = chon;
  const onChonRef = useRef(onChon); onChonRef.current = onChon;
  const capNhatChon = useRef<(id: number | null) => void>(() => {});
  const dk = useRef<DieuKhien>({ phong: () => {}, veGoc: () => {} });
  useEffect(() => { capNhatChon.current(chon); }, [chon]);
  useEffect(() => {
    let huy = false, don = () => {};
    Promise.all([import('three'), import('three/examples/jsm/controls/MapControls.js'), import('three/examples/jsm/controls/OrbitControls.js')]).then(([T, { MapControls }, { OrbitControls }]) => {
      if (huy || !hop.current) return;
      const el = hop.current, W = el.clientWidth || 456, Hh = el.clientHeight || 340;
      const r = new T.WebGLRenderer({ antialias: true, alpha: true });
      r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.setSize(W, Hh); el.appendChild(r.domElement);
      const canh = new T.Scene(), cam = new T.PerspectiveCamera(38, W / Hh, 0.1, 600);
      canh.add(new T.HemisphereLight(0xffffff, 0x334155, 1.6));
      const den = new T.DirectionalLight(0xffffff, 1.4); den.position.set(5, 9, 6); canh.add(den);
      const { vat, tam: t0, xa: xa0 } = dung(T, canh);
      const GOC0 = -0.6, NGHIENG0 = kieu === 'pho' ? 0.62 : 0.32;
      const datGoc = () => { const t = new T.Vector3(...t0); cam.position.set(t.x + xa0 * Math.cos(NGHIENG0) * Math.sin(GOC0), t.y + xa0 * Math.sin(NGHIENG0), t.z + xa0 * Math.cos(NGHIENG0) * Math.cos(GOC0)); ctl.target.copy(t); ctl.update(); };
      const cv = r.domElement;
      const ctl = kieu === 'pho' ? new MapControls(cam, cv) : new OrbitControls(cam, cv);
      ctl.enableDamping = true; ctl.dampingFactor = 0.12; ctl.zoomToCursor = true; ctl.minDistance = 2.5; ctl.maxDistance = xa0 * 3;
      ctl.maxPolarAngle = Math.PI / 2 - 0.06;   // không chui xuống dưới mặt đất
      if (kieu === 'pho') { ctl.screenSpacePanning = false; ctl.panSpeed = 1.1; ctl.rotateSpeed = 0.6; }
      datGoc();
      let khung: import('three').BoxHelper | null = null;
      const veChon = (id: number | null) => {
        if (khung) { canh.remove(khung); khung.geometry.dispose(); khung = null; }
        const k = vat.find((x) => x.id != null && x.id === id); if (!k) return;
        khung = new T.BoxHelper(k.vien, 0xffffff); canh.add(khung);
      };
      let can = true; const ve = () => { can = true; };
      ctl.addEventListener('change', ve);
      capNhatChon.current = (id) => { veChon(id); ve(); };
      veChon(chonRef.current);
      // phím: WASD / mũi tên đi theo mặt đất, Q / E xoay quanh tâm nhìn (khung phải đang được chọn — bấm vào cảnh)
      const phim = new Set<string>();
      const buoc = new T.Vector3(), truoc = new T.Vector3(), phai = new T.Vector3(), len = new T.Vector3(0, 1, 0);
      const diPhim = () => {
        if (!phim.size) return;
        cam.getWorldDirection(truoc); truoc.y = 0; truoc.normalize(); phai.crossVectors(truoc, len).normalize();
        const k = cam.position.distanceTo(ctl.target) * 0.012; buoc.set(0, 0, 0);
        if (phim.has('w') || phim.has('arrowup')) buoc.addScaledVector(truoc, k);
        if (phim.has('s') || phim.has('arrowdown')) buoc.addScaledVector(truoc, -k);
        if (phim.has('d') || phim.has('arrowright')) buoc.addScaledVector(phai, k);
        if (phim.has('a') || phim.has('arrowleft')) buoc.addScaledVector(phai, -k);
        cam.position.add(buoc); ctl.target.add(buoc);
        const q = (phim.has('q') ? 1 : 0) - (phim.has('e') ? 1 : 0);
        if (q) { const o = cam.position.clone().sub(ctl.target).applyAxisAngle(len, q * 0.025); cam.position.copy(ctl.target).add(o); }
        ve();
      };
      let raf = 0; const lap = () => { diPhim(); const doi = ctl.update(); if (can || doi) { can = false; r.render(canh, cam); } raf = requestAnimationFrame(lap); }; lap();

      const ray = new T.Raycaster(), p2 = new T.Vector2(), mat = vat.map((k) => k.m), matDat = new T.Plane(new T.Vector3(0, 1, 0), 0), dd = new T.Vector3();
      const tia = (cx: number, cy: number) => { const b = cv.getBoundingClientRect(); p2.set(((cx - b.left) / b.width) * 2 - 1, -((cy - b.top) / b.height) * 2 + 1); ray.setFromCamera(p2, cam); };
      const trung = (cx: number, cy: number) => { tia(cx, cy); const h = ray.intersectObjects(mat)[0]; return h ? vat.find((k) => k.m === h.object) ?? null : null; };
      /** phóng quanh điểm P (camera và tâm cùng co về P) — P đứng yên trên màn */
      const phongQuanh = (P: import('three').Vector3, f: number) => {
        const d = cam.position.distanceTo(ctl.target), f2 = Math.max(ctl.minDistance / d, Math.min(ctl.maxDistance / d, f));
        cam.position.sub(P).multiplyScalar(f2).add(P); ctl.target.sub(P).multiplyScalar(f2).add(P); ctl.update(); ve();
      };
      dk.current = { phong: (f) => phongQuanh(ctl.target.clone(), f), veGoc: () => { datGoc(); ve(); } };

      // biển tên mờ mặc định (đặt ở nơi dựng); toà đang rê → biển sáng rõ, nổi lên trên các biển khác
      let bienSang: import('three').Sprite | null = null;
      const sangBien = (sp: import('three').Sprite | null) => { if (sp === bienSang) return;
        if (bienSang) { (bienSang.material as import('three').SpriteMaterial).opacity = (bienSang.userData.mo as number) ?? 1; bienSang.renderOrder = 10; }
        if (sp) { (sp.material as import('three').SpriteMaterial).opacity = 1; sp.renderOrder = 20; }
        bienSang = sp; ve(); };
      let x0 = 0, y0 = 0, keo = 0, hen: ReturnType<typeof setTimeout> | null = null, henBam: ReturnType<typeof setTimeout> | null = null;
      const xuong = (e: PointerEvent) => { x0 = e.clientX; y0 = e.clientY; keo = 0; setRe(null); cv.focus({ preventScroll: true }); };
      const di = (e: PointerEvent) => {
        if (e.buttons) { keo = Math.max(keo, Math.abs(e.clientX - x0) + Math.abs(e.clientY - y0)); return; }
        if (hen) clearTimeout(hen); setRe(null);   // thẻ rê chỉ hiện khi chuột dừng 450 ms
        const cx = e.clientX, cy = e.clientY;
        hen = setTimeout(() => { const k = trung(cx, cy); const b = el.getBoundingClientRect(); sangBien(k?.bien ?? null); if (k) setRe({ x: cx - b.left, y: cy - b.top, chu: k.chu }); }, 450);
      };
      const tha = (e: PointerEvent) => {
        if (keo >= 6 || e.button !== 0) return;
        const cx = e.clientX, cy = e.clientY, cham1 = e.pointerType !== 'mouse';
        if (henBam) clearTimeout(henBam);
        henBam = setTimeout(() => { henBam = null; const k = trung(cx, cy); onChonRef.current(k?.id ?? null, { x: cx, y: cy }); if (k && cham1) { const b = el.getBoundingClientRect(); setRe({ x: cx - b.left, y: cy - b.top, chu: k.chu }); } }, 260);
      };
      const dup = (e: MouseEvent) => { e.preventDefault(); if (henBam) { clearTimeout(henBam); henBam = null; }
        tia(e.clientX, e.clientY); const h = ray.intersectObjects(mat)[0]?.point ?? (ray.ray.intersectPlane(matDat, dd) ? dd.clone() : ctl.target.clone()); phongQuanh(h, e.shiftKey ? 2 : 0.5); };
      const phimXuong = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { e.preventDefault(); phim.add(k); } };
      const phimLen = (e: KeyboardEvent) => { phim.delete(e.key.toLowerCase()); };
      const roi = () => { if (hen) clearTimeout(hen); setRe(null); sangBien(null); };
      const boPhim = () => phim.clear();
      // SHIFT + VUỐT 2 NGÓN (touchpad) / SHIFT + LĂN = XOAY quanh tâm nhìn (anh 15/11/2026 "khi giữ shift + dùng 2 ngón thì cho xoay"):
      // bắt ở pha capture của khung chứa → bộ điều khiển không nhận lần lăn này (không phóng); macOS đổi trục khi giữ Shift nên lấy trục nào lớn hơn
      const xoayShift = (e: WheelEvent) => {
        if (!e.shiftKey) return;
        e.preventDefault(); e.stopPropagation(); setRe(null);
        // anh 15/11/2026 "giữ shift + 2 ngón xoay khó quá": vuốt hướng nào cũng chỉ XOAY VÒNG (macOS đổi trục khi giữ Shift nên tách ngang / dọc làm người dùng lạc),
        // nhanh ~1 vòng / 500 px; nghiêng để cho kéo chuột phải (bấm 2 ngón rồi kéo)
        const k = e.deltaMode === 1 ? 16 : 1, d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * k;
        const cau = new T.Spherical().setFromVector3(cam.position.clone().sub(ctl.target)); cau.theta -= d * 0.012;
        cam.position.copy(ctl.target).add(new T.Vector3().setFromSpherical(cau)); ctl.update(); ve();
      };
      el.addEventListener('wheel', xoayShift, { passive: false, capture: true });
      cv.tabIndex = 0; cv.style.outline = 'none'; cv.style.touchAction = 'none';
      cv.addEventListener('pointerdown', xuong); cv.addEventListener('pointermove', di); cv.addEventListener('pointerup', tha); cv.addEventListener('pointerleave', roi);
      cv.addEventListener('dblclick', dup); cv.addEventListener('keydown', phimXuong); cv.addEventListener('keyup', phimLen); cv.addEventListener('blur', boPhim);
      // ô đổi cỡ (widget kéo giãn) → đổi khung vẽ, không dựng lại
      const doiCo = new ResizeObserver(() => { const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return; r.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); ve(); }); doiCo.observe(el);
      don = () => { cancelAnimationFrame(raf); if (hen) clearTimeout(hen); if (henBam) clearTimeout(henBam); doiCo.disconnect(); ctl.dispose(); el.removeEventListener('wheel', xoayShift, { capture: true });
        dk.current = { phong: () => {}, veGoc: () => {} };
        canh.traverse((x) => { const o = x as unknown as { geometry?: { dispose(): void }; material?: { dispose(): void; map?: { dispose(): void } } }; o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); });
        r.dispose(); cv.remove(); };
    }).catch((e) => setLoi(`không mở được 3D: ${String(e?.message ?? e)}`));
    return () => { huy = true; don(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { re, loi, dk };
}

function KhungCanh({ hop, re, loi, cao, dk, kieu = 'pho', chuGiai }: { hop: React.RefObject<HTMLDivElement | null>; re: { x: number; y: number; chu: string } | null; loi: string | null; cao: number | string;
  dk: React.RefObject<DieuKhien>; kieu?: 'pho' | 'toa'; chuGiai?: React.ReactNode }) {
  const nut: React.CSSProperties = { width: 28, height: 28, borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1, #0f172a)', color: 'var(--fg-1)', fontSize: 15, lineHeight: '26px', cursor: 'pointer', padding: 0 };
  return <div style={{ position: 'relative', width: '100%', height: cao }}>
    <div ref={hop} style={{ position: 'absolute', inset: 0, borderRadius: 8, background: 'color-mix(in srgb, var(--fg-3) 6%, transparent)', overflow: 'hidden' }} />
    {loi ? <div style={{ position: 'absolute', inset: 0, padding: 12, color: DO }}>{loi}</div> : null}
    {chuGiai ? <div style={{ position: 'absolute', left: 8, top: 8, pointerEvents: 'none' }}>{chuGiai}</div> : null}
    {re ? <div style={{ position: 'absolute', left: re.x + 10, top: re.y + 12, maxWidth: 240, padding: '4px 7px', borderRadius: 6, fontSize: 11, background: 'var(--bg-1, #0f172a)', border: '1px solid var(--line)', color: 'var(--fg-1)', pointerEvents: 'none', transform: re.x > 260 ? 'translateX(calc(-100% - 20px))' : undefined }}>{re.chu}</div> : null}
    <div style={{ position: 'absolute', right: 6, top: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button style={nut} title="phóng to (hoặc lăn chuột / nhấp đúp)" onClick={() => dk.current?.phong(0.7)}>+</button>
      <button style={nut} title="thu nhỏ (hoặc lăn chuột / Shift + nhấp đúp)" onClick={() => dk.current?.phong(1.45)}>−</button>
      <button style={{ ...nut, fontSize: 13 }} title="về góc nhìn ban đầu" onClick={() => dk.current?.veGoc()}>⟲</button>
    </div>
    <div style={{ position: 'absolute', right: 6, bottom: 4, fontSize: 10, color: 'var(--fg-3)', pointerEvents: 'none', textAlign: 'right' }}>
      {kieu === 'pho' ? 'kéo = đi · chuột phải / Shift + 2 ngón = xoay · lăn = phóng · WASD / mũi tên · Q E xoay' : 'kéo = xoay · Shift + 2 ngón = xoay · chuột phải = trượt · lăn = phóng'}</div>
  </div>;
}

/** MỘT TOÀ (khung phim, tab Toà nhà): có nhãn tầng + biển hướng đi; điều khiển kiểu trình xem 3D (OrbitControls) */
export function ToaNha({ camp, tat, mong, bien, chon, onChon }: { camp: CampToa[]; tat?: CampToa[]; mong: MongToa; bien: { chu: string; mau: string } | null; chon: number | null; onChon: (id: number | null) => void }) {
  const hop = useRef<HTMLDivElement>(null);
  const { re, loi, dk } = useCanh3D(hop, (T, canh) => {
    const g = new T.Group(); canh.add(g);
    const { cao, vat } = dungToa(T, g, { camp, tat, mong, bien, nhanTang: true, kho: new Map() });
    const dat = new T.Mesh(new T.CircleGeometry(Math.max(RONG, SAU) * 1.2, 48), new T.MeshStandardMaterial({ color: 0x1e293b, transparent: true, opacity: 0.4 }));
    dat.rotation.x = -Math.PI / 2; dat.position.y = -0.01; canh.add(dat);
    return { vat, tam: [0, (cao + 0.2) / 2, 0], xa: Math.max(8, cao * 1.45 + 4) };
  }, [camp, tat, mong.sx, mong.ke, mong.cho, bien?.chu], chon, onChon, 'toa');
  return <KhungCanh hop={hop} re={re} loi={loi} cao={340} dk={dk} kieu="toa" />;
}

/** THÀNH PHỐ PHÂN KHU (widget Tổng quan; anh 15/11/2026 "tổ chức thành các phân khu như khu người giàu, khu người nghèo... rồi bố trí các nhà và giao thông xung quanh"):
 *  mỗi phim nhà đang có camp chạy = một toà trên một lô; lô gom thành cụm 2 × 2, giữa các cụm là đường (vạch giữa), ngoài cùng đường vành đai.
 *  Lô gần tâm nhất nhận toà cấp cao nhất → KHU THƯỢNG LƯU (Tháp, Cao ốc — nền lát đá) ở trung tâm · KHU TRUNG LƯU (Văn phòng, Nhà phố — nền cỏ, cây) vòng giữa ·
 *  KHU VEN (Nhà cấp 4, Túp lều — nền đất) ngoài rìa. Biển tên chỉ cắm trên các toà đứng đầu. Bấm toà = chọn phim. */
export type ToaPhim = { p: number; ten: string; camp: CampToa[]; tat?: CampToa[] };
export const laiPhim = (x: ToaPhim) => x.camp.reduce((a, c) => a + c.thu7 - c.chi7, 0);
export const KHU = [{ ten: 'Khu thượng lưu', cap: [4, 5], nen: 0x475569, mau: '#e2e8f0' }, { ten: 'Khu trung lưu', cap: [2, 3], nen: 0x1f3b2a, mau: '#86efac' },
  { ten: 'Khu ven', cap: [0, 1], nen: 0x4a3b28, mau: '#d6b98c' }] as const;
export const khuCua = (cap: number) => KHU.findIndex((k) => (k.cap as readonly number[]).includes(cap));
export function ThanhPho({ ds, chon, onChon, cao }: { ds: ToaPhim[]; chon: number | null; onChon: (p: number | null, xy?: { x: number; y: number }) => void; cao: number }) {
  const hop = useRef<HTMLDivElement>(null);
  const { re, loi, dk } = useCanh3D(hop, (T, canh) => {
    const kho = new Map<string, import('three').CanvasTexture>(), vat: Vat[] = [];
    const n = ds.length, LX = RONG + 1.0, LZ = SAU + 1.0, D = 1.1;   // lô (có sân) · bề ngang đường
    const chan = (x: number) => x + (x % 2);
    const cot = Math.max(2, chan(Math.ceil(Math.sqrt(n * 1.3)))), hang = Math.max(2, chan(Math.ceil(n / cot)));
    const W = D + (cot / 2) * (2 * LX + D), Z = D + (hang / 2) * (2 * LZ + D);
    const xLo = (c: number) => D + Math.floor(c / 2) * (2 * LX + D) + (c % 2) * LX + LX / 2 - W / 2;
    const zLo = (r: number) => D + Math.floor(r / 2) * (2 * LZ + D) + (r % 2) * LZ + LZ / 2 - Z / 2;
    // lô xếp theo khoảng cách tới tâm (elip theo khung) — lô gần tâm nhất nhận toà cấp cao nhất (ds đã xếp cấp cao → thấp)
    const lo: [number, number][] = [];
    for (let r = 0; r < hang; r++) for (let c = 0; c < cot; c++) lo.push([xLo(c), zLo(r)]);
    lo.sort((a, b) => Math.hypot(a[0], a[1] * (W / Z)) - Math.hypot(b[0], b[1] * (W / Z)) || b[1] - a[1] || a[0] - b[0]);
    // đất nền + đường
    const nen = new T.Mesh(new T.PlaneGeometry(W + 2, Z + 2), new T.MeshStandardMaterial({ color: 0x111827 })); nen.rotation.x = -Math.PI / 2; nen.position.y = -0.02; canh.add(nen);
    const matDuong = new T.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.95 });
    for (let k = 0; k <= cot / 2; k++) { const x = D / 2 + k * (2 * LX + D) - W / 2, m = new T.Mesh(new T.PlaneGeometry(D, Z), matDuong); m.rotation.x = -Math.PI / 2; m.position.set(x, -0.005, 0); canh.add(m); }
    for (let k = 0; k <= hang / 2; k++) { const z = D / 2 + k * (2 * LZ + D) - Z / 2, m = new T.Mesh(new T.PlaneGeometry(W, D), matDuong); m.rotation.x = -Math.PI / 2; m.position.set(0, -0.004, z); canh.add(m); }
    // vạch giữa đường: một InstancedMesh cho mọi vạch (nhẹ)
    const vach: [number, number, boolean][] = [];
    for (let k = 0; k <= cot / 2; k++) { const x = D / 2 + k * (2 * LX + D) - W / 2; for (let z = -Z / 2 + 0.4; z < Z / 2; z += 0.9) vach.push([x, z, true]); }
    for (let k = 0; k <= hang / 2; k++) { const z = D / 2 + k * (2 * LZ + D) - Z / 2; for (let x = -W / 2 + 0.4; x < W / 2; x += 0.9) vach.push([x, z, false]); }
    const vm = new T.InstancedMesh(new T.PlaneGeometry(0.08, 0.45), new T.MeshBasicMaterial({ color: 0xe5c07b }), vach.length), mt = new T.Object3D();
    vach.forEach(([x, z, doc], i) => { mt.position.set(x, 0.002, z); mt.rotation.set(-Math.PI / 2, 0, doc ? 0 : Math.PI / 2); mt.updateMatrix(); vm.setMatrixAt(i, mt.matrix); }); canh.add(vm);
    // toà + nền lô theo khu
    const lanKhu: [number, number][][] = KHU.map(() => []), cay: [number, number][] = [];
    let caoMax = 1;
    ds.forEach((ph, i) => {
      const [ox, oz] = lo[i]!, cap = capToa(ph.camp).cap, kh = khuCua(cap);
      const san = new T.Mesh(new T.PlaneGeometry(LX - 0.06, LZ - 0.06), new T.MeshStandardMaterial({ color: KHU[kh]!.nen, roughness: 1 })); san.rotation.x = -Math.PI / 2; san.position.set(ox, 0, oz); canh.add(san);
      lanKhu[kh]!.push([ox, oz]); if (kh === 1) cay.push([ox + LX / 2 - 0.25, oz + LZ / 2 - 0.25], [ox - LX / 2 + 0.25, oz + LZ / 2 - 0.25]);
      const g = new T.Group(); g.position.set(ox, 0, oz); canh.add(g);
      const ten = ph.ten.length > 22 ? `${ph.ten.slice(0, 21)}…` : ph.ten, ngan = ph.ten.length > 16 ? `${ph.ten.slice(0, 15)}…` : ph.ten, lai = laiPhim(ph);
      const r = dungToa(T, g, { camp: ph.camp, tat: ph.tat, mong: { sx: 0, ke: 0, cho: 0 }, bien: { chu: ngan, mau: lai >= 0 ? XANH : DO }, bienCo: 0.42, nhanTang: false, bienTheoMan: true, kho });
      // TÊN PHIM NHỎ + MỜ, rê vào toà mới rõ (anh 15/11/2026 "Tên phim thì nhỏ, opacity, hover vào mới rõ")
      if (r.bienSp) { (r.bienSp.material as import('three').SpriteMaterial).opacity = 0.2; r.bienSp.userData.mo = 0.2; }
      caoMax = Math.max(caoMax, r.cao);
      // KHUNG CHỌN ÔM THÂN (anh 15/11/2026 "khi bấm chọn 1 toà, viền phải gọn lại"): khối bấm = đúng thân nhà / thửa, không gồm biển tên, ăng-ten, đèn
      const [bw, bh, bd] = r.than, bat = new T.Mesh(new T.BoxGeometry(bw, Math.max(0.3, bh), bd), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      bat.position.set(0, Math.max(0.3, bh) / 2, 0); g.add(bat);
      for (const v of r.vat) vat.push({ m: v.m, vien: bat, id: ph.p, chu: `${ten} · ${v.chu}`, bien: r.bienSp });
      const k7 = ph.camp.reduce((a, c) => ({ chi: a.chi + c.chi7, thu: a.thu + c.thu7 }), { chi: 0, thu: 0 });
      const th = capToa(ph.camp).tinHieu;
      vat.push({ bien: r.bienSp, m: bat, vien: bat, id: ph.p, chu: `${ten} · ${CAP[cap]} · ${KHU[kh]!.ten}${th ? ` · 🟢 ${th} camp tín hiệu lãi` : ''} · ${ph.camp.length} camp · 7 ngày lãi ${lai >= 0 ? '' : '−'}$${Math.abs(k7.thu - k7.chi).toFixed(0)}` });
    });
    // lô còn trống ngoài rìa = công viên (cỏ + cây), không để ô đen trơ
    for (const [ox, oz] of lo.slice(ds.length)) { const sv = new T.Mesh(new T.PlaneGeometry(LX - 0.06, LZ - 0.06), new T.MeshStandardMaterial({ color: 0x1d3a24, roughness: 1 })); sv.rotation.x = -Math.PI / 2; sv.position.set(ox, 0, oz); canh.add(sv);
      cay.push([ox - 0.6, oz - 0.3], [ox + 0.5, oz + 0.2], [ox - 0.1, oz + 0.5]); }
    // cây khu trung lưu + công viên (InstancedMesh)
    if (cay.length) { const cm = new T.InstancedMesh(new T.ConeGeometry(0.22, 0.6, 7), new T.MeshStandardMaterial({ color: 0x15803d }), cay.length);
      cay.forEach(([x, z], i) => { mt.position.set(x, 0.3, z); mt.rotation.set(0, 0, 0); mt.updateMatrix(); cm.setMatrixAt(i, mt.matrix); }); canh.add(cm); }
    return { vat, tam: [0, 0, 0], xa: Math.max(12, Math.max(W, Z) * 1.05 + caoMax * 0.5) };
  }, [ds], chon, onChon, 'pho');
  // chú giải khu (chữ HTML góc trái — biển 3D ba khu từng đè nhau ở cùng một góc)
  const dem = KHU.map((_, i) => ds.filter((x) => khuCua(capToa(x.camp).cap) === i).length);
  const chuGiai = <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, padding: '5px 8px', borderRadius: 6, background: 'rgba(15,23,42,.78)', color: '#cbd5e1' }}>
    {KHU.map((k, i) => <span key={k.ten} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: `#${k.nen.toString(16).padStart(6, '0')}`, border: `1px solid ${k.mau}` }} />
      <b style={{ color: k.mau }}>{k.ten}</b> {dem[i]} · {k.cap.map((c) => CAP[c]).reverse().join(' / ')}</span>)}</div>;
  return <KhungCanh hop={hop} re={re} loi={loi} cao={cao} dk={dk} chuGiai={chuGiai} />;
}

/** DANH SÁCH CAMP của một toà — CÙNG nguồn số với cây / cửa sổ đã dựng (anh 15/11/2026 "Bấm vào tưởng có camp lãi, mở ra đéo thấy cái lồn gì… Danh sách camp phải hiện ra cho khớp"):
 *  đang chạy (màu đúng màu cây / cửa: xanh lãi · tím ★ lãi · đỏ lỗ · xám chưa đủ số · lam hẹn giờ) rồi đã tắt (héo). Số 7 ngày + ngày lãi trong 7 ngày đã khép. */
export function DsCampToa({ camp, tat }: { camp: CampToa[]; tat: CampToa[] }) {
  // TRẠNG THÁI BẰNG CHỮ (anh 15/11/2026 "cái này hiểu là thế đéo nào" — chấm xám không nói gì): cùng màu với cây / cửa sổ
  const trangThai = (c: CampToa) => c.tat ? { chu: 'Đã tắt', giai: 'camp đã tắt, còn chi trong 30 ngày (cây héo)' }
    : c.cho ? { chu: 'Hẹn giờ', giai: 'camp đã tạo, chờ tới giờ chạy (cây non)' }
    : c.chi7 < 1 ? { chu: 'Chưa chi', giai: 'đang chạy nhưng 7 ngày chi chưa tới $1 — chưa đủ số để biết lãi / lỗ (cây xám)' }
    : c.thu7 > c.chi7 ? { chu: c.roas ? '★ Lãi' : 'Lãi', giai: 'thu 7 ngày > chi 7 ngày (cây xanh sáng)' } : { chu: 'Lỗ', giai: 'thu 7 ngày ≤ chi 7 ngày (cây đỏ)' };
  const dong = (c: CampToa) => { const r = roiCamp(c), mau = c.tat ? '#a8a29e' : mauCamp(c), tt = trangThai(c);
    return <tr key={c.id} style={{ borderTop: '1px solid var(--line)', opacity: c.tat ? 0.6 : 1 }}>
      <td style={{ padding: '3px 6px 3px 0', whiteSpace: 'nowrap' }}><b style={{ color: 'var(--fg-1)' }}>#{c.id}</b></td>
      <td style={{ padding: '3px 6px', whiteSpace: 'nowrap' }}><span title={tt.giai} style={{ cursor: 'help', color: mau, border: `1px solid ${mau}`, borderRadius: 4, padding: '0 5px', fontSize: 10.5 }}>{tt.chu}</span></td>
      <td style={{ padding: '3px 6px', whiteSpace: 'nowrap' }}>{c.roas ? '★ ROAS' : c.dang}</td>
      <td style={{ padding: '3px 6px' }}><KeToan v={c.ns} /></td>
      <td style={{ padding: '3px 6px' }}><KeToan v={c.chi7} /></td>
      <td style={{ padding: '3px 6px' }}><KeToan v={c.thu7} /></td>
      <td style={{ padding: '3px 6px' }}><KeToan v={c.thu7 - c.chi7} mau={c.thu7 >= c.chi7 ? XANH : DO} /></td>
      <td style={{ padding: '3px 6px', textAlign: 'right', color: r == null ? 'var(--fg-3)' : r >= 0 ? XANH : DO }}>{r == null ? '—' : `${r > 0 ? '+' : ''}${r}%`}</td>
      <td style={{ padding: '3px 0 3px 6px', textAlign: 'right', whiteSpace: 'nowrap', color: laOnDinh(c) ? XANH : 'var(--fg-2)' }}>{c.cho ? 'hẹn giờ' : c.tat ? 'đã tắt' : `${c.ngay_lai}/${c.ngay_chay}${laOnDinh(c) ? ' ổn định' : ''}`}</td>
    </tr>; };
  const xep = (a: CampToa, b: CampToa) => (b.thu7 - b.chi7) - (a.thu7 - a.chi7);
  return <div style={{ maxHeight: 360, overflowY: 'auto', fontSize: 11.5, color: 'var(--fg-2)' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
      <thead><tr style={{ color: 'var(--fg-3)', fontSize: 10.5 }}><th style={{ textAlign: 'left', fontWeight: 400 }}>Camp</th><th style={{ textAlign: 'left', fontWeight: 400, padding: '0 6px' }}>Trạng thái</th><th style={{ textAlign: 'left', fontWeight: 400, padding: '0 6px' }}>Dạng</th>
        <th style={{ textAlign: 'right', fontWeight: 400, padding: '0 6px' }}>NS/ngày</th><th style={{ textAlign: 'right', fontWeight: 400, padding: '0 6px' }}>Chi 7 ngày</th>
        <th style={{ textAlign: 'right', fontWeight: 400, padding: '0 6px' }}>Thu 7 ngày</th><th style={{ textAlign: 'right', fontWeight: 400, padding: '0 6px' }}>Lãi 7 ngày</th><th style={{ textAlign: 'right', fontWeight: 400, padding: '0 6px' }}>ROI</th>
        <th style={{ textAlign: 'right', fontWeight: 400 }} title={`số ngày lãi / số ngày có chi ≥ $1 trong 7 ngày Ethopex đã khép · ổn định = lãi ≥ ${ON_DINH} ngày`}>Ngày lãi</th></tr></thead>
      <tbody>{[...camp].sort(xep).map(dong)}{tat.length ? <tr><td colSpan={9} style={{ paddingTop: 8, color: 'var(--fg-3)', fontSize: 10.5 }}>Đã tắt (còn chi trong 30 ngày) · {tat.length}</td></tr> : null}{[...tat].sort(xep).map(dong)}</tbody>
    </table>
    {!camp.length && !tat.length ? <div style={{ color: 'var(--fg-3)' }}>Không có camp.</div> : null}
  </div>;
}
