'use client';

// Channel picker inline trong card header cho post Discord/Slack/Telegram.
// Compact chip "#name" + dropdown click → list channels + AI suggest badge.
// Khi đổi channel mà voice resolution thay đổi → confirm modal hỏi re-gen.

import { useEffect, useRef, useState, useTransition } from 'react';
import {
  getCardChannels, setCardChannel, type CardChannelOption,
  type HabitatChannelsBundle,
} from '@/lib/actions/card-channel';
import { resolveVoiceProfile } from '@/lib/ai/voice-profile';

interface Props {
  cardId: number;
  projectId: string;
  initialChannelId: number | null;
  initialChannelName: string | null;
  // Preloaded channels bundle từ parent (fetch 1 lần / habitat thay vì N / card).
  // Nếu truyền, chip skip fetch riêng → giảm RSC roundtrips từ N → 1.
  preloadedBundle?: HabitatChannelsBundle | null;
  // contentType + phase để compute isSuggested client-side khi có preloadedBundle
  contentType?: string;
  phase?: string | null;
  onChange?: (channelId: number | null, channelName: string | null) => void;
  // Callback khi voice thay đổi do channel khác → parent có thể prompt re-gen.
  onVoiceChanged?: (oldVoice: string, newVoice: string) => Promise<boolean>;
  // Bump để pill voice context re-fetch sau khi đổi channel.
  onAfterChange?: () => void;
}

// Score channel client-side cho isSuggested badge (giống logic server nhưng
// trên data đã có). Lite version — chỉ phase + content_type matching.
function scoreChannelClient(name: string, phase: string | null, contentType: string, skipForPost: boolean): number {
  if (skipForPost) return -1000;
  const n = name.toLowerCase();
  let score = 0;
  if (phase === 'warm-up') {
    if (/general|intro|chat|lounge|welcome/.test(n)) score += 30;
    if (/rule|announce/.test(n)) return -800;
  }
  if (phase === 'value') {
    if (/help|question|q-a|qa|advice|chart|tarot|reading|astro|numerolog|vedic/.test(n)) score += 35;
    if (contentType === 'image' && /showcase|share|gallery|art/.test(n)) score += 40;
  }
  if (phase === 'bridge') {
    if (/build|project|wip|share|portfolio/.test(n)) score += 30;
  }
  if (phase === 'seed' || phase === 'direct') {
    if (/promo|self.?promo|launch|advertis|^our.?ad|^ad$|partner|affiliat|sponsor/.test(n)) score += 50;
    if (/no.?promo|rule|announce/.test(n)) return -800;
  }
  if (contentType === 'image' && /showcase|gallery|art|photo/.test(n)) score += 25;
  if (contentType === 'video' && /video|clip/.test(n)) score += 25;
  if (/general|chat|lounge/.test(n) && score === 0) score = 5;
  return score;
}

