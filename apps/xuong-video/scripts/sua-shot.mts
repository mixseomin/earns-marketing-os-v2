// SỬA DỮ LIỆU SHOT CỦA MỘT TẬP TỪ MỘT TỆP VÁ (0đ) — cho tập dựng thẳng trên DB (bản sao, phim không có bộ dựng nguồn như tong-tai/): mỗi mục vá
// một shot theo thu_tu, gộp sâu vào ky_thuat / dan_dung / may_3d (vi_tri gộp theo tên nhân vật), ghi đè các cột chữ. Chụp trước (hoan-tac.ts) nên
// ↶ hoàn tác được trên studio. Sửa may_3d → mã khung xám đổi → `bo-set.mts --dung` dựng lại đúng các shot đó.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/sua-shot.mts <tap_id> <vá.json>
// vá.json: [{ "thu_tu": 18, "ky_thuat": { "chuyen_canh": "toi_den" } },
//           { "thu_tu": 28, "may_3d": { "khung": ["Chuỗi hạt ngọc"], "vi_tri": { "Lục Thần": { "dien": ["chong_ban"] } } } },
//           { "thu_tu": 5, "hanh_dong": "…" }]
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { chupTruoc } from '../src/lib/xuong-video/hoan-tac';
import { tachShotDb } from '../src/lib/xuong-video/tach-shot';
import type { Row } from '../src/lib/xuong-video/doc-db';

const [tapId, tep] = [Number(process.argv[2]), process.argv[3]];
if (!tapId || !tep) { console.error('cần <tap_id> <vá.json>'); process.exit(1); }
const db = getDb(); if (!db) { console.error('không có DATABASE_URL'); process.exit(1); }
type Va = { thu_tu: number; ky_thuat?: Record<string, unknown>; dan_dung?: Record<string, unknown>; may_3d?: Record<string, unknown> & { vi_tri?: Record<string, Record<string, unknown>> };
  hanh_dong?: string; canh?: string; prompt_anh?: string; prompt_video?: string; phat_s?: number; thoi_luong_s?: number; bieu_cam?: unknown; /** tách shot thành các nhịp (tach-shot.ts) — chạy TRƯỚC mọi vá khác; thu_tu các mục sau tính theo thứ tự SAU khi tách */ tach?: string[] };
const va = JSON.parse(readFileSync(tep, 'utf8')) as Va[];
const la = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
/** Gộp sâu: object gộp từng khoá, mảng / giá trị đè; null = xoá khoá. */
const gop = (a: unknown, b: unknown): unknown => {
  if (!la(a) || !la(b)) return b;
  const o: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) { if (v === null) delete o[k]; else o[k] = gop(a[k], v); }
  return o;
};
const nhom = `sua-shot-${Date.now()}`;
for (const v of va.filter((x) => x.tach?.length)) {
  const r = (await db.execute(sql`SELECT id FROM xv_canh WHERE tap_id = ${tapId} AND thu_tu = ${v.thu_tu} ORDER BY id LIMIT 1`)) as unknown as Row[];
  if (!r[0]) { console.log(`✗ tách #${v.thu_tu}: không có shot`); continue; }
  const t = await tachShotDb(db, Number(r[0].id), v.tach!, 'sua-shot');
  console.log(t.ok ? `✓ tách #${v.thu_tu} → ${t.ids.length} shot (${t.ids.join(', ')})` : `✗ tách #${v.thu_tu}: ${t.loi}`);
}
for (const v of va.filter((x) => !x.tach?.length)) {
  const r = (await db.execute(sql`SELECT id, ky_thuat, dan_dung, may_3d FROM xv_canh WHERE tap_id = ${tapId} AND thu_tu = ${v.thu_tu} ORDER BY id LIMIT 1`)) as unknown as Row[];
  if (!r[0]) { console.log(`✗ #${v.thu_tu}: không có shot`); continue; }
  const id = Number(r[0].id); const cot: string[] = []; const doi: string[] = [];
  const ghi = async (ten: string, gt: unknown) => { cot.push(ten); doi.push(`${ten} = ${typeof gt === 'object' ? `'${JSON.stringify(gt).replace(/'/g, "''")}'::jsonb` : `'${String(gt).replace(/'/g, "''")}'`}`); };
  if (v.ky_thuat) await ghi('ky_thuat', gop(r[0].ky_thuat ?? {}, v.ky_thuat));
  if (v.dan_dung) await ghi('dan_dung', gop(r[0].dan_dung ?? {}, v.dan_dung));
  if (v.may_3d) {
    const cu = (r[0].may_3d ?? {}) as Record<string, unknown> & { vi_tri?: Record<string, unknown>[] };
    const { vi_tri: viVa, ...khac } = v.may_3d;
    const m = gop(cu, khac) as Record<string, unknown> & { vi_tri?: Record<string, unknown>[] };
    if (viVa) m.vi_tri = (cu.vi_tri ?? []).map((x) => (viVa[String(x.ten)] ? gop(x, viVa[String(x.ten)]) : x)) as Record<string, unknown>[];
    await ghi('may_3d', m);
  }
  for (const k of ['hanh_dong', 'canh', 'prompt_anh', 'prompt_video', 'phat_s', 'thoi_luong_s'] as const) if (v[k] != null) await ghi(k, v[k]);
  if (v.bieu_cam !== undefined) await ghi('bieu_cam', v.bieu_cam);
  if (!cot.length) continue;
  await chupTruoc(db, { bang: 'xv_canh', id, cot, moTa: `sửa shot #${v.thu_tu} (sua-shot.mts)`, nguoi: 'sua-shot', nhom });
  await db.execute(sql.raw(`UPDATE xv_canh SET ${doi.join(', ')}, updated_at = now() WHERE id = ${id}`));
  console.log(`✓ #${v.thu_tu} (${id}): ${cot.join(', ')}`);
}
process.exit(0);
