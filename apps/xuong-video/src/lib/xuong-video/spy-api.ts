// ĐỌC API NỘI BỘ CỦA SPY (spy.on.tc chạy cùng box3, cổng 3850) — một chỗ cho server code của studio (actions-concept.ts; actions.ts còn bản riêng cũ).
import 'server-only';

export const SPY_API = process.env.SPY_API_URL || 'http://127.0.0.1:3850';
export async function docSpy<T>(duong: string, ms = 10000): Promise<{ ok: true; data: T } | { ok: false; loi: string }> {
  try {
    const r = await fetch(`${SPY_API}${duong}`, { cache: 'no-store', signal: AbortSignal.timeout(ms) });
    return r.ok ? { ok: true, data: (await r.json()) as T } : { ok: false, loi: `spy trả ${r.status}` };
  } catch (e) { return { ok: false, loi: `không gọi được spy (${e instanceof Error ? e.message.slice(0, 60) : 'lỗi'})` }; }
}

/** Góc spy gắn với phim (xv_phim.goc_spy) → khối "GÓC KHÁN GIẢ" cho lượt viết kịch bản (claude.ts › vietVaCham) — anh 01/11/2026: "lên kịch bản theo góc sẽ
 *  mạnh mẽ hơn". Đọc mô tả góc tươi từ spy; spy không trả lời thì vẫn dùng tên góc đã lưu. Phim chưa gắn góc → ''. */
export async function vanGocSpyKb(gan: { id: number; sp: number; loai: string; ten: string }[]): Promise<string> {
  if (!gan.length) return '';
  const moTa = new Map<number, string>();
  for (const sp of [...new Set(gan.map((g) => g.sp))]) {
    const r = await docSpy<{ id: number; mo_ta?: string }[]>(`/api/goc?sp=${sp}`);
    if (r.ok) for (const g of r.data) if (g.mo_ta) moTa.set(g.id, g.mo_ta);
  }
  return `GÓC KHÁN GIẢ (spy.on.tc — điều người xem dạng phim này thật sự thích / chán / chia sẻ; mỗi gag / cảnh nên chạm ít nhất một góc):\n${gan.map((g) => `- [${g.loai.replace(/^ai_/, '')}] ${g.ten}${moTa.get(g.id) ? `: ${moTa.get(g.id)}` : ''}`).join('\n')}`;
}
