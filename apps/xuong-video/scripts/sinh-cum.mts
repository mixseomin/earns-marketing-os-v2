// SINH THEO CỤM (luat-dung.ts › cum_mot_lan_sinh, cum-shot.ts): shot liền nhau cùng phân cảnh → MỘT clip nhiều góc có cú cắt; mỗi shot trỏ vào clip
// cụm với điểm vào (ky_thuat.vao_s) đặt theo cú cắt ĐO trên clip (ffmpeg scene). Bản dựng (xuat.ts) cắt đúng đoạn của từng shot — không đổi máy dựng.
// Cụm một shot đã có clip thì giữ nguyên (không có cú cắt nào trong cụm để gãy). Trước khi ghi: chép cả tập sang bảng sao lưu xv_canh_sao_luu_<tap>_cum_<lúc>.
// Tốn: PlenX Veo Lite 800₫ / cụm (cong-ai.ts › GIA_VIDEO_VND), ≤ 3 cụm chạy cùng lúc (ô PlenX), cần DUYET_SINH_1_LAN=1. --thu: chỉ in kế hoạch + prompt, 0đ.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server DUYET_SINH_1_LAN=1 ../../node_modules/.bin/tsx scripts/sinh-cum.mts --tap=356 [--tu=1 --den=17] [--thu]
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { boiCanhCanh, mapCanh, type Row } from '../src/lib/xuong-video/doc-db';
import { guiPlenx, docPlenx } from '../src/lib/xuong-video/cong-plenxai';
import { giaVideoCong } from '../src/lib/xuong-video/cong-ai';
import { chiaCum, anhNeoCuoi, promptCum, vaoTuCatThat, BO_DUOI, VAO_DAU, DUNG_DUOC } from '../src/lib/xuong-video/cum-shot';
import { uploadToR2 } from '../src/lib/r2';

const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const tap = Number(gia('tap')); const tu = Number(gia('tu') || 0), den = Number(gia('den') || 9999); const thu = process.argv.includes('--thu');
const moHinh = 'veo3-lite'; const TRAN = 3;
if (!tap) { console.error('cần --tap'); process.exit(1); }
if (!thu && !process.env.DUYET_SINH_1_LAN) { console.error('tốn tiền — cần DUYET_SINH_1_LAN=1 (hoặc --thu để xem kế hoạch)'); process.exit(2); }
const db = getDb()!; const tmp = `/tmp/sinh-cum-${tap}`; mkdirSync(tmp, { recursive: true });
const ds = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tap} AND thu_tu BETWEEN ${tu} AND ${den} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh);
// người trong từng shot = nhân vật (loai nhan_vat) của shot — neo người: ai cũng phải có ở ảnh mở / ảnh neo cuối (cum-shot.ts › chiaCum)
const laNguoi = new Set(((await db.execute(sql`SELECT id FROM xv_nhan_vat WHERE loai = 'nhan_vat' AND id IN (SELECT DISTINCT jsonb_array_elements_text(nhan_vat)::int FROM xv_canh WHERE tap_id = ${tap})`)) as unknown as Row[]).map((r) => Number(r.id)));
const cacCum = chiaCum(ds, DUNG_DUOC, { nguoi: (c) => c.nhan_vat.filter((x) => laNguoi.has(Number(x))), coKet: (c) => !!c.keyframe_ket }).filter((c) => c.length > 1 || !c[0]!.video_url);
const giaCum = giaVideoCong('plenxai', moHinh);
console.log(`tập ${tap}: ${ds.length} shot → ${cacCum.length} cụm cần sinh · ~${(giaCum.vnd ?? 0) * cacCum.length}₫`);
const bcCum = await Promise.all(cacCum.map((c) => Promise.all(c.map((x) => boiCanhCanh(db, x.id)))));
const pr = cacCum.map((c, i) => promptCum(bcCum[i]!.map((b) => ({ canh: b!.canh, nhanVat: b!.nhanVat }))));
cacCum.forEach((c, i) => console.log(`\n#${c[0]!.thu_tu}–#${c.at(-1)!.thu_tu}: ${pr[i]}`));
if (thu) process.exit(0);

