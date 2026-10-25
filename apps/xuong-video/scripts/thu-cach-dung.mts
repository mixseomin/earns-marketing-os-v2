// BÀI THỬ CÁCH DỰNG (anh 25/10/2026: "sao làm liền mạch khó thế… test làm sao cho đúng và rẻ"). Gốc gãy nối: mỗi shot một lần sinh ĐỘC LẬP → mỗi đường cắt
// model vẽ lại mặt / đồ / dáng / sảnh. So 3 cách trên MỘT đoạn ngắn (mặc định cú giật thẻ #5–#8), chạy nháp cổng rẻ, KHÔNG đụng clip của bản phim:
//   A. mỗi shot một clip (khung đầu → khung cuối, prompt video của shot) — cách hiện tại
//   B. MASTER TAKE: một clip một góc diễn trọn nhịp (khung đầu shot đầu) + một clip cận chèn đồ; cắt bên trong master
//   C. NHIỀU GÓC TRONG MỘT LẦN SINH: một clip, prompt có danh sách shot + "cut to" — nhân vật / đồ giữ qua cú cắt vì cùng một lần sinh
// Ra: 3 đoạn dựng + một video ba bản cạnh nhau (A | B | C) trên kho. Tốn: PlenX Veo Lite ~600₫ / clip (7 clip ≈ 4.200₫), cần DUYET_SINH_1_LAN=1.
//   … tsx scripts/thu-cach-dung.mts --tap=356 --tu=5 --den=8 [--mo-hinh=veo3-lite]
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { boiCanhCanh, mapCanh, type Row } from '../src/lib/xuong-video/doc-db';
import { promptVideoCanh } from '../src/lib/xuong-video/sinh-video';
import { guiPlenx, docPlenx } from '../src/lib/xuong-video/cong-plenxai';
import { giayPhat } from '../src/lib/xuong-video/kieu';
import { uploadToR2 } from '../src/lib/r2';

