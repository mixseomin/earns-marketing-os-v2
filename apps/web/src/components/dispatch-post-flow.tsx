'use client';

// Dispatch flow cho 1 card: 1-click "🚀 Đăng bài" → auto copy body + mở
// deep-link community → confirm modal với URL/timestamp/screenshot/note.
// Sau khi confirm → cards.post_url/posted_at set + touch_log + reply monitor
// có thể pull bài qua URL.

import { memo, useState, useTransition } from 'react';
import { Spinner } from './ui';
import { confirmCardPosted, unconfirmCardPosted } from '@/lib/actions/seeding';
import { wrapExternalUrl } from '@/lib/external-url';
import { useCopyToClipboard } from '@/lib/use-copy-clipboard';

interface DispatchButtonProps {
  projectId: string;
  briefId: number;
  cardId: number;
  // Body để copy (bodyTarget ưu tiên — bản đã dịch sang lang đăng thật)
  bodyToCopy: string;
  // Deep-link priority: parent URL (comment/reply mode) > channel URL > habitat URL.
  postUrl?: string | null;          // URL bài đã đăng (nếu đã confirm)
  channelUrl?: string | null;
  habitatUrl?: string | null;
  /** Khi content_type là comment/reply: URL thread/post gốc để paste reply vào.
   *  Khi present → "Mở thread → paste reply" thay vì "Mở community → tạo post mới". */
  parentUrl?: string | null;
  /** content_type — hiển thị label đúng nút (Đăng bài / Comment / Reply). */
  contentType?: string;
  // Hiển thị channel name trong button "Mở #channel" thay vì "Mở community"
  channelName?: string | null;
  habitatName?: string | null;
  // 0057 GATE: nếu chưa joined community, block dispatch (server cũng gate
  // confirmCardPosted nhưng UI gate cho clearer feedback).
  isJoined?: boolean;
  /** Click khi !isJoined — parent open JoinStatusBanner để fix */
  onRequestJoin?: () => void;
  /** Lý do !isJoined: 'account-never-created' = todo/creating (chưa tạo trên platform),
      'account-broken' = blocked/banned/dormant/defunct (đã tạo nhưng platform khoá),
      'membership' = account active nhưng chưa join community.
      Default 'membership' (backwards compat). */
  notReadyReason?: 'account-never-created' | 'account-broken' | 'membership';
  // Callback sau confirm: refresh list + clear local state
  onConfirmed?: (postUrl: string) => void;
  onUnconfirmed?: () => void;
}

export const DispatchPostFlow = memo(DispatchPostFlowImpl);
DispatchPostFlow.displayName = 'DispatchPostFlow';

