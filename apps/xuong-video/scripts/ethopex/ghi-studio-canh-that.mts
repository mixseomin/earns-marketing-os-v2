// GHI CREATIVE "CẢNH PHIM THẬT" VÀO STUDIO (0đ, chỉ ghi DB) — anh 20/10/2026: nhiều QC cùng một phim mà kho 📦 Sản phẩm của studio không thấy
// gom về một sản phẩm, vì bản cắt cảnh thật (cat-canh.py) dựng ngoài studio. Mỗi creative → một xv_phim QC (the_loai qc_canh_that) + một tập
// có bản xuất = video đã lên Ethopex; kinh_thanh.qc.link = link phim của bản A cùng content → nhom-phim.ts gom chung một sản phẩm.
// ĐỦ NẤC như creative studio thường (anh 20/10/2026: "chỉ có 1 cái đầy đủ… kẹt kịch bản"): tập có 2 cảnh — #1 cảnh phim thật (khung ảnh + clip =
// video đã lên), #2 thẻ cuối (khung ảnh thẻ cuối + chữ CTA + câu giọng CTA đã sinh) — nên kho Sản phẩm tính kịch bản/hình/giọng/clip/xuất đều xong.
// Chạy lại không tạo trùng (khoá = ethopex.creative_id); phim đã có mà tập chưa có cảnh thì bổ sung cảnh.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/ethopex/ghi-studio-canh-that.mts scripts/ethopex/canh-that-studio.json
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

type Cr = { content_id: number; tu: number; den: number; nguon_qc: string | null; creative_id: number; camp_id: number | null; lang: 'en' | 'es'; url: string; giay: number; lo: string;
  anh: string; anh_cuoi: string; chu_cuoi: string; giong_cta?: { url: string; loi: string } };
