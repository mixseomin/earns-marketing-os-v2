'use client';
// 🧪 Ngăn THỬ "nhiều shot trong một clip" cho một phân cảnh (ref2v-canh.ts — học Movie Maker của Digen). Mở từ khối phân cảnh trên timeline.
// Xem trước 0đ: shot nào vào clip (mỗi shot bao nhiêu giây, prompt), ảnh tham chiếu (@Element / @Image), giá thật. Nút sinh thử tốn tiền — anh bấm,
// bấm hai nhịp xác nhận giá (Nut gia). Kết quả chỉ ở sổ job + hiện ở đây, KHÔNG thay clip của shot nào.
import { useEffect, useState } from 'react';
import { Ngan } from './ngan';
import { Nut, Loi, mono, goiAction } from './ui';
import { xemRef2vCanh, thuRef2vCanh, dsThuRef2v } from '@/lib/actions';
import { tien } from '@/lib/xuong-video/kieu';

type Xem = Awaited<ReturnType<typeof xemRef2vCanh>>;
type Ds = Awaited<ReturnType<typeof dsThuRef2v>>;

export function NganRef2v({ tapId, phanDoan, onClose }: { tapId: number; phanDoan: string; onClose: () => void }) {
  const [tieng, setTieng] = useState(false);
  const [xem, setXem] = useState<Xem>(null); const [ds, setDs] = useState<Ds>([]);
  const [loi, setLoi] = useState(''); const [ban, setBan] = useState(false);
  useEffect(() => { void xemRef2vCanh(tapId, phanDoan, tieng).then(setXem); }, [tapId, phanDoan, tieng]);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const nap = async () => { const d = await dsThuRef2v(tapId); setDs(d); if (d.some((x) => x.trang_thai === 'chay')) t = setTimeout(() => void nap(), 15000); };
    void nap(); return () => clearTimeout(t);
  }, [tapId]);
  const chay = async () => {
    setBan(true); setLoi('');
    const r = await goiAction(() => thuRef2vCanh(tapId, phanDoan, tieng));
    setBan(false); setLoi(r.loi);
    if (!r.loi) setDs(await dsThuRef2v(tapId));
  };
  const cuaCanh = ds.filter((x) => x.phan_doan === phanDoan);
  return (
    <Ngan onClose={onClose} tieuDe={`🧪 Thử nhiều shot / một clip · ${phanDoan}`}>
      <div style={{ display: 'grid', gap: 10, fontSize: 12.5 }}>
        <div style={{ ...mono, fontSize: 11, lineHeight: 1.5 }}>Một lượt reference-to-video cho cả phân cảnh (kiểu Movie Maker của Digen): model nhận ảnh mẫu nhân vật / bối cảnh / đồ vật + danh sách prompt từng shot theo giây → một clip có cắt bên trong. Thử nghiệm để so với cách keyframe → clip từng shot; kết quả không thay clip của shot nào.</div>
        {!xem ? <div style={mono}>đang dựng…</div> : <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{xem.tham_chieu.map((t) => (
            <div key={t.ma} title={`${t.ten} · ${t.vai === 'element' ? 'nhân vật (ảnh chính diện + ảnh phụ)' : 'ảnh tham chiếu'}`} style={{ display: 'grid', gap: 2, justifyItems: 'center', fontSize: 10.5 }}>
              <img src={t.anh[0]} alt={t.ten} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)' }} />
              <span className="xv-mono">{t.ma}</span><span>{t.ten}</span>
            </div>))}</div>
          <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>{xem.shots.map((x) => (
            <li key={x.id}><b>#{x.thu_tu}</b> <span className="xv-mono">{x.giay}s</span> — <span style={{ color: 'var(--fg-2)' }}>{x.prompt}</span></li>))}</ol>
          {xem.bo.length > 0 && <div style={{ ...mono, fontSize: 11 }}>không đưa vào (quá 15 giây hoặc quá 4 ảnh tham chiếu): {xem.bo.join(', ')}</div>}
          {xem.loi.map((l, i) => <div key={i} style={{ color: 'var(--amber)', fontSize: 12 }}>⚠ {l}</div>)}
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}><input type="checkbox" checked={tieng} onChange={(e) => setTieng(e.target.checked)} /> sinh kèm tiếng (đắt hơn)</label>
          <div><Nut chinh ly={xem.loi.length ? xem.loi[0] : false} ban={ban} gia={xem.cents} title="Gửi MỘT lượt thử — tốn tiền, bấm hai lần để xác nhận giá" onClick={() => void chay()}>🧪 Sinh thử · {xem.giay}s · {xem.shots.length} shot · {tien(xem.cents)}</Nut></div>
        </>}
        {loi && <Loi>{loi}</Loi>}
        {cuaCanh.length > 0 && <div style={{ display: 'grid', gap: 8 }}>
          <b>Các lượt thử của cảnh này</b>
          {cuaCanh.map((x) => (
            <div key={x.id} style={{ display: 'grid', gap: 4 }}>
              <span className="xv-mono">job #{x.id} · {x.giay}s · {x.trang_thai === 'chay' ? 'đang sinh…' : x.trang_thai === 'xong' ? tien(x.cents) : `lỗi: ${x.loi}`}</span>
              {x.output_url && <video src={x.output_url} controls playsInline style={{ maxWidth: 320, borderRadius: 6 }} />}
            </div>))}
        </div>}
      </div>
    </Ngan>
  );
}
