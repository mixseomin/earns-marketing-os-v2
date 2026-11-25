'use client';
// Ô "CHỜ ANH DUYỆT" ở etp2 › Camp (anh 22/11/2026 "Tao cần duyệt trên page này cơ mà !"): creative máy giữ (etp.cho_anh_duyet, 0460) — chưa duyệt thì không đường nào lên camp.
// ✓ Duyệt = lên ★ ROAS mặc định hoi_cho (giờ theo lịch lên) · ✕ Loại. Lỗi hiện thành ô đỏ ngay dưới nút. Không có gì chờ → không vẽ gì.
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { VideoXem } from '@/components/ui/video-xem';
import { Drawer } from '@/components/ui';
import { CamCauHinh } from './etp-camp-cau-hinh';
import { KhungBaiQc } from './etp-bai-qc';
import { dsChoDuyet, duyetChoAnh, lenCamp, type ChoDuyet } from '@/lib/actions/etp-cho-duyet';
import BANG_LUAT from '@/lib/etp-bang-luat.json';
import { MO_TA_GIONG, maGiong, tenGiong } from '@/lib/etp-dang';

const nut: React.CSSProperties = { fontSize: 12, padding: '3px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--line)', background: 'transparent', color: 'inherit' };
const GIAI = 'chưa duyệt thì máy không lên camp. ✓ Duyệt = creative rời ô này, thành dòng ⏳ xếp hàng ở bảng camp bên dưới; giờ chạy theo lịch. ✕ Loại = không bao giờ lên.';
const GIAI_DK = 'đang DỪNG KHẨN (etp.cau_hinh.dung_khan): bấm Duyệt vẫn ghi duyệt, nhưng máy chặn tạo camp tới khi tắt dừng khẩn — máy tự lên camp ở nhịp đầu nhả (apps/etp/lenh_cho.py), anh không phải bấm lại.';

/** kiểu camp máy sẽ lên: ★ ROAS (sổ len_cr_roas, lệnh anh 22/11/2026 "roas kiểu Sơn") hoặc ★ ROAS mặc định hoi_cho (anh 24/11/2026 "Từ giờ mặc định là roas") */
const kieu = (r: string | null) => { const [ro, ns] = (r ?? '').split('|'); return ro && ns ? `★ ROAS ${ro} · ${'$'}${ns}` : `★ ROAS ${BANG_LUAT.hoi_cho.roas} · ${'$'}${BANG_LUAT.hoi_cho.ns}`; };   // mặc định ★ ROAS hoi_cho (anh 24/11/2026)

/** TÓM TẮT CAMP DỰ KIẾN trên thẻ (anh 25/11/2026 "phải show 1 vài thông tin quan trọng để còn biết mà review… nhất là ngôn ngữ, targeting,... form text"):
 *  giá trị = docThietLap của camp dự kiến (khuôn + ô lệnh ▶ Lên đè) — cùng nguồn ngăn camp, không gõ tay */
const ANH_W = 'clamp(104px, 30vw, 162px)';   // #1861: ảnh thẻ chờ duyệt 162px trên máy tính, co còn ~118px trên điện thoại 393px

