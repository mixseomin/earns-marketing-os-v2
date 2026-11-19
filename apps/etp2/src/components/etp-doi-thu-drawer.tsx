'use client';
// NGĂN CREATIVE ĐỐI THỦ (anh giao 19/11/2026) — loại 'etp-dt' của EtpDrawerHost (xếp chồng, URL ?ed=etp-dt~<khoá phim>). Mở từ màn Phim đối thủ (etp-doi-thu.tsx).
// Từng QC đối thủ của phim: ảnh (bản R2 khi link fbcdn hết hạn), chữ, Page, ngày bắt đầu / lần cuối, số ngày chạy, link Thư viện QC Meta, domain hiển thị,
// dạng creative (cổng AI chung, đệm theo library_id). Xếp số ngày chạy giảm dần. CHỈ ĐỌC. Lọc của ngăn trên URL: ?dtx=<lọc>.
// ngan-moi-ok: phim đối thủ (QC Spy gộp theo phim) — đã tra, chưa có ngăn nào (ngăn etp-phim là phim Ethopex, mở chồng từ ô Ethopex)
// tra-repo-ok: màn nội bộ dựng từ khối dùng chung của etp2 (Drawer, Segmented, SiteFavicon)
import { useEffect, useState, type ReactNode } from 'react';
import { Drawer, Segmented, SiteFavicon } from '@/components/ui';
import { Dem, MO_SO } from '@/components/etp-so';
import { openEntityDrawer } from '@/lib/entity-drawer';
import { docQcDoi, docQcDoiThu, phanDangQc, type DangQc, type PhimDoiThu, type QcDoi, type QcDoiThu, type SxPhim } from '@/lib/actions/etp-doi-thu';
import { DO, OCamp, ORoi, VANG, XANH, gioVn, ngayVn, useDoiThu } from './etp-doi-thu';

const ngoai = (u: string) => `https://href.li/?${u}`;   // link ra ngoài che referrer
const TEN_DANG: Record<DangQc, string> = { cat_canh: 'Cảnh cắt + phụ đề', poster: 'Poster tên phim', nut_xem: 'Nút Watch Free', khac: 'Khác' };
const MAU_DANG: Record<DangQc, string> = { cat_canh: '#38bdf8', poster: '#c084fc', nut_xem: '#fb923c', khac: '#94a3b8' };
type LocNgan = 'all' | 'chay' | DangQc;
const LOC_NGAN: LocNgan[] = ['all', 'chay', 'cat_canh', 'poster', 'nut_xem', 'khac'];

const docUrl = (k: string) => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(k));
function ghiUrl(k: string, v: string | null) {
  const u = new URL(window.location.href);
  if ((u.searchParams.get(k) ?? null) === v) return;
  if (v) u.searchParams.set(k, v); else u.searchParams.delete(k);
  window.history.replaceState(window.history.state, '', `${u.pathname}${u.search}${u.hash}`);
}

function O({ nhan, children }: { nhan: string; children: ReactNode }) {
  return <div><div style={{ fontSize: 10.5, color: MO_SO, textTransform: 'uppercase', letterSpacing: 0.4 }}>{nhan}</div><div style={{ fontSize: 13, marginTop: 2 }}>{children}</div></div>;
}

export function EtpDoiThuDrawer({ khoa, onClose }: { khoa: string; onClose: () => void }) {
  const { so: du, loi: loiDs } = useDoiThu();
  const p = du?.phim.find((x) => x.khoa === khoa) ?? null;
  const dau = (ten: ReactNode, phu: string) => <div className="modal-head"><div><div className="id-line">{phu}</div><h2 style={{ margin: 0 }}>{ten}</h2></div><button className="modal-close" onClick={onClose}>✕</button></div>;
  if (!p) return <Drawer onClose={onClose} width={1180} padding={0}>{dau(du ? 'Không thấy phim' : 'Đang tải…', 'phim đối thủ')}
    <div style={{ padding: 16, color: du ? DO : MO_SO }}>{du ? 'phim này không còn trong danh sách đối thủ (kho Spy đã đổi)' : loiDs ?? 'đang đọc danh sách phim đối thủ…'}</div></Drawer>;
  return <Ngan p={p} dau={dau} onClose={onClose} />;
}

