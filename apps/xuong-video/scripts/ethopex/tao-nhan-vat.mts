// TẠO PHIM QC "NHÂN VẬT ~10s" (mẫu thắng số 3 của Ethopex) vào studio — 0đ, chỉ ghi DB. Khác bản A (kể chuyện):
//   1 cảnh liền 8s, nhân vật chính NHÌN THẲNG ỐNG KÍNH, máy đẩy chậm, khoảnh khắc sức mạnh; không lời kể / phụ đề.
//   Logo tên phim + nút CTA chồng ở khâu ghép (ghep-b.py), không vẽ trong clip.
//   Chất hình = PHIM THẬT (anh 19/10/2026: "video sinh ra cần có chất giống film hoặc phải thực hơn"): phong cách máy điện ảnh,
//   da thật, hạt phim, màu trầm — bỏ "glossy high-end color grade" của bản A (ra chất AI bóng bẩy); clip Veo 3.1 Fast thay Lite.
// Lấy từ phim bản A cùng content_id: anchor Cast (poster), bối cảnh, font poster, nguồn tham khảo (QC thật của app gốc).
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/ethopex/tao-nhan-vat.mts <nhan-vat.json> [content_id…]
// nhan-vat.json: { "<content_id>": { "anh": "<khung mở: ai, ở đâu, nhìn thẳng ống kính>", "dong": "<chuyển động 8s>", "ket": "<khung kết>" } }
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

export const PHONG_CACH_PHIM_THAT = 'Real live-action feature-film still, shot on ARRI Alexa 35 with anamorphic lenses, natural skin texture with visible pores and imperfections, subtle 35mm film grain, practical motivated lighting, realistic muted color grade, real costume fabric and props, cinematic depth of field; NOT CGI, NOT airbrushed, NOT glossy AI render; no text, no watermark, no logo in frame.';
const db = getDb()!;
const spec = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as Record<string, { anh: string; dong: string; ket: string }>;
const chon = process.argv.slice(3).map(Number);
const j = (x: unknown) => JSON.stringify(x);
const BEATS = [{ ten: 'Mở', mo_ta: 'nhân vật chính nhìn thẳng người xem — dừng lướt', cam_xuc: 2 }, { ten: 'Sức mạnh', mo_ta: 'sức mạnh / thân phận thật lộ ra ngay trên mặt nhân vật (xung đột với thế giới đã coi thường họ)', cam_xuc: 3 }, { ten: 'Chốt', mo_ta: 'logo tên phim + nút xem miễn phí (chồng ở khâu ghép)', cam_xuc: 4 }];
const PHAN_CANH = [{ ten: 'hook', an_y: '', beat: 'Mở', nhip: 'cham', muc_tieu: 'nhân vật chính nhìn thẳng ống kính, sức mạnh lộ ra, máy đẩy chậm', xung_dot: 'nhân vật vs thế giới đã coi thường mình', cam_xuc_dau: 2, cam_xuc_cuoi: 4 }];

