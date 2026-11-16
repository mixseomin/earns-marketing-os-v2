#!/usr/bin/env node
// KIỂM KÊ THEO VÙNG: so số chi tiết ĐẾM TRÊN ẢNH (public/du-lieu/<lâu>-kiem-ke.json) với số chi tiết MÔ HÌNH ĐÃ DỰNG (window.__ns.kiemKe(): mỗi cửa sổ, cổng,
// răng cưa, tháp canh, neo, gờ, ô vuông, cửa mái… ghi { mat: "khối#cạnh" | "khối#mai" | "khối#*", loai, y }).
// Mỗi mặt (nhóm cạnh OSM) chia VÙNG theo độ cao tuyệt đối (đỉnh / thân trên / thân dưới / chân / toàn) — đếm từng loại trong từng vùng → THIẾU / THỪA / khớp.
// Thứ tự quét ảnh (QUY-TRINH.md §3b): thành phần ĐẾM ĐƯỢC trước (cửa, cửa mái, tháp, răng cưa…) rồi HOA VĂN / HOẠ TIẾT (huy hiệu, gờ, dải vòm, đá góc, neo…).
//   node apps/castle/scripts/kiem-ke.mjs --lau neuschwanstein        (thoát 1 nếu còn THIẾU)
// tra-repo-ok: so đếm nội bộ trên dữ liệu riêng của cảnh.
import { readFileSync, existsSync } from 'node:fs';
import { du, moTrang } from './chung.mjs';
const tep = du('kiem-ke'); if (!existsSync(tep)) { console.error('chưa có', tep); process.exit(1); }
const KK = JSON.parse(readFileSync(tep, 'utf8'));
const { pg, dong } = await moTrang();
const ds = await pg.evaluate(() => window.__ns.kiemKe()); await dong();
const GOP_Y = new Set(KK.gop_theo_do_cao || ['go_ngang']); // loại đếm theo SỐ ĐỘ CAO khác nhau (gờ chạy vòng nhiều mặt = 1 gờ)
const khop = (mat, mau) => mau.endsWith('#*') ? mat.startsWith(mau.slice(0, -1)) : mat === mau;
let thieu = 0, thua = 0, dung = 0;
for (const m of KK.mat) {
  const cua = ds.filter((e) => m.nhom.some((g) => khop(e.mat, g)));
  console.log(`\n■ ${m.ten}  [${m.nhom.join(', ')}]  · ảnh: ${m.anh}`);
  for (const [vung, v] of Object.entries(m.vung)) {
    const trong = cua.filter((e) => e.y >= (v.tu ?? -1e9) && e.y < (v.den ?? 1e9));
    for (const [loai, nAnh] of Object.entries(v.dem)) {
      const e = trong.filter((x) => x.loai === loai), nMh = GOP_Y.has(loai) ? new Set(e.map((x) => x.y.toFixed(1))).size : e.length;
      const tt = nMh < nAnh ? 'THIẾU' : nMh > nAnh ? 'thừa' : 'khớp'; if (tt === 'THIẾU') thieu++; else if (tt === 'thừa') thua++; else dung++;
      console.log(`  ${vung.padEnd(10)} ${loai.padEnd(10)} ảnh ${String(nAnh).padStart(3)} · mô hình ${String(nMh).padStart(3)}  ${tt}`);
    }
  }
}
console.log(`\n${dung} khớp · ${thieu} THIẾU · ${thua} thừa`); process.exit(thieu ? 1 : 0);
