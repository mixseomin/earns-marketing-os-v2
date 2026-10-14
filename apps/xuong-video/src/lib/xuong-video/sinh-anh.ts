// Sinh ảnh gốc anchor + keyframe shot — lõi dùng chung cho server action (actions.ts, đã kiểm quyền) và script trên box.
import 'server-only';
import { sql } from 'drizzle-orm';
import { dayViecAnh } from './hoan-tat';
import { promptAnhMau } from './claude';
import { promptCamXuc } from './am-thanh';
import { promptKyThuatAnh } from './dien-anh';
import { docKinhThanh, thanhPhanCanh, chanChuModel, phongCachHinh, locNhanh, noiKhungShot, camCongCuVe, laTayNguoi, MO_HINH_ANH, type KinhThanh, type NhanVat } from './kieu';
import { chanTienKy, chanShot, phimQt } from './quy-trinh';
import { promptPoster, MO_HINH_POSTER, TI_LE_POSTER, type MauPoster } from './poster';
import { boiCanhCanh, mapNhanVat, mapTap, mapCanh, kemBienThe, taoJob, jobDangCho, type Db, type Row } from './doc-db';

export type KqSinh<T> = { ok: true; data: T } | { ok: false; loi: string };

/** Prompt ảnh cuối = phong cách bộ phim + prompt cảnh + nhắc giữ đúng anchor theo ảnh tham chiếu. */
export const KHONG_CHU = 'Absolutely NO text, letters, words, numbers, captions, subtitles, labels, watermarks or logos anywhere in the image — not even product names; the frame must be clean, on-screen text is added later in post.';
export function ghepPromptAnh(prompt: string, phongCach: string, nv: NhanVat[], kyThuatAnh = '', trangPhuc = ''): string {
  // Kỹ thuật điện ảnh của shot (cỡ cảnh, góc, ống kính, ánh sáng, màu — thư viện dien-anh.ts) đứng ngay sau phong cách.
  const dong = [KHONG_CHU, phongCach ? `Visual style: ${phongCach}.` : '', kyThuatAnh ? `Cinematography: ${kyThuatAnh}.` : '', prompt.trim()];
  // DANH TÍNH ≠ TRANG PHỤC: người giữ y mặt/tóc/tuổi/dáng; quần áo theo shot nếu shot ghi trang phục. Trước đây "giữ ĐÚNG như mô tả"
  // khoá luôn bộ đồ trong mô tả anchor → shot khoe áo bra bị chồng lên áo thun (09/10/2026).
  const nguoi = nv.filter((v) => v.loai === 'nhan_vat');
  const vat = nv.filter((v) => v.loai !== 'nhan_vat');
  if (nguoi.length) {
    dong.push(trangPhuc.trim()
      ? `Keep the SAME person(s) as in the reference images — identical face, hair, age, skin and body type: ${nguoi.map((v) => `${v.ten} — ${v.mo_ta}`).join(' | ')}. CLOTHING IN THIS SHOT overrides any clothing in that description: ${trangPhuc.trim()}. Do not add any other garment or outer layer that is not stated.`
      : `Keep these people EXACTLY as described (and as shown in the reference images): ${nguoi.map((v) => `${v.ten} — ${v.mo_ta}`).join(' | ')}. Do not redesign them.`);
  }
  // Sản phẩm có ảnh tham chiếu: KHÔNG đưa tên lẫn mô tả chữ vào prompt — model vẽ tên trong ngoặc kép thành phụ đề và bám chữ tả hơn ảnh
  // (09/10/2026: "JettJeans3 - Men's…" thành chữ trên quần, quần vẽ theo chữ "denim 5 túi" thay vì ảnh). Chỉ nói: chép đúng món trong ảnh.
  const spCoAnh = vat.filter((v) => v.loai === 'san_pham' && v.anh_ref.length);
  const vatTa = vat.filter((v) => !spCoAnh.includes(v));
  // Ảnh + MÔ TẢ CHÍNH XÁC (kể cả điều cấm): chỉ ảnh thì model rơi về kiểu đồ quen ("jeans 5 túi bạc màu") khi sản phẩm chiếm góc nhỏ của ảnh
  // mẫu — thử A/B Seedream vs Nano Banana 10/10/2026, cả hai cùng sai khi bỏ mô tả. Mô tả lấy từ anchor (đã đối chiếu trang sản phẩm).
  if (spCoAnh.length) dong.push(`THE PRODUCT in this shot must be copied EXACTLY from its reference images — never a generic version. Product facts (must all hold): ${spCoAnh.map((v) => v.mo_ta).join(' | ')}`);
  if (vatTa.length) dong.push(`Keep these places / props EXACTLY as described and as in the reference images (same color, shape, details): ${vatTa.map((v) => `${v.ten} — ${v.mo_ta}`).join(' | ')}.`);
  // Chữ màn do xưởng tự vẽ lúc xuất (drawtext, đúng font) — model ảnh KHÔNG được tự vẽ phụ đề: Seedream bịa chữ giả "hử le œ hiút nốp dòos" lên keyframe (#1251).
  dong.push(KHONG_CHU);
  return dong.filter(Boolean).join(' ');
}

