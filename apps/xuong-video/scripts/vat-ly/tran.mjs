#!/usr/bin/env node
// tra-repo-ok: luật "trận đấu" cho máy mô phỏng vật lý (cùng matter-js với mo-phong.mjs) — anh 28/11/2026 "Thử trận đấu xem".
// TRẬN ĐẤU HAI ĐỘI trong sân tròn: mỗi đội 4 cầu thủ + 1 thủ môn (bóng tròn tốc độ cố định, tự lái về phía bóng / giữ khung),
// MỘT quả bóng đá nhẹ hơn, hai khung thành ở trái (đội 0 giữ) và phải (đội 1 giữ). Cầu thủ không vào được lưới (vạch cầu môn chỉ chặn cầu thủ),
// bóng vào lưới = bàn thắng cho đội kia; người chạm bóng cuối = người ghi bàn (cùng đội bên thủng lưới = phản lưới).
// 1 giây phim = 1 phút trận; hai hiệp 45', nghỉ giữa hiệp 2,5 s. Cùng hạt giống = cùng trận.
//   node tran.mjs --doi tran-doi.json --seed 7 --ra ghi.json
//   node tran.mjs --doi tran-doi.json --do 1-200 [--top 10]     → chấm độ kịch tính, in bảng
import Matter from 'matter-js';
import { readFileSync, writeFileSync } from 'node:fs';

const { Engine, Bodies, Body, Composite, Events } = Matter;
const rng = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export const LUAT_TRAN = {
  kieu: 'tran',
  cx: 960, cy: 540,
  R: 440, day: 22,
  mieng: 120,        // độ rộng khung thành (px)
  sau: 80,           // độ sâu lưới
  r: 28, rBong: 17,  // cầu thủ / bóng
  toc: 6.2, tocTM: 5.2, bongMax: 17,
  lai: [0.04, 0.09], // độ "bám bóng" của cầu thủ (ngẫu nhiên theo hạt giống) — 0 = nảy như khí, cao = lao vào bóng
  fps: 30, buoc: 4,
  dauGiay: 3, hiep: 45, nghi: 2.5, sauBan: 1.6, cuoiGiay: 6,
};

