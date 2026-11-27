#!/usr/bin/env node
// tra-repo-ok: đã tra máy vật lý 28/11/2026 (matter-js MIT 18,7k sao đang bảo trì · planck.js · rapier archived) → dùng matter-js; tệp này là luật trò chơi + ghi hình.
// MÔ PHỎNG "AI SỐNG SÓT TRONG VÒNG XOAY" (kênh vật lý, ý tưởng #4 dang-kenh.json) — anh 28/11/2026 "Làm đi. Khi nào ra đc video ok mới tạo kênh".
// Mô phỏng chạy ở Node (bước cố định 1/120 s, cùng hạt giống = cùng phim), ghi vị trí từng khung + sự kiện va chạm → trang vat-ly.html chỉ VẼ lại bản ghi
// (tua tới bất kỳ giây nào, dựng song song được, hai lần dựng ra y hệt). Sự kiện va chạm đi tiếp vào tieng.mjs làm tiếng.
//   node mo-phong.mjs --seed 7 --ra ghi.json          → một bản ghi
//   node mo-phong.mjs --do 1-300 [--top 5]            → chạy nhanh nhiều hạt giống, chấm độ kịch tính, in bảng (bước 4)
import Matter from 'matter-js';
import { writeFileSync } from 'node:fs';

const { Engine, Bodies, Body, Composite, Events } = Matter;

// 30 nước — mã ISO cho cờ flag-icons (MIT)
export const NUOC = [
  ['us', 'USA'], ['cn', 'China'], ['in', 'India'], ['br', 'Brazil'], ['ru', 'Russia'], ['jp', 'Japan'], ['de', 'Germany'], ['gb', 'UK'],
  ['fr', 'France'], ['it', 'Italy'], ['es', 'Spain'], ['ca', 'Canada'], ['mx', 'Mexico'], ['kr', 'South Korea'], ['au', 'Australia'],
  ['id', 'Indonesia'], ['tr', 'Turkey'], ['sa', 'Saudi Arabia'], ['ar', 'Argentina'], ['za', 'South Africa'], ['eg', 'Egypt'], ['ng', 'Nigeria'],
  ['vn', 'Vietnam'], ['th', 'Thailand'], ['ph', 'Philippines'], ['pk', 'Pakistan'], ['pl', 'Poland'], ['ua', 'Ukraine'], ['se', 'Sweden'], ['nl', 'Netherlands'],
];

// rng có hạt giống (mulberry32) — Math.random cấm trong mô phỏng
const rng = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export const LUAT = {
  R: 440,            // bán kính trong của vòng (px, khung 1920×1080, tâm 540,540)
  r: 26,             // bán kính bi
  day: 22,           // độ dày vòng
  khe0: 60,          // độ rộng khe lúc đầu (px) vừa lọt bi 52 px: chỉ cú đâm gần thẳng góc mới thoát
  khePhut: 26,       // khe nở thêm mỗi phút (px) — đảm bảo trò chơi kết thúc
  Rmin: 190,         // VÒNG CO theo số bi còn sống (440 → 190 lúc còn 2): trận chung kết chật, không trống trải
  coTocDo: 18,       // px/s — vòng co từ từ
  quay: 0.55,        // tốc độ quay vòng (rad/s)
  trongLuc: 0,       // không trọng lực: bi nảy như khí (kiểu CodeCraftedPhysics); bi bị loại thì tự rơi
  toc: 7,            // tốc độ bi giữ cố định (px / 16,7 ms) — va chạm đổi hướng, không mất đà
  nay: 1,            // độ nảy bi
  fps: 30, buoc: 4,  // 30 khung/s, 4 bước vật lý mỗi khung (1/120 s)
  dauGiay: 3,        // 3 s mở: bi rơi vào, khe chưa mở
  cuoiGiay: 6,       // 6 s kết: vinh danh người thắng
  tranGiay: 260,
};

const doan = 72;   // số đoạn tạo vòng

