'use client';

// Dock "đang làm gì lúc này" cho /plays. Lượt tại chỗ (vào nhóm đọc rồi comment) chạy vài phút bên
// ngoài trang này; không có chỗ nào nói đang chạy thì nhìn lịch tưởng chưa ai đụng, và nếu lượt chết
// giữa chừng cũng không ai biết nó chết ở bước nào. Dock chỉ hiện khi CÓ lượt đang chạy, nên lúc
// bình thường nó vô hình - không chiếm chỗ của lịch.

import { useEffect, useState } from 'react';
import { getPlanLive, type PlanLive } from '@/lib/actions/plan-live';
import { placeName } from '@/lib/content-channels';

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

export function PlanLiveDock({ projectId }: { projectId?: string }) {
  const live = usePlanLive(projectId);
  if (!live.length) return null;

  return (
    <div style={{ position: 'fixed', left: 16, bottom: 16, zIndex: 60, display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 420 }}>
      {live.map((l) => (
        <a key={l.pieceId} href={`/p/${l.projectId}/plays?piece=${l.pieceId}`}
          style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 11px', borderRadius: 8, textDecoration: 'none',
          background: 'var(--bg-2)', border: '1px solid var(--neon-blue)', boxShadow: '0 6px 20px rgba(0,0,0,.35)', fontSize: 12 }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--neon-blue)', flexShrink: 0,
            animation: 'planLivePulse 1.4s ease-in-out infinite' }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ color: 'var(--fg-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <b>{l.stage}</b>
              <span style={{ color: 'var(--fg-3)' }}> · {placeName(l.place) || l.title}</span>
            </div>
            <div style={{ color: 'var(--fg-3)', fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>
              #{l.pieceId} · lịch {l.date} · {ago(l.at)}{l.note ? ` · ${l.note}` : ''}
            </div>
          </div>
        </a>
      ))}
      <style>{'@keyframes planLivePulse{0%,100%{opacity:1}50%{opacity:.25}}'}</style>
    </div>
  );
}
