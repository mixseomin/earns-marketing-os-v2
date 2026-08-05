'use client';

// Self-loading drawers: open a browser-profile / proxy by id from ANYWHERE (no page context).
// Each calls a SERVER by-id bundle (only the matched row + its deps, not the whole pool — same
// pattern as AccountDrawer/accountEditBundle), then renders the SAME drawer the environments page
// uses. Registered in <EntityDrawerHost/>. (Account has its own self-loader: AccountDrawer.)

import { useState, useEffect } from 'react';
import { Drawer } from './ui';
import { BrowserProfileDrawer } from './browser-profile-drawer';
import { ProxyFormModal } from './environments-page';
import { proxyBundle, browserProfileBundle } from '@/lib/actions/environments';

function Placeholder({ onClose, label, bad }: { onClose: () => void; label: string; bad?: boolean }) {
  return (
    <Drawer onClose={onClose} width={460} zIndex={300}>
      <div style={{ padding: 24, fontSize: 13, color: bad ? 'var(--bad)' : 'var(--fg-4)' }}>{label}</div>
    </Drawer>
  );
}

export function BrowserProfileDrawerById({ id, onClose }: { id: number; onClose: () => void }) {
  const [d, setD] = useState<Awaited<ReturnType<typeof browserProfileBundle>> | 'loading'>('loading');
  useEffect(() => {
    let live = true;
    browserProfileBundle(id).then((r) => { if (live) setD(r); }).catch(() => { if (live) setD(null); });
    return () => { live = false; };
  }, [id]);
  if (d === 'loading') return <Placeholder onClose={onClose} label={`Đang tải profile #${id}…`} />;
  if (!d) return <Placeholder onClose={onClose} label={`Không tìm thấy browser profile #${id}.`} bad />;
  return <BrowserProfileDrawer profile={d.profile} proxies={d.proxies} teamMembers={d.teamMembers} onClose={onClose} />;
}

export function ProxyDrawerById({ id, onClose }: { id: number; onClose: () => void }) {
  const [d, setD] = useState<Awaited<ReturnType<typeof proxyBundle>> | 'loading'>('loading');
  useEffect(() => {
    let live = true;
    proxyBundle(id).then((r) => { if (live) setD(r); }).catch(() => { if (live) setD(null); });
    return () => { live = false; };
  }, [id]);
  if (d === 'loading') return <Placeholder onClose={onClose} label={`Đang tải proxy #${id}…`} />;
  if (!d) return <Placeholder onClose={onClose} label={`Không tìm thấy proxy #${id}.`} bad />;
  return <ProxyFormModal proxy={d.proxy} teamMembers={d.teamMembers} onClose={onClose} />;
}
