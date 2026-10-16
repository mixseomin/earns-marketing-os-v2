// SOÁT MURCH QC (qc-cam-xuc.ts) — Claude soát TRONG PHIÊN, 0đ (không gọi model trả tiền). Hai bước:
//   --in [--shot=1,2] : in kế hoạch biểu cảm từng shot + dựng tờ khung (keyframe | 6 khung clip đều nhau) lên R2 để xem.
//   --ghi=<tệp.json>  : { "<thu_tu>": { "keyframe"?: { dat, loi[] }, "clip"?: { dat, loi[], do?: { dau, cuoi } } } } → ghi xv_canh.soat cho đúng
//                       keyframe / clip ĐANG DÙNG (sinh lại là soát cũ hết hiệu lực). Bảng soát: qc-cam-xuc.ts › MUC_SOAT.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/soat-cam-xuc.mts <tap_id> --in
import { readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { uploadToR2 } from '../src/lib/r2';
import { mapCanh, mapNhanVat, type Row } from '../src/lib/xuong-video/doc-db';
import { BIEU_CAM, MUC_SOAT, camThuc, soatKeyframe, soatClip, loiMachBieuCam } from '../src/lib/xuong-video/qc-cam-xuc';

const tapId = Number(process.argv[2]);
const gia = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').slice(k.length + 3);
if (!tapId) { console.error('thiếu tap_id'); process.exit(1); }
const db = getDb()!;
const canh = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} AND nhanh IN ('', 'A') ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh);
const nv = ((await db.execute(sql`SELECT v.* FROM xv_nhan_vat v JOIN xv_tap t ON t.phim_id = v.phim_id WHERE t.id = ${tapId} ORDER BY v.id`)) as unknown as Row[]).map(mapNhanVat);
const chon = gia('shot') ? new Set(gia('shot').split(',').map(Number)) : null;
const ten = (k: string) => BIEU_CAM.find((x) => x.key === k)?.ten ?? k;
const ff = (args: string[]) => new Promise<Buffer | null>((ok) => execFile('ffmpeg', args, { encoding: 'buffer', maxBuffer: 1 << 27, timeout: 120_000 }, (e, b) => ok(e ? null : (b as Buffer))));
const dai = (url: string) => new Promise<number>((ok) => execFile('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', url], (e, o) => ok(e ? 0 : Number(String(o).trim()) || 0)));

if (process.argv.includes('--in')) {
  console.log(`BẢNG SOÁT: ${MUC_SOAT.map((m) => `${m.key} = ${m.ten}`).join(' · ')}`);
  const mach = loiMachBieuCam(canh, nv);
  for (const c of canh) {
    if (chon && !chon.has(c.thu_tu)) continue;
    const kh = (c.bieu_cam ?? []).map((b) => `${b.nv}: ${ten(b.dau)} → ${ten(b.cuoi)}${b.lat ? ' (lật)' : ''}${camThuc(b).length ? ` · cấm ${camThuc(b).map(ten).join(', ')}` : ''}`).join(' | ') || '— chưa có kế hoạch biểu cảm';
    const clip = c.video_cuoi_url || c.video_url;
    let to = '';
    if (clip) {
      const d = await dai(clip); const phat = c.phat_s ?? d;
      const b = await ff(['-v', 'error', '-t', String(Math.min(phat, d || phat)), '-i', clip, '-vf', `fps=6/${Math.max(0.5, Math.min(phat, d || phat))},scale=240:-1,tile=6x1`, '-frames:v', '1', '-q:v', '3', '-f', 'image2', '-vcodec', 'mjpeg', 'pipe:1']);
      if (b?.length) to = (await uploadToR2(`xuong-video/soat/${c.id}-clip-${Date.now()}.jpg`, b, 'image/jpeg')) ?? '';
    }
    console.log(`\n#${c.thu_tu} [${c.phan_doan}] ${c.noi_lien ? '⛓ nối liền · ' : ''}${c.hanh_dong.slice(0, 140)}`);
    console.log(`  kế hoạch: ${kh}${mach[c.id] ? `\n  ✗ ${mach[c.id]!.join('\n  ✗ ')}` : ''}`);
    console.log(`  keyframe: ${c.keyframe_url ?? '—'}  (soát: ${soatKeyframe(c) ? (soatKeyframe(c)!.dat ? 'đạt' : 'trượt') : 'chưa'})`);
    console.log(`  clip: ${clip ?? '—'}  (phát ${c.phat_s ?? '?'}s · soát: ${soatClip(c) ? (soatClip(c)!.dat ? 'đạt' : 'trượt') : 'chưa'})${to ? `\n  tờ 6 khung clip: ${to}` : ''}`);
  }
  process.exit(0);
}
const tep = gia('ghi');
if (!tep) { console.error('cần --in hoặc --ghi=<tệp.json>'); process.exit(1); }
const kq = JSON.parse(readFileSync(tep, 'utf8')) as Record<string, { keyframe?: { dat: boolean; loi?: string[] }; clip?: { dat: boolean; loi?: string[]; do?: { dau?: string; cuoi?: string } } }>;
const nguoi = gia('nguoi') || 'Claude trong phiên (0đ)'; const luc = new Date().toISOString();
for (const [so, r] of Object.entries(kq)) {
  const c = canh.find((x) => x.thu_tu === Number(so));
  if (!c) { console.log(`#${so}: không có shot`); continue; }
  const s = { ...(c.soat ?? {}) } as Record<string, unknown>;
  if (r.keyframe && c.keyframe_url) s.keyframe = { url: c.keyframe_url, luc, nguoi, dat: r.keyframe.dat, loi: r.keyframe.loi ?? [] };
  const clip = c.video_cuoi_url || c.video_url;
  if (r.clip && clip) s.clip = { url: clip, luc, nguoi, dat: r.clip.dat, loi: r.clip.loi ?? [], ...(r.clip.do ? { do: r.clip.do } : {}) };
  await db.execute(sql`UPDATE xv_canh SET soat = ${JSON.stringify(s)}::jsonb, updated_at = now() WHERE id = ${c.id}`);
  console.log(`#${so}: ${r.keyframe ? `keyframe ${r.keyframe.dat ? '✓' : '✗'} ` : ''}${r.clip ? `clip ${r.clip.dat ? '✓' : '✗'}` : ''}`);
}
process.exit(0);
