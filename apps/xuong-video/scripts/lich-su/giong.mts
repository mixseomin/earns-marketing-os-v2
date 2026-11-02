// GIỌNG ĐỌC CÓ MỐC TỪNG CHỮ cho tập kênh lịch sử (02/11/2026, kế hoạch S08 bước 2). Chạy trên box3 (khoá FAL_KEY ở .env.production):
//   NODE_OPTIONS=--conditions=react-server tsx scripts/lich-su/giong.mts <tệp-tập.json> <thư-mục-ra>
// fal ElevenLabs v3 với timestamps:true → <ra>/giong.mp3 + <ra>/moc.json ({chu, start, end}[] từng chữ). Đọc CẢ tập một lượt (giọng liền mạch,
// nhịp tự nhiên); máy dựng chia cảnh theo chữ đầu mỗi câu. Giá GIONG theo am-thanh.ts (eleven-v3 $0,10/1.000 ký tự) — in tiền thật ra cuối.
import { readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const [tep, ra] = process.argv.slice(2);
if (!tep || !ra) { console.error('tsx giong.mts <tập.json> <thư-mục-ra>'); process.exit(2); }
const tap = JSON.parse(readFileSync(tep, 'utf8')) as { ngon_ngu: string; giong?: { voice?: string }; cau: { chu: string }[] };
const text = tap.cau.map((c) => c.chu.trim()).join(' ');
// BÀI DÀI (kênh trọn chuyện 3 phút): ElevenLabs giới hạn chữ mỗi lượt → chia KHÚC theo ranh giới câu (≤ 2.400 ký tự), đọc lần lượt, nối tiếng bằng
// ffmpeg và dời mốc từng ký tự theo độ dài thật của khúc trước; giữa hai khúc chèn một dấu cách để máy dựng không dính chữ cuối khúc với chữ đầu khúc sau.
const khuc: string[] = []; for (const c of tap.cau.map((c) => c.chu.trim())) { if (khuc.length && khuc.at(-1)!.length + c.length + 1 <= 2400) khuc[khuc.length - 1] += ` ${c}`; else khuc.push(c); }
mkdirSync(ra, { recursive: true });
const moc: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] }[] = []; let lech = 0;
for (const [i, t] of khuc.entries()) {
  const r = await fetch('https://fal.run/fal-ai/elevenlabs/tts/eleven-v3', {
    method: 'POST', headers: { Authorization: `Key ${process.env.FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: t, voice: tap.giong?.voice || 'George', timestamps: true, language_code: tap.ngon_ngu, apply_text_normalization: 'auto' }),
    signal: AbortSignal.timeout(300_000),
  });
  if (!r.ok) { console.error(`fal ${r.status} (khúc ${i + 1}/${khuc.length}): ${(await r.text()).slice(0, 300)}`); process.exit(1); }
  const j = await r.json() as { audio: { url: string }; timestamps?: typeof moc };
  const f = join(ra, `khuc-${i}.mp3`); writeFileSync(f, Buffer.from(await (await fetch(j.audio.url)).arrayBuffer()));
  if (i) moc.push({ characters: [' '], character_start_times_seconds: [lech], character_end_times_seconds: [lech] });
  for (const o of [j.timestamps ?? []].flat()) moc.push({ characters: o.characters, character_start_times_seconds: o.character_start_times_seconds.map((v) => v + lech), character_end_times_seconds: o.character_end_times_seconds.map((v) => v + lech) });
  lech += Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }));
}
if (khuc.length === 1) renameSync(join(ra, 'khuc-0.mp3'), join(ra, 'giong.mp3'));
else { writeFileSync(join(ra, 'khuc.txt'), khuc.map((_, i) => `file 'khuc-${i}.mp3'`).join('\n'));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(ra, 'khuc.txt'), '-c:a', 'libmp3lame', '-b:a', '192k', join(ra, 'giong.mp3')]);
  for (const [i] of khuc.entries()) unlinkSync(join(ra, `khuc-${i}.mp3`)); unlinkSync(join(ra, 'khuc.txt')); }
writeFileSync(join(ra, 'moc-tho.json'), JSON.stringify(moc));
console.log(`ký tự ${text.length} · ${khuc.length} khúc · ${Math.round(lech)}s · tiền ~$${((text.length / 1000) * 0.10).toFixed(3)} (~${Math.round((text.length / 1000) * 0.10 * 26000)}₫)`);
