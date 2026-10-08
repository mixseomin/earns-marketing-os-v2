// Kiểm câu ghi xv_job (cách cũ vs cách mới) trong transaction ROLLBACK — không để lại dòng nào. Chạy trên box có DATABASE_URL.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
const db = getDb()!;
const canh = ((await db.execute(sql`SELECT id FROM xv_canh ORDER BY id LIMIT 1`)) as unknown as Array<{ id: number }>)[0]!.id;
class Lui extends Error {}
for (const [ten, q] of [
  ['cu (subquery co tham so)', sql`INSERT INTO xv_job (phim_id, canh_id, loai, provider, model) VALUES (coalesce(${null}::int, (SELECT t.phim_id FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE c.id = ${canh}::int)), ${canh}, 'anh', 'thu', 'thu') RETURNING id`],
  ['moi (tham so thuong)', sql`INSERT INTO xv_job (phim_id, canh_id, loai, provider, model) VALUES (${1}, ${canh}, 'anh', 'thu', 'thu') RETURNING id`],
] as const) {
  try { await db.transaction(async (tx) => { await tx.execute(q); throw new Lui(); }); }
  catch (e) { console.log(ten, e instanceof Lui ? 'OK (đã rollback)' : `LOI: ${(e as Error).message.slice(0, 140)}`); }
}
process.exit(0);
