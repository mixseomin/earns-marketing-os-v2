// PHỦ — dữ liệu cho trang /p/[id]/phu: một màn duy nhất theo dõi phủ affiliate + traffic mua.
//
// Mọi thứ đọc từ sáu bảng phu_* (migration 0180). Không gọi mạng ngoài lúc render: adapter
// (scripts/phu/*.mjs, /api/phu/postback) đổ số vào phu_su_kien/phu_chi trước, trang chỉ cộng.
// Phễu tính theo sid_prefix (= nguồn_camp, hai mẩu đầu của sid) trong cửa sổ N ngày; dòng '' là
// click không mang sid (organic/SEO) để không mất số.

import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';

export * from './phu-shared';
import type { PhuData, PhuPlatform, PhuNguon, PhuCamp, PhuPheu, PhuAdapter, PhuLander } from './phu-shared';

const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v) || 0);
export const KHAC = '(khác)';

/** Biểu thức SQL gom sid về camp đã đăng ký: CASE WHEN sid LIKE '<prefix>\_%' OR sid LIKE '<alias>%' … ELSE '(khác)'.
 *  Dòng không sid ('') giữ nguyên = organic. Một chỗ dựng, ba truy vấn (cửa sổ, cộng dồn, chi) cùng dùng. */
function nhomTheoCamp(camps: Record<string, unknown>[]) {
  const nhanh = camps.map((r) => {
    const prefix = String(r.sid_prefix);
    const t = (r.target && typeof r.target === 'object' ? r.target : {}) as { alias?: unknown };
    const alias = Array.isArray(t.alias) ? t.alias.map(String).filter(Boolean) : [];
    const dk = [sql`sid LIKE ${prefix.replace(/[_%]/g, (m) => '\\' + m) + '\\_%'}`, ...alias.map((a) => sql`sid LIKE ${a.replace(/[_%]/g, (m) => '\\' + m) + '%'}`)];
    return sql`WHEN ${sql.join(dk, sql` OR `)} THEN ${prefix}`;
  });
  return nhanh.length ? sql`CASE WHEN COALESCE(sid, '') = '' THEN '' ${sql.join(nhanh, sql` `)} ELSE ${KHAC} END` : sql`CASE WHEN COALESCE(sid, '') = '' THEN '' ELSE ${KHAC} END`;
}
const nhomChi = sql`sid_prefix`;   // phu_chi ghi thẳng theo prefix camp (adapter/tay), không cần gom lại

/** Nhật ký một camp: số theo NGÀY (view/click/out/signup/chi) + các lần ĐỔI cài đặt (phu_camp_doi, trigger ghi) — đọc
 *  kết quả trước/sau mỗi mốc đổi trên cùng một bảng. Cửa sổ N ngày, đổi thì lấy hết (ít). */
export async function getPhuCampNhatKy(projectId: string, sidPrefix: string, days = 30) {
  const db = getDb();
  if (!db) return { ngay: [], doi: [] };
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const camp = (await db.execute(sql`SELECT target FROM phu_camp WHERE project_id = ${projectId} AND sid_prefix = ${sidPrefix}`)) as unknown as Record<string, unknown>[];
  const t = (camp[0]?.target && typeof camp[0].target === 'object' ? camp[0].target : {}) as { alias?: unknown };
  const alias = Array.isArray(t.alias) ? t.alias.map(String) : [];
  const dk = [sql`sid LIKE ${sidPrefix.replace(/[_%]/g, (m) => '\\' + m) + '\\_%'}`, ...alias.map((a) => sql`sid LIKE ${a.replace(/[_%]/g, (m) => '\\' + m) + '%'}`)];
  const [ev, chi, doi] = await Promise.all([
    db.execute(sql`SELECT date(ts) AS ngay, COUNT(*) FILTER (WHERE loai = 'view') AS view, COUNT(*) FILTER (WHERE loai = 'gate') AS gate,
                          COUNT(*) FILTER (WHERE loai = 'click') AS click, COUNT(*) FILTER (WHERE loai = 'out') AS "out", COUNT(*) FILTER (WHERE loai = 'signup') AS signup
                     FROM phu_su_kien WHERE project_id = ${projectId} AND ts >= ${since}::timestamptz AND (${sql.join(dk, sql` OR `)}) GROUP BY 1`) as unknown as Promise<Record<string, unknown>[]>,
    db.execute(sql`SELECT ngay::text AS ngay, chi_usd, clicks FROM phu_chi WHERE project_id = ${projectId} AND sid_prefix = ${sidPrefix} AND ngay >= ${since.slice(0, 10)}::date`) as unknown as Promise<Record<string, unknown>[]>,
    db.execute(sql`SELECT id, ts, truong, cu, moi, nguon, ly_do FROM phu_camp_doi WHERE project_id = ${projectId} AND sid_prefix = ${sidPrefix} ORDER BY ts DESC LIMIT 200`) as unknown as Promise<Record<string, unknown>[]>,
  ]);
  const byNgay = new Map<string, { ngay: string; view: number; gate: number; click: number; out: number; signup: number; chi: number; visit: number }>();
  const lay = (d: string) => { let r = byNgay.get(d); if (!r) { r = { ngay: d, view: 0, gate: 0, click: 0, out: 0, signup: 0, chi: 0, visit: 0 }; byNgay.set(d, r); } return r; };
  for (const r of ev) { const x = lay(String(r.ngay).slice(0, 10)); x.view = n(r.view); x.gate = n(r.gate); x.click = n(r.click); x.out = n(r.out); x.signup = n(r.signup); }
  for (const r of chi) { const x = lay(String(r.ngay).slice(0, 10)); x.chi = n(r.chi_usd); x.visit = n(r.clicks); }
  return {
    ngay: [...byNgay.values()].sort((a, b) => (a.ngay < b.ngay ? 1 : -1)),
    doi: doi.map((r) => ({ id: Number(r.id), ts: String(r.ts), truong: String(r.truong), cu: s(r.cu), moi: s(r.moi), nguon: String(r.nguon), lyDo: s(r.ly_do) })),
  };
}
export type PhuCampNhatKy = Awaited<ReturnType<typeof getPhuCampNhatKy>>;

