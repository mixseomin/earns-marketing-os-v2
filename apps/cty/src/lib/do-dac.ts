// Đồ đạc cơ bản của một phòng — đọc từ dữ liệu thật, không chép: bảng công việc (sổ tiến độ + plays của dự án phòng cầm,
// hoặc nhật ký lượt với Phòng thử), tủ tài liệu (hồ sơ, luật, kỹ năng, sơ đồ + ai đã đọc theo sổ sự kiện), hòm tin (tin trao tay
// trong sổ sự kiện), sổ chi (ai_usage tháng này của người trong phòng), gói số (data: trong SOUL). Thiếu DB → ô báo "không nối DB".
import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import type { Doc } from './cong-ty';
import { docLog } from '../../worker/log.mjs';
import { tienUsd } from '../../worker/gia.mjs';
import { dsLuot } from './thu-nghiem';

type Row = Record<string, unknown>;
// Mảng JS trong sql`` bị drizzle bung thành ($1, $2) → `= ANY(($1,$2))` hỏng cú pháp; phải dựng ARRAY[...] tường minh.
const arr = (xs: string[]) => sql`ARRAY[${sql.join(xs.map((x) => sql`${x}`), sql`, `)}]::text[]`;
// null = không đọc được (không DB hoặc truy vấn lỗi). Lỗi ghi ra journal của mos2-cty, không nuốt im.
const q = async (s: ReturnType<typeof sql>): Promise<Row[] | null> => { const db = getDb(); if (!db) return null; try { return (await db.execute(s)) as unknown as Row[]; } catch (e) { console.error('do-dac:', (e as Error).message); return null; } };

export async function bangCongViec(p: Doc) {
  const duAn = Array.isArray(p.fm.du_an) ? (p.fm.du_an as string[]) : [];
  if (String(p.fm.thu_nghiem) === 'true') {
    const luot = await dsLuot();
    return { loai: 'thu-nghiem' as const, luot: luot.slice(0, 5).map((l) => ({ ts: l.ts, bat_dau: l.bat_dau, viec: l.viec, trang_thai: l.trang_thai, viec_trang_thai: l.ket?.trang_thai_viec ?? '' })), tong: luot.length };
  }
  if (!duAn.length) return { loai: 'khong' as const };
  const hm = await q(sql`SELECT project_id, trang_thai, count(*)::int AS n FROM tien_do_hang_muc WHERE project_id = ANY(${arr(duAn)}) GROUP BY 1, 2`);
  const buoc = await q(sql`SELECT h.project_id, h.ma, b.thu_tu, b.buoc, b.trang_thai, b.ghi_chu FROM tien_do_buoc b JOIN tien_do_hang_muc h ON h.id = b.hang_muc_id WHERE h.project_id = ANY(${arr(duAn)}) AND b.trang_thai IN ('Đang', 'Kẹt') ORDER BY b.trang_thai, b.updated_at DESC LIMIT 8`);
  // mọi loại card của dự án (backlink, followup, góp ý…) — trước chỉ đếm backlink nên card followup của puzzle-books (#1105, #1107) không hiện
  const plays = await q(sql`SELECT project_id, status, count(*)::int AS n FROM human_tasks WHERE project_id = ANY(${arr(duAn)}) GROUP BY 1, 2`);
  return { loai: 'du-an' as const, duAn, hm, buoc, plays };
}

const dsFm = (p: Doc, k: string) => (Array.isArray(p.fm[k]) ? (p.fm[k] as string[]) : []);
const DONG = ['completed', 'done', 'verified', 'dropped', 'rejected', 'cancelled'];   // card đã khép (Done là chữ ký của anh; dropped/rejected = bỏ)
/** Card plays còn mở của phòng: mọi card của dự án phòng cầm (du_an) + card của dự án liên quan (the_lien_quan) chỉ khi tựa card nhắc
 *  một nền của sổ phòng (so_san_pham: KDP, Etsy…) — mint-almanac có card KDP của bộ sách coin lẫn 20 card backlink của site, chỉ lấy phần sách. */
export async function theViecMo(p: Doc, gioiHan?: number) {
  const duAn = dsFm(p, 'du_an'), lq = dsFm(p, 'the_lien_quan'); const nen = [...new Set(dsFm(p, 'so_san_pham').map((x) => x.split(':')[0]!))];
  if (!duAn.length && !lq.length) return { tong: 0, ds: [] };
  const nhac = nen.length ? sql.join(nen.map((n) => sql`title ~* ${`\\m${n}\\M`}`), sql` OR `) : sql`false`;
  // tong = count(*) over() cùng một truy vấn: phòng cầm nhiều dự án (Marketing 8 dự án) có hàng trăm card — chỉ kéo về `gioiHan` dòng đầu
  const rows = (await q(sql`SELECT id, project_id, status, platform_key, sla_due_at::date::text AS han, title, count(*) OVER ()::int AS tong FROM human_tasks
    WHERE status <> ALL(${arr(DONG)}) AND (project_id = ANY(${arr(duAn)}) OR (project_id = ANY(${arr(lq)}) AND (${nhac}))) ORDER BY sla_due_at NULLS LAST, id
    ${gioiHan ? sql`LIMIT ${gioiHan}` : sql``}`)) as { id: number; project_id: string; status: string; platform_key: string | null; han: string | null; title: string; tong: number }[] | null;
  return rows && { tong: rows[0]?.tong ?? 0, ds: rows };
}
/** Một card (ngăn `the:<id>`) — đủ để đọc trong cty; sửa / duyệt vẫn ở MOS2. undefined = không đọc được DB, null = không có card. */
export async function theMot(id: number) {
  const r = await q(sql`SELECT id, project_id, status, platform_key, title, instructions, notes, prep_payload, publish_url, sla_due_at::date::text AS han,
    to_json(created_at)#>>'{}' AS tao, to_json(updated_at)#>>'{}' AS sua FROM human_tasks WHERE id = ${id}`);
  return r === null ? undefined : ((r[0] ?? null) as { id: number; project_id: string; status: string; platform_key: string | null; title: string; instructions: string | null; notes: string | null;
    prep_payload: { draft?: string; source_url?: string; site_url?: Record<string, string>; site_status?: Record<string, string> } | null; publish_url: string | null; han: string | null; tao: string; sua: string } | null);
}
/** Kênh kéo khách theo cuốn (bảng kenh_sp — puzzle-books/scripts/kenh.mjs ghi, MOS2 Tài sản đọc cùng bảng). */
export async function kenhKeoKhach(p: Doc) {
  const duAn = dsFm(p, 'du_an'); if (!duAn.length) return [];
  return (await q(sql`SELECT san_pham, kenh, ten, xong, tong, canh_bao, the_id, cap_nhat::text AS cap_nhat FROM kenh_sp WHERE project = ANY(${arr(duAn)}) ORDER BY ten, kenh`)) as
    { san_pham: string; kenh: string; ten: string; xong: number | null; tong: number | null; canh_bao: string | null; the_id: number | null; cap_nhat: string }[] | null;
}
/** Tài khoản phòng dùng (vault MOS2 platform_accounts): gắn dự án phòng cầm + id khai thêm (tai_khoan_them — vault chưa gắn dự án).
 *  CHỈ cột không bí mật — không đọc mật khẩu / token / cookie. */
