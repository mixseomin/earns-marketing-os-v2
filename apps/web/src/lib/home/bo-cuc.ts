// ĐỌC BỐ CỤC một màn của /home cho một người: bản riêng → bản team (user_id 0) → bố cục dựng sẵn trong sổ (lib/home/so.ts).
// Bố cục cũ không còn hợp lệ (sổ bỏ một widget, dữ liệu hỏng) thì coi như chưa có, rơi xuống tầng dưới — không bao giờ vẽ ô lạ.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { hopLe, type O } from './luoi';
import { boCuaMan, coWidgetBo } from '@/lib/luoi-trang/bo-so';

/** Widget mới vào sổ (có `moi` muộn hơn lúc lưu bố cục) mà bản lưu chưa có → chèn làm tab ĐẦU của ô đang chứa widget cùng ô với nó ở bố cục dựng sẵn.
 *  Chỉ chèn lúc đọc, không ghi lại DB; bản lưu SAU mốc `moi` (người đã thấy widget rồi tự gỡ) thì để nguyên. */
export function chenWidgetMoi(o: O[], capNhat: string, san: O[], widget: Record<string, { moi?: string }>): O[] {
  const luc = Date.parse(capNhat); if (!Number.isFinite(luc)) return o;
  const co = new Set(o.flatMap((x) => x.tabs ?? [x.ma]));
  let ra = o;
  for (const s of san) {
    const ts = s.tabs ?? [s.ma];
    for (const ma of ts) {
      const moi = widget[ma]?.moi;
      if (!moi || co.has(ma) || !(Date.parse(moi) > luc)) continue;
      const ban = ts.find((t) => t !== ma && co.has(t)); if (!ban) continue;
      ra = ra.map((x) => { const xs = x.tabs ?? [x.ma]; return xs.includes(ban) && xs.length < 12 ? { ...x, ma, tabs: [ma, ...xs] } : x; });
      co.add(ma);
    }
  }
  return ra;
}

export type NguonBoCuc = 'rieng' | 'team' | 'san';
/** `man` là mã màn của BẤT KỲ bộ sổ nào (lib/luoi-trang/bo-so.ts: /home, /outreach) — bộ sổ tự tìm theo mã màn; mã lạ → bố cục rỗng. */
export async function docBoCucHome(userId: number, man: string): Promise<{ o: O[]; nguon: NguonBoCuc }> {
  const bo = boCuaMan(man);
  if (!bo) return { o: [], nguon: 'san' };
  const coWidget = coWidgetBo(bo);
  const san = { o: bo.man.find((m) => m.id === man)!.o, nguon: 'san' as const };
  const db = getDb(); if (!db) return san;
  try {
    const rs = (await db.execute(sql`select user_id::int u, o, cap_nhat::text cap from home_bo_cuc where man = ${man} and user_id in (${userId}, 0)`)) as unknown as { u: number; o: unknown; cap: string }[];
    const doc = (u: number) => { const r = rs.find((x) => x.u === u); const o = hopLe(r?.o, coWidget); return o && r ? chenWidgetMoi(o, r.cap, san.o, bo.widget) : null; };
    const rieng = doc(userId), team = doc(0);
    if (rieng?.length) return { o: rieng, nguon: 'rieng' };
    if (team?.length) return { o: team, nguon: 'team' };
  } catch { /* bảng chưa có (máy chưa chạy migration 0449) → bố cục dựng sẵn */ }
  return san;
}
