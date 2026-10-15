// Dựng BỘ TEMPLATE từ tệp dữ liệu (mau/templates.json) — 0đ, không gọi model nào. Mỗi template = một phim (kinh_thanh.template) có anchor + tập +
// đủ shot (máy, hành động, chữ màn, lời dẫn, prompt ảnh/video) với ô {{x}}; sửa tiếp trên studio như phim thường, tạo phim = 🧩 Tạo phim từ template.
// Chạy lại an toàn: template đã có (trùng tên) thì chỉ cập nhật cấu hình ô (nhãn, gợi ý, thứ tự) — muốn dựng lại bản mới: --lai=<key>.
// --dong-bo=<key>: GHI ĐÈ shot + khung truyện của template đã có theo tệp (mất phần sửa tay trên studio của template đó) — dùng khi sửa khuôn trong tệp.
// Mỗi shot khai cỡ cảnh (co); chuyển động máy (may) để trống thì daDangMay chọn cho đủ đa dạng (cổng nhịp hình). Khung truyện + phân cảnh
// suy từ loại shot (template.ts › khungTuShot) — thiếu là studio chặn keyframe.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/dung-template.mts mau/templates.json [--chi=<key>] [--lai=<key>]
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { ghepThoai, CAM_XUC_THEO_LOAI, type KieuChu, type KinhThanh, type MauQcTemplate, type LoaiNhanVat, type LoaiShotMau, type OTemplate, type DongThoai } from '../src/lib/xuong-video/kieu';
import { timO, dsOTemplate, oThieu, giaTriMau, khungTuShot } from '../src/lib/xuong-video/template';
import { daDangMay } from '../src/lib/xuong-video/nhip-hinh';
import { diemNhan } from '../src/lib/xuong-video/diem-nhan';
import type { KyThuatShot } from '../src/lib/xuong-video/dien-anh';
import { cauThieuNguon, type ThamKhaoCau } from '../src/lib/xuong-video/tham-khao';
import { CTA_MAC_DINH, laShotCta } from '../src/lib/xuong-video/cta';



type Shot = { giay: number; loai: LoaiShotMau; canh?: string; goc_may: string; hanh_dong: string; chu_man: string; loi?: string; noi?: string; dien_xuat?: string;
  prompt_anh?: string; prompt_video?: string; nv?: string[]; /** biến thể (màu…) của anchor gắn vào shot — key trong nhan_vat[].bien_the */ bt?: string[]; keyframe?: string; /** cỡ cảnh (ecu|cu|mcu|ms|two|ws|ews) */ co: string; /** chuyển động máy — trống thì máy chọn */ may?: string;
  /** kiểu chữ RIÊNG của shot (vd ô bình luận: nền trắng, nguyên câu) — trống: shot CTA lấy kiểu thư viện CTA, shot khác theo phim */ kieu?: KieuChu;
  /** nguồn tham khảo của câu cố định (không phải ô) — BẮT BUỘC, thiếu thì dừng (tham-khao.ts) */ tk?: ThamKhaoCau[] };
type Tpl = { key: string; ten: string; mo_ta: string; mau_qc?: MauQcTemplate[]; o: string[]; kinh_thanh: KinhThanh; nhan_vat: { key: string; loai: LoaiNhanVat; ten: string; mo_ta: string; anh_ref?: string[]; giong?: string; bien_the?: { key: string; nhom: string; ten: string; mo_ta: string; anh_url?: string }[] }[];
  tap: { ten: string; brief: string }; shots: Shot[] };
type Tep = { o_chung: Record<string, OTemplate>; templates: Tpl[] };

