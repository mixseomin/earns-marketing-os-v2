'use client';

// Nút "Kéo lại" cho /revenue — bấm là đọc lại API ngay, không chờ hết cache 5-10 phút.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { refreshRevenue } from '@/lib/actions/revenue';
import { Spinner } from './ui';

const DEFAULT_TITLE = 'Xoá cache CJ · Awin · Gumroad · product_stats rồi đọc lại API ngay. AdSense KHÔNG kéo được ở đây — nó đến từ cron 09:00 UTC đổ vào bảng adsense_daily.';

/** `title` đổi được vì mỗi màn kéo một tập nguồn khác nhau — /revenue kéo cả Gumroad, backend
 *  network chỉ có CJ/Awin. Nút nói sai nguồn thì người bấm chờ số không bao giờ tới. */
export function RevenueRefresh({ title = DEFAULT_TITLE }: { title?: string } = {}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <button
      type="button"
      disabled={busy}
      title={title}
      onClick={() => start(async () => {
        const r = await refreshRevenue();
        if (!r.ok) { setMsg(r.error ?? 'lỗi'); return; }
        setMsg(null);
        // revalidateTag mới chỉ xoá cache. Phải refresh để server render lại thì mới thực sự
        // gọi API — thiếu bước này thì bấm xong màn hình vẫn y nguyên số cũ.
        router.refresh();
      })}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 9px', fontSize: 11, fontFamily: 'var(--font-mono)',
        background: 'transparent', color: busy ? 'var(--fg-3)' : 'var(--fg-1)',
        border: '1px solid var(--line)', borderRadius: 4,
        cursor: busy ? 'default' : 'pointer', whiteSpace: 'nowrap',
      }}
    >
      {busy ? <Spinner size="xs" /> : <span aria-hidden>↻</span>}
      {msg ?? (busy ? 'Đang kéo…' : 'Kéo lại')}
    </button>
  );
}
