// Luật khớp Sprawl (roadmap 2c) — MỘT nguồn tỷ lệ + luật nối cho mọi máy sinh và bộ đếm lỗi theo luật.
// Ai dùng: scripts/quy-hoach.mjs (đặt tháp đỏ) · redspires.js (tầng, ban công, đường) · song.js (cầu nối) · nhat2200.js (tháp trắng, cao tốc, nút giao, làn bay).
// JS thuần, không THREE → node lẫn trình duyệt cùng nhập; máy sinh nào cũng hỏi lõi này, không tự đặt số riêng.
// tra-repo-ok: luật hình học nội bộ trên dữ liệu quy hoạch của chính Sprawl (lưới ô + khoảng cách đoạn thẳng), không có thư viện tương ứng

export const TL = {
  tang: 3.6,          // m / tầng — mọi tháp: gờ sàn, ban công, sàn vườn, cầu nối đều nằm trên bội số này tính từ chân tháp
  nguoi: 1.7,         // người đứng
  lanCan: 1.1,        // tay vịn ban công, cầu, cao tốc
  viaHe: 4,           // lùi tối thiểu từ mép đường tới mép dấu chân công trình
  khe: 14,            // khe hở tối thiểu giữa dấu chân hai tháp
  thon: 3,            // cao / rộng thân tối thiểu (tháp mảnh, không ra khối bè)
  vetDo: 1.35,        // dấu chân tháp đỏ = banKinh × vetDo (thân + ban công + tháp vệ tinh dáng 'chum')
  vetTrang: 1.1,      // dấu chân tháp trắng ở mặt đất = banKinh × vetTrang
  rMin: 18,           // banKinh nhỏ nhất của tháp
  cauMax: 130,        // nhịp cầu nối tối đa (mặt tháp → mặt tháp)
  cauDoc: 0.06,       // dốc cầu nối tối đa
  duong: { lon: 15, vua: 9, dibo: 7, pho: 3.5, tau: 4.5 }, // nửa bề rộng đường thật (redspires vẽ đúng số này)
  caoToc: { nua: 7.2, day: 2.6, cao: 46, song: 14, tinh: 9, doc: 0.07, ram: 160 }, // nửa rộng mặt · dầm · cao chạy · biên độ · tĩnh không chồng · dốc tối đa · nhánh nối
  bayTren: 14,        // xe bay cách mặt cao tốc / đỉnh công trình bên dưới
};
TL.caoToc.dinh = TL.caoToc.cao + TL.caoToc.song; // mặt cao tốc cao nhất (trên đất, chưa kể chồng nút giao)

export const batTang = (y) => Math.round(y / TL.tang) * TL.tang;
const dDoan = (x, z, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz, t = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l)) : 0; return Math.hypot(x - ax - t * dx, z - az - t * dz); };

// ---------- lưới ô các tuyến thật (đường + tàu) → hỏi khoảng hở tới mép đường gần nhất ----------
export function luoiTuyen(ql, O = 40) {
  const o = new Map(), k = (i, j) => i * 100003 + j;
  const them = (g, hw, lop) => { for (let i = 1; i < g.length; i++) { const [ax, az] = g[i - 1], [bx, bz] = g[i], s = { ax, az, bx, bz, hw, lop };
    for (let a = Math.floor((Math.min(ax, bx) - hw) / O); a <= Math.floor((Math.max(ax, bx) + hw) / O); a++)
      for (let b = Math.floor((Math.min(az, bz) - hw) / O); b <= Math.floor((Math.max(az, bz) + hw) / O); b++) { const kk = k(a, b); let l = o.get(kk); if (!l) o.set(kk, l = []); l.push(s); } } };
  for (const d of ql.daiLo) them(d.g, d.hw ?? TL.duong[d.lop] ?? TL.duong.vua, d.lop); // d.hw: tuyến thêm (cao tốc trên cao) mang bề rộng riêng
  for (const g of ql.pho) them(g, TL.duong.pho, 'pho');
  for (const g of ql.tau) them(g, TL.duong.tau, 'tau');
  // xa(x, z, tam): khoảng hở nhỏ nhất từ (x, z) tới MÉP tuyến (âm = đứng trên lòng đường), chỉ dò trong bán kính tam; trả cả lớp tuyến gần nhất
  const xa = (x, z, tam, chiLop) => { let m = Infinity, lop = null; const r = Math.ceil(tam / O);
    const i0 = Math.floor(x / O), j0 = Math.floor(z / O), da = new Set();
    for (let a = i0 - r; a <= i0 + r; a++) for (let b = j0 - r; b <= j0 + r; b++) for (const s of o.get(k(a, b)) || []) {
      if (da.has(s) || (chiLop && !chiLop.includes(s.lop))) continue; da.add(s); const d = dDoan(x, z, s.ax, s.az, s.bx, s.bz) - s.hw; if (d < m) { m = d; lop = s.lop; } }
    return { d: m, lop }; };
  return { xa };
}

