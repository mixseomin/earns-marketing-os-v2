'use client';

// Edit one community brief (account × habitat). Used from both AccountFormModal
// (per-account view, listing all habitats this persona engages in) and from
// the Tribes/Habitats page (per-habitat view, listing all accounts engaging
// here). Same shared editor.

import { useState, useTransition, useEffect, useRef, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  upsertBrief, deleteBrief, saveBriefSuggestion,
  savePhasePlan, advancePhase, initPhasePlanFromDefaults,
  getAccountPersonaVoice, getHabitatRowAction,
  type BriefRow, type BriefTemplate, type PersonaVoice,
} from '@/lib/actions/community-briefs';
import type { HabitatRow } from '@/lib/data';
import type { HabitatJoinContext } from './join-status-banner';
import { type JoinStatus } from '@/lib/join-status';
import { BriefSelectorsSection } from './brief-selectors-section';
import { useCopyToClipboard } from '@/lib/use-copy-clipboard';
import { fmtAgo } from '@/lib/time-format';
import { JoinStatusBanner } from './join-status-banner';
import { JoinChip } from './join-chip';
import { AccountReadinessChip } from './account-readiness-chip';
import { CritiquePanel } from './critique-panel';
import { PhaseHistoryView } from './phase-history-view';
import { PostFiltersBar, EMPTY_FILTERS, applyPostFilters, type PostFilters } from './post-filters-bar';
import { isAccountReady } from '@/lib/brief-readiness';
import {
  type Phase, type PhaseEntry, PLANNED_PHASES,
  PHASE_LABEL, PHASE_COLOR, PHASE_DESCRIPTION,
} from '@/lib/phase-plan';
import { CONTENT_FORMATS, formatMeta, allowedFormats, formatColors, postCompleteness, effectiveMix, computeMixAchievement } from '@/lib/content-formats';
import { FormatIcon, IconSliders, IconChevron, ModalHeader, InfoHint, SiteFavicon } from './ui';
import {
  listPostsForBriefPhase, createPostForBriefPhase, createPlaceholdersForBriefPhase,
  updatePost, deletePost,
  type BriefPost,
} from '@/lib/actions/brief-posts';
import {
  generateFullDraft, critiquePost, translateBetween, generateBatchForPhase,
  type PostCritique, type BatchResult,
} from '@/lib/ai/post-draft';
// markCardSeeded sử dụng qua confirmCardPosted trong DispatchPostFlow
import { suggestBrief, type BriefSuggestion, type BriefSuggestionLang } from '@/lib/ai/brief-suggest';
import { AIFormParser } from './ai-form-parser';
import { VoiceContextPill } from './voice-context-pill';
import { ChannelPickerChip } from './channel-picker-chip';
import { PillarPickerChip } from './pillar-picker-chip';
import { DispatchPostFlow } from './dispatch-post-flow';
import { ChannelCoverageGrid } from './channel-coverage-grid';
import { getBriefRowContextBundle, type BriefRowContextBundle } from '@/lib/actions/brief-row-bundle';
import { FormatPreview } from './format-preview';
import { generatePostImage, generatePostImageVariants, generatePostImageSequence,
         setCardMedia, listProjectMedia, type ProjectMediaItem } from '@/lib/actions/post-media';
import { Spinner } from './ui';

type SuggestableField = 'approachMd' | 'narrativeMd' | 'cadence' | 'tone' | 'doMd' | 'dontMd';

// Account status meta — dùng registry chung trong @/lib/status-meta. Pre-2026-05-22
// đã có 1 map riêng ở đây + 1 ở accounts-vault + 1 ở seeding-cockpit → drift; giờ centralize.
import { accountStatusMeta } from '@/lib/status-meta';

export interface BriefEditModalProps {
  projectId: string;
  accountId: number;
  habitatId: number;
  // Display headers (read-only)
  accountLabel: string;     // e.g. "@oritapp · Reddit"
  habitatLabel: string;     // e.g. "r/SaaS · subreddit · 1.2M"
  habitatUrl?: string | null; // link community để mở ra đăng thật
  habitatKind?: string;       // discord/subreddit/... cho favicon fallback
  platformKey?: string;       // để lọc content formats hợp lệ khi tạo bài
  platformCategory?: string;
  // DB overrides cho allowedFormats (platform-level + habitat-level). Resolve
  // order: habitat → platform → hardcoded fallback (xem content-formats.ts).
  platformAllowedFormats?: string[] | null;
  habitatAllowedFormats?: string[] | null;
  // Account status pill ở header (cảnh báo nếu account chưa active / banned)
  accountStatus?: string;
  accountBlockReason?: string | null;
  // Số bài THỰC CÓ theo phase (để badge tab không nhập nhằng estimatedPosts).
  // Optional — nếu không truyền, fallback hiện estimatedPosts như cũ.
  phaseCounts?: Record<string, number>;
  // Breakdown count (phase × content_type) — Overview roadmap dùng để so
  // actual mix vs target mix per phase.
  phaseTypeCounts?: Record<string, Record<string, number>>;
  // Existing row, or null if creating
  existing: BriefRow | null;
  onClose: () => void;
  // Deep-link: mở thẳng tab phase + bung 1 bài cụ thể (từ pipeline view)
  initialTab?: 'overview' | Phase | 'history' | 'detect';
  focusCardId?: number;
  // Báo lên parent mỗi khi user đổi tab phase / mở-đóng 1 bài → ghi URL
  // (F5 mở lại ĐÚNG bài đang xem, không snap về deep-link cũ).
  onFocusChange?: (phase: string, cardId?: number) => void;
  // Click avatar/handle ở header → mở AccountFormModal (do parent cấp loader
  // vì cần project + platforms). Nếu không có callback → không click được.
  onOpenAccount?: (accountId: number) => void;
  // Báo parent biết posts (cards) trong brief vừa thay đổi (tạo/xóa/đổi
  // type/edit body) → parent re-fetch phaseCounts + phaseTypeCounts để
  // Overview roadmap + tab badges cập nhật real-time.
  onPostsChanged?: () => void;
  // Bump để force PostsForPhase re-fetch list (vd sau khi overlay con như
  // HabitatFormModal save xong + archive cards → list bài cần load lại).
  postsReloadKey?: number;
  // Tương tự cho habitat chip → mở HabitatFormModal (sửa platform/url/kind/
  // mod rules/members/...). Parent cấp loader vì cần tribes + platforms.
  onOpenHabitat?: (habitatId: number) => void;
}

