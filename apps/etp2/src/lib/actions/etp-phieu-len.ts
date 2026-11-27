'use server';
// PHIẾU LÊN CAMP (anh 27/11/2026: "giờ lên camp thì sẽ hiện poster phim, tên phim, ngôn ngữ phim. Sau đó sẽ cho ta chọn form text kiểu K hay D. Chọn xong sẽ tự sinh
// nội dung form text tương ứng. Nếu bấm lại (cho trùng) thì sinh lại tiếp form text. Cho ta chọn tiếp kiểu creative là AD, CC2,... default AD. Các trường link …
// default là search.com. Tương tự với domain. Ngân sách, loại bid … default đc set sẵn … Giờ chạy … khung cố định hoặc custom tuỳ ý nhưng cảnh báo. Khi submit thì mày
// sẽ sx với các thông tin đó … để tao review lại creative 1 lần nữa trc khi đẩy camp lên. Ko cần bước review camp thứ 2 nữa").
// Luồng: guiPhieu ghi etp.phieu_len 'dung' (0488) → AD: etp.mau_dung dt_anh_dong_logo tuy_chon.phieu (dung-mau.py, iMac) · CC2: dòng phim (chayDong, cho_len.py nối phiếu)
// → bản dựng vào etp2 › Chờ lên mang phieu_id → anh ✓ Duyệt (etp-cho-len.ts) = vé trực tiếp + apps/etp/len-phieu.py tải creative rồi tạo camp đúng phiếu.
// Nhãn hiện cho anh chỉ "K" / "D" (anh: "Khi show chỉ viết K hay D. Cấm ghi tên chi tiết").
import { anhUrl } from '@/lib/etp-anh-url';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { soChu, type Kieu, type ChuQc } from '@/lib/etp-chu-so';
import { haiKhung, laKhung } from '@/lib/etp-khung';
import { chayDong } from '@/lib/actions/etp-dong';

const run = async <T,>(s: ReturnType<typeof sql>) => (await getDb()!.execute(s)) as unknown as T[];
async function laAdmin() { const me = await getCurrentUser(); return me?.role === 'admin' ? me : null; }

export type DangPhieu = 'AD' | 'CC2';
const MAU_AD = 'dt_anh_dong_logo';
const ROAS_MUC = ['dan', '0.9', '1', '1.1', '1.2'] as const;
export type PhieuMo = {
  cid: number; ten: string | null; lang: string | null; poster: string | null;
  chu: { K: ChuQc | null; D: ChuQc };
  mien: string[]; mien_mac: string | null; khung: { gio: string; chu: string }[];
  dang_cho: { id: number; dang: string; trang_thai: string; tao: string }[];   // phiếu đang dở của phim (để anh không gửi trùng)
};

/** mở phiếu: poster + tên + ngôn ngữ, chữ K (sổ) / D (form-chu), danh sách domain, hai khung giờ chính */
export async function docPhieu(cid: number): Promise<{ ok: true; p: PhieuMo } | { loi: string }> {
  if (!(await laAdmin())) return { loi: 'chỉ admin' };
  const id = Math.trunc(Number(cid)); if (!(id > 0)) return { loi: 'mã phim không hợp lệ' };
  const [f] = await run<{ ten: string | null; lang: string | null; poster: string | null }>(sql`select coalesce(p.ten, v.ten) ten, coalesce(p.locale, v.locale) lang, v.anh poster
    from (select ${id}::int content_id) k left join etp.phim p using (content_id) left join etp.thu_vien_phim v using (content_id)`);
  if (!f?.ten) return { loi: `phim #${id} không có trong etp.phim / thư viện phim` };
  const so = await soChu([id]);
  const [m] = await run<{ mac: string | null; ds: string[] | null }>(sql`select (select gia_tri #>> '{}' from etp.cau_hinh where khoa = 'mien_len') mac,
    (select array_agg(mien order by n desc) from (select mien, count(*) n from etp.camp where mien is not null and mien <> '' group by mien order by n desc limit 12) t) ds`);
  const mien = [...new Set([m?.mac, ...(m?.ds ?? [])].filter((x): x is string => !!x))];
  const dang = await run<{ id: number; dang: string; trang_thai: string; tao: string }>(sql`select id, dang, trang_thai, tao::text tao from etp.phieu_len
    where content_id = ${id} and trang_thai in ('dung', 'cho_duyet', 'len', 'loi') and tao > now() - interval '3 days' order by tao desc`);
  return { ok: true, p: { cid: id, ten: f.ten, lang: f.lang, poster: anhUrl(f.poster), chu: { K: so.kien(id), D: so.dol }, mien, mien_mac: m?.mac ?? null, khung: haiKhung(), dang_cho: dang } };
}

