// TẠO LÔ PHIM QC ETHOPEX vào studio (0đ — chỉ ghi DB): mỗi phim trong <lo.json> → xv_phim (quang_cao, project ethopex, 1080p) + 1 anchor "Cast"
// (ảnh mẫu = poster Ethopex, giữ mặt diễn viên) + xv_tap + 6 xv_canh (lời kể ngôi thứ nhất = thoại dẫn + chữ trên màn). Sinh hình/clip/giọng/xuất
// sau đó đi đường studio: scripts/tu-lam-phim.mts <tap_id> (tốn tiền, cần anh duyệt). Phim đã tạo (trùng content_id trong lô) thì bỏ qua.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/ethopex/tao-lo.mts scripts/ethopex/lo-1910.json
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

type Canh = { loi: string; anh: string; dong: string };
type Phim = { content_id: number; ten: string; lang: 'en' | 'es'; nguon: string; giong: string; poster: string; url: string; nhan_vat: string; canh: Canh[] };
const lo = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as { ghi_chu: string; khuon: { the_cuoi: Record<string, string> }; phim: Phim[] };
const db = getDb()!;
const PHONG_CACH = 'Photorealistic cinematic vertical short drama (US micro-drama look), real actors, dramatic warm lighting, shallow depth of field, glossy high-end color grade, emotional close-ups; no text, no watermark, no logo in frame.';
const ra: { content_id: number; phim: number; tap: number }[] = [];
for (const p of lo.phim) {
  const co = (await db.execute(sql`SELECT id FROM xv_phim WHERE project = 'ethopex' AND (kinh_thanh->'ethopex'->>'content_id')::int = ${p.content_id} AND kinh_thanh->'ethopex'->>'lo' = ${process.argv[2]!}`)) as unknown as { id: number }[];
  if (co.length) { console.log(`· ${p.ten}: đã có phim #${co[0]!.id} — bỏ qua`); continue; }
  const poster = `https://acdn.dofez.com/${p.poster}`;
  const kt = {
    ti_le: '9:16', do_phan_giai: '1080p', ngon_ngu: p.lang, the_loai: 'qc_ke_chuyen', phong_cach: PHONG_CACH,
    mo_hinh_anh: 'gemini-nano-banana-2.1', mo_hinh_video: 'veo-3.1-lite-generate-preview',
    giong_dan: { model: 'fal-ai/elevenlabs/tts/eleven-v3', voice: p.giong },
    logline: p.canh[0]!.loi,
    qc: { ten: `${p.ten} (Ethopex)`, link: p.url, the_cuoi: lo.khuon.the_cuoi[p.lang] },
    ethopex: { content_id: p.content_id, nguon: p.nguon, lo: process.argv[2]!, khuon: 'video thắng #1: kể ngôi thứ nhất + phụ đề + thẻ cuối, hook nhanh' },
  };
  const ph = (await db.execute(sql`INSERT INTO xv_phim (project, ten, loai, mo_ta, kinh_thanh, trang_thai, poster_url)
    VALUES ('ethopex', ${`Ethopex · ${p.ten} · QC kể chuyện (lô 19/10)`}, 'quang_cao', ${`QC FB Ads dự án Ethopex → content ${p.content_id} (${p.nguon}, ${p.lang.toUpperCase()}). ${lo.ghi_chu}`},
      ${JSON.stringify(kt)}::jsonb, 'dang_lam', ${poster}) RETURNING id`)) as unknown as { id: number }[];
  const phimId = ph[0]!.id;
  const nv = (await db.execute(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, anh_ref)
    VALUES (${phimId}, 'nhan_vat', 'Cast', ${`Characters as on the reference poster — keep faces, hair and wardrobe exactly: ${p.nhan_vat}`}, ${JSON.stringify([poster])}::jsonb) RETURNING id`)) as unknown as { id: number }[];
  const tap = (await db.execute(sql`INSERT INTO xv_tap (phim_id, so, ten, kich_ban, tom_tat, trang_thai)
    VALUES (${phimId}, 1, 'Bản A — hook gốc', ${p.canh.map((c, i) => `${i + 1}. ${c.loi}`).join('\n')}, ${p.canh[0]!.loi}, 'storyboard') RETURNING id`)) as unknown as { id: number }[];
  const tapId = tap[0]!.id;
  for (const [i, c] of p.canh.entries()) {
    await db.execute(sql`INSERT INTO xv_canh (tap_id, thu_tu, canh, hanh_dong, prompt_anh, prompt_video, loi_thoai, thoai, chu_man, nhan_vat, phan_doan, thoi_luong_s, trang_thai)
      VALUES (${tapId}, ${i + 1}, ${`Shot ${i + 1}${i === 0 ? ' · hook' : ''}`}, ${c.anh}, ${c.anh}, ${c.dong}, ${c.loi},
        ${JSON.stringify([{ nhan_vat: '', loi: c.loi }])}::jsonb, ${c.loi}, ${JSON.stringify([nv[0]!.id])}::jsonb, ${i === 0 ? 'hook' : 'than'}, 8, 'nhap')`);
  }
  ra.push({ content_id: p.content_id, phim: phimId, tap: tapId });
  console.log(`✓ ${p.ten}: phim #${phimId} · tập #${tapId} · ${p.canh.length} cảnh`);
}
console.log(JSON.stringify(ra));
process.exit(0);