/** Xếp ảnh tham chiếu cho một shot: sản phẩm trước (tối đa 3 ảnh), rồi người (biến thể trước ảnh gốc), rồi bối cảnh/đạo cụ; tối đa 10.
 *  Trả kèm "bản đồ" ảnh nào là gì để model không đoán — với sản phẩm ghi rõ: vẽ ĐÚNG món trong ảnh, ảnh thắng mọi chữ mô tả. */
/** nhieuMau: shot cần thấy nhiều màu của sản phẩm (vd hai móc treo hai màu) → đưa tới 3 ảnh; còn lại CHỈ ảnh màu chính, kẻo model trộn màu
 *  (09/10/2026: đưa 3 ảnh xanh nhạt/đen/xanh vừa → shot 1 ra quần xanh đậm, rồi xanh nhạt bạc). */
export const shotNhieuMau = (prompt: string): boolean => /\b(two|three|both|several|multiple|each)\b.{0,40}\b(pairs?|colou?rs?)\b|\b(black|dark blue|navy|gray|grey|brown|medium blue)\b|colou?rs/i.test(prompt);
export function xepThamChieu(nv: NhanVat[], btCanh: (v: NhanVat) => { anh_url?: string | null } | undefined = () => undefined, nhieuMau = true): { urlRef: string[]; banDoRef: string; vai: { url: string; nhan: string }[] } {
  const vai: { url: string; nhan: string }[] = [];
  const thuTu = [...nv.filter((v) => v.loai === 'san_pham'), ...nv.filter((v) => v.loai === 'nhan_vat'), ...nv.filter((v) => v.loai !== 'san_pham' && v.loai !== 'nhan_vat')];
  const urlRef: string[] = []; const dong: string[] = [];
  for (const v of thuTu) {
    const b = btCanh(v);
    // Sản phẩm: shot chọn biến thể màu có ảnh thật (vd 'Medium Blue') → ảnh đó là màu chính; không thì ảnh đầu của anchor.
    const anh = v.loai === 'san_pham' ? (b?.anh_url ? [b.anh_url, ...(nhieuMau ? v.anh_ref.filter((u) => u !== b.anh_url).slice(0, 2) : [])] : v.anh_ref.slice(0, nhieuMau ? 3 : 1)) : [...(b?.anh_url ? [b.anh_url] : []), ...v.anh_ref.slice(0, b?.anh_url ? 1 : 2)];
    const con = Math.max(0, 10 - urlRef.length);
    const lay = anh.slice(0, con);
    if (!lay.length) continue;
    const tu = urlRef.length + 1; urlRef.push(...lay); const den = urlRef.length;
    const bt = b?.anh_url ? (v.bien_the ?? []).find((x) => x.anh_url === b.anh_url) : undefined;
    lay.forEach((u, i) => vai.push({ url: u, nhan: `${v.loai === 'san_pham' ? '👖 sản phẩm' : v.loai === 'nhan_vat' ? '🧍 người' : v.loai === 'boi_canh' ? '🏠 bối cảnh' : '🧸 đạo cụ'} · ${v.ten}${u === b?.anh_url ? ` · ${bt?.ten ?? 'biến thể'}` : ''}${v.loai === 'san_pham' && i === 0 ? ' · màu chính' : ''}` }));
    const so = tu === den ? `image ${tu}` : `images ${tu}–${den}`;
    dong.push(v.loai === 'san_pham'
      ? `${so} = THE PRODUCT: draw exactly this item — same cut, pockets, seams, hardware and fabric texture; never a generic version. ${lay.length > 1 ? `Image ${tu} shows its MAIN color — use exactly that color unless the shot names another color of the same item; the other product images show other colors of the same item.` : 'Use exactly its color.'} Where text and these images disagree, the images win. Do not write its name.`
      : v.loai === 'nhan_vat' ? `${so} = the person ${v.ten} (same face, hair, age, body).` : `${so} = ${v.loai === 'boi_canh' ? 'the location' : 'the prop'} ${v.ten}.`);
  }
  return { urlRef, banDoRef: dong.length ? `Reference images: ${dong.join(' ')}` : '', vai };
}

