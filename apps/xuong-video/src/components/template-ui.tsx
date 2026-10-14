'use client';
// TEMPLATE trên studio (template.ts · template-db.ts): template là một phim — sửa kinh thánh / anchor / shot như thường, chỗ cần đổi gõ {{ô}}.
// Panel này: nhãn + gợi ý + giá trị mẫu của từng ô, và ngăn "Tạo phim từ template" (điền ô → phim mới, 0đ).
import { useCallback, useEffect, useState } from 'react';
import { Ngan } from './ngan';
import { O, Nut, Loi, Pill, mono } from './ui';
import { docTemplate, luuCauHinhTemplate, taoPhimTuTemplate } from '@/lib/actions';
import { giaTriMau, oThieu, type OTemplateDs } from '@/lib/xuong-video/template';
import type { CauHinhTemplate, Phim } from '@/lib/xuong-video/kieu';

type DuLieu = { cfg: CauHinhTemplate | null; o: OTemplateDs[] };

function useTemplate(phimId: number) {
  const [d, setD] = useState<DuLieu | null>(null);
  const [loi, setLoi] = useState('');
  const nap = useCallback(async () => { const r = await docTemplate(phimId); if (r.ok) setD(r.data); else setLoi(r.loi); }, [phimId]);
  useEffect(() => { void nap(); }, [nap]);
  return { d, loi, nap };
}