export function BriefEditModal({
  projectId, accountId, habitatId,
  accountLabel, habitatLabel, habitatUrl, habitatKind, platformKey, platformCategory,
  platformAllowedFormats, habitatAllowedFormats, accountStatus, accountBlockReason,
  phaseCounts, phaseTypeCounts,
  existing, onClose, initialTab, focusCardId, onFocusChange, onOpenAccount, onOpenHabitat, onPostsChanged, postsReloadKey = 0,
}: BriefEditModalProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectRefreshing, setDetectRefreshing] = useState(false);

  const [approachMd, setApproachMd] = useState(existing?.approachMd ?? '');
  const [cadence,    setCadence]    = useState(existing?.cadence ?? '');
  const [tone,       setTone]       = useState(existing?.tone ?? '');
  const [doMd,       setDoMd]       = useState(existing?.doMd ?? '');
  const [dontMd,     setDontMd]     = useState(existing?.dontMd ?? '');
  const [templates,  setTemplates]  = useState<BriefTemplate[]>(existing?.templates ?? []);
  const [narrativeMd, setNarrativeMd] = useState(existing?.narrativeMd ?? '');

  // ── Persona voice (read-only, surfaced as header chip) ──────────
  const [personaVoice, setPersonaVoice] = useState<PersonaVoice | null>(null);
  useEffect(() => {
    let cancelled = false;
    getAccountPersonaVoice(accountId).then((v) => {
      if (!cancelled) setPersonaVoice(v);
    });
    return () => { cancelled = true; };
  }, [accountId]);

  // ── Habitat data (cho JoinStatusEditPopover: rules + members + gates) ──
  // Fetch 1 lần khi modal mở. Nếu user sửa habitat → habitatId không đổi
  // nhưng data có thể stale; refresh khi onPostsChanged hoặc onOpenHabitat close.
  const [habitatRow, setHabitatRow] = useState<HabitatRow | null>(null);
  useEffect(() => {
    let cancelled = false;
    getHabitatRowAction(projectId, habitatId).then((h) => {
      if (!cancelled) setHabitatRow(h);
    });
    return () => { cancelled = true; };
  }, [projectId, habitatId]);
  // Map HabitatRow → HabitatJoinContext (subset đủ cho popover)
  const habitatInfo: HabitatJoinContext | null = habitatRow ? {
    name: habitatRow.name,
    kind: habitatRow.kind,
    url: habitatRow.url,
    members: habitatRow.members,
    language: habitatRow.language,
    status: habitatRow.status,
    modStrictness: habitatRow.modStrictness,
    postingRules: habitatRow.postingRules,
    postingRulesUrl: habitatRow.postingRulesUrl,
    minAccountAgeDays: habitatRow.minAccountAgeDays,
    minKarma: habitatRow.minKarma,
    minPosts: habitatRow.minPosts,
    dominantTopics: habitatRow.dominantTopics,
    forbiddenTopics: habitatRow.forbiddenTopics,
    tribeName: null,  // tribeId only — name lookup tốn query; sẽ pass null tạm
    habitatIconUrl: habitatRow.iconUrl,
  } : null;

  // ── Phase plan state ────────────────────────────────────────────
  // currentPhase + phasePlan come from DB. activeTab decides which
  // editor pane is visible.
  type TabKey = 'overview' | Phase | 'history' | 'detect';
  const [activeTab, setActiveTab] = useState<TabKey>(
    existing && initialTab ? initialTab : 'overview');
  const [currentPhase, setCurrentPhase] = useState<Phase>(existing?.currentPhase ?? 'warm-up');
  const [phasePlan, setPhasePlan] = useState<PhaseEntry[]>(existing?.phasePlan ?? []);
  const phaseHistory = existing?.phaseHistory ?? [];

  // 0057 Join membership state — TÁCH HẲN khỏi phase. Phase warm-up chỉ active
  // khi joinStatus='joined'. Hiển thị banner phía trên phase tabs nếu chưa join.
  const [joinStatus, setJoinStatusState] = useState<JoinStatus>(existing?.joinStatus ?? 'not_joined');
  const [joinUrl, setJoinUrl] = useState<string>(existing?.joinUrl ?? '');
  const [joinNote, setJoinNote] = useState<string>(existing?.joinNote ?? '');
  const joinedAt = existing?.joinedAt ?? null;
  // Ref + scroll handler để chip ở header click → scroll banner ở body
  // vào viewport (banner có chi tiết + edit button).
  const joinBannerRef = useRef<HTMLDivElement | null>(null);
  const focusJoinBanner = () => {
    joinBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    joinBannerRef.current?.animate(
      [{ background: 'rgba(251,191,36,.25)' }, { background: 'transparent' }],
      { duration: 1200 },
    );
  };
  // Auto-focus banner khi modal mở với !joined — đỡ user phải tự tìm chip header
  // (0057 fix: brief chưa joined mà mở vào phase view → highlight ngay).
  useEffect(() => {
    if (joinStatus !== 'joined' && existing) {
      const t = setTimeout(focusJoinBanner, 300);
      return () => clearTimeout(t);
    }
  }, [joinStatus, existing]);

  // Auto-refresh khi ext POST brief mới (background relay window.postMessage).
  // Match theo briefId hoặc (accountId+habitatId). router.refresh() invalidate
  // page cache → parent loader re-fetch existing brief với scrapedMeta mới.
  useEffect(() => {
    if (!existing) return;
    const handler = (e: MessageEvent) => {
      if (e.source !== window) return;
      const data = e.data as { type?: string; briefId?: number; accountId?: number; habitatId?: number } | undefined;
      if (data?.type !== 'mos2:brief-updated') return;
      // Match brief đang mở
      if (data.briefId === existing.id
          || (data.accountId === accountId && data.habitatId === habitatId)) {
        console.log('[BriefModal] auto-refresh from ext brief-updated', data);
        router.refresh();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [existing, accountId, habitatId, router]);

  // 2-layer readiness: account (tầng 1) + join (tầng 2). Pass xuống children
  // qua isReady + notReadyReason để banner/button có thông điệp đúng layer.
  // notReadyReason có 3 tier (xem DispatchPostFlow):
  //   account-never-created = todo/creating (chưa tạo) → màu xanh dương, action "Tạo"
  //   account-broken        = blocked/banned/dormant/defunct → đỏ pulse, action "Xem"
  //   membership            = account active nhưng !joined → vàng, action "Fix join"
  const accountReady = isAccountReady(accountStatus);
  const isReady = accountReady && joinStatus === 'joined';
  const notReadyReason: 'account-never-created' | 'account-broken' | 'membership' =
    accountStatus === 'todo' || accountStatus === 'creating' ? 'account-never-created' :
    accountStatus && !accountReady ? 'account-broken' :
    'membership';
  // onRequestFix: account-layer → mở Account modal; membership-layer → scroll banner.
  const onRequestFix = () => {
    if (!accountReady && onOpenAccount) onOpenAccount(accountId);
    else focusJoinBanner();
  };

  // First time a brief is opened with empty plan, auto-init from archetype
  // defaults. Idempotent on the server (only fills if empty).
  useEffect(() => {
    if (!existing) return;
    if (phasePlan.length > 0) return;
    let cancelled = false;
    initPhasePlanFromDefaults(projectId, existing.id).then((res) => {
      if (cancelled) return;
      if (res.ok && res.plan) setPhasePlan(res.plan);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  const updatePhaseEntry = (phase: Phase, patch: Partial<PhaseEntry>) => {
    setPhasePlan((prev) => {
      const idx = prev.findIndex((e) => e.phase === phase);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx]!, ...patch };
      return next;
    });
  };

  const persistPhasePlan = (next: PhaseEntry[]) => {
    if (!existing) return;
    startTransition(async () => { await savePhasePlan(projectId, existing.id, next); });
  };

  // Inline phase-change popover. null = closed. Object = open w/ target phase + reason text.
  const [phaseChange, setPhaseChange] = useState<{ to: Phase; reason: string } | null>(null);

  const doAdvancePhase = () => {
    if (!existing || !phaseChange) return;
    const { to, reason } = phaseChange;
    if (to === currentPhase) { setPhaseChange(null); return; }
    setBusy(true);
    startTransition(async () => {
      const res = await advancePhase(projectId, existing.id, to, reason);
      setBusy(false);
      setPhaseChange(null);
      if (res.ok) { setCurrentPhase(to); /* state đã setLocal — KHÔNG router.refresh */ }
    });
  };

  // ── AI suggestion state ─────────────────────────────────────────
  // Hydrate from DB when modal opens — surviving F5 / re-open. Generate
  // is expensive (LLM tokens + 2-3s) so we cache it in community_briefs
  // (columns ai_suggestion + ai_suggestion_at).
  const [suggestion, setSuggestion]       = useState<BriefSuggestion | null>(
    (existing?.aiSuggestion as BriefSuggestion | null) ?? null,
  );
  const [suggestionAt, setSuggestionAt]   = useState<string | null>(existing?.aiSuggestionAt ?? null);
  const [suggestBusy, setSuggestBusy]     = useState(false);
  const [suggestError, setSuggestError]   = useState<string | null>(null);
  // Default UI language preference for actions (Replace/Append).
  const [suggestLang, setSuggestLang]     = useState<'en' | 'vi'>('vi');
  // Free-form extra instruction for the LLM, e.g. "more aggressive tone",
  // "skip emojis", "focus on indie devs". Persisted only in this modal
  // session — not saved to DB.
  const [extraInstruction, setExtraInstruction] = useState<string>('');

  // Per-field "đang regen" state - khi user click ↻ trên 1 SuggestionInline.
  // Field nào đang regen thì show spinner trên card đó, các card khác giữ
  // nguyên suggestion cũ.
  const [regenField, setRegenField] = useState<SuggestableField | null>(null);

  // Map field key → current value, dùng để merge khi server trả empty
  // (enrich-missing mode AI return "" cho field đã có data → giữ suggestion cũ).
  const currentValuesMap = (): Record<SuggestableField, string> => ({
    approachMd, narrativeMd, cadence, tone, doMd, dontMd,
  });

  // Count fields đang trống (dùng cho badge nút "Chỉ field trống").
  const emptyFieldCount = (Object.entries(currentValuesMap()) as [SuggestableField, string][])
    .filter(([, v]) => v.trim().length === 0).length;

  const handleGenerateSuggestion = (
    focusField?: SuggestableField,
    opts?: { emptyOnly?: boolean },
  ) => {
    setSuggestBusy(true);
    setSuggestError(null);
    if (focusField) setRegenField(focusField);
    startTransition(async () => {
      const res = await suggestBrief({
        accountId, habitatId,
        current: { approachMd, narrativeMd, cadence, tone, doMd, dontMd },
        extraInstruction: extraInstruction.trim() || undefined,
        regenField: focusField,
        regenEmptyOnly: opts?.emptyOnly,
      });
      if (!res.ok || !res.suggestion) {
        setSuggestBusy(false);
        setRegenField(null);
        setSuggestError(res.error ?? 'Suggest failed');
        return;
      }
      // Merge logic: trong enrich-missing mode, AI return "" cho field đã có
      // data → giữ suggestion cũ field đó (không ghi đè). Field rỗng được fill.
      let merged = res.suggestion;
      if (opts?.emptyOnly && suggestion) {
        const mergeLang = (lang: 'en' | 'vi'): BriefSuggestion['en'] => ({
          approachMd:  res.suggestion![lang].approachMd  || suggestion[lang].approachMd,
          narrativeMd: res.suggestion![lang].narrativeMd || suggestion[lang].narrativeMd,
          cadence:     res.suggestion![lang].cadence     || suggestion[lang].cadence,
          tone:        res.suggestion![lang].tone        || suggestion[lang].tone,
          doMd:        res.suggestion![lang].doMd        || suggestion[lang].doMd,
          dontMd:      res.suggestion![lang].dontMd      || suggestion[lang].dontMd,
          rationale:   res.suggestion![lang].rationale   || suggestion[lang].rationale,
        });
        merged = { en: mergeLang('en'), vi: mergeLang('vi') };
      }
      // Persist BEFORE flipping busy so user knows the cache is real.
      const saved = await saveBriefSuggestion(projectId, accountId, habitatId, merged);
      setSuggestBusy(false);
      setRegenField(null);
      if (!saved.ok) {
        // Suggestion still usable in-memory — surface the cache error softly.
        setSuggestError(`Generated OK but cache failed: ${saved.error ?? 'unknown'}`);
      }
      setSuggestion(merged);
      setSuggestionAt(new Date().toISOString());
    });
  };

  const setterFor = (k: SuggestableField): ((v: string) => void) => {
    if (k === 'approachMd')  return setApproachMd;
    if (k === 'narrativeMd') return setNarrativeMd;
    if (k === 'cadence')     return setCadence;
    if (k === 'tone')        return setTone;
    if (k === 'doMd')        return setDoMd;
    return setDontMd;
  };
  const currentFor = (k: SuggestableField): string => {
    if (k === 'approachMd')  return approachMd;
    if (k === 'narrativeMd') return narrativeMd;
    if (k === 'cadence')     return cadence;
    if (k === 'tone')        return tone;
    if (k === 'doMd')        return doMd;
    return dontMd;
  };

  const fld: React.CSSProperties = {
    width: '100%', padding: '6px 8px', background: 'var(--bg-2)',
    border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)',
    fontSize: 13, outline: 'none',
  };
  const lbl: React.CSSProperties = {
    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block',
  };

  const handleSave = () => {
    setBusy(true);
    setError(null);
    startTransition(async () => {
      const res = await upsertBrief(projectId, accountId, habitatId, {
        approachMd, cadence, tone, doMd, dontMd, templates, narrativeMd,
      });
      setBusy(false);
      if (!res.ok) { setError(res.error || 'Save failed'); return; }
      router.refresh();
      onClose();
    });
  };

  const handleDelete = () => {
    if (!existing) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    setBusy(true);
    startTransition(async () => {
      await deleteBrief(projectId, existing.id);
      setBusy(false);
      router.refresh();
      onClose();
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: 'min(1480px, 97vw)', maxWidth: 1480 }} onClick={(e) => e.stopPropagation()}>
        <ModalHeader
          kind="brief"
          action={existing ? 'edit' : 'create'}
          accentColor={existing ? PHASE_COLOR[currentPhase] : undefined}
          idText={existing ? `#${existing.id}` : undefined}
          title={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {/* Account chip — click mở AccountFormModal. Persona voice nhét
                  vào tooltip thay vì subtitle để header gọn. */}
              {(() => {
                const personaHint = personaVoice && (personaVoice.voiceSummary || personaVoice.narrativeStyle)
                  ? `\n🎙 Persona: ${personaVoice.voiceSummary ?? ''}${personaVoice.narrativeStyle ? ` · ${personaVoice.narrativeStyle}` : ''}`
                  : '';
                const tooltip = `Mở profile account — sửa persona / handle / login / status / proxy${personaHint}`;
                if (onOpenAccount) {
                  return (
                    <button type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenAccount(accountId); }}
                            title={tooltip}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                                     padding: '2px 8px', background: 'var(--accent-soft)',
                                     border: '1px solid var(--accent-line)', borderRadius: 5,
                                     cursor: 'pointer', color: 'var(--accent)', fontWeight: 700 }}>
                      <SiteFavicon iconSlug={platformKey || undefined}
                                   kind={platformKey || undefined}
                                   size={14}
                                   title={`Platform: ${platformKey || '?'}`} />
                      {accountLabel}
                      <span style={{ fontSize: 9, opacity: 0.65 }}>✎</span>
                    </button>
                  );
                }
                return (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} title={tooltip}>
                    <SiteFavicon iconSlug={platformKey || undefined}
                                 kind={platformKey || undefined}
                                 size={16}
                                 title={`Platform: ${platformKey || '?'}`} />
                    <span style={{ color: 'var(--accent)' }}>{accountLabel}</span>
                  </span>
                );
              })()}
              {/* AccountReadinessChip — TẦNG 1 (account global). Hiện khi
                  account != active. Dead status (todo/creating/blocked/banned/dormant/defunct)
                  → pulse warning đỏ rõ rệt. Click → mở Account modal fix.
                  Khác với JoinChip (tầng 2 — membership per-habitat). */}
              <AccountReadinessChip
                accountStatus={accountStatus ?? ''}
                blockReason={accountBlockReason}
                onClick={onOpenAccount ? () => onOpenAccount(accountId) : undefined}
              />
              <span style={{ color: 'var(--fg-4)' }}>×</span>
              {/* Habitat chip — click mở HabitatFormModal (sửa url / kind /
                  platform / mod rules / members / posting rules / topics). */}
              {onOpenHabitat ? (
                <button type="button"
                        onClick={(e) => { e.stopPropagation(); onOpenHabitat(habitatId); }}
                        title={`Mở sửa habitat — url, kind, platform, mod rules, posting gates, dominant/forbidden topics`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                                 padding: '2px 8px', background: 'var(--bg-2)',
                                 border: '1px solid var(--line)', borderRadius: 5,
                                 cursor: 'pointer', color: 'var(--fg-0)', fontWeight: 600 }}>
                  <SiteFavicon url={habitatUrl}
                               kind={habitatKind}
                               size={14}
                               title={habitatUrl ?? `Habitat: ${habitatLabel}`} />
                  {habitatLabel}
                  <span style={{ fontSize: 9, opacity: 0.55 }}>✎</span>
                </button>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <SiteFavicon url={habitatUrl}
                               kind={habitatKind}
                               size={16}
                               title={habitatUrl ?? `Habitat: ${habitatLabel}`} />
                  <span>{habitatLabel}</span>
                </span>
              )}
              {/* Link community — icon only để header gọn (label nhét tooltip) */}
              {habitatUrl && (
                <a href={habitatUrl} target="_blank" rel="noopener noreferrer"
                   onClick={(e) => e.stopPropagation()}
                   title={`Mở community trong tab mới: ${habitatUrl}`}
                   style={{ display: 'inline-flex', alignItems: 'center',
                            padding: '3px 7px', fontSize: 11, fontFamily: 'var(--font-mono)',
                            fontWeight: 700, color: 'var(--accent)',
                            background: 'var(--accent-soft)',
                            border: '1px solid var(--accent-line)',
                            borderRadius: 4, textDecoration: 'none' }}>
                  ↗
                </a>
              )}
              {/* Join chip — tầng 2 (per-habitat membership). CHỈ render khi
                  account ready (tầng 1). Account !ready → AccountReadinessChip
                  đã loud rồi, JoinChip thêm vào sẽ nhiễu vì join phụ thuộc
                  account tồn tại. */}
              {existing && isAccountReady(accountStatus) && (
                <JoinChip joinStatus={joinStatus} joinedAt={joinedAt}
                          onClick={focusJoinBanner} />
              )}
            </span>
          }
          subtitle={existing ? (
            // Stat bar compact: chỉ phase pill + count. Mix achievement đã có
            // trong Strategy drawer + tab phase đã hiển thị count → bỏ duplicate.
            (() => {
              const cur = currentPhase;
              const entry = phasePlan.find((e) => e.phase === cur);
              const have = phaseCounts?.[cur] ?? 0;
              const planned = entry?.estimatedPosts ?? 0;
              const eff = effectiveMix(platformKey, platformCategory, entry?.formatMix, undefined, platformAllowedFormats, habitatAllowedFormats);
              const actualCounts = phaseTypeCounts?.[cur] ?? {};
              const ach = computeMixAchievement(actualCounts, eff);
              const missCount = ach.items.filter((i) => i.verdict === 'miss' || i.verdict === 'under').length;
              const phaseColor = PHASE_COLOR[cur];
              const fullTooltip = [
                `Phase hiện tại: ${PHASE_LABEL[cur]}`,
                entry?.goal ? `🎯 ${entry.goal}` : null,
                entry?.cadence ? `⏱ ${entry.cadence}` : null,
                ach.total > 0 ? `${ach.doneCount}/${ach.items.length} loại đạt${missCount > 0 ? ` · ${missCount} thiếu` : ''}` : null,
              ].filter(Boolean).join('\n');
              return (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                               fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                  <span title={fullTooltip}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                                 padding: '2px 8px', fontSize: 10, fontWeight: 700,
                                 borderRadius: 3, textTransform: 'uppercase',
                                 background: phaseColor + '22', color: phaseColor,
                                 border: `1px solid ${phaseColor}66`, cursor: 'help' }}>
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: phaseColor,
                                   boxShadow: `0 0 6px ${phaseColor}` }} />
                    {PHASE_LABEL[cur]}
                  </span>
                  <span title={fullTooltip}
                        style={{ color: have > 0 ? 'var(--ok)' : 'var(--fg-3)', cursor: 'help' }}>
                    📝 {have}{planned > 0 ? `/${planned}` : ''} bài
                  </span>
                  {missCount > 0 && (
                    <span title={fullTooltip}
                          style={{ color: 'var(--warn)', cursor: 'help' }}>
                      🎯 {missCount} thiếu
                    </span>
                  )}
                </span>
              );
            })()
          ) : undefined}
          onClose={onClose}
        />

        {existing && (
          <div ref={joinBannerRef}>
            <JoinStatusBanner
              projectId={projectId}
              briefId={existing.id}
              habitatLabel={habitatLabel}
              habitatUrl={habitatUrl ?? null}
              joinStatus={joinStatus}
              joinedAt={joinedAt}
              joinUrl={joinUrl}
              joinNote={joinNote}
              habitatInfo={habitatInfo}
              onOpenHabitat={onOpenHabitat ? () => onOpenHabitat(habitatId) : undefined}
              onChange={(next, payload) => {
                setJoinStatusState(next);
                if (payload?.joinUrl !== undefined) setJoinUrl(payload.joinUrl ?? '');
                if (payload?.joinNote !== undefined) setJoinNote(payload.joinNote ?? '');
              }}
            />
          </div>
        )}

        {existing && (
          <PhaseTabStrip
            activeTab={activeTab}
            currentPhase={currentPhase}
            phasePlan={phasePlan}
            phaseCounts={phaseCounts}
            phaseHistoryCount={phaseHistory.length}
            onChange={(t) => {
              setActiveTab(t);
              // URL phản chiếu tab: overview (default) → xoá param; phase
              // / history / detect → set bfp=<tab> (luôn xoá bfc card focus).
              if (t === 'overview') onFocusChange?.('', undefined);
              else onFocusChange?.(t, undefined);
            }}
            isJoined={isReady}
          />
        )}

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14 }}>

          {/* Habitat thiếu URL → cảnh báo + CTA sửa habitat. Không có URL thì
              không đăng được, không gen ảnh đúng context, không markPosted. */}
          {existing && !habitatUrl && (
            <div style={{ padding: '8px 12px', background: 'rgba(251,191,36,.08)',
                          border: '1px solid rgba(251,191,36,.45)',
                          borderLeft: '3px solid var(--warn)',
                          borderRadius: 5, display: 'flex', alignItems: 'center',
                          gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 18 }}>⚠</span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--warn)' }}>
                  Habitat chưa có URL community
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 2 }}>
                  Không biết community ở đâu → KHÔNG mở được để đăng, KHÔNG đánh dấu được "đã đăng".
                  Sửa habitat điền URL trước rồi quay lại đăng bài.
                </div>
              </div>
              {onOpenHabitat && (
                <button type="button" className="btn primary"
                        onClick={(e) => { e.stopPropagation(); onOpenHabitat(habitatId); }}
                        style={{ fontSize: 11, padding: '5px 12px', fontWeight: 700 }}>
                  ✎ Sửa habitat
                </button>
              )}
            </div>
          )}

          {/* Phase-specific editor (replaces the flat form when tab !== overview/history/detect) */}
          {existing && activeTab !== 'overview' && activeTab !== 'history' && activeTab !== 'detect' && (
            <PhaseEntryEditor
              projectId={projectId}
              briefId={existing.id}
              habitatId={habitatId}
              habitatUrl={habitatUrl}
              onOpenHabitat={onOpenHabitat}
              platformKey={platformKey}
              platformCategory={platformCategory}
              platformAllowedFormats={platformAllowedFormats}
              habitatAllowedFormats={habitatAllowedFormats}
              actualPostCount={phaseCounts?.[activeTab] ?? 0}
              phase={activeTab}
              entry={phasePlan.find((e) => e.phase === activeTab) ?? null}
              isCurrentPhase={activeTab === currentPhase}
              onChange={(patch) => updatePhaseEntry(activeTab, patch)}
              onBlur={() => persistPhasePlan(phasePlan)}
              onAdvance={() => setPhaseChange({ to: activeTab, reason: '' })}
              focusCardId={activeTab === initialTab ? focusCardId : undefined}
              onFocusChange={onFocusChange}
              onPostsChanged={onPostsChanged}
              postsReloadKey={postsReloadKey}
              isJoined={isReady}
              onRequestJoin={onRequestFix}
              notReadyReason={notReadyReason}
            />
          )}

          {/* Inline advance-phase confirm popover */}
          {phaseChange && (
            <div style={{
              padding: 12, background: 'var(--accent-soft)', border: `2px solid ${PHASE_COLOR[phaseChange.to]}`,
              borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ fontSize: 12, color: 'var(--fg-0)' }}>
                Chuyển <strong>{PHASE_LABEL[currentPhase]}</strong> →{' '}
                <strong style={{ color: PHASE_COLOR[phaseChange.to] }}>{PHASE_LABEL[phaseChange.to]}</strong>?
                <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 4 }}>
                  {PHASE_DESCRIPTION[phaseChange.to]}
                </div>
              </div>
              <input type="text" value={phaseChange.reason}
                     onChange={(e) => setPhaseChange({ ...phaseChange, reason: e.target.value })}
                     placeholder="Lý do (ghi vào phase_history)…"
                     autoComplete="off" data-1p-ignore data-lpignore="true" name="phase-reason"
                     style={{ padding: '6px 8px', background: 'var(--bg-2)', color: 'var(--fg-0)',
                              border: '1px solid var(--line)', borderRadius: 5, fontSize: 12, outline: 'none' }} />
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button className="btn ghost" type="button" onClick={() => setPhaseChange(null)}
                        style={{ fontSize: 11 }}>Hủy</button>
                <button className="btn primary" type="button" onClick={doAdvancePhase} disabled={busy}
                        style={{ fontSize: 11, background: PHASE_COLOR[phaseChange.to], borderColor: PHASE_COLOR[phaseChange.to] }}>
                  {busy ? <Spinner size="xs" /> : '✓ Xác nhận chuyển'}
                </button>
              </div>
            </div>
          )}

          {/* History tab */}
          {existing && activeTab === 'history' && (
            <PhaseHistoryView history={phaseHistory} currentPhase={currentPhase} />
          )}

          {/* Auto-detect tab: brief fields scraped từ ext (join_status,
              karma_in_sub, member_role, last_visited_at). Render gọn 1
              section, focusAccountId để chỉ show value của brief hiện
              tại (không phải tất cả briefs cùng habitat). */}
          {existing && activeTab === 'detect' && platformKey && (
            <BriefSelectorsSection
              habitatId={habitatId}
              platformKey={platformKey}
              briefs={[{
                id: existing.id,
                accountId,
                accountHandle: accountLabel.replace(/^@/, ''),
                joinStatus,
                scrapedMeta: (existing as { scrapedMeta?: Record<string, unknown> }).scrapedMeta ?? {},
              }]}
              focusAccountId={accountId}
              refreshing={detectRefreshing}
              onRefresh={async () => {
                setDetectRefreshing(true);
                try {
                  router.refresh();
                  // router.refresh không return Promise — wait nhẹ để
                  // re-fetch + re-render visible cho user.
                  await new Promise((r) => setTimeout(r, 800));
                } finally {
                  setDetectRefreshing(false);
                }
              }}
            />
          )}

          {/* Overview tab (or new brief, no tabs yet) keeps the legacy flat form */}
          {(activeTab === 'overview' || !existing) && (
          <>
          {!existing && (
            <div style={{ padding: 8, fontSize: 11, color: 'var(--fg-3)', background: 'var(--bg-2)', borderRadius: 5, border: '1px dashed var(--line)' }}>
              Sau khi tạo brief, các tab phase (Warm-up / Value / Bridge / Seed / Direct) sẽ xuất hiện với chiến lược chi tiết theo từng thời điểm.
            </div>
          )}
          {/* ── Roadmap chiến lược 5 phase — tóm tắt mix + cadence + goal/phase
                Click 1 phase → switch sang tab đó để sửa chi tiết. ── */}
          {existing && phasePlan.length > 0 && (
            <div style={{ padding: 10, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span title="Roadmap 5 phase + mix định dạng + tần suất + mục tiêu — click 1 phase để mở chi tiết và sửa."
                      style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'help' }}>
                  🗺 Chiến lược 5 phase
                </span>
                <span style={{ fontSize: 10, color: 'var(--fg-4)' }}>
                  click 1 phase để mở sửa
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {PLANNED_PHASES.map((p) => {
                  const entry = phasePlan.find((e) => e.phase === p);
                  const have = phaseCounts?.[p] ?? 0;
                  const isCurrent = p === currentPhase;
                  const eff = effectiveMix(platformKey, platformCategory, entry?.formatMix, undefined, platformAllowedFormats, habitatAllowedFormats);
                  const hasOv = entry?.formatMix && Object.keys(entry.formatMix).length > 0;
                  const actualCounts = phaseTypeCounts?.[p] ?? {};
                  const ach = computeMixAchievement(actualCounts, eff);
                  return (
                    <button key={p} type="button" onClick={() => setActiveTab(p)}
                            title={`Mở tab ${PHASE_LABEL[p]} để sửa mục tiêu / tần suất / mix / Nên-Không / hooks`}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px',
                                     background: isCurrent ? PHASE_COLOR[p] + '14' : 'var(--bg-1)',
                                     border: `1px solid ${isCurrent ? PHASE_COLOR[p] + '66' : 'var(--line)'}`,
                                     borderLeft: `3px solid ${PHASE_COLOR[p]}`,
                                     borderRadius: 5, cursor: 'pointer', textAlign: 'left', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
                                     color: PHASE_COLOR[p], minWidth: 80, textTransform: 'uppercase',
                                     display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {isCurrent && <span style={{ width: 5, height: 5, borderRadius: 3, background: PHASE_COLOR[p], boxShadow: `0 0 6px ${PHASE_COLOR[p]}` }} />}
                        {PHASE_LABEL[p]}
                      </span>
                      {/* Số bài thực */}
                      <span style={{ padding: '0 5px', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                                     borderRadius: 3,
                                     background: have > 0 ? 'rgba(74,222,128,.12)' : 'var(--bg-2)',
                                     color: have > 0 ? 'var(--ok)' : 'var(--fg-4)',
                                     border: `1px solid ${have > 0 ? 'rgba(74,222,128,.4)' : 'var(--line)'}` }}>
                        {have} bài
                      </span>
                      {/* Cadence */}
                      {entry?.cadence && (
                        <span title={`Tần suất: ${entry.cadence}`}
                              style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)',
                                       display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          ⏱ {entry.cadence}
                        </span>
                      )}
                      {/* Achievement bar — actual vs target per format. Có bài
                          rồi → hiện actual/target + verdict (✓/⚠/✕/+); chưa
                          có bài → hiện target % để biết tiêu chí. */}
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
                        <span title={hasOv ? 'Override mix' : 'Mặc định platform'}
                              style={{ padding: '0 4px', fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                                       borderRadius: 2, textTransform: 'uppercase',
                                       background: hasOv ? 'rgba(167,139,250,.15)' : 'var(--bg-2)',
                                       color: hasOv ? '#a78bfa' : 'var(--fg-4)',
                                       border: `1px solid ${hasOv ? 'rgba(167,139,250,.4)' : 'var(--line)'}` }}>
                          {hasOv ? 'OVR' : 'DEF'}
                        </span>
                        {ach.items.map((it) => {
                          const col = formatColors(it.key);
                          const meta = formatMeta(it.key);
                          const targetPct = Math.round(it.targetShare * 100);
                          const icon = it.verdict === 'ok' ? '✓' : it.verdict === 'miss' ? '✕' : it.verdict === 'extra' ? '+' : '⚠';
                          const verdictColor =
                            it.verdict === 'ok' ? 'var(--ok)' :
                            it.verdict === 'miss' ? 'var(--bad)' :
                            it.verdict === 'extra' ? '#a78bfa' :
                            'var(--warn)';
                          const label = have === 0 ? `${targetPct}%` : `${it.actual}/${it.target || '?'}`;
                          const tip = have === 0
                            ? `${meta.label}: target ${targetPct}% (chưa có bài để so)`
                            : it.verdict === 'extra'
                              ? `${meta.label}: thừa ${it.actual} bài (không trong mix mục tiêu)`
                              : it.verdict === 'miss'
                                ? `${meta.label}: CHƯA CÓ — target ~${it.target} bài (${targetPct}%)`
                                : it.verdict === 'ok'
                                  ? `${meta.label}: ✓ ${it.actual}/${it.target} đạt`
                                  : `${meta.label}: ${it.actual}/${it.target} đang thiếu`;
                          return (
                            <span key={it.key} title={tip}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 2,
                                           padding: '1px 5px', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                                           borderRadius: 3, background: col.bg, color: col.fg,
                                           border: `1px solid ${col.border}`,
                                           opacity: it.verdict === 'miss' ? 0.55 : 1 }}>
                              <FormatIcon kind={it.key} size={9} />
                              {label}
                              <span style={{ color: verdictColor, fontSize: 9, fontWeight: 700 }}>{icon}</span>
                            </span>
                          );
                        })}
                      </span>
                      {/* Goal 1 dòng (truncate) */}
                      {entry?.goal && (
                        <span style={{ flexBasis: '100%', fontSize: 10.5, color: 'var(--fg-2)',
                                       overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                          🎯 {entry.goal}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {/* Content Pillar default cho brief — mọi card mới inherit pillar
              này. Per-card có thể override qua chip 📚 trong card header. */}
          {existing && (
            <BriefPillarPicker
              projectId={projectId}
              briefId={existing.id}
              initialPillarId={existing.primaryPillarId}
              onChanged={() => onPostsChanged?.()}
            />
          )}
          {/* Channel coverage matrix — chỉ Discord/Slack/Telegram. Click ô
              trống → tạo 1 bài cho (channel × phase) tương ứng, auto-gắn
              channel + voice. Giúp cover tất cả surface trong server. */}
          {existing && habitatId != null && (
            <ChannelCoverageGrid
              projectId={projectId}
              briefId={existing.id}
              habitatId={habitatId}
              isDiscordLike={['discord', 'slack', 'telegram'].includes(platformKey ?? '')}
              reloadKey={postsReloadKey}
              onPostsChanged={onPostsChanged}
            />
          )}
          <AIFormParser
            context={`Tạo phương án tiếp cận cho persona "${accountLabel}" khi engage trong "${habitatLabel}". Dựa vào community rules / brand voice / competitor posts. Trả về JSON đúng schema. approachMd nên là markdown 4-8 dòng (NƠI/KHI engage). narrativeMd là 5-10 dòng markdown mô tả CÁCH kể chuyện (Vòng cung / Giọng / Hook mở bài / Kết / Tránh). doMd/dontMd dùng bullet list "- ".`}
            schema={[
              { key: 'approachMd',  label: 'Phương án tiếp cận (markdown)', type: 'string', description: 'Tổng quan chiến thuật 4-8 dòng - NƠI/KHI engage' },
              { key: 'narrativeMd', label: 'Cách kể chuyện (markdown)',     type: 'string', description: 'Vòng cung story / Giọng / Hook mở bài / Kết / Tránh - CÁCH viết' },
              { key: 'cadence',     label: 'Tần suất',                      type: 'string', description: 'vd: "3 replies/day", "1 post/week"' },
              { key: 'tone',        label: 'Giọng',                         type: 'string', description: 'vd: "helpful expert, mystical, casual VN"' },
              { key: 'doMd',        label: 'NÊN (markdown bullets)',        type: 'string' },
              { key: 'dontMd',      label: 'KHÔNG (markdown bullets)',      type: 'string' },
            ]}
            currentValues={{ approachMd, narrativeMd, cadence, tone, doMd, dontMd }}
            onApply={(v) => {
              if (v.approachMd != null) setApproachMd(String(v.approachMd));
              if (v.narrativeMd != null) setNarrativeMd(String(v.narrativeMd));
              if (v.cadence != null) setCadence(String(v.cadence));
              if (v.tone != null) setTone(String(v.tone));
              if (v.doMd != null) setDoMd(String(v.doMd));
              if (v.dontMd != null) setDontMd(String(v.dontMd));
            }}
          />

          {/* ── AI auto-suggest from context ────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
            background: 'var(--accent-soft)', border: '1px solid var(--accent-line)',
            borderRadius: 6, fontSize: 11.5, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 14 }}>✨</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ color: 'var(--fg-0)', fontWeight: 600 }}>
                AI đề xuất phương án (en + vi)
                {suggestionAt && (
                  <span style={{ marginLeft: 8, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', fontWeight: 400 }}>
                    · cached {fmtAgo(suggestionAt)}
                  </span>
                )}
              </div>
              <div style={{ color: 'var(--fg-3)', fontSize: 10.5 }}>
                Đọc account + habitat + nội dung hiện có → đề xuất song ngữ. Lưu lại để F5 không mất. Không ghi đè input — chủ động Replace/Append.
              </div>
            </div>
            {suggestion && (
              <div style={{ display: 'inline-flex', gap: 2, padding: 2, background: 'var(--bg-1)', border: '1px solid var(--accent-line)', borderRadius: 5 }}>
                {(['vi', 'en'] as const).map((l) => (
                  <button key={l} type="button" onClick={() => setSuggestLang(l)}
                          title={`Default lang for Replace/Append actions (${l.toUpperCase()})`}
                          style={{
                            padding: '2px 8px', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                            background: suggestLang === l ? 'var(--accent)' : 'transparent',
                            color: suggestLang === l ? '#fff' : 'var(--accent)',
                            border: 'none', borderRadius: 3, cursor: 'pointer',
                          }}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
            {emptyFieldCount > 0 && (
              <button type="button"
                      onClick={() => handleGenerateSuggestion(undefined, { emptyOnly: true })} disabled={suggestBusy}
                      className="btn" style={{ fontSize: 11, padding: '4px 10px' }}
                      title={`Chỉ generate suggestion cho ${emptyFieldCount} field đang trống. Field đã có data giữ nguyên suggestion cũ. Tiết kiệm token + nhanh hơn full regen.`}>
                ✦ Chỉ field trống <span style={{ marginLeft: 4, padding: '0 5px', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, background: 'var(--bg-1)', color: 'var(--accent)', borderRadius: 8, border: '1px solid var(--accent-line)' }}>{emptyFieldCount}</span>
              </button>
            )}
            <button type="button"
                    onClick={() => handleGenerateSuggestion()} disabled={suggestBusy}
                    className="btn primary" style={{ fontSize: 11, padding: '4px 10px' }}
                    title={emptyFieldCount > 0
                      ? `Regen toàn bộ - kể cả ${6 - emptyFieldCount} field đã có data (sẽ propose refinement / alternative)`
                      : 'Regen suggestion cho toàn bộ 6 field'}>
              {suggestBusy
                ? <><Spinner size="xs" /> Đang generate</>
                : suggestion ? '↻ Regen tất cả' : '✨ Generate'}
            </button>
          </div>
          {/* Optional custom instruction — appended to LLM prompt as high-priority. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', flexShrink: 0 }}>🎙 Custom prompt</span>
            <input
              type="text"
              value={extraInstruction}
              onChange={(e) => setExtraInstruction(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !suggestBusy) handleGenerateSuggestion(); }}
              placeholder='Optional: "more aggressive", "tránh emoji", "focus indie devs", "kèm meme tham khảo"…'
              autoComplete="off" data-1p-ignore data-lpignore="true" name="extra-instr"
              style={{
                flex: 1, padding: '5px 8px', fontSize: 11,
                background: 'var(--bg-2)', color: 'var(--fg-0)',
                border: '1px solid var(--line)', borderRadius: 4, outline: 'none',
                fontFamily: 'var(--font-sans)',
              }}
            />
            {extraInstruction && (
              <button type="button" onClick={() => setExtraInstruction('')}
                      title="Clear custom prompt"
                      style={{ fontSize: 10, padding: '3px 7px', background: 'transparent', color: 'var(--fg-3)', border: '1px solid var(--line)', borderRadius: 4, cursor: 'pointer', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                ✕
              </button>
            )}
          </div>
          {suggestError && (
            <div style={{ padding: 6, background: 'rgba(255,77,94,.1)', border: '1px solid rgba(255,77,94,.4)', color: 'var(--bad)', fontSize: 11, borderRadius: 5 }}>
              ⚠ {suggestError}
            </div>
          )}
          {suggestion?.[suggestLang]?.rationale && (
            <div style={{ fontSize: 11, color: 'var(--fg-2)', padding: '6px 8px', background: 'var(--bg-2)', borderRadius: 5, borderLeft: '3px solid var(--accent)' }}>
              <strong style={{ color: 'var(--accent)' }}>Why ({suggestLang.toUpperCase()}):</strong> {suggestion[suggestLang].rationale}
            </div>
          )}

          <div className="modal-cols cols-2">
          <div>
            <FieldLabel label="📖 Cách kể chuyện"
                        hint="vòng cung story, mẫu mở bài, giọng DNA cho combo persona × community này"
                        lbl={lbl}
                        suggestion={suggestion} suggestLang={suggestLang} field="narrativeMd" current={narrativeMd}
                        onApply={(v) => setNarrativeMd(v)} />
            <textarea
              value={narrativeMd}
              onChange={(e) => setNarrativeMd(e.target.value)}
              rows={6}
              style={{ ...fld, fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' }}
              placeholder={'**Vòng cung**: hook → context → insight → mời tham gia\n**Giọng**: scholar warm-story-driven\n**Hook mở bài**: "Tôi đọc 50 chart tháng trước và nhận thấy..."\n**Kết**: câu hỏi mời chia sẻ câu chuyện'}
            />
            <SuggestionInline suggestion={suggestion} defaultLang={suggestLang} field="narrativeMd" current={narrativeMd}
                              setterFor={setterFor} currentFor={currentFor}
                              onRegenerate={() => handleGenerateSuggestion('narrativeMd')} regenerating={regenField === 'narrativeMd'} />
            <div style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              khác với Phương án tiếp cận (NƠI/KHI engage) — kể chuyện là CÁCH viết cho mỗi post
            </div>
          </div>

          <div>
            <FieldLabel label="Approach" hint="markdown — tổng quan chiến thuật" lbl={lbl}
                        suggestion={suggestion} suggestLang={suggestLang} field="approachMd" current={approachMd}
                        onApply={(v) => setApproachMd(v)} />
            <textarea
              value={approachMd}
              onChange={(e) => setApproachMd(e.target.value)}
              rows={5}
              style={{ ...fld, fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' }}
              placeholder="vd: Tham gia trả lời chart-reading. Reply dài 5-8 dòng, dẫn nguồn từ Astrolas. Soft-mention link app cuối reply nếu user hỏi sâu thêm."
            />
            <SuggestionInline suggestion={suggestion} defaultLang={suggestLang} field="approachMd" current={approachMd}
                              setterFor={setterFor} currentFor={currentFor}
                              onRegenerate={() => handleGenerateSuggestion('approachMd')} regenerating={regenField === 'approachMd'} />
          </div>
          </div>{/* /modal-cols: kể chuyện | approach */}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <FieldLabel label="Cadence" lbl={lbl}
                          suggestion={suggestion} suggestLang={suggestLang} field="cadence" current={cadence}
                          onApply={(v) => setCadence(v)} />
              <input type="text" value={cadence} onChange={(e) => setCadence(e.target.value)}
                     style={fld} placeholder="3 replies/day" />
              <SuggestionInline suggestion={suggestion} defaultLang={suggestLang} field="cadence" current={cadence}
                                setterFor={setterFor} currentFor={currentFor}
                                onRegenerate={() => handleGenerateSuggestion('cadence')} regenerating={regenField === 'cadence'} />
            </div>
            <div>
              <FieldLabel label="Tone" lbl={lbl}
                          suggestion={suggestion} suggestLang={suggestLang} field="tone" current={tone}
                          onApply={(v) => setTone(v)} />
              <input type="text" value={tone} onChange={(e) => setTone(e.target.value)}
                     style={fld} placeholder="helpful expert, mystical" />
              <SuggestionInline suggestion={suggestion} defaultLang={suggestLang} field="tone" current={tone}
                                setterFor={setterFor} currentFor={currentFor}
                                onRegenerate={() => handleGenerateSuggestion('tone')} regenerating={regenField === 'tone'} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <FieldLabel label="✅ DO" hint="markdown bullets" lbl={lbl}
                          suggestion={suggestion} suggestLang={suggestLang} field="doMd" current={doMd}
                          onApply={(v) => setDoMd(v)} />
              <textarea value={doMd} onChange={(e) => setDoMd(e.target.value)} rows={5}
                        style={{ ...fld, fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' }}
                        placeholder={'- Cite chart house + aspect\n- Acknowledge OP\'s feeling\n- Offer 1 actionable insight'} />
              <SuggestionInline suggestion={suggestion} defaultLang={suggestLang} field="doMd" current={doMd}
                                setterFor={setterFor} currentFor={currentFor}
                                onRegenerate={() => handleGenerateSuggestion('doMd')} regenerating={regenField === 'doMd'} />
            </div>
            <div>
              <FieldLabel label="🚫 DON&apos;T" hint="markdown bullets" lbl={lbl}
                          suggestion={suggestion} suggestLang={suggestLang} field="dontMd" current={dontMd}
                          onApply={(v) => setDontMd(v)} />
              <textarea value={dontMd} onChange={(e) => setDontMd(e.target.value)} rows={5}
                        style={{ ...fld, fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' }}
                        placeholder={'- Drop link in first sentence\n- Sound salesy\n- Ignore mod rules about astrology accuracy claims'} />
              <SuggestionInline suggestion={suggestion} defaultLang={suggestLang} field="dontMd" current={dontMd}
                                setterFor={setterFor} currentFor={currentFor}
                                onRegenerate={() => handleGenerateSuggestion('dontMd')} regenerating={regenField === 'dontMd'} />
            </div>
          </div>

          <TemplatesEditor templates={templates} onChange={setTemplates} />
          </>
          )}

          {error && (
            <div style={{ padding: 8, background: 'rgba(255,77,94,.1)', border: '1px solid rgba(255,77,94,.4)', color: 'var(--bad)', fontSize: 12, borderRadius: 5 }}>
              {error}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <div className="meta">
            {existing ? `Đang sửa #${existing.id}` : 'Brief mới'}
          </div>
          <div className="modal-foot-actions">
            {existing && (
              <button className="btn danger" onClick={handleDelete} disabled={busy}
                      style={confirmDelete ? { animation: 'pulseDanger 1s ease-in-out infinite' } : undefined}>
                {confirmDelete ? '⚠ Click lần nữa để xác nhận' : '🗑 Xóa'}
              </button>
            )}
            <button className="btn ghost" onClick={onClose} disabled={busy}>Hủy</button>
            <button className="btn primary" onClick={handleSave} disabled={busy}>
              {busy ? <><Spinner size="xs" /> Đang lưu</> : (existing ? 'Lưu' : 'Tạo brief')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplatesEditor({
  templates, onChange,
}: {
  templates: BriefTemplate[];
  onChange: (t: BriefTemplate[]) => void;
}) {
  const fld: React.CSSProperties = {
    width: '100%', padding: '6px 8px', background: 'var(--bg-2)',
    border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)',
    fontSize: 12, outline: 'none',
  };
  const update = (i: number, patch: Partial<BriefTemplate>) => {
    const next = [...templates];
    next[i] = { ...next[i]!, ...patch };
    onChange(next);
  };
  const remove = (i: number) => onChange(templates.filter((_, j) => j !== i));
  const add = () => onChange([...templates, { label: '', body: '' }]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          📝 Mẫu reply tái dùng
        </span>
        <span style={{ fontSize: 10, color: 'var(--fg-4)' }}>{templates.length}</span>
        <span style={{ flex: 1 }} />
        <button className="btn" type="button" onClick={add} style={{ fontSize: 10, padding: '3px 8px' }}>+ Mẫu</button>
      </div>
      {templates.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--fg-3)', padding: 8, background: 'var(--bg-2)', borderRadius: 5, border: '1px dashed var(--line)' }}>
          Chưa có mẫu. Thêm 1-3 reply skeleton tái dùng được.
        </div>
      )}
      {templates.map((t, i) => (
        <div key={i} style={{ marginTop: 6, padding: 8, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <input type="text" placeholder="Nhãn (vd: chart-reading reply)"
                   value={t.label} onChange={(e) => update(i, { label: e.target.value })}
                   style={{ ...fld, flex: 1 }} />
            <button className="btn ghost" type="button" onClick={() => remove(i)}
                    style={{ fontSize: 11, padding: '3px 8px', color: 'var(--bad)' }}>Xóa</button>
          </div>
          <textarea value={t.body} onChange={(e) => update(i, { body: e.target.value })}
                    rows={3} placeholder="Reply skeleton with {variables} like in account snippets…"
                    style={{ ...fld, fontFamily: 'var(--font-mono)', resize: 'vertical' }} />
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// FieldLabel — label with optional ✨ icon when AI has a suggestion
// for this field. Click ✨ → quick "Replace" using the modal's default
// suggestion language.
// ──────────────────────────────────────────────────────────────────
function FieldLabel({
  label, hint, lbl, suggestion, suggestLang, field, current, onApply,
}: {
  label: string;
  hint?: string;
  lbl: CSSProperties;
  suggestion: BriefSuggestion | null;
  suggestLang: 'en' | 'vi';
  field: SuggestableField;
  current: string;
  onApply: (v: string) => void;
}) {
  const sug = suggestion?.[suggestLang]?.[field] ?? '';
  const hasSug = sug.trim().length > 0 && sug.trim() !== current.trim();
  return (
    <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 6 }}>
      <span dangerouslySetInnerHTML={{ __html: label }} />
      {hint && <span style={{ color: 'var(--fg-4)', textTransform: 'none' }}>// {hint}</span>}
      {hasSug && (
        <button type="button"
                onClick={() => onApply(sug)}
                title={`AI có đề xuất ${suggestLang.toUpperCase()} — click để Replace ngay`}
                style={{
                  marginLeft: 'auto', fontSize: 11, padding: '0 5px',
                  background: 'var(--accent-soft)', color: 'var(--accent)',
                  border: '1px solid var(--accent-line)', borderRadius: 3,
                  cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600,
                }}>
          ✨ replace ({suggestLang.toUpperCase()})
        </button>
      )}
    </label>
  );
}

// ──────────────────────────────────────────────────────────────────
// SuggestionInline — collapsible card BELOW each input. Shows EN + VI
// side-by-side (or per-card lang toggle in narrow space) so user reads
// both before picking. Replace / Append / Copy actions apply the
// CURRENTLY-SELECTED card language.
// ──────────────────────────────────────────────────────────────────
function SuggestionInline({
  suggestion, defaultLang, field, current, setterFor, currentFor,
  onRegenerate, regenerating,
}: {
  suggestion: BriefSuggestion | null;
  defaultLang: 'en' | 'vi';
  field: SuggestableField;
  current: string;
  setterFor: (k: SuggestableField) => (v: string) => void;
  currentFor: (k: SuggestableField) => string;
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  // Auto-collapse khi field đã có nội dung - user không cần thấy suggestion
  // ngay; vẫn click để mở. Field rỗng → mở sẵn (user đang cần inspiration).
  const [open, setOpen] = useState(() => current.trim().length === 0);
  const { copied, copy } = useCopyToClipboard();
  const [activeLang, setActiveLang] = useState<'en' | 'vi'>(defaultLang);

  // Modal-level default switch propagates to all cards (per-card override
  // still allowed — user just clicks the card's own toggle after).
  useEffect(() => { setActiveLang(defaultLang); }, [defaultLang]);

  const sugVi = suggestion?.vi?.[field]?.trim() ?? '';
  const sugEn = suggestion?.en?.[field]?.trim() ?? '';
  if (!sugVi && !sugEn) return null;
  if ((sugVi === current.trim() || !sugVi) && (sugEn === current.trim() || !sugEn)) return null;

  const sug = activeLang === 'vi' ? sugVi : sugEn;
  const setter = setterFor(field);
  const curr = currentFor(field);

  const handleCopy = () => { void copy(sug); };
  // Replace -> setter + auto-collapse (field giờ đã có data, suggestion thu gọn lại)
  const handleReplace = () => { setter(sug); setOpen(false); };
  const handleAppend = () => { setter([curr, sug].filter(Boolean).join('\n\n')); setOpen(false); };

  // Collapsed mini-bar - hiển thị 1 dòng cực gọn, click expand.
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
              title="Mở AI suggestion cho field này"
              style={{
                marginTop: 2, padding: '1px 6px', cursor: 'pointer',
                fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--accent)',
                background: 'transparent', border: '1px dashed var(--accent-line)',
                borderRadius: 3, display: 'inline-flex', alignItems: 'center', gap: 4, opacity: 0.75,
              }}>
        ✨ AI suggestion ({activeLang.toUpperCase()}) ▸
      </button>
    );
  }

  return (
    <div style={{
      marginTop: 4, fontSize: 11.5, lineHeight: 1.5,
      background: 'var(--accent-soft)', border: '1px dashed var(--accent-line)',
      borderRadius: 5, overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 8px', cursor: 'pointer',
        fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent)',
      }}
           onClick={() => setOpen(false)}>
        <span>✨ AI suggestion</span>
        {/* Per-card lang switch */}
        <div onClick={(e) => e.stopPropagation()}
             style={{ display: 'inline-flex', gap: 0, padding: 1, background: 'var(--bg-1)', border: '1px solid var(--accent-line)', borderRadius: 3 }}>
          {(['vi', 'en'] as const).map((l) => {
            const txt = l === 'vi' ? sugVi : sugEn;
            const dis = !txt;
            return (
              <button key={l} type="button"
                      onClick={() => !dis && setActiveLang(l)}
                      disabled={dis}
                      title={dis ? `(${l.toUpperCase()} chưa có)` : `Switch card to ${l.toUpperCase()}`}
                      style={{
                        padding: '1px 6px', fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
                        background: activeLang === l ? 'var(--accent)' : 'transparent',
                        color: activeLang === l ? '#fff' : (dis ? 'var(--fg-4)' : 'var(--accent)'),
                        border: 'none', borderRadius: 2, cursor: dis ? 'not-allowed' : 'pointer',
                      }}>{l.toUpperCase()}</button>
            );
          })}
        </div>
        <span style={{ flex: 1 }} />
        {sug && (
          <>
            <button type="button" onClick={(e) => { e.stopPropagation(); handleReplace(); }}
                    title={`Thay input bằng suggestion ${activeLang.toUpperCase()} (sẽ tự thu gọn sau)`}
                    style={btnStyle('var(--accent)', '#fff')}>↻ Thay</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); handleAppend(); }}
                    title={`Nối thêm suggestion ${activeLang.toUpperCase()} vào sau nội dung hiện có`}
                    style={btnStyle('transparent', 'var(--accent)', 'var(--accent-line)')}>+ Nối</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); handleCopy(); }}
                    title={`Copy suggestion ${activeLang.toUpperCase()} vào clipboard`}
                    style={btnStyle('transparent', 'var(--accent)', 'var(--accent-line)')}>
              {copied ? '✓ Đã copy' : '📋 Copy'}
            </button>
          </>
        )}
        {onRegenerate && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onRegenerate(); }}
                  disabled={regenerating}
                  title={`Regen suggestion riêng cho field này (AI tập trung làm lại field này, giữ các field khác)`}
                  style={btnStyle('transparent', 'var(--fg-2)', 'var(--line)')}>
            {regenerating ? '⏳' : '↻ Regen'}
          </button>
        )}
        <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
      </div>
      {sug && (
        <pre style={{
          margin: 0, padding: '6px 10px',
          fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.5,
          color: 'var(--fg-1)', background: 'var(--bg-1)',
          borderTop: '1px dashed var(--accent-line)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          opacity: regenerating ? 0.5 : 1,
        }}>{sug}</pre>
      )}
    </div>
  );
}

// Map nhãn "beat" của sequence ảnh từ tiếng Anh sang tiếng Việt ngắn gọn
// (server action trả tiếng Anh để model hiểu storytelling intent đúng).
function beatLabelVi(beat: string): string {
  const b = beat.toLowerCase();
  if (b.includes('hook') && b.includes('attention')) return 'Hook';
  if (b.includes('opening hook')) return 'Mở bài';
  if (b.includes('context')) return 'Bối cảnh';
  if (b.includes('twist')) return 'Twist';
  if (b.includes('proof')) return 'Bằng chứng';
  if (b.includes('cta')) return 'CTA';
  if (b.includes('midpoint')) return 'Giữa';
  if (b.includes('closing') || b.includes('close')) return 'Kết';
  if (b.includes('hero')) return 'Ảnh chính';
  return beat.split(' ')[0] || beat;
}

// Build CardVoiceContext từ BriefPost (đã có effectiveVoice + source) + bundle
// (habitat info + tribe count + pillar metadata). Tránh fetch riêng per-card —
// pillar.languages + key_msg_count vẫn lấy từ bundle.pillars lookup theo id.
function buildPreloadedVoiceCtx(post: BriefPost, bundle: BriefRowContextBundle): import('@/lib/actions/card-voice-context').CardVoiceContext {
  const effectivePillarId = post.pillarId ?? bundle.briefPrimaryPillarId;
  const pillar = effectivePillarId != null
    ? bundle.pillars.find((p) => p.id === effectivePillarId) ?? null
    : null;
  // Channel meta lookup nếu card.channelId
  const channel = post.channelId != null
    ? bundle.channelsBundle.channels.find((c) => c.id === post.channelId) ?? null
    : null;
  const profile = (post.effectiveVoice as import('@/lib/ai/voice-profile').VoiceProfile) || 'regular';
  const languageMismatch = !!(pillar && pillar.languages.length > 0
    && !pillar.languages.includes(post.targetLang));
  return {
    effectiveProfile: profile,
    source: post.voiceSource,
    habitatProfile: bundle.channelsBundle.habitatVoice,
    channelOverride: channel?.voiceProfileOverride ?? null,
    pillarVoice: (pillar?.voiceProfile as import('@/lib/ai/voice-profile').VoiceProfile) ?? null,
    habitatVoiceNotes: bundle.habitatVoiceNotes,
    pillarVoiceNotes: '',                // bundle compact không có notes, OK cho display
    habitatId: bundle.habitatId,
    habitatName: bundle.habitatName,
    channelId: post.channelId,
    channelName: post.channelName,
    pillarId: pillar?.id ?? null,
    pillarName: pillar?.name ?? null,
    pillarTagline: pillar?.tagline ?? '',
    pillarLanguages: pillar?.languages ?? [],
    pillarKeyMsgCount: 0,                 // bundle compact không có count — không quan trọng cho display
    pillarForbiddenCount: 0,
    targetLang: post.targetLang,
    languageMismatch,
    fewShotCount: channel?.fewShotCount ?? 0,
    fewShotSource: channel?.fewShotCount ? 'channel' : 'none',
    tribeLexiconCount: bundle.tribeLexiconCount,
    tribeAvoidCount: bundle.tribeAvoidCount,
    hasVisualStyle: bundle.habitatHasVisualStyle,
    hasChannelRules: channel?.hasRules ?? false,
  };
}

function btnStyle(bg: string, fg: string, border?: string): CSSProperties {
  return {
    fontSize: 9.5, padding: '2px 7px', fontFamily: 'var(--font-mono)', fontWeight: 600,
    background: bg, color: fg, border: `1px solid ${border ?? bg}`,
    borderRadius: 3, cursor: 'pointer',
  };
}

// fmtAgo đã đưa sang @/lib/time-format (shared, see import top of file).

// ──────────────────────────────────────────────────────────────────
// PhaseTabStrip — sticky horizontal tabs between modal-head and body.
// Order: Overview · Warm-up · Value · Bridge · Seed · Direct · History
// Current phase pulses; other phases dim until clicked.
// ──────────────────────────────────────────────────────────────────
function PhaseTabStrip({
  activeTab, currentPhase, phasePlan, phaseCounts, phaseHistoryCount, onChange,
  isJoined = true,
}: {
  activeTab: 'overview' | Phase | 'history' | 'detect';
  currentPhase: Phase;
  phasePlan: PhaseEntry[];
  phaseCounts?: Record<string, number>;
  phaseHistoryCount: number;
  onChange: (tab: 'overview' | Phase | 'history' | 'detect') => void;
  // 0057 GATE: phase bridge/seed/direct chỉ có nghĩa khi joined. Dim tab.
  isJoined?: boolean;
}) {
  const tabBtn = (
    key: 'overview' | Phase | 'history' | 'detect', label: string, color: string,
    badge?: { text: string; tone: 'ok' | 'neutral'; tip: string },
  ) => {
    const active = activeTab === key;
    const isCurrentPhase = key === currentPhase;
    // Phase bridge/seed/direct = need-join. Vẫn cho click (đọc plan), nhưng dim
    // + lock icon + tooltip rõ. Không block (user có thể prep plan trước khi join).
    const isPhaseKey = typeof key === 'string' && ['bridge', 'seed', 'direct'].includes(key);
    const needsJoin = isPhaseKey && !isJoined;
    const badgeStyle = badge ? (
      badge.tone === 'ok'
        ? { color: 'var(--ok)', background: 'rgba(74,222,128,.12)', borderColor: 'rgba(74,222,128,.4)' }
        : { color: 'var(--fg-3)', background: 'var(--bg-1)', borderColor: 'var(--line)' }
    ) : null;
    return (
      <button key={key} type="button" onClick={() => onChange(key)}
              title={needsJoin
                ? `🔒 ${label}: yêu cầu account đã joined community. Plan vẫn xem được, nhưng không tạo bài / đăng bài / chuyển sang phase này khi chưa join.`
                : undefined}
              style={{
                padding: '6px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
                background: active ? color + '22' : 'transparent',
                color: active ? color : 'var(--fg-2)',
                border: 'none',
                borderBottom: `2px solid ${active ? color : 'transparent'}`,
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                opacity: needsJoin && !active ? 0.45 : 1,
              }}>
          {isCurrentPhase && (
            <span style={{ width: 6, height: 6, borderRadius: 3, background: color, boxShadow: `0 0 6px ${color}` }} />
          )}
          {needsJoin && <span style={{ fontSize: 9 }}>🔒</span>}
          {label}
          {badge && badgeStyle && (
            <span title={badge.tip}
                  style={{
              padding: '0 5px', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
              borderRadius: 3, border: '1px solid', ...badgeStyle,
            }}>{badge.text}</span>
          )}
      </button>
    );
  };

  return (
    <div style={{
      display: 'flex', gap: 2, padding: '0 14px',
      borderBottom: '1px solid var(--line)',
      overflowX: 'auto', flexShrink: 0,
    }}>
      {tabBtn('overview', 'Overview', 'var(--accent)')}
      {PLANNED_PHASES.map((p) => {
        // Badge = SỐ BÀI THỰC CÓ (đếm thực từ DB). Bỏ estimatedPosts —
        // dùng số thực duy nhất, không nhập nhằng giữa thực và dự kiến.
        const have = phaseCounts?.[p] ?? 0;
        const _ = phasePlan; void _; // (giữ prop để API ổn định, không dùng badge nữa)
        const badge = have > 0
          ? { text: String(have), tone: 'ok' as const, tip: `${have} bài đã tạo cho phase này` }
          : undefined;
        return tabBtn(p, PHASE_LABEL[p], PHASE_COLOR[p], badge);
      })}
      {tabBtn('history', 'History',  'var(--fg-3)', phaseHistoryCount > 0
        ? { text: String(phaseHistoryCount), tone: 'neutral', tip: `${phaseHistoryCount} lần chuyển phase` }
        : undefined)}
      {tabBtn('detect', '🔍 Detect', 'var(--accent)')}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// PhaseEntryEditor — edit one phase row in phase_plan.
// Fields: goal, startTrigger, endTrigger, cadence, tone, do, dont, estimatedPosts.
// Auto-saves on blur (persistPhasePlan).
// ──────────────────────────────────────────────────────────────────
function PhaseEntryEditor({
  projectId, briefId, habitatId, habitatUrl, onOpenHabitat, platformKey, platformCategory,
  platformAllowedFormats, habitatAllowedFormats,
  actualPostCount, phase, entry, isCurrentPhase, onChange, onBlur, onAdvance, focusCardId, onFocusChange, onPostsChanged, postsReloadKey,
  isJoined, onRequestJoin, notReadyReason,
}: {
  projectId: string;
  briefId: number;
  habitatId: number;
  habitatUrl?: string | null;
  onOpenHabitat?: (habitatId: number) => void;
  platformKey?: string;
  platformCategory?: string;
  platformAllowedFormats?: string[] | null;
  habitatAllowedFormats?: string[] | null;
  actualPostCount?: number;     // số bài thực có ở phase này (đếm từ cards)
  phase: Phase;
  onPostsChanged?: () => void;
  postsReloadKey?: number;
  entry: PhaseEntry | null;
  isCurrentPhase: boolean;
  onChange: (patch: Partial<PhaseEntry>) => void;
  onBlur: () => void;
  onAdvance: () => void;
  focusCardId?: number;
  onFocusChange?: (phase: string, cardId?: number) => void;
  // 0057 GATE: pass-through xuống PostsForPhase → PostRow → DispatchPostFlow.
  isJoined?: boolean;
  onRequestJoin?: () => void;
  notReadyReason?: 'account-never-created' | 'account-broken' | 'membership';
}) {
  const fld: CSSProperties = {
    width: '100%', padding: '6px 8px', background: 'var(--bg-2)',
    border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)',
    fontSize: 12.5, outline: 'none', fontFamily: 'var(--font-sans)',
  };
  const lbl: CSSProperties = {
    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block',
  };
  // Detailed fields (trigger + tone + counter) collapsed mặc định để bớt noise.
  // User ít sửa start/end trigger + tone sau setup ban đầu. Click expand khi cần.
  const [detailsOpen, setDetailsOpen] = useState(false);
  if (!entry) {
    return (
      <div style={{ padding: 12, fontSize: 12, color: 'var(--fg-3)', background: 'var(--bg-2)', borderRadius: 5, border: '1px dashed var(--line)' }}>
        Chưa có entry cho phase này. Phase plan đang được khởi tạo từ defaults theo archetype habitat…
      </div>
    );
  }
  // Indicator chấm xanh trên nút Chi tiết khi có data trong fields ẩn
  const hasDetailData = !!(entry.startTrigger?.trim() || entry.endTrigger?.trim() || entry.tone?.trim());
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Phase banner ẨN khi đang là current phase (tab đã hiển thị active).
          Chỉ hiện nếu user mở phase KHÁC current → cần advance button. */}
      {!isCurrentPhase && (
        <div title={PHASE_DESCRIPTION[phase]}
             style={{
               padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 8,
               background: PHASE_COLOR[phase] + '11',
               border: `1px solid ${PHASE_COLOR[phase]}44`, borderRadius: 5,
             }}>
          <span style={{ fontSize: 10.5, color: PHASE_COLOR[phase], fontFamily: 'var(--font-mono)' }}>
            Phase {PHASE_LABEL[phase]} chưa active
          </span>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onAdvance}
                  title={`Chuyển brief sang phase ${PHASE_LABEL[phase]} ngay bây giờ`}
                  style={{
                    fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                    padding: '3px 9px',
                    background: 'transparent', color: PHASE_COLOR[phase],
                    border: `1px solid ${PHASE_COLOR[phase]}`, borderRadius: 4, cursor: 'pointer',
                  }}>
            → Chuyển sang
          </button>
        </div>
      )}

      <div className="modal-cols cols-2 right-wide">
      <div className="modal-col">

      {/* PRIMARY: Mục tiêu + Tần suất + Bài đã tạo (1 row) */}
      <div>
        <label style={lbl} title="Mục tiêu của phase này — coi như phase hoàn tất khi đạt được điều này.">Mục tiêu</label>
        <input type="text" value={entry.goal} onBlur={onBlur}
               onChange={(e) => onChange({ goal: e.target.value })}
               style={fld} placeholder="vd: 20 bài chất lượng + intro - mod nhận diện account" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
        <div>
          <label style={lbl} title="Tần suất đăng bài trong phase này (vd: 2 bài/tuần).">Tần suất</label>
          <input type="text" value={entry.cadence} onBlur={onBlur}
                 onChange={(e) => onChange({ cadence: e.target.value })}
                 style={fld} placeholder="2 bài/tuần" />
        </div>
        <div>
          <label style={lbl} title="Số bài đã tạo (đếm thực từ DB).">Đã tạo</label>
          <div style={{ ...fld, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--fg-1)',
                        background: 'var(--bg-1)', cursor: 'default' }}>
            <strong style={{ color: (actualPostCount ?? 0) > 0 ? 'var(--ok)' : 'var(--fg-3)' }}>
              {actualPostCount ?? 0}
            </strong>
            <span style={{ color: 'var(--fg-4)', fontSize: 10 }}>bài</span>
          </div>
        </div>
      </div>

      {/* PRIMARY: Nên/Không (2 col) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label style={lbl} title="Những điều NÊN làm trong phase này.">✅ Nên</label>
          <textarea value={entry.doMd} onBlur={onBlur}
                    onChange={(e) => onChange({ doMd: e.target.value })}
                    rows={5} style={{ ...fld, fontFamily: 'var(--font-mono)', fontSize: 11.5, resize: 'vertical' }} />
        </div>
        <div>
          <label style={lbl} title="Những điều TUYỆT ĐỐI KHÔNG làm.">🚫 Không</label>
          <textarea value={entry.dontMd} onBlur={onBlur}
                    onChange={(e) => onChange({ dontMd: e.target.value })}
                    rows={5} style={{ ...fld, fontFamily: 'var(--font-mono)', fontSize: 11.5, resize: 'vertical' }} />
        </div>
      </div>

      {/* COLLAPSIBLE: Chi tiết (trigger + tone) — ít sửa sau setup ban đầu */}
      <div>
        <button type="button" onClick={() => setDetailsOpen((v) => !v)}
                title={detailsOpen ? 'Thu gọn' : 'Mở rộng: Bắt đầu khi / Kết thúc khi / Giọng'}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                         background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                         fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
          <span>{detailsOpen ? '▾' : '▸'}</span>
          <span>📐 Chi tiết phase {hasDetailData && !detailsOpen ? '●' : ''}</span>
          {!detailsOpen && (
            <span style={{ fontSize: 9.5, color: 'var(--fg-4)' }}>
              (bắt đầu khi · kết thúc khi · giọng)
            </span>
          )}
        </button>
        {detailsOpen && (
          <div style={{ marginTop: 6, padding: 8, background: 'var(--bg-2)',
                        border: '1px solid var(--line)', borderRadius: 5,
                        display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={lbl} title="Điều kiện để BẮT ĐẦU vào phase này.">Bắt đầu khi</label>
                <input type="text" value={entry.startTrigger} onBlur={onBlur}
                       onChange={(e) => onChange({ startTrigger: e.target.value })}
                       style={fld} placeholder="Account tạo + bio set xong" />
              </div>
              <div>
                <label style={lbl} title="Điều kiện để KẾT THÚC phase này → chuyển phase tiếp.">Kết thúc khi</label>
                <input type="text" value={entry.endTrigger} onBlur={onBlur}
                       onChange={(e) => onChange({ endTrigger: e.target.value })}
                       style={fld} placeholder="20 bài chất lượng VÀ qua 30+ ngày" />
              </div>
            </div>
            <div>
              <label style={lbl} title="Tone string ngắn — voice profile của habitat/pillar có rồi, đây chỉ là note bổ sung.">Giọng (note)</label>
              <input type="text" value={entry.tone} onBlur={onBlur}
                     onChange={(e) => onChange({ tone: e.target.value })}
                     style={fld} placeholder="Học thuật, dày citation (note bổ sung — voice profile habitat ưu tiên)" />
            </div>
          </div>
        )}
      </div>

      <HooksEditor hooks={entry.hooks ?? []}
                   onChange={(next) => onChange({ hooks: next })}
                   onBlur={onBlur}
                   phase={phase} />

      <FormatMixEditor value={entry.formatMix}
                       onChange={(next) => onChange({ formatMix: next })}
                       onBlur={onBlur}
                       platformKey={platformKey}
                       platformCategory={platformCategory}
                       platformAllowedFormats={platformAllowedFormats}
                       habitatAllowedFormats={habitatAllowedFormats} />

      </div>{/* /modal-col: chiến lược phase */}
      <div className="modal-col">
      <PostsForPhase projectId={projectId} briefId={briefId}
                     habitatId={habitatId} habitatUrl={habitatUrl} onOpenHabitat={onOpenHabitat}
                     platformKey={platformKey} platformCategory={platformCategory}
                     platformAllowedFormats={platformAllowedFormats}
                     habitatAllowedFormats={habitatAllowedFormats}
                     phaseFormatMix={entry?.formatMix}
                     phase={phase} focusCardId={focusCardId} onFocusChange={onFocusChange}
                     onPostsChanged={onPostsChanged}
                     externalReloadKey={postsReloadKey}
                     isJoined={isJoined}
                     onRequestJoin={onRequestJoin}
                     notReadyReason={notReadyReason} />
      </div>
      </div>{/* /modal-cols */}

      {/* Footer note ẩn — auto-save implicit, linked knowledge thường = 0.
          Nếu cần thì hiện compact icon trong header phase sau. */}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// BriefPillarPicker — set default content pillar cho brief. Mọi card
// tạo trong brief tự inherit pillar này (per-card có thể override).
// ──────────────────────────────────────────────────────────────────
function BriefPillarPicker({
  projectId, briefId, initialPillarId, onChanged,
}: {
  projectId: string;
  briefId: number;
  initialPillarId: number | null;
  onChanged?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [pillars, setPillars] = useState<Array<{ id: number; name: string; tagline: string; voiceIcon: string; voiceLabel: string }> | null>(null);
  const [currentId, setCurrentId] = useState<number | null>(initialPillarId);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancel = false;
    import('@/lib/actions/content-pillars').then(({ listProjectPillarsCompact }) => {
      listProjectPillarsCompact(projectId).then((list) => {
        if (cancel) return;
        setPillars(list.map((p) => ({ id: p.id, name: p.name, tagline: p.tagline,
                                       voiceIcon: p.voiceIcon, voiceLabel: p.voiceLabel })));
      });
    });
    return () => { cancel = true; };
  }, [projectId]);

  // Ẩn block nếu chưa có pillars trong project (CPS chưa setup)
  if (pillars !== null && pillars.length === 0) return null;
  if (pillars === null) return null;     // còn loading

  const current = pillars.find((p) => p.id === currentId);

  const pick = (id: number | null) => {
    setBusy(true);
    startTransition(async () => {
      const { setBriefPrimaryPillar } = await import('@/lib/actions/content-pillars');
      await setBriefPrimaryPillar(projectId, briefId, id);
      setBusy(false);
      setCurrentId(id);
      onChanged?.();
    });
  };

  return (
    <div style={{ padding: 10, background: 'rgba(157,108,255,0.05)',
                  border: '1px solid rgba(157,108,255,0.3)', borderRadius: 6,
                  display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--neon-violet)',
                       textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
          📚 Trụ cột mặc định
        </span>
        <span style={{ flex: 1, fontSize: 10, color: 'var(--fg-4)' }}>
          mọi bài mới trong brief kế thừa trụ cột này (ghi đè per-bài qua chip 📚 ở đầu mỗi row)
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={currentId ?? ''}
                onChange={(e) => pick(e.target.value ? Number(e.target.value) : null)}
                disabled={busy}
                title={current?.tagline ? `"${current.tagline}"` : undefined}
                style={{ flex: 1, maxWidth: 360, padding: '5px 8px',
                         background: 'var(--bg-2)', border: '1px solid var(--line)',
                         borderRadius: 5, color: 'var(--fg-0)', fontSize: 12, fontWeight: 700 }}>
          <option value="">(không gắn trụ cột mặc định)</option>
          {pillars.map((p) => (
            <option key={p.id} value={p.id}>📚 {p.name} — {p.voiceIcon} {p.voiceLabel}</option>
          ))}
        </select>
        {/* Tagline ẩn inline — đã đưa vào tooltip select */}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// FormatMixEditor — override tỉ trọng loại nội dung cho phase này.
// Để trống tất cả = dùng mặc định theo platform (lib/content-formats).
// Seeding xoay vòng theo trọng số này. Compact + collapse mặc định.
// ──────────────────────────────────────────────────────────────────
function FormatMixEditor({
  value, onChange, onBlur, platformKey, platformCategory,
  platformAllowedFormats, habitatAllowedFormats,
}: {
  value: Record<string, number> | undefined;
  onChange: (next: Record<string, number> | undefined) => void;
  onBlur: () => void;
  platformKey?: string;
  platformCategory?: string;
  platformAllowedFormats?: string[] | null;
  habitatAllowedFormats?: string[] | null;
}) {
  // Chỉ liệt kê loại bài community/platform support (habitat override > platform
  // override > hardcoded fallback). Discord không có poll/carousel → không cho
  // user set trọng số (vô nghĩa); habitat r/AskReddit cấm link → bỏ luôn.
  const formats = allowedFormats(platformKey, platformCategory, platformAllowedFormats, habitatAllowedFormats);
  const mix = value ?? {};
  const active = Object.entries(mix).filter(([, w]) => Number(w) > 0);
  const hasOverride = active.length > 0;
  // Mix HIỆU LỰC (luôn có data dù chưa override) — show bar visualization.
  const effective = effectiveMix(platformKey, platformCategory, value, undefined, platformAllowedFormats, habitatAllowedFormats);
  const effEntries = Object.entries(effective).filter(([, w]) => Number(w) > 0).sort((a, b) => b[1] - a[1]);
  const total = effEntries.reduce((sum, [, w]) => sum + Number(w), 0) || 1;
  // Auto-open khi có override (user đang custom); collapse khi default.
  const [open, setOpen] = useState(hasOverride);
  const setW = (key: string, w: number) => {
    const next: Record<string, number> = { ...mix };
    if (w > 0) next[key] = w; else delete next[key];
    onChange(Object.keys(next).length ? next : undefined);
  };
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setOpen((o) => !o)}
                title={hasOverride
                  ? 'Phase này override mix — click để xem/sửa trọng số'
                  : 'Mix mặc định theo platform — click để override cho phase này'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)',
                         fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
                         letterSpacing: '0.06em', padding: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ color: 'var(--accent)', display: 'inline-flex' }}>
            <IconChevron dir={open ? 'down' : 'right'} size={11} />
          </span>
          <IconSliders size={12} /> Mix định dạng
        </button>
        <span title={hasOverride ? 'Override cho phase này' : 'Mặc định theo platform — chưa override'}
              style={{ padding: '0 5px', fontSize: 8.5, fontFamily: 'var(--font-mono)', fontWeight: 700,
                       borderRadius: 3, textTransform: 'uppercase',
                       background: hasOverride ? 'rgba(167,139,250,.15)' : 'var(--bg-1)',
                       color: hasOverride ? '#a78bfa' : 'var(--fg-4)',
                       border: `1px solid ${hasOverride ? 'rgba(167,139,250,.4)' : 'var(--line)'}` }}>
          {hasOverride ? 'override' : 'default'}
        </span>
        {/* Bar visualization — CHỈ HIỆN khi override hoặc đã mở (click expand).
            Default + collapsed → không hiện chips để giảm noise. */}
        {(hasOverride || open) && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', flex: 1 }}>
            {effEntries.map(([k, w]) => {
              const pct = Math.round((Number(w) / total) * 100);
              const col = formatColors(k);
              return (
                <span key={k} title={`${formatMeta(k).label}: trọng số ${w} (~${pct}%)`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 3,
                               padding: '1px 6px', fontSize: 9.5, fontFamily: 'var(--font-mono)', fontWeight: 700,
                               borderRadius: 3, background: col.bg, color: col.fg,
                               border: `1px solid ${col.border}` }}>
                  <FormatIcon kind={k} size={10} />
                  {formatMeta(k).label} {pct}%
                </span>
              );
            })}
          </span>
        )}
        {hasOverride && (
          <button type="button" onClick={() => { onChange(undefined); onBlur(); }}
                  title="Xoá override → quay về mặc định platform"
                  style={{ fontSize: 9.5, padding: '1px 6px', background: 'transparent', color: 'var(--fg-3)',
                           border: '1px solid var(--line)', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
            reset
          </button>
        )}
      </div>
      {open && (
        <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))', gap: 6 }}>
          {formats.map((f) => (
            <label key={f.key} title={f.hint}
                   style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--fg-2)',
                            background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, padding: '4px 6px' }}>
              <span style={{ width: 15, display: 'inline-flex', justifyContent: 'center' }}>
                <FormatIcon kind={f.key} size={13} />
              </span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label}</span>
              <input type="number" min={0} max={9} value={mix[f.key] ?? ''}
                     onBlur={onBlur}
                     onChange={(e) => setW(f.key, Math.max(0, Math.min(9, Number(e.target.value) || 0)))}
                     placeholder="–"
                     style={{ width: 34, padding: '2px 4px', fontSize: 11, textAlign: 'center',
                              background: 'var(--bg-1)', color: 'var(--fg-0)', border: '1px solid var(--line)',
                              borderRadius: 4, outline: 'none' }} />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// HooksEditor — short hook patterns reusable cho phase này.
// Mỗi hook = 1 dòng template ("TIL about X" / "I noticed Y when…").
// Helper khi viết post: cho user pick hook + AI fill content.
// ──────────────────────────────────────────────────────────────────
function HooksEditor({
  hooks, onChange, onBlur, phase,
}: {
  hooks: string[];
  onChange: (next: string[]) => void;
  onBlur: () => void;
  phase: Phase;
}) {
  const fld: CSSProperties = {
    flex: 1, padding: '5px 8px', fontSize: 11.5,
    background: 'var(--bg-2)', color: 'var(--fg-0)',
    border: '1px solid var(--line)', borderRadius: 4, outline: 'none',
    fontFamily: 'var(--font-mono)',
  };
  const update = (i: number, val: string) => {
    const next = [...hooks];
    next[i] = val;
    onChange(next);
  };
  const remove = (i: number) => onChange(hooks.filter((_, j) => j !== i));
  const add = () => onChange([...hooks, '']);
  // Auto-open khi có data, collapsed khi empty.
  const [open, setOpen] = useState(hooks.length > 0);

  // Compact button khi empty + collapsed
  if (hooks.length === 0 && !open) {
    return (
      <button type="button" onClick={() => { setOpen(true); add(); }}
              title={`Thêm 3-5 mẫu câu mở bài cho phase ${PHASE_LABEL[phase]}. Pick 1 hook khi viết bài + AI fill content.`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                       background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                       fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
        <span>▸</span>
        <span>🎣 Thêm mẫu mở bài</span>
        <span style={{ fontSize: 9.5, color: 'var(--fg-4)' }}>(0)</span>
      </button>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <button type="button" onClick={() => setOpen((v) => !v)}
                title={`Các câu mở bài tái dùng được cho post trong phase ${PHASE_LABEL[phase]}.`}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                         fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
                         textTransform: 'uppercase', letterSpacing: '0.06em',
                         display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span>{open ? '▾' : '▸'}</span>
          <span>🎣 Mẫu mở bài</span>
          <span style={{ fontSize: 10, color: 'var(--fg-4)', textTransform: 'none' }}>{hooks.length}</span>
        </button>
        <span style={{ flex: 1 }} />
        {open && (
          <button className="btn" type="button" onClick={add} style={{ fontSize: 10, padding: '3px 8px' }}>+ Thêm</button>
        )}
      </div>
      {open && hooks.map((h, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
          <input type="text" value={h} onBlur={onBlur}
                 onChange={(e) => update(i, e.target.value)}
                 style={fld}
                 placeholder={i === 0 ? '"TIL về Hellenistic time-lords…"' : 'mẫu mở bài khác…'} />
          <button className="btn ghost" type="button" onClick={() => remove(i)}
                  title="Xóa mẫu mở bài này"
                  style={{ fontSize: 11, padding: '3px 8px', color: 'var(--bad)' }}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// PostsForPhase — list + tạo + sửa bài viết (card) cho brief × phase này.
// Mỗi bài viết = 1 card trong MOS2 board với briefId + briefPhase set.
// Click 1 bài → expand inline editor (title + body markdown + col + dispatch).
// "+ Tạo bài viết" → server tạo card prefilled từ phase plan + hook + narrative.
// ──────────────────────────────────────────────────────────────────
const COL_LABEL: Record<string, string> = {
  backlog: 'Ý tưởng',
  needs: 'Chờ duyệt',
  production: 'Đang làm',
  escalated: 'Đang kẹt',
  strategic: 'Kế hoạch dài',
};
const COL_OPTIONS = ['backlog', 'needs', 'production', 'escalated', 'strategic'];

function PostsForPhase({
  projectId, briefId, habitatId, habitatUrl, onOpenHabitat, platformKey, platformCategory,
  platformAllowedFormats, habitatAllowedFormats, phaseFormatMix,
  phase, focusCardId, onFocusChange, onPostsChanged, externalReloadKey = 0,
  isJoined = true, onRequestJoin, notReadyReason,
}: {
  projectId: string;
  briefId: number;
  habitatId: number;
  onOpenHabitat?: (habitatId: number) => void;
  habitatUrl?: string | null;
  platformKey?: string;
  platformCategory?: string;
  platformAllowedFormats?: string[] | null;
  habitatAllowedFormats?: string[] | null;
  phaseFormatMix?: Record<string, number> | null;  // override mix của phase
  phase: Phase;
  onPostsChanged?: () => void;
  externalReloadKey?: number;
  focusCardId?: number;
  onFocusChange?: (phase: string, cardId?: number) => void;
  // 0057 GATE: disable create/batch buttons + pass-through to PostRow → DispatchPostFlow
  isJoined?: boolean;
  onRequestJoin?: () => void;
  notReadyReason?: 'account-never-created' | 'account-broken' | 'membership';
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [posts, setPosts] = useState<BriefPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false); // menu chọn loại bài
  const [batchCreating, setBatchCreating] = useState(false);
  const [batchRegenning, setBatchRegenning] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(focusCardId ?? null);
  const [bumpKey, setBumpKey] = useState(0);
  // Multi-dimension filter — thay typeFilter cũ. Xem PostFiltersBar cho UI + logic.
  const [filters, setFilters] = useState<PostFilters>(EMPTY_FILTERS);
  // Bundle context (channels + pillars + tribe counts) — fetch 1 lần / brief
  // thay vì mỗi PostRow tự fetch (N rows × 3 chip = 3N RSC requests → 1).
  const [bundle, setBundle] = useState<BriefRowContextBundle | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      listPostsForBriefPhase(briefId, phase),
      // Fetch bundle 1 lần — re-fetch nếu externalReloadKey bump (vd habitat overlay close).
      // Không re-fetch khi bumpKey (sửa cards trong list) — bundle KHÔNG đổi.
      bundle == null ? getBriefRowContextBundle(projectId, briefId) : Promise.resolve(bundle),
    ]).then(([rows, b]) => {
      if (cancelled) return;
      setPosts(rows); setLoading(false);
      if (b) setBundle(b);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bundle intentionally not in deps to avoid loop
  }, [briefId, phase, bumpKey, externalReloadKey, projectId]);
  // Deep-link focus: chỉ scroll/bung — không fetch lại posts. Tách khỏi
  // effect trên để khi focusCardId đổi không re-fetch toàn list.
  useEffect(() => {
    if (focusCardId && posts.some((p) => p.id === focusCardId)) {
      setOpenId(focusCardId);
      setTimeout(() => document.getElementById(`post-row-${focusCardId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
    }
  }, [focusCardId, posts]);

  const refresh = () => { setBumpKey((n) => n + 1); onPostsChanged?.(); };

  const handleCreate = (contentType: string = 'text') => {
    setCreating(true);
    setCreateMenuOpen(false);
    startTransition(async () => {
      const res = await createPostForBriefPhase(projectId, briefId, phase, contentType);
      setCreating(false);
      if (res.ok && res.id) {
        setOpenId(res.id);
        onFocusChange?.(phase, res.id);
        refresh(); // bumpKey re-fetch list — KHÔNG router.refresh page
      }
    });
  };

  // Combo: tạo 3 placeholder + ngay lập tức batch-gen với diversity enforced.
  // Phù hợp khi phase chưa có bài nào và muốn AI sinh sẵn 3 bài đa dạng.
  const handleCreateBatch3 = () => {
    setBatchCreating(true);
    setBatchError(null);
    setBatchResult(null);
    startTransition(async () => {
      const create = await createPlaceholdersForBriefPhase(projectId, briefId, phase, 3);
      if (!create.ok) {
        setBatchCreating(false);
        setBatchError(create.error ?? 'Create batch failed');
        return;
      }
      const gen = await generateBatchForPhase(projectId, briefId, phase);
      setBatchCreating(false);
      if (!gen.ok) {
        setBatchError(gen.error ?? 'Batch gen failed');
        return;
      }
      if (gen.batch) setBatchResult(gen.batch);
      refresh(); // bumpKey re-fetch list — KHÔNG router.refresh page
    });
  };

  // Regen tất cả N posts hiện có trong phase với diversity enforced.
  const handleRegenBatch = () => {
    setBatchRegenning(true);
    setBatchError(null);
    setBatchResult(null);
    startTransition(async () => {
      const gen = await generateBatchForPhase(projectId, briefId, phase);
      setBatchRegenning(false);
      if (!gen.ok) {
        setBatchError(gen.error ?? 'Batch regen failed');
        return;
      }
      if (gen.batch) setBatchResult(gen.batch);
      refresh(); // bumpKey re-fetch list — KHÔNG router.refresh page
    });
  };

  const canBatchRegen = posts.length >= 2 && !batchRegenning && !batchCreating;
  const batchBusy = batchCreating || batchRegenning;

  // Drawer Strategy (achievement + filter + batch regen) — collapsed mặc định.
  // List bài = primary view; strategy controls dưới '⚙ Strategy ▾'.
  const [strategyOpen, setStrategyOpen] = useState(false);

  return (
    <div>
      {/* COMPACT HEADER: 1 dòng — phase label + count + ready ratio + Strategy drawer toggle + + Tạo bài */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span title="Bài viết phase này"
              style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
                       textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          📝 {posts.length} bài
        </span>
        {posts.length > 0 && (() => {
          const ready = posts.filter((p) => postCompleteness(p.contentType, p.bodyTarget, p.mediaAssetId).complete).length;
          const isAll = ready === posts.length;
          return (
            <span title={isAll ? 'Tất cả đã đủ data' : `${ready}/${posts.length} đủ data`}
                  style={{ padding: '1px 6px', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                           borderRadius: 999,
                           color: isAll ? 'var(--ok)' : 'var(--warn)',
                           background: isAll ? 'rgba(74,222,128,.13)' : 'rgba(251,191,36,.13)',
                           border: `1px solid ${isAll ? 'rgba(74,222,128,.45)' : 'rgba(251,191,36,.45)'}` }}>
              {ready}/{posts.length}
            </span>
          );
        })()}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setStrategyOpen((v) => !v)}
                title="Mở chiến lược phase: mục tiêu mix, filter loại bài, regen batch, batch creation."
                style={{ fontSize: 10, padding: '3px 8px', background: strategyOpen ? 'var(--accent-soft)' : 'transparent',
                         color: strategyOpen ? 'var(--accent)' : 'var(--fg-3)',
                         border: `1px solid ${strategyOpen ? 'var(--accent-line)' : 'var(--line)'}`,
                         borderRadius: 4, cursor: 'pointer',
                         fontFamily: 'var(--font-mono)' }}>
          ⚙ Strategy {strategyOpen ? '▾' : '▸'}
        </button>
        {/* + Tạo bài button vẫn giữ ngoài header — primary action.
            0057 GATE: phase bridge/seed/direct chỉ cho tạo khi joined (server cũng gate
            createPostForBriefPhase). UI disable + click → focus join banner để clear feedback. */}
        {(() => {
          const phaseNeedsJoin = ['bridge', 'seed', 'direct'].includes(phase);
          const createBlocked = phaseNeedsJoin && !isJoined;
          const createBlockTip = createBlocked
            ? `🔒 Phase "${phase}" yêu cầu account đã joined community. Click để mở Join status.`
            : 'Tạo 1 bài chữ (text) — không AI gen ngay. Bấm ▾ bên cạnh để chọn loại khác.';
          return (
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <button className="btn ghost" type="button"
                  onClick={() => { if (createBlocked) { onRequestJoin?.(); return; } handleCreate('text'); }}
                  disabled={creating || batchBusy}
                  title={createBlockTip}
                  style={{ fontSize: 10, padding: '3px 8px 3px 10px',
                           borderTopRightRadius: 0, borderBottomRightRadius: 0,
                           opacity: createBlocked ? 0.5 : 1,
                           cursor: createBlocked ? 'not-allowed' : 'pointer' }}>
            {creating ? <><Spinner size="xs" /> Đang tạo</>
              : createBlocked ? '🔒 + Tạo 1 bài' : '+ Tạo 1 bài'}
          </button>
          <button className="btn ghost" type="button"
                  onClick={() => { if (createBlocked) { onRequestJoin?.(); return; } setCreateMenuOpen((v) => !v); }}
                  disabled={creating || batchBusy}
                  title={createBlocked ? createBlockTip : "Chọn loại bài (ảnh / video / link / carousel / story / thread / poll / doc)"}
                  style={{ fontSize: 10, padding: '3px 6px',
                           borderLeft: '1px solid var(--line)',
                           borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
                           display: 'inline-flex', alignItems: 'center',
                           opacity: createBlocked ? 0.5 : 1,
                           cursor: createBlocked ? 'not-allowed' : 'pointer' }}>
            <IconChevron dir={createMenuOpen ? 'up' : 'down'} size={10} />
          </button>
          {createMenuOpen && (() => {
            const formats = allowedFormats(platformKey, platformCategory, platformAllowedFormats, habitatAllowedFormats);
            // Tính achievement để recommend loại nên tạo tiếp.
            const target = effectiveMix(platformKey, platformCategory, phaseFormatMix ?? undefined, undefined, platformAllowedFormats, habitatAllowedFormats);
            const counts: Record<string, number> = {};
            for (const p of posts) counts[p.contentType || 'text'] = (counts[p.contentType || 'text'] ?? 0) + 1;
            const ach = computeMixAchievement(counts, target);
            const achByKey = new Map(ach.items.map((it) => [it.key, it]));
            // Sort: miss (priority cao) → under (gap lớn → bé) → ok → extra.
            const sorted = [...formats].sort((a, b) => {
              const av = achByKey.get(a.key);
              const bv = achByKey.get(b.key);
              const score = (v?: typeof ach.items[number]) => {
                if (!v) return 5;
                if (v.verdict === 'miss') return 0;
                if (v.verdict === 'under') return 1 - (v.actualShare - v.targetShare); // gap lớn → score cao
                if (v.verdict === 'ok') return 3;
                return 4; // extra
              };
              return score(av) - score(bv);
            });
            const hasPosts = posts.length > 0;
            return (
              <>
                <div onClick={() => setCreateMenuOpen(false)}
                     style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 41,
                              minWidth: 240, background: 'var(--bg-1)',
                              border: '1px solid var(--line-2)', borderRadius: 6,
                              boxShadow: '0 12px 32px rgba(0,0,0,.5)', padding: 4 }}>
                  <div style={{ padding: '4px 8px 6px', fontSize: 9, fontFamily: 'var(--font-mono)',
                                color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '.06em',
                                borderBottom: '1px solid var(--line)' }}>
                    {hasPosts ? 'Loại nên tạo tiếp (theo tracking)' : 'Loại bài cho platform này'}
                  </div>
                  {sorted.map((f) => {
                    const v = achByKey.get(f.key);
                    const col = formatColors(f.key);
                    const meta = formatMeta(f.key);
                    let badge: { text: string; bg: string; fg: string; border: string } | null = null;
                    let titleSuffix = '';
                    if (v) {
                      const targetPct = Math.round(v.targetShare * 100);
                      if (v.verdict === 'miss') {
                        badge = { text: 'nên tạo', bg: 'rgba(248,113,113,.18)', fg: 'var(--bad)', border: 'rgba(248,113,113,.5)' };
                        titleSuffix = `\n→ Chưa có bài loại này — target ${targetPct}% (~${v.target} bài). Tạo để bám tiêu chí.`;
                      } else if (v.verdict === 'under') {
                        badge = { text: `+1 → bám`, bg: 'rgba(251,191,36,.18)', fg: 'var(--warn)', border: 'rgba(251,191,36,.5)' };
                        titleSuffix = `\n→ Đang ${v.actual}/${v.target} (thiếu ${Math.max(0, v.target - v.actual)} bài để đạt target ${targetPct}%).`;
                      } else if (v.verdict === 'ok') {
                        badge = { text: '✓ đạt', bg: 'rgba(74,222,128,.13)', fg: 'var(--ok)', border: 'rgba(74,222,128,.45)' };
                        titleSuffix = `\n→ Đã đạt: ${v.actual}/${v.target} (~${Math.round(v.actualShare * 100)}%).`;
                      } else if (v.verdict === 'extra') {
                        badge = { text: 'ngoài mix', bg: 'rgba(167,139,250,.15)', fg: '#a78bfa', border: 'rgba(167,139,250,.4)' };
                        titleSuffix = `\n→ Loại này không nằm trong mix mục tiêu (${v.actual} bài thừa).`;
                      }
                    }
                    return (
                      <button key={f.key} type="button" className="btn ghost"
                              onClick={() => handleCreate(f.key)}
                              title={f.hint + titleSuffix}
                              style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8,
                                       fontSize: 11.5, padding: '5px 8px', textAlign: 'left',
                                       color: 'var(--fg-1)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                       width: 18, height: 18, borderRadius: 3,
                                       background: col.bg, color: col.fg,
                                       border: `1px solid ${col.border}`, flexShrink: 0 }}>
                          <FormatIcon kind={f.key} size={12} />
                        </span>
                        <span style={{ flex: 1 }}>{meta.label}</span>
                        {hasPosts && v && (
                          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>
                            {v.actual}/{v.target || '?'}
                          </span>
                        )}
                        {badge && (
                          <span style={{ padding: '0 5px', fontSize: 8.5, fontFamily: 'var(--font-mono)', fontWeight: 700,
                                         borderRadius: 3, textTransform: 'uppercase',
                                         background: badge.bg, color: badge.fg, border: `1px solid ${badge.border}` }}>
                            {badge.text}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </span>
        );
        })()}
      </div>

      {/* ──── STRATEGY DRAWER: collapsed by default ──── */}
      {strategyOpen && (
        <div style={{ marginBottom: 8, padding: 8, background: 'var(--bg-2)',
                      border: '1px solid var(--accent-line)', borderRadius: 6,
                      display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {posts.length === 0 && (() => {
              const batchBlocked = !isJoined;
              return (
              <button className="btn primary" type="button"
                      onClick={() => { if (batchBlocked) { onRequestJoin?.(); return; } handleCreateBatch3(); }}
                      disabled={batchBusy}
                      title={batchBlocked
                        ? '🔒 Chưa join community — batch tạo bài sẽ fail. Click để mở Join status.'
                        : 'Tạo 3 placeholder + AI sinh đồng thời 3 bài đa dạng. ≈ $0.02'}
                      style={{ fontSize: 10, padding: '3px 10px',
                               opacity: batchBlocked ? 0.5 : 1,
                               cursor: batchBlocked ? 'not-allowed' : 'pointer' }}>
                {batchCreating ? <><Spinner size="xs" /> Đang sinh batch</>
                  : batchBlocked ? '🔒 ✨ Tạo batch 3 bài'
                  : <>✨ Tạo batch 3 bài <span style={{ opacity: 0.7 }}>≈ $0.02</span></>}
              </button>
              );
            })()}
            {canBatchRegen && (
              <button className="btn" type="button" onClick={handleRegenBatch} disabled={batchBusy}
                      title={`Regen ${posts.length} bài hiện có với diversity enforced. ≈ $${(0.006 * posts.length).toFixed(2)}`}
                      style={{ fontSize: 10, padding: '3px 10px' }}>
                {batchRegenning ? <><Spinner size="xs" /> Đang regen</> : <>↻ Regen batch ({posts.length}) <span style={{ opacity: 0.7 }}>≈ ${(0.006 * posts.length).toFixed(2)}</span></>}
              </button>
            )}
          </div>
        </div>
      )}

      {batchError && (
        <div style={{ padding: 8, fontSize: 11, color: 'var(--bad)', background: 'rgba(255,77,94,.08)', border: '1px solid rgba(255,77,94,.3)', borderRadius: 5, marginBottom: 6 }}>
          ⚠ Batch error: {batchError}
        </div>
      )}

      {batchResult && (
        <div style={{ padding: 10, fontSize: 11, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', borderRadius: 5, marginBottom: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 700, color: 'var(--accent)' }}>✨ Batch diversity:</span>
            <span style={{ flex: 1, color: 'var(--fg-1)' }}>{batchResult.rationale}</span>
            <button type="button" onClick={() => setBatchResult(null)} className="btn ghost"
                    style={{ fontSize: 10, padding: '2px 6px' }}>✕</button>
          </div>
          {batchResult.results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>
              {batchResult.results.map((r) => (
                <div key={r.cardId}>
                  <strong style={{ color: 'var(--accent)' }}>{r.cardRef}</strong>
                  {' · '}concept: <em style={{ color: 'var(--fg-1)' }}>{r.concept}</em>
                  {' · '}hook: <em style={{ color: 'var(--fg-3)' }}>{(r.hookUsed || '').slice(0, 60)}…</em>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Mức độ đạt theo tiêu chí mix — chỉ hiện trong Strategy drawer ── */}
      {strategyOpen && !loading && (() => {
        const target = effectiveMix(platformKey, platformCategory, phaseFormatMix ?? undefined, undefined, platformAllowedFormats, habitatAllowedFormats);
        const counts: Record<string, number> = {};
        for (const p of posts) counts[p.contentType || 'text'] = (counts[p.contentType || 'text'] ?? 0) + 1;
        const ach = computeMixAchievement(counts, target);
        const empty = ach.total === 0;
        return (
          <div style={{ padding: '7px 9px', marginBottom: 6,
                        background: 'var(--bg-2)', border: '1px solid var(--line)',
                        borderLeft: `3px solid ${empty ? 'var(--warn)' : (ach.missCount === 0 ? 'var(--ok)' : 'var(--warn)')}`,
                        borderRadius: 5, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span title="So sánh phân bổ thực tế (cards đã tạo) vs mix mục tiêu của phase này. Mỗi chip màu = 1 loại format; tick = đạt share mục tiêu; ⚠ = đang thiếu; ✕ = chưa có bài loại đó."
                  style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--fg-3)',
                           textTransform: 'uppercase', letterSpacing: '.05em', cursor: 'help' }}>
              🎯 Mức đạt tiêu chí
            </span>
            {empty ? (
              <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                Chưa có bài — target mix:
              </span>
            ) : (
              <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                {ach.total} bài
              </span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', flex: 1 }}>
              {ach.items.map((it) => {
                const col = formatColors(it.key);
                const meta = formatMeta(it.key);
                const targetPct = Math.round(it.targetShare * 100);
                const actualPct = Math.round(it.actualShare * 100);
                const icon = it.verdict === 'ok' ? '✓' : it.verdict === 'miss' ? '✕' : it.verdict === 'extra' ? '+' : '⚠';
                const verdictColor =
                  it.verdict === 'ok' ? 'var(--ok)' :
                  it.verdict === 'miss' ? 'var(--bad)' :
                  it.verdict === 'extra' ? '#a78bfa' :
                  'var(--warn)';
                const tip = it.verdict === 'extra'
                  ? `${meta.label}: thừa ${it.actual} bài — target = 0 (không nằm trong mix mục tiêu)`
                  : it.verdict === 'miss'
                    ? `${meta.label}: CHƯA CÓ bài — target ~${it.target} (${targetPct}%)`
                    : it.verdict === 'ok'
                      ? `${meta.label}: ✓ đạt — có ${it.actual} bài (${actualPct}%) ≥ target ${targetPct}%`
                      : `${meta.label}: thiếu — có ${it.actual} bài (${actualPct}%) < target ${targetPct}% (~${it.target} bài)`;
                return (
                  <span key={it.key} title={tip}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 3,
                                 padding: '1px 6px', fontSize: 9.5, fontFamily: 'var(--font-mono)', fontWeight: 700,
                                 borderRadius: 3,
                                 background: col.bg, color: col.fg,
                                 border: `1px solid ${col.border}`,
                                 opacity: it.verdict === 'miss' ? 0.55 : 1 }}>
                    <FormatIcon kind={it.key} size={10} />
                    {meta.label}
                    <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>
                      {empty ? `${targetPct}%` : `${it.actual}/${it.target || '?'}`}
                    </span>
                    <span style={{ color: verdictColor, fontSize: 10, fontWeight: 700 }}>{icon}</span>
                  </span>
                );
              })}
            </span>
          </div>
        );
      })()}

      {loading ? (
        <div style={{ padding: 12, textAlign: 'center', color: 'var(--fg-3)', fontSize: 11 }}>
          <Spinner size="xs" /> Đang tải…
        </div>
      ) : posts.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--fg-3)', padding: 10, background: 'var(--bg-2)', borderRadius: 5, border: '1px dashed var(--line)' }}>
          Chưa có bài viết nào cho phase <strong style={{ color: PHASE_COLOR[phase] }}>{PHASE_LABEL[phase]}</strong>.{' '}
          <strong>✨ Tạo batch 3 bài AI</strong> = 1-click tạo 3 placeholder + AI sinh content đa dạng ngay.
          Hoặc <strong>+ Tạo 1 bài</strong> nếu muốn placeholder không gen AI.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <PostFiltersBar posts={posts} filters={filters} onChange={setFilters} />
          {applyPostFilters(posts, filters).map((p) => (
            <div key={p.id} id={`post-row-${p.id}`}
                 style={focusCardId === p.id ? { outline: '2px solid var(--accent)', borderRadius: 6 } : undefined}>
            <PostRow post={p} projectId={projectId} briefId={briefId}
                     habitatId={habitatId} habitatUrl={habitatUrl} onOpenHabitat={onOpenHabitat}
                     platformKey={platformKey} platformCategory={platformCategory}
                     platformAllowedFormats={platformAllowedFormats}
                     habitatAllowedFormats={habitatAllowedFormats}
                     voicePillReloadKey={externalReloadKey}
                     bundle={bundle}
                     isJoined={isJoined}
                     onRequestJoin={onRequestJoin}
                     notReadyReason={notReadyReason}
                     onPostsChanged={onPostsChanged}
                     expanded={openId === p.id}
                     onToggle={() => {
                       const opening = openId !== p.id;
                       setOpenId(opening ? p.id : null);
                       onFocusChange?.(phase, opening ? p.id : undefined);
                     }}
                     onChange={refresh}
                     onLocalPatch={(patch) => {
                       setPosts((arr) => arr.map((x) => x.id === p.id ? { ...x, ...patch } : x));
                       // Đổi content_type / media / channel → roadmap Overview cũng phải đổi.
                       if (patch.contentType != null
                           || patch.mediaAssetId !== undefined
                           || patch.channelId !== undefined) onPostsChanged?.();
                     }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PostRow({
  post, projectId, briefId, habitatId, habitatUrl, onOpenHabitat, platformKey, platformCategory,
  platformAllowedFormats, habitatAllowedFormats, voicePillReloadKey = 0,
  bundle,
  isJoined = true, onRequestJoin, notReadyReason,
  expanded, onToggle, onChange, onLocalPatch, onPostsChanged,
}: {
  post: BriefPost;
  projectId: string;
  briefId: number;
  habitatId: number;
  onOpenHabitat?: (habitatId: number) => void;
  habitatUrl?: string | null;
  platformKey?: string;
  platformCategory?: string;
  platformAllowedFormats?: string[] | null;
  habitatAllowedFormats?: string[] | null;
  voicePillReloadKey?: number;        // bump khi habitat overlay đóng → pill re-fetch
  // Pre-fetched bundle từ parent — skip fetch trên mỗi chip (N rows × 3 chip = 3N → 1)
  bundle?: BriefRowContextBundle | null;
  // 0057 GATE: pass-through to DispatchPostFlow
  isJoined?: boolean;
  onRequestJoin?: () => void;
  notReadyReason?: 'account-never-created' | 'account-broken' | 'membership';
  onPostsChanged?: () => void;         // báo parent reload coverage grid sau khi đổi channel
  expanded: boolean;
  onToggle: () => void;
  onChange: () => void;
  // Update post LOCAL (không re-fetch / router.refresh) — dùng cho thay đổi
  // nhỏ như đổi content_type. Cha sẽ patch posts array tại chỗ.
  onLocalPatch?: (patch: Partial<BriefPost>) => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [title, setTitle] = useState(post.title);
  const [bodyReview, setBodyReview] = useState(post.bodyReview);
  const [bodyTarget, setBodyTarget] = useState(post.bodyTarget);
  const [col, setCol] = useState(post.col);
  const [confirmDel, setConfirmDel] = useState(false);
  const [saving, setSaving] = useState(false);
  // Media (ảnh thật kèm bài)
  const [mediaBusy, setMediaBusy] = useState<'gen' | 'set' | 'variants' | 'sequence' | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerItems, setPickerItems] = useState<ProjectMediaItem[] | null>(null);
  const [mediaErr, setMediaErr] = useState<string | null>(null);
  // Variants picker: sau khi sinh 3 ảnh, hiện grid để user pick 1
  const [variants, setVariants] = useState<Array<{ assetId: number; url: string }> | null>(null);
  // Sequence preview: carousel/thread cần multi-image, list từng beat
  const [sequence, setSequence] = useState<Array<{ assetId: number; url: string; beat: string }> | null>(null);
  const genImg = () => {
    setMediaErr(null); setMediaBusy('gen');
    startTransition(async () => {
      const r = await generatePostImage(projectId, post.id);
      setMediaBusy(null);
      if (!r.ok) { setMediaErr(r.error ?? 'Lỗi sinh ảnh'); return; }
      // Cập nhật local NGAY — không refresh, không refetch list.
      if (r.assetId != null) {
        onLocalPatch?.({ mediaAssetId: r.assetId, mediaUrl: r.url ?? null, mediaKind: 'image' });
      }
    });
  };
  // Sinh 3 variants song song → user pick 1. Cost ≈ 3× normal (~$0.16).
  const genVariants = () => {
    setMediaErr(null); setMediaBusy('variants');
    startTransition(async () => {
      const r = await generatePostImageVariants(projectId, post.id, 3);
      setMediaBusy(null);
      if (!r.ok) { setMediaErr(r.error ?? 'Lỗi sinh variants'); return; }
      setVariants(r.variants ?? null);
    });
  };
  // Pick 1 variant → setCardMedia. Variants khác cũng đã save vào media_assets,
  // không xoá — user có thể quay lại pick lại sau qua "📎 Thư viện".
  const pickVariant = (v: { assetId: number; url: string }) => {
    setMediaBusy('set');
    startTransition(async () => {
      await setCardMedia(projectId, post.id, v.assetId);
      setMediaBusy(null);
      setVariants(null);
      onLocalPatch?.({ mediaAssetId: v.assetId, mediaUrl: v.url, mediaKind: 'image' });
    });
  };
  // Carousel/thread → sinh sequence N ảnh storytelling (5/3/1 beats).
  // KHÔNG link auto vào media_asset_id (card đơn 1 media). Hiện grid để user
  // pick 1 làm cover (hoặc dùng cho dispatch multi-media sau).
  const genSequence = () => {
    setMediaErr(null); setMediaBusy('sequence');
    startTransition(async () => {
      const r = await generatePostImageSequence(projectId, post.id);
      setMediaBusy(null);
      if (!r.ok) { setMediaErr(r.error ?? 'Lỗi sinh sequence'); return; }
      setSequence(r.sequence ?? null);
    });
  };
  const attachMedia = (id: number | null) => {
    setMediaBusy('set'); setPickerOpen(false);
    // Tìm url trong pickerItems (nếu attach từ thư viện) để cập nhật local.
    const picked = id != null ? pickerItems?.find((m) => m.id === id) ?? null : null;
    startTransition(async () => {
      await setCardMedia(projectId, post.id, id);
      setMediaBusy(null);
      onLocalPatch?.({
        mediaAssetId: id,
        mediaUrl: picked?.url ?? null,
        mediaKind: id == null ? null : (picked?.kind ?? 'image'),
      });
    });
  };
  const openPicker = () => {
    setPickerOpen((v) => !v);
    if (!pickerItems) listProjectMedia(projectId, 'image').then(setPickerItems);
  };

  // AI ops state
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftRationale, setDraftRationale] = useState<string | null>(null);
  const [critiqueBusy, setCritiqueBusy] = useState(false);
  const [critique, setCritique] = useState<PostCritique | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState<'r2t' | 't2r' | null>(null);

  // Hỗ trợ đăng bài ngay tại đây (thay vì phải ra pipeline modal). Bấm khi
  // bạn vừa TỰ TAY đăng bài này lên cộng đồng → markCardSeeded dời nhịp lane.
  // Legacy seed state — đã thay bằng DispatchPostFlow. Giữ unused refs để
  // tránh remove side-effect (markCardSeeded vẫn dùng trong DispatchPostFlow
  // qua confirmCardPosted wrapper).
  // Đổi loại bài (content_type) tại chỗ
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [typeBusy, setTypeBusy] = useState(false);
  // Anchor button ref + dropdown position (position:fixed escape stacking)
  const typeBtnRef = useRef<HTMLButtonElement | null>(null);
  const [typeDropPos, setTypeDropPos] = useState<{ top: number; left: number } | null>(null);
  const recomputeTypePos = () => {
    const r = typeBtnRef.current?.getBoundingClientRect();
    if (r) setTypeDropPos({ top: r.bottom + 4, left: r.left });
  };
  useEffect(() => {
    if (!typeMenuOpen) return;
    recomputeTypePos();
    const handler = () => recomputeTypePos();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [typeMenuOpen]);
  const changeType = (newType: string) => {
    setTypeMenuOpen(false);
    if (newType === post.contentType) return;
    // KHÔNG đụng body/media/bodyReview/bodyTarget/mediaAssetId — toàn bộ
    // nội dung giữ nguyên. CHỈ cập nhật content_type + (tùy chọn) title
    // metadata nếu nó còn ở dạng auto-gen "[<phase> · <oldLabel>] ...".
    const oldLabel = formatMeta(post.contentType).label;
    const newLabel = formatMeta(newType).label;
    // Match đúng prefix auto-gen: [Cống hiến · Bài chữ] hoặc [Warm-up · Video]
    // (allow space tuỳ ý). Nếu match → thay label cũ bằng mới, giữ phần đuôi.
    const re = new RegExp(`^(\\[[^·\\]]+·\\s*)${oldLabel.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}(\\s*\\][\\s\\S]*)$`);
    const m = post.title?.match(re);
    const patch: Partial<BriefPost> = { contentType: newType };
    if (m) {
      const newTitle = `${m[1]}${newLabel}${m[2]}`;
      patch.title = newTitle;
      setTitle(newTitle); // sync local state input (chưa mở thì cũng OK)
    }
    // Optimistic: cập nhật local NGAY (badge/preview/completeness đổi tức thì,
    // không đợi server, không re-fetch list, không router.refresh).
    onLocalPatch?.(patch);
    // Server lưu ngầm. Nếu fail, log + revert local. Không spinner full-row.
    setTypeBusy(true);
    void updatePost(projectId, post.id, {
      contentType: newType,
      ...(patch.title != null ? { title: patch.title } : {}),
    })
      .then(() => setTypeBusy(false))
      .catch(() => {
        setTypeBusy(false);
        onLocalPatch?.({ contentType: post.contentType, ...(m ? { title: post.title } : {}) }); // revert
        if (m) setTitle(post.title);
        // eslint-disable-next-line no-console
        console.error('Đổi loại bài thất bại — đã revert');
      });
  };
  // markPosted legacy — đã thay bằng DispatchPostFlow + confirmCardPosted.

  const isBilingual = post.targetLang !== 'vi';
  // image/carousel/story: ảnh là sản phẩm chính, text chỉ là caption (ngắn,
  // không bắt buộc). Các loại khác: text là sản phẩm chính.
  const isVisualType = post.contentType === 'image'
    || post.contentType === 'carousel' || post.contentType === 'story';
  const bodyPh = isVisualType
    ? 'Để trống. Bấm ✨ Sinh draft để AI viết caption ngắn, hoặc tự gõ caption (1-2 câu, hook ở dòng đầu). Ảnh là sản phẩm chính — gắn ảnh ở thanh 🎨 Media phía trên.'
    : 'Để trống. Bấm ✨ Sinh draft đầy đủ để AI viết bài từ brief + persona + community rules, hoặc tự gõ tại đây.';

  // Re-sync khi post từ server thay đổi (vd: sau AI generate)
  useEffect(() => {
    setTitle(post.title);
    setBodyReview(post.bodyReview);
    setBodyTarget(post.bodyTarget);
    setCol(post.col);
  }, [post.title, post.bodyReview, post.bodyTarget, post.col]);

  const persist = (patch: { title?: string; bodyReview?: string; bodyTarget?: string; col?: string }) => {
    setSaving(true);
    // Optimistic local — không onChange (refetch list) cũng không router.refresh.
    // Patch chỉ chứa fields đã đổi → áp dụng trực tiếp lên posts state.
    onLocalPatch?.(patch);
    startTransition(async () => {
      await updatePost(projectId, post.id, patch);
      setSaving(false);
      // KHÔNG re-fetch / router.refresh — local state đã setLocalPatch xong.
    });
  };

  const handleDelete = () => {
    if (!confirmDel) {
      setConfirmDel(true);
      setTimeout(() => setConfirmDel(false), 3000);
      return;
    }
    startTransition(async () => {
      await deletePost(projectId, post.id);
      // Xoá hẳn 1 card → list phải refetch (không có optimistic remove cấp
      // row trong PostsForPhase). onChange() bump bumpKey để re-fetch list
      // (1 round-trip nhanh, KHÔNG router.refresh page).
      onChange();
    });
  };

  const handleGenerate = () => {
    setDraftBusy(true);
    setAiError(null);
    setDraftRationale(null);
    startTransition(async () => {
      const res = await generateFullDraft(post.id);
      setDraftBusy(false);
      if (!res.ok) { setAiError(res.error ?? 'Generate failed'); return; }
      if (res.rationale) setDraftRationale(res.rationale);
      // Local setState + patch — không refresh, không refetch list.
      if (res.title != null) setTitle(res.title);
      if (res.bodyReview != null) setBodyReview(res.bodyReview);
      if (res.bodyTarget != null) setBodyTarget(res.bodyTarget);
      onLocalPatch?.({
        ...(res.title != null ? { title: res.title } : {}),
        ...(res.bodyReview != null ? { bodyReview: res.bodyReview } : {}),
        ...(res.bodyTarget != null ? { bodyTarget: res.bodyTarget } : {}),
      });
    });
  };

  const handleCritique = () => {
    setCritiqueBusy(true);
    setAiError(null);
    startTransition(async () => {
      const res = await critiquePost(post.id);
      setCritiqueBusy(false);
      if (!res.ok) { setAiError(res.error ?? 'Critique failed'); return; }
      setCritique(res.critique ?? null);
    });
  };

  const handleSync = (direction: 'r2t' | 't2r') => {
    setSyncBusy(direction);
    setAiError(null);
    startTransition(async () => {
      const res = await translateBetween(
        post.id,
        direction === 'r2t' ? 'review-to-target' : 'target-to-review',
      );
      setSyncBusy(null);
      if (!res.ok) { setAiError(res.error ?? 'Sync failed'); return; }
      // CHỈ cập nhật ô textarea bị ảnh hưởng — không onChange, không refresh.
      // Server đã lưu DB rồi; local state đồng bộ luôn để khỏi gọi BE lần 2.
      if (res.translated != null) {
        if (direction === 'r2t') {
          setBodyTarget(res.translated);
          onLocalPatch?.({ bodyTarget: res.translated });
        } else {
          setBodyReview(res.translated);
          onLocalPatch?.({ bodyReview: res.translated });
        }
      }
    });
  };

  const fld: CSSProperties = {
    width: '100%', padding: '6px 8px', background: 'var(--bg-2)',
    border: '1px solid var(--line)', borderRadius: 4, color: 'var(--fg-0)',
    fontSize: 12, outline: 'none',
  };
  const taFld: CSSProperties = { ...fld, fontFamily: 'var(--font-mono)', fontSize: 11.5, resize: 'vertical' };
  const labelStyle: CSSProperties = { fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 };

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5,
                  // overflow: 'visible' để dropdown của type/channel chip không bị
                  // clip khi card collapsed. Border-radius vẫn áp dụng cho con
                  // qua border-radius riêng nếu cần.
                  overflow: 'visible' }}>
      <div onClick={onToggle}
           style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', cursor: 'pointer' }}
           title={`${post.cardRef} — click để mở/đóng editor`}>
        {/* SEED-XX: chỉ hiện khi expanded (collapsed → tooltip thay vì badge) */}
        {expanded && (
          <span style={{
            padding: '1px 5px', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
            background: 'var(--bg-1)', color: 'var(--fg-3)', borderRadius: 3, border: '1px solid var(--line)',
            flexShrink: 0,
          }}>{post.cardRef}</span>
        )}
        <span style={{ display: 'inline-flex', flexShrink: 0 }}
              onClick={(e) => e.stopPropagation()}>
          <button ref={typeBtnRef} type="button"
                  onClick={() => {
                    recomputeTypePos();
                    setTypeMenuOpen((v) => !v);
                  }}
                  disabled={typeBusy}
                  title={`Loại bài: ${formatMeta(post.contentType).label}. Click để đổi loại (ảnh / video / link / carousel…). Thay đổi áp dụng ngay; preview + completeness sẽ tự cập nhật.`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 6px 1px 7px',
                           fontSize: 9.5, fontWeight: 700, borderRadius: 3,
                           background: formatColors(post.contentType).bg,
                           color: formatColors(post.contentType).fg,
                           border: `1px solid ${formatColors(post.contentType).border}`, cursor: 'pointer' }}>
            <FormatIcon kind={post.contentType} size={12} /> {formatMeta(post.contentType).label}
            {typeBusy && (
              <span title="Đang lưu..." style={{ width: 5, height: 5, borderRadius: 3,
                background: 'var(--warn)', display: 'inline-block', flexShrink: 0 }} />
            )}
            <IconChevron dir={typeMenuOpen ? 'up' : 'down'} size={9} />
          </button>
          {typeMenuOpen && typeDropPos && (
            <>
              {/* z-index siêu cao để escape mọi stacking context của card row.
                  position:fixed + toạ độ từ button rect để dropdown không bị
                  card khác đè. */}
              <div onClick={() => setTypeMenuOpen(false)}
                   style={{ position: 'fixed', inset: 0, zIndex: 1100 }} />
              <div style={{ position: 'fixed', top: typeDropPos.top, left: typeDropPos.left, zIndex: 1101,
                            minWidth: 170, background: 'var(--bg-1)',
                            border: '1px solid var(--line-2)', borderRadius: 6,
                            boxShadow: '0 12px 32px rgba(0,0,0,.5)', padding: 4 }}>
                <div style={{ padding: '4px 8px 6px', fontSize: 9, fontFamily: 'var(--font-mono)',
                              color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '.06em',
                              borderBottom: '1px solid var(--line)' }}>
                  Đổi loại bài
                </div>
                {allowedFormats(platformKey, platformCategory, platformAllowedFormats, habitatAllowedFormats).map((f) => {
                  const active = f.key === post.contentType;
                  return (
                    <button key={f.key} type="button" className="btn ghost"
                            onClick={() => changeType(f.key)}
                            title={f.hint}
                            style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8,
                                     fontSize: 11.5, padding: '5px 8px', textAlign: 'left',
                                     color: active ? 'var(--accent)' : 'var(--fg-1)',
                                     background: active ? 'var(--accent-soft)' : 'transparent',
                                     fontWeight: active ? 700 : 400 }}>
                      <FormatIcon kind={f.key} size={14} /> {f.label}
                      {active && <span style={{ marginLeft: 'auto', fontSize: 10 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </span>
        {/* Channel picker — chỉ hiện cho Discord/Slack/Telegram habitats.
            Click chip → dropdown chọn channel + AI suggest. Đổi channel
            mà voice thay đổi → confirm prompt re-gen. */}
        <span onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
          <ChannelPickerChip
            cardId={post.id}
            projectId={projectId}
            initialChannelId={post.channelId}
            initialChannelName={post.channelName}
            preloadedBundle={bundle?.channelsBundle ?? null}
            contentType={post.contentType}
            phase={post.briefPhase}
            onChange={(channelId, channelName) => {
              onLocalPatch?.({ channelId, channelName });
            }}
            onVoiceChanged={async (oldVoice, newVoice) => {
              return window.confirm(
                `Giọng điệu sẽ đổi từ "${oldVoice}" → "${newVoice}" theo channel mới.\n\n`
                + `Bài hiện tại được viết theo giọng cũ. Bấm OK để sinh lại draft theo giọng mới, hoặc Cancel để chỉ đổi channel (giữ bài cũ).`,
              );
            }}
            onAfterChange={() => {
              // Trigger queue + voice pill re-fetch ở parent
              onPostsChanged?.();
            }}
          />
        </span>
        {/* Pillar picker — macro positioning. Hidden tự động nếu project chưa
            có pillar nào (CPS chưa setup). Đổi pillar = đổi voice + key msgs
            + forbidden → AI gen ra bài khác hẳn. */}
        <span onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
          <PillarPickerChip
            cardId={post.id}
            projectId={projectId}
            initialPillarId={post.pillarId}
            initialPillarName={post.pillarName}
            preloadedPillars={bundle?.pillars ?? null}
            preloadedBriefPillarId={bundle?.briefPrimaryPillarId ?? null}
            preloadedTargetLang={post.targetLang}
            onChange={(pillarId, pillarName) => {
              onLocalPatch?.({ pillarId, pillarName });
            }}
            onAfterChange={() => {
              onPostsChanged?.();
            }}
          />
        </span>
        <span style={{ flex: 1, fontSize: 12, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title || <em style={{ color: 'var(--fg-4)' }}>(không tiêu đề)</em>}
        </span>
        {/* Compact status: 1 dot completeness + chỉ hiện "thiếu X" khi chưa
            đủ data (giảm noise khi đa số card đã OK). Lang/col/dispatch gộp
            vào tooltip + chỉ icon nhỏ. */}
        {(() => {
          const cmp = postCompleteness(post.contentType, bodyTarget || post.bodyTarget, post.mediaAssetId);
          if (cmp.complete) {
            // Đủ data → chỉ chấm xanh nhỏ
            return (
              <span title="Đã đủ data (sẵn sàng đăng)"
                    style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--ok)', flexShrink: 0 }} />
            );
          }
          // Thiếu → badge nhỏ kèm chi tiết
          return (
            <span title={`Thiếu: ${cmp.missing.join(' + ')}`}
                  style={{ padding: '0 6px', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                           borderRadius: 999, flexShrink: 0,
                           color: 'var(--warn)',
                           background: 'rgba(251,191,36,.13)',
                           border: '1px solid rgba(251,191,36,.45)' }}>
              thiếu {cmp.missing.join('+')}
            </span>
          );
        })()}
        {/* Gộp lang + col + dispatch vào 1 icon nhỏ với tooltip multi-line.
            Chỉ hiện ▾/▸ — các info phụ vào tooltip. */}
        <span title={[
                `Ngôn ngữ: ${isBilingual ? `vi → ${post.targetLang}` : post.targetLang}`,
                `Cột board: ${COL_LABEL[col] ?? col}`,
                post.dispatchReady ? '🚀 Đã dispatch-ready' : null,
                `Card: ${post.cardRef}`,
              ].filter(Boolean).join(' · ')}
              style={{ fontSize: 9, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)',
                       padding: '0 4px', cursor: 'help' }}>
          {isBilingual ? '🌐' : ''}{post.dispatchReady ? '🚀' : ''}
        </span>
        <span style={{ fontSize: 9, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
          {expanded ? '▾' : '▸'}
        </span>
      </div>

      {expanded && (
        <div style={{ padding: 10, borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FormatPreview contentType={post.contentType} title={title}
                         body={bodyReview || bodyTarget || post.body}
                         mediaUrl={post.mediaUrl} />

          {/* Media thật kèm bài */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                        padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5 }}>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--fg-3)',
                           textTransform: 'uppercase', letterSpacing: '.06em' }}>🎨 Media</span>
            {post.mediaUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={post.mediaUrl} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--line)' }} />
              : <span style={{ fontSize: 10.5, color: 'var(--fg-4)' }}>chưa có ảnh thật</span>}
            <span style={{ flex: 1 }} />
            <button type="button" className="btn primary" disabled={!!mediaBusy} onClick={genImg}
                    title="AI sinh 1 ảnh (gpt-image-2 chất lượng medium) theo brief + giọng điệu + phong cách của habitat. Tự gắn vào bài. ≈ $0.05/ảnh."
                    style={{ fontSize: 11, padding: '4px 9px' }}>
              {mediaBusy === 'gen'
                ? <><Spinner size="xs" /> Đang sinh</>
                : <>✨ Sinh ảnh <span style={{ opacity: 0.7, fontWeight: 400 }}>≈ $0.05</span></>}
            </button>
            <button type="button" className="btn" disabled={!!mediaBusy} onClick={genVariants}
                    title="Sinh 3 phương án song song (3 góc/bố cục khác nhau, cùng giọng/phong cách). Chọn 1 → các ảnh còn lại vẫn lưu thư viện. ≈ $0.16."
                    style={{ fontSize: 11, padding: '4px 9px' }}>
              {mediaBusy === 'variants'
                ? <><Spinner size="xs" /> 3 phương án…</>
                : <>🎨 3 phương án <span style={{ opacity: 0.7, fontWeight: 400 }}>≈ $0.16</span></>}
            </button>
            {(post.contentType === 'carousel' || post.contentType === 'thread') && (
              <button type="button" className="btn" disabled={!!mediaBusy} onClick={genSequence}
                      title={post.contentType === 'carousel'
                        ? 'Carousel = 5 ảnh kể chuyện (hook → bối cảnh → twist → bằng chứng → CTA). Cùng palette/style để liền mạch. ≈ $0.27.'
                        : 'Thread = 3 ảnh (hook → giữa → kết). Cùng palette. ≈ $0.16.'}
                      style={{ fontSize: 11, padding: '4px 9px' }}>
                {mediaBusy === 'sequence'
                  ? <><Spinner size="xs" /> Đang sinh chuỗi…</>
                  : <>🎞 {post.contentType === 'carousel' ? 'Chuỗi 5 ảnh carousel' : 'Chuỗi 3 ảnh thread'}</>}
              </button>
            )}
            <button type="button" className="btn" disabled={!!mediaBusy} onClick={openPicker}
                    style={{ fontSize: 11, padding: '4px 9px' }}>📎 Thư viện</button>
            {post.mediaUrl && (
              <button type="button" className="btn" disabled={!!mediaBusy} onClick={() => attachMedia(null)}
                      style={{ fontSize: 11, padding: '4px 9px', color: 'var(--bad)' }}>✕ Gỡ</button>
            )}
          </div>
          {mediaErr && <div style={{ fontSize: 11, color: 'var(--bad)' }}>⚠ {mediaErr}</div>}
          {variants && variants.length > 0 && (
            <div style={{ padding: 8, border: '1px solid var(--neon-violet)',
                          borderRadius: 6, background: 'rgba(157,108,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neon-violet)' }}>
                  🎨 Chọn 1 phương án ({variants.length}):
                </span>
                <span style={{ flex: 1 }} />
                <button type="button" onClick={() => setVariants(null)}
                        title="Đóng — các phương án vẫn còn trong thư viện."
                        style={{ fontSize: 10, padding: '2px 7px', background: 'transparent',
                                 color: 'var(--fg-3)', border: '1px solid var(--line)', borderRadius: 3,
                                 cursor: 'pointer' }}>Đóng</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${variants.length}, 1fr)`, gap: 6 }}>
                {variants.map((v, i) => (
                  <button key={v.assetId} type="button" onClick={() => pickVariant(v)}
                          disabled={!!mediaBusy}
                          title={`Chọn phương án ${i + 1} làm ảnh chính`}
                          style={{ padding: 0, border: '2px solid var(--line)',
                                   borderRadius: 5, overflow: 'hidden',
                                   cursor: mediaBusy ? 'wait' : 'pointer',
                                   background: 'var(--bg-2)', aspectRatio: '1',
                                   position: 'relative' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.url} alt={`phương án ${i + 1}`}
                         style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <span style={{ position: 'absolute', top: 4, left: 4,
                                   padding: '1px 5px', fontSize: 9, fontWeight: 700,
                                   background: 'rgba(0,0,0,0.6)', color: 'white',
                                   borderRadius: 3, fontFamily: 'var(--font-mono)' }}>
                      {i + 1}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {sequence && sequence.length > 0 && (
            <div style={{ padding: 8, border: '1px solid var(--accent)',
                          borderRadius: 6, background: 'rgba(74,222,128,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ok)' }}>
                  🎞 Chuỗi ({sequence.length} ảnh) — click 1 để làm ảnh bìa:
                </span>
                <span style={{ flex: 1 }} />
                <button type="button" onClick={() => setSequence(null)}
                        style={{ fontSize: 10, padding: '2px 7px', background: 'transparent',
                                 color: 'var(--fg-3)', border: '1px solid var(--line)', borderRadius: 3,
                                 cursor: 'pointer' }}>Đóng</button>
              </div>
              <div style={{ display: 'grid',
                            gridTemplateColumns: `repeat(${Math.min(sequence.length, 5)}, 1fr)`,
                            gap: 6 }}>
                {sequence.map((s, i) => (
                  <button key={s.assetId} type="button"
                          onClick={() => pickVariant({ assetId: s.assetId, url: s.url })}
                          disabled={!!mediaBusy}
                          title={`Ảnh ${i + 1}: ${beatLabelVi(s.beat)} — click để làm bìa`}
                          style={{ padding: 0, border: '2px solid var(--line)',
                                   borderRadius: 5, overflow: 'hidden',
                                   cursor: mediaBusy ? 'wait' : 'pointer',
                                   background: 'var(--bg-2)', aspectRatio: '1',
                                   position: 'relative' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.url} alt={s.beat}
                         style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
                                   padding: '2px 4px', fontSize: 9,
                                   background: 'rgba(0,0,0,0.6)', color: 'white',
                                   fontFamily: 'var(--font-mono)',
                                   textAlign: 'center',
                                   overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {i + 1}. {beatLabelVi(s.beat)}
                    </span>
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 5,
                            fontStyle: 'italic' }}>
                💡 Tất cả ảnh đã lưu trong thư viện. Chọn 1 làm bìa ở đây — các ảnh còn lại dùng cho dispatch (sẽ wire sau).
              </div>
            </div>
          )}
          {pickerOpen && (
            <div style={{ border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg-1)', padding: 8 }}>
              {!pickerItems
                ? <div style={{ fontSize: 11, color: 'var(--fg-3)' }}><Spinner size="xs" /> Đang tải thư viện…</div>
                : pickerItems.length === 0
                  ? <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Thư viện chưa có ảnh — dùng ✨ Sinh ảnh AI.</div>
                  : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px,1fr))', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                      {pickerItems.map((m) => (
                        <button key={m.id} type="button" onClick={() => attachMedia(m.id)}
                                title={m.filename}
                                style={{ padding: 0, border: post.mediaAssetId === m.id ? '2px solid var(--accent)' : '1px solid var(--line)',
                                         borderRadius: 5, overflow: 'hidden', cursor: 'pointer', background: 'var(--bg-2)', aspectRatio: '1' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        </button>
                      ))}
                    </div>
                  )}
            </div>
          )}

          {/* Dispatch flow — 1 click copy + open deep-link channel/habitat +
              confirm modal với URL/timestamp/screenshot/note. Đã đăng → hiện
              link bài + button bỏ đánh dấu. */}
          {(() => {
            const channelMeta = post.channelId && bundle
              ? bundle.channelsBundle.channels.find((c) => c.id === post.channelId)
              : null;
            return (
              <DispatchPostFlow
                projectId={projectId}
                briefId={briefId}
                cardId={post.id}
                bodyToCopy={bodyTarget || bodyReview || post.bodyTarget || post.bodyReview}
                postUrl={post.postUrl}
                channelUrl={channelMeta?.url ?? null}
                habitatUrl={habitatUrl}
                channelName={post.channelName}
                habitatName={undefined}
                isJoined={isJoined}
                onRequestJoin={onRequestJoin}
                notReadyReason={notReadyReason}
                onConfirmed={(url) => {
                  onLocalPatch?.({ postUrl: url, postedAt: new Date().toISOString() });
                  onPostsChanged?.();
                  if (!habitatUrl) onOpenHabitat?.(habitatId);   // nhắc nhập habitat URL
                }}
                onUnconfirmed={() => {
                  onLocalPatch?.({ postUrl: null, postedAt: null });
                  onPostsChanged?.();
                }}
              />
            );
          })()}

          {/* AI toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
            padding: '6px 8px', background: 'var(--accent-soft)',
            border: '1px solid var(--accent-line)', borderRadius: 5,
          }}>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)' }}>
              🤖 AI Reasoning
            </span>
            {/* Voice context pill — hiển thị giọng + few-shot + lexicon counts + visual
                style. Click → mở habitat modal section giọng điệu (nếu cha truyền
                onOpenHabitat). User biết AI sinh bài với context gì TRƯỚC khi bấm.
                Preloaded từ post + bundle để skip fetch action riêng. */}
            <VoiceContextPill
              cardId={post.id}
              onEdit={onOpenHabitat}
              reloadKey={voicePillReloadKey}
              preloadedCtx={bundle ? buildPreloadedVoiceCtx(post, bundle) : null}
            />
            <button type="button" className="btn primary" onClick={handleGenerate} disabled={draftBusy}
                    title="Dùng reasoning model (o3-mini) viết full draft cả 2 ngôn ngữ từ context phase + persona + community rules + voice profile + few-shot examples. ~3-5s. ≈ $0.01/lần."
                    style={{ fontSize: 10, padding: '4px 10px' }}>
              {draftBusy ? <><Spinner size="xs" /> Đang sinh draft</> : <>✨ Sinh draft đầy đủ <span style={{ opacity: 0.7 }}>≈ $0.01</span></>}
            </button>
            <button type="button" className="btn" onClick={handleCritique} disabled={critiqueBusy}
                    title="Reasoning model review bản nháp: dự đoán mod có remove không, list risks + suggest fix. Chi phí ước lượng ≈ $0.005 / lần."
                    style={{ fontSize: 10, padding: '4px 10px' }}>
              {critiqueBusy ? <><Spinner size="xs" /> Đang review</> : <>🔍 Review <span style={{ opacity: 0.7 }}>≈ $0.005</span></>}
            </button>
            {isBilingual && (
              <>
                <span style={{ width: 1, height: 14, background: 'var(--accent-line)', margin: '0 4px' }} />
                <button type="button" className="btn ghost" onClick={() => handleSync('r2t')} disabled={syncBusy === 'r2t'}
                        title={`Dịch VN review → ${post.targetLang} target (ghi đè bản target)`}
                        style={{ fontSize: 10, padding: '4px 8px' }}>
                  {syncBusy === 'r2t' ? <Spinner size="xs" /> : `↻ VN → ${post.targetLang}`}
                </button>
                <button type="button" className="btn ghost" onClick={() => handleSync('t2r')} disabled={syncBusy === 't2r'}
                        title={`Dịch ${post.targetLang} target → VN review (ghi đè bản review)`}
                        style={{ fontSize: 10, padding: '4px 8px' }}>
                  {syncBusy === 't2r' ? <Spinner size="xs" /> : `↻ ${post.targetLang} → VN`}
                </button>
              </>
            )}
            {draftRationale && (
              <div style={{ flexBasis: '100%', fontSize: 11, color: 'var(--fg-1)', marginTop: 4, padding: 6, background: 'var(--bg-1)', borderRadius: 4 }}>
                <strong style={{ color: 'var(--accent)' }}>Why:</strong> {draftRationale}
              </div>
            )}
            {aiError && (
              <div style={{ flexBasis: '100%', fontSize: 11, color: 'var(--bad)', marginTop: 4 }}>⚠ {aiError}</div>
            )}
          </div>

          {/* Critique panel */}
          {critique && (
            <CritiquePanel critique={critique} onClose={() => setCritique(null)} />
          )}

          {/* Title */}
          <div>
            <label style={labelStyle}>Tiêu đề</label>
            <input type="text" value={title}
                   onChange={(e) => setTitle(e.target.value)}
                   onBlur={() => title !== post.title && persist({ title })}
                   style={fld} />
          </div>

          {/* Body editors - 2 cột nếu bilingual, 1 cột nếu target=vi */}
          {isBilingual ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={labelStyle} title="Bản tiếng Việt — để bạn đọc duyệt nhanh trước khi đăng.">
                  🇻🇳 Bản VN (review)
                </label>
                <textarea value={bodyReview}
                          onChange={(e) => setBodyReview(e.target.value)}
                          onBlur={() => bodyReview !== post.bodyReview && persist({ bodyReview })}
                          placeholder={bodyPh}
                          rows={16} style={taFld} />
              </div>
              <div>
                <label style={labelStyle} title={`Bản ${post.targetLang.toUpperCase()} — sẽ paste lên community.`}>
                  🌐 Bản {post.targetLang.toUpperCase()} (đăng thật)
                </label>
                <textarea value={bodyTarget}
                          onChange={(e) => setBodyTarget(e.target.value)}
                          onBlur={() => bodyTarget !== post.bodyTarget && persist({ bodyTarget })}
                          placeholder={isVisualType
                            ? `Empty is fine. Click ✨ Sinh draft for an AI caption, or type a short caption (1-2 lines). The image is the main asset.`
                            : `Empty. Click ✨ Sinh draft đầy đủ — AI writes the real ${post.targetLang.toUpperCase()} post here.`}
                          rows={16} style={taFld} />
              </div>
            </div>
          ) : (
            <div>
              <label style={labelStyle}
                     title={isVisualType ? 'Ảnh là sản phẩm chính, caption ngắn — không bắt buộc.' : 'Community = vi nên dùng 1 bản.'}>
                🇻🇳 {isVisualType ? 'Caption' : 'Nội dung'}
              </label>
              <textarea value={bodyTarget}
                        onChange={(e) => setBodyTarget(e.target.value)}
                        onBlur={() => bodyTarget !== post.bodyTarget && persist({ bodyTarget, bodyReview: bodyTarget })}
                        placeholder={bodyPh}
                        rows={isVisualType ? 8 : 18} style={taFld} />
            </div>
          )}

          {/* Footer controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>Cột board:</label>
            <select value={col}
                    onChange={(e) => { setCol(e.target.value); persist({ col: e.target.value }); }}
                    style={{ ...fld, width: 'auto', padding: '4px 6px' }}>
              {COL_OPTIONS.map((c) => (
                <option key={c} value={c}>{COL_LABEL[c] ?? c}</option>
              ))}
            </select>
            {saving && <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}><Spinner size="xs" /> đang lưu</span>}
            <span style={{ flex: 1 }} />
            <a href={`/p/${projectId}/board`} target="_blank" rel="noopener noreferrer"
               style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}
               title="Mở Board tab để xem card trong context">
              ↗ Mở Board
            </a>
            <button className="btn danger" type="button" onClick={handleDelete}
                    style={{ fontSize: 10, padding: '3px 8px', ...(confirmDel ? { animation: 'pulseDanger 1s ease-in-out infinite' } : {}) }}>
              {confirmDel ? '⚠ Click lần nữa để xóa' : '🗑 Xóa'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

