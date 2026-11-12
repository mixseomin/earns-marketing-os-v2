'use client';
// WIDGET "NÊN LÀM GÌ BÂY GIỜ" — Tổng quan 2 etp2 (anh 10/11/2026 duyệt plan tư vấn: "Hay có 1 page kiểu Tổng quan 2 cho mỗi người để xem realtime nên làm gì").
// Đọc bản tư vấn sống etp.tu_van (apps/etp/tu_van.py --luu, dong-bo.py ghi mỗi 10 phút) — cùng số với tin 🧭 Tư vấn trên Telegram, không tính lại ở trình duyệt.
import { useState } from 'react';
import type { TuVan, TuVanCamp } from '@/lib/etp-doc';

const pc = (v: number | null | undefined) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v}%`);
const usd = (v: number | null | undefined) => (v == null ? '—' : `$${Math.abs(v) >= 10 ? Math.round(v).toLocaleString('en-US') : v.toFixed(2)}`);
const mauRoi = (v: number | null | undefined) => (v == null ? 'var(--fg-3)' : v >= 30 ? '#34d399' : v >= 0 ? 'var(--fg-1)' : '#f87171');
const NHOM: [keyof TuVan['du']['nen'], string, string][] = [['tat', '⏹ Nên tắt', '#f87171'], ['tang', '⬆️ Nên tăng', '#34d399'], ['roas', '★ Nên lên ROAS', '#fbbf24'], ['nhan', '⧉ Nên nhân bản', '#60a5fa']];
const DU_BAO = { xanh: ['Dự báo: ngày bình thường', '#34d399'], vang: ['Dự báo: dễ yếu', '#fbbf24'], do: ['Dự báo: ngày yếu', '#f87171'] } as const;
const tuoi = (luc: string) => { const p = Math.max(0, Math.round((Date.now() - Date.parse(luc.replace(' ', 'T'))) / 60_000)); return p < 1 ? 'vừa xong' : `${p} phút trước`; };

export function NenLam({ ds, moCamp }: { ds: TuVan[]; moCamp: (id: number) => void }) {
  const [chon, setChon] = useState<number | null>(null);
  if (!ds.length) return <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>Chưa có bản tư vấn — máy ghi sau lượt đồng bộ kế tiếp (10 phút).</span>;
  const x = ds.find((d) => d.nguoi_id === chon) ?? ds[0]!, d = x.du, ht = d.hien_trang, tt = d.thi_truong;
  const dong = (c: TuVanCamp) => (
    <div key={c.camp_id} onClick={() => moCamp(c.camp_id)} title="mở camp" style={{ display: 'flex', gap: 6, cursor: 'pointer', fontSize: 12, lineHeight: 1.45, padding: '1px 0' }}>
      <span style={{ color: 'var(--fg-3)', flex: '0 0 auto' }}>#{c.camp_id}</span>
      <span style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.ten}>{c.ten}</span>
      <span style={{ flex: '0 1 auto', color: 'var(--fg-2)', textAlign: 'right' }}>{c.ly}</span>
    </div>);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
      {ds.length > 1 ? <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {ds.map((v) => <button key={v.nguoi_id} type="button" onClick={() => setChon(v.nguoi_id)} style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 10, cursor: 'pointer',
          border: '1px solid var(--line)', background: v.nguoi_id === x.nguoi_id ? 'var(--accent)' : 'transparent', color: v.nguoi_id === x.nguoi_id ? '#fff' : 'var(--fg-2)' }}>
          {v.nguoi} <span style={{ color: v.nguoi_id === x.nguoi_id ? '#fff' : mauRoi(v.du.hien_trang.roi) }}>{pc(v.du.hien_trang.roi)}</span></button>)}
      </div> : null}
      <div>
        <b>Hôm nay</b>: chi {usd(ht.chi)} · thu {usd(ht.thu)} · ROI <b style={{ color: mauRoi(ht.roi) }}>{pc(ht.roi)}</b> · {ht.camp} camp
        <span style={{ color: 'var(--fg-3)' }}> — hôm qua {pc(ht.roi_qua)} · 7 ngày {pc(ht.roi_7)}{ht.roi_7_cung_gio !== undefined ? ` · cùng khung giờ: hôm qua ${pc(ht.roi_qua_cung_gio)}, 7 ngày ${pc(ht.roi_7_cung_gio)}` : ''}</span>
      </div>
      {tt.roi_nay != null ? <div><b>Thị trường</b> cả đội {tt.gio_vn}: {pc(tt.roi_nay)} vs 7 ngày {pc(tt.roi_7)}
        <span style={{ color: (tt.lech ?? 0) <= -10 ? '#f87171' : (tt.lech ?? 0) >= 10 ? '#34d399' : 'var(--fg-3)' }}> → {(tt.lech ?? 0) <= -10 ? 'chợ kém hơn thường' : (tt.lech ?? 0) >= 10 ? 'chợ tốt hơn thường' : 'chợ bình thường'}</span></div> : null}
      {d.du_bao ? <div><b style={{ color: DU_BAO[d.du_bao.muc][1] }}>{DU_BAO[d.du_bao.muc][0]}</b>{d.du_bao.ly.length ? ` — ${d.du_bao.ly.join(' · ')} → không tăng tổng ngân sách` : ''}</div> : null}
      {d.du_bao?.bao_dong ? <div style={{ color: '#f87171', fontWeight: 600 }}>🚨 Chợ {pc(d.du_bao.bao_dong.roi)} trên {usd(d.du_bao.bao_dong.chi)} (07:00–{d.du_bao.bao_dong.toi_gio_vn}) → hoãn tăng / nhân bản camp thường</div> : null}
      {d.phien ? <div><b>Phiên {d.phien.gio}</b>: {[...d.phien.mo.map((m) => `mở ${m}`), ...d.phien.dong.map((m) => `đóng ${m}`)].join('; ') || 'không đổi khung'}</div> : null}
      {d.may_se_lam.length ? <div style={{ color: 'var(--fg-2)' }}><b style={{ color: 'var(--fg-1)' }}>Máy luật đang thấy</b>: {d.may_se_lam.map((m) => `${m.luat.split(' · ')[0]} ${m.dat} đủ${m.gan ? `/${m.gan} gần` : ''}`).join(' · ')}</div> : null}
      {NHOM.map(([k, ten, mau]) => d.nen[k].length ? <div key={k}>
        <div style={{ color: mau, fontWeight: 600 }}>{ten}{d.tu_dong ? ' (máy tự làm khi đúng khung + luật)' : ' (làm tay)'} — {d.dem[k]} camp{d.dem[k] > d.nen[k].length ? `, ${d.nen[k].length} lớn nhất` : ''}</div>
        {d.nen[k].map(dong)}
      </div> : null)}
      {!NHOM.some(([k]) => d.nen[k].length) ? <div style={{ color: 'var(--fg-3)' }}>Không camp nào chạm ngưỡng tắt / tăng / ROAS / nhân bản lúc này.</div> : null}
      <div style={{ color: 'var(--fg-3)', fontSize: 11 }}>cập nhật {tuoi(x.luc)} · cố vấn Quang, cùng số tin 🧭 Tư vấn trên Telegram</div>
    </div>);
}
