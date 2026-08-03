'use client';

// EntityRef — THE ONE shared way to render a reference to another entity
// (account, proxy, browser-profile, task, brief, habitat, …) as a consistent
// clickable chip that opens THAT entity's detail drawer.
//
// WHY THIS EXISTS: entity references were hand-rolled per file (three divergent
// local `EntityLink`s + raw `<span>{acc.handle}</span>` / `<select>` displays),
// so most weren't clickable and none looked the same. Rule (ui-conventions §4):
// **any time you show an account / proxy / profile / task / brief / … = <EntityRef>.
// Never a raw span/text/select for an entity that has a drawer.**
//
// Open mechanism (no global host needed — leverages useModalParam's URL scheme):
//   - onOpen  → open the drawer IN-PLACE (preferred when the entity's drawer is
//               already mounted on this page: onOpen={() => modal.open('edit', id)}).
//   - href    → explicit deep-link (navigate; drawer opens on arrival because
//               useModalParam initialises from the URL on mount).
//   - kind+id → auto deep-link for kinds with a VERIFIED route (below). Project-
//               scoped kinds also need `project` (slug/id); without it, falls through.
//   - none resolvable → still renders the consistent chip, but muted + non-clickable
//     (dev console.warn). Never silently pretends to open.

import Link from 'next/link';
import { type ReactNode } from 'react';
import { Pill, type PillSize } from './pill';

export type EntityKind =
  | 'account' | 'proxy' | 'browser-profile' | 'task' | 'brief' | 'habitat'
  | 'tribe' | 'identity' | 'media' | 'contact' | 'platform' | 'squad' | 'agent';

interface KindMeta {
  icon: string;
  color: string;
  /** Build the canonical deep-link. `project` = slug/id for project-scoped kinds.
   * Returns null when the route can't be built (e.g. project-scoped but no project). */
  route?: (id: string | number, project?: string | number) => string | null;
}

// Only VERIFIED routes are auto-built (no fabricated URLs). Add a kind's route here
// once its param scheme is confirmed against the page that owns the drawer.
const META: Record<EntityKind, KindMeta> = {
  proxy:             { icon: '🔌', color: '#38bdf8', route: (id) => `/environments?proxy=edit&proxyId=${id}` },
  'browser-profile': { icon: '🦊', color: '#fb923c', route: (id) => `/environments?profile=edit&profileId=${id}` },
  task:              { icon: '📋', color: '#a78bfa', route: (id, p) => (p != null ? `/p/${p}/plays?task=${id}` : null) },
  account:           { icon: '👤', color: '#4ade80', route: (id, p) => (p != null ? `/p/${p}/resources?m=edit&mId=${id}` : null) },
  brief:             { icon: '📝', color: '#f5c518' },
  habitat:           { icon: '🏠', color: '#22d3ee' },
  tribe:             { icon: '👥', color: '#c084fc' },
  identity:          { icon: '🎭', color: '#f472b6' },
  media:             { icon: '🖼️', color: '#94a3b8' },
  contact:           { icon: '📇', color: '#60a5fa' },
  platform:          { icon: '🧩', color: '#38bdf8' },
  squad:             { icon: '🛡️', color: '#fbbf24' },
  agent:             { icon: '🤖', color: '#34d399' },
};

export interface EntityRefProps {
  kind: EntityKind;
  /** Entity id. Optional only when you drive opening entirely via onOpen/href. */
  id?: string | number | null;
  /** Display text (handle, label, title). Falls back to `#<id>`. */
  label?: ReactNode;
  /** Open the drawer in-place (preferred when its drawer is on this page). */
  onOpen?: () => void;
  /** Explicit deep-link, overrides the auto-route. */
  href?: string;
  /** Project slug/id for project-scoped kinds (account/task/brief/…) auto-routes. */
  project?: string | number;
  size?: PillSize;
  /** Hide the leading kind icon. */
  noIcon?: boolean;
  title?: string;
}

// Consistent chip for ANY entity. Not uppercase/mono (that's Pill's status style) —
// entity handles read as text. Colour + icon come from the kind.
export function EntityRef({ kind, id, label, onOpen, href, project, size = 'sm', noIcon, title }: EntityRefProps) {
  const meta = META[kind];
  const text = label ?? (id != null ? `#${id}` : kind);
  const resolvedHref = href ?? (!onOpen && id != null ? meta.route?.(id, project) ?? null : null);

  const chip = (
    <Pill
      color={meta.color}
      icon={noIcon ? undefined : meta.icon}
      label={text}
      tone="soft"
      size={size}
      uppercase={false}
      mono={false}
      title={title ?? `Mở ${kind} ${id != null ? '#' + id : ''}`.trim()}
      onClick={onOpen}
    />
  );

  if (onOpen) return chip;                                   // in-place open
  if (resolvedHref) return <Link href={resolvedHref} style={{ textDecoration: 'none' }}>{chip}</Link>;

  // Nothing to open — render the chip muted so it's visibly a non-live reference,
  // and warn in dev so the caller wires onOpen/href instead of shipping a dead chip.
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[EntityRef] kind="${kind}" id=${id} has no onOpen/href and no auto-route — rendered non-clickable. Pass onOpen or href.`);
  }
  return (
    <Pill color={meta.color} icon={noIcon ? undefined : meta.icon} label={text}
          tone="ghost" size={size} uppercase={false} mono={false} title={title} />
  );
}