export function ChannelPickerChip({
  cardId, projectId, initialChannelId, initialChannelName,
  preloadedBundle, contentType = 'text', phase = null,
  onChange, onVoiceChanged, onAfterChange,
}: Props) {
  // TẤT CẢ hooks phải khai báo TRƯỚC bất kỳ early return nào (Rules of Hooks).
  // Lỗi cũ: useState(isDiscordLike) khai báo SAU useEffect khác + có early
  // return → React throw "Rendered fewer/more hooks" trong production build
  // (chỉ visible trong production minified, không thấy ở dev).
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [channels, setChannels] = useState<CardChannelOption[] | null>(null);
  const [currentName, setCurrentName] = useState<string | null>(initialChannelName);
  const [currentId, setCurrentId] = useState<number | null>(initialChannelId);
  const [isDiscordLike, setIsDiscordLike] = useState<boolean | null>(null);
  const [dropPos, setDropPos] = useState<{ top: number; left: number } | null>(null);
  const [, startTransition] = useTransition();
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const recomputePos = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setDropPos({ top: r.bottom + 4, left: r.left });
  };
  // Recompute khi scroll/resize trong lúc dropdown mở
  useEffect(() => {
    if (!open) return;
    recomputePos();
    const handler = () => recomputePos();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [open]);

  // Resolve channels: nếu parent truyền preloadedBundle → dùng luôn (compute
  // isCurrent + isSuggested client-side). Nếu không → fallback fetch (chậm,
  // dùng khi không có parent cache, vd standalone usage).
  useEffect(() => {
    let cancel = false;
    if (preloadedBundle) {
      // Build CardChannelOption[] từ bundle + per-card state
      setIsDiscordLike(preloadedBundle.isDiscord);
      if (!preloadedBundle.isDiscord) { setChannels([]); return; }
      const scored = preloadedBundle.channels.map((c) => ({
        ...c,
        _score: scoreChannelClient(c.name, phase, contentType, c.skipForPost),
      }));
      const topPositive = scored.filter((c) => c._score > 0).sort((a, b) => b._score - a._score)[0];
      const opts: CardChannelOption[] = scored.map(({ _score, ...c }) => {
        void _score;
        return {
          id: c.id,
          name: c.name,
          description: c.description,
          allowedFormats: c.allowedFormats,
          voiceProfileOverride: c.voiceProfileOverride,
          effectiveVoice: c.effectiveVoice,
          voiceLabel: c.voiceLabel,
          voiceIcon: c.voiceIcon,
          isCurrent: c.id === currentId,
          isSuggested: topPositive?.id === c.id,
          suggestReason: '',
          hasRules: c.hasRules,
          fewShotCount: c.fewShotCount,
          skipForPost: c.skipForPost,
        };
      });
      setChannels(opts);
      return;
    }
    // Fallback: fetch nếu không có preloaded (backward compat)
    getCardChannels(cardId).then((res) => {
      if (cancel) return;
      if (res.ok) {
        setIsDiscordLike(res.isDiscord);
        setChannels(res.channels);
      } else {
        setIsDiscordLike(false);
      }
    }).catch(() => { if (!cancel) setIsDiscordLike(false); });
    return () => { cancel = true; };
  }, [cardId, preloadedBundle, phase, contentType, currentId]);

  // Early return AFTER all hooks
  if (isDiscordLike === false) return null;

  const pickChannel = async (ch: CardChannelOption | null) => {
    const newId = ch?.id ?? null;
    if (newId === currentId) { setOpen(false); return; }
    setBusy(true);
    try {
      const res = await setCardChannel(projectId, cardId, newId);
      if (!res.ok) { setBusy(false); return; }
      // Confirm re-gen nếu voice thay đổi
      if (res.voiceChanged && onVoiceChanged && res.oldVoice && res.newVoice) {
        startTransition(async () => {
          await onVoiceChanged(res.oldVoice!, res.newVoice!);
        });
      }
      setCurrentId(newId);
      setCurrentName(ch?.name ?? null);
      onChange?.(newId, ch?.name ?? null);
      onAfterChange?.();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const label = currentName ? `#${currentName}` : 'habitat-level';
  const labelColor = currentName ? 'var(--accent)' : 'var(--fg-3)';

  return (
    <div style={{ display: 'inline-block' }}>
      <button ref={btnRef} type="button"
              onClick={() => {
                recomputePos();
                setOpen((v) => !v);
              }}
              disabled={busy}
              title={currentName
                ? `Bài này đăng vào channel #${currentName}. Click để đổi channel.`
                : 'Bài này đăng habitat-level (không vào channel cụ thể). Click để chọn channel.'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', fontSize: 11, fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                background: currentName ? 'var(--accent-soft)' : 'var(--bg-2)',
                color: labelColor,
                border: `1px solid ${currentName ? 'var(--accent-line)' : 'var(--line)'}`,
                borderRadius: 4,
                cursor: busy ? 'wait' : 'pointer',
                whiteSpace: 'nowrap',
              }}>
        <span>{label}</span>
        <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
      </button>

      {open && dropPos && (
        <>
          {/* Backdrop click → đóng. z-index siêu cao để chắc chắn trên tất cả
              card row + brief modal nội dung (modal backdrop = 1000). */}
          <div onClick={() => setOpen(false)}
               style={{ position: 'fixed', inset: 0, zIndex: 1100 }} />
          {/* Dropdown dùng position:fixed + toạ độ từ button rect → escape
              stacking context của card row, không bị card khác đè. */}
          <div style={{
            position: 'fixed', top: dropPos.top, left: dropPos.left,
            zIndex: 1101,
            minWidth: 300, maxWidth: 420, maxHeight: 400,
            background: 'var(--bg-1)', border: '1px solid var(--accent-line)',
            borderRadius: 6, padding: 4,
            display: 'flex', flexDirection: 'column', gap: 2,
            overflowY: 'auto',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            {channels == null ? (
              <div style={{ padding: 8, fontSize: 11, color: 'var(--fg-3)' }}>Đang tải channels…</div>
            ) : channels.length === 0 ? (
              <div style={{ padding: 8, fontSize: 11, color: 'var(--fg-3)' }}>
                Habitat chưa có channel — mở habitat modal section 📺 Channels để thêm.
              </div>
            ) : (
              <>
                {/* Option: habitat-level (no channel) */}
                <button type="button"
                        onClick={() => pickChannel(null)}
                        style={rowStyle(currentId == null, false)}>
                  <span style={{ fontWeight: 700, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                    (habitat-level)
                  </span>
                  <span style={{ flex: 1, fontSize: 10, color: 'var(--fg-4)', fontStyle: 'italic' }}>
                    bài chung — không vào channel cụ thể
                  </span>
                  {currentId == null && <span style={{ fontSize: 10, color: 'var(--accent)' }}>✓</span>}
                </button>
                <div style={{ height: 1, background: 'var(--line)', margin: '2px 4px' }} />
                {channels.map((ch) => (
                  <button key={ch.id} type="button"
                          onClick={() => pickChannel(ch)}
                          disabled={ch.skipForPost}
                          title={ch.skipForPost ? 'Channel này được đánh dấu không đăng bài (vd #rules)' : undefined}
                          style={rowStyle(ch.isCurrent, ch.isSuggested, ch.skipForPost)}>
                    <span style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)',
                                   minWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      #{ch.name}
                    </span>
                    <span title={`Voice: ${ch.voiceLabel}`}
                          style={{ fontSize: 11, fontWeight: 600,
                                   color: ch.voiceProfileOverride ? 'var(--neon-violet)' : 'var(--fg-3)' }}>
                      {ch.voiceIcon} {ch.voiceLabel}
                    </span>
                    {ch.isSuggested && (
                      <span title={`AI gợi ý: ${ch.suggestReason}`}
                            style={{ fontSize: 9, fontWeight: 700,
                                     padding: '1px 5px', borderRadius: 2,
                                     background: 'rgba(74,222,128,0.15)',
                                     color: 'var(--ok)' }}>
                        ✨ gợi ý
                      </span>
                    )}
                    {ch.skipForPost && (
                      <span style={{ fontSize: 9, color: 'var(--bad)' }}>không đăng</span>
                    )}
                    {ch.hasRules && <span title="Channel có rules riêng" style={{ fontSize: 10 }}>📜</span>}
                    {ch.fewShotCount > 0 && (
                      <span title={`${ch.fewShotCount} ví dụ mẫu`} style={{ fontSize: 9, color: 'var(--fg-3)' }}>
                        {ch.fewShotCount}📋
                      </span>
                    )}
                    {ch.description && (
                      <span style={{ flex: 1, fontSize: 9.5, color: 'var(--fg-4)', fontStyle: 'italic',
                                     overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ch.description}
                      </span>
                    )}
                    {ch.isCurrent && <span style={{ fontSize: 10, color: 'var(--accent)' }}>✓</span>}
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function rowStyle(isCurrent: boolean, isSuggested: boolean, disabled: boolean = false): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '5px 8px', fontSize: 11,
    background: isCurrent ? 'var(--accent-soft)' : isSuggested ? 'rgba(74,222,128,0.05)' : 'transparent',
    border: 'none', borderRadius: 4,
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: 'var(--fg-1)',
    textAlign: 'left' as const,
    opacity: disabled ? 0.5 : 1,
    width: '100%',
  };
}
