'use server';
// CHỜ LÊN ETHOPEX (anh 27/11/2026: "sau này creative khi duyệt thì ko gửi lên etho. Phải show ra tao duyệt xong mởi bắt đầu gửi lên đó !").
// Mọi bản dựng mới đi qua MỘT cổng tải: apps/xuong-video/scripts/ethopex/len-creative.py → cho_len.py ghi etp.cho_len 'cho' (0485), KHÔNG tạo creative.
// ✓ Duyệt = 'duyet' → máy dong_phim (iMac, luồng cho_len_chay mỗi 60s) chạy cho_len.py len → tải lên Ethopex → 'da_len'.
// ✕ Bỏ = 'bo' (không xoá) + dòng thư viện tv<id> sang 'loai' để máy không chọn lại.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';

const run = async <T,>(s: ReturnType<typeof sql>) => (await getDb()!.execute(s)) as unknown as T[];

export type ChoLen = {
  id: number; khoa: string; content_id: number; phim: string | null; lang: string | null; dang: string | null; ma: string | null; mau: string | null;
  video: string | null; anh: string | null; giay: number | null; trang_thai: 'cho' | 'duyet' | 'dang_len' | 'da_len' | 'bo';
  creative_id: number | null; loi: string | null; ghi: string | null; duyet_ai: string | null; tao: string; cap_nhat: string;
};

async function laAdmin() { const me = await getCurrentUser(); return me?.role === 'admin' ? me : null; }

/** chờ duyệt + đã duyệt đang chờ máy tải + lên lỗi (có loi) + vừa lên trong 6 giờ (để thấy kết quả sau khi bấm) */
export async function dsChoLen(): Promise<{ ds: ChoLen[] } | { loi: string }> {
  if (!(await laAdmin())) return { loi: 'chỉ admin' };
  try {
    const ds = await run<ChoLen>(sql`select c.id, c.khoa, c.content_id, f.ten phim, c.lang, c.dang, c.ma, c.mau, c.video, c.anh, c.giay::float giay, c.trang_thai,
        c.creative_id, c.loi, c.ghi, c.duyet_ai, c.tao::text tao, c.cap_nhat::text cap_nhat
      from etp.cho_len c left join etp.phim f on f.content_id = c.content_id
      where c.trang_thai in ('cho', 'duyet', 'dang_len') or (c.trang_thai = 'da_len' and c.cap_nhat > now() - interval '6 hours')
      order by (c.trang_thai = 'cho') desc, c.tao desc limit 200`);
    return { ds };
  } catch (e) { return { loi: `đọc etp.cho_len lỗi: ${(e as Error).message}` }; }
}

export async function duyetChoLen(id: number): Promise<{ ok: true; chu: string } | { loi: string }> {
  const me = await laAdmin(); if (!me) return { loi: 'chỉ admin' };
  const n = Math.trunc(Number(id));
  const r = await run<{ id: number }>(sql`update etp.cho_len set trang_thai = 'duyet', duyet_ai = ${me.email}, duyet_luc = now(), loi = null, cap_nhat = now()
    where id = ${n} and trang_thai in ('cho', 'duyet') returning id`);
  if (!r.length) return { loi: `#${n} không còn ở trạng thái chờ duyệt (đã lên hoặc đã bỏ) — tải lại trang` };
  return { ok: true, chu: `đã duyệt #${n} — máy trên iMac tải lên Ethopex trong ~1–2 phút` };
}

export async function boChoLen(id: number): Promise<{ ok: true; chu: string } | { loi: string }> {
  const me = await laAdmin(); if (!me) return { loi: 'chỉ admin' };
  const n = Math.trunc(Number(id));
  const r = await run<{ khoa: string }>(sql`update etp.cho_len set trang_thai = 'bo', duyet_ai = ${me.email}, duyet_luc = now(), cap_nhat = now()
    where id = ${n} and trang_thai in ('cho', 'duyet') returning khoa`);
  if (!r.length) return { loi: `#${n} không bỏ được: đã lên Ethopex hoặc đã bỏ trước đó — tải lại trang` };
  const k = r[0]!.khoa;
  if (/^tv\d+$/.test(k)) await run(sql`update etp.thu_vien set trang_thai = 'loai', ghi = ghi || ' · anh bỏ ở Chờ lên', cap_nhat = now() where id = ${Number(k.slice(2))} and trang_thai <> 'da_len'`);
  return { ok: true, chu: `đã bỏ #${n} — không lên Ethopex` };
}