/** chọn K (hoặc bấm K lần nữa) → máy sinh bộ chữ K mới cho phim (apps/etp/sinh-chu-kien.py --lai --xem --json: không ghi sổ, chữ chỉ đi theo phiếu khi gửi) */
export async function sinhChuK(cid: number): Promise<{ ok: true; chu: ChuQc; vnd: number } | { loi: string }> {
  if (!(await laAdmin())) return { loi: 'chỉ admin' };
  const id = Math.trunc(Number(cid)); if (!(id > 0)) return { loi: 'mã phim không hợp lệ' };
  const tep = path.join(process.cwd(), '..', 'etp', 'sinh-chu-kien.py');
  const link = (await soChu([])).kien(0)?.link ?? 'search.com';
  return await new Promise((ok) => execFile('python3', [tep, String(id), '--lai', '--xem', '--json'], { timeout: 240_000, maxBuffer: 1 << 20, cwd: path.join(process.cwd(), '..', '..') }, (e, out, err) => {
    const ra = `${out ?? ''}`, dong = ra.split('\n').find((l) => l.startsWith('JSON:'));
    if (!dong) return ok({ loi: `sinh chữ K lỗi: ${(ra.split('\n').find((l) => l.startsWith('✗'))?.slice(2) ?? `${err ?? ''}`.trim().split('\n').slice(-2).join(' ') ?? e?.message ?? '?').slice(0, 400)}` });
    try {
      const j = JSON.parse(dong.slice(5)) as { primaryTexts: string[]; headlines: string[]; descriptions: string[]; vnd: number };
      ok({ ok: true, chu: { pt: j.primaryTexts ?? [], hl: j.headlines ?? [], de: j.descriptions ?? [], link }, vnd: Number(j.vnd) || 0 });
    } catch (x) { ok({ loi: `đọc chữ K lỗi: ${(x as Error).message}` }); }
  }));
}

export type PhieuGui = { cid: number; kieu: Kieu; chu: { pt: string[]; hl: string[]; de: string[] }; link: string; dang: DangPhieu; mien: string | null;
  roas: string; ns: number; gio: string };   // gio: 'lich' (khung gần nhất) | 'YYYY-MM-DD HH:MM' giờ VN