function TomTl({ x }: { x: ChoDuyet }) {
  if (x.tlLoi) return <div role="alert" style={{ color: '#fca5a5' }}>Không dựng được camp dự kiến: {x.tlLoi}</div>;
  const t = x.tl; if (!t) return null;
  const dong = (nhan: string, gt: string | null | undefined, tieu?: string, mau?: string) => <div style={{ display: 'flex', gap: 6, minWidth: 0 }} title={tieu ?? gt ?? ''}>
    <span style={{ flex: 'none', width: 62, color: 'var(--fg-3, #888)' }}>{nhan}</span>
    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: mau ?? (gt ? 'inherit' : 'var(--fg-3, #888)') }}>{gt || '—'}</span></div>;
  const nuoc = t.g_so_nuoc ? `${t.g_so_nuoc} nước${t.g_loai_nuoc ? ` · loại ${t.g_so_loai ?? ''}` : ''}` : (t.g_nuoc ?? null);
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 1, fontSize: 11.5, borderTop: '1px solid var(--line)', paddingTop: 4, marginTop: 2 }}>
    {/* #1844 "show thêm kiểu giọng áp dụng với loại creative này": giọng đọc lúc dựng (giongCr — ghi thư viện, lùi về sổ điểm chạm); người đọc + cách đọc ở rê chuột */}
    {dong('Giọng', x.giong ? `${tenGiong(x.giong)} (${maGiong(x.giong)})` : null,
      x.giong ? (MO_TA_GIONG[x.giong] ?? tenGiong(x.giong) ?? '') : 'bản dựng trước 25/11 không lưu lại giọng đã dùng — từ 25/11 mỗi lượt dựng ra 2 bản: giọng mặc định (kỳ dị) + giọng hợp chủ đề phim')}
    {dong('Ngôn ngữ', t.g_ngon_ngu || 'All languages', 'nhan-ban bỏ targeting.locales của mọi camp — không nhắm ngôn ngữ (luật cố định 24/11/2026)', t.g_ngon_ngu ? '#f87171' : '#4ade80')}
    {dong('Nước', nuoc, [t.g_nuoc, t.g_loai_nuoc ? `loại: ${t.g_loai_nuoc}` : ''].filter(Boolean).join('\n'))}
    {dong('Tuổi · GT', [t.g_tuoi, t.g_gioi ? t.g_gioi.split(', ').map((g) => (g === '1' ? 'Male' : g === '2' ? 'Female' : g)).join(', ') : 'All genders'].filter(Boolean).join(' · ') || null,
      'khuôn không đặt tuổi / giới → Meta mặc định 18–65+, mọi giới (Advantage+ audience bật: tuổi chỉ là gợi ý)')}
    {dong('Giá · NS', [t.g_roas ? `★ ROAS ${t.g_roas}` : null, t.c_ns ? `$${t.c_ns}/ngày` : null].filter(Boolean).join(' · ') || null)}
    {dong('Bộ · Page', [t.c_bo ? `bộ ${t.c_bo}` : null, t.a_page_ten].filter(Boolean).join(' · ') || null, `tài khoản ${t.c_tk ?? '?'}`)}
    {dong('Tên miền', t.a_mien)}
    {dong('Lịch', t.g_lich)}
    {dong('CTA · link', [t.f_cta, t.f_link].filter(Boolean).join(' · ') || null)}
    {dong('Chữ chính', t.f_chinh)}
    {dong('Tiêu đề', t.f_tieu)}
    {dong('Mô tả', t.f_mo_ta)}
    {t.ke_thieu ? <div style={{ color: '#f87171' }}>{t.ke_thieu}</div> : null}
  </div>;
}

