'use client';

// Pill hiển thị voice context cho 1 card (post): voice profile + nguồn
// (habitat/channel) + counts (few-shot, tribe lexicon, visual style).
// Click → callback onEdit để parent mở HabitatFormModal section voice.
// Tự fetch context khi mount; re-fetch khi cardId thay đổi.

import { useEffect, useState } from 'react';
import { getCardVoiceContext, type CardVoiceContext } from '@/lib/actions/card-voice-context';
import { VOICE_PROFILE_META } from '@/lib/ai/voice-profile';

interface Props {
  cardId: number;
  onEdit?: (habitatId: number) => void;   // bấm "✎ Sửa" → mở habitat modal
  // reloadKey: parent bump khi habitat overlay đóng → re-fetch để show voice mới.
  reloadKey?: number;
  // Preloaded ctx — nếu truyền, skip fetch action. Parent build từ
  // BriefPost.effectiveVoice + bundle (tribe count, has visual style).
  preloadedCtx?: CardVoiceContext | null;
}

export function VoiceContextPill({ cardId, onEdit, reloadKey = 0, preloadedCtx }: Props) {
  const [ctx, setCtx] = useState<CardVoiceContext | null>(preloadedCtx ?? null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (preloadedCtx) { setCtx(preloadedCtx); setErr(null); return; }
    let cancel = false;
    getCardVoiceContext(cardId).then((res) => {
      if (cancel) return;
      if (res.ok) { setCtx(res.ctx); setErr(null); }
      else { setErr(res.error); setCtx(null); }
    }).catch((e) => { if (!cancel) setErr((e as Error).message); });
    return () => { cancel = true; };
  }, [cardId, reloadKey, preloadedCtx]);

  if (err) {
    return (
      <span style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
        🎙 (lỗi load voice)
      </span>
    );
  }
  if (!ctx) {
    return (
      <span style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
        🎙 đang tải…
      </span>
    );
  }

  const meta = VOICE_PROFILE_META[ctx.effectiveProfile] ?? VOICE_PROFILE_META.regular;
  const sourceLabel =
    ctx.source === 'channel' ? `ghi đè bởi #${ctx.channelName}`
    : ctx.source === 'pillar' ? `từ trụ cột 📚 ${ctx.pillarName}`
    : ctx.source === 'habitat' ? `từ habitat ${ctx.habitatName}`
    : `mặc định (chưa cấu hình)`;

  // Build context summary line cho hover tooltip
  const summary: string[] = [`🎙 Giọng: ${meta.icon} ${meta.label} — ${sourceLabel}`];
  if (ctx.pillarId) {
    summary.push(`📚 Trụ cột: ${ctx.pillarName}${ctx.pillarTagline ? ` — "${ctx.pillarTagline}"` : ''}`);
    if (ctx.pillarKeyMsgCount > 0) summary.push(`  🎯 ${ctx.pillarKeyMsgCount} thông điệp chính`);
    if (ctx.pillarForbiddenCount > 0) summary.push(`  🚫 ${ctx.pillarForbiddenCount} cấm kỵ`);
    if (ctx.languageMismatch) {
      summary.push(`  ⚠ SAI NGÔN NGỮ: trụ cột hỗ trợ [${ctx.pillarLanguages.join(', ')}] nhưng bài target ${ctx.targetLang}`);
    }
  }
  if (ctx.habitatVoiceNotes.trim() || ctx.pillarVoiceNotes.trim()) {
    summary.push(`📝 Có ghi chú giọng`);
  }
  if (ctx.fewShotCount > 0) {
    const srcLabel = ctx.fewShotSource === 'channel' ? 'từ channel'
      : ctx.fewShotSource === 'habitat' ? 'từ habitat'
      : 'từ trụ cột';
    summary.push(`📋 ${ctx.fewShotCount} ví dụ mẫu (${srcLabel})`);
  } else {
    summary.push(`📋 Chưa có ví dụ mẫu — bài AI sẽ thiên về preset chuẩn`);
  }
  if (ctx.tribeLexiconCount > 0) {
    summary.push(`🏷 ${ctx.tribeLexiconCount} từ vựng tribe${ctx.tribeAvoidCount > 0 ? ` + ${ctx.tribeAvoidCount} từ né tránh` : ''}`);
  }
  if (ctx.hasChannelRules) {
    summary.push(`📺 Channel #${ctx.channelName} có rules riêng (sẽ ghi đè habitat)`);
  }
  if (ctx.hasVisualStyle) {
    summary.push(`🎨 Có phong cách hình ảnh — ảnh sinh sẽ fit theme`);
  } else {
    summary.push(`🎨 Chưa có phong cách hình ảnh (vào habitat → AI suy ra từ icon)`);
  }
  summary.push('', 'Click để sửa giọng + ví dụ + phong cách trong habitat.');

  const tooltip = summary.join('\n');

  // Style theo source: channel = tím (override), pillar = xanh dương, habitat = xanh accent, default = xám
  const colors = ctx.source === 'channel'
    ? { bg: 'rgba(157,108,255,0.12)', border: 'rgba(157,108,255,0.4)', fg: 'var(--neon-violet)' }
    : ctx.source === 'pillar'
      ? { bg: 'rgba(96,165,250,0.10)', border: 'rgba(96,165,250,0.4)', fg: '#60a5fa' }
      : ctx.source === 'habitat'
        ? { bg: 'rgba(74,222,128,0.10)', border: 'rgba(74,222,128,0.35)', fg: 'var(--ok)' }
        : { bg: 'var(--bg-2)', border: 'var(--line)', fg: 'var(--fg-3)' };

  // Counts compact: "💀 Bựa · 3 ví dụ · 12 từ · 📺 #showcase · 📚 Edu"
  const counts: string[] = [];
  if (ctx.fewShotCount > 0) counts.push(`${ctx.fewShotCount} ví dụ`);
  if (ctx.tribeLexiconCount > 0) counts.push(`${ctx.tribeLexiconCount} từ`);

  return (
    <button type="button"
            onClick={() => ctx.habitatId != null && onEdit?.(ctx.habitatId)}
            disabled={ctx.habitatId == null}
            title={tooltip}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 9px', fontSize: 11, fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              background: colors.bg,
              color: colors.fg,
              border: `1px solid ${colors.border}`,
              borderRadius: 4,
              cursor: ctx.habitatId != null ? 'pointer' : 'default',
              whiteSpace: 'nowrap',
            }}>
      <span style={{ fontSize: 13 }}>🎙</span>
      <span>{meta.icon} {meta.label}</span>
      {ctx.source === 'channel' && (
        <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.85,
                       padding: '0 4px', borderRadius: 2,
                       background: 'rgba(157,108,255,0.25)' }}>
          ghi đè
        </span>
      )}
      {ctx.source === 'pillar' && (
        <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.85,
                       padding: '0 4px', borderRadius: 2,
                       background: 'rgba(96,165,250,0.25)' }}>
          từ trụ cột
        </span>
      )}
      {ctx.channelName && ctx.source !== 'channel' && (
        <span style={{ fontSize: 10, opacity: 0.75 }}>
          · #{ctx.channelName}
        </span>
      )}
      {ctx.pillarId && ctx.source !== 'pillar' && (
        <span title={ctx.pillarTagline ? `"${ctx.pillarTagline}"` : ctx.pillarName!}
              style={{ fontSize: 10, opacity: 0.75 }}>
          · 📚 {ctx.pillarName?.slice(0, 18)}
        </span>
      )}
      {counts.length > 0 && (
        <span style={{ fontSize: 10, opacity: 0.75 }}>
          · {counts.join(' · ')}
        </span>
      )}
      {ctx.hasVisualStyle && (
        <span title="Có phong cách hình ảnh" style={{ fontSize: 10 }}>🎨</span>
      )}
      {ctx.hasChannelRules && (
        <span title="Channel có rules riêng" style={{ fontSize: 10 }}>📺</span>
      )}
      {ctx.languageMismatch && (
        <span title={`Trụ cột chỉ hỗ trợ [${ctx.pillarLanguages.join(', ')}] nhưng bài target ${ctx.targetLang}`}
              style={{ fontSize: 10, color: 'var(--bad)', fontWeight: 700 }}>⚠</span>
      )}
      <span style={{ fontSize: 9, opacity: 0.55, marginLeft: 2 }}>✎</span>
    </button>
  );
}
