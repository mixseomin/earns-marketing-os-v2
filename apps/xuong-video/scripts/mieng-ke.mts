// CANH MIỆNG — PHẦN BOX (anh 15/11/2026 "chuẩn hoá cho mọi clip"): đo miệng bằng hình chạy trên iMac (scripts/cham-do/do_mieng.py, Grounding DINO), box chỉ đọc / ghi DB.
//   --ke --canh=<id,…>                 in JSON các shot có thoại + clip: mốc từng câu TRONG CLIP (= điểm vào + trễ câu), độ dài clip, giây phát
//   --ghi=<id>:<lệch s>|x --canh=<id>  ghi kết quả đo: dời điểm vào += lệch (kẹp trong clip); không bù được (> 0,25 s) hoặc "x" (không thấy miệng mở) → đánh dấu
//                                      nguon_video.mieng = {dat:false} — kế hoạch cụm (cum-seedance.mts) đưa shot vào lượt sinh lại
// Chạy từ scripts/bo-set/canh-mieng-tap.sh (iMac). 0đ.
import { execFileSync } from 'node:child_process';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { mapCanh, type Row } from '../src/lib/xuong-video/doc-db';
import { giayPhat } from '../src/lib/xuong-video/kieu';
import { DUOI_CLIP_BO } from '../src/lib/xuong-video/toc-do';

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? '';
const ids = arg('canh').split(',').map(Number).filter(Boolean); const db = getDb()!;
const ds = ((await db.execute(sql`SELECT * FROM xv_canh WHERE id = ANY(${`{${ids.join(',')}}`}::int[]) ORDER BY thu_tu`)) as unknown as Row[]).map(mapCanh);
const dai = (u: string) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', u], { encoding: 'utf8' }).trim());
if (process.argv.includes('--ke')) {
  const ke = ds.filter((c) => c.video_url && (c.thoai ?? []).some((d) => d.url && d.loi?.trim())).map((c) => {
    const vao = Number(c.ky_thuat?.vao_s ?? 0);
    return { id: c.id, so: c.thu_tu, video: c.video_url, vao, phat: giayPhat(c), dai: dai(c.video_url!), cau: (c.thoai ?? []).filter((d) => d.url && d.loi?.trim()).map((d) => ({ url: d.url, t: +(vao + (d.tre ?? 0)).toFixed(2) })) };
  });
  console.log(JSON.stringify(ke)); process.exit(0);
}
const ghi = arg('ghi');
if (ghi) {
  const [idS, lS] = ghi.split(':'); const c = ds.find((x) => x.id === Number(idS)); if (!c?.video_url) { console.error('không thấy shot / clip'); process.exit(1); }
  const vao = Number(c.ky_thuat?.vao_s ?? 0); const d = dai(c.video_url); const phat = giayPhat(c);
  const khongMo = lS === 'x'; const l = khongMo ? 0 : Number(lS); const muon = vao + l; const kep = Math.max(0, Math.min(muon, d - phat - DUOI_CLIP_BO));
  const dat = !khongMo && Math.abs(kep - muon) <= 0.25;
  const ly = khongMo ? 'không thấy miệng mở trong lúc câu thoại' : dat ? `miệng trễ ${l.toFixed(2)} s — dời điểm vào ${vao} → ${kep.toFixed(2)}` : `miệng trễ ${l.toFixed(2)} s, clip ${d.toFixed(2)} s không đủ để bù (thiếu ${Math.abs(kep - muon).toFixed(2)} s)`;
  await db.execute(sql`UPDATE xv_canh SET nguon_video = coalesce(nguon_video, '{}'::jsonb) || ${JSON.stringify({ mieng: { dat, lech: l, ly, luc: new Date().toISOString() } })}::jsonb,
    loi = ${dat ? '' : `khớp miệng: ${ly} — sinh lại`} WHERE id = ${c.id}`);
  if (dat) await db.execute(sql`UPDATE xv_canh SET ky_thuat = jsonb_set(coalesce(ky_thuat, '{}'::jsonb), '{vao_s}', ${JSON.stringify(+kep.toFixed(2))}::jsonb) WHERE id = ${c.id}`);
  console.log(`#${c.thu_tu}: ${dat ? '✓' : '✗'} ${ly}`); process.exit(0);
}
console.error('cần --ke hoặc --ghi'); process.exit(1);
