'use server';
// CHỜ ANH DUYỆT (anh 22/11/2026 "Tao cần duyệt trên page này cơ mà !"): creative máy giữ lại (etp.cho_anh_duyet, view etp.cham_cong cột cho_duyet — 0460)
// hiện ở etp2 › Camp. Duyệt = ghi cham_duyet ok (duyetCham — cùng nút Đạt cũ) rồi lên camp $1 bằng đúng đường nút "Lên camp" (lenCampCr → nhan-ban, giờ chạy theo lich_len:
// ngoài 07–12h VN hẹn 07:00). Loại = cham_duyet ok=false. Không tự lên khi chưa bấm — view chặn mọi đường lên camp khác.

import { openSync, readFileSync } from 'node:fs';
import { execFile, spawn } from 'node:child_process';
import { envVe, xinVeTrucTiep } from '@/lib/etp-ve';
import { chuGio, daQua, gioVn } from '@/lib/etp-nb';   // giờ VN dùng chung với nhân bản ★ ROAS bài cũ (etp-tay.ts)
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { duyetCham } from '@/lib/actions/etp-cham';
import { lenCampCr } from '@/lib/actions/etp-dong';
import BANG_LUAT from '@/lib/etp-bang-luat.json';

export type ChoDuyet = {
  creative_id: number; content_id: number | null; phim: string | null; lang: string | null; dang: string | null; video: string | null; anh: string | null;
  ghi: string; tao: string; duyet: boolean | null; diem_thap: string | null; camp_id: number | null; trang_thai: string | null; nhat_ky: string | null;
  /** '1|5' = máy lên ★ ROAS 1 · $5 thay camp $1 (etp.cau_hinh.len_cr_roas, apps/etp/lenh_cho.py — anh 22/11/2026) */ roas: string | null;
};

const run = async <T,>(s: ReturnType<typeof sql>) => (await getDb()!.execute(s)) as unknown as T[];

/** tail nhật ký lên camp của nút (lenCampCr ghi /tmp/etp-len-cr-<cr>.log trên máy chạy web) — để lỗi KÊU TO dưới nút */
function nhatKy(cr: number): string | null {
  try { const t = readFileSync(`/tmp/etp-len-cr-${cr}.log`, 'utf8').trim(); return t ? t.split('\n').slice(-3).join('\n').slice(-400) : null; } catch { return null; }
}

/** creative máy giữ CHƯA duyệt — đã duyệt chưa camp là dòng xếp hàng ở bảng cây camp (etp-doc.ts hangCr) */
export async function dsChoDuyet(): Promise<{ ds: ChoDuyet[]; dungKhan: boolean } | { loi: string }> {
  const me = await getCurrentUser();
  if (me?.role !== 'admin') return { loi: 'chỉ admin' };
  const ds = await run<Omit<ChoDuyet, 'nhat_ky'>>(sql`select h.creative_id, r.content_id, f.ten phim, r.lang, r.dang, r.video, r.anh, h.ghi, h.tao::text tao, u.ok duyet,
      (select string_agg(e.k || ' ' || e.v, ', ' order by e.v::numeric) from etp.cham c, jsonb_each_text(c.diem) e(k, v)
        where c.creative_id = h.creative_id and (e.k like 'meta.%' or e.k like 'afs.%') and e.v::numeric <= 4) diem_thap,
      k.camp_id, k.trang_thai,
      (select (x.gia_tri -> h.creative_id::text ->> 'roas') || '|' || (x.gia_tri -> h.creative_id::text ->> 'ns') from etp.cau_hinh x where x.khoa = 'len_cr_roas') roas
    from etp.cho_anh_duyet_cr h join etp.creative r on r.creative_id = h.creative_id left join etp.phim f on f.content_id = r.content_id
      left join etp.cham_duyet u on u.creative_id = h.creative_id
      left join lateral (select c.camp_id, c.trang_thai from etp.camp c where c.creative_id = h.creative_id order by c.camp_id desc limit 1) k on true
    where u.ok is null   -- ô vàng CHỈ giữ creative chưa duyệt; đã duyệt thì xuống bảng cây camp (etp-doc hangCr — anh 22/11/2026 "duyệt rồi thì phải cho vào table bên dưới")
    order by h.tao, h.creative_id`);
  const [dk] = await run<{ v: boolean }>(sql`select coalesce((select gia_tri = 'true'::jsonb from etp.cau_hinh where khoa = 'dung_khan'), false) v`);
  return { ds: ds.map((x) => ({ ...x, creative_id: Number(x.creative_id), camp_id: x.camp_id == null ? null : Number(x.camp_id), nhat_ky: x.duyet && !x.camp_id ? nhatKy(Number(x.creative_id)) : null })), dungKhan: !!dk?.v };
}

