'use server';
// CHỜ LÊN ETHOPEX (anh 27/11/2026: "sau này creative khi duyệt thì ko gửi lên etho. Phải show ra tao duyệt xong mởi bắt đầu gửi lên đó !").
// Mọi bản dựng mới đi qua MỘT cổng tải: apps/xuong-video/scripts/ethopex/len-creative.py → cho_len.py ghi etp.cho_len 'cho' (0485), KHÔNG tạo creative.
// ✓ Duyệt = 'duyet' → máy dong_phim (iMac, luồng cho_len_chay mỗi 60s) chạy cho_len.py len → tải lên Ethopex → 'da_len'.
// ✕ Bỏ = 'bo' (không xoá) + dòng thư viện tv<id> sang 'loai' để máy không chọn lại.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { openSync } from 'node:fs';
import { chayTach } from '@/lib/etp-chay-tach';
import { envVe, xinVeTrucTiep } from '@/lib/etp-ve';

const run = async <T,>(s: ReturnType<typeof sql>) => (await getDb()!.execute(s)) as unknown as T[];

export type ChoLen = {
  id: number; khoa: string; content_id: number; phim: string | null; lang: string | null; dang: string | null; ma: string | null; mau: string | null;
  video: string | null; anh: string | null; giay: number | null; trang_thai: 'cho' | 'duyet' | 'dang_len' | 'da_len' | 'bo';
  creative_id: number | null; loi: string | null; ghi: string | null; duyet_ai: string | null; tao: string; cap_nhat: string;
  kieu: Kieu; chu: { kien: ChuQc | null; dol: ChuQc };
  // PHIẾU LÊN CAMP (0488, anh 27/11/2026): bản dựng theo phiếu mang sẵn chữ + thiết lập camp; duyệt creative = lên camp, không duyệt camp lần hai
  phieu: { id: number; kieu: Kieu; chu: ChuQc; dang: string; mien: string | null; roas: string; ns: number; gio: string; tu_do: boolean; trang_thai: string } | null;
  camp_id: number | null; camp_loi: string | null;
};
type DongCho = Omit<ChoLen, 'chu' | 'phieu'> & { p_id: number | null; p_kieu: Kieu | null; p_chu: { pt: string[]; hl: string[]; de: string[] } | null; p_link: string | null;
  p_dang: string | null; p_mien: string | null; p_roas: string | null; p_ns: number | null; p_gio: string | null; p_tu_do: boolean | null; p_tt: string | null };
// KIỂU CHỮ QC (anh 27/11/2026 "Khi duyệt creative thì cũng duyệt cả nội dung text luôn. Sinh kiểu Kiên là default và có option chọn sang Dol"):
// chữ đọc ĐÚNG sổ máy tạo creative dùng (chu-qc.py chu_theo_kieu → apps/etp/so_kieu.py) — kien = apps/etp/chu-kieu.json kien[content_id] (tay, ưu tiên) ∪ etp.chu_kieu
// (máy sinh lúc bản vào hàng chờ: apps/etp/sinh-chu-kien.py, anh 27/11/2026 "Mày phải sinh luôn text cho kiểu Kiên lúc review Ảnh") + _link_url; dol = apps/etp/form-chu.json.
import { soChu, type Kieu, type ChuQc } from '@/lib/etp-chu-so';
export type { Kieu, ChuQc } from '@/lib/etp-chu-so';

async function laAdmin() { const me = await getCurrentUser(); return me?.role === 'admin' ? me : null; }

