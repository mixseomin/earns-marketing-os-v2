// THƯ VIỆN KHỐI PROMPT (anh 17/10/2026: "prompt có làm chuẩn hoá để có các thành phần dùng lại tổng quát, áp dụng cho các film khác, thể loại khác
// được chứ?"). Trước đây prompt ghép tay bằng nối chuỗi ở 5 chỗ (một bước, sửa từ 3D, FLUX bước 1, bước 2, video), mỗi chỗ tả lại nhân vật / bộ đồ /
// bối cảnh một kiểu và chữ theo CHẤT LIỆU PHIM ghi cứng ("miniature stop-motion set", "desk lamp OFF", "cartoon acting… squash and stretch") — phim
// người thật tập 122 nhận chữ hoạt hình, bộ chấm prompt cho 0/22 shot sạch. Ở đây:
//   · CHAT_LIEU — mọi chữ phụ thuộc chất liệu phim, MỘT bảng. Phim / thể loại mới = thêm một dòng, không sửa chỗ dựng prompt.
//   · Khoi — một thành phần có mã (máy, bối cảnh, người, đồ vật…); prompt = ghep(khối theo KHUON của đường sinh).
//   · KHUON — mỗi đường sinh khai khối nào BẮT BUỘC: bộ chấm (kiem-prompt.ts) báo thiếu khối, không chỉ soi chữ.
// Thuần (client lẫn server import được). Tự kiểm: prompt-khoi.test.mts
import { THAN_EN, thanMacDinh, type KhoiSet } from './kieu';
import { MOCAP_EN } from './mocap-kho';
export type ChatLieu = 'nguoi_that' | 'hoat_hinh';

