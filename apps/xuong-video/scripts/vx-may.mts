// CLIP VIDEOEXPRESS CHO MÁY ĐĂNG (anh 31/10/2026: "sao ko dùng videoexpress sinh video? Các nội dung hiện tại nhìn nhàm chán"): video mẫu lồng tiếng
// (giai-thich) có MỖI CÂU MỘT CẢNH (de.canh[i] = { truy, prompt, anh }) — box3 xuatVideo lấy ảnh thật Pexels làm khung đầu rồi đánh dấu de.cho_vx.
// Script này chạy trên iMac (VideoExpress chỉ đi qua phiên trình duyệt — profile riêng htuan82-vx, scripts/videoexpress.mjs), $0 (tài khoản đã mua trọn):
//   --gui [--so N]   cảnh chưa gửi → tải ảnh khung đầu → nạp VideoExpress (napKhung) → image2video với prompt chuyển động (guiShot) → ghi uuid vào de.canh[i]
//   --lay            cảnh đã gửi → tìm uuid trong My AI Videos → render xong thì tải mp4 → scp box3 → may-dung.mts --gan-vx (R2) → đủ clip thì --xuat lại video
// Gửi async rồi đi (render ~4 phút); chạy --lay sau. Dừng ngay khi VideoExpress báo hết lượt. VideoExpress chỉ giữ tệp 40 ngày → lấy về R2 là xong.
//   cd ~/Me/GitHub/earns-marketing-os-v2/apps/xuong-video && node scripts/videoexpress.mjs mo && ../../node_modules/.bin/tsx scripts/vx-may.mts --gui
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { napKhung, guiShot, getMedia, catId, trenApp } from './vx-br.mts';

process.env.BR_PROFILE ||= '/Users/htuan/Me/Earns/courseforge-demo/.capture-profile-htuan82-vx';   // cùng profile riêng với videoexpress.mjs
const BOX = 'root@167.233.241.16', THU = join(tmpdir(), 'vx-may');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
type Canh = { truy: string; prompt: string; anh?: string; uuid?: string; vx?: string };
type Dong = { id: number; slug: string; ma: string; canh: Canh[]; phong_cach: string | null };

const psql = (cau: string): string => execFileSync('ssh', [BOX, 'cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; psql "$DATABASE_URL" -tA'], { input: cau, encoding: 'utf8', timeout: 60e3 }).trim();
const boxTsx = (args: string, han = 900): string => execFileSync('ssh', [BOX, `cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/may-dung.mts ${args}`], { encoding: 'utf8', timeout: han * 1000 }).trim();
/** Video đang chờ clip (de.cho_vx) — mới nhất trước. */
function hangCho(so: number): Dong[] {
  const ra = psql(`SELECT coalesce(json_agg(x), '[]') FROM (SELECT v.id, v.slug, m.ma, v.de->'canh' AS canh, m.phong_cach FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id
    WHERE v.de->>'cho_vx' = 'true' AND NOT coalesce(v.luu_tru, false) ORDER BY v.id DESC LIMIT ${Math.max(1, Math.min(20, so))}) x;`);
  return JSON.parse(ra || '[]') as Dong[];
}
const ghiCanh = (id: number, i: number, khoa: 'uuid', gt: string) => psql(`UPDATE xv_may_video SET de = jsonb_set(de, '{canh,${i},${khoa}}', to_jsonb('${gt.replace(/'/g, "''")}'::text)), updated_at = now() WHERE id = ${id};`);
/** Prompt gửi VideoExpress: chuyển động của cảnh + luật chung (ảnh thật giữ nguyên, không chữ). */
export const cauPrompt = (c: Canh, phongCach?: string | null) => `Photorealistic vertical 9:16 clip animated from the exact first frame — keep the scene, people and objects as in the photo. ${c.prompt.trim().replace(/\.?$/, '.')}${phongCach ? ` Look and mood: ${phongCach.split(/Tone:/)[0]!.trim()}` : ''} Cinematic, natural motion. No text, no captions, no logos, no watermarks.`;

