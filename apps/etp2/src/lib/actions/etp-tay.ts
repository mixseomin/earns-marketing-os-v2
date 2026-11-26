'use server';
// ĐIỀU KHIỂN CAMP BẰNG TAY trên etp2 (góp ý #1553 anh 09/11/2026: "Cần chức năng tắt/bật camp trong page này, và tăng giảm bậc, cũng như nhân bản camp với các option
// cơ bản hơn!! nhân bản camp roas... Khi hiện các option thì có mô tả cụ thể, hướng dẫn, đề xuất... nhưng vẫn phải ưu tiên edit = tay").
// Không viết đường gọi Ethopex mới: đi đúng hai máy đang chạy cho Nhà — lam-ethopex.py (bật / tắt / tăng / giảm, gác thang · trần · nhịp · cổng etp)
// và nhan-ban.py (nhân bản thường / thang / sang bộ / ROAS). ai = "anh (etp2)" → nhật ký luật ghi đúng người bấm. Chỉ admin mos2 (chủ).
import { boLuotDoc } from '@/lib/etp-du-kho';
import { execFile } from 'node:child_process';
import { chayTach } from '@/lib/etp-chay-tach';
import { openSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';
import BANG_LUAT from '@/lib/etp-bang-luat.json';
import { envVe, xinVeTay, xinVeTrucTiep } from '@/lib/etp-ve';
import { NS_ROAS_KHOANG, NS_TAY_KHOANG, ROAS_KHOANG, chayLuc, chuGio, daQua, gioVn } from '@/lib/etp-nb';   // chayLuc: lúc camp thực sự chạy (anh 10/11/2026) — một chỗ ở etp-nb, nút "⏱ Lên theo lịch" đọc cùng

const DIR = `${process.env.REPO_DIR ?? '/opt/earns-marketing-os-v2'}/apps/xuong-video/scripts/ethopex`;
const AI = 'anh (etp2)';
const laChu = async () => { const me = await getCurrentUser(); const q = await quyenEtp(me); return !!me && q?.vai === 'chu'; };
// ve: vé thao tác tay (anh 18/11/2026) — nút anh bấm xin vé ngay lúc bấm, máy chỉ miễn phanh chợ khi lệnh mang vé (apps/etp/cong.py ve_hop_le)
const chay = (args: string[], ms: number, ve: string | null = null) => new Promise<string>((ok) =>
  execFile('python3', args, { cwd: DIR, timeout: ms, env: envVe(ve), maxBuffer: 8 << 20 }, (e, out, er) => ok(String(out ?? '') + (e && !out ? String(er || e.message) : ''))));
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
  // ANH BẤM TĂNG / BẬT = LỆNH TRỰC TIẾP (anh 25/11/2026 bấm "↑ Tăng lên $2" bị khoá mùa lễ trả về): vé cong.py --ve-truc-tiep --ngay như ▶ Lên — miễn MỌI phanh
  // (mùa lễ, phanh chợ, nhịp tăng, khoá sau giảm, nắp ROI 3 ngày…), chỉ còn phim cấm / camp đội / giới hạn Ethopex; phanh bị bỏ qua thì Telegram ⚡ báo. Giảm / tắt không cần vé.
  let ve: string | null = null;
  if (lenh[0] === 'tang' || lenh[0] === 'bat') {
    const v = await xinVeTrucTiep(lenh[0] as 'tang' | 'bat', { camp: campId, lenh: `anh bấm etp2: ${luat}`, ns: viec === 'ns' ? o.ns : null });
    if ('loi' in v) return { loi: v.loi };
    if ('canh' in v) return { loi: `⚠ ${v.canh}` };   // --ngay không trả canh; phòng khi cong.py đổi
    ve = v.ma;
  }
  const ra = await chay(['lam-ethopex.py', ...lenh, '--luat', luat, '--ai', AI, ...(o.ep ? ['--ep', '--bo-nhip'] : [])], 170_000, ve);
  const k = dongJson<{ ok?: boolean; loi?: string | null; truoc?: { ns: unknown; tt: unknown }; sau?: { ns: unknown; tt: unknown }; lich?: string }>(ra);
  if (!k) return { loi: `máy không trả kết quả: ${ra.trim().slice(-200) || '(trống)'}` };
  if (!k.ok) return { loi: k.loi || 'không làm được' };
  if (!k.lich) await ghiCho({ camp_id: campId, viec, sau: viec === 'ns' ? o.ns! : null, chu: viec === 'ns' ? `$${o.nsDang} → $${o.ns}` : viec === 'tat' ? 'tắt' : 'bật' });
  boLuotDoc();   // lam-ethopex.py đã ghi etp.nhat_ky — lần làm mới kế đọc sổ mới
  return { ok: true, chu: k.lich ?? (viec === 'ns' ? `$${k.truoc?.ns ?? '?'} → $${k.sau?.ns ?? '?'}` : `${k.truoc?.tt ?? '?'} → ${k.sau?.tt ?? '?'}`) };
}

