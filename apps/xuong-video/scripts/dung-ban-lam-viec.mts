// SERIES "BÀN LÀM VIỆC" (stop-motion, 14/10/2026): một nhân vật tí hon sống trên bàn làm việc thật của anh, phim không lời kiểu Larva.
// Bước 1 — BỐI CẢNH TRƯỚC, nhân vật sau (anh chốt): dựng phim + mỗi bối cảnh một anchor 'boi_canh' có ảnh thật của anh làm tham chiếu,
// rồi sinh ảnh gốc từng bối cảnh ở tầm mắt nhân vật 5 cm. TỐN TIỀN: mỗi bối cảnh 1 ảnh (~$0.034 Nano Banana).
// 20 bối cảnh: đồ vật, độ cao (đỉnh màn hình, từ trên xuống), giờ trong ngày (đêm, sáng sớm). Chạy lại an toàn: phim tìm theo tên, bối cảnh đã có ảnh sinh thì bỏ qua (--lai: sinh thêm một ảnh cho mọi bối cảnh).
// cd apps/xuong-video && DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/dung-ban-lam-viec.mts <ảnh-bàn.jpg …>
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { uploadToR2 } from '../src/lib/r2';
import { taoJob, type Row } from '../src/lib/xuong-video/doc-db';
import { chayViecAnh } from '../src/lib/xuong-video/viec-anh';
import { hoanTatAnh } from '../src/lib/xuong-video/hoan-tat';
import { promptBienThe } from '../src/lib/xuong-video/claude';

const TEN_PHIM = 'Series · Bàn làm việc (stop-motion)';
const PHONG_CACH = 'Real-world miniature stop-motion film: shot on a real home-office desk with a macro lens at tabletop height, as seen by a 5 cm tall character; shallow depth of field with soft bokeh; real materials and textures (warm wood grain, matte white plastic, brushed aluminium, paper); cozy warm desk-lamp light mixed with cool blue monitor glow; slightly handmade stop-motion feel with tactile detail; vertical 9:16 frame. Clean frames with no text, letters, numbers or logos anywhere';
const KINH_THANH = {
  phong_cach: PHONG_CACH, ti_le: '9:16', ngon_ngu: 'en', the_loai: 'hoat_hinh', do_phan_giai: '720p',
  mo_hinh_anh: 'gemini-nano-banana-2.1', mo_hinh_chu: 'claude-opus-5-5', mo_hinh_video: 'fal:fal-ai/veo3.1/lite/image-to-video',
  logline: 'A tiny creature lives on a busy home-office desk and turns everyday gadgets into a whole world of adventures.',
};
/** Bối cảnh: tên (hiện trong studio) + mô tả tiếng Anh (vào prompt). Mỗi cái là một "sân chơi" cho gag. */
const BOI_CANH: { ten: string; mo_ta: string }[] = [
  { ten: 'Toàn cảnh bàn', mo_ta: 'The whole desk seen from the front edge at tabletop height: the yellow-silver iMac on its stand on the right, the second monitor on its silver stand on the left, the white keyboard and white mouse on the warm wooden desktop, notebooks under the left monitor; the two screens glow softly' },
  { ten: 'Hẻm núi bàn phím', mo_ta: 'Down inside the white wireless keyboard: rows of white keys rise like a tiny white city or canyon, low angle looking along the gaps between key rows, soft monitor glow reflecting on the key tops' },
  { ten: 'Gầm chân đế iMac', mo_ta: 'Under and around the curved pale-yellow aluminium iMac stand: the stand arches overhead like a giant gateway, the white power cable snakes across the wooden desk behind it' },
  { ten: 'Bãi chuột', mo_ta: 'The white Magic Mouse sits on the wooden desk like a smooth white dome or parked vehicle, seen from ground level right next to it, the keyboard edge in soft focus behind' },
  { ten: 'Rừng dây cáp sau màn hình', mo_ta: 'Behind the monitors: a tangle of white and black cables, the silver USB hub on its orange card, the dark gap between the screens and the wall, cool blue light spilling from the screens above — a jungle of cables' },
  { ten: 'Núi sổ tay', mo_ta: 'The stack of notebooks and business cards under the left monitor stand seen from below like a layered cliff of paper, the silver monitor stand foot rising beside it' },
  { ten: 'Vách màn hình phát sáng', mo_ta: 'At the foot of the big iMac screen looking up: the bright screen is a towering wall of glowing light filling the top of the frame, showing only a soft abstract blue gradient, its light washing over the wooden desk' },
  { ten: 'Vực mép bàn', mo_ta: 'The front edge of the wooden desk seen from the desktop surface: the edge drops away like a cliff into the dim room below, a shelf with books faintly visible far down in the dark' },
  { ten: 'Đỉnh màn hình iMac', mo_ta: 'On top of the thin iMac like standing on a mountain ridge: looking down over the edge at the whole desk far below — keyboard, mouse, cables and notebooks look tiny; the glow of the screen rises from below the edge' },
  { ten: 'Sân đế màn hình trái', mo_ta: 'The flat silver foot of the left monitor stand seen at ground level: a wide smooth metal plaza with the stand column rising like a tower, notebooks stacked beside it' },
  { ten: 'Khe giữa hai màn hình', mo_ta: 'The narrow gap between the two monitors seen from the desk: two tall glowing walls of light on the left and right, a dark corridor between them leading to the wall behind' },
  { ten: 'Bến đế cắm', mo_ta: 'Close at ground level beside the silver USB hub resting on its orange card, the white cable plugged into it, like a small silver building on an orange platform' },
  { ten: 'Đường dây cáp trắng', mo_ta: 'The white iMac cable lying across the wooden desk seen from ground level, curving away into the distance like a white road or river across a wooden plain' },
  { ten: 'Hang dưới bàn phím', mo_ta: 'The thin dark space under the raised back edge of the white keyboard, seen from inside like a low cave, light coming in from the front edge' },
  { ten: 'Vách sách mép trái', mo_ta: 'The pile of magazines and books at the far left edge of the desk seen from below like a tall layered cliff of colorful paper spines' },
  { ten: 'Quả cầu loa đen', mo_ta: 'A small round black smart speaker behind the left monitor seen from ground level like a giant dark planet sitting on the desk, cables around it' },
  { ten: 'Toàn bàn ban đêm', mo_ta: 'The same desk at night: room dark, only the two screens glow dim blue, the keyboard and mouse catch faint cool light, long soft shadows' },
  { ten: 'Toàn bàn sáng sớm', mo_ta: 'The same desk early in the morning: screens off and black, warm golden sunlight streaming across the wooden desk from the side, dust specks floating in the light beams' },
  { ten: 'Trang sổ mở', mo_ta: 'An open paper notebook lying on the desk seen from page level: a wide white field of lined paper, the spiral binding rising like a fence, a pen lying across like a fallen log' },
  { ten: 'Bản đồ bàn từ trên xuống', mo_ta: 'Top-down view looking straight down at the whole desk like a map: the keyboard, mouse, two monitor stands, cables, notebooks and hub laid out on the warm wooden surface' },
];
const NHAC = 'Real desk reference: keep exactly the same objects, materials, colors and lighting as the real desk in the reference photo. Every screen shows ONLY a soft abstract colored glow — no people, no videos, no app windows, no logos, no text. No people, no hands, no characters in the frame';

