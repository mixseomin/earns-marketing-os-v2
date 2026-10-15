// LƯU MẪU QC THẮNG cho template (anh 15/10/2026: "template phải ghi đầy đủ nguồn tham khảo để coi như ví dụ, đính kèm video thực tế"):
// lấy QC từ kho spy (qc_meta trên box3) → tải video (fbcdn hết hạn sau ít ngày) → lưu lên R2 img.on.tc + ảnh poster + tờ 8 khung để soát.
// In JSON {ma, page, x, ngay, link, video, anh, to} cho từng mã — dán vào mau/templates.json › mau_qc. 0đ, không gọi model.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/luu-mau-qc.mts <library_id> [<library_id>…]
// Kho spy: biến SPY_DATABASE_URL, hoặc đọc /root/.secrets/spy.env (DATABASE_URL của spy.on.tc).
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdtempSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postgres from 'postgres';
import { uploadToR2 } from '../src/lib/r2';

// QC chỉ có trong SpyPro (không có trong kho spy): --video=<url|tệp> --page=<tên> --x=<số bản nhân> --ngay=<ngày chạy> cho MỘT mã
// (lấy từ spypro get_ad › cards[].video_hd_url; link fbcdn hết hạn nhanh nên tải về tệp trước cũng được).
const tuy = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').slice(k.length + 3);
const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const spyUrl = process.env.SPY_DATABASE_URL
  || (existsSync('/root/.secrets/spy.env') ? /DATABASE_URL=["']?([^"'\n]+)/.exec(readFileSync('/root/.secrets/spy.env', 'utf8'))?.[1] : undefined);
if (!spyUrl) { console.error('thiếu kết nối kho spy'); process.exit(1); }
const spy = postgres(spyUrl, { max: 1 });
const thu = mkdtempSync(join(tmpdir(), 'mau-qc-'));
const ra: Record<string, unknown>[] = [];
for (const ma of ids) {
  let r = (await spy`SELECT library_id, page_ten, so_qc_cung, coalesce(ngay_dung, current_date) - bat_dau AS ngay, coalesce(video_hd, video_sd) AS video, anh
    FROM qc_meta WHERE library_id = ${ma}`)[0] as { page_ten: string; so_qc_cung: number | null; ngay: number | null; video: string | null; anh: string | null } | undefined;
  if (!r && tuy('video') && ids.length === 1) r = { page_ten: tuy('page'), so_qc_cung: Number(tuy('x')) || null, ngay: Number(tuy('ngay')) || null, video: tuy('video'), anh: null };
  if (!r) { console.error(`${ma}: không có trong kho spy (QC SpyPro thì thêm --video= --page= --x= --ngay=)`); continue; }
  const o: Record<string, unknown> = { ma, page: r.page_ten, x: r.so_qc_cung, ngay: r.ngay, link: `https://www.facebook.com/ads/library/?id=${ma}` };
  if (r.video) {
    const mp4 = join(thu, `${ma}.mp4`), jpg = join(thu, `${ma}.jpg`), to = join(thu, `${ma}-to.jpg`);
    try {
      if (existsSync(String(r.video))) copyFileSync(String(r.video), mp4); else execFileSync('curl', ['-sL', '-m', '120', '-o', mp4, String(r.video)]);
      const d = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString().trim());
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(Math.min(1, d / 4)), '-i', mp4, '-frames:v', '1', '-vf', 'scale=480:-2', jpg]);
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-vf', `fps=8/${d},scale=240:-2,tile=8x1`, '-frames:v', '1', to]);
      o.giay = Math.round(d * 10) / 10;
      o.video = await uploadToR2(`xuong-video/mau-qc/${ma}.mp4`, readFileSync(mp4), 'video/mp4');
      o.anh = await uploadToR2(`xuong-video/mau-qc/${ma}.jpg`, readFileSync(jpg), 'image/jpeg');
      o.to = await uploadToR2(`xuong-video/mau-qc/${ma}-to.jpg`, readFileSync(to), 'image/jpeg');
    } catch (e) { console.error(`${ma}: tải video lỗi (link fbcdn có thể đã hết hạn) — ${(e as Error).message.slice(0, 120)}`); }
  } else if (r.anh) {   // QC ảnh: lưu ảnh lên R2 (link fbcdn cũng hết hạn)
    const jpg = join(thu, `${ma}.jpg`);
    try { execFileSync('curl', ['-sL', '-m', '60', '-o', jpg, String(r.anh)]); o.anh = await uploadToR2(`xuong-video/mau-qc/${ma}.jpg`, readFileSync(jpg), 'image/jpeg'); }
    catch (e) { console.error(`${ma}: tải ảnh lỗi — ${(e as Error).message.slice(0, 120)}`); }
  }
  ra.push(o);
}
console.log(JSON.stringify(ra, null, 1));
await spy.end();
process.exit(0);
