'use server';

// Báo cáo chi tiết một app App Store cho drawer sản phẩm (tab Tài sản): đọc mọi ngày product_stats của app rồi gộp bằng
// lib/tai-san/bao-cao-app.ts. Gọi khi mở drawer, không kéo theo khi dựng cả cây (10 app × 35 ngày × chiTiet là nặng vô ích).
import { getCurrentUser } from '@/lib/auth';
import { docSo } from '@/lib/products/data';
import { tomTatApp, type BaoCaoApp, type NgayApp } from '@/lib/tai-san/bao-cao-app';

export async function docBaoCaoApp(idSo: string): Promise<BaoCaoApp | { loi: string }> {
  if (!(await getCurrentUser())) return { loi: 'chưa đăng nhập' };
  if (!/^[0-9a-f-]{36}$/i.test(idSo)) return { loi: 'id sổ không hợp lệ' };
  const ds = await docSo<NgayApp>(`/items/product_stats?limit=-1&fields=date,raw_data&filter[product_id][_eq]=${idSo}&filter[platform][_eq]=app-store&sort=-date`, 600);
  return tomTatApp(ds);
}