/** Drill-down: nguồn (mẩu sau prefix, = srcid/zone) của MỘT camp trong cửa sổ, xếp theo view. Trang chính không kéo cái này. */
export async function getPhuNguonCamp(projectId: string, sidPrefix: string, days = 7, limit = 200) {
  const db = getDb();
  if (!db) return [];
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const camp = (await db.execute(sql`SELECT target FROM phu_camp WHERE project_id = ${projectId} AND sid_prefix = ${sidPrefix}`)) as unknown as Record<string, unknown>[];
  const t = (camp[0]?.target && typeof camp[0].target === 'object' ? camp[0].target : {}) as { alias?: unknown };
  const alias = Array.isArray(t.alias) ? t.alias.map(String) : [];
  const dk = [sql`sid LIKE ${sidPrefix.replace(/[_%]/g, (m) => '\\' + m) + '\\_%'}`, ...alias.map((a) => sql`sid LIKE ${a.replace(/[_%]/g, (m) => '\\' + m) + '%'}`)];
  const rows = (await db.execute(sql`
    SELECT regexp_replace(sid, '^[^_|]+[_|][^_|]+[_|]?', '') AS nguon,
           COUNT(*) FILTER (WHERE loai = 'view') AS view, COUNT(*) FILTER (WHERE loai = 'gate') AS gate,
           COUNT(*) FILTER (WHERE loai = 'click') AS click, COUNT(*) FILTER (WHERE loai = 'out') AS "out",
           COUNT(*) FILTER (WHERE loai = 'signup') AS signup, COALESCE(SUM(amount) FILTER (WHERE loai IN ('spend', 'lead')), 0)::float8 AS revenue
      FROM phu_su_kien WHERE project_id = ${projectId} AND ts >= ${since}::timestamptz AND (${sql.join(dk, sql` OR `)})
     GROUP BY 1 ORDER BY signup DESC, view DESC LIMIT ${limit}`)) as unknown as Record<string, unknown>[];
  return rows.map((r) => ({ nguon: String(r.nguon), view: n(r.view), gate: n(r.gate), click: n(r.click), out: n(r.out), signup: n(r.signup), revenue: n(r.revenue) }));
}
const s = (v: unknown) => (v === null || v === undefined ? null : String(v));

/** Project nào có sổ PHỦ (camp hoặc nền tảng) — trang chủ chọn project theo đây, mới sửa gần nhất lên đầu. */
export async function listPhuProjects(): Promise<string[]> {
  const db = getDb();
  if (!db) return [];
  const rows = (await db.execute(sql`
    SELECT project_id FROM (SELECT project_id, MAX(updated_at) u FROM phu_camp GROUP BY 1
                            UNION ALL SELECT project_id, MAX(updated_at) FROM phu_platforms GROUP BY 1) t
     GROUP BY 1 ORDER BY MAX(u) DESC`)) as unknown as Record<string, unknown>[];
  return rows.map((r) => String(r.project_id));
}

