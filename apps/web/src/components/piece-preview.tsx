'use client';

// PiecePreview — BÀI THẬT sẽ đăng, dựng đúng thứ người ta sẽ thấy: ai đứng tên, đăng ở đâu, lúc
// nào, caption nguyên văn, ảnh kèm. MỘT khối duy nhất, dùng ở hai chỗ:
//   · drawer bài (tab Overview) — đọc rồi mới bấm duyệt
//   · lịch plays chế độ Ngày/Tuần — xem cả ngày mai đăng những gì mà không phải mở từng cái
// Nếu không truyền `body`, component tự đi lấy (lịch tháng cố tình KHÔNG kéo body_md về cho nhẹ,
// nên ở chế độ Ngày nó tự nạp phần thân của đúng vài bài trong ngày).

import { useEffect, useState } from 'react';
import { getPieceDetail } from '@/lib/actions/content';
import { CHANNELS, tagVal, tagIds, formatOf } from '@/lib/content-channels';
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
  // KIỂU BÀI quyết định thân bài dựng ra sao — cùng một caption nhưng poll ra ô bình chọn, bài chèn
  // link ra thẻ link, thread ra N mảnh. Đây là chỗ "plan trông thế nào thì đăng thế": nhìn bản dựng
  // là biết người ta sẽ thấy gì, không phải đoán từ chữ 'format:poll' trong tag.
  const fmt = formatOf(piece.tags);
  const kind = fmt?.id ?? (piece.channel === 'twitter-thread' ? 'thread' : '');
  const bodyText = text?.trim() ?? '';
  const tweets = kind === 'thread' && bodyText ? bodyText.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean) : null;
  // Poll: khối dòng 'A. …' / '1) …' là phương án; chữ TRƯỚC khối là câu hỏi, chữ SAU khối vẫn nằm
  // sau (đó là thứ tự người ta đọc thật). Gom hết chữ lên trên là đảo mất câu chốt của caption.
  const isOpt = (l: string) => /^\s*([A-Da-d]|[1-9])[.)]\s+\S/.test(l);
  const lines = kind === 'poll' ? bodyText.split('\n') : [];
  const optFrom = lines.findIndex(isOpt);
  let optTo = -1;
  for (let i = lines.length - 1; i >= 0; i--) if (isOpt(lines[i] ?? '')) { optTo = i; break; }
  const pollOpts = optFrom >= 0 ? lines.slice(optFrom, optTo + 1).filter(isOpt).map((l) => l.replace(/^\s*([A-Da-d]|[1-9])[.)]\s+/, '')) : [];
  const pollAsk = pollOpts.length >= 2 ? lines.slice(0, optFrom).join('\n').trim() : '';
  const pollTail = pollOpts.length >= 2 ? lines.slice(optTo + 1).join('\n').trim() : '';
  const linkUrl = kind === 'link' ? (bodyText.match(/https?:\/\/\S+|\b[a-z0-9-]+\.(com|org|net|gov|io)\/\S*/i)?.[0] ?? '') : '';

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
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {fmt && <span title={`Kiểu bài: ${fmt.label}`} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 5, border: '1px solid var(--line)', color: 'var(--fg-3)' }}>{fmt.icon} {fmt.label}</span>}
          <span style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>#{piece.id}</span>
        </span>
      </div>
      {tweets ? (
        // Thread X đăng ra là N tweet RỜI, không phải một khối. Dựng đúng số mảnh + đếm ký tự vì
        // tweet quá 280 là hỏng lúc đăng, mà nhìn khối liền thì không ai thấy.
        <div style={{ padding: compact ? '7px 9px' : '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tweets.map((t, i) => (
            <div key={i} style={{ borderLeft: '2px solid var(--line)', paddingLeft: 9, fontSize: compact ? 12 : 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {t}
              <span style={{ marginLeft: 6, fontSize: 10, fontFamily: 'var(--font-mono)', color: t.length > 280 ? 'var(--bad)' : 'var(--fg-4)' }}>
                {t.length}/280
              </span>
            </div>
          ))}
        </div>
      ) : pollOpts.length >= 2 ? (
        // Poll đăng ra là ô bình chọn bấm được, không phải mấy dòng A/B/C trong caption.
        <div style={{ padding: compact ? '9px 11px' : '12px 14px', fontSize: compact ? 12 : 13.5, lineHeight: 1.5 }}>
          <div style={{ whiteSpace: 'pre-wrap', marginBottom: 8 }}>{pollAsk}</div>
          {pollOpts.map((o, i) => (
            <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 999, padding: compact ? '4px 11px' : '6px 13px', marginBottom: 5, color: 'var(--fg-2)' }}>{o}</div>
          ))}
          <div style={{ fontSize: 10.5, color: 'var(--fg-4)' }}>{pollOpts.length} phương án · người xem bấm chọn</div>
          {pollTail && <div style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{pollTail}</div>}
        </div>
      ) : (
        <div style={{ padding: compact ? '9px 11px' : '12px 14px', fontSize: compact ? 12 : 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap',
          ...(compact ? { display: '-webkit-box', WebkitLineClamp: 8, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' } : {}) }}>
          {text === null ? '…' : (text.trim() || <em style={{ color: 'var(--neon-amber)' }}>chưa soạn nội dung</em>)}
        </div>
      )}
      {linkUrl && (
        // Bài chèn link: nền tảng tự bung thẻ xem trước, và CHÍNH nó là thứ người ta bấm. Dựng thẻ
        // ở đây để lúc duyệt thấy luôn link nào sẽ bung, không phải dò trong caption.
        <div style={{ margin: compact ? '0 11px 9px' : '0 14px 12px', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-2)' }}>
          <div style={{ padding: compact ? '7px 9px' : '9px 11px' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--fg-4)' }}>{linkUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</div>
            <div style={{ fontSize: compact ? 11.5 : 13, fontWeight: 600, marginTop: 2 }}>{piece.title}</div>
            <div style={{ fontSize: 10.5, color: 'var(--fg-4)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{linkUrl}</div>
          </div>
        </div>
      )}
      {assets.length > 1 && (
        <div style={{ padding: compact ? '0 11px 6px' : '0 14px 8px', fontSize: 10.5, color: 'var(--fg-4)' }}>
          {assets.length} ảnh · người xem lướt ngang
        </div>
      )}
      {assets.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: assets.length > 1 ? '1fr 1fr' : '1fr', gap: 2, background: 'var(--line)' }}>
          {assets.map((m) => (
            // Ảnh hiện TRỌN (contain), không cắt. `cover` + maxHeight cắt mất masthead và dòng nguồn
            // của card → duyệt nhầm cái mình không nhìn thấy. Ở lịch (compact) hạ trần chiều cao,
            // vẫn contain nên chỉ nhỏ đi chứ không mất phần nào.
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m.id} src={m.url} alt={m.filename}
              style={{ width: '100%', height: 'auto', maxHeight: compact ? 320 : undefined, objectFit: 'contain', display: 'block', background: 'var(--bg-2)' }} />
          ))}
        </div>
      )}
    </div>
  );
}
