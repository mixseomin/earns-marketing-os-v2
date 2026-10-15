'use client';
// Xưởng video AI (studio.on.tc) — một màn: danh sách phim → drawer phim (kinh thánh · tuyến nhân vật · tập · storyboard từng tập).
// Storyboard = bảng cảnh: mỗi dòng một cảnh (xương sống dữ liệu); keyframe sinh → chọn → duyệt → video. Canvas node + timeline (G2/G3)
// là hai cách nhìn khác của cùng bảng này, không có dữ liệu riêng.
import { Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useModalParam } from '@/lib/use-modal-param';
import { Ngan } from './ngan';
import { moNgan } from './ngan-chung';
import { MAU_PHIM } from '@/lib/xuong-video/mau';
import { nhomPhim, demKieu, laLuuTru, TEN_KIEU, type KieuNhom } from '@/lib/xuong-video/nhom-phim';
import { dsPhim, luuTruPhim, luuThanhTemplate, docPhim, taoPhim, taoPhimMau, xoaPhim, taoTap, dsMoHinh, dsThungRac, khoiPhuc, docHoanTac, hoanTac, type MoHinhChon, type PhimDayDu } from '@/lib/actions';
import type { MucHoanTac } from '@/lib/xuong-video/hoan-tac';
import { LOAI_PHIM, docKinhThanh, giaAnhCents, giaVideoCents, tien, gioVN, type Phim, type Job, type LoaiPhim } from '@/lib/xuong-video/kieu';
import { Khoa, TabPhim, TAB_PHIM, O, Pill, Seg, Nut, Xoa, Loi, Menu, MucMenu, mono } from './ui';
import { MoHinhCtx } from './mo-hinh-ui';
import { KinhThanhForm } from './kinh-thanh';
import { NhanVatSection } from './nhan-vat';
import { TapView } from './tap';
import { PosterPhim } from './poster-ui';
import { AnhQcPhim } from './anh-qc-ui';
import { ChipGocSpy, GocSpyPanel } from './goc-spy-ui';
import { useNho } from './nho';
import { useDinhKy } from './dinh-ky';
import { anhNho } from '@/lib/xuong-video/anh-nho';
import { SoDoSeries } from './so-do';
import { TemplatePanel, KhoTemplate } from './template-ui';
import { taNguon, taThu } from '@/lib/xuong-video/cong-ai';

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
  const chong = useModalParam(KHOA_CHONG.m);
  const [locKieu, setLocKieu] = useNho<KieuNhom | ''>('xv-loc-kieu', '', ['', 'template', 'series', 'quang_cao', 'phim']);
  const [locTim, setLocTim] = useState('');
  const [hienLuuTru, setHienLuuTru] = useState(false);
  const [tapMo, setTapMo] = useState<number | null>(null);   // bấm chip tập → mở ngăn phim đúng tập
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

      <KhoTemplate ds={phim.filter((p) => p.kinh_thanh?.template && !laLuuTru(p))} onMo={(id) => { setTapMo(null); modal.open('phim', id); }} />

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
      ) : (() => {
        // NHÓM (series / thương hiệu) → PHIM (từng bản) → TẬP, có bộ lọc (nhom-phim.ts).
        const nhom = nhomPhim(phim, { kieu: locKieu, tim: locTim, luuTru: hienLuuTru });
        const dem = demKieu(phim); const soLuuTru = phim.filter(laLuuTru).length;
        return (
          <div className="xv-panel" style={{ padding: 0 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
              <Seg options={[{ value: '' as const, label: `Tất cả ${dem.series + dem.quang_cao + dem.phim}` }, ...(['template', 'series', 'quang_cao', 'phim'] as const).map((k) => ({ value: k, label: `${TEN_KIEU[k]} ${dem[k]}` }))]} value={locKieu} onChange={setLocKieu} />
              <input className="xv-in" style={{ width: 220 }} value={locTim} onChange={(e) => setLocTim(e.target.value)} placeholder="🔍 tìm phim, series, tập…" />
              {soLuuTru > 0 && <label style={{ ...mono, display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={hienLuuTru} onChange={(e) => setHienLuuTru(e.target.checked)} />hiện bản lưu trữ ({soLuuTru})</label>}
              <span style={{ flex: 1 }} /><span style={mono}>{nhom.length} nhóm · {nhom.reduce((a, g) => a + g.phim.length, 0)} phim</span>
            </div>
            {!nhom.length && <div style={{ ...mono, padding: 16 }}>Không có phim khớp bộ lọc.</div>}
            {nhom.map((g) => (
              <section key={g.key} style={{ borderBottom: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '10px 12px 4px', background: 'var(--bg-1)' }}>
                  <b style={{ fontSize: 14 }}>{g.kieu === 'template' ? '🧩 ' : g.kieu === 'series' ? '📺 ' : g.kieu === 'quang_cao' ? '📣 ' : '🎬 '}{g.ten}</b>
                  <Pill color="var(--fg-3)">{TEN_KIEU[g.kieu]}</Pill>
                  <span style={mono}>{g.kieu === 'quang_cao' ? `${g.phim.length} video · ${g.phim.reduce((a, p) => a + (p.so_anh_qc ?? 0), 0)} ảnh QC` : `${g.phim.length} phim · ${g.phim.reduce((a, p) => a + p.so_tap, 0)} tập`} · {tien(g.chi_phi_cents)}</span>
                </div>
                {g.phim.map((p) => (
                  <div key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 12px 8px 28px', opacity: laLuuTru(p) ? 0.55 : 1 }}>
                    <button type="button" title={p.poster_url ? 'Poster — mở phim' : 'Chưa có poster — mở phim, tab 🎭 Phim › Poster'} onClick={() => { setTapMo(null); modal.open('phim', p.id); }}
                      style={{ all: 'unset', cursor: 'pointer', width: 44, aspectRatio: '2 / 3', flexShrink: 0, borderRadius: 4, border: '1px solid var(--line)', background: p.poster_url ? `center / cover no-repeat url(${p.poster_url}), #111` : 'var(--bg-2)', display: 'grid', placeItems: 'center', fontSize: 16, color: 'var(--fg-4)' }}>{p.poster_url ? '' : '🎬'}</button>
                    <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => { setTapMo(null); modal.open('phim', p.id); }} style={{ background: 'none', border: 0, color: 'var(--fg-1)', cursor: 'pointer', fontWeight: 600, padding: 0, font: 'inherit', textAlign: 'left' }}>{p.ten}</button>
                      {laLuuTru(p) && <Pill color="var(--fg-4)">lưu trữ</Pill>}
                      <span style={mono}>{LOAI_PHIM.find((l) => l.key === p.loai)?.label ?? p.loai} · {p.so_nhan_vat} anchor · {p.so_canh} cảnh · {tien(p.chi_phi_cents)}</span>
                    </div>
                    {!!p.goc_spy?.length && <ChipGocSpy ds={p.goc_spy} gon />}
                    {!!p.so_anh_qc && <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={mono}>🖼 {p.so_anh_qc} ảnh QC</span>
                      {(p.anh_qc_tom ?? []).map((a) => <img key={a.id} src={anhNho(a.url, 160)} alt="" title="Ảnh QC — mở phim, tab 🎭 Phim › Ảnh QC" onClick={() => { setTapMo(null); modal.open('phim', p.id); }}
                        style={{ height: 52, aspectRatio: a.ti_le.replace(':', ' / '), objectFit: 'cover', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--line)' }} />)}
                    </div>}
                    {!!p.tap_tom?.length && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {p.tap_tom.map((t) => (
                        <button key={t.id} type="button" className="xv-btn" style={{ padding: '2px 8px', fontSize: 11.5 }} title={`Mở tập ${t.so}`} onClick={() => { setTapMo(t.id); modal.open('phim', p.id); }}>
                          <b>Tập {t.so}</b>{t.ten && t.ten !== p.ten ? ` · ${t.ten}` : ''} <span style={{ color: t.so_canh && t.so_hinh === t.so_canh ? '#4ade80' : 'var(--fg-3)' }}>· {t.so_hinh}/{t.so_canh} hình</span> <span style={{ color: t.so_canh && t.so_clip === t.so_canh ? '#4ade80' : 'var(--fg-3)' }}>· {t.so_clip} clip</span>
                        </button>
                      ))}
                    </div>}
                    </div>
                  </div>
                ))}
              </section>
            ))}
          </div>
        );
      })()}

      {/* key = mã phim: mở phim KHÁC trong cùng ngăn (🧩 từ #…, phim đang dùng template) phải dựng lại cả ngăn — giữ component cũ thì form tự lưu
          của phim trước ghi đè sang phim mới (15/10/2026: kinh thánh #36 đè lên template #24). */}
      {modal.is('phim') && modal.numId != null && (
        <PhimDrawer key={modal.numId} id={modal.numId} tapDau={tapMo} khoa={khoa} onClose={() => { modal.close(); void taiLai(); }} onXoa={async () => { await xoaPhim(modal.numId!); modal.close(); await taiLai(); }} />
      )}
      {/* NGĂN CHỒNG (anh 15/10/2026: "mở template vào drawer" — không thay phim đang xem, không mở tab mới): phim thứ hai mở từ trong ngăn phim
          (🧩 từ #…, phim đang dùng template) nằm đè lên, đóng là về đúng phim cũ. Khoá URL riêng (m2 / tap2 / tab2) → F5 mở lại cả hai lớp. */}
      {chong.is('phim') && chong.numId != null && modal.is('phim') && (
        <PhimDrawer key={`c${chong.numId}`} id={chong.numId} khoa={khoa} khoaUrl={KHOA_CHONG} onClose={() => { chong.close(); void taiLai(); }} onXoa={async () => { await xoaPhim(chong.numId!); chong.close(); await taiLai(); }} />
      )}
    </div>
    </MoHinhCtx.Provider>
  );
}

// ── Drawer phim ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Khoá URL của một lớp ngăn phim: lớp chính m/tap/tab; lớp chồng m2/tap2/tab2 (hai lớp không giành tham số của nhau). */
type KhoaUrl = { m: string; tap: string; tab: string };
const KHOA_CHINH: KhoaUrl = { m: 'm', tap: 'tap', tab: 'tab' };
const KHOA_CHONG: KhoaUrl = { m: 'm2', tap: 'tap2', tab: 'tab2' };

function PhimDrawer({ id, tapDau, khoa, onClose, onXoa, khoaUrl = KHOA_CHINH }: { id: number; tapDau?: number | null; khoa: Khoa; onClose: () => void; onXoa: () => Promise<void>; khoaUrl?: KhoaUrl }) {
  const [d, setD] = useState<PhimDayDu | null | undefined>(undefined);
  const tapParam = useModalParam(khoaUrl.tap);
  const modal = useModalParam(khoaUrl.m);
  /** Mở phim KHÁC từ trong ngăn này → lớp chồng (không thay phim đang xem). */
  const chong = useModalParam(KHOA_CHONG.m);
  const tai = useCallback(async () => setD(await docPhim(id)), [id]);
  useEffect(() => { void tai(); }, [tai]);
  // Tab đang mở, nhớ theo phim (đọc ngay từ đầu, chỉ ghi khi bấm — cùng cách với khung thu gọn #1212).
  const [tab, setTab] = useNho<TabPhim>(`xv-tab-${id}`, 'phim', TAB_PHIM.map((t) => t.key), khoaUrl.tab);
  // Job ảnh còn chạy trên máy chủ (kể cả sau F5) → hỏi lại mỗi 4s tới khi xong.
  const conChay = !!d && (d.dangSinh.nhanVat.length > 0 || d.dangSinh.bienThe.length > 0 || d.dangSinh.poster > 0);
  useDinhKy(tai, conChay ? 4000 : 15000);

  if (d === undefined) return <Ngan onClose={onClose}><span style={mono}>đang tải…</span></Ngan>;
  if (d === null) return <Ngan onClose={onClose}><b>Không thấy phim</b></Ngan>;
  const { phim, nhanVat, tap } = d;
  const tapId = tapParam.numId && tap.some((t) => t.id === tapParam.numId) ? tapParam.numId : tapDau && tap.some((t) => t.id === tapDau) ? tapDau : (tap[0]?.id ?? null);

  return (
    <Ngan onClose={onClose} tieuDe={phim.ten} nut={<>
      {phim.poster_url && <img src={anhNho(phim.poster_url, 160)} alt="" title="Poster (tab 🎭 Phim › Poster)" style={{ height: 34, aspectRatio: '2 / 3', objectFit: 'cover', borderRadius: 4, border: '1px solid var(--line)' }} />}
      <Pill color="var(--fg-3)">{LOAI_PHIM.find((l) => l.key === phim.loai)?.label ?? phim.loai}</Pill>
      {phim.kinh_thanh?.template && <Pill color="var(--violet)">🧩 Template</Pill>}
      {phim.kinh_thanh?.tu_template && <button type="button" className="xv-lienket xv-mono" title="Phim này tạo từ template — mở template ở ngăn chồng lên trên" onClick={() => chong.open('phim', phim.kinh_thanh!.tu_template!.id)}>🧩 từ #{phim.kinh_thanh.tu_template.id}</button>}
      <span style={mono} data-ngu-canh={`phim #${phim.id} ${phim.ten}`}>#{phim.id}</span>
      <ThongKe tk={d.thongKe} tongTien={d.tongTien} soAnchor={nhanVat.length} soTap={tap.length} />
      <HoanTac phimId={phim.id} onDone={tai} />
      <ThungRac phimId={phim.id} onKhoiPhuc={tai} />
      {/* Ít dùng / nguy hiểm → sau ⋯ (YDNI, #1277). */}
      <Menu>
        <MucMenu onClick={() => moNgan({ loai: 'thu-vien', tl: docKinhThanh(phim.kinh_thanh).the_loai })}>🎬 Thư viện điện ảnh</MucMenu>
        <MucMenu onClick={() => moNgan({ loai: 'kho' })}>📦 Kho tài sản</MucMenu>
        {!phim.kinh_thanh?.template && <MucMenu onClick={async () => { const r = await luuThanhTemplate(phim.id, `Template · ${phim.ten}`); if (r.ok) modal.open('phim', r.data); }}>🧩 Lưu thành template (bản sao — phim này giữ nguyên)</MucMenu>}
        <MucMenu onClick={async () => { await luuTruPhim(phim.id, !phim.kinh_thanh?.luu_tru); await tai(); }}>{phim.kinh_thanh?.luu_tru ? '📤 Bỏ lưu trữ (hiện lại trong danh sách)' : '🗄 Lưu trữ (ẩn khỏi danh sách, không xoá)'}</MucMenu>
        <Xoa nhan="cả phim (tập + cảnh)" onXoa={onXoa} />
      </Menu>
    </>} dau={
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {TAB_PHIM.map((t) => <button key={t.key} type="button" className={`xv-btn${tab === t.key ? ' chinh' : ''}`} title={t.mo} onClick={() => setTab(t.key)}>{t.label}</button>)}
      </div>
    }>
      {tab === 'so_do' && <SoDoSeries phim={phim} tap={tap} nhanVat={nhanVat} onChanged={tai} onMoTap={(id) => { tapParam.open('tap', id); setTab('kich_ban'); }} />}
      {tab === 'phim' && <>
        {phim.kinh_thanh?.template && <TemplatePanel phim={phim} onChanged={tai} onMoPhim={(pid) => modal.open('phim', pid)} onMoPhimChong={(pid) => chong.open('phim', pid)} />}
        {phim.loai === 'quang_cao' && !phim.kinh_thanh?.template && <GocSpyPanel phim={phim} onChanged={tai} />}
        <KinhThanhForm phim={phim} khoa={khoa} onSaved={tai} />
        <NhanVatSection phimId={phim.id} nhanVat={nhanVat} kinhThanh={phim.kinh_thanh} khoa={khoa} dangSinh={d.dangSinh} loiAnh={d.loiAnh} onChanged={tai} />
        <PosterPhim phim={phim} nhanVat={nhanVat} dang={d.dangSinh.poster} loiNen={d.loiPoster} onChanged={tai} />
        {phim.loai === 'quang_cao' && <AnhQcPhim phim={phim} nhanVat={nhanVat} />}
      </>}

      {/* Phần theo TẬP. Không tiêu đề mục (tên tab đã nói); hàng chọn tập chỉ hiện khi có thứ để chọn (phim nhiều tập / chưa có tập). */}
      {tab !== 'phim' && tab !== 'so_do' && <div className="xv-panel">
        {(phim.loai === 'phim' || tap.length !== 1) && <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          {tap.length > 0 && (
            <Seg options={tap.map((t) => ({ value: t.id, label: `${phim.loai === 'phim' ? `Tập ${t.so}` : 'Tập'}${t.ten && t.ten !== phim.ten ? ` · ${t.ten}` : ''} (${t.so_canh})` }))} value={tapId ?? 0} onChange={(v) => tapParam.open('tap', v)} />
          )}
          {(phim.loai === 'phim' || tap.length === 0) && (
            <button type="button" className="xv-btn" onClick={async () => { const r = await taoTap(phim.id, ''); if (r.ok) { await tai(); tapParam.open('tap', r.data); } }}>+ Thêm tập</button>
          )}
        </div>}
        {tapId != null && <TapView key={tapId} tap={tap.find((t) => t.id === tapId)!} phim={phim} nhanVat={nhanVat} khoa={khoa} onChanged={tai} tab={tab} />}
      </div>}
      {tab === 'xuat' && <ChiPhiGanDay jobs={d.ganDay} tong={d.tongTien} phimId={phim.id} />}
    </Ngan>
  );
}

// ── Chi phí: mỗi lần sinh một dòng (đầy đủ ở /log) ────────────────────────────────────────────────────────────

const MAU_LOAI: Record<string, string> = { chu: 'var(--cyan)', anh: 'var(--amber)', video: 'var(--violet)' };

const NHAN_LOAI: Record<string, string> = { chu: 'Chữ', anh: 'Ảnh', video: 'Video' };

/** Sổ chi phí gần đây — panel phụ của tab Xuất → gập mặc định (YDNI luật 5), tổng tiền vẫn thấy; mở/gập nhớ trên máy. */
function ChiPhiGanDay({ jobs, tong, phimId }: { jobs: Job[]; tong: number; phimId: number }) {
  const [mo, setMo] = useNho<'0' | '1'>('xv-chi-phi-mo', '0', ['0', '1']);
  return (
    <div className="xv-panel" style={{ padding: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: mo === '1' && jobs.length ? 6 : 0 }}>
        <button type="button" className="xv-btn" onClick={() => setMo(mo === '1' ? '0' : '1')} title={mo === '1' ? 'Gập' : 'Xem các lần gọi AI gần đây'}>{mo === '1' ? '▴' : '▾'}</button>
        <b style={{ fontSize: 12 }}>Chi phí phim này: {tien(tong)}</b>
        <span style={mono}>{jobs.length} lần gọi gần đây · giá niêm yết</span>
        <span style={{ flex: 1 }} />
        <button type="button" className="xv-lienket xv-mono" onClick={() => moNgan({ loai: 'so-chi-phi', phim: phimId })}>xem sổ đầy đủ →</button>
      </div>
      {mo === '1' && jobs.map((j) => (
        <div key={j.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, padding: '2px 0', borderTop: '1px dashed var(--line)' }}>
          <span style={{ ...mono, width: 78 }}>{gioVN(j.created_at)}</span>
          <Pill color={MAU_LOAI[j.loai] ?? 'var(--fg-3)'}>{NHAN_LOAI[j.loai] ?? j.loai}</Pill>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={j.loi || j.nhan}>{j.nhan || j.model}{j.loi ? <span style={{ color: 'var(--red)' }}> · lỗi</span> : null}</span>
          <span style={mono} title={j.nguon ? taThu(j.nguon) : undefined}>{j.nguon ? taNguon(j.nguon) : j.model}</span>
          <b style={{ fontFamily: 'var(--font-mono)', width: 56, textAlign: 'right', color: j.trang_thai === 'cho' || j.trang_thai === 'chay' ? 'var(--violet)' : undefined }}>{j.trang_thai === 'cho' || j.trang_thai === 'chay' ? 'đang…' : tien(j.chi_phi_cents)}</b>
        </div>
      ))}
    </div>
  );
}

// ── Kinh thánh (bible) ──────────────────────────────────────────────────────────────────────────────────────────

const NHAN_RAC: Record<string, string> = { phim: 'phim', tap: 'tập', canh: 'cảnh', nhan_vat: 'anchor', bien_the: 'biến thể', anh_goc: 'ảnh gốc', keyframe: 'keyframe', anh_bien_the: 'ảnh biến thể' };

/** ↶ Hoàn tác thao tác mới nhất của phim (#1252): sửa shot/tập/kinh thánh, chọn keyframe/bản video, duyệt, đổi giọng, xếp thứ tự.
 *  Máy chụp giá trị cũ trước mỗi lần ghi (lib/hoan-tac.ts); nút hỏi máy chủ 4s/lần để luôn hiện đúng việc mới nhất. Xoá thì ở 🗑. */
function HoanTac({ phimId, onDone }: { phimId: number; onDone: () => Promise<void> }) {
  const [m, setM] = useState<MucHoanTac | null>(null);
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState('');
  const nap = useCallback(async () => { const r = await docHoanTac(phimId); if (r.ok) setM(r.data); }, [phimId]);
  useEffect(() => { void nap(); }, [nap]);
  useDinhKy(nap, 4000);
  const lam = async () => { setDang(true); setLoi(''); const r = await hoanTac(phimId); setDang(false); if (!r.ok) { setLoi(r.loi); return; } await onDone(); await nap(); };
  return (
    <>
      <button type="button" className="xv-btn" disabled={!m || dang} onClick={() => void lam()} title={m ? `Hoàn tác: ${m.mo_ta} (${gioVN(m.luc, { chiGio: true })})` : 'Chưa có thao tác nào để hoàn tác'}>
        {dang ? '…' : '↶'}
      </button>
      {loi && <span style={{ ...mono, color: 'var(--red)' }}>{loi}</span>}
    </>
  );
}

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
      <button type="button" className="xv-btn" onClick={() => setMo(true)} title={`Thùng rác${ds?.length ? ` (${ds.length})` : ''} — thứ đã bỏ, khôi phục được`}>🗑{ds?.length ? ` ${ds.length}` : ''}</button>
      {mo && (
        <Ngan nho onClose={() => setMo(false)} tieuDe={`🗑 Thùng rác${phimId == null ? ' · phim đã xoá' : ''}`}>
          <div style={{ ...mono, marginBottom: 8 }}>Bỏ vào đây = gỡ khỏi màn, dữ liệu + ảnh giữ nguyên. Khôi phục đưa về đúng chỗ cũ (cùng id, cùng sổ chi phí).</div>
          <Loi>{loi}</Loi>
          {ds === null ? <span style={mono}>…</span> : ds.length === 0 ? <div style={mono}>Thùng rác trống.</div> : (
            <div style={{ display: 'grid', gap: 6 }}>
              {ds.map((m) => (
                <div key={m.id} className="xv-canh" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {m.anh ? <img src={anhNho(m.anh, 160)} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 5, flexShrink: 0 }} /> : <div style={{ width: 44, height: 44, borderRadius: 5, background: 'var(--bg-2)', flexShrink: 0 }} />}
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
      {/* Hai chip (#1277): tiền (đã tốn · thực tế nếu không lặp lại) và tiến độ — chi tiết trong tooltip. */}
      {chip('💰', <>{tien(tongTien)} · 🎯 {tien(tk.tienDung)}</>, `Đã tốn ${tien(tongTien)} — ảnh ${tien(tk.tienAnh)} · video ${tien(tk.tienVideo)} · chữ (Claude) ${tien(tk.tienChu)} · ${tk.soLanSinh} lần sinh thành công\n🎯 Chi phí thực tế nếu không phải lặp lại: ${tien(tk.tienDung)} — chỉ lượt sinh ra thứ đang nằm trong phim + lượt Claude mới nhất mỗi việc\nmất vì sinh lại / bỏ / lỗi: ${tien(Math.max(0, tongTien - tk.tienDung))}`, 'var(--amber)')}
      {chip('🎬', `${tk.soCanh} cảnh · ${phut} · 🎞 ${tk.nhap}/${tk.soCanh}`, `${soTap} tập · ${tk.soCanh} cảnh, ${tk.giay} giây\n🖼 keyframe ${tk.coKf}/${tk.soCanh} (đã duyệt ${tk.duyet}) · 🎞 video nháp ${tk.nhap}/${tk.soCanh} · ✅ bản cuối ${tk.cuoi}/${tk.soCanh}\n👤 ${soAnchor} anchor · ${tk.anhGoc} ảnh gốc · 🎭 biến thể ${tk.btCoAnh}/${tk.bienThe} có ảnh`)}
    </div>
  );
}

// ── Anchor: nhân vật / sản phẩm / bối cảnh ───────────────────────────────────────────────────────────────────────
