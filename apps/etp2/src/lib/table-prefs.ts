import { cookies } from 'next/headers';
import type { TablePref } from '@/components/ui/table-prefs';

// Đọc trạng thái bảng từ cookie `tbl.*` (xem components/ui/table-prefs.tsx). Gọi MỘT lần ở
// app/layout → mọi bảng trong app sơn đúng ngay lần đầu, không trang nào phải tự nối dây.
export async function readTablePrefs(): Promise<Record<string, TablePref>> {
  const out: Record<string, TablePref> = {};
  for (const c of (await cookies()).getAll()) {
    if (!c.name.startsWith('tbl.')) continue;
    try {
      const v = JSON.parse(decodeURIComponent(c.value));
      if (v && typeof v === 'object') out[c.name.slice(4)] = v as TablePref;
    } catch { /* cookie hỏng → bỏ qua, bảng về mặc định */ }
  }
  return out;
}