const CAT_VACH = 0x0002;

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

  // cầu thủ: đội 0 giữ khung trái (tấn công sang phải), đội 1 ngược lại. j = 0 là thủ môn.
  const ct = [];
  for (let d = 0; d < 2; d++) for (let j = 0; j < 5; j++) {
    const b = Bodies.circle(0, 0, L.r, { restitution: 1, friction: 0, frictionAir: 0, density: 0.003, label: 'ct', collisionFilter: { category: 0x0001, mask: 0x0001 | CAT_VACH } });
    b.doi = d; b.so = DOI.doi[d].so?.[j] ?? [1, 4, 6, 9, 10][j]; b.tm = j === 0; b.k = b.tm ? 0 : L.lai[0] + ng() * (L.lai[1] - L.lai[0]);
    ct.push(b);
  }
  const bong = Bodies.circle(C.x, C.y, L.rBong, { restitution: 0.92, friction: 0, frictionAir: 0.006, density: 0.0007, label: 'bong', collisionFilter: { category: 0x0001, mask: 0x0001 } });
  Composite.add(eng.world, [...ct, bong]);
  const tatCa = [...ct, bong];

  const giaoBong = (doiGiao) => {
    const vt = [[-380, 0], [-230, -150], [-230, 150], [-90, -70], [-110, 90]];
    for (const b of ct) {
      const s = b.doi === 0 ? 1 : -1, [x, y] = vt[ct.indexOf(b) % 5];
      Body.setPosition(b, { x: C.x + s * x + (ng() - 0.5) * 20, y: C.y + y * s + (ng() - 0.5) * 20 });
      const a = ng() * Math.PI * 2; Body.setVelocity(b, { x: Math.cos(a) * L.toc, y: Math.sin(a) * L.toc });
    }
    Body.setPosition(bong, { x: C.x, y: C.y + (ng() - 0.5) * 30 }); Body.setVelocity(bong, { x: (doiGiao === 0 ? 1 : -1) * 2, y: (ng() - 0.5) * 2 });
  };
  giaoBong(0);

  const dt = 1000 / (L.fps * L.buoc);
  const khung = [], suKien = [], ban = [];
  let chamCuoi = null, vaCham = [], xuyen = 0, lichCham = [];
  Events.on(eng, 'collisionStart', (e) => {
    for (const p of e.pairs) {
      const A = p.bodyA, B = p.bodyB, va = Math.hypot(A.velocity.x - B.velocity.x, A.velocity.y - B.velocity.y);
      const coBong = A === bong || B === bong, khac = A === bong ? B : A;
      if (coBong && khac.label === 'ct') { chamCuoi = khac; lichCham.push({ b: khac, t: f / L.fps }); if (va > 1) vaCham.push({ k: 'q', i: ct.indexOf(khac), l: +va.toFixed(1) }); continue; }
      if (va < 1.5) continue;
      if (coBong && (khac.label === 'vong' || khac.label === 'luoi')) vaCham.push({ k: khac.label === 'luoi' ? 'l' : 'v', i: 10, l: +va.toFixed(1) });
      else if (A.label === 'ct' && B.label === 'ct') vaCham.push({ k: 'b', i: ct.indexOf(A), l: +va.toFixed(1) });
    }
  });

  // máy trạng thái: dau (giới thiệu) → choi → (sau bàn: choi tiếp ít giây rồi giao bóng) → nghi (giữa hiệp) → choi → het
  let t = 0, phut = 0, f = 0, trangThai = 'dau', hen = L.dauGiay, hiep = 1, tiSo = [0, 0], ketThuc = null, dongBang = false;
  const ghi = () => khung.push({ m: +phut.toFixed(2), s: [...tiSo], p: tatCa.map((b) => [Math.round(b.position.x * 10) / 10, Math.round(b.position.y * 10) / 10, +b.angle.toFixed(3)]) });
  while (f < 400 * L.fps) {
    t = f / L.fps;
    if (trangThai === 'dau' && t >= hen) { trangThai = 'choi'; suKien.push({ t: +t.toFixed(3), k: 'coi', loai: 'bd' }); }
    if (trangThai === 'nghi' && t >= hen) { trangThai = 'choi'; hiep = 2; giaoBong(1); suKien.push({ t: +t.toFixed(3), k: 'coi', loai: 'bd' }); }
    if (trangThai === 'banVao' && t >= hen) { trangThai = 'choi'; giaoBong(ban[ban.length - 1].doi === 0 ? 1 : 0); }
    dongBang = trangThai === 'dau' || trangThai === 'nghi' || trangThai === 'het';
    if (!dongBang) {
      for (let s = 0; s < L.buoc; s++) Engine.update(eng, dt);
      // lái: cầu thủ nhắm điểm sau lưng bóng (đẩy bóng về khung đối phương); thủ môn bám vạch khung theo trục y của bóng
      for (const b of ct) {
        const s = b.doi === 0 ? 1 : -1;
        let tx, ty, tocB = L.toc;
        if (b.tm) { tx = C.x - s * (xMieng - 55); ty = C.y + Math.max(-L.mieng / 2 - 10, Math.min(L.mieng / 2 + 10, (bong.position.y - C.y) * 0.6)); tocB = L.tocTM; }
        else {
          const gx = C.x + s * L.R, gy = C.y, dx = gx - bong.position.x, dy = gy - bong.position.y, dd = Math.hypot(dx, dy) || 1;
          tx = bong.position.x - (dx / dd) * (L.r + L.rBong); ty = bong.position.y - (dy / dd) * (L.r + L.rBong);
        }
        const ux = tx - b.position.x, uy = ty - b.position.y, ud = Math.hypot(ux, uy) || 1;
        let vx = b.velocity.x, vy = b.velocity.y; const v = Math.hypot(vx, vy) || 1;
        const k = b.tm ? (ud < 12 ? 0 : 0.35) : b.k;
        vx = vx / v + (ux / ud) * k; vy = vy / v + (uy / ud) * k;
        const n = Math.hypot(vx, vy) || 1, tocThuc = b.tm && ud < 12 ? 0.4 : tocB;
        Body.setVelocity(b, { x: (vx / n) * tocThuc, y: (vy / n) * tocThuc });
      }
      const vb = Math.hypot(bong.velocity.x, bong.velocity.y);
      if (vb > L.bongMax) Body.setVelocity(bong, { x: bong.velocity.x / vb * L.bongMax, y: bong.velocity.y / vb * L.bongMax });
      if (trangThai === 'choi') phut += 1 / L.fps;
    }
    // bóng thoát khỏi sân không qua miệng khung = xuyên tường (lỗi vật lý) → kéo về giữa, ghi lại để máy chấm loại hạt giống
    const db = Math.hypot(bong.position.x - C.x, bong.position.y - C.y);
    if (trangThai === 'choi') {
      const vaoTrai = bong.position.x < C.x - xMieng - L.rBong - 2 && Math.abs(bong.position.y - C.y) < L.mieng / 2;
      const vaoPhai = bong.position.x > C.x + xMieng + L.rBong + 2 && Math.abs(bong.position.y - C.y) < L.mieng / 2;
      if (vaoTrai || vaoPhai) {
        const doi = vaoTrai ? 1 : 0; tiSo[doi]++;
        // người ghi bàn = cầu thủ đội ghi bàn chạm bóng gần nhất trong 4 s (thủ môn đối phương đẩy chạm rồi bóng vẫn vào = vẫn tính cho người sút);
        // không có ai = phản lưới của người chạm cuối
        const sut = [...lichCham].reverse().find((x) => x.b.doi === doi && t - x.t < 4)?.b;
        const nguoiB = sut ?? chamCuoi, nguoi = nguoiB ? ct.indexOf(nguoiB) : -1, phanLuoi = !sut && !!chamCuoi;
        const bn = { t: +t.toFixed(3), k: 'ban', doi, i: nguoi, pl: phanLuoi, m: Math.min(90, Math.ceil(phut + (hiep === 2 ? 0 : 0))), s: [...tiSo] };
        ban.push(bn); suKien.push(bn); trangThai = 'banVao'; hen = t + L.sauBan; chamCuoi = null; lichCham = [];
      } else if (db > L.R + L.day + L.rBong + 6 && Math.abs(bong.position.y - C.y) > L.mieng / 2 + 8) { xuyen++; Body.setPosition(bong, { x: C.x, y: C.y }); Body.setVelocity(bong, { x: 0, y: 0 }); }
    }
    for (const b of ct) if (Math.hypot(b.position.x - C.x, b.position.y - C.y) > L.R + L.r + 30) { xuyen++; Body.setPosition(b, { x: C.x + (b.doi ? 200 : -200), y: C.y }); }
    for (const v of vaCham) suKien.push({ t: +t.toFixed(3), ...v });
    vaCham = [];
    if (trangThai === 'choi' && hiep === 1 && phut >= L.hiep) { phut = L.hiep; trangThai = 'nghi'; hen = t + L.nghi; suKien.push({ t: +t.toFixed(3), k: 'coi', loai: 'hiep', s: [...tiSo] }); giaoBong(1); }
    if ((trangThai === 'choi' || trangThai === 'banVao') && hiep === 2 && phut >= 2 * L.hiep && !ketThuc) {
      phut = 2 * L.hiep; trangThai = 'het'; ketThuc = { t, s: [...tiSo], thang: tiSo[0] === tiSo[1] ? -1 : tiSo[0] > tiSo[1] ? 0 : 1 };
      suKien.push({ t: +t.toFixed(3), k: 'coi', loai: 'kt', s: [...tiSo] });
    }
    ghi(); f++;
    if (ketThuc && t >= ketThuc.t + L.cuoiGiay) break;
  }
  return { seed, kieu: 'tran', luat: L, doi: DOI, ct: ct.map((b) => ({ doi: b.doi, so: b.so, tm: b.tm })), khung, suKien, ban, ketThuc, xuyen, DAI: khung.length / L.fps, dauGiay: L.dauGiay };
}

