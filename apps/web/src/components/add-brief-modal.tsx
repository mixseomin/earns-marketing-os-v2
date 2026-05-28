'use client';

// Modal '+ Brief mới' từ Seeding page header. Flow:
//   1. Pick Habitat (filter theo tribe / platform / search)
//   2. Pick Account same platform với habitat (filter accounts của project)
//   3. Submit → upsertBrief → open BriefEditModal in-place để edit chi tiết.
//
// KHÔNG re-implement form chi tiết — chỉ tạo skeleton brief rồi handoff
// sang BriefEditModal đã có (xem brief-edit-modal.tsx).

import { useEffect, useState, useTransition } from 'react';
import type { HabitatRow, AccountRow } from '@/lib/data';
import { listAccountsForProjectByPlatform } from '@/lib/actions/accounts';
import { upsertBrief } from '@/lib/actions/community-briefs';
import { Spinner } from './ui';
import { AccountKindIcon } from './account-kind-icon';

interface Props {
  projectId: string;
  habitats: HabitatRow[];
  onClose: () => void;
  /** Callback sau khi brief tạo OK — parent (seeding-cockpit) mở
   *  BriefEditModal để edit chi tiết. */
  onCreated: (briefId: number, accountId: number, habitatId: number) => void;
}

interface AccountOption {
  id: number;
  handle: string | null;
  status: string;
  accountKind?: string;
  alreadyBriefedHere: boolean;
}

