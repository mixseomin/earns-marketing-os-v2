'use client';
// Một shot trên storyboard: thẻ cảnh, keyframe/clip, form sửa 3 tab.
import { KhungDauKet } from './khung-dau-ket';
import { Fragment, useContext, useEffect, useState, type CSSProperties } from 'react';
import { moNgan, linkTai } from './ngan-chung';
import { dongThoai, tenNoi, LOI_DAN } from '@/lib/xuong-video/am-thanh';
import { THE_LOAI, NHOM_KY_THUAT, dsTheoNhom, hopTheLoai, type TheLoai } from '@/lib/xuong-video/dien-anh';
import { KyThuatTheoNhom } from './thu-vien';
import { BoSetXem } from './bo-set-xem';
import { suaCanh, xoaCanh, sinhKeyframe, chonKeyframe, duyetCanh, sinhVideoCanh, sinhVideoThu, lamLaiTuKeyframe, sinhGiong, sinhAmThanh, xoaKeyframe, goiYAICanh, nangCapCanh, chonPhienBan, khopMiengCanh, luuShotKho, bocTachCanh, layThanhPhanCanh } from '@/lib/actions';
import { O_DAN_DUNG, moTaVi, chuManHien, tenPhanDoan, LOAI_NHAN_VAT, TRANG_THAI_CANH, doiBienThe, motBienTheMoiDoiTuong, thanhPhanCanh, NANG_CAP, KHOP_MIENG, MO_HINH_ANH, MO_HINH_VIDEO, tien, lamTronClip, gioVN, tenCamXuc, type NhanVat, type Canh, type KinhThanh, type LoaiPhim, type DongDoiChieu } from '@/lib/xuong-video/kieu';
import { Chon } from './chon';
import { BieuCamShot } from './bieu-cam-ui';
import { chanVideo } from '@/lib/xuong-video/quy-trinh';
import { Khoa, KqChay, O, Pill, Nut, Loi, AnhNho, DangSinh, mono, Menu, MucMenu, NhomNut } from './ui';
import { MoHinhCtx, giaVideoUi, giaAnhUi, luaChonAnh, luaChonVideo } from './mo-hinh-ui';
import { GiongNhanVat } from './nhan-vat';
import { NutNghe, ClipNho } from './media';
import { anhNho } from '@/lib/xuong-video/anh-nho';
import { svgSoDoShot, veShotTuCanh } from '@/lib/xuong-video/so-do-shot';
import type { KhongGian } from '@/lib/xuong-video/khong-gian';

