// SINH KHO ÂM THANH mẫu dài (07/11/2026). Chạy trên box3: tsx scripts/lich-su/giay/am-sinh.mts <yeu-cau.json> <ra>   yeu-cau = [{ ten, mo_ta, giay, nhac }]. Tiếng đạo cụ / nền: ElevenLabs SFX 0,2¢/giây; nhạc: CassetteAI 2¢/phút; song song 4, thử lại 3 lần; in tiền thật dòng cuối.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chayFal } from '../../../src/lib/xuong-video/fal';

const [tep, ra] = process.argv.slice(2);
if (!tep || !ra) { console.error('tsx am-sinh.mts <yeu-cau.json> <ra>'); process.exit(2); }
mkdirSync(ra, { recursive: true });
const ds = JSON.parse(readFileSync(tep, 'utf8')) as { ten: string; mo_ta: string; giay: number; nhac?: boolean }[], VND_CENT = 260;
// fal qua CỔNG AI CHUNG (fal_chay — khoá fal ở cổng, 16/11/2026)
const goi = async (d: (typeof ds)[number]) => { const [model, input] = d.nhac ? ['cassetteai/music-generator', { prompt: d.mo_ta, duration: d.giay }] : ['fal-ai/elevenlabs/sound-effects/v2', { text: d.mo_ta, duration_seconds: d.giay, prompt_influence: 0.5 }];
  const c = await chayFal(model, input); if (!c.ok) throw new Error(c.loi); const j = c.kq as { audio_file?: { url?: string }; audio?: { url?: string } }, u = j.audio_file?.url ?? j.audio?.url; if (!u) throw new Error(`không thấy tệp: ${JSON.stringify(j).slice(0, 200)}`); const a = await fetch(u); if (!a.ok) throw new Error(`tải ${a.status}`); return Buffer.from(await a.arrayBuffer()); };
let i = 0, tien = 0, hong = 0;
await Promise.all(Array.from({ length: 4 }, async () => { while (i < ds.length) { const d = ds[i++]; let xong = false; for (let lan = 1; lan <= 3 && !xong; lan++) { try { writeFileSync(join(ra, `${d.ten}.mp3`), await goi(d)); tien += (d.nhac ? (d.giay / 60) * 2 : d.giay * 0.2) * VND_CENT; xong = true; console.log(`✓ ${d.ten}`); } catch (e) { console.log(`⚠ ${d.ten} lượt ${lan}: ${(e as Error).message}`); await new Promise((o) => setTimeout(o, 3000 * lan)); } } if (!xong) hong++; } }));
console.log(`${ds.length - hong}/${ds.length} âm ~${Math.round(tien)}₫`);
if (hong) process.exit(1);
