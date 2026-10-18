// BỘ ẢNH HỌC LoRA cho MỘT nhân vật (anh 18/10/2026: "vẽ nhiều ảnh luôn nếu cần để LoRA học tốt nhất — đáng đầu tư vì bền vững lâu dài").
// Ngành: mặt nhân vật dạy sẵn vào LoRA (15–30 ảnh nhiều góc / biểu cảm / ánh sáng / trang phục khác nhau để học MẶT chứ không học quần áo), bố cục
// do độ sâu 3D lo — một lượt vẽ, không bước sửa mặt. Ảnh vẽ bằng model ảnh của phim từ ảnh sát mặt + sheet nhân vật; SFace (soi-mat.py, 0đ) lọc
// ảnh lệch mặt. TỐN TIỀN: mỗi ảnh một job trên sổ — chỉ chạy với DUYET_SINH_1_LAN=1 sau khi anh duyệt.
//   cd apps/xuong-video && DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/lora/sinh-anh-hoc.mts <nhan_vat_id> [--so=30] [--bo=cam-xuc]
// --bo=cam-xuc: bộ HỈ NỘ ÁI Ố (anh 18/10/2026) — bộ thường toàn nét nhẹ nên LoRA kéo mặt về bình thường (khóc ra hét, cười đau ra cười vui);
// mỗi cảm xúc một cận mặt tả cơ mặt + nước mắt cụ thể, nét mạnh thêm một trung cảnh có DÁNG thân (dáng cụ thể từng shot vẫn do khung 3D quyết).
import { execFile } from 'node:child_process';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { mapNhanVat, taoJob, xongJob, type Row } from '../../src/lib/xuong-video/doc-db';
import { sinhAnh, taiAnhBase64 } from '../../src/lib/xuong-video/google';
import { giaAnhSv } from '../../src/lib/xuong-video/hoan-tat';
import { docKinhThanh } from '../../src/lib/xuong-video/kieu';
import { uploadToR2 } from '../../src/lib/r2';
import { songSong } from '../../src/lib/xuong-video/song-song';

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

// HỈ NỘ ÁI Ố: [mặt, dáng trung cảnh (rỗng = chỉ cận)]
const CAM_XUC: [string, string][] = [
  ['laughing with pure joy, eyes crinkled into crescents, head tilted back, wide open-mouthed laugh showing teeth', 'hands clapped together at her chest, shoulders lifted'],
  ['crying tears of joy, a trembling wide smile while clear tears roll down both cheeks, eyes red and shining', 'both hands over her mouth in disbelief'],
  ['furious, shouting with the mouth wide open, brows slammed down, nostrils flared, neck tendons straining, face flushed red', 'leaning forward, pointing a finger hard at someone off screen'],
  ['cold contained rage, jaw clenched, lips pressed into a thin line, glaring from under lowered brows', ''],
  ['tender loving gaze, soft eyes, gentle closed-mouth smile, head tilted slightly', 'hand resting lightly over her heart'],
  ['wistful longing, eyes distant and glistening, faint sad smile', ''],
  ['disgusted, nose wrinkled, upper lip curled up, eyes narrowed, head pulled back', 'leaning away, one hand raised to block'],
  ['contemptuous sneer, one corner of the lip raised, chin up, looking down her nose', ''],
  ['sobbing uncontrollably, face crumpled and contorted, mouth open in a wail, tears streaming down both cheeks, eyes red and swollen, snot at the nostrils', 'hunched over, both hands clutching her chest, shoulders shaking'],
  ['silent crying, a single heavy tear rolling down the cheek, lower lip bitten hard, chin trembling, eyes brimming', 'arms wrapped tightly around herself'],
  ['terrified, eyes wide open showing the whites, mouth open in a gasp, brows raised and pulled together', 'backing away, hands raised defensively in front of her'],
  ['a broken laugh through tears, eyes squeezed shut, brows knitted in pain, mouth open in a cracked laugh, tears running down', 'bent forward, one hand pressed to her forehead'],
  ['humiliated, cheeks flushed red, eyes glistening and lowered, lips pressed together holding back tears', 'head bowed, hands gripping the hem of her jacket'],
  ['stunned shock, eyes wide, jaw dropped, frozen, face drained of color', 'frozen mid-step, one hand half raised'],
];
// CẢM XÚC GIỮA HÀNH ĐỘNG + BỐI CẢNH (anh 18/10/2026: "đang leo núi mà nhìn thấy cảnh đau đớn thì khóc thật to") — cảnh rộng / toàn thân,
// để LoRA giữ mặt cả khi khóc lớn ở khổ nhỏ, ngoài trời: [cỡ, nét + dáng, bối cảnh]
const CAM_CANH: [string, string, string][] = [
  ['medium-wide shot', 'kneeling on a rocky trail, crying out loud with the mouth wide open, tears streaming, one hand gripping a rock, wearing hiking clothes and a backpack', 'mountain trail high above misty valleys'],
  ['full-body shot', 'standing in heavy rain, head thrown back, screaming in grief, soaked hair stuck to her face, arms hanging limp', 'empty city street at night under a streetlight'],
  ['medium-wide shot', 'sliding down a wall to the floor, sobbing hard, both hands pressed over her face', 'pale hospital corridor with fluorescent light'],
  ['full-body shot', 'running barefoot and laughing with pure joy, arms spread wide, hair flying', 'sunny beach at the waterline'],
];
const DS: { co: string; goc: string; cam: string; nen?: string }[] = process.argv.includes('--bo=cam-xuc')
  ? [...CAM_XUC.flatMap(([mat, dang], i) => [{ co: 'tight close-up of the face', goc: GOC[i % 4]!, cam: mat }, ...(dang ? [{ co: 'medium shot from the waist up', goc: GOC[(i + 1) % 3]!, cam: `${mat}, ${dang}` }] : [])]),
    ...CAM_CANH.map(([co, cam, nen], i) => ({ co, goc: GOC[i % 3]!, cam, nen }))]
  : Array.from({ length: so }, (_, i) => ({ co: CO[i % CO.length]!, goc: GOC[i % GOC.length]!, cam: CAM[(i * 3) % CAM.length]! }));