function Ngan({ p, dau, onClose }: { p: PhimDoiThu; dau: (ten: ReactNode, phu: string) => ReactNode; onClose: () => void }) {
  const [d, setD] = useState<QcDoiThu[] | { loi: string } | null>(null);
  const [phan, setPhan] = useState<{ dang: boolean; loi: string | null; con: number }>({ dang: false, loi: null, con: 0 });
  const [loc, setLoc] = useState<LocNgan>(() => { const v = docUrl('dtx') as LocNgan | null; return v && LOC_NGAN.includes(v) ? v : 'all'; });
  useEffect(() => { ghiUrl('dtx', loc === 'all' ? null : loc); }, [loc]);
  useEffect(() => () => ghiUrl('dtx', null), []);   // đóng ngăn thì bỏ lọc ngăn khỏi URL
  useEffect(() => {
    let song = true; setD(null);
    docQcDoiThu(p.ma).then(async (r) => {
      if (!song) return;
      if ('loi' in r) { setD(r); return; }
      setD(r.qc);
      // dạng creative chưa phân → cổng AI chung (haiku rẻ, ≤ 24 QC mỗi lượt), đệm theo library_id — lần mở sau không gọi lại
      const chua = r.qc.filter((x) => !x.dang_cr && x.anh && !x.anh_het).map((x) => x.library_id);
      if (!chua.length) return;
      setPhan({ dang: true, loi: null, con: 0 });
      const k = await phanDangQc(chua).catch((e: unknown) => ({ loi: e instanceof Error ? e.message : String(e) }));
      if (!song) return;
      if ('loi' in k) { setPhan({ dang: false, loi: k.loi, con: 0 }); return; }
      setPhan({ dang: false, loi: null, con: k.con });
      setD((cu) => (Array.isArray(cu) ? cu.map((x) => (k.dang[x.library_id] ? { ...x, dang_cr: k.dang[x.library_id]!.dang, dang_ly: k.dang[x.library_id]!.ly } : x)) : cu));
    }).catch((e: unknown) => { if (song) setD({ loi: e instanceof Error ? e.message : String(e) }); });
    return () => { song = false; };
  }, [p.khoa]);   // eslint-disable-line react-hooks/exhaustive-deps
  const ds = Array.isArray(d) ? d : [];
  const hien = ds.filter((x) => loc === 'all' || (loc === 'chay' ? x.dang : x.dang_cr === loc));
  const demDang = (k: DangQc) => ds.filter((x) => x.dang_cr === k).length;
  return (
    <Drawer onClose={onClose} width={1180} padding={0}>
      {dau(<>{p.co_hoi ? <span style={{ color: VANG }} title="cơ hội: đối thủ chạy mạnh, phim có trên Ethopex, nhà chưa chạy">★ </span> : null}{p.ten}</>, `phim đối thủ · ${p.mien.join(' · ')}`)}
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
        <O nhan="QC đang chạy"><b><Dem v={p.qc_dang} /></b> <span style={{ color: MO_SO }}>/ {p.qc_tong}</span></O>
        <O nhan="Chạy lâu nhất">{p.lau_nhat}d</O>
        <O nhan="Page"><Dem v={p.so_page} /></O>
        <O nhan="Ethopex">{p.etp ? <a style={{ cursor: 'pointer' }} onClick={() => openEntityDrawer('etp-phim', p.etp!.id)} title="mở ngăn phim Ethopex">#{p.etp.id} ↗</a> : <span style={{ color: MO_SO }}>không có</span>}</O>
        <O nhan="Thể loại">{p.etp?.the_loai_ten ?? <span style={{ color: MO_SO }}>—</span>}</O>
        <O nhan="Nhà"><OCamp x={p.nha} ai="Nhà" /> · <ORoi x={p.nha} /></O>
        <O nhan="Đội"><OCamp x={p.doi} ai="Đội" /> · <ORoi x={p.doi} /></O>
      </div>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-1, var(--bg))', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
        <Segmented<LocNgan> value={loc} onChange={setLoc} options={[
          { value: 'all', label: 'Tất cả', title: `${ds.length} QC` }, { value: 'chay', label: 'Đang chạy', title: `${ds.filter((x) => x.dang).length} QC` },
          ...(Object.keys(TEN_DANG) as DangQc[]).map((k) => ({ value: k, label: TEN_DANG[k], title: `${demDang(k)} QC` })),
        ]} />
        <span style={{ fontSize: 11.5, color: phan.loi ? DO : MO_SO }}>{phan.dang ? 'đang phân dạng creative…' : phan.loi ? phan.loi : phan.con ? `còn ${phan.con} QC chưa phân dạng — mở lại ngăn để phân tiếp` : 'xếp theo số ngày chạy, lâu nhất trước'}</span>
      </div>
      {!d ? <div style={{ padding: 16, color: MO_SO }}>đang đọc QC đối thủ…</div>
        : 'loi' in d ? <div style={{ padding: 16, color: DO }}>{d.loi}</div>
          : !hien.length ? <div style={{ padding: 16, color: MO_SO }}>không có QC nào ở bộ lọc này {loc !== 'all' ? <a style={{ cursor: 'pointer' }} onClick={() => setLoc('all')}>— xem tất cả</a> : null}</div>
            : <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, padding: 16 }}>{hien.map((x) => <TheQc key={x.library_id} x={x} />)}</div>
                <CotDoi p={p} />
              </div>}
    </Drawer>
  );
}

