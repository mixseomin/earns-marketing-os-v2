// SINH TUYẾN TRUYỆN + SỔ GÀI / TRẢ cho các phim có bản đồ series (anh 31/10/2026: "Gài / Trả không có data — thiếu data thì sinh thêm vào").
// Cùng đường với nút ✨ AI rút từ bản đồ (claude.ts › goiYTuyenTruyen → tuyen-truyen.ts › tronAi: chỉ điền chỗ trống). Ghi tiền vào sổ chi phí
// của từng phim, chụp kinh_thanh trước khi ghi (↶ Hoàn tác được). Chạy trên box3:
//   cd apps/xuong-video && set -a && . ../../.env.production && set +a && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/sinh-tuyen-truyen.mts [--phim=16,13] [--lai] [--chay]
//   --them=5 --phim=353 [--chay] : AI VIẾT TIẾP 5 tập nối bản đồ (claude.ts › vietThemTap → tuyen-truyen.ts › themTapAi), cùng đường nút ＋ Viết tiếp tập.
//   --sap-khung --phim=353 [--chay] : AI SẮP TUYẾN THEO KHUNG NGÀNH (khung-tuyen.ts) + chi tiết để mở sang tập / mùa sau.
//   mặc định: mọi phim không lưu trữ có ≥ 2 tập trên bản đồ mà sổ còn trống; chỉ in danh sách. --chay = gọi AI + ghi. --lai = cả phim đã có sổ.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { goiYTuyenTruyen, vietThemTap, sapKhungTuyen } from '../src/lib/xuong-video/claude';
import { khungCuaPhim, vanKhung } from '../src/lib/xuong-video/khung-tuyen';
import { tronAi, themTapAi, apSapKhung } from '../src/lib/xuong-video/tuyen-truyen';
import { chupTruoc } from '../src/lib/xuong-video/hoan-tac';
import { ghiTienChu } from '../src/lib/xuong-video/doc-db';
import type { KinhThanh } from '../src/lib/xuong-video/kieu';