const ff = (args: string[]) => execFileSync('ffmpeg', ['-hide_banner', ...args], { timeout: 300_000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const dai = (f: string) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim());
/** Cú cắt cứng trong clip: thử ngưỡng scene từ chặt tới lỏng, lấy lần ra đúng n−1 cú (bỏ cú dính đầu / đuôi, gộp cú sát nhau). */
function catThat(f: string, n: number, d: number): number[] {
  let tot: number[] = [];
  for (const nguong of [0.3, 0.22, 0.4, 0.15, 0.5]) {
    // showinfo ghi ra stderr — gộp vào stdout để đọc
    let out = ''; try { out = execFileSync('sh', ['-c', `ffmpeg -hide_banner -i '${f}' -vf "select='gt(scene,${nguong})',showinfo" -f null - 2>&1`], { encoding: 'utf8', timeout: 120_000 }); } catch { /* clip hỏng → không có cú cắt, theo lịch prompt */ }
    const t = [...out.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1])).filter((x) => x > VAO_DAU + 0.3 && x < d - BO_DUOI - 0.2)
      .reduce<number[]>((a, x) => (a.length && x - a.at(-1)! < 0.4 ? a : [...a, x]), []);
    if (t.length === n - 1) return t;
    if (!tot.length || Math.abs(t.length - (n - 1)) < Math.abs(tot.length - (n - 1))) tot = t;
  }
  return tot;
}
async function sinh(i: number): Promise<string | null> {
  const c = cacCum[i]!; const nhan = `${c[0]!.thu_tu}-${c.at(-1)!.thu_tu}`;
  for (let lan = 1; lan <= 6; lan++) {
    const g = await guiPlenx(moHinh, { prompt: pr[i]!, anhDau: c[0]!.keyframe_url!, anhCuoi: anhNeoCuoi(c), giay: 8 });
    if (!g.ok) { console.log(`  cụm ${nhan}: gửi lỗi (${g.loi.slice(0, 120)}) — đợi 30s thử lại`); await new Promise((r) => setTimeout(r, 30_000)); continue; }
    const tao = new Date().toISOString();
    for (let k = 0; k < 90; k++) { await new Promise((r) => setTimeout(r, 10_000)); const d = await docPlenx(g.taskId, tao, 12);
      if (d.done && d.ok) { const f = `${tmp}/cum-${nhan}.mp4`; writeFileSync(f, Buffer.from(await (await fetch(d.uri)).arrayBuffer())); console.log(`  cụm ${nhan}: xong`); return f; }
      if (d.done && !d.ok) { console.log(`  cụm ${nhan}: hỏng (${d.loi.slice(0, 100)}) — thử lại`); break; } }
  }
  console.log(`  cụm ${nhan}: bỏ sau 6 lần`); return null;
}

const bang = `xv_canh_sao_luu_${tap}_cum_${new Date().toISOString().replace(/\D/g, '').slice(0, 12)}`;
await db.execute(sql.raw(`CREATE TABLE ${bang} AS SELECT * FROM xv_canh WHERE tap_id = ${tap}`));
console.log(`\nsao lưu: bảng ${bang}`);
const kq: (string | null)[] = new Array(cacCum.length).fill(null); let ke = 0;
await Promise.all(Array.from({ length: Math.min(TRAN, cacCum.length) }, async (_, w) => {
  await new Promise((r) => setTimeout(r, w * 4000));   // giãn lượt gửi PlenX (sinh-video.ts › XV_PLENX_GIAN_MS)
  while (ke < cacCum.length) { const i = ke++; kq[i] = await sinh(i); }
}));
for (const [i, c] of cacCum.entries()) {
  const f = kq[i]; const nhan = `#${c[0]!.thu_tu}–#${c.at(-1)!.thu_tu}`; if (!f) { console.log(`${nhan}: KHÔNG có clip — giữ clip cũ`); continue; }
  const d = dai(f); const cat = catThat(f, c.length, d); const v = vaoTuCatThat(c, cat, d);
  const url = await uploadToR2(`xuong-video/video/cum-${tap}-${c[0]!.thu_tu}-${c.at(-1)!.thu_tu}-${randomUUID()}.mp4`, readFileSync(f), 'video/mp4');
  for (const [j, s] of c.entries()) {
    const cum = { tu: c[0]!.thu_tu, den: c.at(-1)!.thu_tu, url, cat, theo_do: v.theoDo, luc: new Date().toISOString() };
    await db.execute(sql`UPDATE xv_canh SET video_url = ${url}, video_cuoi_url = NULL, cat_cuoi_s = NULL, chi_phi_cents = chi_phi_cents + ${j ? 0 : giaCum.cents ?? 0},
      ky_thuat = coalesce(ky_thuat, '{}'::jsonb) || jsonb_build_object('vao_s', ${v.vao[j]!}::float, 'cum', ${JSON.stringify(cum)}::jsonb), updated_at = now() WHERE id = ${s.id}`);
  }
  console.log(`${nhan}: ${url}\n  cắt đo ${cat.map((x) => x.toFixed(2)).join(' · ') || '—'} (${v.theoDo ? 'đủ' : `thiếu/thừa — theo lịch prompt`}) · vào ${v.vao.join(' · ')}${v.ngan.length ? ` · ⚠ đoạn ngắn hơn giây phát: #${v.ngan.join(', #')}` : ''}`);
  ff(['-loglevel', 'error', '-y', '-i', f, '-vf', 'fps=3,scale=160:-1,tile=8x3', '-frames:v', '1', `${tmp}/to-${c[0]!.thu_tu}-${c.at(-1)!.thu_tu}.jpg`]);
}
process.exit(0);
