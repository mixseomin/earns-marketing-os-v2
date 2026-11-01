// ẢNH THẬT TỪNG CON PHỐ HÀ NỘI cho series "Gánh hoa phố cổ" (anh 01/11/2026: "mỗi ngày 1 con phố, phải lên mạng lấy đủ ảnh thật của từng con
// phố; tập 1 dùng con phố có nhiều thông tin nhất"). Đếm ảnh KHỚP TÊN PHỐ (mô tả / tag / tên tệp chứa tên phố, không tính ảnh "Hanoi" chung chung)
// trên Wikimedia Commons + Pexels + Pixabay + Unsplash, xếp hạng; --tai=<khoá> tải N ảnh khớp nhất về tham-khao/pho/<khoá>/ kèm nguon.json
// (link trang gốc + giấy phép). Ảnh dùng làm THAM CHIẾU bối cảnh (anh_ref anchor), không đăng thẳng. Chạy trên iMac:
//   PEXELS_KEY=… PIXABAY_KEY=… UNSPLASH_KEY=… node apps/xuong-video/scripts/anh-pho-that.mjs            → bảng xếp hạng
//   … node apps/xuong-video/scripts/anh-pho-that.mjs --tai=hang_ma [--so=12]                             → tải ảnh phố đó
// Khoá: skill design/stock-photo-apis. Thiếu khoá nguồn nào thì bỏ nguồn đó (Commons không cần khoá).
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PHO = [
  { key: 'hang_ma', ten: 'Hàng Mã', q: ['Hang Ma'], net: 'phố đồ hàng mã, đèn lồng, đồ chơi Trung thu, giấy đỏ' },
  { key: 'ta_hien', ten: 'Tạ Hiện', q: ['Ta Hien'], net: 'phố bia hơi, ghế nhựa tràn đường, đêm đông khách Tây' },
  { key: 'duong_tau', ten: 'Phố đường tàu', q: ['train street', 'Tran Phung'], net: 'đường ray sát nhà, quán cà phê ven ray, tàu lướt qua' },
  { key: 'hang_bac', ten: 'Hàng Bạc', q: ['Hang Bac'], net: 'phố bạc, khắc dấu, bia mộ, nhà cổ' },
  { key: 'hang_buom', ten: 'Hàng Buồm', q: ['Hang Buom'], net: 'phố đi bộ, đồ khô, bánh kẹo, ẩm thực đêm' },
  { key: 'ma_may', ten: 'Mã Mây', q: ['Ma May'], net: 'nhà cổ 87 Mã Mây, homestay, khách ba lô' },
  { key: 'hang_dao', ten: 'Hàng Đào', q: ['Hang Dao'], net: 'phố vải lụa, chợ đêm cuối tuần' },
  { key: 'hang_gai', ten: 'Hàng Gai', q: ['Hang Gai'], net: 'lụa tơ tằm, đồ lưu niệm, may đo' },
  { key: 'phung_hung', ten: 'Phùng Hưng', q: ['Phung Hung'], net: 'phố bích hoạ dưới vòm cầu đá đường sắt' },
  { key: 'luong_van_can', ten: 'Lương Văn Can', q: ['Luong Van Can'], net: 'phố đồ chơi trẻ em' },
  { key: 'hang_be', ten: 'Hàng Bè', q: ['Hang Be'], net: 'chợ Hàng Bè, hàng quà sáng' },
  { key: 'dinh_tien_hoang', ten: 'Đinh Tiên Hoàng (Hồ Gươm)', q: ['Hoan Kiem walking street', 'Dinh Tien Hoang'], net: 'phố đi bộ Hồ Gươm, cầu Thê Húc, tập thể dục sáng' },
  { key: 'hang_luoc', ten: 'Hàng Lược', q: ['Hang Luoc'], net: 'chợ hoa Tết, hoa đào' },
  { key: 'hang_duong', ten: 'Hàng Đường', q: ['Hang Duong'], net: 'ô mai, mứt, chợ Đồng Xuân đầu phố' },
];

const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36' };
const boDau = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
/** Ảnh có thật sự về phố này không: chữ mô tả (bỏ dấu) chứa một tên phố (bỏ dấu). */
const khop = (p, chu) => { const c = boDau(chu ?? ''); return [p.ten, ...p.q].some((t) => c.includes(boDau(t.replace(/\s*\(.*\)/, '')))); };
// Commons đòi UA mô tả công cụ (UA giả trình duyệt bị bóp 429); 429 thì chờ lùi dần rồi thử lại — nguồn nào cũng có trần tần suất.
const UA_COMMONS = { 'User-Agent': 'StudioOnTc-StreetRefs/1.0 (reference photos for an animation series; Node fetch)' };
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const json = async (url, h = {}) => {
  for (let lan = 0; ; lan++) {
    const r = await fetch(url, { headers: { ...(url.includes('wikimedia.org') ? UA_COMMONS : UA), ...h } });
    if (r.status === 429 && lan < 4) { await ngu(2000 * 2 ** lan); continue; }
    if (!r.ok) throw new Error(`${r.status} ${url.replace(/key=[^&]+|client_id=[^&]+/g, 'key=…').slice(0, 80)}`);
    return r.json();
  }
};