/** Biến thể thời điểm cho mỗi bối cảnh (bối cảnh vốn đã là đêm / sáng sớm thì bỏ qua). */
const THOI_DIEM: { ten: string; mo_ta: string }[] = [
  { ten: 'Ban đêm', mo_ta: 'night time: the room is dark, the desk is lit only by the soft blue glow of the screens and a small warm desk lamp, long soft shadows' },
  { ten: 'Sáng sớm', mo_ta: 'early morning: screens are off and black, warm golden sunlight streams low across the desk from the side, dust specks float in the light beams' },
];
/** Đồ vật trên bàn (theo ảnh thật) → anchor đạo cụ; mỗi món một biến thể góc thấp tầm mắt nhân vật. */
const DO_VAT: { ten: string; mo_ta: string }[] = [
  { ten: 'Bàn phím trắng', mo_ta: 'the slim white wireless keyboard with white keys and a silver frame' },
  { ten: 'Chuột Magic Mouse', mo_ta: 'the smooth white wireless Magic Mouse, a low glossy white dome' },
  { ten: 'iMac vàng', mo_ta: 'the thin pale-yellow all-in-one iMac with a white bezel on its curved pale-yellow aluminium stand' },
  { ten: 'Màn hình trái', mo_ta: 'the second monitor with a thin black bezel on a silver aluminium stand with a flat square foot' },
  { ten: 'Chồng sổ tay', mo_ta: 'a small stack of notebooks with business cards on top' },
  { ten: 'Đế cắm USB', mo_ta: 'the small silver aluminium USB hub, a flat rounded rectangle with ports on its side' },
  { ten: 'Thẻ cam', mo_ta: 'a flat orange card / card holder lying on the desk' },
  { ten: 'Dây cáp trắng', mo_ta: 'the long white power cable of the iMac, with a metal plug end' },
  { ten: 'Loa cầu đen', mo_ta: 'a small round black fabric smart speaker, like a little dark sphere' },
  { ten: 'Chồng tạp chí', mo_ta: 'a pile of magazines and books with colorful spines' },
];
const GOC_THAP = 'seen from ground level by a 5 cm tall character standing on the desk: the object towers like a giant structure, macro lens, shallow depth of field';