/** ✓ Duyệt → ghi duyệt + lên camp $1; ✕ Loại → ghi loại. Phanh đang bật (dừng khẩn…): duyệt = XẾP HÀNG, máy tự lên camp ở nhịp đầu phanh nhả
 *  (apps/etp/lenh_cho.py len_cr — anh 22/11/2026 "thằng ngu !": không bắt anh bấm lại) */
export async function duyetChoAnh(cr: number, ok: boolean): Promise<{ ok: true; chu: string } | { loi: string }> {
  const id = Math.trunc(Number(cr));
  const [h] = await run<{ x: number }>(sql`select 1 x from etp.cho_anh_duyet_cr where creative_id = ${id}`);
  if (!h) return { loi: `creative #${id} không nằm trong danh sách chờ anh duyệt` };
  const d = await duyetCham(id, ok);
  if ('loi' in d) return d;
  if (!ok) return { ok: true, chu: `đã loại creative #${id} — không lên camp` };
  return lenCamp(id);
}

/** lên camp cho creative đã duyệt (bấm lại sau khi lên hỏng / dừng khẩn) */
export async function lenCamp(cr: number): Promise<{ ok: true; chu: string } | { loi: string }> {
  const id = Math.trunc(Number(cr));
  const [dk] = await run<{ v: boolean }>(sql`select coalesce((select gia_tri = 'true'::jsonb from etp.cau_hinh where khoa = 'dung_khan'), false) v`);
  if (dk?.v) return { ok: true, chu: `đã duyệt #${id} — xếp hàng: máy tự lên camp ở nhịp đầu nhả dừng khẩn, giờ chạy theo lịch` };
  // creative trong sổ ★ ROAS (len_cr_roas): KHÔNG đi đường $1 — lenh_cho.py lên ★ ROAS ở nhịp worker kế (một creative một camp)
  const [ro] = await run<{ x: number }>(sql`select 1 x from etp.cau_hinh where khoa = 'len_cr_roas' and gia_tri ? ${String(id)}`);
  if (ro) return { ok: true, chu: `đã ghi duyệt #${id} — dòng ★ ROAS hiện ở bảng Camp, lọc ⏳ Chờ duyệt: rê xem camp sẽ tạo, anh bấm ▶ Lên mới lên (máy không tự lên — anh 22/11/2026)` };
  const r = await lenCampCr(-1, id);
  if ('loi' in r) return { loi: `Đã ghi DUYỆT #${id}, nhưng chưa lên camp: ${r.loi}` };
  return { ok: true, chu: `đã gửi lệnh lên camp $1 cho creative #${id} — giờ chạy theo lịch (ngoài 07–12h VN hẹn 07:00); dòng này tự hiện số camp khi xong` };
}

// ▶ LÊN NGAY / 🕒 ĐỔI GIỜ (anh 22/11/2026 "nút bấm Lên ngay = Tao ra lệnh sao phải xin mày ?" · "tao có thể điều chỉnh ngày, giờ lên camp") — anh bấm = LỆNH TRỰC TIẾP:
// vé cong.py --ve-truc-tiep (bỏ qua phanh: dừng khẩn, khung giờ, trần…; KHÔNG bỏ phim cấm / camp đội / giới hạn Ethopex). Phanh đang áp → lần bấm đầu trả { canh }
// (cảnh báo MỘT lần), bấm lại trong 30 phút mới lên. Giờ = "YYYY-MM-DD HH:MM" giờ VN, rỗng = chạy ngay.
const KHUON_CR: Record<string, number> = { en: 65110, es: 65734 };   // cùng sổ apps/etp/lenh_cho.py KHUON_CR
const DIR_NB = () => `${process.env.REPO_DIR ?? '/opt/earns-marketing-os-v2'}/apps/xuong-video/scripts/ethopex`;
export type KqNut = { ok: true; chu: string } | { canh: string } | { loi: string };