export async function taiKhoanPhong(p: Doc) {
  const duAn = dsFm(p, 'du_an'); const them = dsFm(p, 'tai_khoan_them').map(Number).filter(Number.isFinite);
  if (!duAn.length && !them.length) return [];
  return (await q(sql`SELECT id, project_id, platform_key, handle, status, account_type, block_reason, last_used_at::date::text AS dung FROM platform_accounts
    WHERE project_id = ANY(${arr(duAn)}) OR id = ANY(ARRAY[${sql.join((them.length ? them : [-1]).map((x) => sql`${x}`), sql`, `)}]::int[]) ORDER BY platform_key, id`)) as
    { id: number; project_id: string | null; platform_key: string; handle: string; status: string; account_type: string | null; block_reason: string | null; dung: string | null }[] | null;
}

export function tuTaiLieu(p: Doc, ns: Doc[]) {
  const ids = ns.map((d) => d.id);
  const daDoc = docLog({ loai: 'doc', n: 2000 }).filter((e) => ids.includes(String(e.tu)));
  const dem = (tep: string) => daDoc.filter((e) => String((e.chi_tiet as Record<string, unknown> | undefined)?.tep ?? '') === tep).length;
  const skills = [...new Set(ns.flatMap((d) => (Array.isArray(d.fm.skills) ? (d.fm.skills as string[]) : [])))];
  return {
    chung: [{ tep: 'AGENTS.md', ten: 'Luật chung', href: '/luat', lan_doc: dem('AGENTS.md') }, { tep: 'muc-tieu.md', ten: 'Mục tiêu · ngân sách', href: '/muc-tieu', lan_doc: dem('muc-tieu.md') }],
    hoSo: ns.map((d) => ({ tep: `nhan-su/${d.id}/SOUL.md`, ten: `SOUL · ${String(d.fm.ten)}`, href: `/nhan-su/${d.id}`, lan_doc: dem(`nhan-su/${d.id}/SOUL.md`) })),
    skills, soDo: p.fm.so_do ? `so-do/${String(p.fm.so_do)}.svg` : 'máy vẽ theo khuôn',
  };
}

export function homTin(ns: Doc[], n = 8) {
  const ids = ns.map((d) => d.id);
  return docLog({ loai: 'tin', n: 2000 }).filter((e) => ids.includes(String(e.tu)) || ids.includes(String(e.toi))).slice(0, n)
    .map((e) => ({ ts: String(e.ts), luot: String(e.luot ?? ''), tu: String(e.tu ?? ''), toi: String(e.toi ?? ''), buoc: String((e.chi_tiet as Record<string, unknown>)?.buoc ?? ''), noi_dung: String((e.chi_tiet as Record<string, unknown>)?.noi_dung ?? (e.chi_tiet as Record<string, unknown>)?.tra_loi ?? '') }));
}

export async function soChi(ns: Doc[]) {
  const feats = ns.map((d) => `cty:${d.id}`);
  const rows = await q(sql`SELECT feature, model, sum(prompt_tokens)::int AS vao, sum(completion_tokens)::int AS ra, count(*)::int AS luot FROM ai_usage WHERE feature = ANY(${arr(feats)}) AND created_at >= date_trunc('month', now()) GROUP BY 1, 2 ORDER BY 1`);
  if (!rows) return null;
  const ds = rows.map((r) => ({ nguoi: String(r.feature).replace('cty:', ''), model: String(r.model), vao: Number(r.vao), ra: Number(r.ra), luot: Number(r.luot), usd: tienUsd(String(r.model), { input_tokens: Number(r.vao), output_tokens: Number(r.ra) }) as number | null }));
  return { ds, tongUsd: ds.reduce((s, r) => s + (r.usd ?? 0), 0), tranNguoi: Object.fromEntries(ns.map((d) => [d.id, Number(d.fm.tran_usd_thang || 0)])) };
}

export function goiSo(ns: Doc[]) { return [...new Set(ns.flatMap((d) => (Array.isArray(d.fm.data) ? (d.fm.data as string[]) : [])))]; }