/** NHẬN XÉT ĐÃ GHI cho creative khác của cùng phim (etp.nhan_xet_cr) — anh thấy mình đã dặn gì, con thấy hướng sửa */
function NhanXetCu({ ds }: { ds: ChoDuyet['nx'] }) {
  if (!ds?.length) return null;
  return <div data-o="nx-cu" style={{ display: 'flex', flexDirection: 'column', gap: 1, fontSize: 11.5, borderTop: '1px solid var(--line)', paddingTop: 4 }}>
    <span style={{ color: 'var(--fg-3, #888)' }}>Nhận xét trước của phim này:</span>
    {ds.map((n, i) => <div key={i} title={`${n.luc.slice(0, 16)} · cr #${n.cr}`} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      <b style={{ color: n.ok ? '#4ade80' : n.sua ? SUA_MAU : '#f87171' }}>{n.ok ? '✓' : n.sua ? '✎' : '✕'} #{n.cr}</b> {n.chu}</div>)}
  </div>;
}

/** TRẠNG THÁI + BƯỚC KẾ của creative (anh 25/11/2026 "Hiện thêm trạng thái hiện tại của camp này !! Nếu duyệt sẽ sang trạng thái tiếp theo là gì ?") */
function TrangThaiCr({ x, dk }: { x: ChoDuyet; dk: boolean }) {
  const lich = x.tl?.g_lich ?? null;
  const hien = x.duyet == null ? { chu: '⏸ Chờ duyệt', mau: '#f59e0b' } : x.duyet === false && x.sua_lai ? { chu: '✎ Sửa lại', mau: SUA_MAU } : x.duyet === false ? { chu: '✕ Đã loại', mau: '#f87171' } : x.camp_id ? { chu: `✓ camp #${x.camp_id} (${x.trang_thai ?? '?'})`, mau: '#4ade80' } : { chu: '⏳ Chờ lên camp', mau: '#60a5fa' };
  return <div data-o="tt-cr" style={{ display: 'flex', flexDirection: 'column', gap: 1, fontSize: 11.5, borderTop: '1px solid var(--line)', paddingTop: 4 }}>
    <div><span style={{ color: 'var(--fg-3, #888)' }}>Hiện tại: </span><b style={{ color: hien.mau }}>{hien.chu}</b></div>
    {x.duyet == null ? <>
      <div title={GIAI}><span style={{ color: 'var(--fg-3, #888)' }}>Duyệt → </span><b style={{ color: '#60a5fa' }}>⏳ Chờ lên camp</b> · máy tạo camp {kieu(x.roas)}{dk ? ' khi nhả dừng khẩn' : lich ? ` lúc ${lich}` : ''}</div>
      <div title={GIAI_SUA}><span style={{ color: 'var(--fg-3, #888)' }}>Sửa lại → </span><b style={{ color: SUA_MAU }}>✎ Sửa lại</b> · không lên camp, con dựng lại theo nhận xét</div>
      <div><span style={{ color: 'var(--fg-3, #888)' }}>Loại → </span><b style={{ color: '#f87171' }}>✕ Loại</b> · không lên camp</div>
    </> : null}
  </div>;
}

/** NÚT DUYỆT / LOẠI CÓ XÁC NHẬN (anh 25/11/2026 "Nếu bấm loại hoặc duyệt phải có confirm !"): bấm lần đầu chỉ mở ô hỏi ghi rõ trạng thái sẽ sang, bấm Xác nhận mới gọi máy chủ */
/** chọn của anh: true = ✓ Duyệt · false = ✕ Loại · 'sua' = ✎ Sửa lại (#1863 anh 25/11/2026 "Thêm 1 status là Sửa lại !!") */
export type ChonDuyet = boolean | 'sua';
export const SUA_MAU = '#fb923c';
const GIAI_SUA = 'Sửa lại: creative không lên camp (chặn như Loại) nhưng vẫn hiện ở bảng camp với trạng thái ✎ Sửa lại. Nhận xét bắt buộc — con đọc làm hướng dựng lại creative của phim này';
type Bam = (cr: number, f: () => Promise<{ ok: true; chu: string } | { loi: string }>, ok?: ChonDuyet) => void;   // ok = duyệt (true) / loại (false) / sửa lại ('sua'); không có = ▶ Lên lại
/** bấm xong: ô Lọc thêm đúng mục để dòng vừa đổi vẫn thấy (Duyệt → Chờ lên camp · Sửa lại → Sửa lại); Loại thì không thêm */
const locThem = (ok?: ChonDuyet) => { if (ok === 'sua') window.dispatchEvent(new CustomEvent('etp-loc-them', { detail: { k: 'sualai' } }));
  else if (ok !== false) window.dispatchEvent(new CustomEvent('etp-loc-them', { detail: { k: 'duyet' } })); };
/** ĐỔI TRẠNG THÁI NGAY LÚC BẤM (#1847 anh 25/11/2026 "Đã bấm, đang đợi thì phải đổi status ở đây"): đọc lại cả bảng mất vài giây → bấm Xác nhận là phát 'etp-duyet-cr',
 *  etp-view gắn trạng thái mới (⏳ Chờ lên camp / ✕ Đã loại) lên dòng cây + ngăn camp ngay; máy chủ báo lỗi thì phát 'loi' → trả về ⏸ Chờ duyệt */
export const SU_DUYET = 'etp-duyet-cr';
export type SuDuyet = { cr: number; ok: ChonDuyet; pha: 'gui' | 'xong' | 'loi' };
const phat = (d: SuDuyet) => window.dispatchEvent(new CustomEvent<SuDuyet>(SU_DUYET, { detail: d }));
function NutDuyet({ cr, roas, lich, dk, dang, bam }: { cr: number; roas: string | null; lich: string | null; dk: boolean; dang: number | null; bam: Bam }) {
  const [hoi, setHoi] = useState<ChonDuyet | null>(null);   // true = hỏi duyệt, false = hỏi loại, 'sua' = hỏi sửa lại
  const [nx, setNx] = useState('');   // NHẬN XÉT (anh 25/11/2026 "phải cho tao comment vào đó để mày có hướng sửa") → etp.nhan_xet_cr
  if (hoi != null) {
    const sua = hoi === 'sua', vien = hoi === true ? '#22c55e' : sua ? '#f97316' : '#ef4444', chuMau = hoi === true ? '#4ade80' : sua ? SUA_MAU : '#f87171';
    const thieu = sua && !nx.trim();   // Sửa lại bắt buộc nhận xét — không có hướng thì con không biết dựng lại thế nào
    return <div data-o="xac-nhan-duyet" role="alertdialog" style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: 6, borderRadius: 6, fontSize: 12,
      border: `1px solid ${vien}`, background: hoi === true ? 'rgba(34,197,94,.1)' : sua ? 'rgba(249,115,22,.1)' : 'rgba(239,68,68,.1)' }}>
      <div>{hoi === true ? <>Duyệt cr #{cr}? → <b style={{ color: '#60a5fa' }}>⏳ Chờ lên camp</b>, máy tạo camp {kieu(roas)}{dk ? ' khi nhả dừng khẩn' : lich ? ` lúc ${lich}` : ''}.</>
        : sua ? <span title={GIAI_SUA}>Sửa lại cr #{cr}? → <b style={{ color: SUA_MAU }}>✎ Sửa lại</b>, không lên camp; con dựng lại creative theo nhận xét.</span>
        : <>Loại cr #{cr}? → <b style={{ color: '#f87171' }}>✕ Loại</b>, creative không lên camp.</>}</div>
      <textarea data-o="nhan-xet-cr" value={nx} onChange={(e) => setNx(e.target.value)} rows={3} maxLength={4000} autoFocus
        placeholder={hoi === true ? 'Nhận xét (không bắt buộc): chỗ nào hay / cần sửa ở lượt dựng sau' : sua ? 'Cần sửa gì? (bắt buộc) — vd: đổi hook 3 giây đầu, chữ to hơn, bỏ logo góc…' : 'Vì sao loại? Con đọc làm hướng sửa (vd: chữ che mặt, hook yếu, logo mờ…)'}
        style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: 6, borderRadius: 6, border: `1px solid ${thieu ? '#f97316' : 'var(--line)'}`, background: 'var(--bg-2)', color: 'inherit', resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button type="button" disabled={dang != null || thieu} title={thieu ? 'Gõ cần sửa gì trước — Sửa lại bắt buộc có nhận xét' : undefined}
          onClick={() => { const chu = nx; setHoi(null); setNx(''); if (hoi === 'sua') bam(cr, () => duyetChoAnh(cr, false, chu, true), 'sua'); else if (hoi != null) bam(cr, () => duyetChoAnh(cr, hoi, chu), hoi); }}
          style={{ ...nut, fontWeight: 600, borderColor: vien, color: chuMau, opacity: thieu ? 0.5 : 1, cursor: thieu ? 'not-allowed' : 'pointer' }}>{hoi === true ? '✓ Xác nhận duyệt' : sua ? '✎ Xác nhận sửa lại' : '✕ Xác nhận loại'}</button>
        <button type="button" onClick={() => { setHoi(null); setNx(''); }} style={nut}>Huỷ</button>
        {thieu ? <span style={{ fontSize: 11.5, color: SUA_MAU }}>gõ cần sửa gì để bấm được</span> : null}
      </div>
    </div>;
  }
  return <div style={{ display: 'flex', gap: 6 }}>
    <button type="button" disabled={dang != null} onClick={() => setHoi(true)} style={{ ...nut, borderColor: '#22c55e', color: '#4ade80', fontWeight: 600 }}>{dang === cr ? '…' : '✓ Duyệt'}</button>
    <button type="button" data-o="nut-sua-lai" disabled={dang != null} onClick={() => setHoi('sua')} title={GIAI_SUA} style={{ ...nut, borderColor: '#f97316', color: SUA_MAU }}>✎ Sửa lại</button>
    <button type="button" disabled={dang != null} onClick={() => setHoi(false)} style={{ ...nut, borderColor: '#ef4444', color: '#f87171' }}>✕ Loại</button>
  </div>;
}

/** DUYỆT / LOẠI ĐỨNG RIÊNG — cùng NutDuyet (ô xác nhận ghi rõ trạng thái sẽ sang), tự giữ trạng thái gửi + lỗi; dùng ở ngăn camp dòng ⏸ Chờ duyệt của bảng cây
 *  (anh 25/11/2026 "Chờ duyệt thì show luôn cái form Duyệt/Loại vào đây"). Xong thì đọc lại bảng + ô Lọc thêm Chờ lên camp như thẻ phía trên. */
export function NutDuyetCr({ cr, roas, lich }: { cr: number; roas: string | null; lich: string | null }) {
  const router = useRouter(); const [dang, setDang] = useState<number | null>(null); const [bao, setBao] = useState<{ chu?: string; loi?: string }>({});
  const bam: Bam = async (id, f, ok) => { setDang(id); setBao({}); if (ok != null) phat({ cr: id, ok, pha: 'gui' });
    try { const r = await f(); if ('loi' in r) { setBao({ loi: r.loi }); if (ok != null) phat({ cr: id, ok, pha: 'loi' }); }
      else { setBao({ chu: r.chu }); if (ok != null) phat({ cr: id, ok, pha: 'xong' }); locThem(ok); router.refresh(); } }
    catch (e) { setBao({ loi: `máy chủ lỗi: ${String((e as Error)?.message ?? e).slice(0, 200)}` }); if (ok != null) phat({ cr: id, ok, pha: 'loi' }); }
    setDang(null); };
  return <div data-o="duyet-ngan" style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
    <NutDuyet cr={cr} roas={roas} lich={lich} dk={false} dang={dang} bam={bam} />
    {bao.loi ? <div role="alert" style={{ maxWidth: 420, padding: 6, border: '1px solid #ef4444', borderRadius: 4, background: 'rgba(239,68,68,.12)', color: '#fca5a5', fontSize: 12 }}>{bao.loi}</div> : null}
    {bao.chu ? <div style={{ fontSize: 12, color: '#4ade80' }}>{bao.chu}</div> : null}
  </div>;
}

export function ChoDuyetCr() {
  const [du, setDu] = useState<{ ds: ChoDuyet[]; dungKhan: boolean } | null>(null);
  const [loiDs, setLoiDs] = useState<string | null>(null);
  const [bao, setBao] = useState<Record<number, { loi?: string; chu?: string }>>({});
  const [dang, setDang] = useState<number | null>(null);
  const router = useRouter();
  const [xem, setXem] = useState<number | null>(null);
  const [ngan, setNgan] = useState<number | null>(null);   // ngăn camp dự kiến của creative (bấm thẻ)
  const tai = useCallback(async () => { const r = await dsChoDuyet(); if ('loi' in r) setLoiDs(r.loi); else { setLoiDs(null); setDu(r); } }, []);
  useEffect(() => { void tai(); const t = setInterval(() => { void tai(); }, 20_000); return () => clearInterval(t); }, [tai]);
  if (loiDs === 'chỉ admin') return null;
  if (loiDs) return <div role="alert" style={{ margin: '6px 0', padding: 8, border: '1px solid #ef4444', borderRadius: 6, color: '#fca5a5', fontSize: 12 }}>Lỗi đọc chờ duyệt: {loiDs}</div>;
  if (!du || !du.ds.length) return null;
  // #1847: thẻ đổi "Hiện tại" ngay lúc bấm (duyet = ok), lỗi thì trả về chưa duyệt — không đợi đọc lại danh sách
  const datDuyet = (cr: number, v: ChonDuyet | null) => setDu((d) => (d ? { ...d, ds: d.ds.map((x) => (x.creative_id === cr ? { ...x, duyet: v === 'sua' ? false : v, sua_lai: v === 'sua' } : x)) } : d));
  const bam: Bam = async (cr, f, ok) => {
    setDang(cr); setBao((b) => ({ ...b, [cr]: {} })); if (ok != null) { datDuyet(cr, ok); phat({ cr, ok, pha: 'gui' }); }
    const hong = () => { if (ok != null) { datDuyet(cr, null); phat({ cr, ok, pha: 'loi' }); } };
    try { const r = await f(); setBao((b) => ({ ...b, [cr]: 'loi' in r ? { loi: r.loi } : { chu: r.chu } }));
      // duyệt xong THẤY NGAY dòng ⏳ Chờ lên camp dưới phim (anh 25/11/2026): đọc lại bảng camp + ô Lọc thêm mục Chờ lên camp (etp-view nghe 'etp-loc-them')
      if ('loi' in r) hong(); else { if (ok != null) phat({ cr, ok, pha: 'xong' }); locThem(ok); router.refresh(); } }
    catch (e) { setBao((b) => ({ ...b, [cr]: { loi: `máy chủ lỗi: ${String((e as Error)?.message ?? e).slice(0, 200)}` } })); hong(); }
    setDang(null); void tai();
  };
  const cho = du.ds.filter((x) => x.duyet == null).length;
  const xn = ngan == null ? null : du.ds.find((x) => x.creative_id === ngan) ?? null;
  return (
    <div data-cho-duyet="" style={{ margin: '6px 0 10px', border: '1px solid #f59e0b', borderRadius: 8, padding: '8px 10px', background: 'rgba(245,158,11,.06)' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 6 }}>
        <b style={{ color: '#f59e0b' }} title={GIAI}>⏸ Chờ anh duyệt ({cho})</b>
        <span style={{ fontSize: 12, color: 'var(--fg-2)', cursor: 'help' }} title={GIAI}>Duyệt → xuống bảng camp bên dưới</span>
        {du.dungKhan ? <span style={{ fontSize: 12, color: '#f87171', fontWeight: 600, cursor: 'help' }} title={GIAI_DK}>⏳ đang DỪNG KHẨN — đã duyệt thì máy tự lên khi nhả</span> : null}
      </div>
      {xn ? <Drawer onClose={() => setNgan(null)} width={1080} padding={14}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 10 }}>
          <b style={{ fontSize: 15 }}>{xn.phim ?? `phim #${xn.content_id}`}</b>
          <span style={{ color: 'var(--fg-2)', fontSize: 12 }}>{(xn.lang ?? '?').toUpperCase()} · cr #{xn.creative_id} · {xn.dang ?? ''} · {kieu(xn.roas)}</span>
          {xn.duyet == null ? <span style={{ marginLeft: 'auto' }}><NutDuyet cr={xn.creative_id} roas={xn.roas} lich={xn.tl?.g_lich ?? null} dk={!!du.dungKhan} dang={dang} bam={bam} /></span> : null}
        </div>
        <div style={{ marginBottom: 8 }}><TrangThaiCr x={xn} dk={!!du.dungKhan} /></div>
        {bao[xn.creative_id]?.loi ? <div role="alert" style={{ marginBottom: 8, padding: 6, border: '1px solid #ef4444', borderRadius: 4, background: 'rgba(239,68,68,.12)', color: '#fca5a5', fontSize: 12 }}>{bao[xn.creative_id]!.loi}</div> : null}
        {xn.camp_id ? <CamCauHinh campId={xn.camp_id} phim={xn.phim} xemTruoc={<KhungBaiQc cr={xn.creative_id} camp={xn.camp_id} anh={xn.anh} video={xn.video} caoMedia="46dvh" />} soLieu={<div style={{ fontSize: 12, color: 'var(--fg-2)' }}>Số liệu xem ở dòng camp #{xn.camp_id} trong bảng.</div>} />
          : xn.ke ? <CamCauHinh campId={xn.ke.id} ke={xn.ke} phim={xn.phim} xemTruoc={<KhungBaiQc cr={xn.creative_id} anh={xn.anh} video={xn.video} caoMedia="46dvh" />} soLieu={<div style={{ fontSize: 12, color: 'var(--fg-2)' }}>Creative chưa có camp — chưa có số liệu.</div>} />
          : <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>Creative chưa gắn phim (content_id) — chưa dựng được camp dự kiến.</div>}
      </Drawer> : null}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {du.ds.map((x) => { const b = bao[x.creative_id] ?? {}, cho1 = x.duyet == null;
          return (
            // #1861 điện thoại 393px: thẻ co theo khung (không cứng 460 → tràn ngang), ảnh 9:16 co theo bề ngang màn
            <div key={x.creative_id} style={{ display: 'flex', gap: 8, width: 'min(460px, 100%)', boxSizing: 'border-box', minWidth: 0, border: '1px solid var(--line)', borderRadius: 6, padding: 6 }}>
              <div style={{ flex: 'none', width: ANH_W }}>
                {xem === x.creative_id && x.video ? <VideoXem src={x.video} controls style={{ width: '100%', aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 4, display: 'block' }} onEnded={() => setXem(null)} />
                  : <button type="button" title={x.video ? 'bấm để xem video' : 'chưa có video'} onClick={() => x.video && setXem(x.creative_id)} style={{ padding: 0, border: 'none', background: 'none', cursor: x.video ? 'pointer' : 'default', position: 'relative', width: '100%', display: 'block' }}>
                      {x.anh ? <img src={x.anh} alt="" style={{ width: '100%', aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 4, display: 'block' }} /> : <span style={{ display: 'block', width: '100%', aspectRatio: '9 / 16', background: 'var(--line)', borderRadius: 4 }} />}
                      {x.video ? <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, color: '#fff', textShadow: '0 0 6px #000' }}>▶</span> : null}
                    </button>}
              </div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div role="button" tabIndex={0} title="bấm để mở ngăn camp dự kiến (đủ Campaign / Ad set / Ad như trang Ethopex)" onClick={() => setNgan(x.creative_id)} onKeyDown={(e) => { if (e.key === 'Enter') setNgan(x.creative_id); }}
                  style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={x.phim ?? ''}>{x.phim ?? `phim #${x.content_id}`} <span style={{ color: '#60a5fa', fontWeight: 400 }}>↗ chi tiết</span></div>
                <div style={{ color: 'var(--fg-2)' }}>{(x.lang ?? '?').toUpperCase()} · cr #{x.creative_id} · {x.dang ?? ''}</div>
                <div style={{ color: 'var(--fg-3, #888)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={x.ghi}>{x.ghi}</div>
                {x.diem_thap ? <div style={{ color: '#fbbf24' }} title={`tiêu chí chấm ≤ 4: ${x.diem_thap} — duyệt thì người duyệt thắng điểm (0443)`}>⚠ điểm thấp: {x.diem_thap.slice(0, 40)}</div> : null}
                <TomTl x={x} />
                </div>
                <NhanXetCu ds={x.nx} />
                <TrangThaiCr x={x} dk={!!du.dungKhan} />
                {cho1 ? (
                  <div style={{ marginTop: 'auto' }}><NutDuyet cr={x.creative_id} roas={x.roas} lich={x.tl?.g_lich ?? null} dk={!!du.dungKhan} dang={dang} bam={bam} /></div>
                ) : x.camp_id ? <div style={{ color: '#4ade80', marginTop: 'auto' }}>✓ đã duyệt → camp #{x.camp_id} ({x.trang_thai})</div> : (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 'auto' }}>
                    <span style={{ color: '#60a5fa' }} title={du.dungKhan ? GIAI_DK : 'máy đang lên camp / thử lại theo nhịp'}>{du.dungKhan ? '⏳ đã duyệt · xếp hàng lên ' : '✓ đã duyệt · đang lên '}{kieu(x.roas)}</span>
                    {du.dungKhan ? null : <button type="button" disabled={dang != null} onClick={() => bam(x.creative_id, () => lenCamp(x.creative_id))} style={nut}>{dang === x.creative_id ? '…' : 'Lên lại'}</button>}
                  </div>)}
                {b.loi ? <div role="alert" style={{ padding: 6, border: '1px solid #ef4444', borderRadius: 4, background: 'rgba(239,68,68,.12)', color: '#fca5a5' }}>{b.loi}</div> : null}
                {b.chu ? <div style={{ color: '#86efac' }} title={b.chu}>✓ {b.chu.startsWith('đã duyệt') ? 'đã xếp hàng' : 'đã gửi lệnh'}</div> : null}
                {x.nhat_ky && !b.loi ? <pre title="nhật ký lên camp (box3 /tmp/etp-len-cr-…)" style={{ margin: 0, fontSize: 10.5, whiteSpace: 'pre-wrap', color: 'var(--fg-2)', maxHeight: 60, overflow: 'auto' }}>{x.nhat_ky}</pre> : null}
              </div>
            </div>); })}
      </div>
    </div>
  );
}