const gia = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] ?? '';
const tep = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as Tep;
const db = getDb()!;
const q = async (s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as Record<string, unknown>[];
const chi = gia('chi'), lai = gia('lai'), dongBo = gia('dong-bo');
/** Kỹ thuật máy cả tập: cỡ cảnh theo tệp + chuyển động máy đa dạng (đúng luật nhịp hình). */
const kyThuat = (shots: Shot[]): KyThuatShot[] => {
  const ds = shots.map((s, i) => ({ id: i, thu_tu: i + 1, ky_thuat: { co_canh: s.co, ...(s.may ? { chuyen_dong: s.may } : {}) } as KyThuatShot }));
  for (const d of daDangMay(ds)) ds[d.id]!.ky_thuat = d.ky_thuat;
  return ds.map((d) => d.ky_thuat);
};

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
  // Template phải có MẪU QC THẮNG kèm video / ảnh thật (anh 15/10/2026) — thiếu thì không dựng.
  if (!t.mau_qc?.length || t.mau_qc.some((m) => !m.ma || !(m.video || m.anh) || !m.mo_ta)) throw new Error(`${t.key}: thiếu mẫu QC thắng (mau_qc: ma + video/ảnh + mo_ta) — chạy scripts/luu-mau-qc.mts <library_id>`);
  const cfg = { mo_ta: t.mo_ta, o, thu_tu: t.o, mau_qc: t.mau_qc };
  const cu = await q(sql`SELECT id FROM xv_phim WHERE ten = ${t.ten} AND kinh_thanh ? 'template' AND kinh_thanh->'template' <> 'null'::jsonb`);
  if (cu.length && lai !== t.key) {   // đã có → chỉ cập nhật nhãn / gợi ý / thứ tự ô (không đụng shot người đã sửa trên studio)
    const pid = Number(cu[0]!.id);
    await db.execute(sql`UPDATE xv_phim SET kinh_thanh = jsonb_set(kinh_thanh, '{template}', ${JSON.stringify(cfg)}::jsonb), updated_at = now() WHERE id = ${pid}`);
    if (dongBo === t.key) await ghiShot(pid, t, true);
    console.log(`= ${t.key}: đã có #${pid} — cập nhật cấu hình ô${dongBo === t.key ? ' + ĐỒNG BỘ shot/khung truyện từ tệp' : ''}`); continue;
  }
  const giay = Math.round(t.shots.reduce((a, s) => a + s.giay, 0));
  const kt: KinhThanh = { ...t.kinh_thanh, template: cfg };
  const phimId = Number((await q(sql`INSERT INTO xv_phim (project, ten, loai, mo_ta, kinh_thanh) VALUES ('studio', ${t.ten}, 'quang_cao', ${t.mo_ta}, ${JSON.stringify(kt)}::jsonb) RETURNING id`))[0]!.id);
  await ghiShot(phimId, t, false);
  console.log(`+ ${t.key}: template #${phimId} · ${t.shots.length} shot · ${giay}s · ${dung.length} ô (${dung.join(', ')})`);
}
process.exit(0);

