'use server';
// LÀM MỚI DỮ LIỆU (anh 01/11/2026 #1497 "thêm nút refresh data"): trang tự đọc lại kho mỗi phút, nhưng kho chỉ kéo Ethopex 10 phút/lần (etp-dong-bo.timer).
// Nút này chạy ngay MỘT lượt đồng bộ đó (cùng unit systemd — đang chạy thì systemd gộp vào lượt đang chạy, không đẻ lượt thứ hai), trang chờ lượt xong rồi đọc lại.
import { execFile } from 'node:child_process';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';

const VUA = 60;   // giây — lượt vừa xong trong khoảng này thì kho đã mới, chỉ đọc lại trang

/** chay = có lượt kéo số đang chạy / vừa mở → trang chờ tới khi kho có lượt hoàn tất mới hơn `lan`.
 *  ban = máy đang chạy PHẦN SAU của lượt vừa xong (chấm nhẹ, ảnh creative, đề xuất team — dong-bo.py sau dòng ghi xong, có lúc vài chục phút):
 *  số trong kho là của lượt đó, systemd không mở lượt mới tới khi phần sau xong — chỉ đọc lại trang và nói rõ, không để nút chờ một lượt không tới */
export async function lamMoiEtp(): Promise<{ ok: true; chay: boolean; ban?: string; lan: number | null } | { loi: string }> {
  if (!(await quyenEtp(await getCurrentUser()))) return { loi: 'không có quyền' };
  const r = ((await getDb()!.execute(sql`select lan, extract(epoch from now() - xong)::int tuoi, xong::text xong,
      exists (select 1 from etp.dong_bo d where d.xong is null and d.lan > b.lan and d.bat_dau > now() - interval '20 minutes') dang
    from etp.dong_bo b where xong is not null order by lan desc limit 1`)) as unknown as { lan: number; tuoi: number; xong: string; dang: boolean }[])[0];
  const lan = r ? Number(r.lan) : null;
  if (r?.dang) return { ok: true, chay: true, lan };
  if (r && Number(r.tuoi) < VUA) return { ok: true, chay: false, lan };
  const tt = await new Promise<string>((ok) => execFile('systemctl', ['is-active', 'etp-dong-bo.service'], { timeout: 10_000 }, (_e, o) => ok(String(o ?? '').trim())));
  if (tt === 'activating' || tt === 'active') return { ok: true, chay: false, ban: r?.xong ?? '', lan };
  const loi = await new Promise<string | null>((ok) => execFile('systemctl', ['start', '--no-block', 'etp-dong-bo.service'], { timeout: 15_000 }, (e, _o, er) => ok(e ? String(er || e.message).trim().slice(0, 200) : null)));
  return loi ? { loi: `không chạy được lượt đồng bộ: ${loi}` } : { ok: true, chay: true, lan };
}