async function commons(p) {
  const ra = [];
  for (const q of [p.ten, ...p.q]) {
    const d = await json(`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=50&gsrsearch=${encodeURIComponent(`"${q}" Hanoi`)}&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=1600`);
    for (const pg of Object.values(d.query?.pages ?? {})) {
      const ii = pg.imageinfo?.[0]; if (!ii || !/\.(jpe?g|png)$/i.test(pg.title)) continue;
      const mo = `${pg.title} ${ii.extmetadata?.ImageDescription?.value ?? ''}`;
      if (khop(p, mo)) ra.push({ nguon: 'commons', id: pg.title, anh: ii.thumburl ?? ii.url, trang: ii.descriptionurl, giay_phep: ii.extmetadata?.LicenseShortName?.value ?? '', w: ii.width });
    }
  }
  return ra;
}
async function pexels(p) {
  if (!process.env.PEXELS_KEY) return [];
  const ra = [];
  for (const q of p.q) { const d = await json(`https://api.pexels.com/v1/search?query=${encodeURIComponent(`${q} Hanoi`)}&per_page=80`, { Authorization: process.env.PEXELS_KEY });
    for (const x of d.photos ?? []) if (khop(p, `${x.alt} ${x.url}`)) ra.push({ nguon: 'pexels', id: String(x.id), anh: x.src.large2x, trang: x.url, giay_phep: 'Pexels License', w: x.width }); }
  return ra;
}
async function pixabay(p) {
  if (!process.env.PIXABAY_KEY) return [];
  const ra = [];
  for (const q of p.q) { const d = await json(`https://pixabay.com/api/?key=${process.env.PIXABAY_KEY}&q=${encodeURIComponent(`${q} Hanoi`)}&image_type=photo&per_page=200`);
    for (const x of d.hits ?? []) if (khop(p, `${x.tags} ${x.pageURL}`)) ra.push({ nguon: 'pixabay', id: String(x.id), anh: x.largeImageURL, trang: x.pageURL, giay_phep: 'Pixabay Content License', w: x.imageWidth }); }
  return ra;
}
async function unsplash(p) {
  if (!process.env.UNSPLASH_KEY) return [];
  const ra = [];
  for (const q of p.q) { const d = await json(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(`${q} Hanoi`)}&per_page=30&client_id=${process.env.UNSPLASH_KEY}`);
    for (const x of d.results ?? []) if (khop(p, `${x.description ?? ''} ${x.alt_description ?? ''} ${x.links?.html ?? ''} ${(x.tags ?? []).map((t) => t.title).join(' ')}`)) ra.push({ nguon: 'unsplash', id: x.id, anh: x.urls.regular, trang: x.links.html, giay_phep: 'Unsplash License', w: x.width }); }
  return ra;
}
async function anhPho(p) {
  const kq = [];
  for (const f of [commons, pexels, pixabay, unsplash]) { kq.push(await f(p).then((value) => ({ status: 'fulfilled', value }), (reason) => ({ status: 'rejected', reason }))); await ngu(600); }
  const loi = kq.filter((x) => x.status === 'rejected').map((x) => String(x.reason).slice(0, 80));
  const thay = new Set(); const ds = kq.flatMap((x) => (x.status === 'fulfilled' ? x.value : [])).filter((a) => !thay.has(a.trang) && thay.add(a.trang));
  return { ds, loi };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tai = (process.argv.find((a) => a.startsWith('--tai=')) ?? '').slice(6);
  const so = Number((process.argv.find((a) => a.startsWith('--so=')) ?? '').slice(5) || 12);
  if (!tai) {
    const bang = [];
    for (const p of PHO) { const { ds, loi } = await anhPho(p); const n = (k) => ds.filter((a) => a.nguon === k).length;
      bang.push({ ...p, tong: ds.length, c: n('commons'), px: n('pexels'), pb: n('pixabay'), us: n('unsplash'), loi }); }
    bang.sort((a, b) => b.tong - a.tong);
    console.log('Phố                         Tổng  Commons Pexels Pixabay Unsplash');
    for (const b of bang) console.log(`${b.ten.padEnd(28)}${String(b.tong).padStart(4)}${String(b.c).padStart(9)}${String(b.px).padStart(7)}${String(b.pb).padStart(8)}${String(b.us).padStart(9)}${b.loi.length ? `  ⚠ ${b.loi.join(' · ')}` : ''}`);
    process.exit(0);
  }
  const p = PHO.find((x) => x.key === tai); if (!p) { console.error(`không có phố ${tai}`); process.exit(1); }
  const { ds } = await anhPho(p);
  // ảnh to trước, xen nguồn để bộ tham chiếu đa góc
  const chon = ds.sort((a, b) => (b.w ?? 0) - (a.w ?? 0)).slice(0, so * 2);
  const thu = join(dirname(fileURLToPath(import.meta.url)), '..', 'tham-khao', 'pho', p.key); mkdirSync(thu, { recursive: true });
  const md5 = new Set(); const luu = [];
  for (const a of chon) {
    if (luu.length >= so) break;
    try { const r = await fetch(a.anh, { headers: a.nguon === 'commons' ? UA_COMMONS : UA }); if (!r.ok) continue; const b = Buffer.from(await r.arrayBuffer()); if (b.length < 20000) continue;
      const h = createHash('md5').update(b).digest('hex'); if (md5.has(h)) continue; md5.add(h);
      const tep = `${String(luu.length + 1).padStart(2, '0')}-${a.nguon}.jpg`; if (!existsSync(join(thu, tep))) writeFileSync(join(thu, tep), b);
      luu.push({ tep, ...a });
    } catch { /* ảnh hỏng / chặn: bỏ, nguon.json chỉ ghi ảnh đã tải được */ }
  }
  writeFileSync(join(thu, 'nguon.json'), JSON.stringify({ pho: p.ten, net: p.net, luc: new Date().toISOString(), anh: luu }, null, 1));
  console.log(`${p.ten}: tải ${luu.length}/${ds.length} ảnh khớp → ${thu}`);
}
