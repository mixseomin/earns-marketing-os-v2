// SERIES "TANGO & LINT" — BÀN LÀM VIỆC (stop-motion, 14/10/2026): một nhân vật tí hon sống trên bàn làm việc thật của anh, phim không lời kiểu Larva.
// Bước 1 — BỐI CẢNH TRƯỚC, nhân vật sau (anh chốt): dựng phim + mỗi bối cảnh một anchor 'boi_canh' có ảnh thật của anh làm tham chiếu,
// rồi sinh ảnh gốc từng bối cảnh ở tầm mắt nhân vật 5 cm. TỐN TIỀN: mỗi bối cảnh 1 ảnh (~$0.034 Nano Banana).
// 20 bối cảnh: đồ vật, độ cao (đỉnh màn hình, từ trên xuống), giờ trong ngày (đêm, sáng sớm). Chạy lại an toàn: phim tìm theo tên, bối cảnh đã có ảnh sinh thì bỏ qua (--lai: sinh thêm một ảnh cho mọi bối cảnh).
// CÁC ĐỢT (mỗi lần chạy một đợt, kiểm đợt trước rồi mới chạy đợt sau):
//   --dot=boi_canh  (mặc định) 20 bối cảnh gốc · cần đường dẫn ảnh bàn thật lần đầu
//   --dot=bien_the  mỗi bối cảnh 2 biến thể thời điểm (ban đêm, sáng sớm) — hệ biến thể của studio (xv_bien_the)
//   --dot=do_vat    đồ vật trên bàn thành anchor đạo cụ: ảnh gốc + 1 biến thể góc thấp tầm mắt nhân vật
//   --dot=nhan_vat  dàn nhân vật (Tango, Lint, Clicky, Mr. Wipe, Cordy, Sticky): anchor + tiểu sử + character sheet
//                   (chạy lại không tốn tiền: chỉ cập nhật ngoại hình + tiểu sử; --chon=<phuong_an> --chi=<tên>: gắn ảnh thử đã chọn làm sheet)
//   --dot=bo_anh_that  gỡ ảnh gốc của anh khỏi mọi anchor (vào thùng rác) — anh không cho dùng ảnh gốc
//   --chi=Tên A,Tên B --lai: chỉ sinh lại mấy mục này
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
import { boAnhVaoThungRac } from '../src/lib/xuong-video/thung-rac';

const TEN_PHIM = 'Series · Tango & Lint (bàn làm việc, stop-motion)';
const TEN_CU = ['Series · Bàn làm việc (stop-motion)'];   // tên trước 14/10/2026 — tìm phim theo cả tên cũ rồi đổi (so từng tên: mảng text làm postgres-js báo malformed array)
const PHONG_CACH = 'Real-world miniature stop-motion film: shot on a real home-office desk with a macro lens at tabletop height, as seen by a 5 cm tall character; shallow depth of field with soft bokeh; real materials and textures (warm wood grain, matte white plastic, brushed aluminium, paper); cozy warm desk-lamp light mixed with cool blue monitor glow; slightly handmade stop-motion feel with tactile detail; vertical 9:16 frame. Clean frames with no text, letters, numbers or logos anywhere';
const KINH_THANH = {
  phong_cach: PHONG_CACH, ti_le: '9:16', ngon_ngu: 'en', the_loai: 'hoat_hinh', do_phan_giai: '720p',
  mo_hinh_anh: 'gemini-nano-banana-2.1', mo_hinh_chu: 'claude-opus-5-5', mo_hinh_video: 'fal:fal-ai/veo3.1/lite/image-to-video',
  logline: 'Tango, a reckless lump of living orange clay, and Lint, a timid dust bunny, turn a busy home-office desk into a world of wordless adventures — while Mr. Wipe the cleaning cloth tries to wipe them away.',
  series: { ten: 'Tango & Lint', dong_co: '', khan_gia: 'mọi lứa tuổi, toàn cầu — phim không lời', dinh_dang: 'Shorts 9:16, 40–60 giây/tập, hài hành động không lời kiểu Larva', tap: [] },
};
/** DÀN NHÂN VẬT (anh chốt 14/10/2026). mo_ta = đặc tính NHÌN THẤY (vào prompt hình); tieu_su = kiểu Marvel (nguồn gốc, sức mạnh, điểm yếu…)
 *  cho Claude viết kịch bản + làm nền tập phim về chính nhân vật; phuong_an = ảnh thử (scripts/thu-nhan-vat.mts) làm tham chiếu tạo hình. */
