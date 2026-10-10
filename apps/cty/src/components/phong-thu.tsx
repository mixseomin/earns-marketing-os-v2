// Khối vận hành của Phòng thử: nút "Chạy một lượt" (mỗi lần bấm = một lượt, ~1 cent) + nhật ký từng lượt, từng bước.
import Link from 'next/link';
import { dsLuot, chayMotLuot } from '@/lib/thu-nghiem';
import { dsNhanSu } from '@/lib/cong-ty';
import { KhoangGio } from './gio';
import { Nguoi } from './nguoi';

const VIEC_MAU = 'Write a 3-sentence Gumroad description for the puzzle book "Killer Sudoku for Adults: 100 Puzzles". English, no brand names, no em dashes.';
const usd = (b: { model: string; usage: { input_tokens?: number; output_tokens?: number } | null }) => {
  const g: Record<string, [number, number]> = { 'gpt-4.1-nano': [0.1, 0.4], 'gpt-4o-mini': [0.15, 0.6] };
  const k = Object.keys(g).find((x) => b.model.includes(x)); if (!k || !b.usage) return null;
  const [i, o] = g[k]!; return ((b.usage.input_tokens || 0) * i + (b.usage.output_tokens || 0) * o) / 1e6;
};

// Câu trả lời của mô hình là JSON (giao việc / kết quả / soát) → hiện thành nhãn + nội dung; chữ thường (báo cáo) giữ nguyên dòng.
const NHAN: Record<string, string> = { giao_cho: 'Giao cho', viec: 'Việc', tieu_chi: 'Tiêu chí', ket_qua: 'Kết quả', bang_chung: 'Bằng chứng', ok: 'Kết luận', ly_do: 'Lý do' };
const laNhanSu = (x: string) => dsNhanSu().some((d) => d.id === x);
const so = (n: number) => n.toLocaleString('vi-VN');
const giay = (ms: number) => `${(ms / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} s`;
const tachBuoc = (t: string) => { const m = t.match(/^(\d+)\s+(.*)$/); const ten = m ? m[2]! : t; return { so: m?.[1] ?? '', ten: ten.charAt(0).toUpperCase() + ten.slice(1) }; };

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
            : typeof x === 'string' && laNhanSu(x) ? <Nguoi id={x} />
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
        <textarea name="viec" rows={2} defaultValue={VIEC_MAU} required disabled={!admin} aria-label="Việc giao cho phòng" />
        <div className="cty-thu-nut">
          <button type="submit" disabled={!admin || dangChay}>{dangChay ? 'đang chạy…' : '▶ Chạy một lượt'}</button>
          <a className="cty-btn" href="https://vpthu.on.tc" target="_blank" rel="noreferrer">Văn phòng pixel phòng này ↗</a>
          <span className="cty-muted cty-nho">1 lượt ≈ $0,0005 qua proxy (gpt-4.1-nano + gpt-4o-mini) · trang tự tải lại mỗi 4 giây khi đang chạy</span>
        </div>
      </form>
      {!luot.length && <p className="cty-muted">Chưa có lượt nào. Bấm nút để xem Tâm giao việc → Lộc làm → Kỳ soát → báo cáo.</p>}
      {luot.map((l) => {
        const tien = l.buoc.reduce((s, b) => s + (usd(b) ?? 0), 0);
        return (
          <details key={l.ts} id={`luot-${l.ts}`} className="cty-details cty-luot" open={l === luot[0]}>
            <summary>
              <div className="cty-luot-dau"><span className={`cty-pill ${l.trang_thai === 'xong' ? '' : 'cty-pill-off'}`}>{l.trang_thai}</span><span className="cty-luot-viec">{l.viec}</span></div>
              <div className="cty-luot-meta"><KhoangGio tu={l.bat_dau} den={l.ket_thuc} />
                {l.tong && <span> · {l.tong.buoc} bước · {so(l.tong.token)} token · ${tien.toFixed(4)} · {giay(l.tong.ms)}</span>}
                {' · '}<Link href={`/nhat-ky?luot=${encodeURIComponent(l.ts)}`}>sổ sự kiện ↗</Link></div>
            </summary>
            {l.loi && <p className="cty-thu-loi">Lỗi: {l.loi}</p>}
            <ol className="cty-thu-buoc">
              {l.buoc.map((b, i) => { const t = tachBuoc(b.buoc); return (
                <li key={i}>
                  <div className="cty-buoc-dau">
                    <span className="cty-buoc-so">{t.so || i + 1}</span>
                    <b className="cty-buoc-ten">{t.ten}</b>
                    <Nguoi id={b.id} />
                    <span className="cty-buoc-gio"><KhoangGio tu={b.bat_dau} den={b.ket_thuc} ngay={false} /></span>
                  </div>
                  <div className="cty-buoc-meta">{b.model.replace(/^[a-z]+:/, '')} · {b.usage ? `${so(b.usage.input_tokens ?? 0)} vào → ${so(b.usage.output_tokens ?? 0)} ra token` : 'không có số token'} · {giay(b.ms)}{b.loi ? ` · HTTP ${b.http}` : ''}</div>
                  {b.loi ? <pre className="cty-thu-loi">{b.loi}</pre> : <Dap text={b.dap} />}
                </li>
              ); })}
            </ol>
            {l.ket && <div className="cty-thu-ket">Kết luận: việc ở trạng thái <span className={`cty-pill ${l.ket.trang_thai_viec === 'submitted' ? '' : 'cty-pill-off'}`}>{l.ket.trang_thai_viec === 'submitted' ? 'nộp, chờ Giám đốc ký' : l.ket.trang_thai_viec === 'revision' ? 'phải làm lại' : l.ket.trang_thai_viec}</span></div>}
          </details>
        );
      })}
    </section>
  );
}
