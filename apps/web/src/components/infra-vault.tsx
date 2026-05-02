'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { InfraRow } from '@/lib/data';
import { createInfraResource, updateInfraResource, deleteInfraResource, type InfraInput } from '@/lib/actions/vaults';
import { EmptyState, Pill, StatsStrip, type StatCard } from './ui';
import { AIFormParser } from './ai-form-parser';

const KIND_ICON: Record<string, string> = {
  proxy: '🌐', sim: '📱', device: '💻', api_key: '🔑', domain: '🔗', server: '🖥', other: '🗂',
};
const KIND_OPTS = ['proxy', 'sim', 'device', 'api_key', 'domain', 'server', 'other'];
const STATUS_COLOR: Record<string, string> = {
  active: 'var(--ok)', expired: 'var(--bad)', paused: 'var(--warn)', broken: 'var(--bad)',
};

function fmtCost(cents: number, ccy: string): string {
  if (!cents) return 'free';
  if (ccy === 'VND') return `${(cents / 1000).toLocaleString('vi-VN')}k`;
  return `${(cents / 100).toFixed(2)} ${ccy}`;
}
function daysUntil(d: Date | null): number | null {
  if (!d) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function InfraVault({ items, projectId }: { items: InfraRow[]; projectId: string }) {
  const [editing, setEditing] = useState<InfraRow | null>(null);
  const [creating, setCreating] = useState(false);

  const stats: StatCard[] = useMemo(() => [
    { key: 'total', label: 'Total', value: items.length, color: 'var(--fg-0)' },
    { key: 'active', label: 'Active', value: items.filter((i) => i.status === 'active').length, color: 'var(--ok)' },
    { key: 'expiring', label: 'Expiring 30d', value: items.filter((i) => { const d = daysUntil(i.expiresAt); return d !== null && d >= 0 && d <= 30; }).length, color: 'var(--warn)' },
    { key: 'expired', label: 'Expired/Broken', value: items.filter((i) => i.status === 'expired' || i.status === 'broken').length, color: 'var(--bad)' },
    { key: 'cost', label: 'Cost/mo', value: fmtCost(items.reduce((s, i) => s + i.costMonthly, 0), 'VND'), color: 'var(--neon-amber)' },
  ], [items]);

  const grouped = useMemo(() => {
    const map = new Map<string, InfraRow[]>();
    for (const r of items) {
      const arr = map.get(r.kind) ?? [];
      arr.push(r);
      map.set(r.kind, arr);
    }
    return Array.from(map.entries()).sort();
  }, [items]);

  return (
    <>
      <StatsStrip cards={stats} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '8px 0' }}>
        <button className="btn primary" onClick={() => setCreating(true)}>+ New resource</button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon="🌐" title="No infra resources" description="Thêm proxy / SIM / API key / domain..." compact />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {grouped.map(([kind, rows]) => (
            <div key={kind}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{KIND_ICON[kind] ?? '🗂'} {kind}</span>
                <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                <span style={{ opacity: 0.6 }}>{rows.length}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 6 }}>
                {rows.map((r) => {
                  const days = daysUntil(r.expiresAt);
                  return (
                    <div key={r.id} className="panel" style={{ cursor: 'pointer', padding: '8px 10px' }} onClick={() => setEditing(r)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14 }}>{KIND_ICON[r.kind] ?? '🗂'}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span>
                        <Pill color={STATUS_COLOR[r.status] ?? 'var(--fg-3)'} label={r.status} size="xs" />
                      </div>
                      <div style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {r.provider && <span>{r.provider}</span>}
                        <span>{fmtCost(r.costMonthly, r.currency)}/mo</span>
                        {days !== null && (
                          <span style={{ color: days < 0 ? 'var(--bad)' : days < 30 ? 'var(--warn)' : 'var(--fg-3)' }}>
                            {days < 0 ? `expired ${-days}d ago` : `expires ${days}d`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {(editing || creating) && (
        <InfraFormModal item={editing} projectId={projectId} onClose={() => { setEditing(null); setCreating(false); }} />
      )}
    </>
  );
}

function InfraFormModal({ item, projectId, onClose }: { item: InfraRow | null; projectId: string; onClose: () => void }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isCreate = !item;
  const [form, setForm] = useState({
    kind: item?.kind ?? 'proxy',
    label: item?.label ?? '',
    provider: item?.provider ?? '',
    status: (item?.status ?? 'active') as NonNullable<InfraInput['status']>,
    expiresAt: item?.expiresAt ? new Date(item.expiresAt).toISOString().slice(0, 10) : '',
    costMonthly: item?.costMonthly ?? 0,
    currency: item?.currency ?? 'VND',
    metaStr: item?.meta ? JSON.stringify(item.meta, null, 2) : '{}',
    tagsStr: (item?.tags ?? []).join(', '),
    notes: item?.notes ?? '',
  });
  const setF = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const fld: React.CSSProperties = { width: '100%', padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 13, outline: 'none' };
  const lbl: React.CSSProperties = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block' };

  const handleSave = () => {
    if (!form.label.trim()) { setError('label required'); return; }
    let meta: Record<string, unknown>;
    try { meta = form.metaStr.trim() ? JSON.parse(form.metaStr) : {}; }
    catch (e) { setError(`meta JSON invalid: ${(e as Error).message}`); return; }
    const payload: InfraInput = {
      kind: form.kind, label: form.label,
      provider: form.provider || null,
      status: form.status,
      expiresAt: form.expiresAt ? new Date(form.expiresAt) : null,
      costMonthly: Number(form.costMonthly) | 0,
      currency: form.currency,
      meta,
      tags: form.tagsStr.split(',').map((s) => s.trim()).filter(Boolean),
      notes: form.notes || null,
    };
    startTransition(async () => {
      const res = isCreate ? await createInfraResource(payload, projectId) : await updateInfraResource(item!.id, payload, projectId);
      if (!res.ok) { setError(res.error || 'Save failed'); return; }
      router.refresh(); onClose();
    });
  };
  const handleDelete = () => {
    if (!item) return;
    if (!confirm(`Delete "${item.label}"?`)) return;
    startTransition(async () => { await deleteInfraResource(item.id, projectId); router.refresh(); onClose(); });
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) e.stopPropagation(); }}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div><div className="id-line">{item ? `#${item.id}` : 'NEW'}</div><h2>{isCreate ? '+ New infra resource' : `Edit ${item!.label}`}</h2></div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ padding: '8px 14px', background: 'rgba(255,77,94,.08)', borderBottom: '1px solid rgba(255,77,94,.3)', color: 'var(--bad)', fontSize: 12 }}>⚠ {error}</div>}
        <AIFormParser
          currentValues={form}
          context="Infrastructure resource form (server/proxy/domain/SaaS subscription/storage). Parse invoice email, dashboard screenshot, or vendor confirmation."
          schema={[
            { key: 'kind', label: 'Resource kind', type: 'enum', enumValues: ['proxy', 'domain', 'server', 'saas', 'storage', 'cdn', 'database', 'other'] },
            { key: 'label', label: 'Short label/name' },
            { key: 'provider', label: 'Provider/vendor (Hetzner, Cloudflare, ...)' },
            { key: 'status', label: 'Status', type: 'enum', enumValues: ['active', 'paused', 'expired', 'archived'] },
            { key: 'expiresAt', label: 'Expiry date YYYY-MM-DD' },
            { key: 'costMonthly', label: 'Monthly cost (number)', type: 'number' },
            { key: 'currency', label: 'Currency code (USD/EUR/VND)' },
            { key: 'notes', label: 'Notes' },
          ]}
          onApply={(v) => setForm((f) => ({
            ...f,
            kind: typeof v.kind === 'string' ? v.kind : f.kind,
            label: typeof v.label === 'string' ? v.label : f.label,
            provider: typeof v.provider === 'string' ? v.provider : f.provider,
            status: typeof v.status === 'string' ? (v.status as typeof f.status) : f.status,
            expiresAt: typeof v.expiresAt === 'string' ? v.expiresAt : f.expiresAt,
            costMonthly: typeof v.costMonthly === 'number' ? v.costMonthly : f.costMonthly,
            currency: typeof v.currency === 'string' ? v.currency : f.currency,
            notes: typeof v.notes === 'string' ? v.notes : f.notes,
          }))}
        />
        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <span style={lbl}>Kind</span>
            <select style={fld} value={form.kind} onChange={(e) => setF('kind', e.target.value)}>
              {KIND_OPTS.map((k) => <option key={k} value={k}>{KIND_ICON[k]} {k}</option>)}
            </select>
          </div>
          <div>
            <span style={lbl}>Status</span>
            <select style={fld} value={form.status} onChange={(e) => setF('status', e.target.value as NonNullable<InfraInput['status']>)}>
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="expired">expired</option>
              <option value="broken">broken</option>
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={lbl}>Label *</span>
            <input style={fld} value={form.label} onChange={(e) => setF('label', e.target.value)} />
          </div>
          <div><span style={lbl}>Provider</span><input style={fld} placeholder="webshare, hetzner..." value={form.provider} onChange={(e) => setF('provider', e.target.value)} /></div>
          <div><span style={lbl}>Expires (YYYY-MM-DD)</span><input style={fld} type="date" value={form.expiresAt} onChange={(e) => setF('expiresAt', e.target.value)} /></div>
          <div><span style={lbl}>Cost/month</span><input style={fld} type="number" value={form.costMonthly} onChange={(e) => setF('costMonthly', Number(e.target.value) | 0)} /></div>
          <div><span style={lbl}>Currency</span>
            <select style={fld} value={form.currency} onChange={(e) => setF('currency', e.target.value)}>
              <option value="VND">VND</option><option value="USD">USD</option>
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={lbl}>Meta (JSON)</span>
            <textarea style={{ ...fld, minHeight: 80, fontFamily: 'var(--font-mono)', fontSize: 11 }}
                      value={form.metaStr} onChange={(e) => setF('metaStr', e.target.value)} />
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
