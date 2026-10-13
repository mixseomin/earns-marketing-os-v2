// THỬ TẠO HÌNH NHÂN VẬT cho một phim — TỐN TIỀN (mỗi phương án 1 ảnh ~$0.034): mỗi phương án đặt NGAY trong một bối cảnh đã sinh của phim
// (ảnh gốc của anchor bối cảnh làm tham chiếu) để thấy nhân vật có nổi, có hợp thế giới không. Ảnh thử không tạo anchor (job ghi sổ phim).
// Phương án của series Bàn làm việc (14/10/2026) khai ngay dưới; phim khác thì thêm bộ khác.
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

const db = getDb()!;
const phimId = Number(process.argv[2]); const tenBc = process.argv[3] ?? '';
const p = (await db.execute(sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${phimId}`) as unknown as Row[])[0];
if (!p) { console.error('không thấy phim'); process.exit(1); }
const kt = docKinhThanh(p.kinh_thanh as KinhThanh);
const bc = (await db.execute(sql`SELECT anh_ref->>0 AS u FROM xv_nhan_vat WHERE phim_id = ${phimId} AND loai = 'boi_canh' AND ten = ${tenBc} LIMIT 1`) as unknown as Row[])[0]?.u as string | undefined;
if (!bc) { console.error('không thấy ảnh bối cảnh', tenBc); process.exit(1); }
const ra: { key: string; ten: string; url: string | null; loi?: string }[] = [];
await Promise.all(PHUONG_AN.map(async (a) => {
  const prompt = `Character concept frame for a wordless stop-motion film. A handmade stop-motion puppet character: ${a.mo_ta}. It stands full body in the middle of the frame on the wooden desk shown in the reference image, about 5 cm tall (roughly the height of two keyboard keys), seen at its own eye level with a macro lens and shallow depth of field, a lively expressive pose that shows its personality. Keep the desk world exactly as in the reference image. Every screen shows only a plain smooth gradient glow. No people, no hands. Visual style: ${phongCachHinh(kt.phong_cach).replace(/[.\s]+$/, '')}.`;
  const job = await taoJob(db, { phim_id: phimId, nhan: `Thử nhân vật · ${a.ten}`, loai: 'anh', provider: 'google', model: kt.mo_hinh_anh, request: { dich: 'thu_nhan_vat', phuong_an: a.key, prompt, thamChieuUrl: [bc] } });
  const kq = await chayViecAnh({ job, model: kt.mo_hinh_anh, prompt, thamChieuUrl: [bc], tiLe: kt.ti_le, thuMuc: `thu-nhan-vat/${phimId}-${a.key}` });
  await hoanTatAnh(kq);
  ra.push({ key: a.key, ten: a.ten, url: kq.ok ? kq.url : null, ...(kq.ok ? {} : { loi: kq.loi }) });
}));
console.log(JSON.stringify(ra.sort((x, y) => PHUONG_AN.findIndex((a) => a.key === x.key) - PHUONG_AN.findIndex((a) => a.key === y.key))));
process.exit(0);
