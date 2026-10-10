// Khối vận hành của Phòng thử: nút "Chạy một lượt" (mỗi lần bấm = một lượt, ~1 cent) + nhật ký từng lượt, từng bước.
import Link from 'next/link';
import { dsLuot, chayMotLuot } from '@/lib/thu-nghiem';

const VIEC_MAU = 'Write a 3-sentence Gumroad description for the puzzle book "Killer Sudoku for Adults: 100 Puzzles". English, no brand names, no em dashes.';
const usd = (b: { model: string; usage: { input_tokens?: number; output_tokens?: number } | null }) => {
  const g: Record<string, [number, number]> = { 'gpt-4.1-nano': [0.1, 0.4], 'gpt-4o-mini': [0.15, 0.6] };
  const k = Object.keys(g).find((x) => b.model.includes(x)); if (!k || !b.usage) return null;
  const [i, o] = g[k]!; return ((b.usage.input_tokens || 0) * i + (b.usage.output_tokens || 0) * o) / 1e6;
};

// Câu trả lời của mô hình là JSON (giao việc / kết quả / soát) → hiện thành nhãn + nội dung; chữ thường (báo cáo) giữ nguyên dòng.
const NHAN: Record<string, string> = { giao_cho: 'Giao cho', viec: 'Việc', tieu_chi: 'Tiêu chí', ket_qua: 'Kết quả', bang_chung: 'Bằng chứng', ok: 'Kết luận', ly_do: 'Lý do' };
function Dap({ text }: { text: string }) {
  let v: unknown = null;
  try { v = JSON.parse(text); } catch { /* không phải JSON */ }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return <div className="cty-dap cty-dap-chu">{text}</div>;
  return (
    <dl className="cty-dap">
      {Object.entries(v as Record<string, unknown>).map(([k, x]) => (
        <div key={k} className="cty-dap-hang">
          <dt>{NHAN[k] ?? k}</dt>
          <dd>{typeof x === 'boolean' ? <span className={`cty-pill ${x ? '' : 'cty-pill-off'}`}>{x ? 'đạt' : 'chưa đạt'}</span>
            : Array.isArray(x) ? <ol>{x.map((y, i) => <li key={i}>{String(y)}</li>)}</ol>
            : <span className="cty-dap-chu">{String(x)}</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export async function PhongThu({ admin }: { admin: boolean }) {
  const luot = await dsLuot();
  const dangChay = luot.some((l) => l.trang_thai === 'đang chạy');
  return (
    <section className="cty-thu">
      {dangChay && <meta httpEquiv="refresh" content="4" />}
      <form action={chayMotLuot} className="cty-thu-form">
        <textarea name="viec" rows={2} defaultValue={VIEC_MAU} required disabled={!admin} />
        <button type="submit" disabled={!admin || dangChay}>{dangChay ? 'đang chạy…' : '▶ Chạy một lượt'}</button>
        <span className="cty-mono cty-muted">mỗi lần bấm = 1 lượt qua proxy (gpt-4.1-nano + gpt-4o-mini), ghi ai_usage, trần $1/người</span>
        <a className="cty-pill" href="https://vpthu.on.tc" target="_blank" rel="noreferrer">văn phòng pixel riêng phòng này ↗</a>
        <span className="cty-mono cty-muted">mở cửa sổ đó cạnh trang này rồi bấm chạy: ai đang được gọi thì gõ phím, xong về ghế; từng bước hiện ở dưới (tự tải lại mỗi 4 giây)</span>
      </form>
      {!luot.length && <p className="cty-muted">Chưa có lượt nào. Bấm nút để xem Tâm giao việc → Lộc làm → Kỳ soát → báo cáo.</p>}
      {luot.map((l) => {
        const tien = l.buoc.reduce((s, b) => s + (usd(b) ?? 0), 0);
        return (
          <details key={l.ts} className="cty-details" open={l === luot[0]}>
            <summary>
              <span className={`cty-pill ${l.trang_thai === 'xong' ? '' : 'cty-pill-off'}`}>{l.trang_thai}</span> {l.ts.replace('T', ' ').slice(0, 19)} · {l.viec.slice(0, 70)}
              {l.tong && <span className="cty-mono cty-muted"> · {l.tong.buoc} bước · {l.tong.token} token · ${tien.toFixed(4)} · {(l.tong.ms / 1000).toFixed(1)}s</span>} <Link className="cty-pill" href={`/nhat-ky?luot=${encodeURIComponent(l.ts)}`}>sổ sự kiện lượt này</Link>
            </summary>
            {l.loi && <p className="cty-thu-loi">Lỗi: {l.loi}</p>}
            <ol className="cty-thu-buoc">
              {l.buoc.map((b, i) => (
                <li key={i}>
                  <div className="cty-thu-head"><b>{b.buoc}</b> · {b.ai} <span className="cty-mono cty-muted">{b.model} · {b.usage ? `${b.usage.input_tokens}+${b.usage.output_tokens} tok` : ''} · {(b.ms / 1000).toFixed(1)}s{b.loi ? ` · HTTP ${b.http}` : ''}</span></div>
                  {b.loi ? <pre className="cty-thu-loi">{b.loi}</pre> : <Dap text={b.dap} />}
                </li>
              ))}
            </ol>
            {l.ket && <div className="cty-thu-ket"><b>Kết luận:</b> việc ở trạng thái <span className="cty-pill">{l.ket.trang_thai_viec}</span>{l.ket.soat ? ` · Kỳ: ${l.ket.soat.ok ? 'đạt' : 'chưa đạt'} — ${l.ket.soat.ly_do}` : ''}</div>}
          </details>
        );
      })}
    </section>
  );
}
