// Lưu CỤM NGƯỜI MUA của một nhóm sản phẩm spy vào xv_cum_goc (kho-creative.ts › CumGoc). 0đ — cụm gom bằng đọc hiểu (Claude trong phiên
// đọc tên + nhãn review của từng góc), không gọi API. Kiểm với góc THẬT của spy trước khi ghi (góc lạ / trùng cụm → dừng).
//   tệp: scripts/du-lieu/cum-goc/<sp>.json { sp, nguon, cum: [{ ten, mo_ta, goc: [id…] }] }
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/cum-goc.mts scripts/du-lieu/cum-goc/325.json
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { kiemCum, type CumGoc } from '../src/lib/xuong-video/kho-creative';

const f = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as { sp: number; nguon: string; cum: CumGoc[] };
const SPY = process.env.SPY_API_URL || 'http://127.0.0.1:3850';
const goc = (await (await fetch(`${SPY}/api/goc?sp=${f.sp}`)).json()) as { id: number; loai: string }[];
const that = goc.filter((g) => String(g.loai).startsWith('ai_')).map((g) => Number(g.id));
const loi = kiemCum(f.cum, that);
if (loi.length) { console.error(`✗ ${loi.length} lỗi:\n${loi.join('\n')}`); process.exit(1); }
const vao = new Set(f.cum.flatMap((c) => c.goc));
await getDb()!.execute(sql`INSERT INTO xv_cum_goc (sp, cum, nguon, updated_at) VALUES (${f.sp}, ${JSON.stringify(f.cum)}::jsonb, ${f.nguon}, now())
  ON CONFLICT (sp) DO UPDATE SET cum = EXCLUDED.cum, nguon = EXCLUDED.nguon, updated_at = now()`);
console.log(`✓ nhóm spy ${f.sp}: ${f.cum.length} cụm · ${vao.size}/${that.length} góc vào cụm`);
process.exit(0);
