'use client';
// DÒNG PHIM TỰ ĐỘNG (anh 03/11/2026, etp.on.tc): FormChayDong = form hỏi loại nội dung QC (KT / CC / CT…, mô tả + cách làm + giá + ví dụ thật) + thể loại;
// TabDong = mỗi phim một dòng, 8 bước có giờ bắt đầu / kết thúc, nút FIX từng bước, Dừng dòng. Máy: apps/etp/dong_phim.py (iMac) · canh: apps/etp/manh.py (box3).
import { useCallback, useEffect, useState } from 'react';
import { EmptyState, FormModal, FormModalFooter, FormModalSection, SelectField } from '@/components/ui';
import { openEntityDrawer } from '@/lib/entity-drawer';
import { chayDong, docDong, dungDong, fixBuoc, formDong, type DongPhim, type BuocDong, type LoaiNoiDung } from '@/lib/actions/etp-dong';

const TEN_BUOC: Record<string, [string, string]> = {
  nhan: ['Nhận', 'Nhận phim: nhóm gốc Âu-Mỹ, không trong sổ cấm 18+, đội không giữ, phim chưa có camp → Nhà nhận'],
  ws: ['Trang phim', 'Thêm vào workspace Ethopex của Nhà + điền mô tả / cốt truyện, chờ đồng bộ tới khi đủ'],
  poster: ['Soát poster', 'AI soát poster 18+ (soat_18_ai) — cấm thì dòng dừng'],
  cat: ['Cắt', 'Tải tập + cắt 2 góc cuối tập, CTA kiểu Kiên (tho.py → cat-cuoi-lo)'],
  soat: ['Soát đoạn', 'Máy soát từng đoạn (Claude) — giữ đoạn sạch, không còn đoạn sạch thì dừng'],
  creative: ['Tải + chấm', 'Tải MỘT đoạn lên creative (KT: chờ máy sinh kể chuyện) → cổng chấm Meta / AFS'],
  camp: ['Lên camp', 'nhan-ban.py: $1, bộ 2, lịch hôm nay — mọi cổng luật ở đó, chặn thì dừng'],
  chay: ['Camp chạy', 'Chờ Ethopex đồng bộ xong + ACTIVE'],
};
const MAU: Record<string, [string, string]> = { cho: ['#6b7280', 'chờ'], dang: ['#60a5fa', 'đang chạy'], xong: ['#22c55e', 'xong'], dung: ['#f59e0b', 'dừng (policy / luật)'],
  loi: ['#ef4444', 'lỗi'], bo_qua: ['#374151', 'không thuộc loại nội dung này'], chay: ['#60a5fa', 'đang chạy'], huy: ['#6b7280', 'đã huỷ'] };
