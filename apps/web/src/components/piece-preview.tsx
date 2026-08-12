'use client';

// PiecePreview — BÀI THẬT sẽ đăng, dựng đúng thứ người ta sẽ thấy: ai đứng tên, đăng ở đâu, lúc
// nào, caption nguyên văn, ảnh kèm. MỘT khối duy nhất, dùng ở hai chỗ:
//   · drawer bài (tab Overview) — đọc rồi mới bấm duyệt
//   · lịch plays chế độ Ngày/Tuần — xem cả ngày mai đăng những gì mà không phải mở từng cái
// Nếu không truyền `body`, component tự đi lấy (lịch tháng cố tình KHÔNG kéo body_md về cho nhẹ,
// nên ở chế độ Ngày nó tự nạp phần thân của đúng vài bài trong ngày).

import { useEffect, useState } from 'react';
import { getPieceDetail, updateContentPiece } from '@/lib/actions/content';
import { CHANNELS, tagVal, tagIds, formatOf, styleOf } from '@/lib/content-channels';
import { ChannelFavicon } from './ui/site-favicon';
import type { CalPiece } from '@/lib/data';

// Thân bài đã tải giữ lại theo id: đổi bộ lọc là danh sách dựng lại từ đầu, không có chỗ nhớ này
// thì mỗi lần lọc lại gọi lại getPieceDetail cho từng bài — chớp '…' rồi mới ra chữ, và cả cột nhảy
// theo. Nội dung bài không đổi trong lúc đang lọc nên nhớ nguyên phiên là đủ.
const bodyCache = new Map<number, string>();
/** Sửa bài xong phải quên bản cũ đi, không thì bản dựng vẫn là chữ trước lúc sửa. */
export const forgetPieceBody = (id: number) => bodyCache.delete(id);

function usePieceBody(piece: CalPiece, body?: string) {
  // Thân bài đã đi kèm danh sách (piece.body) → KHÔNG gọi gì thêm. Chỉ khi thiếu (dữ liệu cũ hoặc
  // caller truyền piece tự dựng) mới đi lấy. Trước đây mỗi khối xem trước tự gọi một server action:
  // mở /plays là 142 POST nối đuôi nhau, trang quay 38 giây.
  const inline = body ?? (piece.body || undefined);
  const [fetched, setFetched] = useState<string | null>(() => bodyCache.get(piece.id) ?? null);
  useEffect(() => {
    if (inline !== undefined) return;
    const hit = bodyCache.get(piece.id);
    if (hit !== undefined) { setFetched(hit); return; }
    let live = true;
    getPieceDetail(piece.id, piece.projectId).then((d) => {
      bodyCache.set(piece.id, d?.bodyMd ?? '');
      if (live) setFetched(d?.bodyMd ?? '');
    });
    return () => { live = false; };
  }, [inline, piece.id, piece.projectId]);
  return inline ?? fetched;
}

/** Hashtag hiện đúng như trên nền tảng (xanh, tách khỏi chữ thường) — nhìn bản dựng là biết bài đi
 *  kèm mấy tag nào, không phải soi chuỗi. Cùng một hàm cho thân bài lẫn comment. */
function withTags(text: string) {
  return text.split(/(#[\p{L}\p{N}_]+)/gu).map((part, i) => (
    part.startsWith('#') && part.length > 1
      ? <span key={i} style={{ color: 'var(--neon-blue)' }}>{part}</span>
      : <span key={i}>{part}</span>
  ));
}

