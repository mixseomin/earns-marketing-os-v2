'use client';

// Self-loading drawers: open a browser-profile / proxy by id from ANYWHERE (no page context).
// Each fetches the tenant pool + finds its row, then renders the SAME drawer the environments
// page uses. Registered in <EntityDrawerHost/>. (Account has its own self-loader: AccountDrawer.)

import { useState, useEffect } from 'react';
import { Drawer } from './ui';
import { BrowserProfileDrawer } from './browser-profile-drawer';
import { ProxyFormModal } from './environments-page';
import { listBrowserProfiles, listProxies, type ProxyRow, type BrowserProfileRow } from '@/lib/actions/environments';
import { listTeamMembers, type TeamMemberRow } from '@/lib/actions/team';

function Placeholder({ onClose, label, bad }: { onClose: () => void; label: string; bad?: boolean }) {
  return (
    <Drawer onClose={onClose} width={460} zIndex={300}>
      <div style={{ padding: 24, fontSize: 13, color: bad ? 'var(--bad)' : 'var(--fg-4)' }}>{label}</div>
    </Drawer>
  );
}

export function BrowserProfileDrawerById({ id, onClose }: { id: number; onClose: () => void }) {
  const [d, setD] = useState<{ profile: BrowserProfileRow; proxies: ProxyRow[]; teamMembers: TeamMemberRow[] } | null | 'loading'>('loading');
  useEffect(() => {
    let live = true;
    Promise.all([listBrowserProfiles(), listProxies(), listTeamMembers()])
      .then(([profs, proxies, tm]) => { if (!live) return; const p = profs.find((x) => x.id === id) ?? null; setD(p ? { profile: p, proxies, teamMembers: tm } : null); })
      .catch(() => { if (live) setD(null); });
    return () => { live = false; };
  }, [id]);
  if (d === 'loading') return <Placeholder onClose={onClose} label={`Đang tải profile #${id}…`} />;
  if (!d) return <Placeholder onClose={onClose} label={`Không tìm thấy browser profile #${id}.`} bad />;
  return <BrowserProfileDrawer profile={d.profile} proxies={d.proxies} teamMembers={d.teamMembers} onClose={onClose} />;
}

export function ProxyDrawerById({ id, onClose }: { id: number; onClose: () => void }) {
  const [d, setD] = useState<{ proxy: ProxyRow; teamMembers: TeamMemberRow[] } | null | 'loading'>('loading');
  useEffect(() => {
    let live = true;
    Promise.all([listProxies(), listTeamMembers()])
      .then(([proxies, tm]) => { if (!live) return; const p = proxies.find((x) => x.id === id) ?? null; setD(p ? { proxy: p, teamMembers: tm } : null); })
      .catch(() => { if (live) setD(null); });
    return () => { live = false; };
  }, [id]);
  if (d === 'loading') return <Placeholder onClose={onClose} label={`Đang tải proxy #${id}…`} />;
  if (!d) return <Placeholder onClose={onClose} label={`Không tìm thấy proxy #${id}.`} bad />;
  return <ProxyFormModal proxy={d.proxy} teamMembers={d.teamMembers} onClose={onClose} />;
}
