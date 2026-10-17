// GHÉP ĐÈ + SỬA VÙNG bằng MẶT NẠ 3D (anh 17/10/2026: "review topview.ai… học được gì" — topview ghép ảnh sản phẩm thật vào keyframe thay vì để model vẽ, và
// sửa từng chỗ thay vì sinh lại cả video). Studio mình có lợi thế họ không có: khung 3D cho sẵn mặt nạ từng vật (vật đứng trước tự che) + 4 góc phối cảnh
// (dung-set.py › ve_mat_na → khung_xam.mat_na).
//   · ghepNhanDang (0đ) — dán ĐÚNG ảnh chuẩn (vat.anh) lên màn chiếu / tranh / bảng chỉ dẫn của keyframe theo phối cảnh 3D, chỉ trong mặt nạ → hết chữ bậy
//     (tập 122 #20 "Antovate-shiro"), người đứng trước màn vẫn nguyên.
//   · suaVung (FLUX Fill, ~$0,05) — vẽ lại MỘT vùng (thân một người: áo sai màu #12) theo mô tả sổ người, phần còn lại giữ y.
// Kết quả thành ứng viên mới (keyframe_uv) + ảnh chọn; ảnh cũ vẫn nằm trong ứng viên.
import 'server-only';
import { sql } from 'drizzle-orm';
import sharp from 'sharp';
import { boiCanhCanh, taoJob, xongJob, type Db, type Row } from './doc-db';
import { uploadToR2 } from '../r2';
import { chayAnhFal, modelFal } from './fal';
import { bienTheTheoSo } from './bo-set-3d';
import { dongPhang } from './dong-phang';

type Kq<T> = { ok: true; data: T } | { ok: false; loi: string };
const taiAnh = async (u: string) => { const r = await fetch(u); if (!r.ok) throw new Error(`không tải được ${u} (${r.status})`); return Buffer.from(await r.arrayBuffer()); };
const rgba = async (b: Buffer, w?: number, h?: number) => { const x = sharp(b).ensureAlpha(); const r = await (w && h ? x.resize(w, h, { fit: 'fill' }) : x).raw().toBuffer({ resolveWithObject: true }); return { d: r.data, w: r.info.width, h: r.info.height }; };

async function luuUngVien(db: Db, canhId: number, buf: Buffer, duoi: string): Promise<string | null> {
  const url = await uploadToR2(`xuong-video/keyframe/${canhId}-${duoi}-${Date.now()}.jpg`, buf, 'image/jpeg');
  if (!url) return null;
  await db.execute(sql`UPDATE xv_canh SET keyframe_uv = coalesce(keyframe_uv, '[]'::jsonb) || ${JSON.stringify([url])}::jsonb, keyframe_url = ${url}, updated_at = now() WHERE id = ${canhId}`);
  return url;
}

/** GHÉP ĐÈ mọi đồ nhận dạng có ảnh chuẩn trong khung (0đ). */
export async function ghepNhanDang(db: Db, canhId: number): Promise<Kq<{ url: string; vat: string[] }>> {
  const bc = await boiCanhCanh(db, canhId); if (!bc?.canh.keyframe_url) return { ok: false, loi: 'shot chưa có keyframe' };
  const mn = Object.entries(bc.canh.khung_xam?.mat_na ?? {}).filter(([k, v]) => k.startsWith('nd:') && (v.goc?.length ?? 0) >= 4 && v.goc!.every((g) => g.uv));
  if (!mn.length) return { ok: false, loi: 'khung 3D không có đồ nhận dạng nào lọt khung (hoặc khung 3D cũ chưa có mặt nạ — dựng lại 3D)' };
  const vatSet = ((await db.execute(sql`SELECT du_lieu->'vat' AS vat FROM xv_bo_set WHERE phim_id = (SELECT p.id FROM xv_phim p JOIN xv_tap t ON t.phim_id = p.id WHERE t.id = ${bc.canh.tap_id})`)) as unknown as Row[]).flatMap((r) => (r.vat ?? []) as { ten: string; anh?: string }[]);
  const kf = await rgba(await taiAnh(bc.canh.keyframe_url)); const W = kf.w, H = kf.h; const ra = Buffer.from(kf.d);
  // VÙNG NGƯỜI nới rộng (6% bề ngang) bị TRỪ khỏi chỗ ghép: người trong ảnh AI không đứng y chỗ ma-nơ-canh 3D — ghép theo mặt nạ trơn thì biểu đồ đè lên
  // mặt Thần (#20 lần thử đầu). Chỉ dán lên phần đồ nhận dạng chắc chắn không có người.
  const nguoi = Object.entries(bc.canh.khung_xam?.mat_na ?? {}).filter(([k]) => k.startsWith('ng:'));
  const tru = new Uint8Array(W * H);
  for (const [, v] of nguoi) {
    const m = await sharp(await taiAnh(v.url)).resize(W, H, { fit: 'fill' }).greyscale().blur(Math.max(2, Math.round(W * 0.03))).threshold(8).raw().toBuffer();
    for (let i = 0; i < W * H; i++) if (m[i]! > 127) tru[i] = 1;
  }
  const xong: string[] = [];
  for (const [k, v] of mn) {
    const ten = k.slice(3); const anh = vatSet.find((x) => x.ten === ten)?.anh; if (!anh) continue;
    const ref = await rgba(await taiAnh(anh)); const m = await rgba(await taiAnh(v.url), W, H);
    const Hm = dongPhang(v.goc!.map((g) => ({ x: g.p[0]! * W, y: g.p[1]! * H, u: g.uv![0]! * (ref.w - 1), v: g.uv![1]! * (ref.h - 1) }))); if (!Hm) continue;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (tru[y * W + x]) continue;
      const i = (y * W + x) * 4; const a = m.d[i]! / 255; if (a < 0.02) continue;
      const z = Hm[6]! * x + Hm[7]! * y + 1; const u = (Hm[0]! * x + Hm[1]! * y + Hm[2]!) / z, vv = (Hm[3]! * x + Hm[4]! * y + Hm[5]!) / z;
      if (u < 0 || vv < 0 || u > ref.w - 1 || vv > ref.h - 1) continue;
      const x0 = Math.floor(u), y0 = Math.floor(vv), fx = u - x0, fy = vv - y0, x1 = Math.min(x0 + 1, ref.w - 1), y1 = Math.min(y0 + 1, ref.h - 1);
      for (let c = 0; c < 3; c++) {
        const p = (yy: number, xx: number) => ref.d[(yy * ref.w + xx) * 4 + c]!;
        const s = p(y0, x0) * (1 - fx) * (1 - fy) + p(y0, x1) * fx * (1 - fy) + p(y1, x0) * (1 - fx) * fy + p(y1, x1) * fx * fy;
        ra[i + c] = Math.round(ra[i + c]! * (1 - a) + s * a);
      }
    }
    xong.push(ten);
  }
  if (!xong.length) return { ok: false, loi: 'đồ nhận dạng trong khung chưa có ảnh chuẩn (scripts/sinh-anh-set.mts)' };
  const url = await luuUngVien(db, canhId, await sharp(ra, { raw: { width: W, height: H, channels: 4 } }).jpeg({ quality: 92 }).toBuffer(), 'ghep');
  return url ? { ok: true, data: { url, vat: xong } } : { ok: false, loi: 'không đẩy được ảnh lên kho' };
}

