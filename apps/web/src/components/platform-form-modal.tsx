'use client';

// Reusable Platform CRUD modal — mở được từ /platforms admin page,
// từ account modal (✏️ edit), từ publication picker, etc.
// Pattern: feedback_picker_inline_crud.md (edit-anywhere via modal).

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  type PlatformWithUsage, type PlatformPriority, type PlatformCategory,
  createPlatform, updatePlatform, deletePlatform,
} from '@/lib/actions/platforms';
import { AIFormParser } from './ai-form-parser';
import { NoFillInput } from './no-fill-input';
import { TagsInput } from './tags-input';
import { getSuggestedProfileUrlPattern } from '@/lib/platform-profile-urls';

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
  });
  const suggestedProfileUrl = useMemo(() => {
    if (!form.key) return null;
    return getSuggestedProfileUrlPattern(form.key);
  }, [form.key]);
  const setF = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const fld: React.CSSProperties = {
    width: '100%', padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)',
    borderRadius: 5, color: 'var(--fg-0)', fontSize: 13, outline: 'none',
  };
  const lbl: React.CSSProperties = {
    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block',
  };

  const save = () => {
    setError(null);
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
      };
      const res = isCreate ? await createPlatform(payload) : await updatePlatform(platform!.key, payload);
      if (!res.ok) { setError(res.error || 'Lưu thất bại'); return; }
      router.refresh();
      onClose();
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
            ...form,
            tagsStr: form.tags.join(', '),
            tags: undefined as never,
          } as Record<string, string | number | boolean | null | undefined>}
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
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={save}>{isCreate ? 'Create' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