/** Panel đầu tab 🎭 Phim của template: các ô + nút tạo phim. */
export function TemplatePanel({ phim, onChanged, onMoPhim }: { phim: Phim; onChanged: () => Promise<void>; onMoPhim: (id: number) => void }) {
  const { d, loi, nap } = useTemplate(phim.id);
  const [o, setO] = useState<OTemplateDs[]>([]);
  const [moTa, setMoTa] = useState('');
  const [ban, setBan] = useState(false);
  const [loiLuu, setLoiLuu] = useState('');
  const [tao, setTao] = useState(false);
  useEffect(() => { if (d) { setO(d.o); setMoTa(d.cfg?.mo_ta ?? ''); } }, [d]);
  const sua = (k: string, x: Partial<OTemplateDs>) => setO((ds) => ds.map((v) => (v.k === k ? { ...v, ...x } : v)));
  const luu = async () => {
    setBan(true); setLoiLuu('');
    const cfg: CauHinhTemplate = { mo_ta: moTa, o: Object.fromEntries(o.map(({ k, dung: _d, ...v }) => [k, v])) };
    const r = await luuCauHinhTemplate(phim.id, cfg);
    setBan(false);
    if (!r.ok) { setLoiLuu(r.loi); return; }
    await nap(); await onChanged();
  };
  return (
    <div className="xv-panel">
      <h3>🧩 Template<small>sửa phim này như phim thường — chỗ nào đổi theo sản phẩm / góc / chân dung thì gõ <code>{'{{ten_o}}'}</code> (kinh thánh, anchor, brief, chữ màn, lời, prompt…)</small></h3>
      <Loi>{loi}</Loi>
      <O label="Template dùng khi nào"><textarea className="xv-in" rows={2} value={moTa} onChange={(e) => setMoTa(e.target.value)} placeholder="UGC kể chuyện tình huống — hợp sản phẩm giải quyết một nỗi khó chịu hằng ngày…" /></O>
      {!d ? <span style={mono}>…</span> : o.length === 0 ? <div style={mono}>Chưa có ô nào — gõ {'{{san_pham}}'}, {'{{nhan_vat}}'}… vào chữ của phim rồi mở lại tab này.</div> : (
        <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
          <div style={{ ...mono, display: 'grid', gridTemplateColumns: '130px 1fr 1.4fr 1.6fr 40px', gap: 6 }}><span>Ô</span><span>Nhãn</span><span>Gợi ý cho người điền</span><span>Giá trị mẫu</span><span title="ô chữ dài (nhiều dòng)">dài</span></div>
          {o.map((v) => (
            <div key={v.k} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1.4fr 1.6fr 40px', gap: 6, alignItems: 'start', opacity: v.dung ? 1 : 0.5 }}>
              <span style={{ ...mono, paddingTop: 6 }} title={v.dung ? 'đang dùng trong chữ của template' : 'đã khai nhưng không còn chỗ nào dùng — lưu vẫn giữ, không bắt điền'}>{`{{${v.k}}}`}{!v.dung && ' ·thừa'}</span>
              <input className="xv-in" value={v.ten} onChange={(e) => sua(v.k, { ten: e.target.value })} />
              <input className="xv-in" value={v.goi_y ?? ''} onChange={(e) => sua(v.k, { goi_y: e.target.value })} />
              <textarea className="xv-in" rows={v.dai ? 3 : 1} value={v.mau ?? ''} onChange={(e) => sua(v.k, { mau: e.target.value })} />
              <input type="checkbox" checked={!!v.dai} onChange={(e) => sua(v.k, { dai: e.target.checked })} style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
      )}
      <Loi>{loiLuu}</Loi>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <Nut ban={ban} onClick={() => void luu()}>Lưu ô</Nut>
        <Nut chinh ly={!d?.o.length && 'template chưa có ô nào'} onClick={() => setTao(true)}>🧩 Tạo phim từ template</Nut>
      </div>
      {tao && d && <TaoTuTemplate phim={phim} o={o} onClose={() => setTao(false)} onTao={(id) => { setTao(false); onMoPhim(id); }} />}
    </div>
  );
}

/** Ngăn điền ô → phim mới. Giá trị đầu = giá trị mẫu của từng ô. */
function TaoTuTemplate({ phim, o, onClose, onTao }: { phim: Phim; o: OTemplateDs[]; onClose: () => void; onTao: (id: number) => void }) {
  const dung = o.filter((v) => v.dung);
  const [gt, setGt] = useState<Record<string, string>>(() => giaTriMau(dung));
  const [ten, setTen] = useState(phim.ten.replace(/^template\s*·\s*/i, ''));
  const [ban, setBan] = useState(false);
  const [loi, setLoi] = useState('');
  const thieu = oThieu(dung, gt);
  const lam = async () => {
    setBan(true); setLoi('');
    const r = await taoPhimTuTemplate(phim.id, ten, gt);
    setBan(false);
    if (!r.ok) { setLoi(r.loi); return; }
    onTao(r.data.phimId);
  };
  return (
    <Ngan nho onClose={onClose} tieuDe={`🧩 Tạo phim từ: ${phim.ten}`}>
      <div style={{ ...mono, marginBottom: 8 }}>Chép cả template (kinh thánh, anchor, tập, shot) rồi điền ô — 0đ, chưa sinh gì. Shot không chứa ô nào giữ nguyên hình/clip (khối dùng chung); shot có ô → về nháp để sinh lại.</div>
      <O label="Tên phim mới"><input className="xv-in" value={ten} onChange={(e) => setTen(e.target.value)} /></O>
      <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
        {dung.map((v) => (
          <O key={v.k} label={<>{v.ten} <span style={mono}>{`{{${v.k}}}`}</span></>} hint={v.goi_y}>
            {v.dai || (gt[v.k] ?? '').includes('\n')
              ? <textarea className="xv-in" rows={4} value={gt[v.k] ?? ''} onChange={(e) => setGt({ ...gt, [v.k]: e.target.value })} />
              : <input className="xv-in" value={gt[v.k] ?? ''} onChange={(e) => setGt({ ...gt, [v.k]: e.target.value })} />}
          </O>
        ))}
      </div>
      <Loi>{loi}</Loi>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10 }}>
        <Nut chinh ban={ban} ly={(!ten.trim() && 'nhập tên phim') || (thieu.length > 0 && `chưa điền: ${thieu.map((x) => x.ten).join(', ')}`)} onClick={() => void lam()}>Tạo phim (0đ)</Nut>
        {thieu.length > 0 && <Pill color="var(--amber)">còn {thieu.length} ô trống</Pill>}
      </div>
    </Ngan>
  );
}
