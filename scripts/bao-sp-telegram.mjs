// BÁO vào nhóm Telegram MINE (anh yêu cầu 08/10/2026), ba kênh đọc cùng sổ products (Directus):
//   'published'      → topic "🛍️ Sản phẩm mới" (TG_TOPIC): mỗi dòng vừa lên sàn (Etsy, KDP, Gumroad, App Store…) một tin.
//   'owner_review'   → topic "🏭 Sản xuất xong" (TG_TOPIC_SX): sách dựng xong chờ anh duyệt — gộp các dòng cùng tên, kèm link duyệt.
//                     Anh duyệt xong → bot thả ❤ vào tin NGAY (nút Duyệt đánh thức bot qua bao-sp-telegram.path), 1 phút sau mới xoá.
//   tới ngày chưa duyệt → topic "🛍️ Sản phẩm mới": ngày đăng dự kiến (giờ VN) đã tới mà sách còn planned/draft/owner_review —
//                       mỗi sách tối đa MỘT tin mỗi ngày, kèm link mở thẳng drawer duyệt trên MOS2.
//   tới ngày cần đăng → topic "🛍️ Sản phẩm mới": đã duyệt + tới ngày + nền KDP/Gumroad (Publish là chữ ký của anh) → nhắc đăng.
// Bất kể đăng/dựng bằng script nào hay sửa tay trên MOS2. Lần đầu mỗi kênh (chưa có tệp trạng thái) chỉ ghi nhận, không báo hàng cũ.
// Chạy trên box3 bằng systemd timer bao-sp-telegram.timer (1 phút: anh duyệt xong là tin biến gần như ngay). Cấu hình bot: /root/.secrets/mine-tg.env
// (TG_BOT_TOKEN, TG_CHAT, TG_TOPIC, TG_TOPIC_SX — vault MOS2 #476); Directus từ .env.production qua EnvironmentFile.
//   node scripts/bao-sp-telegram.mjs [--dry]      node scripts/bao-sp-telegram.mjs --tu-kiem
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
// CÙNG luật "đã duyệt bản này" với tab Tài sản (doc.ts: cho_anh + daDuyetBanNay → sẵn sàng). Sổ chỉ đổi status khi quy-trinh chạy lại,
// nên đọc status trơn thì sách anh đã duyệt vẫn bị nhắc (Bible/Christmas 09/10/2026). Node ≥22.18 chạy thẳng .ts (bỏ kiểu).
import { daDuyetBanNay } from '../apps/web/src/lib/tai-san/kieu.ts';
const lc = (r) => r.listing_config ?? {};
/** Còn đúng là việc của anh: status chưa qua 'chờ duyệt' và chưa có lần duyệt nào mới hơn bản xem hiện tại. */
export const choAnh = (r) => !(r.status === 'owner_review' && daDuyetBanNay(lc(r).duyetLuc || lc(r).duyet, lc(r).xem?.ngay));

const MOS2 = process.env.MOS2_URL || 'https://mos2.on.tc';
// Link mở thẳng drawer sản phẩm trong tab Tài sản (tai-san-view.tsx: useModalParam('sp') → ?sp=sp&spId=<khoa>, khoa = 'd:<id sổ>').
// Nút Duyệt trong drawer duyệt MỌI dòng cùng tên sách (lib/actions/san-pham-duyet.ts) → link tới một dòng là đủ.
export const linkDuyet = (id) => `${MOS2}/?tab=taisan&sp=sp&spId=${encodeURIComponent(`d:${id}`)}`;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const DD = { paperback: 'bìa mềm', hardcover: 'bìa cứng', ebook: 'ebook' };
export const nen = (r) => ({ etsy: 'Etsy', gumroad: 'Gumroad', 'app-store': 'App Store', udemy: 'Udemy', 'mql5-market': 'MQL5' }[r.platform]
  ?? (r.platform === 'kdp' ? `KDP ${DD[r.category] ?? r.category ?? ''}`.trim() : r.platform));
