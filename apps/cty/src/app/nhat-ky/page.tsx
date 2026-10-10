// /nhat-ky — sổ sự kiện chung (worker/log.mjs): ai gọi mô hình gì, ai đọc tài liệu nào, ai gửi tin cho ai, quyết định, lỗi.
// Lọc theo lượt / người / loại qua query; mỗi mã lượt là một link để lần theo một việc từ đầu tới cuối.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser, loginUrl } from '@/lib/auth';
import { docLog } from '../../../worker/log.mjs';
import { Gio, MuiNhan } from '@/components/gio';
import { Nguoi } from '@/components/nguoi';

export const dynamic = 'force-dynamic';
type SuKien = { ts: string; luot?: string | null; loai: string; tu?: string | null; toi?: string | null; chi_tiet?: Record<string, unknown> };
const LOAI: Record<string, string> = { goi: 'gọi mô hình', doc: 'đọc tài liệu', tin: 'tin trao tay', quyet: 'quyết định', loi: 'lỗi', 'he-thong': 'hệ thống' };

function tomTat(e: SuKien): string {
  const c = e.chi_tiet ?? {};
  switch (e.loai) {
    case 'goi': return `${String(c.model)} · ${(c.usage as { input_tokens?: number; output_tokens?: number } | null)?.input_tokens ?? '?'}+${(c.usage as { output_tokens?: number } | null)?.output_tokens ?? '?'} tok · ${c.usd != null ? '$' + Number(c.usd).toFixed(5) : 'giá ?'} · ${String(c.ms)}ms${c.cache ? ' · cache' : ''}`;
    case 'doc': return `${String(c.tep)} (${String(c.ky_tu)} ký tự) — ${String(c.ly_do ?? '')}`;
    case 'tin': return `${String(c.buoc ?? '')}: ${String(c.noi_dung ?? c.tra_loi ?? '')}`;
    case 'quyet': return `${c.ok ? 'đạt' : 'chưa đạt'} — ${String(c.ly_do ?? '')} → ${String(c.trang_thai_viec ?? '')}`;
    case 'loi': return String(c.loi ?? JSON.stringify(c));
    default: return `${String(c.su_kien ?? '')} ${c.viec ? '· ' + String(c.viec) : ''} ${c.trang_thai ? '· ' + String(c.trang_thai) : ''}`;
  }
}

export default async function NhatKy({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await getCurrentUser(); if (!me) redirect(loginUrl('/nhat-ky'));
  const q = await searchParams;
  const ds = docLog({ luot: q.luot, tu: q.tu, loai: q.loai, n: 300 }) as SuKien[];
  const loc = (k: string, v?: string) => { const p = new URLSearchParams(); for (const [a, b] of Object.entries({ ...q, [k]: v })) if (b) p.set(a, b); const s = p.toString(); return `/nhat-ky${s ? '?' + s : ''}`; };
  return (
    <>
      <p className="cty-mono cty-muted" style={{ margin: 0 }}>sổ sự kiện · {ds.length} dòng gần nhất
        {q.luot && <> · lượt <b>{q.luot}</b> <Link href={loc('luot')}>×</Link></>}
        {q.tu && <> · người <b>{q.tu}</b> <Link href={loc('tu')}>×</Link></>}
        {q.loai && <> · loại <b>{LOAI[q.loai] ?? q.loai}</b> <Link href={loc('loai')}>×</Link></>}
      </p>
      <p className="cty-pills">{Object.entries(LOAI).map(([k, v]) => <Link key={k} className={`cty-pill ${q.loai === k ? '' : 'cty-pill-kind'}`} href={loc('loai', q.loai === k ? undefined : k)}>{v}</Link>)}</p>
      {!ds.length && <p className="cty-muted">Chưa có sự kiện nào. Sự kiện sinh ra khi một lượt chạy (Phòng thử) hoặc khi proxy nhận lượt gọi.</p>}
      <div className="cty-md cty-cuon"><table className="cty-log">
        <thead><tr><th>lúc <MuiNhan /></th><th>lượt</th><th>loại</th><th>từ → tới</th><th>chi tiết</th></tr></thead>
        <tbody>{ds.map((e, i) => (
          <tr key={i}>
            <td className="cty-mono"><Gio iso={e.ts} mui={false} /></td>
            <td className="cty-mono">{e.luot ? <Link href={loc('luot', e.luot)}>{e.luot.slice(11, 19)}</Link> : '—'}</td>
            <td><span className={`cty-pill ${e.loai === 'loi' ? 'cty-pill-off' : e.loai === 'goi' ? '' : 'cty-pill-kind'}`}>{LOAI[e.loai] ?? e.loai}</span></td>
            <td className="cty-log-ai"><Nguoi id={e.tu} anh={false} />{e.tu && <Link className="cty-loc" href={loc('tu', e.tu)} title="lọc theo người này">⌕</Link>}{e.toi ? <> → <Nguoi id={e.toi} anh={false} /><Link className="cty-loc" href={loc('tu', e.toi)} title="lọc theo người này">⌕</Link></> : ''}</td>
            <td className="cty-log-ct">{tomTat(e)}</td>
          </tr>
        ))}</tbody>
      </table></div>
    </>
  );
}