const gio = (iso: string | null) => { if (!iso) return '—'; const d = new Date(Date.parse(iso) + 7 * 3600_000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
const ngayGio = (iso: string | null) => { if (!iso) return '—'; const d = new Date(Date.parse(iso) + 7 * 3600_000); return `${gio(iso)} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const phut = (a: string | null, b: string | null) => { if (!a) return null; const s = ((b ? Date.parse(b) : Date.now()) - Date.parse(a)) / 1000; return s < 60 ? `${Math.round(s)}s` : s < 3600 ? `${Math.round(s / 60)}p` : `${Math.floor(s / 3600)}h${String(Math.round((s % 3600) / 60)).padStart(2, '0')}`; };
const ket = (b: BuocDong) => b.trang_thai === 'dang' && (Date.now() - Date.parse(b.bat_dau ?? '') > b.han_giay * 1000 || Date.now() - Date.parse(b.nhip ?? b.bat_dau ?? '') > 600_000);

// CÂY PHIM → VIDEO / CAMP (anh 03/11/2026 "trình bày dạng tree từ phim -> các camp / video: mỗi dòng là 1 table các bước, highlight từng bước thành công,
// đang xử lý. Ko trình bày như bây giờ, tốn diện tích"): dòng phim = 8 ô bước của dòng; dòng con = mỗi video (đoạn → creative → chấm → camp → chạy).
const COT: [string, string][] = [['nhan', 'Nhận'], ['ws', 'Trang'], ['poster', 'Ảnh bìa'], ['cat', 'Cắt'], ['soat', 'Xem lại'], ['len', 'Đưa lên'], ['cham', 'Chấm'], ['camp', 'Lên camp'], ['chay', 'Chạy']];
const BUOC_COT: Record<string, string> = { len: 'creative', cham: 'creative' };   // dòng phim: hai cột Đưa lên / Chấm cùng là bước creative
const LOAI_DE: Record<string, string> = { CC: 'Cảnh cuối', KT: 'Kể chuyện', LT: 'Test rộng' };
const NEN: Record<string, string> = { xong: '#14532d', dang: '#1e3a8a', chay: '#1e3a8a', dung: '#78350f', loi: '#7f1d1d', cho: 'transparent', bo_qua: 'transparent' };
const CHU: Record<string, string> = { xong: '#86efac', dang: '#bfdbfe', chay: '#bfdbfe', dung: '#fcd34d', loi: '#fca5a5', cho: 'var(--fg-3)', bo_qua: 'var(--fg-3)' };
const KY: Record<string, string> = { xong: '✓', dang: '▶', chay: '▶', dung: '⏸', loi: '!', cho: '·', bo_qua: '–' };

// XEM TRƯỚC KHI RÊ (anh 03/11/2026 "các bước cụ thể xem được như hình poster, creative khi hover vào"): một khung nổi dùng chung cho cả bảng
type Xem = { anh?: string | null; video?: string | null; chu?: string; x: number; y: number };
let datXem: (v: Xem | null) => void = () => {};
function KhungXem() {
  const [v, setV] = useState<Xem | null>(null); datXem = setV;
  if (!v) return null;
  const W = v.video ? 240 : 200; const left = Math.min(v.x + 14, window.innerWidth - W - 12); const top = Math.max(8, Math.min(v.y - 60, window.innerHeight - 440));
  return <div style={{ position: 'fixed', left, top, zIndex: 70, width: W, padding: 6, borderRadius: 8, background: 'var(--bg-1)', border: '1px solid var(--line)', boxShadow: '0 8px 24px rgba(0,0,0,.55)', pointerEvents: 'none' }}>
    {v.video ? <video src={v.video} poster={v.anh ?? undefined} autoPlay muted loop playsInline style={{ width: '100%', borderRadius: 5, display: 'block' }} />
      : v.anh ? <img src={v.anh} alt="" style={{ width: '100%', borderRadius: 5, display: 'block' }} /> : null}
    {v.chu ? <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 4, whiteSpace: 'pre-wrap' }}>{v.chu}</div> : null}</div>;
}
function O({ tt, chu, t, fix, bam, menu, xem }: { tt: string; chu?: string; t?: string; fix?: () => void; bam?: () => void; menu?: (e: React.MouseEvent) => void; xem?: Omit<Xem, 'x' | 'y'> }) {
  return <td title={xem ? undefined : t} onClick={menu ?? bam} onMouseEnter={xem ? (e) => datXem({ ...xem, x: e.clientX, y: e.clientY }) : undefined} onMouseLeave={xem ? () => datXem(null) : undefined}
    style={{ padding: 2, cursor: bam || menu ? 'pointer' : xem ? 'zoom-in' : undefined }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, height: 24, borderRadius: 5, fontSize: 11, whiteSpace: 'nowrap',
    background: NEN[tt] ?? 'transparent', color: CHU[tt] ?? 'var(--fg-3)', border: tt === 'cho' || tt === 'bo_qua' ? '1px dashed var(--line)' : 'none', fontWeight: tt === 'dang' ? 700 : 500,
    animation: tt === 'dang' ? 'etpNhip 1.4s ease-in-out infinite' : undefined }}>
    <span>{KY[tt] ?? ''}</span>{chu ? <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 74 }}>{chu}</span> : null}
    {fix ? <button className="btn" onClick={fix} style={{ padding: '0 4px', fontSize: 10, lineHeight: '14px', color: '#fca5a5', borderColor: '#7f1d1d' }}>FIX</button> : null}</div></td>;
}

function DongCay({ d, xong, moCamp }: { d: DongPhim; xong: () => void; moCamp?: (id: number) => void }) {
  const [mo, setMo] = useState(() => d.buoc.some((x) => x.trang_thai !== 'xong' && x.trang_thai !== 'bo_qua'));   // thư mục: đang làm / lỗi thì mở sẵn, xong thì gập
  const [menu, setMenu] = useState<{ b: BuocDong; x: number; y: number } | null>(null);   // XỬ LÝ TAY TẠI Ô (anh 03/11/2026: bước lâu / lỗi phải reset, fix, dừng ngay tại vị trí đó)
  const b = (k: string) => d.buoc.find((x) => x.buoc === (BUOC_COT[k] ?? k));
  const kq = (k: string) => b(k)?.ket_qua ?? null;
  const ttB = (x?: BuocDong) => (x ? (ket(x) ? 'loi' : x.trang_thai) : 'cho');
  const k1 = kq('creative') as ({ creative_id?: number; tu?: number; den?: number } & NonNullable<BuocDong['ket_qua']>) | null;   // CC / KT: một creative, ket_qua là chính creative đó
  const cr = k1?.ds ?? (k1?.creative_id ? [{ creative_id: k1.creative_id, tu: k1.tu, den: k1.den }] : []);
  const sach = new Set((k1?.sach ?? (k1?.creative_id && b('creative')?.trang_thai === 'xong' ? [{ creative_id: k1.creative_id }] : [])).map((x) => x.creative_id));
  const doan = cr.length ? cr : (kq('soat')?.doan ?? kq('cat')?.doan ?? []);
  const chamXong = b('creative')?.trang_thai === 'xong';
  const ttDong = d.trang_thai === 'chay' && d.buoc.length && d.buoc.every((x) => x.trang_thai === 'xong' || x.trang_thai === 'bo_qua') ? 'xong' : d.trang_thai;
  const hien = d.buoc.find((x) => ['dang', 'loi', 'dung'].includes(x.trang_thai));
  const ghi = d.trang_thai === 'dung' || d.trang_thai === 'loi' ? d.ly_do ?? hien?.ghi : hien?.ghi ?? (ttDong === 'xong' ? `xong sau ${phut(d.tao_luc, d.xong_luc ?? d.buoc[d.buoc.length - 1]?.ket_thuc ?? null)}` : null);
  const tB = (x?: BuocDong) => x ? `${TEN_BUOC[x.buoc]?.[0] ?? x.buoc} · ${MAU[x.trang_thai]?.[1] ?? x.trang_thai}\nbắt đầu ${ngayGio(x.bat_dau)} · xong ${ngayGio(x.ket_thuc)}${x.ghi ? `\n\n${x.ghi}` : ''}` : '';
  const conCamp = (c?: DongPhim['camps'][number] | null) => c ? { tt: c.tt === 'ACTIVE' ? 'xong' : 'cho', chu: c.chi > 0 ? `${c.thu - c.chi >= 0 ? '+' : ''}$${(c.thu - c.chi).toFixed(2)}` : c.tt === 'ACTIVE' ? 'chạy' : 'tắt' } : null;
  const le = d.camps.filter((c) => !cr.some((x) => x.creative_id === c.cr));
  return <>
    <tr style={{ borderTop: '1px solid var(--line)' }}>
      <td style={{ padding: '4px 6px', maxWidth: 340 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span onClick={() => setMo(!mo)} style={{ cursor: 'pointer', width: 12, flex: 'none', textAlign: 'center', color: 'var(--fg-3)', fontSize: 10 }}>{mo ? '▼' : '▶'}</span>
        {d.anh ? <img src={d.anh} alt="" onMouseEnter={(e) => datXem({ anh: d.anh, chu: d.ten ?? '', x: e.clientX, y: e.clientY })} onMouseLeave={() => datXem(null)} style={{ cursor: 'zoom-in', width: 22, height: 31, objectFit: 'cover', borderRadius: 3, flex: 'none' }} /> : <span style={{ width: 22, flex: 'none' }}>🎬</span>}
        <div style={{ minWidth: 0 }}><a onClick={() => openEntityDrawer('etp-phim', d.content_id)} title={d.ten ?? ''} style={{ cursor: 'pointer', fontWeight: 600, fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.ten ?? `phim #${d.content_id}`}</a>
          <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>{LOAI_DE[d.loai] ?? d.loai} · {ngayGio(d.tao_luc)}{doan.length ? ` · ${doan.length} video` : ''}{d.camps.length ? ` · ${d.camps.length} camp` : ''}</span></div></div></td>
      {/* DÒNG PHIM = THƯ MỤC, chỉ thống kê (anh 03/11/2026 "dòng đầu chỉ là thống kê, tổng hợp. Bên trong mới là các creative cụ thể") */}
      <td colSpan={COT.length} style={{ padding: '2px 4px' }}><div onClick={() => setMo(!mo)} style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', flexWrap: 'wrap', fontSize: 11 }}>
        {(() => { const hb = hien ?? d.buoc.find((x) => x.trang_thai === 'cho'); const sX = d.buoc.filter((x) => x.trang_thai === 'xong' || x.trang_thai === 'bo_qua').length; const tt = ttDong === 'xong' ? 'xong' : hb ? ttB(hb) : 'cho';
          const lai = d.camps.reduce((a, c) => a + c.thu - c.chi, 0), chi = d.camps.reduce((a, c) => a + c.chi, 0);
          const Chip = ({ c, nen, children }: { c: string; nen: string; children: React.ReactNode }) => <span style={{ padding: '2px 8px', borderRadius: 5, background: nen, color: c, whiteSpace: 'nowrap' }}>{children}</span>;
          return <>
            <Chip c={CHU[tt] ?? 'var(--fg-2)'} nen={NEN[tt] === 'transparent' ? 'var(--bg-2)' : NEN[tt] ?? 'var(--bg-2)'}>{ttDong === 'xong' ? '✓ xong' : `${KY[tt] ?? ''} bước ${Math.min(sX + 1, d.buoc.length)}/${d.buoc.length} · ${hb ? TEN_BUOC[hb.buoc]?.[0] ?? hb.buoc : ''}${hb?.bat_dau && !hb.ket_thuc ? ` ${phut(hb.bat_dau, null)}` : ''}`}</Chip>
            <span style={{ display: 'inline-flex', gap: 2 }}>{d.buoc.map((x) => <span key={x.buoc} title={TEN_BUOC[x.buoc]?.[0]} style={{ width: 10, height: 10, borderRadius: 2, background: x.trang_thai === 'cho' || x.trang_thai === 'bo_qua' ? 'var(--line)' : NEN[ttB(x)] }} />)}</span>
            <Chip c="var(--fg-1)" nen="var(--bg-2)">{doan.length} creative{sach.size ? ` · ${sach.size} sạch` : ''}</Chip>
            {d.camps.length ? <Chip c="var(--fg-1)" nen="var(--bg-2)">{d.camps.length} camp · {d.camps.filter((c) => c.tt === 'ACTIVE').length} chạy</Chip> : null}
            {chi > 0 ? <Chip c={lai >= 0 ? '#86efac' : '#fca5a5'} nen="var(--bg-2)">chi ${chi.toFixed(2)} · lãi {lai >= 0 ? '+' : ''}${lai.toFixed(2)}</Chip> : null}
          </>; })()}
      </div></td>
      <td style={{ padding: '2px 6px', fontSize: 11, color: d.trang_thai === 'dung' ? '#fbbf24' : d.trang_thai === 'loi' ? '#f87171' : 'var(--fg-2)', maxWidth: 320 }}>
        <div title={ghi ?? ''} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ghi ?? ''}</div></td>
      <td style={{ padding: 2 }}>{d.trang_thai === 'chay' || d.trang_thai === 'dung' || d.trang_thai === 'loi'
        ? <button className="btn" style={{ fontSize: 10, padding: '0 6px' }} onClick={async () => { if (!window.confirm(`Dừng hẳn dòng ${d.ten ?? d.content_id}?`)) return; await dungDong(d.id); xong(); }}>Dừng</button> : null}</td>
    </tr>
    {menu ? <tr><td colSpan={12} style={{ padding: 0, border: 0 }}><div onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
      <div style={{ position: 'fixed', left: Math.min(menu.x, window.innerWidth - 300), top: Math.min(menu.y + 8, window.innerHeight - 240), zIndex: 61, width: 290, padding: 10, borderRadius: 8,
        background: 'var(--bg-1)', border: '1px solid var(--line)', boxShadow: '0 8px 24px rgba(0,0,0,.5)', fontSize: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{TEN_BUOC[menu.b.buoc]?.[0] ?? menu.b.buoc} · {MAU[menu.b.trang_thai]?.[1] ?? menu.b.trang_thai}</div>
        <div style={{ color: 'var(--fg-3)', marginBottom: 6 }}>bắt đầu {ngayGio(menu.b.bat_dau)} · {menu.b.ket_thuc ? `xong ${ngayGio(menu.b.ket_thuc)}` : `đã chạy ${phut(menu.b.bat_dau, null) ?? '—'} / hạn ${Math.round(menu.b.han_giay / 60)} phút`}{menu.b.lan > 1 ? ` · lần ${menu.b.lan}` : ''}</div>
        {menu.b.ghi ? <div style={{ maxHeight: 90, overflow: 'auto', color: 'var(--fg-2)', marginBottom: 8, whiteSpace: 'pre-wrap' }}>{menu.b.ghi}</div> : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button className="btn" onClick={async () => { const r = await fixBuoc(d.id, menu.b.buoc); setMenu(null); if ('loi' in r) window.alert(r.loi); xong(); }}>
            ↻ {menu.b.trang_thai === 'dang' ? 'Huỷ và chạy lại bước này' : 'Chạy lại bước này (FIX)'}</button>
          <button className="btn" style={{ color: '#fca5a5' }} onClick={async () => { if (!window.confirm(`Dừng hẳn dòng ${d.ten ?? d.content_id}?`)) return; await dungDong(d.id); setMenu(null); xong(); }}>⏹ Dừng cả dòng phim</button>
        </div></div></td></tr> : null}
    {mo ? <tr style={{ background: 'var(--bg-1)' }}>
      <td style={{ padding: '2px 6px 2px 40px', fontSize: 11, color: 'var(--fg-2)', whiteSpace: 'nowrap' }}>📁 Chuẩn bị phim</td>
      {COT.map(([k]) => { const x = b(k); const tt = ttB(x); const lau = !!x && x.trang_thai === 'dang' && Date.now() - Date.parse(x.bat_dau ?? '') > x.han_giay * 500;
        return <O key={k} tt={tt} chu={x?.bat_dau ? (x.ket_thuc ? phut(x.bat_dau, x.ket_thuc) ?? '' : `${phut(x.bat_dau, null)}…${lau ? ' ⚠' : ''}`) : ''} t={`${tB(x)}${x && x.trang_thai !== 'cho' && x.trang_thai !== 'bo_qua' ? '\n\nbấm để chạy lại / dừng' : ''}`}
          menu={x && d.trang_thai !== 'huy' && x.trang_thai !== 'cho' && x.trang_thai !== 'bo_qua' ? (e) => setMenu({ b: x, x: e.clientX, y: e.clientY }) : undefined}
          xem={k === 'poster' && d.anh ? { anh: d.anh, chu: `${tB(x)}` } : undefined} />; })}
      <td /><td /></tr> : null}
    {mo ? doan.map((x, i) => {
      const id = 'creative_id' in x ? (x as { creative_id: number }).creative_id : null; const camp = id ? d.camps.find((c) => c.cr === id) ?? null : null; const cc = conCamp(camp);
      const g = x.tu != null && x.den != null ? `${Math.round(x.tu)}–${Math.round(x.den)}s` : '';
      const tCham = id ? (sach.has(id) ? 'xong' : chamXong ? 'dung' : 'dang') : 'cho';
      return <tr key={id ?? i} style={{ background: 'var(--bg-1)' }}>
        <td style={{ padding: '2px 6px 2px 40px', fontSize: 11, color: 'var(--fg-2)', whiteSpace: 'nowrap' }}>{id && d.crs[String(id)]?.anh ? <img src={d.crs[String(id)]!.anh!} alt="" onMouseEnter={(e) => datXem({ ...d.crs[String(id)]!, chu: `creative #${id} · đoạn ${g}`, x: e.clientX, y: e.clientY })} onMouseLeave={() => datXem(null)} style={{ width: 16, height: 28, objectFit: 'cover', borderRadius: 2, verticalAlign: 'middle', marginRight: 4, cursor: 'zoom-in' }} /> : '└ '}{id ? `Creative #${id}` : `Đoạn ${i + 1}`} <span style={{ color: 'var(--fg-3)' }}>{g}</span></td>
        <O tt="bo_qua" /><O tt="bo_qua" /><O tt="bo_qua" />
        <O tt="xong" chu={g} />
        <O tt={id || (kq('soat')?.doan ?? []).length ? 'xong' : ttB(b('soat'))} />
        <O tt={id ? 'xong' : b('creative')?.trang_thai === 'dang' ? 'dang' : 'cho'} chu={id ? `#${id}` : ''} xem={id && d.crs[String(id)] ? { ...d.crs[String(id)], chu: `creative #${id} · đoạn ${g}` } : undefined} />
        <O tt={tCham} chu={tCham === 'dung' ? 'bị chặn' : tCham === 'dang' ? 'đang chấm' : ''} xem={id && d.crs[String(id)] ? { ...d.crs[String(id)], chu: `creative #${id} · ${tCham === 'xong' ? 'chấm sạch' : tCham === 'dung' ? 'bị cổng chấm chặn' : 'đang chấm'}` } : undefined} />
        <O bam={camp && moCamp ? () => moCamp(camp.id) : undefined} tt={camp ? 'xong' : sach.has(id ?? -1) ? ttB(b('camp')) : 'cho'} chu={camp ? `#${camp.id}` : sach.has(id ?? -1) && b('camp')?.trang_thai === 'dang' ? 'chờ anh' : ''} />
        <O bam={camp && moCamp ? () => moCamp(camp.id) : undefined} tt={cc?.tt ?? 'cho'} chu={cc?.chu} t={camp ? `camp #${camp.id} · $${camp.ns ?? '?'}/ngày · chi $${camp.chi.toFixed(2)} · thu $${camp.thu.toFixed(2)} — bấm xem chi tiết` : undefined} />
        <td /><td />
      </tr>; }) : null}
    {mo ? le.map((c) => { const cc = conCamp(c)!; return <tr key={`c${c.id}`} style={{ background: 'var(--bg-1)' }}>
      <td style={{ padding: '2px 6px 2px 40px', fontSize: 11, color: 'var(--fg-2)' }}>└ camp #{c.id}</td>
      {COT.slice(0, 7).map(([k]) => <O key={k} tt="bo_qua" />)}<O bam={moCamp ? () => moCamp(c.id) : undefined} tt="xong" chu={`#${c.id}`} /><O bam={moCamp ? () => moCamp(c.id) : undefined} tt={cc.tt} chu={cc.chu} /><td /><td /></tr>; }) : null}
  </>;
}

export function TabDong({ moCamp }: { moCamp?: (id: number) => void } = {}) {
  const [du, setDu] = useState<Awaited<ReturnType<typeof docDong>> | null>(null);
  const [cu, setCu] = useState(false);
  const tai = useCallback(async () => setDu(await docDong()), []);
  useEffect(() => { void tai(); const t = setInterval(() => void tai(), 10_000); return () => clearInterval(t); }, [tai]);
  if (!du) return <div style={{ padding: 16, color: 'var(--fg-2)' }}>Đang tải…</div>;
  if ('loi' in du) return <EmptyState icon="⚠" title={du.loi} />;
  const may = du.may[0]; const im = may ? (Date.now() - Date.parse(may.nhip)) / 1000 : null;
  // MẶC ĐỊNH (anh 03/11/2026 "bảng này lưu và show mọi quá trình sx; default hiện phim / camp đang làm, vừa làm xong (1 ngày) hoặc bị lỗi; còn lại ẩn khi đang chạy ổn định")
  const xongLuc = (d: DongPhim) => d.xong_luc ?? (d.buoc.every((x) => x.trang_thai === 'xong' || x.trang_thai === 'bo_qua') ? d.buoc[d.buoc.length - 1]?.ket_thuc ?? null : null);
  const dangChay = du.dong.filter((d) => { const x = xongLuc(d);
    return d.trang_thai === 'dung' || d.trang_thai === 'loi' || (d.trang_thai === 'chay' && !x) || (!!x && Date.now() - Date.parse(x) < 86_400_000) || d.buoc.some((b) => b.trang_thai === 'loi' || b.trang_thai === 'dung'); });
  const ds = cu ? du.dong : dangChay;
  return <div>
    <style>{'@keyframes etpNhip{0%,100%{opacity:1}50%{opacity:.55}}'}</style>
    <KhungXem />
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 12, color: 'var(--fg-2)', margin: '0 0 8px', flexWrap: 'wrap' }}>
      <span title="apps/etp/dong_phim.py trên iMac — báo sống mỗi 10 giây">máy chạy: {may ? <><b style={{ color: im! < 60 ? '#4ade80' : '#f87171' }}>{may.may}</b> {im! < 60 ? 'đang sống' : `im ${Math.round(im! / 60)} phút`}</> : <b style={{ color: '#f87171' }}>chưa bật</b>}</span>
      <span>thêm phim: tab Phim → ⋯ → <b>Chạy tự động tới khi lên camp</b></span>
      <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={cu} onChange={(e) => setCu(e.target.checked)} />hiện cả phim đã chạy ổn định / đã huỷ ({du.dong.length - dangChay.length})</label>
    </div>
    {!ds.length ? <EmptyState icon="🎬" title="Không có phim nào đang chạy tự động" /> : <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 1180 }}>
        <colgroup><col style={{ width: 300 }} />{COT.map(([k]) => <col key={k} style={{ width: 78 }} />)}<col /><col style={{ width: 52 }} /></colgroup>
        <thead><tr style={{ fontSize: 11, color: 'var(--fg-3)', textAlign: 'center' }}><th style={{ textAlign: 'left', padding: '0 6px', fontWeight: 500 }}>Phim → creative → camp</th>
          {COT.map(([k, t]) => <th key={k} title={TEN_BUOC[BUOC_COT[k] ?? k]?.[1]} style={{ fontWeight: 500 }}>{t}</th>)}<th style={{ textAlign: 'left', fontWeight: 500, padding: '0 6px' }}>Đang làm</th><th /></tr></thead>
        <tbody>{ds.map((d) => <DongCay key={d.id} d={d} xong={() => void tai()} moCamp={moCamp} />)}</tbody>
      </table></div>}
  </div>;
}

