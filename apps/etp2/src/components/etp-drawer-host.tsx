'use client';
// NGĂN KÉO etp2 — bản gọn của EntityDrawerHost apps/web: chỉ hai loại etp (ngăn phim, ngăn Sản xuất một phim). Cùng kênh @/lib/entity-drawer.
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useEntityDrawerReq, openEntityDrawer, closeEntityDrawersToDepth, readEntityDrawerFromUrl, type EntityDrawerReq } from '@/lib/entity-drawer';

const EtpPhimDrawer = dynamic(() => import('./etp-phim-drawer').then((m) => m.EtpPhimDrawer), { ssr: false });
const EtpSxDrawer = dynamic(() => import('./etp-sx-drawer').then((m) => m.EtpSxDrawer), { ssr: false });

export function EtpDrawerHost() {
  const stack = useEntityDrawerReq();
  useEffect(() => { readEntityDrawerFromUrl().forEach((u) => openEntityDrawer(u.kind, u.id, u.project)); }, []);
  if (!stack.length) return null;
  return <>{stack.map((req, i) => <Khung key={`${req.kind}~${req.id}`} req={req} onClose={() => closeEntityDrawersToDepth(i)} />)}</>;
}

function Khung({ req, onClose }: { req: EntityDrawerReq; onClose: () => void }) {
  const id = Number(req.id);
  if (req.kind === 'etp-phim') return <EtpPhimDrawer id={id} onClose={onClose} />;
  if (req.kind === 'etp-sx') return <EtpSxDrawer id={id} onClose={onClose} />;
  return null;
}
