// BÁO SẢN PHẨM MỚI vào nhóm Telegram MINE (anh yêu cầu 08/10/2026): mỗi dòng sổ products vừa sang 'published' (Etsy, KDP,
// Gumroad, App Store… — bất kể đăng bằng script nào hay sửa tay trên MOS2) → @aiDavid_bot gửi một tin vào topic "🛍️ Sản phẩm mới".
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

if (process.argv.includes('--tu-kiem')) {
  const a = await import('node:assert');
  const t = tin({ platform: 'etsy', store: 'FrontPorchZ', title: 'A <b> & C', price: '181000.00', currency: 'VND', category: 'pdf', url: 'https://x.y/1' });
  a.ok(t.includes('Etsy · FrontPorchZ') && t.includes('A &lt;b&gt; &amp; C') && t.includes('181.000 VND · pdf') && t.endsWith('https://x.y/1'));
  a.ok(tin({ platform: 'kdp', title: 'B' }).endsWith('(sổ chưa có link)'));
  console.log('bao-sp-telegram: 2/2 ok'); process.exit(0);
}

const { DIRECTUS_URL = 'https://as.on.tc', DIRECTUS_TOKEN, TG_BOT_TOKEN, TG_CHAT, TG_TOPIC } = process.env;
if (!DIRECTUS_TOKEN || !TG_BOT_TOKEN || !TG_CHAT) throw new Error('thiếu DIRECTUS_TOKEN / TG_BOT_TOKEN / TG_CHAT');
const DRY = process.argv.includes('--dry');
const TT = process.env.BAO_SP_STATE || '/var/lib/mine-tg/da-bao.json';

const r = await fetch(`${DIRECTUS_URL}/items/products?limit=-1&fields=id,title,platform,store,price,currency,category,url&filter[status][_eq]=published`,
  { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } });
if (!r.ok) throw new Error(`Directus ${r.status}: ${(await r.text()).slice(0, 200)}`);
const ds = (await r.json()).data;

if (!existsSync(TT)) {   // lần đầu: ghi nhận hàng đã bán sẵn, không báo
  mkdirSync(TT.replace(/\/[^/]+$/, ''), { recursive: true });
  writeFileSync(TT, JSON.stringify(ds.map((x) => x.id)));
  console.log(`lần đầu: ghi nhận ${ds.length} sản phẩm đã đăng, không báo`); process.exit(0);
}
const da = new Set(JSON.parse(readFileSync(TT, 'utf8')));
const moi = ds.filter((x) => !da.has(x.id)).slice(0, 10);   // ponytail: tối đa 10 tin/lượt, phần còn lại lượt sau (tránh giới hạn gửi của Telegram)
for (const x of moi) {
  if (DRY) { console.log(`[dry] ${tin(x).replace(/\n/g, ' | ')}`); continue; }
  const g = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, message_thread_id: TG_TOPIC ? Number(TG_TOPIC) : undefined, text: tin(x), parse_mode: 'HTML' }) });
  const j = await g.json();
  if (!j.ok) { console.error(`✗ gửi hỏng ${x.id}: ${j.description}`); process.exitCode = 1; continue; }   // không ghi "đã báo" khi gửi hỏng → lượt sau thử lại
  da.add(x.id); writeFileSync(TT, JSON.stringify([...da]));
  console.log(`✓ báo ${x.platform} · ${x.title}`);
}
if (!moi.length) console.log('không có sản phẩm mới');