export const MO_HINH_SUA_VUNG = 'fal-ai/flux-pro/v1/fill';
/** SỬA VÙNG thân một người theo bộ đồ sổ người (hoặc mo_ta tự ghi) — FLUX Fill với mặt nạ 3D nới 2% (viền áo không lộ đường cắt). Có job + tiền trên sổ. */
export async function suaVung(db: Db, canhId: number, ten: string, moTa?: string): Promise<Kq<{ url: string }>> {
  const bc = await boiCanhCanh(db, canhId); if (!bc?.canh.keyframe_url) return { ok: false, loi: 'shot chưa có keyframe' };
  const mn = bc.canh.khung_xam?.mat_na?.[`ng:${ten}`]; if (!mn) return { ok: false, loi: `khung 3D không có mặt nạ thân ${ten} (dựng lại 3D)` };
  const a = bc.nhanVat.find((v) => v.ten === ten); const vt = (bc.mayDu ?? bc.canh.may_3d)?.vi_tri.find((v) => v.ten === ten);
  const ao = moTa ?? (vt && a ? bienTheTheoSo(vt, a).map((b) => b.mo_ta).join('; ') : '');
  if (!ao) return { ok: false, loi: `không có bộ đồ sổ người cho ${ten} — ghi mô tả` };
  const kf = await sharp(await taiAnh(bc.canh.keyframe_url)).metadata();
  const mask = await sharp(await taiAnh(mn.url)).resize(kf.width, kf.height, { fit: 'fill' }).greyscale().blur(Math.max(2, Math.round((kf.width ?? 1000) * 0.012))).threshold(16).png().toBuffer();
  const maskUrl = await uploadToR2(`xuong-video/keyframe/${canhId}-mat-na-${Date.now()}.png`, mask, 'image/png'); if (!maskUrl) return { ok: false, loi: 'không đẩy được mặt nạ lên kho' };
  const prompt = `${ten.split(' ').pop()}'s clothing, exactly: ${ao}. Photorealistic, same light, colour grade, pose and body shape as the rest of the photo; seamless edges.`;
  const job = await taoJob(db, { nhan: `Sửa vùng (${ten}) · cảnh #${bc.canh.thu_tu}`, canh_id: canhId, loai: 'anh', provider: 'fal', model: `fal:${MO_HINH_SUA_VUNG}`, request: { dich: 'sua_vung', prompt, image: bc.canh.keyframe_url, mask: maskUrl } });
  const kq = await chayAnhFal(MO_HINH_SUA_VUNG, { prompt, image_url: bc.canh.keyframe_url, mask_url: maskUrl, num_images: 1, output_format: 'jpeg', safety_tolerance: '5' });
  if (!kq.ok) { await xongJob(db, job, { loi: kq.loi }); return kq; }
  const url = await luuUngVien(db, canhId, await sharp(kq.data).jpeg({ quality: 92 }).toBuffer(), 'sua');
  if (!url) { await xongJob(db, job, { loi: 'không đẩy được ảnh lên kho' }); return { ok: false, loi: 'không đẩy được ảnh lên kho' }; }
  await xongJob(db, job, { output_url: url, chi_phi_cents: (await modelFal(MO_HINH_SUA_VUNG))?.giaCents ?? 5 });
  return { ok: true, data: { url } };
}