type Goc = 'thap' | 'cao' | 'ngang';
/** Chữ theo chất liệu phim cho từng khối. Thêm thể loại: thêm khoá ở ChatLieu (kieu.ts › KinhThanh.chat_lieu) + một dòng ở đây. */
export const CHAT_LIEU: Record<ChatLieu, {
  /** ảnh cần ra là gì (đường một bước sửa từ ảnh 3D) */ anh_dich: (boiCanh: string) => string;
  /** câu ảnh 3D màu là gì, làm lại thành gì */ previs: string;
  /** bước 1 FLUX: câu mở theo góc máy */ flux_dau: (goc: Goc) => string;
  /** bước 1 FLUX: câu chốt chất liệu (không lặp chữ của phong cách phim) */ flux_cuoi: string;
  /** khoá ánh sáng cảnh (mọi shot cùng cảnh cùng tông) */ anh_sang: (denBan: boolean) => string;
  /** video: lối diễn */ dien_video: (rendau: boolean) => string;
  /** video: giữ đúng khung đầu (KHÔNG nói chuyện chữ — khối cam_chu nói một lần) */ giu_video: string;
  /** video: khung sống — chuyển động phụ hợp chất liệu; cận chèn (chen) không đòi cử động cả người */ song_video: (chen: boolean) => string;
  /** video: không thêm gì ngoài khung đầu */ khong_them: (vao: string) => string;
  /** chữ CẤM với chất liệu này (bộ chấm chặn nếu lọt vào) */ cam: RegExp;
}> = {
  nguoi_that: {
    anh_dich: (b) => `a real cinematic live-action film still${b ? ` — setting: ${b}` : ''}`,
    previs: 're-create it as a real live-action film frame shot on a real set with real actors',
    flux_dau: (g) => `Cinematic live-action film still, photorealistic, ${g === 'thap' ? 'low-angle shot looking up' : g === 'cao' ? 'high-angle shot looking down' : 'eye-level shot'}.`,
    flux_cuoi: 'Real people, real skin and fabric, natural motivated lighting, 35mm film look. No text, no letters, no numbers.',
    anh_sang: () => 'Scene lighting, identical in every shot of this scene: same light direction, exposure and colour grade as the rest of the scene.',
    dien_video: () => 'Naturalistic screen acting (real human timing, subtle and motivated, no cartoon exaggeration)',
    giu_video: 'Stay true to the first frame: same people, faces, wardrobe, set, framing, light and colours — real live-action footage.',
    // NỀN KHOÁ (anh 22/10/2026, phim #132 cảnh thang máy: "phần đằng sau lưng 2 người lúc sinh video hay ảnh hay bị thay đổi"): câu cũ "background stays
    // naturally alive (people breathing, slight shifts…) — never frozen" mời model cho nền chuyển động / vẽ lại; sống là việc của diễn viên, set đứng yên.
    song_video: (chen) => chen ? 'Only the described detail moves; everything else in frame stays still, with natural subtle life (a breath, a slight shift of light).' : 'Keep the actors alive with natural, motivated movement and readable body language — they never freeze. The set behind them is a fixed physical place: walls, doors, furniture, artwork, signs, logos and reflections keep exactly the same shape, position and content for the whole clip; nothing in the background morphs, slides or is redrawn (only natural light and focus may shift).',
    khong_them: (vao) => `Nothing new appears (no extra people or objects${vao}, no visual effects); things cut off by the frame edge stay cut off.`,
    cam: /\b(miniature|stop-motion|stop motion|tiny characters?|plasticine|claymation|toy-?sized|above the desk|desk top|desk lamp|squash and stretch|cartoon acting|puppet|fur, leaves|simply floats)\b/i,
  },
  hoat_hinh: {
    anh_dich: () => 'a real photograph of the miniature stop-motion set',
    previs: 're-create it as the real photographed miniature',
    flux_dau: (g) => `Macro photograph of a real miniature stop-motion set, ${g === 'thap' ? 'low-angle shot from just above the desk, looking up' : g === 'cao' ? 'high-angle shot looking down onto the desk' : 'eye-level shot at the height of the tiny characters'}.`,
    flux_cuoi: 'Real materials, tactile handmade stop-motion feel. No text, no letters, no numbers, no people, no hands.',
    anh_sang: (den) => den
      ? 'Scene lighting, identical in every shot of this scene: the warm desk lamp is ON (soft golden light from the lamp side) mixed with a faint cool glow from the screens; the room beyond the desk falls off to dark; same exposure and colour grade as the rest of the scene.'
      : 'Scene lighting, identical in every shot of this scene: night, the desk lamp is OFF — only the cool blue glow of the screens lights the desk, with deep soft shadows; the room beyond the desk is dark (no bokeh, no extra lamps); same exposure and colour grade in every shot.',
    dien_video: (r) => r ? 'Performance like a real stop-motion puppet (small, deliberate moves; every body keeps its solid shape — no stretching, melting or bending of limbs)' : 'Cartoon acting (anticipation, action, follow-through, squash and stretch, hold the reaction)',
    giu_video: 'Keep the exact look of the first frame: same materials, textures, lighting, colours and depth of field; it is a real photographed miniature, not a cartoon. Every character keeps exactly the face and eyes it has in the first frame — never draw, add or animate a cartoon face, mouth or expression lines that are not there.',
    song_video: () => 'Keep the whole frame alive: the characters perform the action with clear, readable whole-body movement (not just a small facial change), and secondary motion never stops — fur, leaves, grass, clouds and small background details keep drifting.',
    khong_them: (vao) => `Nothing new appears during the clip: no extra characters, props, cables, hands or objects beyond what is in the first frame${vao}; things cut off by the frame edge stay cut off; no fire, smoke, sparks, exhaust, glow, dust or particle effects of any kind (a character that rises simply floats); only movement, expression and camera motion change.`,
    cam: /\b(live-action film still|real actors|35mm film look)\b/i,
  },
};

/** Chữ theo LOẠI VIDEO (xv_phim.loai): phim truyện thì sản phẩm (nếu lọt vào) chỉ cần giữ y, không phải trọng tâm; quảng cáo thì cử chỉ dồn vào sản phẩm
 *  (#54 shot 9 ông Mike kéo cổ áo trong phim bán QUẦN). Chữ sản phẩm TRUNG TÍNH — trước đây ghi cứng cho quần áo ("cut, color, pockets, fabric",
 *  "never tugging other clothing"), QC điện thoại / mỹ phẩm nhận chữ quần. Thêm loại video: thêm một dòng. */
