// DÙNG CHUNG cho mọi công cụ đo / kiểm / dựng lâu đài (quy trình: apps/castle/QUY-TRINH.md):
//   - LAU: tên lâu đài lấy từ --lau <tên> (mặc định neuschwanstein) → tệp du-lieu/<LAU>-*.json, trang neuschwanstein.html?lau=<LAU>
//   - moTrang({ anh3d, them }): bật máy chủ tĩnh ĐÚNG cổng 18777 (token web Cesium chỉ nhận referrer 127.0.0.1:18777 + castle.on.tc), mở Chromium (Playwright),
//     nạp trang, chờ trang sẵn sàng (window.__ns.tt; anh3d = true thì chờ cả lớp ảnh 3D) → { pg, dong() }
//   - du(ten): đường dẫn public/du-lieu/<LAU>-<ten>.json
// Chạy trên iMac (có trình duyệt). PLAYWRIGHT=… nếu Playwright cài chỗ khác.
// tra-repo-ok: mã dán keo nội bộ (máy chủ tĩnh node:http + Playwright), không có thư viện tương ứng cho dữ liệu riêng.
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GOC = join(dirname(fileURLToPath(import.meta.url)), '..'), PUB = join(GOC, 'public');
const i = process.argv.indexOf('--lau');
export const LAU = i > 0 ? process.argv[i + 1] : process.env.LAU || 'neuschwanstein';
export const doiSo = process.argv.slice(2).filter((a, k, ds) => a !== '--lau' && ds[k - 1] !== '--lau'); // tham số còn lại (bỏ --lau <tên>)
export const du = (ten) => join(PUB, 'du-lieu', `${LAU}-${ten}.json`);
// <lâu>.json với mặt bằng ĐÚNG như trang dựng: khối OSM có "ngoai" (≥ 3 điểm) trong <lâu>-sua.json (keo-mep-dom20.py ghi) thì thay vòng ngoài — cùng luật ns.js
// và toa_do_bayern.dsKhoi() bên Python. Máy nào cần mặt bằng khối thì đọc qua đây, không JSON.parse thẳng <lâu>.json (trước 24/11/2026 ba máy tìm / so ảnh nhìn mặt bằng OSM thô).
export function docLau() {
  const D = JSON.parse(readFileSync(join(PUB, 'du-lieu', `${LAU}.json`), 'utf8')), S = existsSync(du('sua')) ? JSON.parse(readFileSync(du('sua'), 'utf8')) : {};
  for (const k of D.khoi) if (Array.isArray(S[k.id]?.ngoai) && S[k.id].ngoai.length >= 3) { k.ngoaiGoc = k.ngoai; k.ngoai = [S[k.id].ngoai]; }
  return D;
}
const PW = process.env.PLAYWRIGHT || '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs';
const LOAI = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.svg': 'image/svg+xml', '.css': 'text/css' };