for (const [cid, s] of Object.entries(spec)) {
  if (chon.length && !chon.includes(Number(cid))) continue;
  const goc = (await db.execute(sql`SELECT id, ten, kinh_thanh, poster_url FROM xv_phim WHERE project = 'ethopex' AND (kinh_thanh->'ethopex'->>'content_id')::int = ${Number(cid)}
    AND kinh_thanh->>'the_loai' = 'qc_ke_chuyen' ORDER BY id LIMIT 1`)) as unknown as { id: number; ten: string; kinh_thanh: Record<string, any>; poster_url: string }[];
  if (!goc.length) { console.log(`✗ content ${cid}: chưa có phim bản A để lấy anchor / nguồn`); continue; }
  const g = goc[0]!;
  const co = (await db.execute(sql`SELECT id FROM xv_phim WHERE project = 'ethopex' AND (kinh_thanh->'ethopex'->>'content_id')::int = ${Number(cid)} AND kinh_thanh->>'the_loai' = 'qc_nhan_vat'`)) as unknown as { id: number }[];
  if (co.length) { console.log(`· content ${cid}: đã có phim nhân vật #${co[0]!.id} — bỏ qua`); continue; }
  const kt = { ...g.kinh_thanh, the_loai: 'qc_nhan_vat', phong_cach: PHONG_CACH_PHIM_THAT, mo_hinh_anh: 'gemini-nano-banana-2.1', mo_hinh_video: 'veo-3.1-fast-generate-preview',
    logline: s.anh, ethopex: { ...g.kinh_thanh.ethopex, khuon: 'video thắng #3: nhân vật nhìn thẳng ống kính ~10s + logo tên phim + nút CTA, không lời kể', ban: 'B' } };
  const ten = g.ten.replace('QC kể chuyện', 'QC nhân vật');
  const ph = (await db.execute(sql`INSERT INTO xv_phim (project, ten, loai, mo_ta, kinh_thanh, trang_thai, poster_url)
    VALUES ('ethopex', ${ten}, 'quang_cao', ${`Bản B (mẫu thắng số 3) của phim #${g.id} — cùng content ${cid}`}, ${j(kt)}::jsonb, 'dang_lam', ${g.poster_url}) RETURNING id`)) as unknown as { id: number }[];
  const phimId = ph[0]!.id;
  const nv = (await db.execute(sql`SELECT loai, ten, mo_ta, anh_ref FROM xv_nhan_vat WHERE phim_id = ${g.id} ORDER BY id`)) as unknown as { loai: string; ten: string; mo_ta: string; anh_ref: unknown }[];
  const ids: number[] = [];
  for (const n of nv) ids.push(((await db.execute(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, anh_ref) VALUES (${phimId}, ${n.loai}, ${n.ten}, ${n.mo_ta}, ${j(n.anh_ref)}::jsonb) RETURNING id`)) as unknown as { id: number }[])[0]!.id);
  // logo tên phim + nút CTA chồng ở khâu ghép NHƯNG phải khai vào chữ màn của cảnh để người xem của studio chấm đúng thứ lên video
  // (19/10/2026: bỏ trống → người xem 1/10 "không thấy tên phim, nút Learn More"); lấy nguyên chữ thẻ cuối bản A (đã qua luật chữ studio)
  const tc = (await db.execute(sql`SELECT c.chu_man FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = ${g.id} ORDER BY c.thu_tu DESC LIMIT 1`)) as unknown as { chu_man: string }[];
  const dongTc = (tc[0]?.chu_man ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
  const nhanQc = g.kinh_thanh.ngon_ngu === 'es' ? 'MINISERIE' : 'SHORT DRAMA';
  const chuMan = dongTc.length >= 2 ? `${nhanQc}: ${dongTc[0]}\n${dongTc[1]}` : `${nhanQc}: "${g.ten.split(' · ')[1] ?? ''}"`;
  const tk = (await db.execute(sql`SELECT c.tham_khao FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = ${g.id} AND c.thu_tu = 1 LIMIT 1`)) as unknown as { tham_khao: { cau: string; nguon: unknown[] }[] }[];
  const nguon = tk[0]?.tham_khao?.[0]?.nguon ?? [];
  const tap = (await db.execute(sql`INSERT INTO xv_tap (phim_id, so, ten, kich_ban, tom_tat, brief, beats, phan_canh, trang_thai)
    VALUES (${phimId}, 1, 'Bản B — nhân vật nhìn ống kính', ${s.anh}, ${s.anh},
      ${`QC Facebook Ads cho PHIM NGẮN (khuôn thắng số 3 Ethopex): MỘT cảnh liền 8s nhân vật chính nhìn thẳng người xem trong khoảnh khắc sức mạnh, chất phim người đóng thật. Không lời kể, không phụ đề; logo tên phim + nút 'Learn More' chồng ở khâu ghép. Mục tiêu: dừng lướt → tò mò → bấm xem phim miễn phí.`},
      ${j(BEATS)}::jsonb, ${j(PHAN_CANH)}::jsonb, 'storyboard') RETURNING id`)) as unknown as { id: number }[];
  const tapId = tap[0]!.id;
  await db.execute(sql`INSERT INTO xv_canh (tap_id, thu_tu, canh, hanh_dong, prompt_anh, prompt_video, loi_thoai, thoai, chu_man, nhan_vat, phan_doan, ky_thuat, dan_dung, tham_khao, thoi_luong_s, trang_thai)
    VALUES (${tapId}, 1, 'Shot 1 · hero', ${s.anh}, ${s.anh}, ${s.dong}, '', '[]'::jsonb, ${chuMan}, ${j(ids)}::jsonb, 'hook',
      ${j({ co_canh: 'mcu', am_thanh: [], chuyen_dong: 'day_vao' })}::jsonb,
      ${j({ mo: s.anh.slice(0, 220), ket: s.ket, dien: s.dong, muc_dich: 'dừng lướt: nhân vật nhìn thẳng người xem, sức mạnh lộ ra' })}::jsonb,
      ${j([{ cau: s.anh, nguon }, ...chuMan.split('\n').map((cau) => ({ cau, nguon }))])}::jsonb, 8, 'nhap')`);
  console.log(`✓ content ${cid}: phim #${phimId} · tập #${tapId} · 1 cảnh hero 8s (phong cách phim thật, Veo 3.1 Fast)`);
}
process.exit(0);
