// Kiểm các câu SQL hay vỡ của xưởng video trong transaction ROLLBACK — không để lại dòng nào. Chạy trên box có DATABASE_URL:
//   cd apps/xuong-video && ../../node_modules/.bin/tsx scripts/thu-ghi-job.mts
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
const db = getDb()!;
const nv = ((await db.execute(sql`SELECT id FROM xv_nhan_vat ORDER BY id LIMIT 2`)) as unknown as Array<{ id: number }>).map((r) => Number(r.id));
const mangInt = (xs: number[]) => `{${xs.join(',')}}`;
class Lui extends Error {}
const cases: Array<[string, ReturnType<typeof sql>]> = [
  ['mảng JS thô (cách cũ)', sql`SELECT count(*) FROM xv_nhan_vat WHERE id = ANY(${nv}::int[])`],
  ['mảng literal (cách mới)', sql`SELECT count(*) FROM xv_nhan_vat WHERE id = ANY(${mangInt(nv)}::int[])`],
  ['ghi tiền lẻ vào numeric', sql`UPDATE xv_job SET chi_phi_cents = ${3.36} WHERE id = (SELECT min(id) FROM xv_job)`],
  ['cộng tiền lẻ vào numeric', sql`UPDATE xv_canh SET chi_phi_cents = chi_phi_cents + ${3.36} WHERE id = (SELECT min(id) FROM xv_canh)`],
];
for (const [ten, q] of cases) {
  try { await db.transaction(async (tx) => { await tx.execute(q); throw new Lui(); }); }
  catch (e) { console.log(ten.padEnd(26), e instanceof Lui ? 'OK' : `LỖI: ${(e as Error).message.slice(0, 120)}`); }
}
process.exit(0);
