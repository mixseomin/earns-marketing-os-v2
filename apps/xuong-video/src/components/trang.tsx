'use client';
// Xưởng video AI (studio.on.tc) — một màn: danh sách phim → drawer phim (kinh thánh · tuyến nhân vật · tập · storyboard từng tập).
// Storyboard = bảng cảnh: mỗi dòng một cảnh (xương sống dữ liệu); keyframe sinh → chọn → duyệt → video. Canvas node + timeline (G2/G3)
// là hai cách nhìn khác của cùng bảng này, không có dữ liệu riêng.
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useModalParam } from '@/lib/use-modal-param';
import {
  dsPhim, docPhim, dsCanh, taoPhim, taoPhimMau, suaPhim, xoaPhim, luuNhanVat, xoaNhanVat, sinhAnhMau, taoTap, suaTap,
  vietKichBanTap, tachCanhTap, suaCanh, themCanh, xoaCanh, sinhKeyframe, chonKeyframe, duyetCanh, uocTien, sinhVideoCanh, kiemVideo, taiAnhLen,
  goiYAIKinhThanh, goiYAIAnchor, goiYAIBoAnchor, goiYAIBrief, goiYAICanh,
  type PhimDayDu,
} from '@/lib/actions';
import {
  LOAI_PHIM, LOAI_NHAN_VAT, TRANG_THAI_CANH, MO_HINH_ANH, MO_HINH_VIDEO, MO_HINH_CHU, docKinhThanh, giaAnhCents, giaVideoCents, tien,
  type Phim, type NhanVat, type Tap, type Canh, type KinhThanh, type LoaiPhim, type LoaiNhanVat,
} from '@/lib/xuong-video/kieu';

type Khoa = { google: boolean; anthropic: boolean; r2: boolean };
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
function Nut({ ly, ban, chinh, nguy, title, onClick, children }: { ly?: string | false | null; ban?: boolean; chinh?: boolean; nguy?: boolean; title?: string; onClick: () => void; children: ReactNode }) {
  const why = ly ? String(ly) : '';
  return <button type="button" className={`xv-btn${chinh ? ' chinh' : ''}${nguy ? ' nguy' : ''}`} disabled={!!why || ban} title={why || title} onClick={onClick}>{children}</button>;
}
/** Xoá hai nhịp: bấm lần một = cảnh báo, bấm lần hai trong 4s = xoá. */
function Xoa({ nhan, onXoa, ban }: { nhan: string; onXoa: () => Promise<void>; ban?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
  return <button type="button" className="xv-btn nguy" disabled={ban} onClick={() => { if (armed) { setArmed(false); void onXoa(); } else setArmed(true); }}>{armed ? `⚠ bấm lại để xoá ${nhan}` : '🗑'}</button>;
}
function Ngan({ onClose, nho, children }: { onClose: () => void; nho?: boolean; children: ReactNode }) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  return <><div className={`xv-backdrop${nho ? ' nho' : ''}`} onClick={onClose} /><div className={`xv-drawer${nho ? ' nho' : ''}`}>{children}</div></>;
}
function Loi({ children }: { children: ReactNode }) { return children ? <div className="xv-loi">{children}</div> : null; }
const mono: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-3)' };

