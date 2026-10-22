// THEO DÕI DUYỆT SAU ĐĂNG — MỘT máy cho MỌI nền tảng (anh 16/10/2026: "có nhiều sản phẩm ở nhiều nền tảng cần review sau khi đăng tải;
// phải 1 con làm đủ các nhiệm vụ này mới tối ưu tài nguyên; đặt nó lên box"). Giỗ Chạp đã lên App Store mà Tài sản vẫn "đã nộp, chờ duyệt".
// Mỗi lượt (box3, theo-doi-duyet.timer, mỗi giờ): đọc sổ Tài sản (Directus products) → với từng sản phẩm hỏi ĐÚNG nền tảng của nó → đổi
// `status` + dòng máy đầu ghi chú ("⟳ ASC …" / "⟳ Duyệt …") + url khi đã lên → trạng thái ĐỔI thì báo Telegram MINE › Quản lý.
// Người chịu trách nhiệm trong cty: Nga (phòng kinh-doanh, cong-ty/nhan-su/nga). Thêm nền tảng = thêm một hàm vào KIEM.
//   app-store      mọi app có Apple ID (sku) — API App Store Connect (scripts/asc-api.mjs)
//   kdp            sách đang chờ duyệt (in_review/pending) có ISBN — tìm trên Amazon theo ISBN qua proxy (IP box3 bị Amazon chặn 503),
//                  mở trang /dp/ khớp ĐÚNG ISBN mới tính là đã lên
//   wordpress.org  plugin đang chờ duyệt — API plugins/info (slug = sku)
//   ms-store       app Windows (sku = Store ID 12 ký tự trên Partner Center) — API công khai storeedgefd mà app Store dùng: thấy sản phẩm ở
//                  thị trường US = đã lên (Giỗ Chạp Windows lên 20/10/2026 mà sổ không biết — đường app Windows trước đây không ghi sổ)
//   node scripts/theo-doi-duyet.mjs [--dry]      node scripts/theo-doi-duyet.mjs --tu-kiem
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { api } from './asc-api.mjs';

// ── phần THUẦN (tự kiểm) ─────────────────────────────────────────────────────────────────────────────────────────────
const CHU_ASC = { WAITING_FOR_REVIEW: 'chờ duyệt', IN_REVIEW: 'Apple đang duyệt', PROCESSING_FOR_APP_STORE: 'đang xử lý', PENDING_DEVELOPER_RELEASE: 'đã duyệt, chờ phát hành',
  PENDING_APPLE_RELEASE: 'đã duyệt, Apple sắp phát hành', REJECTED: 'BỊ TỪ CHỐI', METADATA_REJECTED: 'BỊ TỪ CHỐI (thông tin)', INVALID_BINARY: 'bản dựng lỗi',
  PREPARE_FOR_SUBMISSION: 'chưa nộp', DEVELOPER_REJECTED: 'đã rút', READY_FOR_SALE: 'đang bán', READY_FOR_DISTRIBUTION: 'đang bán' };
/** App Store: trạng thái sổ từ các phiên bản iOS. Bản đã lên store → app "đang bán" kể cả khi bản mới đang chờ (ghi chú nói). */
export function trangThaiAsc(ver) {
  const ds = [...ver].sort((a, b) => String(b.created ?? '').localeCompare(String(a.created ?? '')));
  const dangBan = ds.find((v) => ['READY_FOR_SALE', 'READY_FOR_DISTRIBUTION'].includes(v.state)), moi = ds[0];
  if (!moi) return null;
  const ta = (v) => `${v.version} ${CHU_ASC[v.state] ?? v.state}`;
  if (dangBan) return { status: 'published', dong: `⟳ ASC ${dangBan.version} đang bán${moi !== dangBan && moi.state !== dangBan.state ? ` · bản ${ta(moi)}` : ''}` };
  if (['WAITING_FOR_REVIEW', 'IN_REVIEW', 'PROCESSING_FOR_APP_STORE', 'WAITING_FOR_EXPORT_COMPLIANCE', 'PENDING_APPLE_RELEASE'].includes(moi.state)) return { status: 'in_review', dong: `⟳ ASC ${ta(moi)}` };
  if (moi.state === 'PENDING_DEVELOPER_RELEASE') return { status: 'ready', dong: `⟳ ASC ${ta(moi)} — bấm phát hành trên App Store Connect` };
  if (['REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY'].includes(moi.state)) return { status: 'draft', dong: `⟳ ASC ${ta(moi)} — xem tin Apple trong Resolution Center` };
  return { status: 'draft', dong: null };   // chưa nộp: giữ dòng máy cũ ("⟳ ASC TestFlight 1.0 (3)")
}

