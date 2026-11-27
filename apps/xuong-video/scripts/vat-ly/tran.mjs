#!/usr/bin/env node
// tra-repo-ok: luật "trận đấu" cho máy mô phỏng vật lý (cùng matter-js với mo-phong.mjs) — anh 28/11/2026 "Thử trận đấu xem",
// rồi "sau mỗi bàn thắng chậm lại vài giây, tuýt còi giao bóng; có đá phạt, phạt đền… càng chi tiết càng giống ngoài đời".
// TRẬN ĐẤU HAI ĐỘI trong sân tròn: mỗi đội 11 cầu thủ THẬT (doi[].cauthu từ doi-hinh.mjs, 4-3-3).
//   Chơi: 2 người gần bóng nhất mỗi đội lao vào bóng, còn lại giữ vị trí dạt theo bóng; thủ môn bám khung.
//   Bàn thắng: người ghi bàn chạy ra góc ăn mừng, đồng đội ùa theo → phát lại chậm (replay) → hai đội về vị trí → còi → giao bóng.
//   Phạm lỗi (va mạnh vào người đang giữ bóng): còi, trọng tài rút thẻ (vàng / đỏ / vàng thứ hai), xếp đá phạt:
//     trong vòng cấm = phạt đền (thủ môn đổ người), gần khung = đá phạt trực tiếp (hàng rào 3 người, bóng bổng qua rào + xoáy), xa = đá nhanh.
//   Thẻ đỏ: cầu thủ đi vào đường hầm, đội chơi thiếu người. Trọng tài chạy theo bóng. Bù giờ theo số lần dừng trận.
//   Thống kê: kiểm soát bóng, sút, trúng đích, phạm lỗi, thẻ, cứu thua, trúng cột → bảng giữa hiệp / hết trận + cầu thủ xuất sắc nhất.
//   (anh 28/11/2026 "chậm hơn, cầu thủ theo bóng tịnh tiến không hợp lý, bù giờ, font riêng, VAR chiếu chậm cho người xem hiểu, chấn thương, thay người, thời tiết, sân"):
//   Lái kiểu "steering": vận tốc mong muốn + giới hạn gia tốc + chậm dần khi tới đích; mỗi người một tốc độ / nhịp lắc riêng; chạy chỗ theo đội cầm bóng,
//     người gần nhất ép bóng, người thứ hai bọc lót; chạm bóng là ĐÁ có chủ đích (sút / chuyền cho đồng đội phía trên / dẫn bóng). Tiền đạo giữ hàng việt vị.
//   VAR: soát việt vị mọi bàn (đo ở khoảnh khắc chuyền), chiếu chậm từ cú chuyền + khung đóng băng có vạch việt vị; soát phạt đền (trọng tài nhìn lệch ±30 px).
//   Chấn thương sau pha phạm lỗi (y tế chạy vào, có khi cáng ra + thay người); mỗi đội 2 lượt thay người phút 58–82 lúc bóng chết; thời tiết + sân theo hạt giống.
// nhip giây phim = 1 phút trận khi bóng lăn; đồng hồ dừng khi bóng chết. Cùng hạt giống = cùng trận.
//   node tran.mjs --doi tran-doi.json --seed 7 --ra ghi.json
//   node tran.mjs --doi tran-doi.json --do 1-200 [--top 10]     → chấm độ kịch tính, in bảng
import Matter from 'matter-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { chonXi } from './doi-hinh.mjs';

const { Engine, Bodies, Body, Composite, Events } = Matter;
const rng = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const muot = (x) => { x = Math.min(1, Math.max(0, x)); return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };
const r1 = (x) => Math.round(x * 10) / 10;

export const LUAT_TRAN = {
  kieu: 'tran',
  cx: 960, cy: 540,
  R: 440, day: 22,
  mieng: 120,        // độ rộng khung thành (px)
  sau: 80,           // độ sâu lưới
  r: 21, rBong: 14,  // cầu thủ / bóng
  toc: 5.4, tocTM: 4.8, bongMax: 15,
  nhip: 1.35,        // số giây phim cho 1 phút trận (chậm hơn bản 1 s = 1 phút)
  lai2: { ga: 0.3, ham: 80, gaEp: 1.2, hamEp: 4 },   // giới hạn đổi vận tốc mỗi khung (quán tính) · bán kính bắt đầu chậm lại khi tới đích
  dam: { tam: 7, cho: 0.45, sut: 420, pSut: 1.05, tocSut: 14.5, lech: 0.6, liu: 0.3, bong: 0.55, chuyen: [7.5, 12.5], dan: 6.2 },   // chạm bóng có chủ đích
  var: { p: 0.15, sat: 25, cho: 1.3, dong: 2.4, kq: 1.1, tranTrai: 30, pPen: 0.4, phatToiDa: 5 },
  dau: { p: 0.12, cang: 0.5, chua: 2.6, cangDai: 2.6 },
  thay: { n: 2, tu: 58, den: 82, di: 1.5 },
  troi: [['ngay', 0.34], ['dem', 0.3], ['mua', 0.18], ['tuyet', 0.07], ['suong', 0.11]],
  sanKhac: ['Wembley Stadium', 'Allianz Arena', 'San Siro', 'Signal Iduna Park'],
  lai: [0.04, 0.09], // độ "bám bóng" của cầu thủ (ngẫu nhiên theo hạt giống) — 0 = nảy như khí, cao = lao vào bóng
  fps: 30, buoc: 4,
  dauGiay: 3, hiep: 45, nghi: 5, cuoiGiay: 8,
  tranh: 2,          // số cầu thủ mỗi đội lao vào bóng cùng lúc (người gần bóng nhất)
  // vị trí 4-3-3 theo khung đội 0 (giữ khung trái, x âm = sân nhà): GK, 4 DF, 3 MF, 3 FW — cùng thứ tự với chonXi
  soDo: [[-385, 0], [-265, -200], [-300, -70], [-300, 70], [-265, 200], [-160, -140], [-185, 0], [-160, 140], [-55, -210], [-40, 0], [-55, 210]],
  dat: [0.45, 0.35], // vị trí giữ dạt theo bóng (x, y)
  // sau bàn thắng: ăn mừng (giây) → phát lại (nguồn = số giây trước bàn, toc = tốc độ phát, sau = số giây sau bàn) → về vị trí → chờ còi
  mung: 2.4, replay: { nguon: 1.8, toc: 0.45, sau: 0.4 }, veVi: 1.3, choGiao: 0.6,
  // phạm lỗi: va = tốc độ tương đối tối thiểu, p = xác suất thành lỗi, cam = số giây sau giao bóng / đá phạt không thổi lỗi, gan = cự ly đá phạt trực tiếp
  loi: { va: 2.2, p: 0.35, cam: 2.5, vang: 0.3, do: 0.03, gan: 340 },
  choFK: 1.1, choPen: 1.8, trongTai: 9,
  pen: { toc: 12, lan: 8, lanDai: 0.4 },
  fk: { toc: 15, bay: 150, cao: 26 },
};

const CAT_VACH = 0x0002, CAT_CT = 0x0004, MASK_BONG = 0x0001 | CAT_CT;

