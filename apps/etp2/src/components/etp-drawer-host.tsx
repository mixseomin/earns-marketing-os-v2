'use client';
// NGĂN KÉO etp2 — bản gọn của EntityDrawerHost apps/web: ba loại etp (ngăn phim, ngăn Sản xuất một phim, ngăn creative phim đối thủ). Cùng kênh @/lib/entity-drawer.
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useEntityDrawerReq, openEntityDrawer, closeEntityDrawersToDepth, readEntityDrawerFromUrl, type EntityDrawerReq } from '@/lib/entity-drawer';

const EtpPhimDrawer = dynamic(() => import('./etp-phim-drawer').then((m) => m.EtpPhimDrawer), { ssr: false });
const EtpSxDrawer = dynamic(() => import('./etp-sx-drawer').then((m) => m.EtpSxDrawer), { ssr: false });
const EtpDoiThuDrawer = dynamic(() => import('./etp-doi-thu-drawer').then((m) => m.EtpDoiThuDrawer), { ssr: false });   // ngăn creative phim đối thủ (19/11/2026)

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
  if (req.kind === 'etp-dt') return <EtpDoiThuDrawer khoa={String(req.id)} onClose={onClose} />;   // khoá = tên phim chuẩn hoá, không phải số
  return null;
}
