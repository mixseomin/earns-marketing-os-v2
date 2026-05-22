'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  createHabitat, updateHabitat, deleteHabitat, setHabitatTribes,
  countCardsByContentTypeForHabitat, archiveCardsByTypesForHabitat,
  type HabitatInput, type AffectedCardsByType,
} from '@/lib/actions/tribes-crud';
import {
  listChannelsForHabitat, bulkReplaceChannels, type HabitatChannelInput,
} from '@/lib/actions/habitat-channels';
import type { TribeRow, HabitatRow, PlatformRow } from '@/lib/data';
import { Spinner, FormatIcon, SiteFavicon, Pill, ResourcePicker } from './ui';
import {
  listBriefsForHabitat,
  listAddableAccountsForHabitat,
  upsertBrief,
  type BriefForHabitat,
} from '@/lib/actions/community-briefs';
import { JOIN_STATUS_LABEL, JOIN_STATUS_COLOR, JOIN_STATUS_ICON } from '@/lib/join-status';
import { PHASE_LABEL, PHASE_COLOR } from '@/lib/phase-plan';
import { accountStatusMeta } from '@/lib/status-meta';
import { AIFormParser } from './ai-form-parser';
import { PlatformPicker } from './platform-picker';
import { platformKeysForHabitatKind, detectPlatformKeyFromUrl, defaultKindForPlatformKey, isKindPlatformCompatible } from '@/lib/habitat-platform-map';
import { TagsInput } from './tags-input';
import { parseFormInput, suggestRulesUrl, type FormFieldSchema } from '@/lib/actions/ai-parse';
import { extractDiscordInvite } from '@/lib/actions/discord-extract';
import { parseChannelsFromInput } from '@/lib/actions/parse-channels';
import { VOICE_PROFILES, VOICE_PROFILE_META, type VoiceProfile } from '@/lib/ai/voice-profile';
import { inferHabitatVisualStyle } from '@/lib/actions/habitat-visual-style';
import { CONTENT_FORMATS, allowedFormats, formatColors, formatMeta } from '@/lib/content-formats';
import { listTechnologies, type TechnologyRow } from '@/lib/actions/technologies';
import { TechnologyPicker } from './technology-picker';

const KINDS = ['subreddit', 'fb-group', 'discord', 'forum', 'hashtag', 'slack', 'telegram', 'youtube', 'other'] as const;
const SCRAPE = ['manual', 'live', 'weekly', 'comments'] as const;
const HEALTH = ['ok', 'warn', 'bad'] as const;
const STATUS_OPTS = ['target', 'engaged', 'saturated', 'banned', 'dormant', 'defunct'] as const;
const STRICTNESS = ['', 'low', 'medium', 'high'] as const;
const COMMUNITY_TYPES = ['', 'discussion', 'news', 'q-a', 'portfolio', 'sharing', 'other'] as const;
const LANGUAGES = ['', 'en', 'vi', 'zh', 'ja', 'ko', 'es', 'pt', 'fr', 'de', 'multi'] as const;

