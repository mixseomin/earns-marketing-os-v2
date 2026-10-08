// BÁO vào nhóm Telegram MINE (anh yêu cầu 08/10/2026), hai kênh đọc cùng sổ products:
//   'published'    → topic "🛍️ Sản phẩm mới" (TG_TOPIC): mỗi dòng vừa lên sàn (Etsy, KDP, Gumroad, App Store…) một tin.
//   'owner_review' → topic "🏭 Sản xuất xong" (TG_TOPIC_SX): sản phẩm dựng xong, chờ anh duyệt — gộp các dòng cùng tên thành MỘT tin.
// Bất kể đăng/dựng bằng script nào hay sửa tay trên MOS2 → @aiDavid_bot gửi tin.
// Đọc SỔ chứ không cắm vào từng script đăng: một chỗ bắt được mọi đường lên sàn.
// Lần chạy đầu (chưa có tệp trạng thái) chỉ ghi nhận các dòng đã published sẵn, KHÔNG báo lại hàng cũ.
// Chạy trên box3 bằng systemd timer bao-sp-telegram.timer (10 phút). Cấu hình bot: /root/.secrets/mine-tg.env
// (TG_BOT_TOKEN, TG_CHAT, TG_TOPIC — vault MOS2 #476); Directus từ .env.production qua EnvironmentFile.
//   node scripts/bao-sp-telegram.mjs [--dry]      node scripts/bao-sp-telegram.mjs --tu-kiem
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const NEN = { etsy: 'Etsy', kdp: 'Amazon KDP', gumroad: 'Gumroad', 'app-store': 'App Store', udemy: 'Udemy', 'mql5-market': 'MQL5 Market' };
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const gia = (p, c) => (p == null ? null : `${Number(p).toLocaleString('vi-VN')} ${c || 'USD'}`);
export const tin = (r) => [
  `🛍️ <b>Vừa lên sàn</b> · ${esc(NEN[r.platform] ?? r.platform)}${r.store ? ` · ${esc(r.store)}` : ''}`,
  `<b>${esc(r.title)}</b>`,
  [gia(r.price, r.currency), r.category].filter(Boolean).map(esc).join(' · ') || null,
  r.url ? esc(r.url) : '(sổ chưa có link)',
].filter(Boolean).join('\n');
export const tinSx = (ten, ds) => [
  `🏭 <b>Sản xuất xong · chờ anh duyệt</b>`,
  `<b>${esc(ten)}</b>`,
  ds.map((r) => `${esc(NEN[r.platform] ?? r.platform)}${r.category ? ` (${esc(r.category)})` : ''}`).join(' · '),
  ((d) => (d ? `Đăng dự kiến: ${esc(d)}` : null))(ds.map((r) => r.listing_config?.dangDuKien).filter(Boolean).sort()[0]),
  'Duyệt bản xem trong MOS2 › Tài sản',
].filter(Boolean).join('\n');

if (process.argv.includes('--tu-kiem')) {
  const a = await import('node:assert');
  const t = tin({ platform: 'etsy', store: 'FrontPorchZ', title: 'A <b> & C', price: '181000.00', currency: 'VND', category: 'pdf', url: 'https://x.y/1' });
  a.ok(t.includes('Etsy · FrontPorchZ') && t.includes('A &lt;b&gt; &amp; C') && t.includes('181.000 VND · pdf') && t.endsWith('https://x.y/1'));
  a.ok(tin({ platform: 'kdp', title: 'B' }).endsWith('(sổ chưa có link)'));
  const sx = tinSx('Sách A', [{ platform: 'etsy', category: 'pdf', listing_config: { dangDuKien: '2026-11-02' } }, { platform: 'kdp', category: 'paperback', listing_config: { dangDuKien: '2026-10-20' } }]);
  a.ok(sx.includes('Etsy (pdf) · Amazon KDP (paperback)') && sx.includes('Đăng dự kiến: 2026-10-20'));
  console.log('bao-sp-telegram: 3/3 ok'); process.exit(0);
}

const { DIRECTUS_URL = 'https://as.on.tc', DIRECTUS_TOKEN, TG_BOT_TOKEN, TG_CHAT, TG_TOPIC, TG_TOPIC_SX } = process.env;
if (!DIRECTUS_TOKEN || !TG_BOT_TOKEN || !TG_CHAT) throw new Error('thiếu DIRECTUS_TOKEN / TG_BOT_TOKEN / TG_CHAT');
const DRY = process.argv.includes('--dry');
const THU = process.env.BAO_SP_DIR || '/var/lib/mine-tg';

async function doc(st) {
  const r = await fetch(`${DIRECTUS_URL}/items/products?limit=-1&fields=id,title,platform,store,price,currency,category,url,listing_config&filter[status][_eq]=${st}`,
    { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
  if (!r.ok) throw new Error(`Directus ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).data;
}
async function gui(text, topic) {
  if (DRY) { console.log(`[dry] ${text.replace(/\n/g, ' | ')}`); return true; }
  const g = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, message_thread_id: topic ? Number(topic) : undefined, text, parse_mode: 'HTML' }) });
  const j = await g.json();
  if (!j.ok) { console.error(`✗ gửi hỏng: ${j.description}`); process.exitCode = 1; }
  return j.ok;
}
// Một kênh = một trạng thái sổ + một topic + một tệp "đã báo". nhom(ds) → [[khoá, text, ids]]. Lần đầu: ghi nhận, không báo.
async function kenh(st, topic, tep, nhom) {
  const TT = `${THU}/${tep}`, ds = await doc(st);
  if (!existsSync(TT)) { mkdirSync(THU, { recursive: true }); writeFileSync(TT, JSON.stringify(ds.map((x) => x.id))); console.log(`${st}: lần đầu, ghi nhận ${ds.length} dòng, không báo`); return; }
  // Chỉ giữ dòng CÒN ở trạng thái này: rời đi rồi quay lại (dựng lại sau góp ý → chờ duyệt lần nữa) thì báo lại
  const con = new Set(ds.map((x) => x.id)), da = new Set(JSON.parse(readFileSync(TT, 'utf8')).filter((i) => con.has(i)));
  const moi = nhom(ds.filter((x) => !da.has(x.id))).slice(0, 10);   // ponytail: tối đa 10 tin/lượt/kênh, phần còn lại lượt sau (giới hạn gửi của Telegram)
  for (const [k, text, ids] of moi) {
    if (!(await gui(text, topic))) continue;   // không ghi "đã báo" khi gửi hỏng → lượt sau thử lại
    ids.forEach((i) => da.add(i)); if (!DRY) writeFileSync(TT, JSON.stringify([...da]));
    console.log(`✓ ${st} · ${k}`);
  }
  if (!moi.length) console.log(`${st}: không có gì mới`);
}
await kenh('published', TG_TOPIC, 'da-bao.json', (ds) => ds.map((x) => [`${x.platform} · ${x.title}`, tin(x), [x.id]]));
if (TG_TOPIC_SX) await kenh('owner_review', TG_TOPIC_SX, 'da-bao-sx.json', (ds) => {
  const g = new Map(); for (const x of ds) g.set(x.title, [...(g.get(x.title) ?? []), x]);
  return [...g].map(([ten, xs]) => [ten, tinSx(ten, xs), xs.map((x) => x.id)]);
});
