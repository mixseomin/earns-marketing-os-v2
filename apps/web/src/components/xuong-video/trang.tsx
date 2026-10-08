'use client';
// Xưởng video AI — một màn: danh sách phim → drawer phim (kinh thánh · tuyến nhân vật · tập · storyboard từng tập).
// Storyboard = bảng cảnh: mỗi dòng một cảnh (xương sống dữ liệu); keyframe sinh → chọn → duyệt → video. Canvas node + timeline (G2/G3)
// sẽ là hai cách nhìn khác của cùng bảng này, không có dữ liệu riêng.
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useModalParam } from '@/lib/use-modal-param';
import {
  Drawer, Panel, Section, Pill, EmptyState, Segmented, Collapsible, StatsStrip, ConfirmDeleteButton, GuardedButton, Spinner, SimpleTable,
} from '@/components/ui';
import { ImageAttach } from '@/components/ui/image-attach';
import { TextField, SelectField, TextAreaField } from '@/components/ui/form-field';
import {
  dsPhim, docPhim, dsCanh, taoPhim, suaPhim, xoaPhim, luuNhanVat, xoaNhanVat, sinhAnhMau, taoTap, suaTap, xoaTap,
  vietKichBanTap, tachCanhTap, suaCanh, themCanh, xoaCanh, sinhKeyframe, chonKeyframe, duyetCanh, uocTien, sinhVideoCanh, kiemVideo,
  type PhimDayDu,
} from '@/lib/actions/xuong-video';
import {
  LOAI_PHIM, LOAI_NHAN_VAT, TRANG_THAI_CANH, MO_HINH_ANH, MO_HINH_VIDEO, MO_HINH_CHU, docKinhThanh, giaAnhCents, giaVideoCents, tien,
  type Phim, type NhanVat, type Tap, type Canh, type KinhThanh, type LoaiPhim, type LoaiNhanVat,
} from '@/lib/xuong-video/kieu';

type Khoa = { google: boolean; anthropic: boolean; r2: boolean };
const btn: CSSProperties = { fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer', whiteSpace: 'nowrap' };
const btnChinh: CSSProperties = { ...btn, background: 'var(--neon-cyan)', color: '#000', border: '1px solid transparent', fontWeight: 700 };
const mono: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-3)' };
const loiStyle: CSSProperties = { fontSize: 11, color: 'var(--neon-red, #f87171)', marginTop: 4 };

export function XuongVideoTrang(props: { projectId: string; phimDau: Phim[]; khoa: Khoa }) {
  return <Suspense fallback={<Spinner />}><Ruot {...props} /></Suspense>;
}