const NHAN_VAT: { ten: string; phuong_an: string; mo_ta: string; tieu_su: string }[] = [
  { ten: 'Tango', phuong_an: 'dat_set_cam',
    mo_ta: 'A small round egg-shaped creature made of soft matte ORANGE modelling clay, about 5 cm tall, no neck, two big round white googly eyes with black pupils, tiny stubby clay arms and legs, faint fingerprint texture in the clay, a slightly deeper thumbprint dent on his back, and ONE thin curly strand of slightly darker orange clay springing from the very top of his head like a little antenna.',
    tieu_su: `Origin: a leftover lump of orange modelling clay from the Giant's craft day. One stormy night the charging cable sparked beside him and the jolt brought him to life — the thumbprint on his back is the Giant's, his "birthmark".
Personality: curious, reckless, endlessly optimistic, impatient; he acts first and thinks later — he is the one who starts every adventure (and every mess).
Power: he can squash, stretch and reshape his clay body — roll into a ball, flatten into a sled, stretch an arm into a hook or a rope.
Weakness: heat from the desk lamp slowly dries him stiff; water makes him soft and mushy; reshaping too much leaves him exhausted and lumpy.
Wants: to climb "the Summit" — the top of the iMac — and see what lies beyond the glowing screen.
Fears: being rolled up and shut back inside the clay tub in the drawer.
Relationships: best friend and protector of Lint; rides Clicky; prank rival of Cordy; Sticky's partner in plans; sworn enemy of Mr. Wipe.
Hair: the single curly strand on his head is exactly where the spark struck — it stands straight up like an antenna when electricity or danger is near, and twangs "boing" when he gets an idea.
Loves (signature): gummy bears — he hugs them, hoards them and chases one in almost every episode.
Hates: water drops — one drip from the Giant's cold drink sends him running.
Quirk: he presses his thumbprint on everything he is proud of, like signing his name.
Secret: when he gets scared he leaves tiny orange crumbs behind — a trail his enemies can follow.` },
  { ten: 'Lint', phuong_an: 'bui_long',
    mo_ta: 'A small fluffy dust-bunny creature made of soft GREY felt and fuzz, about 5 cm tall, a round puffball body with wispy fibres sticking out, two big round shiny black eyes, tiny felt feet poking out underneath, no arms, and ONE bright blue thread poking out of the fuzz on top of his head.',
    tieu_su: `Origin: born in the dark cable jungle behind the monitors from years of dust, fluff and a single blue thread from the Giant's sweater — the first dust bunny ever to open its eyes.
Personality: shy, gentle, anxious and fiercely loyal; he hides at the first sign of danger but becomes surprisingly brave when a friend is in trouble.
Power: almost weightless — he floats on the warm air from the computer vents, bounces like a ball, and puffs up to three times his size when frightened; small things stick to his fuzz.
Weakness: Mr. Wipe and anything that cleans; a big sneeze blows him apart (he slowly gathers himself back together); water flattens him.
Wants: a safe, cozy home that will never, ever be cleaned.
Fears: being wiped away — for a dust bunny that means disappearing forever.
Relationships: Tango drags him into adventures and always protects him; Sticky draws him pictures to calm him; Mr. Wipe hunts him.
Mark: the bright blue thread poking out of his fuzz — when it glows faintly, the magic that keeps him alive is working.
Loves (signature): cotton balls — he keeps one as his teddy and pillow and never goes anywhere without it.
Hates: the "pssht" of a spray bottle (cleaning is coming) and the roar of the vacuum.
Quirk: when nervous he hides inside anything round — a cup, a bottle cap, Tango's hands.
Secret: the blue thread inside him is the last piece of the Giant's favourite sweater — and it is what makes him alive.` },
  { ten: 'Clicky', phuong_an: 'chuot_song',
    mo_ta: 'The white Magic Mouse brought to life: a smooth glossy white shell like a gentle turtle or beetle, two small kind black eyes on its front edge, a soft glow underneath its body, a short dark scratch scar across the right side of its shell, big enough for Tango to ride on its back.',
    tieu_su: `Origin: the Giant's wireless mouse, left on overnight with its battery at 1%. In the half-sleep of low power it woke up and found it could move on its own.
Personality: a gentle giant — sleepy, loyal, playful as a puppy; it talks only with soft clicks and the colour of its belly glow (green = happy, amber = sleepy, red = alarm).
Power: glides fast and silently across the desk; its belly light becomes a searchlight in the dark; one double-click can launch Tango into the air.
Weakness: low battery — it slows down and falls asleep mid-adventure until Cordy gives it a charge; it panics when the Giant's hand comes near.
Wants: to be gently scratched on its back like a pet.
Fears: being replaced by a new mouse and thrown in a drawer.
Relationships: Tango's ride and loyal steed; best buddy of Cordy, who charges it; Lint likes to nap on its warm shell.
Mark: a dark scratch across its right side from "the Great Fall" — the night it slid off the desk edge and lay alone on the floor until the Giant found it in the morning. Since then it brakes hard at every edge.
Loves (signature): fresh AA batteries — its favourite treat, like a dog's bone; it does a happy spin when it gets one.
Hates: the laptop trackpad, the rival that could replace it.
Quirk: it chases any blinking light like a cat chasing a laser dot.
Secret: it remembers every place the Giant ever clicked — a map of the whole desk inside its head.` },
  { ten: 'Mr. Wipe', phuong_an: 'gie_lau',
    mo_ta: 'A villain made from a grey-blue microfiber screen-cleaning cloth: a floppy fabric creature that can billow up like a looming ghost, two narrow angry button eyes, fabric edges that flap like arms, and a faded brown coffee-ring stain on one corner.',
    tieu_su: `Origin: a microfiber cleaning cloth that spent years wiping the Giant's screens. Every speck of dust he ever touched made him greyer — until one day he decided dust itself was the enemy.
Personality: an obsessive neat-freak — dramatic, arrogant, theatrical; secretly very lonely.
Power: billows and swoops like a ghost, wraps around things, and uses static cling to pull dust (and Lint) towards him.
Weakness: water makes him soggy, heavy and slow; he gets tangled in cables; heights and the desk edge terrify him.
Wants: a perfectly spotless desk — which means wiping away Lint for good.
Fears: the washing machine.
Relationships: arch-enemy of Lint and Tango; tries to boss Clicky and Cordy around; Sticky keeps outsmarting him.
Mark: a brown coffee-ring stain on one corner — the day the Giant used him to mop up spilled coffee and no wash ever got it out. It is his shame, the reason he can never stand a mess.
Loves (signature): his little blue bottle of screen-cleaner spray — he hugs it like a teddy and sniffs its "clean" smell.
Hates: fingerprints — and Tango leaves clay fingerprints everywhere.
Quirk: he straightens everything he passes into perfect right angles.
Secret: he was white when he was new — and deep in one fold he keeps a single tiny piece of dust he has never been able to throw away.` },
  { ten: 'Cordy', phuong_an: 'ran_cap',
    mo_ta: "The long white charging cable as a playful snake-like creature: its metal plug is the head with two tiny dot eyes and a small smile, a smooth white cable body that curls and coils across the desk, with a short wrap of black electrical tape around the cable just below the plug like a bandage.",
    tieu_su: `Origin: the iMac's charging cable — the cable whose spark brought Tango to life. That same spark woke Cordy up too.
Personality: playful, cheeky, a prankster who can never sit still; he "talks" with little sparks and zaps.
Power: his long body becomes a bridge, a rope, a zipline or a slide; he can give a small charge to wake Clicky or power any gadget on the desk.
Weakness: knots and tangles; sharp bends hurt him; his plug only fits the right port.
Wants: to find the one perfect port that feels like home.
Fears: scissors, and being coiled up and forgotten in a drawer.
Relationships: Clicky's best friend and charger; loves teasing Tango; ties Mr. Wipe in knots.
Mark: a wrap of black electrical tape just below his plug — where the Giant's scissors nicked him while tidying cables. Tango and Sticky bandaged him; that is why he fears scissors.
Loves (signature): the satisfying "click" of plugging into a perfect port, and the charging chime "ding".
Hates: twist ties and knots.
Quirk: instead of talking he ties himself into shapes — a heart, an arrow, a question mark.
Secret: he feels guilty that his spark made the desk come alive — and he does not know if it can happen again.` },
  { ten: 'Sticky', phuong_an: 'giay_note',
    mo_ta: 'A bright yellow sticky-note paper character: a square paper body folded into a little figure with paper arms, two drawn-on ink dot eyes, one corner curled up like a cowlick, and a jagged torn edge on her left side patched with a strip of clear shiny tape.',
    tieu_su: `Origin: peeled from the Giant's sticky-note pad in a hurry and dropped behind the keyboard; she woke up with a message written on her back that she can never read.
Personality: cheerful, clever, chatty (in pictures), the problem-solver of the group.
Power: she folds herself into anything — a paper boat, plane, umbrella, sail or sign — and sticks to any wall; she "talks" by drawing little doodles on herself.
Weakness: her stickiness slowly wears off; wind blows her away; water and tearing are deadly.
Wants: to find out what the writing on her back says.
Fears: being crumpled into a ball and thrown in the bin.
Relationships: plans the adventures with Tango; draws comfort pictures for Lint; outwits Mr. Wipe every time.
Scar: a jagged tear on her left side, patched with clear tape. On her first day alive the Giant crumpled her toward the bin; she tore herself free on the rim of a coffee cup, and Tango — just born himself — patched her with tape from the dispenser. That was the start of their friendship. The scar itches when rain is coming or a friend is in danger.
Loves (signature): highlighter pens — she paints herself in bright colours with them for special occasions.
Hates: the growl of the paper shredder.
Quirk: she doodles everyone's mood on her body before they even show it.
Secret: the message on her back is a reminder the Giant wrote — about the day the desk will be cleared.` },
];
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
  { ten: 'Đỉnh màn hình iMac', mo_ta: 'Camera placed on the top edge of the thin iMac, level horizon, looking forward and down over the edge at the desk far below — keyboard, mouse, cables and notebooks look tiny like a valley seen from a mountain ridge; the thin aluminium top edge of the iMac fills the bottom of the frame' },
  { ten: 'Sân đế màn hình trái', mo_ta: 'The flat silver foot of the left monitor stand seen at ground level: a wide smooth metal plaza with the stand column rising like a tower, notebooks stacked beside it' },
  { ten: 'Khe giữa hai màn hình', mo_ta: 'The narrow gap between the two monitors seen from the desk: two tall glowing walls of light on the left and right, a dark corridor between them leading to the wall behind' },
  { ten: 'Bến đế cắm', mo_ta: 'Close at ground level beside the silver USB hub resting on its orange card, the white cable plugged into it, like a small silver building on an orange platform' },
  { ten: 'Đường dây cáp trắng', mo_ta: 'The white iMac cable lying across the wooden desk seen from ground level, curving away into the distance like a white road or river across a wooden plain' },
  { ten: 'Hang dưới bàn phím', mo_ta: 'Camera on the desk surface looking into the narrow dark gap under the raised back edge of the white keyboard: a low wide cave mouth, the keyboard underside as the cave ceiling, warm light glowing at the far end' },
  { ten: 'Vách sách mép trái', mo_ta: 'The pile of magazines and books at the far left edge of the desk seen from below like a tall layered cliff of colorful paper spines' },
  { ten: 'Quả cầu loa đen', mo_ta: 'A small round black smart speaker behind the left monitor seen from ground level like a giant dark planet sitting on the desk, cables around it' },
  { ten: 'Toàn bàn ban đêm', mo_ta: 'The same desk at night: room dark, only the two screens glow dim blue, the keyboard and mouse catch faint cool light, long soft shadows' },
  { ten: 'Toàn bàn sáng sớm', mo_ta: 'The same desk early in the morning: screens off and black, warm golden sunlight streaming across the wooden desk from the side, dust specks floating in the light beams' },
  { ten: 'Trang sổ mở', mo_ta: 'An open paper notebook lying on the desk seen from page level: a wide white field of lined paper, the spiral binding rising like a fence, a pen lying across like a fallen log' },
  { ten: 'Bản đồ bàn từ trên xuống', mo_ta: 'Top-down view looking straight down at the whole desk like a map: the keyboard, mouse, two monitor stands, cables, notebooks and hub laid out on the warm wooden surface' },
];
const NHAC = 'Real desk reference: keep exactly the same objects, materials, colors and lighting as the real desk in the reference photo. IGNORE and REPLACE whatever the screens show in the reference photo: every screen displays ONLY a plain smooth blue-to-purple gradient glow — no people, no performers, no video thumbnails, no web pages, no app windows, no logos, no text. No people, no hands, no characters anywhere in the frame';

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
const dot = (process.argv.find((x) => x.startsWith('--dot='))?.slice(6) ?? 'boi_canh') as 'boi_canh' | 'bien_the' | 'do_vat' | 'bo_anh_that' | 'nhan_vat';
const tep = process.argv.slice(2).filter((x) => !x.startsWith('--'));
/** --chi=Tên A,Tên B: chỉ sinh lại các bối cảnh / đồ vật này (kèm --lai). */
const chi = process.argv.find((x) => x.startsWith('--chi='))?.slice(6).split(',').map((x) => x.trim()).filter(Boolean) ?? null;
const trong = <T extends { ten: string }>(ds: T[]) => (chi ? ds.filter((x) => chi.includes(x.ten)) : ds);
/** Chạy tối đa 5 việc sinh cùng lúc (Gemini giới hạn tốc độ). */
async function theoDot<T>(ds: T[], f: (x: T) => Promise<void>, cung = 5) { for (let i = 0; i < ds.length; i += cung) await Promise.all(ds.slice(i, i + cung).map(f)); }
const anhRa = (u: string) => !u.includes('/ref/');   // ảnh đã sinh (ảnh thật nằm ở xuong-video/ref/)

