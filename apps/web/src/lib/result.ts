// Result<T> — shared discriminated union cho server-action return values.
// Trước refactor: mỗi action tự define `Promise<{ ok: true; ... } | { ok: false; error: string }>`
// → 100+ inline duplicates. Sau: dùng Result<T> consistent.
//
// Pattern:
//   import { ok, fail, type Result } from '@/lib/result';
//
//   export async function deleteFoo(id: number): Promise<Result> {
//     if (!found) return fail('Foo not found');
//     await db.delete(...);
//     return ok();
//   }
//
//   export async function createBar(input): Promise<Result<{ id: number }>> {
//     const [row] = await db.insert(...).returning();
//     return ok({ id: row.id });
//   }
//
// Client side:
//   const res = await deleteFoo(id);
//   if (!res.ok) { setError(res.error); return; }
//   // TS narrows: res.data : { id: number }

export type Result<T = void> =
  | { ok: true; data: T extends void ? undefined : T; warnings?: string[] }
  | { ok: false; error: string; code?: string };

/** Successful result. Pass `data` for actions that return a value; omit for void actions. */
export function ok(): Result<void>;
export function ok<T>(data: T, warnings?: string[]): Result<T>;
export function ok<T>(data?: T, warnings?: string[]): Result<T | void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = { ok: true, data: data as any };
  if (warnings && warnings.length) payload.warnings = warnings;
  return payload;
}

/** Failure result. `code` optional for programmatic handling (e.g. 'not-found', 'permission-denied'). */
export function fail(error: string, code?: string): Result<never> {
  return { ok: false, error, ...(code ? { code } : {}) };
}

/** Type guard for narrowing in callers. */
export function isOk<T>(r: Result<T>): r is Extract<Result<T>, { ok: true }> {
  return r.ok === true;
}

/**
 * Helper to handle Result in client transitions:
 *   const r = await someAction();
 *   handleResult(r, { onErr: setError, onOk: () => router.refresh() });
 */
export function handleResult<T>(
  r: Result<T>,
  handlers: {
    onErr?: (error: string) => void;
    onOk?: (data: T extends void ? undefined : T, warnings?: string[]) => void;
  },
): void {
  if (r.ok) handlers.onOk?.(r.data as T extends void ? undefined : T, r.warnings);
  else handlers.onErr?.(r.error);
}
