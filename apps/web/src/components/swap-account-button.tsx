'use client';

// SwapAccountButton — popover picker để swap brief sang account active đã có
// sẵn trong project, thay vì phải tạo account mới. Use case: brief đang dùng
// account 'todo' (chưa tạo) trong NeedAccountSection — user muốn assign sang
// account đã active để start seeding ngay.
//
// Inline popover lazy-load list (chỉ fetch khi click mở), tránh N×fetch khi
// section có nhiều rows.

import { memo, useState, useTransition, useEffect, useRef } from 'react';
import {
  listSwappableAccountsForBrief, reassignBriefAccount,
} from '@/lib/actions/community-briefs';
import { Spinner } from './ui';
import { accountStatusMeta } from '@/lib/status-meta';

interface SwappableAccount {
  id: number;
  handle: string | null;
  status: string;
  platformKey: string;
  platformLabel: string;
  accountKind: string;
}

export interface SwapAccountButtonProps {
  projectId: string;
  briefId: number;
  /** Account hiện tại của brief để exclude khỏi list. */
  currentAccountId: number;
  onSwapped: () => void;
}

function SwapAccountButtonImpl({ projectId, briefId, currentAccountId, onSwapped }: SwapAccountButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const [list, setList] = useState<SwappableAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Position fixed-relative-to-button thay vì absolute, để popover escape
  // section container có `overflow: hidden` (NeedAccountSection bị clip).
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [dropPos, setDropPos] = useState<{ top: number; right: number } | null>(null);

  const recomputePos = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setDropPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
  };

  // Lazy load khi mở
  useEffect(() => {
    if (!open || list != null) return;
    let cancelled = false;
    listSwappableAccountsForBrief(projectId, briefId).then((rows) => {
      if (cancelled) return;
      setList(rows.filter((r) => r.id !== currentAccountId));
    });
    return () => { cancelled = true; };
  }, [open, list, projectId, briefId, currentAccountId]);

  // Recompute position khi mở + theo scroll/resize.
  useEffect(() => {
    if (!open) return;
    recomputePos();
    const handler = () => recomputePos();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [open]);

  const doSwap = (accountId: number, handle: string | null) => {
    setBusy(true); setError(null);
    startTransition(async () => {
      const res = await reassignBriefAccount(projectId, briefId, accountId);
      setBusy(false);
      if (!res.ok) {
        setError(res.error ?? 'Swap thất bại');
        return;
      }
      setOpen(false);
      onSwapped();
      // toast handled by parent refresh
      void handle;
    });
  };

  return (
    <>
      <button ref={btnRef} type="button" onClick={() => setOpen((v) => !v)} disabled={busy}
              title="Đổi sang account khác đã có sẵn trong project (thay vì tạo mới)"
              style={{ fontSize: 10, padding: '2px 7px', background: 'var(--bg-2)',
                       color: 'var(--fg-2)', border: '1px solid var(--line)',
                       borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        ↺ Đổi acc
      </button>
      {open && dropPos && (
        <>
          {/* Backdrop để click ngoài đóng */}
          <div onClick={() => setOpen(false)}
               style={{ position: 'fixed', inset: 0, zIndex: 9000 }} />
          {/* Popover — position fixed để escape section overflow:hidden.
              Anchor top-right vào button (right edge align). */}
          <div style={{
            position: 'fixed',
            top: dropPos.top,
            right: dropPos.right,
            zIndex: 9001,
            minWidth: 280, maxWidth: 380, background: 'var(--bg-1)',
            border: '1px solid var(--line-2)', borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0,0,0,.4)', overflow: 'hidden',
          }}>
            <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--line)',
                          background: 'var(--bg-2)', fontSize: 10,
                          fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
                          textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Account active sẵn có (same platform)
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {list == null ? (
                <div style={{ padding: 10, fontSize: 11, color: 'var(--fg-3)',
                              display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Spinner size="xs" /> Đang load…
                </div>
              ) : list.length === 0 ? (
                <div style={{ padding: 10, fontSize: 11, color: 'var(--fg-3)',
                              fontStyle: 'italic' }}>
                  Không có account active nào trên platform này chưa được assign vào habitat này.
                  Tạo account mới ở Account modal.
                </div>
              ) : (
                list.map((a) => {
                  const meta = accountStatusMeta(a.status);
                  return (
                    <button key={a.id} type="button" disabled={busy}
                            onClick={() => doSwap(a.id, a.handle)}
                            style={{ display: 'flex', width: '100%', alignItems: 'center',
                                     gap: 8, padding: '6px 10px', textAlign: 'left',
                                     background: 'transparent', border: 'none',
                                     borderBottom: '1px solid var(--line)',
                                     cursor: busy ? 'wait' : 'pointer', fontSize: 11.5,
                                     color: 'var(--fg-0)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        @{a.handle ?? '(no handle)'}
                      </span>
                      {a.accountKind !== 'user' && (
                        <span style={{ fontSize: 9, padding: '0 5px',
                                       background: 'var(--accent-soft)', color: 'var(--accent)',
                                       border: '1px solid var(--accent-line)', borderRadius: 3,
                                       textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                          {a.accountKind}
                        </span>
                      )}
                      <span style={{ flex: 1 }} />
                      <span style={{ padding: '0 5px', fontSize: 9, fontFamily: 'var(--font-mono)',
                                     fontWeight: 700, borderRadius: 3,
                                     background: meta.color + '22', color: meta.color,
                                     border: `1px solid ${meta.color}55`,
                                     textTransform: 'uppercase' }}>
                        {meta.label}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            {error && (
              <div style={{ padding: '6px 10px', fontSize: 10.5, color: 'var(--bad)',
                            background: 'rgba(248,113,113,.08)',
                            borderTop: '1px solid rgba(248,113,113,.3)' }}>
                ⚠ {error}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

export const SwapAccountButton = memo(SwapAccountButtonImpl);
SwapAccountButton.displayName = 'SwapAccountButton';