function Ruot({ projectId, phimDau, khoa }: { projectId: string; phimDau: Phim[]; khoa: Khoa }) {
  const [phim, setPhim] = useState<Phim[]>(phimDau);
  const [ten, setTen] = useState('');
  const [loai, setLoai] = useState<LoaiPhim>('short');
  const [loiTao, setLoiTao] = useState('');
  const [bận, setBan] = useState(false);
  const modal = useModalParam();
  const taiLai = useCallback(async () => setPhim(await dsPhim(projectId)), [projectId]);

  const tao = async () => {
    setBan(true); setLoiTao('');
    const r = await taoPhim(projectId, ten, loai);
    setBan(false);
    if (!r.ok) { setLoiTao(r.loi); return; }
    setTen(''); await taiLai(); modal.open('phim', r.data);
  };
  const thieu = [!khoa.anthropic && 'ANTHROPIC_API_KEY (viết/tách kịch bản)', !khoa.google && 'GOOGLE_API_KEY (ảnh + video Veo)', !khoa.r2 && 'R2 (kho ảnh/video)'].filter(Boolean) as string[];
  const tongTien = phim.reduce((a, p) => a + p.chi_phi_cents, 0);

  return (
    <div>
      {thieu.length > 0 && (
        <div style={{ ...mono, color: 'var(--neon-amber)', border: '1px dashed var(--neon-amber)', borderRadius: 6, padding: '6px 10px', marginBottom: 10 }}>
          Máy chủ thiếu: {thieu.join(' · ')} — đặt trong .env.production rồi restart mos2-web. Trang vẫn soạn được, nút sinh sẽ báo lỗi tới khi có khoá.
        </div>
      )}
      <StatsStrip cards={[
        { key: 'phim', label: 'Phim / bộ', value: phim.length },
        { key: 'canh', label: 'Cảnh', value: phim.reduce((a, p) => a + p.so_canh, 0) },
        { key: 'tien', label: 'Đã tốn', value: tien(tongTien), sub: 'ảnh + video, theo giá niêm yết' },
        { key: 'gia', label: 'Giá mặc định', value: `${tien(giaAnhCents('gemini-nano-banana-2.1'))} / ảnh · ${tien(giaVideoCents('veo-3.1-lite-generate-preview', '720p', 8))} / 8s`, sub: 'Nano Banana 2.1 · Veo 3.1 Lite 720p' },
      ]} minColWidth={160} />

      <Panel title="Tạo phim / bộ mới" subtitle="short · phim nhiều tập · creative quảng cáo">
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <TextField label="Tên" value={ten} onChange={(e) => setTen(e.target.value)} placeholder="Thỏ và Rùa · Quảng cáo áo bra X…" style={{ minWidth: 260 }} onKeyDown={(e) => { if (e.key === 'Enter') void tao(); }} />
          <div>
            <div style={{ ...mono, textTransform: 'uppercase', marginBottom: 4 }}>Loại</div>
            <Segmented options={LOAI_PHIM.map((l) => ({ value: l.key, label: l.label, title: l.mo_ta }))} value={loai} onChange={setLoai} />
          </div>
          <GuardedButton reason={!ten.trim() && 'nhập tên trước'} disabled={bận} onClick={() => void tao()} style={btnChinh}>+ Tạo</GuardedButton>
        </div>
        {loiTao && <div style={loiStyle}>{loiTao}</div>}
      </Panel>

      {phim.length === 0 ? (
        <EmptyState icon="🎬" title="Chưa có phim nào" description="Tạo một phim ở trên: đặt tên, chọn loại, rồi khai nhân vật/sản phẩm và dán kịch bản." />
      ) : (
        <SimpleTable
          rows={phim}
          getRowKey={(p) => String(p.id)}
          columns={[
            { key: 'ten', header: 'Phim', align: 'left', cell: (p) => <button type="button" onClick={() => modal.open('phim', p.id)} style={{ background: 'none', border: 0, color: 'var(--fg-1)', cursor: 'pointer', fontWeight: 600, padding: 0, textAlign: 'left' }}>{p.ten}</button> },
            { key: 'loai', header: 'Loại', align: 'left', cell: (p) => <Pill color="var(--fg-3)" label={LOAI_PHIM.find((l) => l.key === p.loai)?.label ?? p.loai} /> },
            { key: 'nv', header: 'Anchor', cell: (p) => p.so_nhan_vat },
            { key: 'tap', header: 'Tập', cell: (p) => p.so_tap },
            { key: 'canh', header: 'Cảnh', cell: (p) => p.so_canh },
            { key: 'tien', header: 'Đã tốn', cell: (p) => tien(p.chi_phi_cents) },
            { key: 'tt', header: 'Trạng thái', align: 'left', cell: (p) => p.trang_thai },
          ]}
        />
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

  if (d === undefined) return <Drawer onClose={onClose} width={1100}><Spinner /></Drawer>;
  if (d === null) return <Drawer onClose={onClose} width={1100}><EmptyState icon="∅" title="Không thấy phim" /></Drawer>;
  const { phim, nhanVat, tap } = d;
  const tapId = tapParam.numId && tap.some((t) => t.id === tapParam.numId) ? tapParam.numId : (tap[0]?.id ?? null);

  return (
    <Drawer onClose={onClose} width={1100}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{phim.ten}</h2>
        <Pill color="var(--fg-3)" label={LOAI_PHIM.find((l) => l.key === phim.loai)?.label ?? phim.loai} />
        <span style={mono}>#{phim.id} · {nhanVat.length} anchor · {tap.length} tập</span>
        <span style={{ flex: 1 }} />
        <ConfirmDeleteButton labelIdle="🗑 Xoá phim" labelArmed="⚠ Bấm lại để xoá cả tập + cảnh" onDelete={onXoa} style={btn} />
      </div>

      <KinhThanhForm phim={phim} onSaved={tai} />
      <NhanVatSection phimId={phim.id} nhanVat={nhanVat} kinhThanh={phim.kinh_thanh} khoa={khoa} onChanged={tai} />

      <Section title="Tập & storyboard" subtitle={phim.loai === 'phim' ? 'mỗi tập một kịch bản; tập sau đọc tóm tắt tập trước' : 'một tập'} static>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          {tap.length > 0 && (
            <Segmented
              options={tap.map((t) => ({ value: t.id, label: `${phim.loai === 'phim' ? `Tập ${t.so}` : 'Tập'}${t.ten && t.ten !== phim.ten ? ` · ${t.ten}` : ''} (${t.so_canh})` }))}
              value={tapId ?? 0}
              onChange={(v) => tapParam.open('tap', v)}
            />
          )}
          {(phim.loai === 'phim' || tap.length === 0) && (
            <button type="button" style={btn} onClick={async () => { const r = await taoTap(phim.id, ''); if (r.ok) { await tai(); tapParam.open('tap', r.data); } }}>+ Thêm tập</button>
          )}
        </div>
        {tapId != null && <TapView key={tapId} tap={tap.find((t) => t.id === tapId)!} phim={phim} nhanVat={nhanVat} khoa={khoa} onChanged={tai} />}
      </Section>
    </Drawer>
  );
}

// ── Kinh thánh (bible) ──────────────────────────────────────────────────────────────────────────────────────────

function KinhThanhForm({ phim, onSaved }: { phim: Phim; onSaved: () => Promise<void> }) {
  const goc = useMemo(() => docKinhThanh(phim.kinh_thanh), [phim.kinh_thanh]);
  const [kt, setKt] = useState<Required<KinhThanh>>(goc);
  const [moTa, setMoTa] = useState(phim.mo_ta);
  const [luu, setLuu] = useState(false);
  useEffect(() => { setKt(goc); setMoTa(phim.mo_ta); }, [goc, phim.mo_ta]);
  const dirty = JSON.stringify(kt) !== JSON.stringify(goc) || moTa !== phim.mo_ta;
  const set = <K extends keyof KinhThanh>(k: K, v: Required<KinhThanh>[K]) => setKt((x) => ({ ...x, [k]: v }));
  return (
    <Collapsible title="Kinh thánh của bộ phim" hint="Phong cách + khung hình + model: nối vào đầu MỌI prompt ảnh/video để các tập giống nhau" badge={kt.phong_cach ? `${kt.ti_le} · ${kt.do_phan_giai}` : 'chưa đặt phong cách'} defaultOpen={!kt.phong_cach}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
        <TextAreaField label="Phong cách hình ảnh" gridColumn="1 / -1" rows={2} value={kt.phong_cach} onChange={(e) => set('phong_cach', e.target.value)}
          placeholder="3D hoạt hình kiểu Pixar, màu ấm, ánh sáng mềm buổi sáng, khu rừng cổ tích…" hint="Viết như tả cho hoạ sĩ: chất liệu, bảng màu, ánh sáng, lens. Tiếng Việt hay Anh đều được." />
        <TextAreaField label="Mô tả / tiền đề" gridColumn="1 / -1" rows={2} value={moTa} onChange={(e) => setMoTa(e.target.value)} placeholder="Bộ phim kể về… / Sản phẩm là… bán cho…" />
        <div>
          <div style={{ ...mono, textTransform: 'uppercase', marginBottom: 4 }}>Khung hình</div>
          <Segmented options={[{ value: '9:16', label: '9:16 dọc' }, { value: '16:9', label: '16:9 ngang' }]} value={kt.ti_le} onChange={(v) => set('ti_le', v)} />
        </div>
        <div>
          <div style={{ ...mono, textTransform: 'uppercase', marginBottom: 4 }}>Độ phân giải video</div>
          <Segmented options={[{ value: '720p', label: '720p (rẻ)' }, { value: '1080p', label: '1080p' }]} value={kt.do_phan_giai} onChange={(v) => set('do_phan_giai', v)} />
        </div>
        <SelectField label="Model ảnh" value={kt.mo_hinh_anh} onChange={(e) => set('mo_hinh_anh', e.target.value as Required<KinhThanh>['mo_hinh_anh'])}>
          {MO_HINH_ANH.map((m) => <option key={m.key} value={m.key}>{m.label} · {tien(m.gia1k)}</option>)}
        </SelectField>
        <SelectField label="Model video" value={kt.mo_hinh_video} onChange={(e) => set('mo_hinh_video', e.target.value as Required<KinhThanh>['mo_hinh_video'])}>
          {MO_HINH_VIDEO.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </SelectField>
        <SelectField label="Model chữ (kịch bản, tách cảnh)" value={kt.mo_hinh_chu} onChange={(e) => set('mo_hinh_chu', e.target.value as Required<KinhThanh>['mo_hinh_chu'])}>
          {MO_HINH_CHU.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </SelectField>
        <SelectField label="Ngôn ngữ lời thoại" value={kt.ngon_ngu} onChange={(e) => set('ngon_ngu', e.target.value)}>
          <option value="vi">Tiếng Việt</option><option value="en">English</option>
        </SelectField>
      </div>
      <div style={{ marginTop: 8 }}>
        <GuardedButton reason={!dirty && 'chưa sửa gì'} disabled={luu} style={btnChinh} onClick={async () => { setLuu(true); await suaPhim(phim.id, { kinh_thanh: kt, mo_ta: moTa }); setLuu(false); await onSaved(); }}>Lưu kinh thánh</GuardedButton>
      </div>
    </Collapsible>
  );
}

// ── Anchor: nhân vật / sản phẩm / bối cảnh ───────────────────────────────────────────────────────────────────────

function NhanVatSection({ phimId, nhanVat, kinhThanh, khoa, onChanged }: { phimId: number; nhanVat: NhanVat[]; kinhThanh: KinhThanh; khoa: Khoa; onChanged: () => Promise<void> }) {
  const [sua, setSua] = useState<Partial<NhanVat> | null>(null);
  const [ban, setBan] = useState<number | null>(null);
  const [loi, setLoi] = useState<Record<number, string>>({});
  void kinhThanh;
  const sinh = async (id: number) => {
    setBan(id); setLoi((x) => ({ ...x, [id]: '' }));
    const r = await sinhAnhMau(id);
    setBan(null);
    if (!r.ok) setLoi((x) => ({ ...x, [id]: r.loi }));
    await onChanged();
  };
  return (
    <Section title="Tuyến nhân vật · sản phẩm · bối cảnh" subtitle="anchor: đặc tính cố định + ảnh mẫu → mọi cảnh, mọi tập tham chiếu cùng một bản" static
      headerRight={<button type="button" style={btn} onClick={() => setSua({ loai: 'nhan_vat', ten: '', mo_ta: '', anh_ref: [], giong: '' })}>+ Thêm</button>}>
      {nhanVat.length === 0 && <div style={mono}>Chưa có anchor. Phim nhiều tập BẮT BUỘC khai nhân vật ở đây trước khi tách cảnh, nếu không mỗi tập Claude sẽ tả một kiểu.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 8 }}>
        {nhanVat.map((v) => (
          <div key={v.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 8, display: 'flex', gap: 8 }}>
            <div style={{ width: 72, flexShrink: 0 }}>
              {v.anh_ref[0] ? <a href={v.anh_ref[0]} target="_blank" rel="noreferrer"><img src={v.anh_ref[0]} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6 }} /></a>
                : <div style={{ width: 72, height: 72, borderRadius: 6, background: 'var(--bg-2)', display: 'grid', placeItems: 'center', color: 'var(--fg-4)' }}>?</div>}
              {v.anh_ref.length > 1 && <div style={{ ...mono, textAlign: 'center' }}>+{v.anh_ref.length - 1} ảnh</div>}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <strong style={{ fontSize: 12 }}>{v.ten}</strong>
                <Pill color="var(--fg-3)" label={LOAI_NHAN_VAT.find((l) => l.key === v.loai)?.label ?? v.loai} size="sm" />
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={v.mo_ta}>{v.mo_ta || <em style={{ color: 'var(--fg-4)' }}>chưa mô tả</em>}</div>
              <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                <button type="button" style={btn} onClick={() => setSua(v)}>Sửa</button>
                <GuardedButton reason={(!khoa.google && 'thiếu GOOGLE_API_KEY') || (!v.mo_ta.trim() && 'tả đặc tính trước')} disabled={ban === v.id} style={btn} onClick={() => void sinh(v.id)} title={`Sinh ảnh mẫu từ mô tả (~${tien(giaAnhCents(docKinhThanh(kinhThanh).mo_hinh_anh))})`}>
                  {ban === v.id ? '… đang sinh' : '✨ Sinh ảnh mẫu'}
                </GuardedButton>
                <ConfirmDeleteButton labelIdle="🗑" labelArmed="⚠ xoá?" onDelete={async () => { await xoaNhanVat(v.id); await onChanged(); }} style={btn} />
              </div>
              {loi[v.id] && <div style={loiStyle}>{loi[v.id]}</div>}
            </div>
          </div>
        ))}
      </div>
      {sua && <NhanVatForm phimId={phimId} goc={sua} onClose={() => setSua(null)} onSaved={async () => { setSua(null); await onChanged(); }} />}
    </Section>
  );
}

function NhanVatForm({ phimId, goc, onClose, onSaved }: { phimId: number; goc: Partial<NhanVat>; onClose: () => void; onSaved: () => Promise<void> }) {
  const [f, setF] = useState({ loai: (goc.loai ?? 'nhan_vat') as LoaiNhanVat, ten: goc.ten ?? '', mo_ta: goc.mo_ta ?? '', anh_ref: goc.anh_ref ?? [], giong: goc.giong ?? '' });
  const [loi, setLoi] = useState('');
  const [luu, setLuu] = useState(false);
  const dirty = JSON.stringify(f) !== JSON.stringify({ loai: goc.loai ?? 'nhan_vat', ten: goc.ten ?? '', mo_ta: goc.mo_ta ?? '', anh_ref: goc.anh_ref ?? [], giong: goc.giong ?? '' });
  return (
    <Drawer onClose={onClose} width={520} dirty={dirty}>
      <h3 style={{ marginTop: 0 }}>{goc.id ? `Sửa: ${goc.ten}` : 'Thêm anchor'}</h3>
      <div style={{ display: 'grid', gap: 8 }}>
        <div>
          <div style={{ ...mono, textTransform: 'uppercase', marginBottom: 4 }}>Loại</div>
          <Segmented options={LOAI_NHAN_VAT.map((l) => ({ value: l.key, label: l.label }))} value={f.loai} onChange={(v) => setF({ ...f, loai: v })} />
        </div>
        <TextField label="Tên" required value={f.ten} onChange={(e) => setF({ ...f, ten: e.target.value })} placeholder="Timo (rùa) · Áo bra X · Khu rừng Thì Thầm" hint="Claude dùng đúng tên này khi ghi nhân vật của từng cảnh" />
        <TextAreaField label="Đặc tính cố định" rows={5} value={f.mo_ta} onChange={(e) => setF({ ...f, mo_ta: e.target.value })}
          placeholder="Rùa con 8 tuổi, mai xanh rêu có vân lục giác, mắt to nâu, đeo khăn quàng đỏ, tính điềm tĩnh, đi chậm nhưng chắc…"
          hint="Mọi thứ phải GIỐNG NHAU ở mọi cảnh: ngoại hình, màu, trang phục, tỉ lệ, chất liệu, tính cách. Càng cụ thể model càng ít bịa." />
        {f.loai === 'nhan_vat' && <TextField label="Giọng (cho lồng tiếng sau này)" value={f.giong} onChange={(e) => setF({ ...f, giong: e.target.value })} placeholder="giọng trẻ con ấm, chậm rãi" />}
        <div>
          <div style={{ ...mono, textTransform: 'uppercase', marginBottom: 4 }}>Ảnh mẫu (tham chiếu) — tải lên, hoặc lưu rồi bấm “Sinh ảnh mẫu”</div>
          <ImageAttach value={f.anh_ref} onChange={(urls) => setF({ ...f, anh_ref: urls })} folder="xuong-video-anchor" max={4} />
        </div>
      </div>
      {loi && <div style={loiStyle}>{loi}</div>}
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        <GuardedButton reason={!f.ten.trim() && 'thiếu tên'} disabled={luu} style={btnChinh} onClick={async () => {
          setLuu(true); setLoi('');
          const r = await luuNhanVat({ id: goc.id, phim_id: phimId, ...f });
          setLuu(false);
          if (!r.ok) { setLoi(r.loi); return; }
          await onSaved();
        }}>Lưu</GuardedButton>
        <button type="button" style={btn} onClick={onClose}>Đóng</button>
      </div>
    </Drawer>
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

  const chay = async (ten: string, fn: () => Promise<{ ok: boolean; loi?: string } | void>) => {
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
          {phim.loai === 'phim' && <TextField label="Tên tập" value={tenTap} onChange={(e) => setTenTap(e.target.value)} placeholder="Cuộc đua bắt đầu" />}
          <TextAreaField label="Kịch bản" rows={12} value={kichBan} onChange={(e) => setKichBan(e.target.value)} style={{ fontSize: 12 }}
            placeholder={'Dán kịch bản, hoặc dùng ô bên phải cho Claude viết.\nCảnh 1: … \nCảnh 2: …'} />
          {tap.tom_tat && <div style={{ ...mono, marginTop: 4 }}>Tóm tắt (tập sau đọc): {tap.tom_tat}</div>}
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <GuardedButton reason={!kbDirty && 'chưa sửa'} disabled={!!ban} style={btn} onClick={() => void chay('luu', async () => { await suaTap(tap.id, { kich_ban: kichBan, ten: tenTap }); })}>Lưu kịch bản</GuardedButton>
            <TextField type="number" min={0} max={40} value={soCanh || ''} onChange={(e) => setSoCanh(Number(e.target.value) || 0)} placeholder="số cảnh (tự)" style={{ width: 110 }} size="sm" />
            <GuardedButton reason={(!khoa.anthropic && 'thiếu ANTHROPIC_API_KEY') || (!kichBan.trim() && 'chưa có kịch bản')} disabled={!!ban} style={btnChinh}
              title="Claude đọc kịch bản + anchor → bảng cảnh (góc máy, hành động, lời thoại, prompt ảnh, prompt video). Cảnh đã có keyframe giữ nguyên."
              onClick={() => void chay('tach', async () => { if (kbDirty) await suaTap(tap.id, { kich_ban: kichBan, ten: tenTap }); return tachCanhTap(tap.id, soCanh); })}>
              {ban === 'tach' ? '… Claude đang tách' : '✂ Tách cảnh'}
            </GuardedButton>
          </div>
        </div>
        <div>
          <TextAreaField label="Brief cho Claude viết kịch bản" rows={6} value={brief} onChange={(e) => setBrief(e.target.value)}
            placeholder={phim.loai === 'quang_cao' ? 'Sản phẩm, điểm bán chính, khách mục tiêu, hook mở đầu, CTA…' : phim.loai === 'phim' ? 'Tập này kể gì, xung đột, kết tập mở ra tập sau…' : 'Ý tưởng, hook 3 giây đầu, twist, CTA…'} />
          <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
            <TextField type="number" min={8} max={300} value={thoiLuong} onChange={(e) => setThoiLuong(Number(e.target.value) || 30)} style={{ width: 90 }} size="sm" label="giây" />
            <GuardedButton reason={(!khoa.anthropic && 'thiếu ANTHROPIC_API_KEY') || (!brief.trim() && 'viết brief trước')} disabled={!!ban} style={btn}
              onClick={() => void chay('viet', async () => { const r = await vietKichBanTap(tap.id, brief, thoiLuong); if (r.ok) setKichBan(r.data); return r; })}>
              {ban === 'viet' ? '… đang viết' : '✍ Claude viết kịch bản'}
            </GuardedButton>
          </div>
          <div style={{ ...mono, marginTop: 10, lineHeight: 1.6 }}>
            Mạch: kịch bản → <b>Tách cảnh</b> → <b>Sinh keyframe</b> (ảnh, {tien(giaAnhCents(kt.mo_hinh_anh))}/ảnh) → chọn + <b>Duyệt</b> → <b>Sinh video</b> ({tien(giaVideoCents(kt.mo_hinh_video, kt.do_phan_giai, 8))}/8s).
            {uoc && uoc.soCanhDuyet > 0 && <div style={{ color: 'var(--neon-amber)' }}>Đang chờ sinh video: {uoc.soCanhDuyet} cảnh · {uoc.giayDuyet}s ≈ {tien(uoc.videoTong)}</div>}
          </div>
        </div>
      </div>
      {loi && <div style={loiStyle}>{loi}</div>}

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 12 }}>Storyboard · {canh?.length ?? '…'} cảnh</strong>
        <span style={{ flex: 1 }} />
        <GuardedButton reason={(!khoa.google && 'thiếu GOOGLE_API_KEY') || (chuaKeyframe === 0 && 'mọi cảnh đã có keyframe')} disabled={!!ban} style={btn}
          title={`Sinh 1 keyframe cho mỗi cảnh chưa có (${chuaKeyframe} cảnh ≈ ${tien(chuaKeyframe * giaAnhCents(kt.mo_hinh_anh))})`}
          onClick={() => void chay('kf-all', async () => { for (const c of (canh ?? []).filter((x) => !x.keyframe_url)) { const r = await sinhKeyframe(c.id, 1); if (!r.ok) return r; } })}>
          {ban === 'kf-all' ? '… đang sinh ảnh' : `🖼 Sinh keyframe cho ${chuaKeyframe} cảnh thiếu`}
        </GuardedButton>
        <GuardedButton reason={(!khoa.google && 'thiếu GOOGLE_API_KEY') || (soDuyet === 0 && 'chưa có cảnh nào được duyệt')} disabled={!!ban} style={btnChinh}
          title={uoc ? `Veo: ${uoc.soCanhDuyet} cảnh · ${uoc.giayDuyet}s ≈ ${tien(uoc.videoTong)} — trừ vào khoá Google` : ''}
          onClick={() => void chay('vid-all', async () => { for (const c of (canh ?? []).filter((x) => x.trang_thai === 'duyet')) { const r = await sinhVideoCanh(c.id); if (!r.ok) return r; } })}>
          {ban === 'vid-all' ? '… đang gửi Veo' : `🎬 Sinh video ${soDuyet} cảnh đã duyệt${uoc ? ` (≈ ${tien(uoc.videoTong)})` : ''}`}
        </GuardedButton>
        <button type="button" style={btn} disabled={!!ban} onClick={() => void chay('them', async () => { await themCanh(tap.id); })}>+ Cảnh</button>
      </div>

      {canh === null ? <Spinner /> : canh.length === 0 ? (
        <div style={{ ...mono, marginTop: 8 }}>Chưa có cảnh. Dán kịch bản rồi bấm Tách cảnh, hoặc + Cảnh để tự viết.</div>
      ) : (
        <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
          {canh.map((c) => <CanhRow key={c.id} c={c} nhanVat={nhanVat} kt={kt} khoa={khoa} ban={ban} chay={chay} />)}
        </div>
      )}
    </div>
  );
}

