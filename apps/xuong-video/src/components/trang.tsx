'use client';
// Xưởng video AI (studio.on.tc) — một màn: danh sách phim → drawer phim (kinh thánh · tuyến nhân vật · tập · storyboard từng tập).
// Storyboard = bảng cảnh: mỗi dòng một cảnh (xương sống dữ liệu); keyframe sinh → chọn → duyệt → video. Canvas node + timeline (G2/G3)
// là hai cách nhìn khác của cùng bảng này, không có dữ liệu riêng.
import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useModalParam } from '@/lib/use-modal-param';
import { Timeline } from './timeline';
import { ImageAttach } from './image-attach';
import { MAU_PHIM } from '@/lib/xuong-video/mau';
import { MO_HINH_AM, GIONG, giaAm, dongThoai } from '@/lib/xuong-video/am-thanh';
import { THE_LOAI, NHOM_KY_THUAT, dsTheoNhom, hopTheLoai, nhanKyThuat, type NhomKyThuat, type TheLoai } from '@/lib/xuong-video/dien-anh';
import { kiemQc } from '@/lib/xuong-video/kiem-qc';
import {
  dsPhim, docPhim, dsCanh, taoPhim, taoPhimMau, suaPhim, xoaPhim, luuNhanVat, xoaNhanVat, sinhAnhMau, taoTap, suaTap,
  vietKichBanTap, tachCanhTap, suaCanh, themCanh, xoaCanh, sinhKeyframe, chonKeyframe, duyetCanh, uocTien, sinhVideoCanh, kiemVideo, taiAnhLen,
  dsMoHinh, xepCanh, datAnhChinh, lamLaiTuKeyframe, layTuLinkSanPham, sinhGiong, sinhAmThanh, sinhNhac, uocAm, dsGiongModel, dsGiongCua, chonGiong, ngheThuGiong, xoaAnhGoc, xoaAnhBienThe, xoaKeyframe, dsThungRac, khoiPhuc, type MoHinhChon,
  goiYAIKinhThanh, goiYAIAnchor, goiYAIBoAnchor, goiYAIBrief, goiYAICanh, luuBienThe, xoaBienThe, goiYAIBienThe, sinhAnhBienThe, nangCapCanh, chonPhienBan, doiChieuAnchor, xuatTap, trangThaiXuat, khopMiengCanh,
  type PhimDayDu,
} from '@/lib/actions';
import {
  LOAI_PHIM, LOAI_NHAN_VAT, TRANG_THAI_CANH, NHOM_BIEN_THE, nhanNhom, thanhPhanCanh, NANG_CAP, KHOP_MIENG, MO_HINH_ANH, MO_HINH_VIDEO, MO_HINH_CHU, docKinhThanh, giaAnhCents, giaVideoCents, tien,
  QC_TRONG, type ThongTinQc, thieuQc, giayPhat, cacNhanh, locNhanh, thoiLuongMacDinh, lamTronClip,
  gioVN, type Phim, type NhanVat, type BienThe, type Tap, type Canh, type Job, type KinhThanh, type LoaiPhim, type LoaiNhanVat,
} from '@/lib/xuong-video/kieu';

type Khoa = { google: boolean; anthropic: boolean; r2: boolean; openai: boolean; fal: boolean };
type KqChay = { ok: boolean; loi?: string } | void;

// ── Khối giao diện nhỏ của app (không mượn primitive của mos2 — app riêng) ─────────────────────────────────────────

function O({ label, hint, children, span }: { label?: ReactNode; hint?: ReactNode; children: ReactNode; span?: boolean }) {
  return <div className="xv-field" style={span ? { gridColumn: '1 / -1' } : undefined}>{label && <label className="xv-lbl">{label}</label>}{children}{hint && <div className="xv-hint">{hint}</div>}</div>;
}
function Pill({ color, children }: { color: string; children: ReactNode }) { return <span className="xv-pill" style={{ color }}>{children}</span>; }
function Seg<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string; title?: string }[]; value: T; onChange: (v: T) => void }) {
  return <span className="xv-seg">{options.map((o) => <button key={String(o.value)} type="button" title={o.title} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>)}</span>;
}
/** Nút bị gate: `ly` có chữ = khoá + hiện lý do khi rê chuột (không im lặng vô hiệu). */
/** gia (cents): lượt sinh trên ngưỡng ($0.5) phải bấm lại lần hai ngay tại nút (#1214). */
function Nut({ ly, ban, chinh, nguy, title, onClick, children, gia }: { ly?: string | false | null; ban?: boolean; chinh?: boolean; nguy?: boolean; title?: string; onClick: () => void; children: ReactNode; gia?: number }) {
  const why = ly ? String(ly) : '';
  const xn = useXacNhanTien(gia);
  return <button type="button" className={`xv-btn${chinh ? ' chinh' : ''}${nguy || xn.dangHoi ? ' nguy' : ''}`} disabled={!!why || ban} title={why || title} onClick={() => xn.bam(onClick)}>{xn.dangHoi ? `⚠ ${tien(gia ?? 0)} — bấm lại để xác nhận` : children}</button>;
}
/** Bỏ vào thùng rác hai nhịp: bấm lần một = cảnh báo, bấm lần hai trong 4s = chuyển vào thùng rác (khôi phục được, #1192). */
function Xoa({ nhan, onXoa, ban }: { nhan: string; onXoa: () => Promise<void>; ban?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
  return <button type="button" className="xv-btn nguy" disabled={ban} title={`Chuyển ${nhan} vào thùng rác — khôi phục được ở nút 🗑 Thùng rác`} onClick={() => { if (armed) { setArmed(false); void onXoa(); } else setArmed(true); }}>{armed ? `⚠ bấm lại để bỏ ${nhan} vào thùng rác` : '🗑'}</button>;
}
function Ngan({ onClose, nho, children }: { onClose: () => void; nho?: boolean; children: ReactNode }) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  return <><div className={`xv-backdrop${nho ? ' nho' : ''}`} onClick={onClose} /><div className={`xv-drawer${nho ? ' nho' : ''}`}>{children}</div></>;
}
function Loi({ children }: { children: ReactNode }) { return children ? <div className="xv-loi">{children}</div> : null; }
/** Ảnh nhỏ có nút ✕ xoá (hiện khi rê chuột, hỏi lại trước khi xoá). Dùng cho ảnh gốc, ảnh biến thể, ứng viên keyframe. */
function AnhNho({ url, kich = 40, vien, nhan, title, onClick, onXoa, soSanh }: { url: string; kich?: number; vien?: string; nhan?: string; title?: string; onClick?: () => void; onXoa?: () => void | Promise<void>; soSanh?: string }) {
  return (
    <span className="xv-anh-nho" title={title} style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
      <img src={url} alt="" onClick={onClick} data-so-sanh={soSanh} style={{ width: kich, height: kich, objectFit: 'cover', borderRadius: 5, display: 'block', cursor: onClick ? 'pointer' : 'default', border: `2px solid ${vien ?? 'transparent'}` }} />
      {nhan && <span style={{ position: 'absolute', left: 3, bottom: 2, fontSize: 8.5, color: '#fff', textShadow: '0 1px 2px #000', pointerEvents: 'none' }}>{nhan}</span>}
      {onXoa && <button type="button" className="xv-x" title="Bỏ ảnh vào thùng rác (khôi phục được)" onClick={(e) => { e.stopPropagation(); if (window.confirm('Bỏ ảnh này vào thùng rác? Khôi phục được ở nút 🗑 Thùng rác.')) void onXoa(); }}>✕</button>}
    </span>
  );
}
/** Lớp phủ "đang sinh" có sọc chạy — dùng chung cho thẻ anchor, biến thể, cảnh, clip timeline. */
function DangSinh({ chu = 'đang sinh' }: { chu?: string }) {
  return <div className="xv-dang"><span>⏳ {chu}</span></div>;
}
const mono: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-3)' };


import { Chon, type LuaChon } from './chon';
import { useViTriNoi } from './vi-tri-noi';
import { useXacNhanTien } from './xac-nhan-tien';

