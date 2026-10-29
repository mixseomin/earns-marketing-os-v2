// NẠP PHIM KỂ CHUYỆN LÀM BẰNG VideoExpress vào studio + XUẤT MP4 (0đ — R2 + ffmpeg). Nửa sau của scripts/ethopex/vx-ke-chuyen.mts (anh 29/10/2026).
// Đọc <thư mục>/so.json + am-N.mp3 · anh-N.jpg · vid-N.mp4 (chép từ iMac lên box3), nạp R2, ghi xv_canh (chụp hoàn tác trước khi ghi):
// keyframe_url · video_url · thoai_url · phat_s (= giọng + 0,35s, không quá clip) · nguon_video {model:'videoexpress'}; rồi chayXuat của studio (đúng khuôn chữ
// màn / thẻ cuối QC kể chuyện) + ghiBanXuat. Nhạc nền: tập chưa có nhạc thì xuất không nhạc (choThieuNhac) — sinh nhạc là bước tốn tiền riêng.
//   (iMac) rsync -a ~/.cache/ethopex/vx-kc/<tap>/ root@167.233.241.16:/var/tmp/vx-kc/<tap>/
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/ethopex/vx-nap-tap.mts <tap_id> /var/tmp/vx-kc/<tap>
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { uploadToR2 } from '../../src/lib/r2';
import { chupTruoc } from '../../src/lib/xuong-video/hoan-tac';
import { boiCanhTap, mapCanh, taoJob, type Row } from '../../src/lib/xuong-video/doc-db';
import { chayXuat, ghiBanXuat } from '../../src/lib/xuong-video/xuat-chay';
import { lookPhim } from '../../src/lib/xuong-video/look';
import { docKinhThanh } from '../../src/lib/xuong-video/kieu';

const tapId = Number(process.argv[2]); const D = process.argv[3]!;
if (!tapId || !D || !existsSync(`${D}/so.json`)) { console.error('cần <tap_id> <thư mục có so.json>'); process.exit(1); }
const db = getDb()!;
const so = JSON.parse(readFileSync(`${D}/so.json`, 'utf8')) as { canh: Record<string, { anhUuid?: string; vidUuid?: string; amGiay?: number }> };
const canh = (await db.execute(sql`SELECT id, thu_tu FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as { id: number; thu_tu: number }[];
const giay = (f: string) => Number(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 ${JSON.stringify(f)}`, { encoding: 'utf8' }).trim());
const thieu = canh.filter((c) => !['am', 'anh', 'vid'].every((k) => existsSync(`${D}/${k}-${c.thu_tu}.${k === 'am' ? 'mp3' : k === 'anh' ? 'jpg' : 'mp4'}`)));
if (thieu.length) { console.error(`thiếu tệp cho cảnh ${thieu.map((c) => `#${c.thu_tu}`).join(' ')} — chạy lại vx-ke-chuyen.mts trên iMac`); process.exit(1); }
const nhom = randomUUID();
for (const c of canh) {
  const n = c.thu_tu, ma = randomUUID();
  const kf = await uploadToR2(`xuong-video/keyframe/${c.id}-vx-${ma}.jpg`, readFileSync(`${D}/anh-${n}.jpg`), 'image/jpeg');
  const vid = await uploadToR2(`xuong-video/clip/${c.id}-vx-${ma}.mp4`, readFileSync(`${D}/vid-${n}.mp4`), 'video/mp4');
  const am = await uploadToR2(`xuong-video/am/thoai/${c.id}-vx-${ma}.mp3`, readFileSync(`${D}/am-${n}.mp3`), 'audio/mpeg');
  if (!kf || !vid || !am) { console.error(`✗ nạp R2 hỏng ở cảnh #${n}`); process.exit(1); }
  const gv = giay(`${D}/vid-${n}.mp4`), ga = so.canh[n]?.amGiay ?? giay(`${D}/am-${n}.mp3`);
  const phat = Math.round(Math.min(gv, ga + 0.35) * 10) / 10;
  await chupTruoc(db, { bang: 'xv_canh', id: c.id, cot: ['keyframe_url', 'video_url', 'thoai_url', 'phat_s', 'nguon_video'], moTa: '🎬 nạp ảnh / clip / giọng VideoExpress', nguoi: '', nhom });
  await db.execute(sql`UPDATE xv_canh SET keyframe_url = ${kf}, video_url = ${vid}, thoai_url = ${am}, phat_s = ${phat},
    nguon_video = ${JSON.stringify({ model: 'videoexpress', giay: gv, uuid: so.canh[n]?.vidUuid, anh_uuid: so.canh[n]?.anhUuid, khung_dau: kf })}::jsonb, updated_at = now() WHERE id = ${c.id}`);
  console.log(`✓ #${n}: clip ${gv.toFixed(1)}s · giọng ${ga.toFixed(1)}s · phát ${phat}s`);
}
const b = (await boiCanhTap(db, tapId))!; const kt = docKinhThanh(b.kt);
const job = await taoJob(db, { phim_id: b.tap.phim_id, nhan: `Xuất bản · tập ${b.tap.so} (VideoExpress)`, loai: 'xuat', provider: 'ffmpeg', model: 'ffmpeg', request: { tap_id: tapId, nhanh: 'A' } });
const x = await chayXuat({ loai: b.loai, tiLe: kt.ti_le, nhipStopMotion: kt.nhip_stop_motion, look: lookPhim(kt), canh: ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu`)) as unknown as Row[]).map(mapCanh),
  nhanVat: b.nhanVat, tap: b.tap, qc: kt.qc, nhanh: 'A', choThieuNhac: true, boQuaSoi: true });
if (!x.ok) { await db.execute(sql`UPDATE xv_job SET trang_thai = 'loi', loi = ${x.loi} WHERE id = ${job}`); console.error(`✗ xuất: ${x.loi}`); process.exit(1); }
await ghiBanXuat(db, { tapId, job, nhanh: 'A', kq: x });
console.log(`✓ MP4 ${x.giay}s → ${x.url}`); for (const c of x.canhBao) console.log(`  ⚠ ${c}`);
process.exit(0);
