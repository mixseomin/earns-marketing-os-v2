'use client';

// Nguồn dữ liệu "đang chuẩn bị đăng" cho rail Toàn cảnh trên /plays.
//
// TRƯỚC ĐÂY chỗ này còn một dock nổi góc màn hình. Bỏ rồi: cùng một việc hiện hai chỗ = hai thông
// báo cho một sự kiện, và dock là thẻ <a> nên bấm vào là nhảy trang, mất chỗ đang đọc. Một surface
// duy nhất, bấm là cuộn tới bài ngay trong trang.

import { useEffect, useState } from 'react';
import { getPlanLive, type PlanLive } from '@/lib/actions/plan-live';

const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s trước`;
  return `${Math.round(s / 60)} phút trước`;
};

/** Cùng một nguồn cho dock nổi và mục "đang chuẩn bị đăng" trên rail Toàn cảnh — hai chỗ đọc hai
 *  đường thì sẽ có lúc lệch nhau, mà đây là thứ dùng để biết máy đang làm gì. */
export function usePlanLive(projectId?: string): PlanLive[] {
  const [live, setLive] = useState<PlanLive[]>([]);
  const [, force] = useState(0);

  useEffect(() => {
    let on = true;
    const pull = () => { getPlanLive(projectId).then((r) => { if (on) setLive(r); }).catch(() => {}); };
    pull();
    const poll = setInterval(pull, 12000);
    // Đồng hồ riêng cho chữ "2 phút trước": không có nó thì số phút đứng im giữa hai lần poll.
    const tick = setInterval(() => force((n) => n + 1), 15000);
    return () => { on = false; clearInterval(poll); clearInterval(tick); };
  }, [projectId]);
  return live;
}