export function tran(seed, DOI, L = LUAT_TRAN) {
  const ng = rng(seed * 7919 + 3);
  Matter.Common._seed = seed;
  const eng = Engine.create({ gravity: { x: 0, y: 0 }, positionIterations: 10, velocityIterations: 8 });
  const C = { x: L.cx, y: L.cy };
  const nua = L.mieng / 2 / L.R;   // nửa góc miệng khung thành (rad)
  // vòng tĩnh 120 đoạn, bỏ đoạn rơi vào hai miệng khung (góc 0 và π)
  const doan = 120, tuong = [];
  for (let i = 0; i < doan; i++) {
    const a = (i / doan) * Math.PI * 2, rr = L.R + L.day / 2, w = ((2 * Math.PI * rr) / doan) * 1.1;
    const lech = Math.min(Math.abs(Math.atan2(Math.sin(a), Math.cos(a))), Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))));
    if (lech < nua + 0.012) continue;
    tuong.push(Bodies.rectangle(C.x + Math.cos(a) * rr, C.y + Math.sin(a) * rr, w, L.day, { isStatic: true, angle: a + Math.PI / 2, restitution: 1, friction: 0, label: 'vong' }));
  }
  // lưới: hai thành bên + vách sau, sau mỗi miệng khung; vạch cầu môn chỉ chặn cầu thủ
  const xMieng = L.R * Math.cos(nua);
  for (const s of [-1, 1]) {
    const x0 = C.x + s * xMieng, x1 = C.x + s * (L.R + L.sau);
    for (const y of [C.y - L.mieng / 2 - 6, C.y + L.mieng / 2 + 6]) tuong.push(Bodies.rectangle((x0 + x1) / 2, y, Math.abs(x1 - x0) + 20, 12, { isStatic: true, restitution: 0.4, label: 'luoi' }));
    tuong.push(Bodies.rectangle(x1 + s * 6, C.y, 12, L.mieng + 24, { isStatic: true, restitution: 0.2, label: 'luoi' }));
    tuong.push(Bodies.rectangle(C.x + s * (xMieng + 4), C.y, 8, L.mieng + 12, { isStatic: true, label: 'vach', collisionFilter: { category: CAT_VACH } }));
  }
  Composite.add(eng.world, tuong);

  const huong = (d) => (d === 0 ? 1 : -1);                          // đội 0 tấn công sang phải
  const khungNha = (d) => ({ x: C.x - huong(d) * xMieng, y: C.y }); // khung đội d giữ
  const trongCam = (d, x, y) => huong(d) * (x - C.x) < -(L.R - 150) && Math.abs(y - C.y) < 165;
  const kep = (p, le = L.r + 10) => { const dx = p.x - C.x, dy = p.y - C.y, d = Math.hypot(dx, dy), m = L.R - le; return d > m ? { x: C.x + (dx / d) * m, y: C.y + (dy / d) * m } : p; };
  const kc = (a, b) => Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);

  // cầu thủ: đội 0 giữ khung trái (tấn công sang phải), đội 1 ngược lại. j = 0 là thủ môn.
  // thời tiết + sân: hạt giống riêng để đổi trời không đổi diễn biến khác
  const ngT = rng(seed * 104729 + 11);
  let q = ngT(), troi = L.troi[0][0];
  for (const [k, p] of L.troi) { if (q < p) { troi = k; break; } q -= p; }
  const san = DOI.doi[0].san ?? L.sanKhac[Math.floor(ngT() * L.sanKhac.length)];
  const coTroi = { mua: { ma: 0.004, ch: 0.97 }, tuyet: { ma: 0.01, ch: 0.93 } }[troi] ?? { ma: 0.006, ch: 1 };

  const ct = [], ghe = [[], []];
  for (let d = 0; d < 2; d++) {
    const xi = DOI.doi[d].cauthu ? chonXi(DOI.doi[d].cauthu, DOI.doi[d].xi) : L.soDo.map((_, j) => ({ so: j + 1, ngan: `#${j + 1}`, vt: j ? 'MF' : 'GK' }));
    ghe[d] = (DOI.doi[d].cauthu ?? []).filter((c) => !xi.includes(c));
    xi.forEach((c, j) => {
      const b = Bodies.circle(0, 0, L.r, { restitution: 1, friction: 0, frictionAir: 0, density: 0.003, label: 'ct', collisionFilter: { category: CAT_CT, mask: 0x0001 | CAT_CT | CAT_VACH } });
      Object.assign(b, { doi: d, j, so: c.so, ten: c.ngan, vt: c.vt, nha: L.soDo[j], tm: j === 0, bt: 0, st: 0, cu: 0, vang: 0, doThe: 0, ra: false, lan: null });
      b.k = b.tm ? 0 : L.lai[0] + ng() * (L.lai[1] - L.lai[0]);
      b.f = 0.88 + ng() * 0.2; b.ph = ng() * Math.PI * 2; b.cd = 0;   // tốc độ riêng · nhịp lắc riêng · giờ được chạm bóng lại
      ct.push(b);
    });
  }
  const ct0 = ct.map((b) => ({ doi: b.doi, so: b.so, ten: b.ten, vt: b.vt, tm: b.tm }));   // danh tính lúc ra sân (thay người đổi danh tính trên cùng thân)
  const BI = ct.length;   // chỉ số của bóng trong mỗi khung (sau toàn bộ cầu thủ); BI + 1 = trọng tài
  const bong = Bodies.circle(C.x, C.y, L.rBong, { restitution: 0.92, friction: 0, frictionAir: coTroi.ma, density: 0.0007, label: 'bong', collisionFilter: { category: 0x0001, mask: MASK_BONG } });
  Composite.add(eng.world, [...ct, bong]);
  const tatCa = [...ct, bong];
  const idx = (b) => ct.indexOf(b);
  const tren = () => ct.filter((b) => !b.ra);
  const tt = { x: C.x, y: C.y - 140 };   // trọng tài (điểm, không va chạm)
  const TUNNEL = { x: C.x, y: C.y + L.R + 80 };

  const dt = 1000 / (L.fps * L.buoc);
  const khung = [], suKien = [], ban = [];
  const now = () => khung.length / L.fps;
  const tk = { kiem: [0, 0], sut: [0, 0], trung: [0, 0], loi: [0, 0], vang: [0, 0], do: [0, 0], cuu: [0, 0], cot: [0, 0], chan: [0, 0], cham: {} };
  const anhTk = () => JSON.parse(JSON.stringify(tk));
  let chamCuoi = null, vaCham = [], xuyen = 0, lichCham = [], loiCho = null, camLoi = 0, moc = 0;
  let trangThai = 'dau', hiep = 1, phut = 0, tiSo = [0, 0], ketThuc = null, soDung = 0;
  const them = [0, 0];
  let viec = [], sutDang = null, daDang = null, ttDen = null, sutTouch = null, sauCot = -9, z = 0, bay = null, cong = null;
  // kế hoạch thay người: mỗi đội L.thay.n lượt ở phút ngẫu nhiên, làm ở lần bóng chết đầu tiên sau phút đó
  const keThay = [0, 1].flatMap((d) => Array.from({ length: L.thay.n }, () => ({ doi: d, m: L.thay.tu + ng() * (L.thay.den - L.thay.tu), xong: false }))).sort((a, b) => a.m - b.m);
  let soVar = 0;
  const daRa = [];   // người đã rời sân (thay / cáng) — giữ số liệu để chấm cầu thủ xuất sắc

  Events.on(eng, 'collisionStart', (e) => {
    const t = now(), dangChoi = trangThai === 'choi' && !viec.length;
    for (const p of e.pairs) {
      const A = p.bodyA, B = p.bodyB, va = Math.hypot(A.velocity.x - B.velocity.x, A.velocity.y - B.velocity.y);
      const coBong = A === bong || B === bong, khac = A === bong ? B : A;
      if (coBong && khac.label === 'ct') {
        chamCuoi = khac; lichCham.push({ b: khac, t }); cong = null;
        if (va > 1) vaCham.push({ k: 'q', i: idx(khac), l: +va.toFixed(1) });
        // thủ môn chạm cú sút trúng đích của đối phương = cứu thua
        if (sutDang && khac.tm && khac.doi !== sutDang.doi && t - sutDang.t < 1.2) {
          if (sutDang.trung) { tk.cuu[khac.doi]++; khac.cu++; vaCham.push({ k: 'cuu', i: idx(khac), doi: khac.doi, loai: sutDang.loai ?? null }); if (daDang) daDang.xong = 'cuu'; }
          sutDang = null;
        } else if (sutDang && !khac.tm && t - sutDang.t < 1.2 && khac.doi !== sutDang.doi) { if (sutDang.trung) tk.chan[khac.doi]++; sutDang = null; }
        continue;
      }
      if (coBong && khac.label === 'vong') {
        cong = null;
        const a = Math.atan2(bong.position.y - C.y, bong.position.x - C.x), gan = Math.min(Math.abs(a), Math.PI - Math.abs(a));
        if (dangChoi && gan < nua + 0.05 && gan > nua - 0.06 && va > 6 && t - sauCot > 2) {
          sauCot = t; const doiTC = Math.abs(a) < Math.PI / 2 ? 0 : 1;   // cột bên phải = đội 0 đang tấn công
          tk.cot[doiTC]++; vaCham.push({ k: 'cot', i: BI, doi: doiTC }); if (daDang) daDang.xong = 'cot';
        }
      }
      if (va < 1.5) continue;
      if (coBong && (khac.label === 'vong' || khac.label === 'luoi')) vaCham.push({ k: khac.label === 'luoi' ? 'l' : 'v', i: BI, l: +va.toFixed(1) });
      else if (A.label === 'ct' && B.label === 'ct') {
        vaCham.push({ k: 'b', i: idx(A), l: +va.toFixed(1) });
        // phạm lỗi: va mạnh vào người đang giữ bóng (vừa chạm bóng, bóng còn sát chân)
        if (A.doi !== B.doi && dangChoi && !loiCho && t >= camLoi && va > L.loi.va) {
          const nan = chamCuoi === A ? A : chamCuoi === B ? B : null;
          if (nan) {
            const lc = [...lichCham].reverse().find((x) => x.b === nan), pham = nan === A ? B : A;
            if (lc && t - lc.t < 0.6 && kc(nan, bong) < 90 && !pham.ra && !nan.ra && ng() < L.loi.p) loiCho = { nan, pham, x: nan.position.x, y: nan.position.y };
          }
        }
      }
    }
  });

  // một bước vật lý (4 bước con) + lái + bóng bổng / xoáy + chống xuyên tường
  const vatLy = (lai) => {
    for (let s = 0; s < L.buoc; s++) Engine.update(eng, dt);
    lai?.();
    const vb = Math.hypot(bong.velocity.x, bong.velocity.y);
    if (vb > L.bongMax) Body.setVelocity(bong, { x: (bong.velocity.x / vb) * L.bongMax, y: (bong.velocity.y / vb) * L.bongMax });
    if (bay) {
      const q = Math.hypot(bong.position.x - bay.x, bong.position.y - bay.y) / (bay.dai ?? L.fk.bay);
      if (q >= 1) { bong.collisionFilter.mask = MASK_BONG; bay = null; z = 0; } else z = (bay.cao ?? L.fk.cao) * 4 * q * (1 - q);
    }
    if (cong) {
      if (cong.n-- > 0) { const c = Math.cos(cong.a), s = Math.sin(cong.a), v = bong.velocity; Body.setVelocity(bong, { x: v.x * c - v.y * s, y: v.x * s + v.y * c }); } else cong = null;
    }
    const db = Math.hypot(bong.position.x - C.x, bong.position.y - C.y);
    if (db > L.R + L.day + L.rBong + 6 && Math.abs(bong.position.y - C.y) > L.mieng / 2 + 8) { xuyen++; Body.setPosition(bong, { x: C.x, y: C.y }); Body.setVelocity(bong, { x: 0, y: 0 }); }
    for (const b of tren()) if (Math.hypot(b.position.x - C.x, b.position.y - C.y) > L.R + L.r + 30) { xuyen++; Body.setPosition(b, { x: C.x + (b.doi ? 200 : -200), y: C.y }); }
    const t = now(); for (const v of vaCham) suKien.push({ t: +t.toFixed(3), ...v }); vaCham = [];
  };

  const lai = (b, tx, ty, k, toc) => {
    const ux = tx - b.position.x, uy = ty - b.position.y, ud = Math.hypot(ux, uy) || 1;
    let vx = b.velocity.x, vy = b.velocity.y; const v = Math.hypot(vx, vy) || 1;
    vx = vx / v + (ux / ud) * k; vy = vy / v + (uy / ud) * k; const n = Math.hypot(vx, vy) || 1;
    Body.setVelocity(b, { x: (vx / n) * toc, y: (vy / n) * toc });
    return ud;
  };
  // lái kiểu steering: vận tốc mong muốn hướng tới đích, chậm dần trong bán kính ham, mỗi khung chỉ đổi vận tốc tối đa ga (quán tính — hết "tịnh tiến")
  const lai2 = (b, tx, ty, vmax, ham = L.lai2.ham, ga = L.lai2.ga) => {
    const ux = tx - b.position.x, uy = ty - b.position.y, ud = Math.hypot(ux, uy) || 1;
    const vm = vmax * (b.f ?? 1) * coTroi.ch * Math.min(1, ud / ham), v = b.velocity;
    const dx = (ux / ud) * vm - v.x, dy = (uy / ud) * vm - v.y, dd = Math.hypot(dx, dy) || 1, a = Math.min(dd, ga);
    Body.setVelocity(b, { x: v.x + (dx / dd) * a, y: v.y + (dy / dd) * a });
    return ud;
  };
  // hàng việt vị của đội d (trục tấn công): max(người đứng thứ hai từ cuối của đối phương, bóng)
  const hangVV = (d, ps, bx) => {
    const s = huong(d), a = ps.filter((p) => p.doi !== d).map((p) => s * (p.x - C.x)).sort((x, y) => y - x);
    return Math.max(a[1] ?? 0, s * (bx - C.x), 0);
  };
  // chạm bóng có chủ đích: gần khung → sút (sai số hướng), không thì chuyền cho đồng đội phía trên ít bị kèm, không thì dẫn bóng
  const thuDa = (b, t, on) => {
    if (t < b.cd || bay || kc(b, bong) > L.r + L.rBong + L.dam.tam) return;
    const s = huong(b.doi), B = bong.position, G = { x: C.x + s * (xMieng + 10), y: C.y }, dG = Math.hypot(G.x - B.x, G.y - B.y);
    // bóng phải ở phía trước người (không đá ngược qua lưng)
    if (!b.tm && s * (B.x - b.position.x) < -L.r * 0.6 && dG > 120) return;
    b.cd = t + L.dam.cho * (0.8 + ng() * 0.5);
    const toi = (p, toc) => { const dx = p.x - B.x, dy = p.y - B.y, d = Math.hypot(dx, dy) || 1; return { x: (dx / d) * toc, y: (dy / d) * toc }; };
    let v, kieu, toc;
    // sút: dò 7 khe trên miệng khung, đếm hậu vệ (không tính thủ môn) chắn đường bóng → chọn khe thoáng nhất; khe nào cũng bị chắn thì thôi sút
    let khe = null;
    if (!b.tm && dG < L.dam.sut && ng() < L.dam.pSut * (1.4 - dG / L.dam.sut)) {
      const chan = on.filter((o) => o.doi !== b.doi && !o.tm);
      for (let k = 0; k < 7; k++) {
        const y = C.y + (k / 6 - 0.5) * L.mieng * 0.8, dx = G.x - B.x, dy = y - B.y, d = Math.hypot(dx, dy) || 1;
        let n = 0, xa = 0;
        for (const o of chan) { const ox = o.position.x - B.x, oy = o.position.y - B.y, u = (ox * dx + oy * dy) / (d * d); if (u > 0.02 && u < 1 && Math.abs(ox * dy - oy * dx) / d < L.r + L.rBong + 2) { n++; xa = Math.max(xa, u * d); } }
        const dk = n + ng() * 0.6; if (!khe || dk < khe.dk) khe = { y, n, dk, xa, d };
      }
      if (khe.n > 0 && ng() > L.dam.liu) khe = null;
    }
    if (khe) {
      kieu = 'sut'; toc = L.dam.tocSut + ng() * 2.5;
      v = toi({ x: G.x, y: khe.y + (ng() - 0.5) * L.mieng * L.dam.lech }, toc);
      // có người chắn: bấm bổng qua đầu (bóng bỏ qua cầu thủ tới quá người chắn xa nhất, vẫn vướng thủ môn ở cuối đường)
      if (khe.n > 0 && khe.xa + 40 < khe.d - 50 && ng() < L.dam.bong) { kieu = 'sutBong'; bong.collisionFilter.mask = 0x0001; bay = { ...B, dai: khe.xa + 40, cao: 18 }; }
    } else {
      const doiBan = on.filter((m) => m.doi === b.doi && m !== b && !m.tm), dich = on.filter((m) => m.doi !== b.doi);
      let tot = null, diemTot = -1e9;
      for (const m of doiBan) {
        const dx = m.position.x - B.x, dy = m.position.y - B.y, d = Math.hypot(dx, dy);
        if (d < 80 || d > (b.tm ? 520 : 380)) continue;
        const len = s * dx, kem = dich.filter((o) => { // đối phương nằm gần đường chuyền
          const ox = o.position.x - B.x, oy = o.position.y - B.y, u = (ox * dx + oy * dy) / (d * d);
          return u > 0.05 && u < 1.05 && Math.abs(ox * dy - oy * dx) / d < 34;
        }).length;
        const diem = len - d * 0.25 - kem * 140 + (ng() - 0.5) * 60;
        if (diem > diemTot) { diemTot = diem; tot = m; }
      }
      if (tot && (b.tm || diemTot > -120 || ng() < 0.35)) {
        kieu = 'chuyen'; const d = Math.hypot(tot.position.x - B.x, tot.position.y - B.y);
        toc = Math.min(L.dam.chuyen[1], Math.max(L.dam.chuyen[0], 5 + d * 0.022)) + (b.tm ? 1 : 0);
        v = toi({ x: tot.position.x + tot.velocity.x * 9 + s * 18, y: tot.position.y + tot.velocity.y * 9 }, toc);
      } else {
        kieu = 'dan'; toc = L.dam.dan * (0.85 + ng() * 0.3);
        const g = Math.atan2(G.y - B.y, G.x - B.x) + (ng() - 0.5) * 1.1; v = { x: Math.cos(g) * toc, y: Math.sin(g) * toc };
      }
    }
    Body.setVelocity(bong, v);
    tk.cham[kieu] = (tk.cham[kieu] || 0) + 1; const lc = { b, t, kieu }; chamCuoi = b; lichCham.push(lc); cong = null;
    if (kieu !== 'sut' && kieu !== 'sutBong') sutTouch = lc;   // chuyền / dẫn bóng không tính là cú sút
    vaCham.push({ k: 'q', i: idx(b), l: +toc.toFixed(1) });
  };
  // lái lúc bóng lăn: người gần bóng nhất mỗi đội ép bóng, người thứ hai bọc lót giữa bóng và khung nhà,
  // còn lại giữ vị trí: điểm nhà dạt theo bóng + dâng lên khi đội cầm bóng, lùi khi mất bóng + lắc nhẹ; tiền đạo đứng sát hàng việt vị
  const laiChoi = (t) => {
    const on = tren(), B = bong.position, P = { x: B.x + bong.velocity.x * 7, y: B.y + bong.velocity.y * 7 };
    const kP = (b) => Math.hypot(b.position.x - P.x, b.position.y - P.y);
    const giu = chamCuoi && !chamCuoi.ra ? chamCuoi.doi : -1;
    const ps = on.map((b) => ({ doi: b.doi, x: b.position.x }));
    const vai = new Map();
    for (const d of [0, 1]) on.filter((b) => b.doi === d && !b.tm).sort((a, c) => kP(a) - kP(c)).forEach((b, k) => vai.set(b, k === 0 ? 'ep' : k === 1 ? 'boc' : 'giu'));
    for (const b of on) {
      if (b.lan) { if (t < b.lan.het) { Body.setVelocity(b, { x: b.lan.vx, y: b.lan.vy }); continue; } b.lan = null; }
      const s = huong(b.doi);
      if (b.tm) {
        const tx = C.x - s * (xMieng - 55), ty = C.y + Math.max(-L.mieng / 2 - 10, Math.min(L.mieng / 2 + 10, (B.y - C.y) * 0.6));
        lai2(b, tx, ty, L.tocTM, 40, 0.45);
        if (Math.hypot(bong.velocity.x, bong.velocity.y) < 9) thuDa(b, t, on);   // bóng chậm tới tay thủ môn → phát lên
        continue;
      }
      const v = vai.get(b);
      if (v === 'giu') {
        const bx = (B.x - C.x) * s, by = (B.y - C.y) * s;
        let hx = b.nha[0] + bx * L.dat[0] + (giu === b.doi ? 60 : giu >= 0 ? -40 : 0) + Math.sin(t * 0.4 + b.ph) * 14;
        let hy = b.nha[1] + by * L.dat[1] + Math.cos(t * 0.33 + b.ph * 1.7) * 12;
        if (b.j >= 8) hx = Math.min(hx, hangVV(b.doi, ps, B.x) - 10 + Math.sin(t * 0.7 + b.ph) * 18);   // tiền đạo giữ hàng việt vị (thỉnh thoảng nhích quá)
        const hr = Math.hypot(hx, hy), gioi = L.R - L.r - 14;
        if (hr > gioi) { hx *= gioi / hr; hy *= gioi / hr; }
        lai2(b, C.x + s * hx, C.y + s * hy, L.toc * 0.78, 90);
        continue;
      }
      if (v === 'boc') {
        const G = khungNha(b.doi);
        lai2(b, P.x + (G.x - P.x) * 0.32, P.y + (G.y - P.y) * 0.32, L.toc * 0.9, 60);
        continue;
      }
      // ép bóng: tới điểm sau lưng bóng (phía ngược khung đối phương); đứng sai phía thì vòng sang bên, không đâm xuyên bóng
      const gx = C.x + s * L.R, dx = gx - P.x, dy = C.y - P.y, dd = Math.hypot(dx, dy) || 1, ux = dx / dd, uy = dy / dd;
      const rx = b.position.x - P.x, ry = b.position.y - P.y, truoc = rx * ux + ry * uy;
      let tx = P.x - ux * (L.r + L.rBong - 4), ty = P.y - uy * (L.r + L.rBong - 4);
      if (truoc > 6) { const ben = Math.sign(rx * -uy + ry * ux) || 1; tx = P.x - ux * 10 + -uy * ben * (L.r + L.rBong + 16); ty = P.y - uy * 10 + ux * ben * (L.r + L.rBong + 16); }
      lai2(b, tx, ty, L.toc, L.lai2.hamEp, L.lai2.gaEp);
      thuDa(b, t, on);
    }
  };
  // ăn mừng: người ghi bàn chạy ra góc, đồng đội ùa theo, đối phương lững thững về sân nhà
  const laiMung = (v) => {
    for (const b of tren()) {
      let tx, ty, k, toc;
      if (b === v.nguoi) { tx = v.goc.x; ty = v.goc.y; k = 0.5; toc = L.toc; }
      else if (b.tm) { Body.setVelocity(b, { x: b.velocity.x * 0.8, y: b.velocity.y * 0.8 }); continue; }
      else if (b.doi === v.doi) { tx = v.nguoi.position.x; ty = v.nguoi.position.y; k = 0.35; toc = L.toc * 0.85; }
      else { const s = huong(b.doi); tx = C.x + s * Math.min(b.nha[0], -30); ty = C.y + s * b.nha[1]; k = 0.5; toc = 2; }
      if (Math.hypot(tx - b.position.x, ty - b.position.y) < (b === v.nguoi ? 12 : 34)) { Body.setVelocity(b, { x: b.velocity.x * 0.7, y: b.velocity.y * 0.7 }); continue; }
      lai(b, tx, ty, k, toc);
    }
  };
  const thaCham = () => { for (const b of [...tren(), bong]) Body.setVelocity(b, { x: b.velocity.x * 0.82, y: b.velocity.y * 0.82 }); };

  // vị trí giao bóng: hai đội về sân nhà, đội kia đứng ngoài vòng tròn giữa sân, hai tiền đạo đội giao đứng ở chấm giữa
  const uuTien = [9, 10, 8, 7, 6, 5, 4, 3, 2, 1];
  const nguoiGiao = (d) => tren().filter((b) => b.doi === d && !b.tm).sort((a, b) => uuTien.indexOf(a.j) - uuTien.indexOf(b.j));
  const viTriGiao = (dg) => {
    const m = new Map();
    for (const b of tren()) {
      const s = huong(b.doi); let [x, y] = b.nha; x = Math.min(x, -30);
      const r = Math.hypot(x, y); if (b.doi !== dg && r < 115) { x *= 115 / r; y *= 115 / r; }
      m.set(b, { x: C.x + s * x, y: C.y + s * y });
    }
    const s = huong(dg), [f0, f1] = nguoiGiao(dg);
    if (f0) m.set(f0, { x: C.x - s * (L.r + L.rBong + 2), y: C.y });
    if (f1) m.set(f1, { x: C.x - s * 14, y: C.y + 58 });
    m.set(bong, { x: C.x, y: C.y });
    return m;
  };
  const datViTri = (m) => { for (const [b, p] of m) { Body.setPosition(b, p); Body.setVelocity(b, { x: 0, y: 0 }); } };
  const giao = (dg, loai) => {
    const t = now();
    suKien.push({ t: +t.toFixed(3), k: 'coi', loai });
    for (const b of tren()) Body.setVelocity(b, { x: 0, y: 0 });
    Body.setPosition(bong, { x: C.x, y: C.y });
    Body.setVelocity(bong, { x: -huong(dg) * 4.5, y: (ng() - 0.5) * 4 });   // chuyền về sau
    const f0 = nguoiGiao(dg)[0];
    if (f0) { chamCuoi = f0; lichCham = [{ b: f0, t }]; suKien.push({ t: +t.toFixed(3), k: 'q', i: idx(f0), l: 4 }); }
    moc = khung.length; camLoi = t + L.loi.cam; sutDang = null; daDang = null; trangThai = 'choi';
  };

  // phát lại chậm: chép khung từ max(moc, bàn - nguồn) tới bàn + sau, nội suy theo tốc độ phát
  // o = { a, b (khung nguồn), toc, var: 'ban' | 'pen' } — VAR dùng chung để chiếu chậm khoảnh khắc cần soát
  const chenReplay = (fG, bn, o = {}) => {
    const R = { ...L.replay, ...o }, a = o.a ?? Math.max(moc, fG - Math.round(R.nguon * L.fps)), b = o.b ?? Math.min(khung.length - 1, fG + Math.round(R.sau * L.fps));
    const t0 = now(), n = Math.floor((b - a) / R.toc);
    for (let q = 0; q <= n; q++) {
      const src = a + q * R.toc, i0 = Math.floor(src), i1 = Math.min(b, i0 + 1), w = src - i0, A = khung[i0], B = khung[i1];
      const k = { m: +phut.toFixed(2), h: hiep, s: [...tiSo], c: A.c, r: 1, p: A.p.map((p, j) => [r1(p[0] + (B.p[j][0] - p[0]) * w), r1(p[1] + (B.p[j][1] - p[1]) * w), p[2]]) };
      const zz = (A.z ?? 0) + ((B.z ?? 0) - (A.z ?? 0)) * w; if (zz > 0.5) k.z = +zz.toFixed(1);
      khung.push(k);
    }
    suKien.push({ t: +t0.toFixed(3), k: 'replay', dai: +((n + 1) / L.fps).toFixed(3), tBan: bn.t, i: bn.i, doi: bn.doi, ...(o.var ? { var: o.var } : {}) });
  };
  // khung đóng băng (r:'f') của khoảnh khắc f trong dai giây — vạch việt vị / vòng cấm vẽ trên đó
  const dongBang = (f, dai, ev) => {
    const A = khung[f], n = Math.round(dai * L.fps), t0 = now();
    for (let q = 0; q < n; q++) khung.push({ m: +phut.toFixed(2), h: hiep, s: [...tiSo], c: A.c, r: 'f', p: A.p, ...(A.z ? { z: A.z } : {}) });
    suKien.push({ t: +t0.toFixed(3), k: 'varDong', dai: +(n / L.fps).toFixed(3), f, ...ev });
  };

  // thay người: người ra đi bộ tới chỗ bàn trọng tài thứ tư (mép sân phía dưới), người vào nhận đúng thân đó (số áo / tên mới) rồi chạy vào
  const CHO_THAY = (d) => kep({ x: C.x + (d ? 40 : -40), y: C.y + L.R }, L.r + 4);
  const soThay = [0, 0];
  const banGhe = (d, vt) => { const g = ghe[d]; let k = g.findIndex((c) => c.vt === vt); if (k < 0) k = g.findIndex((c) => c.vt !== 'GK'); return k < 0 ? null : g.splice(k, 1)[0]; };
  const ganThay = (b, c) => {
    daRa.push({ doi: b.doi, so: b.so, ten: b.ten, vt: b.vt, tm: b.tm, bt: b.bt, st: b.st, cu: b.cu, doThe: b.doThe });
    Object.assign(b, { so: c.so, ten: c.ngan, vt: c.vt, bt: 0, st: 0, cu: 0, vang: 0, doThe: 0 });
    b.f = 0.95 + ng() * 0.15;   // chân mới, chạy khoẻ hơn
  };
  // trả về các việc (xep người ra · đổi danh tính) để chèn vào hàng việc lúc bóng chết
  const viecThay = (b, ly) => {
    const c = soThay[b.doi] < 5 ? banGhe(b.doi, b.vt) : null; if (!c) return null;
    soThay[b.doi]++;
    const ev = { k: 'thay', doi: b.doi, i: idx(b), raSo: b.so, raTen: b.ten, vaoSo: c.so, vaoTen: c.ngan, ly, di: ly === 'dau' ? 0.6 : L.thay.di };
    return [
      { loai: 'xep', dai: ev.di, den: () => new Map([[b, CHO_THAY(b.doi)]]), tt: CHO_THAY(b.doi), vao: () => suKien.push({ t: +now().toFixed(3), ...ev }) },
      { loai: 'cho', dai: 0.5, tt: CHO_THAY(b.doi), xong: () => ganThay(b, c) },
    ];
  };
  const thayKeHoach = () => {
    const ra = [];
    for (const k of keThay) {
      if (k.xong || phut < k.m) continue;
      k.xong = true;
      const ung = tren().filter((b) => b.doi === k.doi && !b.tm && !b.doThe && !b.dau);
      const b = ung.sort((x, y) => (x.bt - y.bt) || (ng() - 0.5))[Math.floor(ng() * Math.min(4, ung.length))];
      const v = b && viecThay(b, 'chien thuat'); if (v) ra.push(...v);
      if (ra.length >= 4) break;   // tối đa 2 người một lần dừng
    }
    return ra;
  };

  // hàng việc: xep (dời người theo đường cong mượt, không vật lý), cho (đứng yên), mung / tha (vật lý chạy), fn (một lần)
  const chayViec = (t) => {
    const v = viec[0];
    if (v.bd == null) {
      v.bd = t; v.vao?.();
      if (typeof v.den === 'function') v.den = v.den();
      if (v.den) { v.tu = new Map(); for (const b of v.den.keys()) v.tu.set(b, { x: b.position.x, y: b.position.y }); }
    }
    const u = v.dai ? Math.min(1, (t - v.bd + 1 / L.fps) / v.dai) : 1;
    if (v.loai === 'xep') { const e = muot(u); for (const [b, d] of v.den) { const a = v.tu.get(b); Body.setPosition(b, { x: a.x + (d.x - a.x) * e, y: a.y + (d.y - a.y) * e }); Body.setVelocity(b, { x: 0, y: 0 }); } }
    else if (v.loai === 'mung') vatLy(() => laiMung(v));
    else if (v.loai === 'tha') vatLy(thaCham);
    ttDen = v.tt ? (v.tt.position ?? v.tt) : null;
    if (u >= 1) { viec.shift(); v.xong?.(); v.fn?.(); ttDen = null; }
  };

  const duoi = (b) => { Composite.remove(eng.world, b); b.ra = true; Body.setPosition(b, { x: -999, y: -999 }); if (chamCuoi === b) chamCuoi = null; };
  const nguoiDa = (d, tru) => tren().filter((b) => b.doi === d && !b.tm && b !== tru).sort((a, b) => b.bt - a.bt || uuTien.indexOf(a.j) - uuTien.indexOf(b.j))[0];

  // xếp phạt đền: bóng lên chấm, thủ môn trên vạch, người sút lùi lấy đà, mọi người khác đứng hai hàng ngoài vòng cấm
  const xepPen = (off, da) => {
    const s = huong(off), G = khungNha(off), cham = { x: C.x - s * (L.R - 110), y: C.y }, m = new Map();
    const nguoi = nguoiDa(da), gk = tren().find((b) => b.tm && b.doi === off), gkDa = tren().find((b) => b.tm && b.doi === da);
    m.set(bong, cham); m.set(nguoi, { x: cham.x + s * 64, y: cham.y + 22 });
    if (gk) m.set(gk, { x: G.x + s * 24, y: C.y });
    if (gkDa) m.set(gkDa, { x: C.x - huong(da) * (xMieng - 55), y: C.y });
    // như ngoài đời: ba hàng so le ngoài mép vòng cấm (cách mép 30–150 px), lệch nhẹ từng người, ai ở trên đứng trên — không xếp cột
    const xBox = C.x - s * (L.R - 150), con = tren().filter((b) => !m.has(b)).sort((a, b) => a.position.y - b.position.y);
    const nh = Math.ceil(con.length / 3), cho = con.map((_, k) => { const h = k % 3, j = Math.floor(k / 3), lech = ((k * 37) % 11) / 11 - 0.5;
      return { x: xBox + s * (32 + h * 58 + lech * 26), y: C.y + (j - (nh - 1) / 2) * 62 + (h - 1) * 20 + lech * 14 }; }).sort((a, b) => a.y - b.y);
    con.forEach((b, k) => m.set(b, kep(cho[k])));
    return { m, nguoi, B: cham, chamDa: { x: cham.x + s * (L.r + L.rBong + 1), y: cham.y + 6 } };
  };
  // xếp đá phạt trực tiếp: hàng rào 3 người cách bóng 78 px chắn hướng khung, thủ môn trong khung, người khác lùi ≥ 95 px
  const xepFK = (off, da, B0) => {
    const s = huong(off), G = khungNha(off), B = kep(B0, 60), ud = Math.hypot(G.x - B.x, G.y - B.y);
    const u = { x: (G.x - B.x) / ud, y: (G.y - B.y) / ud }, n = { x: -u.y, y: u.x }, m = new Map();
    const nguoi = nguoiDa(da); m.set(bong, B); m.set(nguoi, kep({ x: B.x - u.x * 42, y: B.y - u.y * 42 }));
    const gk = tren().find((b) => b.tm && b.doi === off); if (gk) m.set(gk, { x: G.x + s * 24, y: C.y + Math.max(-30, Math.min(30, (B.y - C.y) * 0.25)) });
    tren().filter((b) => b.doi === off && !b.tm && !b.doThe).sort((a, b) => kc(a, { position: B }) - kc(b, { position: B })).slice(0, 3)
      .forEach((b, k) => m.set(b, kep({ x: B.x + u.x * 78 + n.x * (k - 1) * 44, y: B.y + u.y * 78 + n.y * (k - 1) * 44 })));
    for (const b of tren()) if (!m.has(b)) {
      let p = { x: b.position.x, y: b.position.y }; const dx = p.x - B.x, dy = p.y - B.y, d = Math.hypot(dx, dy) || 1;
      if (d < 95) p = { x: B.x + (dx / d) * 95, y: B.y + (dy / d) * 95 };
      m.set(b, kep(p));
    }
    return { m, nguoi, B };
  };
  // đá phạt nhanh (xa khung): người bị phạm lỗi đặt bóng, đối phương lùi ≥ 80 px
  const xepNhanh = (off, da, B0, nan) => {
    const B = kep(B0, 40), m = new Map(); m.set(bong, B);
    const nguoi = nan.ra ? nguoiDa(da) : nan; m.set(nguoi, kep({ x: B.x - huong(da) * 40, y: B.y }));
    for (const b of tren()) if (!m.has(b)) {
      let p = { x: b.position.x, y: b.position.y }; const dx = p.x - B.x, dy = p.y - B.y, d = Math.hypot(dx, dy) || 1;
      if (d < 80) p = { x: B.x + (dx / d) * 80, y: B.y + (dy / d) * 80 };
      m.set(b, kep(p));
    }
    return { m, nguoi, B };
  };

  const da = (kieu, off, x) => {
    const t = now(), nguoi = x.nguoi, s = huong(off), G = khungNha(off), B = { x: bong.position.x, y: bong.position.y };
    trangThai = 'choi'; camLoi = t + L.loi.cam; moc = Math.max(0, khung.length - Math.round(0.6 * L.fps));
    chamCuoi = nguoi; lichCham.push({ b: nguoi, t }); suKien.push({ t: +t.toFixed(3), k: 'q', i: idx(nguoi), l: 9 });
    for (const b of tren()) Body.setVelocity(b, { x: 0, y: 0 });
    const huongToi = (p, toc) => { const dx = p.x - B.x, dy = p.y - B.y, d = Math.hypot(dx, dy) || 1; return { x: (dx / d) * toc, y: (dy / d) * toc, d }; };
    if (kieu === 'pen') {
      const r = ng(); let ay = (r < 0.42 ? -1 : r < 0.84 ? 1 : 0) * L.mieng * 0.36;
      if (ng() < 0.08) ay = (ng() < 0.5 ? -1 : 1) * (L.mieng / 2 + 25);
      const v = huongToi({ x: G.x - s * 30, y: C.y + ay }, L.pen.toc); Body.setVelocity(bong, v);
      const gk = tren().find((b) => b.tm && b.doi === off), q = ng(), lan = q < 0.45 ? -1 : q < 0.9 ? 1 : 0;
      if (gk) gk.lan = { vx: 0, vy: lan * L.pen.lan, het: t + L.pen.lanDai };
      daDang = { t, doi: 1 - off, loai: 'pen', i: idx(nguoi), lan, ay: Math.sign(ay) };
    } else if (kieu === 'fk') {
      const ay = ng() < 0.75 ? (ng() < 0.5 ? -1 : 1) * (L.mieng / 2 - 16) : (ng() < 0.5 ? -1 : 1) * (L.mieng / 2 + 22);
      const v = huongToi({ x: G.x - s * 20, y: C.y + ay }, L.fk.toc), Nf = v.d / (2 * L.fk.toc), a = (ng() < 0.5 ? -1 : 1) * (0.012 + ng() * 0.01), q = -a * Nf / 2;
      Body.setVelocity(bong, { x: v.x * Math.cos(q) - v.y * Math.sin(q), y: v.x * Math.sin(q) + v.y * Math.cos(q) });
      bong.collisionFilter.mask = 0x0001; bay = { ...B }; cong = { a, n: Math.round(Nf * 1.3) };
      daDang = { t, doi: 1 - off, loai: 'fk', i: idx(nguoi) };
    } else {
      const ban_ = tren().filter((b) => b.doi === nguoi.doi && b !== nguoi && !b.tm).sort((a, b) => kc(a, nguoi) - kc(b, nguoi))[0];
      Body.setVelocity(bong, ban_ ? huongToi(ban_.position, 9) : { x: huong(nguoi.doi) * 9, y: 0 });
      daDang = { t, doi: 1 - off, loai: 'nhanh', i: idx(nguoi) };
    }
  };

  const xuLoi = (o, t) => {
    const { nan, pham, x, y } = o, off = pham.doi, doiDa = nan.doi, fL = khung.length - 1;
    const kieuTai = (px, py) => (trongCam(off, px, py) ? 'pen' : Math.hypot(px - khungNha(off).x, py - C.y) < L.loi.gan ? 'fk' : 'nhanh');
    // trọng tài nhìn lệch ±tranTrai px → có khi thổi phạt đền cho lỗi ngoài vòng cấm (hoặc ngược lại); VAR sửa
    const kieu = kieuTai(x, y), goi = kieuTai(x + (ng() - 0.5) * 2 * L.var.tranTrai, y + (ng() - 0.5) * 2 * L.var.tranTrai);
    const soatPen = (goi === 'pen' || kieu === 'pen') && soVar < L.var.phatToiDa && (goi !== kieu || ng() < L.var.pPen);
    const kp = soatPen ? kieu : goi;   // kiểu đá cuối cùng: có VAR thì theo sự thật, không thì theo trọng tài
    let the = null; const r = ng();
    if (!pham.tm && r < L.loi.do) the = 'do';
    else if (r < L.loi.do + L.loi.vang * (kp === 'pen' ? 1.6 : 1)) the = pham.vang ? 'vang2' : 'vang';
    if (the === 'vang') pham.vang = 1;
    if (the === 'do' || the === 'vang2') pham.doThe = 1;
    tk.loi[off]++; if (the) tk[the === 'vang' ? 'vang' : 'do'][off]++;
    soDung += 0.25 + (the ? 0.4 : 0) + (kp === 'pen' ? 0.5 : 0);
    suKien.push({ t: +t.toFixed(3), k: 'loi', i: idx(pham), nan: idx(nan), ten: pham.ten, so: pham.so, tenNan: nan.ten, x: r1(x), y: r1(y), kieu: kp, goi, the, doi: off });
    suKien.push({ t: +t.toFixed(3), k: 'coi', loai: 'loi' });
    sutDang = null; daDang = null; cong = null; if (bay) { bay = null; z = 0; bong.collisionFilter.mask = MASK_BONG; }
    viec.push({ loai: 'tha', dai: 0.5, tt: { x, y } });
    if (the) viec.push({ loai: 'cho', dai: 1.4, tt: pham, vao: () => suKien.push({ t: +now().toFixed(3), k: 'the', i: idx(pham), ten: pham.ten, so: pham.so, mau: the, doi: off }) });
    // VAR soát phạt đền: chiếu chậm pha va chạm → đóng băng, khoanh vòng cấm + điểm phạm lỗi → kết luận
    if (soatPen) {
      soVar++; soDung += 0.8;
      const mocNay = moc, ket = goi === kieu ? (kieu === 'pen' ? 'giu' : 'giu') : kieu === 'pen' ? 'pen' : 'huy';
      viec.push({ loai: 'cho', dai: L.var.cho, tt: { x, y }, vao: () => suKien.push({ t: +now().toFixed(3), k: 'var', loai: 'pen', goi, doi: off }) });
      viec.push({ fn: () => chenReplay(fL, { t: +t.toFixed(3), i: idx(nan), doi: doiDa }, { a: Math.max(mocNay, fL - Math.round(1.2 * L.fps)), b: Math.min(khung.length - 1, fL + Math.round(0.3 * L.fps)), toc: 0.5, var: 'pen' }) });
      viec.push({ fn: () => dongBang(fL, L.var.dong, { loai: 'pen', x: r1(x), y: r1(y), doi: off, trong: kieu === 'pen', ket }) });
      viec.push({ loai: 'cho', dai: L.var.kq, tt: { x, y }, vao: () => suKien.push({ t: +now().toFixed(3), k: 'varKq', loai: 'pen', ket, kieu, goi, doi: off, ly: kieu === 'pen' ? 'trong vong cam' : 'ngoai vong cam' }) });
    }
    // chấn thương: người bị phạm lỗi nằm sân, y tế vào; có khi phải cáng ra (thay người nếu còn quyền thay)
    if (!nan.tm && !nan.ra && the !== 'do' && ng() < L.dau.p) {
      const cang = ng() < L.dau.cang; nan.dau = true; soDung += cang ? 1.2 : 0.6;
      viec.push({ loai: 'cho', dai: L.dau.chua, tt: nan, vao: () => suKien.push({ t: +now().toFixed(3), k: 'dau', i: idx(nan), ten: nan.ten, so: nan.so, doi: nan.doi, cang, dai: L.dau.chua }) });
      if (cang) {
        const c = soThay[nan.doi] < 5 ? banGhe(nan.doi, nan.vt) : null;
        viec.push({ loai: 'xep', dai: L.dau.cangDai, den: () => new Map([[nan, TUNNEL]]), tt: nan, vao: () => suKien.push({ t: +now().toFixed(3), k: 'cang', i: idx(nan), dai: L.dau.cangDai }) });
        if (c) {
          soThay[nan.doi]++;
          viec.push({ fn: () => { suKien.push({ t: +now().toFixed(3), k: 'thay', doi: nan.doi, i: idx(nan), raSo: nan.so, raTen: nan.ten, vaoSo: c.so, vaoTen: c.ngan, ly: 'dau', di: 0 }); ganThay(nan, c); nan.dau = false; } });
          viec.push({ loai: 'xep', dai: 0.9, den: () => new Map([[nan, CHO_THAY(nan.doi)]]) });
        } else viec.push({ fn: () => { daRa.push({ doi: nan.doi, so: nan.so, ten: nan.ten, vt: nan.vt, tm: nan.tm, bt: nan.bt, st: nan.st, cu: nan.cu, doThe: 0 }); duoi(nan); } });
      } else viec.push({ fn: () => { nan.dau = false; } });
    }
    viec.push(...thayKeHoach());
    let xp = null;
    viec.push({
      loai: 'xep', dai: kp === 'pen' ? L.choPen : L.choFK,
      den: () => { xp = kp === 'pen' ? xepPen(off, doiDa) : kp === 'fk' ? xepFK(off, doiDa, { x, y }) : xepNhanh(off, doiDa, { x, y }, nan); if (pham.doThe) xp.m.set(pham, TUNNEL); return xp.m; },
      get tt() { return xp?.B ?? { x, y }; },
      xong: () => { if (pham.doThe) duoi(pham); },
    });
    viec.push({ loai: 'cho', dai: kp === 'pen' ? 1.1 : kp === 'fk' ? 0.6 : 0.2, get tt() { return xp?.B; }, vao: () => { suKien.push({ t: +now().toFixed(3), k: 'coi', loai: 'da' }); if (kp === 'pen') suKien.push({ t: +now().toFixed(3), k: 'tim', dai: 1.4 }); } });
    if (kp === 'pen') viec.push({ loai: 'xep', dai: 0.35, den: () => new Map([[xp.nguoi, xp.chamDa]]), get tt() { return xp?.B; } });
    viec.push({ fn: () => da(kp, off, xp) });
  };

  const ketHiep = (t) => {
    sutDang = null; daDang = null; cong = null; if (bay) { bay = null; z = 0; bong.collisionFilter.mask = MASK_BONG; }
    for (const b of ct) b.lan = null;
    if (hiep === 1) {
      suKien.push({ t: +t.toFixed(3), k: 'coi', loai: 'hiep', s: [...tiSo], tk: anhTk() });
      trangThai = 'nghi';
      viec.push({ loai: 'tha', dai: 0.6 }, { loai: 'xep', dai: L.nghi - 1.3, den: () => viTriGiao(1) }, { loai: 'cho', dai: 0.6 }, { fn: () => { hiep = 2; phut = L.hiep; soDung = 0; giao(1, 'bd'); } });
    } else {
      // cầu thủ xuất sắc nhất: bàn ×3, sút trúng ×0,7, cứu thua ×1,2, đội thắng +1, thẻ đỏ −3
      const thang = tiSo[0] === tiSo[1] ? -1 : tiSo[0] > tiSo[1] ? 0 : 1;
      const diemCT = (b) => b.bt * 3 + b.st * 0.7 + b.cu * 1.2 + (b.doi === thang ? 1 : 0) - b.doThe * 3;
      // xét cả người đã rời sân (thay ra / cáng) — số liệu giữ trong daRa
      const ung = [...ct.filter((b) => !b.ra || b.doThe).map((b) => ({ i: idx(b), doi: b.doi, so: b.so, ten: b.ten, bt: b.bt, st: b.st, cu: b.cu, doThe: b.doThe })), ...daRa.map((x) => ({ i: -1, ...x }))];
      const best = ung.sort((a, b) => diemCT(b) - diemCT(a))[0];
      ketThuc = { t: +t.toFixed(3), s: [...tiSo], thang, tk: anhTk(), motm: best.i, motmCT: { so: best.so, ten: best.ten, doi: best.doi, bt: best.bt, st: best.st, cu: best.cu } };
      suKien.push({ t: +t.toFixed(3), k: 'coi', loai: 'kt', s: [...tiSo] });
      trangThai = 'het'; viec.push({ loai: 'tha', dai: 1.2 });
    }
  };

  const phatHienSut = (t) => {
    const last = lichCham[lichCham.length - 1];
    if (!last || last === sutTouch || t - last.t > 0.2) return;
    const v = bong.velocity; if (Math.hypot(v.x, v.y) < 7.5) return;
    const d = last.b.doi, gx = C.x + huong(d) * xMieng, dx = gx - bong.position.x;
    if (v.x * huong(d) <= 0 || Math.abs(dx) > 400) return;
    const yp = bong.position.y + v.y * (dx / v.x) - C.y;
    if (Math.abs(yp) > L.mieng / 2 + 45) return;
    sutTouch = last; const trung = Math.abs(yp) < L.mieng / 2;
    tk.sut[d]++; if (trung) { tk.trung[d]++; last.b.st++; }
    sutDang = { t, doi: d, i: idx(last.b), trung, loai: daDang && daDang.doi === d ? daDang.loai : null };
    suKien.push({ t: +t.toFixed(3), k: 'sut', doi: d, i: idx(last.b), trung });
  };

  const buocChoi = (t) => {
    const goc = hiep === 1 ? L.hiep : 2 * L.hiep;
    if (phut >= goc - 1 && !them[hiep - 1]) { them[hiep - 1] = Math.max(1, Math.min(5, Math.round(1 + soDung))); suKien.push({ t: +t.toFixed(3), k: 'them', hiep, n: them[hiep - 1] }); }
    if (them[hiep - 1] && phut >= goc + them[hiep - 1]) { ketHiep(t); return; }
    vatLy(() => laiChoi(t));
    phut += 1 / (L.fps * L.nhip);
    if (chamCuoi) tk.kiem[chamCuoi.doi]++;
    phatHienSut(t);
    const vaoTrai = bong.position.x < C.x - xMieng - L.rBong - 2 && Math.abs(bong.position.y - C.y) < L.mieng / 2;
    const vaoPhai = bong.position.x > C.x + xMieng + L.rBong + 2 && Math.abs(bong.position.y - C.y) < L.mieng / 2;
    if (vaoTrai || vaoPhai) {
      const doi = vaoTrai ? 1 : 0; tiSo[doi]++;
      // người ghi bàn = cầu thủ đội ghi bàn chạm bóng gần nhất trong 4 s; không có ai = phản lưới của người chạm cuối
      const sut = [...lichCham].reverse().find((x) => x.b.doi === doi && t - x.t < 4)?.b;
      const nguoiB = sut ?? chamCuoi, phanLuoi = !sut && !!chamCuoi;
      const loai = daDang && !daDang.xong && daDang.doi === doi && t - daDang.t < 2 && daDang.loai !== 'nhanh' ? daDang.loai : null;
      const mt = phut > goc ? Math.ceil(phut - goc) : 0;
      const bn = { t: +t.toFixed(3), k: 'ban', doi, i: nguoiB ? idx(nguoiB) : -1, ten: nguoiB?.ten, so: nguoiB?.so, pl: phanLuoi, m: Math.max(1, Math.min(goc, Math.ceil(phut))), mt, loai, s: [...tiSo] };
      if (sut) sut.bt++;
      ban.push(bn); suKien.push(bn); soDung += 0.6;
      sutDang = null; daDang = null; cong = null; loiCho = null;
      const fG = khung.length;
      const nguoiMung = sut ?? tren().filter((b) => b.doi === doi && !b.tm).sort((a, b) => kc(a, bong) - kc(b, bong))[0];
      const y0 = Math.sign(nguoiMung.position.y - C.y) || 1;
      const gocMung = { x: C.x + huong(doi) * Math.cos(0.8) * (L.R - 50), y: C.y + y0 * Math.sin(0.8) * (L.R - 50) };
      viec.push({ loai: 'mung', dai: L.mung, nguoi: nguoiMung, doi, goc: gocMung });
      viec.push({ fn: () => chenReplay(fG, bn) });
      // VAR soát việt vị: đo ở khoảnh khắc đồng đội chuyền cho người ghi bàn (bàn từ bóng sống, không phản lưới)
      let vv = null;
      if (sut && !phanLuoi && !loai && soVar < L.var.phatToiDa) {
        const lc = [...lichCham].reverse(); let k = 0;
        while (k < lc.length && lc[k].b === sut) k++;
        const pass = lc[k], fP = pass ? Math.min(khung.length - 1, Math.round(pass.t * L.fps)) : -1;
        if (pass && pass.b.doi === doi && fP >= moc && khung[fP] && !khung[fP].r) {
          const K = khung[fP], ps = ct0.map((c, j) => ({ doi: c.doi, x: K.p[j][0] })).filter((q) => q.x > -900);
          const s_ = huong(doi), xa = K.p[idx(sut)][0], ya = K.p[idx(sut)][1], hang = hangVV(doi, ps, K.p[BI][0]);
          const lech = s_ * (xa - C.x) - hang, viet = lech > 0 && s_ * (xa - C.x) > 0;
          if (viet || Math.abs(lech) < L.var.sat || ng() < L.var.p) vv = { fP, viet, xa, ya, xd: C.x + s_ * hang, lech: r1(lech), j: idx(pass.b) };
        }
      }
      if (vv) {
        soVar++; soDung += 0.9;
        const mocNay = moc, ket = vv.viet ? 'huy' : 'ok';
        viec.push({ loai: 'tha', dai: L.var.cho, vao: () => suKien.push({ t: +now().toFixed(3), k: 'var', loai: 'ban', doi, i: bn.i }) });
        viec.push({ fn: () => chenReplay(vv.fP, bn, { a: Math.max(mocNay, vv.fP - Math.round(1.0 * L.fps)), b: Math.min(fG, vv.fP + Math.round(0.3 * L.fps)), toc: 0.5, var: 'ban' }) });
        viec.push({ fn: () => dongBang(vv.fP, L.var.dong, { loai: 'ban', i: bn.i, j: vv.j, doi, xa: r1(vv.xa), ya: r1(vv.ya), xd: r1(vv.xd), lech: vv.lech, ket }) });
        viec.push({ loai: 'cho', dai: L.var.kq, vao: () => {
          if (vv.viet) { tiSo[doi]--; bn.huy = true; sut.bt--; }
          suKien.push({ t: +now().toFixed(3), k: 'varKq', loai: 'ban', ket, doi, i: bn.i, ten: bn.ten, ly: vv.viet ? 'viet vi' : 'hop le', s: [...tiSo] });
        } });
      }
      viec.push(...thayKeHoach());
      if (vv?.viet) {
        // bàn bị huỷ: đội phòng ngự đá phạt gián tiếp tại chỗ việt vị
        let xp = null; const nanVV = tren().filter((b) => b.doi !== doi && !b.tm).sort((a, b) => Math.hypot(a.position.x - vv.xa, a.position.y - vv.ya) - Math.hypot(b.position.x - vv.xa, b.position.y - vv.ya))[0];
        viec.push({ loai: 'xep', dai: L.choFK + 0.4, den: () => { xp = xepNhanh(doi, 1 - doi, { x: vv.xa, y: vv.ya }, nanVV); return xp.m; }, get tt() { return xp?.B; } });
        viec.push({ loai: 'cho', dai: 0.5, get tt() { return xp?.B; }, vao: () => suKien.push({ t: +now().toFixed(3), k: 'coi', loai: 'da' }) });
        viec.push({ fn: () => da('nhanh', doi, xp) });
      } else {
        viec.push({ loai: 'xep', dai: L.veVi, den: () => viTriGiao(1 - doi) });
        viec.push({ loai: 'cho', dai: L.choGiao });
        viec.push({ fn: () => giao(1 - doi, 'giao') });
      }
      chamCuoi = null; lichCham = [];
      return;
    }
    if (loiCho) { xuLoi(loiCho, t); loiCho = null; return; }
    if (daDang && t - daDang.t > 1.2) {
      if (daDang.loai === 'pen' && !daDang.xong) suKien.push({ t: +t.toFixed(3), k: 'truot', doi: daDang.doi, i: daDang.i, loai: 'pen' });
      daDang = null;
    }
  };

  // trọng tài: chạy theo bóng lệch 130 px về phía trống; lúc dừng trận chạy tới chỗ phạm lỗi / người bị thẻ / vòng giữa sân
  const capTT = () => {
    let d;
    if (ttDen) d = { x: ttDen.x - 60, y: ttDen.y - 70 };
    else if (trangThai === 'choi' && !viec.length) d = { x: bong.position.x - 40, y: bong.position.y + (bong.position.y > C.y ? -130 : 130) };
    else d = { x: C.x, y: C.y - 140 };
    d = kep(d, 30);
    const dx = d.x - tt.x, dy = d.y - tt.y, dd = Math.hypot(dx, dy), m = Math.min(dd, L.trongTai);
    if (dd > 1) { tt.x += (dx / dd) * m; tt.y += (dy / dd) * m; }
  };
  const ghi = () => {
    const k = { m: +phut.toFixed(2), h: hiep, s: [...tiSo], c: chamCuoi ? idx(chamCuoi) : -1, p: [...tatCa.map((b) => (b.ra ? [-999, -999, 0] : [r1(b.position.x), r1(b.position.y), +b.angle.toFixed(3)])), [r1(tt.x), r1(tt.y), 0]] };
    if (z > 0.5) k.z = +z.toFixed(1);
    khung.push(k);
  };

  datViTri(viTriGiao(0));
  while (khung.length < 600 * L.fps) {
    const t = now();
    if (trangThai === 'dau' && t >= L.dauGiay) giao(0, 'bd');
    if (viec.length) chayViec(t);
    else if (trangThai === 'choi') buocChoi(t);
    capTT(); ghi();
    if (ketThuc && t >= ketThuc.t + L.cuoiGiay) break;
  }
  return {
    seed, kieu: 'tran', luat: L, doi: DOI, bi: BI, ct: ct0, troi, san, daRa,
    khung, suKien, ban, ketThuc, them, xuyen, DAI: khung.length / L.fps, dauGiay: L.dauGiay, cham: tk.cham,
  };
}

