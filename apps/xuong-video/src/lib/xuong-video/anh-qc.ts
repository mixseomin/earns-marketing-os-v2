// ẢNH QC (15/10/2026 — "studio mở rộng làm cả ảnh creative"). Một ảnh tĩnh cho feed Meta: CHÉP bố cục một ảnh QC đang thắng (ảnh mẫu =
// tham chiếu số 1), thay sản phẩm bằng ảnh thật của anchor sản phẩm, in đúng các dòng chữ khai ở `chu` (trống = giữ nguyên văn chữ của mẫu).
// Khác poster: poster cấm mọi chữ trừ tên phim; ảnh QC sống bằng chữ (tiêu đề · lợi ích · huy hiệu giảm giá · nút) nên dùng model vẽ chữ tốt.
// Bảng xv_anh_qc (migration 0258), sinh ở sinh-anh.ts › sinhAnhQcDb, ghi kết quả ở hoan-tat.ts (dich 'anh_qc').
// Thuần — tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/anh-qc.test.mts
import type { NhanVat, TiLeAnh } from './kieu';

export type AnhQc = {
  id: number; phim_id: number; khuon: string; ten: string; mau_url: string; chu: string; y_tuong: string;
  ti_le: TiLeAnh; mo_hinh: string; url: string | null; uv: string[]; an: boolean;
};

/** Model mặc định: chữ phải đúng chính tả từng chữ → Gemini 3 Pro Image ($0,13). Nano Banana 2.1 rẻ hơn 4 lần, chữ kém hơn. */
export const MO_HINH_ANH_QC = 'gemini-3-pro-image';
export const TI_LE_ANH_QC: { value: TiLeAnh; label: string; title: string }[] = [
  { value: '4:5', label: '4:5', title: 'feed Meta/Instagram — khổ mặc định của ảnh QC' },
  { value: '1:1', label: '1:1', title: 'vuông — feed, cột phải' },
  { value: '9:16', label: '9:16', title: 'story / reels' },
];

/** KHUÔN ẢNH QC: ảnh QC đang thắng làm mẫu bố cục. `mau_url` = ảnh gốc trên R2 (khuon-anh-qc/), `chu` = chữ của mẫu (đã sửa chỗ sai với
 *  shop mình, vd màu), `mo` = vì sao / khi nào dùng. Thêm khuôn = một dòng ở đây (ảnh tải lên R2 bằng scripts/tai-len.mts … khuon-anh-qc).
 *  Nguồn: Jett Jeans 15/10/2026 — Contour là ảnh mình chạy (14 đơn, CPA $26, tốt nhất dự án bra); 4 khuôn còn lại JettJeans đang đẩy
 *  (130 ảnh đang chạy, 50 ảnh mới riêng ngày 14/10). */
export const KHUON_ANH_QC = [
  {
    key: 'qua_tang', nhan: '🎁 Quà cho anh ấy', ten: 'Contour · quà tặng',
    mo: 'THẮNG ở shop mình (14 đơn, CPA $26). Nói với người VỢ mua hộ: thiệp "Still Looking Great Dad", hộp quà, "A FIT HE\'LL LOVE", góc "Perfect gift for him"; cận mông có mũi tên = chống chảy đít.',
    mau_url: 'https://img.on.tc/xuong-video/khuon-anh-qc/e77ca175-bf94-439a-a6a0-99aa51d883c9.jpg',
    chu: ['CONTOUR JEANS', 'FOR SENIOR MEN', 'A better fit. A more confident you.', 'NO SAG — LOOK SHARP', 'STRETCH — ALL-DAY COMFORT', 'DEEP POCKETS — FOR DAILY NEEDS',
      'Still Looking Great Dad (handwritten card)', "A FIT HE'LL LOVE", 'AVAILABLE IN 6 CLASSIC COLORS', 'LIGHT BLUE · MEDIUM BLUE · DARK BLUE · GRAY · BROWN · BLACK',
      'THE PERFECT GIFT FOR HIM', 'HUSBAND. DAD. GRANDFATHER. ANY MAN OVER 50.'],
  },
  {
    key: 'chong_chay', nhan: '👖 Anti-Sag 50+', ten: 'Anti-Sag · nửa người + 6 màu',
    mo: 'Khuôn JettJeans chạy nhiều nhất (đầu bảng 14/10). Nửa người mặc quần bên trái, tiêu đề lợi ích + "Made for Men 50+", chồng 6 màu, 3 icon, bảo hành 45 ngày.',
    mau_url: 'https://img.on.tc/xuong-video/khuon-anh-qc/1e063726-9b38-438d-9257-03cb88e1f656.png',
    chu: ['ANTI-SAG JEANS', 'Made for Men 50+', '65% OFF', 'Light Blue · Classic Blue · Dark Blue · Black · Gray · Brown', 'Stretch Comfort · Straight Fit · Deep Pockets', '45-Day Guarantee', 'SHOP NOW'],
  },
  {
    key: 'gia_tri', nhan: '🍂 3 đôi 1 giá', ten: 'Best Value · 3 pairs 1 price',
    mo: 'Ưu đãi nhiều đôi (giống hook "Pay 1 get 3" của video thắng). Flat lay 3–4 chiếc quần trên bàn gỗ, đạo cụ mùa thu, huy hiệu lá phong 70% OFF.',
    mau_url: 'https://img.on.tc/xuong-video/khuon-anh-qc/16806737-fbe1-482b-8ce2-24d6792de686.png',
    chu: ['BEST VALUE', '3 PAIRS, 1 PRICE', 'Straight Fit • Stretch Comfort', '70% OFF', 'Stretch Denim · Straight Fit · Deep Pockets', 'SHOP NOW ›'],
  },
  {
    key: 'giu_cap', nhan: '☀️ Stay up & feel good', ten: 'Stay Up · người mẫu ngoài trời',
    mo: 'Lời hứa "không tụt" (mong muốn D2: giữ được mà không phải thắt chặt). Người đàn ông ~60 cười, đứng ngoài trời nắng, quạt 6 màu, 70% OFF.',
    mau_url: 'https://img.on.tc/xuong-video/khuon-anh-qc/81099ecb-b238-4533-a026-33ba74c4656f.png',
    chu: ['THE JEANS THAT', 'STAY UP & FEEL GOOD', 'Straight Cut · Stretch Comfort · All-Day Ease', '70% OFF', 'Light Blue · Medium Blue · Dark Blue · Black · Gray · Brown',
      'Breathable · Deep Pockets · 45-Day Guarantee', 'SHOP NOW'],
  },
  {
    key: 'bang_mau', nhan: '🎨 6 màu', ten: '6 Colors · lưới màu',
    mo: 'Ảnh sản phẩm thuần (không người): một chiếc trải thẳng + lưới 6 màu gấp. Hợp nhóm đã biết sản phẩm, nhắc nhiều màu để mua thêm.',
    mau_url: 'https://img.on.tc/xuong-video/khuon-anh-qc/9619e13e-c21f-4424-8e14-1e6a76577c00.png',
    chu: ['6 COLORS.', 'ONE EASY FAVORITE.', 'MODERN COMFORT', 'STRAIGHT FIT', '70% OFF', 'SHOP NOW', 'Everyday Comfort · Stretch Denim · Back Button Pockets',
      'LIGHT BLUE · DARK BLUE · MEDIUM BLUE · BLACK · GRAY · BROWN'],
  },
] as const;
export type KhuonAnhQc = (typeof KHUON_ANH_QC)[number]['key'];
export const khuonAnhQc = (k: string) => KHUON_ANH_QC.find((x) => x.key === k);

