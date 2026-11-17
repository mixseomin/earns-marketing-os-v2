'use client';
// Ô "Mô hình" của bảng nhân sự — admin đổi mô hình + chọn luồng QUA CỔNG AI tại chỗ (anh 17/11/2026, góp ý #1661 "edit chọn model, và chọn luồng
// qua cổng api ai nếu cần"). Lưu ở nhip-chinh.json (worker/nhip.mjs datModel), đè dòng model của SOUL; bỏ trống = về lại SOUL.
// Không phải admin: chỉ thấy chữ (con `hien`). Lỗi máy chủ hiện đỏ ngay dưới nút Lưu.
import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { chinhModel } from '@/lib/nhip-chinh';

const QUA = /\s*\bqua:cong\b/g;

export function ChinhModel({ id, model, soul, goiY, admin, hien }: { id: string; model: string; soul: string; goiY: string[]; admin: boolean; hien: ReactNode }) {
  const [mo, setMo] = useState(false);
  const goc = model.replace(QUA, '').trim(); const quaGoc = /\bqua:cong\b/.test(model);
  const [m, setM] = useState(goc); const [qua, setQua] = useState(quaGoc);
  const [cho, chuyen] = useTransition(); const [bao, setBao] = useState<{ ok: boolean; chu: string } | null>(null); const router = useRouter();
  const [xo, setXo] = useState(false); const [loc, setLoc] = useState('');
  const ds = goiY.filter((g) => !loc.trim() || g.toLowerCase().includes(loc.trim().toLowerCase()));
  if (!admin) return <>{hien}</>;
  const cli = /^claude-code\b/.test(m.trim());   // qua:cong chỉ nghĩa với kỹ sư Claude Code CLI; người gọi API vốn đã đi qua cổng
  const moi = [m.trim(), cli && qua ? 'qua:cong' : ''].filter(Boolean).join(' ');
  const luu = (gt: string) => chuyen(async () => { setBao(null); const r = await chinhModel(id, gt);
    setBao(r.ok ? { ok: true, chu: gt ? 'Đã lưu — áp từ lượt kế tiếp' : 'Đã về lại SOUL' } : { ok: false, chu: r.loi ?? 'Máy chủ từ chối.' }); if (r.ok) setMo(false); router.refresh(); });
  if (!mo) return <span className="cty-chinh-model">{hien} <button type="button" className="cty-btn-link cty-nho" title="Đổi mô hình / luồng qua cổng AI" aria-label="Đổi mô hình" onClick={() => setMo(true)}>✎</button>
    {soul && <span className="cty-muted" title={`SOUL ghi: ${soul}`}> (đã chỉnh)</span>}{bao && <div className={bao.ok ? 'cty-bao-ok' : 'cty-bao-loi'}>{bao.chu}</div>}</span>;
  return (
    <div className="cty-nho cty-chinh-ca">
      {/* góp ý #1664: datalist chỉ hiện gợi ý KHỚP chữ đang có → ô đã điền sẵn thì không thấy danh sách. Thay bằng ô chọn có tìm (kiểu Select2): mở là thấy hết, gõ thì lọc. */}
      <span className="cty-chon-tim">
        <input value={m} onChange={(e) => { setM(e.target.value); setLoc(e.target.value); setXo(true); }} onFocus={() => { setLoc(''); setXo(true); }}
          onBlur={() => setTimeout(() => setXo(false), 150)} onKeyDown={(e) => { if (e.key === 'Escape') setXo(false); }} aria-label="Mô hình" placeholder="vd claude-code:opus effort:low" size={24} autoFocus />
        <button type="button" className="cty-chon-tim-mui" aria-label="Mở danh sách" tabIndex={-1} onMouseDown={(e) => { e.preventDefault(); setLoc(''); setXo((x) => !x); }}>▾</button>
        {xo && <ul className="cty-chon-tim-ds" role="listbox">{ds.length ? ds.map((g) => <li key={g} role="option" aria-selected={g === m.trim()} className={g === m.trim() ? 'dang' : ''}
          onMouseDown={(e) => { e.preventDefault(); setM(g); setXo(false); }}>{g}</li>) : <li className="cty-muted">Không có gợi ý — giữ chữ gõ tay</li>}</ul>}
      </span>
      <label className={cli ? '' : 'cty-muted'} title={cli ? 'Claude Code chạy qua cổng AI spy (donk → ckey), không dùng gói Claude' : 'Người gọi API vốn đã đi qua cổng AI; tuỳ chọn này chỉ cho kỹ sư Claude Code CLI'}>
        <input type="checkbox" checked={cli && qua} disabled={!cli} onChange={(e) => setQua(e.target.checked)} /> qua cổng AI</label>
      <button type="button" className="cty-btn cty-nho" disabled={cho || !m.trim() || moi === model} onClick={() => luu(moi)}>{cho ? 'Đang lưu…' : 'Lưu'}</button>
      {soul && <button type="button" className="cty-btn cty-nho" disabled={cho} title={`Về lại SOUL: ${soul}`} onClick={() => luu('')}>Về SOUL</button>}
      <button type="button" className="cty-btn-link cty-nho" onClick={() => { setMo(false); setM(goc); setQua(quaGoc); setBao(null); }}>Huỷ</button>
      {bao && <span className={bao.ok ? 'cty-bao-ok' : 'cty-bao-loi'} data-loi={bao.ok ? undefined : ''}>{bao.chu}</span>}
    </div>
  );
}
