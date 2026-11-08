// SỔ DẠNG CREATIVE cho web — đọc lib/etp-dang.json (một nơi duy nhất; máy Python đọc cùng tệp qua apps/etp/so_dang.py). Không khai lại bảng dạng ở chỗ khác:
// apps/etp/kiem-so-dang.mjs báo đỏ (dong-bo.py chạy mỗi lượt → cảnh báo Telegram). Dùng được cả ở server (route, server action) lẫn client.
import SO_DANG from '@/lib/etp-dang.json';
export type MucDang = { dang: string; ma: string; mau: string; khong_dau: string; dong: string | null; tinh?: boolean; kieu?: string };
export const DS_DANG: MucDang[] = SO_DANG.dang as MucDang[];
export const MAU_DANG: Record<string, string> = Object.fromEntries(DS_DANG.map((x) => [x.dang, x.mau]));
export const MA_DANG: Record<string, string> = Object.fromEntries(DS_DANG.map((x) => [x.dang, x.ma]));
/** mã loại dòng phim (dong_phim.py: CC / KT / LT / AT / ATT / PO / CTS) → dạng creative */
export const DANG_DONG: Record<string, string> = Object.fromEntries(DS_DANG.filter((x) => x.dong).map((x) => [x.dong!, x.dang]));
/** dạng đọc từ tên camp / creative (nhãn dài khớp trước — "anh tinh tom tat" trước "anh tinh"); không khớp → null */
const THEO_DAI = DS_DANG.flatMap((x) => [[x.khong_dau, x.dang], [x.dang, x.dang]] as [string, string][]).sort((a, b) => b[0].length - a[0].length);
export const dangTheoTen = (ten: string | null | undefined): string | null => { const t = (ten ?? '').toLowerCase(); return THEO_DAI.find(([k]) => t.includes(k))?.[1] ?? null; };
