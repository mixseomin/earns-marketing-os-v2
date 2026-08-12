'use client';

// PiecePreview — BÀI THẬT sẽ đăng, dựng đúng thứ người ta sẽ thấy: ai đứng tên, đăng ở đâu, lúc
// nào, caption nguyên văn, ảnh kèm. MỘT khối duy nhất, dùng ở hai chỗ:
//   · drawer bài (tab Overview) — đọc rồi mới bấm duyệt
//   · lịch plays chế độ Ngày/Tuần — xem cả ngày mai đăng những gì mà không phải mở từng cái
// Nếu không truyền `body`, component tự đi lấy (lịch tháng cố tình KHÔNG kéo body_md về cho nhẹ,
// nên ở chế độ Ngày nó tự nạp phần thân của đúng vài bài trong ngày).

import { useEffect, useState } from 'react';
import { getPieceDetail } from '@/lib/actions/content';
import { CHANNELS, tagVal, tagIds } from '@/lib/content-channels';
import type { CalPiece } from '@/lib/data';

export function PiecePreview({ piece, accounts = [], media = [], body, compact = false, onOpen }: {
  piece: CalPiece;
  accounts?: Array<{ id: number; platformKey: string; handle: string | null; accountStats?: Record<string, unknown> }>;
  media?: Array<{ id: number; url: string; filename: string }>;
  /** Thân bài đã có sẵn (drawer) — truyền vào để khỏi gọi lại. */
  body?: string;
  /** Trong lịch: chữ nhỏ hơn, ảnh nhỏ hơn, cắt bớt phần thân. */
  compact?: boolean;
  onOpen?: () => void;
}) {
  const [fetched, setFetched] = useState<string | null>(null);
  const text = body ?? fetched;

  useEffect(() => {
    if (body !== undefined) return;
    let live = true;
    getPieceDetail(piece.id, piece.projectId).then((d) => { if (live) setFetched(d?.bodyMd ?? ''); });
    return () => { live = false; };
  }, [body, piece.id, piece.projectId]);

  const ch = CHANNELS.find((c) => c.id === piece.channel);
  const acct = accounts.find((x) => x.id === Number(tagVal(piece.tags, 'acct')));
  const place = tagVal(piece.tags, 'place');
  const time = tagVal(piece.tags, 'time');
  const assets = tagIds(piece.tags, 'asset').map((id) => media.find((m) => m.id === id)).filter(Boolean) as Array<{ id: number; url: string; filename: string }>;
  const placeLabel = place.startsWith('http') ? place.replace(/^https?:\/\/(www\.)?/, '') : place;

  return (
    <div onClick={onOpen}
      style={{ border: '1px solid var(--line)', borderRadius: 9, overflow: 'hidden', background: 'var(--bg-1)', cursor: onOpen ? 'pointer' : 'default' }}>
      <div style={{ display: 'flex', gap: compact ? 7 : 9, alignItems: 'center', padding: compact ? '7px 9px' : '10px 12px', borderBottom: '1px solid var(--line)' }}>
        <span style={{ width: compact ? 24 : 34, height: compact ? 24 : 34, borderRadius: '50%', background: 'var(--bg-2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', fontSize: compact ? 11 : 15, flexShrink: 0 }}>{ch?.icon ?? '📝'}</span>
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3, minWidth: 0 }}>
          <b style={{ fontSize: compact ? 11.5 : 13 }}>{acct ? (acct.handle ?? acct.platformKey) : <span style={{ color: 'var(--neon-amber)' }}>chưa gắn account</span>}</b>
          <span style={{ fontSize: compact ? 10 : 11, color: 'var(--fg-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {placeLabel || 'chưa chọn nơi đăng'}{time ? ` · ${time}` : ''}
          </span>
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>#{piece.id}</span>
      </div>
      <div style={{ padding: compact ? '9px 11px' : '12px 14px', fontSize: compact ? 12 : 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap',
        ...(compact ? { display: '-webkit-box', WebkitLineClamp: 8, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' } : {}) }}>
        {text === null ? '…' : (text.trim() || <em style={{ color: 'var(--neon-amber)' }}>chưa soạn nội dung</em>)}
      </div>
      {assets.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: assets.length > 1 ? '1fr 1fr' : '1fr', gap: 2, background: 'var(--line)' }}>
          {assets.map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m.id} src={m.url} alt={m.filename}
              style={{ width: '100%', maxHeight: compact ? 150 : 340, objectFit: 'cover', display: 'block', background: 'var(--bg-2)' }} />
          ))}
        </div>
      )}
    </div>
  );
}
