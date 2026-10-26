// TẠO LÔ PHIM QC ETHOPEX vào studio (0đ — chỉ ghi DB), ĐỦ QUY TRÌNH để qua cổng studio ngay (bài học lô 19/10: 9 phim phải vá tay từng cổng):
// mỗi phim trong <lo.json> → xv_phim (quang_cao, project ethopex, 1080p, brief) + anchor "Cast" (ảnh mẫu = poster) + anchor Bối cảnh (studio tự sinh ảnh)
// + xv_tap (khung truyện 4 nhịp + phân cảnh) + 6 cảnh kể ngôi thứ nhất (chữ ngắn, máy chạy, khối diễn, nguồn = QC thật của app gốc) + cảnh 7 thẻ cuối.
// Thẻ cuối: gắn ảnh + clip dựng từ poster (0đ) trước khi chạy pipeline để không sinh AI. Sinh hình/clip/giọng/xuất: scripts/tu-lam-phim.mts <tap_id>.
// JSON mỗi phim cần: content_id, ten, lang, nguon, giong, poster, url, nhan_vat, qc_goc {ma,page,ngay}, boi_canh {ten,mo_ta}, canh[6] {loi, anh, dong}.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/ethopex/tao-lo.mts scripts/ethopex/<lo>.json
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { khuonQcPhim, BEATS_QC_PHIM, PHAN_CANH_QC_PHIM, shotQc, thamKhaoQcGoc, briefQcPhim, nenCua, type QcGoc } from './khuon-qc-phim';

