import Link from 'next/link';
import type { Doc } from '@/lib/cong-ty';
import { Avatar, hueOf } from './avatar';

export function TheNhanSu({ d }: { d: Doc }) {
  const f = d.fm; const phong = String(f.phong ?? '');
  const kind = String(f.kind ?? 'ai');
  return (
    <Link href={`/nhan-su/${d.id}`} className="cty-the">
      <Avatar seed={d.id} hue={hueOf(phong)} />
      <div className="cty-the-body">
        <div className="cty-the-ten">{String(f.ten)} <span className="cty-the-chuc">· {String(f.chuc_danh)}</span> <span className="cty-pill cty-pill-kind">{kind === 'ai' ? '🤖 AI' : kind === 'human' ? '👤 người' : '🏷 vendor'}</span></div>
        <div className="cty-mono cty-muted">{String(f.model)} · mức {String(f.muc_quyet)} · {f.heartbeat === 'off' || f.heartbeat === false ? 'heartbeat: tắt' : `heartbeat: ${String(f.heartbeat)}`}</div>
      </div>
    </Link>
  );
}
