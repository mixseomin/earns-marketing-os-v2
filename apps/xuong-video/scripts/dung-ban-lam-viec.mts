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

const db = getDb()!;
const q = async (s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as Row[];
const lai = process.argv.includes('--lai');
const tep = process.argv.slice(2).filter((x) => !x.startsWith('--'));
if (!tep.length) { console.error('cần đường dẫn ảnh bàn thật'); process.exit(1); }
const anhThat: string[] = [];
for (const t of tep) {
  const u = await uploadToR2(`xuong-video/ref/ban-lam-viec-${randomUUID()}.jpg`, await readFile(t), 'image/jpeg');
  if (!u) { console.error('R2 không nhận ảnh', t); process.exit(1); }
  anhThat.push(u);
}
let phim = (await q(sql`SELECT id FROM xv_phim WHERE ten = ${TEN_PHIM} LIMIT 1`))[0];
if (!phim) {
  phim = (await q(sql`INSERT INTO xv_phim (project, ten, loai, mo_ta, kinh_thanh, trang_thai) VALUES ('studio', ${TEN_PHIM}, 'short',
    'Phim không lời kiểu stop-motion: nhân vật tí hon sống trên bàn làm việc thật, mỗi tập một câu chuyện đủ tình tiết với đồ vật trên bàn.', ${JSON.stringify(KINH_THANH)}::jsonb, 'nhap') RETURNING id`))[0]!;
  await q(sql`INSERT INTO xv_tap (phim_id, so, ten) VALUES (${Number(phim.id)}, 1, '')`);
}
const phimId = Number(phim.id);
const ra: { ten: string; url: string | null; loi?: string }[] = [];
await Promise.all(BOI_CANH.map(async (b) => {
  let v = (await q(sql`SELECT id, anh_ref FROM xv_nhan_vat WHERE phim_id = ${phimId} AND loai = 'boi_canh' AND ten = ${b.ten} LIMIT 1`))[0];
  if (!v) v = (await q(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, anh_ref) VALUES (${phimId}, 'boi_canh', ${b.ten}, ${b.mo_ta}, ${JSON.stringify(anhThat)}::jsonb) RETURNING id, anh_ref`))[0]!;
  const daSinh = ((v.anh_ref as string[]) ?? []).some((u) => !u.includes('/ref/'));
  if (daSinh && !lai) { ra.push({ ten: b.ten, url: null, loi: 'đã có ảnh sinh — bỏ qua' }); return; }
  const prompt = `Establishing shot of a location for a miniature stop-motion film, no characters. Location: ${b.mo_ta}. ${NHAC}. Visual style: ${PHONG_CACH}.`;
  const job = await taoJob(db, { nhan_vat_id: Number(v.id), nhan: `Ảnh gốc · bối cảnh ${b.ten}`, loai: 'anh', provider: 'google', model: KINH_THANH.mo_hinh_anh, request: { prompt, thamChieuUrl: anhThat } });
  const kq = await chayViecAnh({ job, model: KINH_THANH.mo_hinh_anh, prompt, thamChieuUrl: anhThat, tiLe: '9:16', thuMuc: `anchor/${Number(v.id)}` });
  await hoanTatAnh(kq);   // ảnh mới lên ĐẦU anh_ref của bối cảnh, ảnh thật giữ sau làm tham chiếu
  ra.push({ ten: b.ten, url: kq.ok ? kq.url : null, ...(kq.ok ? {} : { loi: kq.loi }) });
}));
console.log(JSON.stringify({ phimId, ra }));
process.exit(0);