/** Sinh "ảnh mẫu" cho anchor từ mô tả (character sheet). Ảnh thêm vào anh_ref; các cảnh sau dùng nó làm tham chiếu. */
export async function sinhAnhGoc(db: Db, nhanVatId: number): Promise<KqSinh<number>> {
  const loi = (x: string): KqSinh<number> => ({ ok: false, loi: x });
  const r = (await db.execute(sql`SELECT v.*, p.kinh_thanh AS kt FROM xv_nhan_vat v JOIN xv_phim p ON p.id = v.phim_id WHERE v.id = ${nhanVatId}`)) as unknown as Row[];
  if (!r[0]) return loi('không thấy anchor');
  const nv = mapNhanVat(r[0]);
  if (!nv.mo_ta.trim()) return loi('anchor chưa có mô tả — tả ngoại hình/đặc tính trước rồi mới sinh ảnh mẫu');
  const kt = docKinhThanh(r[0].kt as KinhThanh);
  const chan = chanChuModel(kt.ngon_ngu, { phongCach: kt.phong_cach, anchor: [nv] });
  if (chan) return loi(chan);
  const job = await taoJob(db, { nhan: `Ảnh gốc · ${nv.ten}`, nhan_vat_id: nhanVatId, loai: 'anh', provider: 'google', model: kt.mo_hinh_anh, request: { prompt: promptAnhMau(nv, kt, nv.anh_ref.length) } });
  await dayViecAnh({ job, model: kt.mo_hinh_anh, prompt: promptAnhMau(nv, kt, nv.anh_ref.length), thamChieuUrl: nv.anh_ref.slice(0, 3), tiLe: nv.loai === 'boi_canh' ? kt.ti_le : '1:1', thuMuc: `anchor/${nhanVatId}` });
  return { ok: true, data: job };
}

/** Câu lệnh + ảnh tham chiếu sẽ gửi cho keyframe của một shot — MỘT chỗ cho lúc sinh thật và sơ đồ nguồn (so "đã gửi" với "giờ sẽ gửi"). */
export function chuanBiKeyframe(bc: NonNullable<Awaited<ReturnType<typeof boiCanhCanh>>>): { prompt: string; urlRef: string[]; vai: { url: string; nhan: string }[] } {
  // Mỗi anchor: ảnh biến thể cảnh chọn (nếu đã sinh) đứng TRƯỚC, rồi ảnh gốc — model bám biến thể mà vẫn giữ danh tính.
  const btCanh = (v: NhanVat) => (v.bien_the ?? []).find((b) => bc.canh.bien_the.includes(b.id));
  // Sản phẩm đứng ĐẦU danh sách tham chiếu (3 ảnh), rồi người/bối cảnh — và prompt nói rõ ảnh số mấy là gì, ảnh thắng chữ (#1256: quần
  // sinh ra là jeans chung chung vì ảnh sản phẩm nằm sau ảnh người, không được gọi tên, còn chữ mô tả "light blue, cúc đồng" lấn ảnh).
  const { urlRef, banDoRef, vai } = xepThamChieu(bc.nhanVat, btCanh, shotNhieuMau(`${bc.canh.prompt_anh} ${bc.canh.trang_phuc}`));
  const ghiChuBt = bc.nhanVat.map((v) => { const b = btCanh(v); return b ? `${v.ten} in this shot: ${b.mo_ta || b.ten}.` : ''; }).filter(Boolean).join(' ');
  // LIỀN MÁY: shot trước chọn chuyển cảnh 'lien_may' → clip của nó kết bằng ảnh này, nên ảnh này phải là giây kế tiếp của chính khung đó
  // (cùng nơi, cùng phía máy, vị trí + đồ vật + trạng thái nối tiếp) — keyframe shot trước làm ảnh tham chiếu cuối (Tango & Lint tập 1: 0/20
  // clip nối khung, shot sau không thấy liên quan shot trước).
  const tr = bc.truoc;
  const noi = tr?.keyframe_url && noiKhungShot(false, tr) && urlRef.length < 10 ? tr.keyframe_url : null;
  if (noi) { urlRef.push(noi); vai.push({ url: noi, nhan: `⛓ khung shot #${tr!.thu_tu} (liền máy)` }); }
  const noiChu = noi ? `Image ${urlRef.length} = the frame just before this one (the same continuous moment): keep the same place, camera side, lighting, and every character's and object's position and state; show only the next instant of the action described.` : '';
  // Thẻ shot: bố cục 3 lớp + trạng thái MỞ + hướng — keyframe là khung đầu của shot.
  const dd = bc.canh.dan_dung ?? {};
  const theChu = [dd.bo_cuc?.trim() && `Composition (foreground / midground / background): ${dd.bo_cuc.trim()}`, dd.mo?.trim() && `This frame is the START of the shot: ${dd.mo.trim()}`, dd.huong?.trim() && `Eyelines and screen direction: ${dd.huong.trim()}`].filter(Boolean).map((x) => `${x}.`).join(' ');
  // Cấm tay người / dụng cụ vẽ lạc khung — CÙNG luật với prompt video (kieu.ts › camCongCuVe); trước đây chỉ video có, keyframe thì không.
  const prompt = [ghepPromptAnh(bc.canh.prompt_anh, phongCachHinh(bc.kt.phong_cach), bc.nhanVat, promptKyThuatAnh(bc.canh.ky_thuat), bc.canh.trang_phuc), camCongCuVe(bc.kt.phong_cach, laTayNguoi(bc.nhanVat)), theChu, banDoRef, noiChu, ghiChuBt, promptCamXuc(bc.canh, bc.nhanVat, 'anh')].filter(Boolean).join(' ');
  return { prompt, urlRef, vai };
}