const ra: { url: string; giong: number | null; dat: boolean; prompt: string }[] = []; let tien = 0;
await songSong(DS, async (d, i) => {   // song song có trần (song-song.ts) — 29 ảnh tuần tự mất ~25 phút
  const co = d.co; const day = co.startsWith('full');
  const prompt = `Photorealistic photograph of the SAME person as in Image 1${ref.length > 1 ? ` and Image 2` : ''}: identical face, eyes, eyebrows, nose, lips, jawline, skin tone and hair (${nv.mo_ta}). ${co}, ${d.goc}, ${d.cam}, ${d.nen ? '' : `wearing ${AO[i % AO.length]}, ${SANG[i % SANG.length]}, `}${d.nen ?? NEN[(i * 2) % NEN.length]}. Natural skin texture, sharp focus on the eyes, 35mm photo. Exactly one person. No text, no watermark.`;
  const job = await taoJob(db, { nhan: `LoRA · ảnh học ${nv.ten} ${i + 1}/${DS.length}`, nhan_vat_id: id, loai: 'anh', provider: 'google', model, request: { prompt, thamChieu: ref } });
  const kq = await sinhAnh({ model, prompt, thamChieuUrl: ref, thamChieu: (await Promise.all(ref.map(taiAnhBase64))).filter((x): x is NonNullable<typeof x> => !!x), tiLe: day ? '9:16' : '4:5' });
  if (!kq.ok) { await xongJob(db, job, { loi: kq.loi }); console.log(`✗ ${i + 1}: ${kq.loi.slice(0, 120)}`); return; }
  const url = await uploadToR2(`xuong-video/lora/${id}/hoc-${i + 1}-${Date.now()}.png`, kq.data, kq.mimeType);
  const gia = await giaAnhSv(model); tien += gia;
  await xongJob(db, job, { output_url: url ?? undefined, model: kq.model, chi_phi_cents: gia });
  if (url) ra.push({ url, giong: null, dat: false, prompt });
  process.stdout.write(`· ${i + 1}/${DS.length} $${(tien / 100).toFixed(2)}\n`);
});
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
