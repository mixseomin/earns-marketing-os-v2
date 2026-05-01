'use client';

import { useState, useTransition, useEffect } from 'react';
import type { Mode, Card } from '@/lib/mock/types';
import { createCard, updateCard, deleteCard, approveCard, rejectCard, escalateCard } from '@/lib/actions/cards';

type Level = 1 | 2 | 3 | 4;
type Mode_ = 'view' | 'edit' | 'create';

interface FormState {
  title: string;
  body: string;
  squadKey: string;
  col: string;
  level: Level;
  money: string;
  due: string;
  urgent: boolean;
  tagsInput: string;
  agentRef: string;
  agentKind: string;          // '' = not assigned
}

const emptyForm = (col: string, squadKey: string): FormState => ({
  title: '',
  body: '',
  squadKey,
  col,
  level: 2,
  money: '',
  due: '',
  urgent: false,
  tagsInput: '',
  agentRef: '',
  agentKind: '',
});

const AGENT_KINDS: Array<{ value: string; label: string; hint: string }> = [
  { value: '',                    label: '— No agent (manual) —',     hint: 'Card không auto-execute. User làm thủ công.' },
  { value: 'gpt-4o-mini',         label: 'GPT-4o mini (cheap, API)',   hint: 'Worker daemon pick up khi col=approved + squad reasoning ON.' },
  { value: 'gpt-4o',              label: 'GPT-4o (smart, API)',        hint: 'Đắt hơn 16x mini.' },
  { value: 'claude-haiku-4-5',    label: 'Claude Haiku 4.5 (cheap+capable)', hint: 'Tốt cho reasoning + tool-use.' },
  { value: 'claude-sonnet-4-6',   label: 'Claude Sonnet 4.6 (smart)',  hint: 'Đắt nhưng reasoning chất.' },
  { value: 'claude-code',         label: 'Claude Code (IDE, qua MCP)', hint: 'Worker SKIP, chờ user pull qua Claude Code MCP.' },
  { value: 'human',               label: 'Human (queue inbox)',         hint: 'Tạo human_task khi card approved.' },
];