// chấm kịch tính: 3–7 bàn, cả hai đội cùng ghi, có lật / gỡ hoà, có bàn cuối trận (>75'), không hoà, không xuyên tường
export function chamTran(g) {
  if (!g.ketThuc) return { diem: -1 };
  const b = g.ban, n = b.length, [a, c] = g.ketThuc.s;
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
  return { diem: +diem.toFixed(1), tiSo: `${a}-${c}`, ban: n, goHoa: doiDan, lat, cuoi, xuyen: g.xuyen };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
  const DOI = JSON.parse(readFileSync(arg('doi', new URL('./tran-doi.json', import.meta.url).pathname), 'utf8'));
  if (arg('do')) {
    const [a, b] = arg('do').split('-').map(Number), kq = [];
    for (let s = a; s <= b; s++) kq.push({ seed: s, ...chamTran(tran(s, DOI)) });
    kq.sort((x, y) => y.diem - x.diem);
    console.table(kq.slice(0, Number(arg('top', 10))));
  } else {
    const g = tran(Number(arg('seed', 1)), DOI);
    console.log(JSON.stringify(chamTran(g)), g.ban.map((x) => `${x.m}' ${DOI.doi[x.doi].ngan}${x.pl ? ' (OG)' : ''}`).join(' · '));
    writeFileSync(arg('ra', 'ghi.json'), JSON.stringify(g));
  }
}
