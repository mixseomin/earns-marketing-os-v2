'use client';
// Ngày nhận dự kiến + cam kết giao hàng — MỘT khối cho trang sản phẩm, checkout, trang cảm ơn, trang theo dõi (@mos2/shop/giao).
// Ngày tính ở trình duyệt theo giờ New York (máy chủ và khách lệch ngày thì không sao: suppressHydrationWarning).
import { camKetGiao, duKienGiao, khoangUS, type CauHinhGiao } from '@mos2/shop/giao';

export function DuKien({ g, nhan = 'Order today, get it', tu }: { g: CauHinhGiao; nhan?: string; tu?: string }) {
  return <div className="du-kien"><span aria-hidden="true">📦</span><span suppressHydrationWarning>{nhan} <b>{khoangUS(duKienGiao(g, tu ? new Date(tu) : new Date()))}</b></span></div>;
}

export function CamKet({ g }: { g: CauHinhGiao }) {
  return <div className="dam-bao"><span aria-hidden="true">🛡️</span><span>{camKetGiao(g)}</span></div>;
}
