// GIỌNG ĐỌC CÓ MỐC TỪNG CHỮ cho tập kênh lịch sử (02/11/2026, kế hoạch S08 bước 2). Chạy trên box3 (khoá FAL_KEY ở .env.production):
//   NODE_OPTIONS=--conditions=react-server tsx scripts/lich-su/giong.mts <tệp-tập.json> <thư-mục-ra>
// fal ElevenLabs v3 với timestamps:true → <ra>/giong.mp3 + <ra>/moc.json ({chu, start, end}[] từng chữ). Đọc CẢ tập một lượt (giọng liền mạch,
// nhịp tự nhiên); máy dựng chia cảnh theo chữ đầu mỗi câu. Giá GIONG theo am-thanh.ts (eleven-v3 $0,10/1.000 ký tự) — in tiền thật ra cuối.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [tep, ra] = process.argv.slice(2);
if (!tep || !ra) { console.error('tsx giong.mts <tập.json> <thư-mục-ra>'); process.exit(2); }
const tap = JSON.parse(readFileSync(tep, 'utf8')) as { ngon_ngu: string; giong?: { voice?: string }; cau: { chu: string }[] };
const text = tap.cau.map((c) => c.chu.trim()).join(' ');
const r = await fetch('https://fal.run/fal-ai/elevenlabs/tts/eleven-v3', {
  method: 'POST', headers: { Authorization: `Key ${process.env.FAL_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ text, voice: tap.giong?.voice || 'George', timestamps: true, language_code: tap.ngon_ngu, apply_text_normalization: 'auto' }),
  signal: AbortSignal.timeout(300_000),
});
if (!r.ok) { console.error(`fal ${r.status}: ${(await r.text()).slice(0, 300)}`); process.exit(1); }
const j = await r.json() as { audio: { url: string }; timestamps?: unknown };
mkdirSync(ra, { recursive: true });
writeFileSync(join(ra, 'giong.mp3'), Buffer.from(await (await fetch(j.audio.url)).arrayBuffer()));
writeFileSync(join(ra, 'moc-tho.json'), JSON.stringify(j.timestamps ?? null));
console.log(`ký tự ${text.length} · tiền ~$${((text.length / 1000) * 0.10).toFixed(3)} (~${Math.round((text.length / 1000) * 0.10 * 26000)}₫)`);