export function moPhong(seed, L = LUAT) {
  const ng = rng(seed * 9973 + 17);
  const eng = Engine.create({ gravity: { x: 0, y: L.trongLuc }, positionIterations: 10, velocityIterations: 8 });
  Matter.Common._seed = seed;   // matter dùng Common.random cho vài chỗ — ghim lại
  const C = { x: 540, y: 540 };
  // vòng = 72 đoạn tĩnh; khe = các đoạn có góc nằm trong [goc, goc+khe] được rút khỏi thế giới
  // đoạn rộng theo bán kính lớn nhất — vòng co thì các đoạn chồng lên nhau, không hở
  const ring = Array.from({ length: doan }, (_, i) => {
    const a = (i / doan) * Math.PI * 2, rr = L.R + L.day / 2, w = ((2 * Math.PI * rr) / doan) * 1.08;
    const b = Bodies.rectangle(C.x + Math.cos(a) * rr, C.y + Math.sin(a) * rr, w, L.day, { isStatic: true, angle: a + Math.PI / 2, restitution: 1, friction: 0, label: `vong${i}` });
    b.a0 = a; b.trong = true; return b;
  });
  Composite.add(eng.world, ring);
  // bi: xếp lưới trong vòng, trộn thứ tự theo hạt giống, đẩy vận tốc đầu ngẫu nhiên
  const thuTu = NUOC.map((_, i) => i).sort(() => ng() - 0.5);
  const bi = [];
  let k = 0;
  for (let hang = 0; hang < 6 && k < NUOC.length; hang++) for (let cot = 0; cot < 6 && k < NUOC.length; cot++) {
    const x = C.x - 2.5 * 62 + cot * 62 + (ng() - 0.5) * 8, y = C.y - 300 + hang * 62 + (ng() - 0.5) * 8;
    const i = thuTu[k++];
    const b = Bodies.circle(x, y, L.r, { restitution: L.nay, friction: 0.002, frictionAir: 0.0004, density: 0.002, label: `bi${i}` });
    Body.setVelocity(b, { x: (ng() - 0.5) * 8, y: (ng() - 0.5) * 4 });
    b.id_ = i; b.song = true; bi.push(b);
  }
  Composite.add(eng.world, bi);

  const dt = 1000 / (L.fps * L.buoc);
  const khung = [], suKien = [], bxh = [];   // bxh = thứ tự bị loại (đầu = loại sớm nhất)
  let goc = ng() * Math.PI * 2, f = 0, ketThuc = null, R = L.R, xuyen = 0;
  let vaChamKhung = [];
  Events.on(eng, 'collisionStart', (e) => {
    for (const p of e.pairs) {
      const A = p.bodyA, B = p.bodyB, va = Math.hypot(A.velocity.x - B.velocity.x, A.velocity.y - B.velocity.y);
      if (va < 1.2) continue;
      const vong = A.label.startsWith('vong') || B.label.startsWith('vong');
      const b = A.label.startsWith('bi') ? A : B;
      vaChamKhung.push({ k: vong ? 'v' : 'b', i: b.id_, l: +va.toFixed(1) });
    }
  });

  const gioiHan = L.tranGiay * L.fps;
  while (f < gioiHan) {
    const t = f / L.fps;
    const mo = t >= L.dauGiay && !ketThuc;
    const conSong = bi.filter((b) => b.song).length;
    const Rdich = L.Rmin + ((L.R - L.Rmin) * Math.max(0, conSong - 2)) / (NUOC.length - 2);
    R = Math.max(Rdich, R - L.coTocDo / L.fps);
    const khe = mo ? (L.khe0 + (L.khePhut * (t - L.dauGiay)) / 60) / R : 0;   // khe tính theo px → đổi ra rad theo bán kính hiện tại
    for (let s = 0; s < L.buoc; s++) {
      goc += (L.quay * dt) / 1000;
      for (const b of ring) {
        const a = b.a0 + goc, rr = R + L.day / 2;
        const trongKhe = mo && ((((b.a0 - 0) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) < khe;
        if (trongKhe && b.trong) { Composite.remove(eng.world, b); b.trong = false; }
        if (!trongKhe && !b.trong) { Composite.add(eng.world, b); b.trong = true; }
        Body.setPosition(b, { x: C.x + Math.cos(a) * rr, y: C.y + Math.sin(a) * rr });
        Body.setAngle(b, a + Math.PI / 2);
      }
      Engine.update(eng, dt);
    }
    // giữ tốc độ không đổi cho bi còn sống; bi đã loại rơi theo trọng lực tự đặt
    for (const b of bi) {
      if (b.boDi) continue;
      if (b.song) { const v = Math.hypot(b.velocity.x, b.velocity.y) || 1; Body.setVelocity(b, { x: (b.velocity.x / v) * L.toc, y: (b.velocity.y / v) * L.toc }); }
      else Body.setVelocity(b, { x: b.velocity.x * 0.99, y: b.velocity.y + 0.9 });
    }
    // bi ra ngoài vòng = bị loại
    for (const b of bi) {
      if (!b.song) continue;
      const d = Math.hypot(b.position.x - C.x, b.position.y - C.y);
      if (d > R + L.day + L.r + 4) {
        b.song = false; bxh.push(b.id_);
        // bi phải ra QUA KHE — ra chỗ khác = xuyên tường (lỗi vật lý), ghi lại để máy chọn hạt giống loại bỏ
        const da = ((Math.atan2(b.position.y - C.y, b.position.x - C.x) - goc) % (2 * Math.PI) + 4 * Math.PI) % (2 * Math.PI);
        if (da > khe + 0.25 && da < 2 * Math.PI - 0.25) xuyen++;
        suKien.push({ t: +t.toFixed(3), k: 'loai', i: b.id_, con: bi.filter((x) => x.song).length });
      }
    }
    for (const v of vaChamKhung) suKien.push({ t: +t.toFixed(3), ...v });
    vaChamKhung = [];
    // bi đã rơi khỏi màn thì bỏ khỏi thế giới cho nhẹ
    for (const b of bi) if (!b.song && !b.boDi && b.position.y > 1300) { Composite.remove(eng.world, b); b.boDi = true; }
    khung.push({ g: +goc.toFixed(4), khe: +khe.toFixed(4), R: +R.toFixed(1), p: bi.map((b) => (b.boDi ? null : [Math.round(b.position.x * 10) / 10, Math.round(b.position.y * 10) / 10, +b.angle.toFixed(3)])) });
    f++;
    const con = bi.filter((b) => b.song);
    if (!ketThuc && con.length === 1) { ketThuc = { t, thang: con[0].id_ }; suKien.push({ t: +t.toFixed(3), k: 'thang', i: con[0].id_ }); }
    if (ketThuc && t >= ketThuc.t + L.cuoiGiay) break;
  }
  const idx = bi.map((b) => b.id_);   // thứ tự bi trong p[] → mã nước
  return { seed, luat: L, nuoc: NUOC, idx, khung, suKien, bxh, ketThuc, xuyen, DAI: khung.length / L.fps };
}

// chấm kịch tính: dài 2–3,5 phút, nhịp loại đều (không loại ồ ạt đầu trận), trận chung kết (2 bi cuối) đủ dài, đầu trận không loại quá nhanh
export function cham(g) {
  if (!g.ketThuc) return { diem: -1, ly_do: 'không kết thúc' };
  const loai = g.suKien.filter((e) => e.k === 'loai').map((e) => e.t), T = g.ketThuc.t;
  const chungKet = T - loai[loai.length - 2], ba = T - loai[loai.length - 3];
  let dongLoat = 0; for (let i = 1; i < loai.length; i++) if (loai[i] - loai[i - 1] < 0.6) dongLoat++;
  const dauTien = loai[0];
  let diem = 100 - g.xuyen * 50;
  if (T < 110) diem -= (110 - T) * 1.2; if (T > 210) diem -= (T - 210) * 1.2;
  diem -= Math.max(0, dongLoat - 6) * 4;
  diem += Math.min(chungKet, 45) * 0.8 - (chungKet < 10 ? 20 : 0);
  diem += Math.min(ba, 70) * 0.2;
  if (dauTien < 6) diem -= 10;
  return { diem: +diem.toFixed(1), T: +T.toFixed(1), chungKet: +chungKet.toFixed(1), dongLoat, xuyen: g.xuyen, thang: g.nuoc[g.ketThuc.thang][1] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
  if (arg('do')) {
    const [a, b] = arg('do').split('-').map(Number), kq = [];
    for (let s = a; s <= b; s++) { const g = moPhong(s); kq.push({ seed: s, ...cham(g) }); }
    kq.sort((x, y) => y.diem - x.diem);
    console.table(kq.slice(0, Number(arg('top', 10))));
    if (arg('ra')) writeFileSync(arg('ra'), JSON.stringify(kq));
  } else {
    const g = moPhong(Number(arg('seed', 1)));
    console.log(JSON.stringify(cham(g)));
    writeFileSync(arg('ra', 'ghi.json'), JSON.stringify(g));
  }
}
