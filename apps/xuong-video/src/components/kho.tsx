'use client';
// Kho tài sản dùng lại (10/10/2026) — drawer 📦 mở từ thẻ shot (lấy clip/keyframe), khu nhạc của tập (lấy nhạc) hoặc Thư viện (xem cả kho).
// Có đích (shot/tập) thì mỗi mục hợp loại có nút "Dùng cho …" — một bấm, có ↶ Hoàn tác; không đích thì chỉ xem + bỏ khỏi kho.
import { useEffect, useState } from 'react';
import { dsTaiSan, dungTaiSanCho, boTaiSan, taoTapTuKhuonQc } from '@/lib/actions';
import { LOAI_TAI_SAN, tien, type LoaiTaiSan, type TaiSan } from '@/lib/xuong-video/kieu';
import { Loi, Nut, mono } from './ui';
import { moNgan } from './ngan-chung';

/** Đích dùng tài sản: shot (clip/keyframe) hoặc tập (nhạc). Mã hoá trong URL drawer: "c<id>" / "t<id>". */
export type DichKho = { canhId?: number; tapId?: number; phimId?: number };
export const maDich = (d: DichKho) => (d.canhId ? `c${d.canhId}` : d.tapId ? `t${d.tapId}` : d.phimId ? `p${d.phimId}` : '');
export const docDich = (m: string | null | undefined): DichKho => { const x = /^([ctp])(\d+)$/.exec(m ?? ''); return !x ? {} : x[1] === 'c' ? { canhId: Number(x[2]) } : x[1] === 't' ? { tapId: Number(x[2]) } : { phimId: Number(x[2]) }; };
const LOAI_HOP: Record<'canh' | 'tap' | 'phim', LoaiTaiSan[]> = { canh: ['clip', 'anh'], tap: ['nhac'], phim: ['khuon_qc'] };