/** Tải ảnh tham chiếu: chọn file → thu nhỏ ≤1600px → data URL → server đẩy R2. */
function TaiAnh({ value, onChange, max = 4 }: { value: string[]; onChange: (urls: string[]) => void; max?: number }) {
  const [ban, setBan] = useState(false);
  const [loi, setLoi] = useState('');
  const chon = async (files: FileList | null) => {
    if (!files?.length) return;
    setBan(true); setLoi('');
    const them: string[] = [];
    for (const f of Array.from(files).slice(0, max - value.length)) {
      try {
        const bmp = await createImageBitmap(f);
        const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
        const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
        c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
        const du = c.toDataURL('image/jpeg', 0.88);
        const r = await taiAnhLen(du);
        if (r.ok) them.push(r.data); else setLoi(r.loi);
      } catch (e) { setLoi(String(e)); }
    }
    setBan(false);
    if (them.length) onChange([...value, ...them]);
  };
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        {value.map((u) => (
          <span key={u} style={{ position: 'relative' }}>
            <a href={u} target="_blank" rel="noreferrer"><img src={u} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)' }} /></a>
            <button type="button" className="xv-btn nguy" style={{ position: 'absolute', top: -6, right: -6, padding: '0 5px', fontSize: 10 }} onClick={() => onChange(value.filter((x) => x !== u))}>×</button>
          </span>
        ))}
      </div>
      {value.length < max && <input type="file" accept="image/*" multiple disabled={ban} onChange={(e) => void chon(e.target.files)} style={{ fontSize: 11 }} />}
      {ban && <span style={mono}> đang tải…</span>}
      <Loi>{loi}</Loi>
    </div>
  );
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

  const tao = async () => {
    setBan(true); setLoiTao('');
    const r = await taoPhim(ten, loai);
    setBan(false);
    if (!r.ok) { setLoiTao(r.loi); return; }
    setTen(''); await taiLai(); modal.open('phim', r.data);
  };
  const thieu = [!khoa.anthropic && 'ANTHROPIC_API_KEY (viết/tách kịch bản)', !khoa.google && 'GOOGLE_API_KEY (ảnh + video Veo)', !khoa.r2 && 'R2 (kho ảnh/video)'].filter(Boolean) as string[];
  const tongTien = phim.reduce((a, p) => a + p.chi_phi_cents, 0);

  return (
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
          {LOAI_PHIM.map((l) => (
            <Nut key={l.key} ban={ban} onClick={async () => { setBan(true); setLoiTao(''); const r = await taoPhimMau(l.key); setBan(false); if (!r.ok) { setLoiTao(r.loi); return; } await taiLai(); modal.open('phim', r.data); }}>{ban ? '… đang tạo + tách cảnh' : `📄 Mẫu ${l.label}`}</Nut>
          ))}
        </div>
      </div>

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
  );
}

// ── Drawer phim ─────────────────────────────────────────────────────────────────────────────────────────────────

function PhimDrawer({ id, khoa, onClose, onXoa }: { id: number; khoa: Khoa; onClose: () => void; onXoa: () => Promise<void> }) {
  const [d, setD] = useState<PhimDayDu | null | undefined>(undefined);
  const tapParam = useModalParam('tap');
  const tai = useCallback(async () => setD(await docPhim(id)), [id]);
  useEffect(() => { void tai(); }, [tai]);

  if (d === undefined) return <Ngan onClose={onClose}><span style={mono}>đang tải…</span></Ngan>;
  if (d === null) return <Ngan onClose={onClose}><b>Không thấy phim</b></Ngan>;
  const { phim, nhanVat, tap } = d;
  const tapId = tapParam.numId && tap.some((t) => t.id === tapParam.numId) ? tapParam.numId : (tap[0]?.id ?? null);

  return (
    <Ngan onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{phim.ten}</h2>
        <Pill color="var(--fg-3)">{LOAI_PHIM.find((l) => l.key === phim.loai)?.label ?? phim.loai}</Pill>
        <span style={mono}>#{phim.id} · {nhanVat.length} anchor · {tap.length} tập</span>
        <span style={{ flex: 1 }} />
        <Xoa nhan="cả phim (tập + cảnh)" onXoa={onXoa} />
        <button type="button" className="xv-btn" onClick={onClose}>Đóng</button>
      </div>

      <KinhThanhForm phim={phim} onSaved={tai} />
      <NhanVatSection phimId={phim.id} nhanVat={nhanVat} kinhThanh={phim.kinh_thanh} khoa={khoa} onChanged={tai} />

      <div className="xv-panel">
        <h3>Tập & storyboard<small>{phim.loai === 'phim' ? 'mỗi tập một kịch bản; tập sau đọc tóm tắt tập trước' : 'một tập'}</small></h3>
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
    </Ngan>
  );
}

// ── Kinh thánh (bible) ──────────────────────────────────────────────────────────────────────────────────────────