/** Ghi anchor + tập + shot của template. capNhat=true: anchor đã có (khớp theo thứ tự trong tệp = thứ tự id), tập + shot ghi đè theo thu_tu. */
async function ghiShot(phimId: number, t: Tpl, capNhat: boolean) {
  const giay = Math.round(t.shots.reduce((a, s) => a + s.giay, 0));
  const { beats, phan_canh } = khungTuShot(t.shots);
  // ✨ điểm nhấn (diem-nhan.ts): hiệu ứng hình (lớp của tập) + tiếng ở mỗi điểm cắt theo loại shot
  const nhan = diemNhan(t.shots.map((s) => ({ loai: s.loai, phat: s.giay })));
  // anchor + biến thể: dựng mới, hoặc (capNhat) khớp theo thứ tự trong tệp = thứ tự id, ghi đè chữ, thiếu thì thêm
  const idNv: Record<string, number> = {}; const idBt: Record<string, number> = {};
  const nvCu = capNhat ? await q(sql`SELECT id FROM xv_nhan_vat WHERE phim_id = ${phimId} ORDER BY id`) : [];
  for (const [i, v] of t.nhan_vat.entries()) {
    const cu = nvCu[i];
    if (cu) await db.execute(sql`UPDATE xv_nhan_vat SET loai = ${v.loai}, ten = ${v.ten}, mo_ta = ${v.mo_ta}, anh_ref = ${JSON.stringify(v.anh_ref ?? [])}::jsonb, giong = ${v.giong ?? ''}, updated_at = now() WHERE id = ${Number(cu.id)}`);
    const id = cu ? Number(cu.id) : Number((await q(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, anh_ref, giong) VALUES (${phimId}, ${v.loai}, ${v.ten}, ${v.mo_ta}, ${JSON.stringify(v.anh_ref ?? [])}::jsonb, ${v.giong ?? ''}) RETURNING id`))[0]!.id);
    idNv[v.key] = id;
    const btCu = capNhat ? await q(sql`SELECT id FROM xv_bien_the WHERE nhan_vat_id = ${id} ORDER BY id`) : [];
    for (const [j, b] of (v.bien_the ?? []).entries()) {
      const c = btCu[j];
      if (c) await db.execute(sql`UPDATE xv_bien_the SET nhom = ${b.nhom}, ten = ${b.ten}, mo_ta = ${b.mo_ta}, anh_url = ${b.anh_url ?? null}, updated_at = now() WHERE id = ${Number(c.id)}`);
      idBt[b.key] = c ? Number(c.id) : Number((await q(sql`INSERT INTO xv_bien_the (nhan_vat_id, nhom, ten, mo_ta, anh_url) VALUES (${id}, ${b.nhom}, ${b.ten}, ${b.mo_ta}, ${b.anh_url ?? null}) RETURNING id`))[0]!.id);
    }
  }
  let tapId: number;
  if (capNhat) {
    tapId = Number((await q(sql`SELECT id FROM xv_tap WHERE phim_id = ${phimId} ORDER BY so LIMIT 1`))[0]!.id);
    const so = Number((await q(sql`SELECT count(*) n FROM xv_canh WHERE tap_id = ${tapId}`))[0]!.n);
    if (so !== t.shots.length) throw new Error(`${t.key}: template có ${so} shot, tệp có ${t.shots.length} — không đồng bộ được, dựng lại bằng --lai`);
    await db.execute(sql`UPDATE xv_tap SET ten = ${t.tap.ten}, brief = ${t.tap.brief}, thoi_luong_s = ${giay}, beats = ${JSON.stringify(beats)}::jsonb, phan_canh = ${JSON.stringify(phan_canh)}::jsonb, lop = ${JSON.stringify(nhan.lop)}::jsonb, updated_at = now() WHERE id = ${tapId}`);
    await db.execute(sql`UPDATE xv_phim SET kinh_thanh = jsonb_set(kinh_thanh, '{qc,kieu_chu}', ${JSON.stringify(t.kinh_thanh.qc?.kieu_chu ?? {})}::jsonb), updated_at = now() WHERE id = ${phimId}`);
  } else tapId = Number((await q(sql`INSERT INTO xv_tap (phim_id, so, ten, brief, thoi_luong_s, beats, phan_canh, lop) VALUES (${phimId}, 1, ${t.tap.ten}, ${t.tap.brief}, ${giay}, ${JSON.stringify(beats)}::jsonb, ${JSON.stringify(phan_canh)}::jsonb, ${JSON.stringify(nhan.lop)}::jsonb) RETURNING id`))[0]!.id);
  const kt = kyThuat(t.shots).map((k, i) => ({ ...k, am_thanh: nhan.am[i] }));
  for (const [i, s] of t.shots.entries()) {
    const thoai: DongThoai[] = s.loi ? [{ nhan_vat: s.noi ?? '', dien_xuat: s.dien_xuat ?? '', loi: s.loi, url: null, tre: 0.2 }] : [];
    const nv = (s.nv ?? []).map((k) => { if (!idNv[k]) throw new Error(`${t.key} shot ${i + 1}: anchor ${k} không có`); return idNv[k]!; });
    const bt = (s.bt ?? []).map((k) => { if (!idBt[k]) throw new Error(`${t.key} shot ${i + 1}: biến thể ${k} không có`); return idBt[k]!; });
    // End card phải mang tên sản phẩm: thiếu thì người xem QC không biết tìm mua gì (#35 bị chấm lệch ý QC vì đúng lỗi này, 15/10/2026).
    if (s.loai === 'end_card' && !timO(s.chu_man).includes('san_pham')) throw new Error(`${t.key} shot ${i + 1}: end card chưa có ô {{san_pham}} trong chữ màn`);
    const thieu = cauThieuNguon({ chu_man: s.chu_man, thoai, tham_khao: s.tk });
    if (thieu.length) throw new Error(`${t.key} shot ${i + 1}: câu cố định chưa có nguồn tham khảo (tk) — ${thieu.map((x) => `“${x}”`).join(', ')}; đổi thành ô hoặc gắn lời khách / QC thắng`);
    const v = { canh: s.canh ?? `Shot ${i + 1} · ${s.loai}`, kf: s.keyframe ?? null, tt: s.keyframe ? 'co_keyframe' : 'nhap' };
    if (capNhat) await db.execute(sql`UPDATE xv_canh SET canh = ${v.canh}, goc_may = ${s.goc_may}, hanh_dong = ${s.hanh_dong}, loi_thoai = ${ghepThoai(thoai)}, thoai = ${JSON.stringify(thoai)}::jsonb,
        thoi_luong_s = ${Math.max(2, Math.ceil(s.giay))}, phat_s = ${s.giay}, nhan_vat = ${JSON.stringify(nv)}::jsonb, bien_the = ${JSON.stringify(bt)}::jsonb, prompt_anh = ${s.prompt_anh ?? ''}, prompt_video = ${s.prompt_video ?? ''},
        phan_doan = ${s.loai}, cam_xuc = ${CAM_XUC_THEO_LOAI[s.loai] ?? 0}, ky_thuat = ${JSON.stringify(kt[i])}::jsonb, chu_man = ${s.chu_man}, kieu_chu = ${JSON.stringify(s.kieu ?? (laShotCta(s.loai) ? CTA_MAC_DINH.kieu : {}))}::jsonb, tham_khao = ${JSON.stringify(s.tk ?? [])}::jsonb, keyframe_url = ${v.kf}, keyframe_uv = ${JSON.stringify(v.kf ? [v.kf] : [])}::jsonb, trang_thai = ${v.tt}, updated_at = now()
      WHERE tap_id = ${tapId} AND thu_tu = ${i + 1}`);
    else await db.execute(sql`INSERT INTO xv_canh (tap_id, thu_tu, canh, goc_may, hanh_dong, loi_thoai, thoai, am_thanh, thoi_luong_s, phat_s, nhan_vat, bien_the, prompt_anh, prompt_video, phan_doan, cam_xuc, ky_thuat, trang_phuc, chu_man, kieu_chu, tham_khao, keyframe_url, keyframe_uv, trang_thai)
      VALUES (${tapId}, ${i + 1}, ${v.canh}, ${s.goc_may}, ${s.hanh_dong}, ${ghepThoai(thoai)}, ${JSON.stringify(thoai)}::jsonb, '', ${Math.max(2, Math.ceil(s.giay))}, ${s.giay},
        ${JSON.stringify(nv)}::jsonb, ${JSON.stringify(bt)}::jsonb, ${s.prompt_anh ?? ''}, ${s.prompt_video ?? ''}, ${s.loai}, ${CAM_XUC_THEO_LOAI[s.loai] ?? 0}, ${JSON.stringify(kt[i])}::jsonb, '', ${s.chu_man}, ${JSON.stringify(s.kieu ?? (laShotCta(s.loai) ? CTA_MAC_DINH.kieu : {}))}::jsonb, ${JSON.stringify(s.tk ?? [])}::jsonb,
        ${v.kf}, ${JSON.stringify(v.kf ? [v.kf] : [])}::jsonb, ${v.tt})`);
  }
}