/** Menu "⋯" gom thao tác phụ (YDNI: mặt ngoài chỉ giữ việc kế tiếp). */
function Menu({ children, nhan = '⋯' }: { children: ReactNode; nhan?: string }) {
  const [mo, setMo] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const viTri = useViTriNoi(ref, mo, { rong: 340, canPhai: true, caoToiDa: 520 });
  useEffect(() => {
    if (!mo) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMo(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [mo]);
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" className="xv-btn" onClick={() => setMo(!mo)} title="Thêm thao tác">{nhan}</button>
      {mo && <div onClick={(e) => { if ((e.target as HTMLElement).closest('[data-dong]')) setMo(false); }} style={{ ...viTri, background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,.5)', padding: 6, display: 'grid', gap: 4, alignContent: 'start' }}>{children}</div>}
    </span>
  );
}
function MucMenu({ onClick, children, ly, nguy, gia }: { onClick: () => void; children: ReactNode; ly?: string | false | null; nguy?: boolean; gia?: number }) {
  const xn = useXacNhanTien(gia);
  // Đang hỏi xác nhận thì KHÔNG mang data-dong — menu không đóng ở lần bấm đầu.
  return <button type="button" {...(xn.canHoi && !xn.dangHoi ? {} : { 'data-dong': '' })} disabled={!!ly} title={ly || undefined} onClick={() => xn.bam(onClick)} className="xv-btn" style={{ textAlign: 'left', color: nguy || xn.dangHoi ? 'var(--red)' : undefined, opacity: ly ? 0.5 : 1 }}>{xn.dangHoi ? `⚠ ${tien(gia ?? 0)} — bấm lại để xác nhận` : children}</button>;
}

/** Danh mục model (Google/OpenAI + ~100 model fal) nạp một lần cho cả trang. */
const MoHinhCtx = createContext<{ anh: MoHinhChon[]; video: MoHinhChon[] }>({ anh: [], video: [] });
// Giá video: fal đọc từ bảng giá (khoảng theo độ phân giải phim, có tiếng); Google theo bảng tĩnh. Chi tiết tiếng Việt ở ô rê chuột (#1193).
const giaVideoUi = (ds: MoHinhChon[], key: string, giay: number, dpg: '720p' | '1080p') => {
  const m = ds.find((x) => x.key === key);
  if (m?.gia) { const g = m.gia.chinh[dpg]; if (g != null) return g * giay; const c = m.gia.clip[dpg]; if (c) return c[1]; }
  return m?.giaCents != null && m.donVi === 'giay' ? m.giaCents * giay : giaVideoCents(key, dpg, giay);
};
const giaAnhUi = (ds: MoHinhChon[], key: string) => ds.find((x) => x.key === key)?.giaCents ?? giaAnhCents(key);
const khoangTien = (k: [number, number], nhan = 1) => (Math.abs(k[0] - k[1]) < 0.05 ? tien(k[0] * nhan) : `${tien(k[0] * nhan)}–${tien(k[1] * nhan)}`);
function luaChonAnh(ds: MoHinhChon[]): LuaChon[] {
  return ds.map((m) => {
    const k = m.gia?.anh;
    const phu = k ? `${khoangTien(k)}/ảnh` : m.giaCents != null ? `${tien(m.giaCents)}/ảnh` : 'chưa có giá';
    return { value: m.key, label: m.label, nhom: m.nhom, phu, title: m.gia?.moTa ?? (m.giaCents != null ? `${tien(m.giaCents)} mỗi ảnh` : '') };
  });
}
function luaChonVideo(ds: MoHinhChon[], giay: number, dpg: '720p' | '1080p'): LuaChon[] {
  return ds.map((m) => {
    if (m.gia) {
      const kg = m.gia.giay[dpg]; const kc = m.gia.clip[dpg];
      const phu = kg ? `${khoangTien(kg, giay)} · ${giay}s` : kc ? `${khoangTien(kc)}/clip` : 'chưa có giá';
      const uoc = kg ? `\nƯớc tính clip ${giay} giây ở ${dpg}: ${khoangTien(kg, giay)} (thấp = không tiếng, cao = có tiếng; studio bật tiếng nên tính mức cao).` : '';
      return { value: m.key, label: m.label, nhom: m.nhom, phu, title: m.gia.moTa + uoc };
    }
    const g = m.donVi === 'giay' && m.giaCents != null ? m.giaCents : giaVideoCents(m.key, dpg, 1);
    return { value: m.key, label: m.label, nhom: m.nhom, phu: `${tien(g * giay)} · ${giay}s`, title: `${tien(g)} mỗi giây ở ${dpg} (bảng giá Google)` };
  });
}

// ── Trang ───────────────────────────────────────────────────────────────────────────────────────────────────────

export function XuongVideoTrang(props: { phimDau: Phim[]; khoa: Khoa }) {
  return <Suspense fallback={<span style={mono}>…</span>}><Ruot {...props} /></Suspense>;
}

function Ruot({ phimDau, khoa }: { phimDau: Phim[]; khoa: Khoa }) {
  const [phim, setPhim] = useState<Phim[]>(phimDau);
  const [ten, setTen] = useState('');
  const [loai, setLoai] = useState<LoaiPhim>('short');
  const [loiTao, setLoiTao] = useState('');
  const [ban, setBan] = useState(false);
  const modal = useModalParam();
  const taiLai = useCallback(async () => setPhim(await dsPhim()), []);
  const [moHinh, setMoHinh] = useState<{ anh: MoHinhChon[]; video: MoHinhChon[] }>({ anh: [], video: [] });
  useEffect(() => { void dsMoHinh().then(setMoHinh); }, []);

  const tao = async () => {
    setBan(true); setLoiTao('');
    const r = await taoPhim(ten, loai);
    setBan(false);
    if (!r.ok) { setLoiTao(r.loi); return; }
    setTen(''); await taiLai(); modal.open('phim', r.data);
  };
  const thieu = [!khoa.anthropic && 'ANTHROPIC_API_KEY (viết/tách kịch bản)', !khoa.google && 'GOOGLE_API_KEY (ảnh + video Veo)', !khoa.openai && 'OPENAI_API_KEY (ảnh dự phòng gpt-image)', !khoa.r2 && 'R2 (kho ảnh/video)'].filter(Boolean) as string[];
  const tongTien = phim.reduce((a, p) => a + p.chi_phi_cents, 0);

  return (
    <MoHinhCtx.Provider value={moHinh}>
    <div>
      {thieu.length > 0 && <div className="xv-banner">Máy chủ thiếu: {thieu.join(' · ')} — đặt trong .env.production rồi restart mos2-studio. Trang vẫn soạn được, nút sinh sẽ báo lỗi tới khi có khoá.</div>}
      <div className="xv-stats">
        <div className="xv-stat"><div className="l">Phim / bộ</div><div className="v">{phim.length}</div></div>
        <div className="xv-stat"><div className="l">Cảnh</div><div className="v">{phim.reduce((a, p) => a + p.so_canh, 0)}</div></div>
        <div className="xv-stat"><div className="l">Đã tốn</div><div className="v">{tien(tongTien)}</div><div className="s">ảnh + video, theo giá niêm yết</div></div>
        <div className="xv-stat"><div className="l">Giá mặc định</div><div className="v" style={{ fontSize: 14 }}>{tien(giaAnhCents('gemini-nano-banana-2.1'))} / ảnh · {tien(giaVideoCents('veo-3.1-lite-generate-preview', '720p', 8))} / 8s</div><div className="s">Nano Banana 2.1 · Veo 3.1 Lite 720p</div></div>
      </div>

      <div className="xv-panel">
        <h3>Tạo phim / bộ mới<small>short · phim nhiều tập · creative quảng cáo</small></h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <O label="Tên"><input className="xv-in" style={{ minWidth: 280 }} value={ten} onChange={(e) => setTen(e.target.value)} placeholder="Thỏ và Rùa · Quảng cáo áo bra X…" onKeyDown={(e) => { if (e.key === 'Enter') void tao(); }} /></O>
          <O label="Loại"><Seg options={LOAI_PHIM.map((l) => ({ value: l.key, label: l.label, title: l.mo_ta }))} value={loai} onChange={setLoai} /></O>
          <div className="xv-field"><Nut ly={!ten.trim() && 'nhập tên trước'} ban={ban} chinh onClick={() => void tao()}>+ Tạo</Nut></div>
        </div>
        <Loi>{loiTao}</Loi>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--line)' }}>
          <span style={mono}>Hoặc tạo từ mẫu có sẵn (kinh thánh + nhân vật + kịch bản tập 1 + storyboard tách sẵn bằng Claude, mất ~30s):</span>
          {MAU_PHIM.map((m) => (
            <Nut key={m.key} ban={ban} title={m.mo_ta} onClick={async () => { setBan(true); setLoiTao(''); const r = await taoPhimMau(m.key); setBan(false); if (!r.ok) { setLoiTao(r.loi); return; } await taiLai(); modal.open('phim', r.data); }}>{ban ? '… đang tạo + tách cảnh' : `📄 Mẫu ${m.nhan}`}</Nut>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}><ThungRac phimId={null} onKhoiPhuc={taiLai} /></div>
      {phim.length === 0 ? (
        <div className="xv-panel" style={{ textAlign: 'center', padding: 40 }}><div style={{ fontSize: 28 }}>🎬</div><b>Chưa có phim nào</b><div style={mono}>Tạo một phim ở trên: đặt tên, chọn loại, rồi khai nhân vật/sản phẩm và dán kịch bản.</div></div>
      ) : (
        <div className="xv-panel" style={{ padding: 0 }}>
          <table className="xv-tbl">
            <thead><tr><th>Phim</th><th>Loại</th><th className="n">Anchor</th><th className="n">Tập</th><th className="n">Cảnh</th><th className="n">Đã tốn</th><th>Trạng thái</th></tr></thead>
            <tbody>{phim.map((p) => (
              <tr key={p.id}>
                <td><button type="button" onClick={() => modal.open('phim', p.id)} style={{ background: 'none', border: 0, color: 'var(--fg-1)', cursor: 'pointer', fontWeight: 600, padding: 0, font: 'inherit' }}>{p.ten}</button></td>
                <td><Pill color="var(--fg-3)">{LOAI_PHIM.find((l) => l.key === p.loai)?.label ?? p.loai}</Pill></td>
                <td className="n">{p.so_nhan_vat}</td><td className="n">{p.so_tap}</td><td className="n">{p.so_canh}</td><td className="n">{tien(p.chi_phi_cents)}</td><td>{p.trang_thai}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {modal.is('phim') && modal.numId != null && (
        <PhimDrawer id={modal.numId} khoa={khoa} onClose={() => { modal.close(); void taiLai(); }} onXoa={async () => { await xoaPhim(modal.numId!); modal.close(); await taiLai(); }} />
      )}
    </div>
    </MoHinhCtx.Provider>
  );
}

// ── Drawer phim ─────────────────────────────────────────────────────────────────────────────────────────────────

function PhimDrawer({ id, khoa, onClose, onXoa }: { id: number; khoa: Khoa; onClose: () => void; onXoa: () => Promise<void> }) {
  const [d, setD] = useState<PhimDayDu | null | undefined>(undefined);
  const tapParam = useModalParam('tap');
  const tai = useCallback(async () => setD(await docPhim(id)), [id]);
  useEffect(() => { void tai(); }, [tai]);
  // Job ảnh còn chạy trên máy chủ (kể cả sau F5) → hỏi lại mỗi 4s tới khi xong.
  const conChay = !!d && (d.dangSinh.nhanVat.length > 0 || d.dangSinh.bienThe.length > 0);
  useEffect(() => { const t = setInterval(() => { if (document.visibilityState === 'visible') void tai(); }, conChay ? 4000 : 15000); return () => clearInterval(t); }, [conChay, tai]);

  if (d === undefined) return <Ngan onClose={onClose}><span style={mono}>đang tải…</span></Ngan>;
  if (d === null) return <Ngan onClose={onClose}><b>Không thấy phim</b></Ngan>;
  const { phim, nhanVat, tap } = d;
  const tapId = tapParam.numId && tap.some((t) => t.id === tapParam.numId) ? tapParam.numId : (tap[0]?.id ?? null);

  return (
    <Ngan onClose={onClose}>
      <div data-ngu-canh={`phim #${phim.id} ${phim.ten}`} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{phim.ten}</h2>
        <Pill color="var(--fg-3)">{LOAI_PHIM.find((l) => l.key === phim.loai)?.label ?? phim.loai}</Pill>
        <span style={mono}>#{phim.id}</span>
        <span style={{ flex: 1 }} />
        <ThongKe tk={d.thongKe} tongTien={d.tongTien} soAnchor={nhanVat.length} soTap={tap.length} />
        <a href="/thu-vien" target="_blank" rel="noreferrer" className="xv-btn" style={{ textDecoration: 'none' }} title="Cỡ cảnh, góc, chuyển động máy, ống kính, ánh sáng, màu, chuyển cảnh, âm thanh, nhạc — theo thể loại">🎬 Thư viện điện ảnh</a>
        <ThungRac phimId={phim.id} onKhoiPhuc={tai} />
        <Xoa nhan="cả phim (tập + cảnh)" onXoa={onXoa} />
        <button type="button" className="xv-btn" onClick={onClose}>Đóng</button>
      </div>

      <KinhThanhForm phim={phim} khoa={khoa} onSaved={tai} />
      <NhanVatSection phimId={phim.id} nhanVat={nhanVat} kinhThanh={phim.kinh_thanh} khoa={khoa} dangSinh={d.dangSinh} loiAnh={d.loiAnh} onChanged={tai} />

      <div className="xv-panel">
        <h3>3 · Tập: brief → kịch bản → storyboard<small>{phim.loai === 'phim' ? 'mỗi tập một kịch bản; tập sau đọc tóm tắt tập trước' : 'một tập'}</small></h3>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          {tap.length > 0 && (
            <Seg options={tap.map((t) => ({ value: t.id, label: `${phim.loai === 'phim' ? `Tập ${t.so}` : 'Tập'}${t.ten && t.ten !== phim.ten ? ` · ${t.ten}` : ''} (${t.so_canh})` }))} value={tapId ?? 0} onChange={(v) => tapParam.open('tap', v)} />
          )}
          {(phim.loai === 'phim' || tap.length === 0) && (
            <button type="button" className="xv-btn" onClick={async () => { const r = await taoTap(phim.id, ''); if (r.ok) { await tai(); tapParam.open('tap', r.data); } }}>+ Thêm tập</button>
          )}
        </div>
        {tapId != null && <TapView key={tapId} tap={tap.find((t) => t.id === tapId)!} phim={phim} nhanVat={nhanVat} khoa={khoa} onChanged={tai} />}
      </div>
      <ChiPhiGanDay jobs={d.ganDay} tong={d.tongTien} phimId={phim.id} />
    </Ngan>
  );
}

// ── Chi phí: mỗi lần sinh một dòng (đầy đủ ở /log) ────────────────────────────────────────────────────────────

const MAU_LOAI: Record<string, string> = { chu: 'var(--cyan)', anh: 'var(--amber)', video: 'var(--violet)' };
const NHAN_LOAI: Record<string, string> = { chu: 'Chữ', anh: 'Ảnh', video: 'Video' };

function ChiPhiGanDay({ jobs, tong, phimId }: { jobs: Job[]; tong: number; phimId: number }) {
  return (
    <div className="xv-panel" style={{ padding: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: jobs.length ? 6 : 0 }}>
        <b style={{ fontSize: 12 }}>Chi phí phim này: {tien(tong)}</b>
        <span style={mono}>mỗi lần gọi AI ghi một dòng · giá niêm yết</span>
        <span style={{ flex: 1 }} />
        <a href={`/log?phim=${phimId}`} className="xv-mono" target="_blank" rel="noreferrer">xem sổ đầy đủ →</a>
      </div>
      {jobs.map((j) => (
        <div key={j.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, padding: '2px 0', borderTop: '1px dashed var(--line)' }}>
          <span style={{ ...mono, width: 78 }}>{gioVN(j.created_at)}</span>
          <Pill color={MAU_LOAI[j.loai] ?? 'var(--fg-3)'}>{NHAN_LOAI[j.loai] ?? j.loai}</Pill>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={j.loi || j.nhan}>{j.nhan || j.model}{j.loi ? <span style={{ color: 'var(--red)' }}> · lỗi</span> : null}</span>
          <span style={mono}>{j.model}</span>
          <b style={{ fontFamily: 'var(--font-mono)', width: 56, textAlign: 'right', color: j.trang_thai === 'cho' || j.trang_thai === 'chay' ? 'var(--violet)' : undefined }}>{j.trang_thai === 'cho' || j.trang_thai === 'chay' ? 'đang…' : tien(j.chi_phi_cents)}</b>
        </div>
      ))}
    </div>
  );
}

// ── Kinh thánh (bible) ──────────────────────────────────────────────────────────────────────────────────────────

function KinhThanhForm({ phim, khoa, onSaved }: { phim: Phim; khoa: Khoa; onSaved: () => Promise<void> }) {
  // Ngăn phim tự làm mới 4-15 giây/lần → phim.kinh_thanh là object MỚI mỗi lần dù nội dung y nguyên. Đồng bộ theo NỘI DUNG (chuỗi JSON)
  // và chỉ khi anh không đang sửa dở — trước đây mỗi lần làm mới ghi đè chỗ đang sửa: chọn thể loại bị nhảy về, "Lấy từ link" điền xong
  // rồi mất (#1207, #1208).
  const gocJson = JSON.stringify(phim.kinh_thanh ?? {});
  const goc = useMemo(() => docKinhThanh(JSON.parse(gocJson) as KinhThanh), [gocJson]);
  const moHinh = useContext(MoHinhCtx);
  const [kt, setKt] = useState<Required<KinhThanh>>(goc);
  const [moTa, setMoTa] = useState(phim.mo_ta);
  const [luu, setLuu] = useState(false);
  const [ai, setAi] = useState(false);
  const [loiAi, setLoiAi] = useState('');
  const dirty = JSON.stringify(kt) !== JSON.stringify(goc) || moTa !== phim.mo_ta;
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  useEffect(() => { if (!dirtyRef.current) { setKt(goc); setMoTa(phim.mo_ta); } }, [goc, phim.mo_ta]);
  // Tự lưu 1,5 giây sau lần sửa cuối — không còn mất vì quên bấm Lưu.
  const [luuLuc, setLuuLuc] = useState('');
  const luuNgay = useCallback(async (k: Required<KinhThanh>, m: string) => {
    setLuu(true); await suaPhim(phim.id, { kinh_thanh: k, mo_ta: m }); setLuu(false);
    setLuuLuc(gioVN(new Date(), { giay: true, chiGio: true }));
    await onSaved();
  }, [phim.id, onSaved]);
  useEffect(() => { if (!dirty) return; const t = setTimeout(() => void luuNgay(kt, moTa), 1500); return () => clearTimeout(t); }, [kt, moTa, dirty, luuNgay]);
  // Mở/đóng khung do anh bấm; chỉ quyết định MỘT lần lúc mở (open điều khiển theo state làm khung tự gập khi vừa chọn thể loại).
  // Anh đã thu gọn/mở thì GIỮ như vậy (nhớ theo phim, qua F5 và lượt tự làm mới) — #1212. Chưa từng bấm: mở khi còn thiếu.
  const khoaMo = (ten: string) => `xv-mo-${ten}-${phim.id}`;
  const docMo = (ten: string, macDinh: boolean) => { try { const v = localStorage.getItem(khoaMo(ten)); return v == null ? macDinh : v === '1'; } catch { return macDinh; } };
  const ghiMo = (ten: string, v: boolean) => { try { localStorage.setItem(khoaMo(ten), v ? '1' : '0'); } catch { /* chế độ riêng tư */ } };
  // Đọc trạng thái đã lưu NGAY từ đầu (form này chỉ dựng ở trình duyệt, sau khi tải phim — không có SSR). CHỈ ghi khi anh bấm tiêu đề:
  // trước đây ghi trong onToggle, mà trình duyệt bắn toggle cho cả lần mở MẶC ĐỊNH lúc tải trang → đè "đã thu gọn" thành "mở".
  const [moKhung, setMoKhungS] = useState(() => docMo('kt', !goc.phong_cach || !goc.the_loai));
  const latKhung = (e: React.MouseEvent) => { e.preventDefault(); setMoKhungS((v) => { ghiMo('kt', !v); return !v; }); };
  const set = <K extends keyof KinhThanh>(k: K, v: Required<KinhThanh>[K]) => setKt((x) => ({ ...x, [k]: v }));
  // Phim quảng cáo: khai sản phẩm/dịch vụ TRƯỚC — mọi nút AI đọc nó (#1201).
  const laQc = phim.loai === 'quang_cao';
  const qc: ThongTinQc = { ...QC_TRONG, ...(kt.qc ?? {}) };
  const setQc = (p: Partial<ThongTinQc>) => setKt((x) => ({ ...x, qc: { ...QC_TRONG, ...(x.qc ?? {}), ...p } }));
  const thieuSp = !!thieuQc(phim.loai, { ...kt, qc });
  const [docLink, setDocLink] = useState(false);
  const [moQc, setMoQcS] = useState(() => docMo('qc', !(goc.qc?.ten || goc.qc?.link)));
  const latQc = (e: React.MouseEvent) => { e.preventDefault(); setMoQcS((v) => { ghiMo('qc', !v); return !v; }); };
  const layLink = async () => {
    setDocLink(true); setLoiAi('');
    const r = await layTuLinkSanPham(phim.id, qc.link);
    setDocLink(false);
    if (!r.ok) { setLoiAi(r.loi); return; }
    setQc({ ...r.data, ten: qc.ten || r.data.ten, anh: [...new Set([...qc.anh, ...r.data.anh])].slice(0, 10) });
  };
  // ✨ riêng từng ô (thể loại / logline / chủ đề): cùng một lượt Claude đọc sản phẩm + tiền đề + nhân vật, chỉ điền đúng ô được bấm.
  const [aiO, setAiO] = useState('');
  const goiYMot = async (k: 'the_loai' | 'logline' | 'chu_de') => {
    setAiO(k); setLoiAi('');
    const r = await goiYAIKinhThanh(phim.id);
    setAiO('');
    if (!r.ok) { setLoiAi(r.loi); return; }
    const v = r.data[k];
    if (k === 'the_loai') { if (v && THE_LOAI.some((t) => t.key === v)) set('the_loai', v as TheLoai); } else if (v) set(k, v);
  };
  const nutAi = (k: 'the_loai' | 'logline' | 'chu_de') => (
    <button type="button" className="xv-btn" disabled={!!aiO || thieuSp} title={thieuSp ? 'khai sản phẩm/dịch vụ ở mục 0 trước' : 'AI gợi ý riêng ô này (đọc sản phẩm, tiền đề, nhân vật)'} onClick={() => void goiYMot(k)}
      style={{ padding: '0 6px', fontSize: 10.5, lineHeight: '16px', marginLeft: 6, textTransform: 'none' }}>{aiO === k ? '… AI' : '✨ AI'}</button>
  );
  const goiY = async () => { setAi(true); setLoiAi(''); const r = await goiYAIKinhThanh(phim.id); setAi(false); if (!r.ok) { setLoiAi(r.loi); return; } set('phong_cach', r.data.phong_cach); setMoTa(r.data.mo_ta); if (r.data.the_loai && THE_LOAI.some((t) => t.key === r.data.the_loai)) set('the_loai', r.data.the_loai as TheLoai); if (r.data.logline) set('logline', r.data.logline); if (r.data.chu_de) set('chu_de', r.data.chu_de); };
  return (
    <>
      {laQc && (
        <details className="xv-det xv-panel" open={moQc} style={{ borderColor: thieuSp ? 'var(--amber)' : 'var(--line)' }}>
          <summary onClick={latQc}>0 · Sản phẩm / dịch vụ được quảng cáo <small>{thieuSp ? '⚠ khai trước — AI gợi ý, viết kịch bản, tách cảnh đều dựa vào đây' : `${qc.ten}${qc.anh.length ? ` · ${qc.anh.length} ảnh` : ''}${qc.uu_dai ? ` · ${qc.uu_dai}` : ''}`}</small></summary>
          <div className="xv-grid">
            <O span label="Link trang sản phẩm" hint="dán link → bấm Lấy từ link: AI đọc trang, điền sẵn tên, điểm nổi bật, đối tượng, ưu đãi + kéo ảnh sản phẩm về (~$0.01)">
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="xv-in" value={qc.link} onChange={(e) => setQc({ link: e.target.value })} placeholder="https://shop.com/products/…" />
                <Nut ly={(!/^https?:\/\//.test(qc.link.trim()) && 'dán link http(s) trước') || (!khoa.anthropic && 'thiếu ANTHROPIC_API_KEY')} ban={docLink} onClick={() => void layLink()}>{docLink ? '… AI đang đọc trang' : '🔗 Lấy từ link'}</Nut>
              </div>
            </O>
            <O label="Tên sản phẩm / dịch vụ"><input className="xv-in" value={qc.ten} onChange={(e) => setQc({ ten: e.target.value })} placeholder="Gentle Lift Bra" /></O>
            <O label="Khách hàng mục tiêu"><input className="xv-in" value={qc.doi_tuong} onChange={(e) => setQc({ doi_tuong: e.target.value })} placeholder="Phụ nữ Mỹ 50+, mỏi vai vì bra gọng" /></O>
            <O label="Ưu đãi / lời kêu gọi"><input className="xv-in" value={qc.uu_dai} onChange={(e) => setQc({ uu_dai: e.target.value })} placeholder="50%+ OFF · Mua 2 tặng 1 · Shop now" /></O>
            <O label="Thị trường · ngôn ngữ"><input className="xv-in" value={qc.thi_truong} onChange={(e) => setQc({ thi_truong: e.target.value })} placeholder="Mỹ · tiếng Anh" /></O>
            <O span label="Điểm nổi bật / lợi ích (có thật)"><textarea className="xv-ta" rows={3} value={qc.diem_noi_bat} onChange={(e) => setQc({ diem_noi_bat: e.target.value })} placeholder="Không gọng, nâng nhẹ từ hai bên, vải dệt liền mềm, dây vai bản rộng, cài trước…" /></O>
            <O span label="Ảnh sản phẩm thật" hint="dán Ctrl+V · nút Dán (điện thoại) · kéo thả · chọn file · URL. Lưu kinh thánh → ảnh vào anchor sản phẩm, AI giữ đúng màu/dáng khi sinh cảnh.">
              <ImageAttach value={qc.anh} onChange={(urls) => setQc({ anh: urls })} max={10} nhanBo="Bỏ ảnh"
                upload={async (du) => { const r = await taiAnhLen(du); return r.ok ? { ok: true, url: r.data } : { ok: false, error: r.loi }; }} />
            </O>
          </div>
        </details>
      )}
    <details className="xv-det xv-panel" open={moKhung}>
      <summary onClick={latKhung}>1 · Kinh thánh của bộ phim <small>{kt.phong_cach ? `${kt.ti_le} · ${kt.do_phan_giai}` : 'chưa đặt phong cách'} · {kt.the_loai ? `🎭 ${THE_LOAI.find((t) => t.key === kt.the_loai)?.ten}` : <b style={{ color: 'var(--amber)' }}>⚠ chưa chọn thể loại (thư viện điện ảnh dựa vào đây)</b>}{kt.logline ? ` · “${kt.logline.slice(0, 70)}”` : ''}</small></summary>

      <div className="xv-grid" style={{ marginTop: 10 }}>
        <O span label="Phong cách hình ảnh" hint="Viết như tả cho hoạ sĩ: chất liệu, bảng màu, ánh sáng, lens. Tiếng Việt hay Anh đều được. Nối vào đầu mọi prompt để các tập giống nhau.">
          <textarea className="xv-ta" rows={2} value={kt.phong_cach} onChange={(e) => set('phong_cach', e.target.value)} placeholder={laQc ? "Quay thật kiểu UGC, ánh sáng cửa sổ, cầm tay, chân thực…" : "3D hoạt hình kiểu Pixar, màu ấm, ánh sáng mềm buổi sáng, khu rừng cổ tích…"} />
        </O>
        <O span label="Mô tả / tiền đề"><textarea className="xv-ta" rows={2} value={moTa} onChange={(e) => setMoTa(e.target.value)} placeholder="Bộ phim kể về… / Sản phẩm là… bán cho…" /></O>
        <O label={<>Thể loại{nutAi('the_loai')}</>} hint="quyết định thư viện cỡ cảnh / ánh sáng / âm thanh / nhạc Claude chọn cho từng shot"><Chon value={kt.the_loai} onChange={(v) => set('the_loai', v as TheLoai)} options={THE_LOAI.map((t) => ({ value: t.key, label: t.ten, title: t.mo_ta, phu: t.mo_ta.split(',')[0] }))} placeholder="chọn thể loại…" minWidth={220} /></O>
        <O label={<>Logline{nutAi('logline')}</>} hint="một câu: ai · muốn gì · cái gì cản"><input className="xv-in" value={kt.logline} onChange={(e) => set('logline', e.target.value)} placeholder={laQc ? "Phụ nữ 50+ mỏi vai vì bra gọng tìm được chiếc bra nâng mặc cả ngày quên" : "Rùa con chậm chạp phải băng qua rừng úa để cứu cây mẹ trước khi mùa đông tới"} /></O>
        <O label={<>Chủ đề{nutAi('chu_de')}</>} hint="điều bộ phim muốn nói"><input className="xv-in" value={kt.chu_de} onChange={(e) => set('chu_de', e.target.value)} placeholder={laQc ? "Thoải mái mà vẫn đẹp" : "Chậm mà bền, đi cùng nhau thì tới"} /></O>
        <O label="Khung hình"><Seg options={[{ value: '9:16', label: '9:16 dọc' }, { value: '16:9', label: '16:9 ngang' }]} value={kt.ti_le} onChange={(v) => set('ti_le', v)} /></O>
        <O label="Độ phân giải video"><Seg options={[{ value: '720p', label: '720p (rẻ)' }, { value: '1080p', label: '1080p' }]} value={kt.do_phan_giai} onChange={(v) => set('do_phan_giai', v)} /></O>
        <O label="Model ảnh (mặc định)"><Chon value={kt.mo_hinh_anh} onChange={(v) => set('mo_hinh_anh', v as Required<KinhThanh>['mo_hinh_anh'])} options={luaChonAnh(moHinh.anh.length ? moHinh.anh : MO_HINH_ANH.map((m) => ({ key: m.key, label: m.label, nhom: '', giaCents: m.gia1k, donVi: 'anh' as const })))} /></O>
        <O label="Model video (mặc định)"><Chon value={kt.mo_hinh_video} onChange={(v) => set('mo_hinh_video', v as Required<KinhThanh>['mo_hinh_video'])} options={luaChonVideo(moHinh.video.length ? moHinh.video : MO_HINH_VIDEO.map((m) => ({ key: m.key, label: m.label, nhom: '', giaCents: m.giaGiay['720p'], donVi: 'giay' as const })), 5, kt.do_phan_giai)} /></O>
        <O label="Model chữ (kịch bản, tách cảnh)"><Chon value={kt.mo_hinh_chu} onChange={(v) => set('mo_hinh_chu', v as Required<KinhThanh>['mo_hinh_chu'])} options={MO_HINH_CHU.map((m) => ({ value: m.key, label: m.label, nhom: 'Anthropic' }))} /></O>
        <O label="Ngôn ngữ lời thoại"><Chon value={kt.ngon_ngu} onChange={(v) => set('ngon_ngu', v)} options={[{ value: 'vi', label: 'Tiếng Việt' }, { value: 'en', label: 'English' }]} /></O>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <Nut ly={!dirty && 'đã lưu'} ban={luu} chinh onClick={() => void luuNgay(kt, moTa)}>Lưu kinh thánh</Nut>
        <span style={{ ...mono, color: dirty ? 'var(--amber)' : 'var(--lime)' }}>{luu ? '… đang lưu' : dirty ? '● chưa lưu — tự lưu sau 1,5 giây' : luuLuc ? `✓ đã lưu ${luuLuc}` : '✓ đã lưu'}</span>
        <Nut ly={thieuSp && 'khai sản phẩm/dịch vụ ở mục 0 trước (hoặc dán link rồi bấm Lấy từ link)'} ban={ai} title="Claude đọc tên phim, loại, sản phẩm (quảng cáo), tuyến nhân vật, các tập đã có → viết phong cách + tiền đề + thể loại + logline. Chỉ điền vào ô, anh xem rồi Lưu." onClick={() => void goiY()}>{ai ? '… AI đang viết' : '✨ AI gợi ý phong cách + tiền đề'}</Nut>
      </div>
      <Loi>{loiAi}</Loi>
    </details>
    </>
  );
}

/** Giọng cố định của một nhân vật (cả bộ phim): chọn model (ElevenLabs tài khoản anh / mọi TTS fal) + giọng, nghe thử. */
function GiongNhanVat({ v, onChanged }: { v: NhanVat; onChanged: () => Promise<void> }) {
  const [mo, setMo] = useState(false);
  const [dsM, setDsM] = useState<Awaited<ReturnType<typeof dsGiongModel>>>([]);
  const [model, setModel] = useState(v.giong_model);
  const [voice, setVoice] = useState(v.giong_id);
  const [dsG, setDsG] = useState<{ id: string; ten: string }[] | null>(null);
  const [ban, setBan] = useState(''); const [loi, setLoi] = useState('');
  useEffect(() => { if (mo && !dsM.length) void dsGiongModel().then((d) => { setDsM(d); if (!model && d[0]) setModel(d[0].key); }); }, [mo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!mo || !model) return; setDsG(null); void dsGiongCua(model).then(setDsG); }, [mo, model]);
  const giaM = (m: (typeof dsM)[number]) => (m.giaCents == null ? (m.key.startsWith('elevenlabs:') ? 'trong gói' : 'chưa có giá') : `${tien(m.giaCents)}${m.donVi === '1k_ky_tu' ? '/1k ký tự' : m.donVi === 'giay' ? '/giây' : m.donVi === 'luot' ? '/lượt' : ''}`);
  const moTa = (id: string) => Object.values(GIONG).flat().find((g) => g.id === id)?.ta;
  const tenModel = dsM.find((m) => m.key === v.giong_model)?.ten ?? v.giong_model.split('/').slice(-2).join('/');
  return (
    <>
      <button type="button" className="xv-btn" onClick={() => setMo(true)} title={v.giong ? `Mô tả giọng: ${v.giong}` : 'Chọn giọng cố định cho nhân vật'}>🗣 {v.giong_id ? `${v.giong_id}` : 'Chọn giọng'}</button>
      {mo && (
        <Ngan nho onClose={() => setMo(false)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 16, flex: 1 }}>🗣 Giọng của {v.ten}</h2>
            <button type="button" className="xv-btn" onClick={() => setMo(false)}>Đóng</button>
          </div>
          <div style={{ ...mono, marginBottom: 10 }}>Một giọng cố định cho cả bộ phim: mọi shot {v.ten} nói đều đọc bằng giọng này, cảm xúc đổi theo từng shot.{v.giong ? ` Mô tả giọng đã ghi: “${v.giong}”.` : ''}{v.giong_model ? ` Đang dùng: ${tenModel} · ${v.giong_id}.` : ''}</div>
          <O label="Model giọng"><Chon value={model} onChange={(x) => { setModel(x); setVoice(''); }} minWidth={300} options={dsM.map((m) => ({ value: m.key, label: m.ten, nhom: m.nhom, phu: giaM(m), title: m.giaText }))} placeholder={dsM.length ? 'chọn…' : 'đang tải danh mục…'} /></O>
          <O label="Giọng" hint={dsG && !dsG.length ? 'model này không công bố danh sách giọng — gõ tên/id giọng nếu biết, để trống = giọng mặc định của model' : undefined}>
            {dsG && !dsG.length
              ? <input className="xv-in" value={voice} onChange={(e) => setVoice(e.target.value)} placeholder="tên / id giọng" />
              : <Chon value={voice} onChange={setVoice} minWidth={300} options={(dsG ?? []).map((g) => ({ value: g.id, label: g.ten, phu: moTa(g.id) }))} placeholder={dsG ? 'chọn giọng…' : 'đang tải giọng…'} />}
          </O>
          <Loi>{loi}</Loi>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Nut chinh ly={!model && 'chọn model'} ban={ban === 'luu'} onClick={async () => { setBan('luu'); setLoi(''); const r = await chonGiong(v.id, model, voice); setBan(''); if (!r.ok) { setLoi(r.loi); return; } await onChanged(); }}>Lưu giọng</Nut>
            <Nut ly={(!v.giong_model && 'lưu giọng trước') || ((v.giong_model !== model || v.giong_id !== voice) && 'lưu giọng vừa chọn trước')} ban={ban === 'nghe'} title="Sinh một câu chào ngắn bằng giọng này (~$0.01)" onClick={async () => { setBan('nghe'); setLoi(''); const r = await ngheThuGiong(v.id); setBan(''); if (!r.ok) { setLoi(r.loi); return; } await onChanged(); }}>🎧 Nghe thử</Nut>
            {v.giong_mau_url && <audio src={v.giong_mau_url} controls preload="none" style={{ height: 28 }} />}
          </div>
        </Ngan>
      )}
    </>
  );
}

const NHAN_RAC: Record<string, string> = { phim: 'phim', tap: 'tập', canh: 'cảnh', nhan_vat: 'anchor', bien_the: 'biến thể', anh_goc: 'ảnh gốc', keyframe: 'keyframe', anh_bien_the: 'ảnh biến thể' };
/** Nút 🗑 Thùng rác + ngăn liệt kê thứ đã bỏ (phimId null = phim đã xoá) với nút Khôi phục. Không có xoá vĩnh viễn (#1192). */
function ThungRac({ phimId, onKhoiPhuc }: { phimId: number | null; onKhoiPhuc: () => Promise<void> }) {
  const [mo, setMo] = useState(false);
  const [ds, setDs] = useState<Awaited<ReturnType<typeof dsThungRac>> | null>(null);
  const [loi, setLoi] = useState('');
  const [ban, setBan] = useState<number | null>(null);
  const nap = useCallback(async () => setDs(await dsThungRac(phimId)), [phimId]);
  useEffect(() => { void nap(); }, [nap, mo]);
  return (
    <>
      <button type="button" className="xv-btn" onClick={() => setMo(true)} title="Thứ đã bỏ — khôi phục được">🗑 Thùng rác{ds?.length ? ` (${ds.length})` : ''}</button>
      {mo && (
        <Ngan nho onClose={() => setMo(false)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 16, flex: 1 }}>🗑 Thùng rác{phimId == null ? ' · phim đã xoá' : ''}</h2>
            <button type="button" className="xv-btn" onClick={() => setMo(false)}>Đóng</button>
          </div>
          <div style={{ ...mono, marginBottom: 8 }}>Bỏ vào đây = gỡ khỏi màn, dữ liệu + ảnh giữ nguyên. Khôi phục đưa về đúng chỗ cũ (cùng id, cùng sổ chi phí).</div>
          <Loi>{loi}</Loi>
          {ds === null ? <span style={mono}>…</span> : ds.length === 0 ? <div style={mono}>Thùng rác trống.</div> : (
            <div style={{ display: 'grid', gap: 6 }}>
              {ds.map((m) => (
                <div key={m.id} className="xv-canh" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {m.anh ? <img src={m.anh} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 5, flexShrink: 0 }} /> : <div style={{ width: 44, height: 44, borderRadius: 5, background: 'var(--bg-2)', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.ten}</div>
                    <div style={mono}>{NHAN_RAC[m.loai] ?? m.loai} · bỏ lúc {gioVN(m.xoa_luc)} · {m.nguoi}</div>
                  </div>
                  <Nut ban={ban === m.id} onClick={async () => { setBan(m.id); setLoi(''); const r = await khoiPhuc(m.id); setBan(null); if (!r.ok) { setLoi(r.loi); return; } await nap(); await onKhoiPhuc(); }}>↩ Khôi phục</Nut>
                </div>
              ))}
            </div>
          )}
        </Ngan>
      )}
    </>
  );
}

/** Thống kê gọn cả phim ở đầu ngăn: chip nhỏ một dòng, rê chuột thấy chi tiết. */
function ThongKe({ tk, tongTien, soAnchor, soTap }: { tk: PhimDayDu['thongKe']; tongTien: number; soAnchor: number; soTap: number }) {
  const phut = `${Math.floor(tk.giay / 60)}:${String(tk.giay % 60).padStart(2, '0')}`;
  const chip = (icon: string, gt: ReactNode, title: string, mau?: string) => (
    <span title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--bg-2)', fontFamily: 'var(--font-mono)', fontSize: 11, color: mau ?? 'var(--fg-2)', whiteSpace: 'nowrap' }}>{icon} {gt}</span>
  );
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      {chip('💰', tien(tongTien), `Tổng đã tốn ${tien(tongTien)}\nảnh ${tien(tk.tienAnh)} · video ${tien(tk.tienVideo)} · chữ (Claude) ${tien(tk.tienChu)}\n${tk.soLanSinh} lần sinh thành công`, 'var(--amber)')}
      {chip('📺', `${soTap} tập`, `${soTap} tập`)}
      {chip('🎬', `${tk.soCanh} cảnh · ${phut}`, `${tk.soCanh} cảnh, tổng ${tk.giay} giây`)}
      {chip('🖼', `${tk.coKf}/${tk.soCanh}`, `${tk.coKf}/${tk.soCanh} cảnh có keyframe · ${tk.duyet} cảnh đã duyệt chờ video`)}
      {chip('🎞', `${tk.nhap}/${tk.soCanh}`, `${tk.nhap}/${tk.soCanh} cảnh có video nháp`)}
      {chip('✅', `${tk.cuoi}/${tk.soCanh}`, `${tk.cuoi}/${tk.soCanh} cảnh có bản cuối`, tk.cuoi && tk.cuoi === tk.soCanh ? 'var(--lime)' : undefined)}
      {chip('👤', `${soAnchor} · ${tk.anhGoc} ảnh`, `${soAnchor} anchor · ${tk.anhGoc} ảnh gốc`)}
      {chip('🎭', `${tk.btCoAnh}/${tk.bienThe}`, `${tk.bienThe} biến thể, ${tk.btCoAnh} đã có ảnh`)}
    </div>
  );
}

// ── Anchor: nhân vật / sản phẩm / bối cảnh ───────────────────────────────────────────────────────────────────────

function NhanVatSection({ phimId, nhanVat, kinhThanh, khoa, dangSinh, loiAnh, onChanged }: { phimId: number; nhanVat: NhanVat[]; kinhThanh: KinhThanh; khoa: Khoa; dangSinh: { nhanVat: number[]; bienThe: number[] }; loiAnh: { nhanVat: Record<number, string>; bienThe: Record<number, string> }; onChanged: () => Promise<void> }) {
  const [sua, setSua] = useState<Partial<NhanVat> | null>(null);
  const [btMo, setBtMo] = useState<number | null>(null);
  const [ban, setBan] = useState<number | null>(null);
  const [loi, setLoi] = useState<Record<number, string>>({});
  const kt = docKinhThanh(kinhThanh);
  // Bấm là đẩy vào hàng đợi nền rồi trả ngay → bấm liên tục nhiều anchor được; trạng thái "đang sinh" đọc từ máy chủ.
  // gui[id] = số ảnh gốc lúc bấm lần đầu của mạch này → nút hiện "đang gửi" ngay khi bấm, xong thì báo đã thêm mấy ảnh.
  const [gui, setGui] = useState<Record<number, { goc: number; cho: number }>>({});
  const sinh = async (id: number, soAnh: number) => {
    setLoi((x) => ({ ...x, [id]: '' }));
    setGui((g) => ({ ...g, [id]: { goc: g[id]?.goc ?? soAnh, cho: (g[id]?.cho ?? 0) + 1 } }));
    const r = await sinhAnhMau(id);
    setGui((g) => (g[id] ? { ...g, [id]: { ...g[id], cho: g[id].cho - 1 } } : g));
    if (!r.ok) setLoi((x) => ({ ...x, [id]: r.loi }));
    await onChanged();
  };
  return (
    <div className="xv-panel">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h3 style={{ flex: 1 }}>2 · Tuyến nhân vật · sản phẩm · bối cảnh<small>anchor: đặc tính cố định + ảnh mẫu → mọi cảnh, mọi tập tham chiếu cùng một bản</small></h3>
        <Nut ban={ban === -1} title="Claude đọc tiền đề + kịch bản các tập + anchor đã có → tạo các anchor còn thiếu (nhân vật, sản phẩm, bối cảnh, đạo cụ). Tạo xong anh sửa/xoá tuỳ ý." onClick={async () => { setBan(-1); setLoi((x) => ({ ...x, [-1]: '' })); const r = await goiYAIBoAnchor(phimId); setBan(null); if (!r.ok) setLoi((x) => ({ ...x, [-1]: r.loi })); await onChanged(); }}>{ban === -1 ? '… AI đang đề xuất' : '✨ AI đề xuất tuyến còn thiếu'}</Nut>
        <button type="button" className="xv-btn" onClick={() => setSua({ loai: 'nhan_vat', ten: '', mo_ta: '', anh_ref: [], giong: '' })}>+ Thêm</button>
      </div>
      <Loi>{loi[-1]}</Loi>
      {nhanVat.length === 0 && <div style={mono}>Chưa có anchor. Phim nhiều tập BẮT BUỘC khai nhân vật ở đây trước khi tách cảnh, nếu không mỗi tập Claude sẽ tả một kiểu.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 8 }}>
        {nhanVat.map((v) => {
          const soDang = dangSinh.nhanVat.filter((x) => x === v.id).length + (gui[v.id]?.cho ?? 0);
          const g0 = gui[v.id]; const them = g0 ? v.anh_ref.length - g0.goc : 0;
          return (
          <div key={v.id} className="xv-anchor" style={{ flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ width: 72, height: 72, flexShrink: 0, position: 'relative', borderRadius: 6, overflow: 'hidden' }}>
                {v.anh_ref[0] ? <a href={v.anh_ref[0]} target="_blank" rel="noreferrer"><img src={v.anh_ref[0]} alt="" style={{ width: 72, height: 72, objectFit: 'cover', display: 'block' }} /></a>
                  : <div style={{ width: 72, height: 72, background: 'var(--bg-2)', display: 'grid', placeItems: 'center', color: 'var(--fg-4)' }}>?</div>}
                {soDang > 0 && <DangSinh chu={`${soDang} ảnh`} />}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><strong style={{ fontSize: 12 }}>{v.ten}</strong><Pill color="var(--fg-3)">{LOAI_NHAN_VAT.find((l) => l.key === v.loai)?.label ?? v.loai}</Pill></div>
                <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={v.mo_ta}>{v.mo_ta || <em style={{ color: 'var(--fg-4)' }}>chưa mô tả</em>}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                  <button type="button" className="xv-btn" onClick={() => setSua(v)}>Sửa</button>
                  <Nut ly={(!khoa.google && !khoa.openai && 'thiếu GOOGLE_API_KEY/OPENAI_API_KEY') || (!v.mo_ta.trim() && 'tả đặc tính trước')} title={`Sinh ảnh gốc (${v.loai === 'nhan_vat' ? 'character sheet: nhiều góc + biểu cảm' : 'ảnh tham chiếu'}) từ mô tả (~${tien(giaAnhCents(kt.mo_hinh_anh))}/ảnh, ~20 giây). Bấm nhiều lần = sinh song song nhiều ảnh; mỗi lần thêm đổi góc khác.`} onClick={() => void sinh(v.id, v.anh_ref.length)} gia={giaAnhCents(kt.mo_hinh_anh)}>{v.anh_ref.length ? '✨ Sinh thêm ảnh gốc' : '✨ Sinh ảnh gốc'} · {tien(giaAnhCents(kt.mo_hinh_anh))}</Nut>
                  <button type="button" className="xv-btn" onClick={() => setSua(v)} title="Thêm ảnh thật: dán Ctrl+V, nút Dán (điện thoại), kéo thả, chọn file, URL">📷 Ảnh thật</button>
                  <Nut ly={(!khoa.anthropic && 'thiếu ANTHROPIC_API_KEY') || (!v.anh_ref.length && 'chưa có ảnh gốc') || (!v.mo_ta.trim() && 'chưa có mô tả')} ban={ban === v.id} title="Claude NHÌN ảnh gốc so với mô tả: màu, chất liệu, chi tiết, chữ/logo — lệch thì đề xuất mô tả theo ảnh (ảnh sản phẩm có ren mà mô tả ghi không ren → cả kịch bản sai)"
                    onClick={async () => { setBan(v.id); setLoi((x) => ({ ...x, [v.id]: '' })); const r = await doiChieuAnchor(v.id); setBan(null); if (!r.ok) setLoi((x) => ({ ...x, [v.id]: r.loi })); await onChanged(); }}>{ban === v.id ? '… đang so' : '🔍 Đối chiếu ảnh'}</Nut>
                  {v.loai === 'nhan_vat' && <GiongNhanVat v={v} onChanged={onChanged} />}
                  <button type="button" className="xv-btn" onClick={() => setBtMo(v.id)} title="Biểu cảm, trang phục, tư thế / góc máy, thời điểm… — mỗi biến thể sinh từ ảnh gốc nên giữ đúng danh tính">🎭 Biến thể ({v.bien_the?.length ?? 0})</button>
                  <Xoa nhan="anchor" onXoa={async () => { await xoaNhanVat(v.id); await onChanged(); }} />
                </div>
                {(soDang > 0 || them > 0) && (
                  <div style={{ ...mono, marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {soDang > 0 && <span style={{ color: 'var(--violet)' }}>⏳ đang sinh {soDang} ảnh (~20 giây/ảnh)…</span>}
                    {them > 0 && <span style={{ color: 'var(--lime)' }}>✓ đã thêm {them} ảnh gốc mới (đang là ảnh chính)</span>}
                  </div>
                )}
                {v.loai === 'san_pham' && !v.anh_ref.length && <div style={{ fontSize: 10.5, color: 'var(--amber)', marginTop: 4 }}>⚠ Quảng cáo cần ảnh sản phẩm thật — bấm 📷 Ảnh thật để dán/tải ảnh, AI sẽ giữ đúng màu, dáng, chi tiết.</div>}
                {v.doi_chieu && (v.doi_chieu.khop
                  ? <div style={{ fontSize: 10.5, color: 'var(--lime)', marginTop: 4 }} title={`Đối chiếu lúc ${gioVN(v.doi_chieu.luc)}`}>✓ Mô tả khớp ảnh gốc</div>
                  : <div style={{ fontSize: 10.5, color: 'var(--amber)', marginTop: 4, display: 'grid', gap: 3 }}>
                      <div>⚠ Mô tả LỆCH ảnh gốc ({gioVN(v.doi_chieu.luc)}):</div>
                      {v.doi_chieu.lech.slice(0, 5).map((l, i) => <div key={i} style={{ paddingLeft: 10 }}>– {l}</div>)}
                      {v.doi_chieu.mo_ta_de_xuat && <div><button type="button" className="xv-btn" style={{ padding: '1px 7px' }} title={v.doi_chieu.mo_ta_de_xuat}
                        onClick={async () => { await luuNhanVat({ id: v.id, phim_id: v.phim_id, loai: v.loai, ten: v.ten, mo_ta: v.doi_chieu!.mo_ta_de_xuat, anh_ref: v.anh_ref, giong: v.giong }); await onChanged(); }}>↳ Dùng mô tả viết theo ảnh</button></div>}
                    </div>)}
                <Loi>{loi[v.id] || (!dangSinh.nhanVat.includes(v.id) ? loiAnh.nhanVat[v.id] : '')}</Loi>
              </div>
            </div>
            {(v.anh_ref.length > 1 || !!v.bien_the?.length) && (
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                {v.anh_ref.length > 1 && v.anh_ref.map((u, i) => (
                  <AnhNho key={u} url={u} kich={34} vien={i === 0 ? 'var(--cyan)' : undefined} nhan={i === 0 ? 'chính' : undefined}
                    title={i === 0 ? 'ảnh chính (thẻ + tham chiếu ưu tiên khi sinh cảnh)' : 'bấm để đặt làm ảnh chính'}
                    onClick={i ? async () => { await datAnhChinh(v.id, u); await onChanged(); } : undefined}
                    onXoa={async () => { await xoaAnhGoc(v.id, u); await onChanged(); }} />
                ))}
                {v.anh_ref.length > 1 && !!v.bien_the?.length && <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--line)', margin: '0 3px' }} />}
                {(v.bien_the ?? []).slice(0, 14).map((b) => b.anh_url
                  ? <AnhNho key={b.id} url={b.anh_url} kich={24} title={`${nhanNhom(v.loai, b.nhom)}: ${b.ten}`} onClick={() => setBtMo(v.id)} />
                  : <span key={b.id} title={`${nhanNhom(v.loai, b.nhom)}: ${b.ten} — chưa có ảnh`} onClick={() => setBtMo(v.id)}
                      style={{ cursor: 'pointer', fontSize: 9.5, lineHeight: '15px', padding: '0 5px', borderRadius: 4, border: `1px solid ${dangSinh.bienThe.includes(b.id) ? 'var(--violet)' : 'var(--line)'}`, color: dangSinh.bienThe.includes(b.id) ? 'var(--violet)' : 'var(--fg-3)', whiteSpace: 'nowrap', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {dangSinh.bienThe.includes(b.id) ? '⏳ ' : ''}{b.ten}
                    </span>)}
                {(v.bien_the?.length ?? 0) > 14 && <span style={{ ...mono, fontSize: 9.5 }} onClick={() => setBtMo(v.id)}>+{v.bien_the!.length - 14}</span>}
              </div>
            )}
          </div>
          );
        })}
      </div>
      {btMo != null && nhanVat.find((v) => v.id === btMo) && <BienTheDrawer a={nhanVat.find((v) => v.id === btMo)!} khoa={khoa} kt={kt} dangSinh={dangSinh.bienThe} loiBt={loiAnh.bienThe} onClose={() => setBtMo(null)} onChanged={onChanged} />}
      {sua && <NhanVatForm phimId={phimId} goc={sua} onClose={() => setSua(null)} onSaved={async () => { setSua(null); await onChanged(); }} />}
    </div>
  );
}

function BienTheDrawer({ a, khoa, kt, dangSinh, loiBt, onClose, onChanged }: { a: NhanVat; khoa: Khoa; kt: Required<KinhThanh>; dangSinh: number[]; loiBt: Record<number, string>; onClose: () => void; onChanged: () => Promise<void> }) {
  const nhom = NHOM_BIEN_THE[a.loai] ?? NHOM_BIEN_THE.nhan_vat;
  const [f, setF] = useState({ nhom: nhom[0]!.key, ten: '', mo_ta: '' });
  const [ban, setBan] = useState<string | null>(null);
  const [loi, setLoi] = useState('');
  const chay = async (k: string, fn: () => Promise<{ ok: boolean; loi?: string } | void>) => {
    setBan(k); setLoi('');
    try { const r = await fn(); if (r && !r.ok) setLoi(r.loi ?? 'lỗi'); } catch (e) { setLoi(`Không gọi được máy chủ (${e instanceof Error ? e.message.slice(0, 80) : 'lỗi mạng'}) — studio vừa cập nhật thì bấm ↻ Tải lại.`); } finally { setBan(null); }
    await onChanged();
  };
  const ds = a.bien_the ?? [];
  const chuaAnh = ds.filter((b) => !b.anh_url);
  const coKhoaAnh = khoa.google || khoa.openai;
  const lyAnh = (!coKhoaAnh && 'thiếu khoá ảnh') || (!a.anh_ref.length && 'anchor chưa có ảnh gốc — Sinh ảnh gốc trước');
  return (
    <Ngan onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>🎭 Biến thể · {a.ten}</h2>
        <Pill color="var(--fg-3)">{LOAI_NHAN_VAT.find((l) => l.key === a.loai)?.label ?? a.loai}</Pill>
        <span style={{ flex: 1 }} />
        <button type="button" className="xv-btn" onClick={onClose}>Đóng</button>
      </div>
      <div style={{ ...mono, marginBottom: 10, lineHeight: 1.6 }}>
        Ảnh gốc giữ <b>danh tính</b> (ai/cái gì); biến thể chỉ đổi một thứ ({nhom.map((x) => x.label.toLowerCase()).join(', ')}). Mỗi biến thể sinh TỪ ảnh gốc nên vẫn đúng nhân vật.
        Khi tách cảnh, Claude tự gán biến thể phù hợp cho từng cảnh; keyframe dùng ảnh biến thể đó làm tham chiếu.
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        {a.anh_ref.slice(0, 3).map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" style={{ height: 80, borderRadius: 6, border: '1px solid var(--line)' }} /></a>)}
        {!a.anh_ref.length && <span className="xv-loi">Chưa có ảnh gốc — đóng lại, bấm "✨ Sinh ảnh gốc" ở thẻ anchor trước.</span>}
        <span style={{ flex: 1 }} />
        <Nut ly={!khoa.anthropic && 'thiếu ANTHROPIC_API_KEY'} ban={!!ban} title="Claude đọc kịch bản các tập → đề xuất các biến thể cảnh nào cũng cần (vd cảnh khóc → biểu cảm buồn; cảnh đêm → bối cảnh ban đêm)" onClick={() => void chay('ai', () => goiYAIBienThe(a.id))}>{ban === 'ai' ? '… AI đang đề xuất' : '✨ AI đề xuất biến thể theo kịch bản'}</Nut>
        <Nut chinh ly={lyAnh || (chuaAnh.length === 0 && 'mọi biến thể đã có ảnh')} ban={!!ban} title={`${chuaAnh.length} ảnh ≈ ${tien(chuaAnh.length * giaAnhCents(kt.mo_hinh_anh))}`}
          onClick={() => void chay('all', async () => { for (const b of chuaAnh) { const r = await sinhAnhBienThe(b.id); if (!r.ok) return r; } })}>
          {ban === 'all' ? '… đang xếp hàng' : `🖼 Sinh ảnh ${chuaAnh.length} biến thể chưa có (chạy nền, 4 ảnh song song)`}
        </Nut>
      </div>
      <Loi>{loi}</Loi>
      {nhom.map((g) => {
        const nh = ds.filter((b) => b.nhom === g.key);
        return (
          <div key={g.key} className="xv-panel" style={{ padding: 10 }}>
            <h3 style={{ marginBottom: 6 }}>{g.label}<small>{nh.length}</small></h3>
            {nh.length === 0 && <div style={mono}>chưa có</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
              {nh.map((b) => <BienTheThe key={b.id} b={b} ly={lyAnh} dang={dangSinh.includes(b.id)} loiAnh={dangSinh.includes(b.id) ? '' : loiBt[b.id]} ban={ban === `x${b.id}`} chay={chay} />)}
            </div>
          </div>
        );
      })}
      <div className="xv-panel" style={{ padding: 10 }}>
        <h3>Thêm biến thể</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <O label="Nhóm"><Seg options={nhom.map((x) => ({ value: x.key, label: x.label }))} value={f.nhom} onChange={(v) => setF({ ...f, nhom: v })} /></O>
          <O label="Tên"><input className="xv-in" value={f.ten} onChange={(e) => setF({ ...f, ten: e.target.value })} placeholder="vui · buồn · đồ mùa đông · góc cao · ban đêm" style={{ minWidth: 200 }} /></O>
          <O label="Thay đổi gì (tiếng Anh tốt hơn)"><input className="xv-in" value={f.mo_ta} onChange={(e) => setF({ ...f, mo_ta: e.target.value })} placeholder="crying, tears on cheeks, ears drooping" style={{ minWidth: 320 }} /></O>
          <div className="xv-field"><Nut chinh ly={!f.ten.trim() && 'nhập tên'} ban={!!ban} onClick={() => void chay('them', async () => { const r = await luuBienThe({ nhan_vat_id: a.id, ...f }); if (r.ok) setF({ ...f, ten: '', mo_ta: '' }); return r; })}>+ Thêm</Nut></div>
        </div>
      </div>
    </Ngan>
  );
}

function BienTheThe({ b, ly, dang, loiAnh, ban, chay }: { b: BienThe; ly: string | false; dang: boolean; loiAnh?: string; ban: boolean; chay: (k: string, fn: () => Promise<{ ok: boolean; loi?: string } | void>) => Promise<void> }) {
  const [sua, setSua] = useState(false);
  const [f, setF] = useState({ ten: b.ten, mo_ta: b.mo_ta });
  return (
    <div className="xv-canh" style={{ display: 'flex', gap: 8 }}>
      <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0, borderRadius: 6, overflow: 'hidden' }}>
        {b.anh_url ? <AnhNho url={b.anh_url} kich={64} onClick={() => window.open(b.anh_url!, '_blank')} onXoa={() => chay(`xa${b.id}`, () => xoaAnhBienThe(b.id))} />
          : <div style={{ width: 64, height: 64, background: 'var(--bg-2)', display: 'grid', placeItems: 'center', color: 'var(--fg-4)', fontSize: 10 }}>chưa ảnh</div>}
        {dang && <DangSinh chu="" />}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        {sua ? (
          <>
            <input className="xv-in" value={f.ten} onChange={(e) => setF({ ...f, ten: e.target.value })} style={{ marginBottom: 4 }} />
            <textarea className="xv-ta" rows={2} value={f.mo_ta} onChange={(e) => setF({ ...f, mo_ta: e.target.value })} />
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <Nut chinh ban={ban} onClick={() => void chay(`b${b.id}`, async () => { const r = await luuBienThe({ id: b.id, nhan_vat_id: b.nhan_vat_id, nhom: b.nhom, ...f }); setSua(false); return r; })}>Lưu</Nut>
              <button type="button" className="xv-btn" onClick={() => setSua(false)}>Huỷ</button>
            </div>
          </>
        ) : (
          <>
            <strong style={{ fontSize: 12 }}>{b.ten}</strong>
            <div style={{ fontSize: 10.5, color: 'var(--fg-3)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={b.mo_ta}>{b.mo_ta}</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
              <Nut ly={ly} ban={dang} onClick={() => void chay(`b${b.id}`, () => sinhAnhBienThe(b.id))}>{dang ? '… đang sinh' : b.anh_url ? '↻' : '🖼 Sinh'}</Nut>
              <button type="button" className="xv-btn" onClick={() => setSua(true)}>Sửa</button>
              <Xoa nhan="biến thể" ban={ban} onXoa={() => chay(`x${b.id}`, () => xoaBienThe(b.id))} />
            </div>
            {loiAnh && <div className="xv-loi" title={loiAnh}>{loiAnh.slice(0, 140)}</div>}
          </>
        )}
      </div>
    </div>
  );
}

function NhanVatForm({ phimId, goc, onClose, onSaved }: { phimId: number; goc: Partial<NhanVat>; onClose: () => void; onSaved: () => Promise<void> }) {
  const [f, setF] = useState({ loai: (goc.loai ?? 'nhan_vat') as LoaiNhanVat, ten: goc.ten ?? '', mo_ta: goc.mo_ta ?? '', anh_ref: goc.anh_ref ?? [], giong: goc.giong ?? '' });
  const [loi, setLoi] = useState('');
  const [luu, setLuu] = useState(false);
  const [ai, setAi] = useState(false);
  const goiY = async () => { setAi(true); setLoi(''); const r = await goiYAIAnchor(phimId, { loai: f.loai, ten: f.ten, mo_ta: f.mo_ta }); setAi(false); if (!r.ok) { setLoi(r.loi); return; } setF((x) => ({ ...x, mo_ta: r.data.mo_ta, giong: r.data.giong || x.giong })); };
  return (
    <Ngan onClose={onClose} nho>
      <h3 style={{ marginTop: 0 }}>{goc.id ? `Sửa: ${goc.ten}` : 'Thêm anchor'}</h3>
      <O label="Loại"><Seg options={LOAI_NHAN_VAT.map((l) => ({ value: l.key, label: l.label }))} value={f.loai} onChange={(v) => setF({ ...f, loai: v })} /></O>
      <O label="Tên *" hint="Claude dùng đúng tên này khi ghi nhân vật của từng cảnh"><input className="xv-in" value={f.ten} onChange={(e) => setF({ ...f, ten: e.target.value })} placeholder="Timo (rùa) · Áo bra X · Khu rừng Thì Thầm" /></O>
      <O label="Đặc tính cố định" hint="Mọi thứ phải GIỐNG NHAU ở mọi cảnh: ngoại hình, màu, trang phục, tỉ lệ, chất liệu, tính cách. Càng cụ thể model càng ít bịa.">
        <textarea className="xv-ta" rows={5} value={f.mo_ta} onChange={(e) => setF({ ...f, mo_ta: e.target.value })} placeholder="Rùa con 8 tuổi, mai xanh rêu có vân lục giác, mắt to nâu, đeo khăn quàng đỏ, tính điềm tĩnh, đi chậm nhưng chắc…" />
        <div style={{ marginTop: 4 }}><Nut ly={!f.ten.trim() && 'đặt tên trước'} ban={ai} title="Claude đọc phong cách + các anchor khác của phim → tả đặc tính khớp, không đụng nhân vật đã có" onClick={() => void goiY()}>{ai ? '… AI đang tả' : '✨ AI tả đặc tính (theo phong cách + tuyến đã có)'}</Nut></div>
      </O>
      {f.loai === 'nhan_vat' && <O label="Giọng (cho lồng tiếng sau này)"><input className="xv-in" value={f.giong} onChange={(e) => setF({ ...f, giong: e.target.value })} placeholder="giọng trẻ con ấm, chậm rãi" /></O>}
      <O label={f.loai === 'san_pham' ? 'Ảnh sản phẩm THẬT (quảng cáo phải đúng hàng) — dán Ctrl+V, nút Dán (điện thoại), kéo thả, chọn file, hoặc URL' : 'Ảnh tham chiếu — dán / kéo thả / file / URL, hoặc lưu rồi bấm “Sinh ảnh gốc”'}>
        <ImageAttach value={f.anh_ref} onChange={(urls) => setF({ ...f, anh_ref: urls })} max={10} nhanBo="Bỏ ảnh khỏi anchor"
          upload={async (du) => { const r = await taiAnhLen(du); return r.ok ? { ok: true, url: r.data } : { ok: false, error: r.loi }; }} />
      </O>
      <Loi>{loi}</Loi>
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        <Nut ly={!f.ten.trim() && 'thiếu tên'} ban={luu} chinh onClick={async () => {
          setLuu(true); setLoi('');
          const r = await luuNhanVat({ id: goc.id, phim_id: phimId, ...f });
          setLuu(false);
          if (!r.ok) { setLoi(r.loi); return; }
          await onSaved();
        }}>Lưu</Nut>
        <button type="button" className="xv-btn" onClick={onClose}>Đóng</button>
      </div>
    </Ngan>
  );
}

// ── Tập: kịch bản + storyboard ───────────────────────────────────────────────────────────────────────────────────

function TapView({ tap, phim, nhanVat, khoa, onChanged }: { tap: Tap; phim: Phim; nhanVat: NhanVat[]; khoa: Khoa; onChanged: () => Promise<void> }) {
  const [kichBan, setKichBan] = useState(tap.kich_ban);
  const [tenTap, setTenTap] = useState(tap.ten);
  const [brief, setBrief] = useState(tap.brief);
  const [thoiLuong, setThoiLuong] = useState(tap.thoi_luong_s ?? thoiLuongMacDinh(phim.loai));
  // Nhánh hook đang xem (A/B/C) — thân chung + hook của nhánh; bản xuất cũng theo nhánh.
  const [nhanh, setNhanh] = useState<string | null>(null);
  // Bản xuất đang dựng (job id) — hỏi máy chủ 5s/lần tới khi xong rồi tải lại tập để danh sách bản xuất hiện tệp mới.
  const [jobXuat, setJobXuat] = useState<number | null>(null);
  const [loiXuat, setLoiXuat] = useState('');
  useEffect(() => {
    if (jobXuat == null) return;
    const t = setInterval(async () => { const r = await trangThaiXuat(jobXuat); if (r.trang_thai === 'cho') return; setJobXuat(null); if (r.trang_thai === 'loi') setLoiXuat(r.loi || 'xuất lỗi'); else { setLoiXuat(r.loi ? `Đã xuất, ${r.loi}` : ''); await onChanged(); } }, 5000);
    return () => clearInterval(t);
  }, [jobXuat]); // eslint-disable-line react-hooks/exhaustive-deps
  const [soCanh, setSoCanh] = useState(0);
  const [canh, setCanh] = useState<Canh[] | null>(null);
  // Bận theo TỪNG nút (không một khoá chung): bấm keyframe cảnh 2 không khoá nút cảnh 3, 4… — chỉ Tách cảnh mới khoá cả tập.
  const [banSet, setBanSet] = useState<ReadonlySet<string>>(new Set());
  const ban = (k: string) => banSet.has(k);
  const banTach = banSet.has('tach');
  const [loi, setLoi] = useState('');
  const [animatic, setAnimatic] = useState(false);
  // 3c xem dạng timeline (mặc định, kiểu CapCut) hoặc danh sách; nhớ theo trình duyệt.
  const [xem, setXem] = useState<'timeline' | 'ds'>(() => { try { return (localStorage.getItem('xv-xem-3c') as 'timeline' | 'ds') || 'timeline'; } catch { return 'timeline'; } });
  useEffect(() => { try { localStorage.setItem('xv-xem-3c', xem); } catch { /* bỏ qua */ } }, [xem]);
  const [chonCanh, setChonCanh] = useState<number | null>(null);
  const [uoc, setUoc] = useState<{ anh1: number; videoTong: number; soCanhDuyet: number; giayDuyet: number } | null>(null);
  const [uocA, setUocA] = useState<Awaited<ReturnType<typeof uocAm>> | null>(null);
  const [mhNhac, setMhNhac] = useState('cassetteai/music-generator');
  const [loiUoc, setLoiUoc] = useState('');
  const kt = docKinhThanh(phim.kinh_thanh);
  const thieuSp = thieuQc(phim.loai, kt);
  // Dấu vân của danh sách cảnh: đổi (sinh xong keyframe/video, duyệt, thêm/bớt cảnh) → báo phim tải lại để chip thống kê
  // đầu phim chạy theo thời gian thực (card #1191). So dấu chứ không báo mỗi lần hỏi, để không tải phim vô ích mỗi 4 giây.
  const dauCanh = useRef('');
  const taiCanh = useCallback(async () => {
    const ds = await dsCanh(tap.id);
    setCanh(ds); setUoc(await uocTien(tap.id));
    // Giá âm thanh nạp riêng (lần đầu phải đọc danh mục giọng fal, chậm) — không bắt danh sách cảnh hay dòng nút âm thanh chờ nó.
    void uocAm(tap.id).then((u) => { setUocA(u); setLoiUoc(''); }).catch((e) => setLoiUoc(`Không tính được giá âm thanh: ${e instanceof Error ? e.message : String(e)}`));
    const dau = ds.map((c) => `${c.id}:${c.trang_thai}:${c.keyframe_uv.length}:${c.video_url ? 1 : 0}:${c.video_cuoi_url ? 1 : 0}:${c.thoi_luong_s}:${c.chi_phi_cents}`).join('|');
    if (dauCanh.current && dau !== dauCanh.current) void onChanged();
    dauCanh.current = dau;
  }, [tap.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void taiCanh(); }, [taiCanh]);
  useEffect(() => { setKichBan(tap.kich_ban); setTenTap(tap.ten); setBrief(tap.brief); }, [tap.kich_ban, tap.ten, tap.brief]);

  // Poll Veo khi có cảnh đang sinh (Veo chạy 1-3 phút). Dừng ngay khi không còn job chạy.
  const dangSinh = (canh ?? []).some((c) => c.trang_thai === 'dang_sinh');
  const dangSinhAnh = (canh ?? []).some((c) => c.dang_sinh_anh || c.dang_sinh_am) || (uocA?.dangNhac ?? 0) > 0;
  // Nhạc sinh xong không đổi danh sách cảnh → phải tự báo phim tải lại thì khối nhạc mới hiện file (không bắt F5).
  const dangNhacTruoc = useRef(0);
  useEffect(() => { const n = uocA?.dangNhac ?? 0; if (dangNhacTruoc.current > 0 && n < dangNhacTruoc.current) void onChanged(); dangNhacTruoc.current = n; }, [uocA?.dangNhac]); // eslint-disable-line react-hooks/exhaustive-deps
  // Thời gian thực: có việc ảnh đang chạy → hỏi lại 4s/lần; không có → 15s/lần (bấm ở tab khác / Worker xong muộn vẫn tự hiện). Tab ẩn thì thôi.
  useEffect(() => { if (banTach) return; const t = setInterval(() => { if (document.visibilityState === 'visible') void taiCanh(); }, dangSinhAnh ? 4000 : 15000); return () => clearInterval(t); }, [dangSinhAnh, banTach, taiCanh]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!dangSinh) { if (pollRef.current) clearInterval(pollRef.current); pollRef.current = null; return; }
    pollRef.current = setInterval(async () => { const r = await kiemVideo(tap.id); if (r.vuaXong || r.conChay === 0) await taiCanh(); }, 10_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [dangSinh, tap.id, taiCanh]);

  const chay = async (ten: string, fn: () => Promise<KqChay>) => {
    setBanSet((s) => new Set(s).add(ten)); setLoi('');
    try { const r = await fn(); if (r && !r.ok) setLoi(r.loi ?? 'lỗi'); } catch (e) { setLoi(`Không gọi được máy chủ (${e instanceof Error ? e.message.slice(0, 80) : 'lỗi mạng'}) — studio vừa cập nhật thì bấm ↻ Tải lại.`); } finally { setBanSet((s) => { const n = new Set(s); n.delete(ten); return n; }); }
    await taiCanh(); await onChanged();
  };
  const kbDirty = kichBan !== tap.kich_ban || tenTap !== tap.ten || brief !== tap.brief;
  const soDuyet = (canh ?? []).filter((c) => c.trang_thai === 'duyet').length;
  const chuaKeyframe = (canh ?? []).filter((c) => !c.keyframe_url).length;
  const sanSang = (canh ?? []).filter((c) => !c.keyframe_url && thanhPhanCanh(c, nhanVat).thieu.length === 0);
  const kemThieu = chuaKeyframe - sanSang.length;

  return (
    <div>
      {/* Thứ tự theo mạch, trái → phải rồi xuống: 3a brief → 3b kịch bản → 3c storyboard. */}
      {phim.loai === 'phim' && <O label="Tên tập"><input className="xv-in" value={tenTap} onChange={(e) => setTenTap(e.target.value)} placeholder="Cuộc đua bắt đầu" style={{ maxWidth: 420 }} /></O>}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 2fr) minmax(320px, 3fr)', gap: 12, alignItems: 'start' }}>
        <div>
          <O label={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>3a · Brief (ý tưởng tập này) <Nut ly={(!khoa.anthropic && 'thiếu ANTHROPIC_API_KEY') || thieuSp} ban={banTach || ban('brief')} title="Claude đọc tiền đề + tuyến nhân vật + tóm tắt các tập trước → gợi ý brief cho tập này" onClick={() => void chay('brief', async () => { const r = await goiYAIBrief(tap.id, thoiLuong); if (r.ok) setBrief(r.data); return r; })}>{ban('brief') ? '… AI' : '✨ AI gợi ý brief'}</Nut></span>}
            hint="Bỏ qua nếu đã có kịch bản sẵn — dán thẳng vào ô 3b bên phải.">
            <textarea className="xv-ta" rows={12} value={brief} onChange={(e) => setBrief(e.target.value)} onBlur={() => { if (brief !== tap.brief) void suaTap(tap.id, { brief }).then(onChanged); }}
              placeholder={phim.loai === 'quang_cao' ? 'Sản phẩm, điểm bán chính, khách mục tiêu, hook mở đầu, CTA…' : phim.loai === 'phim' ? 'Tập này kể gì, xung đột, kết tập mở ra tập sau…' : 'Ý tưởng, hook 3 giây đầu, twist, CTA…'} />
          </O>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="xv-in" type="number" min={8} max={300} value={thoiLuong} onChange={(e) => setThoiLuong(Number(e.target.value) || 30)} style={{ width: 70 }} title="tổng giây" />
            <span style={mono}>giây</span>
            <Nut ly={(!khoa.anthropic && 'thiếu ANTHROPIC_API_KEY') || thieuSp || (!brief.trim() && 'viết brief trước')} ban={banTach || ban('viet')} title="Viết kịch bản từ brief → điền sang ô 3b"
              onClick={() => void chay('viet', async () => { const r = await vietKichBanTap(tap.id, brief, thoiLuong); if (r.ok) setKichBan(r.data); return r; })}>
              {ban('viet') ? '… đang viết' : '✍ Claude viết kịch bản →'}
            </Nut>
          </div>
        </div>
        <div>
          <O label="3b · Kịch bản"><textarea className="xv-ta" rows={12} value={kichBan} onChange={(e) => setKichBan(e.target.value)} placeholder={'Dán kịch bản, hoặc viết brief ở 3a rồi bấm "Claude viết kịch bản".\nCảnh 1: … \nCảnh 2: …'} /></O>
          {tap.tom_tat && <div style={{ ...mono, marginTop: -4, marginBottom: 6 }}>Tóm tắt (tập sau đọc): {tap.tom_tat}</div>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <Nut ly={!kbDirty && 'chưa sửa'} ban={banTach || ban('luu')} onClick={() => void chay('luu', async () => { await suaTap(tap.id, { kich_ban: kichBan, ten: tenTap, brief }); })}>Lưu brief + kịch bản</Nut>
            <span style={{ flex: 1 }} />
            <input className="xv-in" type="number" min={0} max={40} value={soCanh || ''} onChange={(e) => setSoCanh(Number(e.target.value) || 0)} placeholder="số cảnh (tự)" style={{ width: 110 }} />
            <Nut chinh ly={(!khoa.anthropic && 'thiếu ANTHROPIC_API_KEY') || (!kichBan.trim() && 'chưa có kịch bản')} ban={banTach || ban('tach')}
              title="Claude đọc kịch bản + anchor + biến thể → bảng cảnh 3c bên dưới. Cảnh đã có keyframe giữ nguyên."
              onClick={() => void chay('tach', async () => { if (kbDirty) await suaTap(tap.id, { kich_ban: kichBan, ten: tenTap, brief }); return tachCanhTap(tap.id, soCanh, thoiLuong); })}>
              {ban('tach') ? '… Claude đang tách' : '✂ Tách cảnh ↓'}
            </Nut>
          </div>
        </div>
      </div>
      <div style={{ ...mono, marginTop: 8, lineHeight: 1.6 }}>
        Mạch: 3a brief → 3b kịch bản → <b>Tách cảnh</b> → 3c storyboard: <b>Sinh keyframe</b> ({tien(giaAnhCents(kt.mo_hinh_anh))}/ảnh) → chọn + <b>Duyệt</b> → <b>Sinh video</b> ({tien(giaVideoCents(kt.mo_hinh_video, kt.do_phan_giai, 8))}/8s).
        {uoc && uoc.soCanhDuyet > 0 && <span style={{ color: 'var(--amber)' }}> · Đang chờ sinh video: {uoc.soCanhDuyet} cảnh · {uoc.giayDuyet}s ≈ {tien(uoc.videoTong)}</span>}
      </div>
      <Loi>{loi}</Loi>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 12 }}>3c · Storyboard · {canh?.length ?? '…'} cảnh{canh?.length ? ` · phát ${Math.round(locNhanh(canh, nhanh).reduce((a, c) => a + giayPhat(c), 0) * 10) / 10}s` : ''}</strong>
        {!!canh?.length && cacNhanh(canh).length > 0 && (
          <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }} title="Cùng một thân, nhiều hook để A/B trên Meta/TikTok — chọn nhánh để xem / xuất">
            <span style={mono}>hook:</span>
            {cacNhanh(canh).map((h) => <button key={h} type="button" className={`xv-btn${(nhanh ?? cacNhanh(canh)[0]) === h ? ' chinh' : ''}`} style={{ padding: '1px 7px' }} onClick={() => setNhanh(h)}>{h}</button>)}
          </span>
        )}
        <Nut ly={!(canh ?? []).some((c) => c.keyframe_url) && 'chưa có keyframe nào'} title="Xem cả tập từ keyframe (và clip đã có): đúng thứ tự, đúng số giây, có zoom nhẹ + lời thoại. Không tốn tiền." onClick={() => setAnimatic(true)}>▶ Xem animatic (0đ)</Nut>
        <label style={{ ...mono, display: 'inline-flex', gap: 4, alignItems: 'center', cursor: 'pointer' }} title="Khung cuối của mỗi clip = keyframe cảnh kế → các clip nối liền mạch; bản cuối sinh lại cũng giữ đúng hai đầu">
          <input type="checkbox" checked={tap.noi_khung} onChange={(e) => void chay('noi', async () => { await suaTap(tap.id, { noi_khung: e.target.checked }); })} /> Nối khung (khung cuối = keyframe cảnh sau)
        </label>
        <span style={{ flex: 1 }} />
        <Nut ly={(!khoa.google && !khoa.openai && 'thiếu GOOGLE_API_KEY/OPENAI_API_KEY') || ((canh?.length ?? 0) === 0 && 'chưa có cảnh — bấm ✂ Tách cảnh trước') || (chuaKeyframe === 0 && 'mọi cảnh đã có keyframe') || (sanSang.length === 0 && `${kemThieu} cảnh còn thiếu thành phần (ảnh gốc/biến thể) — chuẩn bị ở mục 2`)} ban={banTach || ban('kf-all')}
          title={`Sinh 1 keyframe cho mỗi cảnh đủ thành phần (${sanSang.length} cảnh ≈ ${tien(sanSang.length * giaAnhCents(kt.mo_hinh_anh))})`}
          gia={sanSang.length * giaAnhCents(kt.mo_hinh_anh)} onClick={() => void chay('kf-all', async () => { for (const c of sanSang) { const r = await sinhKeyframe(c.id, 1); if (!r.ok) return r; } })}>
          {ban('kf-all') ? '… đang sinh ảnh' : `🖼 Sinh keyframe ${sanSang.length} cảnh sẵn sàng${kemThieu ? ` (${kemThieu} cảnh còn thiếu thành phần)` : ''}`}
        </Nut>
        <Nut chinh ly={(!khoa.google && !khoa.fal && 'thiếu khoá video (GOOGLE_API_KEY/FAL_KEY)') || ((canh?.length ?? 0) === 0 && 'chưa có cảnh — bấm ✂ Tách cảnh trước') || (soDuyet === 0 && 'chưa có cảnh nào được duyệt keyframe')} ban={banTach || ban('vid-all')}
          title={uoc ? `Veo: ${uoc.soCanhDuyet} cảnh · ${uoc.giayDuyet}s ≈ ${tien(uoc.videoTong)} — trừ vào khoá Google` : ''}
          gia={uoc?.videoTong} onClick={() => void chay('vid-all', async () => { for (const c of (canh ?? []).filter((x) => x.trang_thai === 'duyet')) { const r = await sinhVideoCanh(c.id); if (!r.ok) return r; } })}>
          {ban('vid-all') ? '… đang gửi Veo' : `🎬 Sinh video ${soDuyet} cảnh đã duyệt${uoc ? ` (≈ ${tien(uoc.videoTong)})` : ''}`}
        </Nut>
        <button type="button" className="xv-btn" disabled={banTach || ban('them')} onClick={() => void chay('them', async () => { await themCanh(tap.id); })}>+ Cảnh</button>
        <Nut chinh ly={!(canh ?? []).some((c) => c.video_url || c.video_cuoi_url || c.keyframe_url) && 'chưa có clip/keyframe nào'} ban={jobXuat != null}
          title="Dựng MP4 hoàn chỉnh trên máy chủ (0đ): nối clip theo giây phát, giọng + hiệu ứng + nhạc, chữ màn, phụ đề, end card ưu đãi, chuẩn âm -14 LUFS, 1080p. Shot chưa có clip dùng keyframe tĩnh."
          onClick={async () => { setLoiXuat(''); const r = await xuatTap(tap.id, nhanh ?? cacNhanh(canh ?? [])[0] ?? null); if (!r.ok) setLoiXuat(r.loi); else setJobXuat(r.data); }}>
          {jobXuat != null ? '… đang dựng bản xuất (30–90s)' : `⬇ Xuất MP4${cacNhanh(canh ?? []).length ? ` · hook ${nhanh ?? cacNhanh(canh ?? [])[0]}` : ''}`}
        </Nut>
      </div>
      <Loi>{loiXuat}</Loi>
      {tap.xuat.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
          <span style={mono}>Bản xuất:</span>
          {tap.xuat.slice().reverse().slice(0, 6).map((b) => (
            <a key={b.url} href={b.url} target="_blank" rel="noreferrer" className="xv-btn" style={{ textDecoration: 'none' }} title={`${b.giay}s · ${gioVN(b.luc)}`}>🎬 {b.nhanh ? `hook ${b.nhanh}` : 'bản'} · {b.giay}s · {gioVN(b.luc, { chiGio: true })}</a>
          ))}
        </div>
      )}
      {/* Bộ kiểm "đạt chưa" (0đ, tức thì): quảng cáo chấm hook/sản phẩm/bằng chứng/CTA/tốc độ nói; mọi loại chấm độ dài so với mục tiêu. */}
      {!!canh?.length && (() => {
        const ds = kiemQc({ loai: phim.loai, canh, nhanVat, qc: kt.qc, mucTieuS: tap.thoi_luong_s ?? thoiLuong, nhanh });
        if (!ds.length) return null;
        const hong = ds.filter((x) => !x.ok).length;
        return (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }} title="Mỗi mục là một thứ quảng cáo thật đo được — đỏ thì sửa shot (form cảnh / kéo mép / ＋ đối tượng) hoặc tách lại">
            <span style={{ ...mono, color: hong ? 'var(--amber)' : 'var(--lime)' }}>{hong ? `${hong} mục chưa đạt` : '✓ đạt bộ kiểm'}</span>
            {ds.map((x) => <span key={x.key} title={x.chiTiet ?? x.chu} style={{ fontSize: 10.5, padding: '1px 7px', borderRadius: 999, border: `1px solid ${x.ok ? 'var(--lime)' : 'var(--red)'}`, color: x.ok ? 'var(--lime)' : 'var(--red)', cursor: x.chiTiet ? 'help' : 'default' }}>{x.ok ? '✓' : '✗'} {x.chu}</span>)}
          </div>
        );
      })()}
      {!!canh?.length && (() => {
        const u = uocA ?? { dangPhanDoan: [] as string[], dangCaTap: false, giong: 0, soThoai: canh.filter((c) => c.loi_thoai.trim()).length, sfx: 0, soSfx: canh.length, nhac: {} as Record<string, number>, giay: canh.reduce((a, c) => a + (c.thoi_luong_s || 5), 0), soPhanCanh: new Set(canh.map((c) => c.phan_doan).filter(Boolean)).size, dangNhac: 0 };
        const gia = (c: number) => (uocA ? tien(c) : '…');
        const nvNoi = nhanVat.filter((v) => v.loai === 'nhan_vat');
        return (
        <div className="xv-panel" style={{ marginTop: 8, padding: 10, display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <b style={{ fontSize: 12 }}>🗣 Giọng nhân vật</b><span style={mono}>(một giọng cố định cả bộ phim — bấm để chọn / nghe thử)</span>
            {nvNoi.map((v) => <span key={v.id} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><span style={{ fontSize: 11.5 }}>{v.ten}:</span><GiongNhanVat v={v} onChanged={onChanged} /></span>)}
            {!nvNoi.length && <span style={mono}>chưa có nhân vật nào ở mục 2</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ ...mono, gridColumn: '1 / -1', width: '100%', color: 'var(--fg-2)' }}>Thứ tự nên làm: <b>1.</b> chọn giọng nhân vật → sinh giọng (rẻ, làm sớm để biết độ dài thoại) · <b>2.</b> có video nháp rồi mới sinh hiệu ứng (sinh từ clip, khớp hành động) · <b>3.</b> chốt thứ tự + số giây rồi sinh nhạc theo phân cảnh. Hoặc bấm <b>＋</b> trên từng khối nét đứt ở timeline.</div>
          <b style={{ fontSize: 12 }}>🔊 Âm thanh</b>

          <Nut ly={(!khoa.fal && 'thiếu FAL_KEY') || (!u.soThoai && 'chưa shot nào có lời thoại')} ban={ban('giong')} gia={uocA ? u.giong : undefined} title="Đọc lời thoại mọi shot bằng giọng cố định của từng nhân vật (chọn ở mục 2), cảm xúc theo shot" onClick={() => void chay('giong', () => sinhGiong(tap.id))}>🗣 Sinh giọng {u.soThoai} shot · {gia(u.giong)}</Nut>
          <Nut ly={(!khoa.fal && 'thiếu FAL_KEY') || (!u.soSfx && 'chưa shot nào có clip hay mô tả âm thanh')} ban={ban('sfx')} gia={uocA ? u.sfx : undefined} title="Shot có clip → sinh tiếng từ chính clip (khớp hành động); chưa có clip → từ mô tả âm thanh + kỹ thuật âm thanh của shot" onClick={() => void chay('sfx', () => sinhAmThanh(tap.id))}>🔊 Sinh hiệu ứng {u.soSfx} shot · {gia(u.sfx)}</Nut>
          <Chon nho value={mhNhac} onChange={setMhNhac} minWidth={200} title="Model nhạc" options={MO_HINH_AM.filter((m) => m.loai === 'nhac').map((m) => ({ value: m.key, label: m.ten, phu: `${tien(m.gia)}/phút`, title: m.ghiChu }))} />
          <Nut ly={(!khoa.fal && 'thiếu FAL_KEY') || (!u.soPhanCanh && 'chưa có phân cảnh — tách lại cảnh')} ban={ban('nhac')} gia={uocA ? u.nhac[mhNhac] : undefined} title="Mỗi phân cảnh một đoạn nhạc riêng: dài bằng phân cảnh, theo cảm xúc đầu→cuối + nhịp + kỹ thuật nhạc của các shot" onClick={() => void chay('nhac', () => sinhNhac(tap.id, mhNhac, '*'))}>🎵 Nhạc theo {u.soPhanCanh} phân cảnh · {gia(u.nhac[mhNhac] ?? 0)}</Nut>
          <Nut ly={!khoa.fal && 'thiếu FAL_KEY'} ban={ban('nhac1')} gia={uocA ? u.nhac[mhNhac] : undefined} title="Một bài nền chạy suốt cả tập" onClick={() => void chay('nhac1', () => sinhNhac(tap.id, mhNhac))}>🎵 Một bài cả tập ({u.giay}s)</Nut>
          {u.dangNhac > 0 && <span style={{ ...mono, color: 'var(--violet)' }}>⏳ đang sinh {u.dangNhac} đoạn âm…</span>}
          {loiUoc && <span className="xv-loi">{loiUoc}</span>}
        </div>
        </div>
        );
      })()}

      {canh === null ? <span style={mono}>…</span> : canh.length === 0 ? (
        <div className="xv-panel" style={{ marginTop: 8, textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Chưa có cảnh nào</div>
          <div style={{ ...mono, marginBottom: 12 }}>Bước 1 của mạch: Claude đọc kịch bản + tuyến nhân vật → chia thành cảnh (góc máy, hành động, lời thoại, prompt ảnh/video). Sau đó mới sinh keyframe → duyệt → video.</div>
          <Nut chinh ly={(!khoa.anthropic && 'thiếu ANTHROPIC_API_KEY') || (!kichBan.trim() && 'ô Kịch bản bên trái đang trống — dán kịch bản hoặc bấm Claude viết kịch bản')} ban={banTach || ban('tach')}
            onClick={() => void chay('tach', async () => { if (kbDirty) await suaTap(tap.id, { kich_ban: kichBan, ten: tenTap, brief }); return tachCanhTap(tap.id, soCanh, thoiLuong); })}>
            {ban('tach') ? '… Claude đang tách cảnh (≈20s)' : '✂ Tách cảnh bằng Claude'}
          </Nut>
          <span style={{ ...mono, marginLeft: 10 }}>hoặc <button type="button" className="xv-btn" disabled={banTach || ban('them')} onClick={() => void chay('them', async () => { await themCanh(tap.id); })}>+ Cảnh</button> tự viết</span>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            <button type="button" className={`xv-btn${xem === 'timeline' ? ' chinh' : ''}`} onClick={() => setXem('timeline')}>🎞 Timeline</button>
            <button type="button" className={`xv-btn${xem === 'ds' ? ' chinh' : ''}`} onClick={() => setXem('ds')}>☰ Danh sách cảnh</button>
          </div>
          {xem === 'timeline' ? (() => {
            const canhNhanh = locNhanh(canh, nhanh);
            const cc = canhNhanh.find((x) => x.id === chonCanh) ?? canhNhanh[0]!;
            return (
              <>
                <Timeline canh={canhNhanh} nhanVat={nhanVat} tap={tap} tiLe={kt.ti_le} ngonNgu={kt.ngon_ngu} chon={cc.id} onChon={setChonCanh} onToanManHinh={() => setAnimatic(true)}
                  // Kéo mép = đổi giây PHÁT: ngắn hơn clip là cắt (không tốn tiền); dài hơn clip thì clip phải sinh lại dài hơn.
                  onDoiGiay={(id, g) => void chay(`c${id}`, () => { const c0 = canh.find((x) => x.id === id); return suaCanh(id, { phat_s: g, ...(c0 && g > (c0.thoi_luong_s || 4) ? { thoi_luong_s: Math.ceil(g) } : {}) }); })}
                  sinh={{
                    giong: (id, tuy) => void chay(`g${id}`, () => sinhGiong(tap.id, [id], tuy)),
                    sfx: (id, tuy) => void chay(`s${id}`, () => sinhAmThanh(tap.id, [id], undefined, tuy)),
                    nhac: (pd, model, moTa) => void chay(pd ? 'nhac' : 'nhac1', () => sinhNhac(tap.id, model, pd, moTa)),
                    mhNhac, ban: (k) => banTach || ban(k), dangPhanDoan: uocA?.dangPhanDoan ?? [], dangCaTap: uocA?.dangCaTap ?? false,
                  }}
                  onXep={(ids) => { setCanh((ds) => ds && ids.map((id, i) => ({ ...ds.find((x) => x.id === id)!, thu_tu: i + 1 }))); void chay('xep', () => xepCanh(tap.id, ids)); }} />
                <div data-ngu-canh={`tập #${tap.id} ${tap.ten} · cảnh đang mở #${cc.thu_tu} (id ${cc.id}) ${cc.canh} · ${cc.trang_thai}`}>
                  <CanhRow key={cc.id} c={cc} nhanVat={nhanVat} kt={kt} khoa={khoa} phimLoai={phim.loai} ban={(k) => banTach || ban(k)} chay={chay} />
                </div>
              </>
            );
          })() : (
            <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>{canh.map((c) => <CanhRow key={c.id} c={c} nhanVat={nhanVat} kt={kt} khoa={khoa} phimLoai={phim.loai} ban={(k) => banTach || ban(k)} chay={chay} />)}</div>
          )}
        </>
      )}
      {animatic && canh && <Animatic canh={canh} tiLe={kt.ti_le} ngonNgu={kt.ngon_ngu} onClose={() => setAnimatic(false)} />}
    </div>
  );
}

// ── Animatic: xem cả tập từ keyframe (0 đồng) ──────────────────────────────────────────────────────────────────
// Mỗi cảnh: ưu tiên bản cuối → nháp → keyframe (zoom/lia nhẹ kiểu Ken Burns) trong đúng số giây; lời thoại hiện phụ đề và đọc bằng
// giọng trình duyệt (miễn phí). Mục đích: duyệt nhịp, thứ tự, độ dài TRƯỚC khi tốn tiền video.

function Animatic({ canh, tiLe, ngonNgu, onClose }: { canh: Canh[]; tiLe: string; ngonNgu: string; onClose: () => void }) {
  const ds = canh.filter((c) => c.keyframe_url || c.video_url);
  const [i, setI] = useState(0);
  const [chay, setChay] = useState(true);
  const [doc, setDoc] = useState(true);
  const [t, setT] = useState(0);
  const tong = ds.reduce((a, c) => a + (c.thoi_luong_s || 4), 0);
  const c = ds[i];
  const dai = (c?.thoi_luong_s || 4) * 1000;
  useEffect(() => { setT(0); }, [i]);
  useEffect(() => {
    if (!chay || !c) return;
    const bd = Date.now() - t;
    const id = setInterval(() => {
      const da = Date.now() - bd;
      if (da >= dai) { clearInterval(id); if (i < ds.length - 1) setI(i + 1); else setChay(false); } else setT(da);
    }, 100);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chay, i]);
  useEffect(() => {
    if (!doc || !chay || !c?.loi_thoai || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(c.loi_thoai.replace(/^[^:"“]*[:]\s*/, '').replace(/["“”]/g, ''));
    u.lang = ngonNgu === 'vi' ? 'vi-VN' : 'en-US'; u.rate = 1.05;
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    return () => window.speechSynthesis.cancel();
  }, [i, chay, doc, c?.loi_thoai, ngonNgu]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === ' ') { e.preventDefault(); setChay((x) => !x); } if (e.key === 'ArrowRight') setI((x) => Math.min(ds.length - 1, x + 1)); if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1)); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [ds.length, onClose]);
  if (!c) return null;
  const daQua = ds.slice(0, i).reduce((a, x) => a + (x.thoi_luong_s || 4), 0) + t / 1000;
  const vid = c.video_cuoi_url || c.video_url;
  const doc916 = tiLe === '9:16';
  const p = Math.min(1, t / dai);
  const kb = i % 2 === 0 ? `scale(${1 + 0.08 * p}) translate(${-1.5 * p}%, ${-1 * p}%)` : `scale(${1.08 - 0.08 * p}) translate(${1.5 * p}%, 0)`;
  return (
    <div data-animatic="" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 900, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <div style={{ position: 'relative', height: doc916 ? '78vh' : 'auto', width: doc916 ? 'calc(78vh * 9 / 16)' : 'min(92vw, 1200px)', aspectRatio: doc916 ? '9 / 16' : '16 / 9', overflow: 'hidden', borderRadius: 10, background: '#000' }}>
        {vid ? <video key={vid} src={vid} autoPlay muted={false} playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <img src={c.keyframe_url!} alt="" data-khong-phong-to="" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: kb, transition: 'transform .1s linear' }} />}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, padding: '8px 12px', background: 'linear-gradient(rgba(0,0,0,.6), transparent)', color: '#fff', fontSize: 12 }}>
          #{c.thu_tu} {c.canh} · {c.thoi_luong_s}s · {vid ? (c.video_cuoi_url ? 'bản cuối' : 'nháp') : 'keyframe'}
        </div>
        {c.loi_thoai && <div style={{ position: 'absolute', left: '6%', right: '6%', bottom: '7%', textAlign: 'center', color: '#fff', fontSize: doc916 ? 15 : 18, fontWeight: 600, textShadow: '0 2px 6px #000, 0 0 2px #000' }}>{c.loi_thoai}</div>}
      </div>
      <div style={{ width: doc916 ? 'calc(78vh * 9 / 16)' : 'min(92vw, 1200px)', display: 'flex', gap: 2 }}>
        {ds.map((x, k) => (
          <div key={x.id} onClick={() => setI(k)} title={`#${x.thu_tu} ${x.canh}`} style={{ flex: x.thoi_luong_s || 4, height: 6, borderRadius: 3, cursor: 'pointer', background: k < i ? 'var(--cyan)' : k === i ? `linear-gradient(90deg, var(--cyan) ${p * 100}%, #444 ${p * 100}%)` : '#444' }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#ddd', fontSize: 12 }}>
        <button type="button" className="xv-btn" onClick={() => setI(Math.max(0, i - 1))}>⏮</button>
        <button type="button" className="xv-btn chinh" onClick={() => { if (!chay && i === ds.length - 1 && p >= 1) { setI(0); } setChay(!chay); }}>{chay ? '⏸ Dừng' : '▶ Chạy'}</button>
        <button type="button" className="xv-btn" onClick={() => setI(Math.min(ds.length - 1, i + 1))}>⏭</button>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{daQua.toFixed(1)}s / {tong}s · cảnh {i + 1}/{ds.length}</span>
        <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={doc} onChange={(e) => setDoc(e.target.checked)} /> đọc lời thoại</label>
        <button type="button" className="xv-btn" onClick={onClose}>Đóng (Esc)</button>
      </div>
      {canh.length > ds.length && <div style={{ ...mono, color: 'var(--amber)' }}>{canh.length - ds.length} cảnh chưa có keyframe nên bị bỏ qua trong animatic.</div>}
    </div>
  );
}

// ── Một cảnh ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Keyframe nhỏ dưới video (#1218): có video rồi vẫn xem lại được ảnh gốc của clip (rê để phóng to, kèm ảnh so sánh). */
function KfNho({ url, soSanh }: { url: string; soSanh: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }} title="Keyframe của clip — rê để phóng to">
      <img src={url} alt="" data-so-sanh={soSanh} style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--line)' }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-3)' }}>keyframe</span>
    </div>
  );
}

