'use client';
// NGĂN PHIẾU LÊN CAMP (anh 27/11/2026): poster + tên + ngôn ngữ phim → chọn chữ K / D (K: máy sinh, bấm K lần nữa = sinh lại) → dạng creative (AD mặc định / CC2)
// → link (search.com) · domain (mien_len) · bid ROAS (dàn) · ngân sách ($5) · giờ (khung cố định; giờ tự đặt thì cảnh báo) → Gửi = máy dựng creative,
// bản dựng vào Chờ lên, anh duyệt creative là lên camp đúng phiếu (không còn bước duyệt camp thứ hai). Nhãn chỉ "K" / "D" — không ghi tên người.
// Loại 'etp-phieu-len' của EtpDrawerHost, id = mã phim. Action: @/lib/actions/etp-phieu-len.
// ngan-moi-ok: phiếu lên camp của một phim — chưa ngăn nào có (etp-cr-phim là thư viện creative, etp-phim là chi tiết phim)
// tra-repo-ok: form nội bộ dựng từ Drawer dùng chung của etp2 + action etp-phieu-len
import { useEffect, useState } from 'react';
import { Drawer } from '@/components/ui';
import { MO_SO } from '@/components/etp-so';
import { docPhieu, sinhChuK, guiPhieu, type PhieuMo, type DangPhieu } from '@/lib/actions/etp-phieu-len';
import type { ChuQc } from '@/lib/etp-chu-so';

const DO = '#dc2626', VANG = '#b45309', XANH = '#15803d';
const chip = (on: boolean): React.CSSProperties => ({ padding: '4px 12px', borderRadius: 14, border: `1px solid ${on ? 'var(--accent, #2563eb)' : 'var(--border, #d4d4d8)'}`,
  background: on ? 'var(--accent, #2563eb)' : 'transparent', color: on ? '#fff' : 'inherit', cursor: 'pointer', fontSize: 12.5, fontWeight: on ? 600 : 400 });
const nhan: React.CSSProperties = { fontSize: 11.5, color: MO_SO, width: 92, flex: 'none', paddingTop: 5 };
const ROAS = [{ v: 'dan', t: 'dàn' }, { v: '0.9', t: '0.9' }, { v: '1', t: '1.0' }, { v: '1.1', t: '1.1' }, { v: '1.2', t: '1.2' }];
const NS = [3, 5, 8, 10, 15];
const GOI_Y_GUI = 'dựng xong creative hiện ở Chờ lên; anh duyệt creative là lên camp đúng phiếu này (không duyệt camp lần hai)';
const GOI_Y_GIO = 'giờ ngoài hai khung cố định: camp chạy đúng giờ anh đặt (giờ VN), không theo lịch chuẩn';

function Hang({ ten, children }: { ten: string; children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}><div style={nhan}>{ten}</div><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>{children}</div></div>;
}
function KhoiChu({ c }: { c: ChuQc }) {
  const ds = (t: string, xs: string[]) => xs.length ? <div style={{ marginBottom: 6 }}><div style={{ fontSize: 11, color: MO_SO }}>{t} · {xs.length}</div>
    {xs.map((x, i) => <div key={i} style={{ fontSize: 12.5, padding: '2px 0', borderBottom: '1px dashed var(--border, #e4e4e7)' }}>{x}</div>)}</div> : null;
  return <div style={{ border: '1px solid var(--border, #e4e4e7)', borderRadius: 8, padding: '8px 10px', width: '100%' }}>{ds('Primary text', c.pt)}{ds('Headline', c.hl)}{ds('Description', c.de)}</div>;
}

