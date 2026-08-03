'use client';

// AccountDrawer — open ANY account by id, IN-PLACE, from anywhere.
//
// WHY: account references used to be hand-rolled <Link>s that navigated to a
// different page (/p/<proj>/resources?m=edit) to show the editor. Pair this with
// <EntityRef kind="account" onOpen={() => setId(a.id)} /> and the standard account
// drawer pops right over the current view — no page jump, no bespoke context wiring.
// Self-loads the full <AccountFormModal> bundle (project + platforms + proxy/profile/
// team lists) by id via accountEditBundle.

import { useState, useEffect } from 'react';
import { Drawer } from './ui';
import { AccountFormModal } from './accounts-vault';
import { accountEditBundle } from '@/lib/actions/accounts';

type Bundle = Awaited<ReturnType<typeof accountEditBundle>>;

export function AccountDrawer({ accountId, onClose }: { accountId: number; onClose: () => void }) {
  const [bundle, setBundle] = useState<Bundle | 'loading'>('loading');
  useEffect(() => {
    let live = true;
    setBundle('loading');
    accountEditBundle(accountId).then((b) => { if (live) setBundle(b); }).catch(() => { if (live) setBundle(null); });
    return () => { live = false; };
  }, [accountId]);

  if (bundle === 'loading' || !bundle) {
    return (
      <Drawer onClose={onClose} width={460} zIndex={300}>
        <div style={{ padding: 24, fontSize: 13, color: bundle ? 'var(--fg-4)' : 'var(--bad)' }}>
          {bundle ? `Đang tải account #${accountId}…` : `Không mở được account #${accountId} (thiếu project).`}
        </div>
      </Drawer>
    );
  }
  return (
    <AccountFormModal account={bundle.account} project={bundle.project} projectId={bundle.projectId}
      platforms={bundle.platforms} teamMembers={bundle.teamMembers} proxies={bundle.proxies}
      browserProfiles={bundle.browserProfiles} onClose={onClose} />
  );
}
