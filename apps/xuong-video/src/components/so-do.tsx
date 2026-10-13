'use client';
// SƠ ĐỒ SERIES (anh 14/10/2026 — "cần một bảng kiểu sơ đồ cả bộ phim, từng season, rồi đến tập"): hàng đầu là cả bộ phim, mỗi mùa một hàng
// thẻ tập. Thẻ = số · tên · loại (phiêu lưu / nguồn gốc / kết mùa) · mặt nhân vật · logline · gài/trả · tập đang ở khâu nào. Bấm thẻ: tập đã có
// thì mở (tab Kịch bản), chưa có thì tạo từ bản đồ (tên + brief từ logline, 0đ). Dữ liệu: kinh_thanh.series (kieu.ts › muaSeries).
import { useState } from 'react';
import { docKinhThanh, muaSeries, type NhanVat, type Phim, type Tap, type TapBanDo } from '@/lib/xuong-video/kieu';
import { anhNho } from '@/lib/xuong-video/anh-nho';
import { taoTapTuBanDo } from '@/lib/actions';
import { Pill, Loi, mono, goiAction } from './ui';

const LOAI: Record<string, string> = { phieu_luu: 'Phiêu lưu', nguon_goc: 'Nguồn gốc', ket_mua: 'Kết mùa' };
/** Khâu của tập theo dữ liệu thật — trơn trừ khi đã xuất (xong) — màu chỉ báo nghĩa. */
function khau(t: Tap | undefined): { chu: string; xong: boolean } {
  if (!t) return { chu: 'bản đồ', xong: false };
  if (t.xuat?.some((b) => !b.long_tieng && !b.phu_de)) return { chu: '✓ đã xuất', xong: true };
  if (t.so_canh) return { chu: `${t.so_canh} cảnh`, xong: false };
  if (t.kich_ban?.trim()) return { chu: 'kịch bản', xong: false };
  return { chu: 'đã tạo', xong: false };
}

export function SoDoSeries({ phim, tap, nhanVat, onMoTap, onChanged }: { phim: Phim; tap: Tap[]; nhanVat: NhanVat[]; onMoTap: (tapId: number) => void; onChanged: () => Promise<void> }) {
  const kt = docKinhThanh(phim.kinh_thanh);
  const ds = muaSeries(kt.series);
  const [dang, setDang] = useState<number | null>(null);
  const [loi, setLoi] = useState('');
  const mat = (ten: string) => nhanVat.find((v) => v.loai === 'nhan_vat' && v.ten === ten);
  const tapCua = (b: TapBanDo) => tap.find((t) => t.so === b.so);
  const tongTap = ds.reduce((a, m) => a + m.tap.length, 0);
  const daXuat = ds.flatMap((m) => m.tap).filter((b) => khau(tapCua(b)).xong).length;
  const coKb = ds.flatMap((m) => m.tap).filter((b) => (tapCua(b)?.kich_ban ?? '').trim()).length;
  if (!ds.length) return <div className="xv-panel" style={mono}>Phim chưa có bản đồ series — viết kinh thánh mùa (động cơ + danh sách tập) ở tab 🎭 Phim › Kinh thánh.</div>;
  const bam = async (b: TapBanDo) => {
    const t = tapCua(b);
    if (t) { onMoTap(t.id); return; }
    setDang(b.so); setLoi('');
    const r = await goiAction(() => taoTapTuBanDo(phim.id, b.so));
    setDang(null);
    if (r.loi) { setLoi(r.loi); return; }
    await onChanged();
    if (r.kq && 'data' in r.kq && typeof r.kq.data === 'number') onMoTap(r.kq.data);
  };
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="xv-panel" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '8px 12px' }}>
        {phim.poster_url && <img src={anhNho(phim.poster_url, 160)} alt="" style={{ height: 52, aspectRatio: '2 / 3', objectFit: 'cover', borderRadius: 4 }} />}
        <div style={{ flex: 1, minWidth: 240 }}>
          <b style={{ fontSize: 14 }}>{kt.series?.ten || phim.ten}</b>
          <div style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>{kt.logline}</div>
        </div>
        <span style={mono}>{ds.length} mùa · {tongTap} tập · {coKb} có kịch bản · {daXuat} đã xuất</span>
      </div>
      <Loi>{loi}</Loi>
      {ds.map((m) => (
        <div key={m.so} className="xv-panel" style={{ padding: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 8 }}>
            <b style={{ fontSize: 13 }}>{m.ten}</b>
            <span style={{ ...mono, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.dong_co || kt.series?.dong_co}>{m.ghi_chu || m.dong_co || (m.so === 1 ? kt.series?.dong_co : '')}</span>
            <span style={mono}>{m.tap.length} tập</span>
          </div>
          {!m.tap.length ? <div style={mono}>Mùa này đang lên ý — chưa có danh sách tập.</div> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
              {m.tap.map((b) => {
                const t = tapCua(b); const k = khau(t);
                return (
                  <button key={b.so} type="button" onClick={() => void bam(b)} disabled={dang != null}
                    title={`${b.logline}${b.gai_tra ? `\n\nGài / trả: ${b.gai_tra}` : ''}${b.boi_canh?.length ? `\nBối cảnh: ${b.boi_canh.join(', ')}` : ''}\n\n${t ? 'Bấm để mở tập' : 'Bấm để tạo tập từ bản đồ (0đ)'}`}
                    style={{ all: 'unset', cursor: 'pointer', display: 'grid', gap: 4, alignContent: 'start', padding: 8, borderRadius: 8, border: `1px ${t ? 'solid' : 'dashed'} var(--line)`, background: 'var(--bg-1)' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                      <span style={mono}>{b.so}</span>
                      <b style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.ten}</b>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                      {b.loai && <Pill color="var(--fg-3)">{LOAI[b.loai] ?? b.loai}</Pill>}
                      <span style={{ ...mono, marginLeft: 'auto', color: k.xong ? 'var(--lime)' : undefined }}>{dang === b.so ? 'đang tạo…' : k.chu}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {(b.nhan_vat ?? []).map((ten) => { const v = mat(ten); return v?.anh_ref[0]
                        ? <img key={ten} src={anhNho(v.anh_ref[0], 160)} alt={ten} title={ten} data-khong-phong-to="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--line)' }} />
                        : <span key={ten} style={{ ...mono, fontSize: 10 }}>{ten}</span>; })}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fg-2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{b.logline}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
