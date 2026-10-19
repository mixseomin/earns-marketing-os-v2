// 🎭 THỬ MỘT NHỊP DIỄN TRÊN MẶT (soi-mat.ts › thuDienMat) — liếc mắt, nhếch môi… trên một ảnh của shot, KHÔNG ghi vào shot. TỐN ~110₫ / lượt.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/thu-dien-mat.mts --canh=1045 --anh=ket --ten=Vivian --lenh="…"
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { thuDienMat } from '../src/lib/xuong-video/soi-mat';
import type { Row } from '../src/lib/xuong-video/doc-db';

const val = (k: string) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : ''; };
const canhId = Number(val('canh')); const ten = val('ten'); const lenh = val('lenh'); const anh = val('anh') || 'mo';
if (!canhId || !ten || !lenh) { console.error('cần --canh= --ten= --lenh= [--anh=mo|giua|ket]'); process.exit(1); }
const db = getDb(); if (!db) { console.error('không có DATABASE_URL'); process.exit(1); }
const q = async (s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as Row[];
const c = (await q(sql`SELECT keyframe_url, keyframe_giua, keyframe_ket FROM xv_canh WHERE id = ${canhId}`))[0];
const url = String((anh === 'ket' ? c?.keyframe_ket : anh === 'giua' ? c?.keyframe_giua : c?.keyframe_url) ?? '');
if (!url) { console.error(`shot ${canhId} không có ảnh ${anh}`); process.exit(1); }
console.log(`ảnh gốc: ${url}`);
const r = await thuDienMat(db, canhId, url, ten, lenh);
if (!r.ok) { console.error(`✗ ${r.loi}`); process.exit(1); }
const t0 = Date.now(); let j: Row | undefined;
while (Date.now() - t0 < 10 * 60_000) {
  j = (await q(sql`SELECT trang_thai, loi, chi_phi_cents, provider, request->'ghep' AS ghep, request->'soi_lai' AS soi_lai FROM xv_job WHERE id = ${r.data}`))[0];
  if (j && j.trang_thai !== 'cho' && (j.trang_thai === 'loi' || j.ghep !== null)) break;
  await new Promise((ok) => setTimeout(ok, 5000));
}
console.log(`job ${r.data}: ${j?.trang_thai} · ${j?.provider} · ${Number(j?.chi_phi_cents ?? 0).toFixed(3)}¢${j?.loi ? ` · ${String(j.loi).slice(0, 160)}` : ''}\nảnh ghép: ${j?.ghep}`);
const sl = j?.soi_lai as { ket?: { ten: string; giong: number | null; nhin?: { g: number; dau: number; mat: number } }[] } | null;
for (const k of sl?.ket ?? []) console.log(`soi lại ${k.ten}: giống ${Math.round((k.giong ?? 0) * 100)}% · ${k.nhin ? `nhìn ${k.nhin.g}° (đầu ${k.nhin.dau}°, con ngươi ${k.nhin.mat})` : '—'}`);
process.exit(0);
