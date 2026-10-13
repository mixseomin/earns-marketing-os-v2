'use client';
// 🧑 Thử người xem lần đầu (nguoi-xem.ts): nút có giá + kết quả — người xem kể lại, 5 câu hiểu, điểm, chỗ vấp theo shot (bấm = mở shot).
// Bước bắt buộc: chưa đạt / kịch bản đổi sau lần thử → chặn sinh keyframe + xuất.
import { Fragment, useState } from 'react';
import { thuNguoiXemTap, suaTheoNguoiXem } from '@/lib/actions';
import { giaChuCents, gioVN, tien, type Canh, type Tap } from '@/lib/xuong-video/kieu';
import { chanNguoiXem, TEN_NUT_NGUOI_XEM } from '@/lib/xuong-video/nguoi-xem';
import { Nut, Loi, mono, goiAction } from './ui';

export function NguoiXem({ tap, canh, moHinhChu, coAnthropic, onChanged, onMoShot }: { tap: Tap; canh: Canh[]; moHinhChu: string; coAnthropic: boolean; onChanged: () => Promise<void>; onMoShot?: (thuTu: number) => void }) {
  const [ban, setBan] = useState(false);
  const [loi, setLoi] = useState('');
  const [banSua, setBanSua] = useState(false);
  const [daSua, setDaSua] = useState('');
  const [xemChiTiet, setXemChiTiet] = useState(false);
  const t = tap.thu_nguoi_xem;
  const chan = chanNguoiXem(t, canh);
  const cu = !!t && chan.some((x) => x.includes('đã sửa sau lần kiểm'));
  const gia = giaChuCents(moHinhChu, 6000, 3000);
  const giaSua = giaChuCents(moHinhChu, 8000, 5000);
  const sua = async () => {
    setBanSua(true); setLoi(''); setDaSua('');
    const { loi: l, kq: r } = await goiAction(() => suaTheoNguoiXem(tap.id));
    setLoi(l);
    if (r?.ok) {
      setDaSua(`✓ Đã sửa ${r.data.sua} shot${r.data.them ? `, thêm ${r.data.them} shot` : ''}. ${r.data.ghi_chu} Còn phải: ${[r.data.canGiong && `sinh giọng ${r.data.canGiong} câu`, r.data.canHinh.length && `sinh lại keyframe ${r.data.canHinh.length} shot (đánh dấu đỏ trên shot)`].filter(Boolean).join(' · ') || 'không'} — rồi bấm kiểm lại. Sửa nhầm: ↶ ở đầu ngăn phim trả lại lời / chữ / hình đã sửa; shot được THÊM thì bỏ bằng 🗑 trên shot.`);
    }
    setBanSua(false); await onChanged();
  };
  const lam = async () => { setBan(true); setLoi(''); setLoi((await goiAction(() => thuNguoiXemTap(tap.id))).loi); setBan(false); await onChanged(); };
  const mau = !t ? 'var(--amber)' : cu ? 'var(--amber)' : t.dat ? '#4ade80' : 'var(--red)';
  return (
    <div className="xv-panel" style={{ marginTop: 10, borderLeft: `3px solid ${mau}` }}>
      <h3>🧑 Người xem có hiểu phim không<small>bắt buộc trước keyframe + xuất · Claude chỉ thấy chữ / lời / hình từng shot (không đọc brief), kể lại câu chuyện rồi so với ý tác giả</small></h3>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Nut chinh={!t || cu || !t.dat} ly={(!coAnthropic && 'thiếu ANTHROPIC_API_KEY') || (!canh.length && 'tách cảnh trước')} ban={ban} gia={gia} onClick={() => void lam()}>{ban ? '… đang kiểm' : `${TEN_NUT_NGUOI_XEM} · ~${tien(gia)}`}</Nut>
        {t && <b style={{ color: mau }}>{cu ? '⚠ kịch bản đã sửa sau lần kiểm — bấm kiểm lần nữa' : t.dat ? `✓ Hiểu ${t.diem}/10 · đúng ý tác giả` : `✗ Hiểu ${t.diem}/10${t.khop ? '' : ' · lệch ý tác giả'}`}</b>}
        {t && <span style={mono}>{gioVN(t.luc)}</span>}
        {/* Chưa đạt → sửa ngay tại đây: Claude sửa đúng các shot bị vấp theo các câu gợi ý bên dưới. */}
        {t && !t.dat && !cu && <Nut chinh ly={!coAnthropic && 'thiếu ANTHROPIC_API_KEY'} ban={banSua} gia={giaSua} title="Claude sửa đúng các shot người xem vấp (lời, chữ màn, hành động, prompt hình; chèn shot nếu cần cho thấy) — giữ phần còn lại; ↶ trả lại phần sửa, shot thêm bỏ bằng 🗑" onClick={() => void sua()}>{banSua ? '… đang sửa kịch bản' : `✍ Sửa kịch bản theo góp ý · ~${tien(giaSua)}`}</Nut>}
      </div>
      <Loi>{loi}</Loi>
      {daSua && <div style={{ fontSize: 12, color: '#4ade80', marginTop: 6 }}>{daSua}</div>}
      {/* Đã đạt → chỉ một dòng kết quả, bài kể lại gập sau ▾ (YDNI luật 5); chưa đạt thì luôn bày ra để sửa. */}
      {t && t.dat && !cu && <button type="button" className="xv-lienket xv-mono" style={{ marginTop: 4 }} onClick={() => setXemChiTiet(!xemChiTiet)}>{xemChiTiet ? '▴ gập' : '▾ xem người xem kể lại'}</button>}
      {t && (!t.dat || cu || xemChiTiet) && (
        <div style={{ display: 'grid', gap: 6, marginTop: 8, fontSize: 12, lineHeight: 1.5, opacity: cu ? 0.6 : 1 }}>
          <div><b>Người xem kể lại:</b> {t.ke_lai}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '2px 10px' }}>
            {([['Ai', t.hieu.ai], ['Muốn gì', t.hieu.muon], ['Cản trở', t.hieu.can], ['Cú lật', t.hieu.lat], ['Kết', t.hieu.ket]] as const).map(([k, v]) => <Fragment key={k}><span style={mono}>{k}</span><span style={{ color: /không rõ|không thấy/i.test(v) ? 'var(--red)' : undefined }}>{v}</span></Fragment>)}
          </div>
          {!t.khop && t.lech && <div style={{ color: 'var(--red)' }}><b>Lệch ý tác giả:</b> {t.lech}</div>}
          {t.cho_kho.length > 0 && (
            <div style={{ display: 'grid', gap: 4 }}>
              <b>Chỗ người xem vấp ({t.cho_kho.length}):</b>
              {t.cho_kho.map((x, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '42px 1fr', gap: 6, padding: '4px 6px', borderRadius: 6, background: 'var(--bg-2)' }}>
                  {onMoShot ? <button type="button" className="xv-lienket xv-mono" onClick={() => onMoShot(x.shot)} title="Mở shot này">#{x.shot}</button> : <b className="xv-mono">#{x.shot}</b>}
                  <div><div>{x.van_de}</div><div style={{ color: 'var(--cyan)' }}>→ {x.sua}</div></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
