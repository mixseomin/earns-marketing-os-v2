// KẾT NỐI KHO SPY (DB riêng trên box3) — một pool nhỏ giữ suốt tiến trình, dùng chung cho mọi server action etp2 đọc kho Spy
// (Phim đối thủ: actions/etp-doi-thu.ts · Mẫu creative: actions/etp-mau-cr.ts). Không phải tệp 'use server' → export được hàm thường.
import { readFileSync } from 'node:fs';

async function taoSpy() {
  let url = process.env.SPY_DATABASE_URL;
  if (!url) url = readFileSync('/root/.secrets/spy.env', 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='))?.slice(13).replace(/^["']|["']$/g, '');
  if (!url) throw new Error('không thấy kết nối kho Spy (/root/.secrets/spy.env)');
  return (await import('postgres')).default(url, { max: 3, prepare: false, connect_timeout: 5, idle_timeout: 120 });
}
export type Pg = Awaited<ReturnType<typeof taoSpy>>;
const g = globalThis as unknown as { __etp2_spy?: Promise<Pg> };
export const spy = () => (g.__etp2_spy ??= taoSpy().catch((e) => { g.__etp2_spy = undefined; throw e; }));
