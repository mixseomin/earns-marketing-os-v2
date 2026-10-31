// Sinh ảnh gốc anchor + keyframe shot — lõi dùng chung cho server action (actions.ts, đã kiểm quyền) và script trên box.
import 'server-only';
import { kgCua, loiMachTap2d, nguoiNgoai, sdLuc, type ShotKg } from './khong-gian';
import { cauBoiCanhCoDinh } from './so-do-canh';
import { doiTayDo, cauDoiTayKet, thieuCachThao } from './thao-do';
import { sql } from 'drizzle-orm';
import { dayViecAnh, giaAnhSv } from './hoan-tat';
import { promptAnhMau, promptBienThe } from './claude';
import { promptCatNen, MAU_XANH_NEN } from './cat-nen';
import { promptCamXuc } from './am-thanh';
import { promptBieuCam, cauNuocMat } from './qc-cam-xuc';
import { promptKyThuatAnh } from './dien-anh';
import { chatLieuPhim, docKinhThanh, thanhPhanCanh, chanChuModel, phongCachHinh, locNhanh, noiKhungShot, camCongCuVe, laTayNguoi, MO_HINH_ANH, type BienThe, type Canh, type KhungXam, type KinhThanh, type May3d, type NhanVat } from './kieu';
import { damBaoAnhMat, demMat } from './soi-mat';
import { cauHoiKhung } from './cau-hoi-khung';
import { chanTienKy, chanShot, phimQt } from './quy-trinh';
import { promptPoster, MO_HINH_POSTER, TI_LE_POSTER, type MauPoster } from './poster';
import { promptAnhQc, sanPhamAnhQc, type AnhQc } from './anh-qc';
import { bienTheTheoSo, boCauMay, boSetCuaShot, catMep, chanKhungXam, chuTheThay, doiTuongThieu, huongVoiMay, KHOA_LOOK, nhinCau, loiMachTap, moTaThay, PT_THAY, shotSoTruc, thayRo, trangThaiVat } from './bo-set-3d';
import { mapBoSet } from './bo-set-3d-may';
import { LA_NHAN_DANG, loiAi3d } from './kiem-ai-3d';
import { loiTrangThaiVat, boMat, chamPrompt, dauBoiCanh, NGUONG_CHAN, noiChonPhongCach, TU_TOI_DA_FLUX, type LoiPrompt, type SoatPrompt } from './kiem-prompt';
import { cauAnhSet, CHAT_LIEU, chuNguoi, ghep, goiTenEn, hanhDongTrongMoTa, khoi, KHONG_THEM_ANH, KHONG_THEM_FLUX, KHUON, soNguoiCau, tuTheEn, type DuongSinh, type Khoi } from './prompt-khoi';
import { kiemBangTrangPhuc, docBangTrangPhuc } from './bang-trang-phuc';
import { boiCanhCanh, canhDaThayThe, mapBienThe, mapNhanVat, mapTap, mapCanh, kemBienThe, taoJob, xongJob, jobDangCho, type Db, type Row } from './doc-db';
import { chayAnhFal, modelFal } from './fal';
import { sinhAnh, taiAnhBase64 } from './google';
import { uploadToR2 } from '../r2';
import { TOI_DA_REF, type CongKey } from './cong-ai';

export type KqSinh<T> = { ok: true; data: T } | { ok: false; loi: string };

/** Prompt ảnh cuối = phong cách bộ phim + prompt cảnh + nhắc giữ đúng anchor theo ảnh tham chiếu. */
/** Người đã có LoRA: mặt trên ảnh FLUX đã đúng — lượt Nano chỉ được sửa trang phục / phụ kiện / đồ cầm theo ảnh mẫu. */
export const KHOA_MAT_LORA = 'The FACE in Image 1 is already the right person: keep the face, identity, hair, expression and pose exactly as they are; change only clothing, stains, accessories and held objects to match the reference images.';
/** Shot cần keyframe KẾT (tốn tiền): có khung màu kết VÀ khung thật sự đổi trong clip. Từ BAN_DUNG 82 mọi shot có khung kết để xem trên storyboard. */
export const canKeyframeKet = (kx: { mau_ket?: string; ket_dong?: boolean } | null | undefined): boolean => !!kx?.mau_ket && kx.ket_dong !== false;
export const KHONG_CHU = 'No text, letters, numbers, captions, watermarks or logos anywhere in the image.';
/** CHỮ TRONG THẾ GIỚI PHIM (anh 19/10/2026: "chữ của film sao lại có luật cấm chữ?"): biển "LU GROUP" ở sảnh, màn chiếu "HARRINGTON FUND · LU GROUP"…
 *  là một phần bối cảnh, không phải phụ đề. Luật cũ (09/10/2026 #1251: Seedream bịa chữ giả / phụ đề lên khung; 18/10 biển méo "B-GROP") cấm mọi chữ
 *  → phim mất biển hiệu. Giờ: chữ được KHAI trong ngoặc kép ở mô tả (en) của món set có trong khung là chữ phim — cho hiện ĐÚNG chính tả đó; phụ đề,
 *  chú thích, watermark và mọi chữ không khai vẫn cấm (chữ màn do xưởng vẽ lúc xuất). */
