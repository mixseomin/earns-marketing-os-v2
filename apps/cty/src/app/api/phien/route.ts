// Cổng kiểm phiên cho nginx auth_request (vp.on.tc đứng sau): có phiên mos2-session hợp lệ → 204, không → 401.
// Văn phòng pixel (pixel-agents) không có đăng nhập riêng và ai vào cũng sửa được layout, nên chặn ở cửa bằng cổng này.
import { getCurrentUser } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function GET() {
  const me = await getCurrentUser();
  return new Response(null, { status: me ? 204 : 401 });
}