function DispatchPostFlowImpl({
  projectId, briefId, cardId, bodyToCopy,
  postUrl, channelUrl, habitatUrl, parentUrl, contentType = 'text',
  channelName, habitatName,
  isJoined = true, onRequestJoin, notReadyReason = 'membership',
  onConfirmed, onUnconfirmed,
}: DispatchButtonProps) {
  // Interaction mode: comment/reply bám vào thread/post gốc.
  const isInteraction = contentType === 'comment' || contentType === 'reply';
  const interactionLabel = contentType === 'comment' ? 'Comment' : 'Reply';
  const [confirmOpen, setConfirmOpen] = useState(false);
  const clip = useCopyToClipboard(2000);

  // 0057 GATE: isJoined=false có 3 lý do — account-never-created, account-broken,
  // hoặc membership chưa joined. Mỗi case UI khác nhau (màu + wording + action).
  if (!isJoined && !postUrl) {
    // 3 visual tiers: blue (todo task), red pulse (broken state), amber (missing membership)
    const tier =
      notReadyReason === 'account-never-created' ? {
        label: '➕ Cần tạo account',
        desc: 'Account chưa tồn tại trên platform. Phải đăng ký account thật trước khi nói tới việc đăng bài.',
        btn: 'Tạo account →',
        btnTip: 'Mở Account modal — có signup link + form điền credential',
        bg: 'rgba(59,130,246,.10)',
        border: 'rgba(59,130,246,.5)',
        color: '#3b82f6',
        btnBg: '#3b82f6',
        btnFg: '#fff',
      } : notReadyReason === 'account-broken' ? {
        label: '🚫 Account bị khoá',
        desc: 'Account đã tạo nhưng platform đã block/ban/dormant. Cần appeal mod hoặc swap account khác.',
        btn: 'Xem chi tiết →',
        btnTip: 'Mở Account modal để xem block_reason + lịch sử',
        bg: 'rgba(248,113,113,.10)',
        border: 'rgba(248,113,113,.45)',
        color: 'var(--bad)',
        btnBg: 'var(--bad)',
        btnFg: '#0d1117',
      } : {
        // membership (default)
        label: '🔒 Chưa join community',
        desc: 'Không đăng bài được khi chưa join. Đăng = nguy cơ shadowban + spam-flag.',
        btn: 'Fix join status →',
        btnTip: 'Mở Join status banner để đánh dấu đã join community',
        bg: 'rgba(251,191,36,.10)',
        border: 'rgba(251,191,36,.4)',
        color: 'var(--warn)',
        btnBg: 'var(--warn)',
        btnFg: '#0d1117',
      };
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                    padding: '7px 9px', background: tier.bg,
                    border: `1px solid ${tier.border}`, borderRadius: 5 }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                       color: tier.color,
                       textTransform: 'uppercase', letterSpacing: '.05em' }}>
          {tier.label}
        </span>
        <span style={{ fontSize: 11, color: 'var(--fg-2)', flex: 1 }}>{tier.desc}</span>
        {onRequestJoin && (
          <button type="button" onClick={onRequestJoin}
                  title={tier.btnTip}
                  style={{ fontSize: 10.5, padding: '4px 10px', fontWeight: 700,
                           background: tier.btnBg, color: tier.btnFg,
                           border: 'none', borderRadius: 4, cursor: 'pointer' }}>
            {tier.btn}
          </button>
        )}
      </div>
    );
  }

  // Đã đăng → hiển thị view khác (link + unpost button)
  if (postUrl) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                    padding: '7px 9px', background: 'rgba(74,222,128,.08)',
                    border: '1px solid rgba(74,222,128,.3)', borderRadius: 5 }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                       color: 'var(--ok)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
          ✓ Đã đăng
        </span>
        <a href={wrapExternalUrl(postUrl)} target="_blank" rel="noopener noreferrer"
           style={{ flex: 1, fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    textDecoration: 'none' }}>
          {postUrl.replace(/^https?:\/\//, '').slice(0, 60)} ↗
        </a>
        <UnpostButton projectId={projectId} cardId={cardId} onDone={onUnconfirmed} />
      </div>
    );
  }

  // Chưa đăng → button 1-click flow.
  // Priority: parent URL (interaction) > channel URL > habitat URL.
  // Interaction → open thread/post gốc để paste reply DƯỚI nó.
  const target = (isInteraction && parentUrl?.trim())
    ? parentUrl.trim()
    : channelUrl?.trim() || habitatUrl?.trim() || '';
  const targetLabel = isInteraction
    ? `thread → paste ${interactionLabel}`
    : (channelName ? `#${channelName}` : habitatName || 'community');

  // Interaction thiếu parent URL → block dispatch + báo rõ
  const interactionMissingParent = isInteraction && !parentUrl?.trim();

  const handleDispatch = async () => {
    // 1. Copy body (auto-handles state via useCopyToClipboard)
    await clip.copy(bodyToCopy);
    // 2. Open community in new tab
    if (target) {
      window.open(target.startsWith('http') ? target : `https://${target}`, '_blank', 'noopener,noreferrer');
    }
    // 3. Show confirm modal
    setConfirmOpen(true);
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                    padding: '7px 9px', background: 'rgba(74,222,128,.06)',
                    border: '1px solid rgba(74,222,128,.3)', borderRadius: 5 }}>
        <span title="Bài chưa đăng — bấm nút bên phải để đăng (auto copy nội dung + mở community + hiện form paste URL)"
              style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                       color: 'var(--warn)', textTransform: 'uppercase', letterSpacing: '.05em', cursor: 'help' }}>
          ⏳ Chưa đăng
        </span>
        {clip.copied && (
          <span style={{ fontSize: 10, color: 'var(--ok)' }}>✓ đã copy</span>
        )}
        {clip.error && (
          <span style={{ fontSize: 10, color: 'var(--bad)' }}>⚠ copy lỗi</span>
        )}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={handleDispatch}
                disabled={!bodyToCopy.trim() || interactionMissingParent}
                title={!bodyToCopy.trim()
                  ? 'Chưa có nội dung để copy — sinh draft trước'
                  : interactionMissingParent
                    ? `${interactionLabel} thiếu Parent URL — set trong form trước khi đăng`
                    : `Copy nội dung + mở ${targetLabel} + hiện form xác nhận`}
                style={{ fontSize: 11, padding: '5px 12px', fontWeight: 700,
                         background: (bodyToCopy.trim() && !interactionMissingParent) ? 'var(--ok)' : 'var(--bg-3)',
                         color: (bodyToCopy.trim() && !interactionMissingParent) ? '#0d1117' : 'var(--fg-3)',
                         border: 'none', borderRadius: 4,
                         cursor: (bodyToCopy.trim() && !interactionMissingParent) ? 'pointer' : 'not-allowed',
                         display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          📋 Copy + Mở {targetLabel}
        </button>
        <button type="button" onClick={() => setConfirmOpen(true)}
                title="Đã tự đăng ở chỗ khác rồi → bỏ qua bước copy/mở, mở thẳng form paste URL bài"
                style={{ fontSize: 10.5, padding: '4px 9px',
                         background: 'transparent', color: 'var(--fg-3)',
                         border: '1px dashed var(--line)', borderRadius: 4,
                         cursor: 'pointer' }}>
          Đã đăng tay → nhập URL
        </button>
      </div>
      {confirmOpen && (
        <ConfirmPostedModal
          projectId={projectId}
          briefId={briefId}
          cardId={cardId}
          targetUrl={target}
          targetLabel={targetLabel}
          onClose={() => setConfirmOpen(false)}
          onConfirmed={(url) => {
            setConfirmOpen(false);
            onConfirmed?.(url);
          }}
        />
      )}
    </>
  );
}