/** Anchor sản phẩm có ảnh (tối đa 2 sản phẩm, mỗi cái ≤ 4 ảnh) — thứ duy nhất model phải chép y nguyên. */
export function sanPhamAnhQc(nv: NhanVat[]): { v: NhanVat; anh: string[] }[] {
  return nv.filter((v) => v.loai === 'san_pham' && v.anh_ref.length).slice(0, 2).map((v) => ({ v, anh: v.anh_ref.slice(0, 4) }));
}

/** Prompt + ảnh tham chiếu theo thứ tự: [ảnh mẫu, logo?, ảnh sản phẩm…]. Model đọc số thứ tự ảnh nên bản đồ ảnh phải khớp đúng mảng trả về. */
export function promptAnhQc(a: Pick<AnhQc, 'mau_url' | 'chu' | 'y_tuong' | 'ti_le'>, o: { tenSp: string; logoUrl?: string; nv: NhanVat[] }): { prompt: string; thamChieuUrl: string[] } {
  const ref: string[] = []; const banDo: string[] = [];
  const them = (urls: string[], ta: string) => { if (!urls.length) return; const tu = ref.length + 1; ref.push(...urls); const den = ref.length; banDo.push(`${tu === den ? `image ${tu}` : `images ${tu}–${den}`} = ${ta}`); };
  if (a.mau_url) them([a.mau_url], 'the WINNING REFERENCE AD to recreate');
  if (o.logoUrl) them([o.logoUrl], 'the brand logo');
  const sp = sanPhamAnhQc(o.nv);
  for (const { v, anh } of sp) them(anh, `the REAL product "${v.ten}" — ${v.mo_ta}`);
  const dong = a.chu.split('\n').map((x) => x.trim()).filter(Boolean);
  const cau = [
    `A static social-media advertisement image, aspect ratio ${a.ti_le}, selling ${o.tenSp || 'the product'}.`,
    a.mau_url ? 'Recreate image 1 as closely as possible: the same layout and composition, the same zones (headline block, benefit icons, badges, color swatches, call-to-action button), the same typography style, weight and hierarchy, the same color palette, lighting and background mood, the same kind of model, pose and camera framing. It must look like the same designer made it.' : 'Clean, high-converting e-commerce ad layout: one bold headline, three benefit icons, a discount badge and a call-to-action button.',
    sp.length ? 'Every product shown in the ad must be the REAL product from its reference photos — copy fabric color, cut, pockets, stitching and buttons exactly; where the reference ad shows its own product, swap in ours.' : '',
    o.logoUrl ? 'Place the brand logo where the reference ad has its logo, same size.' : '',
    dong.length
      ? `TEXT on the image — render EXACTLY these lines (spelled exactly, in the matching text zones of the reference, in this order), and no other text: ${dong.map((x) => `"${x}"`).join(' | ')}. Text in parentheses is a direction, not text to print.`
      : 'TEXT: keep every piece of text from the reference ad word for word, spelled exactly; add no other text.',
    a.y_tuong.trim() ? `Extra direction: ${a.y_tuong.trim()}` : '',
    banDo.length ? `Reference images: ${banDo.join('; ')}.` : '',
    'Sharp, photorealistic, professional ad finish. No watermark, no fake UI, no extra logos.',
  ];
  return { prompt: cau.filter(Boolean).join(' '), thamChieuUrl: ref.slice(0, 10) };
}
