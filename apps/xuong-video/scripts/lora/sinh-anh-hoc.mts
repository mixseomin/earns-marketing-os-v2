// BỘ ẢNH HỌC LoRA cho MỘT nhân vật (anh 18/10/2026: "vẽ nhiều ảnh luôn nếu cần để LoRA học tốt nhất — đáng đầu tư vì bền vững lâu dài").
// Ngành: mặt nhân vật dạy sẵn vào LoRA (15–30 ảnh nhiều góc / biểu cảm / ánh sáng / trang phục khác nhau để học MẶT chứ không học quần áo), bố cục
// do độ sâu 3D lo — một lượt vẽ, không bước sửa mặt. Ảnh vẽ bằng model ảnh của phim từ ảnh sát mặt + sheet nhân vật; SFace (soi-mat.py, 0đ) lọc
// ảnh lệch mặt. TỐN TIỀN: mỗi ảnh một job trên sổ — chỉ chạy với DUYET_SINH_1_LAN=1 sau khi anh duyệt.
//   cd apps/xuong-video && DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/lora/sinh-anh-hoc.mts <nhan_vat_id> [--so=30]
import { execFile } from 'node:child_process';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { mapNhanVat, taoJob, xongJob, type Row } from '../../src/lib/xuong-video/doc-db';
import { sinhAnh, taiAnhBase64 } from '../../src/lib/xuong-video/google';
import { giaAnhSv } from '../../src/lib/xuong-video/hoan-tat';
import { docKinhThanh } from '../../src/lib/xuong-video/kieu';
import { uploadToR2 } from '../../src/lib/r2';

