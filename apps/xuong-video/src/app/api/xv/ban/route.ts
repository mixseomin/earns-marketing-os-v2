// Mã bản build hiện tại cho TheoDoiBan (GET thường, không phải server action — tab cũ vẫn gọi được sau deploy).
import { maBan } from '@/lib/ban';

export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({ ban: maBan() }, { headers: { 'cache-control': 'no-store' } });
}