export type LoaiVideo = 'short' | 'phim' | 'quang_cao' | 'may_dung';
const SP_GIU = 'the product (exactly the same item — shape, colour, material and every detail — never restyled or swapped)';
const SP_TAM = (ten: string) => `The product${ten ? ` (${ten})` : ''} is the focus of the shot: any hand or body gesture is about the product itself (holding, touching, using or showing it off) — never about something else nearby; the product stays fully visible the whole clip and no camera move crops it out of frame.`;
export const LOAI_VIDEO: Record<LoaiVideo, { sp_giu: string; sp_tam: (ten: string) => string; /** câu khung sống (CHAT_LIEU.song_video) — QC dựng theo mẫu thì giữ nhịp mẫu, không thêm */ song: (coMau: boolean) => boolean }> = {
  phim: { sp_giu: SP_GIU, sp_tam: () => '', song: () => true },
  short: { sp_giu: SP_GIU, sp_tam: () => '', song: () => true },
  quang_cao: { sp_giu: SP_GIU, sp_tam: SP_TAM, song: (m) => !m },
  may_dung: { sp_giu: SP_GIU, sp_tam: SP_TAM, song: (m) => !m },
};
/** Mã khối — tên thành phần, dùng chung mọi đường sinh. */
export type MaKhoi = 'anh_dich' | 'anh_so' | 'may' | 'boi_canh' | 'bo_tri' | 'khoanh_khac' | 'nguoi' | 'vat' | 'hau_canh' | 'huong' | 'khung' | 'ngoai_khung'
  | 'trang_thai' | 'ti_le' | 'nhan_dang' | 'so_nguoi' | 'anh_sang' | 'phong_cach' | 'chat_lieu' | 'cong_cu' | 'cam_chu' | 'cam_xuc' | 'bieu_cam' | 'khong_khi' | 'giu' | 'dien' | 'chuyen_dong' | 'thoai' | 'khong_them' | 'anh_set' | 'khac';
export type Khoi = { ma: MaKhoi; chu: string };
export const khoi = (ma: MaKhoi, chu: string | false | 0 | null | undefined): Khoi => ({ ma, chu: (chu || '').trim() });
/** Ghép khối thành prompt (bỏ khối rỗng). */
export const ghep = (ds: Khoi[]) => ds.map((k) => k.chu).filter(Boolean).join(' ');

/** ĐƯỜNG SINH và khối BẮT BUỘC của nó (rỗng = bộ chấm báo thiếu). Khuôn quyết định đường đó phải nói gì; chữ của từng khối do thư viện dựng. */
export type DuongSinh = 'mot_buoc' | 'flux' | 'sua_nhan_dang' | 'video';
// khong_them BẮT BUỘC mọi đường (anh 22/10/2026: "mỗi yêu cầu đến AI cần bảo không được thêm mới đối tượng lạ ngoài quy định"): trước đây chỉ đường một bước,
// bước 2 và video (khi có 3D) nói câu này; bước 1 FLUX, nền / người của lớp ghép, video shot không 3D thì không — bộ chấm giờ báo thiếu khối.
export const KHUON: Record<DuongSinh, { ten: string; bat_buoc: MaKhoi[]; flux?: boolean }> = {
  mot_buoc: { ten: 'một bước', bat_buoc: ['anh_dich', 'phong_cach', 'cam_chu', 'so_nguoi', 'khong_them'] },
  flux: { ten: 'bước 1', bat_buoc: ['anh_dich', 'boi_canh', 'chat_lieu', 'so_nguoi', 'khong_them'], flux: true },
  sua_nhan_dang: { ten: 'bước 2', bat_buoc: ['nguoi', 'giu', 'cam_chu', 'so_nguoi', 'khong_them'] },
  video: { ten: 'video', bat_buoc: ['giu', 'dien', 'cam_chu', 'khong_them'] },
};
/** KHÔNG THÊM VẬT LẠ — ảnh sửa (một bước, bước 2, plate): chỉ vật có trong bố cục 3D + mô tả. */
export const KHONG_THEM_ANH = 'Draw ONLY what Image 1 and this description contain: no extra objects, props, papers, cups, bottles, plants, screens, cables, signs, decorations, animals or people that are not there.';
/** Bản NGẮN cho FLUX (ngân sách ~300 từ, FLUX không có prompt âm): nói theo hướng khẳng định. */
export const KHONG_THEM_FLUX = 'Only the objects shaped by the layout and named here; nothing else added on any surface.';
/** ẢNH CHUẨN BỐI CẢNH (doc-db.ts › anhSet): keyframe đã duyệt của shot khác cùng bộ set — chép BỀ NGOÀI phòng, không chép máy / bố trí. */
export const cauAnhSet = (so: number, nhan: string) => `Image ${so} = an approved frame from another shot (${nhan}) on this SAME set: match the LOOK of the place to it exactly — the desk and furniture (same material, wood tone, colour and finish), what lies on each surface, walls, floor, glass, plants, light and colour grade. Do NOT copy its camera, framing, people, poses or object positions: those come only from Image 1. Do not bring in anything from Image ${so} that Image 1 does not show.`;
/** Khối bắt buộc mà rỗng (có người trong khung mới bắt khối người). */
export const thieuKhoi = (duong: DuongSinh, ds: Khoi[], coNguoi = true): MaKhoi[] =>
  KHUON[duong].bat_buoc.filter((m) => ((m !== 'nguoi' && m !== 'so_nguoi') || coNguoi) && !ds.some((k) => k.ma === m && k.chu));