const ROAS_CR = [0.9, 1.4] as const, NS_CR = BANG_LUAT.hoi_cho.ns_khoang as [number, number];   // ★ ROAS creative mới: mức cùng nhan-ban.py ROAS_MIN/MAX · ngân sách sổ luật hoi_cho.ns_khoang

/** creative ĐÃ DUYỆT, chưa có camp, CÙNG PHIM với camp — nguồn "creative mới" của nhân bản ★ ROAS ở bảng điều khiển camp (Dol 22/11/2026) */
export async function dsCrMoiCamp(campId: number): Promise<{ cr: number; lang: string | null; dang: string | null }[]> {
  const me = await getCurrentUser(); if (me?.role !== 'admin') return [];
  return run<{ cr: number; lang: string | null; dang: string | null }>(sql`select r.creative_id cr, r.lang, r.dang from etp.creative r
      join etp.cham_duyet u on u.creative_id = r.creative_id and u.ok
    where r.content_id = (select content_id from etp.camp where camp_id = ${Math.trunc(Number(campId))})
      and not exists (select 1 from etp.camp c where c.creative_id = r.creative_id) order by r.creative_id desc limit 30`);
}

/** o.khuon = camp ★ đang chạy làm KHUÔN (cùng bộ, cùng phim): ★ ROAS creative mới mức o.roas · $o.ns — từ nút nhân bản ★ ROAS "creative mới" */
type LenhNb = { args: string[]; lenh: string; ro: { roas: number; ns: number } | null; content: number; g: string | null };
/** MỘT chỗ dựng lệnh nhan-ban cho ▶ Lên — nút lên thật (lenNgayCr, thêm --that) và 👁 xem trước (xemTruocLen, thêm --xem-truoc) đi CÙNG lệnh này,
 *  nên cái anh xem trước đúng là cái sẽ gửi Ethopex (anh 22/11/2026 "tao cần xem mọi thứ mày sẽ submit thì mới gọi là review") */
