'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { BudgetRow } from '@/lib/data';
import { createBudgetEntry, updateBudgetEntry, deleteBudgetEntry, type BudgetInput } from '@/lib/actions/vaults';
import { EmptyState, StatsStrip, type StatCard } from './ui';

const KIND_ICON: Record<string, string> = { income: '⬆', expense: '⬇', recurring: '🔁' };
const CATEGORY_OPTS = ['ads', 'tools', 'hosting', 'content', 'salary', 'tax', 'commission', 'other'];

function fmtAmount(cents: number, ccy: string): string {
  if (ccy === 'VND') return `${(cents / 1000).toLocaleString('vi-VN')}k`;
  return `${(cents / 100).toFixed(2)} ${ccy}`;
}
function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function BudgetVault({ items, projectId }: { items: BudgetRow[]; projectId: string }) {
  const [editing, setEditing] = useState<BudgetRow | null>(null);
  const [creating, setCreating] = useState(false);

  // Aggregate per currency to avoid mixing VND + USD vào 1 sum (issue trên image #2).
  const stats: StatCard[] = useMemo(() => {
    const monthAgo = Date.now() - 30 * 24 * 3600 * 1000;
    const byCcy = new Map<string, { income: number; expense: number; recurring: number }>();
    for (const i of items) {
      const within30 = i.occurredAt.getTime() >= monthAgo;
      const bucket = byCcy.get(i.currency) ?? { income: 0, expense: 0, recurring: 0 };
      if (within30) {
        if (i.kind === 'income') bucket.income += i.amountCents;
        else bucket.expense += i.amountCents;
      }
      if (i.kind === 'recurring') {
        const days = i.recurringIntervalDays ?? 30;
        bucket.recurring += (i.amountCents * 30) / Math.max(1, days);
      }
      byCcy.set(i.currency, bucket);
    }
    const cards: StatCard[] = [
      { key: 'total', label: 'Entries', value: items.length, color: 'var(--fg-0)' },
    ];
    // Sort currencies by total volume desc; show net per currency.
    const ccys = Array.from(byCcy.entries()).sort((a, b) => (b[1].income + b[1].expense) - (a[1].income + a[1].expense));
    for (const [ccy, b] of ccys) {
      const net = b.income - b.expense;
      cards.push({ key: `net-${ccy}`, label: `Net 30d ${ccy}`, value: fmtAmount(net, ccy), color: net >= 0 ? 'var(--ok)' : 'var(--bad)' });
    }
    if (ccys.length === 1) {
      // Only 1 currency → show breakdown income/expense + recurring as well
      const [ccy, b] = ccys[0]!;
      cards.push(
        { key: `inc-${ccy}`, label: `Income 30d ${ccy}`, value: fmtAmount(b.income, ccy), color: 'var(--ok)' },
        { key: `exp-${ccy}`, label: `Expense 30d ${ccy}`, value: fmtAmount(b.expense, ccy), color: 'var(--bad)' },
        { key: `rec-${ccy}`, label: `Recurring/mo ${ccy}`, value: fmtAmount(Math.round(b.recurring), ccy), color: 'var(--neon-amber)' },
      );
    }
    return cards;
  }, [items]);

  return (
    <>
      <StatsStrip cards={stats} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '8px 0' }}>
        <button className="btn primary" onClick={() => setCreating(true)}>+ New entry</button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon="💳" title="No budget entries" description="Track ad spend, tool subs, income..." compact />
      ) : (
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '6px 10px', textAlign: 'left' }}>Kind</th>
                <th style={{ padding: '6px 10px', textAlign: 'left' }}>Category</th>
                <th style={{ padding: '6px 10px', textAlign: 'left' }}>Label</th>
                <th style={{ padding: '6px 10px', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '6px 10px', textAlign: 'left' }}>Tags</th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id} onClick={() => setEditing(b)} style={{ borderTop: '1px solid var(--line)', cursor: 'pointer' }}>
                  <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{fmtDate(b.occurredAt)}</td>
                  <td style={{ padding: '6px 10px' }}>{KIND_ICON[b.kind] ?? '—'} {b.kind}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--fg-2)' }}>{b.category}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--fg-0)', fontWeight: 500 }}>{b.label}{b.recurringIntervalDays ? ` · every ${b.recurringIntervalDays}d` : ''}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: b.kind === 'income' ? 'var(--ok)' : 'var(--bad)' }}>
                    {b.kind === 'income' ? '+' : '−'}{fmtAmount(b.amountCents, b.currency)}
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    {b.tags.slice(0, 3).map((t) => <span key={t} className="chip" style={{ fontSize: 9, padding: '1px 5px', marginRight: 3 }}>{t}</span>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(editing || creating) && (
        <BudgetFormModal entry={editing} projectId={projectId} onClose={() => { setEditing(null); setCreating(false); }} />
      )}
    </>
  );
}

