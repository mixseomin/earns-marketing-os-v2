'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createTribe, updateTribe, deleteTribe, type TribeInput } from '@/lib/actions/tribes-crud';
import type { TribeRow } from '@/lib/data';
import { TagsInput } from './tags-input';
import { Spinner, FormModal, fieldStyle, labelStyle, ConfirmDeleteButton } from './ui';
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

  const fld = fieldStyle({ size: 'lg' });
  const lbl = labelStyle;

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
    setBusy(true);
    startTransition(async () => {
      await deleteTribe(projectId, tribe.id);
      setBusy(false);
      router.refresh();
      onClose();
    });
  };

  return (
    <FormModal
      kind="tribe"
      action={isCreate ? 'create' : 'edit'}
      idText={isCreate ? undefined : `#${tribe!.id}`}
      title={isCreate ? 'Tribe mới' : tribe!.name}
      subtitle="Nhóm đối tượng (audience cluster) — định danh / lexicon / psychographic"
      width={960}
      preventBackdropClose
      onClose={onClose}
    >
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

          <div className="modal-cols cols-2">
          <div className="modal-col">

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

          </div>{/* /modal-col: nội dung tribe */}
          <div className="modal-col">

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

          </div>{/* /modal-col: phân loại + lexicon */}
          </div>{/* /modal-cols */}

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
              <ConfirmDeleteButton
                onDelete={handleDelete} disabled={busy}
                title="Xoá tribe (habitats có tribe_id sẽ unlink) / Click lần nữa để xác nhận xoá vĩnh viễn"
              />
            )}
            <button className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn primary" onClick={handleSave} disabled={busy || !form.name.trim()}>
              {busy ? <><Spinner size="xs" /> Saving</> : (isCreate ? 'Create tribe' : 'Save')}
            </button>
          </div>
        </div>
    </FormModal>
  );
}