let phim = (await q(sql`SELECT id FROM xv_phim WHERE ten = ${TEN_PHIM} OR ten = ${TEN_CU[0]} ORDER BY id LIMIT 1`))[0];
if (phim) await q(sql`UPDATE xv_phim SET ten = ${TEN_PHIM}, kinh_thanh = kinh_thanh || ${JSON.stringify({ logline: KINH_THANH.logline, series: KINH_THANH.series })}::jsonb, updated_at = now() WHERE id = ${Number(phim.id)} AND ten <> ${TEN_PHIM}`);
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
if (!anhThat.length && dot === 'boi_canh' && !lai) { console.error('cần đường dẫn ảnh bàn thật (lần đầu)'); process.exit(1); }

const ra: { ten: string; url: string | null; loi?: string }[] = [];
/** Sinh một ảnh gốc cho anchor (job gắn nhan_vat_id → hoanTatAnh đưa ảnh lên ĐẦU anh_ref, ảnh thật giữ sau). */
async function anhGoc(loai: 'boi_canh' | 'dao_cu', ten: string, mo_ta: string, prompt: string) {
  let v = (await q(sql`SELECT id, anh_ref FROM xv_nhan_vat WHERE phim_id = ${phimId} AND loai = ${loai} AND ten = ${ten} LIMIT 1`))[0];
  if (!v) v = (await q(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, anh_ref) VALUES (${phimId}, ${loai}, ${ten}, ${mo_ta}, ${JSON.stringify(loai === 'boi_canh' ? anhThat : [])}::jsonb) RETURNING id, anh_ref`))[0]!;
  if (((v.anh_ref as string[]) ?? []).some(anhRa) && !lai) { ra.push({ ten, url: null, loi: 'đã có ảnh — bỏ qua' }); return; }
  await q(sql`UPDATE xv_nhan_vat SET mo_ta = ${mo_ta}, updated_at = now() WHERE id = ${Number(v.id)} AND mo_ta <> ${mo_ta}`);   // mô tả trong script là bản đúng
  // Không có ảnh thật (anh không cho dùng ảnh gốc) → sinh lại bám chính ảnh đã sinh của mục này.
  const ref = anhThat.length ? anhThat : ((v.anh_ref as string[]) ?? []).filter(anhRa).slice(0, 1);
  const job = await taoJob(db, { nhan_vat_id: Number(v.id), nhan: `Ảnh gốc · ${loai === 'boi_canh' ? 'bối cảnh' : 'đồ vật'} ${ten}`, loai: 'anh', provider: 'google', model: KINH_THANH.mo_hinh_anh, request: { prompt, thamChieuUrl: ref } });
  const kq = await chayViecAnh({ job, model: KINH_THANH.mo_hinh_anh, prompt, thamChieuUrl: ref, tiLe: loai === 'boi_canh' ? '9:16' : '1:1', thuMuc: `anchor/${Number(v.id)}` });
  await hoanTatAnh(kq);
  // Sinh lại (--lai) thành công → ảnh sinh cũ vào THÙNG RÁC (khôi phục được ở 🗑), kẻo nó nằm thứ hai trong anh_ref và làm tham chiếu cho
  // biến thể / keyframe (4 cảnh đầu lọt nội dung màn hình gốc, 14/10/2026).
  if (kq.ok) for (const u of ((v.anh_ref as string[]) ?? []).filter(anhRa)) await boAnhVaoThungRac(db, 'anh_goc', Number(v.id), u, 'claude (script sinh lại)');
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

if (dot === 'boi_canh') await theoDot(trong(BOI_CANH), (b) => anhGoc('boi_canh', b.ten, b.mo_ta, `Establishing shot of a location for a miniature stop-motion film, no characters. Location: ${b.mo_ta}. ${NHAC}. Visual style: ${PHONG_CACH}.`));
if (dot === 'bien_the') await theoDot(trong(BOI_CANH).filter((b) => !/ban đêm|sáng sớm/i.test(b.ten)).flatMap((b) => THOI_DIEM.map((t) => ({ b, t }))), ({ b, t }) => bienThe('boi_canh', b.ten, 'thoi_diem', t.ten, t.mo_ta));
// Anh 14/10/2026: ảnh gốc anh gửi KHÔNG dùng làm ảnh của anchor (màn hình trong ảnh có người thật). Gỡ khỏi mọi anchor → thùng rác 🗑.
if (dot === 'bo_anh_that') {
  for (const v of await q(sql`SELECT id, anh_ref FROM xv_nhan_vat WHERE phim_id = ${phimId}`))
    for (const u of ((v.anh_ref as string[]) ?? []).filter((x) => !anhRa(x))) { await boAnhVaoThungRac(db, 'anh_goc', Number(v.id), u, 'claude (bỏ ảnh gốc theo lời anh)'); ra.push({ ten: `anchor ${v.id}`, url: u }); }
}
if (dot === 'do_vat') {
  // Tham chiếu = ảnh bối cảnh ĐÃ SINH (toàn cảnh + bản đồ từ trên xuống), không phải ảnh gốc của anh.
  anhThat = [];
  for (const ten of ['Toàn cảnh bàn', 'Bản đồ bàn từ trên xuống']) {
    const u = (((await q(sql`SELECT anh_ref FROM xv_nhan_vat WHERE phim_id = ${phimId} AND loai = 'boi_canh' AND ten = ${ten} LIMIT 1`))[0]?.anh_ref as string[]) ?? []).find(anhRa);
    if (u) anhThat.push(u);
  }
  await theoDot(trong(DO_VAT), (d) => anhGoc('dao_cu', d.ten, d.mo_ta, `Prop reference shot for a miniature stop-motion film: ${d.mo_ta}, photographed in place on the same warm wooden desk as in the reference images, centered, macro lens, shallow depth of field, no characters. Keep the object's shape, color and material exactly as it appears in the reference images. ${NHAC}. Visual style: ${PHONG_CACH}.`));
  await theoDot(trong(DO_VAT), (d) => bienThe('dao_cu', d.ten, 'goc_may', 'Góc thấp tầm nhân vật', GOC_THAP));
}
// Dàn nhân vật: anchor 'nhan_vat' (tên + đặc tính + tiểu sử) + character sheet, ảnh thử của phương án làm tham chiếu tạo hình.
if (dot === 'nhan_vat') await theoDot(trong(NHAN_VAT), async (n) => {
  const thu = (await q(sql`SELECT output_url FROM xv_job WHERE phim_id = ${phimId} AND request->>'dich' = 'thu_nhan_vat' AND request->>'phuong_an' = ${n.phuong_an} AND trang_thai = 'xong' ORDER BY id DESC LIMIT 1`))[0]?.output_url as string | undefined;
  if (!thu) { ra.push({ ten: n.ten, url: null, loi: 'chưa có ảnh thử phương án' }); return; }
  let v = (await q(sql`SELECT id, anh_ref FROM xv_nhan_vat WHERE phim_id = ${phimId} AND loai = 'nhan_vat' AND ten = ${n.ten} LIMIT 1`))[0];
  if (!v) v = (await q(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, tieu_su, anh_ref) VALUES (${phimId}, 'nhan_vat', ${n.ten}, ${n.mo_ta}, ${n.tieu_su}, ${JSON.stringify([thu])}::jsonb) RETURNING id, anh_ref`))[0]!;
  else await q(sql`UPDATE xv_nhan_vat SET mo_ta = ${n.mo_ta}, tieu_su = ${n.tieu_su}, updated_at = now() WHERE id = ${Number(v.id)}`);
  const sheetCu = ((v.anh_ref as string[]) ?? []).filter((u) => u.includes('/anchor/'));
  const chon = process.argv.find((x) => x.startsWith('--chon='))?.slice(7);   // --chon=<phuong_an>: gắn ảnh thử đã chọn làm sheet, không sinh (0đ)
  if (chon) {
    const u = (await q(sql`SELECT output_url FROM xv_job WHERE phim_id = ${phimId} AND request->>'dich' = 'thu_nhan_vat' AND request->>'phuong_an' = ${chon} AND trang_thai = 'xong' ORDER BY id DESC LIMIT 1`))[0]?.output_url as string | undefined;
    if (!u) { ra.push({ ten: n.ten, url: null, loi: `không có ảnh thử ${chon}` }); return; }
    await q(sql`UPDATE xv_nhan_vat SET anh_ref = ${JSON.stringify([u])}::jsonb || anh_ref, updated_at = now() WHERE id = ${Number(v.id)}`);
    for (const c of sheetCu) await boAnhVaoThungRac(db, 'anh_goc', Number(v.id), c, 'claude (thay sheet đã chọn)');
    ra.push({ ten: n.ten, url: u }); return;
  }
  if (sheetCu.length && !lai) { ra.push({ ten: n.ten, url: null, loi: 'đã có character sheet — bỏ qua' }); return; }
  const prompt = `Character design reference sheet for a handmade stop-motion puppet, on a plain light warm-grey background: full-body turnaround (front, three-quarter, side, back) in a neutral pose, plus a row of close-ups showing neutral, happy, scared and angry expressions; identical design in every view. ONLY this one character: ${n.mo_ta} ${sheetCu.length ? 'It is the SAME character as in the reference sheet — keep its body, colors, materials and eyes identical; add every detail of the description that the reference is missing.' : ''} Use the reference image only for this character's exact design (shape, colors, materials, eyes) — ignore every other character and the background in it. Real handmade materials, soft studio light, macro lens. No text, letters or labels anywhere.`;
  const ref = sheetCu.length ? sheetCu.slice(0, 1) : [thu];
  const job = await taoJob(db, { nhan_vat_id: Number(v.id), nhan: `Character sheet · ${n.ten}`, loai: 'anh', provider: 'google', model: KINH_THANH.mo_hinh_anh, request: { prompt, thamChieuUrl: ref } });
  const kq = await chayViecAnh({ job, model: KINH_THANH.mo_hinh_anh, prompt, thamChieuUrl: ref, tiLe: '1:1', thuMuc: `anchor/${Number(v.id)}` });
  await hoanTatAnh(kq);
  if (kq.ok) for (const c of sheetCu) await boAnhVaoThungRac(db, 'anh_goc', Number(v.id), c, 'claude (script sinh lại sheet)');
  ra.push({ ten: n.ten, url: kq.ok ? kq.url : null, ...(kq.ok ? {} : { loi: kq.loi }) });
});
console.log(JSON.stringify({ phimId, dot, xong: ra.filter((x) => x.url).length, ra }));
process.exit(0);