/** CỘT QC ĐỘI bên phải (anh 19/11/2026 "Show thêm qc của đội ở bên cạnh để so sánh!!"): creative đội cùng phim — ảnh 9:16, người chạy, camp đang / từng lên, chi, ROI.
 *  Dính khi cuộn để luôn đặt cạnh QC đối thủ đang xem. Bấm ảnh mở video. */
function CotDoi({ p }: { p: PhimDoiThu }) {
  const [d, setD] = useState<QcDoi[] | { loi: string } | null>(null), [sx, setSx] = useState<SxPhim | null>(null);
  const ids = [p.etp?.id, ...p.etp_khac].filter((x): x is number => !!x);
  useEffect(() => { let song = true; setD(null); if (!ids.length) { setD([]); return; }
    docQcDoi(ids).then((r) => { if (!song) return; setD('loi' in r ? r : r.qc); if (!('loi' in r)) setSx(r.sx); }).catch((e: unknown) => { if (song) setD({ loi: e instanceof Error ? e.message : String(e) }); });
    return () => { song = false; }; }, [p.khoa]);   // eslint-disable-line react-hooks/exhaustive-deps
  const ds = Array.isArray(d) ? d : [];
  const TEN_B: Record<string, string> = { nhan: 'Nhận phim', ws: 'Trang phim', poster: 'Soát poster', cat: 'Cắt đoạn', soat: 'Soát đoạn', creative: 'Tải + chấm', camp: 'Lên camp', chay: 'Camp chạy',
    cho: 'Chờ máy', trang_phim: 'Trang phim', tai_tap: 'Tải tập', chon_khung: 'Chọn khung', ve_mau: 'Vẽ mẫu', giong: 'Giọng', video: 'Video', thu_vien: 'Thư viện' };
  const mauTt = (t: string | null) => (t === 'loi' ? DO : t === 'dung' ? '#fbbf24' : t === 'cho' ? MO_SO : '#60a5fa');
  const coSx = sx && (sx.dong.length || sx.mau.length || sx.cr.length);
  return <div style={{ width: 300, flex: 'none', borderLeft: '1px solid var(--line)', padding: '16px 12px', position: 'sticky', top: 44, alignSelf: 'flex-start', maxHeight: 'calc(100vh - 60px)', overflowY: 'auto' }}>
    {/* NHÀ ĐANG SẢN XUẤT cho phim — dòng phim · dựng theo mẫu · creative mới chưa lên camp */}
    {coSx ? <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
      <div style={{ fontSize: 11, color: MO_SO, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Nhà đang sản xuất</div>
      {sx!.dong.map((x) => <div key={`d${x.id}`} title={x.ghi ?? ''} onClick={() => openEntityDrawer('etp-sx', ids[0]!)} style={{ fontSize: 11.5, padding: '3px 0', cursor: 'pointer' }}>
        <b>dòng phim {x.loai}</b> · <span style={{ color: mauTt(x.tt) }}>{x.buoc ? TEN_B[x.buoc] ?? x.buoc : 'đang chạy'}{x.tt === 'loi' ? ' lỗi' : x.tt === 'dung' ? ' dừng' : x.tt === 'cho' ? ' chờ' : ''}</span></div>)}
      {sx!.mau.map((x) => <div key={`m${x.mau}`} title={x.ghi ?? ''} onClick={() => openEntityDrawer('etp-mau-dung', `${x.mau}:${ids[0]}`)} style={{ fontSize: 11.5, padding: '3px 0', cursor: 'pointer' }}>
        <b title="dựng theo mẫu học từ đối thủ — bấm xem từng bước">{x.ten ?? 'dựng theo mẫu'}</b> · <span style={{ color: mauTt(x.tt) }}>{TEN_B[x.buoc] ?? x.buoc}{x.tt === 'loi' ? ' lỗi' : x.tt === 'cho' ? ' chờ' : ''}</span></div>)}
      {sx!.cr.length ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, marginTop: 6 }}>
        {sx!.cr.map((x) => <a key={x.creative_id} href={x.video ?? x.anh ?? undefined} target="_blank" rel="noreferrer" title={`${x.dang ?? 'creative'} · chưa lên camp — mở video`}
          style={{ position: 'relative', display: 'block', aspectRatio: '9 / 16', background: '#000', borderRadius: 5, overflow: 'hidden' }}>
          {x.anh ? <img src={x.anh} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} /> : null}
          <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, fontSize: 9.5, background: 'rgba(0,0,0,0.7)', color: '#fff', textAlign: 'center' }}>mới · chưa camp</span></a>)}
      </div> : null}
    </div> : null}
    <div style={{ fontSize: 11, color: MO_SO, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>QC của đội · {ds.length}{ds.length ? ` · ${ds.filter((x) => x.dang).length} đang chạy` : ''}</div>
    {!d ? <div style={{ fontSize: 12, color: MO_SO }}>đang đọc QC đội…</div> : 'loi' in d ? <div style={{ fontSize: 12, color: DO }}>{d.loi}</div>
      : !ids.length ? <div style={{ fontSize: 12, color: MO_SO }}>phim không có trên Ethopex — đội không chạy được</div>
      : !ds.length ? <div style={{ fontSize: 12, color: MO_SO }}>đội chưa chạy phim này</div>
      : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          {ds.map((x) => { const r = x.chi > 0.5 ? ((x.thu - x.chi) / x.chi) * 100 : null;
            return <div key={x.creative_id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <a href={x.video ?? x.anh ?? undefined} target="_blank" rel="noreferrer" title="mở video" style={{ position: 'relative', display: 'block', aspectRatio: '9 / 16', background: '#000', borderRadius: 6, overflow: 'hidden' }}>
                {x.anh ? <img src={x.anh} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} /> : <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: MO_SO, fontSize: 11 }}>chưa có ảnh</span>}
                <span style={{ position: 'absolute', top: 4, left: 4, fontSize: 10, padding: '0 5px', borderRadius: 8, background: 'rgba(0,0,0,0.7)', color: x.dang ? XANH : '#fff' }}>{x.dang ? '● đang chạy' : 'đã dừng'}</span>
              </a>
              <div style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{x.nguoi ?? 'đội'} · {x.dang}/{x.tong} camp</div>
              <div style={{ fontSize: 11, color: MO_SO, fontVariantNumeric: 'tabular-nums' }}>chi ${x.chi.toFixed(0)}{r != null ? <> · ROI <span style={{ color: r >= 0 ? XANH : DO }}>{r.toFixed(0)}%</span></> : ''}</div>
            </div>; })}
        </div>}
  </div>;
}