/** chờ duyệt + đã duyệt đang chờ máy tải + lên lỗi (có loi) + vừa lên trong 6 giờ (để thấy kết quả sau khi bấm) */
export async function dsChoLen(): Promise<{ ds: ChoLen[] } | { loi: string }> {
  if (!(await laAdmin())) return { loi: 'chỉ admin' };
  try {
    const ds = await run<DongCho>(sql`select c.id, c.khoa, c.content_id, f.ten phim, c.lang, c.dang, c.ma, c.mau, c.video, c.anh, c.giay::float giay, c.trang_thai,
        c.creative_id, c.loi, c.ghi, c.duyet_ai, c.tao::text tao, c.cap_nhat::text cap_nhat, c.kieu, c.camp_id, c.camp_loi,
        p.id p_id, p.kieu p_kieu, p.chu p_chu, p.link p_link, p.dang p_dang, p.mien p_mien, coalesce(c.phieu_roas, p.roas_ds[1], p.roas) p_roas, p.ns p_ns, p.gio p_gio, p.tu_do p_tu_do, p.trang_thai p_tt
      from etp.cho_len c left join etp.phim f on f.content_id = c.content_id left join etp.phieu_len p on p.id = c.phieu_id
      where c.phieu_id is not null   -- chỉ bản dựng theo PHIẾU; thẻ form cũ (không phiếu) bỏ (anh 27/11/2026 "Bỏ form cũ này đi")
        and (c.trang_thai in ('cho', 'duyet', 'dang_len') or (c.trang_thai = 'da_len' and c.cap_nhat > now() - interval '6 hours')
        or (c.trang_thai = 'da_len' and c.camp_id is null and c.cap_nhat > now() - interval '3 days'))
      order by (c.trang_thai = 'cho') desc, c.tao desc limit 200`);
    const so = await soChu(ds.map((x) => x.content_id));
    return { ds: ds.map(({ p_id, p_kieu, p_chu, p_link, p_dang, p_mien, p_roas, p_ns, p_gio, p_tu_do, p_tt, ...x }) => ({ ...x, chu: { kien: so.kien(x.content_id), dol: so.dol },
      phieu: p_id ? { id: p_id, kieu: p_kieu ?? 'kien', chu: { pt: p_chu?.pt ?? [], hl: p_chu?.hl ?? [], de: p_chu?.de ?? [], link: p_link ?? '' }, dang: p_dang ?? '', mien: p_mien,
        roas: p_roas ?? 'dan', ns: p_ns ?? 0, gio: p_gio ?? 'lich', tu_do: !!p_tu_do, trang_thai: p_tt ?? '' } : null })) };
  } catch (e) { return { loi: `đọc etp.cho_len lỗi: ${(e as Error).message}` }; }
}

/** thẻ có phiếu: ✓ Duyệt = duyệt creative + LỆNH lên camp (vé trực tiếp 'tao_camp') → apps/etp/len-phieu.py chạy tách: chờ máy iMac tải creative rồi tạo camp đúng phiếu */
async function lenTheoPhieu(n: number, me: { email: string }, duyet: boolean): Promise<{ ok: true; chu: string } | { loi: string } | { canh: string }> {
  const [c] = await run<{ content_id: number; phieu_id: number; ns: number; dang: string; kieu: Kieu; roas: string; gio: string; camp_id: number | null; trang_thai: string }>(sql`select c.content_id,
      c.phieu_id, p.ns, p.dang, p.kieu, coalesce(c.phieu_roas, p.roas_ds[1], p.roas) roas, p.gio, c.camp_id, c.trang_thai from etp.cho_len c join etp.phieu_len p on p.id = c.phieu_id where c.id = ${n}`);
  if (!c) return { loi: `#${n} không có phiếu` };
  if (c.camp_id) return { loi: `#${n} đã có camp #${c.camp_id}` };
  if (duyet ? !['cho', 'duyet'].includes(c.trang_thai) : !['duyet', 'dang_len', 'da_len'].includes(c.trang_thai)) return { loi: `#${n} đang ở trạng thái ${c.trang_thai} — tải lại trang` };
  const k = c.kieu === 'kien' ? 'K' : 'D';
  const lenh = `anh duyệt creative #${n} ở etp2 › Chờ lên = lên camp theo phiếu #${c.phieu_id} (${k} · ${c.dang} · ROAS ${c.roas} · $${c.ns})`;
  const v = await xinVeTrucTiep('tao_camp', { content: c.content_id, lenh, ns: c.ns });
  if (!('ma' in v)) return 'canh' in v ? { canh: `${v.canh} — bấm lần nữa để vẫn lên` } : v;
  if (duyet) {
    const r = await run<{ id: number }>(sql`update etp.cho_len set trang_thai = 'duyet', duyet_ai = ${me.email}, duyet_luc = now(), loi = null, kieu = ${c.kieu}, cap_nhat = now()
      where id = ${n} and trang_thai in ('cho', 'duyet') returning id`);
    if (!r.length) return { loi: `#${n} không còn ở trạng thái chờ duyệt — tải lại trang` };
  }
  await run(sql`update etp.cho_len set camp_loi = null, cap_nhat = now() where id = ${n}`);
  const repo = process.env.REPO_DIR ?? '/opt/earns-marketing-os-v2', log = openSync(`/tmp/etp-len-phieu-${n}.log`, 'a');
  chayTach('python3', [`${repo}/apps/etp/len-phieu.py`, String(n)], { cwd: repo, detached: true, stdio: ['ignore', log, log], env: envVe(v.ma) }).unref();
  if (c.dang === 'CU') return { ok: true, chu: `${duyet ? 'đã duyệt' : 'gửi lại lệnh'} #${n}: creative cũ — máy tạo bản mới cùng video với chữ ${k} của phiếu #${c.phieu_id} (không dựng, ~1–2 phút) rồi tạo camp (ROAS ${c.roas} · $${c.ns})` };
  return { ok: true, chu: `${duyet ? 'đã duyệt' : 'gửi lại lệnh'} #${n}: máy iMac tải creative lên Ethopex (~1–2 phút) rồi tạo camp theo phiếu #${c.phieu_id} (${k} · ${c.dang} · $${c.ns})` };
}