export const gia = (p, c) => (p == null || Number(p) === 0 ? null : (c || 'USD') === 'USD' ? `$${Number(p).toFixed(2)}` : c === 'VND' ? `${Math.round(Number(p)).toLocaleString('vi-VN')} ₫` : `${Number(p)} ${c}`);
export const ngayVn = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '');
const dong = (...xs) => xs.filter(Boolean).join(' · ');
const dau = (ds) => ds.find((r) => r.platform === 'etsy') ?? ds[0];   // dòng đại diện cho link duyệt
const ngayDang = (ds) => ds.map((r) => r.listing_config?.dangDuKien).filter(Boolean).sort()[0] ?? null;

export const tin = (r) => [
  `🛍️ <b>${esc(r.title)}</b>`,
  esc(dong(nen(r), gia(r.price, r.currency))),
  r.url ? `<a href="${esc(r.url)}">Xem trên ${esc(nen(r).split(' ')[0])} →</a>` : '<i>sổ chưa có link sàn</i>',
].join('\n');
export const tinSx = (ten, ds) => [
  `🏭 <b>${esc(ten)}</b>`,
  esc(dong(ds.map(nen).join(', '), ngayDang(ds) && `đăng ${ngayVn(ngayDang(ds))}`)),
  `<a href="${esc(linkDuyet(dau(ds).id))}">Xem + duyệt trong MOS2 →</a>`,
].join('\n');
export const tinTre = (ten, ds, homNay) => {
  const d = ngayDang(ds), tre = Math.round((Date.parse(homNay) - Date.parse(d)) / 86_400_000);
  const chuaDung = ds.every((r) => r.status !== 'owner_review');
  return [
    `⏰ <b>${esc(ten)}</b>`,
    esc(dong(`đăng ${ngayVn(d)}${tre > 0 ? ` (trễ ${tre} ngày)` : ' (hôm nay)'}`, ds.map(nen).join(', '))),
    chuaDung ? '<i>Chưa sản xuất xong</i>' : `<a href="${esc(linkDuyet(dau(ds).id))}">Chưa duyệt, vào duyệt →</a>`,
  ].join('\n');
};

// Trang Pricing của nháp KDP = nơi có nút "Publish Your Paperback Book" (đúng đường link Bookshelf dùng, đọc 10/10/2026)
export const linkKdp = (id) => `https://kdp.amazon.com/action/dualbookshelf.editpaperbackpricing/en_US/title-setup/paperback/${encodeURIComponent(id)}/pricing`;
// KDP chỉ nhắc khi máy ĐÃ tạo nháp (puzzle-books kdp.mjs ghi listing_config.nhapKdp) — trước đó anh không có gì để bấm
export const canNhac = (r) => r.platform !== 'kdp' || !!r.listing_config?.nhapKdp?.id;
export const tinCanDang = (ten, ds, homNay) => {
  const d = ngayDang(ds), tre = Math.round((Date.parse(homNay) - Date.parse(d)) / 86_400_000);
  const nhap = ds.find((r) => r.platform === 'kdp' && r.listing_config?.nhapKdp?.id)?.listing_config.nhapKdp, khac = ds.filter((r) => r.platform !== 'kdp');
  return [
    `📤 <b>${esc(ten)}</b>`,
    esc(dong(`đăng ${ngayVn(d)}${tre > 0 ? ` (trễ ${tre} ngày)` : ' (hôm nay)'}`, ds.map(nen).join(', '))),
    ...(nhap ? ['<i>Nháp KDP đã sẵn, chỉ còn bấm Publish</i>', ...(nhap.canhBao ? [`⚠️ ${esc(nhap.canhBao)}`] : []), `<a href="${esc(linkKdp(nhap.id))}">Mở nháp KDP (trang có nút Publish) →</a>`] : []),
    ...(khac.length ? [`<i>${esc(khac.map(nen).join(', '))}: đã duyệt, cần bấm Publish trên sàn</i>`] : []),
  ].join('\n');
};

