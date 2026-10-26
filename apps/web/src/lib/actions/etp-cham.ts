'use server';
// NÚT "CHẤM" trên etp.on.tc › Creative › Quét nội dung (anh 25/10/2026: "thêm nút để tao có thể chủ động chạy chấm 1 creative cụ thể").
// Chỉ xếp hàng etp.cham_hang — Worker Cloudflare etp-cham nhận trong ~1 phút.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { spawn } from 'node:child_process';

export async function xepHangCham(ids: number[]): Promise<{ ok: true; so: number } | { loi: string }> {
  const me = await getCurrentUser();
  if (!me) return { loi: 'chưa đăng nhập' };
  if (me.role !== 'admin') return { loi: 'chỉ admin' };
  const ds = [...new Set(ids.map(Number).filter((x) => Number.isInteger(x) && x > 0))].slice(0, 200);
  if (!ds.length) return { loi: 'không có creative' };
  await getDb()!.execute(sql`insert into etp.cham_hang (creative_id, nguon, ai)
    select unnest(${`{${ds.join(',')}}`}::int[]), 'nut', ${me.email}
    on conflict (creative_id) do update set luc = now(), nguon = 'nut', ai = excluded.ai, trang_thai = 'cho', bat_dau = null, xong = null, loi = null,
      buoc = 'chờ Cloudflare nhận', nhat_ky = jsonb_build_array(jsonb_build_object('b', 'anh bấm Chấm', 'luc', now()))
    where etp.cham_hang.trang_thai <> 'dang'`);
  return { ok: true, so: ds.length };
}

// DUYỆT CREATIVE 5 ĐIỂM (anh 26/10/2026: "5 điểm thì sẽ cần review người thật" · "không duyệt qua tele — gửi 1 tin tổng hợp rồi link đến page trên etp.on.tc"):
// Đạt = cho lên / chạy tiếp; Loại = chặn lên + máy tắt mọi camp dùng creative này ở lượt lịch giờ kế (≤ 10 phút, apps/etp/lich-gio.py tat_cham). Một nguồn: view etp.cham_cong (0341).
export async function duyetCham(id: number, ok: boolean): Promise<{ ok: true } | { loi: string }> {
  const me = await getCurrentUser();
  if (!me) return { loi: 'chưa đăng nhập' };
  if (me.role !== 'admin') return { loi: 'chỉ admin' };
  if (!Number.isInteger(id) || id <= 0) return { loi: 'creative sai' };
  await getDb()!.execute(sql`insert into etp.cham_duyet (creative_id, ok, ai, ghi) values (${id}, ${ok}, ${me.email}, 'etp.on.tc')
    on conflict (creative_id) do update set ok = excluded.ok, ai = excluded.ai, ghi = excluded.ghi, luc = now()`);
  return { ok: true };
}

// ĐÈN + NÚT TẮT / BẬT CAMP NGAY Ở BẢNG SOÁT (anh 26/10/2026: "creative thuộc camp active thì hiểu là nó đang chạy thật thì phải thêm nút đèn xanh. Cho tắt bật tại đây luôn").
// Mọi lệnh đi qua lam-ethopex.py (một đường: chặn 24 giờ, rào ngân sách, đọc lại, nhật ký luật) — chạy nền (đọc lại tới ~60s/camp), trang tự làm mới thấy trạng thái mới.
// Tắt: mọi camp ACTIVE dùng creative (kể cả bản nhân ★ "duplicate by"); Bật: camp PAUSED của creative, chỉ khi creative qua cổng chấm (etp.cham_cong).
const LAM = `${process.env.REPO_DIR ?? '/opt/earns-marketing-os-v2'}/apps/xuong-video/scripts/ethopex/lam-ethopex.py`;
const chayNen = (args: string[]) => { const p = spawn('python3', [LAM, ...args], { detached: true, stdio: 'ignore', env: process.env }); p.unref(); };
export async function tatBatCreative(id: number, bat: boolean): Promise<{ ok: true; so: number } | { loi: string }> {
  const me = await getCurrentUser();
  if (!me) return { loi: 'chưa đăng nhập' };
  if (me.role !== 'admin') return { loi: 'chỉ admin' };
  if (!Number.isInteger(id) || id <= 0) return { loi: 'creative sai' };
  if (bat) return { loi: 'không bật camp từ trang Soát (anh 26/10/2026: còn nhiều luật xung quanh) — chỉ duyệt creative' };
  const db = getDb()!;
  const rows = (await db.execute(sql`select c.camp_id from etp.camp c where c.trang_thai = ${bat ? 'PAUSED' : 'ACTIVE'}
    and coalesce(nullif(c.creative_id, 0), (select s.creative_id from etp.camp s where s.camp_id = substring(c.ten from 'duplicate by (\d+)')::int)) = ${id}`)) as unknown as { rows?: { camp_id: number }[] } | { camp_id: number }[];
  const ids = (Array.isArray(rows) ? rows : rows.rows ?? []).map((r) => Number(r.camp_id));
  if (!ids.length) return { loi: bat ? 'không có camp tạm dừng để bật' : 'không có camp đang chạy' };
  const ai = `anh (etp.on.tc ${me.email})`, luat = `anh bấm ${bat ? 'Bật' : 'Tắt'} ở etp.on.tc › Soát creative #${id}`;
  if (bat) {
    const g = (await db.execute(sql`select duoc_len, chan_boi from etp.cham_cong where creative_id = ${id}`)) as unknown as { rows?: { duoc_len: boolean; chan_boi: string | null }[] } | { duoc_len: boolean; chan_boi: string | null }[];
    const k = (Array.isArray(g) ? g : g.rows ?? [])[0];
    if (!k || !k.duoc_len) return { loi: `creative #${id} chưa qua cổng chấm${k?.chan_boi ? ` (${k.chan_boi})` : ' (chưa chấm)'} — không bật` };
    for (const c of ids) chayNen(['bat', String(c), '--luat', luat, '--ai', ai]);
  } else chayNen(['tat-loat', ids.join(','), '--ep', '--luat', luat, '--ai', ai]);
  return { ok: true, so: ids.length };
}
