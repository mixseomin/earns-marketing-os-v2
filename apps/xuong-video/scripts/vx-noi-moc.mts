// NỐI ẢNH MỐC bằng VideoExpress khung đầu → cuối (0₫, gói đã mua): ảnh mốc đã vẽ lại (ve-lai-moc.mts) → mỗi cặp liền nhau một đoạn first_last_frame,
// mỗi đoạn MỘT động tác giữa hai khung đã ghim (vị trí / vật lý đúng sẵn từ bản giấy cắt) → tải về → ghép, tua mỗi đoạn về đúng số giây nhịp của kịch bản.
// Chạy trên iMac (br, profile riêng VideoExpress): node scripts/videoexpress.mjs mo, rồi
//   VX_CHAY=1 ../../node_modules/.bin/tsx scripts/vx-noi-moc.mts --moc=a.png,b.png,c.png --giay=1.6,1,2.8 --ra=<thư mục> --nhip='đoạn 1|đoạn 2|đoạn 3' [--kho=16:9]
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { catId, getMedia, guiShot, napKhung, ngu, trenApp } from './vx-br.mts';

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? '';
const moc = arg('moc').split(',').filter(Boolean), giay = arg('giay').split(',').map(Number), nhip = arg('nhip').split('|').map((x) => x.trim()), ra = arg('ra');
const kho = (arg('kho') || '16:9') as '16:9' | '9:16' | '1:1';
if (moc.length < 2 || nhip.length !== moc.length - 1 || giay.length !== moc.length - 1 || !ra) { console.error('cần --moc (n ảnh) --nhip (n-1 đoạn, ngăn bằng |) --giay (n-1 số) --ra'); process.exit(1); }
if (process.env.VX_CHAY !== '1') { console.log('chạy thử (không gửi): thêm VX_CHAY=1'); nhip.forEach((p, i) => console.log(`đoạn ${i + 1} (${giay[i]}s): ${p}`)); process.exit(0); }
if (!trenApp()) { console.error('chưa ở app VideoExpress — chạy node scripts/videoexpress.mjs mo'); process.exit(1); }
mkdirSync(ra, { recursive: true });
const macDinh = catId('default'), vids = catId('my_ai_videos');
const ids: number[] = [];
for (const f of moc) { const id = await napKhung(f, macDinh); if (!id) { console.error(`nạp hỏng: ${f}`); process.exit(1); } ids.push(id); console.log(`nạp ${f} → ${id}`); }
const uuid: string[] = [];
for (let i = 0; i < nhip.length; i++) {
  const u = guiShot(ids[i]!, `${nhip[i]} Static locked-off camera, the background never changes, no text.`, false, ids[i + 1]!, 0, kho);
  if (!u) { console.error(`gửi đoạn ${i + 1} hỏng`); process.exit(1); }
  uuid.push(u); console.log(`đoạn ${i + 1} → ${u}`);
}
writeFileSync(join(ra, 'vx.json'), JSON.stringify({ ids, uuid, giay, nhip }, null, 1));
const tep: string[] = [];
for (let lan = 0; lan < 60 && tep.length < uuid.length; lan++) {
  await ngu(20_000);
  const ds = getMedia(vids, 30).results;
  for (const [i, u] of uuid.entries()) {
    const it = ds.find((x) => x.uuid === u); const p = join(ra, `doan-${i + 1}.mp4`);
    if (it && !it.isPending && it.mediaPath && !tep.includes(p)) { execFileSync('curl', ['-sfL', '-o', p, it.mediaPath]); tep.push(p); console.log(`xong đoạn ${i + 1}: ${it.mediaPath}`); }
  }
}
if (tep.length < uuid.length) { console.error('quá 20 phút chưa xong — chạy lại phần lấy sau'); process.exit(1); }
// ghép: mỗi đoạn tua về đúng số giây nhịp (setpts), cùng cỡ khung
const vao = uuid.map((_, i) => join(ra, `doan-${i + 1}.mp4`));
const dai = vao.map((f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim()));
const loc = vao.map((_, i) => `[${i}:v]setpts=${(giay[i]! / dai[i]!).toFixed(4)}*PTS,scale=1280:720,setsar=1,fps=24[v${i}]`).join(';') + ';' + vao.map((_, i) => `[v${i}]`).join('') + `concat=n=${vao.length}:v=1:a=0[v]`;
execFileSync('ffmpeg', ['-v', 'error', '-y', ...vao.flatMap((f) => ['-i', f]), '-filter_complex', loc, '-map', '[v]', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', join(ra, 'ghep.mp4')]);
console.log(`ghép: ${join(ra, 'ghep.mp4')} (đoạn gốc ${dai.map((d) => d.toFixed(1)).join(' + ')}s → ${giay.join(' + ')}s)`);
