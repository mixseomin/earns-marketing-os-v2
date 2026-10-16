// AI VIẾT PHƯƠNG ÁN CHỮ cho một cặp concept × template (kho concept — concept-db.ts › vietPhuongAnDb, cùng lõi với nút ✍ trên tab Phương án).
// Mặc định CHỈ in giá ước + các ô; thêm --chay mới gọi Claude (TỐN TIỀN — chỉ chạy khi anh bảo).
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/viet-phuong-an.mts <cap_id> [--chay]
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { nguCanhCap, uocVietPhuongAnDb, vietPhuongAnDb } from '../src/lib/xuong-video/concept-db';
import { PA_DU_KIEN } from '../src/lib/xuong-video/concept';

const db = getDb()!;
const cap = Number(process.argv[2]);
if (!Number.isFinite(cap)) { console.error('dùng: viet-phuong-an.mts <cap_id> [--chay]'); process.exit(2); }
const x = await nguCanhCap(db, cap);
if (!x) { console.error(`không thấy cặp #${cap}`); process.exit(1); }
const u = await uocVietPhuongAnDb(db, cap);
console.log(`cặp #${cap} · concept ${x.c.ma} × template #${x.c.template_id} · ${x.oChu.length} ô · ước ${u.ok ? `$${(u.data.cents / 100).toFixed(3)} (${u.data.model})` : u.loi}`);
for (const [i, o] of x.oChu.entries()) console.log(`  ${o.k} · ${o.loai} · ${o.giay}s · ${PA_DU_KIEN(x.oChu, i)} phương án`);
if (!process.argv.includes('--chay')) process.exit(0);
const r = await vietPhuongAnDb(db, cap);
if (!r.ok) { console.error(`✗ ${r.loi}`); process.exit(1); }
const ds = (await db.execute(sql`SELECT o, so, chu, nguon FROM xv_phuong_an WHERE cap_id = ${cap} AND NOT an ORDER BY o, so`)) as unknown as { o: string; so: number; chu: string; nguon: string }[];
const tien = (await db.execute(sql`SELECT chi_phi_cents FROM xv_job WHERE loai = 'chu' AND nhan LIKE ${`Phương án chữ · concept ${x.c.ma} × template #${x.c.template_id}%`} ORDER BY id DESC LIMIT 1`)) as unknown as { chi_phi_cents: number }[];
console.log(`✓ ${r.data} phương án mới · chi thật $${((Number(tien[0]?.chi_phi_cents) || 0) / 100).toFixed(3)}`);
for (const p of ds) console.log(`  ${p.o}#${p.so} [${p.nguon}] ${p.chu}`);
process.exit(0);