/** Tên ngôn ngữ ĐƯA CHO MODEL (tiếng Anh) — kieu.ts › tenNgonNgu là tên cho người đọc / prompt Claude tiếng Việt ('tiếng Việt'), lọt vào prompt video thành
 *  "On-camera dialogue (tiếng Việt, …)" (tập 122). */
export const tenNgonNguEn = (ma?: string) => ({ vi: 'Vietnamese', en: 'English', es: 'Spanish', pt: 'Portuguese', de: 'German', fr: 'French', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', th: 'Thai', id: 'Indonesian' } as Record<string, string>)[ma ?? 'vi'] ?? 'Vietnamese';
/** Tên một món ĐƯA CHO MODEL: nhân vật giữ tên riêng; đạo cụ / sản phẩm đổi sang vế đầu mô tả en ("Ly cà phê" → "White porcelain coffee cup") — tên đồ
 *  tiếng Việt lọt vào câu chuyển động video ("Ly cà phê stays in place", tập 122). */
export const goiTenEn = (nv: { ten: string; loai: string; mo_ta: string }[]) => (ten: string) => {
  const a = nv.find((x) => x.ten.trim().toLowerCase() === ten.trim().toLowerCase());
  return a && a.loai !== 'nhan_vat' && a.mo_ta.trim() ? (a.mo_ta.split(/[,.;:—]/)[0] ?? '').trim().replace(/^(a|an)\s+/i, 'the ') : ten;
};
/** TƯ THẾ ở khung mở theo 3D (mã động tác dung-set.py › DONG_TAC) — FLUX đọc độ sâu ma-nơ-canh có khi ra NGỒI khi 3D đứng (tập 122 #4): nói thẳng.
 *  {mon} = món người đó đang cầm (tên en). Không có mã nào → đứng. */
const DANG_EN: Record<string, string> = {
  chong_ban: 'standing, leaning forward with both palms flat on the table', cui_nguoi: 'standing, leaning forward', om_thung: 'standing, hugging {mon} against the stomach',
  cam_truoc: 'standing, holding {mon} in front of the chest', gio_cao: 'standing, raising {mon} high for everyone to see', dua_truoc_mat: 'standing, holding {mon} up right in front of the other person', lac_treo: 'arm raised to the other person\'s face height, hand not open: thumb and index finger pinch the strap of {mon}, which hangs just below her fingers',
  hat: 'standing, flinging {mon} forward', giat: 'standing, reaching out to snatch', khoanh_tay: 'standing with arms crossed', gioi_thieu: 'standing, one open hand extended toward the person beside',
  thuyet_trinh: 'standing, one hand open toward the screen', cam_dien_thoai: 'standing, looking down at {mon} in hand', nghe_dien_thoai: 'standing, holding {mon} to the ear, on a call', quy_mot_goi: 'kneeling on one knee',
  ...MOCAP_EN,   // mã mocap 'mc_*' — sổ mocap-kho.ts
  om_mat_khoc: 'standing, head bowed, both hands covering the face, crying', om_nguc_khoc: 'bent forward, one hand pressed hard against the chest, crying', quy_khoc: 'collapsed on both knees, slumped forward, crying',
  ngua_mat_gao: 'standing, head thrown back, crying out loud, arms hanging limp', chi_tay_gian: 'leaning forward, pointing a finger hard at someone', lui_so: 'stepping back, both hands raised defensively',
  om_nguoi: 'standing, arms wrapped tightly around herself', tay_che_mieng: 'standing, both hands over the mouth', tay_tran_cui: 'bent forward, one hand pressed to the forehead',
};
export function tuTheEn(v: { nam?: boolean; dien?: string[] }, mon = 'the item'): string {
  if (v.nam) return 'lying down';
  const ma = (v.dien ?? []).map(String).filter((d) => !d.includes('@') || Number(d.split('@')[1]!.split('-')[0]) <= 0.01).map((d) => d.split('@')[0]!);
  const t = ma.map((m) => DANG_EN[m]).filter(Boolean)[0];
  return (t ?? 'standing').replaceAll('{mon}', mon);   // mọi chỗ {mon} (câu lắc thẻ có hai — replace chỉ thay chỗ đầu, bộ chấm chặn #13)
}
/** SỐ NGƯỜI TRONG KHUNG theo 3D (nhân vật chính + người phụ của set lọt khung): ô trống trong khung (hành lang, ô cửa, hậu cảnh) thì AI hay thêm người —
 *  #15 mọc thêm một người mặc vest trắng ngoài hành lang. Không có người nào thì nói thẳng "no people". */
export const soNguoiCau = (chinh: string[], phu: number) => {
  const n = chinh.length + phu;
  if (!n) return 'No people anywhere in this frame.';
  return `Exactly ${n} ${n === 1 ? 'person' : 'people'} in this frame${chinh.length ? ` (${chinh.join(', ')}${phu ? ` and ${phu} background ${phu === 1 ? 'extra' : 'extras'} where the layout places them` : ''})` : ''} — no other people anywhere: not in the background, doorways, corridors, windows or reflections.`;
};
/** THẺ LIÊN KẾT ĐỒ VẬT (anh 18/10/2026: "không dùng tên kiểu cố định mà phải là template và link đến đồ đạc đó… đảm bảo không sai sót"). Chữ thẻ shot gọi
 *  vật bằng {Tên} — ĐÚNG tên nhân vật / đạo cụ / đồ set — thay vì chữ tự do ("box", "cup", "the badge"): bộ kiểm đọc thẻ để biết chắc vật nào được nhắc
 *  (không đoán bằng từ điển — "box" ↔ "Thùng đồ cá nhân" từng trượt), prompt thay thẻ bằng mô tả tiếng Anh của chính vật đó (không lọt tên tiếng Việt).
 *  Thẻ sai tên / trỏ vật không có trong 3D → cổng chặn (kiem-ai-3d.ts › theSai); thẻ chưa thay mà lọt vào prompt → bộ chấm chặn. */
export const THE = /\{([^{}\n]+)\}/g;
/** Các tên được thẻ nhắc trong một đoạn chữ. */
export const theTrong = (t: string | undefined | null) => [...(t ?? '').matchAll(THE)].map((m) => m[1]!.trim());
/** Tên ĐƯA CHO MODEL của một vật qua thẻ: nhân vật → tên; đạo cụ / sản phẩm → vế đầu mô tả en; đồ set → vế đầu en. Không có article (chữ thẻ tự viết a / the). */
export function goiThe(nhanVat: { ten: string; loai: string; mo_ta?: string }[], vatSet: { ten: string; en?: string }[]) {
  const thuong = (x: string) => x.replace(/^(a|an|the)\s+/i, '').replace(/^./, (c) => (/[A-Z][a-z]/.test(x.slice(0, 2)) ? c.toLowerCase() : c));
  return (ten: string): string | undefined => {
    const a = nhanVat.find((x) => x.ten.trim().toLowerCase() === ten.trim().toLowerCase());
    if (a) return a.loai === 'nhan_vat' ? a.ten : a.mo_ta?.trim() ? thuong((a.mo_ta.split(/[,.;:—]/)[0] ?? '').trim()) : undefined;
    const v = vatSet.find((x) => x.ten.trim().toLowerCase() === ten.trim().toLowerCase());
    return v?.en ? thuong((v.en.split(/[,;]/)[0] ?? '').trim()) : undefined;
  };
}
/** Thay mọi thẻ {Tên} trong một đoạn chữ bằng tên đưa cho model; thẻ không biết thì GIỮ NGUYÊN (bộ chấm prompt sẽ chặn — không lặng lẽ đoán). */
export const dienThe = (t: string, goi: (ten: string) => string | undefined) => t.replace(THE, (m, ten: string) => goi(ten.trim()) ?? m);

/** Câu đầu của mô tả bối cảnh (trước ':' hoặc '.'): "Boardroom in afternoon light" — đủ nói ĐANG Ở ĐÂU, không liệt kê đồ (mời vẽ thêm). */
export const dauBoiCanh = (moTa: string) => (moTa.split(/[:.]/)[0] ?? '').trim().split(/\s+/).slice(0, 18).join(' ');
/** chữ tả mặt / đầu — trừ 'eye-level' (góc máy) và 'face out of frame' (chính câu dặn không vẽ mặt) */
export const MAT = /\b(jawline|eyes|face(?! out of frame)|faces|hair|makeup|eyebrows?|lips|smile|stare)\b/i;
/** Bỏ các vế tả mặt / tóc khỏi một mô tả — cận chèn chỉ thấy tay. */
export const boMat = (t: string) => t.split(/,\s*/).filter((x) => !MAT.test(x)).join(', ');
/** chữ tả QUẦN ÁO — có bộ đồ sổ trang phục thì bỏ khỏi mô tả gốc (Trần: "navy three-piece suit" gốc + bộ đồ biến thể = hai bộ đồ). */
const DO = /\b(suit|suits|shirt|blouse|dress|jacket|blazer|tie|trousers|pants|skirt|coat|vest|uniform|sweater|hoodie|jeans|outfit)\b/i;
export const boDo = (t: string) => t.split(/,\s*/).filter((x) => !DO.test(x)).join(', ');
/** Bỏ vế đã có trong đoạn khác (nhân dạng "gold-rimmed glasses" + bộ đồ "…, gold-rimmed glasses" — #15 nói hai lần). */
export const boTrung = (t: string, khac: string) => { const k = khac.toLowerCase(); return t.split(/,\s*/).filter((x) => x.trim().split(/\s+/).length < 2 || !k.includes(x.trim().toLowerCase())).join(', '); };   // vế ≥ 2 từ — 'slim' (dáng) không phải 'slim slacks'

/** KHỐI NGƯỜI: nhân dạng (bỏ quần áo khi có bộ đồ sổ) + bộ đồ (mô tả MỌI biến thể sổ người đang trỏ) + đồ đeo (không trùng bộ đồ). Cận chèn: chỉ tay.
 *  gon = bản ngắn cho bước sửa nhân dạng (ảnh mẫu đã mang mặt). MỘT hàm cho mọi đường. */
/** chữ dáng người đã có trong mô tả gốc → không chèn THAN_EN (khỏi "slim … heavyset" tự mâu thuẫn). */
const CO_DANG = /\b(slim|slender|petite|lean|fit|thin|skinny|gaunt|heavyset|overweight|chubby|plump|stocky|muscular|athletic|broad-shouldered|curvy|build)\b/i;
export function chuNguoi(a: { ten: string; mo_ta: string; loai: string; khoi_3d?: Pick<KhoiSet, 'hinh' | 'than' | 'gioi' | 'tuoi'> | null }, o: { ao: string[]; deo?: string; them?: string[]; tu_the?: string; chen: boolean; gon?: boolean; moTa: (t: string) => string }): string {
  const ao = o.ao.map((x) => (o.chen ? boMat(x) : x)).filter(Boolean).join('; ');
  const deo = o.deo && !ao.toLowerCase().includes(o.deo.toLowerCase().replace(/^(a|an|the)\s+/, '')) ? o.deo : '';
  // tóc / trang điểm của sổ người (khác ngày, khác cảnh) — cận chèn không tả
  const them = o.chen ? '' : (o.them ?? []).filter(Boolean).join(', ');
  const nguoi = a.loai === 'nhan_vat';
  const goc = nguoi && o.chen ? (o.gon ? 'skin tone and sleeve only, face out of frame' : `${a.ten.split(' ').pop()}'s hand and forearm only (face out of frame)`)
    : ao ? boTrung(boDo(o.moTa(a.mo_ta)), ao) : o.moTa(a.mo_ta);
  // DÁNG NGƯỜI (THAN_EN): cùng ô với hình khối 3D — người béo / gầy trong 3D thì chữ cũng nói thế, AI không phải đoán từ bóng người.
  const k3 = a.khoi_3d; const dang = nguoi && !o.chen && k3?.hinh === 'nguoi' && !CO_DANG.test(a.mo_ta) ? THAN_EN[k3.than ?? thanMacDinh(k3.gioi, k3.tuoi)] : '';
  const n = o.gon ? '; ' : ', ';
  return `${goc}${dang ? `${n}${dang}` : ''}${o.tu_the && !o.chen ? `${n}${o.tu_the}` : ''}${ao ? `${n}wearing ${ao}` : ''}${deo ? `${n}${deo}` : ''}${them ? `${n}${them}` : ''}`;
}
