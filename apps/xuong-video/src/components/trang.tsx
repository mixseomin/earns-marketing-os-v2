'use client';
// Xưởng video AI (studio.on.tc) — một màn: danh sách phim → drawer phim (kinh thánh · tuyến nhân vật · tập · storyboard từng tập).
// Storyboard = bảng cảnh: mỗi dòng một cảnh (xương sống dữ liệu); keyframe sinh → chọn → duyệt → video. Canvas node + timeline (G2/G3)
// là hai cách nhìn khác của cùng bảng này, không có dữ liệu riêng.
import { MayDungPanel } from './may-dung-ui';
import { TuDong } from './may-ui';
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useModalParam } from '@/lib/use-modal-param';
import { Ngan } from './ngan';
import { moNgan } from './ngan-chung';
import { MAU_PHIM } from '@/lib/xuong-video/mau';
import { nhomPhim, demKieu, laLuuTru, anhDaiDien, TEN_KIEU, type KieuNhom } from '@/lib/xuong-video/nhom-phim';
import { dsPhim, luuTruPhim, luuThanhTemplate, docPhim, taoPhim, taoPhimMau, xoaPhim, taoTap, dsMoHinh, dsThungRac, khoiPhuc, docHoanTac, hoanTac, baoCaoChuanBiAction, type MoHinhChon, type PhimDayDu } from '@/lib/actions';
import type { MucHoanTac } from '@/lib/xuong-video/hoan-tac';
import { LOAI_PHIM, docKinhThanh, giaAnhCents, giaVideoCents, tien, gioVN, type Phim, type Job, type LoaiPhim } from '@/lib/xuong-video/kieu';
import { Khoa, type TabPhim, Pill, Seg, Nut, Xoa, Loi, Menu, MucMenu, mono } from './ui';
import { MoHinhCtx } from './mo-hinh-ui';
import { KinhThanhForm } from './kinh-thanh';
import { NhanVatSection, BienTheChiTiet } from './nhan-vat';
import { PhanRaPanel } from './phan-ra';
import type { BaoCaoPhim } from '@/lib/xuong-video/phan-ra';
import { TapView } from './tap';
import { PosterPhim } from './poster-ui';
import { AnhQcPhim } from './anh-qc-ui';
import { ChipGocSpy, GocSpyPanel } from './goc-spy-ui';
import { useNho, useMoUrl } from './nho';
import { useDinhKy } from './dinh-ky';
import { anhNho } from '@/lib/xuong-video/anh-nho';
import { SoDoSeries, BanDoTap, khau } from './so-do';
import { Chon } from './chon';
import { CayPhim, type NutPhim } from './cay-phim';
import { XuatHien } from './thanh-phan-ui';
import { nhomCayAnchor } from '@/lib/xuong-video/cay-anchor';
import { TemplatePanel, KhoTemplate } from './template-ui';
import { DanhSachSanPham, NganSanPham } from './kho-creative-ui';
import { taNguon, taThu } from '@/lib/xuong-video/cong-ai';
import { ghiThamSoUrl } from '@/lib/ghi-url';

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
  const [locKieu, setLocKieu] = useNho<KieuNhom | ''>('xv-loc-kieu', '', ['', 'series', 'quang_cao', 'phim']);   // template + video máy có cửa riêng, không còn là bộ lọc
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
  const dem = demKieu(phim); const soLuuTru = phim.filter(laLuuTru).length;
  // YDNI trang chủ (anh 15/10/2026: "YDNI lại trang home"): trước là 4 khối chồng dọc (chỉ số · kho template · tạo mới · danh sách) dài ~4.300px.
  // Giờ MỘT MÀN: đầu ghim (tab Phim | Template · bộ lọc · chỉ số một dòng · ＋ Tạo mới gập sẵn), nội dung cuộn TRONG khung bên dưới.
  // BA CỬA VÀO (anh 17/10/2026, duyệt bản xem): ⚙ Tự động = máy ra video hàng loạt 0đ (may-ui.tsx) · 🧩 Theo template = QC nhân từ khuôn, người
  // duyệt từng bước (kho template + video tạo từ mỗi template) · 🎬 Làm tự do = phim không theo máy / template. 📦 Sản phẩm giữ như cũ.
  const [khoTab, setKhoTab] = useNho<'tu_dong' | 'template' | 'tu_do' | 'sanpham'>('xv-kho-tab', 'tu_dong', ['tu_dong', 'template', 'tu_do', 'sanpham'], 'kho');
  const tuDo = phim.filter((p) => !p.kinh_thanh?.tu_template && p.loai !== 'may_dung');   // video tạo từ template nằm dưới template của nó
  // Ngăn một sản phẩm (kho creative): khoá sản phẩm trong URL (?sp=) → F5 / chia sẻ mở lại đúng sản phẩm.
  const [spMo, setSpMoState] = useState<string | null>(null);
  useLayoutEffect(() => { const k = new URLSearchParams(window.location.search).get('sp'); if (k) setSpMoState(k); }, []);   // sau hydrate, như nho.ts
  const setSpMo = (k: string | null) => { setSpMoState(k); ghiThamSoUrl(k ? { sp: k } : { sp: null, sptab: null }); };
  const [moTao, setMoTao] = useState(false);
  const moPhim = (id: number) => { setTapMo(null); modal.open('phim', id); };

  return (
    <MoHinhCtx.Provider value={moHinh}>
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 110px)' }}>
      {thieu.length > 0 && <div className="xv-banner">Máy chủ thiếu: {thieu.join(' · ')} — đặt trong .env.production rồi restart mos2-studio. Trang vẫn soạn được, nút sinh sẽ báo lỗi tới khi có khoá.</div>}
      <div className="xv-panel" style={{ padding: '8px 10px', marginBottom: 8, display: 'grid', gap: 6, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Seg options={[
            { value: 'tu_dong' as const, label: '⚙ Tự động', title: 'Máy chạy một mình mỗi ngày, ra video hàng loạt · 0đ, không cần người' },
            { value: 'template' as const, label: '🧩 Theo template', title: `Video QC nhân từ khuôn, người bấm và duyệt từng bước · ${dem.template} template · ${phim.filter((p) => p.kinh_thanh?.tu_template && !laLuuTru(p)).length} video` },
            { value: 'tu_do' as const, label: '🎬 Làm tự do', title: `Series, phim ngắn, video organic, QC làm riêng · ${tuDo.filter((p) => !laLuuTru(p) && !p.kinh_thanh?.template).length} phim` },
            { value: 'sanpham' as const, label: '📦 Sản phẩm', title: 'Creative gom theo sản phẩm: góc spy × khuôn × thành phần' },
          ]} value={khoTab} onChange={setKhoTab} />
          {khoTab === 'tu_do' && <>
            <Seg options={[{ value: '' as const, label: 'Tất cả' }, ...(['series', 'quang_cao', 'phim'] as const).map((k) => ({ value: k, label: TEN_KIEU[k], title: `${dem[k]} ${TEN_KIEU[k].toLowerCase()}` }))]} value={locKieu} onChange={setLocKieu} />
            <input className="xv-in" style={{ width: 200 }} value={locTim} onChange={(e) => setLocTim(e.target.value)} placeholder="🔍 tìm phim, series, tập…" />
            {soLuuTru > 0 && <label title={`${soLuuTru} bản lưu trữ`} style={{ ...mono, display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={hienLuuTru} onChange={(e) => setHienLuuTru(e.target.checked)} />lưu trữ</label>}
          </>}
          <span style={{ flex: 1 }} />
          <span style={mono} title="Đã tốn = ảnh + video theo giá niêm yết · giá mặc định Nano Banana 2.1 / Veo 3.1 Lite 720p">{phim.length} phim/bộ · {phim.reduce((a, p) => a + p.so_canh, 0)} cảnh · đã tốn {tien(tongTien)} · {tien(giaAnhCents('gemini-nano-banana-2.1'))}/ảnh · {tien(giaVideoCents('veo-3.1-lite-generate-preview', '720p', 8))}/8s</span>
          <ThungRac phimId={null} onKhoiPhuc={taiLai} />
          <Nut chinh={!moTao} onClick={() => setMoTao(!moTao)} title="Tạo phim / bộ mới: short · phim nhiều tập · creative quảng cáo">{moTao ? '✕ Đóng' : '＋ Tạo mới'}</Nut>
        </div>
        {(moTao || phim.length === 0) && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', paddingTop: 6, borderTop: '1px dashed var(--line)' }}>
            <input className="xv-in" style={{ minWidth: 260 }} value={ten} onChange={(e) => setTen(e.target.value)} placeholder="Tên: Thỏ và Rùa · Quảng cáo áo bra X…" onKeyDown={(e) => { if (e.key === 'Enter') void tao(); }} autoFocus />
            <Seg options={LOAI_PHIM.map((l) => ({ value: l.key, label: l.label, title: l.mo_ta }))} value={loai} onChange={setLoai} />
            <Nut ly={!ten.trim() && 'nhập tên trước'} ban={ban} chinh onClick={() => void tao()}>+ Tạo</Nut>
            <span style={mono} title="Kinh thánh + nhân vật + kịch bản tập 1 + storyboard tách sẵn bằng Claude, mất ~30s">hoặc từ mẫu:</span>
            {MAU_PHIM.map((m) => (
              <Nut key={m.key} ban={ban} title={m.mo_ta} onClick={async () => { setBan(true); setLoiTao(''); const r = await taoPhimMau(m.key); setBan(false); if (!r.ok) { setLoiTao(r.loi); return; } await taiLai(); modal.open('phim', r.data); }}>{ban ? '… đang tạo + tách cảnh' : `📄 ${m.nhan}`}</Nut>
            ))}
            <Loi>{loiTao}</Loi>
          </div>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
      {khoTab === 'tu_dong' ? (
        <TuDong />
      ) : khoTab === 'sanpham' ? (
        <DanhSachSanPham phim={phim} onMo={setSpMo} />
      ) : khoTab === 'template' ? (
        <KhoTemplate ds={phim.filter((p) => p.kinh_thanh?.template && !laLuuTru(p))} phimTu={phim.filter((p) => p.kinh_thanh?.tu_template)} onMo={moPhim} />
      ) : phim.length === 0 ? (
        <div className="xv-panel" style={{ textAlign: 'center', padding: 40 }}><div style={{ fontSize: 28 }}>🎬</div><b>Chưa có phim nào</b><div style={mono}>Tạo một phim ở trên: đặt tên, chọn loại, rồi khai nhân vật/sản phẩm và dán kịch bản.</div></div>
      ) : (() => {
        // NHÓM (series / sản phẩm / thương hiệu) → PHIM → TẬP (nhom-phim.ts). Gọn (anh 15/10/2026 "chia nhóm gọn lại"): mỗi phim MỘT dòng
        // (ảnh đại diện · tên · số liệu · chip tập · ảnh QC); nhóm chỉ một phim thì không có đầu nhóm riêng; đầu nhóm dính khi cuộn.
        const nhom = nhomPhim(tuDo, { kieu: locKieu, tim: locTim, luuTru: hienLuuTru });
        const bieuTuong = (k: KieuNhom) => (k === 'template' ? '🧩' : k === 'series' ? '📺' : k === 'quang_cao' ? '📣' : '🎬');
        const dong = (p: Phim, dau?: ReactNode) => {
          const anh = anhDaiDien(p);
          return (
            // Ba cột cố định (anh 15/10/2026 "ảnh đại diện một cột độc lập"): biểu tượng kiểu (16px, trống ở dòng trong nhóm) · ảnh đại diện (26px) · nội dung
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '16px 26px 1fr', columnGap: 8, alignItems: 'start', padding: '4px 10px', borderBottom: '1px solid var(--line)', opacity: laLuuTru(p) ? 0.55 : 1 }}>
              {dau ?? <span />}
              <button type="button" title={p.poster_url ? 'Poster — mở phim' : anh ? 'Keyframe gần nhất (chưa có poster) — mở phim' : 'Chưa có hình — mở phim'} onClick={() => moPhim(p.id)}
                style={{ all: 'unset', cursor: 'pointer', width: 26, height: 38, flexShrink: 0, borderRadius: 3, border: '1px solid var(--line)', background: anh ? `center / cover no-repeat url(${anhNho(anh, 160)}), #111` : 'var(--bg-2)', display: 'grid', placeItems: 'center', fontSize: 12, color: 'var(--fg-4)' }}>{anh ? '' : '🎬'}</button>
              {/* Cột phải: dòng tên + số liệu + tập + ảnh QC; chân dung / góc spy (nếu có) xuống dòng riêng, thụt vào dưới tên (anh 15/10/2026). */}
              <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 3 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', minHeight: 38 }}>
              {/* Mã phim — cùng số #54 dùng trong chat / script / URL mId (#1394). */}
              <span style={{ ...mono, fontSize: 11, color: 'var(--fg-4)' }}>#{p.id}</span>
              <button type="button" onClick={() => moPhim(p.id)} title={`${LOAI_PHIM.find((l) => l.key === p.loai)?.label ?? p.loai} · ${p.so_nhan_vat} anchor · ${p.so_canh} cảnh · đã tốn ${tien(p.chi_phi_cents)}`} style={{ background: 'none', border: 0, color: 'var(--fg-1)', cursor: 'pointer', padding: 0, font: 'inherit', fontWeight: 700, fontSize: 14.5, textAlign: 'left' }}>{p.ten}</button>
              {laLuuTru(p) && <Pill color="var(--fg-4)">lưu trữ</Pill>}
              {(p.tap_tom ?? []).map((t) => (
                <button key={t.id} type="button" className="xv-btn" style={{ padding: '1px 7px', fontSize: 11 }} title={`Mở tập ${t.so}${t.ten && t.ten !== p.ten ? ` · ${t.ten}` : ''} · ${t.so_hinh}/${t.so_canh} hình · ${t.so_clip}/${t.so_canh} clip`} onClick={() => { setTapMo(t.id); modal.open('phim', p.id); }}>
                  {/* Tiến độ bằng HÌNH, số ở hover (YDNI luật 3): thanh trên = keyframe, thanh dưới = clip; đủ thì xanh. */}
                  <b>T{t.so}</b> <span style={{ display: 'inline-grid', gap: 2, width: 34, verticalAlign: 'middle', marginLeft: 4 }}>{[t.so_hinh, t.so_clip].map((x, i) => <span key={i} style={{ height: 3, borderRadius: 2, background: `linear-gradient(90deg, ${t.so_canh && x >= t.so_canh ? '#4ade80' : 'var(--cyan)'} ${t.so_canh ? Math.round((100 * x) / t.so_canh) : 0}%, var(--line) 0)` }} />)}</span>
                </button>
              ))}
              {!!p.so_anh_qc && <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }} title={`${p.so_anh_qc} ảnh QC — mở phim, tab 📖 Phim › Poster · ảnh QC`}>
                {(p.anh_qc_tom ?? []).slice(0, 6).map((a) => <img key={a.id} src={anhNho(a.url, 160)} alt="" onClick={() => moPhim(p.id)} style={{ height: 30, aspectRatio: a.ti_le.replace(':', ' / '), objectFit: 'cover', borderRadius: 3, cursor: 'pointer', border: '1px solid var(--line)' }} />)}
              </span>}
              </div>
              {!!p.goc_spy?.length && <div style={{ paddingLeft: 6 }}><ChipGocSpy ds={p.goc_spy} gon toiDa={4} /></div>}
              </div>
            </div>
          );
        };
        return (
          <div className="xv-panel" style={{ padding: 0, marginBottom: 0 }}>
            {!nhom.length && <div style={{ ...mono, padding: 16 }}>Không có phim khớp bộ lọc.</div>}
            {/* Series LUÔN có đầu nhóm, kể cả mới một bản (anh 17/10/2026 "cho vào group của film này"): series là chỗ gom các bản / ngôn ngữ / tập —
                bản tiếng Anh của 'Nữ Thừa Kế Bí Mật' sẽ vào đúng nhóm. Nhóm một phim kiểu khác vẫn gọn một dòng (15/10/2026). */}
            {nhom.map((g) => g.phim.length === 1 && g.kieu !== 'series'
              ? dong(g.phim[0]!, <span style={{ fontSize: 12, width: 16, textAlign: 'center' }} title={TEN_KIEU[g.kieu]}>{bieuTuong(g.kieu)}</span>)
              : (
                <section key={g.key}>
                  <div style={{ position: 'sticky', top: 0, zIndex: 1, display: 'flex', gap: 8, alignItems: 'baseline', padding: '5px 10px', background: 'var(--bg-2)', borderBottom: '1px solid var(--line)' }}>
                    <b style={{ fontSize: 12.5 }}>{bieuTuong(g.kieu)} {g.ten}</b>
                    <span style={mono} title={`${g.kieu === 'quang_cao' ? `${g.phim.length} video · ${g.phim.reduce((a, p) => a + (p.so_anh_qc ?? 0), 0)} ảnh QC` : `${g.phim.length} phim · ${g.phim.reduce((a, p) => a + p.so_tap, 0)} tập`} · ${tien(g.chi_phi_cents)}`}>{TEN_KIEU[g.kieu]}</span>
                  </div>
                  {g.phim.map((p) => dong(p))}
                </section>
              ))}
          </div>
        );
      })()}
      </div>

      {/* key = mã phim: mở phim KHÁC trong cùng ngăn (🧩 từ #…, phim đang dùng template) phải dựng lại cả ngăn — giữ component cũ thì form tự lưu
          của phim trước ghi đè sang phim mới (15/10/2026: kinh thánh #36 đè lên template #24). */}
      {spMo && <NganSanPham key={spMo} spKey={spMo} onClose={() => setSpMo(null)} onMoPhim={moPhim} onMoTemplate={() => { setSpMo(null); setKhoTab('template'); }} />}
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
type KhoaUrl = { m: string; tap: string; tab: string; nut: string; gap: string };
const KHOA_CHINH: KhoaUrl = { m: 'm', tap: 'tap', tab: 'tab', nut: 'nut', gap: 'gap' };
const KHOA_CHONG: KhoaUrl = { m: 'm2', tap: 'tap2', tab: 'tab2', nut: 'nut2', gap: 'gap2' };

function PhimDrawer({ id, tapDau, khoa, onClose, onXoa, khoaUrl = KHOA_CHINH }: { id: number; tapDau?: number | null; khoa: Khoa; onClose: () => void; onXoa: () => Promise<void>; khoaUrl?: KhoaUrl }) {
  const [d, setD] = useState<PhimDayDu | null | undefined>(undefined);
  const tapParam = useModalParam(khoaUrl.tap);
  const modal = useModalParam(khoaUrl.m);
  /** Mở phim KHÁC từ trong ngăn này → lớp chồng (không thay phim đang xem). */
  const chong = useModalParam(KHOA_CHONG.m);
  // Hỏi lại định kỳ mà phim KHÔNG đổi → giữ nguyên đối tượng cũ: React bỏ qua lượt vẽ, cây + storyboard bên dưới không dựng lại (31/10/2026).
  const jsonPhim = useRef('');
  const tai = useCallback(async () => { const m = await docPhim(id); const j = JSON.stringify(m); if (j === jsonPhim.current) return; jsonPhim.current = j; setD(m); }, [id]);
  useEffect(() => { void tai(); }, [tai]);
  // KHÔNG CÒN TAB (anh 31/10/2026): mọi phần là một nút trên CÂY PHIM (cay-phim.tsx), nút đang xem trong URL (?nut=), tập trong ?tap=.
  // Link cũ ?tab=… (so_do / kich_ban / ho_so / storyboard / am_thanh / xuat) → mở đúng nút tương ứng rồi xoá tham số cũ.
  const [nut, setNut] = useNho<NutPhim>(`xv-nut-${id}`, 'tap', undefined, khoaUrl.nut);
  const [giuCay, setGiuCay] = useMoUrl(`cay${id}`, false);   // Storyboard tự thu cây thành dải hẹp; anh bung lại thì giữ (URL)
  useLayoutEffect(() => {
    const cu = new URLSearchParams(window.location.search).get(khoaUrl.tab);
    const doi: Record<string, NutPhim> = { so_do: 'so_do', kich_ban: 'tap', ho_so: 'tap:ho_so', storyboard: 'tap:storyboard', xuat: 'tap:xuat', am_thanh: 'am_thanh', phim: 'kinh_thanh' };
    if (cu && doi[cu]) { setNut(doi[cu]!); ghiThamSoUrl({ [khoaUrl.tab]: null }); }
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps -- chỉ đọc link lúc mở
  // Job ảnh còn chạy trên máy chủ (kể cả sau F5) → hỏi lại mỗi 4s tới khi xong.
  const conChay = !!d && (d.dangSinh.nhanVat.length > 0 || d.dangSinh.bienThe.length > 0 || d.dangSinh.poster > 0);
  useDinhKy(tai, conChay ? 4000 : 15000);
  // 📋 BÁO CÁO CHUẨN BỊ (phân rã kịch bản, 0đ): đọc lại mỗi khi dữ liệu phim đổi (d chỉ đổi khi JSON khác) → chấm thiếu trên cây + khung Phân rã luôn khớp
  const [bcPr, setBcPr] = useState<BaoCaoPhim | null>(null);
  const taiPr = useCallback(async () => setBcPr(await baoCaoChuanBiAction(id)), [id]);
  useEffect(() => { void taiPr(); }, [taiPr, d]);

  if (d === undefined) return <Ngan onClose={onClose}><span style={mono}>đang tải…</span></Ngan>;
  if (d === null) return <Ngan onClose={onClose}><b>Không thấy phim</b></Ngan>;
  const { phim, nhanVat, tap } = d;
  const tapId = tapParam.numId && tap.some((t) => t.id === tapParam.numId) ? tapParam.numId : tapDau && tap.some((t) => t.id === tapDau) ? tapDau : (tap[0]?.id ?? null);

  return (
    <Ngan onClose={onClose} tieuDe={phim.ten} nut={<>
      {phim.poster_url && <img src={anhNho(phim.poster_url, 160)} alt="" title="Poster (nút 🖼 Poster trên cây)" style={{ height: 34, aspectRatio: '2 / 3', objectFit: 'cover', borderRadius: 4, border: '1px solid var(--line)' }} />}
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
    </>}>
      {(() => {
        const themTap = phim.loai === 'phim' || tap.length === 0 ? async () => { const r = await taoTap(phim.id, ''); if (r.ok) { await tai(); setNut('tap'); tapParam.open('tap', r.data); } } : undefined;
        const nvDau = nhomCayAnchor(nhanVat)[0]?.cha.id ?? null;
        const nvId = nut.startsWith('nv-') ? Number(nut.slice(3)) : null;
        // node con look (bt-<id>): biến thể look của một nhân vật — chi tiết riêng (character/costume breakdown)
        const btId = nut.startsWith('bt-') ? Number(nut.slice(3)) : null;
        const bt = btId != null ? nhanVat.flatMap((v) => (v.bien_the ?? []).map((b) => ({ b, nv: v }))).find((x) => x.b.id === btId) ?? null : null;
        // nút trỏ vào thứ đã mất (tập bị xoá, anchor bị xoá, biến thể bị xoá) → về Kinh thánh / đầu Thiết kế sản xuất, khung phải không bao giờ trống
        const k = (nut === 'tap' || nut.startsWith('tap:')) && tapId == null ? 'kinh_thanh' : (nvId != null && !nhanVat.some((v) => v.id === nvId)) || (btId != null && !bt) ? 'nhan_vat' : nut;
        // bấm một tập → vào thẳng KHÂU ĐANG DỞ: chưa có cảnh → Kịch bản, đã xuất → Xuất, còn lại → Storyboard
        const moTap = (tid: number) => { const t = tap.find((x) => x.id === tid); setNut(!t?.so_canh ? 'tap' : khau(t).xong ? 'tap:xuat' : 'tap:storyboard'); tapParam.open('tap', tid); };
        const khauTap: TabPhim | null = k === 'tap' ? 'kich_ban' : k.startsWith('tap:') ? (k.slice(4) as TabPhim) : null;
        const hep = k === 'tap:storyboard' && !giuCay;
        const tapDang = tapId != null ? tap.find((t) => t.id === tapId)! : null;
        const nv = (chiTiet: number | null) => <NhanVatSection phimId={phim.id} nhanVat={nhanVat} kinhThanh={phim.kinh_thanh} khoa={khoa} dangSinh={d.dangSinh} loiAnh={d.loiAnh} onChanged={tai} chiTiet={chiTiet} />;
        return (
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <CayPhim thamSoGap={khoaUrl.gap} phim={phim} tap={tap} nhanVat={nhanVat} nut={k} tapId={tapId} onChon={(n, tid) => (tid != null ? moTap(tid) : setNut(n))} onThemTap={themTap}
              hep={hep} onHep={k === 'tap:storyboard' ? (v) => setGiuCay(!v) : undefined}
              phanRa={bcPr ? { thieu: bcPr.tong.thieu, tapCho: bcPr.tong.tap_chua + bcPr.tong.tap_cu } : null} />
            <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 10, alignContent: 'start' }}>
              {k === 'kinh_thanh' && <>
                {phim.kinh_thanh?.template && <TemplatePanel phim={phim} onChanged={tai} onMoPhim={(pid) => modal.open('phim', pid)} onMoPhimChong={(pid) => chong.open('phim', pid)} />}
                {phim.loai === 'quang_cao' && !phim.kinh_thanh?.template && <GocSpyPanel phim={phim} onChanged={tai} />}
                {phim.loai === 'may_dung' && <MayDungPanel phim={phim} />}
                <KinhThanhForm phim={phim} khoa={khoa} onSaved={tai} />
              </>}
              {k === 'nhan_vat' && nvDau != null && <XuatHien phim={phim} tap={tap} loai="nv" id={nvDau} ten={nhanVat.find((v) => v.id === nvDau)?.ten ?? ''} onMoTap={moTap} onMoBanDo={(so) => setNut(`bd-${so}`)} />}
              {k === 'nhan_vat' && nv(nvDau)}
              {nvId != null && k === nut && <XuatHien phim={phim} tap={tap} loai="nv" id={nvId} ten={nhanVat.find((v) => v.id === nvId)?.ten ?? ''} onMoTap={moTap} onMoBanDo={(so) => setNut(`bd-${so}`)} />}
              {nvId != null && k === nut && nv(nvId)}
              {bt && k === nut && <XuatHien phim={phim} tap={tap} loai="bt" id={bt.b.id} ten={bt.b.ten} onMoTap={moTap} onMoBanDo={(so) => setNut(`bd-${so}`)} />}
              {bt && k === nut && <div className="xv-panel"><BienTheChiTiet b={bt.b} nvTen={bt.nv.ten} phimId={phim.id} dangSinh={d.dangSinh.bienThe} loiBt={d.loiAnh.bienThe} onChanged={tai} /></div>}
              {k === 'phan_ra' && <PhanRaPanel phimId={phim.id} bc={bcPr} onChanged={async () => { await tai(); await taiPr(); }} onChon={(n) => setNut(n)} />}
              {k === 'poster' && <>
                <PosterPhim phim={phim} nhanVat={nhanVat} dang={d.dangSinh.poster} loiNen={d.loiPoster} onChanged={tai} />
                {phim.loai === 'quang_cao' && <AnhQcPhim phim={phim} nhanVat={nhanVat} />}
              </>}
              {(k === 'so_do' || k === 'tuyen' || k === 'gai_tra') && <SoDoSeries phim={phim} tap={tap} nhanVat={nhanVat} onChanged={tai} onMoTap={moTap}
                mat={k === 'so_do' ? 'tap' : k} onMat={(m) => setNut(m === 'tap' ? 'so_do' : m)} />}
              {k.startsWith('bd-') && <BanDoTap phim={phim} so={Number(k.slice(3))} onTao={async (tid) => { await tai(); moTap(tid); }} />}
              {khauTap && tapDang && <div className="xv-panel"><TapView key={`${tapDang.id}-${khauTap}`} tap={tapDang} phim={phim} nhanVat={nhanVat} khoa={khoa} onChanged={tai} tab={khauTap} onMoNut={setNut} /></div>}
              {k === 'tap:xuat' && <ChiPhiGanDay jobs={d.ganDay} tong={d.tongTien} phimId={phim.id} />}
              {/* 🔊 Âm thanh (thuộc Thiết kế sản xuất): theo tập — chọn tập ngay đầu khung */}
              {k === 'am_thanh' && <div className="xv-panel">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <b style={{ fontSize: 13 }}>🔊 Âm thanh</b><span style={mono}>giọng nhân vật · hiệu ứng · nhạc theo phân cảnh — của tập</span>
                  {tap.length > 0 && <Chon nho minWidth={200} value={String(tapId ?? '')} options={tap.map((t) => ({ value: String(t.id), label: `Tập ${t.so} · ${t.ten}`, ngan: `Tập ${t.so}` }))} onChange={(v) => tapParam.open('tap', Number(v))} />}
                </div>
                {tapDang ? <TapView key={`${tapDang.id}-am`} tap={tapDang} phim={phim} nhanVat={nhanVat} khoa={khoa} onChanged={tai} tab="am_thanh" /> : <div style={mono}>Phim chưa có tập nào.</div>}
              </div>}
            </div>
          </div>
        );
      })()}

    </Ngan>
  );
}

// ── Chi phí: mỗi lần sinh một dòng (đầy đủ ở /log) ────────────────────────────────────────────────────────────

const MAU_LOAI: Record<string, string> = { chu: 'var(--cyan)', anh: 'var(--amber)', video: 'var(--violet)' };

const NHAN_LOAI: Record<string, string> = { chu: 'Chữ', anh: 'Ảnh', video: 'Video' };

/** Sổ chi phí gần đây — panel phụ của nút ⬇ Xuất của tập → gập mặc định (YDNI luật 5), tổng tiền vẫn thấy; mở/gập nhớ trên máy. */
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
  const jsonM = useRef('');
  const nap = useCallback(async () => { const r = await docHoanTac(phimId); if (!r.ok) return; const j = JSON.stringify(r.data); if (j !== jsonM.current) { jsonM.current = j; setM(r.data); } }, [phimId]);
  useEffect(() => { void nap(); }, [nap]);
  useDinhKy(nap, 12_000);   // 12s (trước 4s): server action chạy nối đuôi — hỏi dày làm mọi cú bấm phải xếp hàng; sau mỗi thao tác của anh thì onDone/nap gọi ngay
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