export function HabitatFormModal({
  projectId, habitat, tribes, platforms, presetTribeId, onClose, onCreated,
  onOpenAccount, onOpenBrief,
}: {
  projectId: string;
  habitat: HabitatRow | null;     // null = create
  tribes: TribeRow[];             // for tribe picker
  platforms: PlatformRow[];       // for platform picker
  presetTribeId?: number | null;  // create with this tribe pre-selected
  onClose: () => void;
  onCreated?: (newId: number) => void;  // fired after successful creation
  /** Click @accountHandle trong HabitatBriefsSection → mở Account modal */
  onOpenAccount?: (accountId: number) => void;
  /** Click favicon/row → mở Brief modal */
  onOpenBrief?: (briefId: number) => void;
}) {
  const router = useRouter();
  const isCreate = !habitat;
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Pre-save confirm khi user bỏ format support mà còn cards loại đó.
  // Hiển thị list affected + 2 actions: archive (soft-hide, restore khi bật
  // lại format) hoặc giữ orphan visible (badge cảnh báo).
  const [confirmRemoval, setConfirmRemoval] = useState<{
    removedTypes: string[];
    affected: AffectedCardsByType[];
  } | null>(null);
  const [technologies, setTechnologies] = useState<TechnologyRow[]>([]);
  useEffect(() => { listTechnologies().then(setTechnologies); }, []);
  const [rulesFetchBusy, setRulesFetchBusy] = useState(false);
  const [rulesFetchMsg, setRulesFetchMsg] = useState<string | null>(null);
  const [findUrlBusy, setFindUrlBusy] = useState(false);
  // Discord invite extractor: paste discord.gg/xxx → 1-click fill
  // name/url/description/members (qua Discord public Invite API, no auth).
  const [discordInvite, setDiscordInvite] = useState('');
  const [discordBusy, setDiscordBusy] = useState(false);
  const [discordMsg, setDiscordMsg] = useState<string | null>(null);
  const [discordIcon, setDiscordIcon] = useState<string | null>(habitat?.iconUrl ?? null);
  // Fallback: paste raw rules text/HTML when AI can't fetch the URL
  // (CORS / login wall / cloudflare / private subreddit etc.)
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  // Mode for multi-source rule aggregation: REPLACE (default) or APPEND
  // (merge with existing postingRules, dedupe). Useful for sites with
  // multiple rule pages (charter + per-sub rules + sticky FAQs).
  const [mergeMode, setMergeMode] = useState<'replace' | 'append'>('replace');

  const [form, setForm] = useState<HabitatInput>({
    name: habitat?.name ?? '',
    kind: habitat?.kind ?? 'subreddit',
    url: habitat?.url ?? '',
    platformKey: habitat?.platformKey ?? null,
    technologyKey: habitat?.technologyKey ?? null,
    iconUrl: habitat?.iconUrl ?? null,
    members: habitat?.members ?? 0,
    activity: habitat?.activity ?? '',
    scrapeFrequency: (habitat?.scrapeFrequency as HabitatInput['scrapeFrequency']) ?? 'manual',
    health: (habitat?.health as HabitatInput['health']) ?? 'ok',
    tribeId: habitat?.tribeId ?? presetTribeId ?? null,
    language: habitat?.language ?? '',
    communityType: habitat?.communityType ?? '',
    status: (habitat?.status as HabitatInput['status']) ?? 'target',
    modStrictness: (habitat?.modStrictness as HabitatInput['modStrictness']) ?? '',
    postingRules: habitat?.postingRules ?? '',
    postingRulesUrl: habitat?.postingRulesUrl ?? '',
    minAccountAgeDays: habitat?.minAccountAgeDays ?? 0,
    minKarma: habitat?.minKarma ?? 0,
    minPosts: habitat?.minPosts ?? 0,
    linksAllowedAfter: habitat?.linksAllowedAfter ?? '',
    dominantTopics: habitat?.dominantTopics ?? [],
    forbiddenTopics: habitat?.forbiddenTopics ?? [],
    voiceProfile: habitat?.voiceProfile ?? 'regular',
    voiceNotes: habitat?.voiceNotes ?? '',
    fewShotExamples: habitat?.fewShotExamples ?? null,
    visualStyleDescriptor: habitat?.visualStyleDescriptor ?? null,
    bestPostTimes: habitat?.bestPostTimes ?? '',
    allowedFormatsOverride: habitat?.allowedFormatsOverride ?? null,
  });
  const setF = <K extends keyof HabitatInput>(k: K, v: HabitatInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Channels (sub-channel của Discord/Slack/Telegram). Load lazy khi mount,
  // bulk-save khi user bấm Save modal (cùng habitat update).
  const [channels, setChannels] = useState<HabitatChannelInput[]>([]);
  const [channelsLoaded, setChannelsLoaded] = useState(false);
  useEffect(() => {
    if (isCreate || !habitat) { setChannelsLoaded(true); return; }
    listChannelsForHabitat(habitat.id).then((rows) => {
      setChannels(rows.map((r) => ({
        name: r.name, url: r.url, description: r.description, rules: r.rules,
        allowedFormats: r.allowedFormats, postingGates: r.postingGates,
        voiceProfileOverride: r.voiceProfileOverride, fewShotExamples: r.fewShotExamples,
        sortOrder: r.sortOrder,
      })));
      setChannelsLoaded(true);
    }).catch(() => setChannelsLoaded(true));
  }, [habitat, isCreate]);
  // Multi-channel platform: chỉ hiện section channels cho các platform có
  // concept "channel" (Discord/Slack/Telegram). Reddit/forum chỉ 1 ruleset.
  const showChannels = ['discord', 'slack', 'telegram'].includes(form.platformKey ?? '');

  // M2M: form.tribeId = PRIMARY tribe. extraTribeIds = secondary tribes
  // (excludes primary). Saved together via setHabitatTribes after the
  // main create/update succeeds.
  const [extraTribeIds, setExtraTribeIds] = useState<number[]>(
    () => (habitat?.tribeIds ?? []).filter((id) => id !== (habitat?.tribeId ?? null)),
  );
  const toggleExtra = (id: number) =>
    setExtraTribeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const fld: React.CSSProperties = { width: '100%', padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 13, outline: 'none' };
  const lbl: React.CSSProperties = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block' };

  // Shared rules-extraction schema + apply logic for both fetch (URL) and
  // paste (raw text/HTML) entry points.
  const rulesParseSchema: FormFieldSchema[] = [
    { key: 'postingRules', label: 'Posting rules (markdown)', type: 'string', description: 'Convert raw rules text → markdown bullets, preserve numbering & order.' },
    { key: 'minAccountAgeDays', label: 'Min account age days', type: 'number' },
    { key: 'minKarma', label: 'Min karma', type: 'number' },
    { key: 'minPosts', label: 'Min prior posts', type: 'number' },
    { key: 'linksAllowedAfter', label: 'Links allowed after', type: 'string', description: 'e.g. "5 posts" / "never" / "profile only"' },
    { key: 'modStrictness', label: 'Mod strictness', type: 'enum', enumValues: ['low', 'medium', 'high'] },
    { key: 'dominantTopics', label: 'Dominant topics (comma-separated)', type: 'string', description: 'topics encouraged' },
    { key: 'forbiddenTopics', label: 'Forbidden topics (comma-separated)', type: 'string', description: 'topics banned per rules' },
    { key: 'communityType', label: 'Community type', type: 'enum', enumValues: [...COMMUNITY_TYPES] as string[] },
    { key: 'language', label: 'Language', type: 'enum', enumValues: [...LANGUAGES] as string[] },
  ];
  const rulesParseContext = (() => {
    const base = `Đây là rules / about / nội quy của community "${form.name}" (${form.kind}). Rút ra: full rules text (preserve order như markdown bullets), posting gates (min account age days / karma / posts), khi nào được drop link, mod strictness (low/medium/high suy từ giọng văn), dominant + forbidden topics. Chỉ trả những field tìm thấy.`;
    if (mergeMode === 'append' && (form.postingRules ?? '').trim()) {
      return `${base}\n\nIMPORTANT — APPEND MODE: Đã có rules từ source khác (xem dưới). Hãy MERGE source mới vào, GIỮ rule cũ, DEDUPE rule trùng (cùng nội dung dù khác cách diễn đạt). Output postingRules = full merged markdown bullets, không lặp.\n\n--- EXISTING POSTINGRULES ---\n${form.postingRules}\n--- END EXISTING ---\n\nFor numeric gates (minAccountAgeDays/minKarma/minPosts): chỉ trả nếu source mới có value KHÁC hoặc value CAO HƠN existing — admin có thể đang gộp rules từ nhiều subforum khác nhau, lấy strict nhất. Topics: merge và dedupe cả 2 lists.`;
    }
    return base;
  })();

  const applyRulesParseResult = (values: Record<string, string | number | boolean | null>): number => {
    let applied = 0;
    if (values.postingRules)        { setF('postingRules', String(values.postingRules)); applied++; }
    if (values.minAccountAgeDays != null) { setF('minAccountAgeDays', Number(values.minAccountAgeDays)); applied++; }
    if (values.minKarma != null)    { setF('minKarma', Number(values.minKarma)); applied++; }
    if (values.minPosts != null)    { setF('minPosts', Number(values.minPosts)); applied++; }
    if (values.linksAllowedAfter)   { setF('linksAllowedAfter', String(values.linksAllowedAfter)); applied++; }
    if (values.modStrictness)       { setF('modStrictness', String(values.modStrictness) as HabitatInput['modStrictness']); applied++; }
    if (values.communityType)       { setF('communityType', String(values.communityType)); applied++; }
    if (values.language)            { setF('language', String(values.language)); applied++; }
    if (values.dominantTopics)      { setF('dominantTopics', String(values.dominantTopics).split(',').map((s) => s.trim()).filter(Boolean)); applied++; }
    if (values.forbiddenTopics)     { setF('forbiddenTopics', String(values.forbiddenTopics).split(',').map((s) => s.trim()).filter(Boolean)); applied++; }
    return applied;
  };

  // AI: guess the rules URL from community URL + kind + name (no live fetch).
  // Pattern-matches known platforms first (Reddit instant), AI fallback for others.
  const handleFindRulesUrl = () => {
    if (!form.url?.trim() && !form.name.trim()) { setRulesFetchMsg('Điền tên hoặc URL community trước'); return; }
    setFindUrlBusy(true); setRulesFetchMsg(null);
    startTransition(async () => {
      const res = await suggestRulesUrl({ communityUrl: form.url, kind: form.kind ?? '', name: form.name });
      setFindUrlBusy(false);
      if (!res.ok || !res.url) {
        setRulesFetchMsg(res.error ?? 'Không tìm được URL');
        return;
      }
      setF('postingRulesUrl', res.url);
      const badge = res.confidence === 'certain' ? '✓' : res.confidence === 'likely' ? '~' : '?';
      setRulesFetchMsg(`${badge} Found (${res.method}) — kiểm tra rồi Fetch`);
      setTimeout(() => setRulesFetchMsg(null), 5000);
    });
  };

  // Fetch postingRulesUrl → strip HTML → LLM extract → fill rules + meta.
  const handleFetchRulesFromUrl = () => {
    const url = (form.postingRulesUrl ?? '').trim();
    if (!url) { setRulesFetchMsg('Điền URL trước'); return; }
    setRulesFetchBusy(true); setRulesFetchMsg(null);
    startTransition(async () => {
      const res = await parseFormInput({ url, schema: rulesParseSchema, context: rulesParseContext });
      setRulesFetchBusy(false);
      if (!res.ok || !res.values) {
        setRulesFetchMsg(`${res.error ?? 'Parse failed'} — thử "📋 Paste raw"`);
        return;
      }
      const applied = applyRulesParseResult(res.values);
      setRulesFetchMsg(`✓ Filled ${applied} field${applied === 1 ? '' : 's'}`);
      setTimeout(() => setRulesFetchMsg(null), 4000);
    });
  };

  // Fallback: parse rules from pasted raw text/HTML instead of URL fetch.
  const handleParsePastedRules = () => {
    const text = pasteText.trim();
    if (!text) { setRulesFetchMsg('Paste rules text trước'); return; }
    setRulesFetchBusy(true); setRulesFetchMsg(null);
    startTransition(async () => {
      const res = await parseFormInput({ text, schema: rulesParseSchema, context: rulesParseContext });
      setRulesFetchBusy(false);
      if (!res.ok || !res.values) { setRulesFetchMsg(res.error ?? 'Parse failed'); return; }
      const applied = applyRulesParseResult(res.values);
      setRulesFetchMsg(`✓ Filled ${applied} field${applied === 1 ? '' : 's'} from paste`);
      setPasteText('');
      setPasteOpen(false);
      setTimeout(() => setRulesFetchMsg(null), 4000);
    });
  };

  // Discord invite → 1-click extract server info qua Discord public Invite API.
  // Auto-fill name (nếu trống), url, members + icon. Khi habitat ĐÃ tồn tại
  // (edit mode) → auto-commit ngay vào DB (không đợi Save modal) để name/icon
  // habitat update tức thời cho mọi nơi (header, list…). Create mode: chỉ
  // fill form, commit khi Save như cũ.
  const handleExtractDiscord = () => {
    const raw = discordInvite.trim() || form.url || '';
    if (!raw) { setDiscordMsg('⚠ Dán invite link trước (discord.gg/xxx)'); return; }
    setDiscordBusy(true); setDiscordMsg(null);
    startTransition(async () => {
      const res = await extractDiscordInvite(raw);
      if (!res.ok) { setDiscordBusy(false); setDiscordMsg(`⚠ ${res.error}`); return; }
      const info = res.info;
      // 1) Update form state. Name + url: LUÔN dùng Discord (source of truth
      // chính thức, ngay cả khi habitat name cũ là alias VN — user thường
      // muốn name đồng bộ với server thật để tránh nhầm). Rules + format
      // settings vẫn defensive (text content user edit thật).
      const nextName = info.name;
      const nextUrl = info.inviteUrl;
      const nextMembers = info.memberCount ?? form.members ?? 0;
      const nextPlatform = form.platformKey ?? 'discord';
      const nextKind = form.kind && form.kind !== 'subreddit' ? form.kind : 'discord';
      const nextRules = (form.postingRules ?? '').trim()
        ? form.postingRules
        : (info.description ? `# About\n${info.description}\n` : (form.postingRules ?? ''));
      // Language auto-detect: nếu chưa set, đoán từ description text.
      // Heuristic đơn giản: có ký tự VN (à/á/ạ/ã/â/ấ/ầ/ẩ/ẫ/ậ/ă/ằ/ắ/ẳ/ẵ/ặ/è/é/...) → 'vi',
      // có ký tự CJK (Hàn/Nhật/Trung) → tương ứng, còn lại → 'en'.
      let nextLanguage = form.language;
      if (!nextLanguage?.trim() && info.description) {
        const d = info.description;
        if (/[àáạảãâấầẩẫậăằắẳẵặèéẹẻẽêếềểễệìíịỉĩòóọỏõôốồổỗộơớờởỡợùúụủũưứừửữựỳýỵỷỹđ]/i.test(d)) nextLanguage = 'vi';
        else if (/[가-힣]/.test(d)) nextLanguage = 'ko';
        else if (/[ぁ-んァ-ヶ一-龥]/.test(d)) nextLanguage = 'ja';
        else if (/[一-龥]/.test(d)) nextLanguage = 'zh';
        else nextLanguage = 'en';     // default Discord = EN, hiếm khi sai
      } else if (!nextLanguage?.trim()) {
        // No description → vẫn default 'en' cho Discord (98% server EN)
        nextLanguage = 'en';
      }
      setForm((f) => ({
        ...f,
        name: nextName,
        url: nextUrl,
        members: nextMembers,
        platformKey: nextPlatform,
        kind: nextKind,
        language: nextLanguage,
        postingRules: nextRules,
        iconUrl: info.iconUrl,
      } as HabitatInput));
      setDiscordIcon(info.iconUrl);
      // 2) Edit mode: persist NGAY các field core (name/url/members/iconUrl +
      // postingRules nếu vừa lấp từ description) — không đợi Save modal.
      // Tránh mất sync khi user mở extract nhưng quên Save (nay là source of
      // truth Discord API). Note: chỉ persist subset, các field khác (rules
      // manual edit, allowedFormatsOverride…) vẫn cần Save như cũ.
      if (!isCreate && habitat) {
        try {
          await updateHabitat(projectId, habitat.id, {
            name: nextName,
            url: nextUrl,
            members: nextMembers,
            platformKey: nextPlatform,
            kind: nextKind,
            iconUrl: info.iconUrl,
            ...(((form.postingRules ?? '').trim() === '' && info.description)
              ? { postingRules: nextRules } : {}),
            // Auto-set language nếu trước đó trống (lần đầu extract)
            ...((!form.language?.trim() && nextLanguage) ? { language: nextLanguage } : {}),
          });
          // Refresh server data để list ngoài modal cũng sync name/icon ngay.
          // User vẫn ở modal — chỉ đóng khi bấm Save/Cancel.
          router.refresh();
        } catch (e) {
          setDiscordMsg(`⚠ Lấy info OK nhưng auto-save lỗi: ${(e as Error).message}`);
          setDiscordBusy(false);
          return;
        }
      }
      setDiscordBusy(false);
      setDiscordMsg(
        `✓ ${info.name} · ${info.memberCount?.toLocaleString() ?? '?'} members`
        + (info.onlineCount ? ` (${info.onlineCount.toLocaleString()} online)` : '')
        + (info.features.includes('VERIFIED') ? ' · ✓verified' : '')
        + (info.features.includes('COMMUNITY') ? ' · community' : '')
        + (!isCreate ? ' · 💾 saved' : ' · 📝 chưa save (tạo mới)'),
      );
    });
  };

  // Effective allowed format keys = override nếu set, else platform default.
  // Dùng để diff old vs new khi pre-save check.
  const effectiveAllowedSet = (override: string[] | null | undefined, platKey: string | null | undefined): Set<string> => {
    if (Array.isArray(override)) return new Set(override);
    const platRow = platKey ? platforms.find((p) => p.key === platKey) : null;
    return new Set(allowedFormats(platKey ?? undefined, platRow?.category ?? undefined).map((f) => f.key));
  };

  const doSave = (archiveOrphans: boolean, typesToArchive: string[] = []) => {
    setBusy(true); setError(null);
    startTransition(async () => {
      const primary = form.tribeId ?? null;
      const fullSet = [...new Set([
        ...(primary != null ? [primary] : []),
        ...extraTribeIds,
      ])];
      if (isCreate) {
        const res = await createHabitat(projectId, form);
        if (!res.ok) { setBusy(false); setError(res.error ?? 'Save failed'); return; }
        if (res.id != null && (fullSet.length > 0)) {
          await setHabitatTribes(projectId, res.id, fullSet, primary);
        }
        setBusy(false);
        router.refresh();
        if (res.id != null) onCreated?.(res.id);
        onClose();
      } else {
        const res = await updateHabitat(projectId, habitat!.id, form);
        if (!res.ok) { setBusy(false); setError(res.error ?? 'Save failed'); return; }
        await setHabitatTribes(projectId, habitat!.id, fullSet, primary);
        // Sau khi habitat đã save với allowed_formats_override mới: archive
        // cards loại đã bị bỏ (user chọn). Auto-restore (types được tick lại)
        // đã chạy server-side trong updateHabitat — không cần đây.
        if (archiveOrphans && typesToArchive.length > 0) {
          await archiveCardsByTypesForHabitat(projectId, habitat!.id, typesToArchive);
        }
        // Bulk save channels (chỉ khi platform multi-channel). Upsert by name
        // để giữ id ổn định cho cards đã link.
        if (showChannels && channelsLoaded) {
          await bulkReplaceChannels(habitat!.id, channels.filter((c) => c.name.trim()));
        }
        setBusy(false);
        router.refresh();
        onClose();
      }
    });
  };

  const handleSave = () => {
    // Pre-save check: nếu tạo mới → không có data cũ → skip. Nếu edit và
    // allowedFormatsOverride đổi → tính types BỊ BỎ → count cards affected
    // → show confirm nếu > 0.
    if (isCreate || !habitat) { doSave(false); return; }
    const oldSet = effectiveAllowedSet(habitat.allowedFormatsOverride, habitat.platformKey ?? form.platformKey ?? null);
    const newSet = effectiveAllowedSet(form.allowedFormatsOverride, form.platformKey ?? habitat.platformKey ?? null);
    const removedTypes = [...oldSet].filter((t) => !newSet.has(t));
    if (removedTypes.length === 0) { doSave(false); return; }
    // Có format bị bỏ → check xem có cards loại đó không.
    setBusy(true); setError(null);
    startTransition(async () => {
      const counts = await countCardsByContentTypeForHabitat(habitat.id);
      const affected = counts.filter((c) => removedTypes.includes(c.contentType) && c.count > 0);
      setBusy(false);
      if (affected.length === 0) { doSave(false); return; }
      // Có orphan → show dialog xác nhận.
      setConfirmRemoval({ removedTypes, affected });
    });
  };

  const handleDelete = () => {
    if (!habitat) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    setBusy(true);
    startTransition(async () => {
      await deleteHabitat(projectId, habitat.id);
      setBusy(false);
      router.refresh();
      onClose();
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: 'min(1280px, 96vw)', maxWidth: 1280 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="id-line">
              {isCreate ? 'NEW HABITAT' : `Habitat #${habitat!.id} · ${(habitat!.kind || '').toUpperCase()}`}
            </div>
            <h2 style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {!isCreate && habitat && (
                // Ưu tiên icon_url từ DB (Discord guild icon, etc.); fallback
                // sang SiteFavicon (Google favicon) nếu chưa extract. Live
                // update khi user vừa extract — dùng form.iconUrl chứ không
                // phải habitat.iconUrl (chỉ đổi sau Save).
                (form.iconUrl || habitat.iconUrl) ? (
                  <img src={(form.iconUrl ?? habitat.iconUrl)!}
                       alt={habitat.name} width={22} height={22}
                       title={habitat.name}
                       style={{ borderRadius: 4, border: '1px solid var(--line)', objectFit: 'cover' }} />
                ) : (
                  <SiteFavicon url={habitat.url} kind={habitat.kind} size={20}
                               title={habitat.url ?? habitat.name} />
                )
              )}
              <span>{isCreate ? '+ New habitat' : (form.name.trim() || habitat!.name)}</span>
              {!isCreate && habitat?.url && (
                <a href={habitat.url} target="_blank" rel="noopener noreferrer"
                   title={`Mở ${habitat.url}`}
                   style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
                            color: 'var(--accent)', padding: '2px 7px', borderRadius: 4,
                            background: 'var(--accent-soft)', border: '1px solid var(--accent-line)',
                            textDecoration: 'none' }}>↗</a>
              )}
            </h2>
          </div>
          <button className="btn ghost" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Accounts engaging section — đặt LÊN ĐẦU modal-body để user thấy
              ngay (không phải scroll xuống cuối). Hiện khi đã edit (không phải
              create), vì habitat mới tạo chưa có brief nào. */}
          {!isCreate && habitat && (
            <HabitatBriefsSection
              projectId={projectId}
              habitatId={habitat.id}
              habitatName={habitat.name}
              habitatKind={habitat.kind}
              platformKey={habitat.platformKey ?? form.platformKey ?? null}
              onOpenAccount={onOpenAccount}
              onOpenBrief={onOpenBrief}
            />
          )}
          <AIFormParser
            context={[
              'Đây là 1 habitat (community/group concrete) cho marketing project. Đọc URL/text/screenshot/wiki rules → fill mọi field bên dưới.',
              'NAME = tên hiển thị (vd "r/astrology", "Lý Số Việt Nam").',
              'KIND chọn từ enum: subreddit/fb-group/discord/forum/hashtag/slack/telegram/youtube/other.',
              'MEMBERS = số thành viên (integer).',
              'ACTIVITY = mô tả ngắn ("high", "120 posts/d").',
              'LANGUAGE: dominant language (en/vi/zh/ja/multi/...).',
              'COMMUNITYTYPE: discussion/news/q-a/portfolio/sharing/other.',
              'STATUS: target/engaged/saturated/banned/dormant — outreach lifecycle.',
              'MODSTRICTNESS: low/medium/high — đo độ ngặt rules.',
              'POSTINGRULES: full markdown rules (paste sub wiki / about page rules).',
              'POSTINGRULESURL: canonical URL của trang rules (subreddit /about/rules, FB group About, forum announcements).',
              'MINACCOUNTAGEDAYS / MINKARMA / MINPOSTS: integer gates trước khi được post links.',
              'LINKSALLOWEDAFTER: free-form ("after 5 posts", "never", "profile only").',
              'DOMINANTTOPICS: comma-separated từ khóa hot.',
              'FORBIDDENTOPICS: comma-separated topics cấm.',
              'BESTPOSTTIMES: free-form ("8-10am UTC weekdays").',
            ].join(' ')}
            schema={[
              { key: 'name',     label: 'Name',     type: 'string' },
              { key: 'kind',     label: 'Kind',     type: 'enum', enumValues: [...KINDS] },
              { key: 'url',      label: 'URL',      type: 'string' },
              { key: 'members',  label: 'Members',  type: 'number' },
              { key: 'activity', label: 'Activity', type: 'string' },
              { key: 'language',          label: 'Language',           type: 'enum', enumValues: [...LANGUAGES] as string[] },
              { key: 'communityType',     label: 'Community type',     type: 'enum', enumValues: [...COMMUNITY_TYPES] as string[] },
              { key: 'status',            label: 'Outreach status',    type: 'enum', enumValues: [...STATUS_OPTS] as string[] },
              { key: 'modStrictness',     label: 'Mod strictness',     type: 'enum', enumValues: [...STRICTNESS] as string[] },
              { key: 'postingRules',      label: 'Posting rules (md)', type: 'string', description: 'Full markdown — paste community rules / wiki' },
              { key: 'postingRulesUrl',   label: 'Posting rules URL',  type: 'string', description: 'Canonical link tới trang rules (auto-detect từ URL habitat: e.g. https://reddit.com/r/X/about/rules)' },
              { key: 'minAccountAgeDays', label: 'Min account age (days)', type: 'number' },
              { key: 'minKarma',          label: 'Min karma',          type: 'number' },
              { key: 'minPosts',          label: 'Min prior posts',    type: 'number' },
              { key: 'linksAllowedAfter', label: 'Links allowed after',type: 'string', description: 'e.g. "5 posts", "never", "profile only"' },
              { key: 'dominantTopics',    label: 'Dominant topics (comma-separated)', type: 'string' },
              { key: 'forbiddenTopics',   label: 'Forbidden topics (comma-separated)', type: 'string' },
              { key: 'bestPostTimes',     label: 'Best post times',    type: 'string', description: 'e.g. "8-10am UTC weekdays"' },
            ]}
            currentValues={{
              name: form.name, kind: form.kind ?? '', url: form.url ?? '', members: form.members ?? 0, activity: form.activity ?? '',
              language: form.language ?? '', communityType: form.communityType ?? '', status: form.status ?? '',
              modStrictness: form.modStrictness ?? '', postingRules: form.postingRules ?? '',
              postingRulesUrl: form.postingRulesUrl ?? '',
              minAccountAgeDays: form.minAccountAgeDays ?? 0, minKarma: form.minKarma ?? 0, minPosts: form.minPosts ?? 0,
              linksAllowedAfter: form.linksAllowedAfter ?? '',
              dominantTopics: (form.dominantTopics ?? []).join(', '),
              forbiddenTopics: (form.forbiddenTopics ?? []).join(', '),
              bestPostTimes: form.bestPostTimes ?? '',
            }}
            onApply={(v) => {
              if (v.name != null)              setF('name', String(v.name));
              if (v.kind != null)              setF('kind', String(v.kind));
              if (v.url != null)               setF('url', String(v.url));
              if (v.members != null)           setF('members', Number(v.members));
              if (v.activity != null)          setF('activity', String(v.activity));
              if (v.language != null)          setF('language', String(v.language));
              if (v.communityType != null)     setF('communityType', String(v.communityType));
              if (v.status != null)            setF('status', String(v.status) as HabitatInput['status']);
              if (v.modStrictness != null)     setF('modStrictness', String(v.modStrictness) as HabitatInput['modStrictness']);
              if (v.postingRules != null)      setF('postingRules', String(v.postingRules));
              if (v.postingRulesUrl != null)   setF('postingRulesUrl', String(v.postingRulesUrl));
              if (v.minAccountAgeDays != null) setF('minAccountAgeDays', Number(v.minAccountAgeDays));
              if (v.minKarma != null)          setF('minKarma', Number(v.minKarma));
              if (v.minPosts != null)          setF('minPosts', Number(v.minPosts));
              if (v.linksAllowedAfter != null) setF('linksAllowedAfter', String(v.linksAllowedAfter));
              if (v.dominantTopics != null)    setF('dominantTopics', String(v.dominantTopics).split(',').map((s) => s.trim()).filter(Boolean));
              if (v.forbiddenTopics != null)   setF('forbiddenTopics', String(v.forbiddenTopics).split(',').map((s) => s.trim()).filter(Boolean));
              if (v.bestPostTimes != null)     setF('bestPostTimes', String(v.bestPostTimes));
            }}
          />

          {/* ── 3-column body ── col1: identity | col2: outreach gates | col3: voice + rules + topics + channels ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <div title="Nhận diện community + link platform + tribes mà habitat thuộc về"
               style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px dashed var(--line)', paddingBottom: 4, cursor: 'help' }}>
            🪪 Nhận diện
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
            <div>
              <label style={lbl}>Name *</label>
              <input type="text" value={form.name} onChange={(e) => setF('name', e.target.value)}
                     style={fld} placeholder="r/astrology" autoFocus />
            </div>
            <div>
              <label style={lbl}>Kind</label>
              <select value={form.kind} onChange={(e) => setF('kind', e.target.value)} style={fld}>
                {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={lbl}>
              <span>URL</span>
              {form.url && (() => {
                // Internal tool → wrap qua href.li để khỏi leak referrer
                // (xem feedback_href_li_wrap memory). Click label → mở community.
                const safe = `https://href.li/?${form.url}`;
                return (
                  <a href={safe} target="_blank" rel="noopener noreferrer"
                     onClick={(e) => e.stopPropagation()}
                     title={`Mở community trong tab mới: ${form.url}`}
                     style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent)',
                              fontFamily: 'var(--font-mono)', textDecoration: 'none',
                              padding: '0 5px', borderRadius: 3,
                              background: 'var(--accent-soft)',
                              border: '1px solid var(--accent-line)' }}>↗ mở</a>
                );
              })()}
            </label>
            <input type="url" value={form.url ?? ''}
                   onChange={(e) => {
                     const v = e.target.value;
                     setF('url', v);
                     // Auto-suggest platform from URL hostname when user pastes/types,
                     // but ONLY if user hasn't manually set one yet.
                     if (!form.platformKey) {
                       const detected = detectPlatformKeyFromUrl(v);
                       if (detected && tribes.length >= 0) {  // tribes is just an existence check
                         // Only set if MOS2 has that platform; UI checks via PlatformPicker
                         setF('platformKey', detected);
                       }
                     }
                   }}
                   style={fld} placeholder="https://reddit.com/r/astrology" />
          </div>

          {/* Discord invite extractor — chỉ hiện khi platform=discord hoặc URL chứa discord.
              1-click qua public Invite API: fill name + url + members + icon preview. */}
          {(() => {
            const isDiscord = form.platformKey === 'discord' || form.kind === 'discord'
              || /discord\.(gg|com)/i.test(form.url ?? '');
            if (!isDiscord) return null;
            return (
              <div style={{
                padding: '8px 10px',
                background: 'rgba(88,101,242,0.06)',                   // Discord blurple tint
                border: '1px solid rgba(88,101,242,0.35)',
                borderRadius: 6,
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#7289da' }}>
                  <span>🎮</span> Discord — tự điền
                  <span style={{ fontWeight: 400, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                    dán invite → điền tên + members + icon
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {discordIcon && (
                    <img src={discordIcon} alt="server icon" width={36} height={36}
                         style={{ borderRadius: 6, border: '1px solid var(--line)', flexShrink: 0 }} />
                  )}
                  <input type="text" value={discordInvite}
                         onChange={(e) => setDiscordInvite(e.target.value)}
                         onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleExtractDiscord(); } }}
                         placeholder="discord.gg/xxxxx  hoặc  https://discord.com/invite/xxxxx"
                         style={{ ...fld, flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                         autoComplete="off" data-1p-ignore data-lpignore="true" />
                  <button type="button"
                          onClick={handleExtractDiscord}
                          disabled={discordBusy}
                          title="Gọi Discord public Invite API → trả name/members/icon/description. Không cần bot, không cần OAuth."
                          style={{
                            flexShrink: 0, padding: '6px 12px', fontSize: 11, fontWeight: 700,
                            background: '#5865F2', color: '#fff',
                            border: 'none', borderRadius: 5,
                            cursor: discordBusy ? 'wait' : 'pointer',
                            opacity: discordBusy ? 0.6 : 1,
                            whiteSpace: 'nowrap',
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                          }}>
                    {discordBusy ? <><Spinner size="xs" /> Đang lấy…</> : '🔍 Lấy info'}
                  </button>
                </div>
                {discordMsg && (
                  <div style={{
                    fontSize: 10.5, fontFamily: 'var(--font-mono)',
                    color: discordMsg.startsWith('✓') ? 'var(--ok)' : 'var(--bad)',
                  }}>{discordMsg}</div>
                )}
              </div>
            );
          })()}

          {/* Platform link — auto-suggested from kind, but admin can override.
              Required cho kinds platform-agnostic (forum/hashtag/other) để
              "+ Add account" từ habitat drawer biết auto-lock platform nào. */}
          {(() => {
            const autoFromKind = platformKeysForHabitatKind(form.kind ?? '')?.[0] ?? null;
            const needsExplicit = autoFromKind == null;
            const effective = form.platformKey || autoFromKind;
            return (
              <div>
                <label style={lbl}>
                  <span title={'Platform mà habitat này thuộc về. Cần chọn để "+ Add account" auto-lock vào platform này (account mới tạo sẽ tự gắn). Auto-detect từ URL nếu để trống.'}
                        style={{ cursor: 'help' }}>Platform</span>
                  {needsExplicit && <span title='Cần chọn để "+ Add account" auto-lock platform'
                                          style={{ color: 'var(--warn)', textTransform: 'none', marginLeft: 4 }}>⚠ nên chọn</span>}
                  {!needsExplicit && <span style={{ color: 'var(--fg-4)', textTransform: 'none' }}>// auto từ kind, có thể override</span>}
                </label>
                <PlatformPicker platforms={platforms} value={effective ?? ''}
                                onChange={(k) => {
                                  const newKey = k || null;
                                  setF('platformKey', newKey);
                                  // Auto-sync kind: nếu kind hiện tại KHÔNG hợp lệ với platform
                                  // mới (vd platform=discord nhưng kind=subreddit) → reset về preset
                                  // của platform. Tránh data lệch (Discord platform với subreddit kind).
                                  if (newKey && !isKindPlatformCompatible(form.kind ?? '', newKey)) {
                                    const presetKind = defaultKindForPlatformKey(newKey);
                                    if (presetKind) setF('kind', presetKind);
                                  }
                                }} fld={fld} />
                {!form.platformKey && autoFromKind && (
                  <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 3 }}>
                    Default: <code>{autoFromKind}</code> (suy từ kind <code>{form.kind}</code>). Pick khác để override.
                  </div>
                )}
                {/* Cảnh báo mismatch: platform đã set nhưng kind hiện tại không
                    hợp lệ với platform (data cũ bị lệch). Nút "Sửa kind" auto. */}
                {form.platformKey && !isKindPlatformCompatible(form.kind ?? '', form.platformKey) && (() => {
                  const presetKind = defaultKindForPlatformKey(form.platformKey);
                  if (!presetKind) return null;
                  return (
                    <div style={{ marginTop: 5, padding: '5px 8px',
                                  background: 'rgba(248,113,113,.08)',
                                  border: '1px solid rgba(248,113,113,.4)',
                                  borderRadius: 4, fontSize: 11, color: 'var(--bad)',
                                  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span>⛔ Kind <code>{form.kind}</code> không khớp platform <code>{form.platformKey}</code> — preset đúng là <code>{presetKind}</code>.</span>
                      <button type="button"
                              onClick={(e) => { e.stopPropagation(); setF('kind', presetKind); }}
                              style={{ fontSize: 10.5, padding: '2px 9px', fontWeight: 700,
                                       background: 'var(--bad)', color: '#fff',
                                       border: 'none', borderRadius: 3, cursor: 'pointer',
                                       fontFamily: 'var(--font-mono)' }}>
                        ✎ Sửa kind → {presetKind}
                      </button>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          <div>
            <label style={lbl}>
              <span title="Engine / CMS / framework của site (WordPress, Discourse, vBulletin, XenForo, phpBB, Shopify, Webflow, custom…). Chỉ cần điền nếu khác mặc định của platform — để scraper biết cách parse rules + post."
                    style={{ cursor: 'help' }}>Engine</span>
            </label>
            <TechnologyPicker
              technologies={technologies}
              value={form.technologyKey ?? null}
              onChange={(k) => setF('technologyKey', k)}
              fld={fld}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <label style={lbl}>Members</label>
              <input type="number" min={0} value={form.members ?? 0} onChange={(e) => setF('members', Number(e.target.value))}
                     style={{ ...fld, fontFamily: 'var(--font-mono)' }} />
            </div>
            <div>
              <label style={lbl}>Activity</label>
              <input type="text" value={form.activity ?? ''} onChange={(e) => setF('activity', e.target.value)}
                     style={fld} placeholder="high · 120 posts/d" />
            </div>
            <div>
              <label style={lbl}>Health</label>
              <select value={form.health} onChange={(e) => setF('health', e.target.value as HabitatInput['health'])} style={fld}>
                {HEALTH.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={lbl}>Tribe chính <span style={{ color: 'var(--fg-4)', textTransform: 'none' }}>// primary</span></label>
              <select value={form.tribeId ?? ''}
                      onChange={(e) => {
                        const v = e.target.value ? Number(e.target.value) : null;
                        setF('tribeId', v);
                        if (v != null) setExtraTribeIds((prev) => prev.filter((x) => x !== v));
                      }} style={fld}>
                <option value="">(no tribe)</option>
                {tribes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Scrape frequency</label>
              <select value={form.scrapeFrequency} onChange={(e) => setF('scrapeFrequency', e.target.value as HabitatInput['scrapeFrequency'])} style={fld}>
                {SCRAPE.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={lbl}
                   title="1 community có thể thuộc nhiều tribe (audience identity). Tribe chính ở trên = primary; thêm tribe phụ ở đây nếu chéo nhiều nhóm.">
              <span style={{ cursor: 'help' }}>Tribe phụ</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {tribes.filter((t) => t.lifecycle !== 'defunct' && t.id !== form.tribeId).length === 0 && (
                <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>(không có tribe phụ khả dụng)</span>
              )}
              {tribes.filter((t) => t.lifecycle !== 'defunct' && t.id !== form.tribeId).map((t) => {
                const on = extraTribeIds.includes(t.id);
                return (
                  <span key={t.id} onClick={() => toggleExtra(t.id)}
                        style={{ padding: '2px 7px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                                 border: `1px solid ${on ? 'var(--accent-line)' : 'var(--line)'}`,
                                 background: on ? 'var(--accent-soft)' : 'transparent',
                                 color: on ? 'var(--accent)' : 'var(--fg-3)' }}>
                    {on ? '✓ ' : '+ '}{t.name}
                  </span>
                );
              })}
            </div>
          </div>
          </div>{/* /left column */}

          {/* ── RIGHT: Outreach meta — feeds AI brief generator + persona-fit hints ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <div title="AI brief generator đọc các field này để sinh chiến lược tiếp cận (approach / narrative / phase plan / hooks). Điền càng đầy → brief càng chuẩn."
                 style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px dashed var(--accent-line)', paddingBottom: 4, cursor: 'help' }}>
              🎯 Outreach meta
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={lbl}>Language</label>
                <select value={form.language ?? ''} onChange={(e) => setF('language', e.target.value)} style={fld}>
                  {LANGUAGES.map((l) => <option key={l} value={l}>{l || '—'}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Type</label>
                <select value={form.communityType ?? ''} onChange={(e) => setF('communityType', e.target.value)} style={fld}>
                  {COMMUNITY_TYPES.map((c) => <option key={c} value={c}>{c || '—'}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Status</label>
                <select value={form.status} onChange={(e) => setF('status', e.target.value as HabitatInput['status'])} style={fld}>
                  {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Mod strictness</label>
                <select value={form.modStrictness ?? ''} onChange={(e) => setF('modStrictness', e.target.value as HabitatInput['modStrictness'])} style={fld}>
                  {STRICTNESS.map((s) => <option key={s} value={s}>{s || '—'}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div>
                <label style={lbl}>Min age (days)</label>
                <input type="number" min={0} value={form.minAccountAgeDays ?? 0} onChange={(e) => setF('minAccountAgeDays', Number(e.target.value))}
                       style={{ ...fld, fontFamily: 'var(--font-mono)' }} />
              </div>
              <div>
                <label style={lbl}>Min karma</label>
                <input type="number" min={0} value={form.minKarma ?? 0} onChange={(e) => setF('minKarma', Number(e.target.value))}
                       style={{ ...fld, fontFamily: 'var(--font-mono)' }} />
              </div>
              <div>
                <label style={lbl}>Min posts</label>
                <input type="number" min={0} value={form.minPosts ?? 0} onChange={(e) => setF('minPosts', Number(e.target.value))}
                       style={{ ...fld, fontFamily: 'var(--font-mono)' }} />
              </div>
            </div>

            <div>
              <label style={lbl}>Links allowed after</label>
              <input type="text" value={form.linksAllowedAfter ?? ''} onChange={(e) => setF('linksAllowedAfter', e.target.value)}
                     style={fld} placeholder='"5 posts" / "never" / "profile only"' />
            </div>

            <div>
              <label style={lbl}>Best post times <span style={{ color: 'var(--fg-4)', textTransform: 'none' }}>// e.g. "8-10am UTC weekdays"</span></label>
              <input type="text" value={form.bestPostTimes ?? ''} onChange={(e) => setF('bestPostTimes', e.target.value)}
                     style={fld} placeholder="" />
            </div>

            {/* Loại bài community này hỗ trợ — override platform default.
                Null/empty checkboxes = kế thừa platform. Bỏ tick 1 loại = community
                CẤM (vd r/AskReddit bỏ 'link' dù Reddit support). Tick ngoài
                default = community CHO PHÉP thêm (rare). */}
            {(() => {
              const platKey = form.platformKey || (form.kind ? platformKeysForHabitatKind(form.kind)?.[0] : null);
              const platRow = platKey ? platforms.find((p) => p.key === platKey) : null;
              const platCat = platRow?.category ?? null;
              const platformDefault = new Set(allowedFormats(platKey, platCat).map((f) => f.key));
              const override = form.allowedFormatsOverride;
              const isOverridden = override != null && Array.isArray(override);
              const selected = new Set(isOverridden ? override : Array.from(platformDefault));
              const toggle = (k: string) => {
                const next = new Set(selected);
                if (next.has(k)) next.delete(k); else next.add(k);
                // Nếu kết quả khớp y hệt platform default → clear override (null).
                const arr = Array.from(next);
                const sameAsDefault = arr.length === platformDefault.size && arr.every((x) => platformDefault.has(x));
                setF('allowedFormatsOverride', sameAsDefault ? null : arr);
              };
              const resetToDefault = () => setF('allowedFormatsOverride', null);
              return (
                <div>
                  <label style={lbl}
                         title={`Pick loại bài community này HỖ TRỢ. Khi tạo bài mới hoặc đổi loại, picker chỉ liệt kê các loại tick ở đây. Tick = cho phép, bỏ tick = cấm. Mặc định = kế thừa platform${platKey ? ` (${platKey})` : ''}.`}>
                    <span style={{ cursor: 'help' }}>Loại bài hỗ trợ</span>
                    {isOverridden && (
                      <button type="button" onClick={resetToDefault}
                              title="Bỏ override, kế thừa platform default"
                              style={{ marginLeft: 8, fontSize: 9.5, padding: '1px 6px', background: 'transparent',
                                       color: 'var(--fg-3)', border: '1px solid var(--line)', borderRadius: 3,
                                       cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                        reset
                      </button>
                    )}
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(108px, 1fr))', gap: 6 }}>
                    {CONTENT_FORMATS.map((f) => {
                      const on = selected.has(f.key);
                      const inheritedFromPlatform = platformDefault.has(f.key);
                      const col = formatColors(f.key);
                      return (
                        <label key={f.key} title={`${f.label} — ${f.hint}${inheritedFromPlatform ? '\n(platform default: có)' : '\n(platform default: không — tick để community thêm exception)'}`}
                               style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
                                        padding: '4px 7px', borderRadius: 5, cursor: 'pointer',
                                        background: on ? col.bg : 'var(--bg-2)',
                                        border: `1px solid ${on ? col.border : 'var(--line)'}`,
                                        color: on ? col.fg : (inheritedFromPlatform ? 'var(--fg-2)' : 'var(--fg-4)'),
                                        opacity: on ? 1 : (inheritedFromPlatform ? 0.7 : 0.45) }}>
                          <input type="checkbox" checked={on} onChange={() => toggle(f.key)}
                                 style={{ accentColor: col.fg, cursor: 'pointer' }} />
                          <FormatIcon kind={f.key} size={12} />
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
                    {isOverridden
                      ? `Override: ${(override ?? []).length}/${CONTENT_FORMATS.length} loại (community-specific)`
                      : `Kế thừa platform default: ${platformDefault.size}/${CONTENT_FORMATS.length} loại`}
                  </div>
                </div>
              );
            })()}

          </div>{/* /col2 — outreach gates + formats */}

          {/* ── COL 3: Voice + Rules + Channels + Topics ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <div title="Voice profile + posting rules + channels + topics — section nội dung. Click ▾ để mở rộng phần dùng nhiều."
                 style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px dashed var(--accent-line)', paddingBottom: 4, cursor: 'help' }}>
              🎙 Voice · Rules · Channels
            </div>
            {/* Voice & few-shot — điều khiển độ "bựa" của AI gen. Đây là
                section quan trọng nhất cho chất lượng bài: voice_profile
                preset + voice_notes free-text + few-shot example posts. */}
            <VoiceSection
              voiceProfile={form.voiceProfile ?? 'regular'}
              voiceNotes={form.voiceNotes ?? ''}
              fewShotExamples={form.fewShotExamples ?? null}
              visualStyleDescriptor={form.visualStyleDescriptor ?? null}
              habitatIconUrl={form.iconUrl ?? habitat?.iconUrl ?? null}
              habitatId={habitat?.id ?? null}
              onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
              fld={fld}
              lbl={lbl}
            />

            {/* Channels — chỉ hiện cho Discord/Slack/Telegram (multi-channel
                platform). Mỗi channel có rule + format limits riêng → card
                khi tạo phải chọn channel để áp đúng. */}
            {showChannels && (
              <div>
                <label style={lbl}
                       title="Sub-channel trong server. Mỗi channel có rule riêng (off-topic / promo / showcase / Q&A...). Khi tạo bài, picker channel xuất hiện để áp đúng rules. Bỏ trống = bài đăng habitat-level (rule chung).">
                  <span style={{ cursor: 'help' }}>📺 Channels</span>
                  <span style={{ color: 'var(--fg-4)', textTransform: 'none', fontWeight: 400, marginLeft: 4 }}>
                    {channels.length > 0 ? `(${channels.length})` : '(chưa có — bài sẽ áp rule chung)'}
                  </span>
                </label>
                {!channelsLoaded ? (
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', padding: 6 }}>
                    <Spinner size="xs" /> Đang tải channels…
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {/* Bulk parser: paste screenshot Discord sidebar / text dump
                        → AI sinh array channels và APPEND vào list (giữ items
                        có sẵn). Dedupe by name (case-insensitive). */}
                    <ChannelBulkParser
                      platformKey={form.platformKey ?? 'discord'}
                      onApply={(parsed) => {
                        setChannels((prev) => {
                          const existing = new Map(prev.map((c) => [c.name.trim().toLowerCase(), c]));
                          for (const p of parsed) {
                            const k = p.name.toLowerCase();
                            const existed = existing.get(k);
                            if (existed) {
                              // Merge: chỉ điền field trống của existing.
                              // postingGates: nếu chưa có thì lấy từ parser
                              // (auto-skip rules/bot/announce channels).
                              existing.set(k, {
                                ...existed,
                                url: existed.url || p.url,
                                description: existed.description || p.description,
                                rules: existed.rules || p.rules,
                                allowedFormats: existed.allowedFormats ?? p.allowedFormats,
                                postingGates: existed.postingGates ?? p.postingGates,
                              });
                            } else {
                              existing.set(k, p);
                            }
                          }
                          return Array.from(existing.values());
                        });
                      }}
                    />
                    {(() => {
                      // Habitat-level allowed formats — pass xuống row để render
                      // chip + decide what's available trong picker khi expand.
                      const habitatAllowed = new Set(allowedFormats(
                        form.platformKey, platforms.find((p) => p.key === form.platformKey)?.category,
                        undefined, form.allowedFormatsOverride ?? null,
                      ).map((f) => f.key));
                      return channels.map((ch, i) => (
                        <ChannelRow
                          key={`${i}-${ch.name}`}
                          ch={ch}
                          habitatAllowed={habitatAllowed}
                          onChange={(patch) => setChannels((arr) => arr.map((x, j) => j === i ? { ...x, ...patch } : x))}
                          onRemove={() => setChannels((arr) => arr.filter((_, j) => j !== i))}
                          fld={fld}
                        />
                      ));
                    })()}
                    <button type="button"
                            onClick={() => setChannels((arr) => [...arr, { name: '', url: null, description: '', rules: '' }])}
                            style={{ fontSize: 11, padding: '5px 10px', background: 'var(--bg-2)',
                                     color: 'var(--accent)', border: '1px dashed var(--accent-line)',
                                     borderRadius: 5, cursor: 'pointer' }}>
                      + Thêm channel
                    </button>
                  </div>
                )}
              </div>
            )}

            <div>
              <label style={lbl}>
                <span title="URL chính thức của trang rules (vd reddit.com/r/X/about/rules). Bấm Fetch để AI parse rules + meta gates tự động."
                      style={{ cursor: 'help' }}>Rules URL</span>
                {form.postingRulesUrl && (
                  <a href={form.postingRulesUrl} target="_blank" rel="noopener noreferrer"
                     style={{ marginLeft: 6, color: 'var(--accent)', textDecoration: 'none', fontSize: 10 }}
                     title="Open rules page in new tab">↗ open</a>
                )}
                {rulesFetchMsg && (
                  <span style={{
                    marginLeft: 8, fontSize: 10, fontWeight: 500,
                    color: rulesFetchMsg.startsWith('✓') ? 'var(--ok)' : 'var(--bad)',
                    textTransform: 'none',
                  }}>{rulesFetchMsg}</span>
                )}
              </label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 9.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>MODE:</span>
                <div style={{ display: 'inline-flex', gap: 0, padding: 1, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 4 }}>
                  {(['replace', 'append'] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setMergeMode(m)}
                            title={m === 'replace'
                              ? 'Replace: source mới ghi đè rules đang có'
                              : 'Append: AI merge source mới vào rules đang có (dedupe trùng) — dùng cho site nhiều rules pages'}
                            style={{
                              padding: '2px 8px', fontSize: 9.5, fontWeight: 700, fontFamily: 'var(--font-mono)',
                              background: mergeMode === m ? 'var(--accent)' : 'transparent',
                              color: mergeMode === m ? '#0d1117' : 'var(--fg-2)',
                              border: 'none', borderRadius: 3, cursor: 'pointer',
                            }}>
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
                {mergeMode === 'append' && (form.postingRules ?? '').trim() && (
                  <span style={{ fontSize: 9.5, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                    + merge vào rules hiện tại
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="url" value={form.postingRulesUrl ?? ''}
                       onChange={(e) => setF('postingRulesUrl', e.target.value)}
                       style={{ ...fld, flex: 1 }}
                       placeholder="https://reddit.com/r/astrology/about/rules  /  https://lyso.vn/forum.html?board=rules" />
                <button type="button"
                        onClick={handleFindRulesUrl}
                        disabled={findUrlBusy || rulesFetchBusy}
                        title="AI tự tìm URL trang rules dựa vào URL community + loại platform. Reddit = instant, forum khác = gọi AI."
                        style={{
                          flexShrink: 0, padding: '6px 10px', fontSize: 11, fontWeight: 600,
                          background: 'var(--bg-2)', color: 'var(--fg-1)',
                          border: '1px solid var(--line)', borderRadius: 5,
                          cursor: findUrlBusy || rulesFetchBusy ? 'not-allowed' : 'pointer',
                          opacity: findUrlBusy || rulesFetchBusy ? 0.6 : 1,
                          whiteSpace: 'nowrap',
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                        }}>
                  {findUrlBusy ? <><Spinner size="xs" /> Finding</> : '🔍 Find'}
                </button>
                <button type="button"
                        onClick={handleFetchRulesFromUrl}
                        disabled={rulesFetchBusy || !form.postingRulesUrl?.trim()}
                        title={mergeMode === 'append'
                          ? 'Fetch URL → AI MERGE vào rules hiện tại (dedupe). Dùng cho site nhiều rules pages: change URL → fetch → change → fetch tiếp.'
                          : 'Fetch URL → strip HTML → AI rút rules + posting gates + topics → fill các field bên dưới (không overwrite các field đã edit)'}
                        style={{
                          flexShrink: 0, padding: '6px 10px', fontSize: 11, fontWeight: 600,
                          background: 'var(--accent)', color: '#0d1117',
                          border: '1px solid var(--accent)', borderRadius: 5,
                          cursor: rulesFetchBusy || !form.postingRulesUrl?.trim() ? 'not-allowed' : 'pointer',
                          opacity: rulesFetchBusy || !form.postingRulesUrl?.trim() ? 0.6 : 1,
                          whiteSpace: 'nowrap',
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                        }}>
                  {rulesFetchBusy && !pasteOpen ? <><Spinner size="xs" /> Fetching</> : '↻ Fetch'}
                </button>
                <button type="button"
                        onClick={() => setPasteOpen((o) => !o)}
                        title="Fallback nếu fetch URL không được (CORS / login wall / cloudflare). Paste raw rules text/HTML → AI parse cùng schema."
                        style={{
                          flexShrink: 0, padding: '6px 10px', fontSize: 11, fontWeight: 600,
                          background: pasteOpen ? 'var(--accent-soft)' : 'var(--bg-2)',
                          color: pasteOpen ? 'var(--accent)' : 'var(--fg-1)',
                          border: '1px solid ' + (pasteOpen ? 'var(--accent-line)' : 'var(--line)'),
                          borderRadius: 5, cursor: 'pointer', whiteSpace: 'nowrap',
                        }}>
                  📋 Paste raw {pasteOpen ? '▾' : '▸'}
                </button>
              </div>
              {pasteOpen && (
                <div style={{ marginTop: 6, padding: 8, background: 'var(--bg-2)', border: '1px dashed var(--line)', borderRadius: 5 }}>
                  <div style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                    Paste raw rules text hoặc HTML (vd: copy từ subreddit /about/rules, FB group rules tab, forum announcements) → AI parse same schema.
                  </div>
                  <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={6}
                            placeholder={'Paste raw text or HTML here...\n\nVD:\nRule 1: No self-promotion in titles\nRule 2: Account must be 30+ days old\nRule 3: Min 10 karma to post links'}
                            style={{ ...fld, fontFamily: 'var(--font-mono)', fontSize: 11, resize: 'vertical' }} />
                  <div style={{ marginTop: 6, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => { setPasteOpen(false); setPasteText(''); }}
                            style={{ fontSize: 10, padding: '4px 10px', background: 'transparent', color: 'var(--fg-3)', border: '1px solid var(--line)', borderRadius: 4, cursor: 'pointer' }}>
                      Cancel
                    </button>
                    <button type="button"
                            onClick={handleParsePastedRules}
                            disabled={rulesFetchBusy || !pasteText.trim()}
                            style={{
                              fontSize: 10, padding: '4px 12px', fontWeight: 600,
                              background: 'var(--accent)', color: '#0d1117',
                              border: '1px solid var(--accent)', borderRadius: 4,
                              cursor: rulesFetchBusy || !pasteText.trim() ? 'not-allowed' : 'pointer',
                              opacity: rulesFetchBusy || !pasteText.trim() ? 0.6 : 1,
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}>
                      {rulesFetchBusy ? <><Spinner size="xs" /> Parsing</> : '✨ Parse paste'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label style={lbl}
                     title="Nội dung rules dạng markdown bullets. Paste từ URL trên (Find/Fetch sẽ auto-fill) hoặc nhập tay. AI brief đọc field này để biết bài bị remove khi nào.">
                <span style={{ cursor: 'help' }}>Rules nội dung</span>
              </label>
              <textarea value={form.postingRules ?? ''} onChange={(e) => setF('postingRules', e.target.value)} rows={4}
                        style={{ ...fld, fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' }}
                        placeholder="- Rule 1: no self-promotion in titles&#10;- Rule 2: AMA only on Fridays" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={lbl}>✅ Dominant topics <span style={{ color: 'var(--fg-4)', textTransform: 'none' }}>// hot topics get traction</span></label>
                <TagsInput value={form.dominantTopics ?? []} onChange={(v) => setF('dominantTopics', v)} placeholder="natal chart, transit…" />
              </div>
              <div>
                <label style={lbl}>🚫 Forbidden topics <span style={{ color: 'var(--fg-4)', textTransform: 'none' }}>// never write about</span></label>
                <TagsInput value={form.forbiddenTopics ?? []} onChange={(v) => setF('forbiddenTopics', v)} placeholder="prediction guarantee, fake guru…" />
              </div>
            </div>
          </div>{/* /col3 — voice + rules + channels + topics */}
          </div>{/* /3-col wrapper */}

          {error && (
            <div style={{ padding: 8, background: 'rgba(255,77,94,.1)', border: '1px solid rgba(255,77,94,.4)', color: 'var(--bad)', fontSize: 12, borderRadius: 5 }}>
              {error}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <div className="meta" />
          <div className="modal-foot-actions">
            {!isCreate && (
              <button className="btn danger" onClick={handleDelete} disabled={busy}
                      title={confirmDelete ? 'Click lần nữa để xác nhận xoá' : 'Xoá habitat (briefs liên quan sẽ bị xoá)'}
                      style={confirmDelete ? { animation: 'pulseDanger 1s ease-in-out infinite' } : undefined}>
                {confirmDelete ? '⚠ Click again to confirm' : '🗑 Delete'}
              </button>
            )}
            <button className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn primary" onClick={handleSave} disabled={busy || !form.name.trim()}>
              {busy ? <><Spinner size="xs" /> Saving</> : (isCreate ? 'Create habitat' : 'Save')}
            </button>
          </div>
        </div>
      </div>
      {/* Confirm dialog khi bỏ format mà còn cards orphan */}
      {confirmRemoval && (
        <div className="modal-backdrop" onClick={() => !busy && setConfirmRemoval(null)}>
          <div className="modal" style={{ width: 'min(560px, 96vw)' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div style={{ flex: 1 }}>
                <div className="id-line">FORMAT REMOVAL · CARDS AFFECTED</div>
                <h2 style={{ fontSize: 15, marginTop: 4 }}>
                  ⚠ Bỏ {confirmRemoval.removedTypes.length} loại bài, còn{' '}
                  {confirmRemoval.affected.reduce((s, a) => s + a.count, 0)} bài đang dùng
                </h2>
              </div>
              <button type="button" className="btn ghost" onClick={() => !busy && setConfirmRemoval(null)} disabled={busy}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 12, color: 'var(--fg-2)', margin: 0 }}>
                Habitat <strong>{habitat?.name}</strong> sẽ không còn hỗ trợ các loại bài sau,
                nhưng vẫn có cards loại đó:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {confirmRemoval.affected.map((a) => {
                  const meta = formatMeta(a.contentType);
                  const col = formatColors(a.contentType);
                  return (
                    <div key={a.contentType}
                         style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                                  background: col.bg, border: `1px solid ${col.border}`, borderRadius: 5 }}>
                      <FormatIcon kind={a.contentType} size={14} />
                      <span style={{ flex: 1, color: col.fg, fontWeight: 700 }}>{meta.label}</span>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-1)' }}>
                        {a.count} bài
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ padding: 8, fontSize: 11, color: 'var(--fg-3)', background: 'var(--bg-2)',
                            borderRadius: 5, border: '1px dashed var(--line)' }}>
                💡 <strong>Lưu trữ</strong> = ẩn cards khỏi list/count nhưng giữ data. Khi bật lại format ↔ tự khôi phục.
                <br />
                💡 <strong>Giữ orphan</strong> = cards vẫn hiện (badge cảnh báo) — xử lý thủ công sau.
              </div>
            </div>
            <div className="modal-foot" style={{ display: 'flex', gap: 8, padding: 14, justifyContent: 'flex-end' }}>
              <button className="btn ghost" disabled={busy} onClick={() => setConfirmRemoval(null)}>
                Huỷ (không Save)
              </button>
              <button className="btn" disabled={busy}
                      onClick={() => { const c = confirmRemoval; setConfirmRemoval(null); if (c) doSave(false); }}
                      title="Save habitat. Cards loại bị bỏ vẫn hiển thị bình thường (có thể xử lý sau).">
                Giữ orphan
              </button>
              <button className="btn primary" disabled={busy}
                      onClick={() => { const c = confirmRemoval; setConfirmRemoval(null); if (c) doSave(true, c.removedTypes); }}
                      title={`Lưu trữ ${confirmRemoval.affected.reduce((s, a) => s + a.count, 0)} bài. Khi tick lại loại đó → tự khôi phục.`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                {busy ? <><Spinner size="xs" /> Lưu trữ + Save</> : '🗃 Lưu trữ + Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Voice + few-shot section. Voice profile preset (6 enum) điều khiển độ
// "bựa" của AI gen: shitposter (memes), edgelord (sarcastic), expert
// (data-heavy)... Few-shot examples là calibration anchor cho LLM bắt
// chước tone tốt hơn rules dạng prose. Visual style descriptor (AI-inferred
// 1x từ habitat icon) inject vào image gen để ảnh fit theme habitat.
function VoiceSection({
  voiceProfile, voiceNotes, fewShotExamples, visualStyleDescriptor,
  habitatIconUrl, habitatId, onChange, fld, lbl,
}: {
  voiceProfile: string;
  voiceNotes: string;
  fewShotExamples: Array<{ title?: string; body: string; whyItWorks?: string }> | null;
  visualStyleDescriptor: string | null;
  habitatIconUrl: string | null;
  habitatId: number | null;          // null = create mode, ko gọi inferVisualStyle
  onChange: (patch: { voiceProfile?: string; voiceNotes?: string;
    fewShotExamples?: Array<{ title?: string; body: string; whyItWorks?: string }> | null;
    visualStyleDescriptor?: string | null;
  }) => void;
  fld: React.CSSProperties;
  lbl: React.CSSProperties;
}) {
  const [expanded, setExpanded] = useState(false);
  const [inferBusy, setInferBusy] = useState(false);
  const [inferMsg, setInferMsg] = useState<string | null>(null);
  const examples = fewShotExamples ?? [];
  const meta = VOICE_PROFILE_META[voiceProfile as VoiceProfile] ?? VOICE_PROFILE_META.regular;

  const inferVisualStyle = async () => {
    if (!habitatId || !habitatIconUrl) {
      setInferMsg('⚠ Cần lưu habitat + có icon trước');
      return;
    }
    setInferBusy(true); setInferMsg(null);
    try {
      const res = await inferHabitatVisualStyle(habitatId);
      if (res.ok) {
        onChange({ visualStyleDescriptor: res.descriptor });
        setInferMsg(`✓ Đã suy ra: ${res.descriptor.slice(0, 60)}…`);
      } else {
        setInferMsg(`⚠ ${res.error}`);
      }
    } catch (e) {
      setInferMsg(`⚠ ${(e as Error).message}`);
    }
    setInferBusy(false);
  };

  return (
    <div style={{
      padding: '6px 8px',
      background: 'rgba(157,108,255,0.05)',
      border: '1px solid rgba(157,108,255,0.3)',
      borderRadius: 6,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      {/* HEADER — voice profile picker. Layout: icon + select rộng (hiện rõ
          icon + label + short description) + nút mở rộng. Tooltip example
          không hiển thị inline (quá dài làm tràn) — đưa vào tooltip của select. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14, lineHeight: 1 }} title="Giọng điệu — quyết định độ bựa/nghiêm túc của AI gen">🎙</span>
        <select value={voiceProfile}
                onChange={(e) => onChange({ voiceProfile: e.target.value })}
                title={`Đang dùng: ${meta.icon} ${meta.label} — ${meta.short}\n\nVí dụ: ${meta.example}\n\nChọn giọng khác để AI sinh bài theo tông đó.`}
                style={{ ...fld, flex: 1, fontWeight: 700, fontSize: 12.5 }}>
          {VOICE_PROFILES.map((p) => {
            const m = VOICE_PROFILE_META[p];
            return <option key={p} value={p}>{m.icon} {m.label} — {m.short}</option>;
          })}
        </select>
        <button type="button" onClick={() => setExpanded((v) => !v)}
                title={expanded ? 'Thu gọn' : 'Mở rộng — ghi chú giọng / ví dụ / phong cách hình ảnh'}
                style={{ flexShrink: 0,
                         background: 'transparent', border: '1px solid var(--line)',
                         borderRadius: 4, padding: '4px 8px', fontSize: 11,
                         color: 'var(--fg-3)', cursor: 'pointer',
                         fontFamily: 'var(--font-mono)',
                         whiteSpace: 'nowrap' }}>
          {expanded ? '▾' : `▸${voiceNotes || examples.length > 0 || visualStyleDescriptor ? ' ●' : ''}`}
        </button>
      </div>

      {expanded && (
        <>
          {/* GHI CHÚ GIỌNG — free-text */}
          <div>
            <label style={lbl} title="Bổ sung ngữ cảnh cho preset giọng điệu. VD: 'nhiều slang dân tài chính, dùng thuật ngữ crypto kiểu mỉa mai, không bao giờ nghiêm túc'. AI sẽ đọc cả block này.">
              Ghi chú giọng <span style={{ color: 'var(--fg-4)', textTransform: 'none', fontWeight: 400, marginLeft: 4 }}>(tuỳ chọn — ngữ cảnh bổ sung)</span>
            </label>
            <textarea value={voiceNotes}
                      onChange={(e) => onChange({ voiceNotes: e.target.value })}
                      placeholder="VD: nhiều slang dân tài chính, drop thuật ngữ crypto kiểu mỉa mai, không bao giờ sincere, in-joke về 'paper hands' và 'rugged'"
                      rows={2}
                      style={{ ...fld, fontFamily: 'var(--font-mono)', fontSize: 11.5, resize: 'vertical' }} />
          </div>

          {/* VÍ DỤ MẪU (few-shot) */}
          <div>
            <label style={lbl} title="Bài hút nước thật của community này. AI sẽ bắt chước tông/độ dài/in-joke. 3-5 ví dụ là tối ưu.">
              Ví dụ mẫu (few-shot)
              <span style={{ color: 'var(--fg-4)', textTransform: 'none', fontWeight: 400, marginLeft: 4 }}>
                ({examples.length} — tối đa 5, dùng làm chuẩn cho AI bắt chước)
              </span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {examples.map((ex, i) => (
                <FewShotRow key={i} example={ex}
                            onChange={(patch) => onChange({
                              fewShotExamples: examples.map((x, j) => j === i ? { ...x, ...patch } : x),
                            })}
                            onRemove={() => {
                              const next = examples.filter((_, j) => j !== i);
                              onChange({ fewShotExamples: next.length > 0 ? next : null });
                            }}
                            fld={fld} />
              ))}
              {examples.length < 5 && (
                <button type="button"
                        onClick={() => onChange({
                          fewShotExamples: [...examples, { title: '', body: '', whyItWorks: '' }],
                        })}
                        style={{ fontSize: 11, padding: '5px 10px',
                                 background: 'var(--bg-2)',
                                 color: 'var(--accent)',
                                 border: '1px dashed var(--accent-line)',
                                 borderRadius: 5, cursor: 'pointer' }}>
                  + Thêm ví dụ bài hút nước
                </button>
              )}
            </div>
          </div>

          {/* PHONG CÁCH HÌNH ẢNH — AI suy ra từ icon, cache vào DB */}
          <div>
            <label style={lbl} title="Mô tả thẩm mỹ của community — AI đọc icon habitat + mô tả community rồi suy ra. Đẩy vào prompt sinh ảnh để ảnh fit theme community.">
              Phong cách hình ảnh <span style={{ color: 'var(--fg-4)', textTransform: 'none', fontWeight: 400, marginLeft: 4 }}>(cho sinh ảnh — AI suy ra từ icon)</span>
            </label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
              <input type="text" value={visualStyleDescriptor ?? ''}
                     onChange={(e) => onChange({ visualStyleDescriptor: e.target.value || null })}
                     placeholder="VD: purple cosmic gradient, mystical astrology aesthetic, soft glow"
                     style={{ ...fld, flex: 1, fontFamily: 'var(--font-mono)', fontSize: 11.5 }} />
              <button type="button"
                      onClick={inferVisualStyle}
                      disabled={inferBusy || !habitatIconUrl || !habitatId}
                      title={!habitatId ? 'Cần Lưu habitat trước'
                        : !habitatIconUrl ? 'Cần lấy icon trước (Discord auto-fill ở trên)'
                        : 'Gọi GPT-4 Vision phân tích icon → suy ra mô tả phong cách'}
                      style={{ padding: '5px 10px', fontSize: 11, fontWeight: 600,
                               background: 'var(--accent)', color: '#0d1117',
                               border: 'none', borderRadius: 5,
                               cursor: inferBusy ? 'wait' : 'pointer',
                               opacity: (inferBusy || !habitatIconUrl || !habitatId) ? 0.5 : 1,
                               whiteSpace: 'nowrap',
                               display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                {inferBusy ? <><Spinner size="xs" /> đang suy ra…</> : '✨ AI suy ra'}
              </button>
            </div>
            {inferMsg && (
              <div style={{ marginTop: 4, fontSize: 10,
                            color: inferMsg.startsWith('✓') ? 'var(--ok)' : 'var(--bad)' }}>{inferMsg}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Single few-shot example editor — title (optional) + body + why_it_works.
function FewShotRow({
  example, onChange, onRemove, fld,
}: {
  example: { title?: string; body: string; whyItWorks?: string };
  onChange: (patch: Partial<{ title: string; body: string; whyItWorks: string }>) => void;
  onRemove: () => void;
  fld: React.CSSProperties;
}) {
  const [expanded, setExpanded] = useState(false);
  const preview = (example.body || example.title || '(trống)').replace(/\s+/g, ' ').slice(0, 80);
  return (
    <div style={{
      background: 'var(--bg-2)', border: '1px solid var(--line)',
      borderRadius: 5, overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
        cursor: 'pointer',
      }} onClick={() => setExpanded((v) => !v)}>
        <span style={{ fontSize: 10, color: 'var(--fg-3)', width: 12, textAlign: 'center' }}>
          {expanded ? '▾' : '▸'}
        </span>
        <span style={{ flex: 1, fontSize: 11, color: 'var(--fg-1)',
                       overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                       fontFamily: 'var(--font-mono)' }}>
          {preview}
        </span>
        {example.whyItWorks && <span title="Có ghi chú vì sao hiệu quả" style={{ fontSize: 10, color: 'var(--ok)' }}>●</span>}
        <button type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                title="Xoá ví dụ"
                style={{ fontSize: 11, padding: '2px 7px', color: 'var(--bad)',
                         background: 'transparent', border: '1px solid var(--line)',
                         borderRadius: 4, cursor: 'pointer' }}>✕</button>
      </div>
      {expanded && (
        <div style={{ padding: 8, borderTop: '1px solid var(--line)',
                      display: 'flex', flexDirection: 'column', gap: 5,
                      background: 'var(--bg-1)' }}>
          <input type="text" value={example.title ?? ''}
                 onChange={(e) => onChange({ title: e.target.value })}
                 placeholder="Tiêu đề (tuỳ chọn — để trống nếu Discord/bài ngắn)"
                 style={{ ...fld, fontSize: 11.5 }} />
          <textarea value={example.body ?? ''}
                    onChange={(e) => onChange({ body: e.target.value })}
                    placeholder="Nội dung bài hút nước — dán nguyên bản từ community"
                    rows={4}
                    style={{ ...fld, fontFamily: 'var(--font-mono)', fontSize: 11.5, resize: 'vertical' }} />
          <input type="text" value={example.whyItWorks ?? ''}
                 onChange={(e) => onChange({ whyItWorks: e.target.value })}
                 placeholder="Vì sao bài này hiệu quả (tuỳ chọn — vd: 'mở bài in-medias-res, không setup, tông mỉa mai, không ký tên')"
                 style={{ ...fld, fontSize: 11 }} />
        </div>
      )}
    </div>
  );
}

// Compact row cho 1 channel — collapsed default: name + url + format chip + ⋯ +
// ✕. Click name (hoặc ▸) → expand inline cho description / rules / format
// checkboxes. Local state cho expanded để parent không re-render cả list khi
// toggle 1 row.
function ChannelRow({
  ch, habitatAllowed, onChange, onRemove, fld,
}: {
  ch: HabitatChannelInput;
  habitatAllowed: Set<string>;
  onChange: (patch: Partial<HabitatChannelInput>) => void;
  onRemove: () => void;
  fld: React.CSSProperties;
}) {
  const [expanded, setExpanded] = useState(false);
  const isOv = Array.isArray(ch.allowedFormats);
  const selected = new Set(isOv ? ch.allowedFormats! : Array.from(habitatAllowed));
  const formatCount = selected.size;
  const hasContent = (ch.description ?? '').trim() || (ch.rules ?? '').trim();
  // skip_for_post = channel admin/info-only (rules / announcements / bot-commands).
  // Hiển thị mute (giảm opacity + badge 🚫) + AI sẽ bỏ qua khi pick.
  const skipForPost = ch.postingGates != null && typeof ch.postingGates === 'object'
    && (ch.postingGates as Record<string, unknown>).skip_for_post === true;
  // Short URL display — strip protocol + domain trailing
  const shortUrl = ch.url
    ? ch.url.replace(/^https?:\/\//, '').replace(/^discord\.com\//, 'd/').replace(/\/$/, '')
    : '';

  const toggleFmt = (k: string) => {
    const next = new Set(selected);
    if (next.has(k)) next.delete(k); else next.add(k);
    const arr = Array.from(next);
    const sameAsHabitat = arr.length === habitatAllowed.size && arr.every((x) => habitatAllowed.has(x));
    onChange({ allowedFormats: sameAsHabitat ? null : arr });
  };

  return (
    <div style={{
      background: 'var(--bg-2)', border: '1px solid var(--line)',
      borderRadius: 5, overflow: 'hidden',
      // Mute toàn row nếu channel không đăng bài (rules/announce/bot)
      opacity: skipForPost ? 0.55 : 1,
    }}>
      {/* COMPACT HEADER ROW — 1 dòng */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
        cursor: 'pointer',
      }}
           onClick={() => setExpanded((v) => !v)}>
        <span style={{ fontSize: 10, color: 'var(--fg-3)', width: 12, textAlign: 'center' }}
              title={expanded ? 'Thu gọn' : 'Mở rộng để sửa rules/description/format'}>
          {expanded ? '▾' : '▸'}
        </span>
        <span style={{
          flex: 1, fontWeight: 700, fontSize: 12,
          color: ch.name?.trim() ? 'var(--fg-0)' : 'var(--fg-4)',
          fontFamily: 'var(--font-mono)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} title={ch.name || '(chưa đặt tên)'}>
          # {ch.name || 'unnamed'}
        </span>
        {shortUrl && (
          <a href={`https://href.li/?${ch.url}`} target="_blank" rel="noopener noreferrer"
             onClick={(e) => e.stopPropagation()}
             title={`Mở channel: ${ch.url}`}
             style={{
               fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)',
               textDecoration: 'none', maxWidth: 200, overflow: 'hidden',
               textOverflow: 'ellipsis', whiteSpace: 'nowrap',
             }}>
            ↗ {shortUrl}
          </a>
        )}
        {/* Format chip — N icons + count */}
        <span title={isOv
                ? `Override channel: ${formatCount} loại bài`
                : `Kế thừa habitat: ${formatCount} loại bài`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '1px 6px', fontSize: 9.5, fontFamily: 'var(--font-mono)',
                fontWeight: 700, borderRadius: 3,
                background: isOv ? 'rgba(157,108,255,0.12)' : 'var(--bg-1)',
                color: isOv ? 'var(--neon-violet)' : 'var(--fg-3)',
                border: `1px solid ${isOv ? 'rgba(157,108,255,0.4)' : 'var(--line)'}`,
              }}>
          {Array.from(selected).slice(0, 3).map((k) => (
            <FormatIcon key={k} kind={k} size={10} />
          ))}
          {formatCount > 3 && <span>+{formatCount - 3}</span>}
          <span style={{ marginLeft: 2 }}>{formatCount}</span>
        </span>
        {hasContent && (
          <span title="Có description / rules"
                style={{ fontSize: 10, color: 'var(--ok)' }}>●</span>
        )}
        {skipForPost && (
          <span title="Channel admin/info-only — AI sẽ KHÔNG pick channel này khi tạo bài"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 3,
                         padding: '1px 6px', fontSize: 9, fontWeight: 700,
                         fontFamily: 'var(--font-mono)',
                         background: 'rgba(248,113,113,0.12)',
                         color: 'var(--bad)',
                         border: '1px solid rgba(248,113,113,0.4)',
                         borderRadius: 3 }}>
            🚫 không đăng
          </span>
        )}
        <button type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                title="Xoá channel này"
                style={{ fontSize: 11, padding: '2px 7px', color: 'var(--bad)',
                         background: 'transparent', border: '1px solid var(--line)',
                         borderRadius: 4, cursor: 'pointer' }}>✕</button>
      </div>

      {/* EXPANDED PANEL */}
      {expanded && (
        <div style={{
          padding: 8, borderTop: '1px solid var(--line)',
          display: 'flex', flexDirection: 'column', gap: 5,
          background: 'var(--bg-1)',
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="text" value={ch.name ?? ''}
                   onChange={(e) => onChange({ name: e.target.value })}
                   placeholder="general / promo / showcase"
                   style={{ ...fld, flex: 1, fontWeight: 700 }} />
            <input type="url" value={ch.url ?? ''}
                   onChange={(e) => onChange({ url: e.target.value })}
                   placeholder="https://discord.com/channels/<server>/<chan>"
                   style={{ ...fld, flex: 2, fontFamily: 'var(--font-mono)', fontSize: 11 }} />
          </div>
          <input type="text" value={ch.description ?? ''}
                 onChange={(e) => onChange({ description: e.target.value })}
                 placeholder="Mô tả ngắn — off-topic / showcase only / Q&A…"
                 style={{ ...fld, fontSize: 11 }} />
          <textarea value={ch.rules ?? ''}
                    onChange={(e) => onChange({ rules: e.target.value })}
                    placeholder="Rules markdown cho channel này — vd 'no links, AMA Friday only, 100+ karma…'"
                    rows={2}
                    style={{ ...fld, fontFamily: 'var(--font-mono)', fontSize: 11, resize: 'vertical' }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 9.5, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
              Loại bài:
            </span>
            {CONTENT_FORMATS.filter((f) => habitatAllowed.has(f.key) || (isOv && selected.has(f.key))).map((f) => {
              const on = selected.has(f.key);
              const col = formatColors(f.key);
              return (
                <label key={f.key} title={`${f.label}${isOv ? ' (channel override)' : ' (kế thừa habitat)'}`}
                       style={{ display: 'inline-flex', alignItems: 'center', gap: 3,
                                padding: '1px 6px', fontSize: 9.5, fontFamily: 'var(--font-mono)',
                                fontWeight: 700, borderRadius: 3, cursor: 'pointer',
                                background: on ? col.bg : 'var(--bg-1)',
                                color: on ? col.fg : 'var(--fg-4)',
                                border: `1px solid ${on ? col.border : 'var(--line)'}`,
                                opacity: on ? 1 : 0.5 }}>
                  <input type="checkbox" checked={on} onChange={() => toggleFmt(f.key)}
                         style={{ accentColor: col.fg, cursor: 'pointer', width: 10, height: 10 }} />
                  <FormatIcon kind={f.key} size={10} />
                  {f.label}
                </label>
              );
            })}
            {isOv && (
              <button type="button"
                      onClick={() => onChange({ allowedFormats: null })}
                      title="Reset về kế thừa habitat"
                      style={{ fontSize: 9, padding: '1px 5px', background: 'transparent',
                               color: 'var(--fg-3)', border: '1px solid var(--line)', borderRadius: 3,
                               cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                reset
              </button>
            )}
          </div>
          {/* Channel-level voice override. NULL = inherit habitat (default).
              Vd habitat shitposter + #rules channel → 'regular' để bài #rules
              đỡ trolling. */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 9.5, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)',
                           textTransform: 'uppercase', minWidth: 70 }}>
              🎙 Giọng:
            </span>
            <select value={ch.voiceProfileOverride ?? ''}
                    onChange={(e) => onChange({ voiceProfileOverride: e.target.value || null })}
                    title="Ghi đè giọng điệu của habitat. Để trống = kế thừa habitat."
                    style={{ ...fld, fontSize: 11, flex: 1, maxWidth: 240 }}>
              <option value="">(kế thừa habitat)</option>
              {VOICE_PROFILES.map((p) => {
                const m = VOICE_PROFILE_META[p];
                return <option key={p} value={p}>{m.icon} {m.label}</option>;
              })}
            </select>
            {ch.voiceProfileOverride && (
              <span style={{ fontSize: 10, color: 'var(--neon-violet)',
                             fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                ghi đè
              </span>
            )}
          </div>
          {/* Toggle "không đăng bài" cho channel admin/info-only (rules,
              announcements, bot-commands…). Auto-set khi parse từ tên + manual
              override. Channel có skip_for_post=true sẽ bị disable trong
              ChannelPickerChip + ChannelCoverageGrid. */}
          {(() => {
            const gates = ch.postingGates ?? {};
            const skipForPost = gates.skip_for_post === true;
            const toggleSkip = () => {
              const newGates = skipForPost
                ? null     // turn off: clear gates (giữ logic null = no constraint)
                : { ...gates, skip_for_post: true, reason: 'manual' };
              onChange({ postingGates: newGates });
            };
            return (
              <label title={skipForPost
                      ? 'Channel này KHÔNG dùng để đăng bài (vd #rules, #announcements). Bỏ tick để cho phép đăng.'
                      : 'Tick nếu channel này admin/info-only (rules / announcements / bot-commands). AI sẽ không pick channel này khi tạo bài.'}
                     style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '3px 7px', fontSize: 10.5, cursor: 'pointer',
                              fontFamily: 'var(--font-mono)',
                              background: skipForPost ? 'rgba(248,113,113,0.10)' : 'transparent',
                              border: `1px solid ${skipForPost ? 'rgba(248,113,113,0.4)' : 'var(--line)'}`,
                              color: skipForPost ? 'var(--bad)' : 'var(--fg-3)',
                              borderRadius: 4, width: 'fit-content' }}>
                <input type="checkbox" checked={skipForPost} onChange={toggleSkip}
                       style={{ accentColor: 'var(--bad)', cursor: 'pointer', width: 12, height: 12 }} />
                <span style={{ fontWeight: 700 }}>🚫 Không đăng bài</span>
                <span style={{ opacity: 0.7 }}>
                  (channel admin/info-only — AI sẽ bỏ qua khi pick channel)
                </span>
              </label>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// Inline parser block — paste screenshot Discord sidebar / text dump
// channels → AI extract → append. Same UX với AIFormParser nhưng custom
// vì output là array, không phải flat object. Collapsed mặc định.
function ChannelBulkParser({
  platformKey,
  onApply,
}: {
  platformKey: string;
  onApply: (channels: Array<{ name: string; url: string | null; description: string; rules: string; allowedFormats: string[] | null; postingGates: Record<string, unknown> | null }>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');
  const [image, setImage] = useState<{ base64: string; mime: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Chỉ nhận file ảnh'); return; }
    if (file.size > 8 * 1024 * 1024) { setError('Ảnh > 8MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [, base64] = result.split(',');
      setImage({ base64: base64 || '', mime: file.type, name: file.name });
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) { e.preventDefault(); handleFile(f); return; }
      }
    }
  };

  const submit = async () => {
    if (!text.trim() && !image) { setError('Dán text danh sách channel hoặc ảnh'); return; }
    setError(null); setNotes(null); setBusy(true);
    const res = await parseChannelsFromInput({
      text: text.trim() || undefined,
      imageBase64: image?.base64,
      imageMimeType: image?.mime,
      platformKey,
    });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    if (res.channels.length === 0) { setError('Không tìm thấy channel nào trong input'); return; }
    onApply(res.channels);
    if (res.notes) setNotes(`${res.channels.length} channel · ${res.notes}`);
    else setNotes(`✓ Đã thêm ${res.channels.length} channel`);
    setText(''); setImage(null);
    setTimeout(() => setNotes(null), 4000);
  };

  if (!expanded) {
    return (
      <div style={{
        padding: '5px 10px',
        background: 'rgba(157,108,255,0.06)',
        border: '1px dashed rgba(157,108,255,0.4)',
        borderRadius: 5,
        display: 'flex', alignItems: 'center', gap: 8, fontSize: 11,
      }}>
        <span style={{ fontSize: 13 }}>✨</span>
        <button type="button" onClick={() => setExpanded(true)}
                style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                         color: 'var(--neon-violet)', fontWeight: 600, fontSize: 11 }}>
          AI thêm hàng loạt
        </button>
        <span style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
          dán ảnh sidebar Discord / danh sách text → AI tách channel
        </span>
        {notes && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ok)' }}>{notes}</span>}
      </div>
    );
  }
  return (
    <div style={{
      padding: 8, background: 'rgba(157,108,255,0.06)',
      border: '1px solid rgba(157,108,255,0.4)', borderRadius: 6,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13 }}>✨</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--neon-violet)' }}>AI thêm channel hàng loạt</span>
        <span style={{ flex: 1, fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
          dán text · Ctrl+V ảnh · upload
        </span>
        <button type="button" onClick={() => setExpanded(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--fg-3)',
                         cursor: 'pointer', fontSize: 12 }}>✕</button>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} onPaste={handlePaste}
                placeholder={`Dán danh sách channel (mỗi dòng 1 channel) hoặc ảnh sidebar:\n# general\n# rules\n# showcase — chỉ ảnh và video\n# promo — không spam`}
                rows={4}
                style={{ width: '100%', padding: 8, background: 'var(--bg-2)',
                         border: '1px solid var(--line)', borderRadius: 5,
                         color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)',
                         resize: 'vertical', outline: 'none' }} />
      {image && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--fg-3)' }}>
          <span>📷 {image.name}</span>
          <button type="button" onClick={() => setImage(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--fg-3)',
                           cursor: 'pointer', fontSize: 11 }}>gỡ</button>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
               onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
        <button type="button" onClick={() => fileInputRef.current?.click()}
                style={{ padding: '4px 8px', fontSize: 10, background: 'var(--bg-2)',
                         border: '1px solid var(--line)', borderRadius: 4,
                         color: 'var(--fg-2)', cursor: 'pointer' }}>📎 Tải ảnh lên</button>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={submit} disabled={busy || (!text.trim() && !image)}
                style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600,
                         background: busy ? 'var(--bg-3)' : 'var(--neon-violet)',
                         border: 'none', borderRadius: 4,
                         color: busy ? 'var(--fg-3)' : 'var(--bg-0)',
                         cursor: busy ? 'wait' : 'pointer' }}>
          {busy ? '✦ đang tách…' : '✦ Tách channel'}
        </button>
      </div>
      {error && <div style={{ fontSize: 10, color: 'var(--bad)' }}>⚠ {error}</div>}
      {notes && <div style={{ fontSize: 10, color: 'var(--ok)' }}>{notes}</div>}
    </div>
  );
}

// Local Collapsible — copy của accounts-vault.tsx Collapsible (chưa export
// chung). Khi shared primitives được tách ra `ui/`, replace 2 chỗ.
function Collapsible({
  title, badge, defaultOpen = false, children, hint,
}: {
  title: React.ReactNode;
  badge?: React.ReactNode;
  hint?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginTop: 4, border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg-1)' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', padding: '8px 12px',
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--fg-1)', fontSize: 12, textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 9, color: 'var(--fg-3)', transition: 'transform .15s', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
        <span style={{ fontWeight: 600 }}>{title}</span>
        {badge}
        <span style={{ flex: 1 }} />
        {hint && <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{hint}</span>}
      </button>
      {open && <div style={{ padding: '4px 12px 12px', borderTop: '1px solid var(--line)' }}>{children}</div>}
    </div>
  );
}

// HabitatBriefsSection — Mirror của AccountBriefsSection (xem
// accounts-vault.tsx:2878). List accounts đã engage habitat này (mỗi
// account = 1 brief = 1 row), + "+ Add account" button mở ResourcePicker
// list những accounts cùng platform CHƯA có brief để gắn nhanh.
//
// Click pattern:
//   - 👤 avatar / @accountHandle → Account modal (credential/persona/status)
//   - Row body → Brief modal (chiến lược, phase, bài)
//   - Platform icon overlay (góc dưới avatar) chỉ thị platform của account.
function HabitatBriefsSection({
  projectId, habitatId, habitatName, habitatKind, platformKey,
  onOpenAccount, onOpenBrief,
}: {
  projectId: string;
  habitatId: number;
  habitatName: string;
  habitatKind: string;
  platformKey: string | null;
  onOpenAccount?: (accountId: number) => void;
  onOpenBrief?: (briefId: number) => void;
}) {
  const router = useRouter();
  const [briefs, setBriefs] = useState<BriefForHabitat[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [picking, setPicking] = useState(false);
  const [addable, setAddable] = useState<Array<{ id: number; handle: string | null; status: string; platformKey: string; platformLabel: string }>>([]);
  const [creatingFor, setCreatingFor] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    listBriefsForHabitat(habitatId)
      .then((rows) => {
        if (!cancelled) { setBriefs(rows); setLoading(false); }
      })
      .catch((err) => {
        if (!cancelled) {
          setFetchError(err?.message || String(err));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [habitatId, reloadTick]);

  const handleAdd = async () => {
    const list = await listAddableAccountsForHabitat(projectId, habitatId, platformKey ? [platformKey] : null);
    setAddable(list);
    setPicking(true);
  };

  const handlePick = async (accountId: number) => {
    setPicking(false);
    setCreatingFor(accountId);
    try {
      const r = await upsertBrief(projectId, accountId, habitatId, {});
      if (r.ok && r.id) {
        setReloadTick((t) => t + 1);
        router.refresh();
        onOpenBrief?.(r.id);
      } else {
        setFetchError(r.error || 'Không tạo được brief');
      }
    } finally {
      setCreatingFor(null);
    }
  };

  return (
    <Collapsible
      title="🎯 Accounts engaging"
      defaultOpen={false}
      badge={
        <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: briefs.length > 0 ? 'var(--accent)' : 'var(--fg-3)', padding: '1px 6px', borderRadius: 3, background: briefs.length > 0 ? 'var(--accent-soft)' : 'var(--bg-2)' }}>
          {briefs.length}
        </span>
      }
      hint={
        <button className="btn" type="button" onClick={(e) => { e.stopPropagation(); handleAdd(); }}
                style={{ fontSize: 10, padding: '2px 8px' }}
                disabled={creatingFor !== null}>
          {creatingFor !== null ? '…' : '+ Add account'}
        </button>
      }
    >
      {loading ? (
        <div style={{ padding: 12, textAlign: 'center', color: 'var(--fg-3)' }}>
          <Spinner size="sm" /> <span style={{ marginLeft: 6, fontSize: 11 }}>Loading briefs…</span>
        </div>
      ) : fetchError ? (
        <div style={{ padding: 10, fontSize: 11, color: 'var(--bad)', borderRadius: 5,
                      background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.3)' }}>
          ⚠ Fetch error: {fetchError}
        </div>
      ) : briefs.length === 0 ? (
        <div style={{ padding: 10, fontSize: 11, color: 'var(--fg-3)', borderRadius: 5, background: 'var(--bg-2)', border: '1px dashed var(--line)' }}>
          Chưa có account nào engage habitat này. Click <strong>+ Add account</strong> để link 1 account cùng platform vào community + viết approach.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {briefs.map((b) => {
            const acctMeta = accountStatusMeta(b.accountStatus);
            const joinColor = JOIN_STATUS_COLOR[b.joinStatus];
            const joinIcon = JOIN_STATUS_ICON[b.joinStatus];
            const joinLabel = JOIN_STATUS_LABEL[b.joinStatus];
            const phaseColor = PHASE_COLOR[b.currentPhase];
            const phaseLabel = PHASE_LABEL[b.currentPhase];
            const handleBriefClick = () => onOpenBrief?.(b.id);
            const handleAccountClick = (e: React.MouseEvent) => {
              e.stopPropagation();
              if (b.accountHandle) onOpenAccount?.(b.accountId);
            };
            return (
              <div key={b.id}
                   style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, alignItems: 'center' }}>
                {/* Avatar 👤 + platform overlay → click mở Account modal
                    (đối xứng Account modal: favicon habitat → Brief modal).
                    Body row click → Brief modal. */}
                <button type="button" onClick={handleAccountClick}
                        disabled={!onOpenAccount || !b.accountHandle}
                        title={onOpenAccount ? `Mở Account modal: @${b.accountHandle ?? '?'}` : ''}
                        style={{ background: 'none', border: 'none', padding: 0,
                                 cursor: onOpenAccount ? 'pointer' : 'default',
                                 display: 'inline-flex', position: 'relative', flexShrink: 0 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 5,
                                 background: 'var(--bg-3)', color: 'var(--fg-2)',
                                 display: 'flex', alignItems: 'center', justifyContent: 'center',
                                 fontSize: 16, border: '1px solid var(--line)' }}>👤</span>
                  {b.platformKey && (
                    <img src={`https://cdn.simpleicons.org/${b.platformKey}/d4d4d8`}
                         alt={b.platformLabel}
                         width={12} height={12}
                         title={b.platformLabel}
                         style={{ position: 'absolute', right: -3, bottom: -3,
                                  background: 'var(--bg-1)', borderRadius: 3, padding: 1,
                                  border: '1px solid var(--line)' }} />
                  )}
                </button>
                <div style={{ minWidth: 0, cursor: onOpenBrief ? 'pointer' : 'default' }}
                     onClick={onOpenBrief ? handleBriefClick : undefined}
                     title={onOpenBrief ? 'Click để mở Brief modal' : ''}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2, flexWrap: 'wrap' }}>
                    {/* @handle → click mở Account modal */}
                    <button type="button" onClick={handleAccountClick}
                            disabled={!onOpenAccount || !b.accountHandle}
                            title={onOpenAccount ? `Mở Account modal: @${b.accountHandle ?? '?'}` : ''}
                            style={{ background: 'none', border: 'none', padding: 0, fontSize: 12,
                                     fontWeight: 600, color: 'var(--fg-0)',
                                     cursor: onOpenAccount ? 'pointer' : 'default',
                                     textDecoration: 'underline', textDecorationStyle: 'dotted',
                                     textDecorationColor: 'var(--fg-4)', textUnderlineOffset: 3,
                                     fontFamily: 'var(--font-mono)',
                                     overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      @{b.accountHandle ?? 'no-handle'}
                    </button>
                    <span title={b.platformLabel}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 3,
                                   padding: '0 6px', fontSize: 9, fontFamily: 'var(--font-mono)',
                                   fontWeight: 700, borderRadius: 3, textTransform: 'uppercase',
                                   color: 'var(--fg-3)', border: '1px solid var(--line)' }}>
                      {b.platformKey && (
                        <img src={`https://cdn.simpleicons.org/${b.platformKey}/9ca3af`}
                             alt="" width={9} height={9} style={{ opacity: 0.9 }} />
                      )}
                      {b.platformLabel}
                    </span>
                    {/* Account status — chỉ hiện khi ≠ active (giảm noise) */}
                    {b.accountStatus !== 'active' && (
                      <span title={`Account status (tầng 1 — global): ${acctMeta.label}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 3,
                                     padding: '0 6px', fontSize: 9, fontFamily: 'var(--font-mono)',
                                     fontWeight: 700, borderRadius: 3, textTransform: 'uppercase',
                                     background: acctMeta.color + '22', color: acctMeta.color,
                                     border: `1px solid ${acctMeta.color}66` }}>
                        {acctMeta.icon} {acctMeta.label}
                      </span>
                    )}
                    {/* Join status chip — tầng 2 */}
                    <span title={`Join status (tầng 2 — membership per-habitat): ${joinLabel}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 3,
                                   padding: '0 6px', fontSize: 9, fontFamily: 'var(--font-mono)',
                                   fontWeight: 700, borderRadius: 3, textTransform: 'uppercase',
                                   background: joinColor + (b.joinStatus === 'joined' ? '1a' : '22'),
                                   color: joinColor,
                                   border: `1px solid ${joinColor}66` }}>
                      {joinIcon} {joinLabel}
                    </span>
                    {/* Phase chip — tầng 3 */}
                    <span title={`Engagement phase (tầng 3 — strategy step): ${phaseLabel}`}
                          style={{ display: 'inline-flex', alignItems: 'center',
                                   padding: '0 6px', fontSize: 9, fontFamily: 'var(--font-mono)',
                                   fontWeight: 700, borderRadius: 3, textTransform: 'uppercase',
                                   background: phaseColor + '22', color: phaseColor,
                                   border: `1px solid ${phaseColor}66` }}>
                      {phaseLabel}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.approachMd ? b.approachMd.split('\n')[0] : <em style={{ color: 'var(--fg-4)' }}>chưa viết approach</em>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {b.cadence && <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }} title="Cadence">⏱ {b.cadence}</span>}
                  {b.tone && <span style={{ fontSize: 10, color: 'var(--fg-3)' }} title={`Tone: ${b.tone}`}>🎵</span>}
                  {b.templates.length > 0 && <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }} title={`${b.templates.length} templates`}>📝 {b.templates.length}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {picking && (
        <ResourcePicker
          title="Chọn account để add brief"
          hint={`Accounts cùng platform${platformKey ? ` (${platformKey})` : ''} trong project, chưa có brief với habitat này.`}
          items={addable}
          getKey={(a) => a.id}
          renderItem={(a) => ({
            title: `@${a.handle ?? 'no-handle'}`,
            subtitle: `${a.platformLabel} · status: ${a.status}`,
          })}
          onPick={(a) => handlePick(a.id)}
          onClose={() => setPicking(false)}
          emptyMessage={
            <>Project này chưa có account nào cùng platform <strong>{platformKey ?? '—'}</strong> để gắn vào {habitatKind} <strong>{habitatName}</strong>.<br />
            Tạo account mới ở tab Accounts, hoặc dùng <strong>+ Add community</strong> trong Account modal.</>
          }
        />
      )}
    </Collapsible>
  );
}