const id = Number(process.argv[2]); const so = Number((process.argv.find((a) => a.startsWith('--so=')) ?? '--so=30').slice(5));
if (!id) { console.error('cần <nhan_vat_id>'); process.exit(1); }
if (process.env.DUYET_SINH_1_LAN !== '1') { console.error('TỐN TIỀN — chỉ chạy với DUYET_SINH_1_LAN=1 sau khi anh duyệt'); process.exit(1); }
const db = getDb()!;
const nv = mapNhanVat(((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE id = ${id}`)) as unknown as Row[])[0]!);
const phim = ((await db.execute(sql`SELECT id, kinh_thanh FROM xv_phim WHERE id = ${nv.phim_id}`)) as unknown as Row[])[0]!;
const kt = docKinhThanh(phim.kinh_thanh); const model = kt.mo_hinh_anh || 'gemini-nano-banana-2.1';
const mat = ((nv as unknown as { anh_mat?: { url?: string[] } }).anh_mat?.url ?? []);
const ref = [...mat, ...nv.anh_ref].slice(0, 3);
if (!ref.length) { console.error('nhân vật chưa có ảnh mẫu / ảnh sát mặt'); process.exit(1); }
const nu = /woman|female|girl|nữ/i.test(nv.mo_ta); const ho = nu ? 'her' : 'his';

const GOC = ['front view, looking straight into the camera', `three-quarter view, head turned to ${ho} left`, `three-quarter view, head turned to ${ho} right`, `left side profile`, `right side profile`,
  'seen slightly from above, looking up at the camera', 'seen slightly from below', `looking back over ${ho} shoulder at the camera`];
const CAM = ['neutral calm expression', 'soft closed-mouth smile', 'bright open laughing smile', 'cold determined stare', 'sad, eyes glistening with tears', 'surprised, eyebrows raised, lips parted', 'angry frown', 'a faint knowing smirk'];
const CO = ['tight close-up of the face', 'head-and-shoulders portrait', 'tight close-up of the face', 'medium shot from the waist up', 'head-and-shoulders portrait', 'full-body shot, standing'];
const SANG = ['soft window daylight', 'warm indoor lamp light', 'overcast outdoor daylight', 'neutral studio light', 'golden hour sunlight'];
const AO = nu ? ['plain white silk blouse', 'tailored white blazer', 'simple grey knit sweater', 'black turtleneck', 'navy office blazer', 'casual white t-shirt', 'beige trench coat']
  : ['white dress shirt', 'black suit jacket', 'grey knit sweater', 'navy polo shirt', 'casual white t-shirt', 'dark overcoat', 'black turtleneck'];
const NEN = ['plain light grey studio backdrop', 'softly blurred modern office', 'softly blurred city street', 'plain warm beige wall', 'softly blurred cafe interior'];

const ra: { url: string; giong: number | null; dat: boolean; prompt: string }[] = []; let tien = 0;
for (let i = 0; i < so; i++) {
  const co = CO[i % CO.length]!; const day = co.startsWith('full');
  const prompt = `Photorealistic photograph of the SAME person as in Image 1${ref.length > 1 ? ` and Image 2` : ''}: identical face, eyes, eyebrows, nose, lips, jawline, skin tone and hair (${nv.mo_ta}). ${co}, ${GOC[i % GOC.length]}, ${CAM[(i * 3) % CAM.length]}, wearing ${AO[i % AO.length]}, ${SANG[i % SANG.length]}, ${NEN[(i * 2) % NEN.length]}. Natural skin texture, sharp focus on the eyes, 35mm photo. Exactly one person. No text, no watermark.`;
  const job = await taoJob(db, { nhan: `LoRA · ảnh học ${nv.ten} ${i + 1}/${so}`, nhan_vat_id: id, loai: 'anh', provider: 'google', model, request: { prompt, thamChieu: ref } });
  const kq = await sinhAnh({ model, prompt, thamChieuUrl: ref, thamChieu: (await Promise.all(ref.map(taiAnhBase64))).filter((x): x is NonNullable<typeof x> => !!x), tiLe: day ? '9:16' : '4:5' });
  if (!kq.ok) { await xongJob(db, job, { loi: kq.loi }); console.log(`✗ ${i + 1}: ${kq.loi.slice(0, 120)}`); continue; }
  const url = await uploadToR2(`xuong-video/lora/${id}/hoc-${i + 1}-${Date.now()}.png`, kq.data, kq.mimeType);
  const gia = await giaAnhSv(model); tien += gia;
  await xongJob(db, job, { output_url: url ?? undefined, model: kq.model, chi_phi_cents: gia });
  if (url) ra.push({ url, giong: null, dat: false, prompt });
  process.stdout.write(`· ${i + 1}/${so} $${(tien / 100).toFixed(2)}\n`);
}
// LỌC MẶT (SFace, 0đ): giống ảnh sát mặt ≥ ngưỡng cùng người; mặt nghiêng hẳn (profile) bộ so không tin được → giữ nếu ≥ 0,25
const vao = { mau: { [nv.ten]: mat.length ? mat : ref }, anh: ra.map((x, i) => ({ id: i, url: x.url, ten: [nv.ten] })) };
const soi = await new Promise<{ anh: { id: number; ket?: { ten: string; giong: number | null; dat: boolean; nghieng?: boolean }[] }[] }>((ok, hong) => {
  const p = execFile(process.env.XV_SOI_MAT_PY || '/opt/xv-soi-mat/bin/python', ['scripts/soi-mat/soi-mat.py'], { maxBuffer: 1 << 24, timeout: 20 * 60_000 }, (e, o) => (e ? hong(e) : ok(JSON.parse(o))));
  p.stdin?.end(JSON.stringify(vao));
});
for (const a of soi.anh) { const k = a.ket?.[0]; const x = ra[a.id]!; x.giong = k?.giong ?? null; x.dat = !!k && (k.dat || (!!k.nghieng && (k.giong ?? 0) >= 0.25)); }
const giu = ra.filter((x) => x.dat);
const man = await uploadToR2(`xuong-video/lora/${id}/bo-hoc-${Date.now()}.json`, Buffer.from(JSON.stringify({ nhan_vat: id, ten: nv.ten, ref, anh: ra }, null, 1)), 'application/json');
console.log(JSON.stringify({ sinh: ra.length, giu: giu.length, tien: `$${(tien / 100).toFixed(2)}`, bo_hoc: man }));
process.exit(0);