if (process.argv.includes('--tu-kiem')) {
  const a = await import('node:assert');
  const t = tin({ platform: 'etsy', title: 'A <b> & C', price: '181000.00', currency: 'VND', url: 'https://x.y/1' });
  a.equal(t, '🛍️ <b>A &lt;b&gt; &amp; C</b>\nEtsy · 181.000 ₫\n<a href="https://x.y/1">Xem trên Etsy →</a>');
  a.ok(tin({ platform: 'kdp', category: 'paperback', title: 'B', price: '9.99', currency: 'USD' }).includes('KDP bìa mềm · $9.99\n<i>'));
  const ds = [{ id: 'e1', platform: 'etsy', status: 'owner_review', listing_config: { dangDuKien: '2026-11-02' } }, { id: 'k1', platform: 'kdp', category: 'paperback', status: 'owner_review', listing_config: { dangDuKien: '2026-10-20' } }];
  a.ok(tinSx('S', ds).includes('Etsy, KDP bìa mềm · đăng 20/10') && tinSx('S', ds).includes('spId=d%3Ae1'));
  a.ok(tinTre('S', ds, '2026-10-22').includes('đăng 20/10 (trễ 2 ngày)') && tinTre('S', ds, '2026-10-22').includes('vào duyệt'));
  const nhap = ds.map((r) => ({ ...r, status: 'draft' }));
  a.ok(tinTre('S', nhap, '2026-10-20').includes('(hôm nay)') && tinTre('S', nhap, '2026-10-20').includes('Chưa sản xuất xong'));
  a.equal(choAnh({ status: 'owner_review', listing_config: { duyetLuc: '2026-10-08T11:24:30Z', xem: { ngay: '2026-10-06T17:44:59Z' } } }), false);   // đã duyệt bản này
  a.equal(choAnh({ status: 'owner_review', listing_config: { duyetLuc: '2026-10-05T11:00:00Z', xem: { ngay: '2026-10-06T17:44:59Z' } } }), true);    // dựng lại sau lần duyệt
  a.equal(choAnh({ status: 'draft', listing_config: {} }), true);
  a.ok(tinCanDang('S', [{ platform: 'gumroad', listing_config: { dangDuKien: '2026-10-10' } }], '2026-10-12').includes('đăng 10/10 (trễ 2 ngày) · Gumroad'));
  const k = { platform: 'kdp', category: 'paperback', listing_config: { dangDuKien: '2026-10-10', nhapKdp: { id: 'AB12CD34EF5', canhBao: 'chỉ chọn được 1/3 danh mục' } } };
  a.ok(!canNhac({ platform: 'kdp', listing_config: {} }) && canNhac(k) && canNhac({ platform: 'gumroad' }));   // KDP chưa có nháp → không nhắc
  const tk = tinCanDang('S', [k], '2026-10-10');
  a.ok(tk.includes('Nháp KDP đã sẵn') && tk.includes('paperback/AB12CD34EF5/pricing') && tk.includes('1/3 danh mục') && !tk.includes('cần bấm Publish trên sàn'));
  console.log('bao-sp-telegram: 11/11 ok'); process.exit(0);
}

const { DIRECTUS_URL = 'https://as.on.tc', DIRECTUS_TOKEN, TG_BOT_TOKEN, TG_CHAT, TG_TOPIC, TG_TOPIC_SX } = process.env;
if (!DIRECTUS_TOKEN || !TG_BOT_TOKEN || !TG_CHAT) throw new Error('thiếu DIRECTUS_TOKEN / TG_BOT_TOKEN / TG_CHAT');
const DRY = process.argv.includes('--dry');
const THU = process.env.BAO_SP_DIR || '/var/lib/mine-tg';
const HOM_NAY = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });   // lịch đăng tính theo ngày của anh