const db = getDb()!;
const q = async (s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as Row[];
const lai = process.argv.includes('--lai');
const dot = (process.argv.find((x) => x.startsWith('--dot='))?.slice(6) ?? 'boi_canh') as 'boi_canh' | 'bien_the' | 'do_vat';
const tep = process.argv.slice(2).filter((x) => !x.startsWith('--'));
/** Chạy tối đa 5 việc sinh cùng lúc (Gemini giới hạn tốc độ). */
async function theoDot<T>(ds: T[], f: (x: T) => Promise<void>, cung = 5) { for (let i = 0; i < ds.length; i += cung) await Promise.all(ds.slice(i, i + cung).map(f)); }
const anhRa = (u: string) => !u.includes('/ref/');   // ảnh đã sinh (ảnh thật nằm ở xuong-video/ref/)

let phim = (await q(sql`SELECT id FROM xv_phim WHERE ten = ${TEN_PHIM} LIMIT 1`))[0];
if (!phim) {
  phim = (await q(sql`INSERT INTO xv_phim (project, ten, loai, mo_ta, kinh_thanh, trang_thai) VALUES ('studio', ${TEN_PHIM}, 'short',
    'Phim không lời kiểu stop-motion: nhân vật tí hon sống trên bàn làm việc thật, mỗi tập một câu chuyện đủ tình tiết với đồ vật trên bàn.', ${JSON.stringify(KINH_THANH)}::jsonb, 'nhap') RETURNING id`))[0]!;
  await q(sql`INSERT INTO xv_tap (phim_id, so, ten) VALUES (${Number(phim.id)}, 1, '')`);
}
const phimId = Number(phim.id);
// Ảnh thật: tải lên khi có đường dẫn; không thì dùng ảnh thật đã gắn ở bối cảnh đầu (đợt sau không cần đưa lại).
let anhThat: string[] = [];
for (const t of tep) {
  const u = await uploadToR2(`xuong-video/ref/ban-lam-viec-${randomUUID()}.jpg`, await readFile(t), 'image/jpeg');
  if (!u) { console.error('R2 không nhận ảnh', t); process.exit(1); }
  anhThat.push(u);
}
if (!anhThat.length) anhThat = (((await q(sql`SELECT anh_ref FROM xv_nhan_vat WHERE phim_id = ${phimId} AND loai = 'boi_canh' ORDER BY id LIMIT 1`))[0]?.anh_ref as string[]) ?? []).filter((u) => !anhRa(u));
if (!anhThat.length) { console.error('cần đường dẫn ảnh bàn thật (lần đầu)'); process.exit(1); }

const ra: { ten: string; url: string | null; loi?: string }[] = [];
/** Sinh một ảnh gốc cho anchor (job gắn nhan_vat_id → hoanTatAnh đưa ảnh lên ĐẦU anh_ref, ảnh thật giữ sau). */
async function anhGoc(loai: 'boi_canh' | 'dao_cu', ten: string, mo_ta: string, prompt: string) {
  let v = (await q(sql`SELECT id, anh_ref FROM xv_nhan_vat WHERE phim_id = ${phimId} AND loai = ${loai} AND ten = ${ten} LIMIT 1`))[0];
  if (!v) v = (await q(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, anh_ref) VALUES (${phimId}, ${loai}, ${ten}, ${mo_ta}, ${JSON.stringify(anhThat)}::jsonb) RETURNING id, anh_ref`))[0]!;
  if (((v.anh_ref as string[]) ?? []).some(anhRa) && !lai) { ra.push({ ten, url: null, loi: 'đã có ảnh — bỏ qua' }); return; }
  const job = await taoJob(db, { nhan_vat_id: Number(v.id), nhan: `Ảnh gốc · ${loai === 'boi_canh' ? 'bối cảnh' : 'đồ vật'} ${ten}`, loai: 'anh', provider: 'google', model: KINH_THANH.mo_hinh_anh, request: { prompt, thamChieuUrl: anhThat } });
  const kq = await chayViecAnh({ job, model: KINH_THANH.mo_hinh_anh, prompt, thamChieuUrl: anhThat, tiLe: loai === 'boi_canh' ? '9:16' : '1:1', thuMuc: `anchor/${Number(v.id)}` });
  await hoanTatAnh(kq);
  ra.push({ ten, url: kq.ok ? kq.url : null, ...(kq.ok ? {} : { loi: kq.loi }) });
}
/** Một biến thể của anchor (xv_bien_the, đúng hệ biến thể studio) — bám 2 ảnh đầu của anchor (ảnh sinh + ảnh thật). */
async function bienThe(loai: 'boi_canh' | 'dao_cu', tenAnchor: string, nhom: string, ten: string, mo_ta: string) {
  const v = (await q(sql`SELECT id, mo_ta, anh_ref FROM xv_nhan_vat WHERE phim_id = ${phimId} AND loai = ${loai} AND ten = ${tenAnchor} LIMIT 1`))[0];
  const anh = ((v?.anh_ref as string[]) ?? []);
  if (!v || !anh.some(anhRa)) { ra.push({ ten: `${tenAnchor} · ${ten}`, url: null, loi: 'anchor chưa có ảnh gốc — chạy đợt trước' }); return; }
  let b = (await q(sql`SELECT id, anh_url FROM xv_bien_the WHERE nhan_vat_id = ${Number(v.id)} AND ten = ${ten} LIMIT 1`))[0];
  if (b?.anh_url && !lai) { ra.push({ ten: `${tenAnchor} · ${ten}`, url: null, loi: 'đã có — bỏ qua' }); return; }
  if (!b) b = (await q(sql`INSERT INTO xv_bien_the (nhan_vat_id, nhom, ten, mo_ta) VALUES (${Number(v.id)}, ${nhom}, ${ten}, ${mo_ta}) RETURNING id, anh_url`))[0]!;
  const prompt = `${promptBienThe({ loai, ten: tenAnchor, mo_ta: String(v.mo_ta) }, { nhom, ten, mo_ta }, KINH_THANH)} ${NHAC}.`;
  const job = await taoJob(db, { nhan_vat_id: Number(v.id), bien_the_id: Number(b.id), nhan: `Biến thể · ${tenAnchor} · ${ten}`, loai: 'anh', provider: 'google', model: KINH_THANH.mo_hinh_anh, request: { prompt } });
  const kq = await chayViecAnh({ job, model: KINH_THANH.mo_hinh_anh, prompt, thamChieuUrl: anh.slice(0, 2), tiLe: loai === 'boi_canh' ? '9:16' : '1:1', thuMuc: `bien-the/${Number(b.id)}` });
  await hoanTatAnh(kq);
  ra.push({ ten: `${tenAnchor} · ${ten}`, url: kq.ok ? kq.url : null, ...(kq.ok ? {} : { loi: kq.loi }) });
}

if (dot === 'boi_canh') await theoDot(BOI_CANH, (b) => anhGoc('boi_canh', b.ten, b.mo_ta, `Establishing shot of a location for a miniature stop-motion film, no characters. Location: ${b.mo_ta}. ${NHAC}. Visual style: ${PHONG_CACH}.`));
if (dot === 'bien_the') await theoDot(BOI_CANH.filter((b) => !/ban đêm|sáng sớm/i.test(b.ten)).flatMap((b) => THOI_DIEM.map((t) => ({ b, t }))), ({ b, t }) => bienThe('boi_canh', b.ten, 'thoi_diem', t.ten, t.mo_ta));
if (dot === 'do_vat') {
  await theoDot(DO_VAT, (d) => anhGoc('dao_cu', d.ten, d.mo_ta, `Prop reference shot for a miniature stop-motion film: ${d.mo_ta}, photographed in place on the same warm wooden desk as in the reference photo, centered, macro lens, shallow depth of field, no characters. Keep the object's real shape, color and material exactly as in the reference photo. ${NHAC}. Visual style: ${PHONG_CACH}.`));
  await theoDot(DO_VAT, (d) => bienThe('dao_cu', d.ten, 'goc_may', 'Góc thấp tầm nhân vật', GOC_THAP));
}
console.log(JSON.stringify({ phimId, dot, xong: ra.filter((x) => x.url).length, ra }));
process.exit(0);
