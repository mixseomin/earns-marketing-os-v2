// ĐỌC BỐ CỤC một màn của /home cho một người: bản riêng → bản team (user_id 0) → bố cục dựng sẵn trong sổ (lib/home/so.ts).
// Bố cục cũ không còn hợp lệ (sổ bỏ một widget, dữ liệu hỏng) thì coi như chưa có, rơi xuống tầng dưới — không bao giờ vẽ ô lạ.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { hopLe, type O } from './luoi';
import { coWidget, manCua } from './so';

export type NguonBoCuc = 'rieng' | 'team' | 'san';
export async function docBoCucHome(userId: number, man: string): Promise<{ o: O[]; nguon: NguonBoCuc }> {
  const san = { o: manCua(man).o, nguon: 'san' as const };
  const db = getDb(); if (!db) return san;
  try {
    const rs = (await db.execute(sql`select user_id::int u, o from home_bo_cuc where man = ${man} and user_id in (${userId}, 0)`)) as unknown as { u: number; o: unknown }[];
    const rieng = hopLe(rs.find((r) => r.u === userId)?.o, coWidget), team = hopLe(rs.find((r) => r.u === 0)?.o, coWidget);
    if (rieng?.length) return { o: rieng, nguon: 'rieng' };
    if (team?.length) return { o: team, nguon: 'team' };
  } catch { /* bảng chưa có (máy chưa chạy migration 0449) → bố cục dựng sẵn */ }
  return san;
}