export function FormChayDong({ contentId, onClose }: { contentId: number; onClose: () => void }) {
  const [f, setF] = useState<Awaited<ReturnType<typeof formDong>> | null>(null);
  const [loai, setLoai] = useState('CC'); const [tl, setTl] = useState(''); const [gui, setGui] = useState(false); const [loi, setLoi] = useState<string | null>(null);
  useEffect(() => { void formDong(contentId).then((r) => { setF(r); if (!('loi' in r)) setTl(r.tlPhim ?? ''); }); }, [contentId]);
  const ok = f && !('loi' in f);
  return <FormModal kind="generic" action="create" title={<>▶ Chạy tự động tới khi lên camp</>} idText={`PHIM #${contentId}`} subtitle={ok ? f.ten ?? undefined : undefined} width="md" onClose={onClose}>
    {!f ? <FormModalSection><div style={{ color: 'var(--fg-2)' }}>Đang tải…</div></FormModalSection>
      : 'loi' in f ? <FormModalSection><div style={{ color: '#f87171' }}>{f.loi}</div></FormModalSection> : <>
      <FormModalSection>
        {f.nhomGoc !== 'au_my' ? <div style={{ color: '#f87171', marginBottom: 10 }}>Phim {f.nhomGoc ? `nhóm gốc '${f.nhomGoc}'` : 'chưa xác định nhóm gốc'} — chỉ chạy phim Âu-Mỹ.</div> : null}
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Loại nội dung QC</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {f.loai.map((l: LoaiNoiDung) => <label key={l.ma} style={{ display: 'block', border: `1px solid ${loai === l.ma ? '#60a5fa' : 'var(--line)'}`, borderRadius: 8, padding: '10px 12px',
            cursor: l.chay ? 'pointer' : 'not-allowed', opacity: l.chay ? 1 : 0.55, background: loai === l.ma ? 'rgba(96,165,250,.08)' : undefined }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="radio" name="loai" checked={loai === l.ma} disabled={!l.chay} onChange={() => setLoai(l.ma)} />
              <b>{l.ten}</b><span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-3)' }}>{l.gia} · {l.thoi_gian}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-2)', margin: '6px 0 0 24px' }}>{l.mo_ta}</div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', margin: '4px 0 0 24px' }}>Máy làm: {l.cach}</div>
            {l.khoa ? <div style={{ fontSize: 11, color: '#fbbf24', margin: '4px 0 0 24px' }}>Chưa chạy được: {l.khoa}</div> : null}
            {l.vi_du.length ? <div style={{ display: 'flex', gap: 10, margin: '8px 0 0 24px', flexWrap: 'wrap' }}>
              {l.vi_du.map((v) => <div key={v.creative_id} style={{ fontSize: 11, color: 'var(--fg-2)' }}>
                <video src={`${v.video}#t=3`} controls preload="metadata" style={{ width: 120, height: 213, background: '#000', borderRadius: 6, display: 'block' }} />
                <div style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${v.phim ?? ''} · creative #${v.creative_id}`}>#{v.creative_id} {v.phim ?? ''}</div>
                <div>14 ngày: chi ${v.chi} · lãi <b style={{ color: v.lai >= 0 ? '#4ade80' : '#f87171' }}>{v.lai >= 0 ? '+' : '−'}${Math.abs(v.lai)}</b></div></div>)}
            </div> : <div style={{ fontSize: 11, color: 'var(--fg-3)', margin: '6px 0 0 24px' }}>Chưa có ví dụ chạy ≥ $5 trong 14 ngày.</div>}
          </label>)}
        </div>
      </FormModalSection>
      <FormModalSection>
        <SelectField label="Thể loại phim" hint={f.tlPhim ? 'máy đã gắn sẵn — đổi nếu sai (ghi vào sổ thể loại, lịch giờ + báo cáo thể loại đọc cùng sổ)' : 'chưa gắn — chọn thể loại'}
          value={tl} onChange={(e) => setTl(e.target.value)}>
          <option value="">— chưa chọn —</option>
          {Object.entries(f.theLoai).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </SelectField>
        {loi ? <div style={{ color: '#f87171', marginTop: 8 }}>{loi}</div> : null}
      </FormModalSection>
      <FormModalFooter>
        <button className="btn" onClick={onClose}>Huỷ</button>
        <button className="btn primary" disabled={gui || f.nhomGoc !== 'au_my' || !tl} title={!tl ? 'chọn thể loại trước' : undefined} onClick={async () => {
          setGui(true); setLoi(null); const r = await chayDong(contentId, loai, tl); setGui(false);
          if ('loi' in r) return setLoi(r.loi);
          onClose(); const u = new URL(window.location.href); u.searchParams.set('t', 'dong'); window.location.href = u.toString();
        }}>{gui ? 'Đang gửi…' : '▶ Chạy tự động'}</button>
      </FormModalFooter>
    </>}
  </FormModal>;
}