/** ns của không bid / sang bộ: anh chỉnh $1–20 (22/11/2026); bỏ trống = máy đặt ($10 bài cũ NB · $1 bài mới) */
export type KieuNb = { kieu: 'thuong'; ns?: number } | { kieu: 'thang'; ns: number } | { kieu: 'bo'; bo: string; ns?: number } | { kieu: 'roas'; roas: number; ns: number; tamDung: boolean; /** nhiều mức bài cũ một lần bấm (Dol 22/11/2026: cặp 0.9 + 1.1 · bộ ba 0.9 + 1 + 1.1) — mỗi mức một camp */ cap?: number[];
  /** giờ chạy: bỏ trống = lịch lên camp quyết · 'ngay' · 'YYYY-MM-DD HH:MM' VN — hai cái sau là lệnh trực tiếp (vé cong.py --ve-truc-tiep) */ gio?: string | null };
/** các mức ROAS của một lần bấm — mỗi mức một camp */
const mucRoas = (x: Extract<KieuNb, { kieu: 'roas' }>) => (x.cap?.length ? x.cap : [x.roas]);
const thamNb = (x: KieuNb): string[] | string => {
  if ((x.kieu === 'thuong' || x.kieu === 'bo') && x.ns != null && !(Number.isInteger(x.ns) && x.ns >= NS_TAY_KHOANG[0] && x.ns <= NS_TAY_KHOANG[1])) return `ngân sách $${NS_TAY_KHOANG[0]}–${NS_TAY_KHOANG[1]}`;
  const nsTay = (x.kieu === 'thuong' || x.kieu === 'bo') && x.ns != null ? ['--ns', String(x.ns)] : [];
  if (x.kieu === 'thuong') return nsTay;
  if (x.kieu === 'thang') return Number.isInteger(x.ns) && x.ns > 1 ? ['--thang', String(x.ns)] : 'mức thang không hợp lệ';
  if (x.kieu === 'bo') return /^[A-Za-z0-9_ -]{1,20}$/.test(x.bo) ? ['--bo', x.bo, '--ep', ...nsTay] : 'bộ không hợp lệ';
  const muc = mucRoas(x);
  if (muc.length > 3 || new Set(muc).size !== muc.length || muc.some((r) => !(r >= ROAS_KHOANG[0] && r <= ROAS_KHOANG[1]))) return `ROAS goal phải trong ${ROAS_KHOANG[0]}–${ROAS_KHOANG[1]}, tối đa 3 mức khác nhau`;
  if (!(Number.isInteger(x.ns) && x.ns >= NS_ROAS_KHOANG[0] && x.ns <= NS_ROAS_KHOANG[1])) return `ngân sách camp ROAS $${NS_ROAS_KHOANG[0]}–${NS_ROAS_KHOANG[1]}`;
  if (x.gio && x.gio !== 'ngay') { const g = gioVn(x.gio); if (!g) return 'giờ chạy sai dạng'; if (daQua(g)) return `giờ ${g} VN đã qua — chọn giờ sau bây giờ`; }
  return ['--ns', String(x.ns), ...(x.tamDung ? ['--tam-dung'] : [])];   // mức ROAS gắn ở từng lượt (nhanBanTay)
};