/** MỌI lý do chặn sinh keyframe của một shot — quy trình cấp tập (brief, khung truyện, phân cảnh, phong cách, người xem hiểu, kịch bản series)
 *  + cấp shot (phân cảnh, mẫu, cỡ cảnh) + prompt + ngôn ngữ + thành phần. MỘT chỗ cho nút sinh và script kiểm (kiem-cong-shot.mts): trước đây
 *  script tự lắp lại danh sách cổng, lệch dần với nút. */
export async function lyChanKeyframe(db: Db, canhId: number): Promise<{ bc: NonNullable<Awaited<ReturnType<typeof boiCanhCanh>>>; chan: string[] } | null> {
  const bc = await boiCanhCanh(db, canhId);
  if (!bc) return null;
  const tapQt = mapTap(((await db.execute(sql`SELECT * FROM xv_tap WHERE id = ${bc.canh.tap_id}`)) as unknown as Row[])[0]!);
  const nvPhim = await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${tapQt.phim_id} ORDER BY id`)) as unknown as Row[]).map(mapNhanVat));
  const tatCa = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${bc.canh.tap_id} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh);
  const chan: string[] = [];
  const qt = [...chanTienKy(tapQt, phimQt(String(((await db.execute(sql`SELECT loai FROM xv_phim WHERE id = ${tapQt.phim_id}`)) as unknown as Row[])[0]?.loai ?? 'phim'), bc.kt), locNhanh(tatCa, bc.canh.nhanh || 'A'), locNhanh(tatCa, 'A'), nvPhim.filter((v) => v.loai === 'boi_canh').map((v) => v.id)), ...chanShot(bc.canh, tapQt, nvPhim)];
  if (qt.length) chan.push(`Shot #${bc.canh.thu_tu} chưa qua quy trình: ${qt.join('; ')}`);
  if (!bc.canh.prompt_anh.trim()) chan.push('cảnh chưa có prompt ảnh');
  const cm = chanChuModel(bc.kt.ngon_ngu, { phongCach: bc.kt.phong_cach, shot: bc.canh, anchor: bc.nhanVat });
  if (cm) chan.push(cm);
  const tp = thanhPhanCanh(bc.canh, bc.nhanVat);
  if (tp.thieu.length) chan.push(`Chưa chuẩn bị đủ thành phần: ${tp.thieu.join('; ')}. Làm ở tab 🎭 Phim (Tuyến nhân vật) rồi sinh lại.`);
  return { bc, chan };
}