async function lenhNb(cr: number, gio?: string | null, o?: { roas: number; ns: number; khuon: number } | null): Promise<LenhNb | { loi: string }> {
  const id = Math.trunc(Number(cr)), g = gioVn(gio);
  if (gio && !g) return { loi: `giờ không đọc được: "${gio}" — dạng YYYY-MM-DD HH:MM giờ VN` };
  if (g && daQua(g)) return { loi: `giờ ${g} VN đã qua — chọn giờ sau bây giờ` };
  const [x] = await run<{ content_id: number | null; ten: string | null; lang: string | null; ok: boolean | null; co_camp: boolean; bo: string | null; roas: string | null; ns: string | null }>(sql`select r.content_id, f.ten, r.lang, u.ok,
      exists (select 1 from etp.camp c where c.creative_id = r.creative_id) co_camp, (select gia_tri#>>'{}' from etp.cau_hinh where khoa = 'bo_phim_moi') bo,
      (select gia_tri -> ${String(id)} ->> 'roas' from etp.cau_hinh where khoa = 'len_cr_roas') roas, (select gia_tri -> ${String(id)} ->> 'ns' from etp.cau_hinh where khoa = 'len_cr_roas') ns
    from etp.creative r left join etp.phim f using (content_id) left join etp.cham_duyet u on u.creative_id = r.creative_id where r.creative_id = ${id}`);
  if (!x) return { loi: `không thấy creative #${id}` };
  if (!x.ok) return { loi: `creative #${id} chưa duyệt — duyệt trước rồi mới lên` };
  if (x.co_camp) return { loi: `creative #${id} đã có camp` };
  if (!x.content_id || (!o && !x.bo)) return { loi: 'thiếu bộ lên camp (bo_phim_moi) hoặc phim của creative' };
  if (o) {
    if (!(o.roas >= ROAS_CR[0] && o.roas <= ROAS_CR[1])) return { loi: `ROAS goal phải trong ${ROAS_CR[0]}–${ROAS_CR[1]}` };
    if (!(Number.isInteger(o.ns) && o.ns >= NS_CR[0] && o.ns <= NS_CR[1])) return { loi: `ngân sách ★ ROAS creative mới $${NS_CR[0]}–${NS_CR[1]} (sổ luật hoi_cho)` };
    const [k] = await run<{ content_id: number | null }>(sql`select content_id from etp.camp where camp_id = ${Math.trunc(Number(o.khuon))}`);
    if (!k) return { loi: `không thấy camp khuôn #${o.khuon}` };
    if (Number(k.content_id) !== Number(x.content_id)) return { loi: `creative #${id} không cùng phim với camp #${o.khuon}` };
  }
  const lang = x.lang === 'es' ? 'es' : 'en', ro = o ? { roas: o.roas, ns: o.ns } : x.roas && x.ns ? { roas: Number(x.roas), ns: Math.trunc(Number(x.ns)) } : null;
  const lenh = o ? `anh bấm nhân bản ★ ROAS ${o.roas} creative mới #${id} từ camp #${o.khuon} trên etp2 (${chuGio(g)})` : `anh bấm ▶ Lên ngay creative #${id} trên etp2 (${chuGio(g)})`;
  const ten = `duyet ${(x.ten ?? '').replace(/[^A-Za-z0-9 .,:!?#-]/g, '')} ${lang.toUpperCase()} - ${ro ? 'cr moi' : 'creative'} #${id}`;   // spawn không qua shell — chỉ chữ ASCII
  return { lenh, ro, content: Number(x.content_id), g, args: ['nhan-ban.py', String(o ? Math.trunc(Number(o.khuon)) : KHUON_CR[lang]), ...(ro ? ['--roas', String(ro.roas), '--ns', String(ro.ns)] : []), '--tay', ...(o ? [] : ['--bo', String(x.bo)]), '--creative', String(id),   // khuôn ★: không --bo → giữ bộ camp khuôn
    '--content', String(x.content_id), '--ten', ten, ...(g ? ['--gio', g] : [])] };
}

export async function lenNgayCr(cr: number, gio?: string | null, o?: { roas: number; ns: number; khuon: number } | null): Promise<KqNut> {
  const me = await getCurrentUser(); if (me?.role !== 'admin') return { loi: 'chỉ admin được lên camp' };
  const L = await lenhNb(cr, gio, o); if ('loi' in L) return L;
  const id = Math.trunc(Number(cr)), { ro, g, lenh } = L;
  const v = await xinVeTrucTiep('tao_camp', { content: L.content, lenh, ns: ro?.ns ?? 1 });
  if (!('ma' in v)) return v;
  const log = openSync(`/tmp/etp-len-cr-${id}.log`, 'a');
  spawn('python3', [...L.args, '--that', '--luat', lenh, '--ai', `anh (etp2 ${me.email})`], { cwd: DIR_NB(), detached: true, stdio: ['ignore', log, log], env: envVe(v.ma) }).unref();
  return { ok: true, chu: `đã gửi lệnh lên ${ro ? `★ ROAS ${ro.roas} · $${ro.ns}` : 'camp $1'} — ${chuGio(g)}` };
}

export type XemTruoc = { ten: string | null; chay: string | null; canh: string[]; payload: Record<string, unknown> } | { loi: string };
/** 👁 XEM TRƯỚC ▶ Lên: nhan-ban chạy KHÔ (--xem-truoc, cấm đi cùng --that) đúng lệnh của nút → payload THẬT sẽ POST /api/v1/campaigns/facebook + cổng sẽ bỏ qua.
 *  Không tạo gì, không cấp vé; chỉ đọc khuôn + danh sách camp Ethopex. */
