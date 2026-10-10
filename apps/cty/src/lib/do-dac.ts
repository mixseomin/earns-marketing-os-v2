// Đồ đạc cơ bản của một phòng — đọc từ dữ liệu thật, không chép: bảng công việc (sổ tiến độ + plays của dự án phòng cầm,
// hoặc nhật ký lượt với Phòng thử), tủ tài liệu (hồ sơ, luật, kỹ năng, sơ đồ + ai đã đọc theo sổ sự kiện), hòm tin (tin trao tay
// trong sổ sự kiện), sổ chi (ai_usage tháng này của người trong phòng), gói số (data: trong SOUL). Thiếu DB → ô báo "không nối DB".
import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import type { Doc } from './cong-ty';
import { docLog } from '../../worker/log.mjs';
import gia from '../../worker/gia-model.json';
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
  const plays = await q(sql`SELECT project_id, status, count(*)::int AS n FROM human_tasks WHERE platform_key = 'backlink' AND project_id = ANY(${arr(duAn)}) GROUP BY 1, 2`);
  return { loai: 'du-an' as const, duAn, hm, buoc, plays };
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
  const giaCua = (model: string) => { const ten = model.includes(':') ? model.split(':')[1]! : model; const k = Object.keys(gia).filter((x) => x !== '_' && ten.startsWith(x)).sort((a, b) => b.length - a.length)[0]; return k ? (gia as unknown as Record<string, [number, number]>)[k] : null; };
  const ds = rows.map((r) => { const g = giaCua(String(r.model)); const usd = g ? (Number(r.vao) * g[0] + Number(r.ra) * g[1]) / 1e6 : null; return { nguoi: String(r.feature).replace('cty:', ''), model: String(r.model), vao: Number(r.vao), ra: Number(r.ra), luot: Number(r.luot), usd }; });
  return { ds, tongUsd: ds.reduce((s, r) => s + (r.usd ?? 0), 0), tranNguoi: Object.fromEntries(ns.map((d) => [d.id, Number(d.fm.tran_usd_thang || 0)])) };
}

export function goiSo(ns: Doc[]) { return [...new Set(ns.flatMap((d) => (Array.isArray(d.fm.data) ? (d.fm.data as string[]) : [])))]; }