function BudgetFormModal({ entry, projectId, onClose }: { entry: BudgetRow | null; projectId: string; onClose: () => void }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isCreate = !entry;
  const [form, setForm] = useState({
    kind: (entry?.kind ?? 'expense') as BudgetInput['kind'],
    category: entry?.category ?? 'tools',
    label: entry?.label ?? '',
    amountK: entry ? entry.amountCents / 1000 : 0,  // input "k VND" for friendlier UX
    currency: entry?.currency ?? 'VND',
    occurredAt: (entry?.occurredAt ? new Date(entry.occurredAt) : new Date()).toISOString().slice(0, 10),
    recurringIntervalDays: entry?.recurringIntervalDays ?? '',
    tagsStr: (entry?.tags ?? []).join(', '),
    notes: entry?.notes ?? '',
  });
  const setF = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const fld: React.CSSProperties = { width: '100%', padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 13, outline: 'none' };
  const lbl: React.CSSProperties = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block' };

  const handleSave = () => {
    if (!form.label.trim()) { setError('label required'); return; }
    const cents = form.currency === 'VND'
      ? Math.round(Number(form.amountK) * 1000)
      : Math.round(Number(form.amountK) * 100);
    const payload: BudgetInput = {
      kind: form.kind, category: form.category, label: form.label,
      amountCents: cents, currency: form.currency,
      occurredAt: new Date(form.occurredAt),
      recurringIntervalDays: form.recurringIntervalDays === '' ? null : Number(form.recurringIntervalDays) | 0,
      tags: form.tagsStr.split(',').map((s) => s.trim()).filter(Boolean),
      notes: form.notes || null,
    };
    startTransition(async () => {
      const res = isCreate ? await createBudgetEntry(payload, projectId) : await updateBudgetEntry(entry!.id, payload, projectId);
      if (!res.ok) { setError(res.error || 'Save failed'); return; }
      router.refresh(); onClose();
    });
  };
  const handleDelete = () => {
    if (!entry) return;
    if (!confirm(`Delete "${entry.label}"?`)) return;
    startTransition(async () => { await deleteBudgetEntry(entry.id, projectId); router.refresh(); onClose(); });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div><div className="id-line">{entry ? `#${entry.id}` : 'NEW'}</div><h2>{isCreate ? '+ New budget entry' : `Edit ${entry!.label}`}</h2></div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ padding: '8px 14px', background: 'rgba(255,77,94,.08)', borderBottom: '1px solid rgba(255,77,94,.3)', color: 'var(--bad)', fontSize: 12 }}>⚠ {error}</div>}
        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div>
            <span style={lbl}>Kind</span>
            <select style={fld} value={form.kind} onChange={(e) => setF('kind', e.target.value as BudgetInput['kind'])}>
              <option value="expense">⬇ expense</option>
              <option value="income">⬆ income</option>
              <option value="recurring">🔁 recurring</option>
            </select>
          </div>
          <div>
            <span style={lbl}>Category</span>
            <select style={fld} value={form.category} onChange={(e) => setF('category', e.target.value)}>
              {CATEGORY_OPTS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <span style={lbl}>Date</span>
            <input style={fld} type="date" value={form.occurredAt} onChange={(e) => setF('occurredAt', e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={lbl}>Label *</span>
            <input style={fld} placeholder='vd: "Meta ads boost - landing page"' value={form.label} onChange={(e) => setF('label', e.target.value)} />
          </div>
          <div>
            <span style={lbl}>Amount ({form.currency === 'VND' ? 'k VND' : form.currency})</span>
            <input style={fld} type="number" step="any" value={form.amountK} onChange={(e) => setF('amountK', Number(e.target.value))} />
          </div>
          <div>
            <span style={lbl}>Currency</span>
            <select style={fld} value={form.currency} onChange={(e) => setF('currency', e.target.value)}>
              <option value="VND">VND</option><option value="USD">USD</option>
            </select>
          </div>
          <div>
            <span style={lbl}>Recurring (days)</span>
            <input style={fld} type="number" placeholder="30 if monthly" value={form.recurringIntervalDays} onChange={(e) => setF('recurringIntervalDays', e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={lbl}>Tags</span>
            <input style={fld} value={form.tagsStr} onChange={(e) => setF('tagsStr', e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={lbl}>Notes</span>
            <textarea style={{ ...fld, minHeight: 50 }} value={form.notes} onChange={(e) => setF('notes', e.target.value)} />
          </div>
        </div>
        <div className="modal-foot">
          <div className="meta">{isCreate ? 'New' : 'Editing'}</div>
          <div className="modal-foot-actions">
            {!isCreate && <button className="btn danger" onClick={handleDelete}>🗑 Delete</button>}
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={handleSave}>{isCreate ? 'Create' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