/** thẻ phiếu đã duyệt mà lên camp lỗi / quá hạn vé → anh bấm Lên camp lại (vé mới) */
export async function lenCampLaiChoLen(id: number): Promise<{ ok: true; chu: string } | { loi: string } | { canh: string }> {
  const me = await laAdmin(); if (!me) return { loi: 'chỉ admin' };
  return lenTheoPhieu(Math.trunc(Number(id)), me, false);
}

export async function duyetChoLen(id: number): Promise<{ ok: true; chu: string } | { loi: string } | { canh: string }> {
  const me = await laAdmin(); if (!me) return { loi: 'chỉ admin' };
  const n = Math.trunc(Number(id));
  const [ph] = await run<{ phieu_id: number | null }>(sql`select phieu_id from etp.cho_len where id = ${n}`);
  if (ph?.phieu_id) return lenTheoPhieu(n, me, true);
  // duyệt = duyệt cả chữ QC đang hiện trên thẻ. Phim chưa có chữ K (chu-kieu.json) → thẻ đã hiện chữ D → lưu D đúng thứ anh vừa xem (chu-qc.py dừng nếu K mà thiếu chữ)
  const c = await run<{ content_id: number }>(sql`select content_id from etp.cho_len where id = ${n}`);
  const epD = !!c[0] && !(await soChu([c[0].content_id])).kien(c[0].content_id);
  const r = await run<{ id: number; kieu: Kieu }>(sql`update etp.cho_len set trang_thai = 'duyet', duyet_ai = ${me.email}, duyet_luc = now(), loi = null, cap_nhat = now(),
      kieu = case when ${epD} then 'dol' else kieu end
    where id = ${n} and trang_thai in ('cho', 'duyet') returning id, kieu`);
  if (!r.length) return { loi: `#${n} không còn ở trạng thái chờ duyệt (đã lên hoặc đã bỏ) — tải lại trang` };
  return { ok: true, chu: `đã duyệt #${n} với chữ ${r[0]!.kieu === 'kien' ? 'K' : 'D'}${epD ? ' (phim chưa có chữ K)' : ''} — máy trên iMac tải lên Ethopex trong ~1–2 phút` };
}

export async function doiKieuChoLen(id: number, kieu: Kieu): Promise<{ ok: true; chu: string } | { loi: string }> {
  const me = await laAdmin(); if (!me) return { loi: 'chỉ admin' };
  if (kieu !== 'kien' && kieu !== 'dol') return { loi: `kiểu chữ không hợp lệ: ${String(kieu)}` };
  const n = Math.trunc(Number(id));
  const r = await run<{ id: number }>(sql`update etp.cho_len set kieu = ${kieu}, cap_nhat = now() where id = ${n} and trang_thai in ('cho', 'duyet') returning id`);
  if (!r.length) return { loi: `#${n} không đổi kiểu được: đang tải / đã lên / đã bỏ — tải lại trang` };
  return { ok: true, chu: `#${n} sẽ lên với chữ ${kieu === 'kien' ? 'K · search.com' : 'D · info.com'}` };
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

/** máy chưa sinh được chữ K lúc bản vào hàng chờ (cổng AI lỗi / thiếu cốt truyện) → anh bấm sinh lại cho phim của thẻ #id (~2₫, chạy apps/etp/sinh-chu-kien.py trên box3) */
export async function sinhChuKien(id: number): Promise<{ ok: true; chu: string } | { loi: string }> {
  if (!(await laAdmin())) return { loi: 'chỉ admin' };
  const c = await run<{ content_id: number }>(sql`select content_id from etp.cho_len where id = ${Math.trunc(Number(id))}`);
  if (!c[0]) return { loi: `#${id} không có trong hàng chờ — tải lại trang` };
  const tep = path.join(process.cwd(), '..', 'etp', 'sinh-chu-kien.py');
  return await new Promise((ok) => execFile('python3', [tep, String(c[0]!.content_id)], { timeout: 240_000, maxBuffer: 1 << 20, cwd: path.join(process.cwd(), '..', '..') }, (e, out, err) => {
    const ra = `${out ?? ''}`.trim();
    if (e) return ok({ loi: `sinh chữ K lỗi: ${(ra.split('\n').find((l) => l.startsWith('✗')) ?? `${err ?? ''}`.trim().split('\n').slice(-2).join(' ') ?? e.message).slice(0, 400)}` });
    ok({ ok: true, chu: ra.split('\n').slice(-1)[0] ?? 'đã sinh' });
  }));
}
