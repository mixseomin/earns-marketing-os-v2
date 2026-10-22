// DỊCH VỤ NGHE TELEGRAM LIÊN TỤC (anh 21/10/2026: "sao phải đợi 1 phút?"): trước đây tin / nút bấm chỉ được đọc khi nhịp cty-nhip chạy (mỗi phút).
// Dịch vụ này chờ sẵn (long-poll 30 giây) nên nút anh bấm đổi "⏳ đã nhận" trong 1–2 giây, tin vào đúng hộp phòng ngay. Dùng CHUNG gomTin (tg-phong.mjs):
// cùng offset, cùng khoá, cùng xếp hộp. Đập tim nghe.tim mỗi vòng — còn sống thì nhịp mỗi phút không gom (một nơi đọc bot thôi); dịch vụ chết thì
// sau 90 giây nhịp mỗi phút tự gom lại như cũ, không mất tin. systemd: apps/cty/deploy/cty-tg-nghe.service (Restart=always).
import fs from 'node:fs';
import path from 'node:path';
import { gomTin } from './tg-phong.mjs';
import { xuNutPhim } from './phim-nut.mjs';
import { xuNutSp, baoKetLenh } from './sp-nut.mjs';
import { bangEthopex, xuNutBang } from './ethopex.mjs';

const { TG_BOT_TOKEN: T, TG_CHAT: C } = process.env; if (!T || !C) { console.error('thiếu TG_BOT_TOKEN / TG_CHAT'); process.exit(1); }
const tg = async (m, b) => { const j = await (await fetch(`https://api.telegram.org/bot${T}/${m}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: C, ...b }), signal: AbortSignal.timeout(m === 'getUpdates' ? 45_000 : 15_000) })).json(); if (!j.ok && m !== 'getUpdates') console.error(`✗ telegram ${m}: ${j.description}`); return j; };
const tim = path.join(process.env.CTY_DATA_DIR || '/var/lib/cty', 'tg-hop', 'nghe.tim');
for (;;) {
  try { fs.mkdirSync(path.dirname(tim), { recursive: true }); fs.writeFileSync(tim, new Date().toISOString()); const n = await gomTin(tg, { cho: 30 }); if (n) console.log(`${new Date().toISOString()} ${n} tin`); if (await xuNutPhim(tg)) console.log('xử nút phim');
    try { if (await xuNutSp(tg)) console.log('xử nút đăng sản phẩm'); await baoKetLenh(tg); } catch (e) { console.error(`✗ nút đăng sản phẩm: ${e.message}`); }
    try { if (await xuNutBang(tg)) console.log('🔄 bảng Ethopex'); else { const b = await bangEthopex(tg); if (b) console.log(`bảng Ethopex: ${b}`); } } catch (e) { console.error(`✗ bảng Ethopex: ${e.message}`); } }
  catch (e) { console.error(`✗ nghe: ${e.message}`); await new Promise((r) => setTimeout(r, 5000)); }
}