function KinhThanhForm({ phim, onSaved }: { phim: Phim; onSaved: () => Promise<void> }) {
  const goc = useMemo(() => docKinhThanh(phim.kinh_thanh), [phim.kinh_thanh]);
  const [kt, setKt] = useState<Required<KinhThanh>>(goc);
  const [moTa, setMoTa] = useState(phim.mo_ta);
  const [luu, setLuu] = useState(false);
  const [ai, setAi] = useState(false);
  const [loiAi, setLoiAi] = useState('');
  useEffect(() => { setKt(goc); setMoTa(phim.mo_ta); }, [goc, phim.mo_ta]);
  const dirty = JSON.stringify(kt) !== JSON.stringify(goc) || moTa !== phim.mo_ta;
  const set = <K extends keyof KinhThanh>(k: K, v: Required<KinhThanh>[K]) => setKt((x) => ({ ...x, [k]: v }));
  const goiY = async () => { setAi(true); setLoiAi(''); const r = await goiYAIKinhThanh(phim.id); setAi(false); if (!r.ok) { setLoiAi(r.loi); return; } set('phong_cach', r.data.phong_cach); setMoTa(r.data.mo_ta); };
  return (
    <details className="xv-det xv-panel" open={!kt.phong_cach}>
      <summary>Kinh thánh của bộ phim <small>{kt.phong_cach ? `${kt.ti_le} · ${kt.do_phan_giai} · nối vào đầu MỌI prompt ảnh/video` : 'chưa đặt phong cách'}</small></summary>
      <div className="xv-grid" style={{ marginTop: 10 }}>
        <O span label="Phong cách hình ảnh" hint="Viết như tả cho hoạ sĩ: chất liệu, bảng màu, ánh sáng, lens. Tiếng Việt hay Anh đều được. Nối vào đầu mọi prompt để các tập giống nhau.">
          <textarea className="xv-ta" rows={2} value={kt.phong_cach} onChange={(e) => set('phong_cach', e.target.value)} placeholder="3D hoạt hình kiểu Pixar, màu ấm, ánh sáng mềm buổi sáng, khu rừng cổ tích…" />
        </O>
        <O span label="Mô tả / tiền đề"><textarea className="xv-ta" rows={2} value={moTa} onChange={(e) => setMoTa(e.target.value)} placeholder="Bộ phim kể về… / Sản phẩm là… bán cho…" /></O>
        <O label="Khung hình"><Seg options={[{ value: '9:16', label: '9:16 dọc' }, { value: '16:9', label: '16:9 ngang' }]} value={kt.ti_le} onChange={(v) => set('ti_le', v)} /></O>
        <O label="Độ phân giải video"><Seg options={[{ value: '720p', label: '720p (rẻ)' }, { value: '1080p', label: '1080p' }]} value={kt.do_phan_giai} onChange={(v) => set('do_phan_giai', v)} /></O>
        <O label="Model ảnh"><select className="xv-sel" value={kt.mo_hinh_anh} onChange={(e) => set('mo_hinh_anh', e.target.value as Required<KinhThanh>['mo_hinh_anh'])}>{MO_HINH_ANH.map((m) => <option key={m.key} value={m.key}>{m.label} · {tien(m.gia1k)}</option>)}</select></O>
        <O label="Model video"><select className="xv-sel" value={kt.mo_hinh_video} onChange={(e) => set('mo_hinh_video', e.target.value as Required<KinhThanh>['mo_hinh_video'])}>{MO_HINH_VIDEO.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select></O>
        <O label="Model chữ (kịch bản, tách cảnh)"><select className="xv-sel" value={kt.mo_hinh_chu} onChange={(e) => set('mo_hinh_chu', e.target.value as Required<KinhThanh>['mo_hinh_chu'])}>{MO_HINH_CHU.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select></O>
        <O label="Ngôn ngữ lời thoại"><select className="xv-sel" value={kt.ngon_ngu} onChange={(e) => set('ngon_ngu', e.target.value)}><option value="vi">Tiếng Việt</option><option value="en">English</option></select></O>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <Nut ly={!dirty && 'chưa sửa gì'} ban={luu} chinh onClick={async () => { setLuu(true); await suaPhim(phim.id, { kinh_thanh: kt, mo_ta: moTa }); setLuu(false); await onSaved(); }}>Lưu kinh thánh</Nut>
        <Nut ban={ai} title="Claude đọc tên phim, loại, tuyến nhân vật, các tập đã có → viết phong cách + tiền đề khớp. Chỉ điền vào ô, anh xem rồi Lưu." onClick={() => void goiY()}>{ai ? '… AI đang viết' : '✨ AI gợi ý phong cách + tiền đề'}</Nut>
      </div>
      <Loi>{loiAi}</Loi>
    </details>
  );
}

// ── Anchor: nhân vật / sản phẩm / bối cảnh ───────────────────────────────────────────────────────────────────────

function NhanVatSection({ phimId, nhanVat, kinhThanh, khoa, onChanged }: { phimId: number; nhanVat: NhanVat[]; kinhThanh: KinhThanh; khoa: Khoa; onChanged: () => Promise<void> }) {
  const [sua, setSua] = useState<Partial<NhanVat> | null>(null);
  const [ban, setBan] = useState<number | null>(null);
  const [loi, setLoi] = useState<Record<number, string>>({});
  const kt = docKinhThanh(kinhThanh);
  const sinh = async (id: number) => {
    setBan(id); setLoi((x) => ({ ...x, [id]: '' }));
    const r = await sinhAnhMau(id);
    setBan(null);
    if (!r.ok) setLoi((x) => ({ ...x, [id]: r.loi }));
    await onChanged();
  };
  return (
    <div className="xv-panel">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h3 style={{ flex: 1 }}>Tuyến nhân vật · sản phẩm · bối cảnh<small>anchor: đặc tính cố định + ảnh mẫu → mọi cảnh, mọi tập tham chiếu cùng một bản</small></h3>
        <Nut ban={ban === -1} title="Claude đọc tiền đề + kịch bản các tập + anchor đã có → tạo các anchor còn thiếu (nhân vật, sản phẩm, bối cảnh, đạo cụ). Tạo xong anh sửa/xoá tuỳ ý." onClick={async () => { setBan(-1); setLoi((x) => ({ ...x, [-1]: '' })); const r = await goiYAIBoAnchor(phimId); setBan(null); if (!r.ok) setLoi((x) => ({ ...x, [-1]: r.loi })); await onChanged(); }}>{ban === -1 ? '… AI đang đề xuất' : '✨ AI đề xuất tuyến còn thiếu'}</Nut>
        <button type="button" className="xv-btn" onClick={() => setSua({ loai: 'nhan_vat', ten: '', mo_ta: '', anh_ref: [], giong: '' })}>+ Thêm</button>
      </div>
      <Loi>{loi[-1]}</Loi>
      {nhanVat.length === 0 && <div style={mono}>Chưa có anchor. Phim nhiều tập BẮT BUỘC khai nhân vật ở đây trước khi tách cảnh, nếu không mỗi tập Claude sẽ tả một kiểu.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 8 }}>
        {nhanVat.map((v) => (
          <div key={v.id} className="xv-anchor">
            <div style={{ width: 72, flexShrink: 0 }}>
              {v.anh_ref[0] ? <a href={v.anh_ref[0]} target="_blank" rel="noreferrer"><img src={v.anh_ref[0]} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6 }} /></a>
                : <div style={{ width: 72, height: 72, borderRadius: 6, background: 'var(--bg-2)', display: 'grid', placeItems: 'center', color: 'var(--fg-4)' }}>?</div>}
              {v.anh_ref.length > 1 && <div style={{ ...mono, textAlign: 'center' }}>+{v.anh_ref.length - 1} ảnh</div>}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><strong style={{ fontSize: 12 }}>{v.ten}</strong><Pill color="var(--fg-3)">{LOAI_NHAN_VAT.find((l) => l.key === v.loai)?.label ?? v.loai}</Pill></div>
              <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={v.mo_ta}>{v.mo_ta || <em style={{ color: 'var(--fg-4)' }}>chưa mô tả</em>}</div>
              <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                <button type="button" className="xv-btn" onClick={() => setSua(v)}>Sửa</button>
                <Nut ly={(!khoa.google && 'thiếu GOOGLE_API_KEY') || (!v.mo_ta.trim() && 'tả đặc tính trước')} ban={ban === v.id} title={`Sinh ảnh mẫu từ mô tả (~${tien(giaAnhCents(kt.mo_hinh_anh))})`} onClick={() => void sinh(v.id)}>{ban === v.id ? '… đang sinh' : '✨ Sinh ảnh mẫu'}</Nut>
                <Xoa nhan="anchor" onXoa={async () => { await xoaNhanVat(v.id); await onChanged(); }} />
              </div>
              <Loi>{loi[v.id]}</Loi>
            </div>
          </div>
        ))}
      </div>
      {sua && <NhanVatForm phimId={phimId} goc={sua} onClose={() => setSua(null)} onSaved={async () => { setSua(null); await onChanged(); }} />}
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
      <O label="Ảnh mẫu (tham chiếu) — tải lên, hoặc lưu rồi bấm “Sinh ảnh mẫu”"><TaiAnh value={f.anh_ref} onChange={(urls) => setF({ ...f, anh_ref: urls })} /></O>
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
  const [brief, setBrief] = useState('');
  const [thoiLuong, setThoiLuong] = useState(phim.loai === 'quang_cao' ? 24 : phim.loai === 'short' ? 40 : 60);
  const [soCanh, setSoCanh] = useState(0);
  const [canh, setCanh] = useState<Canh[] | null>(null);
  const [ban, setBan] = useState<string | null>(null);
  const [loi, setLoi] = useState('');
  const [uoc, setUoc] = useState<{ anh1: number; videoTong: number; soCanhDuyet: number; giayDuyet: number } | null>(null);
  const kt = docKinhThanh(phim.kinh_thanh);
  const taiCanh = useCallback(async () => { setCanh(await dsCanh(tap.id)); setUoc(await uocTien(tap.id)); }, [tap.id]);
  useEffect(() => { void taiCanh(); }, [taiCanh]);
  useEffect(() => { setKichBan(tap.kich_ban); setTenTap(tap.ten); }, [tap.kich_ban, tap.ten]);

  // Poll Veo khi có cảnh đang sinh (Veo chạy 1-3 phút). Dừng ngay khi không còn job chạy.
  const dangSinh = (canh ?? []).some((c) => c.trang_thai === 'dang_sinh');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!dangSinh) { if (pollRef.current) clearInterval(pollRef.current); pollRef.current = null; return; }
    pollRef.current = setInterval(async () => { const r = await kiemVideo(tap.id); if (r.vuaXong || r.conChay === 0) await taiCanh(); }, 10_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [dangSinh, tap.id, taiCanh]);

  const chay = async (ten: string, fn: () => Promise<KqChay>) => {
    setBan(ten); setLoi('');
    try { const r = await fn(); if (r && !r.ok) setLoi(r.loi ?? 'lỗi'); } finally { setBan(null); }
    await taiCanh(); await onChanged();
  };
  const kbDirty = kichBan !== tap.kich_ban || tenTap !== tap.ten;
  const soDuyet = (canh ?? []).filter((c) => c.trang_thai === 'duyet').length;
  const chuaKeyframe = (canh ?? []).filter((c) => !c.keyframe_url).length;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(280px, 1fr)', gap: 10 }}>
        <div>
          {phim.loai === 'phim' && <O label="Tên tập"><input className="xv-in" value={tenTap} onChange={(e) => setTenTap(e.target.value)} placeholder="Cuộc đua bắt đầu" /></O>}
          <O label="Kịch bản"><textarea className="xv-ta" rows={12} value={kichBan} onChange={(e) => setKichBan(e.target.value)} placeholder={'Dán kịch bản, hoặc dùng ô bên phải cho Claude viết.\nCảnh 1: … \nCảnh 2: …'} /></O>
          {tap.tom_tat && <div style={{ ...mono, marginTop: -4, marginBottom: 6 }}>Tóm tắt (tập sau đọc): {tap.tom_tat}</div>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <Nut ly={!kbDirty && 'chưa sửa'} ban={!!ban} onClick={() => void chay('luu', async () => { await suaTap(tap.id, { kich_ban: kichBan, ten: tenTap }); })}>Lưu kịch bản</Nut>
            <input className="xv-in" type="number" min={0} max={40} value={soCanh || ''} onChange={(e) => setSoCanh(Number(e.target.value) || 0)} placeholder="số cảnh (tự)" style={{ width: 110 }} />
            <Nut chinh ly={(!khoa.anthropic && 'thiếu ANTHROPIC_API_KEY') || (!kichBan.trim() && 'chưa có kịch bản')} ban={!!ban}
              title="Claude đọc kịch bản + anchor → bảng cảnh (góc máy, hành động, lời thoại, prompt ảnh, prompt video). Cảnh đã có keyframe giữ nguyên."
              onClick={() => void chay('tach', async () => { if (kbDirty) await suaTap(tap.id, { kich_ban: kichBan, ten: tenTap }); return tachCanhTap(tap.id, soCanh); })}>
              {ban === 'tach' ? '… Claude đang tách' : '✂ Tách cảnh'}
            </Nut>
          </div>
        </div>
        <div>
          <O label={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>Brief cho Claude viết kịch bản <Nut ly={!khoa.anthropic && 'thiếu ANTHROPIC_API_KEY'} ban={!!ban} title="Claude đọc tiền đề + tuyến nhân vật + tóm tắt các tập trước → gợi ý brief cho tập này" onClick={() => void chay('brief', async () => { const r = await goiYAIBrief(tap.id, thoiLuong); if (r.ok) setBrief(r.data); return r; })}>{ban === 'brief' ? '… AI' : '✨ AI gợi ý brief'}</Nut></span>}>
            <textarea className="xv-ta" rows={6} value={brief} onChange={(e) => setBrief(e.target.value)}
              placeholder={phim.loai === 'quang_cao' ? 'Sản phẩm, điểm bán chính, khách mục tiêu, hook mở đầu, CTA…' : phim.loai === 'phim' ? 'Tập này kể gì, xung đột, kết tập mở ra tập sau…' : 'Ý tưởng, hook 3 giây đầu, twist, CTA…'} />
          </O>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input className="xv-in" type="number" min={8} max={300} value={thoiLuong} onChange={(e) => setThoiLuong(Number(e.target.value) || 30)} style={{ width: 80 }} title="tổng giây" />
            <span style={mono}>giây</span>
            <Nut ly={(!khoa.anthropic && 'thiếu ANTHROPIC_API_KEY') || (!brief.trim() && 'viết brief trước')} ban={!!ban}
              onClick={() => void chay('viet', async () => { const r = await vietKichBanTap(tap.id, brief, thoiLuong); if (r.ok) setKichBan(r.data); return r; })}>
              {ban === 'viet' ? '… đang viết' : '✍ Claude viết kịch bản'}
            </Nut>
          </div>
          <div style={{ ...mono, marginTop: 10, lineHeight: 1.6 }}>
            Mạch: kịch bản → <b>Tách cảnh</b> → <b>Sinh keyframe</b> (ảnh, {tien(giaAnhCents(kt.mo_hinh_anh))}/ảnh) → chọn + <b>Duyệt</b> → <b>Sinh video</b> ({tien(giaVideoCents(kt.mo_hinh_video, kt.do_phan_giai, 8))}/8s).
            {uoc && uoc.soCanhDuyet > 0 && <div style={{ color: 'var(--amber)' }}>Đang chờ sinh video: {uoc.soCanhDuyet} cảnh · {uoc.giayDuyet}s ≈ {tien(uoc.videoTong)}</div>}
          </div>
        </div>
      </div>
      <Loi>{loi}</Loi>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 12 }}>Storyboard · {canh?.length ?? '…'} cảnh</strong>
        <span style={{ flex: 1 }} />
        <Nut ly={(!khoa.google && 'thiếu GOOGLE_API_KEY') || (chuaKeyframe === 0 && 'mọi cảnh đã có keyframe')} ban={!!ban}
          title={`Sinh 1 keyframe cho mỗi cảnh chưa có (${chuaKeyframe} cảnh ≈ ${tien(chuaKeyframe * giaAnhCents(kt.mo_hinh_anh))})`}
          onClick={() => void chay('kf-all', async () => { for (const c of (canh ?? []).filter((x) => !x.keyframe_url)) { const r = await sinhKeyframe(c.id, 1); if (!r.ok) return r; } })}>
          {ban === 'kf-all' ? '… đang sinh ảnh' : `🖼 Sinh keyframe cho ${chuaKeyframe} cảnh thiếu`}
        </Nut>
        <Nut chinh ly={(!khoa.google && 'thiếu GOOGLE_API_KEY') || (soDuyet === 0 && 'chưa có cảnh nào được duyệt')} ban={!!ban}
          title={uoc ? `Veo: ${uoc.soCanhDuyet} cảnh · ${uoc.giayDuyet}s ≈ ${tien(uoc.videoTong)} — trừ vào khoá Google` : ''}
          onClick={() => void chay('vid-all', async () => { for (const c of (canh ?? []).filter((x) => x.trang_thai === 'duyet')) { const r = await sinhVideoCanh(c.id); if (!r.ok) return r; } })}>
          {ban === 'vid-all' ? '… đang gửi Veo' : `🎬 Sinh video ${soDuyet} cảnh đã duyệt${uoc ? ` (≈ ${tien(uoc.videoTong)})` : ''}`}
        </Nut>
        <button type="button" className="xv-btn" disabled={!!ban} onClick={() => void chay('them', async () => { await themCanh(tap.id); })}>+ Cảnh</button>
      </div>

      {canh === null ? <span style={mono}>…</span> : canh.length === 0 ? (
        <div style={{ ...mono, marginTop: 8 }}>Chưa có cảnh. Dán kịch bản rồi bấm Tách cảnh, hoặc + Cảnh để tự viết.</div>
      ) : (
        <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>{canh.map((c) => <CanhRow key={c.id} c={c} nhanVat={nhanVat} kt={kt} khoa={khoa} ban={ban} chay={chay} />)}</div>
      )}
    </div>
  );
}