export function PiecePreview({ piece, accounts = [], media = [], body, replies = [], editableReplies = false, compact = false, onOpen }: {
  piece: CalPiece;
  accounts?: Array<{ id: number; platformKey: string; handle: string | null; accountStats?: Record<string, unknown> }>;
  media?: Array<{ id: number; url: string; filename: string; width?: number | null; height?: number | null }>;
  /** Thân bài đã có sẵn (drawer) — truyền vào để khỏi gọi lại. */
  body?: string;
  /** Comment đầu (piece con gắn tag replyto:) — runner đăng ngay sau bài chính. */
  replies?: CalPiece[];
  /** Cho sửa comment tại chỗ (bấm đúp) — bật ở drawer, tắt ở lịch/feed cho khỏi lỡ tay. */
  editableReplies?: boolean;
  /** Trong lịch: chữ nhỏ hơn, ảnh nhỏ hơn, cắt bớt phần thân. */
  compact?: boolean;
  onOpen?: () => void;
}) {
  const text = usePieceBody(piece, body);

  const ch = CHANNELS.find((c) => c.id === piece.channel);
  const acct = accounts.find((x) => x.id === Number(tagVal(piece.tags, 'acct')));
  const place = tagVal(piece.tags, 'place');
  const time = tagVal(piece.tags, 'time');
  const assets = tagIds(piece.tags, 'asset').map((id) => media.find((m) => m.id === id)).filter(Boolean) as NonNullable<typeof media>;
  // Chỗ ảnh phải được GIỮ SẴN trước khi ảnh tải xong. Ảnh lười + height:auto = khung cao 0px cho tới
  // lúc tải, rồi bung ra — nội dung phía dưới bị đẩy xuống, và cú nhảy tới một bài ở xa rơi hụt vài
  // nghìn px (đo được 4055px) vì smooth-scroll không nhắm lại. Có số đo thật thì dùng, không thì lấy
  // khổ card 4/5 (khổ ảnh dựng sẵn của kho).
  const ratio = (m: { width?: number | null; height?: number | null }) => (m.width && m.height ? `${m.width}/${m.height}` : '4/5');
  const placeLabel = place.startsWith('http') ? place.replace(/^https?:\/\/(www\.)?/, '') : place;
  // KIỂU BÀI quyết định thân bài dựng ra sao — cùng một caption nhưng poll ra ô bình chọn, bài chèn
  // link ra thẻ link, thread ra N mảnh. Đây là chỗ "plan trông thế nào thì đăng thế": nhìn bản dựng
  // là biết người ta sẽ thấy gì, không phải đoán từ chữ 'format:poll' trong tag.
  const fmt = formatOf(piece.tags);
  const sty = styleOf(piece.tags);
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
  // Album/carousel: nhận theo kiểu bài, KHÔNG theo "có nhiều ảnh" — 2 ảnh trong bài photo thường
  // là hai ảnh đứng cạnh nhau, không phải thẻ lướt.
  const carousel = kind === 'album' && assets.length > 0;
  const linkUrl = kind === 'link' ? (bodyText.match(/https?:\/\/\S+|\b[a-z0-9-]+\.(com|org|net|gov|io)\/\S*/i)?.[0] ?? '') : '';

  return (
    <div onClick={onOpen}
      style={{ border: '1px solid var(--line)', borderRadius: 9, overflow: 'hidden', background: 'var(--bg-1)', cursor: onOpen ? 'pointer' : 'default' }}>
      {piece.status === 'published' && (
        // Bài đã lên rồi thì bản dựng phải nói ra: lên lúc nào, bài thật ở đâu. Không có link đã lưu
        // thì đó là một lỗ hổng thật (không ai kiểm được nó có sống không), nên nói thẳng.
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: compact ? '5px 9px' : '7px 12px',
          background: 'color-mix(in srgb, var(--ok) 14%, transparent)', borderBottom: '1px solid var(--line)', fontSize: compact ? 10.5 : 11.5 }}>
          <b style={{ color: 'var(--ok)' }}>✓ Đã đăng</b>
          {piece.publishedAt && <span style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{piece.publishedAt}</span>}
          {piece.publishUrl
            ? <a href={piece.publishUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                style={{ marginLeft: 'auto', color: 'var(--neon-blue)' }}>mở bài thật ↗</a>
            : <span style={{ marginLeft: 'auto', color: 'var(--neon-amber)' }}>chưa lưu link bài</span>}
        </div>
      )}
      <div style={{ display: 'flex', gap: compact ? 7 : 9, alignItems: 'center', padding: compact ? '7px 9px' : '10px 12px', borderBottom: '1px solid var(--line)' }}>
        {/* Favicon THẬT của nền tảng (không phải emoji): nhìn cái là biết bài này lên đâu. */}
        <ChannelFavicon channel={piece.channel} size={compact ? 24 : 34} circle title={ch?.label ?? piece.channel} />
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3, minWidth: 0 }}>
          <b style={{ fontSize: compact ? 11.5 : 13 }}>{acct ? (acct.handle ?? acct.platformKey) : <span style={{ color: 'var(--neon-amber)' }}>chưa gắn account</span>}</b>
          <span style={{ fontSize: compact ? 10 : 11, color: 'var(--fg-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {placeLabel || 'chưa chọn nơi đăng'}{time ? ` · ${time}` : ''}
          </span>
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {piece.hasLink && (
            <span title="Bài có link — nền tảng hạ reach, nhất là Facebook. Xem chi tiết ở drawer."
              style={{ fontSize: 10, padding: '1px 6px', borderRadius: 5, border: '1px solid var(--neon-blue)', color: 'var(--neon-blue)' }}>🔗 link</span>
          )}
          {sty && <span title={`Trình bày: ${sty.hint}`} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 5, border: '1px solid var(--line)', color: 'var(--fg-3)' }}>{sty.icon} {sty.label}</span>}
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
              {withTags(t)}
              <span style={{ marginLeft: 6, fontSize: 10, fontFamily: 'var(--font-mono)', color: t.length > 280 ? 'var(--bad)' : 'var(--fg-4)' }}>
                {t.length}/280
              </span>
            </div>
          ))}
        </div>
      ) : pollOpts.length >= 2 ? (
        // Poll đăng ra là ô bình chọn bấm được, không phải mấy dòng A/B/C trong caption.
        <div style={{ padding: compact ? '9px 11px' : '12px 14px', fontSize: compact ? 12 : 13.5, lineHeight: 1.5 }}>
          <div style={{ whiteSpace: 'pre-wrap', marginBottom: 8 }}>{withTags(pollAsk)}</div>
          {pollOpts.map((o, i) => (
            <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 999, padding: compact ? '4px 11px' : '6px 13px', marginBottom: 5, color: 'var(--fg-2)' }}>{o}</div>
          ))}
          <div style={{ fontSize: 10.5, color: 'var(--fg-4)' }}>{pollOpts.length} phương án · người xem bấm chọn</div>
          {pollTail && <div style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{withTags(pollTail)}</div>}
        </div>
      ) : (
        <div style={{ padding: compact ? '9px 11px' : '12px 14px', fontSize: compact ? 12 : 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap',
          ...(compact ? { display: '-webkit-box', WebkitLineClamp: 8, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' } : {}) }}>
          {text === null ? '…' : (text.trim() ? withTags(text) : <em style={{ color: 'var(--neon-amber)' }}>chưa soạn nội dung</em>)}
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
      {replies.length > 0 && (
        <div style={{ borderTop: '1px solid var(--line)', background: 'var(--bg-2)', padding: compact ? '7px 9px' : '9px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--fg-4)' }}>
            Comment đầu · runner đăng ngay sau bài
          </div>
          {replies.map((r) => <CommentBubble key={r.id} piece={r} accounts={accounts} compact={compact} editable={editableReplies} />)}
        </div>
      )}
      {carousel ? (
        // Album/carousel đăng ra là một dải LƯỚT NGANG từng thẻ một, không phải lưới ảnh xếp chồng.
        // Dựng đúng thế: scroll-snap từng thẻ, số thứ tự trên mỗi thẻ.
        <div>
          <div style={{ padding: compact ? '6px 11px 4px' : '8px 14px 5px', fontSize: 10.5, color: 'var(--fg-4)' }}>
            🎞 Carousel · {assets.length} thẻ · người xem lướt ngang
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollSnapType: 'x mandatory', padding: compact ? '0 11px 10px' : '0 14px 12px' }}>
            {assets.map((m, i) => (
              <div key={m.id} style={{ position: 'relative', flex: '0 0 auto', width: compact ? 168 : 232, scrollSnapAlign: 'start' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.filename} loading="lazy" decoding="async"
                  style={{ width: '100%', height: 'auto', aspectRatio: ratio(m), display: 'block', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg-2)' }} />
                <span style={{ position: 'absolute', top: 6, right: 6, fontSize: 10, padding: '1px 6px', borderRadius: 999,
                  background: 'rgba(0,0,0,.62)', color: '#fff', fontFamily: 'var(--font-mono)' }}>{i + 1}/{assets.length}</span>
              </div>
            ))}
          </div>
        </div>
      ) : assets.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: assets.length > 1 ? '1fr 1fr' : '1fr', gap: 2, background: 'var(--line)' }}>
          {assets.map((m) => (
            // Ảnh hiện TRỌN (contain), không cắt. `cover` + maxHeight cắt mất masthead và dòng nguồn
            // của card → duyệt nhầm cái mình không nhìn thấy. Ở lịch (compact) hạ trần chiều cao,
            // vẫn contain nên chỉ nhỏ đi chứ không mất phần nào.
            // eslint-disable-next-line @next/next/no-img-element
            // Ảnh card là PNG 1080×1350 (~300 kB): tải hết cả tháng là ~5 MB không ai xem tới.
            // lazy = chỉ tải khi cuộn tới gần.
            <img key={m.id} src={m.url} alt={m.filename} loading="lazy" decoding="async"
              style={{ width: '100%', height: 'auto', aspectRatio: ratio(m), maxHeight: compact ? 320 : undefined, objectFit: 'contain', display: 'block', background: 'var(--bg-2)' }} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Comment đầu: cùng là một content_piece (tag replyto:<id>), nên vẫn có account riêng, vẫn duyệt
 *  được, vẫn kiểm link được — chỉ khác chỗ đứng. Dựng thụt vào như trên Facebook. */
function CommentBubble({ piece, accounts, compact, editable = false }: {
  piece: CalPiece;
  accounts: Array<{ id: number; platformKey: string; handle: string | null }>;
  compact: boolean;
  editable?: boolean;
}) {
  const fetched = usePieceBody(piece);
  // Sửa xong thì giữ bản mới tại chỗ: piece.body của trang chỉ đổi sau khi router.refresh xong.
  const [local, setLocal] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = local ?? fetched;

  const save = async (v: string) => {
    setEditing(false);
    if (v === (text ?? '')) return;
    setSaving(true);
    setLocal(v);
    bodyCache.set(piece.id, v);
    await updateContentPiece(piece.id, piece.projectId, { bodyMd: v });
    setSaving(false);
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <ChannelFavicon channel={piece.channel} size={compact ? 18 : 22} circle />
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 12, padding: compact ? '6px 10px' : '8px 12px', minWidth: 0, flex: 1 }}
        onDoubleClick={editable ? () => setEditing(true) : undefined}
        title={editable ? 'Bấm đúp để sửa comment' : undefined}>
        <b style={{ fontSize: compact ? 11 : 12 }}>{acctLabel(piece, accounts)}</b>
        {editing ? (
          <textarea autoFocus defaultValue={text ?? ''} rows={3} disabled={saving}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => save(e.target.value)}
            style={{ width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line)',
              background: 'var(--bg-0)', color: 'var(--fg-1)', fontSize: compact ? 11.5 : 13, lineHeight: 1.5, resize: 'vertical' }} />
        ) : (
          <div style={{ fontSize: compact ? 11.5 : 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', marginTop: 2, userSelect: 'text' }}>
            {text === null ? '…' : (text.trim() ? withTags(text) : <em style={{ color: 'var(--neon-amber)' }}>chưa soạn nội dung</em>)}
          </div>
        )}
      </div>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end', flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>#{piece.id}</span>
        {/* Copy riêng cho comment: nó là đoạn phải dán sang ô comment của nền tảng, không dán chung
            với caption bài chính được. */}
        <button type="button" title="Copy nội dung comment" disabled={!text}
          onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(text ?? ''); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
          style={{ fontSize: 10, padding: '1px 6px', borderRadius: 5, cursor: 'pointer', border: '1px solid var(--line)',
            background: 'transparent', color: copied ? 'var(--ok)' : 'var(--fg-3)' }}>{copied ? '✓ đã copy' : 'copy'}</button>
      </span>
    </div>
  );
}

const acctLabel = (p: CalPiece, accounts: Array<{ id: number; platformKey: string; handle: string | null }>) => {
  const a = accounts.find((x) => x.id === Number(tagVal(p.tags, 'acct')));
  return a?.handle ?? a?.platformKey ?? 'chưa gắn account';
};
