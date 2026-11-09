'use server';
// ĐIỀU KHIỂN CAMP BẰNG TAY trên etp2 (góp ý #1553 anh 09/11/2026: "Cần chức năng tắt/bật camp trong page này, và tăng giảm bậc, cũng như nhân bản camp với các option
// cơ bản hơn!! nhân bản camp roas... Khi hiện các option thì có mô tả cụ thể, hướng dẫn, đề xuất... nhưng vẫn phải ưu tiên edit = tay").
// Không viết đường gọi Ethopex mới: đi đúng hai máy đang chạy cho Nhà — lam-ethopex.py (bật / tắt / tăng / giảm, gác thang · trần · nhịp · cổng etp)
// và nhan-ban.py (nhân bản thường / thang / sang bộ / ROAS). ai = "anh (etp2)" → nhật ký luật ghi đúng người bấm. Chỉ admin mos2 (chủ).
import { execFile, spawn } from 'node:child_process';
import { openSync } from 'node:fs';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';

const DIR = `${process.env.REPO_DIR ?? '/opt/earns-marketing-os-v2'}/apps/xuong-video/scripts/ethopex`;
const AI = 'anh (etp2)';
const laChu = async () => { const me = await getCurrentUser(); const q = await quyenEtp(me); return !!me && q?.vai === 'chu'; };
const chay = (args: string[], ms: number) => new Promise<string>((ok) =>
  execFile('python3', args, { cwd: DIR, timeout: ms, env: process.env, maxBuffer: 8 << 20 }, (e, out, er) => ok(String(out ?? '') + (e && !out ? String(er || e.message) : ''))));
const dongJson = <T,>(ra: string): T | null => { const d = ra.trim().split('\n').reverse().find((l) => l.startsWith('{')); try { return d ? (JSON.parse(d) as T) : null; } catch { return null; } };

export type KetTay = { ok: true; chu: string } | { loi: string };

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
  const ra = await chay(['nhan-ban.py', String(campId), '--tay', ...t], 120_000);
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
  spawn('python3', ['nhan-ban.py', String(campId), '--tay', ...t, '--that', '--luat', `tay etp2: nhân bản ${x.kieu}${ghi ? ` · ${ghi.slice(0, 120)}` : ''}`, '--ai', AI],
    { cwd: DIR, detached: true, stdio: ['ignore', log, log], env: process.env }).unref();
  return { ok: true, chu: 'đã gửi máy nhân bản — camp mới hiện sau lượt đồng bộ kế (kết quả ghi nhật ký luật)' };
}
