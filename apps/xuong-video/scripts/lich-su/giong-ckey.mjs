#!/usr/bin/env node
// CỔNG GIỌNG CHUNG (05/11/2026 ckey; 08/11/2026 anh: "chuyển vào cơ chế chung. Mọi AI API đều phải qua fallback"): mọi giọng ElevenLabs của xưởng
// (kênh lịch sử, shot-code, ảnh tĩnh Ethopex…) đi qua tệp này. Chuỗi: ckey Speakvela/ElevenLabs-TTS (156₫ / câu ≤ 1.000 ký tự, thử 3 lần lỗi tạm)
// → fal eleven-v3 (~2.600₫ / 1.000 ký tự) — luật "rẻ trước, chính hãng cuối"; bước nào chạy in ra để biết câu nào đã xuống tuyến sau.
// ckey NHẬN MÃ GIỌNG, LỜ TÊN (đo md5 08/11/2026: "Laura", "Brian", tên bịa đều ra CÙNG một giọng mặc định — trước ngày này mọi câu gửi tên đều sai giọng)
// → đổi tên sang mã ở MA_GIONG; tên không có trong bảng = DỪNG báo lỗi, không lặng lẽ đọc giọng mặc định. fal nhận tên như cũ.
// Chạy trên box3 (khoá CKEY_API_KEY / FAL_KEY ở .env.production, không ra khỏi máy chủ):
//   node scripts/lich-su/giong-ckey.mjs <yeu-cau.json> <thư-mục-ra>
//   yeu-cau.json = { giong: 'Charlotte' | '<mã>', engine?: 'v3', language?: 'en', cau: [{ khoa, chu }] }  → <ra>/<khoa>.mp3 mỗi câu; dòng cuối in tuyến + tiền thật
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// mã giọng có sẵn của ElevenLabs — từng mã đo trên ckey 08/11/2026 ra giọng riêng (khác giọng mặc định)
export const MA_GIONG = { Laura: 'FGY2WhTYpPnrIDTdsKH5', Brian: 'nPczCjzI2devNBz1zQrb', Callum: 'N2lVS1w4EtoT3dr4eOWO', Jessica: 'cgSgspJ2msm6clMCkdW9', George: 'JBFqnCBsd6RMkjVDRZzb',
  Daniel: 'onwK4e9ZLuTAKqWW03F9', Aria: '9BWtsMINqrJLrRacOk9x', Sarah: 'EXAVITQu4vr4xnSDxMaL', Chris: 'iP95p4xoKVk53GoZ742B', Charlotte: 'XB0fDUnXU5powFXDhCwa',
  River: 'SAz9YHcvj6GT2YYXdXww', Bill: 'pqHfZKP75CvOlQylNhV4' };   // Lily (pFZP…) ra trùng giọng mặc định — chưa có mã đúng
const GIA_CKEY = 156, VND_FAL_1K = 0.10 * 26000;
export function maGiong(g) {
  if (!g) return MA_GIONG.Charlotte;
  if (/^[A-Za-z0-9]{20}$/.test(g)) return g;   // đã là mã
  const k = Object.keys(MA_GIONG).find((x) => x.toLowerCase() === String(g).toLowerCase());
  if (!k) throw new Error(`giọng "${g}" chưa có mã trong MA_GIONG (giong-ckey.mjs) — ckey lờ tên, gửi tên sẽ ra giọng mặc định; thêm mã rồi chạy lại`);
  return MA_GIONG[k];
}

async function ckey(c, Y, ma) {
  let r = null;
  for (let lan = 1; lan <= 3; lan++) {   // chợ người bán: lỗi tạm (5xx / đứt kết nối) thử lại tối đa 3 lần, 4xx thì sang tuyến sau ngay
    r = await fetch('https://api.xah.io/v1/audio/speech', { method: 'POST', headers: { authorization: `Bearer ${process.env.CKEY_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'Speakvela/ElevenLabs-TTS', input: c.chu, voice: ma, engine: Y.engine ?? 'v3', ...(Y.language && Y.language !== 'en' ? { language: Y.language } : {}) }),
      signal: AbortSignal.timeout(120_000) }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
    if (r.ok || (r.status >= 400 && r.status < 500)) break;
  }
  if (!r.ok) throw new Error(`ckey ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const b = Buffer.from(await r.arrayBuffer()); if (b.length < 3000) throw new Error(`ckey trả ${b.length} byte — không phải tiếng`);
  return b;
}
async function fal(c, Y) {
  const r = await fetch('https://fal.run/fal-ai/elevenlabs/tts/eleven-v3', { method: 'POST', headers: { Authorization: `Key ${process.env.FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: c.chu, voice: Y.giong ?? 'Charlotte', language_code: Y.language ?? 'en', apply_text_normalization: 'auto' }), signal: AbortSignal.timeout(300_000) });
  if (!r.ok) throw new Error(`fal ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return Buffer.from(await (await fetch((await r.json()).audio.url)).arrayBuffer());
}

if (process.argv[1] === '-' || process.argv[1]?.endsWith('giong-ckey.mjs')) {   // '-': shot-code/long-tieng.mjs chạy bản repo máy mình qua stdin (node -)
  const [tep, ra] = process.argv.slice(2); if (!tep || !ra) { console.error('node giong-ckey.mjs <yeu-cau.json> <ra>'); process.exit(2); }
  const Y = JSON.parse(readFileSync(tep, 'utf8'));
  let ma; try { ma = maGiong(Y.giong); } catch (e) { console.error(`✗ ${e.message}`); process.exit(5); }
  mkdirSync(ra, { recursive: true }); let vnd = 0; const tuyen = { ckey: 0, fal: 0 };
  for (const c of Y.cau) {
    if (c.chu.length > 1000) { console.error(`✗ câu ${c.khoa} dài ${c.chu.length} ký tự (> 1.000 của gói 156₫)`); process.exit(4); }
    let b = null;
    if (process.env.CKEY_API_KEY) { try { b = await ckey(c, Y, ma); vnd += GIA_CKEY; tuyen.ckey++; } catch (e) { console.error(`! câu ${c.khoa}: ${e.message} → fal`); } }
    if (!b) { try { b = await fal(c, Y); vnd += Math.round(c.chu.length / 1000 * VND_FAL_1K); tuyen.fal++; } catch (e) { console.error(`✗ câu ${c.khoa}: hết tuyến — ${e.message}`); process.exit(1); } }
    writeFileSync(join(ra, `${c.khoa}.mp3`), b);
  }
  console.log(`giọng ${Y.giong ?? 'Charlotte'} · ${Y.cau.length} câu · ckey ${tuyen.ckey} · fal ${tuyen.fal} · tiền ${vnd}₫`);
}