/** NHÂN BẢN THẬT: chạy nền (tạo + đọc lại có thể vài phút), kết quả vào nhật ký luật + log /tmp/etp2-nb-<camp>.log */
export async function nhanBanTay(campId: number, x: KieuNb, ghi?: string): Promise<KetTay> {
  if (!(await laChu())) return { loi: 'chỉ admin mos2 điều khiển camp' };
  if (!Number.isInteger(campId) || campId <= 0) return { loi: 'camp không hợp lệ' };
  const t = thamNb(x); if (typeof t === 'string') return { loi: t };
  const log = openSync(`/tmp/etp2-nb-${campId}.log`, 'a');
  if (x.kieu === 'roas') {   // ★ ROAS bài cũ — một hay nhiều mức (cặp 0.9 + 1.1 · bộ ba 0.9 + 1 + 1.1, Dol 22/11/2026): các lượt NỐI TIẾP, mỗi lượt một vé
    const muc = mucRoas(x), g = x.gio && x.gio !== 'ngay' ? gioVn(x.gio) : null, truc = x.gio != null;
    const chuChay = g ? chuGio(g) : truc ? 'chạy ngay' : chayLuc();
    const ves: string[] = [];
    for (const r of muc) {
      // MỌI lượt anh bấm (theo lịch / chạy ngay / đặt giờ) = LỆNH TRỰC TIẾP (anh 25/11/2026 "fix tất cả nút thủ công"): vé cong.py --ve-truc-tiep --ngay miễn mọi phanh; giờ vẫn theo khung cố định gio_len
      const v = await xinVeTrucTiep('nhan_ban', { camp: campId, lenh: `anh bấm etp2: nhân bản ★ ROAS ${r} bài cũ của #${campId} · $${x.ns} · ${truc ? chuGio(g) : chuChay}${ghi ? ` · ${ghi.slice(0, 120)}` : ''}`, ns: x.ns });
      if ('canh' in v) return { loi: `⚠ Phanh đang áp: ${v.canh} — bấm Tạo camp lại trong 30 phút là máy bỏ qua phanh và lên` };
      if ('loi' in v) return { loi: v.loi };
      ves.push(v.ma);
    }
    const ten = muc.map(String).join(' + ');
    const chung = ['nhan-ban.py', String(campId), '--tay', '--anh', ...t, '--that', '--luat', `tay etp2: nhân bản ★ ROAS ${ten} — ANH CHỊU TRÁCH NHIỆM, máy không chặn${ghi ? ` · ${ghi.slice(0, 120)}` : ''}`, '--ai', AI];
    chayTach('sh', ['-c', muc.map((r, i) => `ETP_VE="$V${i}" python3 "$@" --roas ${r.toFixed(2)}${g ? ' --gio "$G"' : ''}`).join('; '), 'sh', ...chung],
      { cwd: DIR, detached: true, stdio: ['ignore', log, log], env: { ...envVe(null), G: g ?? '', ...Object.fromEntries(ves.map((v, i) => [`V${i}`, v])) } }).unref();
    await ghiCho({ camp_id: campId, viec: 'nb', sau: null, chu: `nhân bản ★ ROAS ${ten} · $${x.ns}${muc.length > 1 ? ' mỗi camp' : ''} · ${chuChay}` });
    return { ok: true, chu: `đã gửi máy ${muc.length > 1 ? `${muc.length} camp ★ ROAS ${muc.join(' / ')} (chạy nối tiếp)` : `camp ★ ROAS ${muc[0]}`} · $${x.ns}${muc.length > 1 ? ' mỗi camp' : ''} · bài cũ của #${campId} · camp mới ${chuChay} · camp hiện ngay trong bảng Camp (🚀 đang lên) · kết quả ghi nhật ký luật` };
  }
  // anh bấm nhân bản = LỆNH TRỰC TIẾP (anh 25/11/2026 "fix tất cả nút thủ công" — trước vé 'tay' không miễn mùa lễ / nắp ROI / trần ngày)
  const vt = await xinVeTrucTiep('nhan_ban', { camp: campId, lenh: `anh bấm etp2: nhân bản ${x.kieu} #${campId}${x.ns != null ? ` · $${x.ns}` : ''}${ghi ? ` · ${ghi.slice(0, 120)}` : ''}`, ns: x.ns ?? null });
  if ('loi' in vt) return { loi: vt.loi };
  if ('canh' in vt) return { loi: `⚠ ${vt.canh}` };
  const ve = vt.ma;
  chayTach('python3', ['nhan-ban.py', String(campId), '--tay', '--anh', ...t, '--that', '--luat', `tay etp2: nhân bản ${x.kieu} — ANH CHỊU TRÁCH NHIỆM, máy không chặn${ghi ? ` · ${ghi.slice(0, 120)}` : ''}`, '--ai', AI],
    { cwd: DIR, detached: true, stdio: ['ignore', log, log], env: envVe(ve) }).unref();
  await ghiCho({ camp_id: campId, viec: 'nb', sau: null, chu: `nhân bản ${x.kieu === 'thuong' ? 'thường' : x.kieu === 'thang' ? `thang $${x.ns}` : `sang bộ ${x.bo}`}${x.kieu !== 'thang' && x.ns != null ? ` · $${x.ns}` : ''}` });
  return { ok: true, chu: `đã gửi máy nhân bản (anh chịu trách nhiệm — máy không chặn bằng luật, chỉ dừng khẩn) · camp mới ${chayLuc()} · camp hiện ngay trong bảng Camp khi Ethopex trả mã (~10–40 giây): 🚀 đang lên → chờ giờ / chạy, kết quả ghi nhật ký luật` };
}
