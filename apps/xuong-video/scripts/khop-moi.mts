// KHỚP MÔI từ KHUNG ĐÃ DUYỆT + TỆP GIỌNG (anh 26/10/2026 "giờ sinh khớp mồm xem nào"): ảnh + giọng → video người nói, một bước (VEED Fabric 1.0 — fal,
// 480p $0,08/giây · 720p $0,15/giây theo bảng giá fal; độ dài = độ dài giọng). Đường khác của studio: Vidu trước rồi Sync Lipsync v2 (kieu.ts › KHOP_MIENG).
//   cd /opt/earns-marketing-os-v2/apps/xuong-video && set -a; . ../../.env.production; set +a; DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server \
//     ../../node_modules/.bin/tsx scripts/khop-moi.mts --anh=/tmp/khung-356/so-26-that.png --am=<url mp3> --ra=/tmp/khung-356/noi-26 [--do-phan-giai=480p]
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { guiFal, docFal } from '../src/lib/xuong-video/fal';
import { uploadToR2 } from '../src/lib/r2';

const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const anh = gia('anh'), am = gia('am'), ra = gia('ra') ?? '/tmp/khop-moi', dpg = gia('do-phan-giai') ?? '720p', model = gia('model') ?? 'veed/fabric-1.0';
if (!anh || !am) { console.error('cần --anh và --am'); process.exit(1); }
if (!process.env.DUYET_SINH_1_LAN) { console.error('tốn tiền — cần DUYET_SINH_1_LAN=1'); process.exit(2); }
const len = async (f: string, k: string, mime: string) => { const u = await uploadToR2(`xuong-video/thu/${k}-${randomUUID()}${f.slice(f.lastIndexOf('.'))}`, readFileSync(f), mime); if (!u) throw new Error(`không tải lên được ${f}`); return u; };
const uAnh = /^https?:/.test(anh) ? anh : await len(anh, 'khop-anh', 'image/png');
const uAm = /^https?:/.test(am) ? am : await len(am, 'khop-am', 'audio/mpeg');
// --dien="<chỉ đạo diễn tiếng Anh>": Vidu DIỄN trước (nét mặt / cử chỉ theo câu chỉ đạo — Fabric không nhận chỉ đạo, #26 ra mặt hiền) → Sync Lipsync v2
// sửa khẩu hình theo giọng (đường của studio: actions.ts › khớp miệng, sync_mode cut_off). Vidu $0,05/giây + Sync ~$0,05/giây.
const cho = async (id: string): Promise<string> => { for (let i = 0; i < 120; i++) { await new Promise((r) => setTimeout(r, 10_000)); const d = await docFal(id); if (d.done && d.ok) return d.uri; if (d.done) throw new Error(d.loi); } throw new Error('quá 20 phút'); };
if (gia('dien')) {
  const giay = Math.max(2, Math.min(8, Math.ceil(Number(gia('giay') || 3))));
  // --cuoi=<khung cuối>: khoá cả khung cuối (ánh mắt, nét kết) — chỉ khung đầu thì Vidu tự chế đoạn kết (#26 nửa sau quay thẳng vào ống kính, sai trục nhìn)
  const uCuoi = gia('cuoi') ? (/^https?:/.test(gia('cuoi')!) ? gia('cuoi')! : await len(gia('cuoi')!, 'khop-cuoi', 'image/png')) : null;
  const v = await guiFal('fal-ai/vidu/q2/image-to-video/turbo', { ...(uCuoi ? { end_image_url: uCuoi } : {}), image_url: uAnh, prompt: `Photorealistic live-action vertical short drama close-up. ${gia('dien')} The person speaks during the shot (mouth moving as if talking). Locked-off camera unless stated. Natural, realistic acting.`, duration: giay, resolution: '720p', movement_amplitude: 'auto' });
  if (!v.ok) { console.log(`Vidu từ chối — ${v.loi}`); process.exit(3); }
  const uV = await cho(v.taskId); console.log(`video diễn: ${uV}`);
  const s2 = await guiFal('fal-ai/sync-lipsync/v2', { video_url: uV, audio_url: uAm, sync_mode: 'cut_off' });
  if (!s2.ok) { console.log(`Sync từ chối — ${s2.loi}`); process.exit(3); }
  const uS = await cho(s2.taskId); writeFileSync(`${ra}.mp4`, Buffer.from(await (await fetch(uS)).arrayBuffer())); console.log(`clip: ${await len(`${ra}.mp4`, 'khop-moi', 'video/mp4')}`); process.exit(0);
}
const g = await guiFal(model, { image_url: uAnh, audio_url: uAm, resolution: dpg });
if (!g.ok) { console.log(`fal từ chối — ${g.loi}`); process.exit(3); }
for (let i = 0; i < 120; i++) {
  await new Promise((r) => setTimeout(r, 10_000)); const d = await docFal(g.taskId);
  if (d.done && d.ok) { writeFileSync(`${ra}.mp4`, Buffer.from(await (await fetch(d.uri)).arrayBuffer())); console.log(`clip: ${await len(`${ra}.mp4`, 'khop-moi', 'video/mp4')}`); process.exit(0); }
  if (d.done) { console.log(`hỏng — ${d.loi}`); process.exit(4); }
}
console.log('quá 20 phút'); process.exit(5);
