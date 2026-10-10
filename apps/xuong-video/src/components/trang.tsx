'use client';
// Xưởng video AI (studio.on.tc) — một màn: danh sách phim → drawer phim (kinh thánh · tuyến nhân vật · tập · storyboard từng tập).
// Storyboard = bảng cảnh: mỗi dòng một cảnh (xương sống dữ liệu); keyframe sinh → chọn → duyệt → video. Canvas node + timeline (G2/G3)
// là hai cách nhìn khác của cùng bảng này, không có dữ liệu riêng.
import { Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useModalParam } from '@/lib/use-modal-param';
import { Ngan } from './ngan';
import { moNgan } from './ngan-chung';
import { MAU_PHIM } from '@/lib/xuong-video/mau';
import { dsPhim, docPhim, taoPhim, taoPhimMau, xoaPhim, taoTap, dsMoHinh, dsThungRac, khoiPhuc, docHoanTac, hoanTac, type MoHinhChon, type PhimDayDu } from '@/lib/actions';
import type { MucHoanTac } from '@/lib/xuong-video/hoan-tac';
import { LOAI_PHIM, docKinhThanh, giaAnhCents, giaVideoCents, tien, gioVN, type Phim, type Job, type LoaiPhim } from '@/lib/xuong-video/kieu';
import { Khoa, TabPhim, TAB_PHIM, O, Pill, Seg, Nut, Xoa, Loi, mono } from './ui';
import { MoHinhCtx } from './mo-hinh-ui';
import { KinhThanhForm } from './kinh-thanh';
import { NhanVatSection } from './nhan-vat';
import { TapView } from './tap';
import { useNho } from './nho';
import { useDinhKy } from './dinh-ky';

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
  // Tab đang mở, nhớ theo phim (đọc ngay từ đầu, chỉ ghi khi bấm — cùng cách với khung thu gọn #1212).
  const [tab, setTab] = useNho<TabPhim>(`xv-tab-${id}`, 'kich_ban', TAB_PHIM.map((t) => t.key));
  // Job ảnh còn chạy trên máy chủ (kể cả sau F5) → hỏi lại mỗi 4s tới khi xong.
  const conChay = !!d && (d.dangSinh.nhanVat.length > 0 || d.dangSinh.bienThe.length > 0);
  useDinhKy(tai, conChay ? 4000 : 15000);

  if (d === undefined) return <Ngan onClose={onClose}><span style={mono}>đang tải…</span></Ngan>;
  if (d === null) return <Ngan onClose={onClose}><b>Không thấy phim</b></Ngan>;
  const { phim, nhanVat, tap } = d;
  const tapId = tapParam.numId && tap.some((t) => t.id === tapParam.numId) ? tapParam.numId : (tap[0]?.id ?? null);

  return (
    <Ngan onClose={onClose} tieuDe={phim.ten} nut={<>
      <Pill color="var(--fg-3)">{LOAI_PHIM.find((l) => l.key === phim.loai)?.label ?? phim.loai}</Pill>
      <span style={mono} data-ngu-canh={`phim #${phim.id} ${phim.ten}`}>#{phim.id}</span>
      <ThongKe tk={d.thongKe} tongTien={d.tongTien} soAnchor={nhanVat.length} soTap={tap.length} />
      <button type="button" className="xv-btn" onClick={() => moNgan({ loai: 'thu-vien', tl: docKinhThanh(phim.kinh_thanh).the_loai })} title="Cỡ cảnh, góc, chuyển động máy, ống kính, ánh sáng, màu, chuyển cảnh, âm thanh, nhạc — lọc sẵn theo thể loại của phim">🎬 Thư viện</button>
      <HoanTac phimId={phim.id} onDone={tai} />
      <ThungRac phimId={phim.id} onKhoiPhuc={tai} />
      <Xoa nhan="cả phim (tập + cảnh)" onXoa={onXoa} />
    </>} dau={
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {TAB_PHIM.map((t) => <button key={t.key} type="button" className={`xv-btn${tab === t.key ? ' chinh' : ''}`} title={t.mo} onClick={() => setTab(t.key)}>{t.label}</button>)}
      </div>
    }>
      {tab === 'kich_ban' && <>
        <KinhThanhForm phim={phim} khoa={khoa} onSaved={tai} />
        <NhanVatSection phimId={phim.id} nhanVat={nhanVat} kinhThanh={phim.kinh_thanh} khoa={khoa} dangSinh={d.dangSinh} loiAnh={d.loiAnh} onChanged={tai} />
      </>}

      <div className="xv-panel">
        <h3>{tab === 'kich_ban' ? '3 · Tập: brief → kịch bản → tách cảnh' : TAB_PHIM.find((t) => t.key === tab)!.label.replace(/^\S+\s/, '')}<small>{tab === 'kich_ban' ? (phim.loai === 'phim' ? 'mỗi tập một kịch bản; tập sau đọc tóm tắt tập trước' : 'một tập') : TAB_PHIM.find((t) => t.key === tab)!.mo}</small></h3>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          {tap.length > 0 && (
            <Seg options={tap.map((t) => ({ value: t.id, label: `${phim.loai === 'phim' ? `Tập ${t.so}` : 'Tập'}${t.ten && t.ten !== phim.ten ? ` · ${t.ten}` : ''} (${t.so_canh})` }))} value={tapId ?? 0} onChange={(v) => tapParam.open('tap', v)} />
          )}
          {(phim.loai === 'phim' || tap.length === 0) && (
            <button type="button" className="xv-btn" onClick={async () => { const r = await taoTap(phim.id, ''); if (r.ok) { await tai(); tapParam.open('tap', r.data); } }}>+ Thêm tập</button>
          )}
        </div>
        {tapId != null && <TapView key={tapId} tap={tap.find((t) => t.id === tapId)!} phim={phim} nhanVat={nhanVat} khoa={khoa} onChanged={tai} tab={tab} />}
      </div>
      {tab === 'xuat' && <ChiPhiGanDay jobs={d.ganDay} tong={d.tongTien} phimId={phim.id} />}
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
        <button type="button" className="xv-lienket xv-mono" onClick={() => moNgan({ loai: 'so-chi-phi', phim: phimId })}>xem sổ đầy đủ →</button>
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
        {dang ? '…' : `↶ Hoàn tác${m ? `: ${m.mo_ta.length > 34 ? `${m.mo_ta.slice(0, 32)}…` : m.mo_ta}` : ''}`}
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
      <button type="button" className="xv-btn" onClick={() => setMo(true)} title="Thứ đã bỏ — khôi phục được">🗑 Thùng rác{ds?.length ? ` (${ds.length})` : ''}</button>
      {mo && (
        <Ngan nho onClose={() => setMo(false)} tieuDe={`🗑 Thùng rác${phimId == null ? ' · phim đã xoá' : ''}`}>
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
      {chip('🎯', tien(tk.tienDung), `Chi phí thực tế nếu không phải lặp lại: ${tien(tk.tienDung)}\nchỉ tính lượt sinh ra thứ đang nằm trong phim (keyframe, clip, giọng, nhạc, ảnh anchor đang dùng) + lượt Claude mới nhất mỗi việc\nmất vì sinh lại / bỏ / lỗi: ${tien(Math.max(0, tongTien - tk.tienDung))}${tongTien > 0 ? ` (${Math.round((Math.max(0, tongTien - tk.tienDung) / tongTien) * 100)}%)` : ''} — tổng 💰 chỉ đếm lượt còn tính vào phim, nên hai số không cộng trừ thẳng khi đã đặt lại sổ`, 'var(--lime)')}
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
