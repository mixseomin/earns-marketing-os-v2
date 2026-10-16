// ĐỌC API NỘI BỘ CỦA SPY (spy.on.tc chạy cùng box3, cổng 3850) — một chỗ cho server code của studio (actions-concept.ts; actions.ts còn bản riêng cũ).
import 'server-only';

export const SPY_API = process.env.SPY_API_URL || 'http://127.0.0.1:3850';
export async function docSpy<T>(duong: string, ms = 10000): Promise<{ ok: true; data: T } | { ok: false; loi: string }> {
  try {
    const r = await fetch(`${SPY_API}${duong}`, { cache: 'no-store', signal: AbortSignal.timeout(ms) });
    return r.ok ? { ok: true, data: (await r.json()) as T } : { ok: false, loi: `spy trả ${r.status}` };
  } catch (e) { return { ok: false, loi: `không gọi được spy (${e instanceof Error ? e.message.slice(0, 60) : 'lỗi'})` }; }
}
