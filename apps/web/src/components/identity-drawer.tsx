'use client';

// IdentityDrawer — open ANY identity by id, IN-PLACE, from anywhere.
// Song sinh với <AccountDrawer>: cùng lý do tồn tại (tham chiếu entity từng là
// <a href="/p/<proj>/identities?m=edit"> nhảy trang để xem 1 bản ghi). Pair với
// <EntityRef kind="identity" onOpen={…} /> → modal chuẩn bật ngay trên view hiện tại.

import { useState, useEffect } from 'react';
import { Drawer } from './ui';
import { IdentityFormModal, type IdentityFormState } from './identities-page';
import { getIdentity, updateIdentity } from '@/lib/actions/identities';

export function IdentityDrawer({ identityId, onClose }: { identityId: number; onClose: () => void }) {
  const [form, setForm] = useState<IdentityFormState | null | 'loading'>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    setForm('loading');
    getIdentity(identityId)
      .then((r) => {
        if (!live) return;
        setForm(r && {
          id: r.id, name: r.name, kind: r.kind, handleBase: r.handleBase, email: r.email,
          password: undefined,                     // undefined = giữ nguyên password cũ
          displayName: r.displayName, bio: r.bio, avatarUrl: r.avatarUrl,
          persona: r.persona, customFields: r.customFields,
        });
      })
      .catch(() => { if (live) setForm(null); });
    return () => { live = false; };
  }, [identityId]);

  if (form === 'loading' || !form) {
    return (
      <Drawer onClose={onClose} width={460} zIndex={300}>
        <div style={{ padding: 24, fontSize: 13, color: form ? 'var(--fg-4)' : 'var(--bad)' }}>
          {form ? `Đang tải identity #${identityId}…` : `Không tìm thấy identity #${identityId}.`}
        </div>
      </Drawer>
    );
  }

  const save = async () => {
    setBusy(true);
    try {
      await updateIdentity(identityId, form);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return <IdentityFormModal form={form} setForm={setForm} onClose={onClose} onSave={save} busy={busy} />;
}