/** Trang phục của người trong shot — sửa ngay trên thẻ (Enter/blur là lưu). Trống = mặc như mô tả nhân vật. */
function TrangPhucShot({ c, onLuu }: { c: Canh; onLuu: (t: string) => void }) {
  const [v, setV] = useState(c.trang_phuc);
  useEffect(() => { setV(c.trang_phuc); }, [c.trang_phuc]);
  const luu = () => { if (v.trim() !== c.trang_phuc.trim()) onLuu(v.trim()); };
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }} title="Trang phục trong shot này — đè lên bộ đồ trong mô tả nhân vật (mặt, tóc, dáng vẫn giữ)">
      <span style={{ fontSize: 11 }}>👗</span>
      <input className="xv-in" value={v} onChange={(e) => setV(e.target.value)} onBlur={luu} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); luu(); } }}
        placeholder="trang phục trong shot (trống = như mô tả nhân vật) · vd: chỉ mặc áo bra không gọng, không áo ngoài" style={{ fontSize: 11.5, padding: '3px 8px', flex: 1, maxWidth: 560 }} />
    </div>
  );
}

function CanhRow({ c, nhanVat, kt, khoa, ban, chay, phimLoai }: { c: Canh; nhanVat: NhanVat[]; kt: Required<KinhThanh>; khoa: Khoa; phimLoai: LoaiPhim; ban: (k: string) => boolean; chay: (ten: string, fn: () => Promise<KqChay>) => Promise<void> }) {
  const [mo, setMo] = useState(false);
  const [f, setF] = useState<Canh>(c);
  const [ai, setAi] = useState(false);
  const [loiAi, setLoiAi] = useState('');
  const moHinh = useContext(MoHinhCtx);
  // Shot cũ chỉ có chuỗi loi_thoai → mở form thì tách sẵn thành dòng ("Tên: lời") để sửa kiểu kịch bản.
  const tuChuoi = (x: Canh): Canh => (x.thoai.length || !x.loi_thoai.trim() ? x : { ...x, thoai: dongThoai(x, nhanVat) });
  // Danh sách cảnh tự làm mới 4-15 giây/lần (object mới): chỉ đồng bộ khi NỘI DUNG đổi và form sửa đang đóng — không ghi đè chỗ đang sửa.
  const cJson = JSON.stringify(c);
  useEffect(() => { if (!mo) setF(tuChuoi(JSON.parse(cJson) as Canh)); }, [cJson, mo]); // eslint-disable-line react-hooks/exhaustive-deps
  // AI điền form tại chỗ, KHÔNG qua chay() — chay tải lại cảnh và useEffect trên sẽ ghi đè mất phần AI vừa điền.
  const aiVietLai = async () => { setAi(true); setLoiAi(''); const r = await goiYAICanh(c.id, { canh: f.canh, goc_may: f.goc_may, hanh_dong: f.hanh_dong, loi_thoai: f.loi_thoai, nhan_vat: f.nhan_vat }); setAi(false); if (!r.ok) { setLoiAi(r.loi); return; } setF((x) => ({ ...x, ...r.data })); };
  const tt = TRANG_THAI_CANH[c.trang_thai] ?? TRANG_THAI_CANH.nhap;
  const dirty = JSON.stringify(f) !== JSON.stringify(c);
  const tatCaBt = nhanVat.flatMap((v) => (v.bien_the ?? []).map((b) => ({ ...b, nv: v.ten })));
  const doc = kt.ti_le === '9:16';
  const anhKhung: CSSProperties = { width: doc ? 68 : 120, height: doc ? 120 : 68, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)' };
  const k = `c${c.id}`;
  const tp = thanhPhanCanh(c, nhanVat);
  // Ảnh tham chiếu của các đối tượng cần khớp danh tính trong shot — nhân vật, sản phẩm, đạo cụ (bỏ bối cảnh), biến thể đang chọn nếu có —
  // đi kèm khi phóng to keyframe để so (#1215).
  const soSanh = JSON.stringify(tp.ds.filter((x) => x.anh && x.nv.loai !== 'boi_canh').map((x) => ({ ten: `${x.nv.ten}${x.bt ? ` · ${x.bt.ten}` : ''}`, url: x.anh })));
  // Model chọn tại cảnh (mặc định theo kinh thánh) — giá $ hiện trên ô chọn và nút.
  const [mhAnh, setMhAnh] = useState<string>(kt.mo_hinh_anh);
  const [mhVideo, setMhVideo] = useState<string>(kt.mo_hinh_video);
  useEffect(() => { setMhAnh(kt.mo_hinh_anh); setMhVideo(kt.mo_hinh_video); }, [kt.mo_hinh_anh, kt.mo_hinh_video]);
  const giay = mhVideo.startsWith('fal:') ? (c.thoi_luong_s || 5) : lamTronClip(c.thoi_luong_s);
  const dsAnh = moHinh.anh.length ? moHinh.anh : MO_HINH_ANH.map((m) => ({ key: m.key, label: m.label, nhom: '', giaCents: m.gia1k, donVi: 'anh' as const }));
  const dsVideo = moHinh.video.length ? moHinh.video : MO_HINH_VIDEO.map((m) => ({ key: m.key, label: m.label, nhom: '', giaCents: m.giaGiay['720p'], donVi: 'giay' as const }));
  const giaAnh = giaAnhUi(dsAnh, mhAnh);
  const giaVid = giaVideoUi(dsVideo, mhVideo, giay, kt.do_phan_giai);
  const giaNangCap = NANG_CAP.giaGiayCents * (c.thoi_luong_s || 8);
  const lyAnh = (!khoa.google && !khoa.openai && !(mhAnh.startsWith('fal:') && khoa.fal) && 'thiếu khoá ảnh') || (!c.prompt_anh.trim() && 'chưa có prompt ảnh (Sửa cảnh → prompt ảnh)') || (tp.thieu.length > 0 && `thiếu: ${tp.thieu.join('; ')}`);
  const lyVideo = mhVideo.startsWith('fal:') ? !khoa.fal && 'thiếu FAL_KEY' : !khoa.google && 'thiếu GOOGLE_API_KEY';
  const chonAnh = <Chon nho value={mhAnh} onChange={setMhAnh} options={luaChonAnh(dsAnh)} title="Model ảnh cho lần sinh này" minWidth={220} />;
  const chonVideo = <Chon nho value={mhVideo} onChange={setMhVideo} options={luaChonVideo(dsVideo, giay, kt.do_phan_giai)} title="Model video cho lần sinh này" minWidth={240} />;
  // Bước kế của cảnh → MỘT nút chính; còn lại vào menu ⋯ (YDNI).
  const buoc = c.trang_thai === 'dang_sinh' || c.dang_sinh_anh ? 'dang' : c.video_cuoi_url ? 'cuoi' : c.video_url && c.trang_thai === 'xong' ? 'nhap' : c.trang_thai === 'duyet' ? 'duyet' : c.keyframe_url ? 'kf' : 'trong';

  return (
    <div className="xv-canh">
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0 }}>
          {c.video_cuoi_url ? <div><video src={c.video_cuoi_url} controls preload="metadata" style={anhKhung} /><div style={{ ...mono, color: 'var(--lime)', textAlign: 'center' }}>bản cuối</div>{c.keyframe_url && <KfNho url={c.keyframe_url} soSanh={soSanh} />}</div>
            : c.video_url ? <div><video src={c.video_url} controls preload="metadata" style={anhKhung} /><div style={{ ...mono, textAlign: 'center' }}>nháp</div>{c.keyframe_url && <KfNho url={c.keyframe_url} soSanh={soSanh} />}</div>
            : c.keyframe_url ? <div style={{ position: 'relative' }}><img src={c.keyframe_url} alt="" data-so-sanh={soSanh} style={anhKhung} />{buoc === 'dang' && <DangSinh chu="" />}</div>
            : <div style={{ ...anhKhung, position: 'relative', display: 'grid', placeItems: 'center', color: 'var(--fg-4)', fontSize: 10, overflow: 'hidden' }}>chưa có{buoc === 'dang' && <DangSinh chu={c.dang_sinh_anh ? 'ảnh' : 'video'} />}</div>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ ...mono, color: 'var(--fg-2)' }}>#{c.thu_tu}</span>
            <strong style={{ fontSize: 12 }} title={c.goc_may}>{c.canh || 'Cảnh'}</strong>
            <Pill color={tt.color}>{tt.label}</Pill>
            <span style={mono} title={c.phat_s && c.phat_s !== c.thoi_luong_s ? `phát ${c.phat_s}s, clip sinh ${c.thoi_luong_s}s (cắt lấy phần đầu)` : undefined}>{c.phat_s && c.phat_s !== c.thoi_luong_s ? `phát ${c.phat_s}s / clip ${c.thoi_luong_s}s` : `${c.thoi_luong_s}s`}{c.chi_phi_cents > 0 ? ` · đã tốn ${tien(c.chi_phi_cents)}` : ''}</span>
            {c.nhanh && <Pill color="var(--amber)">hook {c.nhanh}</Pill>}
            {c.chu_man && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 4, background: '#facc1522', color: '#facc15', fontWeight: 700 }} title="Chữ trên màn">✎ {c.chu_man}</span>}
          </div>
          {(
            <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              {tp.ds.map(({ nv, bt, anh, thieu }) => (
                <span key={nv.id} title={thieu.length ? thieu.join('\n') : `${nv.ten}${bt ? ` · ${bt.ten}` : ''} — sẵn sàng`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 7px 2px 2px', borderRadius: 999, border: `1px solid ${thieu.length ? 'var(--red)' : 'var(--line)'}`, background: 'var(--bg-1)', fontSize: 10.5 }}>
                  {anh ? <img src={anh} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} /> : <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-2)', display: 'grid', placeItems: 'center', color: 'var(--red)' }}>!</span>}
                  <span>{nv.ten}{bt && <span style={{ color: 'var(--violet)' }}> · {bt.ten}</span>}</span>
                  {thieu.length > 0 && <span style={{ color: 'var(--red)' }}>thiếu</span>}
                </span>
              ))}
              {/* Thêm/bớt đối tượng ngay trên thẻ (#1210): nhân vật · sản phẩm · bối cảnh · đạo cụ — lưu luôn, keyframe sau tham chiếu đúng. */}
              <Chon nho multi values={c.nhan_vat.map(String)} onValues={(v) => void chay(k, () => suaCanh(c.id, { nhan_vat: v.map(Number) }))} minWidth={120} placeholder="＋ đối tượng"
                title="Thêm / bớt nhân vật, sản phẩm, bối cảnh, đạo cụ có trong shot (ảnh của chúng làm tham chiếu khi sinh keyframe)"
                options={nhanVat.map((v) => ({ value: String(v.id), label: v.ten, nhom: LOAI_NHAN_VAT.find((l) => l.key === v.loai)?.label, phu: v.anh_ref.length ? undefined : 'chưa ảnh' }))} />
              {phimLoai === 'quang_cao' && !nhanVat.some((v) => v.loai === 'san_pham' && c.nhan_vat.includes(v.id)) && nhanVat.some((v) => v.loai === 'san_pham') && <span style={{ fontSize: 10.5, color: 'var(--amber)' }}>⚠ shot chưa có sản phẩm</span>}
            </div>
          )}
          <div style={{ fontSize: 11.5, marginTop: 3, color: 'var(--fg-2)' }} title={c.loi_thoai ? `“${c.loi_thoai}”` : undefined}>{c.hanh_dong}</div>
          {nhanVat.some((v) => v.loai === 'nhan_vat' && c.nhan_vat.includes(v.id)) && (
            <TrangPhucShot c={c} onLuu={(t) => void chay(k, () => suaCanh(c.id, { trang_phuc: t }))} />
          )}
          {dongThoai(c, nhanVat).length > 0 && (
            <div style={{ marginTop: 4, padding: '4px 8px', borderLeft: '2px solid var(--line)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              {dongThoai(c, nhanVat).map((d, i) => (
                <div key={i} style={{ marginBottom: 2, display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <b style={{ color: 'var(--cyan)', textTransform: 'uppercase' }}>{d.nhan_vat || 'Lời dẫn'}</b>
                  {d.dien_xuat && <i style={{ color: 'var(--fg-3)' }}>({d.dien_xuat})</i>}
                  <span style={{ color: 'var(--fg-1)' }}>{d.loi}</span>
                  {d.url && <audio src={d.url} controls preload="none" style={{ height: 20, width: 120 }} />}
                </div>
              ))}
            </div>
          )}
          {(() => { const ds = nhanKyThuat(c.ky_thuat); return ds.length ? <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 4 }}>{c.phan_doan && <span style={{ ...mono, fontSize: 9.5, color: 'var(--violet)' }}>🎬 {c.phan_doan} ·</span>}{ds.map((x) => <span key={x} style={{ fontSize: 9.5, lineHeight: '15px', padding: '0 5px', borderRadius: 4, border: '1px solid var(--line)', color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{x}</span>)}</div> : null; })()}
          {(c.thoai_url || c.am_thanh_url || c.dang_sinh_am) && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
              {c.thoai_url && <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', ...mono }}>🗣<audio src={c.thoai_url} controls preload="none" style={{ height: 24, width: 170 }} /></span>}
              {c.am_thanh_url && <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', ...mono }}>🔊<audio src={c.am_thanh_url} controls preload="none" style={{ height: 24, width: 170 }} /></span>}
              {(c.dang_sinh_giong || c.dang_sinh_sfx) && <span style={{ ...mono, color: 'var(--violet)' }}>⏳ đang sinh {[c.dang_sinh_giong && 'giọng', c.dang_sinh_sfx && 'hiệu ứng'].filter(Boolean).join(' + ')}…</span>}
            </div>
          )}
          {tp.thieu.length > 0 && <div style={{ fontSize: 10.5, color: 'var(--red)', marginTop: 3 }}>Chưa sinh được: {tp.thieu.join(' · ')} — chuẩn bị ở mục 2.</div>}
          <Loi>{c.loi}</Loi>
          {c.keyframe_uv.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
              {c.keyframe_uv.map((u) => (
                <AnhNho key={u} url={u} soSanh={soSanh} vien={u === c.keyframe_url ? 'var(--cyan)' : undefined} title={u === c.keyframe_url ? 'đang chọn' : 'chọn ảnh này làm keyframe'}
                  onClick={() => void chay(k, async () => { await chonKeyframe(c.id, u); })} onXoa={() => chay(k, () => xoaKeyframe(c.id, u))} />
              ))}
            </div>
          )}
          {c.video_phien_ban.length > 1 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={mono}>{c.video_phien_ban.length} phiên bản:</span>
              {c.video_phien_ban.map((v, i) => {
                const dung = v.url === c.video_url || v.url === c.video_cuoi_url;
                return (
                  <Menu key={v.url + i} nhan={`${dung ? '● ' : ''}${i + 1} ${v.ban === 'cuoi' ? 'cuối' : 'nháp'}`}>
                    <div style={{ ...mono, padding: '2px 4px' }}>{v.model}{v.luc ? ` · ${gioVN(v.luc)}` : ''}</div>
                    <a data-dong="" href={v.url} target="_blank" rel="noreferrer" className="xv-btn" style={{ textDecoration: 'none' }}>▶ Xem / tải</a>
                    {v.url !== c.video_url && <MucMenu onClick={() => void chay(i + 'n' + c.id, () => chonPhienBan(c.id, v.url, 'nhap'))}>Dùng làm nháp</MucMenu>}
                    {v.url !== c.video_cuoi_url && <MucMenu onClick={() => void chay(i + 'c' + c.id, () => chonPhienBan(c.id, v.url, 'cuoi'))}>Dùng làm bản cuối</MucMenu>}
                  </Menu>
                );
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap', alignItems: 'center' }}>
            {buoc === 'trong' && <>{chonAnh}<Nut chinh ly={lyAnh} ban={ban(k)} onClick={() => void chay(k, () => sinhKeyframe(c.id, 1, mhAnh))} gia={giaAnh}>🖼 Sinh keyframe · {tien(giaAnh)}</Nut></>}
            {buoc === 'kf' && <Nut chinh ban={ban(k)} onClick={() => void chay(k, () => duyetCanh(c.id, true))}>✓ Duyệt keyframe</Nut>}
            {/* Sinh lại ảnh hiện ngay cạnh nút chính (không giấu trong ⋯): sửa trang phục / prompt / đối tượng xong là bấm lại được. Ảnh cũ vẫn giữ làm ứng viên. */}
            {(buoc === 'kf' || buoc === 'duyet' || buoc === 'nhap' || buoc === 'cuoi') && <>{chonAnh}<Nut ly={lyAnh} ban={ban(k)} title="Sinh thêm một ảnh keyframe mới theo prompt / trang phục / đối tượng hiện tại; ảnh cũ vẫn giữ trong dải ứng viên để chọn lại" onClick={() => void chay(k, () => sinhKeyframe(c.id, 1, mhAnh))} gia={giaAnh}>↻ Sinh lại ảnh · {tien(giaAnh)}</Nut></>}
            {buoc === 'duyet' && <>{chonVideo}<Nut chinh ly={lyVideo} ban={ban(k)} onClick={() => void chay(k, () => sinhVideoCanh(c.id, mhVideo))} gia={giaVid}>🎬 Sinh nháp · {giay}s · {tien(giaVid)}</Nut></>}
            {buoc === 'dang' && <span style={{ ...mono, color: 'var(--violet)' }}>{c.dang_sinh_anh ? 'đang sinh ảnh…' : 'đang sinh video, tự kiểm mỗi 10s…'}</span>}
            {(buoc === 'nhap' || buoc === 'cuoi') && <>{chonVideo}<Nut ly={lyVideo} ban={ban(k)} title="Sinh một bản nháp video mới từ keyframe đang chọn; bản cũ vẫn giữ trong danh sách phiên bản" onClick={() => void chay(k, () => sinhVideoCanh(c.id, mhVideo))} gia={giaVid}>↻ Sinh lại nháp · {giay}s · {tien(giaVid)}</Nut></>}
            {buoc === 'nhap' && <Nut chinh ly={!khoa.fal && 'thiếu FAL_KEY'} ban={ban(k)} title="Nâng cấp CHÍNH clip nháp (Topaz ×2): chuyển động, bố cục, nhân vật y hệt bản nháp" onClick={() => void chay(k, () => nangCapCanh(c.id))} gia={giaNangCap}>⬆ Làm bản cuối (nâng cấp nháp, khớp 100%) · {tien(giaNangCap)}</Nut>}
            {buoc === 'cuoi' && <a href={c.video_cuoi_url!} target="_blank" rel="noreferrer" className="xv-btn chinh" style={{ textDecoration: 'none' }}>⬇ Tải bản cuối</a>}
            <Menu>
              <div style={{ ...mono, padding: '2px 4px' }}>Model cho các lệnh bên dưới</div>
              <div style={{ display: 'grid', gap: 4 }}>{chonAnh}{chonVideo}</div>
              <MucMenu onClick={() => setMo(true)}>✎ Sửa cảnh (góc máy, lời thoại, prompt, nhân vật)</MucMenu>
              {c.loi_thoai.trim() && <MucMenu ly={!khoa.fal && 'thiếu FAL_KEY'} onClick={() => void chay(`g${c.id}`, () => sinhGiong(c.tap_id, [c.id]))}>🗣 {c.thoai_url ? 'Sinh lại' : 'Sinh'} giọng shot này</MucMenu>}
              <MucMenu ly={!khoa.fal && 'thiếu FAL_KEY'} onClick={() => void chay(`s${c.id}`, () => sinhAmThanh(c.tap_id, [c.id]))}>🔊 {c.am_thanh_url ? 'Sinh lại' : 'Sinh'} hiệu ứng âm thanh{c.video_url ? ' (từ clip)' : ''}</MucMenu>
              {(buoc === 'nhap' || buoc === 'cuoi') && dongThoai(c, nhanVat).some((d) => d.url) && <MucMenu ly={!khoa.fal && 'thiếu FAL_KEY'} gia={KHOP_MIENG.giaGiayCents * (c.thoi_luong_s || 8)} onClick={() => void chay(k, () => khopMiengCanh(c.id))}>👄 Khớp miệng với giọng đã sinh ({KHOP_MIENG.label}) · {tien(KHOP_MIENG.giaGiayCents * (c.thoi_luong_s || 8))}</MucMenu>}
              {(buoc === 'nhap' || buoc === 'cuoi') && <MucMenu onClick={() => void chay(k, () => lamLaiTuKeyframe(c.id))}>↩ Làm lại từ keyframe (đổi ảnh / duyệt lại — các bản video vẫn giữ trong phiên bản)</MucMenu>}
              {c.trang_thai === 'duyet' && <MucMenu onClick={() => void chay(k, () => duyetCanh(c.id, false))}>↩ Bỏ duyệt keyframe</MucMenu>}
              {c.trang_thai === 'loi' && buoc !== 'nhap' && buoc !== 'cuoi' && c.keyframe_url && <MucMenu ly={lyVideo} onClick={() => void chay(k, () => sinhVideoCanh(c.id, mhVideo))} gia={giaVid}>↻ Sinh lại nháp · {giay}s · {tien(giaVid)}</MucMenu>}
              {(buoc === 'nhap' || buoc === 'cuoi') && <MucMenu ly={lyVideo} onClick={() => void chay(k, () => sinhVideoCanh(c.id, mhVideo, 'cuoi'))} gia={giaVid}>🎬 Bản cuối = sinh lại bằng model đã chọn · {tien(giaVid)} (chuyển động có thể khác nháp)</MucMenu>}
              {buoc === 'cuoi' && <MucMenu ly={!khoa.fal && 'thiếu FAL_KEY'} onClick={() => void chay(k, () => nangCapCanh(c.id))} gia={giaNangCap}>⬆ Nâng cấp lại từ nháp · {tien(giaNangCap)}</MucMenu>}
              {c.video_url && <a data-dong="" href={c.video_url} target="_blank" rel="noreferrer" className="xv-btn" style={{ textDecoration: 'none' }}>⬇ Tải nháp</a>}
              <MucMenu nguy onClick={() => void chay(k, async () => { await xoaCanh(c.id); })}>🗑 Xoá cảnh</MucMenu>
            </Menu>
          </div>
        </div>
      </div>
      {mo && (
        <div className="xv-grid" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--line)' }}>
          <O label="Nhãn cảnh"><input className="xv-in" value={f.canh} onChange={(e) => setF({ ...f, canh: e.target.value })} /></O>
          <O label="Góc máy"><input className="xv-in" value={f.goc_may} onChange={(e) => setF({ ...f, goc_may: e.target.value })} /></O>
          <O label="Clip sinh" hint="độ dài model sinh (Veo 4/6/8)"><Chon value={String(f.thoi_luong_s)} onChange={(v) => setF({ ...f, thoi_luong_s: Number(v) })} options={[3, 4, 5, 6, 8, 10, 12, 15].map((x) => ({ value: String(x), label: `${x} giây`, phu: x > 8 ? 'chỉ model fal' : undefined }))} minWidth={140} /></O>
          <O label="Giây phát" hint="cắt lấy phần đầu clip; trống = cả clip"><input className="xv-in" type="number" min={1} max={15} step={0.5} value={f.phat_s ?? ''} onChange={(e) => setF({ ...f, phat_s: e.target.value === '' ? null : Number(e.target.value) })} placeholder={String(f.thoi_luong_s)} style={{ width: 90 }} /></O>
          <O span label="✎ Chữ trên màn" hint="≤ 8 từ: câu hook, số liệu, ưu đãi, CTA — bản xuất vẽ đúng chữ này"><input className="xv-in" value={f.chu_man} onChange={(e) => setF({ ...f, chu_man: e.target.value })} placeholder="để trống = không có chữ" /></O>
          <O label="Nhánh hook" hint="trống = thân chung; A/B/C = shot thay thế nhau ở hook"><input className="xv-in" value={f.nhanh} onChange={(e) => setF({ ...f, nhanh: e.target.value.trim().toUpperCase().slice(0, 2) })} placeholder="—" style={{ width: 70 }} /></O>
          <O label="Nhân vật · sản phẩm · bối cảnh trong cảnh"><Chon multi values={f.nhan_vat.map(String)} onValues={(v) => setF({ ...f, nhan_vat: v.map(Number) })} options={nhanVat.map((v) => ({ value: String(v.id), label: v.ten, nhom: LOAI_NHAN_VAT.find((l) => l.key === v.loai)?.label }))} placeholder="chọn…" /></O>
          <O label="Biến thể trong cảnh" hint="mỗi anchor tối đa 1 (biểu cảm / trang phục / góc…)"><Chon multi values={f.bien_the.map(String)} onValues={(v) => setF({ ...f, bien_the: v.map(Number) })} options={tatCaBt.filter((b) => f.nhan_vat.includes(b.nhan_vat_id)).map((b) => ({ value: String(b.id), label: b.ten, nhom: b.nv }))} placeholder="không dùng biến thể" /></O>
          <O span label="👗 Trang phục trong shot" hint="đè lên bộ đồ trong mô tả nhân vật; khuôn mặt, tóc, dáng vẫn giữ. Vd: chỉ mặc áo bra không gọng, KHÔNG áo ngoài"><input className="xv-in" value={f.trang_phuc} onChange={(e) => setF({ ...f, trang_phuc: e.target.value })} placeholder="để trống = mặc như mô tả nhân vật" /></O>
          <O span label="Hành động"><textarea className="xv-ta" rows={2} value={f.hanh_dong} onChange={(e) => setF({ ...f, hanh_dong: e.target.value })} /></O>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="xv-lbl" style={{ marginBottom: 4 }}>Thoại (kiểu kịch bản phim) <span style={{ ...mono, textTransform: 'none' }}>— mỗi lượt nói một dòng: nhân vật · diễn xuất (nhìn lên, giơ tay…) · lời. Mỗi dòng sinh giọng riêng theo giọng nhân vật.</span></div>
            {f.thoai.map((d, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '160px 200px 1fr auto', gap: 6, marginBottom: 4 }}>
                <Chon nho value={d.nhan_vat} onChange={(v) => setF({ ...f, thoai: f.thoai.map((x, j) => (j === i ? { ...x, nhan_vat: v } : x)) })} minWidth={150}
                  options={[{ value: '', label: 'Lời dẫn' }, ...nhanVat.filter((v) => v.loai === 'nhan_vat').map((v) => ({ value: v.ten, label: v.ten }))]} />
                <input className="xv-in" placeholder="diễn xuất: nhìn lên, giơ tay" value={d.dien_xuat} onChange={(e) => setF({ ...f, thoai: f.thoai.map((x, j) => (j === i ? { ...x, dien_xuat: e.target.value } : x)) })} />
                <input className="xv-in" placeholder="lời nói" value={d.loi} onChange={(e) => setF({ ...f, thoai: f.thoai.map((x, j) => (j === i ? { ...x, loi: e.target.value } : x)) })} />
                <button type="button" className="xv-btn" title="Bỏ dòng" onClick={() => setF({ ...f, thoai: f.thoai.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            <button type="button" className="xv-btn" onClick={() => setF({ ...f, thoai: [...f.thoai, { nhan_vat: f.thoai[f.thoai.length - 1]?.nhan_vat ?? '', dien_xuat: '', loi: '' }] })}>+ Dòng thoại</button>
          </div>
          <O label="Âm thanh"><input className="xv-in" value={f.am_thanh} onChange={(e) => setF({ ...f, am_thanh: e.target.value })} /></O>
          <O label="Phân cảnh (scene)" hint="shot cùng tên phân cảnh hợp thành một cảnh trên timeline"><input className="xv-in" value={f.phan_doan} onChange={(e) => setF({ ...f, phan_doan: e.target.value })} /></O>
          <O label={`Cảm xúc cuối shot: ${f.cam_xuc > 0 ? '+' : ''}${f.cam_xuc}`} hint="-5 đau/sợ … +5 vui/hy vọng — vẽ đường cong cảm xúc của tập"><input type="range" min={-5} max={5} step={1} value={f.cam_xuc} onChange={(e) => setF({ ...f, cam_xuc: Number(e.target.value) })} /></O>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="xv-lbl" style={{ marginBottom: 4 }}>Ngôn ngữ điện ảnh <span style={{ ...mono, textTransform: 'none' }}>— chọn từ thư viện; nhóm "Hợp {THE_LOAI.find((t) => t.key === kt.the_loai)?.ten ?? 'thể loại'}" đứng đầu; ghép vào prompt ảnh/video khi sinh · <a href="/thu-vien" target="_blank" rel="noreferrer" style={{ color: 'var(--cyan)' }}>xem thư viện ↗</a></span></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 6 }}>
              {NHOM_KY_THUAT.map((n) => {
                const tl = (kt.the_loai || undefined) as TheLoai | undefined;
                const opts = dsTheoNhom(n.key, tl).map((x) => ({ value: x.key, label: x.ten, nhom: hopTheLoai(x, tl) ? `Hợp ${THE_LOAI.find((t) => t.key === tl)?.ten ?? 'mọi thể loại'}` : 'Thể loại khác', title: x.mo_ta }));
                return (
                  <label key={n.key} style={{ display: 'grid', gap: 2 }}>
                    <span style={{ ...mono }}>{n.icon} {n.ten}</span>
                    {n.key === 'am_thanh'
                      ? <Chon nho multi values={f.ky_thuat.am_thanh ?? []} onValues={(v) => setF({ ...f, ky_thuat: { ...f.ky_thuat, am_thanh: v.slice(0, 3) } })} options={opts} placeholder="chưa chọn" minWidth={200} />
                      : <Chon nho value={(f.ky_thuat as Record<string, string | undefined>)[n.key] ?? ''} onChange={(v) => setF({ ...f, ky_thuat: { ...f.ky_thuat, [n.key]: v } })} options={opts} placeholder="chưa chọn" minWidth={200} />}
                  </label>
                );
              })}
            </div>
          </div>
          <O span label="Prompt ảnh (keyframe, tiếng Anh)"><textarea className="xv-ta" rows={3} value={f.prompt_anh} onChange={(e) => setF({ ...f, prompt_anh: e.target.value })} style={{ fontFamily: 'var(--font-mono)' }} /></O>
          <O span label="Prompt video (chuyển động, tiếng Anh)"><textarea className="xv-ta" rows={3} value={f.prompt_video} onChange={(e) => setF({ ...f, prompt_video: e.target.value })} style={{ fontFamily: 'var(--font-mono)' }} /></O>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Nut ly={!khoa.anthropic && 'thiếu ANTHROPIC_API_KEY'} ban={ai || ban(k)} title="Claude đọc cảnh trước/sau + tuyến nhân vật + phong cách → điền đủ góc máy, hành động, lời thoại, prompt ảnh, prompt video khớp mạch. Chỉ điền vào form, anh xem rồi Lưu cảnh." onClick={() => void aiVietLai()}>{ai ? '… AI đang viết' : '✨ AI viết lại cảnh (khớp cảnh trước/sau)'}</Nut>
            <Loi>{loiAi}</Loi>
            <Nut ly={!dirty && 'chưa sửa'} ban={ban(k)} chinh onClick={() => void chay(k, async () => {
              await suaCanh(c.id, { canh: f.canh, goc_may: f.goc_may, thoi_luong_s: f.thoi_luong_s, nhan_vat: f.nhan_vat, bien_the: f.bien_the, hanh_dong: f.hanh_dong, loi_thoai: f.loi_thoai, am_thanh: f.am_thanh, prompt_anh: f.prompt_anh, prompt_video: f.prompt_video, phan_doan: f.phan_doan, cam_xuc: f.cam_xuc, ky_thuat: f.ky_thuat, thoai: f.thoai, phat_s: f.phat_s, chu_man: f.chu_man, nhanh: f.nhanh, trang_phuc: f.trang_phuc });
              setMo(false);
            })}>Lưu cảnh</Nut>
            <button type="button" className="xv-btn" onClick={() => { setF(c); setMo(false); }}>Huỷ</button>
          </div>
        </div>
      )}
    </div>
  );
}
