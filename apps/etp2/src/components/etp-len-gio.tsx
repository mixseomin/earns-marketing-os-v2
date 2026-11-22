'use client';
// ▶ LÊN NGAY / 🕒 ĐỔI GIỜ ở bảng cây camp (anh 22/11/2026 "nút bấm Lên ngay = Tao ra lệnh sao phải xin mày ?" · "tao có thể điều chỉnh ngày, giờ lên camp khác đi"
// · "nếu camp đang chờ (đã push lên etho) thì mày cũng phải xử lý được nó"). Anh bấm = lệnh trực tiếp (vé cong.py --ve-truc-tiep): phanh đang áp thì lần đầu hiện
// ô VÀNG cảnh báo một lần, bấm lại là lên. Lỗi = ô ĐỎ ngay dưới nút. Camp đã đẩy lên Ethopex không sửa được giờ → camp mới đúng giờ, camp cũ tạm dừng.
import { useEffect, useRef, useState } from 'react';
import { bayGioVn } from '@/lib/etp-nb';
import { useRouter } from 'next/navigation';
import { AnchoredPopover } from '@/components/ui';
import { doiGioCamp, khongDuyetCr, lenNgayCr, xemTruocLen, type KqNut, type XemTruoc } from '@/lib/actions/etp-cho-duyet';

const nut: React.CSSProperties = { fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'inherit', cursor: 'pointer' };
const o: React.CSSProperties = { fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'inherit' };
/** ISO → "YYYY-MM-DDTHH:MM" giờ VN cho ô datetime-local */
const vnInput = (iso: string | null | undefined) => { if (!iso) return ''; const d = new Date(Date.parse(iso) + 7 * 3600_000); return isNaN(+d) ? '' : d.toISOString().slice(0, 16); };

/** Ô GIỜ VN dùng chung cho mọi chỗ đặt giờ camp (bảng điều khiển camp "đặt giờ", ▶ Lên, 🕒 đổi giờ) — anh 22/11/2026 #1762 "tick vào thì chọn sẵn ngày hôm nay
 *  · default set sẵn ngày hôm nay, lúc này · ko để trống": không bao giờ trống (xoá ô = về lúc này), tick "hôm nay" = khoá ngày hôm nay, chỉ chọn giờ. */
export function OGioVn({ gio, setGio, style }: { gio: string; setGio: (g: string) => void; style?: React.CSSProperties }) {
  const nay = bayGioVn(), homNay = nay.slice(0, 10), g = gio || nay;
  const [chiNay, setChiNay] = useState(() => g.slice(0, 10) <= homNay);
  useEffect(() => { if (!gio) setGio(bayGioVn()); }, [gio, setGio]);
  const s: React.CSSProperties = { ...o, ...style, width: 'auto', colorScheme: 'dark' };
  return <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
    {chiNay
      ? <input type="time" data-o-gio-vn="" value={g.slice(11, 16)} aria-label="giờ VN hôm nay" onChange={(e) => setGio(e.target.value ? `${homNay}T${e.target.value}` : bayGioVn())} style={s} />
      : <input type="datetime-local" data-o-gio-vn="" value={g} min={nay} aria-label="ngày giờ VN" onChange={(e) => setGio(e.target.value || bayGioVn())} style={s} />}
    <label title="tick = ngày hôm nay, chỉ chọn giờ · bỏ tick = chọn cả ngày" style={{ display: 'inline-flex', gap: 4, alignItems: 'center', cursor: 'pointer', whiteSpace: 'nowrap' }}>
      <input type="checkbox" checked={chiNay} onChange={(e) => { const v = e.target.checked; setChiNay(v); if (v) { const t = `${homNay}T${g.slice(11, 16)}`; setGio(t < nay ? nay : t); } }} />hôm nay</label>
  </span>;
}

/** 👁 XEM TRƯỚC mọi thứ ▶ Lên sẽ gửi Ethopex (anh 22/11/2026 "tao cần xem mọi thứ mày sẽ submit thì mới gọi là review"): nhan-ban chạy KHÔ đúng lệnh của nút
 *  (xemTruocLen → --xem-truoc) → payload THẬT, đọc thành chữ; JSON gốc gập dưới cùng. Không tạo gì. */
