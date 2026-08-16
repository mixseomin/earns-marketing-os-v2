import { sql, type SQL } from 'drizzle-orm';

// `${jsArray}::text[]` KHÔNG bind được thành mảng Postgres: driver gửi phần tử trần nên pg ném
// `malformed array literal: "…"` (22P02). Lỗi này im lặng ở mọi chỗ có `catch` fail-safe — truy
// vấn hỏng, hàm trả mảng rỗng, giao diện chỉ đơn giản không hiện gì và không ai biết tại sao
// (2026-08-08: dải "sản phẩm đang dựng" trắng trơn đúng vì thế).
//
// Cách đúng là bind TỪNG phần tử làm một tham số riêng bên trong `ARRAY[…]`. Mẫu này từng được
// viết tay trong outreach-touches.ts kèm ghi chú, nhưng viết tay thì chỗ tiếp theo lại quên —
// nên gom thành một hàm để không còn chỗ nào phải nhớ.
//
//   WHERE key = ANY(${textArray(keys)})     · rỗng → ARRAY[]::text[], vẫn hợp lệ, khớp 0 dòng
export function textArray(values: readonly string[]): SQL {
  return sql`ARRAY[${sql.join(values.map((v) => sql`${v}`), sql`, `)}]::text[]`;
}

/** Như trên nhưng cho khoá số (`id = ANY(${bigintArray(ids)})`). Cùng lý do, cùng cách: nối chuỗi
 *  `ARRAY[1,2,3]` bằng sql.raw thì chạy được nhưng mở đường cho lần sau nối thứ chưa lọc vào SQL. */
export function bigintArray(values: readonly number[]): SQL {
  return sql`ARRAY[${sql.join(values.map((v) => sql`${v}`), sql`, `)}]::bigint[]`;
}
