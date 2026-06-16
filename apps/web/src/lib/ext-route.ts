import { NextResponse } from 'next/server';

// Shared helpers cho /api/ext/* route handlers — DRY các pattern lặp >1 lần
// (rule: bất kỳ logic lặp >1 lần → 1 hàm). Xem audit dry-audit-crew 2026-06-16.

/**
 * Lấy row đầu từ kết quả `db.execute(sql`...`)` của Drizzle (postgres-js trả mảng).
 * Thay idiom `(rows as unknown as Array<Record<string, unknown>>)[0]` lặp 55+ chỗ.
 */
export function firstRow<T = Record<string, unknown>>(result: unknown): T | undefined {
  return (result as unknown as T[])[0];
}

/** Toàn bộ rows với kiểu T (cùng cast, dùng khi cần map nhiều dòng). */
export function rows<T = Record<string, unknown>>(result: unknown): T[] {
  return (result as unknown as T[]) ?? [];
}

/**
 * Error response chuẩn `{ ok: false, error, ...extra }` + status.
 * Thay `NextResponse.json({ ok: false, error: '...' }, { status: X })` lặp 54+ chỗ
 * (+ db-guard 503, validation 400, reason 200…).
 */
export function errorResponse(error: string | undefined, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error, ...(extra || {}) }, { status });
}

/** Success response chuẩn `{ ok: true, ...data }`. */
export function okResponse(data?: Record<string, unknown>) {
  return NextResponse.json({ ok: true, ...(data || {}) });
}
