// ĐỌC SỐ LIỆU AGENTS CỦA cty.on.tc DẠNG DỮ LIỆU (anh 20/11/2026: cấm nhúng nguyên trang cty vào widget — MOS2 lấy dữ liệu rồi tự vẽ).
// Cổng phía cty: repo cty src/app/api/agents/route.ts (dữ liệu src/lib/agents.ts). Hai app cùng chạy trên box3 → gọi thẳng 127.0.0.1:3860,
// chuyển kèm phiên mos2-session của người đang xem để cty kiểm phiên + quyền y như trên trang cty (không có khoá riêng nào giữa hai bên).
import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import type { DapCty } from './cty-agents-kieu';

export const CTY_NOI = process.env.CTY_NOI || 'http://127.0.0.1:3860';

async function cookiePhien(): Promise<string> {
  const raw = (await headers()).get('cookie') || '';
  return Array.from(raw.matchAll(/(?:^|;\s*)(mos2-session=[^;]+)/g)).map((m) => m[1]).join('; ');
}
/** Một lượt hỏi cty (máy chủ). Lỗi mạng / cty trả lỗi → { ok: false, loi } đủ câu để ô widget báo to, không nuốt. */
export async function hoiCty<T>(duong: string, init?: { method: 'POST'; body: unknown }): Promise<DapCty<T>> {
  try {
    const r = await fetch(`${CTY_NOI}${duong}`, {
      method: init?.method ?? 'GET', cache: 'no-store', signal: AbortSignal.timeout(30_000),
      headers: { cookie: await cookiePhien(), ...(init ? { 'content-type': 'application/json' } : {}) }, body: init ? JSON.stringify(init.body) : undefined,
    });
    const j = await r.json().catch(() => null) as ({ loi?: string; admin?: boolean; luc?: string; du?: T; ok?: boolean } | null);
    if (!r.ok) return { ok: false, loi: j?.loi ?? `cty.on.tc trả ${r.status}` };
    return { ok: true, admin: !!j?.admin, luc: j?.luc ?? '', du: (j?.du ?? j) as T };
  } catch (e) { return { ok: false, loi: `Không gọi được cty.on.tc (${CTY_NOI}): ${(e as Error).message}` }; }
}
/** Đọc một phần — React cache: hai widget cùng màn đọc cùng phần thì chỉ hỏi cty một lần. */
export const docAgents = cache(<T,>(phan: string, them = '') => hoiCty<T>(`/api/agents?phan=${phan}${them}`));