export function AddBriefModal({ projectId, habitats, onClose, onCreated }: Props) {
  const [habQ, setHabQ] = useState('');
  const [habitatId, setHabitatId] = useState<number | null>(null);
  const [accounts, setAccounts] = useState<AccountOption[] | null>(null);
  const [accountQ, setAccountQ] = useState('');
  const [accountId, setAccountId] = useState<number | null>(null);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const habitat = habitatId ? habitats.find((h) => h.id === habitatId) : null;
  const platformKey = habitat?.platformKey ?? '';

  // Khi pick habitat → load accounts cùng platform.
  useEffect(() => {
    if (!habitat || !platformKey) { setAccounts(null); return; }
    let cancel = false;
    setAccounts(null);
    listAccountsForProjectByPlatform(projectId, platformKey, habitat.id).then((rows) => {
      if (cancel) return;
      setAccounts(rows.map((r) => ({
        id: r.id, handle: r.handle, status: r.status,
        accountKind: (r as AccountOption & { accountKind?: string }).accountKind,
        alreadyBriefedHere: r.alreadyBriefedHere,
      })));
    });
    return () => { cancel = true; };
  }, [habitatId, projectId, platformKey, habitat]);

  const filteredHabitats = habitats.filter((h) => {
    if (!habQ.trim()) return true;
    const q = habQ.toLowerCase();
    return h.name.toLowerCase().includes(q)
      || (h.platformKey ?? '').toLowerCase().includes(q)
      || (h.kind ?? '').toLowerCase().includes(q);
  });

  const filteredAccounts = (accounts ?? []).filter((a) => {
    if (!accountQ.trim()) return true;
    return (a.handle ?? '').toLowerCase().includes(accountQ.toLowerCase());
  });

  const doCreate = () => {
    if (!habitatId || !accountId) { setError('Cần chọn cả habitat + account'); return; }
    setError(null);
    startTransition(async () => {
      const res = await upsertBrief(projectId, accountId, habitatId, {});
      if (!res.ok || res.id == null) {
        setError(res.error || 'create fail');
        return;
      }
      onCreated(res.id, accountId, habitatId);
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 'min(820px, 100%)', maxWidth: 820 }}
           onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)',
                      display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>
            + Brief mới
          </h2>
          <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>
            Pick habitat + account → skeleton brief → mở editor.
          </span>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} className="btn ghost"
                  style={{ fontSize: 11, padding: '4px 8px' }}>✕</button>
        </div>

        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
                      maxHeight: '70vh', overflow: 'auto' }}>
          {/* Step 1: habitat */}
          <div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)',
                          textTransform: 'uppercase', marginBottom: 4 }}>
              1 · Habitat
            </div>
            <input placeholder="Tìm habitat / platform / kind…"
                   value={habQ} onChange={(e) => setHabQ(e.target.value)}
                   style={{ width: '100%', padding: '6px 10px', fontSize: 12,
                            background: 'var(--bg-2)', border: '1px solid var(--line)',
                            borderRadius: 4, color: 'var(--fg-0)', marginBottom: 6 }} />
            <div style={{ border: '1px solid var(--line)', borderRadius: 4,
                          maxHeight: 320, overflow: 'auto' }}>
              {filteredHabitats.length === 0 && (
                <div style={{ padding: 10, fontSize: 11, color: 'var(--fg-4)',
                              fontStyle: 'italic' }}>
                  Không có habitat match
                </div>
              )}
              {filteredHabitats.map((h) => {
                const on = habitatId === h.id;
                return (
                  <button key={h.id} type="button"
                          onClick={() => { setHabitatId(h.id); setAccountId(null); }}
                          style={{ display: 'flex', width: '100%', textAlign: 'left',
                                   alignItems: 'center', gap: 6, padding: '6px 10px',
                                   background: on ? 'var(--accent-soft)' : 'transparent',
                                   border: 'none', borderBottom: '1px solid var(--line)',
                                   cursor: 'pointer', fontSize: 11.5,
                                   color: on ? 'var(--accent)' : 'var(--fg-1)' }}>
                    <span style={{ fontWeight: 700 }}>{h.name}</span>
                    <span style={{ fontSize: 9, color: 'var(--fg-4)',
                                   fontFamily: 'var(--font-mono)' }}>
                      {h.kind}{h.platformKey ? ` · ${h.platformKey}` : ''}
                    </span>
                    <span style={{ flex: 1 }} />
                    {h.isOwn && <span title="Own habitat">👑</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: account */}
          <div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)',
                          textTransform: 'uppercase', marginBottom: 4 }}>
              2 · Account {platformKey ? `(${platformKey})` : '— pick habitat trước'}
            </div>
            <input placeholder="Tìm account handle…"
                   value={accountQ} onChange={(e) => setAccountQ(e.target.value)}
                   disabled={!habitatId}
                   style={{ width: '100%', padding: '6px 10px', fontSize: 12,
                            background: 'var(--bg-2)', border: '1px solid var(--line)',
                            borderRadius: 4, color: 'var(--fg-0)', marginBottom: 6,
                            opacity: habitatId ? 1 : 0.5 }} />
            <div style={{ border: '1px solid var(--line)', borderRadius: 4,
                          maxHeight: 320, overflow: 'auto' }}>
              {!habitatId && (
                <div style={{ padding: 10, fontSize: 11, color: 'var(--fg-4)',
                              fontStyle: 'italic' }}>
                  Pick habitat trước
                </div>
              )}
              {habitatId && accounts == null && (
                <div style={{ padding: 10, fontSize: 11, color: 'var(--fg-3)',
                              display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Spinner size="xs" /> Đang load accounts…
                </div>
              )}
              {habitatId && accounts != null && filteredAccounts.length === 0 && (
                <div style={{ padding: 10, fontSize: 11, color: 'var(--fg-4)',
                              fontStyle: 'italic' }}>
                  Không có account same platform.
                  Mở Account modal tạo account {platformKey} mới trước.
                </div>
              )}
              {habitatId && filteredAccounts.map((a) => {
                const on = accountId === a.id;
                const disabled = a.alreadyBriefedHere;
                return (
                  <button key={a.id} type="button"
                          disabled={disabled}
                          onClick={() => setAccountId(a.id)}
                          title={disabled ? 'Account này đã có brief với habitat đang chọn' : undefined}
                          style={{ display: 'flex', width: '100%', textAlign: 'left',
                                   alignItems: 'center', gap: 6, padding: '6px 10px',
                                   background: on ? 'var(--accent-soft)' : 'transparent',
                                   border: 'none', borderBottom: '1px solid var(--line)',
                                   cursor: disabled ? 'not-allowed' : 'pointer',
                                   opacity: disabled ? 0.45 : 1,
                                   fontSize: 11.5,
                                   color: on ? 'var(--accent)' : 'var(--fg-1)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      <AccountKindIcon kind={a.accountKind} />@{a.handle ?? '(no handle)'}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--fg-4)',
                                   fontFamily: 'var(--font-mono)' }}>{a.status}</span>
                    <span style={{ flex: 1 }} />
                    {disabled && (
                      <span style={{ fontSize: 9, color: 'var(--warn)',
                                     fontFamily: 'var(--font-mono)' }}>đã có brief</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {error && (
          <div style={{ padding: '6px 14px', fontSize: 11, color: 'var(--bad)',
                        background: 'rgba(248,113,113,.08)',
                        borderTop: '1px solid rgba(248,113,113,.3)' }}>
            ⚠ {error}
          </div>
        )}

        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line)',
                      display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} className="btn ghost"
                  style={{ fontSize: 12 }}>Huỷ</button>
          <button onClick={doCreate} disabled={!habitatId || !accountId || busy}
                  className="btn primary"
                  style={{ fontSize: 12, fontWeight: 700,
                           opacity: (!habitatId || !accountId || busy) ? 0.5 : 1 }}>
            {busy ? '⟳ Đang tạo…' : '+ Tạo brief → Edit'}
          </button>
        </div>
      </div>
    </div>
  );
}
