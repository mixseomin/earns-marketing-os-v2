'use client';

// Self-loading drawers for PROJECT-SCOPED entities (brief, habitat, tribe): open one by id
// from ANY page via <EntityDrawerHost/>. Each resolves its project + context by id, then renders
// the SAME modal its project page uses. Cross-entity links inside these modals route back through
// the global host (openEntityDrawer), so account/habitat/brief chips inside them also open
// in-place — no page pre-mounting anything.

import { useState, useEffect } from 'react';
import { Drawer } from './ui';
import { openEntityDrawer } from '@/lib/entity-drawer';
import { BriefEditModal } from './brief-edit-modal';
import { HabitatFormModal } from './habitat-form-modal';
import { TribeFormModal } from './tribe-form-modal';
import { briefDrawerBundle } from '@/lib/actions/community-briefs';
import { habitatDrawerBundle, tribeDrawerBundle } from '@/lib/actions/entity-drawer-loaders';

function Placeholder({ onClose, label, bad }: { onClose: () => void; label: string; bad?: boolean }) {
  return (
    <Drawer onClose={onClose} width={460} zIndex={300}>
      <div style={{ padding: 24, fontSize: 13, color: bad ? 'var(--bad)' : 'var(--fg-4)' }}>{label}</div>
    </Drawer>
  );
}

export function BriefDrawer({ briefId, onClose }: { briefId: number; onClose: () => void }) {
  const [d, setD] = useState<Awaited<ReturnType<typeof briefDrawerBundle>> | 'loading'>('loading');
  useEffect(() => {
    let live = true;
    briefDrawerBundle(briefId).then((r) => { if (live) setD(r); }).catch(() => { if (live) setD(null); });
    return () => { live = false; };
  }, [briefId]);
  if (d === 'loading') return <Placeholder onClose={onClose} label={`Đang tải brief #${briefId}…`} />;
  if (!d) return <Placeholder onClose={onClose} label={`Không tìm thấy brief #${briefId}.`} bad />;
  const { ctx, row } = d;
  return (
    <BriefEditModal
      projectId={d.projectId}
      accountId={ctx.accountId} habitatId={ctx.habitatId}
      accountLabel={ctx.accountLabel} habitatLabel={ctx.habitatLabel}
      habitatUrl={ctx.habitatUrl} habitatKind={ctx.habitatKind}
      platformKey={ctx.platformKey} platformCategory={ctx.platformCategory}
      platformAllowedFormats={ctx.platformAllowedFormats} habitatAllowedFormats={ctx.habitatAllowedFormats}
      accountStatus={ctx.accountStatus} accountBlockReason={ctx.accountBlockReason}
      phaseCounts={d.phaseCounts} phaseTypeCounts={d.phaseTypeCounts}
      existing={row}
      // Cross-entity chips inside the brief open via the global host too (stacked over this drawer).
      onOpenAccount={(id) => openEntityDrawer('account', id)}
      onOpenHabitat={(id) => openEntityDrawer('habitat', id)}
      onClose={onClose}
    />
  );
}

export function HabitatDrawer({ habitatId, onClose }: { habitatId: number; onClose: () => void }) {
  const [d, setD] = useState<Awaited<ReturnType<typeof habitatDrawerBundle>> | 'loading'>('loading');
  useEffect(() => {
    let live = true;
    habitatDrawerBundle(habitatId).then((r) => { if (live) setD(r); }).catch(() => { if (live) setD(null); });
    return () => { live = false; };
  }, [habitatId]);
  if (d === 'loading') return <Placeholder onClose={onClose} label={`Đang tải habitat #${habitatId}…`} />;
  if (!d) return <Placeholder onClose={onClose} label={`Không tìm thấy habitat #${habitatId}.`} bad />;
  return (
    <HabitatFormModal
      projectId={d.projectId} habitat={d.habitat} tribes={d.tribes} platforms={d.platforms}
      onOpenAccount={(id) => openEntityDrawer('account', id)}
      onOpenBrief={(id) => openEntityDrawer('brief', id)}
      onClose={onClose}
    />
  );
}

export function TribeDrawer({ tribeId, onClose }: { tribeId: number; onClose: () => void }) {
  const [d, setD] = useState<Awaited<ReturnType<typeof tribeDrawerBundle>> | 'loading'>('loading');
  useEffect(() => {
    let live = true;
    tribeDrawerBundle(tribeId).then((r) => { if (live) setD(r); }).catch(() => { if (live) setD(null); });
    return () => { live = false; };
  }, [tribeId]);
  if (d === 'loading') return <Placeholder onClose={onClose} label={`Đang tải tribe #${tribeId}…`} />;
  if (!d) return <Placeholder onClose={onClose} label={`Không tìm thấy tribe #${tribeId}.`} bad />;
  return <TribeFormModal projectId={d.projectId} tribe={d.tribe} onClose={onClose} />;
}
