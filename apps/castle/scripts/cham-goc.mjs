#!/usr/bin/env node
// CHẤM THEO BỘ GÓC CHUẨN — thước đo hình học chung cho người sửa, trọng tài máy và người phản biện (anh 16/11/2026: hệ tự phản biện, bước 3 không cần anh ngồi so).
// Mỗi góc trong public/du-lieu/<lâu>-goc-chuan.json: đặt camera, nạp ảnh 3D, đo MỌI khối thấy được bằng tia (window.__ns.doKhoiTheoTia: đỉnh thật − đỉnh mô hình,
// cùng cách đo). Gộp theo khối: trung vị lệch qua các góc đo tin được (≥ 4 cột, độ trải ≤ 3 m). Điểm chung = số khối lệch ≥ 1,5 m + trung bình |lệch|.
// KHÔNG dùng điểm so điểm ảnh (nhiễu: ảnh 3D nhoè + cây; thẻ #1623 sửa 5 khối mà điểm 59,6 → 60,2).
//   node apps/castle/scripts/cham-goc.mjs                    chấm, ghi apps/castle/.cham-goc/<giờ>.json + moi-nhat.json, in bảng xếp hạng lệch
//   node apps/castle/scripts/cham-goc.mjs --so <tệp cũ>      so với lượt trước: khối nào tốt lên / xấu đi (cổng trọng tài: thoát 1 nếu có khối xấu đi ≥ 1,5 m)
//   node apps/castle/scripts/cham-goc.mjs --so <cũ> --voi <mới>   so hai lượt đã chấm, không đo lại
//   node apps/castle/scripts/cham-goc.mjs --pha way/123:3    PHÁ THỬ: tạm nâng khối đó 3 m (không đổi tệp), thước phải báo khối đó lệch thêm ≈ −3 m
//   node apps/castle/scripts/cham-goc.mjs --goc ten1,ten2    chỉ chấm vài góc (nhanh)
//   node apps/castle/scripts/cham-goc.mjs --ghi <tệp>        ghi thêm kết quả ra tệp đó (trong-tai.mjs dùng)
//   node apps/castle/scripts/cham-goc.mjs --lap              lập lại tệp góc chuẩn (8 hướng quanh lâu đài + góc các thẻ báo lệch)
// tra-repo-ok: keo nội bộ trên dữ liệu riêng của cảnh (Playwright qua chung.mjs).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { GOC, du, moTrang } from './chung.mjs';
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const TEP_GOC = du('goc-chuan'), RA = join(GOC, '.cham-goc'); mkdirSync(RA, { recursive: true });
const NGUONG = 1.5;
// CỔNG TRỌNG TÀI: khối XẤU ĐI = sau sửa lệch ≥ 1,5 m VÀ tệ hơn trước ≥ 0,9 m (bài phá thử 16/11: nâng 3 m một khối đang lệch 0,9 → −2,1; luật cũ "tệ hơn ≥ 1,5" để lọt)
function soSanh(cu, kq, tenCu) {
  // lượt mới chỉ chấm vài góc → mốc cũ cũng chỉ lấy đúng các góc đó (trung vị tính lại), không so táo với cam
  if (cu.goc.some((g) => !kq.goc.includes(g))) { const tv = (a) => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
    const kh = cu.khoi.map((k) => ({ ...k, chi_tiet: k.chi_tiet.filter((d) => kq.goc.includes(d.goc)) })).filter((k) => k.chi_tiet.length).map((k) => ({ ...k, lech: +tv(k.chi_tiet.map((d) => d.lech)).toFixed(2) }));
    cu = { ...cu, khoi: kh, lech_nang: kh.filter((k) => Math.abs(k.lech) >= NGUONG).length, lech_tb: +(kh.reduce((t, k) => t + Math.abs(k.lech), 0) / (kh.length || 1)).toFixed(2) }; }
  const M = new Map(cu.khoi.map((k) => [k.id, k])); let xau = 0;
  console.log(`\nSO VỚI ${tenCu} (lệch ≥ ${NGUONG} m: ${cu.lech_nang} → ${kq.lech_nang} khối · trung bình ${cu.lech_tb} → ${kq.lech_tb} m)`);
  for (const k of kq.khoi) { const c = M.get(k.id); if (!c) continue; const d = Math.abs(k.lech) - Math.abs(c.lech); if (Math.abs(d) < 0.9) continue; const x = d > 0 && Math.abs(k.lech) >= NGUONG; if (x) xau++;
    console.log(`  ${d < 0 ? '✓ tốt lên' : x ? '✗ XẤU ĐI' : '· kém hơn (còn trong ngưỡng)'} ${k.id} ${k.ten}: lệch ${c.lech} → ${k.lech} m`); }
  const mat = cu.khoi.filter((k) => !kq.khoi.some((q) => q.id === k.id)); if (mat.length) console.log(`  · ${mat.length} khối lượt trước đo được, lượt này không: ${mat.map((k) => k.id).join(', ')}`);
  if (xau) { console.log(`✗ ${xau} khối xấu đi`); process.exit(1); } console.log('✓ không khối nào xấu đi'); }