function UnpostButton({ projectId, cardId, onDone }: {
  projectId: string; cardId: number; onDone?: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  if (confirm) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 10, color: 'var(--bad)' }}>Bỏ đánh dấu?</span>
        <button type="button" disabled={busy}
                onClick={() => {
                  setBusy(true);
                  startTransition(async () => {
                    await unconfirmCardPosted(projectId, cardId);
                    setBusy(false);
                    setConfirm(false);
                    onDone?.();
                  });
                }}
                style={{ fontSize: 10, padding: '2px 7px', background: 'var(--bad)',
                         color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}>
          {busy ? <Spinner size="xs" /> : 'OK'}
        </button>
        <button type="button" onClick={() => setConfirm(false)}
                style={{ fontSize: 10, padding: '2px 7px', background: 'transparent',
                         color: 'var(--fg-3)', border: '1px solid var(--line)',
                         borderRadius: 3, cursor: 'pointer' }}>
          Huỷ
        </button>
      </span>
    );
  }
  return (
    <button type="button" onClick={() => setConfirm(true)}
            title="Bỏ đánh dấu đã đăng — nếu bấm nhầm"
            style={{ fontSize: 9.5, padding: '2px 7px', background: 'transparent',
                     color: 'var(--fg-3)', border: '1px solid var(--line)',
                     borderRadius: 3, cursor: 'pointer' }}>
      bỏ đánh dấu
    </button>
  );
}

