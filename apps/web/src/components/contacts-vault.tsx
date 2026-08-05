'use client';

import { useState, useMemo } from 'react';
import type { ContactRow } from '@/lib/data';
import { Pill, EmptyState, Drawer, ListToolbar, FilterChips, Pager, usePaged, MultiSelect } from './ui';

function fmtDate(d: Date | null): string {
  if (!d) return '—';
  const day = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (day < 1) return 'today';
  if (day < 7) return `${day}d ago`;
  if (day < 30) return `${Math.floor(day / 7)}w ago`;
  return new Date(d).toLocaleDateString();
}

export function ContactsVault({ contacts, projectName }: { contacts: ContactRow[]; projectName: string }) {
  const [filterRole, setFilterRole] = useState<string[]>([]);
  const [filterScope, setFilterScope] = useState<'all' | 'project' | 'portfolio'>('all');
  const [search, setSearch] = useState('');
  const [openContact, setOpenContact] = useState<ContactRow | null>(null);

  // Role = a category (data-driven), not a signal → data-driven multi-select, no per-role colour (YDNI).
  const roleOptions = useMemo(() => {
    const seen = new Map<string, number>();
    for (const c of contacts) {
      if (!c.role) continue;
      seen.set(c.role, (seen.get(c.role) ?? 0) + 1);
    }
    return Array.from(seen, ([value, count]) => ({ value, label: value, count }));
  }, [contacts]);

  const scopeCounts = useMemo(() => ({
    all: contacts.length,
    project: contacts.filter((c) => c.projectId != null).length,
    portfolio: contacts.filter((c) => c.projectId == null).length,
  }), [contacts]);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (filterRole.length && (!c.role || !filterRole.includes(c.role))) return false;
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

  const { pageItems, ...pager } = usePaged(filtered);

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

      <ListToolbar search={search} onSearch={setSearch} searchPlaceholder="Search name/email/tag…"
        right={<MultiSelect label="role" options={roleOptions} selected={filterRole} onChange={setFilterRole} compact />}>
        <FilterChips value={filterScope} onChange={setFilterScope} counts={scopeCounts}
          options={[{ value: 'all', label: 'All scope' }, { value: 'project', label: 'Project' }, { value: 'portfolio', label: 'Portfolio' }]} />
      </ListToolbar>

      {filtered.length === 0 ? (
        <EmptyState icon="🔍" title="Không có contact match filter" compact />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
          {pageItems.map((c) => (
            <div key={c.id} className="panel" style={{ cursor: 'pointer' }} onClick={() => setOpenContact(c)}>
              <div style={{ padding: '8px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--fg-0)', fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                  {c.role && <Pill color="var(--fg-3)" label={c.role} size="xs" />}
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
      <Pager {...pager} onPage={pager.setPage} />

      {openContact && <ContactModal contact={openContact} onClose={() => setOpenContact(null)} />}
    </div>
  );
}

function ContactModal({ contact, onClose }: { contact: ContactRow; onClose: () => void }) {
  return (
    <Drawer onClose={onClose} width={540} padding={0}>
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
    </Drawer>
  );
}