export function KhoNoiDung({ dich = {} }: { dich?: DichKho }) {
  const hop = dich.canhId ? LOAI_HOP.canh : dich.tapId ? LOAI_HOP.tap : dich.phimId ? LOAI_HOP.phim : null;
  const [loai, setLoai] = useState<LoaiTaiSan | ''>(hop?.[0] ?? '');
  const [q, setQ] = useState('');
  const [ds, setDs] = useState<TaiSan[] | null>(null);
  const [bao, setBao] = useState('');
  const [loi, setLoi] = useState('');
  const [dang, setDang] = useState<number | null>(null);
  const tai = () => void dsTaiSan({}).then(setDs);
  useEffect(tai, []);
  const loc = (ds ?? []).filter((t) => (!loai || t.loai === loai) && (!q.trim() || `${t.ten} ${t.san_pham} ${t.mo_ta} ${t.the.join(' ')}`.toLowerCase().includes(q.trim().toLowerCase())));
  const dem = (k: LoaiTaiSan) => (ds ?? []).filter((t) => t.loai === k).length;
  const tenDich = dich.canhId ? 'shot này' : dich.tapId ? 'tập này' : 'phim này (tập mới)';
  const dung = async (t: TaiSan) => {
    setDang(t.id); setLoi(''); setBao('');
    const r = t.loai === 'khuon_qc' && dich.phimId ? await taoTapTuKhuonQc(t.id, dich.phimId) : await dungTaiSanCho(t.id, dich);
    setDang(null);
    if (!r.ok) { setLoi(r.loi); return; }
    setBao(`Đã dùng "${t.ten}" cho ${tenDich} — sai thì bấm ↶ Hoàn tác ở đầu trang.`); tai();
  };
  return (
    <div>
      <div className="xv-mono" style={{ marginBottom: 8 }}>
        Tài sản đã sinh và đạt — creative sau lấy lại thay vì sinh mới (0đ). Giá hiện trên mỗi mục là tiền đã bỏ ra để sinh nó.
        {hop && <> Đang chọn cho <b>{tenDich}</b>.</>}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <button type="button" className={`xv-btn${loai === '' ? ' chinh' : ''}`} style={{ padding: '2px 9px' }} onClick={() => setLoai('')}>Tất cả <span className="xv-mono">{ds?.length ?? 0}</span></button>
        {LOAI_TAI_SAN.filter((l) => dem(l.key) || hop?.includes(l.key)).map((l) => (
          <button key={l.key} type="button" className={`xv-btn${loai === l.key ? ' chinh' : ''}`} style={{ padding: '2px 9px' }} onClick={() => setLoai(l.key)}>{l.icon} {l.ten} <span className="xv-mono">{dem(l.key)}</span></button>
        ))}
        <input className="xv-in" placeholder="tìm: sản phẩm, động tác, tâm trạng…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
      </div>
      <Loi>{loi}</Loi>
      {bao && <div className="xv-mono" style={{ color: 'var(--lime)', marginBottom: 8 }}>{bao}</div>}
      {ds == null ? <div style={mono}>đang tải…</div> : !loc.length ? <div style={mono}>Kho chưa có mục nào{loai ? ' loại này' : ''}. Lưu từ thẻ shot (⋯ → ⭐ Lưu shot vào kho); nhạc nền tự vào kho khi sinh.</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
          {loc.map((t) => (
            <div key={t.id} className="xv-canh" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {t.url && t.loai === 'clip' && <video src={t.url} muted loop playsInline preload="metadata" onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})} onMouseLeave={(e) => e.currentTarget.pause()} onClick={() => moNgan({ loai: 'xem', url: t.url!, ten: t.ten })} style={{ width: '100%', aspectRatio: t.so_do.ti_le === '16:9' ? '16 / 9' : '9 / 16', objectFit: 'cover', borderRadius: 6, background: '#000', cursor: 'zoom-in' }} />}
              {t.url && t.loai === 'anh' && <img src={t.url} alt="" onClick={() => moNgan({ loai: 'xem', url: t.url!, ten: t.ten })} style={{ width: '100%', aspectRatio: t.so_do.ti_le === '16:9' ? '16 / 9' : '9 / 16', objectFit: 'cover', borderRadius: 6, cursor: 'zoom-in' }} />}
              {t.url && t.loai === 'nhac' && <audio src={t.url} controls preload="none" style={{ width: '100%' }} />}
              {t.loai === 'giong' && <div style={mono}>🗣 {String(t.du_lieu.voice ?? '')} · {String(t.du_lieu.model ?? '').split('/').pop()}</div>}
              {t.loai === 'kieu_chu' && (() => { const k = (t.du_lieu.kieu_chu ?? {}) as { font?: string; mau?: string; vien?: string; nhan?: string }; return <div style={{ fontFamily: k.font, fontWeight: 900, fontSize: 18, color: k.mau || '#fff', WebkitTextStroke: `1px ${k.vien || '#000'}`, background: 'var(--bg-2)', borderRadius: 6, padding: '6px 8px' }}>PAY 1 GET <span style={{ color: k.nhan || k.mau }}>3</span></div>; })()}
              {t.loai === 'khuon_qc' && <div style={mono}>🧩 {String((t.so_do as { so_shot?: number }).so_shot ?? '')} shot · {Math.round(Number((t.so_do as { dai?: number }).dai ?? 0))}s · chữ màn + lời nguyên văn</div>}
              <b style={{ fontSize: 12 }}>{t.ten}</b>
              {t.san_pham && <div style={{ fontSize: 11, color: 'var(--cyan)' }}>{t.san_pham}</div>}
              {t.mo_ta && <div title={t.mo_ta} style={{ fontSize: 11, color: 'var(--fg-2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.mo_ta}</div>}
              {!!t.the.length && <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>{t.the.map((x) => <span key={x} className="xv-mono" style={{ padding: '0 6px', border: '1px solid var(--line)', borderRadius: 999 }}>{x}</span>)}</div>}
              <div style={mono}>{tien(t.chi_phi_cents)} để sinh · dùng lại {t.so_lan_dung} lần{t.thuong_hieu ? ` · ${t.thuong_hieu}` : ''}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 'auto' }}>
                {hop?.includes(t.loai) && <Nut chinh ban={dang === t.id} onClick={() => void dung(t)}>Dùng cho {tenDich}</Nut>}
                <Nut title="Bỏ khỏi kho (tệp vẫn nguyên, không xoá)" onClick={() => void boTaiSan(t.id).then(tai)}>Bỏ khỏi kho</Nut>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
