// Avatar = ĐÚNG nhân vật của người đó trên văn phòng pixel (scripts/nhan-vat.mjs, cùng quy tắc với seed-van-phong) — nhìn avatar là nhận
// ra người trên văn phòng. Ảnh cắt sẵn ở public/nhan-vat/<sprite>.png. Mã không phải nhân sự (giám đốc, hệ thống…) → ô pixel sinh từ tên.
import { dsNhanSu } from '@/lib/cong-ty';
import { spriteTheoNguoi } from '../../scripts/nhan-vat.mjs';
export function anhNhanSu(id: string, hue = 0): string {
  const ds = dsNhanSu(); const sp = (spriteTheoNguoi(ds.map((d) => ({ id: d.id, gioi_tinh: d.fm.gioi_tinh, thu_tu: d.fm.thu_tu }))) as Record<string, number>)[id];
  return sp == null ? avatarDataUri(id, hue) : `/nhan-vat/${sp}.png`;
}
export function avatarDataUri(seed: string, hue: number): string {
  let h = 2166136261; for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const cells: string[] = [];
  for (let y = 0; y < 7; y++) for (let x = 0; x < 4; x++) {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    if ((h >>> 16) % 3 !== 0) { cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`); if (x < 3) cells.push(`<rect x="${6 - x}" y="${y}" width="1" height="1"/>`); }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.5 -0.5 8 8" shape-rendering="crispEdges"><rect x="-0.5" y="-0.5" width="8" height="8" rx="1" fill="hsl(${hue} 40% 92%)"/><g fill="hsl(${hue} 55% 42%)">${cells.join('')}</g></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
export function Avatar({ seed, hue, size = 44 }: { seed: string; hue: number; size?: number }) {
  return <img src={anhNhanSu(seed, hue)} width={size} height={size} alt="" className="cty-av" />;
}
// Màu theo phòng: băm id phòng → hue (0–359). Không giữ bảng màu riêng để thêm phòng không phải sửa hai nơi.
export function hueOf(phong: string): number { let h = 5381; for (const ch of phong) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0; return h % 360; }
