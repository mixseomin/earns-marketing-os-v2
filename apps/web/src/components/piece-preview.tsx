'use client';

// PiecePreview — BÀI THẬT sẽ đăng, dựng đúng thứ người ta sẽ thấy: ai đứng tên, đăng ở đâu, lúc
// nào, caption nguyên văn, ảnh kèm. MỘT khối duy nhất, dùng ở hai chỗ:
//   · drawer bài (tab Overview) — đọc rồi mới bấm duyệt
//   · lịch plays chế độ Ngày/Tuần — xem cả ngày mai đăng những gì mà không phải mở từng cái
// Nếu không truyền `body`, component tự đi lấy (lịch tháng cố tình KHÔNG kéo body_md về cho nhẹ,
// nên ở chế độ Ngày nó tự nạp phần thân của đúng vài bài trong ngày).

import { FormatIcon } from './ui';
import { useEffect, useState } from 'react';
import { getPieceDetail, updateContentPiece } from '@/lib/actions/content';
import { CHANNELS, tagVal, tagIds, formatOf, styleOf, fbButtonOf, seriesOf, isVideoMedia, placeName, isOnSiteFormat, justPosted, acctGap } from '@/lib/content-channels';
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
  accounts?: Array<{ id: number; platformKey: string; handle: string | null; status?: string; accountStats?: Record<string, unknown> }>;
  media?: Array<{ id: number; url: string; filename: string; width?: number | null; height?: number | null; kind?: string; mimeType?: string | null }>;
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
  const placeShort = placeName(place);
  // KIỂU BÀI quyết định thân bài dựng ra sao — cùng một caption nhưng poll ra ô bình chọn, bài chèn
  // link ra thẻ link, thread ra N mảnh. Đây là chỗ "plan trông thế nào thì đăng thế": nhìn bản dựng
  // là biết người ta sẽ thấy gì, không phải đoán từ chữ 'format:poll' trong tag.
  const fmt = formatOf(piece.tags);
  const sty = styleOf(piece.tags);
  const kind = fmt?.id ?? (piece.channel === 'twitter-thread' ? 'thread' : '');
  // Việc làm TẠI CHỖ (comment / tương tác / share lại): thẻ này không phải bài viết sẵn mà là KẾ
  // HOẠCH — nội dung chỉ có sau khi vào nhóm, đọc bài người ta hỏi gì rồi mới viết. Dựng khác hẳn
  // bài đăng để không ai tưởng đây là chữ sẽ dán nguyên vào ô comment.
  //
  // TRỪ "comment đầu" (tag replyto:<id>): bài gốc là BÀI CỦA MÌNH, mình biết trước nó viết gì nên
  // soạn sẵn câu comment là đúng. Chỉ comment vào bài NGƯỜI KHÁC mới phải chờ tới lúc đọc bài họ.
  const ownThread = !!tagVal(piece.tags, 'replyto');
  // Thẻ do /plan/result tự đẻ sau mỗi comment: cùng kiểu 'engage' nhưng việc khác hẳn — quay lại
  // đúng thread mình vừa nói, không phải đi tương tác dạo trong nhóm.
  const threadBack = !!tagVal(piece.tags, 'thread');
  const onSite = isOnSiteFormat(kind) && !ownThread;
  // Thân của thẻ tại-chỗ có ba nửa, cắt theo hai mốc do API ghi: "CHUẨN BỊ (" (/plan/prepare) và
  // "— ĐÃ COMMENT/TƯƠNG TÁC" (/plan/result). Kế hoạch → bài đã chọn → cái đã xảy ra. Trộn chung một
  // khối thì mở thẻ ra không phân biệt được dự định với kết quả, mà đó đúng là thứ cần duyệt.
  const prepAt = onSite && text ? text.indexOf('CHUẨN BỊ (') : -1;
  const doneAt = onSite && text ? text.search(/—\s*ĐÃ (COMMENT|TƯƠNG TÁC)/) : -1;
  const cut = (from: number, to: number) => (text ?? '').slice(from, to < 0 ? undefined : to).trim();
  const draftText = onSite ? cut(0, prepAt >= 0 ? prepAt : doneAt) : '';
  const prepText = prepAt >= 0 ? cut(prepAt, doneAt).replace(/^CHUẨN BỊ \([^)]*\):\s*/, '') : '';
  const doneText = doneAt >= 0 ? cut(doneAt, -1).replace(/^—\s*/, '') : '';
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

  // Chưa có account đăng được = bài này mới chỉ là DỰ ĐỊNH, không phải việc làm được hôm nay. Toàn
  // cảnh phải phân biệt ngay bằng mắt, không thì lịch đầy bài trông như đã sẵn sàng cả. Bài ĐÃ ĐĂNG
  // không bao giờ mờ (chuyện account của nó xong từ lâu), và lúc mở drawer để duyệt (editableReplies)
  // cũng không mờ — đang đọc kỹ thì làm mờ chữ là cản.
  const noAcct = piece.status === 'published' || editableReplies ? null : acctGap(piece, accounts);

  return (
    <div onClick={onOpen} title={noAcct ? `Chưa chạy được: ${noAcct}` : undefined}
      style={{ border: onSite ? '1px dashed color-mix(in srgb, var(--fg-4) 70%, transparent)' : '1px solid var(--line)',
        borderRadius: 9, overflow: 'hidden', background: 'var(--bg-1)', cursor: onOpen ? 'pointer' : 'default',
        opacity: noAcct ? 0.42 : 1, filter: noAcct ? 'saturate(.55)' : undefined }}>
      {piece.status !== 'published' && tagVal(piece.tags, 'platsched') && (
        // Bài đã nằm trong lịch của chính nền tảng: FB tự đăng kể cả lúc máy mình tắt. Phải nói ra,
        // vì nhìn giống hệt bài chờ runner mà việc cần làm thì khác hẳn.
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: compact ? '5px 9px' : '7px 12px',
          background: 'color-mix(in srgb, var(--neon-cyan) 12%, transparent)', borderBottom: '1px solid var(--line)', fontSize: compact ? 10.5 : 11.5 }}>
          <b style={{ color: 'var(--neon-cyan)' }}>⏳ FB đã nhận lịch</b>
          <span style={{ color: 'var(--fg-3)' }}>FB tự đăng đúng giờ</span>
          {replies.length > 0 && <span style={{ marginLeft: 'auto', color: 'var(--neon-amber)' }}>comment đầu vẫn phải đăng tay</span>}
        </div>
      )}
      {piece.status === 'published' && (
        // Bài đã lên rồi thì bản dựng phải nói ra: lên lúc nào, bài thật ở đâu. Không có link đã lưu
        // thì đó là một lỗ hổng thật (không ai kiểm được nó có sống không), nên nói thẳng.
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: compact ? '5px 9px' : '7px 12px',
          background: 'color-mix(in srgb, var(--ok) 14%, transparent)', borderBottom: '1px solid var(--line)', fontSize: compact ? 10.5 : 11.5 }}>
          <b style={{ color: 'var(--ok)' }}>✓ Đã đăng</b>
          {piece.publishedAt && <span style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{piece.publishedAt}</span>}
          {justPosted(piece.publishedAt) && (
            // Lượt vừa chạy xong: chấm nháy để mở lịch ra là thấy ngay, khỏi dò theo cột giờ.
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--ok)', fontSize: 10 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--ok)', animation: 'freshPulse 1.2s ease-in-out infinite' }} />
              vừa đăng
              <style>{'@keyframes freshPulse{0%,100%{opacity:1}50%{opacity:.2}}'}</style>
            </span>
          )}
          {piece.publishUrl
            ? <a href={piece.publishUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                style={{ marginLeft: 'auto', color: 'var(--neon-blue)' }}>mở bài thật ↗</a>
            : <span style={{ marginLeft: 'auto', color: 'var(--neon-amber)' }}>chưa lưu link bài</span>}
        </div>
      )}
      <div style={{ display: 'flex', gap: compact ? 7 : 9, alignItems: 'center', padding: compact ? '7px 9px' : '10px 12px', borderBottom: '1px solid var(--line)' }}>
        {/* Favicon THẬT của nền tảng (không phải emoji): nhìn cái là biết bài này lên đâu. */}
        <ChannelFavicon channel={piece.channel} size={compact ? 24 : 34} circle title={ch?.label ?? piece.channel} />
        {/* NƠI ĐĂNG đứng đầu, tài khoản xuống dòng phụ. Trước đây ngược lại: mọi thẻ trong ngày
            đều in đậm cùng một tên account ("MilitaryCalc") nên nhìn cả cột thấy y hệt nhau, còn
            thứ THẬT SỰ khác nhau giữa các thẻ — đăng vào nhóm nào — thì nằm mờ bên dưới. */}
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3, minWidth: 0 }}>
          <b style={{ fontSize: compact ? 11.5 : 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
             title={place || undefined}>
            {onSite && <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>{fmt?.id === 'engage' ? 'tương tác trong ' : 'comment trong '}</span>}
            {placeShort || <span style={{ color: 'var(--neon-amber)' }}>chưa chọn nơi đăng</span>}
          </b>
          <span style={{ fontSize: compact ? 10 : 11, color: 'var(--fg-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {acct
              ? `bằng ${acct.handle ?? acct.platformKey}`
              : <span style={{ color: 'var(--neon-amber)' }}>chưa gắn account</span>}
            {time ? ` · ${time}` : ''}
          </span>
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {piece.hasLink && (
            <span title="Bài có link — nền tảng hạ reach, nhất là Facebook. Xem chi tiết ở drawer."
              style={{ fontSize: 10, padding: '1px 6px', borderRadius: 5, border: '1px solid var(--neon-blue)', color: 'var(--neon-blue)' }}>🔗 link</span>
          )}
          {seriesOf(piece.tags) && (
            // Series là lời hứa lặp lại — nhìn bản dựng phải biết bài này thuộc chuỗi nào.
            <span title={`Series: ${seriesOf(piece.tags)?.hint}`}
              style={{ fontSize: 10, padding: '1px 6px', borderRadius: 5, border: '1px solid var(--neon-amber)', color: 'var(--neon-amber)' }}>
              ⟳ {seriesOf(piece.tags)?.label}
            </span>
          )}
          {piece.channel === 'reddit' && tagVal(piece.tags, 'flair') && (
            // Reddit hiện flair ngay cạnh tiêu đề — bản dựng phải có, vì thiếu flair ở sub bắt buộc
            // là bài bị gỡ chứ không phải chuyện thẩm mỹ.
            <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 999, background: 'var(--bg-2)', border: '1px solid var(--line)', color: 'var(--fg-2)' }}>
              {tagVal(piece.tags, 'flair')}
            </span>
          )}
          {piece.channel === 'reddit' && tagVal(piece.tags, 'rdtag').split(',').filter(Boolean).map((t) => (
            <span key={t} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 5, border: `1px solid ${t === 'nsfw' ? 'var(--bad)' : 'var(--fg-4)'}`, color: t === 'nsfw' ? 'var(--bad)' : 'var(--fg-3)' }}>
              {t.toUpperCase()}
            </span>
          ))}
          {tagVal(piece.tags, 'story') && (
            <span title="Đăng kèm Facebook story — cùng nội dung, mặt thứ hai, không tốn thêm gì"
              style={{ fontSize: 10, padding: '1px 6px', borderRadius: 5, border: '1px solid var(--neon-pink)', color: 'var(--neon-pink)' }}>◎ story</span>
          )}
          {sty && <span title={`Trình bày: ${sty.hint}`} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 5, border: '1px solid var(--line)', color: 'var(--fg-3)' }}>{sty.icon} {sty.label}</span>}
          {fmt && <span title={`Kiểu bài: ${fmt.label}`} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 5, border: '1px solid var(--line)', color: 'var(--fg-3)' }}><FormatIcon kind={fmt.id} size={10} /> {fmt.label}</span>}
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
      ) : onSite ? (
        <div style={{ padding: compact ? '9px 11px' : '12px 14px', fontSize: compact ? 11.5 : 13, lineHeight: 1.55 }}>
          {/* Thẻ kế hoạch thì phải ĐỌC ĐƯỢC và ghi rõ các bước sẽ làm. Trước đây chỗ này chỉ có một
              dòng xám mờ — nhìn vào không biết lượt đó gồm những gì. Các bước giống nhau ở mọi thẻ
              cùng loại là ĐÚNG: cái khác nhau giữa các thẻ là nơi đăng + tài khoản + giờ, đã nằm
              ở đầu thẻ. Nội dung comment KHÔNG nằm ở đây vì nó sinh lúc đứng trước bài thật. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 10, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--fg-2)',
              padding: '1px 6px', borderRadius: 4, border: '1px dashed var(--fg-3)' }}>kế hoạch</span>
            <span style={{ color: 'var(--fg-2)' }}>{threadBack ? 'quay lại thread đã comment' : kind === 'engage' ? 'tương tác trong nhóm' : 'comment vào bài trong nhóm'}</span>
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--fg-1)' }}>
            {(threadBack
              ? ['Mở lại đúng thread mình đã comment.',
                 'Ai trả lời mình thì trả lời tiếp, bám đúng câu họ hỏi.',
                 'Ai hỏi câu thật mà chưa ai đáp thì trả lời họ.',
                 'Thả cảm xúc cho những comment có ích.',
                 'Ghi lại: ai trả lời, mình đã đáp gì.']
              : kind === 'engage'
              ? ['Vào nhóm đúng giờ.',
                 'Lọc bài đăng trong 24h và đang ÍT tương tác (≤30) — bài đã đông thì tên mình chìm.',
                 'Thả cảm xúc từng bài, đọc thật.',
                 'Lưu danh sách link đã tương tác vào thẻ này.']
              : ['Vào nhóm đúng giờ.',
                 'Đọc các bài đang có — xem lúc này mọi người đang bàn gì.',
                 'Chọn bài mình đóng góp được thật; không có thì bỏ lượt.',
                 'Viết comment bám đúng bài đó.',
                 'Điền sẵn lên browser, chờ duyệt.',
                 'Gửi, rồi lưu link + nguyên văn vào thẻ này.']
            ).map((s, i) => <li key={i} style={{ marginBottom: 1 }}>{s}</li>)}
          </ol>
          {draftText && (
            // Đã soạn tại chỗ nhưng chưa đăng → nguyên văn hiện rõ, đây mới là thứ sẽ đăng.
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--fg-2)', marginBottom: 3 }}>nội dung</div>
              <div style={{ whiteSpace: 'pre-wrap', color: 'var(--fg-1)', borderLeft: '2px solid var(--line)', paddingLeft: 9,
                ...(compact ? { display: '-webkit-box', WebkitLineClamp: 8, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' } : {}) }}>
                {withTags(draftText)}
              </div>
            </div>
          )}
          {prepText && (
            <PrepPanel piece={piece} full={text ?? ''} prep={prepText} endAt={doneAt} compact={compact} editable={!piece.publishUrl} />
          )}
          {doneText
            ? <DonePanel done={doneText} url={piece.publishUrl ?? ''} kind={kind} compact={compact} />
            : (
              <div style={{ marginTop: 8, fontSize: compact ? 10.5 : 11.5, color: 'var(--fg-2)' }}>
                {piece.publishUrl
                  ? <a href={piece.publishUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--neon-blue)' }}>
                      ✓ đã làm — mở {kind === 'engage' ? 'bài đã tương tác' : 'comment đã đăng'} ↗
                    </a>
                  : <>kết quả (link + nguyên văn) ghi vào đây sau khi làm xong</>}
              </div>
            )}
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
      ) : assets.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: assets.length > 1 ? '1fr 1fr' : '1fr', gap: 2, background: 'var(--line)' }}>
          {assets.map((m) => (
            // Ảnh hiện TRỌN (contain), không cắt. `cover` + maxHeight cắt mất masthead và dòng nguồn
            // của card → duyệt nhầm cái mình không nhìn thấy. Ở lịch (compact) hạ trần chiều cao,
            // vẫn contain nên chỉ nhỏ đi chứ không mất phần nào.
            // eslint-disable-next-line @next/next/no-img-element
            // Ảnh card là PNG 1080×1350 (~300 kB): tải hết cả tháng là ~5 MB không ai xem tới.
            // lazy = chỉ tải khi cuộn tới gần.
            isVideoMedia(m) ? (
              // Reel là VIDEO. Dựng bằng <img> thì ra ô vỡ — duyệt lịch mà không xem được clip thì
              // duyệt cái gì. preload="metadata": lịch tháng chỉ tải vài KB đầu mỗi clip, bấm mới tải tiếp.
              <video key={m.id} src={m.url} controls playsInline preload="metadata"
                style={{ width: '100%', height: 'auto', aspectRatio: ratio(m), maxHeight: compact ? 320 : 560, objectFit: 'contain', display: 'block', background: '#000' }} />
            ) : (
            <img key={m.id} src={m.url} alt={m.filename} loading="lazy" decoding="async"
              style={{ width: '100%', height: 'auto', aspectRatio: ratio(m), maxHeight: compact ? 320 : undefined, objectFit: 'contain', display: 'block', background: 'var(--bg-2)' }} />
            )
          ))}
        </div>
      ) : null}
      {fbButtonOf(piece.tags) && (
        // Nút CTA của FB nằm NGAY DƯỚI bài, người đọc bấm được mà không cần link trong thân bài.
        <div style={{ padding: compact ? '6px 9px 8px' : '9px 12px 11px', borderTop: '1px solid var(--line)' }}>
          <div style={{ textAlign: 'center', padding: compact ? '4px 0' : '6px 0', borderRadius: 6, background: 'var(--bg-2)',
            border: '1px solid var(--line)', fontSize: compact ? 11 : 12.5, fontWeight: 600, color: 'var(--fg-2)' }}>
            {fbButtonOf(piece.tags)?.label}
          </div>
        </div>
      )}
    </div>
  );
}

/** Khối "bài đã chọn" là thứ dùng để DUYỆT, nên phải đọc được bằng mắt chứ không phải một cục chữ:
 *  trích bài đứng riêng, số liệu thành hàng nhỏ, nguồn là link bấm được (không phải URL dài tràn
 *  dòng), ý chính thành gạch đầu dòng, và câu định viết nằm cuối — sửa được ngay tại đây khi chưa
 *  đăng. Nội dung vẫn lưu trong body_md dạng chữ (CLI `plan` đọc/ghi cùng chỗ), chỗ này chỉ bóc ra. */
function parsePrep(s: string) {
  const grab = (re: RegExp) => (s.match(re)?.[1] ?? '').trim();
  const points = grab(/Ý CHÍNH BÀI GỐC:\s*([\s\S]*?)(?:\nBÁM Ý:|\nDỰ ĐỊNH VIẾT:|$)/)
    .split('\n').map((x) => x.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
  return {
    parentText: grab(/BÀI GỐC:\s*([\s\S]*?)(?:\n\(bài lúc|\nhttps?:|\nNGUỒN:|\nÝ CHÍNH|\nBÁM Ý:|\nDỰ ĐỊNH VIẾT:|$)/),
    stats: grab(/\(bài lúc mình vào:\s*([^)]*)\)/),
    parentUrl: grab(/\n(https?:\/\/\S+)/),
    source: grab(/NGUỒN:\s*(\S+)/),
    points,
    angle: grab(/BÁM Ý:\s*([\s\S]*?)(?:\nDỰ ĐỊNH VIẾT:|$)/),
    draft: grab(/DỰ ĐỊNH VIẾT:\s*([\s\S]*)$/),
  };
}

const shortUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\?.*$/, '').slice(0, 60);

function PrepPanel({ piece, full, prep, endAt, compact, editable }: {
  piece: CalPiece; full: string; prep: string; endAt: number; compact: boolean; editable: boolean;
}) {
  const p = parsePrep(prep);
  const [draft, setDraft] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const shown = draft ?? p.draft;

  // Sửa câu định viết = thay đúng đoạn sau "DỰ ĐỊNH VIẾT:" trong body_md, giữ nguyên phần bài gốc,
  // ý chính và phần đã-làm. Sửa xong runner đọc lại bằng `plan draft <id>` rồi điền lên browser.
  const save = async (v: string) => {
    setEditing(false);
    if (v.trim() === shown.trim()) return;
    const at = full.indexOf('DỰ ĐỊNH VIẾT:');
    if (at < 0) return;
    const from = at + 'DỰ ĐỊNH VIẾT:'.length;
    const to = endAt >= 0 ? endAt : full.length;
    const body = `${full.slice(0, from)}\n${v.trim()}\n${full.slice(to)}`;
    setSaving(true); setDraft(v.trim()); bodyCache.set(piece.id, body);
    await updateContentPiece(piece.id, piece.projectId, { bodyMd: body });
    setSaving(false);
  };

  const label = (t: string) => (
    <div style={{ fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--fg-3)', marginBottom: 2 }}>{t}</div>
  );

  return (
    <div style={{ marginTop: 8, border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg-2)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: compact ? '4px 8px' : '5px 10px', borderBottom: '1px solid var(--line)' }}>
        <span style={{ fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--fg-2)' }}>bài đã chọn</span>
        {p.parentUrl && (
          <a href={p.parentUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
            style={{ fontSize: 10.5, color: 'var(--neon-blue)' }}>mở bài ↗</a>
        )}
      </div>
      <div style={{ padding: compact ? '6px 8px 8px' : '8px 10px 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {p.parentText && (
          <div style={{ borderLeft: '2px solid var(--fg-4)', paddingLeft: 8, color: 'var(--fg-1)',
            ...(compact ? { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' } : {}) }}>
            {p.parentText}
          </div>
        )}
        {(p.stats || p.source) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
            {p.stats && <span>{p.stats}</span>}
            {p.source && (
              <a href={p.source} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                style={{ color: 'var(--fg-2)', textDecoration: 'underline' }} title={p.source}>
                nguồn: {shortUrl(p.source)} ↗
              </a>
            )}
          </div>
        )}
        {p.points.length > 0 && (
          <div>
            {label('ý chính bài gốc')}
            <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--fg-1)' }}>
              {p.points.map((s, i) => <li key={i} style={{ marginBottom: 1 }}>{s}</li>)}
            </ul>
          </div>
        )}
        {p.angle && (
          // Câu này là cái để bắt lỗi lạc đề, nên nó phải nổi hơn phần còn lại chứ không chìm cùng màu.
          <div style={{ borderLeft: '3px solid var(--neon-amber)', paddingLeft: 8 }}>
            {label('bám ý')}
            <div style={{ color: 'var(--fg-1)' }}>{p.angle}</div>
          </div>
        )}
        {(shown || editable) && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {label('mình sẽ viết')}
              {editable && !editing && (
                <button onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                  style={{ marginBottom: 2, fontSize: 10, color: 'var(--neon-blue)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  sửa
                </button>
              )}
              {saving && <span style={{ marginBottom: 2, fontSize: 10, color: 'var(--fg-3)' }}>đang lưu…</span>}
            </div>
            {editing ? (
              <textarea autoFocus defaultValue={shown} onClick={(e) => e.stopPropagation()}
                onBlur={(e) => save(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }}
                style={{ width: '100%', minHeight: 110, fontSize: compact ? 11.5 : 13, lineHeight: 1.5, padding: 7,
                  background: 'var(--bg-1)', color: 'var(--fg-1)', border: '1px solid var(--neon-blue)', borderRadius: 5, resize: 'vertical' }} />
            ) : (
              <div style={{ whiteSpace: 'pre-wrap', color: 'var(--fg-1)', borderLeft: '2px solid var(--line)', paddingLeft: 8,
                ...(compact ? { display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' } : {}) }}>
                {shown || <span style={{ color: 'var(--fg-3)' }}>chưa soạn - bấm sửa để viết</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Khối "đã làm": nguyên văn ĐÃ đăng + đường theo dõi của nó. Cùng lý do với khối chuẩn bị — đây là
 *  bằng chứng, đọc để đánh giá cách làm, nên tách hẳn ba phần: đăng lúc nào bằng ai, nói gì, và các
 *  mốc đo sau đó. Mốc đo do /plan/track nối vào body dạng "· đo <giờ>: …", ở đây bóc thành hàng. */
function DonePanel({ done, url, kind, compact }: { done: string; url: string; kind: string; compact: boolean }) {
  const head = done.match(/^ĐÃ (COMMENT|TƯƠNG TÁC)\s*\(([^),]*)(?:,\s*bằng\s*([^)]*))?\)\s*:/);
  const rest = head ? done.slice(head[0].length) : done;
  const lines = rest.split('\n');
  const metrics = lines.filter((l) => l.trim().startsWith('· đo')).map((l) => {
    const m = l.match(/·\s*đo\s*([^:]*):\s*(.*)$/);
    return { at: (m?.[1] ?? '').trim(), what: (m?.[2] ?? '').trim() };
  });
  const text = lines.filter((l) => !l.trim().startsWith('· đo')).join('\n').trim();

  return (
    <div style={{ marginTop: 8, border: '1px solid var(--ok)', borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap',
        padding: compact ? '4px 8px' : '5px 10px', borderBottom: '1px solid var(--line)', background: 'color-mix(in srgb, var(--ok) 10%, transparent)' }}>
        <span style={{ fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ok)' }}>
          {head?.[1] === 'TƯƠNG TÁC' ? 'đã tương tác' : 'đã comment'}
          {head?.[2] ? <span style={{ color: 'var(--fg-3)', textTransform: 'none', letterSpacing: 0 }}> · {head[2]}</span> : null}
          {head?.[3] ? <span style={{ color: 'var(--fg-3)', textTransform: 'none', letterSpacing: 0 }}> · bằng {head[3]}</span> : null}
        </span>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontSize: 10.5, color: 'var(--neon-blue)' }}>
            mở {kind === 'engage' ? 'bài đã tương tác' : 'comment'} ↗
          </a>
        )}
      </div>
      <div style={{ padding: compact ? '6px 8px 8px' : '8px 10px 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {text && (
          <div style={{ whiteSpace: 'pre-wrap', color: 'var(--fg-1)', borderLeft: '2px solid var(--line)', paddingLeft: 8,
            ...(compact ? { display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' } : {}) }}>
            {withTags(text)}
          </div>
        )}
        <div>
          <div style={{ fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--fg-3)', marginBottom: 2 }}>theo dõi</div>
          {metrics.length === 0
            ? <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>chưa đo lần nào — <code style={{ fontFamily: 'var(--font-mono)' }}>plan track</code> sau vài ngày</div>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {metrics.map((m, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{m.at}</span>
                    <span style={{ color: m.what.includes('KHÔNG CÒN') ? 'var(--bad)' : 'var(--fg-1)' }}>{m.what}</span>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
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
