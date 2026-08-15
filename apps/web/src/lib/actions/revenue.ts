'use server';

// Kéo lại số doanh thu NGAY, không chờ hết hạn cache.
//
// Các nguồn API (CJ · Awin · Gumroad · Directus product_stats) đọc thẳng mỗi lần render nhưng có
// cache 5-10 phút, nên vừa xảy ra một đơn thì mở trang vẫn thấy số cũ tới 10 phút mà không có
// cách nào ép. `revalidateTag` xoá đúng nhóm đó; lần render kế đọc lại từ API thật.
//
// AdSense KHÔNG nằm trong đây: nó đọc bảng `adsense_daily` do cron 09:00 UTC đổ vào, nên xoá cache
// không đẻ ra dòng mới. Nút phải nói đúng chuyện đó thay vì giả vờ làm mới cả trang.

import { revalidateTag } from 'next/cache';
import { REVENUE_TAG } from '@/lib/revenue/networks';
import { getCurrentUser } from '@/lib/auth';

export async function refreshRevenue(): Promise<{ ok: boolean; error?: string }> {
  // Mỗi lần bấm là vài lời gọi ra CJ/Awin/Gumroad — chặn ở đây để nút không thành cái vòi
  // cho người lạ bơm request qua tài khoản network của mình.
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: 'Chưa đăng nhập' };
  revalidateTag(REVENUE_TAG);
  return { ok: true };
}