type Canh = { loi: string; anh: string; dong: string; co_canh?: string; chuyen_dong?: string };   // co_canh / chuyen_dong: đạo diễn khai tay (vào bối cảnh mới = ws…), thiếu thì shotQc chia
// the_cuoi_anh: tả riêng khung thẻ cuối khi poster gốc hở hang / gợi dục (cổng chấm Meta khoa_than) — mặc định "key art theo poster"
type Phim = { content_id: number; ten: string; lang: 'en' | 'es'; nguon: string; giong: string; poster: string; url: string; nhan_vat: string; qc_goc?: QcGoc; boi_canh?: { ten: string; mo_ta: string }; canh: Canh[]; the_cuoi_anh?: string };
// khuon.giay_canh (mặc định 3s) + khuon.mo_hinh_video: QC kể chuyện dài 2–3' (anh 21/10/2026) dùng ~20 shot 8s
const lo = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as { ghi_chu: string; khuon: { the_cuoi: Record<string, string>; giay_canh?: number; mo_hinh_video?: string }; phim: Phim[] };
const GIAY = lo.khuon.giay_canh ?? 3;
const db = getDb()!;
const PHONG_CACH = 'Photorealistic cinematic vertical short drama (US micro-drama look), real actors, dramatic warm lighting, shallow depth of field, glossy high-end color grade, emotional close-ups; no text, no watermark, no logo in frame.';
const j = (x: unknown) => JSON.stringify(x);
const ra: { content_id: number; phim: number; tap: number }[] = [];
for (const p of lo.phim) {
  if (!p.qc_goc) { console.log(`✗ ${p.ten}: thiếu qc_goc (QC thật của app gốc) — studio đòi nguồn tham khảo, bỏ qua`); continue; }
  const co = (await db.execute(sql`SELECT id FROM xv_phim WHERE project = 'ethopex' AND (kinh_thanh->'ethopex'->>'content_id')::int = ${p.content_id} AND kinh_thanh->'ethopex'->>'lo' = ${process.argv[2]!}`)) as unknown as { id: number }[];
  if (co.length) { console.log(`· ${p.ten}: đã có phim #${co[0]!.id} — bỏ qua`); continue; }
  const poster = /^https?:/.test(p.poster) ? p.poster : `https://acdn.dofez.com/${p.poster}`;   // poster Ethopex (đường tương đối) hoặc link đầy đủ (R2)
  const k = khuonQcPhim(p.ten, p.lang, p.nguon, p.canh.map((c) => c.loi));
  const kt = {
    ti_le: '9:16', do_phan_giai: '1080p', ngon_ngu: p.lang, the_loai: 'qc_ke_chuyen', phong_cach: PHONG_CACH,
    mo_hinh_anh: 'gemini-nano-banana-2.1', mo_hinh_video: lo.khuon.mo_hinh_video ?? 'veo-3.1-lite-generate-preview',
    giong_dan: { model: 'fal-ai/elevenlabs/tts/eleven-v3', voice: p.giong }, logline: p.canh[0]!.loi,
    qc: { ten: k.qcTen, link: p.url, the_cuoi: lo.khuon.the_cuoi[p.lang] },
    ethopex: { content_id: p.content_id, nguon: p.nguon, lo: process.argv[2]!, qc_goc: p.qc_goc, khuon: 'video thắng #1: kể ngôi thứ nhất + phụ đề + thẻ cuối, hook nhanh' },
  };
  const ph = (await db.execute(sql`INSERT INTO xv_phim (project, ten, loai, mo_ta, kinh_thanh, trang_thai, poster_url)
    VALUES ('ethopex', ${`Ethopex · ${p.ten} · QC kể chuyện`}, 'quang_cao', ${`QC FB Ads dự án Ethopex → content ${p.content_id} (${p.nguon}, ${p.lang.toUpperCase()}). ${lo.ghi_chu}`},
      ${j(kt)}::jsonb, 'dang_lam', ${poster}) RETURNING id`)) as unknown as { id: number }[];
  const phimId = ph[0]!.id;
  const cast = (await db.execute(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, anh_ref)
    VALUES (${phimId}, 'nhan_vat', 'Cast', ${`Characters as on the reference poster — keep faces, hair and wardrobe exactly: ${p.nhan_vat}`}, ${j([poster])}::jsonb) RETURNING id`)) as unknown as { id: number }[];
  const bc = p.boi_canh ?? { ten: 'Story world', mo_ta: p.canh.map((c) => c.anh.split(/[,.:]/)[0]).join('; ') };
  const boi = (await db.execute(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, anh_ref) VALUES (${phimId}, 'boi_canh', ${bc.ten}, ${bc.mo_ta}, '[]'::jsonb) RETURNING id`)) as unknown as { id: number }[];
  const anchors = j([cast[0]!.id, boi[0]!.id]);
  const tap = (await db.execute(sql`INSERT INTO xv_tap (phim_id, so, ten, kich_ban, tom_tat, brief, beats, phan_canh, trang_thai)
    VALUES (${phimId}, 1, 'Bản A — hook gốc', ${p.canh.map((c, i) => `${i + 1}. ${c.loi}`).join('\n')}, ${p.canh[0]!.loi}, ${briefQcPhim(p.ten, nenCua(p.nguon), p.lang, p.canh.length)},
      ${j(BEATS_QC_PHIM)}::jsonb, ${j(PHAN_CANH_QC_PHIM)}::jsonb, 'storyboard') RETURNING id`)) as unknown as { id: number }[];
  const tapId = tap[0]!.id;
  const shots = [...p.canh.map((c, i) => ({ ...c, chu: k.chu[i]! })), { loi: k.theCuoi.loi, anh: p.the_cuoi_anh ?? k.theCuoi.anh, dong: k.theCuoi.dong, chu: k.theCuoi.chu }];
  let truocKt: { co_canh: string; chuyen_dong: string } | undefined;
  for (const [i, c] of shots.entries()) {
    const g = shotQc(i, shots.length, truocKt);
    const s = { ...g, co_canh: (c as Canh).co_canh ?? g.co_canh, chuyen_dong: (c as Canh).chuyen_dong ?? g.chuyen_dong };
    truocKt = { co_canh: s.co_canh, chuyen_dong: s.chuyen_dong };
    await db.execute(sql`INSERT INTO xv_canh (tap_id, thu_tu, canh, hanh_dong, prompt_anh, prompt_video, loi_thoai, thoai, chu_man, nhan_vat, phan_doan, ky_thuat, dan_dung, tham_khao, thoi_luong_s, trang_thai)
      VALUES (${tapId}, ${i + 1}, ${`Shot ${i + 1}${i === 0 ? ' · hook' : i === shots.length - 1 ? ' · end card' : ''}`}, ${c.anh}, ${c.anh}, ${c.dong}, ${c.loi},
        ${j([{ nhan_vat: '', loi: c.loi }])}::jsonb, ${c.chu}, ${anchors}::jsonb, ${s.phan_doan},
        ${j({ co_canh: s.co_canh, am_thanh: [], chuyen_dong: s.chuyen_dong })}::jsonb,
        ${j({ mo: c.anh.slice(0, 220), ket: c.dong, dien: c.dong, muc_dich: s.muc_dich })}::jsonb,
        ${j(thamKhaoQcGoc([c.chu, c.loi], p.qc_goc))}::jsonb, ${i === shots.length - 1 ? 3 : GIAY}, 'nhap')`);
  }
  ra.push({ content_id: p.content_id, phim: phimId, tap: tapId });
  console.log(`✓ ${p.ten}: phim #${phimId} · tập #${tapId} · ${shots.length} cảnh (đủ quy trình)`);
}
console.log(j(ra));
process.exit(0);