// ── Một cảnh ────────────────────────────────────────────────────────────────────────────────────────────────────

function CanhRow({ c, nhanVat, kt, khoa, ban, chay }: { c: Canh; nhanVat: NhanVat[]; kt: Required<KinhThanh>; khoa: Khoa; ban: string | null; chay: (ten: string, fn: () => Promise<KqChay>) => Promise<void> }) {
  const [mo, setMo] = useState(false);
  const [f, setF] = useState(c);
  const [ai, setAi] = useState(false);
  const [loiAi, setLoiAi] = useState('');
  useEffect(() => { setF(c); }, [c]);
  // AI điền form tại chỗ, KHÔNG qua chay() — chay tải lại cảnh và useEffect trên sẽ ghi đè mất phần AI vừa điền.
  const aiVietLai = async () => { setAi(true); setLoiAi(''); const r = await goiYAICanh(c.id, { canh: f.canh, goc_may: f.goc_may, hanh_dong: f.hanh_dong, loi_thoai: f.loi_thoai, nhan_vat: f.nhan_vat }); setAi(false); if (!r.ok) { setLoiAi(r.loi); return; } setF((x) => ({ ...x, ...r.data })); };
  const tt = TRANG_THAI_CANH[c.trang_thai] ?? TRANG_THAI_CANH.nhap;
  const dirty = JSON.stringify(f) !== JSON.stringify(c);
  const tenNv = (ids: number[]) => ids.map((i) => nhanVat.find((v) => v.id === i)?.ten).filter(Boolean).join(', ');
  const doc = kt.ti_le === '9:16';
  const anhKhung: CSSProperties = { width: doc ? 68 : 120, height: doc ? 120 : 68, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)' };
  const k = `c${c.id}`;

  return (
    <div className="xv-canh">
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0 }}>
          {c.video_url ? <video src={c.video_url} controls preload="metadata" style={anhKhung} />
            : c.keyframe_url ? <a href={c.keyframe_url} target="_blank" rel="noreferrer"><img src={c.keyframe_url} alt="" style={anhKhung} /></a>
            : <div style={{ ...anhKhung, display: 'grid', placeItems: 'center', color: 'var(--fg-4)', fontSize: 10 }}>chưa có</div>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ ...mono, color: 'var(--fg-2)' }}>#{c.thu_tu}</span>
            <strong style={{ fontSize: 12 }}>{c.canh || 'Cảnh'}</strong>
            <Pill color={tt.color}>{tt.label}</Pill>
            <span style={mono}>{c.thoi_luong_s}s · {c.goc_may}</span>
            {c.nhan_vat.length > 0 && <span style={mono}>· {tenNv(c.nhan_vat)}</span>}
            {c.chi_phi_cents > 0 && <span style={mono}>· {tien(c.chi_phi_cents)}</span>}
            <span style={{ flex: 1 }} />
            <button type="button" className="xv-btn" onClick={() => setMo((v) => !v)}>{mo ? 'Thu' : 'Sửa'}</button>
          </div>
          <div style={{ fontSize: 11.5, marginTop: 3 }}>{c.hanh_dong}</div>
          {c.loi_thoai && <div style={{ fontSize: 11, color: 'var(--fg-2)', fontStyle: 'italic' }}>“{c.loi_thoai}”</div>}
          <Loi>{c.loi}</Loi>
          {c.keyframe_uv.length > 1 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
              {c.keyframe_uv.map((u) => (
                <button key={u} type="button" title={u === c.keyframe_url ? 'đang chọn' : 'chọn ảnh này làm keyframe'} onClick={() => void chay(k, async () => { await chonKeyframe(c.id, u); })}
                  style={{ padding: 0, border: u === c.keyframe_url ? '2px solid var(--cyan)' : '2px solid transparent', borderRadius: 6, background: 'none', cursor: 'pointer' }}>
                  <img src={u} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4, display: 'block' }} />
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            <Nut ly={(!khoa.google && 'thiếu GOOGLE_API_KEY') || (!c.prompt_anh.trim() && 'chưa có prompt ảnh (Sửa → prompt ảnh)')} ban={!!ban} title={`1 ảnh ≈ ${tien(giaAnhCents(kt.mo_hinh_anh))}`} onClick={() => void chay(k, () => sinhKeyframe(c.id, 1))}>
              {ban === k ? '…' : c.keyframe_url ? '🖼 Thêm ứng viên' : '🖼 Sinh keyframe'}
            </Nut>
            {c.keyframe_url && !['duyet', 'dang_sinh', 'xong'].includes(c.trang_thai) && <Nut chinh ban={!!ban} onClick={() => void chay(k, () => duyetCanh(c.id, true))}>✓ Duyệt keyframe</Nut>}
            {c.trang_thai === 'duyet' && (
              <>
                <Nut chinh ly={!khoa.google && 'thiếu GOOGLE_API_KEY'} ban={!!ban} title={`Veo ${c.thoi_luong_s}s ≈ ${tien(giaVideoCents(kt.mo_hinh_video, kt.do_phan_giai, c.thoi_luong_s))}`} onClick={() => void chay(k, () => sinhVideoCanh(c.id))}>🎬 Sinh video</Nut>
                <Nut ban={!!ban} onClick={() => void chay(k, () => duyetCanh(c.id, false))}>bỏ duyệt</Nut>
              </>
            )}
            {c.trang_thai === 'dang_sinh' && <span style={{ ...mono, color: 'var(--violet)' }}>Veo đang chạy, tự kiểm mỗi 10s…</span>}
            {(c.trang_thai === 'xong' || c.trang_thai === 'loi') && c.keyframe_url && <Nut ly={!khoa.google && 'thiếu GOOGLE_API_KEY'} ban={!!ban} onClick={() => void chay(k, () => sinhVideoCanh(c.id))}>↻ Sinh lại video</Nut>}
            {c.video_url && <a href={c.video_url} target="_blank" rel="noreferrer" className="xv-btn" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>⬇ mp4</a>}
            <Xoa nhan="cảnh" ban={!!ban} onXoa={() => chay(k, async () => { await xoaCanh(c.id); })} />
          </div>
        </div>
      </div>
      {mo && (
        <div className="xv-grid" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--line)' }}>
          <O label="Nhãn cảnh"><input className="xv-in" value={f.canh} onChange={(e) => setF({ ...f, canh: e.target.value })} /></O>
          <O label="Góc máy"><input className="xv-in" value={f.goc_may} onChange={(e) => setF({ ...f, goc_may: e.target.value })} /></O>
          <O label="Thời lượng"><select className="xv-sel" value={String(f.thoi_luong_s)} onChange={(e) => setF({ ...f, thoi_luong_s: Number(e.target.value) })}><option value="4">4s</option><option value="6">6s</option><option value="8">8s</option></select></O>
          <O label="Anchor trong cảnh" hint="giữ Ctrl/⌘ để chọn nhiều"><select className="xv-sel" multiple value={f.nhan_vat.map(String)} onChange={(e) => setF({ ...f, nhan_vat: Array.from(e.target.selectedOptions).map((o) => Number(o.value)) })} style={{ minHeight: 60 }}>{nhanVat.map((v) => <option key={v.id} value={v.id}>{v.ten}</option>)}</select></O>
          <O span label="Hành động"><textarea className="xv-ta" rows={2} value={f.hanh_dong} onChange={(e) => setF({ ...f, hanh_dong: e.target.value })} /></O>
          <O label="Lời thoại"><input className="xv-in" value={f.loi_thoai} onChange={(e) => setF({ ...f, loi_thoai: e.target.value })} /></O>
          <O label="Âm thanh"><input className="xv-in" value={f.am_thanh} onChange={(e) => setF({ ...f, am_thanh: e.target.value })} /></O>
          <O span label="Prompt ảnh (keyframe, tiếng Anh)"><textarea className="xv-ta" rows={3} value={f.prompt_anh} onChange={(e) => setF({ ...f, prompt_anh: e.target.value })} style={{ fontFamily: 'var(--font-mono)' }} /></O>
          <O span label="Prompt video (chuyển động, tiếng Anh)"><textarea className="xv-ta" rows={3} value={f.prompt_video} onChange={(e) => setF({ ...f, prompt_video: e.target.value })} style={{ fontFamily: 'var(--font-mono)' }} /></O>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Nut ly={!khoa.anthropic && 'thiếu ANTHROPIC_API_KEY'} ban={ai || !!ban} title="Claude đọc cảnh trước/sau + tuyến nhân vật + phong cách → điền đủ góc máy, hành động, lời thoại, prompt ảnh, prompt video khớp mạch. Chỉ điền vào form, anh xem rồi Lưu cảnh." onClick={() => void aiVietLai()}>{ai ? '… AI đang viết' : '✨ AI viết lại cảnh (khớp cảnh trước/sau)'}</Nut>
            <Loi>{loiAi}</Loi>
            <Nut ly={!dirty && 'chưa sửa'} ban={!!ban} chinh onClick={() => void chay(k, async () => {
              await suaCanh(c.id, { canh: f.canh, goc_may: f.goc_may, thoi_luong_s: f.thoi_luong_s, nhan_vat: f.nhan_vat, hanh_dong: f.hanh_dong, loi_thoai: f.loi_thoai, am_thanh: f.am_thanh, prompt_anh: f.prompt_anh, prompt_video: f.prompt_video });
              setMo(false);
            })}>Lưu cảnh</Nut>
            <button type="button" className="xv-btn" onClick={() => { setF(c); setMo(false); }}>Huỷ</button>
          </div>
        </div>
      )}
    </div>
  );
}
