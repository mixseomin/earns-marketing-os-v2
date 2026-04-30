'use client';

import { useState, useMemo } from 'react';
import type { ContactRow } from '@/lib/data';
import { Pill, EmptyState } from './ui';

const ROLE_COLOR: Record<string, string> = {
  KOC: '#a78bfa', partner: '#10b981', brand: '#fbbf24',
  influencer: '#ff3ca8', press: '#38bdf8', customer: '#fb923c',
};

function fmtDate(d: Date | null): string {
  if (!d) return '—';
  const day = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (day < 1) return 'today';
  if (day < 7) return `${day}d ago`;
  if (day < 30) return `${Math.floor(day / 7)}w ago`;
  return new Date(d).toLocaleDateString();
}

export function ContactsVault({ contacts, projectName }: { contacts: ContactRow[]; projectName: string }) {
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterScope, setFilterScope] = useState<'all' | 'project' | 'portfolio'>('all');
  const [search, setSearch] = useState('');
  const [openContact, setOpenContact] = useState<ContactRow | null>(null);

  const roles = useMemo(() => Array.from(new Set(contacts.map((c) => c.role).filter(Boolean))), [contacts]);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (filterRole !== 'all' && c.role !== filterRole) return false;
      if (filterScope === 'project' && c.projectId == null) return false;
      if (filterScope === 'portfolio' && c.projectId != null) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !(c.email ?? '').toLowerCase().includes(q)
            && !(c.role ?? '').toLowerCase().includes(q) && !c.tags.some((t) => t.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [contacts, filterRole, filterScope, search]);

  if (contacts.length === 0) {
    return (
      <EmptyState
        icon="📇"
        title={`Contacts — chưa có cho ${projectName}`}
        description="Chạy npm run sync-from-directus để pull từ as.on.tc, hoặc thêm contact mới qua UI (CRUD form sẽ ship sau)."
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
            📇 Contacts <small style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', fontWeight: 400 }}>// {contacts.length} total</small>
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--fg-3)' }}>
            KOC, partner, brand, influencer, press, customer. Theo project hoặc portfolio-wide.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="chip" data-active={filterRole === 'all' || undefined} onClick={() => setFilterRole('all')}>All roles</span>
        {roles.map((r) => (
          <span key={r} className="chip" data-active={filterRole === r || undefined} onClick={() => setFilterRole(r)} style={{ color: ROLE_COLOR[r] }}>
            {r} <span style={{ opacity: 0.6, marginLeft: 4 }}>{contacts.filter((c) => c.role === r).length}</span>
          </span>
        ))}
        <span style={{ width: 1, height: 18, background: 'var(--line)' }} />
        <span className="chip" data-active={filterScope === 'all' || undefined} onClick={() => setFilterScope('all')}>All scope</span>
        <span className="chip" data-active={filterScope === 'project' || undefined} onClick={() => setFilterScope('project')}>Project</span>
        <span className="chip" data-active={filterScope === 'portfolio' || undefined} onClick={() => setFilterScope('portfolio')}>Portfolio</span>
        <span style={{ flex: 1 }} />
        <input placeholder="Search name/email/tag…" value={search} onChange={(e) => setSearch(e.target.value)}
               style={{ padding: '6px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg-0)', fontSize: 12, outline: 'none', minWidth: 200 }} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🔍" title="Không có contact match filter" compact />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
          {filtered.map((c) => (
            <div key={c.id} className="panel" style={{ cursor: 'pointer' }} onClick={() => setOpenContact(c)}>
              <div style={{ padding: '8px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--fg-0)', fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                  {c.role && <Pill color={ROLE_COLOR[c.role] ?? 'var(--fg-3)'} label={c.role} size="xs" />}
                </div>
                {c.email && <div style={{ fontSize: 11, color: 'var(--fg-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email}</div>}
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span>{c.projectId ?? 'portfolio'}</span>
                  {c.lastTouchedAt && <span>· touched {fmtDate(c.lastTouchedAt)}</span>}
                  {c.tags.slice(0, 2).map((t) => <span key={t}>#{t}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {openContact && <ContactModal contact={openContact} onClose={() => setOpenContact(null)} />}
    </div>
  );
}

function ContactModal({ contact, onClose }: { contact: ContactRow; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="id-line">{contact.role || 'contact'} · {contact.projectId ?? 'portfolio'}</div>
            <h2>{contact.name}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5 }}>
          {contact.email && <div><span style={{ color: 'var(--fg-3)' }}>email · </span><a href={`mailto:${contact.email}`} style={{ color: 'var(--accent)' }}>{contact.email}</a></div>}
          {contact.role && <div><span style={{ color: 'var(--fg-3)' }}>role · </span>{contact.role}</div>}
          {contact.company && <div><span style={{ color: 'var(--fg-3)' }}>company · </span>{contact.company}</div>}
          {contact.lastTouchedAt && <div><span style={{ color: 'var(--fg-3)' }}>last touch · </span>{new Date(contact.lastTouchedAt).toLocaleDateString()}</div>}
          {Object.keys(contact.socialHandles).length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 4 }}>Social</div>
              <pre style={{ margin: 0, padding: 8, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-1)', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(contact.socialHandles, null, 2)}
              </pre>
            </div>
          )}
          {contact.notes && (
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 4 }}>Notes</div>
              <div style={{ fontSize: 12, color: 'var(--fg-1)', whiteSpace: 'pre-wrap' }}>{contact.notes}</div>
            </div>
          )}
          {contact.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {contact.tags.map((t) => <span key={t} className="tag">#{t}</span>)}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <div className="meta">{contact.importedFrom ?? 'manual'}</div>
          <div className="modal-foot-actions">
            <button className="btn ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
