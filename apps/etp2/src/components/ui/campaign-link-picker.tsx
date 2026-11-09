'use client';

// Standard link picker for campaign/email fields: choose from /offers (affiliate links) +
// /products (own products) instead of pasting a raw URL. Lazy-loads the catalog the first time
// it opens (the list is remote), keeps a paste-through fallback (some links aren't catalogued).

import { useEffect, useMemo, useRef, useState } from 'react';
import { listCampaignLinks, type CampaignLink } from '@/lib/actions/campaign-links';

const icon = (k: CampaignLink['kind']) => (k === 'offer' ? '💸' : '📦');

const inp: React.CSSProperties = { flex: 1, minWidth: 0, padding: '5px 9px', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 12 };
const btn: React.CSSProperties = { padding: '3px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-1)', fontSize: 12, cursor: 'pointer', flexShrink: 0 };

export function CampaignLinkPicker({ value, onChange, onSave, saving }: {
  value?: string;
  onChange: (v: string) => void;
  onSave?: () => void;
  saving?: boolean;
}) {
  const [links, setLinks] = useState<CampaignLink[] | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open && links === null) listCampaignLinks().then(setLinks).catch(() => setLinks([])); }, [open, links]);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const matched = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const list = links ?? [];
    return (ql ? list.filter((l) => `${l.label} ${l.sub} ${l.url}`.toLowerCase().includes(ql)) : list).slice(0, 50);
  }, [links, q]);
  const current = useMemo(() => (links ?? []).find((l) => l.url === value) ?? null, [links, value]);

  const pick = (l: CampaignLink) => { onChange(l.url); setQ(''); setOpen(false); onSave?.(); };

  return (
    <div ref={box} data-comp="ui.CampaignLinkPicker" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={value || ''} onChange={(e) => onChange(e.target.value)} onFocus={() => setOpen(true)}
          placeholder="Chọn từ /offers · /products — hoặc dán URL" autoComplete="off" style={inp} />
        <button type="button" onClick={() => setOpen((o) => !o)} style={btn} title="Chọn link từ danh mục offers + products">▾ Danh mục</button>
        {onSave && <button type="button" onClick={onSave} disabled={saving} style={{ ...btn, fontWeight: 700 }}>{saving ? '…' : 'Lưu'}</button>}
      </div>
      {current
        ? <div style={{ fontSize: 10.5, color: 'var(--ok,#22c55e)', marginTop: 3 }}>✓ {icon(current.kind)} {current.label} · {current.sub}</div>
        : value ? <div style={{ fontSize: 10.5, color: 'var(--fg-4)', marginTop: 3 }}>URL tự nhập (không có trong danh mục)</div> : null}

      {open && (
        <div style={{ position: 'absolute', zIndex: 40, top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.4)', overflow: 'hidden' }}>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="tìm offer / product…" autoComplete="off"
            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', background: 'var(--bg-2)', border: 'none', borderBottom: '1px solid var(--line)', color: 'var(--fg-0)', fontSize: 12, outline: 'none' }} />
          {links === null ? (
            <div style={{ padding: 12, fontSize: 12, color: 'var(--fg-3)', textAlign: 'center' }}>đang tải danh mục…</div>
          ) : matched.length === 0 ? (
            <div style={{ padding: 12, fontSize: 12, color: 'var(--fg-4)', textAlign: 'center' }}>không có link khớp</div>
          ) : (
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {matched.map((l) => (
                <button key={l.kind + l.url} type="button" onClick={() => pick(l)}
                  style={{ display: 'flex', width: '100%', gap: 8, alignItems: 'center', padding: '6px 10px', background: l.url === value ? 'var(--bg-2)' : 'transparent', border: 'none', borderBottom: '1px solid var(--line)', color: 'var(--fg-1)', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>
                  <span>{icon(l.kind)}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.label}</span>
                  {l.status && /pending/i.test(l.status) && <span style={{ fontSize: 9, color: 'var(--neon-amber)' }}>⏳</span>}
                  <span style={{ fontSize: 10, color: 'var(--fg-4)', flexShrink: 0, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.sub}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
