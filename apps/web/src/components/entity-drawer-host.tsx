'use client';

// EntityDrawerHost — mounted ONCE (RootProviders). Subscribes to the global entity-drawer
// channel and renders the right self-loading drawer for whatever <EntityRef> (or any code)
// asked to open, IN-PLACE, on ANY page. Drawers are lazy-loaded so this adds nothing to the
// global bundle until an entity is actually opened. New kinds = one line in the switch.

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useEntityDrawerReq, openEntityDrawer, closeEntityDrawer, readEntityDrawerFromUrl, HOST_KINDS } from '@/lib/entity-drawer';

const AccountDrawer = dynamic(() => import('./account-drawer').then((m) => m.AccountDrawer), { ssr: false });
const BrowserProfileDrawerById = dynamic(() => import('./entity-self-drawers').then((m) => m.BrowserProfileDrawerById), { ssr: false });
const ProxyDrawerById = dynamic(() => import('./entity-self-drawers').then((m) => m.ProxyDrawerById), { ssr: false });
const IdentityDrawer = dynamic(() => import('./identity-drawer').then((m) => m.IdentityDrawer), { ssr: false });
const BriefDrawer = dynamic(() => import('./entity-project-drawers').then((m) => m.BriefDrawer), { ssr: false });
const HabitatDrawer = dynamic(() => import('./entity-project-drawers').then((m) => m.HabitatDrawer), { ssr: false });
const TribeDrawer = dynamic(() => import('./entity-project-drawers').then((m) => m.TribeDrawer), { ssr: false });
const AgentDrawer = dynamic(() => import('./entity-more-drawers').then((m) => m.AgentDrawer), { ssr: false });
const TeamMemberDrawer = dynamic(() => import('./entity-more-drawers').then((m) => m.TeamMemberDrawer), { ssr: false });
const MediaDrawer = dynamic(() => import('./entity-more-drawers').then((m) => m.MediaDrawer), { ssr: false });
const ContactDrawer = dynamic(() => import('./entity-more-drawers').then((m) => m.ContactDrawer), { ssr: false });

// HOST_KINDS lives in @/lib/entity-drawer (single source, shared with EntityRef). The switch
// below MUST cover exactly those kinds — re-exported here for existing importers.
export { HOST_KINDS };

export function EntityDrawerHost() {
  const req = useEntityDrawerReq();
  // Deep-link restore: if the page loaded with ?ed=kind~id, open that drawer on mount.
  useEffect(() => { const u = readEntityDrawerFromUrl(); if (u) openEntityDrawer(u.kind, u.id, u.project); }, []);
  if (!req) return null;
  const onClose = () => closeEntityDrawer();
  const id = Number(req.id);
  switch (req.kind) {
    case 'account': return <AccountDrawer accountId={id} onClose={onClose} />;
    case 'browser-profile': return <BrowserProfileDrawerById id={id} onClose={onClose} />;
    case 'proxy': return <ProxyDrawerById id={id} onClose={onClose} />;
    case 'identity': return <IdentityDrawer identityId={id} onClose={onClose} />;
    case 'brief': return <BriefDrawer briefId={id} onClose={onClose} />;
    case 'habitat': return <HabitatDrawer habitatId={id} onClose={onClose} />;
    case 'tribe': return <TribeDrawer tribeId={id} onClose={onClose} />;
    case 'agent': return <AgentDrawer agentId={id} onClose={onClose} />;
    case 'team-member': return <TeamMemberDrawer userId={id} onClose={onClose} />;
    case 'media': return <MediaDrawer mediaId={id} onClose={onClose} />;
    case 'contact': return <ContactDrawer contactId={id} onClose={onClose} />;
    default: return null;   // unregistered kind → nothing (EntityRef falls back to deep-link route)
  }
}