function TheQc({ x }: { x: QcDoiThu }) {
  const [hong, setHong] = useState(false);
  const lib = `https://www.facebook.com/ads/library/?id=${x.library_id}`;
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#000', aspectRatio: '1 / 1', display: 'grid', placeItems: 'center', position: 'relative' }}>
        {x.anh && !hong && !x.anh_het ? <img src={x.anh} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setHong(true)} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          : <a href={ngoai(lib)} target="_blank" rel="noreferrer noopener" title="Meta chỉ giữ link ảnh QC vài ngày; QC này dừng trước khi máy kịp lưu bản riêng nên không còn nguồn ảnh. Từ nay máy lưu ảnh mọi QC đối thủ (cả QC đã dừng) ngay khi mở danh sách."
            style={{ color: MO_SO, fontSize: 12, textAlign: 'center', padding: 12 }}>mất ảnh: link Meta hết hạn trước khi máy lưu ↗</a>}
        <span title={x.dang ? 'Spy còn thấy QC này trong 2 ngày qua' : `Spy thấy lần cuối ${gioVn(x.lan_cuoi)}`} style={{ position: 'absolute', top: 6, left: 6, fontSize: 10.5, padding: '1px 6px', borderRadius: 9, background: 'rgba(0,0,0,0.65)', color: x.dang ? XANH : 'var(--fg-2)' }}>{x.dang ? '● đang chạy' : '○ đã dừng'}</span>
        {x.media === 'video' ? <span title="QC video (ảnh là ảnh bìa)" style={{ position: 'absolute', top: 6, right: 6, fontSize: 10.5, padding: '1px 6px', borderRadius: 9, background: 'rgba(0,0,0,0.65)', color: '#fff' }}>▶ video</span> : null}
      </div>
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, flex: 1 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <b style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }} title="số ngày chạy (từ ngày bắt đầu tới lần cuối Spy thấy)">{x.ngay}d</b>
          <span style={{ color: MO_SO, fontVariantNumeric: 'tabular-nums' }} title={`bắt đầu ${ngayVn(x.bat_dau)} · lần cuối Spy thấy ${gioVn(x.lan_cuoi)} (giờ VN)`}>{ngayVn(x.bat_dau)} → {gioVn(x.lan_cuoi)}</span>
          {x.dang_cr ? <span title={x.dang_ly ?? ''} style={{ fontSize: 10.5, padding: '0 6px', borderRadius: 9, color: MAU_DANG[x.dang_cr], border: `1px solid ${MAU_DANG[x.dang_cr]}66` }}>{TEN_DANG[x.dang_cr]}</span> : null}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
          <SiteFavicon url="https://facebook.com" size={13} title="Page Facebook" />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`Page ${x.page_ten ?? '?'}${x.page_id ? ` · id ${x.page_id}` : ''}`}>{x.page_ten ?? '—'}</span>
        </div>
        {x.noi_dung ? <div title={x.noi_dung} style={{ whiteSpace: 'pre-wrap', lineHeight: 1.45, color: 'var(--fg-2)', display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{x.noi_dung}</div> : null}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 'auto', paddingTop: 4 }}>
          {x.hien_thi ? <span title="domain hiển thị trên QC" style={{ fontSize: 10.5, letterSpacing: 0.4, color: 'var(--fg-2)', border: '1px solid var(--line)', borderRadius: 4, padding: '0 5px' }}>{x.hien_thi}</span> : null}
          {x.cta ? <span title="nút kêu gọi trên QC" style={{ fontSize: 10.5, color: 'var(--fg-2)' }}>[{x.cta}]</span> : null}
          <SiteFavicon url={`https://${x.mien}`} size={12} title={`trang đích ${x.mien}`} />
          <a href={ngoai(lib)} target="_blank" rel="noreferrer noopener" style={{ marginLeft: 'auto', fontSize: 11.5 }} title={`Thư viện QC Meta · ${x.library_id}`}>Thư viện QC ↗</a>
        </div>
      </div>
    </div>
  );
}
