'use client';

// Reusable Platform CRUD modal — mở được từ /platforms admin page,
// từ account modal (✏️ edit), từ publication picker, etc.
// Pattern: feedback_picker_inline_crud.md (edit-anywhere via modal).

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  type PlatformWithUsage, type PlatformPriority, type PlatformCategory,
  createPlatform, updatePlatform, deletePlatform,
} from '@/lib/actions/platforms';
import {
  listCommunitiesByPlatform, countCardsByContentTypeForPlatform, archiveCardsByTypesForPlatform,
  type AffectedCardsByType,
} from '@/lib/actions/tribes-crud';
import { listTechnologies, detectTechnologyFromUrl, type TechnologyRow, type SignupField } from '@/lib/actions/technologies';
import { AIFormParser } from './ai-form-parser';
import { NoFillInput } from './no-fill-input';
import { TagsInput } from './tags-input';
import { IconCommunity, FormatIcon } from './ui';
import { HabitatSelectorsSection } from './habitat-selectors-section';
import { CONTENT_FORMATS, allowedFormats, formatColors, formatMeta } from '@/lib/content-formats';
import { getSuggestedProfileUrlPattern } from '@/lib/platform-profile-urls';
import { TechnologyPicker, SignupFieldsBuilder } from './technology-picker';

const PRIORITY_ORDER: PlatformPriority[] = ['critical', 'high', 'medium', 'low'];
const PRIORITY_META: Record<PlatformPriority, { star: string; label: string }> = {
  critical: { star: '★★★★', label: 'Critical' },
  high:     { star: '★★★',  label: 'High' },
  medium:   { star: '★★',   label: 'Medium' },
  low:      { star: '★',    label: 'Low' },
};