if (arg('--so') && arg('--voi')) { soSanh(JSON.parse(readFileSync(arg('--so'), 'utf8')), JSON.parse(readFileSync(arg('--voi'), 'utf8')), arg('--so')); process.exit(0); }
const pha = arg('--pha') ? (() => { const [id, d] = arg('--pha').split(':'); return { id, d: +d }; })() : null;
let suaTam = null;
if (pha) { const S = JSON.parse(readFileSync(du('sua'), 'utf8')), cu = +(S[pha.id]?.y_tren ?? NaN);
  if (!Number.isFinite(cu)) { console.error(`--pha cần khối có y_tren trong sua.json (${pha.id} chưa có)`); process.exit(1); }
  suaTam = { [pha.id]: { y_tren: String(cu + pha.d) } }; console.log(`PHÁ THỬ: ${pha.id} y_tren ${cu} → ${cu + pha.d} (tạm, không ghi tệp)`); }
// Nghỉ 15 giây sau mỗi góc: lượt đang xếp hàng dò cổng 5 giây một lần — không nghỉ thì lượt này lấy lại cổng ngay, lượt kia chờ mãi (Thắng #1624 treo 60 phút, 16/11/2026).
// MỖI GÓC MỘT PHIÊN trang riêng: cổng 18777 chỉ một lượt đo một lúc — nhả cổng giữa các góc để lượt đo của người khác (Thắng) chen vào được, không bị chặn cả 20 phút
const mo = () => moTrang({ anh3d: true, khung: { width: 1280, height: 800 }, suaTam });
if (process.argv.includes('--lap') || !existsSync(TEP_GOC)) { const { pg, dong } = await mo();
  const ds = await pg.evaluate(() => { const n = window.__ns, K = n.dsKhoi.filter((k) => k.yTren != null && Math.hypot(k.v[0][0], k.v[0][1]) < 130);
    const xs = K.flatMap((k) => k.v.map((p) => p[0])), zs = K.flatMap((k) => k.v.map((p) => p[1])), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const R = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) / 2 + 95, yT = 32, ra = [];
    ['dong', 'dong-nam', 'nam', 'tay-nam', 'tay', 'tay-bac', 'bac', 'dong-bac'].forEach((ten, i) => { const a = i * Math.PI / 4, p = [cx + R * Math.cos(a), yT + 38, cz + R * Math.sin(a)], d = [cx - p[0], yT - p[1], cz - p[2]], l = Math.hypot(...d);
      ra.push({ ten, p: p.map((v) => +v.toFixed(1)), d: d.map((v) => +(v / l).toFixed(4)), fov: 45, zoom: +l.toFixed(0) }); });
    return ra; });
  const the = [['the-1623-cong', { p: [103.25, 24.26, -5.61], d: [-0.9808, -0.0799, -0.1777], fov: 45, zoom: 93.4 }]];
  for (const [ten, c] of the) ds.push({ ten, ...c });
  writeFileSync(TEP_GOC, JSON.stringify({ _: 'BỘ GÓC CHUẨN của scripts/cham-goc.mjs: 8 hướng quanh lâu đài (cách mép ~95 m, cao hơn tâm 38 m) + góc các thẻ báo lệch (thêm tay: góc nào anh từng báo thì thêm vào để không lùi). p = vị trí camera, d = hướng nhìn, toạ độ cảnh (x đông, z nam).', goc: ds }, null, 1) + '\n');
  console.log('đã lập', TEP_GOC, `(${ds.length} góc)`); await dong();
}
const chon = arg('--goc')?.split(','), GOCS = JSON.parse(readFileSync(TEP_GOC, 'utf8')).goc.filter((g) => !chon || chon.includes(g.ten));
const theoKhoi = {};
for (const g of GOCS) { const { pg, dong } = await mo(), t0 = Date.now();
  const r = await pg.evaluate(async (cam) => { const n = window.__ns; await n.chupHaiBan({ ...cam, w: innerWidth, h: innerHeight }); await n.batAnh3dTam(true);
    const C = n.camera, [x, y, z] = cam.p, [dx, dy, dz] = cam.d; C.fov = cam.fov; C.updateProjectionMatrix(); C.position.set(x, y, z); C.lookAt(x + dx * 50, y + dy * 50, z + dz * 50); C.updateMatrixWorld();
    const ra = n.khoiTrongVung([[0, 0, 1, 1]]).map((k) => n.doKhoiTheoTia(k.id)).filter(Boolean); await n.batAnh3dTam(false); return ra; }, g);
  await dong();
  await new Promise((ok) => setTimeout(ok, 15000));
  let tin = 0; for (const x of r) { if (!(x.so >= 4) || x.trai > 3) continue; tin++; (theoKhoi[x.id] ||= { ten: x.ten || '', y: x.dinhMoHinh, do: [] }).do.push({ goc: g.ten, lech: x.lech, so: x.so }); }
  console.log(`góc ${g.ten}: ${r.length} khối thấy, ${tin} khối đo tin được · ${((Date.now() - t0) / 1000).toFixed(0)} giây`);
}
const tv = (a) => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const khoi = Object.entries(theoKhoi).map(([id, k]) => ({ id, ten: k.ten, y_tren: k.y, lech: +tv(k.do.map((d) => d.lech)).toFixed(2), goc: k.do.length, chi_tiet: k.do })).sort((a, b) => Math.abs(b.lech) - Math.abs(a.lech));
const lechNang = khoi.filter((k) => Math.abs(k.lech) >= NGUONG), tb = khoi.length ? khoi.reduce((t, k) => t + Math.abs(k.lech), 0) / khoi.length : 0;
const kq = { luc: new Date().toISOString(), goc: GOCS.map((g) => g.ten), pha, so_khoi: khoi.length, lech_nang: lechNang.length, lech_tb: +tb.toFixed(2), khoi };
const tep = join(RA, kq.luc.replace(/[:.]/g, '-') + (pha ? '-pha' : '') + '.json'); writeFileSync(tep, JSON.stringify(kq, null, 1)); if (!pha && !chon) writeFileSync(join(RA, 'moi-nhat.json'), JSON.stringify(kq, null, 1)); if (arg('--ghi')) writeFileSync(arg('--ghi'), JSON.stringify(kq, null, 1) + '\n');
console.log(`\nĐIỂM: ${khoi.length} khối đo được · lệch ≥ ${NGUONG} m: ${lechNang.length} khối · trung bình |lệch| ${tb.toFixed(2)} m · ${tep}`);
for (const k of khoi.slice(0, 25)) console.log(`  ${k.lech > 0 ? 'thấp hơn thật' : 'cao hơn thật '} ${Math.abs(k.lech).toFixed(1).padStart(5)} m · ${k.id} ${k.ten} · y_tren ${k.y_tren} · ${k.goc} góc (${k.chi_tiet.map((d) => d.goc + ' ' + d.lech).join(', ')})`);
if (arg('--so')) soSanh(JSON.parse(readFileSync(arg('--so'), 'utf8')), kq, arg('--so'));
