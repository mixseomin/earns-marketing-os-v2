'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createHabitat, updateHabitat, deleteHabitat, type HabitatInput } from '@/lib/actions/tribes-crud';
import type { TribeRow, HabitatRow, PlatformRow } from '@/lib/data';
import { Spinner } from './ui';
import { AIFormParser } from './ai-form-parser';
import { PlatformPicker } from './platform-picker';
import { platformKeysForHabitatKind, detectPlatformKeyFromUrl } from '@/lib/habitat-platform-map';
import { TagsInput } from './tags-input';
import { parseFormInput, suggestRulesUrl, type FormFieldSchema } from '@/lib/actions/ai-parse';
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
}: {
  projectId: string;
  habitat: HabitatRow | null;     // null = create
  tribes: TribeRow[];             // for tribe picker
  platforms: PlatformRow[];       // for platform picker
  presetTribeId?: number | null;  // create with this tribe pre-selected
  onClose: () => void;
  onCreated?: (newId: number) => void;  // fired after successful creation
}) {
  const router = useRouter();
  const isCreate = !habitat;
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [technologies, setTechnologies] = useState<TechnologyRow[]>([]);
  useEffect(() => { listTechnologies().then(setTechnologies); }, []);
  const [rulesFetchBusy, setRulesFetchBusy] = useState(false);
  const [rulesFetchMsg, setRulesFetchMsg] = useState<string | null>(null);
  const [findUrlBusy, setFindUrlBusy] = useState(false);
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
    bestPostTimes: habitat?.bestPostTimes ?? '',
  });
  const setF = <K extends keyof HabitatInput>(k: K, v: HabitatInput[K]) => setForm((f) => ({ ...f, [k]: v }));

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

  const handleSave = () => {
    setBusy(true); setError(null);
    startTransition(async () => {
      if (isCreate) {
        const res = await createHabitat(projectId, form);
        setBusy(false);
        if (!res.ok) { setError(res.error ?? 'Save failed'); return; }
        router.refresh();
        if (res.id != null) onCreated?.(res.id);
        onClose();
      } else {
        const res = await updateHabitat(projectId, habitat!.id, form);
        setBusy(false);
        if (!res.ok) { setError(res.error ?? 'Save failed'); return; }
        router.refresh();
        onClose();
      }
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
      <div className="modal" style={{ width: 'min(1080px, 100%)', maxWidth: 1080 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ flex: 1 }}>
            <div className="id-line">{isCreate ? 'NEW HABITAT' : `Habitat #${habitat!.id}`}</div>
            <h2>{isCreate ? '+ New habitat' : habitat!.name}</h2>
          </div>
          <button className="btn ghost" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
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

          {/* ── 2-column body ── left = identity, right = outreach meta ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px dashed var(--line)', paddingBottom: 4 }}>
            🪪 Identity & links
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
            <label style={lbl}>URL</label>
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
                  Platform link {needsExplicit && <span style={{ color: 'var(--warn)', textTransform: 'none' }}>// nên chọn để "+ Add account" auto-lock platform</span>}
                  {!needsExplicit && <span style={{ color: 'var(--fg-4)', textTransform: 'none' }}>// auto từ kind, có thể override</span>}
                </label>
                <PlatformPicker platforms={platforms} value={effective ?? ''}
                                onChange={(k) => setF('platformKey', k || null)} fld={fld} />
                {!form.platformKey && autoFromKind && (
                  <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 3 }}>
                    Default: <code>{autoFromKind}</code> (suy từ kind <code>{form.kind}</code>). Pick khác để override.
                  </div>
                )}
              </div>
            );
          })()}

          <div>
            <label style={lbl}>
              Forum engine <span style={{ color: 'var(--fg-4)', textTransform: 'none' }}>// override tech nếu khác platform default</span>
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
              <label style={lbl}>Tribe</label>
              <select value={form.tribeId ?? ''} onChange={(e) => setF('tribeId', e.target.value ? Number(e.target.value) : null)} style={fld}>
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
          </div>{/* /left column */}

          {/* ── RIGHT: Outreach meta — feeds AI brief generator + persona-fit hints ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px dashed var(--accent-line)', paddingBottom: 4 }}>
              🎯 Outreach meta — AI brief đọc các field này
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

            <div>
              <label style={lbl}>
                Posting rules URL
                <span style={{ color: 'var(--fg-4)', textTransform: 'none' }}> // canonical rules page</span>
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
              <label style={lbl}>Posting rules <span style={{ color: 'var(--fg-4)', textTransform: 'none' }}>// markdown — paste content từ URL trên</span></label>
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
          </div>{/* /right column */}
          </div>{/* /2-col wrapper */}

          {error && (
            <div style={{ padding: 8, background: 'rgba(255,77,94,.1)', border: '1px solid rgba(255,77,94,.4)', color: 'var(--bad)', fontSize: 12, borderRadius: 5 }}>
              {error}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <div className="meta">{isCreate ? 'New habitat' : `Editing #${habitat!.id}`}</div>
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
    </div>
  );
}
