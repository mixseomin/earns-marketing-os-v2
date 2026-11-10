'use server';
// ĐIỀU KHIỂN CAMP BẰNG TAY trên etp2 (góp ý #1553 anh 09/11/2026: "Cần chức năng tắt/bật camp trong page này, và tăng giảm bậc, cũng như nhân bản camp với các option
// cơ bản hơn!! nhân bản camp roas... Khi hiện các option thì có mô tả cụ thể, hướng dẫn, đề xuất... nhưng vẫn phải ưu tiên edit = tay").
// Không viết đường gọi Ethopex mới: đi đúng hai máy đang chạy cho Nhà — lam-ethopex.py (bật / tắt / tăng / giảm, gác thang · trần · nhịp · cổng etp)
// và nhan-ban.py (nhân bản thường / thang / sang bộ / ROAS). ai = "anh (etp2)" → nhật ký luật ghi đúng người bấm. Chỉ admin mos2 (chủ).
import { execFile, spawn } from 'node:child_process';
import { openSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';
import BANG_LUAT from '@/lib/etp-bang-luat.json';
/** LÚC CAMP NHÂN BẢN THỰC SỰ CHẠY (anh 10/11/2026 "khi nhân bản phải ghi rõ ngày, giờ sẽ thực sự active") — cùng luật nhan-ban.lich_len / chay_luc: trong khung lên → chạy ngay khi đồng bộ xong; ngoài khung → 07:00 VN */
function chayLuc(now = Date.now()): string {
  const [a, b] = BANG_LUAT.khung_doi.len as [number, number], vn = new Date(now + 7 * 36e5), h = vn.getUTCHours();
  const hh = (d: Date) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  if (a <= h && h < b) return `chạy ngay khi Ethopex / Meta đồng bộ xong (~2–20 phút, từ ${hh(vn)} giờ VN)`;
  const mai = new Date(vn.getTime() + (h >= a ? 864e5 : 0));
  return `hẹn chạy 07:00 ${String(mai.getUTCDate()).padStart(2, '0')}/${String(mai.getUTCMonth() + 1).padStart(2, '0')} giờ VN (ngoài khung lên ${a}–${b}h)`;
}

const DIR = `${process.env.REPO_DIR ?? '/opt/earns-marketing-os-v2'}/apps/xuong-video/scripts/ethopex`;
const AI = 'anh (etp2)';
const laChu = async () => { const me = await getCurrentUser(); const q = await quyenEtp(me); return !!me && q?.vai === 'chu'; };
const chay = (args: string[], ms: number) => new Promise<string>((ok) =>
  execFile('python3', args, { cwd: DIR, timeout: ms, env: process.env, maxBuffer: 8 << 20 }, (e, out, er) => ok(String(out ?? '') + (e && !out ? String(er || e.message) : ''))));
const dongJson = <T,>(ra: string): T | null => { const d = ra.trim().split('\n').reverse().find((l) => l.startsWith('{')); try { return d ? (JSON.parse(d) as T) : null; } catch { return null; } };

export type KetTay = { ok: true; chu: string } | { loi: string };

// SỔ LỆNH CHỜ ÁP (anh 09/11/2026: "khi thay đổi mà chưa áp dụng ngay thì phải show lại vết để còn biết đang làm mà chờ"): lệnh tay đã gửi Ethopex xong
// nhưng kho etp.camp (và cả nhật ký luật) chỉ đổi ở lượt đồng bộ kế (~10 phút) → ghi NGAY vào xv_khoa_ngoai['etp2_cho_ap'] (giữ 2 giờ),
// trang hiện ⏳ trên dòng camp + trong bảng điều khiển cho tới khi kho khớp (khopKho ở etp-view).
export type ChoAp = { camp_id: number; viec: 'ns' | 'tat' | 'bat' | 'nb'; sau: number | null; chu: string; luc: string };
async function ghiCho(x: Omit<ChoAp, 'luc'>) {
  const dong = JSON.stringify([{ ...x, luc: new Date().toISOString() }]);
  await getDb()!.execute(sql`insert into xv_khoa_ngoai (ten, gia_tri) values ('etp2_cho_ap', ${dong}::jsonb)
    on conflict (ten) do update set cap_nhat = now(), gia_tri = coalesce((select jsonb_agg(e) from jsonb_array_elements(
      case when jsonb_typeof(xv_khoa_ngoai.gia_tri) = 'array' then xv_khoa_ngoai.gia_tri else '[]'::jsonb end || excluded.gia_tri) e
      where (e->>'luc')::timestamptz > now() - interval '2 hours'), '[]'::jsonb)`).catch(() => {});
}
/** sổ lệnh chờ áp (2 giờ gần nhất) — trang etp2 đọc mỗi lần dựng */
export async function docChoAp(): Promise<ChoAp[]> {
  if (!(await laChu())) return [];
  const r = ((await getDb()!.execute(sql`select gia_tri from xv_khoa_ngoai where ten = 'etp2_cho_ap'`)) as unknown as { gia_tri: unknown }[])[0]?.gia_tri;
  return Array.isArray(r) ? (r as ChoAp[]).filter((x) => Date.now() - Date.parse(x.luc) < 2 * 3600_000) : [];
}

/** bật · tắt · đổi ngân sách (tự chọn tăng / giảm theo mức đang chạy). ep = anh ép: bỏ chặn "camp đang lãi" khi tắt, chặn "vừa giảm" + nhịp tăng khi tăng */
export async function campTay(campId: number, viec: 'bat' | 'tat' | 'ns', o: { ns?: number; nsDang?: number; ep?: boolean; ghi?: string } = {}): Promise<KetTay> {
  if (!(await laChu())) return { loi: 'chỉ admin mos2 điều khiển camp' };
  if (!Number.isInteger(campId) || campId <= 0) return { loi: 'camp không hợp lệ' };
  let lenh: string[];
  if (viec === 'ns') {
    if (!Number.isInteger(o.ns) || !Number.isFinite(o.nsDang)) return { loi: 'thiếu mức ngân sách' };
    if (o.ns === o.nsDang) return { loi: `camp đang $${o.nsDang} rồi` };
    lenh = [o.ns! > o.nsDang! ? 'tang' : 'giam', String(campId), String(o.ns)];
  } else lenh = [viec, String(campId)];
  const luat = `tay etp2: ${viec === 'ns' ? `$${o.nsDang} → $${o.ns}` : viec === 'tat' ? 'tắt' : 'bật'}${o.ghi ? ` · ${o.ghi.slice(0, 120)}` : ''}${o.ep ? ' · ép' : ''}`;
  const ra = await chay(['lam-ethopex.py', ...lenh, '--luat', luat, '--ai', AI, ...(o.ep ? ['--ep', '--bo-nhip'] : [])], 170_000);
  const k = dongJson<{ ok?: boolean; loi?: string | null; truoc?: { ns: unknown; tt: unknown }; sau?: { ns: unknown; tt: unknown }; lich?: string }>(ra);
  if (!k) return { loi: `máy không trả kết quả: ${ra.trim().slice(-200) || '(trống)'}` };
  if (!k.ok) return { loi: k.loi || 'không làm được' };
  if (!k.lich) await ghiCho({ camp_id: campId, viec, sau: viec === 'ns' ? o.ns! : null, chu: viec === 'ns' ? `$${o.nsDang} → $${o.ns}` : viec === 'tat' ? 'tắt' : 'bật' });
  return { ok: true, chu: k.lich ?? (viec === 'ns' ? `$${k.truoc?.ns ?? '?'} → $${k.sau?.ns ?? '?'}` : `${k.truoc?.tt ?? '?'} → ${k.sau?.tt ?? '?'}`) };
}

export type KieuNb = { kieu: 'thuong' } | { kieu: 'thang'; ns: number } | { kieu: 'bo'; bo: string } | { kieu: 'roas'; roas: number; ns: number; tamDung: boolean };
const thamNb = (x: KieuNb): string[] | string => {
  if (x.kieu === 'thuong') return [];
  if (x.kieu === 'thang') return Number.isInteger(x.ns) && x.ns > 1 ? ['--thang', String(x.ns)] : 'mức thang không hợp lệ';
  if (x.kieu === 'bo') return /^[A-Za-z0-9_ -]{1,20}$/.test(x.bo) ? ['--bo', x.bo, '--ep'] : 'bộ không hợp lệ';
  if (!(x.roas >= 1 && x.roas <= 1.4)) return 'ROAS goal phải trong 1.0–1.4';
  if (!(x.ns >= 15 && x.ns <= 20)) return 'ngân sách camp ROAS $15–20';
  return ['--roas', x.roas.toFixed(2), '--ns', String(x.ns), ...(x.tamDung ? ['--tam-dung'] : [])];
};

/** XEM TRƯỚC nhân bản: chạy khô (không --that) — máy in payload / lý do chặn, không tạo gì */
export async function xemNhanBan(campId: number, x: KieuNb): Promise<{ ok: true; chu: string } | { loi: string }> {
  if (!(await laChu())) return { loi: 'chỉ admin mos2 điều khiển camp' };
  const t = thamNb(x); if (typeof t === 'string') return { loi: t };
  const ra = await chay(['nhan-ban.py', String(campId), '--tay', '--anh', ...t], 120_000);   // --anh: anh bấm tay — máy không chặn bằng luật mềm (10/11/2026)
  const k = dongJson<{ ok?: boolean; loi?: string | null; ten?: string }>(ra);
  if (k && (k.ok === false || k.loi)) return { loi: k.loi || 'máy chặn' };   // chạy khô bị chặn: ok null + loi (vd ĐANG DỪNG LÊN CAMP MỚI)
  return { ok: true, chu: ra.trim().slice(-3000) || '(máy không in gì)' };
}

/** NHÂN BẢN THẬT: chạy nền (tạo + đọc lại có thể vài phút), kết quả vào nhật ký luật + log /tmp/etp2-nb-<camp>.log */
export async function nhanBanTay(campId: number, x: KieuNb, ghi?: string): Promise<KetTay> {
  if (!(await laChu())) return { loi: 'chỉ admin mos2 điều khiển camp' };
  if (!Number.isInteger(campId) || campId <= 0) return { loi: 'camp không hợp lệ' };
  const t = thamNb(x); if (typeof t === 'string') return { loi: t };
  const log = openSync(`/tmp/etp2-nb-${campId}.log`, 'a');
  spawn('python3', ['nhan-ban.py', String(campId), '--tay', '--anh', ...t, '--that', '--luat', `tay etp2: nhân bản ${x.kieu} — ANH CHỊU TRÁCH NHIỆM, máy không chặn${ghi ? ` · ${ghi.slice(0, 120)}` : ''}`, '--ai', AI],
    { cwd: DIR, detached: true, stdio: ['ignore', log, log], env: process.env }).unref();
  await ghiCho({ camp_id: campId, viec: 'nb', sau: null, chu: `nhân bản ${x.kieu === 'thuong' ? 'thường' : x.kieu === 'thang' ? `thang $${x.ns}` : x.kieu === 'bo' ? `sang bộ ${x.bo}` : `ROAS ${x.roas}`}` });
  return { ok: true, chu: `đã gửi máy nhân bản (anh chịu trách nhiệm — máy không chặn bằng luật, chỉ dừng khẩn) · camp mới ${chayLuc()} · camp hiện sau lượt đồng bộ kế, kết quả ghi nhật ký luật` };
}
