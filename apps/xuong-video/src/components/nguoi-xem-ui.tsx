'use client';
// 🧑 Thử người xem lần đầu (nguoi-xem.ts): nút có giá + kết quả — người xem kể lại, 5 câu hiểu, điểm, chỗ vấp theo shot (bấm = mở shot).
// Bước bắt buộc: chưa đạt / kịch bản đổi sau lần thử → chặn sinh keyframe + xuất.
import { Fragment, useState } from 'react';
import { thuNguoiXemTap } from '@/lib/actions';
import { giaChuCents, gioVN, tien, type Canh, type Tap } from '@/lib/xuong-video/kieu';
import { chanNguoiXem, TEN_NUT_NGUOI_XEM } from '@/lib/xuong-video/nguoi-xem';
import { Nut, Loi, mono } from './ui';

export function NguoiXem({ tap, canh, moHinhChu, coAnthropic, onChanged, onMoShot }: { tap: Tap; canh: Canh[]; moHinhChu: string; coAnthropic: boolean; onChanged: () => Promise<void>; onMoShot?: (thuTu: number) => void }) {
  const [ban, setBan] = useState(false);
  const [loi, setLoi] = useState('');
  const t = tap.thu_nguoi_xem;
  const chan = chanNguoiXem(t, canh);
  const cu = !!t && chan.some((x) => x.includes('đã sửa sau lần kiểm'));
  const gia = giaChuCents(moHinhChu, 5000, 2500);
  const lam = async () => { setBan(true); setLoi(''); try { const r = await thuNguoiXemTap(tap.id); if (!r.ok) setLoi(r.loi); } catch (e) { setLoi(`Không gọi được máy chủ (${e instanceof Error ? e.message.slice(0, 80) : 'lỗi mạng'})`); } setBan(false); await onChanged(); };
  const mau = !t ? 'var(--amber)' : cu ? 'var(--amber)' : t.dat ? '#4ade80' : 'var(--red)';
  return (
    <div className="xv-panel" style={{ marginTop: 10, borderLeft: `3px solid ${mau}` }}>
      <h3>🧑 Người xem có hiểu phim không<small>bắt buộc trước keyframe + xuất · Claude chỉ thấy chữ / lời / hình từng shot (không đọc brief), kể lại câu chuyện rồi so với ý tác giả</small></h3>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Nut chinh={!t || cu || !t.dat} ly={(!coAnthropic && 'thiếu ANTHROPIC_API_KEY') || (!canh.length && 'tách cảnh trước')} ban={ban} gia={gia} onClick={() => void lam()}>{ban ? '… đang kiểm' : `${TEN_NUT_NGUOI_XEM} · ~${tien(gia)}`}</Nut>
        {t && <b style={{ color: mau }}>{cu ? '⚠ kịch bản đã sửa sau lần kiểm — bấm kiểm lần nữa' : t.dat ? `✓ Hiểu ${t.diem}/10 · đúng ý tác giả` : `✗ Hiểu ${t.diem}/10${t.khop ? '' : ' · lệch ý tác giả'}`}</b>}
        {t && <span style={mono}>{gioVN(t.luc)}</span>}
      </div>
      <Loi>{loi}</Loi>
      {t && (
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
