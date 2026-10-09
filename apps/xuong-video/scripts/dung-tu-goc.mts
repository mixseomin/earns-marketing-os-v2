// Dựng lại MỘT tập từ hồ sơ ĐO bản gốc (mau/<ten>-goc.json) — 0đ, không gọi model nào (anh 10/10/2026: "bỏ hết các thành phần sai,
// chuẩn bị gen toàn bộ video ad hoàn chỉnh"). Hồ sơ = điểm cắt thật, chữ màn nguyên văn theo giây, lời đọc gốc có mốc giây, hình từng cảnh,
// prompt, kiểu chữ từng cảnh, ảnh thật cho cảnh bằng chứng/end card.
//   --phim=5 --tap=6 --ho-so=mau/jett-husband-goc.json --giu=73 [--chay]
//   --giu=<id shot> : shot đã làm chuẩn (giữ nguyên hình/video/giọng, chỉ cập nhật chữ + kiểu + giờ theo hồ sơ cảnh 1).
//   Mặc định chỉ in kế hoạch. --chay: (1) chi phí phim chỉ tính job của shot giữ, (2) shot cũ + anchor không có trong gốc → thùng rác,
//   (3) tạo shot mới, anchor mới, kịch bản = lời đọc gốc, bài đăng = bài gốc, QC mẫu = khung mới. Mọi sửa trên bản ghi giữ lại có hoàn tác.
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { boVaoThungRac } from '../src/lib/xuong-video/thung-rac';
import { chupTruoc } from '../src/lib/xuong-video/hoan-tac';
import { ghepThoai, type DongThoai } from '../src/lib/xuong-video/kieu';

