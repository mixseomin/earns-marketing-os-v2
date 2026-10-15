// Sinh ảnh gốc anchor + keyframe shot — lõi dùng chung cho server action (actions.ts, đã kiểm quyền) và script trên box.
import 'server-only';
import { sql } from 'drizzle-orm';
import { dayViecAnh } from './hoan-tat';
import { promptAnhMau } from './claude';
import { promptCamXuc } from './am-thanh';
import { promptKyThuatAnh } from './dien-anh';
import { docKinhThanh, thanhPhanCanh, chanChuModel, phongCachHinh, locNhanh, noiKhungShot, camCongCuVe, laTayNguoi, MO_HINH_ANH, type Canh, type KinhThanh, type NhanVat } from './kieu';
import { chanTienKy, chanShot, phimQt } from './quy-trinh';
import { promptPoster, MO_HINH_POSTER, TI_LE_POSTER, type MauPoster } from './poster';
import { boSetCuaShot, chanKhungXam, huongVoiMay, loiMachTap, moTaThay, PT_THAY, shotSoTruc, trangThaiVat } from './bo-set-3d';
import { mapBoSet } from './bo-set-3d-may';
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
export function xepThamChieu(nv: NhanVat[], btCanh: (v: NhanVat) => { anh_url?: string | null } | undefined = () => undefined, nhieuMau = true, truoc = 0): { urlRef: string[]; banDoRef: string; vai: { url: string; nhan: string }[] } {
  const vai: { url: string; nhan: string }[] = [];
  const thuTu = [...nv.filter((v) => v.loai === 'san_pham'), ...nv.filter((v) => v.loai === 'nhan_vat'), ...nv.filter((v) => v.loai !== 'san_pham' && v.loai !== 'nhan_vat')];
  const urlRef: string[] = []; const dong: string[] = [];
  for (const v of thuTu) {
    const b = btCanh(v);
    // Sản phẩm: shot chọn biến thể màu có ảnh thật (vd 'Medium Blue') → ảnh đó là màu chính; không thì ảnh đầu của anchor.
    const anh = v.loai === 'san_pham' ? (b?.anh_url ? [b.anh_url, ...(nhieuMau ? v.anh_ref.filter((u) => u !== b.anh_url).slice(0, 2) : [])] : v.anh_ref.slice(0, nhieuMau ? 3 : 1)) : [...(b?.anh_url ? [b.anh_url] : []), ...v.anh_ref.slice(0, b?.anh_url ? 1 : 2)];
    const con = Math.max(0, 10 - truoc - urlRef.length);
    const lay = anh.slice(0, con);
    if (!lay.length) continue;
    const tu = truoc + urlRef.length + 1; urlRef.push(...lay); const den = truoc + urlRef.length;   // truoc = số ảnh đứng trước (khung xám là ảnh 1)
    const bt = b?.anh_url ? (v.bien_the ?? []).find((x) => x.anh_url === b.anh_url) : undefined;
    lay.forEach((u, i) => vai.push({ url: u, nhan: `${v.loai === 'san_pham' ? '👖 sản phẩm' : v.loai === 'nhan_vat' ? '🧍 người' : v.loai === 'boi_canh' ? '🏠 bối cảnh' : '🧸 đạo cụ'} · ${v.ten}${u === b?.anh_url ? ` · ${bt?.ten ?? 'biến thể'}` : ''}${v.loai === 'san_pham' && i === 0 ? ' · màu chính' : ''}` }));
    const so = tu === den ? `image ${tu}` : `images ${tu}–${den}`;
    dong.push(v.loai === 'san_pham'
      ? `${so} = THE PRODUCT: draw exactly this item — same cut, pockets, seams, hardware and fabric texture; never a generic version. ${lay.length > 1 ? `Image ${tu} shows its MAIN color — use exactly that color unless the shot names another color of the same item; the other product images show other colors of the same item.` : 'Use exactly its color.'} Where text and these images disagree, the images win. Do not write its name.`
      : v.loai === 'nhan_vat' ? `${so} = the person ${v.ten} (same face, hair, age, body).` : `${so} = ${v.loai === 'boi_canh' ? 'the location' : 'the prop'} ${v.ten}.`);
  }
  return { urlRef, banDoRef: dong.length ? `Reference images: ${dong.join(' ')}` : '', vai };
}

