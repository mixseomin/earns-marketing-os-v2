'use server';
// DIỄN BIẾN TRONG NGÀY (anh 05/11/2026: "khi bấm hoặc hover vào 1 ngày có thể nhìn thấy diễn biến tăng giảm trong ngày đó ko" — "1 cái chart"):
// chi / thu từng giờ của một nhóm camp trong một ngày Ethopex, từ etp.so_gio_camp (dong-bo ghi). gio 0 = 07:00 VN.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp, xemNha } from '@/lib/etp-quyen';

export type SoGio = { gio: number; chi: number; thu: number };

export async function docGioNgay(camps: number[], ngay: string): Promise<{ ds: SoGio[]; luc: string | null } | { loi: string }> {
  const q = await quyenEtp(await getCurrentUser());
  if (!q || !xemNha(q)) return { loi: 'không có quyền xem số theo giờ' };
  const ids = [...new Set(camps.filter((x) => Number.isInteger(x) && x > 0))].slice(0, 2000);
  if (!ids.length || !/^\d{4}-\d{2}-\d{2}$/.test(ngay)) return { ds: [], luc: null };
  const r = (await getDb()!.execute(sql`select gio, sum(chi)::float chi, sum(thu)::float thu, max(cap_nhat)::text luc from etp.so_gio_camp
    where ngay = ${ngay}::date and camp_id = any(${`{${ids.join(',')}}`}::bigint[]) group by gio order by gio`)) as unknown as { gio: number; chi: number; thu: number; luc: string }[];
  return { ds: r.map((x) => ({ gio: Number(x.gio), chi: Number(x.chi), thu: Number(x.thu) })), luc: r.reduce<string | null>((a, x) => (!a || x.luc > a ? x.luc : a), null) };
}