/** Sinh keyframe: `so` ứng viên (1-3), nối vào keyframe_uv; cảnh chưa có ảnh chọn thì tự chọn ảnh đầu. Mọi cổng ở lyChanKeyframe. */
export async function sinhKeyframeCanh(db: Db, canhId: number, so = 1, moHinh?: string): Promise<KqSinh<number[]>> {
  const loi = (x: string): KqSinh<number[]> => ({ ok: false, loi: x });
  const g = await lyChanKeyframe(db, canhId);
  if (!g) return loi('không thấy cảnh');
  if (g.chan.length) return loi(g.chan.join(' · '));
  const { bc } = g;
  if (moHinh && (moHinh.startsWith('fal:') || MO_HINH_ANH.some((m) => m.key === moHinh))) bc.kt.mo_hinh_anh = moHinh as typeof bc.kt.mo_hinh_anh;
  await db.execute(sql`UPDATE xv_canh SET loi = '' WHERE id = ${canhId}`);
  const { prompt, urlRef } = chuanBiKeyframe(bc);
  const jobs: number[] = [];
  for (let i = 0; i < Math.max(1, Math.min(3, so)); i++) {
    const job = await taoJob(db, { nhan: `Keyframe · cảnh #${bc.canh.thu_tu} ${bc.canh.canh}`, canh_id: canhId, loai: 'anh', provider: 'google', model: bc.kt.mo_hinh_anh, request: { prompt, thamChieu: urlRef.length, thamChieuUrl: urlRef } });
    jobs.push(job);
    await dayViecAnh({ job, model: bc.kt.mo_hinh_anh, prompt, thamChieuUrl: urlRef, tiLe: bc.kt.ti_le, thuMuc: `keyframe/${canhId}` });
  }
  return { ok: true, data: jobs };
}

/** Sinh MỘT poster cho phim (poster.ts): nhân vật chính theo ảnh mẫu anchor, đúng phong cách, tên phim là chữ duy nhất. Kết quả nối vào
 *  xv_phim.poster_uv; phim chưa có poster thì bản đầu thành poster đang dùng (hoan-tat.ts). */
export async function sinhPosterPhim(db: Db, phimId: number, yTuong = '', mau: MauPoster | '' = ''): Promise<KqSinh<number>> {
  const loi = (x: string): KqSinh<number> => ({ ok: false, loi: x });
  const p = ((await db.execute(sql`SELECT id, ten, mo_ta, loai, kinh_thanh FROM xv_phim WHERE id = ${phimId}`)) as unknown as Row[])[0];
  if (!p) return loi('không thấy phim');
  const nv = ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${phimId} ORDER BY id`)) as unknown as Row[]).map(mapNhanVat);
  const phim = { ten: String(p.ten ?? ''), mo_ta: String(p.mo_ta ?? ''), loai: p.loai as 'phim', kinh_thanh: (p.kinh_thanh ?? {}) as KinhThanh };
  if (!nv.some((v) => v.anh_ref.length)) return loi('phim chưa có anchor nào có ảnh mẫu — sinh ảnh mẫu nhân vật ở mục 2 trước, poster cần nó để giữ đúng mặt');
  const dang = (await db.execute(sql`SELECT 1 FROM xv_job WHERE phim_id = ${phimId} AND request->>'dich' = 'poster' AND ${jobDangCho()} LIMIT 1`)) as unknown as Row[];
  if (dang.length) return loi('đang sinh poster — đợi xong rồi mới sinh thêm');
  const kt = docKinhThanh(phim.kinh_thanh);
  const { prompt, thamChieuUrl } = promptPoster(phim, nv, yTuong, mau);
  const chan = chanChuModel(kt.ngon_ngu, { phongCach: kt.phong_cach, anchor: nv.filter((v) => v.anh_ref.length) });
  if (chan) return loi(chan);
  const job = await taoJob(db, { phim_id: phimId, nhan: `Poster · ${phim.ten}`, loai: 'anh', provider: 'google', model: MO_HINH_POSTER, request: { dich: 'poster', mau, prompt, thamChieu: thamChieuUrl.length, thamChieuUrl } });
  await dayViecAnh({ job, model: MO_HINH_POSTER, prompt, thamChieuUrl, tiLe: TI_LE_POSTER, thuMuc: `poster/${phimId}` });
  return { ok: true, data: job };
}
