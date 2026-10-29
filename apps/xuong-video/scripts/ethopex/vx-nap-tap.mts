// NẠP PHIM KỂ CHUYỆN LÀM BẰNG VideoExpress vào studio + XUẤT MP4 (0đ — R2 + ffmpeg). Nửa sau của scripts/ethopex/vx-ke-chuyen.mts (anh 29/10/2026).
// Đọc <thư mục>/so.json + am-N.mp3 · anh-N.jpg · vid-N.mp4 (chép từ iMac lên box3), nạp R2, ghi xv_canh (chụp hoàn tác trước khi ghi):
// keyframe_url · video_url · thoai_url · phat_s (= giọng + 0,35s, không quá clip) · nguon_video {model:'videoexpress'}; rồi chayXuat của studio (đúng khuôn chữ
// màn / thẻ cuối QC kể chuyện) + ghiBanXuat. Nhạc nền: tập chưa có nhạc thì dùng lại nhạc kể chuyện trong kho ($0).
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
const so = JSON.parse(readFileSync(`${D}/so.json`, 'utf8')) as { giong?: string; canh: Record<string, { anhUuid?: string; vidUuid?: string; amGiay?: number }> };
const canh = (await db.execute(sql`SELECT id, thu_tu, thoai, loi_thoai FROM xv_canh WHERE tap_id = ${tapId} AND coalesce(phan_doan, '') <> 'cta' ORDER BY thu_tu, id`)) as unknown as { id: number; thu_tu: number; thoai: { loi: string; nhan_vat?: string }[] | null; loi_thoai: string }[];
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
  await chupTruoc(db, { bang: 'xv_canh', id: c.id, cot: ['keyframe_url', 'video_url', 'thoai_url', 'thoai', 'phat_s', 'nguon_video'], moTa: '🎬 nạp ảnh / clip / giọng VideoExpress', nguoi: '', nhom });
  // giọng phải nằm ở thoai[].url — bộ xuất đọc dòng thoại (am-thanh.ts › dongThoai), thoai_url chỉ dùng cho cảnh cũ chưa có mảng thoai: chỉ ghi thoai_url thì MP4 câm (lần xuất đầu 29/10)
  const dong = c.thoai?.length ? c.thoai : [{ loi: c.loi_thoai, nhan_vat: '' }];
  const thoai = dong.map((d, i) => (i === 0 ? { ...d, url: am, dai: ga, gon: true, giong: `videoexpress|${so.giong ?? 'tts'}` } : d));
  await db.execute(sql`UPDATE xv_canh SET keyframe_url = ${kf}, video_url = ${vid}, thoai_url = ${am}, thoai = ${JSON.stringify(thoai)}::jsonb, phat_s = ${phat},
    nguon_video = ${JSON.stringify({ model: 'videoexpress', giay: gv, uuid: so.canh[n]?.vidUuid, anh_uuid: so.canh[n]?.anhUuid, khung_dau: kf })}::jsonb, updated_at = now() WHERE id = ${c.id}`);
  console.log(`✓ #${n}: clip ${gv.toFixed(1)}s · giọng ${ga.toFixed(1)}s · phát ${phat}s`);
}
// NHẠC NỀN $0 (anh 29/10/2026 "miễn phí tối đa"): tập chưa có nhạc → DÙNG LẠI bản nhạc QC kể chuyện đã sinh trong kho (xv_tai_san loai 'nhac', đã trả tiền từ trước),
// ưu tiên bản "tense … triumphant" (cú lật của truyện trả thù), bản ít tập dùng nhất. Không sinh nhạc mới (bước tốn tiền); AI Sound Maker của VideoExpress khoá sau Review Bonus.
// Không lót tiếng clip: am-thanh.ts › phatTiengClip tắt tiếng clip ở cảnh có lời dẫn (clip AI tự bịa giọng / nhạc, nền nhảy 30 dB).
const coNhac = ((await db.execute(sql`SELECT nhac_url FROM xv_tap WHERE id = ${tapId}`)) as unknown as { nhac_url: string | null }[])[0]?.nhac_url;
if (!coNhac) {
  const nhac = ((await db.execute(sql`SELECT k.id, k.url, k.ten FROM xv_tai_san k WHERE k.loai = 'nhac' AND k.mo_ta ILIKE '%Genre: qc ke_chuyen%'
    ORDER BY (k.mo_ta ILIKE '%tense%triumphant%') DESC, (SELECT count(*) FROM xv_tap t WHERE t.nhac_url = k.url), k.id DESC LIMIT 1`)) as unknown as { id: number; url: string; ten: string }[])[0];
  if (nhac) {
    await chupTruoc(db, { bang: 'xv_tap', id: tapId, cot: ['nhac_url', 'nhac_mo_ta'], moTa: '🎵 dùng lại nhạc kho cho phim VideoExpress', nguoi: '', nhom });
    await db.execute(sql`UPDATE xv_tap SET nhac_url = ${nhac.url}, nhac_mo_ta = ${`dùng lại kho #${nhac.id}: ${nhac.ten}`} WHERE id = ${tapId}`);
    console.log(`✓ nhạc nền: dùng lại kho #${nhac.id} (${nhac.ten.slice(0, 60)})`);
  } else console.log('⚠ kho chưa có nhạc QC kể chuyện — xuất không nhạc');
}
const b = (await boiCanhTap(db, tapId))!; const kt = docKinhThanh(b.kt);
const job = await taoJob(db, { phim_id: b.tap.phim_id, nhan: `Xuất bản · tập ${b.tap.so} (VideoExpress)`, loai: 'xuat', provider: 'ffmpeg', model: 'ffmpeg', request: { tap_id: tapId, nhanh: 'A' } });
const x = await chayXuat({ loai: b.loai, tiLe: kt.ti_le, nhipStopMotion: kt.nhip_stop_motion, look: lookPhim(kt), canh: ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu`)) as unknown as Row[]).map(mapCanh),
  nhanVat: b.nhanVat, tap: b.tap, qc: kt.qc, nhanh: 'A', choThieuNhac: true, boQuaSoi: true, chiThuTu: canh.map((c) => c.thu_tu) });   // chỉ thân phim — thẻ cuối do bước CTA v2 (cat-canh) dựng
if (!x.ok) { await db.execute(sql`UPDATE xv_job SET trang_thai = 'loi', loi = ${x.loi} WHERE id = ${job}`); console.error(`✗ xuất: ${x.loi}`); process.exit(1); }
await ghiBanXuat(db, { tapId, job, nhanh: 'A', kq: x });
// CỔNG KHÔNG CÂM (anh 29/10/2026 "sao ko có tiếng?" rồi "lần sau… lặp lại lỗi này?"): bản xuất đầu tiên −91 dB vì giọng không vào thoai[] — đo mức tiếng cả bản, câm thì ĐỎ
const muc = Number(/mean_volume: (-?[\d.]+) dB/.exec(execSync(`ffmpeg -hide_banner -i ${JSON.stringify(x.url)} -af volumedetect -f null - 2>&1`, { encoding: 'utf8' }))?.[1] ?? -99);
if (muc < -45) { console.error(`✗ bản xuất CÂM (${muc} dB) — giọng không vào bản dựng, kiểm thoai[].url của các cảnh: ${x.url}`); process.exit(1); }
console.log(`✓ MP4 ${x.giay}s → ${x.url}`); console.log(`  bước kế (iMac): vx-ke-chuyen.mts --tap=${tapId} --cta=${x.url}  → thẻ cuối mẫu CTA v2`); for (const c of x.canhBao) console.log(`  ⚠ ${c}`);
process.exit(0);