// dấu chân tròn (x, z, r) có trống không: hở mép đường ≥ viaHe, hở mọi tháp đã đặt ≥ khe
export const oTrong = (luoi, ds, x, z, r) => luoi.xa(x, z, r + TL.viaHe + 1).d >= r + TL.viaHe && ds.every((q) => Math.hypot(q.x - x, q.z - z) >= r + q.r + TL.khe);
// dời vào khối trống gần nhất (vòng xoắn 6 m), không quá tamMax; null = không chỗ
export function doiVaoKhoi(luoi, ds, x, z, r, tamMax = 120) {
  if (oTrong(luoi, ds, x, z, r)) return [x, z];
  for (let d = 6; d <= tamMax; d += 6) { const n = Math.max(8, Math.round(d * 6.28 / 8));
    for (let i = 0; i < n; i++) { const a = (i / n) * 6.2832, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; if (oTrong(luoi, ds, px, pz, r)) return [px, pz]; } }
  return null;
}
// đặt một tháp theo luật: giữ chỗ (dời ≤ tamMax), không được thì thu bán kính tới rMin; trả { x, z, banKinh } hoặc null
export function datThap(luoi, ds, x, z, banKinh, vet, tamMax = 120) {
  for (let R = banKinh; R >= TL.rMin; R = R > TL.rMin && R * 0.85 < TL.rMin ? TL.rMin : R * 0.85) {
    const p = doiVaoKhoi(luoi, ds, x, z, R * vet, tamMax); if (p) return { x: p[0], z: p[1], banKinh: R };
    if (R === TL.rMin) break;
  }
  return null;
}
export const banKinhThon = (banKinh, cao, vet = 1) => Math.max(TL.rMin, Math.min(banKinh, cao / (2 * TL.thon * vet)));

// ---------- tuyến (polyline có độ cao) ----------
// giao cắt mặt bằng giữa hai polyline [[x, z]] → [{ i, j, fa, fb, x, z }] (đoạn i của A, đoạn j của B, tỷ lệ trên đoạn)
export function diemGiao(A, B) {
  const ra = [];
  for (let i = 1; i < A.length; i++) { const [ax, az] = A[i - 1], [bx, bz] = A[i];
    for (let j = 1; j < B.length; j++) { const [cx, cz] = B[j - 1], [dx, dz] = B[j], den = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx); if (!den) continue;
      const t = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / den, u = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / den;
      if (t >= 0 && t < 1 && u >= 0 && u < 1) ra.push({ i: i - 1, j: j - 1, fa: t, fb: u, x: ax + (bx - ax) * t, z: az + (bz - az) * t }); } }
  return ra;
}