const gia = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] ?? '';
const chay = process.argv.includes('--chay'), lai = process.argv.includes('--lai');
const chiPhim = gia('phim').split(',').map(Number).filter(Boolean);
const db = getDb()!;
if (process.argv.includes('--sap-khung')) {
  if (chiPhim.length !== 1) { console.error('--sap-khung cần đúng một --phim'); process.exit(1); }
  const p = ((await db.execute(sql`SELECT id, ten, kinh_thanh FROM xv_phim WHERE id = ${chiPhim[0]!}`)) as unknown as { id: number; ten: string; kinh_thanh: KinhThanh }[])[0]!;
  const khung = khungCuaPhim(p.kinh_thanh);
  console.log(`#${p.id} ${p.ten}: khung ${khung?.ten ?? '(thể loại chưa có khung)'}`);
  if (!chay || !khung) process.exit(khung ? 0 : 1);
  const k = await sapKhungTuyen(p.kinh_thanh, p.ten, vanKhung(khung));
  if (!k.ok) { console.log(`LỖI ${k.loi}`); process.exit(1); }
  if (k.model && k.tokens) await ghiTienChu(db, p.id, 'AI sắp tuyến theo khung ngành', k.model, k.tokens);
  const moi = ((await db.execute(sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${p.id}`)) as unknown as { kinh_thanh: KinhThanh }[])[0]!.kinh_thanh;
  const s = apSapKhung(moi.series!, k.data, () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  await chupTruoc(db, { bang: 'xv_phim', id: p.id, cot: ['kinh_thanh'], moTa: 'AI sắp tuyến theo khung ngành', nguoi: 'sinh-tuyen-truyen' });
  await db.execute(sql`UPDATE xv_phim SET kinh_thanh = jsonb_set(kinh_thanh, '{series}', ${JSON.stringify(s)}::jsonb), updated_at = now() WHERE id = ${p.id}`);
  for (const t of s.tuyen ?? []) console.log(`  ${t.ma} [${t.vai}] ${t.ten}: ${s.tap.filter((x) => x.su_kien?.[t.ma]).map((x) => x.so).join(',')}`);
  console.log(`  để mở: ${(s.so_gai_tra ?? []).filter((g) => g.mo).map((g) => `${g.chi_tiet} (tập ${g.gieo} → ${g.mo === 'mua_sau' ? 'mùa sau' : 'tập sau'})`).join(' · ')}`);
  console.log(`  ${k.model} · ${k.tokens?.vnd != null ? `${Math.round(k.tokens.vnd)}₫` : `${k.tokens?.in}/${k.tokens?.out} tok`}`);
  process.exit(0);
}
const them = Number(gia('them') || 0);
if (them) {
  if (chiPhim.length !== 1) { console.error('--them cần đúng một --phim'); process.exit(1); }
  const p = ((await db.execute(sql`SELECT id, ten, kinh_thanh FROM xv_phim WHERE id = ${chiPhim[0]!}`)) as unknown as { id: number; ten: string; kinh_thanh: KinhThanh }[])[0]!;
  console.log(`#${p.id} ${p.ten}: viết tiếp ${them} tập sau tập ${Math.max(...(p.kinh_thanh.series?.tap ?? []).map((t) => t.so))}`);
  if (!chay) process.exit(0);
  const anchor = ((await db.execute(sql`SELECT ten FROM xv_nhan_vat WHERE phim_id = ${p.id}`)) as unknown as { ten: string }[]).map((r) => r.ten);
  const k = await vietThemTap(p.kinh_thanh, p.ten, them, anchor, vanKhung(khungCuaPhim(p.kinh_thanh)));
  if (!k.ok) { console.log(`LỖI ${k.loi}`); process.exit(1); }
  if (k.model && k.tokens) await ghiTienChu(db, p.id, `AI viết tiếp ${them} tập trên bản đồ`, k.model, k.tokens);
  const moi = ((await db.execute(sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${p.id}`)) as unknown as { kinh_thanh: KinhThanh }[])[0]!.kinh_thanh;
  const r = themTapAi(moi.series!, k.data, () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  await chupTruoc(db, { bang: 'xv_phim', id: p.id, cot: ['kinh_thanh'], moTa: `AI viết tiếp tập ${r.them.join(', ')}`, nguoi: 'sinh-tuyen-truyen' });
  await db.execute(sql`UPDATE xv_phim SET kinh_thanh = jsonb_set(kinh_thanh, '{series}', ${JSON.stringify(r.s)}::jsonb), updated_at = now() WHERE id = ${p.id}`);
  for (const t of r.s.tap.filter((x) => r.them.includes(x.so))) console.log(`  Tập ${t.so} "${t.ten}": ${t.logline}\n${Object.entries(t.su_kien ?? {}).map(([m, v]) => `     ${m}: ${v}`).join('\n')}`);
  const tra = r.s.so_gai_tra!.filter((g) => g.tra != null && r.them.includes(g.tra));
  console.log(`  trả trong tập mới: ${tra.map((g) => `${g.chi_tiet} (${g.gieo}→${g.tra})`).join(' · ')}\n  còn treo: ${r.s.so_gai_tra!.filter((g) => g.tra == null).length} · ${k.model} · ${k.tokens?.vnd != null ? `${Math.round(k.tokens.vnd)}₫` : `${k.tokens?.in}/${k.tokens?.out} tok`}`);
  process.exit(0);
}
const rows = (await db.execute(sql`SELECT id, ten, kinh_thanh FROM xv_phim WHERE jsonb_typeof(kinh_thanh->'series'->'tap') = 'array'
  AND jsonb_array_length(kinh_thanh->'series'->'tap') >= 2 ORDER BY id`)) as unknown as { id: number; ten: string; kinh_thanh: KinhThanh }[];
const ds = rows.filter((r) => (chiPhim.length ? chiPhim.includes(r.id) : !r.kinh_thanh.luu_tru)
  && (lai || !(r.kinh_thanh.series?.so_gai_tra?.length && r.kinh_thanh.series?.tuyen?.length)));
console.log(`${ds.length} phim: ${ds.map((r) => `#${r.id} ${r.ten}`).join(' | ')}`);
if (!chay) process.exit(0);

let tongVnd = 0;
const mot = async (r: (typeof ds)[number]) => {
  const k = await goiYTuyenTruyen(r.kinh_thanh, r.ten);
  if (!k.ok) { console.log(`#${r.id} LỖI ${k.loi}`); return; }
  if (k.model && k.tokens) await ghiTienChu(db, r.id, 'AI rút tuyến truyện + gài/trả', k.model, k.tokens);
  tongVnd += k.tokens?.vnd ?? 0;
  // đọc lại ngay trước khi ghi — người có thể vừa sửa trên trang trong lúc AI chạy
  const moi = ((await db.execute(sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${r.id}`)) as unknown as { kinh_thanh: KinhThanh }[])[0]!.kinh_thanh;
  const s = tronAi(moi.series!, k.data, () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  await chupTruoc(db, { bang: 'xv_phim', id: r.id, cot: ['kinh_thanh'], moTa: 'AI rút tuyến truyện + gài/trả', nguoi: 'sinh-tuyen-truyen' });
  await db.execute(sql`UPDATE xv_phim SET kinh_thanh = jsonb_set(kinh_thanh, '{series}', ${JSON.stringify(s)}::jsonb), updated_at = now() WHERE id = ${r.id}`);
  console.log(`#${r.id} ${r.ten}: ${s.tuyen?.length ?? 0} tuyến · ${k.data.su_kien.length} ô sự kiện · ${s.so_gai_tra?.length ?? 0} chi tiết gài/trả · ${k.model} · ${k.tokens?.vnd != null ? `${Math.round(k.tokens.vnd)}₫` : `${k.tokens?.in}/${k.tokens?.out} tok`}`);
};
for (let i = 0; i < ds.length; i += 4) await Promise.all(ds.slice(i, i + 4).map(mot));   // song song có trần
console.log(`xong · tiền ckey báo: ${Math.round(tongVnd)}₫`);
process.exit(0);
