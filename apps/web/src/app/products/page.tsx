// /products đã gộp vào trang chủ › Tài sản (anh chốt 05/10/2026: sản phẩm là tài sản, một bề mặt với website và shop).
// Giữ route để link cũ không 404.
import { redirect } from 'next/navigation';

export default function ProductsRoute() {
  redirect('/?tab=taisan');
}