const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const tap = Number(gia('tap')), tu = Number(gia('tu')), den = Number(gia('den')); const moHinh = gia('mo-hinh') || 'veo3-lite';
if (!tap || !tu || !den) { console.error('cần --tap --tu --den'); process.exit(1); }
if (!process.env.DUYET_SINH_1_LAN) { console.error('tốn tiền — cần DUYET_SINH_1_LAN=1'); process.exit(2); }
const db = getDb()!; const thu = `/tmp/thu-cach-${tap}-${tu}-${den}`; mkdirSync(thu, { recursive: true });
const ds = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tap} AND thu_tu BETWEEN ${tu} AND ${den} ORDER BY thu_tu`)) as unknown as Row[]).map(mapCanh);
/** sinh một clip PlenX tuần tự (gói có thể chặn chạy song song → 429 thì đợi) → tải về /tmp, trả đường dẫn */
async function clip(nhan: string, prompt: string, anhDau: string, anhCuoi?: string | null): Promise<string | null> {
  for (let lan = 1; lan <= 6; lan++) {
    const g = await guiPlenx(moHinh, { prompt, anhDau, anhCuoi: anhCuoi ?? null, giay: 8 });
    if (!g.ok) { console.log(`  ${nhan}: gửi lỗi (${g.loi.slice(0, 120)}) — thử lại`); await new Promise((r) => setTimeout(r, 30_000)); continue; }
    const tao = new Date().toISOString();
    for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 10_000)); const d = await docPlenx(g.taskId, tao, 12);
      if (d.done && d.ok) { const f = `${thu}/${nhan}.mp4`; writeFileSync(f, Buffer.from(await (await fetch(d.uri)).arrayBuffer())); console.log(`  ${nhan}: xong`); return f; }
      if (d.done && !d.ok) { console.log(`  ${nhan}: hỏng (${d.loi.slice(0, 100)}) — thử lại`); break; } }
  }
  console.log(`  ${nhan}: bỏ sau 6 lần`); return null;
}
const ff = (args: string[]) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args], { timeout: 300_000 });
const doan = (vao: string, tuS: number, dai: number, ra: string) => ff(['-ss', String(tuS), '-i', vao, '-t', String(dai), '-vf', 'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30,setsar=1', '-an', '-c:v', 'libx264', '-preset', 'veryfast', ra]);
const noi = (tep: string[], ra: string) => { writeFileSync(`${thu}/ds.txt`, tep.map((t) => `file '${t}'`).join('\n')); ff(['-f', 'concat', '-safe', '0', '-i', `${thu}/ds.txt`, '-c', 'copy', ra]); };
const tongGiay = ds.reduce((s, c) => s + giayPhat(c), 0);
const bc = await Promise.all(ds.map((c) => boiCanhCanh(db, c.id)));
const moTa = ds.map((c) => `${c.dan_dung?.mo ?? ''} → ${c.dan_dung?.ket ?? ''}`.trim()).join('; then ');

// ── A: mỗi shot một clip ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
console.log('A. mỗi shot một clip');
const aTep: string[] = [];
for (const [i, c] of ds.entries()) { const f = await clip(`A-${c.thu_tu}`, promptVideoCanh(bc[i]!), c.keyframe_url!, c.keyframe_ket); if (!f) continue; const r = `${thu}/A-${c.thu_tu}-cat.mp4`; doan(f, 0.5, giayPhat(c), r); aTep.push(r); }
if (aTep.length) noi(aTep, `${thu}/A.mp4`);
// ── B: master take + cận chèn ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
console.log('B. master take + cận chèn');
const dau = ds[0]!; const chen = ds.find((c) => c.ky_thuat?.co_canh === 'insert');
const pMaster = `One continuous take from a single static camera, no cuts: ${moTa}. Same two women, same lobby, same lighting throughout; the action flows without pause. Only the people already in the first frame appear. No on-screen text.`;
const fM = await clip('B-master', pMaster, dau.keyframe_url!);
const fC = chen ? await clip('B-chen', `Insert close-up, single static shot, no cuts: ${chen.dan_dung?.mo ?? ''} → ${chen.dan_dung?.ket ?? ''}. Same hands, same lanyard and badge as the first frame. No on-screen text.`, chen.keyframe_url!, chen.keyframe_ket) : null;
if (fM) { const bTep = [`${thu}/B-1.mp4`]; const t1 = Math.min(3, tongGiay * 0.55); doan(fM, 0.4, t1, bTep[0]!);
  if (fC) { bTep.push(`${thu}/B-2.mp4`); doan(fC, 0.5, 1, bTep[1]!); }
  bTep.push(`${thu}/B-3.mp4`); doan(fM, 0.4 + t1 + (fC ? 1 : 0), Math.max(1, tongGiay - t1 - (fC ? 1 : 0)), bTep.at(-1)!); noi(bTep, `${thu}/B.mp4`); }
// ── C: nhiều góc trong một lần sinh ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
console.log('C. nhiều góc trong một clip');
let t0 = 0; const dsShot = ds.map((c, i) => { const d = (8 * giayPhat(c)) / tongGiay; const s = `Shot ${i + 1} (${t0.toFixed(1)}–${(t0 + d).toFixed(1)} s, ${c.ky_thuat?.co_canh ?? 'medium'}${i ? ', hard cut' : ''}): ${c.dan_dung?.mo ?? ''} → ${c.dan_dung?.ket ?? ''}`; t0 += d; return s; });
const pC = `A short edited film sequence of ${ds.length} shots with hard cuts between them, the same two women, same outfits, same props and same lobby in every shot: ${dsShot.join('. ')}. Keep every object state continuous across the cuts. No on-screen text.`;
const fCC = await clip('C-nhieu-goc', pC, dau.keyframe_url!); if (fCC) doan(fCC, 0.2, Math.min(7.4, tongGiay + 1), `${thu}/C.mp4`);
// ── ghép A | B | C cạnh nhau ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const co = ['A', 'B', 'C'].map((x) => `${thu}/${x}.mp4`).filter((f) => { try { readFileSync(f); return true; } catch { return false; } });
const ra = `${thu}/so-sanh.mp4`;
if (co.length) { ff([...co.flatMap((f) => ['-i', f]), '-filter_complex', `${co.map((_, i) => `[${i}:v]scale=360:640,tpad=stop_mode=clone:stop_duration=8[v${i}]`).join(';')};${co.map((_, i) => `[v${i}]`).join('')}hstack=${co.length},trim=0:${Math.ceil(tongGiay + 1)}[o]`, '-map', '[o]', '-c:v', 'libx264', '-preset', 'veryfast', ra]);
  const url = await uploadToR2(`xuong-video/thu/${tap}-${tu}-${den}-${randomUUID()}.mp4`, readFileSync(ra), 'video/mp4'); console.log(`\nSO SÁNH (${co.map((f) => f.split('/').pop()!.replace('.mp4', '')).join(' | ')}): ${url}`);
  for (const f of co) { const u = await uploadToR2(`xuong-video/thu/${tap}-${f.split('/').pop()!.replace('.mp4', '')}-${randomUUID()}.mp4`, readFileSync(f), 'video/mp4'); console.log(`  ${f.split('/').pop()}: ${u}`); } }
process.exit(0);
