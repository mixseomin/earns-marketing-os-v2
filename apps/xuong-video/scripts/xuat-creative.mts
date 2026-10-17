// XUẤT CREATIVE từ clip phim gốc của bộ hình (cùng lõi nút ⬇ Xuất trên kho creative — xuat-creative.ts › xuatCreativeDb): đổi chữ màn + lồng lại
// giọng câu đổi (đúng giọng câu gốc, ~$0.004/câu), ghép MP4 bằng ffmpeg, không sinh video. Creative phải đã duyệt, bộ hình phải có phim gốc.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/xuat-creative.mts <sp_key> <số creative> [<số> …]
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { nguCanhXuat, xuatCreativeDb } from '../src/lib/xuong-video/xuat-creative';
import { taoJob, xongJob, type Row } from '../src/lib/xuong-video/doc-db';
import { laDuyet } from '../src/lib/xuong-video/concept';
import { tien } from '../src/lib/xuong-video/kieu';

if (process.env.DUYET_SINH_1_LAN !== '1') { console.error('lồng giọng TỐN TIỀN (nhỏ) — cần DUYET_SINH_1_LAN=1 sau khi anh bảo'); process.exit(1); }
const db = getDb()!; const [spKey, ...so] = process.argv.slice(2);
for (const x of so.map(Number)) {
  const cr = ((await db.execute(sql`SELECT id, so, ma, trang_thai FROM xv_creative WHERE sp_key = ${spKey} AND so = ${x}`)) as unknown as Row[])[0];
  if (!cr) { console.log(`#${x}: không thấy`); continue; }
  if (!laDuyet(String(cr.trang_thai))) { console.log(`#${x}: chưa duyệt — bỏ`); continue; }
  const nc = await nguCanhXuat(db, Number(cr.id)); if (!nc.ok) { console.log(`#${x}: ${nc.loi}`); continue; }
  const job = await taoJob(db, { phim_id: nc.data.phimGoc, nhan: `Xuất creative #${x} từ phim gốc (script)`, loai: 'xuat', provider: 'ffmpeg', model: 'ffmpeg', request: { creative_id: Number(cr.id) } });
  const r = await xuatCreativeDb(db, Number(cr.id), job).catch((e: unknown) => ({ ok: false as const, loi: e instanceof Error ? e.message : String(e) }));
  if (!r.ok) { await xongJob(db, job, { loi: r.loi }); console.log(`✗ #${x} ${cr.ma}: ${r.loi}`); continue; }
  const xu = ((await db.execute(sql`SELECT xuat FROM xv_creative WHERE id = ${Number(cr.id)}`)) as unknown as Row[])[0]?.xuat as { giay?: number; canh_bao?: string[] } | null;
  const t = ((await db.execute(sql`SELECT coalesce(sum(chi_phi_cents), 0) AS c FROM xv_job WHERE id = ${job} OR (loai = 'am' AND request->>'job' = ${String(job)})`)) as unknown as Row[])[0];
  console.log(`✓ #${x} ${cr.ma} · ${xu?.giay}s · ${tien(Number(t?.c ?? 0))} → ${r.data.url}${(xu?.canh_bao ?? []).map((c) => `\n   ⚠ ${c}`).join('')}`);
}
process.exit(0);
