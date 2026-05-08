'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createTribe, updateTribe, deleteTribe, type TribeInput } from '@/lib/actions/tribes-crud';
import type { TribeRow } from '@/lib/data';
import { TagsInput } from './tags-input';
import { Spinner } from './ui';
import { AIFormParser } from './ai-form-parser';

const LIFECYCLES = ['discovery', 'active', 'saturated', 'fading', 'defunct'] as const;

export function TribeFormModal({
  projectId, tribe, onClose,
}: {
  projectId: string;
  tribe: TribeRow | null;     // null = create
  onClose: () => void;
}) {
  const router = useRouter();
  const isCreate = !tribe;
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<TribeInput>({
    name: tribe?.name ?? '',
    slug: tribe?.slug ?? '',
    descText: tribe?.descText ?? '',
    signal: tribe?.signal ?? '',
    sentiment: tribe?.sentiment ?? 0,
    lifecycle: (tribe?.lifecycle as TribeInput['lifecycle']) ?? 'discovery',
    lexicon: tribe?.lexicon ?? [],
    avoid: tribe?.avoid ?? [],
    psychographic: tribe?.psychographic ?? '',
  });
  const setF = <K extends keyof TribeInput>(k: K, v: TribeInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const fld: React.CSSProperties = { width: '100%', padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 13, outline: 'none' };
  const lbl: React.CSSProperties = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block' };

  const handleSave = () => {
    setBusy(true); setError(null);
    startTransition(async () => {
      const res = isCreate
        ? await createTribe(projectId, form)
        : await updateTribe(projectId, tribe!.id, form);
      setBusy(false);
      if (!res.ok) { setError(res.error ?? 'Save failed'); return; }
      router.refresh();
      onClose();
    });
  };

  const handleDelete = () => {
    if (!tribe) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    setBusy(true);
    startTransition(async () => {
      await deleteTribe(projectId, tribe.id);
      setBusy(false);
      router.refresh();
      onClose();
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: 'min(720px, 100%)', maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ flex: 1 }}>
            <div className="id-line">{isCreate ? 'NEW TRIBE' : `Tribe #${tribe!.id}`}</div>
            <h2>{isCreate ? '+ New tribe' : tribe!.name}</h2>
          </div>
          <button className="btn ghost" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <AIFormParser
            context="Đây là 1 tribe (audience cluster) cho marketing project. Suy ra từ text/URL: name (ngắn), descText (1-2 câu), signal (vì sao tribe này quan trọng), psychographic (mindset), lexicon (3-7 từ tribe dùng), avoid (3-5 từ tribe ghét)."
            schema={[
              { key: 'name',          label: 'Name',         type: 'string' },
              { key: 'descText',      label: 'Description',  type: 'string' },
              { key: 'signal',        label: 'Signal',       type: 'string' },
              { key: 'psychographic', label: 'Psychographic',type: 'string' },
              { key: 'lexicon',       label: 'Lexicon (comma-separated)', type: 'string' },
              { key: 'avoid',         label: 'Avoid (comma-separated)',   type: 'string' },
            ]}
            currentValues={{ name: form.name, descText: form.descText, signal: form.signal, psychographic: form.psychographic, lexicon: (form.lexicon ?? []).join(', '), avoid: (form.avoid ?? []).join(', ') }}
            onApply={(v) => {
              if (v.name != null)          setF('name', String(v.name));
              if (v.descText != null)      setF('descText', String(v.descText));
              if (v.signal != null)        setF('signal', String(v.signal));
              if (v.psychographic != null) setF('psychographic', String(v.psychographic));
              if (v.lexicon != null)       setF('lexicon', String(v.lexicon).split(',').map((s) => s.trim()).filter(Boolean));
              if (v.avoid != null)         setF('avoid', String(v.avoid).split(',').map((s) => s.trim()).filter(Boolean));
            }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
            <div>
              <label style={lbl}>Name *</label>
              <input type="text" value={form.name} onChange={(e) => setF('name', e.target.value)}
                     style={fld} placeholder="Astrology enthusiasts" autoFocus />
            </div>
            <div>
              <label style={lbl}>Slug <span style={{ color: 'var(--fg-4)', textTransform: 'none' }}>(auto)</span></label>
              <input type="text" value={form.slug} onChange={(e) => setF('slug', e.target.value)}
                     style={{ ...fld, fontFamily: 'var(--font-mono)' }} placeholder="auto from name" />
            </div>
          </div>

          <div>
            <label style={lbl}>Description</label>
            <textarea value={form.descText} onChange={(e) => setF('descText', e.target.value)} rows={2}
                      style={{ ...fld, fontFamily: 'var(--font-sans)', resize: 'vertical' }}
                      placeholder="Short description of who's in this tribe" />
          </div>

          <div>
            <label style={lbl}>Signal <span style={{ color: 'var(--fg-4)', textTransform: 'none' }}>// vì sao tribe này matter</span></label>
            <textarea value={form.signal} onChange={(e) => setF('signal', e.target.value)} rows={2}
                      style={{ ...fld, fontFamily: 'var(--font-sans)', resize: 'vertical' }}
                      placeholder="High-intent paying users; chart-reading questions weekly" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <label style={lbl}>Lifecycle</label>
              <select value={form.lifecycle} onChange={(e) => setF('lifecycle', e.target.value as TribeInput['lifecycle'])} style={fld}>
                {LIFECYCLES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Sentiment <span style={{ color: 'var(--fg-4)', textTransform: 'none' }}>{form.sentiment}</span></label>
              <input type="range" min={-100} max={100} step={5}
                     value={form.sentiment} onChange={(e) => setF('sentiment', Number(e.target.value))}
                     style={{ width: '100%' }} />
            </div>
            <div>
              <label style={lbl}>Psychographic</label>
              <input type="text" value={form.psychographic} onChange={(e) => setF('psychographic', e.target.value)}
                     style={fld} placeholder="seeker, sceptic, lifestyle…" />
            </div>
          </div>

          <div>
            <label style={lbl}>Lexicon <span style={{ color: 'var(--fg-4)', textTransform: 'none' }}>// từ tribe dùng</span></label>
            <TagsInput value={form.lexicon ?? []} onChange={(v) => setF('lexicon', v)} placeholder="natal chart, transit, retrograde…" />
          </div>

          <div>
            <label style={lbl}>Avoid <span style={{ color: 'var(--fg-4)', textTransform: 'none' }}>// từ tribe ghét</span></label>
            <TagsInput value={form.avoid ?? []} onChange={(v) => setF('avoid', v)} placeholder="generic horoscope, fortune-telling, fake guru…" />
          </div>

          {error && (
            <div style={{ padding: 8, background: 'rgba(255,77,94,.1)', border: '1px solid rgba(255,77,94,.4)', color: 'var(--bad)', fontSize: 12, borderRadius: 5 }}>
              {error}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <div className="meta">{isCreate ? 'New tribe' : `Editing #${tribe!.id}`}</div>
          <div className="modal-foot-actions">
            {!isCreate && (
              <button className="btn danger" onClick={handleDelete} disabled={busy}
                      title={confirmDelete ? 'Click lần nữa để xác nhận xoá vĩnh viễn' : 'Xoá tribe (habitats có tribe_id sẽ unlink)'}
                      style={confirmDelete ? { animation: 'pulseDanger 1s ease-in-out infinite' } : undefined}>
                {confirmDelete ? '⚠ Click again to confirm' : '🗑 Delete'}
              </button>
            )}
            <button className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn primary" onClick={handleSave} disabled={busy || !form.name.trim()}>
              {busy ? <><Spinner size="xs" /> Saving</> : (isCreate ? 'Create tribe' : 'Save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