export function EtpPhieuLenDrawer({ cid, onClose }: { cid: number; onClose: () => void }) {
  const [p, setP] = useState<PhieuMo | null>(null);
  const [loiMo, setLoiMo] = useState<string | null>(null);
  const [kieu, setKieu] = useState<'kien' | 'dol'>('kien');
  const [chuK, setChuK] = useState<ChuQc | null>(null);
  const [sinh, setSinh] = useState<{ dang: boolean; loi?: string; vnd?: number }>({ dang: false });
  const [dang, setDang] = useState<DangPhieu>('AD');
  const [link, setLink] = useState('search.com');
  const [mien, setMien] = useState('');
  const [roas, setRoas] = useState('dan');
  const [ns, setNs] = useState(5);
  const [gio, setGio] = useState('lich');
  const [gioTay, setGioTay] = useState('');
  const [gui, setGui] = useState<{ dang?: boolean; loi?: string; ok?: string }>({});

  const sinhK = async () => {
    setKieu('kien'); setSinh({ dang: true });
    const r = await sinhChuK(cid);
    if ('loi' in r) setSinh({ dang: false, loi: r.loi }); else { setChuK(r.chu); setSinh({ dang: false, vnd: r.vnd }); }
  };
  useEffect(() => { docPhieu(cid).then((r) => {
    if ('loi' in r) return setLoiMo(r.loi);
    setP(r.p); setMien(r.p.mien_mac ?? r.p.mien[0] ?? '');
    if (r.p.chu.K) setChuK(r.p.chu.K); else void sinhK();   // phim chưa có chữ K trong sổ → máy sinh ngay (K là mặc định)
  }); }, [cid]);   // eslint-disable-line react-hooks/exhaustive-deps

  const chu = kieu === 'kien' ? chuK : p?.chu.D ?? null;
  const gioChon = gio === 'tay' ? gioTay.replace('T', ' ') : gio;
  const gioKhung = new Set(p?.khung.map((k) => k.gio.slice(11, 16)) ?? []);
  const ngoaiKhung = gio === 'tay' && !!gioTay && !gioKhung.has(gioTay.slice(11, 16));
  const coThe = !!p && !!chu?.pt.length && !sinh.dang && !gui.dang && !gui.ok && !(gio === 'tay' && !gioTay);
  const guiDi = async () => {
    if (!chu) return; setGui({ dang: true });
    const r = await guiPhieu({ cid, kieu, chu: { pt: chu.pt, hl: chu.hl, de: chu.de }, link, dang, mien: mien || null, roas, ns, gio: gioChon });
    setGui('loi' in r ? { loi: r.loi } : { ok: r.chu });
  };

  const dau = <div className="modal-head"><div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
    {p?.poster ? <img src={p.poster} alt="" style={{ width: 64, height: 90, objectFit: 'cover', borderRadius: 6, flex: 'none' }} /> : null}
    <div><div className="id-line">phiếu lên camp · phim #{cid}</div><h2 style={{ margin: 0 }}>{p?.ten ?? '…'}</h2>
      <div style={{ fontSize: 12, color: MO_SO, marginTop: 2 }}>ngôn ngữ: <b>{(p?.lang ?? '?').toUpperCase()}</b></div></div></div>
    <button className="modal-close" onClick={onClose}>✕</button></div>;

  return <Drawer onClose={onClose} width={720} padding={0}>{dau}
    <div style={{ padding: '12px 16px' }}>
      {loiMo ? <div style={{ color: DO }}>{loiMo}</div> : !p ? <div style={{ color: MO_SO }}>đang đọc phim…</div> : <>
        {p.dang_cho.length ? <div style={{ fontSize: 12, color: VANG, marginBottom: 10 }}>phiếu đang dở: {p.dang_cho.map((x) => `#${x.id} ${x.dang} (${x.trang_thai})`).join(' · ')}</div> : null}
        <Hang ten="Form text">
          <button style={chip(kieu === 'kien')} onClick={() => void sinhK()} title={kieu === 'kien' ? 'bấm lần nữa = máy sinh lại bộ chữ K mới' : 'máy sinh bộ chữ K cho phim'} data-chon-k>K{kieu === 'kien' ? ' ↻' : ''}</button>
          <button style={chip(kieu === 'dol')} onClick={() => setKieu('dol')} data-chon-d>D</button>
          {sinh.dang ? <span style={{ fontSize: 12, color: MO_SO }}>máy đang sinh chữ K…</span> : sinh.loi ? <span style={{ fontSize: 12, color: DO }}>{sinh.loi}</span>
            : kieu === 'kien' && sinh.vnd ? <span style={{ fontSize: 11.5, color: MO_SO }}>vừa sinh · {Math.round(sinh.vnd).toLocaleString('vi-VN')}₫</span> : null}
          {chu ? <KhoiChu c={chu} /> : null}
        </Hang>
        <Hang ten="Creative">{(['AD', 'CC2'] as const).map((d) => <button key={d} style={chip(dang === d)} onClick={() => setDang(d)}>{d}</button>)}</Hang>
        <Hang ten="Link">{[...new Set(['search.com', 'info.com', link])].map((l) => <button key={l} style={chip(link === l)} onClick={() => setLink(l)}>{l}</button>)}</Hang>
        <Hang ten="Domain">{p.mien.map((m) => <button key={m} style={chip(mien === m)} onClick={() => setMien(m)} title={m === p.mien_mac ? 'domain mặc định' : undefined}>{m}{m === p.mien_mac ? ' ★' : ''}</button>)}</Hang>
        <Hang ten="Bid ROAS">{ROAS.map((r) => <button key={r.v} style={chip(roas === r.v)} onClick={() => setRoas(r.v)}>{r.t}</button>)}</Hang>
        <Hang ten="Ngân sách">{NS.map((n) => <button key={n} style={chip(ns === n)} onClick={() => setNs(n)}>${n}</button>)}
          <input type="number" min={1} max={50} value={ns} onChange={(e) => setNs(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} style={{ width: 64, fontSize: 12.5 }} /></Hang>
        <Hang ten="Giờ chạy">
          <button style={chip(gio === 'lich')} onClick={() => setGio('lich')} title="khung cố định gần nhất lúc camp được tạo">khung gần nhất</button>
          {p.khung.map((k) => <button key={k.gio} style={chip(gio === k.gio.replace('T', ' '))} onClick={() => setGio(k.gio.replace('T', ' '))}>{k.chu}</button>)}
          <button style={chip(gio === 'tay')} onClick={() => setGio('tay')}>tự đặt</button>
          {gio === 'tay' ? <input type="datetime-local" value={gioTay} onChange={(e) => setGioTay(e.target.value)} style={{ fontSize: 12.5 }} /> : null}
          {ngoaiKhung ? <span style={{ fontSize: 12, color: VANG, fontWeight: 600 }} title={GOI_Y_GIO} data-canh-gio>⚠ ngoài khung cố định</span> : null}
        </Hang>
        <div style={{ borderTop: '1px solid var(--border, #e4e4e7)', paddingTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-primary" disabled={!coThe} onClick={() => void guiDi()} title={GOI_Y_GUI} data-gui-phieu>{gui.dang ? 'đang gửi…' : 'Gửi phiếu · máy dựng creative'}</button>
        </div>
        {gui.loi ? <div style={{ marginTop: 8, padding: '8px 10px', border: `1px solid ${DO}`, borderRadius: 6, color: DO, fontSize: 12.5 }}>✗ {gui.loi}</div> : null}
        {gui.ok ? <div style={{ marginTop: 8, padding: '8px 10px', border: `1px solid ${XANH}`, borderRadius: 6, color: XANH, fontSize: 12.5 }}>✓ {gui.ok}</div> : null}
      </>}
    </div>
  </Drawer>;
}
