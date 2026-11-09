// HÀNG KẾT NỐI DB RIÊNG CỦA etp2 (anh 09/11/2026 "sửa load chậm"): @mos2/db mở pool max 4 dùng chung mọi app, mà trang etp gọi ~45 câu song song
// → câu một dòng cũng chờ ~930ms trong hàng (journal [etp-cham]). Lúc máy chủ etp2 khởi động, dựng sẵn pool 16 vào đúng singleton getDb() đọc
// (globalThis.__mos2_db / __mos2_pg) — mọi chỗ gọi getDb() trong etp2 dùng pool này; app khác không đổi. Postgres max_connections 100.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || !process.env.DATABASE_URL || globalThis.__mos2_db) return;
  const [{ default: postgres }, { drizzle }, schema] = await Promise.all([import('postgres'), import('drizzle-orm/postgres-js'), import('@mos2/db/schema')]);
  const pg = postgres(process.env.DATABASE_URL, { max: 16, prepare: false });
  globalThis.__mos2_pg = pg;
  globalThis.__mos2_db = drizzle(pg, { schema, casing: 'snake_case' });
}
