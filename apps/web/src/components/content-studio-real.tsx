'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { ContentPieceRow } from '@/lib/data';
import { createContentPiece, updateContentPiece, archiveContentPiece, generateContent, type ContentInput } from '@/lib/actions/content';
import { CHANNELS, STATUSES, type ContentStatus } from '@/lib/content-channels';
import type { SkillRow } from '@/lib/actions/library';
import { EmptyState, Pill, StatsStrip, type StatCard } from './ui';

// URL state hook (same pattern as library-page.tsx).
function useUrlParam(key: string, defaultValue: string): [string, (v: string) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get(key) ?? defaultValue;
  const set = (v: string) => {
    const next = new URLSearchParams(params.toString());
    if (!v || v === defaultValue) next.delete(key);
    else next.set(key, v);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return [value, set];
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'var(--fg-3)', approved: 'var(--neon-cyan)', scheduled: 'var(--neon-amber)',
  published: 'var(--ok)', archived: 'var(--fg-4)',
};

export function ContentStudioReal({ items, projectId, projectName, skills, tribes, accounts }: {
  items: ContentPieceRow[];
  projectId: string;
  projectName: string;
  skills: SkillRow[];
  tribes: Array<{ slug: string; name: string }>;
  accounts: Array<{ handle: string; platformKey: string }>;
}) {
  const [editing, setEditing] = useState<ContentPieceRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [channel, setChannel] = useUrlParam('ch', 'all');
  const [status, setStatus] = useUrlParam('st', 'all');
  const [q, setQ] = useUrlParam('q', '');

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return items.filter((p) => {
      if (channel !== 'all' && p.channel !== channel) return false;
      if (status !== 'all' && p.status !== status) return false;
      if (!ql) return true;
      return (p.title + ' ' + p.subject + ' ' + p.tags.join(' ') + ' ' + p.bodyMd).toLowerCase().includes(ql);
    });
  }, [items, channel, status, q]);

  const stats: StatCard[] = useMemo(() => {
    const byCh = new Map<string, number>();
    const byStat = new Map<string, number>();
    for (const p of items) {
      byCh.set(p.channel, (byCh.get(p.channel) ?? 0) + 1);
      byStat.set(p.status, (byStat.get(p.status) ?? 0) + 1);
    }
    return [
      { key: 'total', label: 'Total', value: items.length, color: 'var(--fg-0)' },
      { key: 'draft', label: 'Drafts', value: byStat.get('draft') ?? 0, color: STATUS_COLOR.draft! },
      { key: 'approved', label: 'Approved', value: byStat.get('approved') ?? 0, color: STATUS_COLOR.approved! },
      { key: 'scheduled', label: 'Scheduled', value: byStat.get('scheduled') ?? 0, color: STATUS_COLOR.scheduled! },
      { key: 'published', label: 'Published', value: byStat.get('published') ?? 0, color: STATUS_COLOR.published! },
    ];
  }, [items]);

  const grouped = useMemo(() => {
    const map = new Map<string, ContentPieceRow[]>();
    for (const p of filtered) {
      const arr = map.get(p.channel) ?? [];
      arr.push(p);
      map.set(p.channel, arr);
    }
    // Sort by CHANNELS order
    return CHANNELS
      .filter((c) => map.has(c.id))
      .map((c) => ({ ch: c, items: map.get(c.id)! }));
  }, [filtered]);

  return (
    <div className="page" style={{ padding: 16 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            🎬 Content Studio
            <small>// {items.length} pieces · {projectName}</small>
          </h1>
          <p className="page-sub">Multi-channel content drafts. AI co-pilot via gpt-4o-mini · skill từ /library hỗ trợ persona/style.</p>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => setCreating(true)}>+ New piece</button>
        </div>
      </div>

      <StatsStrip cards={stats} />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, margin: '10px 0 8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="Filter title/body/tags…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: '6px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, fontSize: 12, color: 'var(--fg-0)', outline: 'none' }}
        />
        <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{filtered.length}/{items.length}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        <span className="chip" data-active={channel === 'all' || undefined} onClick={() => setChannel('all')} style={{ cursor: 'pointer', fontSize: 10 }}>all channels</span>
        {CHANNELS.map((c) => {
          const count = items.filter((p) => p.channel === c.id).length;
          if (count === 0) return null;
          return (
            <span key={c.id} className="chip" data-active={channel === c.id || undefined} onClick={() => setChannel(c.id)}
                  style={{ cursor: 'pointer', fontSize: 10 }}>
              {c.icon} {c.label} <span style={{ opacity: 0.6 }}>{count}</span>
            </span>
          );
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
        <span className="chip" data-active={status === 'all' || undefined} onClick={() => setStatus('all')} style={{ cursor: 'pointer', fontSize: 10 }}>all status</span>
        {STATUSES.map((s) => {
          const count = items.filter((p) => p.status === s).length;
          if (count === 0) return null;
          return (
            <span key={s} className="chip" data-active={status === s || undefined} onClick={() => setStatus(s)}
                  style={{ cursor: 'pointer', fontSize: 10, color: STATUS_COLOR[s] }}>
              {s} <span style={{ opacity: 0.6 }}>{count}</span>
            </span>
          );
        })}
      </div>

      {items.length === 0 ? (
        <EmptyState icon="🎬" title="No content pieces" description="Tạo piece đầu tiên — hoặc bấm AI Generate để OpenAI sinh draft từ brief." compact />
      ) : filtered.length === 0 ? (
        <div className="panel"><div className="panel-body" style={{ padding: 16, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>(no match)</div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {grouped.map(({ ch, items: list }) => (
            <div key={ch.id}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--neon-cyan)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{ch.icon} {ch.label}</span>
                <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                <span style={{ opacity: 0.6 }}>{list.length}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                {list.map((p) => (
                  <div key={p.id} className="panel" style={{ cursor: 'pointer' }} onClick={() => setEditing(p)}>
                    <div className="panel-head" style={{ padding: '6px 10px' }}>
                      <div className="panel-title" style={{ fontSize: 12 }}>{p.title}</div>
                      <Pill color={STATUS_COLOR[p.status] ?? 'var(--fg-3)'} label={p.status} size="xs" />
                    </div>
                    <div className="panel-body" style={{ padding: '6px 10px' }}>
                      {p.subject && (
                        <div style={{ fontSize: 11, color: 'var(--fg-1)', fontStyle: 'italic', marginBottom: 4 }}>"{p.subject}"</div>
                      )}
                      <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)', whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.bodyMd.slice(0, 180) || <span style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>(empty)</span>}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 6, alignItems: 'center' }}>
                        {p.tags.slice(0, 4).map((t) => <span key={t} className="chip" style={{ fontSize: 9, padding: '1px 5px' }}>{t}</span>)}
                        {p.tribeSlug && <span style={{ fontSize: 9, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>◍ {p.tribeSlug}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {(editing || creating) && (
        <ContentFormModal
          piece={editing}
          projectId={projectId}
          skills={skills}
          tribes={tribes}
          accounts={accounts}
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}

// ── Form modal with multi-channel preview ─────────────────────────
function ContentFormModal({ piece, projectId, skills, tribes, accounts, onClose }: {
  piece: ContentPieceRow | null;
  projectId: string;
  skills: SkillRow[];
  tribes: Array<{ slug: string; name: string }>;
  accounts: Array<{ handle: string; platformKey: string }>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiSkillSlug, setAiSkillSlug] = useState('');
  const isCreate = !piece;
  const [form, setForm] = useState({
    title: piece?.title ?? '',
    channel: piece?.channel ?? 'fb-post',
    tribeSlug: piece?.tribeSlug ?? '',
    persona: piece?.persona ?? '',
    subject: piece?.subject ?? '',
    bodyMd: piece?.bodyMd ?? '',
    status: (piece?.status ?? 'draft') as ContentStatus,
    tagsStr: (piece?.tags ?? []).join(', '),
    aiNotes: piece?.aiNotes ?? [] as string[],
  });
  const setF = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const fld: React.CSSProperties = { width: '100%', padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 13, outline: 'none' };
  const lbl: React.CSSProperties = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block' };

  const handleSave = () => {
    if (!form.title.trim()) { setError('title required'); return; }
    const payload: ContentInput = {
      title: form.title, channel: form.channel,
      tribeSlug: form.tribeSlug || null, persona: form.persona || null,
      subject: form.subject || null,
      bodyMd: form.bodyMd, status: form.status,
      tags: form.tagsStr.split(',').map((s) => s.trim()).filter(Boolean),
      aiNotes: form.aiNotes,
    };
    startTransition(async () => {
      const res = isCreate
        ? await createContentPiece(projectId, payload)
        : await updateContentPiece(piece!.id, projectId, payload);
      if (!res.ok) { setError(res.error || 'Save failed'); return; }
      router.refresh(); onClose();
    });
  };
  const handleArchive = () => {
    if (!piece) return;
    if (!confirm(`Archive "${piece.title}"?`)) return;
    startTransition(async () => { await archiveContentPiece(piece.id, projectId); router.refresh(); onClose(); });
  };

  const handleAiGenerate = () => {
    if (!aiPrompt.trim()) { setError('Brief prompt required'); return; }
    setAiBusy(true); setError(null);
    const skillBody = aiSkillSlug ? skills.find((s) => s.slug === aiSkillSlug)?.body : undefined;
    generateContent({
      prompt: aiPrompt, channel: form.channel,
      tribeSlug: form.tribeSlug || undefined, persona: form.persona || undefined,
      skillSnippet: skillBody,
    }).then((res) => {
      if (!res.ok) { setError(res.error || 'AI generate failed'); return; }
      setForm((f) => ({
        ...f,
        title: res.title || f.title,
        subject: res.subject || f.subject,
        bodyMd: res.bodyMd || f.bodyMd,
        aiNotes: res.aiNotes ?? f.aiNotes,
      }));
    }).finally(() => setAiBusy(false));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{
          width: '94vw', maxWidth: 1600, height: '92vh',
          display: 'flex', flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div><div className="id-line">{piece?.slug ?? 'NEW PIECE'}</div><h2>{isCreate ? '+ New content piece' : `Edit ${piece!.title}`}</h2></div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ padding: '8px 14px', background: 'rgba(255,77,94,.08)', borderBottom: '1px solid rgba(255,77,94,.3)', color: 'var(--bad)', fontSize: 12 }}>⚠ {error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', flex: 1, minHeight: 0 }}>
          {/* LEFT: form */}
          <div style={{ overflow: 'auto', padding: 14, borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* AI generate */}
            <div style={{ padding: 10, background: 'rgba(157,108,255,.06)', border: '1px solid rgba(157,108,255,.25)', borderRadius: 6 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--neon-violet)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>🤖 AI co-pilot</div>
              <textarea
                placeholder="Brief: vd: 'Reel 30s giới thiệu use-case Orit cho dev agency, tone direct'"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                style={{ ...fld, minHeight: 50, fontSize: 11 }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                <select style={{ ...fld, fontSize: 10, padding: '4px 6px', flex: 1 }} value={aiSkillSlug} onChange={(e) => setAiSkillSlug(e.target.value)}>
                  <option value="">— No skill (default voice) —</option>
                  {skills.slice(0, 30).map((s) => <option key={s.slug} value={s.slug}>✦ {s.title}</option>)}
                </select>
                <button type="button" onClick={handleAiGenerate} disabled={aiBusy} className="btn primary" style={{ fontSize: 10, padding: '4px 10px' }}>
                  {aiBusy ? '⟲ generating…' : 'Generate'}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
              <div>
                <span style={lbl}>Title *</span>
                <input style={fld} value={form.title} onChange={(e) => setF('title', e.target.value)} />
              </div>
              <div>
                <span style={lbl}>Channel</span>
                <select style={fld} value={form.channel} onChange={(e) => setF('channel', e.target.value)}>
                  {CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              <div>
                <span style={lbl}>Status</span>
                <select style={fld} value={form.status} onChange={(e) => setF('status', e.target.value as ContentStatus)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <span style={lbl}>
                  Tribe <span style={{ color: 'var(--fg-4)' }}>(từ /p/{projectId}/tribes)</span>
                </span>
                {tribes.length === 0 ? (
                  <input style={fld} placeholder="empty — tạo tribe trước trong Tribes page" value={form.tribeSlug} onChange={(e) => setF('tribeSlug', e.target.value)} list="tribes-dl" />
                ) : (
                  <select style={fld} value={form.tribeSlug} onChange={(e) => setF('tribeSlug', e.target.value)}>
                    <option value="">— No tribe —</option>
                    {tribes.map((t) => <option key={t.slug} value={t.slug}>◍ {t.name} <span>({t.slug})</span></option>)}
                  </select>
                )}
              </div>
              <div>
                <span style={lbl}>
                  Persona <span style={{ color: 'var(--fg-4)' }}>(từ Accounts vault)</span>
                </span>
                <input
                  style={fld}
                  list="accounts-dl"
                  placeholder={accounts.length === 0 ? 'free-text — chưa có account' : 'pick account hoặc tự nhập'}
                  value={form.persona}
                  onChange={(e) => setF('persona', e.target.value)}
                />
                <datalist id="accounts-dl">
                  {accounts.map((a) => (
                    <option key={`${a.platformKey}-${a.handle}`} value={`${a.handle} · ${a.platformKey}`} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <span style={lbl}>Subject / Hook</span>
              <input style={fld} value={form.subject} onChange={(e) => setF('subject', e.target.value)} />
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 200 }}>
              <span style={lbl}>Body (markdown) *</span>
              <textarea
                style={{ ...fld, flex: 1, minHeight: 240, resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.5 }}
                value={form.bodyMd}
                onChange={(e) => setF('bodyMd', e.target.value)}
              />
            </div>

            <div>
              <span style={lbl}>Tags</span>
              <input style={fld} value={form.tagsStr} onChange={(e) => setF('tagsStr', e.target.value)} />
            </div>

            {form.aiNotes.length > 0 && (
              <div>
                <span style={lbl}>AI notes</span>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 11, color: 'var(--fg-2)' }}>
                  {form.aiNotes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            )}
          </div>

          {/* RIGHT: live preview */}
          <div style={{ overflow: 'auto', padding: 14, background: 'var(--bg-1)' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              📱 Channel preview · {form.channel}
            </div>
            <ChannelPreview
              channel={form.channel}
              title={form.title}
              subject={form.subject}
              persona={form.persona}
              bodyMd={form.bodyMd}
            />
          </div>
        </div>

        <div className="modal-foot">
          <div className="meta">{isCreate ? 'New' : `Editing #${piece!.id}`}</div>
          <div className="modal-foot-actions">
            {!isCreate && <button className="btn danger" onClick={handleArchive}>🗑 Archive</button>}
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={handleSave}>{isCreate ? 'Create' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Channel-specific preview shell ────────────────────────────────
function ChannelPreview({ channel, title, subject, persona, bodyMd }: {
  channel: string; title: string; subject?: string | null; persona?: string | null; bodyMd: string;
}) {
  const card: React.CSSProperties = {
    background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 8,
    padding: 14, fontSize: 13, lineHeight: 1.55, color: 'var(--fg-0)',
    whiteSpace: 'pre-wrap',
  };
  const meta: React.CSSProperties = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', marginBottom: 8 };
  const empty = !bodyMd.trim();

  if (channel === 'fb-post') {
    return (
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-2)' }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{persona || 'Page name'}</div>
            <div style={meta}>Đề xuất · 12 phút · 🌐</div>
          </div>
        </div>
        {subject && <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>{subject}</div>}
        <div>{empty ? <span style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>(empty body)</span> : bodyMd}</div>
        <div style={{ display: 'flex', gap: 14, paddingTop: 8, marginTop: 10, borderTop: '1px solid var(--line)', fontSize: 11, color: 'var(--fg-3)' }}>
          <span>👍 React</span><span>💬 Comment</span><span>↗ Share</span>
        </div>
      </div>
    );
  }

  if (channel === 'email') {
    return (
      <div style={{ ...card, background: 'var(--bg-1)' }}>
        <div style={meta}>From: {persona || 'sender@brand.vn'}</div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Subject: {subject || title || '(no subject)'}</div>
        <div style={meta}>Preview text · 06:30 sáng</div>
        <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '10px 0' }} />
        <div>{empty ? <span style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>(empty body)</span> : bodyMd}</div>
      </div>
    );
  }

  if (channel === 'twitter-thread') {
    const tweets = bodyMd.split(/\n\n+/).filter(Boolean);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tweets.length === 0
          ? <div style={card}><span style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>(empty thread)</span></div>
          : tweets.map((t, i) => (
            <div key={i} style={card}>
              <div style={meta}>{persona || '@you'} · {i + 1}/{tweets.length}</div>
              <div>{t}</div>
            </div>
          ))}
      </div>
    );
  }

  if (channel === 'reel') {
    return (
      <div style={{ ...card, padding: 0, aspectRatio: '9 / 16', maxWidth: 280, margin: '0 auto', overflow: 'hidden', position: 'relative', background: 'linear-gradient(180deg, #1a1a2e, #0a0a1a)' }}>
        <div style={{ position: 'absolute', inset: 0, padding: 14, display: 'flex', flexDirection: 'column' }}>
          <div style={meta}>{persona || '@creator'} · Reel</div>
          {subject && <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6, color: '#fff', lineHeight: 1.2, textShadow: '0 1px 4px rgba(0,0,0,.6)' }}>{subject}</div>}
          <div style={{ fontSize: 11, lineHeight: 1.5, marginTop: 'auto', color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,.7)' }}>
            {empty ? <span style={{ color: 'rgba(255,255,255,.4)', fontStyle: 'italic' }}>(empty script)</span> : bodyMd.slice(0, 280)}
          </div>
        </div>
      </div>
    );
  }

  if (channel === 'ad') {
    return (
      <div style={{ ...card, maxWidth: 360 }}>
        <div style={meta}>Sponsored · {persona || 'Brand'}</div>
        <div style={{ aspectRatio: '4/3', background: 'var(--bg-2)', borderRadius: 4, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-4)', fontSize: 10 }}>[creative]</div>
        {subject && <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{subject}</div>}
        <div style={{ fontSize: 12 }}>{empty ? <span style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>(empty copy)</span> : bodyMd}</div>
        <button style={{ marginTop: 8, padding: '6px 12px', background: 'var(--accent)', color: '#000', border: 0, borderRadius: 5, fontSize: 11, fontWeight: 600 }}>Learn more</button>
      </div>
    );
  }

  if (channel === 'dm') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 340 }}>
        <div style={{ ...card, background: 'rgba(0,229,255,.08)', alignSelf: 'flex-end', maxWidth: '85%', borderRadius: '8px 8px 2px 8px' }}>
          <div>{empty ? <span style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>(empty message)</span> : bodyMd}</div>
        </div>
        <div style={meta}>{persona || '@you'} · sent</div>
      </div>
    );
  }

  // Default: blog/landing/youtube-script + fallbacks
  return (
    <div style={card}>
      {title && <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{title}</h3>}
      {subject && <div style={{ fontSize: 12, color: 'var(--fg-2)', fontStyle: 'italic', marginBottom: 8 }}>{subject}</div>}
      <div>{empty ? <span style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>(empty body)</span> : bodyMd}</div>
    </div>
  );
}
