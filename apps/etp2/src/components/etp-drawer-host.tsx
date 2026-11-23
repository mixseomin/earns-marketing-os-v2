'use client';
// NGĂN KÉO etp2 — bản gọn của EntityDrawerHost apps/web: ba loại etp (ngăn phim, ngăn Sản xuất một phim, ngăn creative phim đối thủ). Cùng kênh @/lib/entity-drawer.
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useEntityDrawerReq, openEntityDrawer, closeEntityDrawersToDepth, readEntityDrawerFromUrl, type EntityDrawerReq } from '@/lib/entity-drawer';

const EtpPhimDrawer = dynamic(() => import('./etp-phim-drawer').then((m) => m.EtpPhimDrawer), { ssr: false });
const EtpSxDrawer = dynamic(() => import('./etp-sx-drawer').then((m) => m.EtpSxDrawer), { ssr: false });
const EtpDoiThuDrawer = dynamic(() => import('./etp-doi-thu-drawer').then((m) => m.EtpDoiThuDrawer), { ssr: false });   // ngăn creative phim đối thủ (19/11/2026)
const EtpMauDungDrawer = dynamic(() => import('./etp-mau-dung-drawer').then((m) => m.EtpMauDungDrawer), { ssr: false });   // chi tiết việc dựng theo mẫu — dòng thời gian (19/11/2026)
const EtpMauDrawer = dynamic(() => import('./etp-mau-drawer').then((m) => m.EtpMauDrawer), { ssr: false });   // chi tiết một mẫu creative: thông số + phim sản xuất (19/11/2026)
const EtpMauPhimDrawer = dynamic(() => import('./etp-mau-phim-drawer').then((m) => m.EtpMauPhimDrawer), { ssr: false });   // chọn phim sinh creative theo mẫu (19/11/2026)
const EtpCrPhimDrawer = dynamic(() => import('./etp-cr-phim-drawer').then((m) => m.EtpCrPhimDrawer), { ssr: false });   // creative của một phim: soạn + thư viện + lên camp (23/11/2026)

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
  if (req.kind === 'etp-mau-dung') return <EtpMauDungDrawer khoa={String(req.id)} onClose={onClose} />;   // id = <mã mẫu>:<mã phim>
  if (req.kind === 'etp-mau') return <EtpMauDrawer khoa={String(req.id)} onClose={onClose} />;   // id = <loại>:<mã mẫu>
  if (req.kind === 'etp-mau-phim') return <EtpMauPhimDrawer ma={String(req.id)} onClose={onClose} />;   // id = mã mẫu (sổ etp-mau-cr.json / sổ dạng)
  if (req.kind === 'etp-cr-phim') return <EtpCrPhimDrawer khoa={String(req.id)} onClose={onClose} />;   // id = <mã phim> hoặc <mã phim>:moi
  return null;
}