/** Sinh "ảnh mẫu" cho anchor từ mô tả (character sheet). Ảnh thêm vào anh_ref; các cảnh sau dùng nó làm tham chiếu.
 *  so = số ảnh một lượt (#1351, anh 13/10/2026: "mỗi lần sinh cần thêm vài góc khác chứ không chỉ một góc chính"): ảnh thứ k lấy góc thứ
 *  (đã có + k) trong claude.ts › GOC_THEM — lần đầu = ảnh chính + các góc phụ, lần sau = các góc chưa có. Trả job đầu tiên. */
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

/** Sinh KEYFRAME KẾT cho một shot (khung cuối, từ khung màu chỗ kết của bản 3D) — cần keyframe mở + khung màu kết. Lưu vào xv_canh.keyframe_ket. */
export async function sinhKeyframeKetCanh(db: Db, canhId: number): Promise<KqSinh<number>> {
  const bc = await boiCanhCanh(db, canhId);
  if (!bc) return { ok: false, loi: 'không thấy cảnh' };
  if (!bc.canh.keyframe_url) return { ok: false, loi: 'shot chưa có keyframe mở' };
  if (!bc.canh.khung_xam?.mau_ket) return { ok: false, loi: 'shot không có khung màu chỗ kết (không ai di chuyển / quay trong shot, hoặc chưa dựng khung 3D)' };
  const { prompt, urlRef } = chuanBiKeyframe(bc, true);
  const job = await taoJob(db, { nhan: `Keyframe KẾT · cảnh #${bc.canh.thu_tu} ${bc.canh.canh}`, canh_id: canhId, loai: 'anh', provider: 'google', model: bc.kt.mo_hinh_anh, request: { prompt, thamChieu: urlRef.length, thamChieuUrl: urlRef, dich: 'keyframe_ket' } });
  await dayViecAnh({ job, model: bc.kt.mo_hinh_anh, prompt, thamChieuUrl: urlRef, tiLe: bc.kt.ti_le, thuMuc: `keyframe/${canhId}-ket` });
  return { ok: true, data: job };
}

