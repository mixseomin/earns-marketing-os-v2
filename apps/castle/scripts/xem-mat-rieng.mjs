#!/usr/bin/env node
// XEM MẶT DỰNG RIÊNG THEO ẢNH CHỤP (mặt Torbau hướng sân dưới — du-lieu/<lâu>-mat-torbau-san.json, mattien.js banDoMat / datMatRieng):
// mở trang (không ảnh 3D, cổng trống), in mốc ngang (x ảnh → s mét), độ cao gờ / mái hiên khung, cạnh bị khoá, rồi BẢNG QUY ĐỔI từng phần tử
// (s, bề ngang, đáy → đỉnh tuyệt đối, mặt tường nhận) + phần tử bị bỏ vì không có tường ở độ cao đó. Soát số trước khi chụp so / trọng tài.
//   node apps/castle/scripts/xem-mat-rieng.mjs [--lau neuschwanstein]
// tra-repo-ok: keo nội bộ (Playwright qua chung.mjs), dữ liệu riêng của cảnh.
import { moTrang } from './chung.mjs';
const { pg, dong } = await moTrang({ nhanLog: '[ns] mặt Torbau' });
const kq = await pg.evaluate(() => {
  const M = window.__ns.matTb?.(); if (!M) return null;
  const { bo, bd, viTri } = M, r2 = (v) => +v.toFixed(2), dong = [];
  const them = (loai, ten, x, x0, x1, yTren, yDuoi) => { const s = bd.s(x), y0 = bd.y(x, yDuoi), y1 = bd.y(x, yTren), p = viTri(s, (y0 + y1) / 2);
    dong.push({ loai, ten, s: r2(s), rong: r2(bd.m(x0, x1)), y0: r2(y0), y1: r2(y1), mat: p?.mat || '— KHÔNG CÓ TƯỜNG' }); };
  for (const c of bo.cum || []) { const xs = c.o.flat(); them('cụm ' + c.o.length + ' ô', c.ten, (Math.min(...xs) + Math.max(...xs)) / 2, Math.min(...xs), Math.max(...xs), c.vom ? c.vom[2] : c.dinhO, c.bau); }
  for (const o of bo.oTron || []) them('ô tròn', o.ten, o.x, o.x - o.r, o.x + o.r, o.y - o.r, o.y + o.r);
  for (const d of bo.dieMVom || []) them('diềm vòm', d.ten, (d.tu + d.den) / 2, d.tu, d.den, d.y0, d.y1);
  for (const c of bo.cuaDi || []) them('cửa đi', c.ten, (c.o[0] + c.o[1]) / 2, c.o[0], c.o[1], c.vien[2], c.dinhO);
  if (bo.loGia) them('lô-gia', bo.loGia.ten, (bo.loGia.hop[0] + bo.loGia.hop[1]) / 2, bo.loGia.hop[0], bo.loGia.hop[1], bo.loGia.maiTren, bo.loGia.conXon[1]);
  if (bo.dongHo) them('đồng hồ', bo.dongHo.ten, bo.dongHo.x, bo.dongHo.x - bo.dongHo.r, bo.dongHo.x + bo.dongHo.r, bo.dongHo.y - bo.dongHo.r, bo.dongHo.y + bo.dongHo.r);
  // toạ độ KHUNG (u trái → phải nhìn từ ngoài, v chân → mái hiên — cùng cách scripts/kiem-ke.mjs) của từng chi tiết đã ghi sổ trên các mặt bị khoá
  const kk = window.__ns.kiemKe().filter((e) => M.khoa.includes(e.mat) && e.x != null).map((e) => { const f = window.__ns.matTuong(e.mat), [nx, nz] = f.n, rx = nz, rz = -nx;
    const trai = f.p[0] * rx + f.p[1] * rz < f.q[0] * rx + f.q[1] * rz ? f.p : f.q; return { mat: e.mat, loai: e.loai, u: +(((e.x - trai[0]) * rx + (e.z - trai[1]) * rz) / f.L).toFixed(3), v: +((e.y - f.yDat) / (f.y1 - f.yDat)).toFixed(3), d: +(e.y - f.yDat).toFixed(2) }; });
  const cong = (window.__ns.VOM_CONG || []).map((c) => ({ mat: c.mat, day: r2(c.y), cao: r2(c.cao ?? (c.y1 - c.y)), rong: r2(c.w) })); // mọi vòm cổng: mặt tường, đáy lỗ, cao, rộng
  return { neo: M.neo.map(([x, s]) => [x, r2(s), r2(bd.s(x))]), yGo: r2(M.yGo), yMai: r2(M.yMai), khoa: M.khoa, dung: M.dung, cong, dong, kk };
});
await dong();
if (!kq) { console.error('trang không có mặt Torbau dựng theo ảnh (thiếu tệp / mốc)'); process.exit(1); }
console.log('mốc ngang [x ảnh, s mốc, s ánh xạ]:', JSON.stringify(kq.neo));
console.log(`gờ chia tầng ${kq.yGo} m · mái hiên khung ${kq.yMai} m · khoá ${kq.khoa.length} mặt: ${kq.khoa.join(' ')}`);
console.log('đã dựng:', JSON.stringify(kq.dung));
console.log('vòm cổng:', JSON.stringify(kq.cong));
console.log('sổ kiểm kê (mặt bị khoá) — u, v theo khung chính mặt đó, d = mét trên chân tường:');
for (const e of kq.kk) console.log(`  ${e.mat.padEnd(18)} ${e.loai.padEnd(9)} u ${e.u} · v ${e.v} · d ${e.d}`);
for (const d of kq.dong) console.log(`${d.loai.padEnd(9)} s ${String(d.s).padStart(6)} · rộng ${String(d.rong).padStart(5)} · ${d.y0} → ${d.y1} m · ${d.mat} · ${d.ten}`);