// ── Một cảnh ────────────────────────────────────────────────────────────────────────────────────────────────────

function CanhRow({ c, nhanVat, kt, khoa, ban, chay }: {
  c: Canh; nhanVat: NhanVat[]; kt: Required<KinhThanh>; khoa: Khoa; ban: string | null;
  chay: (ten: string, fn: () => Promise<{ ok: boolean; loi?: string } | void>) => Promise<void>;
}) {
  const [mo, setMo] = useState(false);
  const [f, setF] = useState(c);
  useEffect(() => { setF(c); }, [c]);
  const tt = TRANG_THAI_CANH[c.trang_thai] ?? TRANG_THAI_CANH.nhap;
  const dirty = JSON.stringify(f) !== JSON.stringify(c);
  const tenNv = (ids: number[]) => ids.map((i) => nhanVat.find((v) => v.id === i)?.ten).filter(Boolean).join(', ');
  const w = kt.ti_le === '9:16' ? 68 : 120;
  const anhKhung: CSSProperties = { width: w, height: kt.ti_le === '9:16' ? 120 : 68, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)' };
  const khoaKey = `c${c.id}`;

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 8, background: 'var(--bg-1)' }}>
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
            <Pill color={tt.color} label={tt.label} size="sm" />
            <span style={mono}>{c.thoi_luong_s}s · {c.goc_may}</span>
            {c.nhan_vat.length > 0 && <span style={mono}>· {tenNv(c.nhan_vat)}</span>}
            {c.chi_phi_cents > 0 && <span style={mono}>· {tien(c.chi_phi_cents)}</span>}
            <span style={{ flex: 1 }} />
            <button type="button" style={btn} onClick={() => setMo((v) => !v)}>{mo ? 'Thu' : 'Sửa'}</button>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--fg-1)', marginTop: 3 }}>{c.hanh_dong}</div>
          {c.loi_thoai && <div style={{ fontSize: 11, color: 'var(--fg-2)', fontStyle: 'italic' }}>“{c.loi_thoai}”</div>}
          {c.loi && <div style={loiStyle}>{c.loi}</div>}
          {c.keyframe_uv.length > 1 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
              {c.keyframe_uv.map((u) => (
                <button key={u} type="button" title={u === c.keyframe_url ? 'đang chọn' : 'chọn ảnh này làm keyframe'} onClick={() => void chay(khoaKey, async () => { await chonKeyframe(c.id, u); })}
                  style={{ padding: 0, border: u === c.keyframe_url ? '2px solid var(--neon-cyan)' : '2px solid transparent', borderRadius: 6, background: 'none', cursor: 'pointer' }}>
                  <img src={u} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4, display: 'block' }} />
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            <GuardedButton reason={(!khoa.google && 'thiếu GOOGLE_API_KEY') || (!c.prompt_anh.trim() && 'chưa có prompt ảnh (Sửa → prompt ảnh)')} disabled={!!ban} style={btn}
              title={`1 ảnh ≈ ${tien(giaAnhCents(kt.mo_hinh_anh))}`} onClick={() => void chay(khoaKey, () => sinhKeyframe(c.id, 1))}>
              {ban === khoaKey ? '…' : c.keyframe_url ? '🖼 Thêm ứng viên' : '🖼 Sinh keyframe'}
            </GuardedButton>
            {c.keyframe_url && c.trang_thai !== 'duyet' && c.trang_thai !== 'dang_sinh' && c.trang_thai !== 'xong' && (
              <button type="button" style={btnChinh} disabled={!!ban} onClick={() => void chay(khoaKey, () => duyetCanh(c.id, true))}>✓ Duyệt keyframe</button>
            )}
            {c.trang_thai === 'duyet' && (
              <>
                <GuardedButton reason={!khoa.google && 'thiếu GOOGLE_API_KEY'} disabled={!!ban} style={btnChinh} title={`Veo ${c.thoi_luong_s}s ≈ ${tien(giaVideoCents(kt.mo_hinh_video, kt.do_phan_giai, c.thoi_luong_s))}`}
                  onClick={() => void chay(khoaKey, () => sinhVideoCanh(c.id))}>🎬 Sinh video</GuardedButton>
                <button type="button" style={btn} disabled={!!ban} onClick={() => void chay(khoaKey, () => duyetCanh(c.id, false))}>bỏ duyệt</button>
              </>
            )}
            {c.trang_thai === 'dang_sinh' && <span style={{ ...mono, color: 'var(--neon-violet)' }}>Veo đang chạy, tự kiểm mỗi 10s…</span>}
            {(c.trang_thai === 'xong' || c.trang_thai === 'loi') && c.keyframe_url && (
              <GuardedButton reason={!khoa.google && 'thiếu GOOGLE_API_KEY'} disabled={!!ban} style={btn} onClick={() => void chay(khoaKey, () => sinhVideoCanh(c.id))}>↻ Sinh lại video</GuardedButton>
            )}
            {c.video_url && <a href={c.video_url} target="_blank" rel="noreferrer" style={{ ...btn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>⬇ mp4</a>}
            <ConfirmDeleteButton labelIdle="🗑" labelArmed="⚠ xoá cảnh?" onDelete={() => chay(khoaKey, async () => { await xoaCanh(c.id); })} style={btn} />
          </div>
        </div>
      </div>
      {mo && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--line)' }}>
          <TextField label="Nhãn cảnh" value={f.canh} onChange={(e) => setF({ ...f, canh: e.target.value })} />
          <TextField label="Góc máy" value={f.goc_may} onChange={(e) => setF({ ...f, goc_may: e.target.value })} />
          <SelectField label="Thời lượng" value={String(f.thoi_luong_s)} onChange={(e) => setF({ ...f, thoi_luong_s: Number(e.target.value) })}>
            <option value="4">4s</option><option value="6">6s</option><option value="8">8s</option>
          </SelectField>
          <SelectField label="Anchor trong cảnh" multiple value={f.nhan_vat.map(String)} onChange={(e) => setF({ ...f, nhan_vat: Array.from(e.target.selectedOptions).map((o) => Number(o.value)) })} hint="giữ Ctrl/⌘ để chọn nhiều" style={{ minHeight: 60 }}>
            {nhanVat.map((v) => <option key={v.id} value={v.id}>{v.ten}</option>)}
          </SelectField>
          <TextAreaField label="Hành động" gridColumn="1 / -1" rows={2} value={f.hanh_dong} onChange={(e) => setF({ ...f, hanh_dong: e.target.value })} />
          <TextField label="Lời thoại" value={f.loi_thoai} onChange={(e) => setF({ ...f, loi_thoai: e.target.value })} />
          <TextField label="Âm thanh" value={f.am_thanh} onChange={(e) => setF({ ...f, am_thanh: e.target.value })} />
          <TextAreaField label="Prompt ảnh (keyframe, tiếng Anh)" gridColumn="1 / -1" rows={3} value={f.prompt_anh} onChange={(e) => setF({ ...f, prompt_anh: e.target.value })} mono />
          <TextAreaField label="Prompt video (chuyển động, tiếng Anh)" gridColumn="1 / -1" rows={3} value={f.prompt_video} onChange={(e) => setF({ ...f, prompt_video: e.target.value })} mono />
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 6 }}>
            <GuardedButton reason={!dirty && 'chưa sửa'} disabled={!!ban} style={btnChinh} onClick={() => void chay(khoaKey, async () => {
              await suaCanh(c.id, { canh: f.canh, goc_may: f.goc_may, thoi_luong_s: f.thoi_luong_s, nhan_vat: f.nhan_vat, hanh_dong: f.hanh_dong, loi_thoai: f.loi_thoai, am_thanh: f.am_thanh, prompt_anh: f.prompt_anh, prompt_video: f.prompt_video });
              setMo(false);
            })}>Lưu cảnh</GuardedButton>
            <button type="button" style={btn} onClick={() => { setF(c); setMo(false); }}>Huỷ</button>
          </div>
        </div>
      )}
    </div>
  );
}

