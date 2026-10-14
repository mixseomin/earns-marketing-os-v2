// Dựng BỘ TEMPLATE từ tệp dữ liệu (mau/templates.json) — 0đ, không gọi model nào. Mỗi template = một phim (kinh_thanh.template) có anchor + tập +
// đủ shot (máy, hành động, chữ màn, lời dẫn, prompt ảnh/video) với ô {{x}}; sửa tiếp trên studio như phim thường, tạo phim = 🧩 Tạo phim từ template.
// Chạy lại an toàn: template đã có (trùng tên) thì chỉ cập nhật cấu hình ô (nhãn, gợi ý, thứ tự) — muốn dựng lại bản mới: --lai=<key>.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/dung-template.mts mau/templates.json [--chi=<key>] [--lai=<key>]
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { ghepThoai, CAM_XUC_THEO_LOAI, type KinhThanh, type LoaiNhanVat, type LoaiShotMau, type OTemplate, type DongThoai } from '../src/lib/xuong-video/kieu';
import { timO, dsOTemplate, oThieu, giaTriMau } from '../src/lib/xuong-video/template';

type Shot = { giay: number; loai: LoaiShotMau; canh?: string; goc_may: string; hanh_dong: string; chu_man: string; loi?: string; noi?: string; dien_xuat?: string;
  prompt_anh?: string; prompt_video?: string; nv?: string[]; keyframe?: string };
type Tpl = { key: string; ten: string; mo_ta: string; o: string[]; kinh_thanh: KinhThanh; nhan_vat: { key: string; loai: LoaiNhanVat; ten: string; mo_ta: string; anh_ref?: string[]; giong?: string }[];
  tap: { ten: string; brief: string }; shots: Shot[] };
type Tep = { o_chung: Record<string, OTemplate>; templates: Tpl[] };

const gia = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] ?? '';
const tep = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as Tep;
const db = getDb()!;
const q = async (s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as Record<string, unknown>[];
const chi = gia('chi'), lai = gia('lai');

for (const t of tep.templates) {
  if (chi && t.key !== chi) continue;
  // kiểm khuôn trước khi ghi: mọi ô dùng phải được khai (nhãn + giá trị mẫu) — template mở ra là thử được ngay
  const dung = timO([t.kinh_thanh, t.nhan_vat, t.tap, t.shots]);
  const o = Object.fromEntries(t.o.map((k) => { const v = tep.o_chung[k]; if (!v) throw new Error(`${t.key}: ô ${k} chưa khai trong o_chung`); return [k, v]; }));
  const thieuKhai = dung.filter((k) => !o[k]);
  if (thieuKhai.length) throw new Error(`${t.key}: dùng ô chưa liệt kê trong "o": ${thieuKhai.join(', ')}`);
  const ds = dsOTemplate({ o }, dung);
  const thieuMau = oThieu(ds, giaTriMau(ds));
  if (thieuMau.length) throw new Error(`${t.key}: ô thiếu giá trị mẫu: ${thieuMau.map((x) => x.k).join(', ')}`);
  const cfg = { mo_ta: t.mo_ta, o, thu_tu: t.o };
  const cu = await q(sql`SELECT id FROM xv_phim WHERE ten = ${t.ten} AND kinh_thanh ? 'template' AND kinh_thanh->'template' <> 'null'::jsonb`);
  if (cu.length && lai !== t.key) {   // đã có → chỉ cập nhật nhãn / gợi ý / thứ tự ô (không đụng shot người đã sửa trên studio)
    await db.execute(sql`UPDATE xv_phim SET kinh_thanh = jsonb_set(kinh_thanh, '{template}', ${JSON.stringify(cfg)}::jsonb), updated_at = now() WHERE id = ${Number(cu[0]!.id)}`);
    console.log(`= ${t.key}: đã có #${cu[0]!.id} — cập nhật cấu hình ô`); continue;
  }
  const giay = Math.round(t.shots.reduce((a, s) => a + s.giay, 0));
  const kt: KinhThanh = { ...t.kinh_thanh, template: cfg };
  const phimId = Number((await q(sql`INSERT INTO xv_phim (project, ten, loai, mo_ta, kinh_thanh) VALUES ('studio', ${t.ten}, 'quang_cao', ${t.mo_ta}, ${JSON.stringify(kt)}::jsonb) RETURNING id`))[0]!.id);
  const idNv: Record<string, number> = {};
  for (const v of t.nhan_vat) idNv[v.key] = Number((await q(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, anh_ref, giong) VALUES (${phimId}, ${v.loai}, ${v.ten}, ${v.mo_ta}, ${JSON.stringify(v.anh_ref ?? [])}::jsonb, ${v.giong ?? ''}) RETURNING id`))[0]!.id);
  const tapId = Number((await q(sql`INSERT INTO xv_tap (phim_id, so, ten, brief, thoi_luong_s) VALUES (${phimId}, 1, ${t.tap.ten}, ${t.tap.brief}, ${giay}) RETURNING id`))[0]!.id);
  for (const [i, s] of t.shots.entries()) {
    const thoai: DongThoai[] = s.loi ? [{ nhan_vat: s.noi ?? '', dien_xuat: s.dien_xuat ?? '', loi: s.loi, url: null, tre: 0.2 }] : [];
    const nv = (s.nv ?? []).map((k) => { if (!idNv[k]) throw new Error(`${t.key} shot ${i + 1}: anchor ${k} không có`); return idNv[k]!; });
    await db.execute(sql`INSERT INTO xv_canh (tap_id, thu_tu, canh, goc_may, hanh_dong, loi_thoai, thoai, am_thanh, thoi_luong_s, phat_s, nhan_vat, bien_the, prompt_anh, prompt_video, phan_doan, cam_xuc, ky_thuat, trang_phuc, chu_man, kieu_chu, keyframe_url, keyframe_uv, trang_thai)
      VALUES (${tapId}, ${i + 1}, ${s.canh ?? `Shot ${i + 1} · ${s.loai}`}, ${s.goc_may}, ${s.hanh_dong}, ${ghepThoai(thoai)}, ${JSON.stringify(thoai)}::jsonb, '', ${Math.max(2, Math.ceil(s.giay))}, ${s.giay},
        ${JSON.stringify(nv)}::jsonb, '[]'::jsonb, ${s.prompt_anh ?? ''}, ${s.prompt_video ?? ''}, ${s.loai}, ${CAM_XUC_THEO_LOAI[s.loai] ?? 0}, '{}'::jsonb, '', ${s.chu_man}, '{}'::jsonb,
        ${s.keyframe ?? null}, ${JSON.stringify(s.keyframe ? [s.keyframe] : [])}::jsonb, ${s.keyframe ? 'co_keyframe' : 'nhap'})`);
  }
  console.log(`+ ${t.key}: template #${phimId} · ${t.shots.length} shot · ${giay}s · ${dung.length} ô (${dung.join(', ')})`);
}
process.exit(0);