type Canh = { tu: number; den: number; loai: string; chu: string; hinh: string; mau_quan?: string; anh_that?: string; y: number; kieu?: Record<string, unknown>; prompt_anh?: string; prompt_video?: string; goc_may?: string; anchor?: string[] };
type HoSo = { nguon: string; loi_doc: [number, string][]; canh: Canh[]; phong_cach: string; kieu_chu_phim: Record<string, unknown>; anchor_moi: Record<string, { loai: string; ten: string; mo_ta: string }>; doi_ten_anchor: Record<string, { ten: string; mo_ta: string }> };
const gia = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] ?? '';
const phimId = Number(gia('phim')), tapId = Number(gia('tap')), giu = Number(gia('giu') || 0), chay = process.argv.includes('--chay');
const hs = JSON.parse(readFileSync(gia('ho-so'), 'utf8')) as HoSo;
const db = getDb()!;
const q = async (s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as Record<string, unknown>[];
const B = 'https://cdn.orabra.com/uploads/media/719ea446-f511-4ea6-8b66-422c50a743fe/2879d968-9f99-4a9c-9365-32ed4eb01f33/';
const r2 = (x: number) => Math.round(x * 100) / 100;

// Lời đọc gốc → cảnh chứa mốc bắt đầu; tre = giây tính từ đầu cảnh.
const loiTheoCanh = hs.canh.map(() => [] as DongThoai[]);
for (const [t, loi] of hs.loi_doc) { const i = hs.canh.findIndex((c) => t >= c.tu - 0.001 && t < c.den); loiTheoCanh[Math.max(0, i)]!.push({ nhan_vat: '', dien_xuat: 'energetic female ad narrator', loi, url: null, tre: r2(t - hs.canh[Math.max(0, i)]!.tu) }); }
const sp = Number((await q(sql`SELECT id FROM xv_nhan_vat WHERE phim_id = ${phimId} AND loai = 'san_pham' ORDER BY id LIMIT 1`))[0]!.id);
const mauQuan = new Map((await q(sql`SELECT id, ten FROM xv_bien_the WHERE nhan_vat_id = ${sp}`)).map((r) => [String(r.ten), Number(r.id)]));
const cu = await q(sql`SELECT id, thu_tu FROM xv_canh WHERE tap_id = ${tapId} AND id <> ${giu} ORDER BY thu_tu`);
const nvCu = await q(sql`SELECT id, ten FROM xv_nhan_vat WHERE phim_id = ${phimId} AND id <> ${sp} AND NOT (id::text = ANY(${`{${Object.keys(hs.doi_ten_anchor).join(',')}}`}::text[])) ORDER BY id`);
const jobGiu = giu ? await q(sql`SELECT j.id, j.loai, j.chi_phi_cents FROM xv_job j JOIN xv_canh c ON c.id = ${giu} WHERE j.phim_id = ${phimId} AND j.trang_thai = 'xong' AND j.output_url IN (c.keyframe_url, c.video_url, c.video_cuoi_url, c.thoai->0->>'url')`) : [];
console.log(`hồ sơ: ${hs.canh.length} cảnh · ${r2(hs.canh.reduce((a, c) => a + c.den - c.tu, 0))}s · ${hs.loi_doc.length} câu lời đọc · nguồn ${hs.nguon.slice(0, 60)}`);
console.log(`chi phí phim: chỉ tính ${jobGiu.length} job của shot giữ #${giu} = $${(jobGiu.reduce((a, j) => a + Number(j.chi_phi_cents), 0) / 100).toFixed(3)} (${jobGiu.map((j) => j.loai).join(', ')})`);
console.log(`thùng rác: ${cu.length} shot cũ · ${nvCu.length} anchor (${nvCu.map((r) => r.ten).join(', ')})`);
hs.canh.forEach((c, i) => console.log(`  #${i + 1} ${r2(c.den - c.tu)}s ${c.loai}${c.anh_that ? ' [ảnh thật]' : c.prompt_anh ? '' : i === 0 ? ' [shot giữ]' : ' [THIẾU prompt]'} · ${c.mau_quan ?? '-'} · "${c.chu.replace(/\n/g, ' / ')}" · lời: ${loiTheoCanh[i]!.map((d) => `${d.tre}s "${d.loi}"`).join(' | ') || '-'}`));
if (!chay) { console.log('(xem trước — thêm --chay để ghi)'); process.exit(0); }

let nhom: string | undefined;
const chup = async (bang: 'xv_phim' | 'xv_tap' | 'xv_canh' | 'xv_nhan_vat', id: number, cot: string[]) => { nhom = await chupTruoc(db, { bang, id, cot, moTa: 'dựng lại tập từ hồ sơ đo bản gốc', nguoi: nhom ? '' : 'script dung-tu-goc', nhom }); };
// 1. Chi phí: chỉ job của shot giữ
await db.execute(sql`UPDATE xv_job SET tinh_chi = (id = ANY(${`{${jobGiu.map((j) => j.id).join(',') || 0}}`}::int[])) WHERE phim_id = ${phimId}`);
// 2. Thùng rác
if (cu.length) await boVaoThungRac(db, 'canh', cu.map((r) => Number(r.id)), 'script dung-tu-goc', `${cu.length} shot dựng theo phân tích sai (trước khi đo bản gốc)`);
for (const r of nvCu) await boVaoThungRac(db, 'nhan_vat', [Number(r.id)], 'script dung-tu-goc', `anchor không có trong bản gốc: ${r.ten}`);
// 3. Anchor: đổi tên/mô tả cho đúng (tiếng Anh) + tạo anchor mới
for (const [id, v] of Object.entries(hs.doi_ten_anchor)) { await chup('xv_nhan_vat', Number(id), ['ten', 'mo_ta']); await db.execute(sql`UPDATE xv_nhan_vat SET ten = ${v.ten}, mo_ta = ${v.mo_ta}, updated_at = now() WHERE id = ${Number(id)}`); }
const idAnchor: Record<string, number> = { bowl: Number(Object.keys(hs.doi_ten_anchor)[0]) };
for (const [k, v] of Object.entries(hs.anchor_moi)) idAnchor[k] = Number((await q(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta) VALUES (${phimId}, ${v.loai}, ${v.ten}, ${v.mo_ta}) RETURNING id`))[0]!.id);
// 4. Phim: phong cách + kiểu chữ chung + QC mẫu = khung mới
await chup('xv_phim', phimId, ['kinh_thanh']);
const mauShots = hs.canh.map((c) => ({ giay: r2(c.den - c.tu), loai: c.loai, chu_man: c.chu, hinh: c.hinh }));
await db.execute(sql`UPDATE xv_phim SET kinh_thanh = jsonb_set(jsonb_set(jsonb_set(jsonb_set(kinh_thanh, '{phong_cach}', to_jsonb(${hs.phong_cach}::text)),
  '{qc,kieu_chu}', ${JSON.stringify(hs.kieu_chu_phim)}::jsonb), '{qc,vi_tri_chu}', '"giua"'::jsonb), '{qc,mau,shots}', ${JSON.stringify(mauShots)}::jsonb), updated_at = now() WHERE id = ${phimId}`);
// 5. Tập: kịch bản = lời đọc gốc + chữ màn theo cảnh; bài đăng = bài gốc nguyên văn; beats/phân cảnh cũ bỏ
const kichBan = [`# ${hs.nguon}`, '', ...hs.canh.map((c, i) => `CẢNH ${i + 1} · ${c.tu.toFixed(2)}–${c.den.toFixed(2)}s · ${c.loai}\n  Chữ màn: ${c.chu.replace(/\n/g, ' / ')}\n  Hình: ${c.hinh}${loiTheoCanh[i]!.length ? `\n  Giọng đọc: ${loiTheoCanh[i]!.map((d) => `(+${d.tre}s) "${d.loi}"`).join(' ')}` : ''}`)].join('\n\n');
const mau = (await q(sql`SELECT kinh_thanh->'qc'->'mau' AS m FROM xv_phim WHERE id = ${phimId}`))[0]!.m as Record<string, string>;
await chup('xv_tap', tapId, ['kich_ban', 'beats', 'phan_canh', 'bai_dang', 'thoi_luong_s']);
await db.execute(sql`UPDATE xv_tap SET kich_ban = ${kichBan}, beats = '[]'::jsonb, phan_canh = '[]'::jsonb, thoi_luong_s = ${Math.round(hs.canh[hs.canh.length - 1]!.den)},
  bai_dang = ${JSON.stringify({ chu_bai: mau.chu_bai ?? '', tieu_de: mau.tieu_de ?? '', mo_ta: '', cta: mau.cta ?? 'Shop now', luc: new Date().toISOString() })}::jsonb, updated_at = now() WHERE id = ${tapId}`);
// 6. Shot — hành động ghi tiếng Anh (cổng ngôn ngữ chặn mọi chữ Việt của phim EN); mô tả tiếng Việt giữ ở qc.mau.shots[].hinh cho anh đọc.
const hanhDong = (c: Canh, anh: string | null) => (c.prompt_video ? c.prompt_video.split('. ').slice(0, 2).join('. ') : anh ? (c.loai === 'end_card' ? 'Real product photo on white with FLASH SALE · SHOP NOW' : 'Real customer photo collage (shop reviews)') : '');
for (const [i, c] of hs.canh.entries()) {
  const phat = r2(c.den - c.tu);
  const kieu = { ...(c.kieu ?? {}), y: c.y };
  const thoai = loiTheoCanh[i]!;
  if (i === 0 && giu) {
    const cuThoai = ((await q(sql`SELECT thoai FROM xv_canh WHERE id = ${giu}`))[0]!.thoai ?? []) as DongThoai[];
    const gop = thoai.map((d) => ({ ...d, url: cuThoai.find((x) => x.loi.replace(/[^a-z]/gi, '').toLowerCase() === d.loi.replace(/[^a-z]/gi, '').toLowerCase())?.url ?? null }));
    await chup('xv_canh', giu, ['chu_man', 'kieu_chu', 'phat_s', 'thoai', 'loi_thoai', 'thoi_luong_s', 'phan_doan']);
    await db.execute(sql`UPDATE xv_canh SET chu_man = ${c.chu}, kieu_chu = ${JSON.stringify(kieu)}::jsonb, phat_s = ${phat}, thoi_luong_s = 4, thoai = ${JSON.stringify(gop)}::jsonb, loi_thoai = ${ghepThoai(gop)},
      phan_doan = ${c.loai}, thu_tu = 1, updated_at = now() WHERE id = ${giu}`);
    continue;
  }
  const ids = c.anchor?.includes('none') ? [] : [sp, ...(c.anchor ?? []).map((k) => idAnchor[k]).filter((x): x is number => !!x)];
  const bt = c.mau_quan && mauQuan.get(c.mau_quan) ? [mauQuan.get(c.mau_quan)!] : [];
  const anh = c.anh_that ? `${B}${c.anh_that}.webp` : null;
  await db.execute(sql`INSERT INTO xv_canh (tap_id, thu_tu, canh, goc_may, hanh_dong, loi_thoai, thoai, am_thanh, thoi_luong_s, nhan_vat, bien_the, prompt_anh, prompt_video, phan_doan, cam_xuc, ky_thuat, trang_phuc, phat_s, chu_man, nhanh, kieu_chu, keyframe_url, keyframe_uv, trang_thai)
    VALUES (${tapId}, ${i + 1}, ${`Shot ${i + 1} · ${c.loai}`}, ${c.goc_may ?? (anh ? 'Still real product/customer photo' : '')}, ${hanhDong(c, anh)}, ${ghepThoai(thoai)}, ${JSON.stringify(thoai)}::jsonb, '', 4,
      ${JSON.stringify(anh ? [] : ids)}::jsonb, ${JSON.stringify(bt)}::jsonb, ${c.prompt_anh ?? ''}, ${c.prompt_video ?? ''}, ${c.loai}, 0, '{}'::jsonb, '', ${phat}, ${c.chu}, '', ${JSON.stringify(kieu)}::jsonb,
      ${anh}, ${JSON.stringify(anh ? [anh] : [])}::jsonb, ${anh ? 'co_keyframe' : 'nhap'})`);
}
console.log(`✓ đã dựng ${hs.canh.length} shot từ hồ sơ gốc · anchor mới ${JSON.stringify(idAnchor)} · ↶ Hoàn tác (sửa bản ghi giữ lại) + 🗑 Thùng rác (shot/anchor cũ)`);
process.exit(0);