export async function xemTruocLen(cr: number, gio?: string | null): Promise<XemTruoc> {
  const me = await getCurrentUser(); if (me?.role !== 'admin') return { loi: 'chỉ admin' };
  const L = await lenhNb(cr, gio); if ('loi' in L) return L;
  const out = await new Promise<string>((ok) => execFile('python3', [...L.args, '--xem-truoc'], { cwd: DIR_NB(), timeout: 240_000, maxBuffer: 8 << 20 },
    (e, so, se) => ok(String(so || '') + (e && !so ? `\n{"loi": ${JSON.stringify(String(se || e.message).trim().split('\n').slice(-3).join(' · ').slice(0, 400))}}` : ''))));
  const t = out.trim().split('\n').reverse().find((l) => l.startsWith('{'));
  if (!t) return { loi: `nhan-ban không trả kết quả: ${out.slice(-300)}` };
  const j = JSON.parse(t) as { loi?: string | null; ten?: string; chay_luc?: string; gio_roas?: string; gio_anh?: string; canh?: string[]; payload?: Record<string, unknown> };
  if (!j.payload) return { loi: j.loi || 'nhan-ban chạy khô không ra payload' };
  return { ten: j.ten ?? null, chay: j.gio_anh ?? j.gio_roas ?? j.chay_luc ?? null, canh: j.canh ?? [], payload: j.payload };
}

/** camp ĐÃ đẩy lên Ethopex, còn chờ giờ chạy: Ethopex không sửa được start_time Ad Set → nhan-ban tạo camp MỚI đúng giờ anh đặt rồi TẠM DỪNG camp cũ (--thay-cho) */
export async function doiGioCamp(campId: number, gio: string): Promise<KqNut> {
  const me = await getCurrentUser(); if (me?.role !== 'admin') return { loi: 'chỉ admin được đổi giờ camp' };
  const id = Math.trunc(Number(campId)), g = gioVn(gio);
  if (!g) return { loi: `giờ không đọc được: "${gio}" — dạng YYYY-MM-DD HH:MM giờ VN` };
  if (daQua(g)) return { loi: `giờ ${g} VN đã qua — chọn giờ sau bây giờ` };
  const [c] = await run<{ la_roas: boolean | null; roas: string | null; ngan_sach: string | null; cho: boolean }>(sql`select c.la_roas, c.roas::text roas, c.ngan_sach::text ngan_sach,
      (c.lich is not null and c.lich > now() and coalesce(c.trang_thai, '') not in ('PAUSED', 'ARCHIVED', 'DELETED')) cho from etp.camp c where c.camp_id = ${id}`);
  if (!c) return { loi: `không thấy camp #${id} trong sổ nhà` };
  if (!c.cho) return { loi: `camp #${id} không còn chờ giờ chạy — đổi giờ chỉ cho camp chưa chạy` };
  const ro = c.la_roas && c.roas ? { roas: Number(c.roas), ns: Math.trunc(Number(c.ngan_sach ?? 0)) } : null;
  const lenh = `anh bấm 🕒 đổi giờ camp #${id} trên etp2 → ${chuGio(g)} (camp mới đúng giờ, tạm dừng #${id})`;
  const v = await xinVeTrucTiep('nhan_ban', { camp: id, lenh, ns: ro?.ns ?? Number(c.ngan_sach ?? 1) });
  if (!('ma' in v)) return v;
  const log = openSync(`/tmp/etp-doi-gio-${id}.log`, 'a');
  spawn('python3', ['nhan-ban.py', String(id), ...(ro ? ['--roas', String(ro.roas), '--ns', String(ro.ns)] : []), '--gio', g, '--thay-cho', String(id), '--that',
    '--luat', lenh, '--ai', `anh (etp2 ${me.email})`], { cwd: DIR_NB(), detached: true, stdio: ['ignore', log, log], env: envVe(v.ma) }).unref();
  return { ok: true, chu: `đã gửi lệnh: camp mới ${chuGio(g)}, xong thì tạm dừng #${id}` };
}

/** tail nhật ký đổi giờ (box3 /tmp/etp-doi-gio-<id>.log) — lỗi KÊU TO dưới nút */
export async function nhatKyDoiGio(campId: number): Promise<string | null> {
  const me = await getCurrentUser(); if (me?.role !== 'admin') return null;
  try { const t = readFileSync(`/tmp/etp-doi-gio-${Math.trunc(Number(campId))}.log`, 'utf8').trim(); return t ? t.split('\n').slice(-3).join('\n').slice(-400) : null; } catch { return null; }
}
