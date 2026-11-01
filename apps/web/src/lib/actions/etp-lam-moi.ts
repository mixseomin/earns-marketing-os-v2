'use server';
// LÀM MỚI DỮ LIỆU (anh 01/11/2026 #1497 "thêm nút refresh data"): trang tự đọc lại kho mỗi phút, nhưng kho chỉ kéo Ethopex 10 phút/lần (etp-dong-bo.timer).
// Nút này chạy ngay MỘT lượt đồng bộ đó (cùng unit systemd — đang chạy thì systemd gộp vào lượt đang chạy, không đẻ lượt thứ hai), trang chờ lượt xong rồi đọc lại.
import { execFile } from 'node:child_process';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';

const VUA = 60;   // giây — lượt vừa xong trong khoảng này thì kho đã mới, chỉ đọc lại trang

export async function lamMoiEtp(): Promise<{ ok: true; chay: boolean; lan: number | null } | { loi: string }> {
  if (!(await quyenEtp(await getCurrentUser()))) return { loi: 'không có quyền' };
  const r = ((await getDb()!.execute(sql`select lan, extract(epoch from now() - xong)::int tuoi from etp.dong_bo where xong is not null order by lan desc limit 1`)) as unknown as { lan: number; tuoi: number }[])[0];
  const lan = r ? Number(r.lan) : null;
  if (r && Number(r.tuoi) < VUA) return { ok: true, chay: false, lan };
  const loi = await new Promise<string | null>((ok) => execFile('systemctl', ['start', '--no-block', 'etp-dong-bo.service'], { timeout: 15_000 }, (e, _o, er) => ok(e ? String(er || e.message).trim().slice(0, 200) : null)));
  return loi ? { loi: `không chạy được lượt đồng bộ: ${loi}` } : { ok: true, chay: true, lan };
}