const a = process.argv.slice(2), so = Number(a[a.indexOf('--so') + 1]) || 6;
if (a.includes('--tu-kiem')) {
  const t = (await import('node:assert')).strict;
  const p = cauPrompt({ truy: 'x', prompt: 'slow push-in on hands turning pages' });
  t.ok(p.includes('slow push-in on hands turning pages.') && /No text/.test(p) && /first frame/.test(p));
  const pc = cauPrompt({ truy: 'x', prompt: 'pan' }, 'Celestial: full moon, stars. Tone: intimate.'); t.ok(pc.includes('full moon') && !pc.includes('intimate'), 'phong cách hình vào prompt, phần giọng văn thì không');
  t.ok(!cauPrompt({ truy: 'x', prompt: 'pan left.' }).includes('..'), 'không nhân đôi dấu chấm');
  console.log('vx-may: 3/3 ok'); process.exit(0);
}
if (!a.includes('--gui') && !a.includes('--lay')) { console.error('dùng: vx-may.mts --gui [--so N] | --lay | --tu-kiem'); process.exit(2); }
if (!trenApp()) { console.error('phiên VideoExpress chưa mở — chạy: node scripts/videoexpress.mjs mo'); process.exit(2); }
mkdirSync(THU, { recursive: true });
const hang = hangCho(so);
if (!hang.length) { console.log('· không có video nào chờ clip VideoExpress'); process.exit(0); }

if (a.includes('--gui')) {
  const catDefault = catId('default'); let gui = 0;
  for (const d of hang) for (const [i, c] of d.canh.entries()) {
    if (c.uuid || c.vx) continue;
    if (!c.anh) { console.log(`  ! #${d.id} cảnh ${i}: chưa có ảnh khung đầu (box3 xuatVideo chưa lấy)`); continue; }
    const f = join(THU, `${d.id}-${i}.jpg`);
    if (!existsSync(f)) { const r = await fetch(c.anh, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60_000) }); if (!r.ok) { console.log(`  ! #${d.id} cảnh ${i}: tải ảnh ${r.status}`); continue; } writeFileSync(f, Buffer.from(await r.arrayBuffer())); }
    const mediaId = await napKhung(f, catDefault); if (!mediaId) { console.log(`  ! #${d.id} cảnh ${i}: nạp ảnh hỏng`); continue; }
    const uuid = guiShot(mediaId, cauPrompt(c, d.phong_cach), true);
    if (!uuid) { console.log('  ✗ VideoExpress từ chối (có thể hết lượt hôm nay) — dừng lô'); process.exit(1); }
    ghiCanh(d.id, i, 'uuid', uuid); gui++; console.log(`  ✓ #${d.id} ${d.slug} cảnh ${i} → ${uuid}`);
  }
  console.log(`vx-may --gui: đã gửi ${gui} cảnh (render ~4 phút, chạy --lay sau)`);
} else {
  const ds = getMedia(catId('my_ai_videos'), 100).results; let lay = 0, cho = 0;
  for (const d of hang) {
    let du = true;
    for (const [i, c] of d.canh.entries()) {
      if (c.vx) continue; du = false;
      if (!c.uuid) continue;
      const it = ds.find((x) => x.uuid === c.uuid);
      if (!it || it.isPending || !it.mediaPath) { cho++; continue; }
      const f = join(THU, `${d.id}-${i}.mp4`);
      execFileSync('curl', ['-sSL', '-A', UA, '-o', f, it.mediaPath], { timeout: 120e3 });
      const dich = `/var/tmp/vx-may/${d.id}-${i}.mp4`;
      execFileSync('ssh', [BOX, 'mkdir -p /var/tmp/vx-may']); execFileSync('scp', ['-q', f, `${BOX}:${dich}`], { timeout: 300e3 });
      console.log(`  ${boxTsx(`--may ${d.ma} --gan-vx ${d.id} ${i} ${dich}`, 300).split('\n').pop()}`); lay++;
    }
    // đủ clip mọi cảnh (kể cả vừa gắn) → dựng lại video trên box3
    const con = JSON.parse(psql(`SELECT coalesce(json_agg(c->>'vx'), '[]') FROM xv_may_video v, jsonb_array_elements(v.de->'canh') c WHERE v.id = ${d.id};`) || '[]') as (string | null)[];
    if (!du && con.length && con.every(Boolean)) console.log(`  ▶ #${d.id} đủ ${con.length} clip — dựng lại: ${boxTsx(`--may ${d.ma} --xuat ${d.slug}`, 1200).split('\n').slice(-2).join(' | ')}`);
  }
  console.log(`vx-may --lay: lấy ${lay} clip, ${cho} cảnh còn đang render`);
}