// ---------- BỘ ĐẾM: mỗi luật một con số lỗi, đích 0 ----------
// the = { thap: [{ x, z, r, cao, rong, y0? }] (cao tính từ chân y0), cau: [{ ax, az, ra, bx, bz, rb, yA, yB, yAbs, yBabs, caoA, caoB }],
//         caoToc: [{ P: [[x, z]], y: [], d?: [] (mặt phố dưới từng điểm), ram?: bool }], bay: [{ x, z, y }], thapTren: [{ x, z, r, cao }] (vật cao cho cao tốc / làn bay né) }
// luoi = luoiTuyen(ql). Trả { luat: { ten: số lỗi }, vd: { ten: [mẫu đầu] } }.
export function kiem(luoi, the) {
  const luat = {}, vd = {}, loi = (ten, mau) => { luat[ten] = (luat[ten] || 0) + 1; (vd[ten] ||= []).length < 3 && vd[ten].push(mau); }, co = (ten) => { luat[ten] ||= 0; };
  const T = the.thap || [];
  if (the.thap) { co('thap-de-duong'); co('thap-chong-thap'); co('thap-be');
    for (const [i, t] of T.entries()) { const h = luoi.xa(t.x, t.z, t.r + TL.viaHe + 1); if (h.d < t.r + TL.viaHe - 0.5) loi('thap-de-duong', { i, lop: h.lop, hut: +(t.r + TL.viaHe - h.d).toFixed(1) });
      if (t.cao / t.rong < TL.thon - 0.01) loi('thap-be', { i, cao: Math.round(t.cao), rong: Math.round(t.rong) });
      for (let j = i + 1; j < T.length; j++) { const q = T[j], d = Math.hypot(q.x - t.x, q.z - t.z); if (d < t.r + q.r + TL.khe - 0.5) loi('thap-chong-thap', { i, j, d: Math.round(d) }); } } }
  if (the.cau) { for (const n of ['cau-lech-tang', 'cau-qua-dai', 'cau-xuyen-thap', 'cau-qua-dinh', 'cau-doc']) co(n);
    const lech = (y) => Math.abs(y / TL.tang - Math.round(y / TL.tang)) * TL.tang > 0.05;
    for (const [i, c] of the.cau.entries()) { const nhip = Math.hypot(c.bx - c.ax, c.bz - c.az) - c.ra - c.rb;
      if (lech(c.yA) || lech(c.yB)) loi('cau-lech-tang', { i, yA: +c.yA.toFixed(2), yB: +c.yB.toFixed(2) });
      if (nhip > TL.cauMax) loi('cau-qua-dai', { i, nhip: Math.round(nhip) });
      if (c.yA > c.caoA * 0.85 || c.yB > c.caoB * 0.85) loi('cau-qua-dinh', { i });
      if (Math.abs(c.yAbs - c.yBabs) / Math.max(1, nhip) > TL.cauDoc) loi('cau-doc', { i, doc: +(Math.abs(c.yAbs - c.yBabs) / Math.max(1, nhip)).toFixed(3) });
      for (const [k, t] of T.entries()) { if ((t.x === c.ax && t.z === c.az) || (t.x === c.bx && t.z === c.bz)) continue;
        if (dDoan(t.x, t.z, c.ax, c.az, c.bx, c.bz) < t.r + 5 && (t.y0 || 0) + t.cao > Math.min(c.yAbs, c.yBabs)) { loi('cau-xuyen-thap', { i, thap: k }); break; } } } }
  if (the.caoToc) { for (const n of ['caotoc-giao-cung-cao', 'caotoc-doc', 'caotoc-dau-ngoai-duong', 'caotoc-xuyen-thap']) co(n);
    const C = the.caoToc, yTai = (c, i, f) => c.y[i] + (c.y[i + 1] - c.y[i]) * f;
    for (let a = 0; a < C.length; a++) for (let b = a + 1; b < C.length; b++) for (const g of diemGiao(C[a].P, C[b].P)) {
      // nhánh nối chạm tuyến mẹ ở hai đầu là chỗ nhập làn, không phải giao cắt
      if ((C[a].ram && (C[a].me === b || C[a].con === b)) || (C[b].ram && (C[b].me === a || C[b].con === a))) continue;
      const d = Math.abs(yTai(C[a], g.i, g.fa) - yTai(C[b], g.j, g.fb)); if (d < TL.caoToc.tinh - 0.2) loi('caotoc-giao-cung-cao', { a, b, x: Math.round(g.x), z: Math.round(g.z), dy: +d.toFixed(1) }); }
    for (const [a, c] of C.entries()) { let dMax = 0; for (let i = 1; i < c.P.length; i++) { const L = Math.hypot(c.P[i][0] - c.P[i - 1][0], c.P[i][1] - c.P[i - 1][1]); if (L > 0.5 && !(c.d && c.y[i] - c.d[i] < 1.2 && c.y[i - 1] - c.d[i - 1] < 1.2)) dMax = Math.max(dMax, Math.abs(c.y[i] - c.y[i - 1]) / L); } // đoạn đang bám mặt phố (đáp đất) dốc theo phố, không tính vào trần dốc cao tốc
      if (dMax > TL.caoToc.doc + 0.005) loi('caotoc-doc', { a, doc: +dMax.toFixed(3) });
      if (!c.ram) for (const p of [c.P[0], c.P[c.P.length - 1]]) { const h = luoi.xa(p[0], p[1], 40, ['lon', 'vua']); if (h.d > 0) loi('caotoc-dau-ngoai-duong', { a, x: Math.round(p[0]), z: Math.round(p[1]), cach: +h.d.toFixed(1) }); }
      for (const [k, t] of (the.thapTren || []).entries()) for (let i = 0; i < c.P.length; i += 2) if (Math.hypot(c.P[i][0] - t.x, c.P[i][1] - t.z) < t.r + TL.caoToc.nua && (t.y0 || 0) + t.cao > c.y[i]) { loi('caotoc-xuyen-thap', { a, thap: k }); break; } } }
  if (the.bay) { co('bay-cat-caotoc'); co('bay-xuyen-thap');
    for (const [i, b] of the.bay.entries()) {
      for (const c of the.caoToc || []) { let cat = false; for (let k = 0; k < c.P.length && !cat; k += 2) cat = Math.hypot(c.P[k][0] - b.x, c.P[k][1] - b.z) < TL.caoToc.nua + 6 && Math.abs(b.y - c.y[k]) < TL.bayTren; if (cat) { loi('bay-cat-caotoc', { i, y: Math.round(b.y) }); break; } }
      for (const t of the.thapTren || []) if (Math.hypot(t.x - b.x, t.z - b.z) < t.r + 6 && b.y < (t.y0 || 0) + t.cao + TL.bayTren) { loi('bay-xuyen-thap', { i }); break; } } }
  return { luat, vd, tong: Object.values(luat).reduce((s, v) => s + v, 0) };
}
export const inKiem = (nhan, k) => `[khớp ${nhan}] ${k.tong} lỗi · ` + Object.entries(k.luat).map(([n, v]) => `${n} ${v}`).join(' · ');
