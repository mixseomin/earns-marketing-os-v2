'use server';
// CHỜ LÊN ETHOPEX (anh 27/11/2026: "sau này creative khi duyệt thì ko gửi lên etho. Phải show ra tao duyệt xong mởi bắt đầu gửi lên đó !").
// Mọi bản dựng mới đi qua MỘT cổng tải: apps/xuong-video/scripts/ethopex/len-creative.py → cho_len.py ghi etp.cho_len 'cho' (0485), KHÔNG tạo creative.
// ✓ Duyệt = 'duyet' → máy dong_phim (iMac, luồng cho_len_chay mỗi 60s) chạy cho_len.py len → tải lên Ethopex → 'da_len'.
// ✕ Bỏ = 'bo' (không xoá) + dòng thư viện tv<id> sang 'loai' để máy không chọn lại.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const run = async <T,>(s: ReturnType<typeof sql>) => (await getDb()!.execute(s)) as unknown as T[];

export type ChoLen = {
  id: number; khoa: string; content_id: number; phim: string | null; lang: string | null; dang: string | null; ma: string | null; mau: string | null;
  video: string | null; anh: string | null; giay: number | null; trang_thai: 'cho' | 'duyet' | 'dang_len' | 'da_len' | 'bo';
  creative_id: number | null; loi: string | null; ghi: string | null; duyet_ai: string | null; tao: string; cap_nhat: string;
  kieu: Kieu; chu: { kien: ChuQc | null; dol: ChuQc };
};
// KIỂU CHỮ QC (anh 27/11/2026 "Khi duyệt creative thì cũng duyệt cả nội dung text luôn. Sinh kiểu Kiên là default và có option chọn sang Dol"):
// chữ đọc ĐÚNG sổ máy tạo creative dùng (chu-qc.py chu_theo_kieu) — kien = apps/etp/chu-kieu.json kien[content_id] + _link_url, dol = apps/etp/form-chu.json. Không tự viết chữ.
export type Kieu = 'kien' | 'dol';
export type ChuQc = { pt: string[]; hl: string[]; de: string[]; link: string };
const docSo = (f: string) => { try { return JSON.parse(readFileSync(path.join(process.cwd(), '..', 'etp', f), 'utf8')) as Record<string, any>; } catch { return null; } };
function soChu() {
  const k = docSo('chu-kieu.json'), f = docSo('form-chu.json');
  if (!f) throw new Error('không đọc được apps/etp/form-chu.json (cwd ' + process.cwd() + ')');
  const dol: ChuQc = { pt: f.primaryTexts ?? [], hl: f.headlines ?? [], de: f.descriptions ?? [], link: f.link_url ?? '' };
  const kien = (cid: number): ChuQc | null => { const b = k?.kien?.[String(cid)]; return b ? { pt: b.primaryTexts ?? [], hl: b.headlines ?? [], de: b.descriptions ?? [], link: k?.kien?._link_url ?? '' } : null; };
  return { dol, kien };
}

async function laAdmin() { const me = await getCurrentUser(); return me?.role === 'admin' ? me : null; }

/** chờ duyệt + đã duyệt đang chờ máy tải + lên lỗi (có loi) + vừa lên trong 6 giờ (để thấy kết quả sau khi bấm) */
export async function dsChoLen(): Promise<{ ds: ChoLen[] } | { loi: string }> {
  if (!(await laAdmin())) return { loi: 'chỉ admin' };
  try {
    const ds = await run<ChoLen>(sql`select c.id, c.khoa, c.content_id, f.ten phim, c.lang, c.dang, c.ma, c.mau, c.video, c.anh, c.giay::float giay, c.trang_thai,
        c.creative_id, c.loi, c.ghi, c.duyet_ai, c.tao::text tao, c.cap_nhat::text cap_nhat, c.kieu
      from etp.cho_len c left join etp.phim f on f.content_id = c.content_id
      where c.trang_thai in ('cho', 'duyet', 'dang_len') or (c.trang_thai = 'da_len' and c.cap_nhat > now() - interval '6 hours')
      order by (c.trang_thai = 'cho') desc, c.tao desc limit 200`);
    const so = soChu();
    return { ds: ds.map((x) => ({ ...x, chu: { kien: so.kien(x.content_id), dol: so.dol } })) };
  } catch (e) { return { loi: `đọc etp.cho_len lỗi: ${(e as Error).message}` }; }
}

export async function duyetChoLen(id: number): Promise<{ ok: true; chu: string } | { loi: string }> {
  const me = await laAdmin(); if (!me) return { loi: 'chỉ admin' };
  const n = Math.trunc(Number(id));
  // duyệt = duyệt cả chữ QC đang hiện trên thẻ. Phim chưa có chữ Kiên (chu-kieu.json) → thẻ đã hiện chữ D → lưu D đúng thứ anh vừa xem (chu-qc.py dừng nếu K mà thiếu chữ)
  const c = await run<{ content_id: number }>(sql`select content_id from etp.cho_len where id = ${n}`);
  const epD = !!c[0] && !soChu().kien(c[0].content_id);
  const r = await run<{ id: number; kieu: Kieu }>(sql`update etp.cho_len set trang_thai = 'duyet', duyet_ai = ${me.email}, duyet_luc = now(), loi = null, cap_nhat = now(),
      kieu = case when ${epD} then 'dol' else kieu end
    where id = ${n} and trang_thai in ('cho', 'duyet') returning id, kieu`);
  if (!r.length) return { loi: `#${n} không còn ở trạng thái chờ duyệt (đã lên hoặc đã bỏ) — tải lại trang` };
  return { ok: true, chu: `đã duyệt #${n} với chữ kiểu ${r[0]!.kieu === 'kien' ? 'Kiên (K)' : 'Dol (D)'}${epD ? ' (phim chưa có chữ Kiên)' : ''} — máy trên iMac tải lên Ethopex trong ~1–2 phút` };
}

export async function doiKieuChoLen(id: number, kieu: Kieu): Promise<{ ok: true; chu: string } | { loi: string }> {
  const me = await laAdmin(); if (!me) return { loi: 'chỉ admin' };
  if (kieu !== 'kien' && kieu !== 'dol') return { loi: `kiểu chữ không hợp lệ: ${String(kieu)}` };
  const n = Math.trunc(Number(id));
  const r = await run<{ id: number }>(sql`update etp.cho_len set kieu = ${kieu}, cap_nhat = now() where id = ${n} and trang_thai in ('cho', 'duyet') returning id`);
  if (!r.length) return { loi: `#${n} không đổi kiểu được: đang tải / đã lên / đã bỏ — tải lại trang` };
  return { ok: true, chu: `#${n} sẽ lên với chữ kiểu ${kieu === 'kien' ? 'Kiên (K · search.com)' : 'Dol (D · info.com)'}` };
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
