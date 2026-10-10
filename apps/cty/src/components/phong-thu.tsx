// Phòng thử, chia mảnh cho các tab của ngăn phòng (YDNI): Chạy = khung giao việc + lượt mới nhất đủ bước; Các lượt = mỗi lượt
// một dòng (bấm bung đủ bước). Mỗi lần bấm Chạy = một lượt (~$0,0005).
import Link from 'next/link';
import { dsLuot, type Luot } from '@/lib/thu-nghiem';
import { KhungChay } from './khung-chay';
import { dsNhanSu } from '@/lib/cong-ty';
import { Gio, KhoangGio } from './gio';
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

const TT: Record<string, string> = { xong: '', 'lỗi': 'cty-pill-loi', 'đang chạy': 'cty-pill-off' };
const KQ: Record<string, [string, string]> = { submitted: ['nộp, chờ ký', ''], revision: ['phải làm lại', 'cty-pill-off'] };
const tienLuot = (l: Luot) => l.buoc.reduce((s, b) => s + (usd(b) ?? 0), 0);

/** Một lượt đủ bước: đầu lượt (trạng thái · việc · giờ · số) + từng bước (người, giờ, mô hình, trả lời đã dàn nhãn). */
export function LuotChiTiet({ l }: { l: Luot }) {
  return (
    <div className="cty-luot">
      <div className="cty-luot-meta"><KhoangGio tu={l.bat_dau} den={l.ket_thuc} />
        {l.tong && <span> · {l.tong.buoc} bước · {so(l.tong.token)} token · ${tienLuot(l).toFixed(4)} · {giay(l.tong.ms)}</span>}
        {' · '}<Link href={`/nhat-ky?luot=${encodeURIComponent(l.ts)}`}>sổ sự kiện ↗</Link></div>
      {l.loi && <p className="cty-bao-loi" data-loi>Lỗi: {l.loi}</p>}
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
        {l.trang_thai === 'đang chạy' && <li className="cty-muted">đang chạy bước tiếp…</li>}
      </ol>
    </div>
  );
}

function DauLuot({ l }: { l: Luot }) {
  const kq = l.ket ? KQ[l.ket.trang_thai_viec] : null;
  return (
    <span className="cty-luot-dong">
      <span className={`cty-pill ${TT[l.trang_thai] ?? 'cty-pill-kind'}`}>{l.trang_thai}</span>
      <span className="cty-luot-viec">{l.viec}</span>
      {kq && <span className={`cty-pill ${kq[1]}`}>{kq[0]}</span>}
      <span className="cty-luot-gio"><Gio iso={l.bat_dau} /></span>
    </span>
  );
}

/** Tab Chạy: khung giao việc + lượt mới nhất đủ bước. */
export async function PhongThuChay({ admin }: { admin: boolean }) {
  const ds = await dsLuot(); const moi = ds[0];
  return (
    <div className="cty-thu">
      <KhungChay macDinh={VIEC_MAU} admin={admin} dangChay={ds.some((l) => l.trang_thai === 'đang chạy')} />
      {moi ? <><h3 className="cty-thu-tieu"><DauLuot l={moi} /></h3><LuotChiTiet l={moi} /></> : <p className="cty-muted">Chưa có lượt nào. Bấm Chạy để xem Tâm giao việc → Lộc làm → Kỳ soát → báo cáo.</p>}
    </div>
  );
}

/** Tab Các lượt: mỗi lượt một dòng, bấm bung đủ bước. */
export async function PhongThuDs() {
  const ds = await dsLuot();
  if (!ds.length) return <p className="cty-muted">Chưa có lượt nào.</p>;
  return <div className="cty-ds-luot">{ds.map((l) => <details key={l.ts} id={`luot-${l.ts}`} className="cty-luot-hang"><summary><DauLuot l={l} /></summary><LuotChiTiet l={l} /></details>)}</div>;
}

export async function demLuot() { const ds = await dsLuot(); return { tong: ds.length, dangChay: ds.some((l) => l.trang_thai === 'đang chạy'), moi: ds[0] ?? null }; }