/** ISBN-13 của sách: sku là ISBN, hoặc "ISBN 979…" trong ghi chú. */
export const isbnCua = (p) => (/^97[89]\d{10}$/.test(String(p.sku ?? '')) ? String(p.sku) : (String(p.notes ?? '').match(/ISBN\s*:?\s*(97[89]\d{10})/) ?? [])[1] ?? null);
/** Trang sản phẩm Amazon có đúng ISBN này không (Amazon in "ISBN-13 : 979-8178977729"). */
export const trangCoIsbn = (html, isbn) => html.includes(`${isbn.slice(0, 3)}-${isbn.slice(3)}`) || html.includes(isbn);
/** Mã /dp/ trong trang tìm kiếm, theo thứ tự xuất hiện, không trùng. */
export const dpTrongTrang = (html) => [...new Set([...html.matchAll(/\/dp\/([0-9A-Z]{10})/g)].map((m) => m[1]))];

/** BSR trên trang sản phẩm: hạng tổng "#12,345 in Books" (sách mới chưa bán thì không có) + hạng từng mục. */
export function docBsr(html) {
  const t = html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  const i = t.indexOf('Best Sellers Rank'); if (i < 0) return { bsr: null, hang: [] };
  const doan = t.slice(i, i + 700);
  const so = (x) => Number(x.replace(/,/g, ''));
  const tong = doan.match(/#([\d,]+) in Books\b/);
  const hang = [...doan.matchAll(/#([\d,]+) in ([^#(]+?)(?=\s*(?:#|\(|Customer|$))/g)].filter((m) => !/^Books\s*$/.test(m[2].trim())).slice(0, 3).map((m) => ({ so: so(m[1]), muc: m[2].trim() }));
  return { bsr: tong ? so(tong[1]) : null, hang };
}

/** Dòng máy đầu ghi chú: thay dòng máy cũ ("⟳ …"), giữ phần tay (cùng luật ios-chung/Tools/tai-san.mjs). */
export function ghiChu(cu, dong) {
  if (!dong) return cu ?? null;
  const tay = (cu ?? '').split('\n').filter((l, i) => !(i === 0 && l.startsWith('⟳ '))).join('\n').trim();
  return tay ? `${dong}\n${tay}` : dong;
}

export const CHU_SO = { planned: 'dự kiến', draft: 'đang làm', ready: 'sẵn sàng', owner_review: 'chờ anh duyệt', pending: 'đã nộp, chờ duyệt', in_review: 'đã nộp, chờ duyệt', published: 'đang bán', archived: 'ngừng', unlisted: 'ngừng' };

if (process.argv.includes('--tu-kiem')) {
  const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) { console.error(`SAI ${m}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); process.exitCode = 1; } };
  const v = (version, state, created) => ({ version, state, created });
  eq(trangThaiAsc([v('1.0', 'READY_FOR_SALE', '2026-09-20')]).status, 'published', 'Giỗ Chạp lên store');
  eq(trangThaiAsc([v('1.0', 'WAITING_FOR_REVIEW', '2026-10-08')]), { status: 'in_review', dong: '⟳ ASC 1.0 chờ duyệt' }, 'chờ duyệt');
  eq(trangThaiAsc([v('1.0', 'READY_FOR_SALE', '2026-09-20'), v('1.1', 'IN_REVIEW', '2026-10-10')]).dong, '⟳ ASC 1.0 đang bán · bản 1.1 Apple đang duyệt', 'bản mới đang duyệt');
  eq(trangThaiAsc([v('1.0', 'REJECTED', '2026-09-29')]).status, 'draft', 'bị từ chối');
  eq(trangThaiAsc([v('1.0', 'PREPARE_FOR_SUBMISSION', '2026-10-11')]), { status: 'draft', dong: null }, 'chưa nộp giữ dòng TestFlight');
  eq(trangThaiAsc([v('1.0', 'PENDING_DEVELOPER_RELEASE', '2026-10-11')]).status, 'ready', 'chờ bấm phát hành');
  eq(trangThaiAsc([]), null, 'chưa có phiên bản');
  eq(isbnCua({ sku: '9798178977729' }), '9798178977729', 'sku là ISBN');
  eq(isbnCua({ sku: '04YHKYVPAPM', notes: 'KDP 04YHKYVPAPM · ISBN 9798178892831 · 8.5x11' }), '9798178892831', 'ISBN trong ghi chú');
  eq(isbnCua({ sku: '2T0BCDKSVEV', notes: 'file xong' }), null, 'chưa có ISBN');
  eq(trangCoIsbn('<span>ISBN-13</span> : 979-8178977729 </span>', '9798178977729'), true, 'trang có ISBN');
  eq(trangCoIsbn('ISBN-13 : 979-8178892831', '9798178977729'), false, 'ISBN khác (bản bìa mềm/cứng)');
  eq(dpTrongTrang('<a href="/x/dp/B0HM6QFYDG/ref">a</a><a href="/dp/B07984JN3L">b</a><a href="/dp/B0HM6QFYDG">'), ['B0HM6QFYDG', 'B07984JN3L'], 'mã dp không trùng');
  eq(ghiChu('⟳ ASC TestFlight 1.0 (3)\nTay.', '⟳ ASC 1.0 đang bán'), '⟳ ASC 1.0 đang bán\nTay.', 'thay dòng máy giữ tay');
  eq(ghiChu('Tay.', null), 'Tay.', 'không dòng máy');
  eq(trangAmazonHong(503, 'x'.repeat(30000)), true, '503 = bị chặn');
  eq(trangAmazonHong(200, '<form action="/errors/validateCaptcha">' + 'x'.repeat(30000)), true, 'trang captcha 200 = bị chặn');
  eq(trangAmazonHong(200, 'x'.repeat(3785)), true, 'trang cụt = bị chặn');
  eq(trangAmazonHong(200, 'ISBN-13 : 979-8178977729' + 'x'.repeat(600000)), false, 'trang thật');
  const mau = '<span>Best Sellers Rank:</span> #110 in State Quarter Collecting <a>#226 in Antique &amp; Collectible Precious Metals (Books)</a> #813 in Antique &amp; Collectible Reference (Books) <span>Customer Reviews';
  eq(docBsr(mau), { bsr: null, hang: [{ so: 110, muc: 'State Quarter Collecting' }, { so: 226, muc: 'Antique & Collectible Precious Metals' }, { so: 813, muc: 'Antique & Collectible Reference' }] }, 'sách mới: chưa hạng tổng');
  eq(docBsr('Best Sellers Rank: #1,234,567 in Books (See Top 100 in Books) #55 in Word Search').bsr, 1234567, 'hạng tổng');
  eq(docBsr('<html>no rank</html>'), { bsr: null, hang: [] }, 'không có BSR');
  if (!process.exitCode) console.log('theo-doi-duyet: 22/22 đạt');
  process.exit(process.exitCode ?? 0);
}

// ── mỗi nền tảng một hàm: sản phẩm → { status, dong, url? } | null (chưa kiểm được lượt này — giữ nguyên) ───────────────────
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const DATA = process.env.THEO_DOI_DATA || '/var/lib/theo-doi-duyet';
const ngayVn = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10).split('-').reverse().slice(0, 2).join('/');

/** Proxy cho Amazon: khoá SuiProxy của spy (/root/.secrets/spy.env). Lưu endpoint, chỉ xin mới khi hết hạn — xin liên tục bị khoá đổi 60 giây. */
async function proxyAmazon() {
  const f = `${DATA}/proxy.json`;
  try { const c = JSON.parse(readFileSync(f, 'utf8')); if (c.het > Date.now() + 60_000) return c.ep; } catch { /* chưa có */ }
  const key = (readFileSync('/root/.secrets/spy.env', 'utf8').match(/^SUIPROXY_KEY=(.*)$/m) ?? [])[1]?.trim().replace(/^["']|["']$/g, '');
  if (!key) return null;
  let r = null;
  for (let i = 0; i < 4 && !r?.success; i++) {   // vừa đổi IP thì SuiProxy khoá đổi ~60 giây ("thử lại sau N giây") → chờ đúng chừng đó
    r = await (await fetch(`https://api.suiproxy.com/api/proxy/get-new-proxy?api_key=${key}`, { signal: AbortSignal.timeout(20_000) })).json().catch(() => null);
    const cho = Number(String(r?.message ?? '').match(/(\d+)\s*giây/)?.[1] ?? 0);
    if (!r?.success && cho > 0 && cho <= 90) await new Promise((ok) => setTimeout(ok, (cho + 2) * 1000)); else if (!r?.success) break;
  }
  if (!r?.success) return null;
  mkdirSync(DATA, { recursive: true });
  writeFileSync(f, JSON.stringify({ ep: r.data.proxyHttp, het: Date.now() + (Number(r.data.timeLive) || 1500) * 1000 }));
  return r.data.proxyHttp;
}
/** Lấy một trang Amazon: IP proxy bị chặn → bỏ IP đó, xin IP mới, thử lại (tối đa 3 IP / lượt — chặn hay không tuỳ IP: 16/10 IP 27.76.x đọc
 *  được, IP 58.186.x bị 503). Không được thì null = chưa kiểm được. Mọi chỗ đọc Amazon đi qua đây. */
let soLanDoiIp = 0;
async function amazon(url) {
  for (;;) {
    const ep = await proxyAmazon(); if (!ep) return null;
    const html = layQuaProxy(url, ep); if (html) return html;
    if (++soLanDoiIp > 3) return null;
    boProxy();
  }
}
function boProxy() { try { writeFileSync(`${DATA}/proxy.json`, '{}'); } catch { /* chưa có thư mục */ } }
/** GET qua proxy bằng curl (fetch của Node không đi proxy HTTP sẵn). Amazon chặn IP (503, trang captcha, trang cụt) → null: KHÔNG được coi là
 *  "chưa có sách" (16/10/2026 chạy thử: proxy bị chặn mà máy báo bản bìa cứng Nostalgic "chưa thấy" trong khi nó đã lên). */
export function trangAmazonHong(code, html) { return code !== 200 || html.length < 20_000 || /captcha|robot check|api-services-support@amazon/i.test(html); }
function layQuaProxy(url, ep) {
  let out = '';
  try { out = execFileSync('curl', ['-s', '--compressed', '-m', '40', '-x', `http://${ep}`, '-A', UA, '-H', 'Accept-Language: en-US,en;q=0.9', '-w', '\n%{http_code}', url], { encoding: 'utf8', maxBuffer: 20e6 }); }
  catch { return null; }
  const i = out.lastIndexOf('\n'), html = out.slice(0, i), code = Number(out.slice(i + 1));
  return trangAmazonHong(code, html) ? null : html;
}

const KIEM = {
  'app-store': async (p) => {
    if (!/^\d{6,}$/.test(String(p.sku ?? ''))) return null;
    const ver = (await api('GET', `/v1/apps/${p.sku}/appStoreVersions?filter[platform]=IOS&limit=20&fields[appStoreVersions]=versionString,appStoreState,createdDate`)).data;
    const tt = trangThaiAsc(ver.map((x) => ({ version: x.attributes.versionString, state: x.attributes.appStoreState, created: x.attributes.createdDate })));
    if (tt?.status === 'published') {
      // đang bán mà CHƯA MỞ VÙNG BÁN = không hiện ở nước nào (Giỗ Chạp 15-16/10/2026) — mở bằng `node Tools/asc.mjs vungban` của app
      let coVung = true;
      try { await api('GET', `/v1/apps/${p.sku}/appAvailabilityV2`); } catch (e) { if (/\b404\b/.test(String(e.message))) coVung = false; else throw e; }
      if (!coVung) tt.dong += ' — CHƯA MỞ VÙNG BÁN: không hiện ở nước nào (chạy Tools/asc.mjs vungban)';
      else {   // kiểm THẬT trên store công khai: Apple mất vài giờ (có khi 24 giờ) mới hiện sau khi mở vùng bán
        const thay = async (c) => (await (await fetch(`https://itunes.apple.com/lookup?id=${p.sku}&country=${c}`, { signal: AbortSignal.timeout(15_000) })).json().catch(() => ({}))).resultCount > 0;
        const [vn, us] = [await thay('vn'), await thay('us')];
        if (!vn || !us) tt.dong += ` — chưa hiện trên store ${[!vn && 'VN', !us && 'US'].filter(Boolean).join(' + ')}`;
      }
      if (!p.url) tt.url = `https://apps.apple.com/app/id${p.sku}`;
    }
    return tt;
  },
  kdp: async (p) => {
    if (!['in_review', 'pending'].includes(p.status)) return null;
    const isbn = isbnCua(p);
    if (!isbn) return { status: p.status, dong: `⟳ Duyệt KDP: chưa kiểm được — sổ chưa có ISBN (${ngayVn()})` };
    const tim = await amazon(`https://www.amazon.com/s?k=${isbn}&i=stripbooks`);
    if (!tim) return null;   // Amazon chặn / proxy hỏng: chưa kiểm được, lượt sau thử lại
    for (const asin of dpTrongTrang(tim).slice(0, 4)) {
      const trang = await amazon(`https://www.amazon.com/dp/${asin}`);
      if (trang == null) return null;   // bị chặn giữa chừng: không kết luận
      if (trangCoIsbn(trang, isbn)) return { status: 'published', dong: `⟳ Duyệt KDP: đã lên Amazon ${asin} (${ngayVn()})`, url: `https://www.amazon.com/dp/${asin}` };
    }
    return { status: p.status, dong: `⟳ Duyệt KDP: chưa thấy trên Amazon (kiểm ${ngayVn()})` };
  },
  'ms-store': async (p) => {
    if (!/^9[0-9A-Z]{11}$/.test(String(p.sku ?? ''))) return null;
    const r = await fetch(`https://storeedgefd.dsx.mp.microsoft.com/v9.0/products/${p.sku}?market=US&locale=en-US&deviceFamily=Windows.Desktop`, { signal: AbortSignal.timeout(20_000) });
    const url = `https://apps.microsoft.com/detail/${p.sku.toLowerCase()}`;
    if (r.ok) { const j = await r.json().catch(() => null); if (j?.Payload?.Title) return { status: 'published', dong: `⟳ Duyệt MS Store: đang bán (${ngayVn()})`, url }; }
    if (r.status !== 404 && !r.ok) return null;   // Store lỗi tạm: không kết luận
    if (p.status === 'published') return { status: 'published', dong: `⟳ Duyệt MS Store: KHÔNG thấy trên Store US (kiểm ${ngayVn()})` };
    return { status: p.status === 'draft' ? 'draft' : 'in_review', dong: `⟳ Duyệt MS Store: chưa lên (kiểm ${ngayVn()})` };
  },
  'wordpress.org': async (p) => {
    if (!['in_review', 'pending'].includes(p.status) || !p.sku) return null;
    const j = await (await fetch(`https://api.wordpress.org/plugins/info/1.2/?action=plugin_information&request%5Bslug%5D=${encodeURIComponent(p.sku)}`, { signal: AbortSignal.timeout(20_000) })).json().catch(() => null);
    if (!j) return null;
    if (j.slug) return { status: 'published', dong: `⟳ Duyệt WP.org: đã lên ${j.version ?? ''} (${ngayVn()})`.replace('  ', ' '), url: `https://wordpress.org/plugins/${j.slug}/` };
    return { status: p.status, dong: `⟳ Duyệt WP.org: chưa lên (kiểm ${ngayVn()})` };
  },
};

// ── vòng chính ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const DRY = process.argv.includes('--dry');
const log = (...a) => console.log(new Date().toISOString().slice(0, 19), ...a);
const U = process.env.DIRECTUS_URL || 'https://as.on.tc';
const H = { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}`, 'Content-Type': 'application/json' };
const pr = await fetch(`${U}/items/products?limit=-1&fields=id,title,platform,sku,status,notes,url&filter[platform][_in]=${Object.keys(KIEM).join(',')}`, { headers: H });
if (!pr.ok) throw new Error(`Directus products → ${pr.status} ${(await pr.text()).slice(0, 200)}`);
const doi = [];
let kiem = 0, chuaKiem = 0;
const sp = (await pr.json()).data;
for (const p of sp) {
  let tt;
  try { tt = await KIEM[p.platform](p); } catch (e) { log(`${p.platform} · ${p.title}: lỗi ${String(e.message).slice(0, 120)}`); chuaKiem++; continue; }
  if (!tt) { if (['in_review', 'pending'].includes(p.status)) chuaKiem++; continue; }
  kiem++;
  const notes = ghiChu(p.notes, tt.dong), url = tt.url ?? p.url ?? null;
  if (tt.status === p.status && notes === (p.notes ?? null) && url === (p.url ?? null)) continue;
  const moiCanhBao = /CHƯA MỞ VÙNG BÁN/.test(tt.dong ?? '') && !/CHƯA MỞ VÙNG BÁN/.test(p.notes ?? '');
  if (tt.status !== p.status || moiCanhBao) doi.push({ nen: p.platform, ten: p.title, cu: p.status, moi: tt.status, dong: tt.dong, url });
  log(`${p.platform} · ${p.title}: ${CHU_SO[p.status] ?? p.status} → ${CHU_SO[tt.status] ?? tt.status}${tt.dong ? ` (${tt.dong})` : ''}`);
  if (DRY) continue;
  const r = await fetch(`${U}/items/products/${p.id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ status: tt.status, notes, url }) });
  if (!r.ok) log(`  lỗi ghi ${r.status} ${(await r.text()).slice(0, 150)}`);
}
log(`xong: kiểm ${kiem} · chưa kiểm được ${chuaKiem} · đổi trạng thái ${doi.length}`);

