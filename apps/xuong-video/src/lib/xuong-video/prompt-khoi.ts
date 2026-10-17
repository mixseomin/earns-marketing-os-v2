// THƯ VIỆN KHỐI PROMPT (anh 17/10/2026: "prompt có làm chuẩn hoá để có các thành phần dùng lại tổng quát, áp dụng cho các film khác, thể loại khác
// được chứ?"). Trước đây prompt ghép tay bằng nối chuỗi ở 5 chỗ (một bước, sửa từ 3D, FLUX bước 1, bước 2, video), mỗi chỗ tả lại nhân vật / bộ đồ /
// bối cảnh một kiểu và chữ theo CHẤT LIỆU PHIM ghi cứng ("miniature stop-motion set", "desk lamp OFF", "cartoon acting… squash and stretch") — phim
// người thật tập 122 nhận chữ hoạt hình, bộ chấm prompt cho 0/22 shot sạch. Ở đây:
//   · CHAT_LIEU — mọi chữ phụ thuộc chất liệu phim, MỘT bảng. Phim / thể loại mới = thêm một dòng, không sửa chỗ dựng prompt.
//   · Khoi — một thành phần có mã (máy, bối cảnh, người, đồ vật…); prompt = ghep(khối theo KHUON của đường sinh).
//   · KHUON — mỗi đường sinh khai khối nào BẮT BUỘC: bộ chấm (kiem-prompt.ts) báo thiếu khối, không chỉ soi chữ.
// Thuần (client lẫn server import được). Tự kiểm: prompt-khoi.test.mts
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
    giu_video: 'Keep the exact look of the first frame: same people, faces, wardrobe, set, lighting and colours; real live-action footage.',
    song_video: (chen) => chen ? 'Only the described detail moves; everything else in frame stays still, with natural subtle life (a breath, a slight shift of light).' : 'Keep the frame alive with natural, motivated movement: the actors perform the action with readable body language, and the background stays naturally alive (people breathing, slight shifts, light on surfaces) — never frozen.',
    khong_them: (vao) => `Nothing new appears during the clip: no extra people, props or objects beyond what is in the first frame${vao}; things cut off by the frame edge stay cut off; no visual effects, particles or glows.`,
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
  | 'trang_thai' | 'ti_le' | 'nhan_dang' | 'anh_sang' | 'phong_cach' | 'chat_lieu' | 'cong_cu' | 'cam_chu' | 'cam_xuc' | 'bieu_cam' | 'giu' | 'dien' | 'chuyen_dong' | 'thoai' | 'khac';
export type Khoi = { ma: MaKhoi; chu: string };
export const khoi = (ma: MaKhoi, chu: string | false | 0 | null | undefined): Khoi => ({ ma, chu: (chu || '').trim() });
/** Ghép khối thành prompt (bỏ khối rỗng). */
export const ghep = (ds: Khoi[]) => ds.map((k) => k.chu).filter(Boolean).join(' ');

/** ĐƯỜNG SINH và khối BẮT BUỘC của nó (rỗng = bộ chấm báo thiếu). Khuôn quyết định đường đó phải nói gì; chữ của từng khối do thư viện dựng. */
export type DuongSinh = 'mot_buoc' | 'flux' | 'sua_nhan_dang' | 'video';
export const KHUON: Record<DuongSinh, { ten: string; bat_buoc: MaKhoi[]; flux?: boolean }> = {
  mot_buoc: { ten: 'một bước', bat_buoc: ['anh_dich', 'phong_cach', 'cam_chu'] },
  flux: { ten: 'bước 1', bat_buoc: ['anh_dich', 'boi_canh', 'chat_lieu'], flux: true },
  sua_nhan_dang: { ten: 'bước 2', bat_buoc: ['nguoi', 'giu', 'cam_chu'] },
  video: { ten: 'video', bat_buoc: ['giu', 'dien', 'cam_chu'] },
};
/** Khối bắt buộc mà rỗng (có người trong khung mới bắt khối người). */
export const thieuKhoi = (duong: DuongSinh, ds: Khoi[], coNguoi = true): MaKhoi[] =>
  KHUON[duong].bat_buoc.filter((m) => (m !== 'nguoi' || coNguoi) && !ds.some((k) => k.ma === m && k.chu));

/** Tên ngôn ngữ ĐƯA CHO MODEL (tiếng Anh) — kieu.ts › tenNgonNgu là tên cho người đọc / prompt Claude tiếng Việt ('tiếng Việt'), lọt vào prompt video thành
 *  "On-camera dialogue (tiếng Việt, …)" (tập 122). */
export const tenNgonNguEn = (ma?: string) => ({ vi: 'Vietnamese', en: 'English', es: 'Spanish', pt: 'Portuguese', de: 'German', fr: 'French', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', th: 'Thai', id: 'Indonesian' } as Record<string, string>)[ma ?? 'vi'] ?? 'Vietnamese';
/** Tên một món ĐƯA CHO MODEL: nhân vật giữ tên riêng; đạo cụ / sản phẩm đổi sang vế đầu mô tả en ("Ly cà phê" → "White porcelain coffee cup") — tên đồ
 *  tiếng Việt lọt vào câu chuyển động video ("Ly cà phê stays in place", tập 122). */
export const goiTenEn = (nv: { ten: string; loai: string; mo_ta: string }[]) => (ten: string) => {
  const a = nv.find((x) => x.ten.trim().toLowerCase() === ten.trim().toLowerCase());
  return a && a.loai !== 'nhan_vat' && a.mo_ta.trim() ? (a.mo_ta.split(/[,.;:—]/)[0] ?? '').trim().replace(/^(a|an)\s+/i, 'the ') : ten;
};
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
export const boTrung = (t: string, khac: string) => { const k = khac.toLowerCase(); return t.split(/,\s*/).filter((x) => !x.trim() || !k.includes(x.trim().toLowerCase())).join(', '); };

/** KHỐI NGƯỜI: nhân dạng (bỏ quần áo khi có bộ đồ sổ) + bộ đồ (mô tả MỌI biến thể sổ người đang trỏ) + đồ đeo (không trùng bộ đồ). Cận chèn: chỉ tay.
 *  gon = bản ngắn cho bước sửa nhân dạng (ảnh mẫu đã mang mặt). MỘT hàm cho mọi đường. */
export function chuNguoi(a: { ten: string; mo_ta: string; loai: string }, o: { ao: string[]; deo?: string; chen: boolean; gon?: boolean; moTa: (t: string) => string }): string {
  const ao = o.ao.map((x) => (o.chen ? boMat(x) : x)).filter(Boolean).join('; ');
  const deo = o.deo && !ao.toLowerCase().includes(o.deo.toLowerCase().replace(/^(a|an|the)\s+/, '')) ? o.deo : '';
  const nguoi = a.loai === 'nhan_vat';
  const goc = nguoi && o.chen ? (o.gon ? 'skin tone and sleeve only, face out of frame' : `${a.ten.split(' ').pop()}'s hand and forearm only (face out of frame)`)
    : ao ? boTrung(boDo(o.moTa(a.mo_ta)), ao) : o.moTa(a.mo_ta);
  const n = o.gon ? '; ' : ', ';
  return `${goc}${ao ? `${n}wearing ${ao}` : ''}${deo ? `${n}${deo}` : ''}`;
}
