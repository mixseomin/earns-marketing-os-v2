'use client';
// 📋 PHÂN RÃ KỊCH BẢN — khung phải của nút cây "Phân rã kịch bản" (tab 📖 Phim › Thiết kế sản xuất). Báo cáo chuẩn bị cả phim như tổ chuẩn bị đoàn phim:
// món THIẾU (chưa tả / chưa ảnh gốc / chưa ảnh mẫu) — bấm mở đúng món trong cây; từng tập chưa / cũ / đã phân rã; ghi chú liền mạch AI phát hiện.
// Tập mới TỰ phân rã sau ✂ Tách cảnh — không ai phải bấm; nút ở đây cho tập cũ / sửa kịch bản / chạy lại. Phân rã nhiều tập gọi TỪNG tập một
// (mỗi request ngắn, có tiến độ) — một request gom cả phim sẽ vượt giới hạn 300s của nginx. Luật: lib/xuong-video/phan-ra-thuan.ts · chạy: phan-ra.ts.
import { useState } from 'react';
import { phanRaTapAction, sinhAnhThieuAction } from '@/lib/actions';
import type { BaoCaoPhim } from '@/lib/xuong-video/phan-ra';
import type { TrangThaiPhanRa } from '@/lib/xuong-video/phan-ra-thuan';
import { LOAI_NHAN_VAT, NHOM_BIEN_THE, gioVN } from '@/lib/xuong-video/kieu';
import { Den, Loi, Nut, Seg, mono } from './ui';
import { useNho } from './nho';