// CỔNG: mọi công cụ đo / kiểm castle chạy máy dò chú thích // nuốt mã trước (scripts/kiem-chu-thich.mjs) — mã bị nuốt thì từ chối chạy
// (đo / kiểm trên mã đang hỏng im lặng cho kết quả sai, đã xảy ra với nan-google.mjs 16/11/2026)
import { execFileSync } from 'node:child_process';
// + kiem-nap-phien-ban.mjs: mô-đun mới quên thêm vào danh sách nạp theo dấu phiên bản thì trang thật chạy bản cũ trong bộ đệm Cloudflare (17/11/2026)
function kiemChuThich() {
  for (const [tep, ly] of [['kiem-chu-thich.mjs', 'có chú thích // nuốt mã trong castle'], ['kiem-nap-phien-ban.mjs', 'mô-đun castle nạp trần, thiếu trong danh sách TEP của trang']])
    try { execFileSync(process.execPath, [join(GOC, 'scripts', tep)], { stdio: 'pipe' }); } catch (e) { console.error(String(e.stderr || '') + String(e.stdout || e.message)); console.error(`✗ dừng: ${ly} — sửa trước khi đo / kiểm`); process.exit(1); }
}
// suaTam: { 'way/…': { y_tren: '…' } } trộn TẠM vào <lâu>-sua.json khi trang nạp (không đổi tệp) — bài phá thử của cham-goc.mjs, chấm bản sửa chưa ghi
// GÁC TREO (anh 21/11/2026: "Chạy ngầm phải đảm bảo ko có lỗi khiến bị trơ đơ mãi ko xong"): mọi công cụ mở Chromium qua moTrang có một đồng hồ —
// HAN_TREO giây (mặc định 600) không có nhịp nào (mở trình duyệt, nạp trang, nhip() công cụ gọi mỗi việc — KHÔNG tính tin console: trang kẹt vẫn ghi lỗi đều) → in việc đang kẹt, giết trình duyệt, thoát 124.
// Công cụ có vòng lâu: gọi nhip('<việc>') mỗi lần xong một việc (so-anh-that.mjs: mỗi ảnh). dong() cũng có hạn: 20 s không đóng xong → giết cứng.
export function taoGac(hanMs, khiTreo) {
  let viec = 'khởi động', t = null;
  const nhip = (ten) => { if (ten) viec = ten; clearTimeout(t); t = setTimeout(() => khiTreo(viec), hanMs); t.unref?.(); };
  return { nhip, tat: () => clearTimeout(t), viec: () => viec };
}
let gacTrang = null;
export const nhip = (ten) => gacTrang?.nhip(ten);
export async function moTrang({ anh3d = false, them = '', khung = { width: 1600, height: 1200 }, nhanLog = null, suaTam = null } = {}) {
  kiemChuThich();
  const may = http.createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = join(PUB, p); if (!f.startsWith(PUB) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404).end(); return; }
    if (suaTam && f === du('sua')) { const S = JSON.parse(readFileSync(f, 'utf8')); for (const [id, e] of Object.entries(suaTam)) S[id] = { ...(S[id] || {}), ...e }; r.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(S)); return; }
    r.writeHead(200, { 'Content-Type': LOAI[extname(f)] || 'application/octet-stream' }).end(readFileSync(f));
  });
  // cổng 18777 là cổng DUY NHẤT khoá ảnh 3D nhận → mỗi lúc một lượt đo; lượt khác (Thắng / phiên khác) đang giữ thì XẾP HÀNG chờ tới 20 phút
  // thay vì chết (thẻ #1629: Thắng dừng vì phiên khác đang đo)
  // KHÔNG ảnh 3D thì không cần cổng 18777: hệ điều hành cấp cổng trống — chạy song song, không xếp hàng sau lượt đo ảnh 3D
  const CONG = anh3d ? 18777 : 0;
  for (let t0 = Date.now(), bao = false; ;) {
    const loi = await new Promise((ok) => { may.once('error', ok); may.listen(CONG, '127.0.0.1', () => ok(null)); });
    if (!loi) break;
    if (loi.code !== 'EADDRINUSE' || Date.now() - t0 > 20 * 60e3) { console.error('cổng 18777 vẫn bận sau 20 phút:', loi.code); process.exit(1); }
    if (!bao) { console.error('cổng 18777 đang có lượt đo khác — xếp hàng chờ (tối đa 20 phút)…'); bao = true; }
    await new Promise((ok) => setTimeout(ok, 5000));
  }
  const { chromium } = await import(PW);
  const b = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
  const HAN = Number(process.env.HAN_TREO || 600);
  gacTrang = taoGac(HAN * 1e3, (viec) => { console.error(`✗ TREO: "${viec}" quá ${HAN} s không nhúc nhích → giết trình duyệt, thoát 124`);
    try { b.process?.()?.kill('SIGKILL'); } catch {} try { may.close(); } catch {} process.exit(124); });
  gacTrang.nhip('mở trình duyệt');
  const cong = may.address().port;
  // trangMoi(): thêm một trang cùng trình duyệt, cùng máy chủ (đo nhiều góc song song — cham-goc.mjs)
  const trangMoi = async () => { const pg = await b.newPage({ viewport: khung });
    pg.on('pageerror', (e) => console.log('LỖI TRANG', e.message));
    // mỗi pg.evaluate TRẢ VỀ = một nhịp (trang còn sống): vòng dò dài không tự gọi nhip() vẫn không bị giết oan (22/11/2026 khop-camera bị giết ở ảnh 18 dù đang dò đều);
    // trang treo thật thì evaluate không bao giờ trả về → gác vẫn bắt
    const evGoc = pg.evaluate.bind(pg); pg.evaluate = async (...a) => { const r = await evGoc(...a); nhip(); return r; };
    if (nhanLog) pg.on('console', (m) => { if (m.text().startsWith(nhanLog)) console.log(m.text()); });
    await pg.addInitScript((a) => { try { localStorage.setItem('ns-anh3d', a ? '1' : '0'); localStorage.setItem('ns-anh3d-cong-cu', '1'); localStorage.setItem('ns-dau-thu', '1'); } catch {} }, anh3d);
    nhip('nạp trang'); await pg.goto(`http://127.0.0.1:${cong}/neuschwanstein.html?lau=${encodeURIComponent(LAU)}${them ? '&' + them : ''}`);
    await pg.waitForFunction((a) => window.__ns?.tt && (!a || window.__ns.anh3d()), anh3d, { timeout: 180000 });
    nhip('trang sẵn sàng'); return pg; };
  const pg = await trangMoi();
  return { pg, trangMoi, dong: async () => { nhip('đóng trình duyệt');
    const xong = await Promise.race([b.close().then(() => true), new Promise((ok) => setTimeout(ok, 20e3, false))]);
    if (!xong) { console.error('✗ trình duyệt không đóng sau 20 s → giết cứng'); try { b.process?.()?.kill('SIGKILL'); } catch {} }
    gacTrang?.tat(); gacTrang = null; may.close(); } };
}