export function CardModal({
  open, viewMode, card, projectId, mode, defaultCol, onClose, onSaved,
}: {
  open: boolean;
  viewMode?: Mode_;
  mode: Mode;
  card: Card | null;
  projectId: string;
  defaultCol?: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [editing, setEditing] = useState<Mode_>(viewMode ?? 'view');
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const initialSquad = card?.squad ?? mode.squads[0]?.id ?? '';
  const [form, setForm] = useState<FormState>(() => {
    if (card) {
      return {
        title: card.title,
        body: card.body ?? '',
        squadKey: card.squad,
        col: card.col,
        level: card.level,
        money: card.money ?? '',
        due: card.due ?? '',
        urgent: !!card.urgent,
        tagsInput: (card.tags ?? []).join(', '),
        agentRef: card.agent ?? '',
        agentKind: card.agentKind ?? '',
      };
    }
    return emptyForm(defaultCol ?? mode.columns[0]?.id ?? 'needs', initialSquad);
  });

  // Reset form when card changes (different card opened) or mode toggles to create.
  useEffect(() => {
    if (!open) return;
    if (card) {
      setForm({
        title: card.title,
        body: card.body ?? '',
        squadKey: card.squad,
        col: card.col,
        level: card.level,
        money: card.money ?? '',
        due: card.due ?? '',
        urgent: !!card.urgent,
        tagsInput: (card.tags ?? []).join(', '),
        agentRef: card.agent ?? '',
        agentKind: card.agentKind ?? '',
      });
      setEditing('view');
    } else {
      setForm(emptyForm(defaultCol ?? mode.columns[0]?.id ?? 'needs', initialSquad));
      setEditing('create');
    }
    setError(null);
  }, [open, card?.id, defaultCol]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const isCreate = editing === 'create';
  const isEdit = editing === 'edit';
  const isView = editing === 'view';
  const squad = mode.squads.find((s) => s.id === form.squadKey);

  const setF = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const parseTags = (s: string): string[] =>
    s.split(',').map((t) => t.trim()).filter(Boolean);

  const handleSave = () => {
    if (!form.title.trim()) { setError('Title không được rỗng'); return; }
    const payload = {
      title: form.title,
      body: form.body || null,
      squadKey: form.squadKey,
      col: form.col,
      level: form.level,
      money: form.money || null,
      due: form.due,
      urgent: form.urgent,
      tags: parseTags(form.tagsInput),
      agentRef: form.agentRef || null,
      agentKind: form.agentKind || null,
    };
    startTransition(async () => {
      const res = isCreate
        ? await createCard(projectId, payload)
        : await updateCard(projectId, card!.id, payload);
      if (!res.ok) { setError(res.error || 'Lưu thất bại'); return; }
      setError(null);
      onSaved?.();
      onClose();
    });
  };

  const handleDelete = () => {
    if (!card) return;
    if (!confirm(`Xoá card "${card.id}"? Không thể undo.`)) return;
    startTransition(async () => {
      const res = await deleteCard(projectId, card.id);
      if (!res.ok) { alert(res.error); return; }
      onSaved?.();
      onClose();
    });
  };

  const handleAction = (a: 'approve' | 'reject' | 'escalate') => {
    if (!card) return;
    startTransition(async () => {
      const fn = a === 'approve' ? approveCard : a === 'reject' ? rejectCard : escalateCard;
      const res = await fn(projectId, card.id);
      if (!res.ok) { alert(res.error); return; }
      onSaved?.();
      onClose();
    });
  };

  const fld: React.CSSProperties = {
    width: '100%', padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)',
    borderRadius: 5, color: 'var(--fg-0)', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none',
  };
  const lbl: React.CSSProperties = {
    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block',
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ flex: 1 }}>
            <div className="id-line">
              {card?.id ?? 'NEW'} • {squad?.icon} {squad?.name} • Trust Level {form.level}
            </div>
            {isView ? (
              <h2>{card?.title}</h2>
            ) : (
              <input style={{ ...fld, fontSize: 18, fontWeight: 600, padding: '4px 8px' }} autoFocus
                     value={form.title} onChange={(e) => setF('title', e.target.value)}
                     placeholder="Card title…" />
            )}
          </div>
          {isView && card && <button className="btn" onClick={() => setEditing('edit')} style={{ marginRight: 8 }}>✎ Edit</button>}
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {error && (
          <div style={{ padding: '8px 14px', background: 'rgba(255,77,94,.08)', borderBottom: '1px solid rgba(255,77,94,.3)', color: 'var(--bad)', fontSize: 12 }}>
            ⚠ {error}
          </div>
        )}

        <div className="modal-body">
          {isView && card ? (
            <>
              <div className="modal-grid">
                <div className="modal-cell">
                  <div className="lbl">Expected impact</div>
                  <div className={`val ${card.money?.startsWith('-') ? 'bad' : 'ok'}`}>{card.money || '—'}</div>
                </div>
                <div className="modal-cell">
                  <div className="lbl">Deadline</div>
                  <div className={`val ${card.urgent || card.due === 'NOW' ? 'bad' : 'warn'}`}>{card.due || '—'}</div>
                </div>
                <div className="modal-cell">
                  <div className="lbl">Squad / Agent</div>
                  <div className="val" style={{ fontSize: 16 }}>{squad?.icon} {squad?.name}</div>
                  <div className="sub mono">@{card.agent}</div>
                </div>
                <div className="modal-cell">
                  <div className="lbl">Trust Level</div>
                  <div className="val" style={{ color: `var(--l${card.level})` }}>L{card.level}</div>
                </div>
              </div>
              {card.body && (<>
                <div className="modal-section-title">Agent reasoning</div>
                <div className="modal-text">{card.body}</div>
              </>)}
              {(card.tags ?? []).length > 0 && (<>
                <div className="modal-section-title">Tags</div>
                <div className="kcard-tags">
                  {card.tags!.map((t, i) => <span key={i} className="tag">{t}</span>)}
                </div>
              </>)}
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <span style={lbl}>Squad</span>
                <select style={fld} value={form.squadKey} onChange={(e) => setF('squadKey', e.target.value)}>
                  {mode.squads.length === 0 && <option value="">— no squads (tạo squad trước) —</option>}
                  {mode.squads.map((s) => (
                    <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <span style={lbl}>Column</span>
                <select style={fld} value={form.col} onChange={(e) => setF('col', e.target.value)}>
                  {mode.columns.map((c) => (
                    <option key={c.id} value={c.id}>{c.icon} {c.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <span style={lbl}>Trust Level</span>
                <select style={fld} value={form.level} onChange={(e) => setF('level', Number(e.target.value) as Level)}>
                  <option value={1}>L1 — Auto</option>
                  <option value={2}>L2 — Notify</option>
                  <option value={3}>L3 — Approve needed</option>
                  <option value={4}>L4 — Escalate</option>
                </select>
              </div>
              <div>
                <span style={lbl}>Deadline</span>
                <input style={fld} placeholder="e.g. 3h, NOW, open, T+2" value={form.due} onChange={(e) => setF('due', e.target.value)} />
              </div>
              <div>
                <span style={lbl}>Money / impact</span>
                <input style={fld} placeholder="e.g. +18tr/m, -2.4tr/d" value={form.money} onChange={(e) => setF('money', e.target.value)} />
              </div>
              <div>
                <span style={lbl}>Agent ref</span>
                <input style={fld} placeholder="e.g. RES-04, you" value={form.agentRef} onChange={(e) => setF('agentRef', e.target.value)} />
              </div>
              <div style={{ gridColumn: '1 / -1', padding: 8, background: 'rgba(157,108,255,.06)', border: '1px solid rgba(157,108,255,.25)', borderRadius: 5 }}>
                <span style={lbl}>🤖 Agent kind <span style={{ color: 'var(--fg-4)' }}>(Phase 10 dispatch — worker daemon)</span></span>
                <select style={fld} value={form.agentKind} onChange={(e) => setF('agentKind', e.target.value)}>
                  {AGENT_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
                <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                  {AGENT_KINDS.find((k) => k.value === form.agentKind)?.hint ?? ''}
                  {form.agentKind && form.col !== 'approved' && (
                    <div style={{ marginTop: 4, color: 'var(--warn)' }}>
                      ⚠ Card đang ở col <b>{form.col}</b>. Worker chỉ pick card ở col <b>approved</b>. Move card sang approved (qua /board hoặc set col field bên trên) để dispatch.
                    </div>
                  )}
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={lbl}>Tags (comma-separated)</span>
                <input style={fld} placeholder="e.g. Shopee, Winner, Critical" value={form.tagsInput} onChange={(e) => setF('tagsInput', e.target.value)} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={lbl}>Body (agent reasoning)</span>
                <textarea style={{ ...fld, minHeight: 80, resize: 'vertical' }}
                          placeholder="Mô tả chi tiết / lý do AI đề xuất / context…"
                          value={form.body} onChange={(e) => setF('body', e.target.value)} />
              </div>
              <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--fg-1)' }}>
                <input type="checkbox" checked={form.urgent} onChange={(e) => setF('urgent', e.target.checked)} /> Mark urgent
              </label>
            </div>
          )}
        </div>

        <div className="modal-foot">
          <div className="meta">
            {isView ? '⌘↵ approve • ⌘⌫ reject • esc close' : isEdit ? 'Editing — Save để áp dụng' : 'New card'}
          </div>
          <div className="modal-foot-actions">
            {isView && card && (
              <>
                <button className="btn ghost" onClick={onClose}>Close</button>
                <button className="btn danger" onClick={() => handleAction('reject')}>✕ Reject</button>
                <button className="btn" onClick={() => handleAction('escalate')}>↑ Escalate</button>
                <button className="btn success" onClick={() => handleAction('approve')}>✓ Approve</button>
              </>
            )}
            {(isEdit || isCreate) && (
              <>
                {isEdit && card && <button className="btn danger" onClick={handleDelete}>🗑 Delete</button>}
                <button className="btn ghost" onClick={isEdit ? () => setEditing('view') : onClose}>Cancel</button>
                <button className="btn primary" onClick={handleSave}>{isCreate ? 'Create card' : 'Save changes'}</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