/** ✓ Gửi phiếu → ghi etp.phieu_len rồi giao máy dựng đúng dạng. Creative dựng xong vào Chờ lên; anh duyệt creative = lên camp với đúng phiếu này. */
export async function guiPhieu(g: PhieuGui): Promise<{ ok: true; id: number; chu: string } | { loi: string }> {
  const me = await laAdmin(); if (!me) return { loi: 'chỉ admin' };
  const cid = Math.trunc(Number(g.cid)); if (!(cid > 0)) return { loi: 'mã phim không hợp lệ' };
  if (g.kieu !== 'kien' && g.kieu !== 'dol') return { loi: 'kiểu chữ phải là K hoặc D' };
  if (g.dang !== 'AD' && g.dang !== 'CC2') return { loi: 'kiểu creative phải là AD hoặc CC2' };
  const pt = (g.chu?.pt ?? []).map(String).filter(Boolean), hl = (g.chu?.hl ?? []).map(String).filter(Boolean), de = (g.chu?.de ?? []).map(String).filter(Boolean);
  if (!pt.length || !hl.length) return { loi: 'chữ QC trống — chọn K (máy sinh) hoặc D trước khi gửi' };
  const link = String(g.link ?? '').trim(); if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(link)) return { loi: `link không hợp lệ: ${link}` };
  const mien = g.mien ? String(g.mien).trim() : null; if (mien && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(mien)) return { loi: `domain không hợp lệ: ${mien}` };
  const roas = String(g.roas); if (!(ROAS_MUC as readonly string[]).includes(roas)) return { loi: `bid ROAS phải là dàn hoặc 0.9–1.2 (nhận ${roas})` };
  const ns = Math.trunc(Number(g.ns)); if (!(ns >= 1 && ns <= 50)) return { loi: 'ngân sách phải từ $1 tới $50' };
  const gio = String(g.gio ?? 'lich').trim().replace('T', ' ').slice(0, 16);
  if (gio !== 'lich' && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(gio)) return { loi: `giờ chạy không hợp lệ: ${g.gio}` };
  const tuDo = gio !== 'lich' && !laKhung(gio);
  const [f] = await run<{ lang: string | null; cam: string | null }>(sql`select coalesce(p.locale, v.locale) lang,
      (select gia_tri -> ${String(cid)} ->> 'ly_do' from xv_khoa_ngoai where ten = 'ethopex_phim_cam' and jsonb_typeof(gia_tri) = 'object' and gia_tri ? ${String(cid)}) cam
    from (select ${cid}::int content_id) k left join etp.phim p using (content_id) left join etp.thu_vien_phim v using (content_id)`);
  if (f?.cam) return { loi: `PHIM CẤM — không dựng: ${f.cam}` };
  const [trung] = await run<{ id: number }>(sql`select id from etp.phieu_len where content_id = ${cid} and dang = ${g.dang} and trang_thai = 'dung' and tao > now() - interval '2 days'`);
  if (trung) return { loi: `phim này đang có phiếu #${trung.id} dạng ${g.dang} chờ máy dựng — chờ bản dựng vào Chờ lên rồi gửi phiếu mới` };
  const chu = JSON.stringify({ pt, hl, de });
  const [p] = await run<{ id: number }>(sql`insert into etp.phieu_len (content_id, lang, kieu, chu, link, dang, mien, roas, ns, gio, tu_do, ai)
    values (${cid}, ${f?.lang ?? null}, ${g.kieu}, ${chu}::jsonb, ${link}, ${g.dang}, ${mien}, ${roas}, ${ns}, ${gio}, ${tuDo}, ${me.email}) returning id`);
  if (!p) return { loi: 'không ghi được phiếu' };
  const k = g.kieu === 'kien' ? 'K' : 'D';
  const loiPhieu = async (l: string) => { await run(sql`update etp.phieu_len set trang_thai = 'loi', loi = ${l.slice(0, 400)}, cap_nhat = now() where id = ${p.id}`); return { loi: l }; };
  if (g.dang === 'AD') {
    const [dang] = await run<{ tt: string }>(sql`select trang_thai tt from etp.mau_dung where mau = ${MAU_AD} and content_id = ${cid} and trang_thai in ('dang', 'cho', 'cho_nang_cap') and (tuy_chon is not null or trang_thai = 'dang')`);
    if (dang) return await loiPhieu(`AD đang dựng cho phim này (${dang.tt === 'dang' ? 'đang làm' : 'đang chờ máy'}) — chờ xong rồi gửi phiếu mới`);
    const r = await run<{ mau: string }>(sql`insert into etp.mau_dung (mau, content_id, buoc, trang_thai, ghi, ten_mau, tuy_chon)
      values (${MAU_AD}, ${cid}, 'cho', 'cho', ${`phiếu lên camp #${p.id} — chờ máy dựng AD (iMac) nhận`}, 'Ảnh động logo gốc + CTA', ${JSON.stringify({ phieu: p.id })}::jsonb)
      on conflict (mau, content_id) do update set buoc = 'cho', trang_thai = 'cho', tuy_chon = excluded.tuy_chon, cap_nhat = now(), ghi = excluded.ghi
      where etp.mau_dung.trang_thai in ('loi', 'cho', 'xong', 'dung') returning mau`);
    if (!r[0]) return await loiPhieu('việc dựng AD của phim đang ở trạng thái không nhận bản mới');
  } else {
    const r = await chayDong(cid, 'CC2', '');
    if ('loi' in r) return await loiPhieu(`dòng CC2: ${r.loi}`);
  }
  const chuGio = gio === 'lich' ? `khung gần nhất (${haiKhung()[0]?.chu ?? ''})` : `${gio}${tuDo ? ' ⚠ ngoài khung' : ''}`;
  return { ok: true, id: p.id, chu: `đã gửi phiếu #${p.id}: ${k} · ${g.dang} · ${link} · ${mien ?? 'domain mặc định'} · ROAS ${roas === 'dan' ? 'dàn' : roas} · $${ns} · ${chuGio} — máy dựng xong creative hiện ở Chờ lên, anh duyệt là lên camp` };
}
