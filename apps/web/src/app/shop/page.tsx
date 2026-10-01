// /shop — backend vận hành cửa hàng (anh chốt 01/10/2026: mellowstep cần quản lý đơn / cửa hàng / sản phẩm↔NCC / luồng NCC /
// vận đơn ở MOS2, giống Shopdy). Mặt tiền + thu tiền ở WooCommerce; mọi thứ sau khi khách trả tiền ở đây.
// Dữ liệu: lib/shop/doc.ts (sổ shop_*), máy chạy: lib/shop/dong-bo.ts (webhook Woo + /api/cron/shop mỗi 10 phút).
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { docShop } from '@/lib/shop/doc';
import { ShopView } from '@/components/shop-view';

export const dynamic = 'force-dynamic';

export default async function ShopPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/shop');
  if (me.role !== 'admin') redirect('/');
  const { don, bienThe, cuaHang } = await docShop();
  return <ShopView don={don} bienThe={bienThe} cuaHang={cuaHang} />;
}
