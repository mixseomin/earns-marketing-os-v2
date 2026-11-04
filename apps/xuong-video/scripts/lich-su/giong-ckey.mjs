#!/usr/bin/env node
// GIỌNG ĐỌC QUA CKEY (05/11/2026, anh: "Ckey cũng có voice này"): ElevenLabs qua người bán Speakvela trên ckey.vn — 156₫ một lượt (≤ 1.000 ký tự),
// rẻ hơn fal eleven-v3 (~2.600₫ / 1.000 ký tự) khoảng 16 lần. Luật "ckey trước, chính hãng cuối". Trả MP3, KHÔNG có mốc từng chữ → đọc MỖI CÂU một lượt,
// mốc cảnh lấy theo độ dài thật từng câu (shot-code/long-tieng.mjs). Chạy trên box3 (khoá CKEY_API_KEY ở .env.production, không ra khỏi máy chủ):
//   node scripts/lich-su/giong-ckey.mjs <yeu-cau.json> <thư-mục-ra>
//   yeu-cau.json = { giong: 'Charlotte', engine?: 'v3', language?: 'en', cau: [{ khoa, chu }] }  → <ra>/<khoa>.mp3 mỗi câu; in tiền thật cuối
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [tep, ra] = process.argv.slice(2); if (!tep || !ra) { console.error('node giong-ckey.mjs <yeu-cau.json> <ra>'); process.exit(2); }
const Y = JSON.parse(readFileSync(tep, 'utf8')), MODEL = 'Speakvela/ElevenLabs-TTS', GIA = 156;
if (!process.env.CKEY_API_KEY) { console.error('thiếu CKEY_API_KEY'); process.exit(3); }
mkdirSync(ra, { recursive: true }); let dem = 0;
for (const c of Y.cau) {
  if (c.chu.length > 1000) { console.error(`✗ câu ${c.khoa} dài ${c.chu.length} ký tự (> 1.000 của gói 156₫)`); process.exit(4); }
  let r = null;
  for (let lan = 1; lan <= 3; lan++) {   // chợ người bán: lỗi tạm (5xx / hết hạn kết nối) thử lại tối đa 3 lần, 4xx thì dừng ngay
    r = await fetch('https://api.xah.io/v1/audio/speech', { method: 'POST', headers: { authorization: `Bearer ${process.env.CKEY_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, input: c.chu, voice: Y.giong ?? 'Charlotte', engine: Y.engine ?? 'v3', ...(Y.language && Y.language !== 'en' ? { language: Y.language } : {}) }),
      signal: AbortSignal.timeout(120_000) }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
    if (r.ok || (r.status >= 400 && r.status < 500)) break;
  }
  if (!r.ok) { console.error(`✗ ckey ${r.status} câu ${c.khoa}: ${(await r.text()).slice(0, 300)}`); process.exit(1); }
  writeFileSync(join(ra, `${c.khoa}.mp3`), Buffer.from(await r.arrayBuffer())); dem++;
}
console.log(`ckey ${MODEL} · ${dem} câu · ${Y.cau.reduce((s, c) => s + c.chu.length, 0)} ký tự · tiền ${dem * GIA}₫`);