/** Câu lệnh + ảnh tham chiếu sẽ gửi cho keyframe của một shot — MỘT chỗ cho lúc sinh thật và sơ đồ nguồn (so "đã gửi" với "giờ sẽ gửi"). */
export function chuanBiKeyframe(bc: NonNullable<Awaited<ReturnType<typeof boiCanhCanh>>>, ket = false): { prompt: string; urlRef: string[]; vai: { url: string; nhan: string }[] } {
  // Mỗi anchor: ảnh biến thể cảnh chọn (nếu đã sinh) đứng TRƯỚC, rồi ảnh gốc — model bám biến thể mà vẫn giữ danh tính.
  const btCanh = (v: NhanVat) => (v.bien_the ?? []).find((b) => bc.canh.bien_the.includes(b.id));
  // Sản phẩm đứng ĐẦU danh sách tham chiếu (3 ảnh), rồi người/bối cảnh — và prompt nói rõ ảnh số mấy là gì, ảnh thắng chữ (#1256: quần
  // sinh ra là jeans chung chung vì ảnh sản phẩm nằm sau ảnh người, không được gọi tên, còn chữ mô tả "light blue, cúc đồng" lấn ảnh).
  // Shot có KHUNG XÁM 3D: bố trí + hậu cảnh lấy từ 3D, nên KHÔNG gửi ảnh mẫu bối cảnh lẫn chữ tả bối cảnh (thử #23 tập 19, 14/10/2026: ảnh
  // mẫu 'Cable Jungle' có màn hình phía sau → keyframe vẽ thêm chân iMac + màn hình nơi 3D là bức tường xa). Chất liệu/ánh sáng vẫn theo phong cách phim.
  const coKx = !!bc.canh.khung_xam?.xam;
  // Đạo cụ / sản phẩm KHÔNG có trong khung 3D (kể cả các phần của nó) thì không gửi ảnh mẫu + chữ tả: ảnh mẫu là lời mời vẽ (15/10/2026 shot #32
  // tập 19: ảnh mẫu USB Hub đi kèm dù hub nằm ngoài khung → keyframe đặt Tango đứng trên hub). Trạng thái vật vẫn nói ở câu OBJECT STATE.
  // Chỉ khung MỞ: khung kết chưa đo "thấy gì" riêng.
  const ngoaiKhung = (v: NhanVat) => !ket && !!bc.ptAnchor && (v.loai === 'dao_cu' || v.loai === 'san_pham') && (bc.ptAnchor.get(v.ten) ?? 0) < PT_THAY;
  const nvRef = coKx ? bc.nhanVat.filter((v) => v.loai !== 'boi_canh' && !ngoaiKhung(v)) : bc.nhanVat;
  // Khung xám là ẢNH SỐ 1 (thử #23: đứng thứ 8/9 sau bảy ảnh mẫu thì model coi nhẹ bố trí).
  // Có khung MÀU (vật liệu + ánh sáng theo kịch bản) thì nó là ảnh số 1 — gần ảnh thật hơn khung xám, model ít phải đoán khối nào là gì.
  // ket = keyframe KẾT: ảnh số 1 là khung màu ở chỗ kết (khung_xam.mau_ket).
  const kxMau = coKx ? (ket ? bc.canh.khung_xam!.mau_ket ?? null : bc.canh.khung_xam!.mau ?? null) : null;
  const kx = coKx ? kxMau ?? bc.canh.khung_xam!.xam : null;
  const tc = xepThamChieu(nvRef, btCanh, shotNhieuMau(`${bc.canh.prompt_anh} ${bc.canh.trang_phuc}`), kx ? 1 : 0);
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
  const kxChu = kx ? (kxMau ? `Image ${soKx} = a COLOUR 3D PREVIS render of THIS exact frame from the real set: camera, framing, horizon, every object's and character's position, size and overlap, the lighting direction and colours are all correct — re-create it as the real photographed miniature, keeping everything exactly where it is; materials get real detail, and each character's exact look comes from its reference images (the previs shapes are only stand-ins).` : `Image ${soKx} = a grey-box 3D LAYOUT render from THIS shot's exact camera on the real set: every object and every character must sit EXACTLY where its block is, and NOTHING that is not a block may appear — same position, size, overlap, perspective, horizon and framing. It shows layout only: colours, materials and lighting come from the style and the other reference images, never grey blocks.`) + ` ${ket ? 'Image 1 shows where everything is at the END of the shot.' : moTaThay(bc.canh.khung_xam?.thay, goiVat)}` : '';
  // LIỀN MÁY: shot trước chọn chuyển cảnh 'lien_may' → clip của nó kết bằng ảnh này, nên ảnh này phải là giây kế tiếp của chính khung đó
  // (cùng nơi, cùng phía máy, vị trí + đồ vật + trạng thái nối tiếp) — keyframe shot trước làm ảnh tham chiếu cuối (Tango & Lint tập 1: 0/20
  // clip nối khung, shot sau không thấy liên quan shot trước).
  // Keyframe KẾT: khung MỞ đã duyệt của chính shot làm tham chiếu nhân vật / ánh sáng / chất liệu — ảnh mới là cùng shot ở khoảnh khắc cuối.
  const moUrl = ket && bc.canh.keyframe_url && urlRef.length < 10 ? bc.canh.keyframe_url : null;
  if (moUrl) { urlRef.push(moUrl); vai.push({ url: moUrl, nhan: '▶ khung mở của chính shot' }); }
  const moChu = moUrl ? `Image ${urlRef.length} = the START frame of this very shot: same characters, look, materials, lighting and set — this new image is the same shot at its LAST moment, everyone moved to where Image 1 shows them.` : '';
  const tr = bc.truoc;
  const noi = !ket && tr?.keyframe_url && noiKhungShot(false, tr) && urlRef.length < 10 ? tr.keyframe_url : null;
  if (noi) { urlRef.push(noi); vai.push({ url: noi, nhan: `⛓ khung shot #${tr!.thu_tu} (liền máy)` }); }
  const noiChu = noi ? `Image ${urlRef.length} = the frame just before this one (the same continuous moment): keep the same place, camera side, lighting, and every character's and object's position and state; show only the next instant of the action described.` : '';
  // CÙNG CẢNH: keyframe shot mở cảnh làm tham chiếu BỐ TRÍ (không phải khung hình) — mọi shot trong cảnh đứng trên cùng một bộ set như stop-motion thật.
  const ms = bc.master;
  // Có khung xám thì bố trí cảnh đã nằm trong 3D — keyframe mở cảnh (có thể dựng trên 3D cũ) chỉ kéo lệch hậu cảnh, không gửi.
  const msUrl = !kx && ms?.keyframe_url && ms.keyframe_url !== noi && urlRef.length < 10 ? ms.keyframe_url : null;
  if (msUrl) { urlRef.push(msUrl); vai.push({ url: msUrl, nhan: `🗺 bố trí cảnh (shot mở cảnh #${ms!.thu_tu})` }); }
  const soMs = urlRef.length;
  // CẮT TRONG CẢNH: khung shot liền trước mang TRẠNG THÁI qua cú cắt (ai cầm gì, bẹp hay tròn, đứng đâu) — chuyển cảnh là chỗ hay hỏng nhất.
  // Có khung xám: chỗ đứng + trạng thái mở đã nằm trong 3D + thẻ shot; keyframe shot trước (có thể dựng trên 3D cũ) chỉ kéo lệch hậu cảnh (thử #23).
  const trUrl = !kx && !noi && tr?.keyframe_url && tr.phan_doan === bc.canh.phan_doan && tr.keyframe_url !== ms?.keyframe_url && urlRef.length < 9 ? tr.keyframe_url : null;
  if (trUrl) { urlRef.push(trUrl); vai.push({ url: trUrl, nhan: `✂ trạng thái shot trước #${tr!.thu_tu}` }); }
  const trChu = trUrl ? `Image ${urlRef.length} = the shot just before this cut, same scene: carry over every character's and object's STATE and place in the set (what they hold, their shape, where they stand) unless the action above changes it; stay on the same side of the action. Do NOT copy its framing.` : '';
  // KHUNG CHUẨN MÀU của cảnh (hero frame / color script, luật khung_chuan_mau): shot có 3D thì bố trí lấy từ Image 1, nhưng TÔNG MÀU / phơi sáng / màu
  // đèn lấy từ keyframe mở cảnh đã có — mỗi keyframe một tông (#32 có màn hình xanh sau lưng trong khi 3D là tường tối) là lỗi khán giả thấy ngay.
  const mauUrl = kx && !ket && ms?.keyframe_url && ms.keyframe_url !== noi && urlRef.length < 10 ? ms.keyframe_url : null;
  if (mauUrl) { urlRef.push(mauUrl); vai.push({ url: mauUrl, nhan: `🎨 khung chuẩn màu (shot mở cảnh #${ms!.thu_tu})` }); }
  const mauChu = mauUrl ? `Image ${urlRef.length} = the COLOUR & LIGHT reference of this scene (its opening frame): match its colour grade, white balance, exposure, contrast and the colour of the light exactly. Do NOT copy its layout, camera angle, framing or background — those come from Image 1 only.` : '';
  const msChu = msUrl ? `Image ${soMs} = the opening shot of this same scene, on the same physical set: keep the SET LAYOUT identical — where every object stands relative to the others (and what is in front of / behind what), and which side of those objects each character is on, consistent with the action. Do NOT copy its framing: the camera position, angle and shot size come from the composition described above, but the camera stays on the same side of the action as in that shot.` : '';
  // Thẻ shot: bố cục 3 lớp + trạng thái MỞ + hướng — keyframe là khung đầu của shot.
  const dd = bc.canh.dan_dung ?? {};
  const theChu = [dd.bo_cuc?.trim() && `Composition (foreground / midground / background): ${dd.bo_cuc.trim()}`, (ket ? dd.ket?.trim() && `This frame is the END of the shot: ${dd.ket.trim()}` : dd.mo?.trim() && `This frame is the START of the shot: ${dd.mo.trim()}`), dd.huong?.trim() && `Eyelines and screen direction: ${dd.huong.trim()}`].filter(Boolean).map((x) => `${x}.`).join(' ');
  // Cấm tay người / dụng cụ vẽ lạc khung — CÙNG luật với prompt video (kieu.ts › camCongCuVe); trước đây chỉ video có, keyframe thì không.
  // KHOÁ ÁNH SÁNG CẢNH (nối thử #22→#24: ba shot ba tông — gỗ sáng ấm / xanh lục tối / tối đốm sáng): shot có 3D dùng chung một câu ánh sáng
  // lấy từ dữ liệu (đèn bàn bật hay tắt), mọi shot cùng cảnh cùng tông, hậu cảnh ngoài bộ set tối.
  const anhSang = kx ? (bc.canh.may_3d?.den_ban
    ? 'Scene lighting, identical in every shot of this scene: the warm desk lamp is ON (soft golden light from the lamp side) mixed with a faint cool glow from the screens; the room beyond the desk falls off to dark; same exposure and colour grade as the rest of the scene.'
    : 'Scene lighting, identical in every shot of this scene: night, the desk lamp is OFF — only the cool blue glow of the screens lights the desk, with deep soft shadows; the room beyond the desk is dark (no bokeh, no extra lamps); same exposure and colour grade in every shot.') : '';
  // TRẠNG THÁI VẬT (15/10/2026: kẹo đã bẻ đôi nằm ngoài khung 3D của 7.1a → không có nhãn → keyframe vẽ con gấu nguyên theo ảnh mẫu): mọi anchor
  // của shot đang ở trạng thái khác ảnh mẫu thì nói thẳng, đè lên ảnh mẫu — lấy từ 3D đầy đủ (kể cả đồ để lại), không dò chữ.
  const trangChu = ((bc.mayDu ?? bc.canh.may_3d)?.vi_tri ?? []).filter((v) => bc.nhanVat.some((n) => n.ten === v.ten)).map((v) => { const t = trangThaiVat(v, ket); return t ? `${v.ten}: ${t}` : ''; }).filter(Boolean);
  const trangCau = trangChu.length ? `STATE in this frame (overrides the reference photos): ${trangChu.join('; ')}.` : '';
  // TỈ LỆ NHÂN VẬT (lineup / size chart, luật ti_le_nhan_vat): mỗi nhân vật một tấm mẫu riêng nên model đoán tỉ lệ; 3D đã đúng — nói bằng số so với
  // nhân vật đầu tiên trong khung (chiều cao khối khoi_3d).
  const caoCua = (ten: string) => bc.nhanVat.find((n) => n.ten === ten && n.loai === 'nhan_vat')?.khoi_3d?.co?.[2];
  const nvKhung = kx ? ((bc.mayDu ?? bc.canh.may_3d)?.vi_tri ?? []).filter((v) => !v.an && caoCua(v.ten) && (bc.canh.khung_xam?.thay ?? []).some((t) => t.ten === v.ten && t.pt >= PT_THAY)).map((v) => v.ten) : [];
  const goc0 = nvKhung[0]; const h0 = goc0 ? caoCua(goc0)! : 0;
  const tiLeCau = nvKhung.length >= 2 && h0 > 0 ? `SCALE (relative heights, exactly as Image 1 shows): ${nvKhung.slice(1).map((t) => `${t} is ${Math.round((caoCua(t)! / h0) * 10) / 10}× the height of ${goc0}`).join('; ')}.` : '';
  // HƯỚNG NHÂN VẬT so với máy, từ số 3D (15/10/2026 #38: 3D thấy Tango nghiêng hẳn, keyframe vẽ mặt nhìn thẳng máy theo ảnh mẫu — prompt không nói hướng).
  const mHuong = bc.mayDu ?? bc.canh.may_3d; const trongKhung = new Set((bc.canh.khung_xam?.thay ?? []).filter((t) => t.pt >= PT_THAY).map((t) => t.ten));
  const huongChu = kx && mHuong ? mHuong.vi_tri.filter((v) => !v.an && trongKhung.has(v.ten) && bc.nhanVat.some((n) => n.ten === v.ten && n.loai === 'nhan_vat'))
    .map((v) => { const h = huongVoiMay(mHuong, v, ket); return h ? `${v.ten}: ${h.chu}` : ''; }).filter(Boolean) : [];
  const huongCau = huongChu.length ? `CHARACTER FACING in this frame, exactly as Image 1 shows (overrides the pose in the reference sheets): ${huongChu.join('; ')}.` : '';
  const prompt = [ghepPromptAnh(bc.canh.prompt_anh, phongCachHinh(bc.kt.phong_cach), nvRef, promptKyThuatAnh(bc.canh.ky_thuat), bc.canh.trang_phuc), camCongCuVe(bc.kt.phong_cach, laTayNguoi(bc.nhanVat)), kxChu, trangCau, huongCau, tiLeCau, anhSang, mauChu, moChu, theChu, banDoRef, noiChu, trChu, msChu, ghiChuBt, promptCamXuc(bc.canh, bc.nhanVat, 'anh')].filter(Boolean).join(' ');
  return { prompt, urlRef, vai };
}