const vao = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as { creative: Cr[]; phim_moi: Record<string, { ten: string; link: string }> };
const db = getDb()!;
const j = (x: unknown) => JSON.stringify(x);
let moi = 0, co = 0, bs = 0;
/** 2 cảnh của creative cảnh thật — chỉ thêm khi tập chưa có cảnh nào */
async function canh(phimId: number, c: Cr) {
  const tap = (await db.execute(sql`SELECT id FROM xv_tap WHERE phim_id = ${phimId} ORDER BY so LIMIT 1`)) as unknown as { id: number }[];
  if (!tap.length) return;
  const n = (await db.execute(sql`SELECT count(*)::int AS n FROM xv_canh WHERE tap_id = ${tap[0]!.id}`)) as unknown as { n: number }[];
  if (n[0]!.n > 0) return;
  const L = Math.round((c.den - c.tu) * 10) / 10, cuoi = Math.max(2.5, Math.round((c.giay - L) * 10) / 10);
  await db.execute(sql`INSERT INTO xv_canh (tap_id, thu_tu, canh, hanh_dong, chu_man, phan_doan, keyframe_url, video_url, thoi_luong_s, phat_s, trang_thai, thoai, loi_thoai, ky_thuat, dan_dung)
    VALUES (${tap[0]!.id}, 1, ${`Shot 1 · cảnh phim thật ${c.tu}–${c.den}s`}, ${`Cảnh phim thật cắt từ QC app gốc ${c.nguon_qc ?? ''} (đoạn ${c.tu}–${c.den}s): mở bằng hook bị chà đạp, kết ở chỗ lật ngược / treo; giữ bố cục app gốc (tên trên, phụ đề thoại giữa, tóm tắt dưới) + nút CTA nhún từ giây 3`},
      '', 'hook', ${c.anh}, ${c.url}, ${Math.ceil(L)}, ${L}, 'duyet', '[]'::jsonb, '', ${j({ nguon: 'canh_that', am_thanh: ['tiếng gốc của phim'] })}::jsonb, ${j({ mo: 'cảnh hook bị chà đạp', ket: 'lật ngược / treo' })}::jsonb)`);
  await db.execute(sql`INSERT INTO xv_canh (tap_id, thu_tu, canh, hanh_dong, chu_man, phan_doan, keyframe_url, video_url, thoi_luong_s, phat_s, trang_thai, thoai, loi_thoai, ky_thuat)
    VALUES (${tap[0]!.id}, 2, 'Shot 2 · end card', ${'Thẻ cuối: poster sạch (logo thật của phim) + dòng hỏi vàng + mũi tên + nút CTA' + (c.giong_cta ? ' + giọng đọc CTA' : '')}, ${c.chu_cuoi}, 'cta', ${c.anh_cuoi}, ${c.url},
      ${Math.ceil(cuoi)}, ${cuoi}, 'duyet', ${j(c.giong_cta ? [{ nhan_vat: '', loi: c.giong_cta.loi, url: c.giong_cta.url, dien_xuat: 'V.O. excited' }] : [])}::jsonb, ${c.giong_cta?.loi ?? ''}, ${j({ nguon: 'canh_that' })}::jsonb)`);
  bs++;
}
for (const c of vao.creative) {
  const da = (await db.execute(sql`SELECT id FROM xv_phim WHERE project = 'ethopex' AND (kinh_thanh->'ethopex'->>'creative_id')::int = ${c.creative_id}`)) as unknown as { id: number }[];
  if (da.length) { co++; await canh(da[0]!.id, c); await db.execute(sql`UPDATE xv_phim SET poster_url = ${c.anh_cuoi} WHERE id = ${da[0]!.id} AND poster_url IS NULL`); continue; }
  const a = (await db.execute(sql`SELECT ten, kinh_thanh, poster_url FROM xv_phim WHERE project = 'ethopex' AND (kinh_thanh->'ethopex'->>'content_id')::int = ${c.content_id}
    AND kinh_thanh->>'the_loai' = 'qc_ke_chuyen' ORDER BY id LIMIT 1`)) as unknown as { ten: string; kinh_thanh: Record<string, any>; poster_url: string | null }[];
  const pm = vao.phim_moi[String(c.content_id)];
  const tenPhim = a[0] ? a[0].ten.split(' · ')[1]! : pm!.ten;
  const qc = a[0]?.kinh_thanh?.qc ?? { ten: `${pm!.ten} — short drama`, link: pm!.link };
  const kt = { ti_le: '9:16', do_phan_giai: '1080p', ngon_ngu: c.lang, the_loai: 'qc_canh_that', qc,
    ethopex: { ...(a[0]?.kinh_thanh?.ethopex ?? {}), content_id: c.content_id, creative_id: c.creative_id, camp_id: c.camp_id, nguon_qc: c.nguon_qc, tu: c.tu, den: c.den, lo: c.lo,
      khuon: 'cảnh phim thật: cắt đoạn hook → lật ngược/treo từ QC app gốc (spy) + nút CTA + giọng CTA + thẻ cuối poster (cat-canh.py)' } };
  const ten = `Ethopex · ${tenPhim} · Cảnh thật ${c.tu}–${c.den}s (lô ${c.lo})`;
  const ph = (await db.execute(sql`INSERT INTO xv_phim (project, ten, loai, mo_ta, kinh_thanh, trang_thai, poster_url)
    VALUES ('ethopex', ${ten}, 'quang_cao', ${`Creative Ethopex #${c.creative_id}${c.camp_id ? ` · camp #${c.camp_id}` : ''} — cắt từ QC app gốc ${c.nguon_qc ?? ''} (${c.tu}–${c.den}s), 0đ`}, ${j(kt)}::jsonb, 'dang_lam', ${a[0]?.poster_url ?? c.anh_cuoi}) RETURNING id`)) as unknown as { id: number }[];
  await db.execute(sql`INSERT INTO xv_tap (phim_id, so, ten, kich_ban, tom_tat, xuat, trang_thai)
    VALUES (${ph[0]!.id}, 1, ${`Cảnh thật ${c.tu}–${c.den}s`}, '', ${`Đoạn ${c.tu}–${c.den}s của QC app gốc`}, ${j([{ luc: new Date().toISOString(), url: c.url, giay: c.giay, nhanh: 'A' }])}::jsonb, 'storyboard')`);
  await canh(ph[0]!.id, c);
  moi++;
}
console.log(`ghi mới ${moi} · đã có ${co} · bổ sung cảnh ${bs}`);
process.exit(0);