/** Keyframe nhỏ dưới video (#1218): có video rồi vẫn xem lại được ảnh gốc của clip (rê để phóng to, kèm ảnh so sánh). */
export function KfNho({ url, soSanh }: { url: string; soSanh: string }) {
  return (
    <img src={anhNho(url, 160)} alt="" data-so-sanh={soSanh} title="Keyframe của clip — rê để phóng to"
      style={{ display: 'block', width: 34, height: 34, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--line)', marginTop: 4 }} />
  );
}

/** Nguồn của MỘT tệp (ảnh/clip) dưới thumbnail: nhãn ngắn "ckey · nano-banana-2", rê chuột thấy đủ cổng · model thật · tiền thật · các bước dự phòng. */
function NguonTep({ c, url }: { c: Canh; url: string }) {
  const n = c.nguon_tep?.[url];
  if (!n) return null;
  // width 0 + minWidth 100%: dòng nowrap không góp bề rộng cho khối cha (khối co theo clip, chữ cắt …) — trước đây khối căn giữa rộng theo chữ, tràn sang cột phải (#1368).
  return <div title={n.day} style={{ ...mono, fontSize: 9.5, color: 'var(--fg-3)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: 0, minWidth: '100%' }}>{n.ngan}</div>;
}

/** Phân cảnh của shot (kỹ thuật đã áp nằm ở chân cột ảnh — KyThuatTheoNhom). */
function KyThuatGon({ phanDoan }: { phanDoan: string }) {
  if (!phanDoan) return null;
  return <div style={{ marginTop: 4, ...mono, color: 'var(--violet)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>🎬 {tenPhanDoan(phanDoan)}</div>;
}

/** Trang phục của người trong shot — sửa ngay trên thẻ (Enter/blur là lưu). Trống = mặc như mô tả nhân vật. */
export function TrangPhucShot({ c, onLuu }: { c: Canh; onLuu: (t: string) => void }) {
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

// ⚖️ Bảng đối chiếu Dự kiến ↔ Bóc-từ-ảnh (3 cột + mức khớp). khớp=xanh · gần=hổ phách · lệch/thiếu/thừa=đỏ.
const MUC_MAU: Record<string, string> = { 'khớp': 'var(--green)', 'gần': 'var(--amber)', 'lệch': 'var(--red)', 'thiếu': 'var(--red)', 'thừa': 'var(--red)' };
const MUC_NHAN: Record<string, string> = { 'khớp': '✓ khớp', 'gần': '≈ gần', 'thiếu': '✗ thiếu', 'thừa': '＋ thừa', 'lệch': '✗ lệch' };
// Tách "Thành phần" → (đối tượng → thuộc tính) để dựng cây. "Áo Lâm Hạ"→{Lâm Hạ, Áo}; "Đạo cụ Thẻ + vị trí"→{🧸 Thẻ, Vị trí}; "Đạo cụ Thẻ + trạng thái"→{🧸 Thẻ, Trạng thái}.
const THUOC_TINH = ['Áo', 'Tóc', 'Biểu cảm', 'Vị trí', 'Dáng', 'Hướng nhìn', 'Ánh nhìn', 'Nhìn', 'Trang sức', 'Hành động', 'Đồ cầm', 'Cầm', 'Trang điểm', 'Makeup'];
function tachTP(tp: string): { obj: string; attr: string | null } {
  const md = tp.match(/^Đạo cụ\s+(.+?)\s*[+·\-–]\s*(vị trí|trạng thái).*$/i);
  if (md?.[1]) return { obj: `🧸 ${md[1].trim()}`, attr: md[2]!.toLowerCase().startsWith('vị') ? 'Vị trí' : 'Trạng thái' };
  const md2 = tp.match(/^Đạo cụ\s+(.+)$/i);
  if (md2?.[1]) return { obj: `🧸 ${md2[1].trim()}`, attr: null };
  for (const a of THUOC_TINH) if (tp.startsWith(`${a} `)) return { obj: tp.slice(a.length + 1).trim(), attr: a };
  return { obj: tp, attr: null };
}
const mucXauNhat = (ms: string[]): string | null => ms.some((m) => m === 'lệch' || m === 'thiếu' || m === 'thừa') ? 'lệch' : ms.some((m) => m === 'gần') ? 'gần' : ms.length ? 'khớp' : null;
function BadgeMuc({ muc }: { muc: string }) { return <span style={{ color: MUC_MAU[muc] ?? 'var(--fg-3)', fontWeight: 700, whiteSpace: 'nowrap' }}>{MUC_NHAN[muc] ?? muc}</span>; }

// Một dòng bảng: dự kiến LUÔN có; thuc_te/muc/ghi_chu chỉ có khi đã bóc ảnh.
type RowDC = { thanh_phan: string; du_kien: string; thuc_te?: string; muc?: string; ghi_chu?: string };
const dongLoi = (r: RowDC) => { const { obj, attr } = tachTP(r.thanh_phan); return attr ? `${obj} · ${attr}` : obj; };

// Bảng dạng CÂY: đối tượng là nút cha, thuộc tính là con; lưới tự xuống dòng khít bề ngang. coAnh=false → chỉ Thành phần + Dự kiến (shot chưa bóc); coAnh=true → thêm Khớp (giữa) + Bóc ảnh.
function DoiChieuTable({ rows, coAnh }: { rows: RowDC[]; coAnh: boolean }) {
  const nhom: { obj: string; con: { r: RowDC; attr: string | null }[] }[] = [];
  for (const r of rows) { const { obj, attr } = tachTP(r.thanh_phan); const g = nhom.find((x) => x.obj === obj); if (g) g.con.push({ r, attr }); else nhom.push({ obj, con: [{ r, attr }] }); }
  const o: CSSProperties = { borderTop: '1px solid var(--line)', paddingTop: 4, whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.45 };
  const oT: CSSProperties = { ...mono, fontSize: 9, color: 'var(--fg-3)', textTransform: 'uppercase', paddingBottom: 2 };
  const gtc = coAnh ? 'minmax(96px,0.85fr) minmax(0,1.5fr) max-content minmax(0,1.5fr)' : 'minmax(120px,0.7fr) minmax(0,2fr)';
  const cells = (label: string, r: RowDC, child: boolean, first: boolean) => {
    const bt = first ? 'none' : (o.borderTop as string);
    const out = [
      <div key="a" style={{ ...o, borderTop: bt, paddingLeft: child ? 16 : 0, fontWeight: child ? 400 : 700, color: r.muc ? MUC_MAU[r.muc] : (child ? 'var(--fg-2)' : 'var(--fg-1)') }}>{child ? '↳ ' : ''}{label}</div>,
      <div key="b" style={{ ...o, borderTop: bt, color: 'var(--fg-2)' }}>{r.du_kien || '—'}</div>,
    ];
    if (coAnh) out.push(
      <div key="c" style={{ ...o, borderTop: bt }}>{r.muc ? <BadgeMuc muc={r.muc} /> : <span style={{ color: 'var(--fg-3)' }}>·</span>}</div>,
      <div key="d" style={{ ...o, borderTop: bt, color: 'var(--fg-1)' }}>{r.thuc_te ? <>{r.thuc_te}{r.ghi_chu && r.muc !== 'khớp' ? <span style={{ color: MUC_MAU[r.muc ?? ''], display: 'block', fontSize: 10 }}>↳ {r.ghi_chu}</span> : null}</> : <span style={{ color: 'var(--fg-3)' }}>— chưa bóc</span>}</div>,
    );
    return out;
  };
  return (
    <div style={{ fontSize: 11 }}>
      <div style={{ display: 'grid', gridTemplateColumns: gtc, columnGap: 10, alignItems: 'start' }}>
        <div style={oT}>Thành phần</div><div style={oT}>Dự kiến</div>{coAnh && <><div style={oT}>Khớp</div><div style={oT}>Bóc từ ảnh</div></>}
        {nhom.map((g, gi) => {
          if (g.con.length === 1 && g.con[0]!.attr === null) return <Fragment key={gi}>{cells(g.obj, g.con[0]!.r, false, false)}</Fragment>;
          const worst = mucXauNhat(g.con.map((x) => x.r.muc).filter(Boolean) as string[]);
          return (
            <Fragment key={gi}>
              <div style={{ ...o, gridColumn: '1 / -1', borderTop: '2px solid var(--line)', fontWeight: 700, fontSize: 11.5, color: worst ? MUC_MAU[worst] : 'var(--fg-1)' }}>▸ {g.obj}</div>
              {g.con.map((x, xi) => <Fragment key={xi}>{cells(x.attr ?? x.r.thanh_phan, x.r, true, xi === 0)}</Fragment>)}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
export function BocTachShot({ c }: { c: Canh }) {
  // Chip đầu/cuối: bấm → MỞ NGĂN đối chiếu RỘNG (DataTable kéo cột thoải mái, không bị panel hẹp cắt cột — anh 30/10/2026). Nhãn chip cho biết đã bóc / lệch / chưa.
  const bt = c.boc_tach;
  const cu = !!(bt?.tren?.dau && bt.tren.dau !== c.keyframe_url);   // keyframe sinh lại sau lần bóc → bóc tách cũ
  const khung = ([['dau', 'đầu', c.keyframe_url], ['cuoi', 'cuối', c.keyframe_ket]] as const).filter(([, , u]) => !!u);
  if (!khung.length) return null;
  const nhan = (luc: 'dau' | 'cuoi') => !bt?.[luc] ? ' · chưa bóc'
    : (bt.doi_chieu?.[luc]?.some((x) => x.muc === 'lệch' || x.muc === 'thiếu' || x.muc === 'thừa') ? ' · ✕ lệch' : bt.doi_chieu?.[luc]?.length ? ' · ✓' : ' · đã bóc') + (cu ? ' (cũ)' : '');
  return (
    <div style={{ marginTop: 6, display: 'grid', gap: 4 }}>
      <span style={{ ...mono, fontSize: 9.5, color: 'var(--fg-3)', textTransform: 'uppercase' }}>🎬 Keyframe đầu · cuối — bấm để mở ngăn đối chiếu (rộng, kéo cột)</span>
      <div style={{ display: 'flex', gap: 8 }}>{khung.map(([luc, ten, u]) => (
        <button key={luc} type="button" onClick={() => moNgan({ loai: 'doi-chieu', canhId: c.id })} title={`Mở ngăn đối chiếu khung ${ten} — rộng, kéo cột${bt?.[luc] ? '' : ' · chưa bóc, bấm 🧩 trong ngăn để chạy'}`}
          style={{ padding: 2, border: '2px solid var(--line)', borderRadius: 6, background: 'var(--bg-1)', cursor: 'pointer', display: 'grid', gap: 2, justifyItems: 'center' }}>
          <img src={anhNho(u as string, 320)} alt="" style={{ width: 86, aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 3, background: '#000' }} />
          <span style={{ ...mono, fontSize: 9, color: 'var(--fg-3)' }}>🧩 {ten}{nhan(luc)}</span>
        </button>))}</div>
    </div>
  );
}

// Gộp DANH MỤC DỰ KIẾN (luôn có) với ĐỐI CHIẾU từ ảnh (nếu đã bóc) theo thanh_phan → mỗi dòng có dự kiến + (thực tế/khớp khi đã bóc).
function ghepDC(duKien: { thanh_phan: string; du_kien: string }[], dc?: DongDoiChieu[]): RowDC[] {
  const map = new Map<string, RowDC>();
  for (const m of duKien) map.set(m.thanh_phan, { thanh_phan: m.thanh_phan, du_kien: m.du_kien });
  for (const d of dc ?? []) { const ex = map.get(d.thanh_phan);
    if (ex) { ex.thuc_te = d.thuc_te; ex.muc = d.muc; ex.ghi_chu = d.ghi_chu; if (!ex.du_kien || ex.du_kien === 'không khai' || ex.du_kien === 'không tả') ex.du_kien = d.du_kien || ex.du_kien; }
    else map.set(d.thanh_phan, { thanh_phan: d.thanh_phan, du_kien: d.du_kien, thuc_te: d.thuc_te, muc: d.muc, ghi_chu: d.ghi_chu }); }
  return [...map.values()];
}

// ⚖️ Ngăn RỘNG của một shot (loai 'doi-chieu'): mỗi khung (đầu/cuối) hiện DANH MỤC THÀNH PHẦN DỰ KIẾN (mọi shot, kể cả chưa bóc AI), gộp đối chiếu khi đã bóc;
// riêng khung đầu còn mục DỰ KIẾN BỔ SUNG nối từ shot trước (tách bạch). Nút bóc tách trong ngăn.
export function DoiChieuNgan({ canhId }: { canhId: number }) {
  const [d, setD] = useState<Awaited<ReturnType<typeof layThanhPhanCanh>> | null>(null);
  const [dangBoc, setDangBoc] = useState(false);
  const [loiBoc, setLoiBoc] = useState('');
  const [moDayDu, setMoDayDu] = useState<Record<string, boolean>>({});
  const tai = async () => setD(await layThanhPhanCanh(canhId));
  useEffect(() => { void tai(); }, [canhId]);
  const chayBoc = async () => {
    if (dangBoc) return;
    setDangBoc(true); setLoiBoc('');
    const r = await bocTachCanh(canhId);
    if (!r.ok) setLoiBoc(r.loi || 'bóc tách hỏng'); else await tai();
    setDangBoc(false);
  };
  if (!d) return <div style={{ ...mono, padding: 12, color: 'var(--fg-3)' }}>đang tải…</div>;
  if (!d.ok) return <div style={{ ...mono, padding: 12, color: 'var(--red)' }}>⚠ {d.loi}</div>;
  const bt = d.boc_tach;
  const cu = !!(bt?.tren?.dau && bt.tren.dau !== d.keyframe_url);
  const khung = [['dau', 'đầu', d.keyframe_url ?? null], ['cuoi', 'cuối', d.keyframe_ket ?? null]] as const;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 13 }}>{d.ten}</b>
        <button type="button" onClick={chayBoc} disabled={dangBoc || !d.keyframe_url} className="xv-btn"
          title="Bóc thành phần thật từ keyframe (đầu + cuối) rồi đối chiếu dự kiến. ~0,6¢/khung."
          style={{ ...mono, fontSize: 11, color: cu ? 'var(--amber)' : undefined, borderColor: cu ? 'var(--amber)' : undefined }}>
          {dangBoc ? '⏳ đang bóc tách…' : !d.keyframe_url ? '🧩 chưa có keyframe' : bt ? (cu ? '⟳ Bóc tách lại (ảnh đã đổi)' : '⟳ Bóc tách lại') : '🧩 Bóc tách khung này'}
        </button>
        {!d.keyframe_url && <span style={{ ...mono, fontSize: 11, color: 'var(--fg-3)' }}>shot chưa sinh keyframe — dưới là danh mục dự kiến</span>}
        {loiBoc && <span style={{ ...mono, fontSize: 11, color: 'var(--red)' }}>⚠ {loiBoc}</span>}
      </div>
      {khung.map(([luc, ten, u]) => {
        const rows = ghepDC(d.duKien?.[luc] ?? [], bt?.doi_chieu?.[luc]);
        const coAnh = !!u;
        const daChieu = (bt?.doi_chieu?.[luc]?.length ?? 0) > 0;
        const loi = rows.filter((r) => r.muc === 'lệch' || r.muc === 'thiếu' || r.muc === 'thừa');
        const gan = rows.filter((r) => r.muc === 'gần');
        const moDD = moDayDu[luc] ?? !daChieu;   // chưa đối chiếu → mở sẵn danh mục dự kiến; đã đối chiếu → gập, chỉ hiện khối lỗi
        return (
          <div key={luc} style={{ display: 'grid', gap: 6 }}>
            <div style={{ ...mono, fontSize: 11, color: 'var(--cyan)', textTransform: 'uppercase' }}>🎬 Khung {ten} · {rows.length} thành phần{coAnh ? (daChieu ? (loi.length ? ` · ⚠ ${loi.length} lỗi${gan.length ? ` · ${gan.length} gần` : ''}` : ' · ✓ khớp dự kiến') : ' · chưa đối chiếu, bấm ⟳ Bóc tách') : ' · chưa có ảnh (chỉ dự kiến)'}</div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              {u && <img src={anhNho(u, 640)} alt="" style={{ width: 200, aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 6, background: '#000', flexShrink: 0, position: 'sticky', top: 0 }} />}
              <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 8 }}>
                {daChieu && loi.length > 0 && (
                  <div style={{ border: '1px solid var(--red)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ ...mono, fontSize: 10.5, color: '#fff', fontWeight: 700, background: 'var(--red)', padding: '3px 8px' }}>⚠ {loi.length} LỖI — rê xem đủ</div>
                    <div style={{ padding: '3px 8px 4px' }}>
                      {loi.map((r, i) => {
                        const may = (r.ghi_chu ?? '').startsWith('[máy');
                        return (
                          <div key={i} title={`${dongLoi(r)}\nCần: ${r.du_kien || '—'}\nẢnh ra: ${r.thuc_te || '—'}${r.ghi_chu ? `\n${r.ghi_chu}` : ''}`}
                            style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 11, lineHeight: 1.8, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                            <span style={{ flexShrink: 0, fontWeight: 700, color: 'var(--fg-1)' }}>{dongLoi(r)}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--fg-3)' }}>
                              <span style={{ color: 'var(--fg-2)' }}>{r.du_kien || '—'}</span> → <span style={{ color: 'var(--red)', fontWeight: 600 }}>{r.thuc_te || '—'}</span>
                            </span>
                            <span style={{ ...mono, flexShrink: 0, fontSize: 8.5, padding: '0 3px', borderRadius: 3, background: may ? 'var(--green)' : 'var(--amber)', color: '#000' }}>{may ? 'máy' : 'AI'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {daChieu && loi.length === 0 && <div style={{ ...mono, fontSize: 11, color: '#fff', fontWeight: 700, background: 'var(--green)', borderRadius: 6, padding: '3px 8px' }}>✓ KHỚP DỰ KIẾN — 0 lỗi</div>}
                {coAnh ? (
                  <div>
                    <button type="button" className="xv-lienket xv-mono" style={{ fontSize: 10 }} onClick={() => setMoDayDu((m) => ({ ...m, [luc]: !moDD }))}>{moDD ? '▾ Ẩn' : '▸ Xem'} đầy đủ danh mục ({rows.length} thành phần{gan.length ? `, ${gan.length} gần` : ''})</button>
                    {moDD && <div style={{ marginTop: 4 }}><DoiChieuTable rows={rows} coAnh={coAnh} /></div>}
                  </div>
                ) : <DoiChieuTable rows={rows} coAnh={coAnh} />}
                {luc === 'dau' && d.boSung && d.boSung.muc.length > 0 && (
                  <div style={{ border: `1px ${d.boSung.tuThat ? 'solid var(--green)' : 'dashed var(--amber)'}`, borderRadius: 6, padding: '6px 8px' }}>
                    <div style={{ ...mono, fontSize: 10, color: d.boSung.tuThat ? 'var(--green)' : 'var(--amber)', textTransform: 'uppercase', marginBottom: 4 }}>
                      {d.boSung.tuThat
                        ? `🔗 THỰC TẾ đã xác lập ở cuối shot ${d.boSung.tuShot} — đầu shot này phải khớp tiếp`
                        : `➕ Dự kiến cuối shot ${d.boSung.tuShot} (chưa bóc — tạm theo kế hoạch, bóc xong sẽ cập nhật theo thực tế)`}
                    </div>
                    <DoiChieuTable rows={d.boSung.muc.map((m) => ({ thanh_phan: m.thanh_phan, du_kien: m.du_kien }))} coAnh={false} />
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** chiTiet: đang nằm trong ngăn chi tiết shot — cột trái rộng hơn, khung 3D nhúng bộ xem xoay được (#1365). */
export function CanhRow({ c, nhanVat, kt, khoa, ban, chay: chayTap, phimLoai, chiTiet, kg, sau }: { kg?: KhongGian | null; sau?: Canh | null; c: Canh; nhanVat: NhanVat[]; kt: Required<KinhThanh>; khoa: Khoa; phimLoai: LoaiPhim; ban: (k: string) => boolean; chay: (ten: string, fn: () => Promise<KqChay>, taiCho?: boolean) => Promise<string>; chiTiet?: boolean }) {
  // Lỗi của MỌI nút trong thẻ shot hiện ngay trên hàng nút của chính shot đó (không phải đầu tập).
  const [loiNut, setLoiNut] = useState('');
  const chay = async (k: string, fn: () => Promise<KqChay>) => { setLoiNut(''); setLoiNut(await chayTap(k, fn, true)); };
  const [mo, setMo] = useState(false);
  const [tabF, setTabF] = useState<'noi_dung' | 'the' | 'may' | 'ky_thuat'>('noi_dung');
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
  const anhKhung: CSSProperties = { width: doc ? 90 : 160, height: doc ? 160 : 90, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)' };
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
  const lyAnh = (!khoa.google && !khoa.openai && !(mhAnh.startsWith('fal:') && khoa.fal) && !(mhAnh.startsWith('ckey:') && khoa.ckey) && !(mhAnh.startsWith('shopaikey:') && khoa.shopaikey) && !khoa.ckey && !khoa.shopaikey && 'thiếu khoá ảnh') || (!c.prompt_anh.trim() && 'chưa có prompt ảnh (Sửa cảnh → prompt ảnh)') || (tp.thieu.length > 0 && `thiếu: ${tp.thieu.join('; ')}`);
  // Cùng cổng với máy chủ (quy-trinh.ts › chanVideo: keyframe đã duyệt + giọng trước video) → nút tắt kèm lý do thay vì bấm rồi bị chặn.
  // Nút Sinh nháp tự lo phần máy làm được (duyệt keyframe đang chọn, sinh giọng còn thiếu → giọng xong tự gửi video), nên chỉ tắt
  // vì thứ người phải làm: thiếu khoá, chưa có keyframe, đang sinh giọng dở.
  const thieuGiong = dongThoai(c, nhanVat).some((d) => d.loi.trim() && !d.url);
  const chanVid = chanVideo(c, nhanVat, phimLoai === 'quang_cao').filter((x) => x !== 'chưa duyệt keyframe' && !x.includes('chưa có giọng'));
  const lyVideo = (mhVideo.startsWith('fal:') ? !khoa.fal && 'thiếu FAL_KEY' : mhVideo.startsWith('shopaikey:') ? !khoa.shopaikey && 'thiếu SHOPAIKEY_API_KEY' : !khoa.google && !khoa.shopaikey && 'thiếu GOOGLE_API_KEY') || (chanVid.length > 0 && chanVid.join('; ')) || (c.dang_sinh_giong && 'đang sinh giọng — xong sẽ tự gửi video nếu anh đã bấm Sinh nháp');
  const chonAnh = <Chon nho value={mhAnh} onChange={setMhAnh} options={luaChonAnh(dsAnh)} title="Model ảnh cho lần sinh này" minWidth={220} />;
  const chonVideo = <Chon nho value={mhVideo} onChange={setMhVideo} options={luaChonVideo(dsVideo, giay, kt.do_phan_giai, phimLoai === 'quang_cao')} title="Model video cho lần sinh này" minWidth={240} />;
  // Bước kế của cảnh → MỘT nút chính; còn lại vào menu ⋯ (YDNI).
  const buoc = c.trang_thai === 'dang_sinh' || c.dang_sinh_anh ? 'dang' : c.video_cuoi_url ? 'cuoi' : c.video_url && c.trang_thai === 'xong' ? 'nhap' : c.trang_thai === 'duyet' ? 'duyet' : c.keyframe_url ? 'kf' : 'trong';

  return (
    <div className="xv-canh">
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0, width: Math.max(Number(anhKhung.width), chiTiet ? 260 : 180), display: 'grid', justifyItems: 'center', alignContent: 'start' }}>
          {c.video_cuoi_url ? <div><ClipNho url={c.video_cuoi_url} ten={`#${c.thu_tu} ${c.canh} · bản cuối`} style={anhKhung} /><div style={{ ...mono, color: 'var(--lime)', textAlign: 'center' }}>bản cuối</div><NguonTep c={c} url={c.video_cuoi_url} />{c.keyframe_url && <KfNho url={c.keyframe_url} soSanh={soSanh} />}</div>
            : c.video_url ? <div><ClipNho url={c.video_url} ten={`#${c.thu_tu} ${c.canh} · nháp`} style={anhKhung} /><div style={{ ...mono, textAlign: 'center' }}>nháp</div><NguonTep c={c} url={c.video_url} />{c.keyframe_url && <KfNho url={c.keyframe_url} soSanh={soSanh} />}</div>
            : c.keyframe_url ? <div style={{ position: 'relative' }}><img src={anhNho(c.keyframe_url, 320)} alt="" data-so-sanh={soSanh} style={anhKhung} />{buoc === 'dang' && <DangSinh chu="" />}</div>
            : <div style={{ ...anhKhung, position: 'relative', display: 'grid', placeItems: 'center', color: 'var(--fg-4)', fontSize: 10, overflow: 'hidden' }}>chưa có{buoc === 'dang' && <DangSinh chu={c.dang_sinh_anh ? 'ảnh' : 'video'} />}</div>}
          {/* KHUNG 3D của shot (#1365): ảnh khung màu / xám từ bộ set — bấm mở bộ xem đúng máy shot; trong ngăn chi tiết thì xoay được tại chỗ. */}
          {c.may_3d && (chiTiet
            ? <div style={{ justifySelf: 'stretch', marginTop: 6 }}><div style={{ ...mono, fontSize: 9.5, color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 2 }}>🧊 Bản 3D</div><BoSetXem tapId={c.tap_id} canhId={c.id} gon /></div>
            : (c.khung_xam?.mau || c.khung_xam?.xam) && <button type="button" title="Khung 3D của shot (Blender) — bấm để xoay xem đúng máy shot" onClick={() => moNgan({ loai: 'bo-set', tapId: c.tap_id, canhId: c.id })}
                style={{ justifySelf: 'stretch', marginTop: 6, padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'grid', gap: 2, justifyItems: 'center' }}>
                <span style={{ ...mono, fontSize: 9.5, color: 'var(--fg-3)', textTransform: 'uppercase', justifySelf: 'start' }}>🧊 Bản 3D</span>
                {c.khung_xam.mau_ket
                  ? <div style={{ width: '100%' }}><KhungDauKet kx={c.khung_xam} doc={kt.ti_le !== '16:9'} onMo={() => moNgan({ loai: 'bo-set', tapId: c.tap_id, canhId: c.id })} /></div>
                  : <img src={anhNho(c.khung_xam.mau || c.khung_xam.xam, 320)} alt="" style={{ ...anhKhung, objectFit: 'contain', background: '#000' }} />}
              </button>)}
          {/* SƠ ĐỒ SHOT (so-do-shot.ts, 0đ): vẽ từ sơ đồ cảnh 2D + sổ đồ vật + kế hoạch biểu cảm — cỡ khung, trái / phải màn, nhìn ai, nét mặt, đồ, điểm neo mắt. */}
          {!c.may_3d && (() => {
            // cặp ĐẦU | CUỐI: khung cuối của shot nối động tác vẽ đầu đã bắt đầu quay về hướng shot sau (mũi tên cam) — duyệt chỗ nối trước khi sinh
            const ds = (['dau', 'ket'] as const).map((luc) => { const v = veShotTuCanh(c, kg, nhanVat, { luc, sau }); return v ? { luc, url: `data:image/svg+xml;utf8,${encodeURIComponent(svgSoDoShot(v))}` } : null; }).filter((x) => !!x);
            if (!ds.length) return null;
            return <div style={{ justifySelf: 'stretch', marginTop: 6, display: 'grid', gap: 2 }}>
              <span style={{ ...mono, fontSize: 9.5, color: 'var(--fg-3)', textTransform: 'uppercase' }} title="Sơ đồ shot — vẽ từ dữ liệu: cỡ khung, ai đứng đâu, nhìn ai (mũi tên vàng), nét mặt (ô góc = nét cuối shot), đồ trên người, dấu xanh = điểm neo mắt; mũi tên cam = đầu bắt đầu quay ở cuối shot (cắt giữa động tác)">📐 Sơ đồ đầu · cuối</span>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${ds.length}, 1fr)`, gap: 4 }}>
                {ds.map((d) => <button key={d.luc} type="button" title={`Sơ đồ ${d.luc === 'ket' ? 'cuối' : 'đầu'} shot — bấm để phóng to`} onClick={() => moNgan({ loai: 'xem', url: d.url, ten: `Sơ đồ shot #${c.thu_tu} · ${d.luc === 'ket' ? 'cuối' : 'đầu'}` })}
                  style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}><img src={d.url} alt="" style={{ width: '100%', aspectRatio: kt.ti_le === '16:9' ? '16 / 9' : '9 / 16', objectFit: 'contain', background: '#000', borderRadius: 4 }} /></button>)}
              </div>
            </div>; })()}
          <div style={{ justifySelf: 'stretch' }}><KyThuatTheoNhom kt={c.ky_thuat} /></div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ ...mono, color: 'var(--fg-2)' }}>#{c.thu_tu}</span>
            <strong style={{ fontSize: 12 }} title={c.goc_may}>{c.canh || 'Cảnh'}</strong>
            <Pill color={tt.color}>{tt.label}</Pill>
            <span style={mono} title={c.phat_s && c.phat_s !== c.thoi_luong_s ? `phát ${c.phat_s}s, clip sinh ${c.thoi_luong_s}s (cắt lấy phần đầu)` : undefined}>{c.phat_s && c.phat_s !== c.thoi_luong_s ? `phát ${c.phat_s}s / clip ${c.thoi_luong_s}s` : `${c.thoi_luong_s}s`}{c.chi_phi_cents > 0 ? ` · đã tốn ${tien(c.chi_phi_cents)}` : ''}</span>
            {c.nhanh && <Pill color="var(--amber)">hook {c.nhanh}</Pill>}
            {c.chu_man && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 4, border: '1px solid var(--line)', color: 'var(--fg-1)', fontWeight: 600 }} title={c.chu_man}>✎ {chuManHien(c.chu_man)}</span>}
          </div>
          {(
            <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              {tp.ds.map(({ nv, bt, anh, thieu }) => (
                <span key={nv.id} title={thieu.length ? thieu.join('\n') : `${nv.ten}${bt ? ` · ${bt.ten}` : ''} — sẵn sàng`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 7px 2px 2px', borderRadius: 999, border: `1px solid ${thieu.length ? 'var(--red)' : 'var(--line)'}`, background: 'var(--bg-1)', fontSize: 10.5 }}>
                  {anh ? <img src={anhNho(anh, 160)} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} /> : <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-2)', display: 'grid', placeItems: 'center', color: 'var(--red)' }}>!</span>}
                  <span>{nv.ten}</span>
                  {/* Chọn biến thể ngay trên chip (#1249): ảnh gốc hoặc một biến thể (phòng ngủ sáng / tối…) — mỗi đối tượng tối đa 1. */}
                  {(nv.bien_the ?? []).length > 0 ? (
                    <Chon nho value={bt ? String(bt.id) : ''} onChange={(x) => void chay(k, () => suaCanh(c.id, { bien_the: doiBienThe(c.bien_the, nv, x ? Number(x) : null) }))}
                      title={`Biến thể của ${nv.ten} trong shot này`}
                      options={[{ value: '', label: 'ảnh gốc' }, ...(nv.bien_the ?? []).map((b) => ({ value: String(b.id), label: b.ten, phu: b.anh_url ? undefined : 'chưa ảnh', title: b.mo_ta }))]} />
                  ) : null}
                  {thieu.length > 0 && <span style={{ color: 'var(--red)' }}>thiếu</span>}
                </span>
              ))}
              {/* Thêm/bớt đối tượng ngay trên thẻ (#1210): nhân vật · sản phẩm · bối cảnh · đạo cụ — lưu luôn, keyframe sau tham chiếu đúng.
                  Chỉ một nút ＋ (#1382): đối tượng đã chọn đã hiện thành chip bên trái, ô liệt kê lại tên chỉ thêm rối. */}
              <Chon nho multi xacNhanBo nut="＋" values={c.nhan_vat.map(String)} onValues={(v) => void chay(k, () => suaCanh(c.id, { nhan_vat: v.map(Number) }))} minWidth={220} placeholder="＋ đối tượng"
                title="Thêm / bớt nhân vật, sản phẩm, bối cảnh, đạo cụ có trong shot (ảnh của chúng làm tham chiếu khi sinh keyframe)"
                options={nhanVat.map((v) => ({ value: String(v.id), label: v.ten, nhom: LOAI_NHAN_VAT.find((l) => l.key === v.loai)?.label, phu: v.anh_ref.length ? undefined : 'chưa ảnh' }))} />
              {phimLoai === 'quang_cao' && !nhanVat.some((v) => v.loai === 'san_pham' && c.nhan_vat.includes(v.id)) && nhanVat.some((v) => v.loai === 'san_pham') && <span style={{ fontSize: 10.5, color: 'var(--amber)' }}>⚠ shot chưa có sản phẩm</span>}
            </div>
          )}
          <div style={{ fontSize: 11.5, marginTop: 3, color: 'var(--fg-2)' }} title={[moTaVi(c) && moTaVi(c) !== c.hanh_dong.trim() ? `🇻🇳 ${moTaVi(c)}` : '', c.loi_thoai ? `“${c.loi_thoai}”` : ''].filter(Boolean).join('\n') || undefined}>{c.hanh_dong}</div>
          {nhanVat.some((v) => v.loai === 'nhan_vat' && c.nhan_vat.includes(v.id)) && (
            <TrangPhucShot c={c} onLuu={(t) => void chay(k, () => suaCanh(c.id, { trang_phuc: t }))} />
          )}
          <BocTachShot c={c} />

          {phimLoai === 'quang_cao' && <BieuCamShot c={c} nhanVat={nhanVat} onDoi={async () => { await chay(k, async () => ({ ok: true as const, data: undefined })); }} />}
          {dongThoai(c, nhanVat).length > 0 && (
            <div style={{ marginTop: 4, padding: '4px 8px', borderLeft: '2px solid var(--line)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              {dongThoai(c, nhanVat).map((d, i) => (
                <div key={i} style={{ marginBottom: 2, display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <b style={{ color: 'var(--cyan)', textTransform: 'uppercase' }}>{tenNoi(d)}</b>
                  {d.dien_xuat && <i style={{ color: 'var(--fg-3)' }}>({d.dien_xuat})</i>}
                  <span style={{ color: 'var(--fg-1)' }}>{d.loi}</span>
                  {d.url && <NutNghe url={d.url} title={`Nghe giọng ${tenNoi(d)}`} />}
                </div>
              ))}
            </div>
          )}
          <KyThuatGon phanDoan={c.phan_doan} />
          {/* Giọng đã nằm ở từng dòng thoại phía trên; ở đây chỉ còn file giọng gộp cũ (không gán được dòng nào) + hiệu ứng. */}
          {((c.thoai_url && !dongThoai(c, nhanVat).some((d) => d.url)) || c.am_thanh_url || c.dang_sinh_am) && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
              {c.thoai_url && !dongThoai(c, nhanVat).some((d) => d.url) && <NutNghe url={c.thoai_url} nhan="🗣 giọng" />}
              {c.am_thanh_url && <NutNghe url={c.am_thanh_url} nhan="🔊 hiệu ứng" />}
              {(c.dang_sinh_giong || c.dang_sinh_sfx) && <span style={{ ...mono, color: 'var(--violet)' }}>⏳ đang sinh {[c.dang_sinh_giong && 'giọng', c.dang_sinh_sfx && 'hiệu ứng'].filter(Boolean).join(' + ')}…</span>}
            </div>
          )}
          {tp.thieu.length > 0 && <div style={{ fontSize: 10.5, color: 'var(--red)', marginTop: 3 }}>Chưa sinh được: {tp.thieu.join(' · ')} — chuẩn bị ở tab 🎭 Phim.</div>}
          <Loi>{c.loi}</Loi>
          {c.keyframe_uv.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
              {c.keyframe_uv.map((u) => (
                <div key={u} style={{ display: 'grid', gap: 1, justifyItems: 'center', maxWidth: 72 }}>
                  <AnhNho url={u} soSanh={soSanh} vien={u === c.keyframe_url ? 'var(--cyan)' : undefined} title={`${u === c.keyframe_url ? 'đang chọn' : 'chọn ảnh này làm keyframe'}${c.nguon_tep?.[u] ? `\n${c.nguon_tep[u]!.day}` : ''}`}
                    onClick={() => void chay(k, async () => { await chonKeyframe(c.id, u); })} onXoa={() => chay(k, () => xoaKeyframe(c.id, u))} />
                  <NguonTep c={c} url={u} />
                </div>
              ))}
            </div>
          )}
          {c.video_phien_ban.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={mono}>{c.video_phien_ban.length} phiên bản:</span>
              {c.video_phien_ban.map((v, i) => {
                const dung = v.url === c.video_url || v.url === c.video_cuoi_url;
                return (
                  <Menu key={v.url + i} nhan={`${dung ? '● ' : ''}${i + 1} ${v.ban === 'cuoi' ? 'cuối' : 'nháp'}${c.nguon_tep?.[v.url] ? ` · ${c.nguon_tep[v.url]!.ngan}` : ''}`}>
                    <div style={{ ...mono, padding: '2px 4px', whiteSpace: 'pre-line' }}>{c.nguon_tep?.[v.url]?.day ?? v.model}{v.luc ? ` · ${gioVN(v.luc)}` : ''}</div>
                    <MucMenu onClick={() => moNgan({ loai: 'xem', url: v.url, ten: `Cảnh #${c.thu_tu} · phiên bản ${i + 1}` })}>▶ Xem / tải</MucMenu>
                    {v.url !== c.video_url && <MucMenu onClick={() => void chay(i + 'n' + c.id, () => chonPhienBan(c.id, v.url, 'nhap'))}>Dùng làm nháp</MucMenu>}
                    {v.url !== c.video_cuoi_url && <MucMenu onClick={() => void chay(i + 'c' + c.id, () => chonPhienBan(c.id, v.url, 'cuoi'))}>Dùng làm bản cuối</MucMenu>}
                  </Menu>
                );
              })}
            </div>
          )}
          <Loi>{loiNut}</Loi>
          {/* Nút xếp theo NHÓM (#1245): Ảnh (model + sinh/duyệt) · Video (model + nháp/bản cuối) · sửa/⋯ ở mép phải. */}
          <div style={{ display: 'flex', gap: 8, marginTop: 7, flexWrap: 'wrap', alignItems: 'stretch' }}>
            <NhomNut nhan="🖼 Ảnh">
              {chonAnh}
              {buoc === 'trong' && <Nut chinh ly={lyAnh} ban={ban(k)} onClick={() => void chay(k, () => sinhKeyframe(c.id, 1, mhAnh))} gia={giaAnh}>Sinh keyframe · {tien(giaAnh)}</Nut>}
              {/* Sinh lại ảnh hiện ngay (không giấu trong ⋯): sửa trang phục / prompt / đối tượng xong là bấm lại được. Ảnh cũ vẫn giữ làm ứng viên. */}
              {buoc !== 'trong' && buoc !== 'dang' && <Nut ly={lyAnh} ban={ban(k)} title="Sinh thêm một ảnh keyframe mới theo prompt / trang phục / đối tượng hiện tại; ảnh cũ vẫn giữ trong dải ứng viên để chọn lại" onClick={() => void chay(k, () => sinhKeyframe(c.id, 1, mhAnh))} gia={giaAnh}>↻ Sinh lại · {tien(giaAnh)}</Nut>}
              {buoc === 'kf' && <Nut chinh ban={ban(k)} onClick={() => void chay(k, () => duyetCanh(c.id, true))}>✓ Duyệt keyframe</Nut>}
              {buoc === 'dang' && c.dang_sinh_anh && <span style={{ ...mono, color: 'var(--violet)', alignSelf: 'center' }}>đang sinh ảnh…</span>}
            </NhomNut>
            {(buoc === 'kf' || buoc === 'duyet' || buoc === 'nhap' || buoc === 'cuoi' || (buoc === 'dang' && !c.dang_sinh_anh)) && (
              <NhomNut nhan="🎬 Video">
                {buoc !== 'dang' && chonVideo}
                {(buoc === 'duyet' || buoc === 'kf') && <Nut chinh ly={lyVideo} ban={ban(k)} title={[buoc === 'kf' && 'bấm = duyệt keyframe đang chọn', thieuGiong && 'shot còn lời chưa có giọng: sinh giọng trước, giọng xong máy tự gửi video'].filter(Boolean).join(' · ') || undefined} onClick={() => void chay(k, () => sinhVideoCanh(c.id, mhVideo, 'nhap', true))} gia={giaVid}>{c.dang_sinh_giong ? '⏳ Đang sinh giọng…' : `${thieuGiong ? '🗣 Giọng + ' : ''}Sinh nháp · ${giay}s · ${tien(giaVid)}`}</Nut>}
                {buoc !== 'dang' && chanVid.length > 0 && <span style={{ fontSize: 11, color: 'var(--red)', alignSelf: 'center' }}>chưa sinh video được: {chanVid.join('; ')}</span>}
                {/* SINH THỬ ngoài quy trình (anh 14/10/2026): thử một shot không phải đi hết cổng — có keyframe là bấm được; job ghi 🧪 THỬ. Có keyframe kết thì làm ảnh cuối. */}
                {buoc !== 'dang' && chanVid.length > 0 && c.keyframe_url && <Nut ly={mhVideo.startsWith('fal:') ? !khoa.fal && 'thiếu FAL_KEY' : !khoa.google && 'thiếu GOOGLE_API_KEY'} ban={ban(k)} title={`Sinh thử video ngoài quy trình (bỏ cổng duyệt / kiểm khung / animatic) — ảnh đầu = keyframe đang chọn${c.keyframe_ket ? ', ảnh cuối = keyframe kết (chuyển động theo 3D)' : ''}. Ghi vào sổ là bản THỬ.`} onClick={() => void chay(k, () => sinhVideoThu(c.id, mhVideo))} gia={giaVid}>🧪 Sinh thử · {giay}s · {tien(giaVid)}</Nut>}
                {buoc === 'dang' && <span style={{ ...mono, color: 'var(--violet)', alignSelf: 'center' }} title={c.video_dang?.day}>đang sinh video{c.video_dang ? ` · ${c.video_dang.ngan}` : ''}, tự kiểm mỗi 10s…</span>}
                {(buoc === 'nhap' || buoc === 'cuoi') && <Nut ly={lyVideo} ban={ban(k)} title="Sinh một bản nháp video mới từ keyframe đang chọn; bản cũ vẫn giữ trong danh sách phiên bản" onClick={() => void chay(k, () => sinhVideoCanh(c.id, mhVideo, 'nhap', true))} gia={giaVid}>↻ Nháp mới · {giay}s · {tien(giaVid)}</Nut>}
                {buoc === 'nhap' && <Nut chinh ly={!khoa.fal && 'thiếu FAL_KEY'} ban={ban(k)} title="Nâng cấp CHÍNH clip nháp (Topaz ×2): chuyển động, bố cục, nhân vật y hệt bản nháp" onClick={() => void chay(k, () => nangCapCanh(c.id))} gia={giaNangCap}>⬆ Làm bản cuối · {tien(giaNangCap)}</Nut>}
                {buoc === 'cuoi' && <a href={linkTai(c.video_cuoi_url!)} download className="xv-btn chinh" style={{ textDecoration: 'none' }}>⬇ Tải bản cuối</a>}
              </NhomNut>
            )}
            <span style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {/* Sửa cảnh là việc hay làm nhất sau sinh ảnh → nút riêng cạnh ⋯ (#1228), không chôn trong menu. */}
            <button type="button" className={`xv-btn${mo ? ' chinh' : ''}`} onClick={() => setMo(!mo)} title="Sửa cảnh: nội dung, thoại, máy, prompt">✎ Sửa</button>
            <Menu>
              <div style={{ ...mono, padding: '2px 4px' }}>Model cho các lệnh bên dưới</div>
              <div style={{ display: 'grid', gap: 4 }}>{chonAnh}{chonVideo}</div>
              {dongThoai(c, nhanVat).some((d) => d.loi.trim()) && <MucMenu ly={(!khoa.fal && 'thiếu FAL_KEY') || (c.dang_sinh_giong && 'đang sinh giọng — đợi xong')} onClick={() => void chay(`g${c.id}`, () => sinhGiong(c.tap_id, [c.id]))}>🗣 {c.thoai_url ? 'Sinh lại' : 'Sinh'} giọng shot này</MucMenu>}
              <MucMenu ly={(!khoa.fal && 'thiếu FAL_KEY') || (c.dang_sinh_sfx && 'đang sinh hiệu ứng — đợi xong')} onClick={() => void chay(`s${c.id}`, () => sinhAmThanh(c.tap_id, [c.id]))}>🔊 {c.am_thanh_url ? 'Sinh lại' : 'Sinh'} hiệu ứng âm thanh{c.video_url ? ' (từ clip)' : ''}</MucMenu>
              {(buoc === 'nhap' || buoc === 'cuoi') && dongThoai(c, nhanVat).some((d) => d.url) && <MucMenu ly={!khoa.fal && 'thiếu FAL_KEY'} gia={KHOP_MIENG.giaGiayCents * (c.thoi_luong_s || 8)} onClick={() => void chay(k, () => khopMiengCanh(c.id))}>👄 Khớp miệng với giọng đã sinh ({KHOP_MIENG.label}) · {tien(KHOP_MIENG.giaGiayCents * (c.thoi_luong_s || 8))}</MucMenu>}
              {(buoc === 'nhap' || buoc === 'cuoi') && <MucMenu onClick={() => void chay(k, () => lamLaiTuKeyframe(c.id))}>↩ Làm lại từ keyframe (đổi ảnh / duyệt lại — các bản video vẫn giữ trong phiên bản)</MucMenu>}
              {c.trang_thai === 'duyet' && <MucMenu onClick={() => void chay(k, () => duyetCanh(c.id, false))}>↩ Bỏ duyệt keyframe</MucMenu>}
              {c.trang_thai === 'loi' && buoc !== 'nhap' && buoc !== 'cuoi' && c.keyframe_url && <MucMenu ly={lyVideo} onClick={() => void chay(k, () => sinhVideoCanh(c.id, mhVideo, 'nhap', true))} gia={giaVid}>↻ Sinh lại nháp · {giay}s · {tien(giaVid)}</MucMenu>}
              {(buoc === 'nhap' || buoc === 'cuoi') && <MucMenu ly={lyVideo} onClick={() => void chay(k, () => sinhVideoCanh(c.id, mhVideo, 'cuoi', true))} gia={giaVid}>🎬 Bản cuối = sinh lại bằng model đã chọn · {tien(giaVid)} (chuyển động có thể khác nháp)</MucMenu>}
              {buoc === 'cuoi' && <MucMenu ly={!khoa.fal && 'thiếu FAL_KEY'} onClick={() => void chay(k, () => nangCapCanh(c.id))} gia={giaNangCap}>⬆ Nâng cấp lại từ nháp · {tien(giaNangCap)}</MucMenu>}
              {c.video_url && <a data-dong="" href={linkTai(c.video_url)} download className="xv-btn" style={{ textDecoration: 'none' }}>⬇ Tải nháp</a>}
              {(c.keyframe_url || c.video_url) && <MucMenu onClick={() => void chay(k, () => luuShotKho(c.id))}>⭐ Lưu shot vào kho (keyframe + clip đang dùng)</MucMenu>}
              <MucMenu onClick={() => moNgan({ loai: 'kho', dich: { canhId: c.id } })}>📦 Lấy clip / keyframe từ kho (0đ)</MucMenu>
              {(c.keyframe_url || c.video_url) && <MucMenu onClick={() => moNgan({ loai: 'nguon', canhId: c.id })}>🔗 Nguồn của shot — keyframe/clip sinh từ gì, nguồn nào đã đổi (0đ)</MucMenu>}
              <MucMenu nguy onClick={() => void chay(k, async () => { await xoaCanh(c.id); })}>🗑 Xoá cảnh</MucMenu>
            </Menu>
            </div>
          </div>
        </div>
      </div>
      {mo && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--line)' }}>
          {/* YDNI: 3 tab thay một form dài phải cuộn — nội dung (hay sửa nhất) mặc định; máy/cảm xúc; thời lượng + prompt (ít đụng). Thanh Lưu luôn thấy. */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {([['noi_dung', 'Nội dung'], ['the', 'Thẻ shot'], ['may', 'Máy · cảm xúc · âm'], ['ky_thuat', 'Thời lượng · prompt']] as const).map(([key, chu]) => <button key={key} type="button" className={`xv-btn${tabF === key ? ' chinh' : ''}`} onClick={() => setTabF(key)}>{chu}</button>)}
          </div>
          {tabF === 'noi_dung' && (
            <div className="xv-grid">
              <O label="Nhãn cảnh"><input className="xv-in" value={f.canh} onChange={(e) => setF({ ...f, canh: e.target.value })} /></O>
              <O label="Đối tượng"><Chon multi values={f.nhan_vat.map(String)} onValues={(v) => setF({ ...f, nhan_vat: v.map(Number) })} options={nhanVat.map((v) => ({ value: String(v.id), label: v.ten, nhom: LOAI_NHAN_VAT.find((l) => l.key === v.loai)?.label }))} placeholder="chọn…" /></O>
              <O label="Biến thể" hint="mỗi đối tượng tối đa 1"><Chon multi values={f.bien_the.map(String)} onValues={(v) => setF({ ...f, bien_the: motBienTheMoiDoiTuong(v.map(Number), nhanVat) })} options={tatCaBt.filter((b) => f.nhan_vat.includes(b.nhan_vat_id)).map((b) => ({ value: String(b.id), label: b.ten, nhom: b.nv }))} placeholder="không dùng biến thể" /></O>
              <O span label="Hành động"><textarea className="xv-ta" rows={2} value={f.hanh_dong} onChange={(e) => setF({ ...f, hanh_dong: e.target.value })} /></O>
              <O span label="Mô tả tiếng Việt" hint="người duyệt đọc trên lưới — không gửi model"><textarea className="xv-ta" rows={2} value={f.hanh_dong_vi} onChange={(e) => setF({ ...f, hanh_dong_vi: e.target.value })} /></O>
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="xv-lbl" style={{ marginBottom: 4 }} title="Mỗi lượt nói một dòng: nhân vật · diễn xuất · lời. Mỗi dòng sinh giọng riêng theo giọng cố định của nhân vật (đổi ở nút giọng cạnh tên).">Thoại</div>
                {f.thoai.map((d, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '150px auto 180px 1fr auto', gap: 6, marginBottom: 4, alignItems: 'center' }}>
                    <Chon nho value={d.nhan_vat} onChange={(v) => setF({ ...f, thoai: f.thoai.map((x, j) => (j === i ? { ...x, nhan_vat: v } : x)) })} minWidth={150}
                      options={[{ value: '', label: LOI_DAN }, ...nhanVat.filter((v) => v.loai === 'nhan_vat').map((v) => ({ value: v.ten, label: v.ten }))]} />
                {/* Chọn model + giọng của người nói ngay tại dòng (#1221) — giọng cố định theo nhân vật, đổi ở đây là đổi cả phim. */}
                {(() => { const v = nhanVat.find((x) => x.loai === 'nhan_vat' && x.ten === d.nhan_vat); return v ? <GiongNhanVat v={v} onChanged={async () => { await chay(k, async () => undefined); }} /> : <span style={mono}>—</span>; })()}
                    <input className="xv-in" placeholder="diễn xuất: nhìn lên, giơ tay" value={d.dien_xuat} onChange={(e) => setF({ ...f, thoai: f.thoai.map((x, j) => (j === i ? { ...x, dien_xuat: e.target.value } : x)) })} />
                    <input className="xv-in" placeholder="lời nói" value={d.loi} onChange={(e) => setF({ ...f, thoai: f.thoai.map((x, j) => (j === i ? { ...x, loi: e.target.value } : x)) })} />
                    <button type="button" className="xv-btn" title="Bỏ dòng" onClick={() => setF({ ...f, thoai: f.thoai.filter((_, j) => j !== i) })}>✕</button>
                  </div>
                ))}
                <button type="button" className="xv-btn" onClick={() => setF({ ...f, thoai: [...f.thoai, { nhan_vat: f.thoai[f.thoai.length - 1]?.nhan_vat ?? '', dien_xuat: '', loi: '' }] })}>+ Dòng thoại</button>
              </div>
              <O span label="Chữ trên màn" hint="≤ 8 từ: hook, số liệu, ưu đãi, CTA"><input className="xv-in" value={f.chu_man} onChange={(e) => setF({ ...f, chu_man: e.target.value })} placeholder="để trống = không có chữ" /></O>
              <O span label="Trang phục" hint="đè bộ đồ trong mô tả nhân vật, giữ mặt/tóc/dáng — vd: chỉ mặc áo bra, KHÔNG áo ngoài"><input className="xv-in" value={f.trang_phuc} onChange={(e) => setF({ ...f, trang_phuc: e.target.value })} placeholder="để trống = mặc như mô tả nhân vật" /></O>
            </div>
          )}
          {tabF === 'the' && (
            <div className="xv-grid">
              {O_DAN_DUNG.map((o) => (
                <O key={o.key} span label={`${o.ten}${o.vaoModel ? ' · tiếng Anh' : ''}`} hint={o.vaoModel ? 'đi vào prompt ảnh + video' : 'ghi chú dựng'}>
                  <textarea className="xv-ta" rows={2} value={f.dan_dung?.[o.key] ?? ''} placeholder={o.mau} onChange={(e) => setF({ ...f, dan_dung: { ...(f.dan_dung ?? {}), [o.key]: e.target.value } })} style={o.vaoModel ? { fontFamily: 'var(--font-mono)' } : undefined} />
                </O>
              ))}
            </div>
          )}
          {tabF === 'may' && (
            <div className="xv-grid">
              <O label="Góc máy"><input className="xv-in" value={f.goc_may} onChange={(e) => setF({ ...f, goc_may: e.target.value })} /></O>
              <O label="Phân cảnh"><input className="xv-in" value={f.phan_doan} onChange={(e) => setF({ ...f, phan_doan: e.target.value })} /></O>
              <O label={`Khán giả cuối shot: ${tenCamXuc(f.cam_xuc)} (${f.cam_xuc > 0 ? '+' : ''}${f.cam_xuc})`} hint="Cảm xúc ta muốn khán giả có ở cuối shot: -5 tuyệt vọng … 0 trung tính … +5 muốn mua ngay — vẽ đường cong Khán giả trên timeline"><input type="range" min={-5} max={5} step={1} value={f.cam_xuc} onChange={(e) => setF({ ...f, cam_xuc: Number(e.target.value) })} /></O>
              <O label="Âm thanh"><input className="xv-in" value={f.am_thanh} onChange={(e) => setF({ ...f, am_thanh: e.target.value })} /></O>
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="xv-lbl" style={{ marginBottom: 4 }} title="Chọn từ thư viện; nhóm hợp thể loại phim đứng đầu; ghép vào prompt ảnh/video khi sinh">Ngôn ngữ điện ảnh · <button type="button" className="xv-lienket" style={{ textTransform: 'none', fontWeight: 400 }} onClick={() => moNgan({ loai: 'thu-vien', tl: kt.the_loai })}>thư viện</button></div>
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
            </div>
          )}
          {tabF === 'ky_thuat' && (
            <div className="xv-grid">
              <O label="Clip sinh"><Chon value={String(f.thoi_luong_s)} onChange={(v) => setF({ ...f, thoi_luong_s: Number(v) })} options={[3, 4, 5, 6, 8, 10, 12, 15].map((x) => ({ value: String(x), label: `${x} giây`, phu: x > 8 ? 'chỉ model fal' : undefined }))} minWidth={140} /></O>
              <O label="Giây phát" hint="cắt phần đầu clip; trống = cả clip"><input className="xv-in" type="number" min={1} max={15} step={0.5} value={f.phat_s ?? ''} onChange={(e) => setF({ ...f, phat_s: e.target.value === '' ? null : Number(e.target.value) })} placeholder={String(f.thoi_luong_s)} style={{ width: 90 }} /></O>
              <O label="Nhánh hook" hint="trống = thân chung · A/B/C"><input className="xv-in" value={f.nhanh} onChange={(e) => setF({ ...f, nhanh: e.target.value.trim().toUpperCase().slice(0, 2) })} placeholder="—" style={{ width: 70 }} /></O>
              <O span label="Prompt ảnh · tiếng Anh"><textarea className="xv-ta" rows={3} value={f.prompt_anh} onChange={(e) => setF({ ...f, prompt_anh: e.target.value })} style={{ fontFamily: 'var(--font-mono)' }} /></O>
              <O span label="Prompt video · tiếng Anh"><textarea className="xv-ta" rows={3} value={f.prompt_video} onChange={(e) => setF({ ...f, prompt_video: e.target.value })} style={{ fontFamily: 'var(--font-mono)' }} /></O>
            </div>
          )}
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Nut ly={!khoa.anthropic && 'thiếu ANTHROPIC_API_KEY'} ban={ai || ban(k)} title="Claude đọc cảnh trước/sau + tuyến nhân vật + phong cách → điền đủ góc máy, hành động, lời thoại, prompt ảnh, prompt video khớp mạch. Chỉ điền vào form, anh xem rồi Lưu cảnh." onClick={() => void aiVietLai()}>{ai ? '… AI đang viết' : '✨ AI viết lại cảnh (khớp cảnh trước/sau)'}</Nut>
            <Loi>{loiAi}</Loi>
            <Nut ly={!dirty && 'chưa sửa'} ban={ban(k)} chinh onClick={() => void chay(k, async () => {
              await suaCanh(c.id, { canh: f.canh, goc_may: f.goc_may, thoi_luong_s: f.thoi_luong_s, nhan_vat: f.nhan_vat, bien_the: f.bien_the, hanh_dong: f.hanh_dong, hanh_dong_vi: f.hanh_dong_vi, loi_thoai: f.loi_thoai, am_thanh: f.am_thanh, prompt_anh: f.prompt_anh, prompt_video: f.prompt_video, phan_doan: f.phan_doan, cam_xuc: f.cam_xuc, ky_thuat: f.ky_thuat, dan_dung: f.dan_dung, thoai: f.thoai, phat_s: f.phat_s, chu_man: f.chu_man, nhanh: f.nhanh, trang_phuc: f.trang_phuc });
              setMo(false);
            })}>Lưu cảnh</Nut>
            <button type="button" className="xv-btn" onClick={() => { setF(c); setMo(false); }}>Huỷ</button>
          </div>
        </div>
      )}
    </div>
  );
}
