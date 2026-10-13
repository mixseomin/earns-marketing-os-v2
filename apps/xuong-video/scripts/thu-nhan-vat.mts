// THỬ TẠO HÌNH NHÂN VẬT cho một phim — TỐN TIỀN (mỗi phương án 1 ảnh ~$0.034): mỗi phương án đặt NGAY trong một bối cảnh đã sinh của phim
// (ảnh gốc của anchor bối cảnh làm tham chiếu) để thấy nhân vật có nổi, có hợp thế giới không. Ảnh thử không tạo anchor (job ghi sổ phim).
// Phương án của series Bàn làm việc (14/10/2026) khai ngay dưới; phim khác thì thêm bộ khác.
//   --bo=phu: dàn nhân vật phụ đứng cạnh Cam + Bụi (ảnh thử của hai đứa làm tham chiếu).
// cd apps/xuong-video && DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/thu-nhan-vat.mts <phim_id> "<tên bối cảnh>"
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { taoJob, type Row } from '../src/lib/xuong-video/doc-db';
import { chayViecAnh } from '../src/lib/xuong-video/viec-anh';
import { hoanTatAnh } from '../src/lib/xuong-video/hoan-tat';
import { docKinhThanh, phongCachHinh, type KinhThanh } from '../src/lib/xuong-video/kieu';

const PHUONG_AN: { key: string; ten: string; mo_ta: string }[] = [
  { key: 'dat_set_cam', ten: 'Cục đất sét cam', mo_ta: 'a small round blob creature made of soft matte ORANGE modelling clay (the same orange as the card on the desk), a simple egg-shaped body with no neck, two big round white googly-style eyes with black pupils, tiny stubby clay arms and legs, faint fingerprint texture in the clay; curious and mischievous' },
  { key: 'bui_long', ten: 'Bụi lông sau màn hình', mo_ta: 'a small fluffy dust-bunny creature made of soft grey felt and fuzz, a round puffball body with wispy fibres, two big round shiny black eyes, tiny felt feet poking out underneath, no arms (it bounces and rolls); shy but brave' },
  { key: 'nap_but', ten: 'Sinh vật nắp bút + kẹp giấy', mo_ta: 'a small creature built from desk supplies: its body is a glossy blue pen cap, arms and legs are bent silver paperclips, two big round white bead eyes glued on the cap, a tiny eraser as a nose; plucky inventor' },
  { key: 'de_dat_set', ten: 'Dế đất sét', mo_ta: 'a small cartoon cricket made of matte brown and green modelling clay, a rounded friendly body, two big round eyes, two long bendy antennae, simplified clay legs, little folded wings on its back; cheerful adventurer' },
];
/** Dàn phụ (anh duyệt 14/10/2026): đứng CẠNH Cam + Bụi (ảnh thử của hai đứa làm tham chiếu) để xem cả nhóm có hợp nhau không. */
const PHU: { key: string; ten: string; mo_ta: string }[] = [
  { key: 'chuot_song', ten: 'Chuột sống', mo_ta: 'the white Magic Mouse on the desk is ALIVE: a gentle pet-like creature, its smooth white shell like a turtle or beetle, two small kind eyes on its front edge, a soft glow underneath, gliding on the desk — the orange clay creature rides on its back' },
  { key: 'gie_lau', ten: 'Giẻ lau', mo_ta: 'a villain made from a grey-blue microfiber screen-cleaning cloth: a floppy fabric creature that puffs itself up like a looming ghost, two narrow angry button eyes, its fabric edges flapping like arms, sweeping toward the scared fluffy dust bunny' },
  { key: 'ran_cap', ten: 'Rắn dây cáp', mo_ta: 'the long white charging cable is a playful snake-like creature: its metal plug is the head with two tiny dot eyes, the cable body curls and coils across the desk like a friendly snake' },
  { key: 'giay_note', ten: 'Giấy note', mo_ta: 'a bright yellow sticky-note paper character that folds itself into shapes: a square paper body folded into a little figure with paper arms, two drawn-on ink dot eyes, one corner curled up like a cowlick, cheerful' },
];