// chấm kịch tính: 3–7 bàn, cả hai đội cùng ghi, có lật / gỡ hoà, bàn cuối trận, phạt đền, đá phạt thành bàn, thẻ đỏ, trúng cột, bàn phút bù giờ
export function chamTran(g) {
  if (!g.ketThuc) return { diem: -1 };
  const b = g.ban.filter((x) => !x.huy), n = b.length, [a, c] = g.ketThuc.s, ev = (k) => g.suKien.filter((e) => e.k === k);
  let doiDan = 0, lat = 0, prev = 0;
  for (const x of b) { const d = Math.sign(x.s[0] - x.s[1]); if (d !== 0 && prev !== 0 && d !== prev) lat++; if (d === 0) doiDan++; if (d !== 0) prev = d; }
  let diem = 100 - g.xuyen * 40;
  if (n < 3) diem -= (3 - n) * 18; if (n > 7) diem -= (n - 7) * 10;
  if (a === c) diem -= 25;
  if (!a || !c) diem -= 12;
  diem += doiDan * 8 + lat * 14;
  const cuoi = b.filter((x) => x.m >= 75).length; diem += Math.min(cuoi, 2) * 9;
  if (Math.abs(a - c) === 1) diem += 10;
  const quyetDinh = b.length && Math.abs(a - c) === 1 ? b[b.length - 1].m : 0; if (quyetDinh >= 80) diem += 10;
  const loi = ev('loi'), pen = loi.filter((e) => e.kieu === 'pen').length, fk = loi.filter((e) => e.kieu === 'fk').length;
  const penBan = b.filter((x) => x.loai === 'pen').length, fkBan = b.filter((x) => x.loai === 'fk').length;
  const doThe = ev('the').filter((e) => e.mau !== 'vang').length, cot = ev('cot').length, cuuPen = ev('cuu').filter((e) => e.loai === 'pen').length;
  const bu = b.filter((x) => x.mt > 0 && x.m === 90).length;
  diem += Math.min(pen, 2) * 8 + Math.min(fk, 2) * 3 + fkBan * 12 + Math.min(doThe, 1) * 8 + Math.min(cot, 2) * 4 + bu * 10 + cuuPen * 6;
  const varN = ev('var').length, huy = ev('varKq').filter((e) => e.ket === 'huy' || e.ket === 'pen').length, dau = ev('dau').length, thay = ev('thay').length;
  diem += Math.min(varN, 2) * 4 + Math.min(huy, 1) * 8 + Math.min(dau, 1) * 3;
  if (loi.length < 2) diem -= 6; if (loi.length > 8) diem -= (loi.length - 8) * 4;
  if (g.DAI > 300) diem -= (g.DAI - 300) * 0.5;
  return { diem: +diem.toFixed(1), tiSo: `${a}-${c}`, ban: n, goHoa: doiDan, lat, cuoi, loi: loi.length, pen, penBan, fk, fkBan, doThe, cot, bu, varN, huy, dau, thay, troi: g.troi, dai: Math.round(g.DAI), xuyen: g.xuyen };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
  const DOI = JSON.parse(readFileSync(arg('doi', new URL('./tran-doi.json', import.meta.url).pathname), 'utf8'));
  if (arg('do')) {
    const [a, b] = arg('do').split('-').map(Number), kq = [];
    for (let s = a; s <= b; s++) kq.push({ seed: s, ...chamTran(tran(s, DOI)) });
    kq.sort((x, y) => y.diem - x.diem);
    console.table(kq.slice(0, Number(arg('top', 10))));
    const tb = (k) => (kq.reduce((s, x) => s + (x[k] ?? 0), 0) / kq.length).toFixed(2);
    console.log(`trung bình ${kq.length} trận: bàn ${tb('ban')} · lỗi ${tb('loi')} · phạt đền ${tb('pen')} (vào ${tb('penBan')}) · đá phạt ${tb('fk')} (vào ${tb('fkBan')}) · thẻ đỏ ${tb('doThe')} · cột ${tb('cot')} · VAR ${tb('varN')} (đổi ${tb('huy')}) · chấn thương ${tb('dau')} · thay ${tb('thay')} · dài ${tb('dai')} s`);
  } else {
    const g = tran(Number(arg('seed', 1)), DOI);
    const ph = (x) => `${x.m}${x.mt ? '+' + x.mt : ''}'`;
    console.log(JSON.stringify(chamTran(g)));
    console.log(g.ban.map((x) => `${ph(x)} ${DOI.doi[x.doi].ngan} ${x.ten ?? '?'}${x.pl ? ' (OG)' : ''}${x.huy ? ' (VAR huỷ)' : ''}${x.loai ? ` (${x.loai})` : ''}`).join(' · '));
    console.log(g.suKien.filter((e) => ['loi', 'the', 'cot', 'cuu', 'truot', 'them', 'varKq', 'dau', 'thay'].includes(e.k)).map((e) => `${e.t.toFixed(1)}s ${e.k}${e.kieu ? ':' + e.kieu : ''}${e.ket ? ':' + e.ket : ''}${e.mau ? ':' + e.mau : ''}${e.n ? '+' + e.n : ''} ${e.ten ?? e.raTen ?? ''}${e.vaoTen ? '→' + e.vaoTen : ''}`).join(' | '));
    writeFileSync(arg('ra', 'ghi.json'), JSON.stringify(g));
  }
}