/** MỘT CẢNH MỘT MODEL ẢNH (luật mot_model_canh): keyframe của shot sinh bằng model khác với đa số keyframe cùng cảnh → không tiêu tiền video lên
 *  khung lệch "tay vẽ"; sinh lại keyframe bằng model của cảnh trước. Model lấy từ job đã sinh ra đúng tệp keyframe (xv_job.output_url). */
export async function tronModelCanh(db: Db, c: Pick<Canh, 'id' | 'tap_id' | 'phan_doan' | 'keyframe_url'>): Promise<string | null> {
  if (!c.keyframe_url || !c.phan_doan) return null;
  const r = (await db.execute(sql`SELECT c.id, c.thu_tu, j.model FROM xv_canh c JOIN xv_job j ON j.output_url = c.keyframe_url AND j.loai = 'anh'
    WHERE c.tap_id = ${c.tap_id} AND c.phan_doan = ${c.phan_doan} AND c.keyframe_url IS NOT NULL`)) as unknown as Row[];
  const cua = r.find((x) => Number(x.id) === c.id); if (!cua || r.length < 2) return null;
  // Cùng model qua cổng khác (ckey / ShopAIKey / Google — chuỗi dự phòng của xưởng) là MỘT tay vẽ: bỏ tiền tố cổng trước khi so.
  const goc = (m: unknown) => String(m).replace(/^(shopaikey|ckey|google):/, '');
  const dem = new Map<string, number>(); for (const x of r) dem.set(goc(x.model), (dem.get(goc(x.model)) ?? 0) + 1);
  const [daSo, so] = [...dem].sort((a, b) => b[1] - a[1])[0]!;
  return goc(cua.model) !== daSo && so >= 2 ? `keyframe sinh bằng ${goc(cua.model)} trong khi cảnh "${c.phan_doan}" dùng ${daSo} (${so}/${r.length} shot) — một cảnh một model: sinh lại keyframe bằng ${daSo}` : null;
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
  // Bộ set 3D: shot thuộc set phải có máy ảo + khung xám đúng mã + qua kiểm hình học (trong khung, không bị che, không vượt trục).
  const sid = boSetCuaShot(bc.canh, nvPhim);
  if (sid) {
    const r = (await db.execute(sql`SELECT * FROM xv_bo_set WHERE id = ${sid}`)) as unknown as Row[];
    const ds = locNhanh(tatCa, bc.canh.nhanh || 'A'); const i = ds.findIndex((c) => c.id === bc.canh.id);
    // Mã khung xám tính trên máy ĐẦY ĐỦ (có đồ để lại) — cùng cách bo-set-3d-may.ts dựng.
    const mDu = bc.mayDu ?? bc.canh.may_3d;   // máy đầy đủ (có đồ để lại) — doc-db.ts › boiCanhCanh, cùng nguồn với prompt
    const k = chanKhungXam({ ...bc.canh, may_3d: mDu }, nvPhim, r[0] ? mapBoSet(r[0]) : null, i > 0 ? shotSoTruc(ds, i) : null);
    // Mạch: mọi nhân vật mở shot này đúng chỗ lần cuối thấy nó kết + chuỗi chú ý nhìn → thấy → làm (cùng hàm dấu ⚠ trên lưới).
    k.push(...(loiMachTap(ds, nvPhim, r[0] ? [mapBoSet(r[0])] : [])[bc.canh.id] ?? []));
    if (k.length) chan.push(`Bộ set 3D: ${k.join('; ')}`);
  }
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
  if (moHinh && (/^(fal|ckey|shopaikey|google):/.test(moHinh) || MO_HINH_ANH.some((m) => m.key === moHinh))) bc.kt.mo_hinh_anh = moHinh as typeof bc.kt.mo_hinh_anh;   // ckey:/shopaikey:/google: = chọn đích danh nguồn (cong-ai.ts)
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

/** Mô tả anchor gọn cho nhãn khối: bỏ phần sau ' — ' (vai trò trong truyện), cắt ở câu đầu, ≤ 140 ký tự. */
export const moTaNgan = (mo: string): string => { const a = mo.split(' — ')[0]!.split(/(?<=\.)\s/)[0]!.trim().replace(/\.$/, ''); return a.length > 140 ? `${a.slice(0, 137)}…` : a; };
