'use server';
// LƯU BỐ CỤC /home (bảng home_bo_cuc, migration 0449): tự lưu mỗi lần kéo thả · về bố cục mặc định · đặt bản mặc định cho team.
// Mọi bố cục qua hopLe (lib/home/luoi.ts + sổ widget) trước khi ghi — trình duyệt gửi ô lạ / lặp / vượt màn thì từ chối, không ghi.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { hopLe, type O } from '@/lib/home/luoi';
import { boCuaMan, choLapBo, coWidgetBo } from '@/lib/luoi-trang/bo-so';
import { docBoCucHome, type NguonBoCuc } from '@/lib/home/bo-cuc';

type Loi = { loi: string };
async function ai() { const me = await getCurrentUser(); return me && me.role === 'admin' ? me : null; }
// mã màn thuộc bộ sổ nào (/home, /outreach) thì bố cục được kiểm theo sổ widget của bộ đó
const manHopLe = (man: string) => !!boCuaMan(man);
const coWidgetCua = (man: string) => coWidgetBo(boCuaMan(man)!), choLapCua = (man: string) => choLapBo(boCuaMan(man)!);

export async function luuBoCucHome(man: string, o: unknown): Promise<{ ok: true } | Loi> {
  const a = await ai(); if (!a) return { loi: 'Chỉ quản trị mới lưu được bố cục.' };
  if (!manHopLe(man)) return { loi: 'Màn không có trong sổ.' };
  const v = hopLe(o, coWidgetCua(man), choLapCua(man)); if (!v) return { loi: 'Bố cục không hợp lệ (widget lạ, lặp hoặc vượt màn) nên chưa lưu.' };
  const db = getDb(); if (!db) return { loi: 'Chưa nối được cơ sở dữ liệu nên chưa lưu.' };
  await db.execute(sql`insert into home_bo_cuc (user_id, man, o) values (${a.id}, ${man}, ${JSON.stringify(v)}::jsonb)
    on conflict (user_id, man) do update set o = excluded.o, cap_nhat = now()`);
  return { ok: true };
}

/** bỏ bản riêng của màn này → trả bố cục đang áp sau đó (bản team nếu có, không thì bản dựng sẵn) */
export async function veMacDinhHome(man: string): Promise<{ o: O[]; nguon: NguonBoCuc } | Loi> {
  const a = await ai(); if (!a) return { loi: 'Chỉ quản trị mới đổi được bố cục.' };
  if (!manHopLe(man)) return { loi: 'Màn không có trong sổ.' };
  const db = getDb(); if (!db) return { loi: 'Chưa nối được cơ sở dữ liệu.' };
  await db.execute(sql`delete from home_bo_cuc where user_id = ${a.id} and man = ${man}`);
  return docBoCucHome(a.id, man);
}

/** bố cục đang xem thành bản mặc định của cả team cho màn này */
export async function datTeamHome(man: string, o: unknown): Promise<{ ok: true } | Loi> {
  const a = await ai(); if (!a) return { loi: 'Chỉ quản trị mới đặt được mặc định cho team.' };
  if (!manHopLe(man)) return { loi: 'Màn không có trong sổ.' };
  const v = hopLe(o, coWidgetCua(man), choLapCua(man)); if (!v) return { loi: 'Bố cục không hợp lệ nên chưa đặt.' };
  const db = getDb(); if (!db) return { loi: 'Chưa nối được cơ sở dữ liệu.' };
  await db.execute(sql`insert into home_bo_cuc (user_id, man, o) values (0, ${man}, ${JSON.stringify(v)}::jsonb)
    on conflict (user_id, man) do update set o = excluded.o, cap_nhat = now()`);
  return { ok: true };
}
