#!/usr/bin/env node
// XEM CẠNH KHỐI: in mọi cạnh của các khối nêu tên (chiều dài, hướng la bàn pháp tuyến ngoài, giữa cạnh, đỉnh tường, nền đất)
// kèm các mục window.__ns.thieuAnh() thuộc khối đó — để chọn ảnh nhìn đúng mặt trước khi đếm chi tiết (thẻ #1652 #1653 #1654).
//   node apps/castle/scripts/xem-canh-khoi.mjs way/223110818 way/223110820 …
// tra-repo-ok: keo nội bộ (Playwright qua chung.mjs), chỉ đọc sổ trên trang.
import { moTrang } from './chung.mjs';
const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const { pg, dong } = await moTrang({});
const kq = await pg.evaluate((ids) => {
  const thieu = window.__ns.thieuAnh(), r1 = (v) => (v == null ? null : +(+v).toFixed(1)), ra = {};
  for (const id of ids) {
    const d = [];
    for (let i = 0; i < 64; i++) { let f = null; try { f = window.__ns.matTuong(id + '#' + i); } catch { f = null; } if (!f || !f.p || !f.q) break;
      const [nx, nz] = f.n, huong = ((Math.atan2(nx, -nz) * 180 / Math.PI) + 360) % 360;
      d.push({ c: i, L: r1(f.L), huong: Math.round(huong), giua: [r1((f.p[0] + f.q[0]) / 2), r1((f.p[1] + f.q[1]) / 2)], yDat: r1(f.yDat), y1: r1(f.y1) }); }
    ra[id] = { canh: d, thieu: thieu.filter((s) => s.startsWith(id + '#')) };
  }
  return ra;
}, ids);
await dong();
for (const [id, v] of Object.entries(kq)) {
  console.log('■', id, '· thiếu', v.thieu.length);
  for (const c of v.canh) console.log(`  #${c.c}  dài ${c.L} m  hướng ${c.huong}°  giữa ${c.giua}  nền ${c.yDat}  đỉnh ${c.y1}`);
  for (const t of v.thieu) console.log('  THIẾU', t);
}
