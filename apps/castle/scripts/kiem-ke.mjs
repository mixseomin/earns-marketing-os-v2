#!/usr/bin/env node
// KIỂM KÊ THEO VÙNG: so số chi tiết ĐẾM TRÊN ẢNH (public/du-lieu/<lâu>-kiem-ke.json) với số chi tiết MÔ HÌNH ĐÃ DỰNG (window.__ns.kiemKe(): mỗi cửa sổ, cổng,
// răng cưa, tháp canh, neo, gờ, ô vuông, cửa mái… ghi { mat: "khối#cạnh" | "khối#mai" | "khối#*", loai, y }).
// Mỗi mặt (nhóm cạnh OSM) chia VÙNG theo độ cao tuyệt đối (đỉnh / thân trên / thân dưới / chân / toàn) — đếm từng loại trong từng vùng → THIẾU / THỪA / khớp.
// Thứ tự kiểm (QUY-TRINH.md §3b): 1) KHUNG tổng thể mảng tường (tỉ lệ cao/rộng, đỉnh/rộng đo trên ảnh) → 2) thành phần ĐẾM ĐƯỢC + VỊ TRÍ trong khung
// (u: 0 trái → 1 phải nhìn từ ngoài, v: 0 chân tường → 1 mái hiên) → 3) TƯƠNG QUAN (thẳng cột, cùng hàng) → 4) HOA VĂN / HOẠ TIẾT.
// khung: { "mat": "khối#cạnh" (mặt làm khung), "ti_le_cao_rong": số (ảnh), "sai": 0.06 } · vùng: "vi_tri": { loại: [[u, v], …] } · "quan_he": [["thang_cot", loạiA, loạiB], ["cung_hang", loại]]
//   node apps/castle/scripts/kiem-ke.mjs --lau neuschwanstein        (thoát 1 nếu còn THIẾU)
// tra-repo-ok: so đếm nội bộ trên dữ liệu riêng của cảnh.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { du, moTrang } from './chung.mjs';
const tep = du('kiem-ke'); if (!existsSync(tep)) { console.error('chưa có', tep); process.exit(1); }
const KK = JSON.parse(readFileSync(tep, 'utf8'));
const { pg, dong } = await moTrang();
const ds = await pg.evaluate(() => window.__ns.kiemKe()), chong = await pg.evaluate(() => window.__ns.chongLan()), loLung = await pg.evaluate(() => window.__ns.cuaLoLung());
const KHUNG = {}; for (const m of KK.mat) if (m.khung?.mat) KHUNG[m.khung.mat] = await pg.evaluate((id) => window.__ns.matTuong(id), m.khung.mat);
await dong();
let saiKhung = 0, saiViTri = 0, saiQH = 0;
// toạ độ khung (u, v) của một điểm trên mặt: u theo chiều phải nhìn từ NGOÀI (phải = (nz, −nx)), v từ mặt đất trước tường tới mái hiên
const uv = (f, x, y, z) => { const rx = f.n[1], rz = -f.n[0], a = f.p[0] * rx + f.p[1] * rz, b = f.q[0] * rx + f.q[1] * rz, lo = Math.min(a, b), W = Math.abs(b - a); return [(x * rx + z * rz - lo) / W, (y - f.yDat) / (f.y1 - f.yDat)]; };
const GOP_Y = new Set(KK.gop_theo_do_cao || ['go_ngang']); // loại đếm theo SỐ ĐỘ CAO khác nhau (gờ chạy vòng nhiều mặt = 1 gờ)
const khop = (mat, mau) => mau.endsWith('#*') ? mat.startsWith(mau.slice(0, -1)) : mat === mau;
let thieu = 0, thua = 0, dung = 0;
// KẾT QUẢ THEO MẶT cho lớp 🧭 Kiểm trên trang (danhgia.js): { "khối#cạnh" | "khối#*" | "khối#mai": { ten, khop, loi: [câu], loai_sai: [loại] } } → du-lieu/<lâu>-kiem-ke-kq.json
const KQ = {}; let kqM = null; const ghiLoi = (cau, loai) => { kqM.loi.push(cau); if (loai) kqM.loai_sai.push(loai); };
for (const m of KK.mat) {
  kqM = { ten: m.ten, anh: m.anh, khop: 0, loi: [], loai_sai: [] }; for (const g of m.nhom) KQ[g] = kqM;
  const cua = ds.filter((e) => m.nhom.some((g) => khop(e.mat, g)));
  console.log(`\n■ ${m.ten}  [${m.nhom.join(', ')}]  · ảnh: ${m.anh}`);
  const f = m.khung?.mat ? KHUNG[m.khung.mat] : null;
  if (m.khung?.ti_le_cao_rong && f) { const tl = (f.y1 - f.yDat) / f.L, d = Math.abs(tl / m.khung.ti_le_cao_rong - 1), sai = m.khung.sai ?? 0.06; if (d > sai) { saiKhung++; ghiLoi(`sai KHUNG ${(d * 100).toFixed(0)} % (cao/rộng ${tl.toFixed(2)}, ảnh ${m.khung.ti_le_cao_rong})`, 'khung'); } else kqM.khop++;
    console.log(`  KHUNG ${m.khung.mat}: cao/rộng mô hình ${tl.toFixed(3)} (rộng ${f.L.toFixed(1)} m, chân ${f.yDat.toFixed(1)} → mái hiên ${f.y1.toFixed(1)}) · ảnh ${m.khung.ti_le_cao_rong} → lệch ${(d * 100).toFixed(0)} %  ${d > sai ? 'SAI KHUNG' : 'khớp'}`); }
  for (const [vung, v] of Object.entries(m.vung)) {
    // vùng theo KHUNG (tu_v / den_v: 0 chân → 1 mái hiên) khi có khung — ranh tuyệt đối (tu / den, mét) lệch ngay khi khung đổi
    const trong = cua.filter((e) => (f && (v.tu_v != null || v.den_v != null) && e.x != null) ? (() => { const vv = uv(f, e.x, e.y, e.z)[1]; return vv >= (v.tu_v ?? -9) && vv < (v.den_v ?? 9); })() : (f && (v.tu_d != null || v.den_d != null)) ? e.y - f.yDat >= (v.tu_d ?? -1e9) && e.y - f.yDat < (v.den_d ?? 1e9) : e.y >= (v.tu ?? -1e9) && e.y < (v.den ?? 1e9)); // tu_d / den_d: mét trên chân tường khung
    for (const [loai, nAnh] of Object.entries(v.dem)) {
      const e = trong.filter((x) => x.loai === loai), nMh = GOP_Y.has(loai) ? new Set(e.map((x) => x.y.toFixed(1))).size : e.length;
      const tt = nMh < nAnh ? 'THIẾU' : nMh > nAnh ? 'thừa' : 'khớp'; if (tt === 'THIẾU') thieu++; else if (tt === 'thừa') thua++; else dung++;
      if (tt === 'khớp') kqM.khop++; else ghiLoi(`${vung}: ${loai} ảnh ${nAnh} · mô hình ${nMh} (${tt})`, loai);
      console.log(`  ${vung.padEnd(10)} ${loai.padEnd(10)} ảnh ${String(nAnh).padStart(3)} · mô hình ${String(nMh).padStart(3)}  ${tt}`);
      const vt = v.vi_tri?.[loai]; if (vt && f) { // VỊ TRÍ: ghép gần nhất từng điểm ảnh ↔ điểm mô hình
        const mh = e.filter((x) => x.x != null).map((x) => uv(f, x.x, x.y, x.z)), con = mh.slice(); let max = 0, xau = null;
        for (const [ua, va] of vt) { let bi = -1, bd = 1e9; con.forEach(([um, vm], i) => { const dd = Math.hypot(um - ua, vm - va); if (dd < bd) { bd = dd; bi = i; } }); if (bi < 0) { max = 1; xau = [ua, va, null]; break; } if (bd > max) { max = bd; xau = [ua, va, con[bi]]; } con.splice(bi, 1); }
        const sai = (v.sai_vi_tri ?? 0.06), hong = max > sai; if (hong) { saiViTri++; ghiLoi(`${vung}: ${loai} sai vị trí ${(max * 100).toFixed(0)} % khung`, loai); } else kqM.khop++;
        console.log(`    ↳ vị trí ${loai}: lệch lớn nhất ${(max * 100).toFixed(0)} % khung${xau ? ` (ảnh u ${xau[0]} v ${xau[1]} ↔ mô hình ${xau[2] ? `u ${xau[2][0].toFixed(2)} v ${xau[2][1].toFixed(2)}` : 'không có'})` : ''}  ${hong ? 'SAI VỊ TRÍ' : 'khớp'}`); }
    }
    for (const [kieu, a, b] of v.quan_he || []) { if (!f) continue; const pa = cua.filter((x) => x.loai === a && x.x != null).map((x) => uv(f, x.x, x.y, x.z)), pb = cua.filter((x) => x.loai === (b || a) && x.x != null).map((x) => uv(f, x.x, x.y, x.z));
      const ok = kieu === 'thang_cot' ? pa.every(([u]) => pb.some(([u2]) => Math.abs(u2 - u) < 0.04)) : kieu === 'cung_hang' ? pa.filter(([, vv]) => vv >= (v.tu_v ?? -9) && vv < (v.den_v ?? 9)).every(([, vv], _, arr) => Math.abs(vv - arr[0][1]) < 0.03) : true;
      if (!ok) { saiQH++; ghiLoi(`${vung}: tương quan ${kieu} ${a}${b ? '↔' + b : ''} sai`, a); } else kqM.khop++; console.log(`    ↳ tương quan ${kieu} ${a}${b ? ' ↔ ' + b : ''}: ${ok ? 'khớp' : 'SAI'}`); }
  }
}
const matChong = [...new Set(chong.map((c) => c.mat))];
for (const c of chong) { (KQ[c.mat] ??= { ten: c.mat, khop: 0, loi: [], loai_sai: [] }).loi.push(`ô cửa chồng lấn tại s ${c.a[0]} / ${c.b[0]}`); KQ[c.mat].loai_sai.push('cua_so'); }
{ const cu = existsSync(du('kiem-ke-kq')) ? JSON.parse(readFileSync(du('kiem-ke-kq'), 'utf8')) : null; if (JSON.stringify(cu?.mat) !== JSON.stringify(KQ)) writeFileSync(du('kiem-ke-kq'), JSON.stringify({ luc: new Date().toISOString(), mat: KQ }, null, 1) + '\n'); }   // chỉ ghi khi KẾT QUẢ đổi: ghi lại mỗi lượt (dấu giờ mới) làm cây kỹ sư luôn bẩn → trọng tài đạt mà máy không đẩy được (16/11/2026) // CHỒNG LẤN toàn mô hình (mọi mặt, không riêng mặt đã kiểm kê)
console.log(`\nCHỒNG LẤN ô cửa: ${chong.length} cặp trên ${matChong.length} mặt${chong.length ? ' — ' + matChong.slice(0, 12).join(', ') : ''}`);
console.log(`\nCỬA LƠ LỬNG (ngoài chân–đỉnh tường của chính khối quá 1 m): ${loLung.length}${loLung.length ? ' — ' + loLung.slice(0, 6).map((x) => `${x.mat} y ${x.y} (tường ${x.chan}–${x.dinh})`).join(' · ') : ''}`);
console.log(`\n${dung} khớp · ${thieu} THIẾU · ${thua} thừa · ${saiKhung} sai khung · ${saiViTri} sai vị trí · ${saiQH} sai tương quan`); process.exit(thieu || saiKhung || saiViTri || saiQH || chong.length || loLung.length ? 1 : 0);