async function doc(st) {
  const r = await fetch(`${DIRECTUS_URL}/items/products?limit=-1&fields=id,title,status,platform,store,price,currency,category,url,listing_config&filter[status][_in]=${st}`,
    { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
  if (!r.ok) throw new Error(`Directus ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).data;
}
// Link duyệt MOS2 (trang cần đăng nhập) không có gì để xem trước → tắt preview cho gọn; link sàn (Etsy…) giữ ảnh nhỏ.
// Trả message_id (để xoá khi việc đã xong) hoặc null khi gửi hỏng.
async function gui(text, topic) {
  if (DRY) { console.log(`[dry] ${text.replace(/\n/g, ' | ')}`); return -1; }
  const g = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, message_thread_id: topic ? Number(topic) : undefined, text, parse_mode: 'HTML',
      link_preview_options: text.includes(MOS2) || text.includes('kdp.amazon.com') ? { is_disabled: true } : { prefer_small_media: true } }) });
  const j = await g.json();
  if (!j.ok) { console.error(`✗ gửi hỏng: ${j.description}`); process.exitCode = 1; return null; }
  return j.result.message_id;
}
// Xoá tin CỦA BOT (chỉ mã tin chính bot đã gửi và lưu trong tệp trạng thái — không bao giờ đoán mã tin, vì bot là admin xoá được cả tin người khác)
async function xoa(ids) {
  for (const id of ids) {
    if (DRY || id < 0) { console.log(`[dry] xoá tin ${id}`); continue; }
    const j = await (await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/deleteMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, message_id: id }) })).json();
    if (!j.ok && !/not found|can't be deleted/i.test(j.description)) console.error(`✗ xoá tin ${id}: ${j.description}`);
  }
}
// Thả ❤ vào tin (Bot API setMessageReaction) — dấu "anh duyệt rồi" hiện NGAY, tin còn nằm đó 1 phút rồi mới xoá.
async function tha(id) {
  if (DRY || id < 0) { console.log(`[dry] ❤ tin ${id}`); return; }
  const j = await (await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/setMessageReaction`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, message_id: id, reaction: [{ type: 'emoji', emoji: '❤' }] }) })).json();
  if (!j.ok) console.error(`✗ thả tim tin ${id}: ${j.description}`);
}
const XOA_SAU = 60_000;   // ms: thả tim xong bao lâu thì xoá
const quaHan = (luc) => Date.now() - Date.parse(luc) >= XOA_SAU;
const gom = (ds) => { const g = new Map(); for (const x of ds) g.set(x.title, [...(g.get(x.title) ?? []), x]); return [...g]; };
const docTep = (p) => JSON.parse(readFileSync(p, 'utf8'));
const ghi = (p, v) => { if (!DRY) writeFileSync(p, JSON.stringify(v)); };

// Kênh theo TRẠNG THÁI. Tệp = { da: [id dòng đã báo], tin: { message_id: [id dòng] } }; tệp cũ dạng mảng = chỉ có 'da'.
// donKhiXong: tin mà MỌI dòng của nó đã rời trạng thái này (anh duyệt xong → ready) thì xoá — kênh "việc cần làm" tự dọn.
async function kenh(st, topic, tep, nhom, donKhiXong = false, loc = () => true) {
  const TT = `${THU}/${tep}`, ds = (await doc(st)).filter(loc);
  if (!existsSync(TT)) { mkdirSync(THU, { recursive: true }); writeFileSync(TT, JSON.stringify({ da: ds.map((x) => x.id), tin: {} })); console.log(`${st}: lần đầu, ghi nhận ${ds.length} dòng, không báo`); return; }
  const cu = docTep(TT), S = Array.isArray(cu) ? { da: cu, tin: {} } : cu;
  // Chỉ giữ dòng CÒN ở trạng thái này: rời đi rồi quay lại (dựng lại sau góp ý → chờ duyệt lần nữa) thì báo lại
  const con = new Set(ds.map((x) => x.id)), da = new Set(S.da.filter((i) => con.has(i)));
  // Việc xong (mọi dòng của tin đã rời trạng thái): lượt đầu thả ❤ + ghi giờ; đủ 1 phút sau mới xoá. Quay lại chờ duyệt trước khi xoá → bỏ dấu giờ.
  S.xong ??= {};
  if (donKhiXong) for (const [m, ids] of Object.entries(S.tin)) {
    if (ids.some((i) => con.has(i))) { delete S.xong[m]; continue; }
    if (!S.xong[m]) { await tha(Number(m)); S.xong[m] = new Date().toISOString(); console.log(`❤ ${st} · tin ${m}`); }
    else if (quaHan(S.xong[m])) { await xoa([Number(m)]); delete S.tin[m]; delete S.xong[m]; console.log(`🗑 ${st} · xoá tin ${m}`); }
  }
  const moi = nhom(ds.filter((x) => !da.has(x.id))).slice(0, 10);   // ponytail: tối đa 10 tin/lượt/kênh, phần còn lại lượt sau (giới hạn gửi của Telegram)
  for (const [k, text, ids] of moi) {
    const m = await gui(text, topic); if (m == null) continue;   // không ghi "đã báo" khi gửi hỏng → lượt sau thử lại
    ids.forEach((i) => da.add(i)); if (donKhiXong) S.tin[m] = ids;
    console.log(`✓ ${st} · ${k}`);
  }
  S.da = [...da]; ghi(TT, S);
  if (!moi.length) console.log(`${st}: không có gì mới`);
}
await kenh('published', TG_TOPIC, 'da-bao.json', (ds) => ds.map((x) => [`${x.platform} · ${x.title}`, tin(x), [x.id]]));
if (TG_TOPIC_SX) await kenh('owner_review', TG_TOPIC_SX, 'da-bao-sx.json', (ds) => gom(ds).map(([ten, xs]) => [ten, tinSx(ten, xs), xs.map((x) => x.id)]), true, choAnh);