const db = getDb()!;
const phimId = Number(process.argv[2]); const tenBc = process.argv[3] ?? '';
const p = (await db.execute(sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${phimId}`) as unknown as Row[])[0];
if (!p) { console.error('không thấy phim'); process.exit(1); }
const kt = docKinhThanh(p.kinh_thanh as KinhThanh);
const bc = (await db.execute(sql`SELECT anh_ref->>0 AS u FROM xv_nhan_vat WHERE phim_id = ${phimId} AND loai = 'boi_canh' AND ten = ${tenBc} LIMIT 1`) as unknown as Row[])[0]?.u as string | undefined;
if (!bc) { console.error('không thấy ảnh bối cảnh', tenBc); process.exit(1); }
const bo = process.argv.find((x) => x.startsWith('--bo='))?.slice(5) ?? 'chinh';
// Dàn phụ: thêm ảnh thử mới nhất của Cam + Bụi làm tham chiếu để cả nhóm đứng chung một khung.
const kem: string[] = [];
if (bo === 'phu') for (const k of ['dat_set_cam', 'bui_long']) {
  const u = (await db.execute(sql`SELECT output_url FROM xv_job WHERE phim_id = ${phimId} AND request->>'dich' = 'thu_nhan_vat' AND request->>'phuong_an' = ${k} AND trang_thai = 'xong' ORDER BY id DESC LIMIT 1`) as unknown as Row[])[0]?.output_url as string | undefined;
  if (u) kem.push(u);
}
const ra: { key: string; ten: string; url: string | null; loi?: string }[] = [];
const DS = bo === 'phu' ? PHU : PHUONG_AN;
await Promise.all(DS.map(async (a) => {
  const prompt = bo === 'phu'
    ? `Character concept frame for a wordless stop-motion film. A new handmade stop-motion character: ${a.mo_ta}. It is shown together with the two main characters from reference images 2 and 3 — the small round ORANGE clay blob with googly eyes and the small grey fluffy dust bunny — keep those two EXACTLY as in their reference images. All of them on the wooden desk from reference image 1, at character eye level with a macro lens and shallow depth of field, an expressive moment that shows how the new character relates to the two. Keep the desk world exactly as in reference image 1. Every screen shows only a plain smooth gradient glow. No people, no human hands. Visual style: ${phongCachHinh(kt.phong_cach).replace(/[.\s]+$/, '')}.`
    : `Character concept frame for a wordless stop-motion film. A handmade stop-motion puppet character: ${a.mo_ta}. It stands full body in the middle of the frame on the wooden desk shown in the reference image, about 5 cm tall (roughly the height of two keyboard keys), seen at its own eye level with a macro lens and shallow depth of field, a lively expressive pose that shows its personality. Keep the desk world exactly as in the reference image. Every screen shows only a plain smooth gradient glow. No people, no hands. Visual style: ${phongCachHinh(kt.phong_cach).replace(/[.\s]+$/, '')}.`;
  const job = await taoJob(db, { phim_id: phimId, nhan: `Thử nhân vật · ${a.ten}`, loai: 'anh', provider: 'google', model: kt.mo_hinh_anh, request: { dich: 'thu_nhan_vat', phuong_an: a.key, prompt, thamChieuUrl: [bc, ...kem] } });
  const kq = await chayViecAnh({ job, model: kt.mo_hinh_anh, prompt, thamChieuUrl: [bc, ...kem], tiLe: kt.ti_le, thuMuc: `thu-nhan-vat/${phimId}-${a.key}` });
  await hoanTatAnh(kq);
  ra.push({ key: a.key, ten: a.ten, url: kq.ok ? kq.url : null, ...(kq.ok ? {} : { loi: kq.loi }) });
}));
console.log(JSON.stringify(ra.sort((x, y) => DS.findIndex((a) => a.key === x.key) - DS.findIndex((a) => a.key === y.key))));
process.exit(0);
