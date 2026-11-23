// TẢI MẠNG DÙNG CHUNG cho mọi lệnh lấy dữ liệu ngoài của lâu đài (Commons, Mapillary, Overpass, OpenTopoData) — 23/11/2026.
// Lý do: mỗi tệp tự fetch một kiểu (tim-anh không thử lại, tai-duong thử 4 lần, tai-lau-dai-that 8 lần, anh-quanh không lần nào) → bước 6 sân dưới
// mất 16 / 30 ảnh Commons vì 429 khi tải dồn, còn đường API ngay cạnh thì có thử lại. Một chỗ giữ luật:
//   - GIÃN NHỊP theo máy chủ (NHIP): Commons chặn theo IP khi tải liền nhau; giãn trước khi gọi, không đợi bị chặn rồi mới chờ.
//   - THỬ LẠI khi 429 / 5xx / đứt mạng / quá giờ: chờ theo Retry-After, không có thì tăng dần (cho[lần]); hết lượt thì trả Response cuối (hoặc ném lỗi mạng).
//   - Không bao giờ in URL (Mapillary để khoá trong query) — chỉ in tên máy + mã.
// taiMang(url, init?, { thu = 6, cho = [10, 20, 40, 60, 90, 120], thoiGian = 60 }) → Response
// tra-repo-ok: bọc fetch có sẵn của Node, vài chục dòng — không cần thư viện retry.
const UA = 'castle-lau-dai-that/1.0';
const NHIP = { 'upload.wikimedia.org': 1500, 'commons.wikimedia.org': 600, 'graph.mapillary.com': 200, 'overpass-api.de': 1000, 'overpass.kumi.systems': 1000, 'overpass.private.coffee': 1000, 'api.opentopodata.org': 1100 };
const lanCuoi = new Map(), ngu = (ms) => new Promise((ok) => setTimeout(ok, ms));
// Máy chủ kênh (người đang chờ nút 📷) không được treo 2 phút: kenh.mjs đặt macDinh.thu = 1, macDinh.choToiDa = 5 lúc khởi động; lệnh kỹ sư giữ mặc định.
export const macDinh = { thu: 6, choToiDa: 120 };
export async function taiMang(url, init = {}, { thu = macDinh.thu, cho = [10, 20, 40, 60, 90, 120], thoiGian = 60, im = false } = {}) {
  const may = new URL(url).hostname, gian = NHIP[may] || 0;
  for (let lan = 0; ; lan++) {
    const doi = (lanCuoi.get(may) || 0) + gian - Date.now(); if (doi > 0) await ngu(doi);
    lanCuoi.set(may, Date.now());
    let r, loi;
    try { r = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers || {}) }, signal: AbortSignal.timeout(thoiGian * 1000) }); }
    catch (e) { loi = e; }
    const hong = loi || r.status === 429 || r.status >= 500;
    if (!hong) return r;
    if (lan >= thu) { if (loi) throw new Error(`${may}: ${loi.message} (đã thử ${lan + 1} lần)`); return r; }
    const s = Math.min(macDinh.choToiDa, Math.max(+(r?.headers.get('retry-after')) || 0, cho[Math.min(lan, cho.length - 1)]));
    if (!im) console.error(`   ${may}: ${loi ? loi.message : r.status} — chờ ${s} s rồi thử lại (${lan + 1}/${thu})`);
    await ngu(s * 1000);
  }
}
// Tự kiểm: node apps/castle/server/tai-mang.mjs --tu-kiem — máy chủ giả trả 429 hai lần rồi 200; 503 mãi thì trả 503 sau đúng số lần thử; giãn nhịp có tác dụng.
if (process.argv[1]?.endsWith('tai-mang.mjs') && process.argv.includes('--tu-kiem')) {
  const { createServer } = await import('node:http'), assert = (await import('node:assert')).default;
  let dem = 0; const sv = createServer((q, s) => { dem++; if (q.url === '/a' && dem <= 2) { s.writeHead(429, { 'retry-after': '0' }); return s.end(); } if (q.url === '/b') { s.writeHead(503); return s.end(); } s.end('ok'); });
  await new Promise((ok) => sv.listen(0, '127.0.0.1', ok)); const g = `http://127.0.0.1:${sv.address().port}`;
  const a = await taiMang(g + '/a', {}, { cho: [0], im: true }); assert.equal(a.status, 200); assert.equal(dem, 3);
  dem = 0; const b = await taiMang(g + '/b', {}, { thu: 2, cho: [0], im: true }); assert.equal(b.status, 503); assert.equal(dem, 3);
  NHIP['127.0.0.1'] = 300; const t0 = Date.now(); await taiMang(g + '/c'); await taiMang(g + '/c'); assert.ok(Date.now() - t0 >= 290, 'giãn nhịp');
  await assert.rejects(taiMang('http://127.0.0.1:1/x', {}, { thu: 1, cho: [0], im: true }), /đã thử 2 lần/);
  macDinh.choToiDa = 0; dem = 0; const t1 = Date.now(); const a2 = await taiMang(g + '/b', {}, { thu: 1, cho: [30], im: true }); assert.equal(a2.status, 503); assert.ok(Date.now() - t1 < 5000, 'trần chờ');
  sv.close(); console.log('tai-mang: 5 / 5 bài đạt');
}
