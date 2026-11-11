// GET /etp/huy → Huy (Kỹ sư Ethopex) đang làm việc không (anh 12/11/2026: "Huy đang nhận việc và làm thì icon 💬 chạy chuyển động, xong thì dừng + nháy 1 cái").
// Đọc thẳng hàng việc của Huy trên box3 (/var/lib/cty/etp-sua.json — worker/tho-may-viec.mjs ghi, etp2 chạy cùng máy). Nút hỏi mỗi 3 giây.
import fs from 'node:fs';
import { getCurrentUser } from '@/lib/auth';
export const dynamic = 'force-dynamic';
const TEP = `${process.env.CTY_DATA_DIR || '/var/lib/cty'}/etp-sua.json`;
type Viec = { id: number; khoa: string; chu: string; tt: string; xong?: string };
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return new Response('', { status: 401 });
  let hang: Viec[] = [];
  try { hang = JSON.parse(fs.readFileSync(TEP, 'utf8')).hang ?? []; } catch { /* chưa có hàng = không làm gì */ }
  const dang = hang.find((v) => v.tt === 'dang');
  const xong = hang.reduce<string | null>((a, v) => (v.xong && (!a || v.xong > a) ? v.xong : a), null);
  return Response.json({ dang: dang ? { id: dang.id, chu: String(dang.chu).replace(/<[^>]+>/g, '').slice(0, 160) } : null, xong },
    { headers: { 'cache-control': 'no-store' } });
}
