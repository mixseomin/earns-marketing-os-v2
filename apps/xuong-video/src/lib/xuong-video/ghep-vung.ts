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

/** Ảnh ghép / sửa chỉ thành ỨNG VIÊN — KHÔNG tự thành ảnh chọn (17/10/2026: lượt ghép cả tập tự chọn ảnh, 5 shot biểu đồ đè lên mặt người). Người soát
 *  ảnh rồi mới chọn (scripts/ghep-vung.mts --chon hoặc chọn trên lưới). */
async function luuUngVien(db: Db, canhId: number, buf: Buffer, duoi: string, chon = false): Promise<string | null> {
  const url = await uploadToR2(`xuong-video/keyframe/${canhId}-${duoi}-${Date.now()}.jpg`, buf, 'image/jpeg');
  if (!url) return null;
  await db.execute(sql`UPDATE xv_canh SET keyframe_uv = coalesce(keyframe_uv, '[]'::jsonb) || ${JSON.stringify([url])}::jsonb, keyframe_url = CASE WHEN ${chon} THEN ${url} ELSE keyframe_url END, updated_at = now() WHERE id = ${canhId}`);
  return url;
}

/** TÁCH NGƯỜI TRÊN CHÍNH KEYFRAME (SAM2, ~$0,002 / người): mặt nạ 3D là chỗ ma-nơ-canh, người AI vẽ lệch đi (#19 #21 mặt ở chỗ 3D là màn chiếu, #12 áo
 *  Vivian ngoài mặt nạ 3D) → lấy viền người THẬT trên ảnh. Điểm chấm: tâm mặt nạ 3D người đó (dương) + tâm người khác (âm). Trả mặt nạ W×H (1 = người). */
export const MO_HINH_TACH = 'fal-ai/sam2/image';
async function tachNguoi(db: Db, canhId: number, thuTu: number, kfUrl: string, matNa: Record<string, { url: string }>, W: number, H: number): Promise<Map<string, Uint8Array>> {
  const tam = new Map<string, [number, number]>();
  for (const [k, v] of Object.entries(matNa).filter(([k]) => k.startsWith('ngd:'))) {
    const m = await sharp(await taiAnh(v.url)).resize(W, H, { fit: 'fill' }).greyscale().raw().toBuffer();
    let sx = 0, sy = 0, n = 0; for (let i = 0; i < W * H; i++) if (m[i]! > 127) { sx += i % W; sy += Math.floor(i / W); n++; }
    if (n > W * H * 0.002) tam.set(k.slice(4), [Math.round(sx / n), Math.round(sy / n)]);
  }
  const out = new Map<string, Uint8Array>();
  for (const [ten, [x, y]] of tam) {
    const am = [...tam].filter(([t]) => t !== ten).map(([, p]) => ({ x: p[0], y: p[1], label: 0 }));
    const job = await taoJob(db, { nhan: `Tách người (${ten}) · cảnh #${thuTu}`, canh_id: canhId, loai: 'anh', provider: 'fal', model: `fal:${MO_HINH_TACH}`, request: { dich: 'tach_nguoi', image: kfUrl, prompts: [{ x, y, label: 1 }, ...am] } });
    const kq = await chayAnhFal(MO_HINH_TACH, { image_url: kfUrl, prompts: [{ x, y, label: 1 }, ...am], apply_mask: false, output_format: 'png' });
    if (!kq.ok) { await xongJob(db, job, { loi: kq.loi }); continue; }
    await xongJob(db, job, { chi_phi_cents: 0.25 });
    const m = await sharp(kq.data).resize(W, H, { fit: 'fill' }).greyscale().raw().toBuffer();
    const a = new Uint8Array(W * H); let n = 0; for (let i = 0; i < W * H; i++) if (m[i]! > 127) { a[i] = 1; n++; }
    if (n > W * H * 0.003 && n < W * H * 0.85) out.set(ten, a);   // ngoài khoảng này = SAM chấm trượt (nền / cả khung)
  }
  return out;
}