// ── ĐO BSR (anh 16/10/2026: "xem traffic từng quyển" — Amazon không cho tác giả xem lượt xem trang; BSR lên xuống hằng ngày là dấu có người
// mua). Sách KDP đang bán có link /dp/ → mỗi cuốn MỘT lần/ngày (giờ VN) vào product_stats (platform kdp, raw_data.bsr + hang). Amazon chặn
// lượt này thì giờ sau thử lại (chưa có số hôm nay = chưa đo, không ghi 0).
const homNay = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
let doBsr = 0, chanBsr = 0;
for (const p of sp.filter((x) => x.platform === 'kdp' && x.status === 'published' && /\/dp\/([0-9A-Z]{10})/.test(x.url ?? ''))) {
  const asin = p.url.match(/\/dp\/([0-9A-Z]{10})/)[1];
  const cu = (await (await fetch(`${U}/items/product_stats?limit=1&fields=id,raw_data&filter[product_id][_eq]=${p.id}&filter[date][_eq]=${homNay}&filter[platform][_eq]=kdp`, { headers: H })).json()).data?.[0];
  if (cu?.raw_data?.bsr !== undefined) continue;   // hôm nay đã đo
  const html = await amazon(`https://www.amazon.com/dp/${asin}`);
  if (!html) { chanBsr++; continue; }
  const b = docBsr(html);
  doBsr++;
  log(`BSR ${p.title.slice(0, 40)} (${asin}): ${b.bsr ? `#${b.bsr} Books` : 'chưa có hạng tổng'}${b.hang.length ? ` · ${b.hang.map((h) => `#${h.so} ${h.muc}`).join(' · ')}` : ''}`);
  if (DRY) continue;
  const raw = { ...(cu?.raw_data ?? {}), bsr: b.bsr, hang: b.hang, asin };
  await fetch(cu ? `${U}/items/product_stats/${cu.id}` : `${U}/items/product_stats`, { method: cu ? 'PATCH' : 'POST', headers: H,
    body: JSON.stringify(cu ? { raw_data: raw } : { product_id: p.id, date: homNay, platform: 'kdp', raw_data: raw }) });
}
if (doBsr || chanBsr) log(`BSR: đo ${doBsr} cuốn${chanBsr ? ` · Amazon chặn ${chanBsr} (giờ sau thử lại)` : ''}`);

// Báo Telegram khi trạng thái ĐỔI. Bot + nhóm đọc trong vault mos2 (acct #476, nhóm MINE, topic Quản lý).
if (doi.length && !DRY && process.env.MOS2_SECRET_KEY && process.env.DATABASE_URL) {
  const { default: postgres } = await import('postgres');
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    const [t] = await sql`SELECT pgp_sym_decrypt(decode(data->>'token_enc','base64'), ${process.env.MOS2_SECRET_KEY}) AS t FROM account_state WHERE account_id = 476 AND kind = 'api' AND ref = 'bot_token'`;
    const [g] = await sql`SELECT data FROM account_state WHERE account_id = 476 AND kind = 'property' AND ref = 'mine'`;
    const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const TEN_NEN = { 'app-store': 'App Store', kdp: 'KDP', 'wordpress.org': 'WordPress.org' };
    const text = `<b>Duyệt sau đăng — trạng thái đổi</b> (Nga)\n` + doi.map((d) => `• ${TEN_NEN[d.nen] ?? d.nen} · ${esc(d.ten)}: ${CHU_SO[d.cu] ?? d.cu} → <b>${CHU_SO[d.moi] ?? d.moi}</b>`
      + (d.dong ? `\n  ${esc(d.dong.replace(/^⟳ (ASC|Duyệt [^:]+:) ?/, ''))}` : '') + (d.url && d.moi === 'published' ? `\n  ${esc(d.url)}` : '')).join('\n');
    const r = await fetch(`https://api.telegram.org/bot${t?.t}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: g?.data?.chat_id, message_thread_id: g?.data?.topics?.['Quản lý'], text, parse_mode: 'HTML', disable_web_page_preview: true }) });
    log(r.ok ? 'đã báo Telegram MINE › Quản lý' : `Telegram lỗi ${r.status}`);
  } finally { await sql.end(); }
}