const TT: Record<TrangThaiPhanRa, { chu: string; den: 'ok' | 'cho' | 'loi' | 'tat' }> = {
  xong: { chu: 'đã phân rã', den: 'ok' }, cu: { chu: 'cũ — chữ tập đổi sau lần trước', den: 'cho' }, chua: { chu: 'chưa phân rã', den: 'cho' }, trong: { chu: 'chưa có shot', den: 'tat' },
};
const dong = (v: number) => `${Math.round(v).toLocaleString('vi-VN')}₫`;
const nhanNhom = (nhom: string | null) => (nhom ? Object.values(NHOM_BIEN_THE).flat().find((x) => x.key === nhom)?.label ?? LOAI_NHAN_VAT.find((l) => l.key === nhom)?.label ?? nhom : '');
const th = { ...mono, textAlign: 'left' as const, fontWeight: 400, padding: '4px 8px', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' as const };
const td = { padding: '5px 8px', borderBottom: '1px solid var(--line)', fontSize: 12.5, verticalAlign: 'top' as const };

export function PhanRaPanel({ phimId, bc, onChanged, onChon }: { phimId: number; bc: BaoCaoPhim | null; onChanged: () => Promise<void>; onChon: (nut: string) => void }) {
  const [tab, setTab] = useNho<'thieu' | 'tap' | 'ghi'>('xv-pr-tab', 'thieu', ['thieu', 'tap', 'ghi'], 'prt');
  const [ban, setBan] = useState<string | null>(null);
  const [loi, setLoi] = useState(''); const [tin, setTin] = useState('');
  if (!bc) return <div className="xv-panel"><div style={mono}>đang đọc báo cáo chuẩn bị…</div></div>;

  const cho = bc.tap.filter((t) => t.trang_thai === 'chua' || t.trang_thai === 'cu');
  const giaPr = cho.reduce((s, t) => ({ cents: s.cents + (bc.uoc[t.id]?.cents ?? 0), vnd: s.vnd + (bc.uoc[t.id]?.vnd ?? 0) }), { cents: 0, vnd: 0 });
  const thieuAnh = bc.thieu.filter((m) => m.ly_do.includes('ảnh') && !m.ly_do.includes('chưa tả'));
  const giaAnh = { cents: thieuAnh.length * bc.gia_anh.cents, vnd: thieuAnh.length * bc.gia_anh.vnd };
  const ghiChu = bc.tap.filter((t) => t.ghi_chu.length || t.khong_khop.length);
  const xong = bc.tap.filter((t) => t.trang_thai === 'xong').length;

  // phân rã danh sách tập TUẦN TỰ từng request (tập sau thấy món tập trước vừa tạo → không đẻ trùng), cập nhật tiến độ + báo cáo sau mỗi tập
  const phanRa = async (ds: { id: number; so: number }[], ep = false) => {
    setBan('pr'); setLoi(''); setTin('');
    let moi = 0, doi = 0, vnd = 0; const l: string[] = [];
    for (const [i, t] of ds.entries()) {
      setTin(`… đang phân rã tập ${t.so} (${i + 1}/${ds.length})`);
      const r = await phanRaTapAction(t.id, ep);
      if (!r.ok) { l.push(`tập ${t.so}: ${r.loi}`); continue; }
      moi += r.data.moi; doi += r.data.shotDoi; vnd += r.data.vnd ?? 0;
      await onChanged();
    }
    setBan(null); setLoi(l.join(' · '));
    setTin(`Xong ${ds.length - l.length}/${ds.length} tập · tạo ${moi} món mới · gắn lại ${doi} shot${vnd ? ` · tiền thật ${dong(vnd)}` : ''}`);
  };
  const sinhThieu = async () => {
    setBan('anh'); setLoi(''); setTin('');
    const r = await sinhAnhThieuAction(phimId);
    setBan(null);
    if (!r.ok) { setLoi(r.loi); return; }
    setTin(`Đã xếp sinh ${r.data.goc} ảnh gốc + ${r.data.bienThe} ảnh mẫu (chạy nền, vài phút)${r.data.cho.length ? ` · ${r.data.cho.length} món chờ ảnh gốc của cha: ${r.data.cho.slice(0, 4).join(', ')}${r.data.cho.length > 4 ? '…' : ''}` : ''}`);
    if (r.data.loi.length) setLoi(r.data.loi.join(' · '));
    await onChanged();
  };

  return (
    <div className="xv-panel" style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ flex: 1, margin: 0 }}>📋 Phân rã kịch bản<small>đọc từng shot, gắn thẻ mọi phục trang (gồm giày) · tóc · trang điểm · từng phụ kiện · vết · đạo cụ · bối cảnh — tập mới tự phân rã sau ✂ Tách cảnh</small></h3>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5 }}>
        <span>{bc.tong.tap} tập · <b>{xong}</b> đã phân rã{bc.tong.tap_cu ? <> · <b style={{ color: 'var(--amber)' }}>{bc.tong.tap_cu}</b> cũ</> : null}{bc.tong.tap_chua ? <> · <b style={{ color: 'var(--amber)' }}>{bc.tong.tap_chua}</b> chưa</> : null}</span>
        <span>cần <b>{bc.tong.can}</b> món · đủ <b>{bc.tong.du}</b> · thiếu <b style={{ color: bc.tong.thieu ? 'var(--red)' : 'var(--lime)' }}>{bc.tong.thieu}</b></span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Nut chinh={cho.length > 0} ban={!!ban} ly={!cho.length && 'mọi tập có shot đã phân rã và không đổi — chạy lại từng tập ở tab Theo tập'} gia={giaPr.cents}
          title={`Phân rã các tập chưa / cũ (${cho.map((t) => t.so).join(', ')}) — từng tập một, tập không đổi bỏ qua 0đ. Giá ước theo model chữ của phim (${bc.model}), qua cổng rẻ trước.`}
          onClick={() => void phanRa(cho)}>{ban === 'pr' ? '… đang phân rã' : cho.length ? `🔎 Phân rã ${cho.length} tập (~${dong(giaPr.vnd)})` : '✓ Mọi tập đã phân rã'}</Nut>
        <Nut ban={!!ban} ly={!thieuAnh.length && 'không món nào thiếu ảnh'} gia={giaAnh.cents}
          title="Đợt 1: ảnh gốc cho anchor đang dùng mà chưa có · đợt 2: ảnh mẫu cho biến thể có cha đã có ảnh gốc (biến thể chờ ảnh gốc thì bấm lại khi xong). Chạy nền."
          onClick={() => void sinhThieu()}>{ban === 'anh' ? '… đang xếp hàng' : `🖼 Sinh ảnh cho ${thieuAnh.length} món thiếu (~${dong(giaAnh.vnd)})`}</Nut>
      </div>
      {tin && <div style={{ ...mono, color: 'var(--fg-2)' }}>{tin}</div>}
      <Loi>{loi}</Loi>
      <Seg value={tab} onChange={setTab} options={[
        { value: 'thieu', label: 'Thiếu chuẩn bị', title: `${bc.thieu.length} món shot đang dùng mà chưa đủ (chưa tả / chưa ảnh)` },
        { value: 'tap', label: 'Theo tập', title: `${bc.tap.length} tập — trạng thái phân rã, số món cần / thiếu` },
        { value: 'ghi', label: 'Ghi chú liền mạch', title: `${ghiChu.reduce((s, t) => s + t.ghi_chu.length + t.khong_khop.length, 0)} ghi chú / chỗ không khớp` },
      ]} />

      {tab === 'thieu' && (bc.thieu.length ? (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr><th style={th}>Món</th><th style={th}>Thuộc</th><th style={th}>Nhóm</th><th style={th}>Thiếu</th><th style={th}>Tập</th><th style={{ ...th, textAlign: 'right' }}>Shot dùng</th></tr></thead>
          <tbody>{bc.thieu.map((m) => (
            <tr key={`${m.loai}-${m.id}`} role="button" tabIndex={0} title="Mở món này trong cây để làm / sinh ảnh" style={{ cursor: 'pointer' }}
              onClick={() => onChon(m.loai === 'bien_the' ? `bt-${m.id}` : `nv-${m.id}`)} onKeyDown={(e) => { if (e.key === 'Enter') onChon(m.loai === 'bien_the' ? `bt-${m.id}` : `nv-${m.id}`); }}>
              <td style={td}>{m.ly_do.includes('chưa tả') ? '✎' : '📷'} {m.ten}</td>
              <td style={{ ...td, color: 'var(--fg-3)' }}>{m.cua ?? '—'}</td>
              <td style={{ ...td, color: 'var(--fg-3)' }}>{nhanNhom(m.nhom)}</td>
              <td style={{ ...td, color: 'var(--amber)' }}>{m.ly_do}</td>
              <td style={{ ...td, ...mono }}>{m.tap.join(', ')}</td>
              <td style={{ ...td, ...mono, textAlign: 'right' }}>{m.so_shot}</td>
            </tr>))}</tbody>
        </table>
      ) : <div style={{ ...mono, color: 'var(--lime)' }}>✓ Mọi món các shot đang dùng đều đã có mô tả + ảnh.{bc.tong.tap_chua + bc.tong.tap_cu ? ' (Còn tập chưa / cũ phân rã — phân rã xong mới biết đủ hết chưa.)' : ''}</div>)}

      {tab === 'tap' && (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr><th style={th}>Tập</th><th style={th}>Phân rã</th><th style={{ ...th, textAlign: 'right' }}>Shot</th><th style={{ ...th, textAlign: 'right' }}>Cần</th><th style={{ ...th, textAlign: 'right' }}>Thiếu</th><th style={th}>Lúc</th><th style={th} /></tr></thead>
          <tbody>{bc.tap.map((t) => (
            <tr key={t.id}>
              <td style={td}><span style={mono}>{t.so}</span> {t.ten || `Tập ${t.so}`}</td>
              <td style={td}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Den muc={TT[t.trang_thai].den} title={TT[t.trang_thai].chu} />{TT[t.trang_thai].chu}</span></td>
              <td style={{ ...td, ...mono, textAlign: 'right' }}>{t.so_shot}</td>
              <td style={{ ...td, ...mono, textAlign: 'right' }}>{t.can}</td>
              <td style={{ ...td, ...mono, textAlign: 'right', color: t.thieu ? 'var(--red)' : undefined }}>{t.thieu}</td>
              <td style={{ ...td, ...mono }}>{t.luc ? gioVN(t.luc) : '—'}</td>
              <td style={{ ...td, textAlign: 'right' }}>{t.trang_thai !== 'trong' && (
                <Nut ban={!!ban} gia={bc.uoc[t.id]?.cents} title={t.trang_thai === 'xong' ? 'Chữ tập không đổi — chạy lại vẫn tốn một lượt' : 'Phân rã tập này'}
                  onClick={() => void phanRa([t], t.trang_thai === 'xong')}>{t.trang_thai === 'xong' ? 'Chạy lại' : 'Phân rã'} ~{dong(bc.uoc[t.id]?.vnd ?? 0)}</Nut>)}</td>
            </tr>))}</tbody>
        </table>
      )}

      {tab === 'ghi' && (ghiChu.length ? (
        <div style={{ display: 'grid', gap: 10 }}>{ghiChu.map((t) => (
          <div key={t.id} style={{ display: 'grid', gap: 3 }}>
            <b style={{ fontSize: 12.5 }}>Tập {t.so} · {t.ten}</b>
            {t.ghi_chu.map((g, i) => <div key={`g${i}`} style={{ fontSize: 12.5, paddingLeft: 10 }}>– {g}</div>)}
            {t.khong_khop.map((g, i) => <div key={`k${i}`} style={{ fontSize: 12, paddingLeft: 10, color: 'var(--amber)' }}>⚠ {g}</div>)}
          </div>))}</div>
      ) : <div style={mono}>Chưa có ghi chú liền mạch nào (phân rã tập để AI soát mâu thuẫn giữa các shot).</div>)}
    </div>
  );
}