/** GHÉP ĐÈ mọi đồ nhận dạng có ảnh chuẩn trong khung (0đ + tách người ~$0,002 / người). */
export async function ghepNhanDang(db: Db, canhId: number, chon = false): Promise<Kq<{ url: string; vat: string[] }>> {
  const bc = await boiCanhCanh(db, canhId); if (!bc?.canh.keyframe_url) return { ok: false, loi: 'shot chưa có keyframe' };
  const mn = Object.entries(bc.canh.khung_xam?.mat_na ?? {}).filter(([k, v]) => k.startsWith('nd:') && (v.goc?.length ?? 0) >= 4 && v.goc!.every((g) => g.uv));
  if (!mn.length) return { ok: false, loi: 'khung 3D không có đồ nhận dạng nào lọt khung (hoặc khung 3D cũ chưa có mặt nạ — dựng lại 3D)' };
  const vatSet = ((await db.execute(sql`SELECT du_lieu->'vat' AS vat FROM xv_bo_set WHERE phim_id = (SELECT p.id FROM xv_phim p JOIN xv_tap t ON t.phim_id = p.id WHERE t.id = ${bc.canh.tap_id})`)) as unknown as Row[]).flatMap((r) => (r.vat ?? []) as { ten: string; anh?: string }[]);
  const kf = await rgba(await taiAnh(bc.canh.keyframe_url)); const W = kf.w, H = kf.h; const ra = Buffer.from(kf.d);
  // NGƯỜI THẬT TRÊN KEYFRAME (SAM2) nới 1,5% bị TRỪ khỏi chỗ dán — trước đây lấy theo 3D, người AI lệch ma-nơ-canh thì biểu đồ đè lên mặt (#19 #21 #16)
  const tru = new Uint8Array(W * H);
  const nguoiKf = await tachNguoi(db, canhId, bc.canh.thu_tu, bc.canh.keyframe_url, bc.canh.khung_xam?.mat_na ?? {}, W, H);
  if (nguoiKf.size) {
    const hop = Buffer.alloc(W * H); for (const a of nguoiKf.values()) for (let i = 0; i < W * H; i++) if (a[i]) hop[i] = 255;
    const no = await sharp(hop, { raw: { width: W, height: H, channels: 1 } }).blur(Math.max(2, Math.round(W * 0.015))).threshold(8).raw().toBuffer();
    for (let i = 0; i < W * H; i++) if (no[i]! > 127) tru[i] = 1;
  }
  const boQua: string[] = [];
  const xong: string[] = [];
  for (const [k, v] of mn) {
    const ten = k.slice(3); const anh = vatSet.find((x) => x.ten === ten)?.anh; if (!anh) continue;
    const ref = await rgba(await taiAnh(anh)); const m = await rgba(await taiAnh(v.url), W, H);
    let tong = 0; for (let i = 0; i < W * H; i++) if (m.d[i * 4]! > 127) tong++;
    if (!tong) continue;
    const Hm = dongPhang(v.goc!.map((g) => ({ x: g.p[0]! * W, y: g.p[1]! * H, u: g.uv![0]! * (ref.w - 1), v: g.uv![1]! * (ref.h - 1) }))); if (!Hm) continue;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (tru[y * W + x]) continue;   // chỗ có người thật trên keyframe
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
  if (!xong.length) return { ok: false, loi: boQua.length ? `không ghép: ${boQua.join(', ')} — để nguyên ảnh AI` : 'đồ nhận dạng lọt khung chưa có ảnh chuẩn (scripts/sinh-anh-set.mts)' };
  const url = await luuUngVien(db, canhId, await sharp(ra, { raw: { width: W, height: H, channels: 4 } }).jpeg({ quality: 92 }).toBuffer(), 'ghep', chon);
  return url ? { ok: true, data: { url, vat: xong } } : { ok: false, loi: 'không đẩy được ảnh lên kho' };
}

export const MO_HINH_SUA_VUNG = 'fal-ai/flux-pro/v1/fill';
/** SỬA VÙNG thân một người theo bộ đồ sổ người (hoặc mo_ta tự ghi) — FLUX Fill với mặt nạ 3D nới 2% (viền áo không lộ đường cắt). Có job + tiền trên sổ. */
export async function suaVung(db: Db, canhId: number, ten: string, moTa?: string, chon = false): Promise<Kq<{ url: string }>> {
  const bc = await boiCanhCanh(db, canhId); if (!bc?.canh.keyframe_url) return { ok: false, loi: 'shot chưa có keyframe' };
  const mn = bc.canh.khung_xam?.mat_na?.[`ng:${ten}`]; if (!mn) return { ok: false, loi: `khung 3D không có mặt nạ thân ${ten} (dựng lại 3D)` };
  const a = bc.nhanVat.find((v) => v.ten === ten); const vt = (bc.mayDu ?? bc.canh.may_3d)?.vi_tri.find((v) => v.ten === ten);
  const ao = moTa ?? (vt && a ? bienTheTheoSo(vt, a).map((b) => b.mo_ta).join('; ') : '');
  if (!ao) return { ok: false, loi: `không có bộ đồ sổ người cho ${ten} — ghi mô tả` };
  // ≤ 1 MP: fal tính FLUX Fill $0,05 / MP LÀM TRÒN LÊN — ảnh 768×1376 (1,06 MP) bị tính 2 MP = $0,10
  const goc = await sharp(await taiAnh(bc.canh.keyframe_url)).metadata(); const tl = Math.min(1, Math.sqrt(990_000 / ((goc.width ?? 1) * (goc.height ?? 1))));
  const kf = { width: Math.floor((goc.width ?? 768) * tl), height: Math.floor((goc.height ?? 1365) * tl) };
  const anhGui = await uploadToR2(`xuong-video/keyframe/${canhId}-goc-sua-${Date.now()}.jpg`, await sharp(await taiAnh(bc.canh.keyframe_url)).resize(kf.width, kf.height).jpeg({ quality: 92 }).toBuffer(), 'image/jpeg');
  if (!anhGui) return { ok: false, loi: 'không đẩy được ảnh lên kho' };
  // MẶT NẠ = NGƯỜI THẬT trên keyframe (SAM2, chấm từ 3D) bỏ phần đầu (18% trên cùng của hộp người) — mặt nạ 3D trơn trượt khỏi người AI (#12 lần đầu)
  const W = kf.width, H = kf.height; const ng = (await tachNguoi(db, canhId, bc.canh.thu_tu, anhGui, bc.canh.khung_xam?.mat_na ?? {}, W, H)).get(ten);   // ảnh đã thu nhỏ W×H — toạ độ điểm chấm cùng hệ
  if (!ng) return { ok: false, loi: `không tách được ${ten} trên keyframe (SAM2) — không sửa vùng mù` };
  let y0 = H, y1 = 0; for (let i = 0; i < W * H; i++) if (ng[i]) { const y = Math.floor(i / W); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const cat = y0 + Math.round((y1 - y0) * 0.18); const buf = Buffer.alloc(W * H); for (let i = 0; i < W * H; i++) if (ng[i] && Math.floor(i / W) >= cat) buf[i] = 255;
  const mask = await sharp(buf, { raw: { width: W, height: H, channels: 1 } }).blur(Math.max(2, Math.round(W * 0.012))).threshold(16).png().toBuffer();
  const maskUrl = await uploadToR2(`xuong-video/keyframe/${canhId}-mat-na-${Date.now()}.png`, mask, 'image/png'); if (!maskUrl) return { ok: false, loi: 'không đẩy được mặt nạ lên kho' };
  const prompt = `${ten.split(' ').pop()}'s clothing, exactly: ${ao}. Photorealistic, same light, colour grade, pose and body shape as the rest of the photo; seamless edges.`;
  const job = await taoJob(db, { nhan: `Sửa vùng (${ten}) · cảnh #${bc.canh.thu_tu}`, canh_id: canhId, loai: 'anh', provider: 'fal', model: `fal:${MO_HINH_SUA_VUNG}`, request: { dich: 'sua_vung', prompt, image: anhGui, mask: maskUrl } });
  const kq = await chayAnhFal(MO_HINH_SUA_VUNG, { prompt, image_url: anhGui, mask_url: maskUrl, num_images: 1, output_format: 'jpeg', safety_tolerance: '5' });
  if (!kq.ok) { await xongJob(db, job, { loi: kq.loi }); return kq; }
  const gia = (await modelFal(MO_HINH_SUA_VUNG))?.giaCents ?? 5;
  const url = await luuUngVien(db, canhId, await sharp(kq.data).jpeg({ quality: 92 }).toBuffer(), 'sua', chon);
  if (!url) { await xongJob(db, job, { loi: 'không đẩy được ảnh lên kho', chi_phi_cents: gia }); return { ok: false, loi: 'không đẩy được ảnh lên kho' }; }   // đã trả tiền → vẫn vào sổ
  await xongJob(db, job, { output_url: url, chi_phi_cents: gia });
  return { ok: true, data: { url } };
}