// Kênh NHẮC THEO NGÀY: tệp = { tên sách: { ngay, tin: [message_id], xong? } }. Mỗi sách một tin mỗi ngày (tin mới thay tin cũ);
// sách ra khỏi danh sách (anh duyệt / đã đăng) → thả ❤ ngay, 1 phút sau xoá.
async function nhacTheoNgay(tep, nhan, ds, viet) {
  const TT = `${THU}/${tep}`, nhac = Object.fromEntries(Object.entries(existsSync(TT) ? docTep(TT) : {}).map(([k, v]) => [k, typeof v === 'string' ? { ngay: v, tin: [] } : v]));
  const nhom = gom(ds), con = new Set(nhom.map(([ten]) => ten));
  for (const ten of Object.keys(nhac)) {
    if (con.has(ten)) { delete nhac[ten].xong; continue; }
    if (!nhac[ten].xong) { for (const m of nhac[ten].tin) await tha(m); nhac[ten].xong = new Date().toISOString(); console.log(`❤ ${nhan} · ${ten}`); }
    else if (quaHan(nhac[ten].xong)) { await xoa(nhac[ten].tin); delete nhac[ten]; console.log(`🗑 ${nhan} · ${ten}: đã xong, xoá tin nhắc`); }
  }
  let n = 0;
  for (const [ten, xs] of nhom) {
    if (nhac[ten]?.ngay === HOM_NAY || n >= 10) continue;
    const m = await gui(viet(ten, xs), TG_TOPIC); if (m == null) continue;
    await xoa(nhac[ten]?.tin ?? []);
    nhac[ten] = { ngay: HOM_NAY, tin: [m] }; n++;
    console.log(`✓ ${nhan} · ${ten}`);
  }
  ghi(TT, nhac);
  if (!n) console.log(`${nhan}: không có gì mới`);
}
const toiNgay = (x) => x.listing_config?.dangDuKien && x.listing_config.dangDuKien <= HOM_NAY;
// Tới ngày mà CHƯA DUYỆT (hoặc chưa dựng xong)
await nhacTheoNgay('da-nhac-tre.json', 'tới ngày chưa duyệt', (await doc('planned,draft,owner_review')).filter(choAnh).filter(toiNgay), (ten, xs) => tinTre(ten, xs, HOM_NAY));
// Tới ngày, ĐÃ DUYỆT, nền máy không tự đăng được (KDP, Gumroad: nút Publish là của anh) → nhắc đăng. Etsy máy tự bật (may-chay dang) nên không nhắc.
const daDuyet = [...(await doc('ready')), ...(await doc('owner_review')).filter((x) => !choAnh(x))];
await nhacTheoNgay('da-nhac-dang.json', 'tới ngày cần đăng', daDuyet.filter((x) => ['kdp', 'gumroad'].includes(x.platform)).filter(canNhac).filter(toiNgay), (ten, xs) => tinCanDang(ten, xs, HOM_NAY));
