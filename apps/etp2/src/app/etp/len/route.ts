// GET /etp/len → mã nhật ký lên camp (lib/etp-nhat-ky-len maNhatKyLen). Trang hỏi mỗi 5 giây, KHÔNG chờ lượt đồng bộ kho:
// có lệnh lên / kết quả lên mới từ bất kỳ đường nào → router.refresh, nút ▶ dòng đó khoá ngay (anh 25/11/2026).
import { getCurrentUser } from '@/lib/auth';
import { maNhatKyLen } from '@/lib/etp-nhat-ky-len';
export const dynamic = 'force-dynamic';
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return new Response('', { status: 401 });
  return new Response(maNhatKyLen(), { headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } });
}