type Pl = Record<string, any>;   // eslint-disable-line @typescript-eslint/no-explicit-any
function XemTruocLen({ cr, gio, anh, video }: { cr: number; gio: string | null; anh?: string | null; video?: string | null }) {
  const [x, setX] = useState<XemTruoc | null>(null);
  useEffect(() => { let song = true; setX(null); xemTruocLen(cr, gio).then((r) => { if (song) setX(r); }).catch((e) => { if (song) setX({ loi: `máy chủ lỗi: ${String((e as Error)?.message ?? e).slice(0, 200)}` }); }); return () => { song = false; }; }, [cr, gio]);
  if (!x) return <div style={{ color: 'var(--fg-2)' }}>👁 đang chạy khô nhan-ban để lấy đúng payload sẽ gửi Ethopex (~10–60 giây, không tạo gì)…</div>;
  if ('loi' in x) return <div role="alert" style={{ padding: 6, border: '1px solid #ef4444', borderRadius: 4, background: 'rgba(239,68,68,.12)', color: '#fca5a5' }}>Không xem trước được: {x.loi}</div>;
  const p = x.payload as Pl, c: Pl = p.campaign ?? {}, cs: Pl = c.source_payload ?? {}, ag: Pl = (c.ad_groups ?? [])[0] ?? {}, as: Pl = ag.source_payload ?? {}, tg: Pl = as.targeting ?? {};
  const ad: Pl = (p.ads ?? ag.ads ?? [])[0] ?? {}, ads: Pl = ad.source_payload ?? {};
  const nuoc: string[] = tg.geo_locations?.countries ?? [];
  const tien = (v: unknown) => v == null || v === '' ? '—' : `$${Number(v)}/ngày`;   // Ethopex daily_budget = $ nguyên (nhan-ban int(ns))
  const gioi = (g: unknown) => Array.isArray(g) && g.length ? g.map((v) => (v === 1 ? 'nam' : v === 2 ? 'nữ' : String(v))).join(', ') : 'mọi giới';
  const vitri = [tg.publisher_platforms, tg.facebook_positions, tg.instagram_positions].filter((v) => Array.isArray(v) && v.length).map((v) => v.join(', ')).join(' · ');
  const tg2 = (s: string | null | undefined) => { if (!s) return null; const d = new Date(s); if (isNaN(+d)) return s; const v = new Date(+d + 7 * 3600_000); return `${v.toISOString().slice(11, 16)} ${v.toISOString().slice(8, 10)}/${v.toISOString().slice(5, 7)} giờ VN`; };
  const dong: [string, React.ReactNode][] = [
    ['Tên camp', x.ten ?? cs.name ?? p.name ?? '—'],
    ['Tài khoản QC', `${p.ad_account_id ?? '—'}${p.external_account_id ? ` · tk ngoài ${p.external_account_id}` : ''}`],
    ['Page', p.facebook_page_id ?? ad.facebook_page_id ?? '—'], ['Pixel', p.pixel_id_arb ?? '—'],
    ['Ngân sách', tien(cs.daily_budget ?? as.daily_budget)],
    ['Cách thầu', cs.bid_strategy === 'LOWEST_COST_WITH_MIN_ROAS' ? 'Lowest cost + ROAS tối thiểu' : cs.bid_strategy ?? '—'],
    ['ROAS sàn', as.bid_constraints?.roas_average_floor != null ? String(as.bid_constraints.roas_average_floor) : '—'],
    ['Mục tiêu', `${cs.objective === 'OUTCOME_SALES' ? 'Bán hàng (OUTCOME_SALES)' : cs.objective ?? '—'}${cs.dsa_payor ? ` · DSA ${cs.dsa_payor}` : ''}`],
    ['Tối ưu', as.optimization_goal === 'VALUE' ? 'giá trị đơn (VALUE)' : as.optimization_goal ?? '—'],
    ['Trạng thái', `camp ${cs.status ?? '—'} · ad ${ads.status ?? '—'} (Ethopex tự bật camp khi đồng bộ)`],
    ['Giờ chạy', x.chay ?? (ag.start_time ? tg2(ag.start_time) : 'chạy ngay khi Ethopex / Meta đồng bộ xong')],
    ['Kiểu chạy', ag.type_run ?? '—'],
    ['Nước', nuoc.length ? <span title={nuoc.join(', ')}>{nuoc.length} nước: {nuoc.join(', ')}</span> : 'mọi nước'],
    ['Tuổi · giới', `${tg.age_min ?? 18}–${tg.age_max ?? 65} · ${gioi(tg.genders)}`],
    ['Vị trí', vitri || 'tự động (Advantage+)'],
    ['Ad', `${ads.name ?? '—'} · creative #${ad.creative_id ?? cr} · content #${ad.content_id ?? '—'}${ad.domain ? ` · ${ad.domain}` : ''}`],
  ];
  return <div data-xem-truoc-len="" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <b style={{ color: '#93c5fd' }}>👁 Sẽ gửi Ethopex đúng như sau</b>
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      {anh || video ? <a href={video || anh || undefined} target="_blank" rel="noreferrer" title={video ? 'mở video creative' : 'mở ảnh creative'} style={{ flex: '0 0 auto' }}>
        {anh ? <img src={anh} alt="" style={{ width: 96, height: 170, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--line)' }} />
          : <video src={video!} muted style={{ width: 96, height: 170, objectFit: 'cover', borderRadius: 4 }} />}</a> : null}
      <table style={{ borderCollapse: 'collapse', fontSize: 11.5, flex: 1 }}><tbody>
        {dong.map(([k, v]) => <tr key={k}><td style={{ color: 'var(--fg-2)', padding: '1px 8px 1px 0', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{k}</td><td style={{ padding: '1px 0', wordBreak: 'break-word' }}>{v}</td></tr>)}
      </tbody></table>
    </div>
    {x.canh.length ? <div style={{ padding: 6, border: '1px solid #f59e0b', borderRadius: 4, background: 'rgba(245,158,11,.12)', color: '#fde68a' }}>
      ⚠ Cổng sẽ BỎ QUA khi anh bấm (lệnh trực tiếp):<ul style={{ margin: '2px 0 0 16px', padding: 0 }}>{x.canh.map((t, i) => <li key={i}>{t}</li>)}</ul></div> : null}
    <details><summary style={{ cursor: 'pointer', color: 'var(--fg-2)' }}>JSON gốc gửi POST /api/v1/campaigns/facebook</summary>
      <pre style={{ margin: 0, maxHeight: 260, overflow: 'auto', fontSize: 10.5, background: 'var(--bg-2)', padding: 6, borderRadius: 4 }}>{JSON.stringify(p, null, 2)}</pre></details>
  </div>;
}

/** cr = dòng xếp hàng (creative đã duyệt chưa camp) · camp + lich = camp đã đẩy lên Ethopex, chờ giờ chạy */
export function NutLenGio({ cr, camp, lich, nhan, anh, video }: { cr?: number | null; camp?: number; lich?: string | null; nhan?: React.ReactNode; anh?: string | null; video?: string | null }) {
  const router = useRouter();
  const neo = useRef<HTMLButtonElement>(null);
  const [mo, setMo] = useState(false), [gio, setGio] = useState(''), [dang, setDang] = useState<'ngay' | 'gio' | 'khong' | null>(null)   /* MỖI NÚT MỘT CỜ (anh 22/11/2026 "sao lại 2 chữ đang gửi"): chỉ nút vừa bấm hiện đang gửi */, [kq, setKq] = useState<KqNut | null>(null);
  const doiGio = camp != null && camp > 0;
  const bam = async (g: string | null, khong?: boolean) => {
    setDang(khong ? 'khong' : g ? 'gio' : 'ngay'); setKq(null);
    try { setKq(khong ? await khongDuyetCr(Number(cr)) : doiGio ? await doiGioCamp(camp, g ?? '') : await lenNgayCr(Number(cr), g)); }
    catch (e) { setKq({ loi: `máy chủ lỗi: ${String((e as Error)?.message ?? e).slice(0, 200)}` }); }
    setDang(null); daGui.current = true;   // làm mới bảng lúc ĐÓNG khung — làm mới ngay thì dòng chờ duyệt biến mất, khung + kết quả mất theo
  };
  const daGui = useRef(false);
  const dong = () => { setMo(false); if (daGui.current) { daGui.current = false; router.refresh(); } };
  const nutXanh: React.CSSProperties = { ...nut, borderColor: '#22c55e', color: '#4ade80', fontWeight: 600, cursor: dang ? 'wait' : 'pointer', flex: 1 };
  return <>
    <button ref={neo} data-nut-len-gio="" onClick={(e) => { e.stopPropagation(); setMo((v) => !v); setKq(null); setGio((doiGio ? vnInput(lich) : '') || bayGioVn()); }}
      title={doiGio ? 'đổi giờ chạy camp đang chờ' : 'lên camp ngay hoặc đặt giờ chạy'}
      style={doiGio ? { border: 'none', background: 'transparent', color: '#f59e0b', cursor: 'pointer', padding: '0 2px', fontSize: 11 } : { ...nut, padding: '1px 8px', fontSize: 11, borderColor: '#22c55e', color: '#4ade80', fontWeight: 600 }}>
      {nhan ?? (doiGio ? '🕒' : '▶ Lên')}</button>
    <AnchoredPopover anchorRef={neo} open={mo} onClose={dong}>
      <div onClick={(e) => e.stopPropagation()} style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, width: doiGio ? 300 : 'min(560px, 92vw)', maxHeight: doiGio ? undefined : '78vh', overflowY: doiGio ? undefined : 'auto', fontSize: 12, lineHeight: 1.45,
        background: 'var(--bg-1)', border: '1px solid var(--accent-line, var(--line))', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.45)' }}>
        <b>{doiGio ? `Đổi giờ chạy camp #${camp}` : `Lên camp creative #${cr}`}</b>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>Giờ VN
          <OGioVn gio={gio} setGio={setGio} /></label>
        {doiGio ? <span style={{ color: 'var(--fg-2)' }}>Ethopex không sửa giờ được: lên camp mới đúng giờ, tạm dừng camp cũ.</span> : null}
        <div style={{ display: 'flex', gap: 6 }}>
          {doiGio ? null : <button disabled={!!dang} onClick={() => bam(null)} title="bỏ qua ô giờ, lên camp ngay" style={nutXanh}>{dang === 'ngay' ? 'đang gửi…' : '▶ Lên ngay'}</button>}
          <button disabled={!!dang || !gio} onClick={() => bam(gio)} title="camp chạy đúng giờ VN trong ô" style={nutXanh}>{dang === 'gio' ? 'đang gửi…' : doiGio ? '🕒 Đặt giờ mới' : '🕒 Lên theo giờ này'}</button>
          {doiGio ? null : <button data-khong-duyet="" disabled={!!dang} onClick={() => bam(null, true)}
            title="ghi LOẠI creative + bỏ khỏi sổ ★ ROAS: không tạo camp, không gửi Ethopex, dòng biến mất khỏi bảng (anh 22/11/2026)"
            style={{ ...nut, borderColor: '#ef4444', color: '#fca5a5', fontWeight: 600, cursor: dang ? 'wait' : 'pointer' }}>{dang === 'khong' ? 'đang gửi…' : '✕ Không duyệt'}</button>}
        </div>
        {kq && 'canh' in kq ? <div role="alert" style={{ padding: 6, border: '1px solid #f59e0b', borderRadius: 4, background: 'rgba(245,158,11,.12)', color: '#fde68a' }}>
          ⚠ Phanh đang áp: {kq.canh}<br />Bấm lại trong 30 phút là máy bỏ qua phanh và lên.</div> : null}
        {kq && 'loi' in kq ? <div role="alert" style={{ padding: 6, border: '1px solid #ef4444', borderRadius: 4, background: 'rgba(239,68,68,.12)', color: '#fca5a5' }}>{kq.loi}</div> : null}
        {kq && 'ok' in kq ? <div role="status" style={{ padding: 6, border: '1px solid #22c55e', borderRadius: 4, background: 'rgba(34,197,94,.12)', color: '#86efac' }}>✓ {kq.chu}</div> : null}
        {!doiGio && cr ? <XemTruocLen cr={Number(cr)} gio={null} anh={anh} video={video} /> : null}
      </div>
    </AnchoredPopover>
  </>;
}
