// POSTER PHIM (13/10/2026 — "mỗi phim hay có poster"). Một ảnh dọc 2:3 kiểu key art: nhân vật chính (ảnh mẫu anchor làm tham chiếu để giữ
// đúng mặt), đúng phong cách của phim, tên phim là chữ DUY NHẤT trên ảnh. Khác keyframe: keyframe cấm chữ (chữ màn vẽ lúc xuất), poster
// thì tên phim là một phần của hình. Mỗi lượt sinh nối vào xv_phim.poster_uv, bản đang dùng ở poster_url (hoan-tat.ts › hoanTatAnh).
// Thuần — tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/poster.test.mts
import { docKinhThanh, phongCachHinh, type KinhThanh, type NhanVat, type Phim } from './kieu';

/** Model poster: chữ tên phim phải đúng chính tả → model vẽ chữ tốt nhất (đắt hơn model keyframe mặc định). */
export const MO_HINH_POSTER = 'gemini-3-pro-image';
export const TI_LE_POSTER = '2:3' as const;

/** Tên in trên poster: tên series nếu có (các bản thử cùng một series), bỏ phần ghi chú trong ngoặc ở cuối ("Fox Tales (sáp màu, thử)"). */
export function tenPoster(p: Pick<Phim, 'ten'> & { kinh_thanh?: KinhThanh | null }): string {
  const ten = (p.kinh_thanh?.series?.ten?.trim() || p.ten).trim();
  return ten.replace(/\s*[([][^()[\]]*[)\]]\s*$/u, '').trim() || ten;
}

/** Anchor đưa vào poster: người có ảnh mẫu (tối đa 4, theo thứ tự khai) → sản phẩm có ảnh (phim QC) → một bối cảnh. */
export function anchorPoster(nv: NhanVat[]): NhanVat[] {
  const coAnh = nv.filter((v) => v.anh_ref.length);
  return [
    ...coAnh.filter((v) => v.loai === 'nhan_vat').slice(0, 4),
    ...coAnh.filter((v) => v.loai === 'san_pham').slice(0, 2),
    ...coAnh.filter((v) => v.loai === 'boi_canh').slice(0, 1),
  ];
}

export function promptPoster(p: Pick<Phim, 'ten' | 'mo_ta' | 'loai'> & { kinh_thanh?: KinhThanh | null }, nv: NhanVat[], yTuong = ''): { prompt: string; thamChieuUrl: string[] } {
  const kt = docKinhThanh(p.kinh_thanh ?? {});
  const ten = tenPoster(p);
  const ds = anchorPoster(nv);
  const thamChieuUrl: string[] = []; const banDo: string[] = [];
  for (const v of ds) {
    const anh = v.anh_ref.slice(0, v.loai === 'nhan_vat' ? 2 : 1);
    const tu = thamChieuUrl.length + 1; thamChieuUrl.push(...anh); const den = thamChieuUrl.length;
    banDo.push(`${tu === den ? `image ${tu}` : `images ${tu}–${den}`} = ${v.loai === 'nhan_vat' ? `the character ${v.ten} (same face, design, colors)` : v.loai === 'san_pham' ? `the product ${v.ten} (copy it exactly)` : `the setting ${v.ten}`}`);
  }
  const tienDe = (kt.series?.dong_co || kt.logline || p.mo_ta || '').trim();
  const nguoi = ds.filter((v) => v.loai === 'nhan_vat');
  const dong = [
    `A ${p.loai === 'quang_cao' ? 'key visual poster for an advertising film' : kt.series?.dong_co ? 'key art poster for an animated series' : 'theatrical movie poster'}, vertical 2:3.`,
    phongCachHinh(kt.phong_cach) ? `Visual style (must match the film exactly): ${phongCachHinh(kt.phong_cach)}.` : '',
    tienDe ? `What the film is about: ${tienDe}` : '',
    nguoi.length ? `Feature ${nguoi.length > 1 ? 'these characters together, the first one as the hero' : 'this character as the hero'}: ${nguoi.map((v) => `${v.ten} — ${v.mo_ta}`).join(' | ')}. Keep them EXACTLY as in the reference images — do not redesign them.` : '',
    yTuong.trim() ? `Poster idea from the director: ${yTuong.trim()}` : 'Strong, simple composition with one clear focal point and a mood that sells the premise; leave clean space for the title.',
    banDo.length ? `Reference images: ${banDo.join('; ')}.` : '',
    `TITLE: render the title "${ten}" as bold, beautifully designed poster typography that fits the style, spelled EXACTLY "${ten}" (every letter and accent).`,
    'The title is the ONLY text in the image: no tagline, no credits block, no names, no dates, no logos, no watermark.',
  ];
  return { prompt: dong.filter(Boolean).join(' '), thamChieuUrl: thamChieuUrl.slice(0, 10) };
}