export async function getPhu(projectId: string, days = 7): Promise<PhuData> {
  const rong: PhuData = { platforms: [], nguon: [], camp: [], pheu: [], adapters: [], landers: [], days, tong: { view: 0, gate: 0, click: 0, out: 0, signup: 0, revenue: 0, chi: 0 }, loi: null };
  const db = getDb();
  if (!db) return { ...rong, loi: 'DATABASE_URL chưa cấu hình' };
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  // Camp đọc TRƯỚC: phễu gom theo camp đã đăng ký ngay trong SQL. sid khớp `<prefix>_%` hoặc một alias
  // trong target.alias (URL đời cũ, vd 'bv-pop-us-m') → dòng camp đó; còn lại dồn vào MỘT dòng '(khác)'
  // (đếm số sid_prefix lạ). Không có đường nào để 1 triệu sid thành 1 triệu dòng trên trang.
  const c = await db.execute(sql`SELECT * FROM phu_camp WHERE project_id = ${projectId} ORDER BY trang_thai, sid_prefix`);
  type R = Record<string, unknown>;
  const nhom = nhomTheoCamp(c as unknown as R[]);
  const [p, ng, ev, chi, ad, ld, evAll, chiAll] = await Promise.all([
    db.execute(sql`
      SELECT p.*, t.status AS card_status
        FROM phu_platforms p LEFT JOIN human_tasks t ON t.id = p.card_id
       WHERE p.project_id = ${projectId}
       ORDER BY CASE p.nhom WHEN 'cam' THEN 0 WHEN 'ai' THEN 1 WHEN 'random' THEN 2 ELSE 3 END, p.name`),
    db.execute(sql`SELECT * FROM phu_nguon WHERE project_id = ${projectId} ORDER BY CASE trang_thai WHEN 'hoat_dong' THEN 0 WHEN 'dang_mo' THEN 1 WHEN 'du_kien' THEN 2 ELSE 3 END, name`),
    db.execute(sql`
      SELECT ${nhom} AS sid_prefix, COUNT(DISTINCT sid_prefix) AS so_prefix,
             COUNT(*) FILTER (WHERE loai = 'view')   AS view,
             COUNT(*) FILTER (WHERE loai = 'gate')   AS gate,
             COUNT(*) FILTER (WHERE loai = 'click')  AS click,
             COUNT(*) FILTER (WHERE loai = 'out')    AS "out",
             COUNT(*) FILTER (WHERE loai = 'signup') AS signup,
             COUNT(*) FILTER (WHERE loai = 'lead')   AS lead,
             COUNT(*) FILTER (WHERE loai = 'spend')  AS spend_count,
             COALESCE(SUM(amount) FILTER (WHERE loai IN ('spend', 'lead')), 0)::float8 AS revenue
        FROM phu_su_kien
       WHERE project_id = ${projectId} AND ts >= ${since}::timestamptz
       GROUP BY 1 ORDER BY revenue DESC, click DESC`),
    db.execute(sql`
      SELECT ${nhomChi} AS sid_prefix, COALESCE(SUM(chi_usd), 0)::float8 AS chi
        FROM phu_chi WHERE project_id = ${projectId} AND ngay >= ${since.slice(0, 10)}::date
       GROUP BY 1`),
    db.execute(sql`SELECT * FROM phu_adapter WHERE project_id = ${projectId} ORDER BY loai, key`),
    db.execute(sql`SELECT * FROM phu_lander WHERE project_id = ${projectId} ORDER BY host, path`),
    // cộng dồn toàn thời gian theo prefix — phán xét camp không được phụ thuộc cửa sổ N ngày
    db.execute(sql`
      SELECT ${nhom} AS sid_prefix, COUNT(*) FILTER (WHERE loai = 'view') AS view, COUNT(*) FILTER (WHERE loai = 'gate') AS gate,
             COUNT(*) FILTER (WHERE loai = 'click') AS click, COUNT(*) FILTER (WHERE loai = 'out') AS "out",
             COUNT(*) FILTER (WHERE loai = 'signup') AS signup, COALESCE(SUM(amount) FILTER (WHERE loai IN ('spend', 'lead')), 0)::float8 AS revenue
        FROM phu_su_kien WHERE project_id = ${projectId} AND sid_prefix <> '' GROUP BY 1`),
    db.execute(sql`SELECT ${nhomChi} AS sid_prefix, COALESCE(SUM(chi_usd), 0)::float8 AS chi FROM phu_chi WHERE project_id = ${projectId} GROUP BY 1`),
  ]);
  const chiMap = new Map<string, number>();
  for (const r of chi as unknown as R[]) chiMap.set(String(r.sid_prefix), n(r.chi));
  const tongEv = new Map<string, R>(); for (const r of evAll as unknown as R[]) tongEv.set(String(r.sid_prefix), r);
  const tongChi = new Map<string, number>(); for (const r of chiAll as unknown as R[]) tongChi.set(String(r.sid_prefix), n(r.chi));
  const pheu: PhuPheu[] = (ev as unknown as R[]).map((r) => ({
    sidPrefix: String(r.sid_prefix ?? ''), soPrefix: n(r.so_prefix), view: n(r.view), gate: n(r.gate), click: n(r.click), out: n(r.out), signup: n(r.signup), lead: n(r.lead),
    spendCount: n(r.spend_count), revenue: n(r.revenue), chi: chiMap.get(String(r.sid_prefix ?? '')) ?? 0,
  }));
  // Chi có mà chưa có sự kiện nào (camp vừa chạy) vẫn phải hiện — tiền đã đi.
  for (const [k, v] of chiMap) if (!pheu.some((x) => x.sidPrefix === k)) pheu.push({ sidPrefix: k, soPrefix: 1, view: 0, gate: 0, click: 0, out: 0, signup: 0, lead: 0, spendCount: 0, revenue: 0, chi: v });
  const tong = pheu.reduce((a, x) => ({ view: a.view + x.view, gate: a.gate + x.gate, click: a.click + x.click, out: a.out + x.out, signup: a.signup + x.signup, revenue: a.revenue + x.revenue, chi: a.chi + x.chi }), rong.tong);
  return {
    days, tong, loi: null, pheu,
    platforms: (p as unknown as R[]).map((r) => ({
      id: n(r.id), slug: String(r.slug), name: String(r.name), nhom: String(r.nhom), chuongTrinh: s(r.chuong_trinh), trangThai: String(r.trang_thai),
      hoaHong: s(r.hoa_hong), linkMau: s(r.link_mau), cuaRa: s(r.cua_ra), accountId: r.account_id == null ? null : n(r.account_id),
      cardId: r.card_id == null ? null : n(r.card_id), cardStatus: s(r.card_status), buocKe: s(r.buoc_ke), ghiChu: s(r.ghi_chu), updatedAt: String(r.updated_at),
    })),
    nguon: (ng as unknown as R[]).map((r) => ({
      id: n(r.id), key: String(r.key), name: String(r.name), loai: String(r.loai), trangThai: String(r.trang_thai), macroClick: s(r.macro_click),
      macroChi: s(r.macro_chi), postbackToken: s(r.postback_token), accountId: r.account_id == null ? null : n(r.account_id), napUsd: n(r.nap_usd), ghiChu: s(r.ghi_chu),
    })),
    camp: (c as unknown as R[]).map((r) => ({
      id: n(r.id), nguonKey: String(r.nguon_key), ten: String(r.ten), sidPrefix: String(r.sid_prefix), lander: s(r.lander),
      target: (r.target && typeof r.target === 'object' ? r.target : {}) as Record<string, unknown>,
      nganSachNgay: r.ngan_sach_ngay == null ? null : n(r.ngan_sach_ngay), trangThai: String(r.trang_thai), batDau: s(r.bat_dau), ghiChu: s(r.ghi_chu),
      ketThuc: r.ket_thuc == null ? null : String(r.ket_thuc), nhipNgay: n(r.nhip_ngay) || 1,
      tieuChi: (r.tieu_chi && typeof r.tieu_chi === 'object' ? r.tieu_chi : {}) as PhuCamp['tieuChi'], keHoach: s(r.ke_hoach),
      tong: (() => { const e = tongEv.get(String(r.sid_prefix)) ?? {}; return { view: n(e.view), gate: n(e.gate), click: n(e.click), out: n(e.out), signup: n(e.signup), revenue: n(e.revenue), chi: tongChi.get(String(r.sid_prefix)) ?? 0 }; })(),
    })),
    adapters: (ad as unknown as R[]).map((r) => ({ key: String(r.key), name: String(r.name), loai: String(r.loai), lich: s(r.lich), lastRun: s(r.last_run), lastOk: r.last_ok == null ? null : Boolean(r.last_ok), lastNote: s(r.last_note), postbackToken: s(r.postback_token) })),
    landers: (ld as unknown as R[]).map((r) => ({ host: String(r.host), path: String(r.path), ten: String(r.ten), moTa: s(r.mo_ta), dich: s(r.dich), lastSinh: s(r.last_sinh), soMuc: r.so_muc == null ? null : n(r.so_muc), trangThai: String(r.trang_thai) })),
  };
}