export const chuTrongKhung = (moTa: string[]): string[] => [...new Set(moTa.flatMap((t) => [...t.matchAll(/["“]([^"”]{1,60})["”]/g)].map((m) => m[1]!.trim())).filter(Boolean))];
export const camChu = (cho: string[] = []): string => cho.length
  ? `The ONLY lettering allowed anywhere in the image is the in-world signage ${cho.map((c) => `"${c}"`).join(', ')} — spelled exactly like that, crisp and correct, nothing added. No captions, subtitles, watermarks, labels or any other text, letters or numbers anywhere.`
  : KHONG_CHU;
export function ghepPromptAnh(prompt: string, phongCach: string, nv: NhanVat[], kyThuatAnh = '', trangPhuc = '', cam = KHONG_CHU): string {
  // Kỹ thuật điện ảnh của shot (cỡ cảnh, góc, ống kính, ánh sáng, màu — thư viện dien-anh.ts) đứng ngay sau phong cách.
  const dong = [cam, phongCach ? `Visual style: ${phongCach}.` : '', kyThuatAnh ? `Cinematography: ${kyThuatAnh}.` : '', prompt.trim()];
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
  dong.push(cam);
  return dong.filter(Boolean).join(' ');
}

/** Xếp ảnh tham chiếu cho một shot: sản phẩm trước (tối đa 3 ảnh), rồi người (biến thể trước ảnh gốc), rồi bối cảnh/đạo cụ; tối đa 10.
 *  Trả kèm "bản đồ" ảnh nào là gì để model không đoán — với sản phẩm ghi rõ: vẽ ĐÚNG món trong ảnh, ảnh thắng mọi chữ mô tả. */
/** nhieuMau: shot cần thấy nhiều màu của sản phẩm (vd hai móc treo hai màu) → đưa tới 3 ảnh; còn lại CHỈ ảnh màu chính, kẻo model trộn màu
 *  (09/10/2026: đưa 3 ảnh xanh nhạt/đen/xanh vừa → shot 1 ra quần xanh đậm, rồi xanh nhạt bạc). */
export const shotNhieuMau = (prompt: string): boolean => /\b(two|three|both|several|multiple|each)\b.{0,40}\b(pairs?|colou?rs?)\b|\b(black|dark blue|navy|gray|grey|brown|medium blue)\b|colou?rs/i.test(prompt);
/** toiDa = số ảnh tối đa cổng ảnh nhận (cong-ai.ts › TOI_DA_REF, tính cả ảnh đứng trước). Vượt thì xếp lại GỌN: mỗi người chỉ ảnh sát mặt + biến thể
 *  trang phục (bỏ ảnh toàn thân thừa) — thay vì cổng từ chối cả shot (#322 #5 23/10/2026: 9 ảnh > PlenX 8) hoặc cắt đuôi mất đạo cụ. */
export function xepThamChieu(nv: NhanVat[], btCanh: (v: NhanVat) => { anh_url?: string | null } | undefined = () => undefined, nhieuMau = true, truoc = 0, toiDa = 10, gon: 0 | 1 | 2 = 0): { urlRef: string[]; banDoRef: string; vai: { url: string; nhan: string }[] } {
  const vai: { url: string; nhan: string }[] = [];
  const thuTu = [...nv.filter((v) => v.loai === 'san_pham'), ...nv.filter((v) => v.loai === 'nhan_vat'), ...nv.filter((v) => v.loai !== 'san_pham' && v.loai !== 'nhan_vat')];
  const urlRef: string[] = []; const dong: string[] = [];
  for (const v of thuTu) {
    const b = btCanh(v);
    // Sản phẩm: shot chọn biến thể màu có ảnh thật (vd 'Medium Blue') → ảnh đó là màu chính; không thì ảnh đầu của anchor.
    // Người (phim người thật): ảnh SÁT MẶT đứng đầu — mô hình bám mặt theo số điểm ảnh của mặt, bảng nhân vật cả người thì mặt chỉ vài chục px.
    const mat = v.loai === 'nhan_vat' ? (v.anh_mat?.url ?? []).slice(0, 1) : [];
    const anh = v.loai === 'san_pham' ? (b?.anh_url ? [b.anh_url, ...(nhieuMau ? v.anh_ref.filter((u) => u !== b.anh_url).slice(0, 2) : [])] : v.anh_ref.slice(0, nhieuMau ? 3 : 1))
      : gon ? [...mat, ...(b?.anh_url ? [b.anh_url] : []), ...v.anh_ref.slice(0, 1)].slice(0, gon === 2 ? 1 : 2) : [...mat, ...(b?.anh_url ? [b.anh_url] : []), ...v.anh_ref.slice(0, b?.anh_url ? 1 : 2)];
    const con = Math.max(0, 10 - truoc - urlRef.length);
    const lay = anh.slice(0, con);
    if (!lay.length) continue;
    const tu = truoc + urlRef.length + 1; urlRef.push(...lay); const den = truoc + urlRef.length;   // truoc = số ảnh đứng trước (khung xám là ảnh 1)
    const bt = b?.anh_url ? (v.bien_the ?? []).find((x) => x.anh_url === b.anh_url) : undefined;
    lay.forEach((u, i) => vai.push({ url: u, nhan: `${v.loai === 'san_pham' ? '👖 sản phẩm' : v.loai === 'nhan_vat' ? '🧍 người' : v.loai === 'boi_canh' ? '🏠 bối cảnh' : '🧸 đạo cụ'} · ${v.ten}${u === b?.anh_url ? ` · ${bt?.ten ?? 'biến thể'}` : ''}${v.loai === 'san_pham' && i === 0 ? ' · màu chính' : ''}` }));
    const so = tu === den ? `image ${tu}` : `images ${tu}–${den}`;
    dong.push(v.loai === 'san_pham'
      ? `${so} = THE PRODUCT: draw exactly this item — same cut, pockets, seams, hardware and fabric texture; never a generic version. ${lay.length > 1 ? `Image ${tu} shows its MAIN color — use exactly that color unless the shot names another color of the same item; the other product images show other colors of the same item.` : 'Use exactly its color.'} Where text and these images disagree, the images win. Do not write its name.`
      : v.loai === 'nhan_vat' ? `${so} = the person ${v.ten} (same face, hair, age, body).${mat.length && lay[0] === mat[0] ? ` Image ${tu} is a CLOSE-UP of ${v.ten}'s face: the face in the new image must be this exact person — same bone structure, eyes, nose, mouth, hairline and skin; only the expression may change.` : ''}` : `${so} = ${v.loai === 'boi_canh' ? 'the location' : 'the prop'} ${v.ten}.`);
  }
  // nấc 1: mỗi người mặt + trang phục; nấc 2 (khung đông người, #353 #11 ba người + bối cảnh + đồ = 9 > 8): mỗi người chỉ một ảnh
  if (gon < 2 && truoc + urlRef.length > toiDa) return xepThamChieu(nv, btCanh, nhieuMau, truoc, toiDa, (gon + 1) as 1 | 2);
  return { urlRef, banDoRef: dong.length ? `Reference images: ${dong.join(' ')}` : '', vai };
}

/** Sinh "ảnh mẫu" cho anchor từ mô tả (character sheet). Ảnh thêm vào anh_ref; các cảnh sau dùng nó làm tham chiếu.
 *  so = số ảnh một lượt (#1351, anh 13/10/2026: "mỗi lần sinh cần thêm vài góc khác chứ không chỉ một góc chính"): ảnh thứ k lấy góc thứ
 *  (đã có + k) trong claude.ts › GOC_THEM — lần đầu = ảnh chính + các góc phụ, lần sau = các góc chưa có. Trả job đầu tiên. */
/** ẢNH MẶT QUAY TRÁI / PHẢI cho nhân vật người (anh 19/10/2026 "sinh đủ ảnh đi"): ảnh mẫu chỉ có mặt nhìn thẳng thì 🩹 sửa hướng nhìn không có ảnh
 *  cùng phía để đưa mô hình (soi-mat.ts › keHoachSuaMat) — mô hình chép luôn ánh mắt nhìn ống kính của ảnh mẫu. Chân dung đầu–vai quay 3/4 về bên trái /
 *  phải NGƯỜI XEM, mắt nhìn tiếp về phía đó, nền xám trơn. Ảnh về nối CUỐI anh_ref (hoan-tat.ts › 'mat_goc') — ảnh mẫu chính không đổi. */
export const promptMatGoc = (nv: Pick<NhanVat, 'mo_ta'>, ben: 'trai' | 'phai', kt: KinhThanh): string => {
  const b = ben === 'trai' ? 'LEFT' : 'RIGHT';
  return `Photorealistic head-and-shoulders portrait of EXACTLY the same person as the reference images (same face, bone structure, eyes, nose, mouth, hairline, hairstyle, skin tone and age): ${nv.mo_ta}. `
    + `Head turned about 35 degrees toward the viewer's ${b} (three-quarter view), eyes looking further toward the viewer's ${b}, NOT at the camera. Neutral, natural expression. `
    + `Plain light grey studio background, soft even light, sharp focus on the face, natural skin texture. Visual style: ${phongCachHinh(docKinhThanh(kt).phong_cach) || 'cinematic'}. No text, no watermark.`;
};
export async function sinhMatGoc(db: Db, nhanVatId: number, ben: ('trai' | 'phai')[] = ['trai', 'phai']): Promise<KqSinh<number[]>> {
  const r = (await db.execute(sql`SELECT v.*, p.kinh_thanh AS kt FROM xv_nhan_vat v JOIN xv_phim p ON p.id = v.phim_id WHERE v.id = ${nhanVatId}`)) as unknown as Row[];
  if (!r[0]) return { ok: false, loi: 'không thấy nhân vật' };
  const nv = mapNhanVat(r[0]); if (nv.loai !== 'nhan_vat' || !nv.anh_ref.length) return { ok: false, loi: `${nv.ten}: chỉ nhân vật người đã có ảnh mẫu` };
  const kt = docKinhThanh(r[0].kt as KinhThanh);
  const ref = [...new Set([...(nv.anh_mat?.url ?? []).slice(0, 1), nv.anh_ref[0]!])];
  const jobs: number[] = [];
  for (const b of ben) {
    const prompt = promptMatGoc(nv, b, kt);
    const job = await taoJob(db, { nhan: `Ảnh mặt quay ${b === 'trai' ? 'trái' : 'phải'} · ${nv.ten}`, nhan_vat_id: nhanVatId, loai: 'anh', provider: 'google', model: kt.mo_hinh_anh, request: { prompt, dich: 'mat_goc', ben: b } });
    await dayViecAnh({ job, model: kt.mo_hinh_anh, prompt, thamChieuUrl: ref, tiLe: '1:1', thuMuc: `anchor/${nhanVatId}` });
    jobs.push(job);
  }
  return { ok: true, data: jobs };
}
export async function sinhAnhGoc(db: Db, nhanVatId: number, so = 1): Promise<KqSinh<number>> {
  const loi = (x: string): KqSinh<number> => ({ ok: false, loi: x });
  const r = (await db.execute(sql`SELECT v.*, p.kinh_thanh AS kt FROM xv_nhan_vat v JOIN xv_phim p ON p.id = v.phim_id WHERE v.id = ${nhanVatId}`)) as unknown as Row[];
  if (!r[0]) return loi('không thấy anchor');
  const nv = mapNhanVat(r[0]);
  if (!nv.mo_ta.trim()) return loi('anchor chưa có mô tả — tả ngoại hình/đặc tính trước rồi mới sinh ảnh mẫu');
  const kt = docKinhThanh(r[0].kt as KinhThanh);
  const chan = chanChuModel(kt.ngon_ngu, { phongCach: kt.phong_cach, anchor: [nv] });
  if (chan) return loi(chan);
  let dau = 0;
  for (let k = 0; k < Math.max(1, Math.min(6, so)); k++) {
    const prompt = promptAnhMau(nv, kt, nv.anh_ref.length + k);
    const job = await taoJob(db, { nhan: `Ảnh gốc · ${nv.ten}${so > 1 ? ` · góc ${k + 1}/${so}` : ''}`, nhan_vat_id: nhanVatId, loai: 'anh', provider: 'google', model: kt.mo_hinh_anh, request: { prompt } });
    await dayViecAnh({ job, model: kt.mo_hinh_anh, prompt, thamChieuUrl: nv.anh_ref.slice(0, 3), tiLe: nv.loai === 'boi_canh' ? kt.ti_le : '1:1', thuMuc: `anchor/${nhanVatId}` });
    dau ||= job;
  }
  return { ok: true, data: dau };
}

/** Ảnh NGƯỜI NỀN XANH để tách nền (cat-nen.ts): một dáng cố định `dang`, cầm sản phẩm của phim; tham chiếu = ảnh người + ảnh đầu của mỗi
 *  anchor sản phẩm. Xong → hoan-tat.ts nhận dich 'cat_nen': chromakey → PNG → điền vào lớp phủ ID_LOP_CAT_NEN của tập. TỐN TIỀN (1 ảnh). */
/** Sinh ảnh một BIẾN THỂ từ ảnh gốc của anchor (tham chiếu) → giữ danh tính, chỉ đổi phần biến thể. MỘT lõi cho nút trên thẻ nhân vật
 *  (actions.ts › sinhAnhBienThe) và script (sinh-anh-phim.mts --bien-the). moHinh = nguồn đích danh (ckey:…) — không thì model ảnh của phim. */
export async function sinhAnhBienTheDb(db: Db, bienTheId: number, moHinh?: string): Promise<KqSinh<number>> {
  const r = (await db.execute(sql`SELECT b.*, v.loai AS v_loai, v.ten AS v_ten, v.mo_ta AS v_mo_ta, v.anh_ref AS v_anh, p.kinh_thanh AS kt
    FROM xv_bien_the b JOIN xv_nhan_vat v ON v.id = b.nhan_vat_id JOIN xv_phim p ON p.id = v.phim_id WHERE b.id = ${bienTheId}`)) as unknown as Row[];
  if (!r[0]) return { ok: false, loi: 'không thấy biến thể' };
  const b = mapBienThe(r[0]);
  const anhGoc = Array.isArray(r[0].v_anh) ? (r[0].v_anh as string[]) : [];
  if (!anhGoc.length) return { ok: false, loi: 'anchor chưa có ảnh gốc — bấm "Sinh ảnh mẫu" của anchor trước để biến thể bám theo' };
  const kt = docKinhThanh(r[0].kt as KinhThanh);
  const model = moHinh && /^(fal|ckey|shopaikey|google):/.test(moHinh) ? moHinh : kt.mo_hinh_anh;
  const a = { loai: String(r[0].v_loai) as NhanVat['loai'], ten: String(r[0].v_ten), mo_ta: String(r[0].v_mo_ta) };
  const prompt = promptBienThe(a, b, kt);
  const job = await taoJob(db, { nhan: `Biến thể · ${a.ten} · ${b.ten}`, nhan_vat_id: b.nhan_vat_id, bien_the_id: bienTheId, loai: 'anh', provider: 'google', model, request: { prompt } });
  await dayViecAnh({ job, model, prompt, thamChieuUrl: anhGoc.slice(0, 2), tiLe: a.loai === 'boi_canh' ? kt.ti_le : '1:1', thuMuc: `bien-the/${bienTheId}` });
  return { ok: true, data: job };
}

export async function sinhAnhCatNen(db: Db, nhanVatId: number, dang: string): Promise<KqSinh<number>> {
  const loi = (x: string): KqSinh<number> => ({ ok: false, loi: x });
  const r = (await db.execute(sql`SELECT v.*, p.kinh_thanh AS kt FROM xv_nhan_vat v JOIN xv_phim p ON p.id = v.phim_id WHERE v.id = ${nhanVatId}`)) as unknown as Row[];
  if (!r[0]) return loi('không thấy anchor');
  const nv = mapNhanVat(r[0]);
  if (nv.loai !== 'nhan_vat') return loi('chỉ tách nền NHÂN VẬT');
  if (!nv.anh_ref.length) return loi(`${nv.ten} chưa có ảnh mẫu — sinh ảnh gốc trước để giữ đúng mặt`);
  if (!dang.trim()) return loi('thiếu mô tả dáng đứng (ô "dang" của template)');
  const kt = docKinhThanh(r[0].kt as KinhThanh);
  const sp = ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${nv.phim_id} AND loai = 'san_pham' ORDER BY id`)) as unknown as Row[]).map(mapNhanVat).filter((v) => v.anh_ref.length).slice(0, 2);
  const refNguoi = nv.anh_ref.slice(0, 2); const refSp = sp.map((v) => v.anh_ref[0]!);
  const prompt = promptCatNen(nv, dang, sp, refNguoi.length, refSp.length);
  const job = await taoJob(db, { phim_id: nv.phim_id, nhan: `Ảnh tách nền · ${nv.ten}`, nhan_vat_id: nhanVatId, loai: 'anh', provider: 'google', model: kt.mo_hinh_anh, request: { prompt, dich: 'cat_nen', dang, thamChieuUrl: [...refNguoi, ...refSp] } });
  await dayViecAnh({ job, model: kt.mo_hinh_anh, prompt, thamChieuUrl: [...refNguoi, ...refSp], tiLe: kt.ti_le, thuMuc: `cat-nen/${nhanVatId}` });
  return { ok: true, data: job };
}

/** Sinh KEYFRAME KẾT cho một shot (khung cuối, từ khung màu chỗ kết của bản 3D) — cần keyframe mở + khung màu kết. Lưu vào xv_canh.keyframe_ket. */
/** Sinh keyframe KẾT (khung 3D kết → keyframe_ket) và keyframe GIỮA (khung 3D giữa clip → keyframe_giua, khi 3D có mau_giua) của một shot.
 *  Cả hai lấy ảnh đầu của shot cho dáng vẻ, cỡ khung theo 3D (chuanBiKeyframe ket). Ba ảnh đầu / giữa / kết làm DẢI NHỊP của ảnh thứ 2 gửi model video
 *  (sinh-video.ts › anhCuoiChuoi). ep = sinh cả cho shot không bị gắn cờ đổi khung (ket_dong) — miễn có khung 3D kết. Trả các job đã gửi. */
export async function sinhKeyframeKetCanh(db: Db, canhId: number, o: { ep?: boolean } = {}): Promise<KqSinh<number[]>> {
  const bc = await boiCanhCanh(db, canhId);
  if (!bc) return { ok: false, loi: 'không thấy cảnh' };
  if (!bc.canh.keyframe_url) return { ok: false, loi: 'shot chưa có keyframe mở' };
  if (!(o.ep ? !!bc.canh.khung_xam?.mau_ket : canKeyframeKet(bc.canh.khung_xam))) return { ok: false, loi: 'shot không đổi khung trong clip (không ai di chuyển / quay, máy không đi cú liền mạch) — không cần keyframe kết, hoặc chưa dựng khung 3D' };
  { const t = thieuCachThao(doiTayDo((bc.mayDu ?? bc.canh.may_3d)?.vi_tri ?? [], (x) => bc.nhanVat.some((v) => v.ten === x && v.loai === 'nhan_vat'))); if (t) return { ok: false, loi: `#${bc.canh.thu_tu}: ${t}` }; }
  if (chatLieuPhim(bc.kt) === 'nguoi_that') await damBaoAnhMat(db, bc.nhanVat).catch((e: unknown) => console.error('[ảnh sát mặt]', e));
  const jobs: number[] = [];
  for (const giua of bc.canh.khung_xam?.mau_giua ? [false, true] : [false]) {
    // ẢNH ĐẦU CHUYỂN GÓC (khung 3D có góc kết / giữa trên khung mở): Nano sửa từ ảnh đầu, không vẽ lại sảnh — 0đ
    const { anhMoChuyen } = await import('./ghep-vung');
    const moChuyen = await anhMoChuyen(db, canhId, giua).catch((e: unknown) => { console.error(`[ảnh đầu chuyển góc] shot ${canhId}`, e); return null; });
    const { prompt, urlRef } = chuanBiKeyframe(bc, true, giua, moChuyen);
    const job = await taoJob(db, { nhan: `Keyframe ${giua ? 'GIỮA' : 'KẾT'} · cảnh #${bc.canh.thu_tu} ${bc.canh.canh}`, canh_id: canhId, loai: 'anh', provider: 'google', model: bc.kt.mo_hinh_anh, request: { prompt, thamChieu: urlRef.length, thamChieuUrl: urlRef, dich: giua ? 'keyframe_giua' : 'keyframe_ket' } });
    await dayViecAnh({ job, model: bc.kt.mo_hinh_anh, prompt, thamChieuUrl: urlRef, tiLe: bc.kt.ti_le, thuMuc: `keyframe/${canhId}-${giua ? 'giua' : 'ket'}` });
    jobs.push(job);
  }
  return { ok: true, data: jobs };
}

/** Câu lệnh + ảnh tham chiếu sẽ gửi cho keyframe của một shot — MỘT chỗ cho lúc sinh thật và sơ đồ nguồn (so "đã gửi" với "giờ sẽ gửi"). */
/** LỚP GHÉP shot ≥ 2 người (khung_xam.lop): prompt NỀN không người + từng người (FLUX độ sâu riêng → nhân dạng → tách nền xanh) — ghepTungNguoi */
/** LoRA mặt nhân vật cho fal flux-lora-depth (xv_nhan_vat.lora) */
export type LoraVe = { path: string; scale: number };
export type LopGhep = { nen: { sau: string; prompt: string }; nguoi: { ten: string; sau: string; xa: number; prompt1: string; prompt2: string; /** vẽ lại TẠI CHỖ trên plate (inpainting) — không câu nền xanh */ prompt_tai_cho: string; /** câu trang phục của shot (en) — lượt sửa đồ tại chỗ */ ao?: string; ref: string[]; loras?: LoraVe[] }[] };
export type HaiBuoc = { lop?: LopGhep; /** người trong khung đều có LoRA → bước 1 FLUX LoRA độ sâu vẽ đúng mặt, BỎ bước 2 sửa mặt */ loras?: LoraVe[]; motBuoc?: boolean; sau: string; /** khung xương OpenPose của người trong khung (dung-set.py › ve_xuong) — có thì bước 1 điều khiển bằng độ sâu + dáng */ xuong?: string; prompt1: string; prompt2: string; ref2: string[] };
export function chuanBiKeyframe(bc: NonNullable<Awaited<ReturnType<typeof boiCanhCanh>>>, ket = false, /** keyframe GIỮA: ảnh 3D giữa clip (mau_giua), trạng thái theo khung kết */ giua = false, /** ảnh đầu đã chuyển sang góc kết / giữa (ghep-vung.ts › anhMoChuyen) — ảnh để sửa */ moChuyen: string | null = null): { prompt: string; urlRef: string[]; vai: { url: string; nhan: string }[]; haiBuoc?: HaiBuoc; soat?: SoatPrompt; khoi?: Partial<Record<DuongSinh, Khoi[]>> } {
  bc = canhDaThayThe(bc);   // THẺ {Tên} → mô tả en của đúng vật (prompt-khoi.ts › goiThe) — mọi chữ thẻ shot đi vào model qua đây
  // Mỗi anchor: ảnh biến thể cảnh chọn (nếu đã sinh) đứng TRƯỚC, rồi ảnh gốc — model bám biến thể mà vẫn giữ danh tính.
  // Biến thể của từng người: SỔ TRANG PHỤC trước (sổ người trỏ tới biến thể chuẩn hoá — bo-set-3d.ts › bienTheTheoSo), chọn tay trên shot sau.
  const viTriCua = (t: string) => (bc.mayDu ?? bc.canh.may_3d)?.vi_tri.find((x) => x.ten === t);
  // Shot 3D có sổ người (bienTheTheoSo theo ket); shot 2D dùng SỔ TRANG PHỤC CARRY (bc.look — lookMang) để áo + VẾT mang từ shot khai sang, đồng nhất đối chiếu.
  const lookCua = (v: NhanVat): BienThe[] => { const lk = v.loai === 'nhan_vat' ? bc.look?.get(v.ten) : undefined; return lk ? KHOA_LOOK.flatMap((k) => lk[k] ?? []) : []; };   // mọi món: phục trang + từng phụ kiện + từng vết
  const btCanh = (v: NhanVat) => { const vt = viTriCua(v.ten); return (vt ? bienTheTheoSo(vt, v, ket)[0] : lookCua(v)[0]) ?? (v.bien_the ?? []).find((b) => bc.canh.bien_the.includes(b.id)); };
  /** MỌI biến thể sổ người đang trỏ (trang_phuc + trang + vet) — mô tả en, không phải tên biến thể tiếng Việt */
  const btSo = (v: NhanVat) => { const vt = viTriCua(v.ten); return vt && v.loai === 'nhan_vat' ? bienTheTheoSo(vt, v, ket) : lookCua(v); };
  // CHẤT LIỆU PHIM (prompt-khoi.ts › CHAT_LIEU): mọi chữ phụ thuộc chất liệu lấy từ một bảng — không ghi cứng chữ hoạt hình / người thật ở đây
  const cl = chatLieuPhim(bc.kt); const CL = CHAT_LIEU[cl]; const nguoiThat = cl === 'nguoi_that';
  // Sản phẩm đứng ĐẦU danh sách tham chiếu (3 ảnh), rồi người/bối cảnh — và prompt nói rõ ảnh số mấy là gì, ảnh thắng chữ (#1256: quần
  // sinh ra là jeans chung chung vì ảnh sản phẩm nằm sau ảnh người, không được gọi tên, còn chữ mô tả "light blue, cúc đồng" lấn ảnh).
  // Shot có KHUNG XÁM 3D: bố trí + hậu cảnh lấy từ 3D, nên KHÔNG gửi ảnh mẫu bối cảnh lẫn chữ tả bối cảnh (thử #23 tập 19, 14/10/2026: ảnh
  // mẫu 'Cable Jungle' có màn hình phía sau → keyframe vẽ thêm chân iMac + màn hình nơi 3D là bức tường xa). Chất liệu/ánh sáng vẫn theo phong cách phim.
  const coKx = !!bc.canh.khung_xam?.xam;
  // Đạo cụ / sản phẩm KHÔNG có trong khung 3D (kể cả các phần của nó) thì không gửi ảnh mẫu + chữ tả: ảnh mẫu là lời mời vẽ (15/10/2026 shot #32
  // tập 19: ảnh mẫu USB Hub đi kèm dù hub nằm ngoài khung → keyframe đặt Tango đứng trên hub). Trạng thái vật vẫn nói ở câu OBJECT STATE.
  // Chỉ khung MỞ: khung kết chưa đo "thấy gì" riêng.
  // Nhân vật ngoài khung cũng không gửi ảnh mẫu (15/10/2026 #35: gửi 4 ảnh mẫu Tango + Lint khi cả hai nằm ngoài khung — mời model vẽ thêm).
  const hienKhung = (ten: string) => (bc.ptAnchor?.get(ten) ?? 0) >= PT_THAY || chuTheThay(bc.canh.khung_xam, ten);
  // ĐỒ ĐANG CẦM của người có mặt trong khung KHÔNG BAO GIỜ là ngoài khung (19/10/2026 #1: cốc cà phê trong tay Vivian ở góc rộng chỉ vài điểm ảnh 3D
  // → bị xếp OFF-SCREEN "do not draw" → keyframe Vivian tay không, shot hắt cà phê mất cốc)
  const cuaNguoiHien = (ten: string) => { const vt = (bc.mayDu ?? bc.canh.may_3d)?.vi_tri.find((x) => x.ten === ten && x.cam && !x.an); return !!vt && hienKhung(vt.cam!); };
  const ngoaiKhung = (v: NhanVat) => !ket && !!bc.ptAnchor && v.loai !== 'boi_canh' && !hienKhung(v.ten) && !cuaNguoiHien(v.ten);
  const nvRef = coKx ? bc.nhanVat.filter((v) => v.loai !== 'boi_canh' && !ngoaiKhung(v)) : bc.nhanVat;
  // Khung xám là ẢNH SỐ 1 (thử #23: đứng thứ 8/9 sau bảy ảnh mẫu thì model coi nhẹ bố trí).
  // Có khung MÀU (vật liệu + ánh sáng theo kịch bản) thì nó là ảnh số 1 — gần ảnh thật hơn khung xám, model ít phải đoán khối nào là gì.
  // ket = keyframe KẾT: ảnh số 1 là khung màu ở chỗ kết (khung_xam.mau_ket).
  const kxMau = coKx ? (ket && giua ? bc.canh.khung_xam!.mau_giua ?? null : ket ? bc.canh.khung_xam!.mau_ket ?? null : bc.canh.khung_xam!.mau ?? null) : null;
  const kx = coKx ? kxMau ?? bc.canh.khung_xam!.xam : null;
  // số ảnh tối đa CỔNG ẢNH nhận (PlenX 8, ckey 3): ảnh mẫu + mọi ảnh nối khung / bố trí phía dưới đều trong trần này — quá trần cổng từ chối cả shot
  const toiDaRef = TOI_DA_REF[bc.kt.mo_hinh_anh.split(':')[0] as CongKey] ?? 10;
  const tc = xepThamChieu(nvRef, btCanh, shotNhieuMau(`${bc.canh.prompt_anh} ${bc.canh.trang_phuc}`), kx ? 1 : 0, toiDaRef);
  const urlRef = [...(kx ? [kx] : []), ...tc.urlRef]; const banDoRef = tc.banDoRef;
  const vai = [...(kx ? [{ url: kx, nhan: kxMau ? '🎨 khung màu 3D (bố trí + ánh sáng)' : '🧊 khung xám 3D (bố trí)' }] : []), ...tc.vai];
  const ghiChuBt = bc.nhanVat.map((v) => { const b = btCanh(v); return b ? `${v.ten} in this shot: ${b.mo_ta || b.ten}.` : ''; }).filter(Boolean).join(' ');
  // KHUNG XÁM 3D (bo-set-3d.ts): render từ bộ set thật + máy ảo của shot — bố trí lấy từ DỮ LIỆU, không để model tự nghĩ (anh 14/10/2026:
  // "dựng bối cảnh bằng 3D để scale và làm đúng mọi bộ phim thay vì dựa vào AI bừa bãi"). Đứng ngay sau ảnh mẫu, trước mọi tham chiếu nối khung.
  // Nhãn khối trong khung 3D gọi ĐẠO CỤ / SẢN PHẨM bằng chính mô tả anchor (15/10/2026: nhãn trơn 'Orange Card' + mô tả nước đôi → keyframe lúc thẻ
  // nhựa phẳng lúc ví da). Một nguồn với ảnh mẫu của anchor; nhân vật giữ tên (ngoại hình đi theo ảnh mẫu riêng).
  // Vật trong set là MỘT PHẦN của anchor (Card Window → Orange Card): gọi "<phần>, part of <mô tả anchor>" — model biết mảng xanh là thẻ trong ví da.
  const goiVat = (ten: string) => {
    const a = bc.anchorCua?.[ten] ?? ten; const v = bc.nhanVat.find((x) => x.ten === a && (x.loai === 'dao_cu' || x.loai === 'san_pham'));
    if (!v?.mo_ta.trim()) return undefined;
    return a === ten ? moTaNgan(v.mo_ta) : `${bc.canh.khung_xam?.thay?.find((t) => t.ten === ten)?.en ?? ten}, part of ${moTaNgan(v.mo_ta)}`;
  };
  const soKx = 1;
  const kxChu = kx ? (kxMau ? `Image ${soKx} = a COLOUR 3D PREVIS render of THIS exact frame from the real set: camera, framing, horizon, every object's and character's position, size and overlap, the lighting direction and colours are all correct — ${CL.previs}, keeping everything exactly where it is; materials get real detail, and each character's exact look comes from its reference images (the previs shapes are only stand-ins). The previs HANDS are rough placeholders: keep where each hand is and what it touches, but draw natural, anatomically correct hands — five fingers, natural knuckles and wrist, never twisted or bent sideways like the stand-in.` : `Image ${soKx} = a grey-box 3D LAYOUT render from THIS shot's exact camera on the real set: every object and every character must sit EXACTLY where its block is, and NOTHING that is not a block may appear — same position, size, overlap, perspective, horizon and framing. It shows layout only: colours, materials and lighting come from the style and the other reference images, never grey blocks.`) + ` ${ket ? 'Image 1 shows where everything is at the END of the shot.' : moTaThay(bc.canh.khung_xam?.thay, goiVat, bc.canh.khung_xam)}` : '';
  // LIỀN MÁY: shot trước chọn chuyển cảnh 'lien_may' → clip của nó kết bằng ảnh này, nên ảnh này phải là giây kế tiếp của chính khung đó
  // (cùng nơi, cùng phía máy, vị trí + đồ vật + trạng thái nối tiếp) — keyframe shot trước làm ảnh tham chiếu cuối (Tango & Lint tập 1: 0/20
  // clip nối khung, shot sau không thấy liên quan shot trước).
  // Keyframe KẾT: khung MỞ đã duyệt của chính shot làm tham chiếu nhân vật / ánh sáng / chất liệu — ảnh mới là cùng shot ở khoảnh khắc cuối.
  const moUrl = ket && bc.canh.keyframe_url && urlRef.length < toiDaRef ? bc.canh.keyframe_url : null;
  if (moUrl) { urlRef.push(moUrl); vai.push({ url: moUrl, nhan: '▶ khung mở của chính shot' }); }
  const moChu = moUrl ? `Image ${urlRef.length} = the START frame of this very shot: same characters, look, materials, lighting and set — this new image is the same shot at its LAST moment, everyone moved to where Image 1 shows them.` : '';
  const tr = bc.truoc;
  const noi = !ket && tr?.keyframe_url && noiKhungShot(false, tr) && urlRef.length < toiDaRef ? tr.keyframe_url : null;
  if (noi) { urlRef.push(noi); vai.push({ url: noi, nhan: `⛓ khung shot #${tr!.thu_tu} (liền máy)` }); }
  const noiChu = noi ? `Image ${urlRef.length} = the frame just before this one (the same continuous moment): keep the same place, camera side, lighting, and every character's and object's position and state; show only the next instant of the action described.` : '';
  // CÙNG CẢNH: keyframe shot mở cảnh làm tham chiếu BỐ TRÍ (không phải khung hình) — mọi shot trong cảnh đứng trên cùng một bộ set như stop-motion thật.
  const ms = bc.master;
  // Có khung xám thì bố trí cảnh đã nằm trong 3D — keyframe mở cảnh (có thể dựng trên 3D cũ) chỉ kéo lệch hậu cảnh, không gửi.
  const msUrl = !kx && ms?.keyframe_url && ms.keyframe_url !== noi && urlRef.length < toiDaRef ? ms.keyframe_url : null;
  if (msUrl) { urlRef.push(msUrl); vai.push({ url: msUrl, nhan: `🗺 bố trí cảnh (shot mở cảnh #${ms!.thu_tu})` }); }
  const soMs = urlRef.length;
  // CẮT TRONG CẢNH: khung shot liền trước mang TRẠNG THÁI qua cú cắt (ai cầm gì, bẹp hay tròn, đứng đâu) — chuyển cảnh là chỗ hay hỏng nhất.
  // Có khung xám: chỗ đứng + trạng thái mở đã nằm trong 3D + thẻ shot; keyframe shot trước (có thể dựng trên 3D cũ) chỉ kéo lệch hậu cảnh (thử #23).
  const trUrl = !kx && !noi && tr?.keyframe_url && tr.phan_doan === bc.canh.phan_doan && tr.keyframe_url !== ms?.keyframe_url && urlRef.length < toiDaRef - 1 ? tr.keyframe_url : null;
  if (trUrl) { urlRef.push(trUrl); vai.push({ url: trUrl, nhan: `✂ trạng thái shot trước #${tr!.thu_tu}` }); }
  const trChu = trUrl ? `Image ${urlRef.length} = the shot just before this cut, same scene: carry over every character's and object's STATE and place in the set (what they hold, their shape, where they stand) unless the action above changes it; stay on the same side of the action. Do NOT copy its framing.` : '';
  // BẢNG TỈ LỆ (character lineup, luật ti_le_nhan_vat — anh 15/10/2026: "chưa thấy bảng vẽ tỷ lệ giữa các đối tượng"): mỗi nhân vật một tấm mẫu
  // riêng chụp ở cỡ khác nhau, câu SCALE chỉ là chữ → gửi kèm ảnh cả dàn đứng cạnh nhau đúng cm khi khung có ≥ 2 nhân vật / đạo cụ.
  const soMon = nvRef.filter((v) => v.loai !== 'boi_canh').length;
  const btlUrl = !ket && kx && bc.kt.bang_ti_le && soMon >= 2 && urlRef.length < toiDaRef ? bc.kt.bang_ti_le : null;
  if (btlUrl) { urlRef.push(btlUrl); vai.push({ url: btlUrl, nhan: '📏 bảng tỉ lệ dàn nhân vật' }); }
  const btlChu = btlUrl ? `Image ${urlRef.length} = SIZE CHART of the cast (straight front view, ruler lines every 1 cm, true height written under each): it is NOT a scene and NOT a pose — use it only for every character's and prop's true size relative to the others; the shapes there are stand-ins, each look comes from its reference images.` : '';
  // KHUNG CHUẨN MÀU của cảnh (hero frame / color script, luật khung_chuan_mau): shot có 3D thì bố trí lấy từ Image 1, nhưng TÔNG MÀU / phơi sáng / màu
  // đèn lấy từ keyframe mở cảnh đã có — mỗi keyframe một tông (#32 có màn hình xanh sau lưng trong khi 3D là tường tối) là lỗi khán giả thấy ngay.
  const mauUrl = kx && !ket && ms?.keyframe_url && ms.keyframe_url !== noi && urlRef.length < toiDaRef ? ms.keyframe_url : null;
  if (mauUrl) { urlRef.push(mauUrl); vai.push({ url: mauUrl, nhan: `🎨 khung chuẩn màu (shot mở cảnh #${ms!.thu_tu})` }); }
  const mauChu = mauUrl ? `Image ${urlRef.length} = the COLOUR & LIGHT reference of this scene (its opening frame): match its colour grade, white balance, exposure, contrast and the colour of the light exactly. Do NOT copy its layout, camera angle, framing or background — those come from Image 1 only.` : '';
  // Plate khoá KIẾN TRÚC + VẬT LIỆU (tường / cửa / tranh / sàn y bản đã duyệt); VỊ TRÍ trên màn theo FIXED LAYOUT tính theo máy (anh 31/10/2026: cửa lúc trái lúc phải — bản
  // chuẩn giữ "trông thế nào", FIXED LAYOUT giữ "ở phía nào màn theo máy này"; hai thứ không được mâu thuẫn). Trước câu này mềm ("keep layout") → model vẫn dựng lại phòng mỗi khung.
  const msChu = msUrl ? `Image ${soMs} = an approved frame of this SAME lobby, the exact same physical set. The walls, elevator doors, wall picture, floor, ceiling, light fittings and every material and finish look EXACTLY as in it — reproduce that same architecture and the same fixtures; do NOT redesign the room and do NOT add, remove or duplicate any door, picture or fixture. WHERE each fixture sits on screen for THIS camera is given by the FIXED LAYOUT above (this camera may see the set from another side than Image ${soMs}); keep every object's relative arrangement and keep the camera on the same side of the action. Do NOT copy Image ${soMs}'s framing, shot size or camera angle.` : '';
  // Thẻ shot: bố cục 3 lớp + trạng thái MỞ + hướng — keyframe là khung đầu của shot.
  const dd = bc.canh.dan_dung ?? {};
  const theChu = [dd.bo_cuc?.trim() && `Composition (foreground / midground / background): ${dd.bo_cuc.trim()}`, (ket ? dd.ket?.trim() && `This frame is the END of the shot: ${dd.ket.trim()}` : dd.mo?.trim() && `This frame is the START of the shot: ${dd.mo.trim()}`), dd.huong?.trim() && `Eyelines and screen direction: ${dd.huong.trim()}`].filter(Boolean).map((x) => `${x}.`).join(' ');
  // Cấm tay người / dụng cụ vẽ lạc khung — CÙNG luật với prompt video (kieu.ts › camCongCuVe); trước đây chỉ video có, keyframe thì không.
  // KHOÁ ÁNH SÁNG CẢNH (nối thử #22→#24: ba shot ba tông — gỗ sáng ấm / xanh lục tối / tối đốm sáng): shot có 3D dùng chung một câu ánh sáng
  // lấy từ dữ liệu (đèn bàn bật hay tắt), mọi shot cùng cảnh cùng tông, hậu cảnh ngoài bộ set tối.
  const anhSang = kx ? CL.anh_sang(!!bc.canh.may_3d?.den_ban) : '';
  // TRẠNG THÁI VẬT (15/10/2026: kẹo đã bẻ đôi nằm ngoài khung 3D của 7.1a → không có nhãn → keyframe vẽ con gấu nguyên theo ảnh mẫu): mọi anchor
  // của shot đang ở trạng thái khác ảnh mẫu thì nói thẳng, đè lên ảnh mẫu — lấy từ 3D đầy đủ (kể cả đồ để lại), không dò chữ.
  // Ô sổ người trang_phuc / trang / vet là TÊN biến thể (tiếng Việt) — in thẳng ra là "wearing: Sơ mi trắng" (tập 122, mọi shot): đổi sang mô tả en của biến
  // thể; boNguoi = đường có khối người (bộ đồ + đồ đeo đã nói ở đó) thì bỏ khỏi câu trạng thái, không nói hai lần.
  const trangCauCua = (boNguoi: boolean) => {
    const ds = ((bc.mayDu ?? bc.canh.may_3d)?.vi_tri ?? []).map((v) => {
      const a = bc.nhanVat.find((n) => n.ten === v.ten); if (!a) return '';
      const t = trangThaiVat(v, ket, (k, gt) => { const b = (a.bien_the ?? []).find((x) => x.ten.trim().toLowerCase() === gt.trim().toLowerCase()); return a.loai === 'nhan_vat' && boNguoi && (b || k === 'do_deo' || k === 'toc' || k === 'trang_diem') ? null : b ? b.mo_ta : gt; });
      return t ? `${v.ten}: ${t}` : '';
    }).filter(Boolean);
    return ds.length ? `STATE in this frame (overrides the reference photos): ${ds.join('; ')}.` : '';
  };
  const trangCau = trangCauCua(false);
  // TỈ LỆ NHÂN VẬT (lineup / size chart, luật ti_le_nhan_vat): mỗi nhân vật một tấm mẫu riêng nên model đoán tỉ lệ; 3D đã đúng — nói bằng số so với
  // nhân vật đầu tiên trong khung (chiều cao khối khoi_3d).
  const caoCua = (ten: string) => bc.nhanVat.find((n) => n.ten === ten && n.loai === 'nhan_vat')?.khoi_3d?.co?.[2];
  const nvKhung = kx ? ((bc.mayDu ?? bc.canh.may_3d)?.vi_tri ?? []).filter((v) => !v.an && caoCua(v.ten) && (bc.canh.khung_xam?.thay ?? []).some((t) => t.ten === v.ten && thayRo(bc.canh.khung_xam, t))).map((v) => v.ten) : [];
  const goc0 = nvKhung[0]; const h0 = goc0 ? caoCua(goc0)! : 0;
  const tiLeCau = nvKhung.length >= 2 && h0 > 0 ? `SCALE (relative heights, exactly as Image 1 shows): ${nvKhung.slice(1).map((t) => `${t} is ${Math.round((caoCua(t)! / h0) * 10) / 10}× the height of ${goc0}`).join('; ')}.` : '';
  // HƯỚNG NHÂN VẬT so với máy, từ số 3D (15/10/2026 #38: 3D thấy Tango nghiêng hẳn, keyframe vẽ mặt nhìn thẳng máy theo ảnh mẫu — prompt không nói hướng).
  // HƯỚNG + ÁNH MẮT: thân quay đâu (huongVoiMay) + mắt nhìn ai (nhinCau, đích = mọi nhân vật có chỗ đứng kể cả ngoài khung). Shot cố ý nhìn máy
  // (dan_dung.huong nói 'into the lens' / 'to camera' — #21) thì không cấm.
  const nhinMay = /into the (lens|camera)|to camera|at the camera/i.test(String(bc.canh.dan_dung?.huong ?? ''));
  const laNv = (t: string) => bc.nhanVat.some((n) => n.ten === t && n.loai === 'nhan_vat');
  const huongNhin = (m: NonNullable<typeof bc.canh.may_3d>, v: NonNullable<typeof bc.canh.may_3d>['vi_tri'][number]) => {
    const h = huongVoiMay(m, v, ket)?.chu; if (!h) return undefined;
    const e = nhinMay ? '' : nhinCau(m, v, m.vi_tri.filter((x) => laNv(x.ten)), ket);
    return e ? `${h}, ${e}` : h;
  };
  // chữ phim khai ở mô tả vật set trong khung VÀ ở mô tả đối tượng đang thấy (đối tượng xuyên suốt: logo, bảng số tầng — mô tả đối tượng là nguồn chuẩn)
  const chuPhim = chuTrongKhung([...(bc.canh.khung_xam?.thay ?? []).filter((t) => thayRo(bc.canh.khung_xam, t)).map((t) => t.en ?? ''),
    ...bc.nhanVat.filter((v) => v.loai !== 'nhan_vat' && v.loai !== 'boi_canh' && !ngoaiKhung(v)).map((v) => v.mo_ta)]);
  const mHuong = bc.mayDu ?? bc.canh.may_3d; const trongKhung = new Set((bc.canh.khung_xam?.thay ?? []).filter((t) => thayRo(bc.canh.khung_xam, t)).map((t) => t.ten));
  const huongChu = kx && mHuong ? mHuong.vi_tri.filter((v) => !v.an && trongKhung.has(v.ten) && bc.nhanVat.some((n) => n.ten === v.ten && n.loai === 'nhan_vat'))
    .map((v) => { const h = huongNhin(mHuong, v); return h ? `${v.ten}: ${h}` : ''; }).filter(Boolean) : [];
  // ≥ 2 người: vế "không nhìn máy" nói MỘT lần ở câu cuối (nobody looks into the camera lens), bỏ khỏi từng người
  if (huongChu.length >= 2 && !nhinMay) huongChu.splice(0, huongChu.length, ...huongChu.map((x) => boCauMay(x)));
  const huongCau = huongChu.length ? `CHARACTER FACING in this frame, exactly as Image 1 shows (overrides the pose in the reference sheets): ${huongChu.join('; ')}.${nhinMay ? '' : ' Candid film still: nobody looks into the camera lens — every person keeps their eyes on who or what they are dealing with.'}` : '';
  // CỠ NHÂN VẬT TRONG KHUNG bằng SỐ (15/10/2026, kiểm khung tập 19: #9 / #30 3D là cận mặt Tango mà keyframe vẽ cỡ trung — prompt chỉ bảo
  // "theo bố cục ảnh 1", không nói chủ thể to bao nhiêu): chiều cao + vùng đo trên chính khung 3D (khung_xam.kiem / thay). Chỉ khung MỞ.
  const trongKhungAnchor = bc.nhanVat.filter((v) => v.loai !== 'boi_canh' && !ngoaiKhung(v)).map((v) => v.ten);
  const framingCau = khungChu(bc.canh.khung_xam, kx ? trongKhungAnchor : nvKhung, ket);
  // NGOÀI KHUNG gọi đích danh: anchor của shot (nhân vật / đạo cụ) mà 3D không thấy — chữ thẻ shot hay nhắc tới chúng ("Tango and Lint hiding
  // behind the orange card") nên phải nói thẳng là không vẽ.
  // tên đưa model: nhân vật = tên, đạo cụ = mô tả en (tên đồ tiếng Việt "Ly cà phê" từng lọt vào câu ngoài khung)
  const ngoaiTen = kx && !ket ? bc.nhanVat.filter((v) => ngoaiKhung(v)).map((v) => (v.loai === 'nhan_vat' ? v.ten : goiTenEn([...bc.nhanVat, ...bc.nvPhim])(v.ten).replace(/^the /, ''))) : [];
  const ngoaiCau = ngoaiTen.length ? `OFF-SCREEN in this frame (part of the story, NOT visible right now): ${ngoaiTen.join(', ')} — do not draw them, their shadow or any part of them, even where the description mentions them.` : '';
  // GÓC MÁY bằng SỐ từ máy 3D (anh 15/10/2026, #35: 3D sát mặt bàn ngước lên Mr. Wipe, keyframe vẽ ngang tầm — prompt chỉ có cụm chung "low-angle").
  const mGoc = bc.mayDu ?? bc.canh.may_3d;
  const chinh = mGoc ? mGoc.vi_tri.find((v) => trongKhungAnchor.includes(v.ten) && bc.nhanVat.some((n) => n.ten === v.ten && n.loai === 'nhan_vat')) ?? mGoc.vi_tri.find((v) => trongKhungAnchor.includes(v.ten)) : undefined;
  const mayCau = kx && mGoc ? gocMayChu(mGoc, chinh ? { ten: chinh.ten, giuaZ: (chinh.tam[2] ?? 0) + (bc.nhanVat.find((n) => n.ten === chinh.ten)?.khoi_3d?.co?.[2] ?? 0) / 2 } : null, nguoiThat) : '';
  // BỐI CẢNH: câu đầu mô tả anchor bối cảnh ("Boardroom in afternoon light") — có khung 3D thì KHÔNG gửi ảnh mẫu / mô tả dài (mời vẽ thêm đồ, #23
  // tập 19), nhưng phải nói ĐANG Ở ĐÂU: bỏ hẳn thì model không biết không gian (anh 17/10/2026: "không gian, bối cảnh chưa thấy prompt nhắc đến").
  const boiCanh = bc.nhanVat.filter((v) => v.loai === 'boi_canh').map((v) => dauBoiCanh(v.mo_ta)).filter(Boolean)[0] ?? '';
  // HÌNH HỌC CỐ ĐỊNH theo máy (so-do-canh › cauBoiCanhCoDinh): cửa / tranh / ghế đúng tường + số lượng + chỗ trên màn tính từ máy của shot — giữ bất biến
  // khi đổi góc (anh 31/10/2026: nền "2 cửa bên phải" mà cửa nhảy trái / phải mỗi khung vì hình học chưa bao giờ được khoá theo máy). '' khi phim chưa có sơ đồ.
  const sdKhung = bc.khongGian?.so_do && bc.canh.ky_thuat?.sd ? sdLuc(bc.canh, ket ? 'ket' : 'dau') : null;
  const boiCanhCoDinh = sdKhung ? cauBoiCanhCoDinh(bc.khongGian!.so_do, sdKhung) : '';
  // KHỐI NGƯỜI / MÓN (prompt-khoi.ts › chuNguoi) — MỘT hàm cho mọi đường: bộ đồ = mô tả mọi biến thể sổ người, đồ đeo sổ người, cận chèn chỉ tả tay.
  const chen = bc.canh.ky_thuat?.co_canh === 'insert';
  const vtCua = (v: NhanVat) => (v.loai === 'nhan_vat' ? viTriCua(v.ten) : undefined);
  // mô tả biến thể ĐỦ (không cắt ở " — " như moTaVua: vết cà phê sau dấu gạch từng bị cắt khỏi mọi prompt #2–#13)
  const aoCua = (v: NhanVat) => btSo(v).map((b) => b.mo_ta.trim().replace(/[.\s]+$/, '').slice(0, 600)).filter(Boolean);
  const themCua = (v: NhanVat) => { const vt = vtCua(v); return vt ? [ket ? vt.toc_den ?? vt.toc : vt.toc, ket ? vt.trang_diem_den ?? vt.trang_diem : vt.trang_diem].filter((x): x is string => !!x?.trim()) : []; };
  const deoCua = (v: NhanVat) => { const vt = vtCua(v); return (ket ? vt?.do_deo_den ?? vt?.do_deo : vt?.do_deo) ?? ''; };
  // toiDaTu: bước 1 FLUX đọc ~300 từ — bộ đồ rút còn vế đầu (dáng bộ đồ, chi tiết vết / hoạ tiết để bước 2 làm theo ảnh mẫu + mô tả đủ); #6 vết cà phê đủ chữ = 305 từ
  const rut = (t: string, n?: number) => { if (!n) return t; const w = t.split(/\s+/); return w.length <= n ? t : `${w.slice(0, n).join(' ').replace(/[,;:]+$/, '')}…`; };
  // tư thế theo 3D (đứng / ngồi / nằm / dáng tay + món đang cầm) — chỉ bước 1 FLUX (đọc độ sâu ma-nơ-canh, dễ hiểu sai dáng); bước 2 giữ ảnh bước 1
  // ĐỒ CẦM ≠ ĐỒ ĐEO (19/10/2026 #25: chuỗi hạt khai deo 'cotay_t' mà câu đồ cầm gọi là món Thần cầm → Nano đặt chuỗi hạt vào lòng bàn tay ngửa)
  const monCam = (v: NhanVat) => { const mm = (bc.mayDu ?? bc.canh.may_3d)?.vi_tri.find((x) => x.cam === v.ten && !x.an && !(x as { deo?: string }).deo); return mm ? goiTenEn([...bc.nhanVat, ...bc.nvPhim])(mm.ten) : undefined; };
  const CHO_DEO: Record<string, string> = { cotay_t: 'around the left wrist', cotay_p: 'around the right wrist', co: 'around the neck' };
  const monDeo = (v: NhanVat) => ((bc.mayDu ?? bc.canh.may_3d)?.vi_tri ?? []).filter((x) => x.cam === v.ten && !x.an && (x as { deo?: string }).deo)
    .map((x) => `wearing exactly ONE ${goiTenEn([...bc.nhanVat, ...bc.nvPhim])(x.ten)} ${CHO_DEO[(x as { deo?: string }).deo!] ?? 'on the body'} (worn, not held; no second one anywhere)`);
  const taNv = (v: NhanVat, gon = false, toiDaTu?: number) => chuNguoi(v, { ao: aoCua(v).map((x) => rut(x, toiDaTu)), deo: deoCua(v), them: themCua(v), chen, gon, moTa: gon ? moTaNgan : moTaVua,
    tu_the: toiDaTu && v.loai === 'nhan_vat' && vtCua(v) ? tuTheEn(vtCua(v)!, monCam(v)) : undefined });
  // DÁNG + ĐỒ CẦM cho đường Nano (19/10/2026 #13: câu Nano chỉ tả thẻ "trông như ảnh 4", không nói AI cầm, cầm thế nào → thẻ lơ lửng giữa không trung,
  // tay Vivian trống). Trước chỉ bước 1 FLUX nhận câu dáng; giờ plate Nano là đường chính của shot nhiều người.
  const dangChu = bc.nhanVat.filter((v) => v.loai === 'nhan_vat' && vtCua(v) && !vtCua(v)!.an).map((v) => { const t = tuTheEn(vtCua(v)!, monCam(v)); const d = monDeo(v); const ca = [t === 'standing' ? '' : t, ...d].filter(Boolean); return ca.length ? `${v.ten}: ${ca.join('; ')}` : ''; }).filter(Boolean);
  const dangCau = dangChu.length ? `POSES, HELD AND WORN ITEMS, as Image 1 shows (every held item stays physically in its holder's hand, every worn item stays where it is worn — never floating in the air; a held item's reference image shows only what it looks like, not where it goes): ${dangChu.join('; ')}.` : '';
  // SỬA TỪ ẢNH 3D (anh 15/10/2026, #35 ba lần: "dựng lại cảnh theo ảnh 1" + 9 ảnh + đoạn chữ dài → model tự sắp lại: ngang tầm, nhìn thẳng máy,
  // thêm cáp / màn hình theo chữ). Ngành giữ hình học bằng img2img / restyle: ảnh màu 3D LÀ ảnh gốc, model chỉ vẽ lại bề mặt. Ảnh mẫu: 1 tấm
  // cho mỗi nhân vật / đạo cụ CÓ TRONG KHUNG. Không gửi chữ hành động của thẻ shot (dáng + chỗ đã ở 3D; chữ là nơi lọt "cable loop").
  if (kxMau && bc.kt.keyframe_sua_3d !== false) {
    const ref: string[] = [kxMau]; const vaiS: { url: string; nhan: string }[] = [{ url: kxMau, nhan: '🎨 ảnh GỐC 3D — chỉ vẽ lại bề mặt' }];
    const trongS = nvRef.filter((v) => v.loai !== 'boi_canh');
    const thay = trongS.map((v) => {
      const u = btCanh(v)?.anh_url ?? v.anh_ref[0]; let so = '';
      if (u && ref.length < 6) { ref.push(u); vaiS.push({ url: u, nhan: `${v.loai === 'nhan_vat' ? '🧍' : '🧸'} ${v.ten}` }); so = ` — looks exactly like Image ${ref.length}`; }
      return `${v.ten}${so}: ${taNv(v, true)}`;
    });
    // ẢNH ĐẦU CỦA CHÍNH SHOT làm tham chiếu cho keyframe KẾT / GIỮA (19/10/2026 #1: ảnh kết vẽ ra một văn phòng khác — sàn gỗ, đèn vàng — vì chỉ có
    // khung 3D + ảnh mẫu nhân vật; ảnh đầu / cuối không nối thì video biến hình giữa hai nơi). Giữ phòng / ánh sáng / người theo ảnh đầu, chỉ đổi phần 3D đổi.
    const dauShot = ket && bc.canh.keyframe_url ? (ref.push(bc.canh.keyframe_url), vaiS.push({ url: bc.canh.keyframe_url, nhan: '🎬 ảnh ĐẦU của shot' }), ref.length) : 0;
    // CỠ KHUNG / VỊ TRÍ MÁY chỉ theo khung 3D (ảnh 1): bản trước nói "giữ theo ảnh đầu" chung chung → Nano giữ luôn toàn cảnh của ảnh đầu dù 3D kết là cận
    // hai người sau cú giật máy (#1) — video phải hoà tan đổi cả khung ở giây cuối.
    // MÁY YÊN (khung_xam.dong.ket / giua — dung-set.py ghi khi máy kết / giữa trùng khung mở): nền ảnh kết = nền ảnh đầu, ghep-vung.ts › ghepNenKet chép đè
    // nền đó sau khi Nano vẽ → Nano phải giữ đúng nền ảnh đầu, không theo tường / vật liệu của khung 3D (nếu không, viền quanh người sẽ lệch màu với nền chép).
    const gocYen = giua ? bc.canh.khung_xam?.dong?.giua_goc : bc.canh.khung_xam?.dong?.ket_goc;
    const yen = !!gocYen && gocYen.every((g, k) => Math.abs(g[0]! - [0, 1, 1, 0][k]!) < 0.01 && Math.abs(g[1]! - [0, 0, 1, 1][k]!) < 0.01);   // đứng yên hẳn
    const lia = !!gocYen && !yen;   // máy lia / đẩy vào: khung theo Image 1, sảnh giữ y Image đầu
    // ĐỒ ĐEO tháo ra trong shot đọc từ SỔ NGƯỜI (do_deo → do_deo_den), không ví dụ chữ cứng — câu cũ "lanyard and badge… stays on" làm ảnh kết #132 #15 giữ
    // thẻ trên ngực Hạ dù Vivian vừa giật mất (clip ra hai thẻ).
    const tach = (x?: string) => (x ?? '').split(/;\s*/).map((y) => y.trim()).filter(Boolean);
    const thao = giua ? [] : (bc.mayDu ?? bc.canh.may_3d)?.vi_tri.flatMap((vt) => { if (vt.do_deo_den == null) return []; const con = new Set(tach(vt.do_deo_den).map((y) => y.toLowerCase())); const mat = tach(vt.do_deo).filter((y) => !con.has(y.toLowerCase())); return mat.length ? [`${vt.ten} no longer wears ${mat.join(' or ')} — it is gone from ${vt.ten}`] : []; }) ?? [];
    // ĐỒ ĐỔI TAY trong shot (thao-do.ts — một sổ với câu video + cổng): người gần chỗ kết của món là người cầm lúc kết; đồ ĐEO kèm trạng thái theo cách tháo
    // (#132 #15: thẻ giật đứt khoá → dây hở hai đầu trong tay Vivian, cổ Hạ trống).
    const vtK = (bc.mayDu ?? bc.canh.may_3d)?.vi_tri ?? [];
    const traoTay = giua ? [] : cauDoiTayKet(doiTayDo(vtK, (t) => bc.nhanVat.some((v) => v.ten === t && v.loai === 'nhan_vat'))).map((c) => c.replace(/\{([^}]+)\}/g, (_m, t: string) => goiVat(t) ?? t));
    const dauCau = dauShot ? `Image ${dauShot} = the FIRST frame of this same shot, a moment earlier — use it for the look: the room, set dressing, light, colour grade, faces, hair and wardrobe. ${yen ? `The camera does NOT move in this shot: framing, angle and zoom are exactly Image ${dauShot}'s, and every wall, door, sign, floor, light, colour and texture is identical to Image ${dauShot}. Image 1 only tells where each person and held item ends up and their pose — its walls and materials are rough stand-ins, ignore them.` : `The CAMERA comes ONLY from Image 1: copy Image 1's zoom, framing, camera angle, subject sizes and positions exactly, even where they differ completely from Image ${dauShot} (the camera ${lia ? 'turns or moves with the action' : 'may have zoomed or moved during the shot'}).${lia ? ` It is the same physical place as Image ${dauShot}: every wall, door, sign, floor, light, colour and texture that both frames see is identical to Image ${dauShot}; Image 1's walls and materials are rough stand-ins.` : ''}`} Held items and stains as Image 1 shows. ${[...traoTay, ...thao].length ? `${[...traoTay, ...thao].join('. ')}. ` : ''}Every other worn accessory in Image ${dauShot} stays on exactly as it is.` : '';   // #2 ảnh kết mất dây thẻ
    // ẢNH CHUẨN BỐI CẢNH (doc-db.ts › anhSet): bàn / đồ đạc / chất liệu phòng giống keyframe đã duyệt của shot khác cùng bộ set. Khung kết đã có ảnh đầu
    // của chính shot làm chuẩn bề ngoài → không gửi thêm.
    const st = bc.anhSet; const nhanSet = st ? `episode ${st.tap_so}, shot #${st.thu_tu}` : '';
    const setSo = !dauShot && st && ref.length < 7 ? (ref.push(st.url), vaiS.push({ url: st.url, nhan: `🏠 ảnh chuẩn bối cảnh (tập ${st.tap_so} #${st.thu_tu})` }), ref.length) : 0;
    const trang3d = trangCauCua(true);
    // SỐ NGƯỜI theo 3D: nhân vật lọt khung + người phụ của set lọt khung (khung_xam.thay.nguoi)
    const thayAll = bc.canh.khung_xam?.thay ?? [];
    const chinhNguoi = trongS.filter((v) => v.loai === 'nhan_vat').map((v) => v.ten);
    const phuNguoi = thayAll.filter((t) => t.nguoi && t.pt >= 0.5 && !bc.nhanVat.some((n) => n.ten === t.ten)).length;
    const soNguoi = ket ? 'The same people as in the start frame — nobody new appears.' : soNguoiCau(chinhNguoi, phuNguoi);
    // KHUÔN một bước (prompt-khoi.ts › KHUON.mot_buoc)
    const k1: Khoi[] = [
      khoi('anh_dich', `EDIT Image 1. Image 1 is a 3D previs render of this exact frame; turn it into ${CL.anh_dich(boiCanh)}. This is a RE-TEXTURING job, not a new picture: keep the camera position, height and tilt, the lens, the framing and horizon, and every object's and character's position, size, pose, facing, overlap and cut-off at the frame edges EXACTLY as in Image 1. Do not add, remove, move, rotate, enlarge or shrink anything.`),
      khoi('may', mayCau), khoi('bo_tri', ket ? '' : moTaThay(bc.canh.khung_xam?.thay, goiVat, bc.canh.khung_xam)), khoi('boi_canh', boiCanhCoDinh), khoi('so_nguoi', soNguoi), khoi('huong', chen ? '' : huongCau), khoi('dien', dangCau), khoi('giu', dauCau), khoi('khung', framingCau), khoi('ngoai_khung', ngoaiCau), khoi('trang_thai', trang3d),
      khoi('nguoi', thay.length && `Replace each smooth stand-in shape with the real thing, in exactly the same place, size and pose: ${thay.join(' | ')}.`),
      khoi('phong_cach', `Photo look: ${phongCachHinh(bc.kt.phong_cach).replace(/[.\s]+$/, '')}. Keep Image 1's light direction and colours.`),
      khoi('anh_set', setSo && cauAnhSet(setSo, nhanSet)), khoi('khong_them', KHONG_THEM_ANH),
      khoi('cong_cu', camCongCuVe(bc.kt.phong_cach, laTayNguoi(bc.nhanVat))), khoi('cam_chu', camChu(chuPhim)),
      khoi('cam_xuc', chen ? '' : promptCamXuc(bc.canh, bc.nhanVat, 'anh')), khoi('bieu_cam', chen ? '' : promptBieuCam(bc.canh.bieu_cam, 'anh')),
    ];
    // ẢNH ĐẦU ĐÃ CHUYỂN SANG GÓC NÀY (ghep-vung.ts › anhMoChuyen — chuẩn ngành "chuyển ảnh rồi vẽ vá"): ảnh kết / giữa SỬA TỪ ảnh đầu đã duyệt thay vì vẽ lại
    // từ khung 3D — 23/10/2026 #132 #16 #19: Nano nhận khung 3D làm ảnh gốc, vẽ lại cả sảnh khác ảnh đầu (lệch 13–29 %) → ghép nền lộ vệt, người bóng đôi.
    // Ảnh đó thành Image 1, mọi ảnh khác lùi một số (đánh lại số trong mọi khối).
    if (moChuyen) {
      ref.unshift(moChuyen); vaiS.unshift({ url: moChuyen, nhan: '🎬 ảnh ĐẦU chuyển sang góc này — ảnh để sửa' });
      for (const k of k1) k.chu = k.chu.replace(/\bImage (\d+)/g, (_m, n: string) => `Image ${Number(n) + 1}`);
      const ad = k1.find((k) => k.ma === 'anh_dich');
      if (ad) ad.chu = `EDIT Image 1. Image 1 is the approved START frame of this very shot, already turned to this moment's camera; any area the start frame never saw is filled with rough 3D previs — repaint those areas so they continue the same set seamlessly. Change ONLY the people and the items they hold or wear: move each person to where Image 2 (3D previs of this moment) shows them, in that pose and facing that way; where a person stood before, show the set behind them.${[...traoTay, ...thao].length ? ` At this moment: ${[...traoTay, ...thao].join('; ')}.` : ''} Every wall, door, sign, floor, ceiling, light, colour and texture stays exactly as in Image 1, and the framing stays exactly Image 1's.`;
    }
    const pS = ghep(k1);
    // SOÁT CHỮ (kiem-prompt.ts) cho MỌI đường: người trong khung + bộ đồ sổ trang phục, đồ chủ thể đang thấy, chất liệu phim
    const chuThe3d = new Set((bc.canh.khung_xam?.kiem ?? []).filter((k) => k.bat_buoc && k.trong_khung).map((k) => k.nhan_vat));
    const soat: SoatPrompt = { co_canh: bc.canh.ky_thuat?.co_canh, ten_rieng: bc.nhanVat.map((v) => v.ten), chat_lieu: cl,
      nguoi: trongS.filter((v) => v.loai === 'nhan_vat').map((v) => ({ ten: v.ten, trang_phuc: aoCua(v).map((x) => (chen ? boMat(x) : x)).join('; ') || undefined })),
      vat: trongS.filter((v) => v.loai !== 'nhan_vat' && chuThe3d.has(v.ten)).map((v) => ({ ten: v.ten, mo_ta: v.mo_ta })),
      // KHÔNG 3D: người ngoài khung của đúng khung này theo sơ đồ cảnh (khong-gian.ts) — chữ cho họ làm chủ ngữ là model vẽ thêm người
      ...(!bc.canh.khung_xam?.kiem && bc.khongGian && bc.canh.ky_thuat?.sd ? { ngoai: nguoiNgoai(bc.khongGian, bc.canh, ket ? 'ket' : 'dau') } : {}) };
    // HAI BƯỚC (anh 15–16/10/2026, #35: chỉ model điều khiển bằng ĐỘ SÂU giữ đúng góc máy 3D; nhân dạng phải nhờ một lượt sửa có ảnh mẫu):
    // bước 1 = FLUX depth từ bản đồ độ sâu 3D + chữ (không nhận ảnh mẫu) → ảnh thật đúng hình học; bước 2 = sửa nhân dạng trên chính ảnh đó.
    const sau = bc.canh.khung_xam?.sau;
    if (sau && !ket && bc.kt.keyframe_hai_buoc !== false) {
      // Prompt bước 1 NGẮN, mô tả tự nhiên (FLUX đọc giới hạn chữ: khối luật dài bị cắt, con số "40 mm, 1.2 cm" bị vẽ thành chữ "480" — #35).
      // Hình học đã nằm trong bản đồ độ sâu; chữ chỉ nói Ở ĐÂU, KHOẢNH KHẮC, AI / CÁI GÌ trông ra sao, quay hướng nào.
      const thayDs = bc.canh.khung_xam?.thay ?? [];
      // NGÂN SÁCH TỪ cho FLUX (~300 từ): mô tả vật qua thẻ / bộ đồ dài làm vượt (#3, #11 = 303–307 từ) → dựng lại gọn dần (bộ đồ 32 → 20 → 12 từ, hậu cảnh ≤ 6 → 4 món)
      // thay vì để FLUX cắt mất phần cuối (câu chất liệu, "No text").
      const soNguoiKhung = trongS.filter((v) => v.loai === 'nhan_vat').length;
      // ĐỒ CỐ ĐỊNH CỦA SET có đối tượng (bo_set_id — cửa thang, logo, bình lan, bàn…): bước 1 FLUX chỉ tả NGƯỜI + đồ cầm tay; đồ cố định đã nằm trong bản đồ
      // độ sâu, vào danh sách HẬU CẢNH (một tên gọn mỗi món, có trần) — tả như món riêng làm #15 343 từ, #16 406 từ (trần 300), bước 1 bị chặn.
      const monS = trongS.filter((v) => !v.bo_set_id);
      const dungMon = (cap: number, gon = false) => monS.map((v) => {
        const t = thayDs.find((x) => (bc.anchorCua?.[x.ten] ?? x.ten) === v.ten); const hg = mGoc?.vi_tri.find((x) => x.ten === v.ten);
        const h = hg && v.loai === 'nhan_vat' ? huongNhin(mGoc!, hg) : undefined;
        const hh = h && soNguoiKhung >= 2 && !nhinMay ? boCauMay(h) : h;   // ≥ 2 người: "không nhìn máy" nói một lần (khoi khong_nhin_may)
        return `${taNv(v, gon, cap)}${hh && !chen ? `, ${hh}` : ''}${t ? catMep(t.hop).replace(/^, cut off by/, ', only partly in frame, cut off by') : ''}`;
      });
      const nenDu = [...new Set(thayDs.filter((x) => !bc.nhanVat.some((v) => v.ten === (bc.anchorCua?.[x.ten] ?? x.ten) && !v.bo_set_id) && x.pt >= PT_THAY).sort((p, q) => q.pt - p.pt).map((x) => goiVat(x.ten) ?? x.en ?? x.ten))];   // một lần mỗi loại (#20: ba lần "black leather armchair"), lớn trước
      const g = mGoc ? Math.round((Math.atan2((mGoc.nhin[2] ?? 0) - (mGoc.dat[2] ?? 0), Math.hypot(mGoc.nhin[0]! - mGoc.dat[0]!, mGoc.nhin[1]! - mGoc.dat[1]!)) * 180) / Math.PI) : 0;
      // KHUÔN bước 1 FLUX (KHUON.flux): ảnh đích theo chất liệu + bối cảnh + khoảnh khắc mở (dáng — #20 "chống bàn" mà FLUX vẽ đứng thẳng) + người + hậu cảnh
      // bản NGẮN cho FLUX: số người + ngoài khung gọn (câu đầy đủ ~30 từ mỗi câu làm #3 vượt ngân sách)
      const soNguoiNgan = ket ? '' : chinhNguoi.length + phuNguoi ? `Exactly ${chinhNguoi.length + phuNguoi} ${chinhNguoi.length + phuNguoi === 1 ? 'person' : 'people'}${chinhNguoi.length ? ` (${chinhNguoi.join(', ')})` : ''}; nobody else anywhere.` : 'No people.';
      const ngoaiNgan = ngoaiTen.length ? `Not in frame: ${ngoaiTen.join(', ')}.` : '';
      const dungKF = (cap: number, nenToiDa: number, gon = false, pcNgan = false): Khoi[] => { const mon = dungMon(cap, gon); const nen = nenDu.slice(0, nenToiDa); return [
        khoi('anh_dich', CL.flux_dau(g >= 8 ? 'thap' : g <= -8 ? 'cao' : 'ngang')), khoi('boi_canh', boiCanh && `Setting: ${boiCanh}.`),
        khoi('khoanh_khac', !ket && bc.canh.dan_dung?.mo && `Moment: ${bc.canh.dan_dung.mo.replace(/[.\s]+$/, '')}.`),
        khoi('nguoi', mon.length && `${mon.join('. ')}.`), khoi('so_nguoi', `${soNguoiNgan}${soNguoiKhung >= 2 && !nhinMay && !chen ? ' Nobody looks into the camera.' : ''}`.trim()), khoi('ngoai_khung', ngoaiNgan), khoi('hau_canh', nen.length && `Background: ${nen.join(', ')}.`), khoi('khong_them', KHONG_THEM_FLUX),
        khoi('anh_sang', nguoiThat ? '' : bc.canh.may_3d?.den_ban ? 'Warm desk-lamp light mixed with cool blue screen glow.' : 'Night: only cool blue screen glow, deep soft shadows, dark room.'),
        khoi('phong_cach', nguoiThat ? rut(moTaVua(phongCachHinh(bc.kt.phong_cach)), pcNgan ? 16 : undefined) : ''), khoi('chat_lieu', CL.flux_cuoi),
      ]; };
      const soTu = (ds: Khoi[]) => ghep(ds).split(/\s+/).length;
      // hai nấc cuối: tả người / món bản NGẮN (mặt, tóc để bước 2 làm theo ảnh mẫu) rồi cắt câu phong cách — #11 có thẻ là chủ thể (thayRo) = 312 từ ở nấc cũ cuối
      const kF = [dungKF(32, 6), dungKF(20, 5), dungKF(12, 4), dungKF(12, 3, true), dungKF(12, 3, true, true), dungKF(8, 2, true, true), dungKF(8, 0, true, true)].find((x) => soTu(x) <= TU_TOI_DA_FLUX - 10) ?? dungKF(6, 0, true, true);
      const ref2: string[] = [kxMau]; const nhanDang: string[] = [];
      for (const v of trongS) {
        const ta = taNv(v, true);
        const u = btCanh(v)?.anh_url ?? v.anh_ref[0]; if (!u || ref2.length >= 5) { nhanDang.push(`${v.ten}: ${ta}`); continue; } ref2.push(u); nhanDang.push(`${v.ten} — exactly like Image ${ref2.length + 1}: ${ta}`);
      }
      // ĐỒ NHẬN DẠNG trong khung (màn chiếu, tranh, bảng chỉ dẫn — kiem-ai-3d.ts › LA_NHAN_DANG): ảnh chuẩn đã dán trên mặt vật ở khung màu (Image 2);
      // FLUX bước 1 vẽ chữ bậy lên đó, KHONG_CHU ở bước 2 lại cấm sửa → #20 màn chiếu ra chữ vô nghĩa. Bước 2 chép nội dung từ Image 2, chữ khác vẫn cấm.
      const set2 = st && ref2.length < 6 ? (ref2.push(st.url), ref2.length + 1) : 0;   // Image 1 = ảnh bước 1, ref2[i] = Image i + 2
      const coDinh = thayDs.filter((x) => x.pt >= PT_THAY && LA_NHAN_DANG.test(x.en ?? '')).map((x) => x.en!);
      // KHUÔN bước 2 sửa nhân dạng (KHUON.sua_nhan_dang)
      const kS: Khoi[] = [
        khoi('nguoi', `EDIT Image 1 (a photograph of this exact frame). Change ONLY how each character and prop LOOKS so it matches its reference image: ${nhanDang.join(' | ')}.`),
        khoi('giu', 'Keep everything else exactly as Image 1 (camera, framing, every position, size and outline, background, light, colours); Image 2 is the 3D layout of this frame. Do not add, remove, move or resize anything.'),
        khoi('anh_set', set2 && cauAnhSet(set2, nhanSet)), khoi('khong_them', KHONG_THEM_ANH), khoi('boi_canh', boiCanhCoDinh),
        khoi('huong', chen ? '' : huongCau), khoi('so_nguoi', soNguoi), khoi('ngoai_khung', ngoaiCau), khoi('cong_cu', camCongCuVe(bc.kt.phong_cach, laTayNguoi(bc.nhanVat))),
        khoi('nhan_dang', coDinh.length && `The ${coDinh.join(' and the ')} must show EXACTLY what is on it in Image 2 — same picture, same title text, same layout — replacing whatever Image 1 shows there.`),
        khoi('cam_chu', coDinh.length ? `Apart from that: ${camChu(chuPhim)}` : camChu(chuPhim)),
        khoi('cam_xuc', chen ? '' : promptCamXuc(bc.canh, bc.nhanVat, 'anh')), khoi('bieu_cam', chen ? '' : promptBieuCam(bc.canh.bieu_cam, 'anh')),
      ];
      // LỚP GHÉP (anh 18/10/2026 chọn "ghép từng người"): một lượt FLUX cho cả khung nhiều người không gắn đúng mô tả vào đúng khối (#12 trộn Hạ + Vivian,
      // Thần quay lưng) → mỗi người MỘT lượt riêng trên nền xanh (một chủ thể thì đạt như các shot một người), nền một lượt riêng không người.
      const lopKx = bc.canh.khung_xam?.lop; const dau = CL.flux_dau(g >= 8 ? 'thap' : g <= -8 ? 'cao' : 'ngang');
      const lop: LopGhep | undefined = lopKx ? {
        nen: { sau: lopKx.nen, prompt: ghep([khoi('anh_dich', dau), khoi('boi_canh', boiCanh && `Setting: ${boiCanh}.`), khoi('boi_canh', boiCanhCoDinh), khoi('hau_canh', nenDu.length && `Background: ${nenDu.slice(0, 6).join(', ')}.`),
          khoi('so_nguoi', 'No people anywhere: the place is completely empty.'), khoi('khong_them', KHONG_THEM_FLUX), khoi('phong_cach', nguoiThat ? moTaVua(phongCachHinh(bc.kt.phong_cach)) : ''), khoi('chat_lieu', CL.flux_cuoi), khoi('cam_chu', camChu(chuPhim))]) },   // cấm chữ: biển / logo vẽ thành chữ méo (#12 'B-GROP') — đồ nhận dạng đi đường ghép ảnh chuẩn
        nguoi: lopKx.nguoi.flatMap((x) => {
          const v = trongS.find((n) => n.ten === x.ten); if (!v) return [];
          const hg = mGoc?.vi_tri.find((y) => y.ten === v.ten); const h = hg ? huongNhin(mGoc!, hg) : undefined;
          const cam = (mGoc?.vi_tri ?? []).filter((y) => y.cam === v.ten && !y.an).map((y) => bc.nhanVat.find((n) => n.ten === y.ten)).filter((n): n is NhanVat => !!n);
          const ref = [v, ...cam].map((n) => btCanh(n)?.anh_url ?? n.anh_ref[0]).filter((u): u is string => !!u);
          const xanh = `the flat, uniform pure chroma green ${MAU_XANH_NEN} background`;
          const lo = v.lora?.url ? [{ path: v.lora.url, scale: 1 }] : undefined;
          // TRANG PHỤC CỦA SHOT (vết cà phê, áo đổi…): ảnh sổ người là bộ đồ SẠCH — lớp ghép chỉ bảo "outfit như Image 2" thì vết bẩn mất (#12–#14 Hạ áo
          // trắng tinh sau khi bị hắt cà phê). Câu trang phục của shot đè lên đồ trong ảnh tham chiếu, như đường một lượt (ghepPromptAnh).
          const ao = aoCua(v).join('; ');
          return [{ ten: v.ten, sau: x.sau, xa: x.xa, ref, ...(lo ? { loras: lo } : {}),
            prompt1: ghep([khoi('anh_dich', dau), khoi('nguoi', `${v.lora?.trigger ? `${v.lora.trigger}, ` : ''}${taNv(v, false, 20)}${h ? `, ${h}` : ''}.`), khoi('trang_thai', ao && `Wearing: ${ao}.`), khoi('so_nguoi', `Exactly 1 person (${v.ten}); nobody else.`), khoi('khong_them', KHONG_THEM_FLUX),
              khoi('hau_canh', `Background: ${xanh} fills everything around the person — no room, no floor line, no shadow on the background.`), khoi('chat_lieu', CL.flux_cuoi), khoi('cam_chu', KHONG_CHU)]),
            ao,
            prompt_tai_cho: ghep([khoi('cam_chu', KHONG_CHU), khoi('anh_dich', dau), khoi('trang_thai', ao && `Wearing: ${ao}.`), khoi('nguoi', `${v.lora?.trigger ? `${v.lora.trigger}, ` : ''}${taNv(v, false, 20)}${h ? `, ${h}` : ''}.`),
              khoi('so_nguoi', 'Exactly one person in the masked area, nobody else.'), khoi('khong_them', KHONG_THEM_FLUX), khoi('chat_lieu', CL.flux_cuoi)]),
            prompt2: `EDIT Image 1 (a close crop of ONE person). Change ONLY how the person LOOKS: ${v.ten} — exactly like Image 2 (same face, hair, age${ao ? '' : ', outfit'})${ao ? `, CLOTHING IN THIS SHOT (overrides the clothing in Image 2): ${ao}` : ''}${cam.length ? `; ${cam.map((m, i) => `${m.ten} — exactly like Image ${i + 3}`).join('; ')}` : ''}. Keep the framing, pose, body angle and size exactly as Image 1${h ? ` — ${h}` : ''}; do NOT turn the person toward the camera if Image 1 shows them otherwise. Replace everything around the person with ${xanh}, edge to edge; add no objects the person is not already holding or wearing. ${KHONG_CHU}` }];
        }) } : undefined;
      // LoRA (anh 18/10/2026): người trong khung có LoRA → bước 1 vẽ đúng mặt ngay (từ khoá + LoRA), mọi người đều có LoRA thì bỏ bước 2 sửa mặt
      const nguoiKhung = trongS.filter((v) => v.loai === 'nhan_vat');
      const coLora = nguoiKhung.filter((v) => v.lora?.url);
      const loraVe = coLora.map((v) => ({ path: v.lora!.url, scale: 1 }));
      const tuKhoa = coLora.map((v) => v.lora!.trigger).join(', ');
      return { prompt: pS, urlRef: ref, vai: vaiS, haiBuoc: { ...(lop && lop.nguoi.length >= 2 ? { lop } : {}), ...(loraVe.length ? { loras: loraVe, motBuoc: coLora.length === nguoiKhung.length } : {}), sau, ...(DUNG_XUONG && bc.canh.khung_xam?.xuong ? { xuong: bc.canh.khung_xam.xuong } : {}), prompt1: `${tuKhoa ? `${tuKhoa}. ` : ''}${ghep(kF)}`, prompt2: ghep(kS), ref2 }, soat,
        // CHẤM đúng đường SẼ ĐI: shot ≥ 2 người đi ghép từng người (plate Nano = prompt một bước + lượt mặt từng người), bước 1 FLUX / bước 2 không gửi —
        // chấm chúng chặn oan (#16: "bước 1 dài 338 từ, không nói bộ đồ" trong khi plate Nano không có giới hạn 300 từ)
        khoi: lop && lop.nguoi.length >= 2 ? { mot_buoc: k1 } : { mot_buoc: k1, flux: kF, sua_nhan_dang: kS } };
    }
    return { prompt: pS, urlRef: ref, vai: vaiS, soat, khoi: { mot_buoc: k1 } };
  }
  // THỨ TỰ: khối 3D (bố trí, góc máy, cỡ, hướng mặt, ngoài khung) đứng ĐẦU prompt — đứng sau phong cách + mô tả nhân vật thì bị loãng (#35).
  const prompt = [kxChu, mayCau, framingCau, boiCanhCoDinh, huongCau, dangCau, ngoaiCau, trangCau, ghepPromptAnh(bc.canh.prompt_anh, phongCachHinh(bc.kt.phong_cach), nvRef, promptKyThuatAnh(bc.canh.ky_thuat), bc.canh.trang_phuc, camChu(chuPhim)), camCongCuVe(bc.kt.phong_cach, laTayNguoi(bc.nhanVat)), tiLeCau, btlChu, anhSang, mauChu, moChu, theChu, banDoRef, noiChu, trChu, msChu, ghiChuBt, promptCamXuc(bc.canh, bc.nhanVat, 'anh'), promptBieuCam(bc.canh.bieu_cam, 'anh'), 'No extra objects, props or people beyond what this description and the reference images show.'].filter(Boolean).join(' ');
  return { prompt, urlRef, vai };
}

/** CHẤM MỌI PROMPT KEYFRAME của một shot (kiem-prompt.ts): đường một bước (--nguon / chọn model khác), bước 1 FLUX + bước 2, keyframe KẾT nếu shot có
 *  khung kết. MỘT chỗ cho cổng (lyChanKeyframe) và sinh-anh-phim --xem-prompt. */
export function chamKeyframe(bc: NonNullable<Awaited<ReturnType<typeof boiCanhCanh>>>): { diem: number; loi: LoiPrompt[] } {
  let diem = 100; const loi: LoiPrompt[] = [];
  for (const ket of canKeyframeKet(bc.canh.khung_xam) ? [false, true] : [false]) {
    const k = chuanBiKeyframe(bc, ket); if (!k.soat) continue; const nhan = ket ? 'khung kết · ' : '';
    const c = chamPrompt((Object.entries(k.khoi ?? {}) as [DuongSinh, Khoi[]][]).map(([d, ds]) => ({ ten: `${nhan}${KHUON[d].ten}`, duong: d, khoi: ds })), k.soat);
    diem = Math.min(diem, c.diem); loi.push(...c.loi);
  }
  // sổ đồ vật: câu keyframe cuối cùng phải nói đủ trạng thái từng món (kiem-prompt.ts › loiTrangThaiVat)
  { const lv = loiTrangThaiVat('keyframe', chuanBiKeyframe(bc).prompt, bc.canh.ky_thuat?.vat_so); for (const l of lv) { diem -= l.phat; loi.push(l); } }
  const bcMoTa = bc.nhanVat.filter((v) => v.loai === 'boi_canh').map((v) => v.mo_ta).join(' ');
  const nc = bcMoTa ? noiChonPhongCach(phongCachHinh(bc.kt.phong_cach), bcMoTa) : [];
  if (nc.length) { diem -= 10; loi.push({ buoc: 'phong cách phim', ma: 'noi_chon', phat: 10, chu: `phong cách phim nhắc ${nc.join(', ')} mà bối cảnh shot không có — đồ đạc / nguồn sáng của một nơi để ở mô tả bối cảnh, không để ở phong cách (nền sẽ đổi giữa các shot)` }); }
  return { diem, loi };
}

/** Câu CAMERA từ máy 3D: cao bao nhiêu cm trên mặt bàn và so với giữa chủ thể, ngước / chúc bao nhiêu độ, ống kính, và HỆ QUẢ thấy gì
 *  (ngước: thấy mặt dưới, nền là phần phía trên — không thấy mặt bàn; chúc: thấy mặt bàn quanh chủ thể). Thuần — kiểm ở sinh-anh.test. */
export function gocMayChu(m: Pick<May3d, 'dat' | 'nhin' | 'ong_kinh'>, chu: { ten: string; giuaZ: number } | null, nguoiThat = false): string {
  const [dx, dy, dz] = [m.nhin[0]! - m.dat[0]!, m.nhin[1]! - m.dat[1]!, (m.nhin[2] ?? 0) - (m.dat[2] ?? 0)];
  const doc = Math.round((Math.atan2(dz, Math.hypot(dx, dy)) * 180) / Math.PI); const cao = Math.round((m.dat[2] ?? 0) * 10) / 10;
  // PHIM NGƯỜI THẬT: máy cao bao nhiêu cm so với SÀN, cỡ người thật — câu "lens 55 cm above the desk / tiny characters" của hoạt hình bàn làm việc
  // lọt vào phim người thật (tập 122, đường một bước); kiem-prompt.ts › chất liệu lệch chặn chữ hoạt hình.
  if (nguoiThat) return `CAMERA, exactly as the 3D set places it (do NOT change it): ${m.ong_kinh} mm lens, ${Math.round(cao)} cm above the floor, ${doc >= 8 ? `tilted UP ${doc}° — a LOW-ANGLE shot looking up at ${chu?.ten ?? 'the subject'}` : doc <= -8 ? `tilted DOWN ${-doc}° — a HIGH-ANGLE shot looking down at ${chu?.ten ?? 'the subject'}` : `level (${doc}°) — an EYE-LEVEL shot`}. Not a different angle.`;
  const so = chu ? (cao < chu.giuaZ - 0.5 ? `below the middle of ${chu.ten} (which is ${Math.round(chu.giuaZ * 10) / 10} cm up)` : cao > chu.giuaZ + 0.5 ? `above ${chu.ten} (whose middle is ${Math.round(chu.giuaZ * 10) / 10} cm up)` : `level with ${chu.ten}`) : '';
  const dau = `CAMERA, exactly as the 3D set places it (do NOT change it): ${m.ong_kinh} mm lens, the lens ${cao} cm above the desk${so ? `, ${so}` : ''}, `;
  if (doc >= 8) return `${dau}tilted UP ${doc}° — a LOW-ANGLE shot: we look up at ${chu?.ten ?? 'the subject'}${doc >= 15 ? ', seeing its underside' : ''}; the desk top is barely visible (only at the very bottom edge if at all); behind the subject is what is ABOVE and beyond the desk. Not eye-level, not from above.`;
  if (doc <= -8) return `${dau}tilted DOWN ${-doc}° — a HIGH-ANGLE shot: we look down on ${chu?.ten ?? 'the subject'} and see the desk surface around and behind it. Not eye-level, not from below.`;
  return `${dau}level (${doc}°) — an EYE-LEVEL shot at ${chu?.ten ?? 'the subject'}'s height: the horizon of the desk runs across the frame; not from above, not from below.`;
}

const vungEn = (x: number, y: number) => `${y < 0.36 ? 'upper' : y > 0.64 ? 'lower' : 'middle'} ${x < 0.36 ? 'left' : x > 0.64 ? 'right' : 'centre'}`;
/** Câu FRAMING: bề ngang + chiều cao PHẦN THẤY của từng nhân vật trên khung 3D (hộp thay, 0..1) + vùng. Đo cả hai chiều: nhân vật nằm bẹp
 *  (#9 tập 19) thấp mà tràn ngang khung — chỉ đo chiều cao thì câu nói "30%" trong khi 3D là cận mặt. Thuần — kiểm ở sinh-anh.test. */
export function khungChu(kx: Canh['khung_xam'] | null | undefined, ten: string[], ket = false): string {
  if (ket || !kx?.thay?.length || !ten.length) return '';
  const tron = (x: number) => Math.max(5, Math.round(x * 20) * 5);
  const ds = ten.map((t) => {
    const th = (kx.thay ?? []).find((x) => x.ten === t); if (!th) return '';
    const w = th.hop[2] - th.hop[0], h = th.hop[3] - th.hop[1]; const vt = vungEn((th.hop[0] + th.hop[2]) / 2, (th.hop[1] + th.hop[3]) / 2);
    const co = `spans about ${tron(w)}% of the frame width and ${tron(h)}% of its height, ${vt}`;
    const cat = catMep(th.hop);
    // Cận = cao ≥ 85% khung hoặc chiếm > nửa diện tích (#9 Tango nằm tràn ngang cao 45%: w·h ≈ 0,36 → không; dải đế cắm tràn ngang cao 10% → không).
    return h >= 0.85 || w * h >= 0.5 ? `${t} ${co} — a close-up: ${t} fills the frame and the frame edges crop the body${cat}` : `${t} ${co}${cat}`;
  }).filter(Boolean);
  return ds.length ? `FRAMING measured on Image 1 — keep the same subject size and position, do NOT zoom out or in: ${ds.join('; ')}.` : '';
}

/** MỘT CẢNH MỘT MODEL ẢNH (luật mot_model_canh): keyframe của shot sinh bằng model khác với đa số keyframe cùng cảnh → không tiêu tiền video lên
 *  khung lệch "tay vẽ"; sinh lại keyframe bằng model của cảnh trước. Model lấy từ job đã sinh ra đúng tệp keyframe (xv_job.output_url). */
export async function tronModelCanh(db: Db, c: Pick<Canh, 'id' | 'tap_id' | 'phan_doan' | 'keyframe_url'>): Promise<string | null> {
  if (!c.keyframe_url || !c.phan_doan) return null;
  const r = (await db.execute(sql`SELECT c.id, c.thu_tu, j.model, j.nhan, j.request->>'buoc1' AS buoc1 FROM xv_canh c JOIN xv_job j ON j.output_url = c.keyframe_url AND j.loai = 'anh'
    WHERE c.tap_id = ${c.tap_id} AND c.phan_doan = ${c.phan_doan} AND c.keyframe_url IS NOT NULL`)) as unknown as Row[];
  const cua = r.find((x) => Number(x.id) === c.id); if (!cua || r.length < 2) return null;
  // Cùng model qua cổng khác (ckey / ShopAIKey / Google — chuỗi dự phòng của xưởng) là MỘT tay vẽ: bỏ tiền tố cổng trước khi so.
  // Cùng DÒNG model qua người bán khác cũng là một tay vẽ (17/10/2026 #127: shot nhiều tham chiếu đi Google gemini-nano-banana-2.1, shot khác qua ckey
  // wowztools/Nano-Banana-2 — cùng Nano Banana 2 mà bị chặn "một cảnh một model").
  // ĐƯỜNG ĐỘ SÂU (18/10/2026 #20 bị chặn oan): mọi keyframe đi qua FLUX độ sâu dựng hình (bước 1 / LoRA một lượt / ghép từng người) — lượt Nano Banana
  // sau đó chỉ sửa mặt, nước mắt, hoà sáng trên ảnh FLUX — cùng MỘT tay vẽ 'flux-độ-sâu', so theo đường chứ không theo model lượt cuối.
  const doSau = (x: Row) => !!x.buoc1 || /flux[^ ]*depth|flux-general/i.test(String(x.model)) || /ghép từng người|bước 2|nước mắt/.test(String(x.nhan ?? ''));
  const goc = (m: unknown, x?: Row) => { if (x && doSau(x)) return 'flux-độ-sâu'; const _ = String(m).replace(/^(shopaikey|ckey|google):/, ''); return goc0(_); };
  const goc0 = (x: string) => {
    return /nano-banana-2|gemini-3\.1-flash-image/i.test(x) ? 'nano-banana-2' : /nano-banana-pro|gemini-3-pro-image/i.test(x) ? 'nano-banana-pro' : x; };
  const dem = new Map<string, number>(); for (const x of r) dem.set(goc(x.model, x), (dem.get(goc(x.model, x)) ?? 0) + 1);
  const [daSo, so] = [...dem].sort((a, b) => b[1] - a[1])[0]!;
  return goc(cua.model, cua) !== daSo && so >= 2 ? `keyframe sinh bằng ${goc(cua.model, cua)} trong khi cảnh "${c.phan_doan}" dùng ${daSo} (${so}/${r.length} shot) — một cảnh một model: sinh lại keyframe bằng ${daSo}` : null;
}

/** MỌI lý do chặn sinh keyframe của một shot — quy trình cấp tập (brief, khung truyện, phân cảnh, phong cách, người xem hiểu, kịch bản series)
 *  + cấp shot (phân cảnh, mẫu, cỡ cảnh) + prompt + ngôn ngữ + thành phần. MỘT chỗ cho nút sinh và script kiểm (kiem-cong-shot.mts): trước đây
 *  script tự lắp lại danh sách cổng, lệch dần với nút. */
export async function lyChanKeyframe(db: Db, canhId: number, /** THỬ ngoài quy trình (như video 🧪 Sinh thử): bỏ cổng cấp tập / thẻ shot, giữ cổng prompt + ngôn ngữ + thành phần — cảnh mẫu một cảnh (#322 ReelShort) */ thu = false): Promise<{ bc: NonNullable<Awaited<ReturnType<typeof boiCanhCanh>>>; chan: string[] } | null> {
  const bc = await boiCanhCanh(db, canhId);
  if (!bc) return null;
  const tapQt = mapTap(((await db.execute(sql`SELECT * FROM xv_tap WHERE id = ${bc.canh.tap_id}`)) as unknown as Row[])[0]!);
  const nvPhim = await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${tapQt.phim_id} ORDER BY id`)) as unknown as Row[]).map(mapNhanVat));
  const tatCa = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${bc.canh.tap_id} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh);
  const chan: string[] = [];
  const pq = phimQt(String(((await db.execute(sql`SELECT loai FROM xv_phim WHERE id = ${tapQt.phim_id}`)) as unknown as Row[])[0]?.loai ?? 'phim'), bc.kt);
  const qt = [...chanTienKy(tapQt, pq, locNhanh(tatCa, bc.canh.nhanh || 'A'), locNhanh(tatCa, 'A'), nvPhim.filter((v) => v.loai === 'boi_canh').map((v) => v.id)), ...chanShot(bc.canh, tapQt, nvPhim, { camXucQc: pq.camXucQc, ds: locNhanh(tatCa, bc.canh.nhanh || 'A'), theLoai: pq.the_loai })];
  if (qt.length && !thu) chan.push(`Shot #${bc.canh.thu_tu} chưa qua quy trình: ${qt.join('; ')}`);
  // Bộ set 3D: shot thuộc set phải có máy ảo + khung xám đúng mã + qua kiểm hình học (trong khung, không bị che, không vượt trục).
  const sid = boSetCuaShot(bc.canh, nvPhim);
  // KHUNG ĐO TRÊN 3D SỐNG (do-3d-song.ts): đủ để chấm, không có ảnh độ sâu / khung màu → chưa sinh keyframe được
  if (sid && bc.canh.khung_xam?.nguon === 'song') chan.push('Khung 3D mới đo trên 3D sống để chấm (chưa dựng Blender — chưa có ảnh độ sâu / khung màu cho keyframe): 🧊 Dựng khung xám trước khi sinh');
  // ĐỐI TƯỢNG XUYÊN SUỐT (bo-set-3d.ts › doiTuongThieu): vật set thấy trong ≥ 2 shot của phim phải là đối tượng có ảnh mẫu — không thì mỗi shot model vẽ
  // một kiểu (logo, số tầng, ghế, người phụ). Mặt nền (sàn / tường / trần) theo ảnh chuẩn bối cảnh (doc-db.ts › anhSet).
  if (sid) {
    const ds = ((await db.execute(sql`SELECT c.nhan_vat, c.khung_xam FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = ${tapQt.phim_id} AND c.khung_xam IS NOT NULL
      AND coalesce(c.nhanh, '') IN ('', 'A', ${bc.canh.nhanh || 'A'})`)) as unknown as Row[]).filter((x) => boSetCuaShot({ nhan_vat: (x.nhan_vat as number[]) ?? [] }, nvPhim) === sid);
    const thieu = doiTuongThieu(ds.map((x) => ({ khung_xam: x.khung_xam as KhungXam })), bc.vatSet as Parameters<typeof doiTuongThieu>[1], nvPhim.map((v) => ({ ten: v.ten, anh: v.anh_ref.length })));
    const o = new Set((bc.canh.khung_xam?.thay ?? []).filter((t) => thayRo(bc.canh.khung_xam, t)).map((t) => t.ten));
    const cua = thieu.filter((x) => o.has(x.ten));
    if (cua.length) chan.push(`Vật xuất hiện nhiều shot mà chưa là đối tượng có ảnh mẫu (mỗi shot sẽ bị vẽ một kiểu): ${cua.map((x) => `${x.ten} (${x.so_shot} shot · ${x.ly_do === 'chua_co' ? 'chưa có đối tượng' : 'thiếu ảnh mẫu'})`).join(', ')} — tạo bằng scripts/doi-tuong-xuyen-suot.mts`);
    // HỒ SƠ NGƯỜI CHỈ CÓ NGOẠI HÌNH (prompt-khoi.ts › hanhDongTrongMoTa): người phụ của set / đối tượng người đang thấy mà mô tả mang hành động → chặn
    const nguoiThay = [...bc.vatSet.filter((v) => o.has(v.ten) && ('ao' in v || 'tu_the' in v)).map((v) => ({ ten: v.ten, mo: v.en ?? '' })),
      ...bc.nhanVat.filter((v) => v.loai === 'nhan_vat').map((v) => ({ ten: v.ten, mo: v.mo_ta }))];
    const hd = nguoiThay.map((x) => ({ ...x, hd: hanhDongTrongMoTa(x.mo) })).filter((x) => x.hd);
    if (hd.length) chan.push(`Mô tả người mang HÀNH ĐỘNG (sẽ lặp ở mọi shot dùng người đó — hành động thuộc thẻ shot, không thuộc hồ sơ): ${hd.map((x) => `${x.ten} "${x.hd}"`).join(', ')}`);
  }
  // KHÔNG 3D mà có SƠ ĐỒ CẢNH (khong-gian.ts): cùng các cổng mạch tập — trục qua cú cắt, nhìn → thấy, tổng thể, sổ dáng / đồ vật — thay vì bỏ qua
  if (!sid && kgCua(tapQt.khong_gian, bc.canh)) { const l = loiMachTap2d(tapQt.khong_gian, locNhanh(tatCa, bc.canh.nhanh || 'A') as unknown as ShotKg[])[bc.canh.id] ?? []; if (l.length) chan.push(`Sơ đồ cảnh: ${l.join('; ')}`); }
  if (sid) {
    const r = (await db.execute(sql`SELECT * FROM xv_bo_set WHERE id = ${sid}`)) as unknown as Row[];
    const ds = locNhanh(tatCa, bc.canh.nhanh || 'A'); const i = ds.findIndex((c) => c.id === bc.canh.id);
    // Mã khung xám tính trên máy ĐẦY ĐỦ (có đồ để lại) — cùng cách bo-set-3d-may.ts dựng.
    const mDu = bc.mayDu ?? bc.canh.may_3d;   // máy đầy đủ (có đồ để lại) — doc-db.ts › boiCanhCanh, cùng nguồn với prompt
    const k = chanKhungXam({ ...bc.canh, may_3d: mDu }, nvPhim, r[0] ? mapBoSet(r[0]) : null, i > 0 ? shotSoTruc(ds, i) : null);
    // Mạch: mọi nhân vật mở shot này đúng chỗ lần cuối thấy nó kết + chuỗi chú ý nhìn → thấy → làm (cùng hàm dấu ⚠ trên lưới).
    k.push(...(loiMachTap(ds, nvPhim, r[0] ? [mapBoSet(r[0])] : [], tapQt.phan_canh)[bc.canh.id] ?? []));   // phân cảnh: luồng thời gian (ngày truyện / liền trước)
    if (k.length) chan.push(`Bộ set 3D: ${k.join('; ')}`);
    // Bộ kiểm riêng cho phim AI (kiem-ai-3d.ts): vật được nhắc phải có khối 3D + thấy ở cú cận · người nói thấy mặt · vật đeo kèm người đeo.
    const ai = loiAi3d({ ...bc.canh, may_3d: mDu }, nvPhim, r[0] ? mapBoSet(r[0]) : null);
    if (ai.length) chan.push(`Bộ kiểm AI: ${ai.join('; ')}`);
    // Bảng trang phục theo ngày truyện (bang-trang-phuc.ts): đồ đang mặc đúng bảng của cảnh + đúng hoàn cảnh.
    const tp = kiemBangTrangPhuc(bc.canh, mDu, tapQt.phan_canh, docBangTrangPhuc(bc.kt), nvPhim);
    if (tp.length) chan.push(tp.join('; '));
  }
  if (!bc.canh.prompt_anh.trim()) chan.push('cảnh chưa có prompt ảnh');
  const cm = chanChuModel(bc.kt.ngon_ngu, { phongCach: bc.kt.phong_cach, shot: bc.canh, anchor: bc.nhanVat });
  if (cm) chan.push(cm);
  const tp = thanhPhanCanh(bc.canh, bc.nhanVat);
  if (tp.thieu.length) chan.push(`Chưa chuẩn bị đủ thành phần: ${tp.thieu.join('; ')}. Làm ở tab 📖 Phim › 🎨 Thiết kế sản xuất rồi sinh lại.`);
  // BỘ CHẤM PROMPT (kiem-prompt.ts): chữ SẼ gửi đường hai bước (mặc định khi có độ sâu 3D) — lẫn tiếng Việt, thiếu bộ đồ, cận chèn tả mặt, chữ ngược 3D, quá dài cho FLUX
  if (!chan.length) { const lp = chamKeyframe(bc).loi.filter((l) => l.phat >= NGUONG_CHAN); if (lp.length) chan.push(`Bộ chấm prompt: ${lp.map((l) => l.chu).join(' · ')}`); }
  return { bc, chan };
}

/** Sinh keyframe: `so` ứng viên (1-3), nối vào keyframe_uv; cảnh chưa có ảnh chọn thì tự chọn ảnh đầu. Mọi cổng ở lyChanKeyframe. */
/** congAnh (vd 'plenxai:nano-banana-2'): GIỮ đường nhiều bước (độ sâu / ghép từng người / sửa mặt) nhưng các bước Nano đi đúng cổng này — khác
 *  moHinh (chọn model khác = đường một bước). Anh 21/10/2026: thử keyframe qua PlenX mà vị trí người vẫn khoá theo 3D. */
// siet = khối "ĐIỂM BẮT BUỘC ĐÚNG" (doi-chieu-khung.ts › sietTuLech): lệch của lần sinh trước, nối vào CHÍNH prompt nguồn + bước nhân dạng — vòng
// tự-sửa B6 (anh 30/10/2026: SỬA TỪ PROMPT NGUỒN, không vá ảnh). $0, không đổi ảnh mẫu/trang phục nên giữ danh tính; sinh lại cả khung từ prompt đã siết.
export async function sinhKeyframeCanh(db: Db, canhId: number, so = 1, moHinh?: string, congAnh?: string, thu = false, siet = ''): Promise<KqSinh<number[]>> {
  const loi = (x: string): KqSinh<number[]> => ({ ok: false, loi: x });
  const g = await lyChanKeyframe(db, canhId, thu);
  if (!g) return loi('không thấy cảnh');
  if (g.chan.length) return loi(g.chan.join(' · '));
  const { bc } = g;
  if (chatLieuPhim(bc.kt) === 'nguoi_that') await damBaoAnhMat(db, bc.nhanVat).catch((e: unknown) => console.error('[ảnh sát mặt]', e));   // phim người thật: kèm ảnh sát mặt
  if (moHinh && (/^(fal|ckey|shopaikey|google|plenxai):/.test(moHinh) || MO_HINH_ANH.some((m) => m.key === moHinh))) bc.kt.mo_hinh_anh = moHinh as typeof bc.kt.mo_hinh_anh;   // ckey:/shopaikey:/google:/plenxai: = chọn đích danh nguồn (cong-ai.ts)
  if (congAnh && /^(ckey|shopaikey|google|plenxai):/.test(congAnh)) bc.kt.mo_hinh_anh = congAnh as typeof bc.kt.mo_hinh_anh;   // cổng cho các bước Nano, vẫn nhiều bước
  await db.execute(sql`UPDATE xv_canh SET loi = '' WHERE id = ${canhId}`);
  const { prompt, urlRef, haiBuoc } = chuanBiKeyframe(bc);
  const promptS = siet ? `${prompt}\n\n${siet}` : prompt;   // prompt nguồn đã siết (đường lop plate + một bước)
  const jobs: number[] = [];
  // Chọn đích danh model khác (so A/B) → đi đường một bước như cũ; mặc định có độ sâu 3D → hai bước.
  // LƯỢT NƯỚC MẮT (qc-cam-xuc.ts › NUOC_MAT): nét khóc / cười đau / nhục nhã ở đầu shot → thêm nước mắt bằng một lượt sửa ảnh (đường LoRA) hoặc gộp
  // vào lượt sửa sẵn có (bước 2 nhân dạng, lượt hoà ánh sáng của ghép từng người) — FLUX độ sâu không tự vẽ nước mắt.
  const nuoc = cauNuocMat(bc.canh.bieu_cam);
  if (haiBuoc?.lop && !moHinh) {   // shot ≥ 2 người: ghép từng người (đồng bộ, chọn ảnh khi xong)
    const r = await ghepTungNguoi(db, canhId, bc.canh.thu_tu, bc.kt, haiBuoc.lop, { prompt: promptS, refs: urlRef }, jobs, nuoc);
    return r.ok ? { ok: true, data: jobs } : loi(`ghép từng người: ${r.loi}`);
  }
  if (haiBuoc && !moHinh) {
    for (let i = 0; i < Math.max(1, Math.min(3, so)); i++) {
      const b1 = await buocDoSau(db, canhId, bc.canh.thu_tu, haiBuoc, bc.kt.ti_le);
      if (!b1.ok) return loi(`bước 1 (độ sâu): ${b1.loi}`);
      // CỔNG SAU BƯỚC 1 (0đ, YuNet): khung 3D có người quay mặt về máy (cùng luật câu hỏi kiểm [mat:]) mà ảnh bước 1 không có mặt người nào → dừng,
      // không trả tiền bước 2 cho ảnh hỏng. Tập 122 #11: 4 lượt bước 1 vẽ ma-nơ-canh thành bình / tượng, bước 2 tự đặt người bừa chỗ khác.
      // chỉ người ĐỦ LỚN (≥ 30% chiều cao khung 3D) mới bắt buộc thấy mặt — người nhỏ ở khung rộng mặt vài chục px, bộ dò không chắc bắt được
      const lon = new Set((bc.canh.khung_xam?.kiem ?? []).filter((k) => k.trong_khung && k.cao_khung_pt >= 30).map((k) => k.nhan_vat));
      const canMat = cauHoiKhung({ canh: bc.canh, nhanVat: bc.nhanVat, may: bc.mayDu, kg: bc.khongGian }).filter((q) => q.ma.startsWith('mat:') && lon.has(q.ma.slice(4))).length;
      if (canMat && (await demMat(b1.url)) === 0) return loi(`bước 1 không có mặt người nào (khung 3D cần ${canMat}) — dừng trước bước 2, ảnh bước 1: ${b1.url}`);
      const thamChieuUrl = [b1.url, ...haiBuoc.ref2];
      // LoRA lo MẶT; trang phục / vết bẩn / đạo cụ vẫn phải qua lượt sửa theo ảnh mẫu (18/10/2026: bỏ lượt này thì #12–#15 mất áo dính cà phê, đổi màu váy)
      const p2 = [haiBuoc.prompt2, siet, haiBuoc.motBuoc ? KHOA_MAT_LORA : '', nuoc].filter(Boolean).join(' ');
      const job = await taoJob(db, { nhan: `Keyframe (bước 2 · nhân dạng) · cảnh #${bc.canh.thu_tu} ${bc.canh.canh}`, canh_id: canhId, loai: 'anh', provider: 'google', model: bc.kt.mo_hinh_anh, request: { prompt: p2, thamChieu: thamChieuUrl.length, thamChieuUrl, buoc1: b1.url } });
      jobs.push(job);
      await dayViecAnh({ job, model: bc.kt.mo_hinh_anh, prompt: p2, thamChieuUrl, tiLe: bc.kt.ti_le, thuMuc: `keyframe/${canhId}` });
    }
    return { ok: true, data: jobs };
  }
  for (let i = 0; i < Math.max(1, Math.min(3, so)); i++) {
    const job = await taoJob(db, { nhan: `Keyframe · cảnh #${bc.canh.thu_tu} ${bc.canh.canh}`, canh_id: canhId, loai: 'anh', provider: 'google', model: bc.kt.mo_hinh_anh, request: { prompt: promptS, thamChieu: urlRef.length, thamChieuUrl: urlRef } });
    jobs.push(job);
    await dayViecAnh({ job, model: bc.kt.mo_hinh_anh, prompt: promptS, thamChieuUrl: urlRef, tiLe: bc.kt.ti_le, thuMuc: `keyframe/${canhId}` });
  }
  return { ok: true, data: jobs };
}

/** DỰNG TẠI CHỖ (shot ≥ 2 người). Chặng đường 18/10/2026: ghép từng người trên nền xanh rồi cắt / co / dán → người bóp ngang x1,2–1,9 (#12, #15),
 *  bóng bị mép khung cắt thì người tí hon (#14), lượt "hoà ánh sáng" cả khung vẽ thêm người (#15 hai Vivian) → thử plate FLUX độ sâu + vẽ lại thân
 *  tại chỗ: đúng chỗ đúng cỡ nhưng ánh sáng phẳng như ảnh stock (anh: "bản ghép 3D VFX không đẹp so với bản sinh bằng Nano thuần") — FLUX chỉ thấy
 *  KHỐI (độ sâu), không thấy màu / ánh sáng của khung 3D.
 *  Cách phim làm: CHẤT ẢNH + ÁNH SÁNG đến từ tấm plate đẹp, MẶT chỉnh riêng ở độ phân giải cao rồi ghép đúng chỗ. Giờ: plate = Nano Banana MỘT lượt cả
 *  khung (khung 3D màu làm bố cục + ánh sáng, ảnh mẫu từng người — đường một bước vốn đẹp), đếm mặt chặn người thừa (vẽ lại một lần), rồi LƯỢT MẶT
 *  từng người có LoRA ở 1024². Không vẽ lại thân (làm phẳng ánh sáng), không lượt hoà sáng cả khung (vẽ thêm người). */
async function ghepTungNguoi(db: Db, canhId: number, thuTu: number, kt: KinhThanh, lop: LopGhep, nano: { prompt: string; refs: string[] }, jobs: number[], nuoc = ''): Promise<{ ok: true; url: string } | { ok: false; loi: string }> {
  const doc = kt.ti_le !== '16:9'; const mh: string = kt.mo_hinh_anh || MO_HINH_ANH[0]!.key;
  const veFal = async (nhan: string, model: string, input: Record<string, unknown>, co: { width: number; height: number }): Promise<{ ok: true; url: string } | { ok: false; loi: string }> => {
    const job = await taoJob(db, { nhan: `${nhan} · cảnh #${thuTu}`, canh_id: canhId, loai: 'anh', provider: 'fal', model: `fal:${model}`, request: { dich: 'keyframe_tai_cho', ...input } }); jobs.push(job);
    const kq = await chayAnhFal(model, { ...input, image_size: co, num_images: 1, output_format: 'jpeg', num_inference_steps: 28, guidance_scale: 3.5, enable_safety_checker: false });
    if (!kq.ok) { await xongJob(db, job, { loi: kq.loi }); return kq; }
    const url = await uploadToR2(`xuong-video/keyframe/${canhId}/tai-cho-${Date.now()}.jpg`, kq.data, kq.mimeType);
    if (!url) { await xongJob(db, job, { loi: 'không đẩy được ảnh lên kho', chi_phi_cents: GIA_XUONG_CENTS }); return { ok: false, loi: 'không đẩy được ảnh lên kho' }; }   // đã trả tiền → vẫn vào sổ
    await xongJob(db, job, { output_url: url, chi_phi_cents: GIA_XUONG_CENTS });
    return { ok: true, url };
  };
  const veNano = async (nhan: string, prompt: string, urls: string[]): Promise<{ ok: true; url: string } | { ok: false; loi: string }> => {
    const job = await taoJob(db, { nhan: `${nhan} · cảnh #${thuTu}`, canh_id: canhId, loai: 'anh', provider: 'google', model: mh, request: { prompt, thamChieu: urls.length, thamChieuUrl: urls } }); jobs.push(job);
    const kq = await sinhAnh({ model: mh, prompt, thamChieuUrl: urls, thamChieu: (await Promise.all(urls.map(taiAnhBase64))).filter((x): x is NonNullable<typeof x> => !!x), tiLe: doc ? '9:16' : '16:9' });
    if (!kq.ok) { await xongJob(db, job, { loi: kq.loi }); return { ok: false, loi: kq.loi }; }
    const url = await uploadToR2(`xuong-video/keyframe/${canhId}/plate-${Date.now()}.jpg`, kq.data, kq.mimeType);
    if (!url) { await xongJob(db, job, { loi: 'không đẩy được ảnh lên kho', chi_phi_cents: await giaAnhSv(mh) }); return { ok: false, loi: 'không đẩy được ảnh lên kho' }; }   // đã trả tiền → vẫn vào sổ
    await xongJob(db, job, { output_url: url, model: kq.model, chi_phi_cents: await giaAnhSv(mh) });
    return { ok: true, url };
  };
  const pPlate = [nano.prompt, nuoc].filter(Boolean).join(' ');
  let plate = await veNano('Keyframe (tại chỗ · plate Nano)', pPlate, nano.refs);
  if (!plate.ok) return { ok: false, loi: `plate: ${plate.loi}` };
  // NGƯỜI THỪA: Nano đôi khi vẽ thêm người (bóng phản chiếu thành người thứ ba — #15) → đếm mặt; thừa thì vẽ lại plate MỘT lần, vẫn thừa thì giữ bản ít mặt hơn
  const mat0 = await demMat(plate.url);
  if (mat0 !== null && mat0 > lop.nguoi.length) {
    const lai = await veNano('Keyframe (tại chỗ · plate Nano · vẽ lại vì thừa người)', `${pPlate} EXACTLY ${lop.nguoi.length} people in the whole image — no reflections or extra figures that look like people.`, nano.refs);
    if (lai.ok && ((await demMat(lai.url)) ?? 99) < mat0) plate = lai;
  }
  let cur = plate.url;
  // LƯỢT MẶT (kiểu Face Detailer / ADetailer — anh 18/10/2026 "sao mặt vẫn bị méo"): khung rộng nhiều người thì mặt chỉ ~70–80 px trong ảnh 720×1280,
  // FLUX không đủ điểm ảnh vẽ mắt / mũi / miệng → mặt phồng, lệch. Cắt vùng đầu từng người (định vị theo lớp độ sâu 3D của họ), phóng 1024², vẽ lại
  // MẶT bằng LoRA của chính người đó (mặt nạ elip giữa ô, giữ góc đầu / nét mặt / ánh sáng), thu về dán đúng ô bằng mặt nạ mờ biên + khớp màu.
  for (const x of lop.nguoi.filter((y) => y.loras)) {
    const { catVungDau, danVungDau } = await import('./soi-mat');
    const v = await catVungDau(cur, x.sau);
    if (!v) { console.error(`[lượt mặt] ${x.ten}: không thấy mặt trong vùng — bỏ qua`); continue; }
    const vung = await uploadToR2(`xuong-video/keyframe/${canhId}/mat-vung-${Date.now()}.jpg`, Buffer.from(v.b64, 'base64'), 'image/jpeg');
    const mn = await matNaElip(canhId);
    if (!vung || !mn) return { ok: false, loi: `${x.ten}: không đẩy được vùng đầu / mặt nạ` };
    const n = nuoc && nuoc.includes(x.ten) ? ` ${nuoc}` : '';
    const r = await veFal(`Keyframe (tại chỗ · ${x.ten} · mặt 1024)`, MO_HINH_VE_TAI_CHO, { prompt: `${KHONG_CHU} Close-up of the face, sharp natural skin detail, same head angle, expression and lighting. ${x.prompt_tai_cho}${n}`, image_url: vung, mask_url: mn, strength: 0.55, loras: x.loras }, { width: 1024, height: 1024 });
    if (!r.ok) return { ok: false, loi: `${x.ten} (mặt): ${r.loi}` };
    const b64 = await danVungDau(cur, r.url, v.hop);
    const url = b64 && await uploadToR2(`xuong-video/keyframe/${canhId}/tai-cho-mat-${Date.now()}.jpg`, Buffer.from(b64, 'base64'), 'image/jpeg');
    if (!url) return { ok: false, loi: `${x.ten}: dán mặt hỏng` };
    cur = url;
  }
  const cuoi = cur;
  const { chonKeyframe } = await import('./tu-sua-clip');
  await chonKeyframe(db, canhId, cuoi, 'dựng tại chỗ');
  return { ok: true, url: cuoi };
}

/** BƯỚC 1 của keyframe hai bước: FLUX depth (fal) từ bản đồ độ sâu 3D + chữ → ảnh thật đúng góc máy / bố cục. Chạy tại chỗ (10–30s), có job
 *  riêng trên sổ (tiền theo bảng giá fal, không đọc được thì 5 ¢ — giá công bố $0,05/MP). Ảnh lên kho để bước 2 dùng làm ảnh gốc. */
export const MO_HINH_DO_SAU = 'fal-ai/flux-pro/v1/depth';
/** BƯỚC 1 khi khung có NGƯỜI: FLUX general + ControlNet Union (InstantX) — độ sâu + khung xương OpenPose cùng lúc. Chỉ độ sâu thì ma-nơ-canh khối elip
 *  bị cắt sát khung thành đồ vật (tập 122 #11: bình đồng cắm cây, không người nào) và bước 2 tự đặt người bừa. Giá $0,075/MP, 720×1280 = 1 MP. */
export const MO_HINH_XUONG = 'fal-ai/flux-general';
/** Vẽ lại TẠI CHỖ một người trên plate: mặt nạ + LoRA + độ sâu (dựng tại chỗ — ghepTungNguoi). */
export const MO_HINH_VE_TAI_CHO = 'fal-ai/flux-general/inpainting';
/** Mặt nạ ELIP giữa ô vùng đầu 1024² (cùng hình elip mà soi-mat.py › dan dán lại) — lượt mặt chỉ vẽ lại mặt, giữ tóc / nền ở mép ô. */
async function matNaElip(canhId: number): Promise<string | null> {
  try {
    const sharp = (await import('sharp')).default;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="black"/><ellipse cx="512" cy="481" rx="338" ry="410" fill="white"/></svg>`;
    return await uploadToR2(`xuong-video/keyframe/${canhId}/mat-na-elip.png`, await sharp(Buffer.from(svg)).png().toBuffer(), 'image/png');
  } catch (e) { console.error('[mặt nạ elip]', e); return null; }
}
/** FLUX dev độ sâu + LoRA mặt nhân vật ($0,035 / MP — vẽ 720×1280 = 1 MP; 768×1365 bị làm tròn lên 2 MP, trả gấp đôi) */
export const MO_HINH_LORA_SAU = 'fal-ai/flux-lora-depth';
export const GIA_XUONG_CENTS = 7.5;
/** TẮT 18/10/2026: lượt thử #11 (độ sâu không người + khung xương) ra ảnh nhoè như ảnh ma — FLUX dev Union kém xa FLUX pro depth. Giữ đường để thử
 *  lại khi có model dáng tốt hơn; người trong độ sâu giờ là thân liền (mesh/nguoi.py › than_tron). */
export const DUNG_XUONG = false;
const UNION_XUONG = 'InstantX/FLUX.1-dev-Controlnet-Union';
async function buocDoSau(db: Db, canhId: number, thuTu: number, h: HaiBuoc, tiLe: string): Promise<{ ok: true; url: string } | { ok: false; loi: string }> {
  const mh = h.loras?.length ? MO_HINH_LORA_SAU : h.xuong ? MO_HINH_XUONG : MO_HINH_DO_SAU;
  const job = await taoJob(db, { nhan: `Keyframe (bước 1 · ${h.xuong ? 'độ sâu + dáng' : 'độ sâu'}) · cảnh #${thuTu}`, canh_id: canhId, loai: 'anh', provider: 'fal', model: `fal:${mh}`, request: { dich: 'keyframe_buoc1', prompt: h.prompt1, control: h.sau, ...(h.xuong ? { xuong: h.xuong } : {}) } });
  const doc = tiLe !== '16:9';
  const kq = h.loras?.length
    ? await chayAnhFal(MO_HINH_LORA_SAU, { prompt: h.prompt1, image_url: h.sau, loras: h.loras, image_size: doc ? { width: 720, height: 1280 } : { width: 1280, height: 720 }, num_images: 1, output_format: 'jpeg', enable_safety_checker: false })
    : h.xuong
    ? await chayAnhFal(MO_HINH_XUONG, { prompt: h.prompt1, image_size: doc ? { width: 720, height: 1280 } : { width: 1280, height: 720 }, num_images: 1, output_format: 'jpeg', num_inference_steps: 28, guidance_scale: 3.5,
        controlnet_unions: [{ path: UNION_XUONG, controls: [{ control_image_url: h.sau, control_mode: 'depth', conditioning_scale: 0.6 }, { control_image_url: h.xuong, control_mode: 'pose', conditioning_scale: 1 }] }] })
    : await chayAnhFal(MO_HINH_DO_SAU, { prompt: h.prompt1, control_image_url: h.sau, image_size: doc ? { width: 768, height: 1365 } : { width: 1365, height: 768 }, num_images: 1, output_format: 'jpeg', safety_tolerance: '5' });
  if (!kq.ok) { await xongJob(db, job, { loi: kq.loi }); return kq; }
  const gia = h.loras?.length ? 3.5 : h.xuong ? GIA_XUONG_CENTS : (await modelFal(MO_HINH_DO_SAU))?.giaCents ?? 5;
  const url = await uploadToR2(`xuong-video/keyframe/${canhId}/buoc1-${Date.now()}.jpg`, kq.data, kq.mimeType);
  // ảnh đã vẽ (fal đã tính tiền) mà không đẩy được → vẫn ghi tiền vào sổ: sổ chi phí là tiền THẬT đã ra, không phải tiền ra ảnh
  if (!url) { await xongJob(db, job, { loi: 'không đẩy được ảnh bước 1 lên kho', chi_phi_cents: gia }); return { ok: false, loi: 'không đẩy được ảnh bước 1 lên kho' }; }
  await xongJob(db, job, { output_url: url, chi_phi_cents: gia });
  return { ok: true, url };
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

/** Sinh MỘT bản cho một ảnh QC (anh-qc.ts): chép bố cục ảnh mẫu, sản phẩm theo ảnh thật của anchor, chữ đúng `chu`. Kết quả lên đầu
 *  xv_anh_qc.uv; ảnh chưa có bản đang dùng thì bản đầu thành bản đang dùng (hoan-tat.ts). Model = cột mo_hinh của dòng. */
export async function sinhAnhQcDb(db: Db, anhQcId: number): Promise<KqSinh<number>> {
  const loi = (x: string): KqSinh<number> => ({ ok: false, loi: x });
  const a = ((await db.execute(sql`SELECT a.*, p.kinh_thanh, p.ten AS ten_phim FROM xv_anh_qc a JOIN xv_phim p ON p.id = a.phim_id WHERE a.id = ${anhQcId}`)) as unknown as Row[])[0];
  if (!a) return loi('không thấy ảnh QC');
  const phimId = Number(a.phim_id);
  const nv = ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${phimId} ORDER BY id`)) as unknown as Row[]).map(mapNhanVat);
  const sp = sanPhamAnhQc(nv);
  if (!sp.length) return loi('phim chưa có anchor SẢN PHẨM có ảnh — ảnh QC cần ảnh thật của sản phẩm để không vẽ sai món (mục 2)');
  if (!String(a.mau_url ?? '') && !String(a.chu ?? '').trim()) return loi('chưa có ảnh mẫu lẫn chữ — chọn một khuôn hoặc dán ảnh QC mẫu');
  const chan = chanChuModel('en', { anchor: sp.map((x) => x.v) });
  if (chan) return loi(chan);
  const dang = (await db.execute(sql`SELECT 1 FROM xv_job WHERE request->>'dich' = 'anh_qc' AND (request->>'anh_qc_id')::int = ${anhQcId} AND ${jobDangCho()} LIMIT 1`)) as unknown as Row[];
  if (dang.length) return loi('ảnh này đang sinh — đợi xong rồi mới sinh thêm');
  const qc = docKinhThanh((a.kinh_thanh ?? {}) as KinhThanh).qc;
  const dong = { mau_url: String(a.mau_url ?? ''), chu: String(a.chu ?? ''), y_tuong: String(a.y_tuong ?? ''), ti_le: String(a.ti_le || '4:5') as AnhQc['ti_le'] };
  const { prompt, thamChieuUrl } = promptAnhQc(dong, { tenSp: qc.ten || String(a.ten_phim ?? ''), logoUrl: qc.logo_url || undefined, nv });
  const model = String(a.mo_hinh || MO_HINH_ANH[0].key);
  const job = await taoJob(db, { phim_id: phimId, nhan: `Ảnh QC · ${String(a.ten || a.khuon || `#${anhQcId}`)}`, loai: 'anh', provider: 'google', model, request: { dich: 'anh_qc', anh_qc_id: anhQcId, prompt, thamChieu: thamChieuUrl.length, thamChieuUrl } });
  await dayViecAnh({ job, model, prompt, thamChieuUrl, tiLe: dong.ti_le, thuMuc: `anh-qc/${phimId}` });
  return { ok: true, data: job };
}

/** Mô tả anchor gọn cho nhãn khối: bỏ phần sau ' — ' (vai trò trong truyện), cắt ở câu đầu, ≤ 140 ký tự. */
/** Mô tả vừa đủ cho prompt chỉ có chữ (bước 1 độ sâu): câu đầu đầy đủ tới ~320 ký tự, cắt ở ranh giới từ — moTaNgan cắt 140 ký tự làm mất
 *  đúng chi tiết nhận dạng ("two n…" mất mắt nút áo + vết ố cà phê của Mr. Wipe). */
export const moTaVua = (mo: string, toiDa = 320): string => { const a = mo.split(' — ')[0]!.trim().replace(/\.$/, ''); return a.length <= toiDa ? a : a.slice(0, a.lastIndexOf(' ', toiDa)).replace(/[,;:]$/, ''); };
export const moTaNgan = (mo: string): string => { const a = mo.split(' — ')[0]!.split(/(?<=\.)\s/)[0]!.trim().replace(/\.$/, ''); return a.length > 140 ? `${a.slice(0, 137)}…` : a; };