function ConfirmPostedModal({
  projectId, briefId, cardId, targetUrl, targetLabel, onClose, onConfirmed,
}: {
  projectId: string;
  briefId: number;
  cardId: number;
  targetUrl?: string;       // URL community đã mở (gợi ý cho user paste link bài cụ thể)
  targetLabel: string;
  onClose: () => void;
  onConfirmed: (url: string) => void;
}) {
  const [postUrl, setPostUrl] = useState('');
  const [postedAt, setPostedAt] = useState(() => {
    // Default = now() format datetime-local (YYYY-MM-DDTHH:MM)
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const submit = () => {
    const url = postUrl.trim();
    if (!url) { setError('URL bài đã đăng là bắt buộc'); return; }
    if (!/^https?:\/\//i.test(url)) { setError('URL không hợp lệ (cần bắt đầu http:// hoặc https://)'); return; }
    setBusy(true); setError(null);
    startTransition(async () => {
      const res = await confirmCardPosted(projectId, briefId, cardId, {
        postUrl: url,
        postedAt: new Date(postedAt).toISOString(),
        postScreenshotUrl: screenshotUrl.trim() || null,
        postNote: note.trim() || null,
      });
      setBusy(false);
      if (!res.ok) { setError(res.error ?? 'Lỗi xác nhận'); return; }
      onConfirmed(url);
    });
  };

  // Auto-detect screenshot URL khi user paste image data URL hoặc URL ảnh
  const handleScreenshotPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    // Future: support image paste → upload to R2 → set URL.
    // Hiện tại chỉ accept text URL.
    void e;
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 2000 }}
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 'min(560px, 95vw)', padding: 18 }}
           onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>🚀</span>
          <h3 style={{ margin: 0, fontSize: 16 }}>Xác nhận đã đăng bài</h3>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} className="btn ghost" style={{ fontSize: 14 }}>✕</button>
        </div>
        <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--fg-3)' }}>
          Sau khi bạn đã đăng bài lên <strong style={{ color: 'var(--accent)' }}>{targetLabel}</strong>, paste link bài để MOS2 có thể theo dõi reply.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={LBL}>🔗 URL bài đã đăng *</label>
            <input type="url" value={postUrl} onChange={(e) => setPostUrl(e.target.value)}
                   placeholder="https://reddit.com/r/astrology/comments/xxx... hoặc discord.com/channels/123/456/789"
                   autoFocus required
                   style={FLD} />
            {targetUrl && (
              <div style={{ marginTop: 3, fontSize: 10, color: 'var(--fg-4)' }}>
                💡 Bạn vừa mở <code style={{ fontFamily: 'var(--font-mono)' }}>{targetUrl.slice(0, 60)}…</code> —
                quay lại tab đó, copy URL bài cụ thể vừa post, paste vào đây.
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <div>
              <label style={LBL}>⏰ Thời gian đăng</label>
              <input type="datetime-local" value={postedAt}
                     onChange={(e) => setPostedAt(e.target.value)}
                     style={FLD} />
            </div>
            <div>
              <label style={LBL}>📸 Screenshot (URL)</label>
              <input type="url" value={screenshotUrl}
                     onPaste={handleScreenshotPaste}
                     onChange={(e) => setScreenshotUrl(e.target.value)}
                     placeholder="optional"
                     style={FLD} />
            </div>
          </div>
          <div>
            <label style={LBL}>📝 Ghi chú (tuỳ chọn)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      placeholder="vd: mod approved sau 5 phút / shadow ban / phải edit title vì rules"
                      style={{ ...FLD, fontFamily: 'var(--font-mono)', fontSize: 11.5, resize: 'vertical' }} />
          </div>
          {error && (
            <div style={{ padding: 8, fontSize: 11, color: 'var(--bad)',
                          background: 'rgba(248,113,113,.08)',
                          border: '1px solid rgba(248,113,113,.3)', borderRadius: 4 }}>
              ⚠ {error}
            </div>
          )}
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn ghost" disabled={busy}>Huỷ</button>
          <button onClick={submit} className="btn primary" disabled={busy || !postUrl.trim()}>
            {busy ? <><Spinner size="xs" /> Đang lưu</> : '✓ Xác nhận đã đăng'}
          </button>
        </div>
      </div>
    </div>
  );
}

const LBL: React.CSSProperties = {
  display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)',
  color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.06em',
  marginBottom: 4, fontWeight: 700,
};
const FLD: React.CSSProperties = {
  width: '100%', padding: '6px 9px', background: 'var(--bg-2)',
  border: '1px solid var(--line)', borderRadius: 4,
  color: 'var(--fg-0)', fontSize: 12, outline: 'none',
};