export function PlatformFormModal({ platform, onClose }: { platform: PlatformWithUsage | null; onClose: () => void }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState<{
    removedTypes: string[];
    affected: AffectedCardsByType[];
  } | null>(null);
  const isCreate = !platform;
  const [form, setForm] = useState({
    key: platform?.key ?? '',
    label: platform?.label ?? '',
    signupUrl: platform?.signupUrl ?? '',
    postUrl: platform?.postUrl ?? '',
    profileUrlPattern: platform?.profileUrlPattern ?? '',
    priority: (platform?.priority ?? 'medium') as PlatformPriority,
    iconSlug: platform?.iconSlug ?? '',
    description: platform?.description ?? '',
    pricing: platform?.pricing ?? '',
    region: platform?.region ?? '',
    category: (platform?.category ?? 'other') as string,
    userCountEstimate: platform?.userCountEstimate ?? '',
    tags: platform?.tags ?? [],
    technologyKey: platform?.technologyKey ?? null as string | null,
    signupFields: (platform?.signupFields ?? []) as SignupField[],
    // null = chưa override (dùng hardcoded fallback). [] = override = không
    // cho format nào (rare). Array các key = list custom.
    allowedFormats: platform?.allowedFormats ?? null,
  });
  const [technologies, setTechnologies] = useState<TechnologyRow[]>([]);
  useEffect(() => { listTechnologies().then(setTechnologies); }, []);
  const [detecting, setDetecting] = useState(false);
  const [detectMsg, setDetectMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const handleDetect = async () => {
    if (!form.signupUrl) return;
    setDetecting(true); setDetectMsg(null);
    const result = await detectTechnologyFromUrl(form.signupUrl);
    setDetecting(false);
    if (result.techKey) {
      setF('technologyKey', result.techKey);
      setDetectMsg({ text: `${result.techKey} (${result.confidence}) via ${result.method}`, ok: true });
    } else {
      setDetectMsg({ text: `No match — ${result.method}`, ok: false });
    }
  };
  const suggestedProfileUrl = useMemo(() => {
    if (!form.key) return null;
    return getSuggestedProfileUrlPattern(form.key);
  }, [form.key]);
  const setF = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Reverse view: list communities (habitats) using THIS platform across
  // every project. Lazy-load when modal opens with an existing platform.
  const [communities, setCommunities] = useState<Awaited<ReturnType<typeof listCommunitiesByPlatform>>>([]);
  useEffect(() => {
    if (!platform?.key) { setCommunities([]); return; }
    let cancelled = false;
    listCommunitiesByPlatform(platform.key, 50).then((rows) => {
      if (!cancelled) setCommunities(rows);
    });
    return () => { cancelled = true; };
  }, [platform?.key]);

  const fld: React.CSSProperties = {
    width: '100%', padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)',
    borderRadius: 5, color: 'var(--fg-0)', fontSize: 13, outline: 'none',
  };
  const lbl: React.CSSProperties = {
    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block',
  };

  const doSave = (archiveOrphans: boolean, typesToArchive: string[] = []) => {
    setError(null); setBusy(true);
    startTransition(async () => {
      const payload = {
        ...form,
        postUrl: form.postUrl || null,
        profileUrlPattern: form.profileUrlPattern || null,
        pricing: form.pricing || null,
        region: form.region || null,
        userCountEstimate: form.userCountEstimate || null,
        category: form.category as PlatformCategory,
        tags: form.tags,
        technologyKey: form.technologyKey || null,
        signupFields: form.signupFields,
        allowedFormats: form.allowedFormats,
      };
      const res = isCreate ? await createPlatform(payload) : await updatePlatform(platform!.key, payload);
      if (!res.ok) { setBusy(false); setError(res.error || 'Lưu thất bại'); return; }
      if (!isCreate && archiveOrphans && typesToArchive.length > 0) {
        await archiveCardsByTypesForPlatform(platform!.key, typesToArchive);
      }
      setBusy(false);
      router.refresh();
      onClose();
    });
  };

  // Effective allowed format keys = override nếu set, else hardcoded fallback.
  const effectiveAllowedSet = (override: string[] | null | undefined): Set<string> => {
    if (Array.isArray(override)) return new Set(override);
    return new Set(allowedFormats(form.key, form.category as string).map((f) => f.key));
  };

  const save = () => {
    // Pre-save check: nếu tạo mới → skip. Nếu edit và allowedFormats đổi →
    // tính types BỊ BỎ → count cards affected → show confirm nếu > 0.
    if (isCreate || !platform) { doSave(false); return; }
    const oldSet = effectiveAllowedSet(platform.allowedFormats);
    const newSet = effectiveAllowedSet(form.allowedFormats);
    const removedTypes = [...oldSet].filter((t) => !newSet.has(t));
    if (removedTypes.length === 0) { doSave(false); return; }
    setBusy(true); setError(null);
    startTransition(async () => {
      const counts = await countCardsByContentTypeForPlatform(platform.key);
      const affected = counts.filter((c) => removedTypes.includes(c.contentType) && c.count > 0);
      setBusy(false);
      if (affected.length === 0) { doSave(false); return; }
      setConfirmRemoval({ removedTypes, affected });
    });
  };

  // 2-step delete confirm (no native confirm — feedback_no_native_dialogs)
  const [confirmDelete, setConfirmDelete] = useState(false);
  const handleDelete = () => {
    if (!platform) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    startTransition(async () => {
      const res = await deletePlatform(platform.key);
      if (!res.ok) { setError(res.error || 'Xóa thất bại'); setConfirmDelete(false); return; }
      router.refresh();
      onClose();
    });
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) e.stopPropagation(); }}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="id-line">{platform?.key ?? 'NEW PLATFORM'}</div>
            <h2>{isCreate ? '+ New platform' : `Edit ${platform!.label}`}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ padding: '8px 14px', background: 'rgba(255,77,94,.08)', borderBottom: '1px solid rgba(255,77,94,.3)', color: 'var(--bad)', fontSize: 12 }}>⚠ {error}</div>}

        <AIFormParser
          context="Platform catalog entry. Parse from website URL, About/Pricing page, or paste platform description."
          currentValues={{
            key: form.key, label: form.label, signupUrl: form.signupUrl,
            postUrl: form.postUrl, profileUrlPattern: form.profileUrlPattern,
            priority: form.priority, iconSlug: form.iconSlug, description: form.description,
            pricing: form.pricing, region: form.region, category: form.category,
            userCountEstimate: form.userCountEstimate,
            tagsStr: form.tags.join(', '),
          }}
          schema={[
            { key: 'label', label: 'Display name (e.g. "Hacker News")' },
            { key: 'key', label: 'Unique slug, lowercase no spaces' },
            { key: 'signupUrl', label: 'Signup/register URL' },
            { key: 'postUrl', label: 'Submit/post URL' },
            { key: 'profileUrlPattern', label: 'Profile URL pattern with {handle} placeholder' },
            { key: 'priority', label: 'Priority', type: 'enum', enumValues: ['critical', 'high', 'medium', 'low'] },
            { key: 'iconSlug', label: 'Simple Icons slug' },
            { key: 'description', label: 'Short 1-2 sentence description — what it does, audience, USP' },
            { key: 'pricing', label: 'Pricing summary (e.g. "Free", "Free + Pro $9/mo")' },
            { key: 'region', label: 'ISO 2-letter country code or "global"' },
            { key: 'category', label: 'Category', type: 'enum', enumValues: ['community', 'social', 'video', 'blog', 'launch', 'marketplace', 'messaging', 'newsletter', 'design', 'audio', 'other'] },
            { key: 'userCountEstimate', label: 'User count estimate' },
            { key: 'tagsStr', label: 'Comma-separated tags (e.g. "b2b, viral, vietnam, oss")' },
          ]}
          onApply={(v) => setForm((f) => ({
            ...f,
            label: typeof v.label === 'string' ? v.label : f.label,
            key: !platform && typeof v.key === 'string' ? v.key : f.key,
            signupUrl: typeof v.signupUrl === 'string' ? v.signupUrl : f.signupUrl,
            postUrl: typeof v.postUrl === 'string' ? v.postUrl : f.postUrl,
            profileUrlPattern: typeof v.profileUrlPattern === 'string' ? v.profileUrlPattern : f.profileUrlPattern,
            priority: (v.priority as PlatformPriority) || f.priority,
            iconSlug: typeof v.iconSlug === 'string' ? v.iconSlug : f.iconSlug,
            description: typeof v.description === 'string' ? v.description : f.description,
            pricing: typeof v.pricing === 'string' ? v.pricing : f.pricing,
            region: typeof v.region === 'string' ? v.region : f.region,
            category: typeof v.category === 'string' ? v.category : f.category,
            userCountEstimate: typeof v.userCountEstimate === 'string' ? v.userCountEstimate : f.userCountEstimate,
            tags: typeof v.tagsStr === 'string'
              ? Array.from(new Set([...f.tags, ...v.tagsStr.split(/[,\n]/).map((t) => t.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')).filter(Boolean)]))
              : f.tags,
          }))}
        />

        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <span style={lbl}>Label *</span>
            <NoFillInput style={fld} value={form.label} onChange={(e) => setF('label', e.target.value)} />
          </div>
          <div>
            <span style={lbl}>Key (slug) {isCreate ? '*' : ''}</span>
            <NoFillInput style={fld} disabled={!isCreate} placeholder="auto từ label nếu rỗng"
                         value={form.key} onChange={(e) => setF('key', e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))} />
          </div>
          <div style={{ gridColumn: '1 / 3' }}>
            <span style={lbl}>Signup URL *</span>
            <NoFillInput style={fld} type="url" placeholder="https://..." value={form.signupUrl} onChange={(e) => setF('signupUrl', e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / 3' }}>
            <span style={lbl}>Post URL <span style={{ color: 'var(--fg-4)' }}>(optional)</span></span>
            <NoFillInput style={fld} type="url" placeholder="https://...submit" value={form.postUrl} onChange={(e) => setF('postUrl', e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / 3' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ ...lbl, marginBottom: 0 }}>
                Profile URL pattern <span style={{ color: 'var(--fg-4)' }}>(optional · {`{handle}`} placeholder)</span>
              </span>
              {suggestedProfileUrl && form.profileUrlPattern !== suggestedProfileUrl && (
                <button type="button"
                  onClick={() => setF('profileUrlPattern', suggestedProfileUrl)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 10.5, cursor: 'pointer', padding: 0 }}
                  title={`Apply suggestion: ${suggestedProfileUrl}`}
                >
                  💡 Apply suggested
                </button>
              )}
            </div>
            <NoFillInput style={fld} type="url"
              placeholder="https://www.example.com/user/{handle}"
              value={form.profileUrlPattern}
              onChange={(e) => setF('profileUrlPattern', e.target.value)} />
            {suggestedProfileUrl && !form.profileUrlPattern && (
              <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
                💡 Suggested: <span style={{ color: 'var(--accent)' }}>{suggestedProfileUrl}</span>
              </div>
            )}
            {!suggestedProfileUrl && form.key && (
              <div style={{ fontSize: 10, color: 'var(--fg-4)', marginTop: 3, fontStyle: 'italic' }}>
                Chưa có suggestion cho key &quot;{form.key}&quot; trong hardcoded map.
              </div>
            )}
          </div>
          <div>
            <span style={lbl}>Priority</span>
            <select style={fld} value={form.priority} onChange={(e) => setF('priority', e.target.value as PlatformPriority)}>
              {PRIORITY_ORDER.map((p) => <option key={p} value={p}>{PRIORITY_META[p].star} {PRIORITY_META[p].label.toLowerCase()}</option>)}
            </select>
          </div>
          <div>
            <span style={lbl}>Icon slug <span style={{ color: 'var(--fg-4)' }}>(simpleicons.org)</span></span>
            <NoFillInput style={fld} placeholder="auto từ key"
                         value={form.iconSlug} onChange={(e) => setF('iconSlug', e.target.value.toLowerCase())} />
          </div>
          <div style={{ gridColumn: '1 / 3' }}>
            <span style={lbl}>Description <span style={{ color: 'var(--fg-4)' }}>(1-2 sentences)</span></span>
            <textarea style={{ ...fld, minHeight: 50, fontFamily: 'inherit', resize: 'vertical' }}
                      placeholder="Forum tech VN, ML-driven FYP, B2B-focused..."
                      value={form.description} onChange={(e) => setF('description', e.target.value)} />
          </div>
          <div>
            <span style={lbl}>Category</span>
            <select style={fld} value={form.category} onChange={(e) => setF('category', e.target.value)}>
              {['community', 'social', 'video', 'blog', 'launch', 'marketplace', 'messaging', 'newsletter', 'design', 'audio', 'other'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <span style={lbl}>Region <span style={{ color: 'var(--fg-4)' }}>(US, VN, global...)</span></span>
            <NoFillInput style={fld} placeholder="US, VN, global"
                         value={form.region} onChange={(e) => setF('region', e.target.value)} />
          </div>
          <div>
            <span style={lbl}>Pricing</span>
            <NoFillInput style={fld} placeholder="Free / $9/mo..."
                         value={form.pricing} onChange={(e) => setF('pricing', e.target.value)} />
          </div>
          <div>
            <span style={lbl}>User count estimate</span>
            <NoFillInput style={fld} placeholder="1B MAU, 5M users..."
                         value={form.userCountEstimate} onChange={(e) => setF('userCountEstimate', e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / 3' }}>
            <span style={lbl}>Tags</span>
            <TagsInput value={form.tags} onChange={(t) => setF('tags', t)} placeholder="b2b, oss, viral, vietnam..." />
          </div>

          {/* ── Allowed content formats (override hardcoded) ── */}
          <div style={{ gridColumn: '1 / 3', borderTop: '1px dashed var(--line)', paddingTop: 10, marginTop: 2 }}>
            <span style={{ ...lbl, color: 'var(--accent)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              📋 Loại bài hỗ trợ
              <span style={{ fontSize: 10, color: 'var(--fg-4)', textTransform: 'none', fontWeight: 400 }}>
                // default cho mọi habitat của platform này (habitat có thể override thêm)
              </span>
            </span>
            {(() => {
              const hardcodedDefault = new Set(allowedFormats(form.key, form.category as string).map((f) => f.key));
              const override = form.allowedFormats;
              const isOverridden = override != null && Array.isArray(override);
              const selected = new Set(isOverridden ? override : Array.from(hardcodedDefault));
              const toggle = (k: string) => {
                const next = new Set(selected);
                if (next.has(k)) next.delete(k); else next.add(k);
                const arr = Array.from(next);
                const sameAsDefault = arr.length === hardcodedDefault.size && arr.every((x) => hardcodedDefault.has(x));
                setF('allowedFormats', sameAsDefault ? null : arr);
              };
              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 6 }}>
                    {CONTENT_FORMATS.map((f) => {
                      const on = selected.has(f.key);
                      const inHardcoded = hardcodedDefault.has(f.key);
                      const col = formatColors(f.key);
                      return (
                        <label key={f.key} title={`${f.label} — ${f.hint}${inHardcoded ? '\n(hardcoded default: có)' : '\n(hardcoded default: không)'}`}
                               style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
                                        padding: '4px 7px', borderRadius: 5, cursor: 'pointer',
                                        background: on ? col.bg : 'var(--bg-2)',
                                        border: `1px solid ${on ? col.border : 'var(--line)'}`,
                                        color: on ? col.fg : (inHardcoded ? 'var(--fg-2)' : 'var(--fg-4)'),
                                        opacity: on ? 1 : (inHardcoded ? 0.7 : 0.45) }}>
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
                  <div style={{ marginTop: 4, fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)',
                                display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isOverridden
                      ? <>Override: <strong style={{ color: 'var(--fg-2)' }}>{(override ?? []).length}/{CONTENT_FORMATS.length}</strong> loại</>
                      : <>Dùng hardcoded fallback: <strong style={{ color: 'var(--fg-2)' }}>{hardcodedDefault.size}/{CONTENT_FORMATS.length}</strong> loại</>}
                    {isOverridden && (
                      <button type="button" onClick={() => setF('allowedFormats', null)}
                              style={{ fontSize: 9.5, padding: '1px 6px', background: 'transparent',
                                       color: 'var(--fg-3)', border: '1px solid var(--line)', borderRadius: 3,
                                       cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                        reset → hardcoded
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>

          {/* ── Technology engine section ── */}
          <div style={{ gridColumn: '1 / 3', borderTop: '1px dashed var(--line)', paddingTop: 10, marginTop: 2 }}>
            <span style={{ ...lbl, color: 'var(--accent)', marginBottom: 6 }}>
              ⚙ Engine / CMS / framework
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <TechnologyPicker
                  technologies={technologies}
                  value={form.technologyKey}
                  onChange={(k) => setF('technologyKey', k)}
                  fld={fld}
                />
              </div>
              <button type="button" onClick={handleDetect} disabled={detecting || !form.signupUrl}
                title={form.signupUrl ? 'Auto-detect engine từ signup URL' : 'Nhập signup URL trước'}
                style={{
                  flexShrink: 0, padding: '5px 9px', fontSize: 11, whiteSpace: 'nowrap',
                  background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 4,
                  color: detecting ? 'var(--fg-3)' : 'var(--accent)', cursor: detecting ? 'wait' : 'pointer',
                }}>
                {detecting ? '...' : '🔍 Detect'}
              </button>
            </div>
            {detectMsg && (
              <div style={{ fontSize: 10.5, marginTop: 4, fontFamily: 'var(--font-mono)',
                color: detectMsg.ok ? 'var(--good)' : 'var(--fg-3)' }}>
                {detectMsg.text}
              </div>
            )}
          </div>

          {/* ── Platform signup fields override ── */}
          <div style={{ gridColumn: '1 / 3' }}>
            <div style={{ marginBottom: 4 }}>
              <span style={{ ...lbl, marginBottom: 0 }}>
                Signup fields
                <span style={{ color: 'var(--fg-4)', textTransform: 'none', marginLeft: 4 }}>
                  // platform-specific overrides; inherits from engine above
                </span>
              </span>
            </div>
            <SignupFieldsBuilder
              fields={form.signupFields}
              onChange={(fields) => setF('signupFields', fields)}
            />
          </div>

          {/* Reverse view — communities (habitats) using this platform.
              Click row → navigate to that project's tribes page with habitat opened. */}
          {!isCreate && (
            <div style={{ gridColumn: '1 / 3', marginTop: 6 }}>
              <span style={{ ...lbl, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <IconCommunity size={11} color="var(--accent)" />
                Communities dùng platform này
                <span style={{ color: 'var(--fg-4)', textTransform: 'none', fontWeight: 400 }}>
                  // {communities.length} cross-project
                </span>
              </span>
              {communities.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--fg-3)', padding: 8, background: 'var(--bg-2)', border: '1px dashed var(--line)', borderRadius: 5 }}>
                  Chưa có habitat nào link tới platform này. Add habitat ở /p/{'{id}'}/tribes hoặc dùng auto-detect khi paste URL.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                  {communities.map((c) => (
                    <Link key={c.id} href={`/p/${c.projectId}/tribes?habitat=${c.id}`}
                          onClick={() => onClose()}
                          style={{
                            display: 'block', padding: '6px 8px',
                            background: 'var(--bg-2)', border: '1px solid var(--line)',
                            borderRadius: 5, textDecoration: 'none', color: 'var(--fg-0)', fontSize: 11.5,
                          }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <IconCommunity size={11} color="var(--accent)" />
                        {c.name}
                      </div>
                      <div style={{ fontSize: 9.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span>📁 {c.projectName}</span>
                        {c.tribeName && <span>· ◍ {c.tribeName}</span>}
                        {c.members > 0 && <span>· 👥 {(c.members / 1000).toFixed(c.members > 9999 ? 0 : 1)}k</span>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* LLM-discovered selectors cho ext scrape - chỉ hiện edit-mode (có
              platform tồn tại) vì chưa thể có selectors khi đang create. */}
          {!isCreate && platform && (
            <div style={{ gridColumn: '1 / 3', marginTop: 8 }}>
              <HabitatSelectorsSection platformKey={platform.key} editable={true} />
            </div>
          )}
        </div>

        <div className="modal-foot">
          <div className="meta">
            {platform ? `${platform.accountsCount} accounts · added globally` : 'Adds to platforms catalog (shared across projects)'}
          </div>
          <div className="modal-foot-actions">
            {!isCreate && platform!.accountsCount === 0 && (
              <button
                className="btn danger"
                onClick={handleDelete}
                style={confirmDelete ? { animation: 'pulseDanger 1s ease-in-out infinite' } : undefined}
              >
                {confirmDelete ? '⚠ Click again to confirm' : '🗑 Delete'}
              </button>
            )}
            <button className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn primary" onClick={save} disabled={busy}>
              {busy ? '… Saving' : (isCreate ? 'Create' : 'Save')}
            </button>
          </div>
        </div>
      </div>
      {confirmRemoval && (
        <div className="modal-backdrop" onClick={() => !busy && setConfirmRemoval(null)}>
          <div className="modal" style={{ width: 'min(560px, 96vw)' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div style={{ flex: 1 }}>
                <div className="id-line">PLATFORM FORMAT REMOVAL · CARDS AFFECTED</div>
                <h2 style={{ fontSize: 15, marginTop: 4 }}>
                  ⚠ Bỏ {confirmRemoval.removedTypes.length} loại bài ở platform <strong>{platform?.label}</strong>, còn{' '}
                  {confirmRemoval.affected.reduce((s, a) => s + a.count, 0)} bài đang dùng
                </h2>
              </div>
              <button type="button" className="btn ghost" onClick={() => !busy && setConfirmRemoval(null)} disabled={busy}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 12, color: 'var(--fg-2)', margin: 0 }}>
                Tất cả communities của platform này sẽ không còn hỗ trợ các loại bài sau,
                nhưng vẫn có cards loại đó (tính trên mọi habitat dùng platform):
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
                💡 <strong>Giữ orphan</strong> = cards vẫn hiện — xử lý thủ công sau.
              </div>
            </div>
            <div className="modal-foot" style={{ display: 'flex', gap: 8, padding: 14, justifyContent: 'flex-end' }}>
              <button className="btn ghost" disabled={busy} onClick={() => setConfirmRemoval(null)}>
                Huỷ (không Save)
              </button>
              <button className="btn" disabled={busy}
                      onClick={() => { const c = confirmRemoval; setConfirmRemoval(null); if (c) doSave(false); }}>
                Giữ orphan
              </button>
              <button className="btn primary" disabled={busy}
                      onClick={() => { const c = confirmRemoval; setConfirmRemoval(null); if (c) doSave(true, c.removedTypes); }}>
                {busy ? '… Lưu trữ' : '🗃 Lưu trữ + Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
