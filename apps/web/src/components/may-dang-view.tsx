'use client';
// TAB MÁY ĐĂNG (anh 09/11/2026: "liệt kê từng query đăng từ mới nhất xuống. Mỗi bước cụ thể phải thành từng cột … Hover vào thì ra chi tiết, có thể tương tác
// luôn trên đó để huỷ, reset, comment … Bảng dùng uiDataTable. Hiển thị thời gian thực. Trên mobile show các cột chính … Bấm chi tiết thì ra drawer …
// Các bước hay lỗi phải có cột chi tiết để thống kê và tập trung fix"). Phòng phụ trách: Phòng Social Traffic (apps/cty/cong-ty/phong/social-traffic.md).
// Nguồn: sổ may_dang_so qua /api/may-dang/so — một dòng một lượt máy đăng xét một kênh × một nền, 7 bước theo đúng thứ tự máy đi (puzzle-books luot-dang.mjs).
// Tab con (YDNI: >2 nhóm = chia tab): Lượt đăng (bảng) · Lỗi hay gặp (gom bước × nhóm lý do, bấm là lọc) · Máy (bật tắt máy, nghỉ nền, vòng 10 phút — màn ⚡ cũ).
// URL giữ mọi cách nhìn (ui-conventions §1): md (tab con) · md_ngay · md_<lọc> · md_q; drawer lượt = useModalParam (?m=luot-dang&mId=<id>).
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnchoredPopover, DataTable, Drawer, EmptyState, MultiSelect, NutViec, SearchInput, Segmented, StatsStrip, TextField, type DataColumn, type DataGroup, type MultiSelectOption } from '@/components/ui';
import { SiteFavicon } from '@/components/ui/site-favicon';
import { MayDang } from '@/components/social-may-dang';
import { pkCua } from '@/lib/ho-nen';
import { wrapExternalUrl } from '@/lib/external-url';
import { useModalParam } from '@/lib/use-modal-param';

type O = { t: 'ok' | 'loi' | 'dung' | 'bo'; ly?: string; ms?: number };
type Dong = {
  id: number | string; ma: string; may_ten: string; nen: string; du_an: string; may_mac?: string; bd: string; kt: string | null; giay: number | null;
  ket: string; buoc_dung: string | null; ma_ly: string | null; loi: string | null; slug: string | null; url: string | null; acct: string | null; profile: string | null;
  duong: string | null; buoc: Record<string, O>; lan: number; nguon: string; ghi_chu: { ai: string; luc: string; chu: string }[];
  so_dang?: { url?: string | null; chuaXacNhan?: boolean; bo?: boolean } | null; lenh?: { id: number; luc: string; xong_luc: string | null } | null; tam?: boolean;
};
type Chay = { id: number; ma: string; may_ten: string; nen: string; du_an: string; bd: string; slug: string | null; noi_dung: string; kq: { luc: string; ok: boolean; url: string | null; noi_dung: string } | null };

const BUOC: { k: string; ten: string; giai: string }[] = [
  { k: 'kenh', ten: 'Kênh', giai: 'kênh bật / nghỉ / hẹn giờ / kênh chết / có lượt khác đang chạy' },
  { k: 'nhip', ten: 'Nhịp an toàn', giai: 'trần bài theo tuổi kênh, cách ≥ 3 giờ, cảnh báo tài khoản, khung giờ, chờ sau lần hỏng' },
  { k: 'chon', ten: 'Chọn bài', giai: 'bài DUYỆT chưa đăng nền này (đúng góc kế hoạch nếu có) — hoặc hết bài / chưa tới hạn' },
  { k: 'chuan_bi', ten: 'Chuẩn bị', giai: 'kéo video/ảnh từ kho, bản xuất hợp nền, chữ + link (đan xen bài thường 1/3)' },
  { k: 'dang', ten: 'Đăng', giai: 'Graph API trên box3 hoặc trình duyệt (profile riêng của kênh)' },
  { k: 'xac_nhan', ten: 'Xác nhận', giai: 'có link bài thật — đã bấm mà không thấy bài thì sổ ghi "chưa xác nhận", máy không đăng lại' },
  { k: 'sau', ten: 'Sau đăng', giai: 'bình luận link, ảnh bìa, playlist' },
];
const TEN_BUOC: Record<string, string> = Object.fromEntries(BUOC.map((b) => [b.k, b.ten]));
const KET: Record<string, { ten: string; mau: string; giai: string }> = {
  chay: { ten: 'đang đăng', mau: 'var(--info, #3b82f6)', giai: 'máy đang làm lượt này ngay lúc này' },
  dang: { ten: 'đã lên', mau: 'var(--ok, #16a34a)', giai: 'bài đã lên nền' },
  hen: { ten: 'đã hẹn', mau: 'var(--ok, #16a34a)', giai: 'bài đã hẹn giờ trên nền' },
  hong: { ten: 'hỏng', mau: 'var(--danger, #dc2626)', giai: 'máy làm mà hỏng — tự thử lại sau 30 phút (tối đa 3 lần/ngày), thợ máy Mạnh tự nhận việc sửa gốc' },
  mat_dau: { ten: 'mất dấu', mau: 'var(--danger, #dc2626)', giai: 'bắt đầu hơn 40 phút mà không có kết quả — tiến trình chết giữa lượt' },
  het: { ten: 'kho cạn', mau: 'var(--warn, #d97706)', giai: 'không còn bài DUYỆT chưa đăng cho nền này — cần làm thêm bài, không phải lỗi máy' },
  dung: { ten: 'dừng đúng luật', mau: 'var(--fg-3)', giai: 'máy đứng đúng luật (trần, cách giờ, khung giờ, nghỉ, hẹn giờ…) — tự đi tiếp khi điều kiện qua' },
  bo: { ten: 'bỏ lượt', mau: 'var(--fg-3)', giai: 'lượt này nhường (lượt khác đang chạy, bài thường thay bài link…) — lượt sau tự đi' },
};
// Tên cho mã lý do — mã do hàm SQL may_dang_ma_ly (migration 0445) phân, một nguồn; ở đây chỉ đặt tên đọc được.
const MA_LY: Record<string, string> = {
  'het-bai': 'Hết bài đã duyệt', 'chua-han': 'Chưa tới hạn đăng', 'kenh-hen-gio': 'Kênh hẹn giờ', 'nghi-nen': 'Nền đang nghỉ', 'kenh-chet': 'Kênh chết (0 lượt xem)',
  'canh-bao-tk': 'Tài khoản có cảnh báo', 'cach-3-gio': 'Chưa cách đủ 3 giờ', 'tran-ngay': 'Đủ trần ngày', 'ngoai-khung': 'Ngoài khung giờ', 'chua-toi-gio': 'Chưa tới giờ kênh',
  'cho-sau-hong': 'Chờ sau lần hỏng', 'luot-khac-chay': 'Lượt khác đang chạy', 'bai-thuong': 'Lượt bài thường', 'may-mac-khac': 'Nền thuộc máy Mac khác', 'graph-xac-minh': 'Graph API đòi xác minh',
  'hen-thieu': 'Hẹn giờ thiếu bài', 'api-box3': 'Lỗi script API box3', 'het-dia': 'Hết dung lượng đĩa', 'tai-tep-hong': 'Tải tệp về hỏng', 'br-chan-nut': 'Gác br chặn nút',
  'br-eval-hong': 'Mã br eval lỗi', 'fb-hen-gio': 'FB hẹn giờ hỏng', 'yt-chua-cong-khai': 'YouTube chưa công khai', 'quora-giao-dien': 'Quora: giao diện', 'ig-giao-dien': 'Instagram: giao diện',
  'tiktok-giao-dien': 'TikTok: giao diện', 'x-giao-dien': 'X: giao diện', 'tien-trinh-bi-cat': 'Tiến trình bị cắt', 'yt-dien-thieu': 'YouTube: điền thiếu ô', 'yt-khong-public': 'YouTube: không chọn được Public',
  'yt-publish-khong-xac-nhan': 'YouTube: Publish không xác nhận', 'sai-danh-tinh': 'Sai kênh / tài khoản', 'yt-playlist': 'YouTube: gắn playlist', 'x-khong-thay-bai': 'X: không thấy bài mới',
  'x-o-soan': 'X: chữ không vào ô soạn', 'tai-len-cham': 'Tải lên quá lâu', 'ssh-may-khac': 'Không vào được máy Mac khác', 'br-profile': 'Profile trình duyệt', 'fb-graph': 'Facebook Graph API',
  'dang-nhap': 'Đăng nhập / checkpoint', 'dang-trung': 'Chặn đăng trùng', 'thieu-ban-xuat': 'Thiếu bản xuất hợp nền', 'chua-xac-nhan': 'Chưa xác nhận bài lên', 'mat-dau': 'Mất dấu giữa lượt',
  'qua-gio': 'Quá thời gian', khac: 'Khác (chưa phân loại)',
};
const tenLy = (m: string | null) => (m ? MA_LY[m] ?? m : '—');
const gioVn = (iso: string) => new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
const homVn = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const nho = { fontSize: 12, color: 'var(--fg-2)' } as const;
const cat = (w: number) => ({ maxWidth: w, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }) as const;
const NGAY = [{ value: '1', label: '24 giờ' }, { value: '3', label: '3 ngày' }, { value: '7', label: '7 ngày' }, { value: '14', label: '14 ngày' }];
const LOC = ['da', 'km', 'nen', 'tk', 'kq', 'bd', 'ml'] as const;
type KhoaLoc = (typeof LOC)[number];
type Loc = Record<KhoaLoc, string[]>;
const locTrong = (): Loc => ({ da: [], km: [], nen: [], tk: [], kq: [], bd: [], ml: [] });
const tkCua = (r: Dong) => (r.acct ? `#${r.acct}` : r.profile ? r.profile.split('/').pop()!.replace(/^\.capture-profile-/, '') : '—');
const GIA_TRI: Record<KhoaLoc, (r: Dong) => string | null> = { da: (r) => r.du_an || '—', km: (r) => r.may_ten, nen: (r) => r.nen, tk: tkCua, kq: (r) => r.ket, bd: (r) => r.buoc_dung, ml: (r) => r.ma_ly };
const KY: Record<O['t'], [string, string]> = { ok: ['✓', 'var(--ok, #16a34a)'], loi: ['✗', 'var(--danger, #dc2626)'], dung: ['⏸', 'var(--warn, #d97706)'], bo: ['↷', 'var(--fg-3)'] };
const TEN_T: Record<O['t'], string> = { ok: 'qua', loi: 'hỏng', dung: 'dừng đúng luật', bo: 'bỏ lượt' };

/** Lượt đang chạy (nhật ký 'bat-dau' chưa vào sổ) → dòng tạm: chưa có kết quả = đang đăng (quá 40 phút = mất dấu); có rồi = 3 bước đã biết, chờ sổ đủ bước. */
function dongTam(c: Chay): Dong {
  const phut = (Date.now() - Date.parse(c.bd)) / 60_000, kq = c.kq, ket = kq ? (kq.ok ? 'dang' : 'hong') : phut > 40 ? 'mat_dau' : 'chay';
  const buoc: Record<string, O> = { kenh: { t: 'ok' }, nhip: { t: 'ok' }, chon: { t: 'ok', ly: c.slug ?? '' } };
  if (kq) buoc.dang = { t: kq.ok ? 'ok' : 'loi', ly: kq.noi_dung };
  if (kq?.ok) buoc.xac_nhan = { t: kq.url ? 'ok' : 'loi', ly: kq.url ?? 'không có link' };
  return { id: `c${c.id}`, ma: c.ma, may_ten: c.may_ten, nen: c.nen, du_an: c.du_an, bd: c.bd, kt: kq?.luc ?? null, giay: kq ? Math.round((Date.parse(kq.luc) - Date.parse(c.bd)) / 1000) : Math.round(phut * 60),
    ket, buoc_dung: kq?.ok ? null : 'dang', ma_ly: ket === 'mat_dau' ? 'mat-dau' : null, loi: kq && !kq.ok ? kq.noi_dung : ket === 'mat_dau' ? `bắt đầu ${gioVn(c.bd)}, hơn 40 phút không có kết quả` : null,
    slug: c.slug, url: kq?.url ?? null, acct: null, profile: null, duong: null, buoc, lan: 1, nguon: 'tam', ghi_chu: [], tam: true };
}

async function goi(url: string, body: object): Promise<string> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as { error?: string; bao?: string };
  if (!r.ok || j.error) throw new Error(j.error ?? `máy chủ trả ${r.status}`);
  return j.bao ?? 'xong';
}

/** Việc làm được trên một lượt — một bộ cho cả thẻ nổi lẫn drawer. Chỉ hiện nút bấm được thật trên đúng dòng đó (cùng điều kiện server xét). */
function ViecLuot({ r, admin, xong }: { r: Dong; admin: boolean; xong: () => void }) {
  const [chu, setChu] = useState('');
  if (r.tam) return <span style={nho}>Lượt đang chạy / vừa xong — sổ đủ 7 bước về khi máy hết vòng 10 phút, lúc đó có nút.</span>;
  const id = Number(r.id), daLen = !!r.so_dang?.url, chuaXn = !!r.so_dang?.chuaXacNhan && !r.so_dang?.url;
  const coThuLai = ['hong', 'mat_dau'].includes(r.ket) || r.ma_ly === 'cho-sau-hong';
  const lenhCho = !!r.lenh && !r.lenh.xong_luc;
  const lam = (viec: string, x: object = {}) => async () => { const b = await goi('/api/may-dang/so', { id, viec, ...x }); xong(); return b; };
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'flex-start' }} onClick={(e) => e.stopPropagation()}>
    {coThuLai && (lenhCho ? <span style={nho}>⟳ lệnh thử lại gửi {gioVn(r.lenh!.luc)} — chờ máy nhận ở vòng kế (≤ 10 phút)</span>
      : <NutViec nhan="⟳ Thử lại" giai="xoá đếm hỏng của kênh × nền này: vòng 10 phút kế máy đăng lại (vẫn theo nhịp an toàn), không chờ 30 phút / tới mai" lam={lam('thu_lai')} />)}
    {r.slug && !daLen && !r.so_dang?.bo && !chuaXn && r.ket !== 'dang' && <NutViec nguy nhan="✕ Bỏ bài khỏi nền" giai={`máy không chọn ${r.slug} để đăng lên ${r.nen} nữa (bài vẫn đăng nền khác)`} lam={lam('bo_bai')} />}
    {chuaXn && <NutViec nhan="↺ Gỡ chưa xác nhận" giai="sổ ghi 'đã bấm nhưng chưa thấy bài' nên máy không đăng lại bài này. Bài KHÔNG có trên nền thì gỡ để máy đăng lại" lam={lam('go_chua_xn')} />}
    {admin && <NutViec nhan="⏸ Nghỉ nền hôm nay" giai={`${r.may_ten} không đăng ${r.nen} tới hết ${homVn()} (giờ VN); tab Máy gỡ nghỉ`} lam={async () => { await goi('/api/social/may-dang', { ma: r.ma, nen: r.nen, nghi_den: homVn() }); xong(); return `nghỉ ${r.nen} tới hết hôm nay`; }} />}
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'flex-start', flex: '1 1 220px' }}>
      <span style={{ flex: 1 }}><TextField value={chu} onChange={(e) => setChu(e.target.value)} placeholder="Ghi chú bổ sung…" size="sm" /></span>
      {chu.trim() && <NutViec nhan="Lưu" giai="lưu ghi chú vào lượt này" lam={async () => { const b = await lam('ghi_chu', { chu })(); setChu(''); return b; }} />}
    </span>
  </div>;
}

/** Ô một bước: ký hiệu + một dòng lý do; rê chuột = thẻ nổi đủ chữ + việc làm ngay. */
function OBuoc({ r, k, admin, xong, moChiTiet }: { r: Dong; k: string; admin: boolean; xong: () => void; moChiTiet: () => void }) {
  const o = r.buoc?.[k], ref = useRef<HTMLSpanElement>(null), [mo, setMo] = useState(false);
  const chay = r.ket === 'chay' && !o && k === 'dang';
  if (!o && !chay) return <span style={{ color: 'var(--fg-3)' }}>·</span>;
  const [ky, mau] = chay ? ['●', 'var(--info, #3b82f6)'] : KY[o!.t];
  const b = BUOC.find((x) => x.k === k)!;
  return <>
    <span ref={ref} onMouseEnter={() => setMo(true)} style={{ display: 'inline-flex', gap: 4, maxWidth: 190, overflow: 'hidden', whiteSpace: 'nowrap', cursor: 'default' }}>
      <b style={{ color: mau }}>{ky}</b><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', color: o?.t === 'ok' ? 'var(--fg-2)' : 'var(--fg-1)' }}>{chay ? 'đang làm…' : o!.ly ?? ''}</span>
    </span>
    <AnchoredPopover anchorRef={ref} open={mo} onClose={() => setMo(false)} backdrop={false} closeOnPointerOutside>
      <div style={{ width: 360, maxWidth: '90vw', padding: 10, display: 'grid', gap: 8, fontSize: 12 }}>
        <div><b>{b.ten}</b> <span style={{ color: mau }}>{chay ? 'đang làm' : TEN_T[o!.t]}</span>{o?.ms != null && <span style={{ color: 'var(--fg-3)' }}> · {(o.ms / 1000).toFixed(1)}s từ đầu lượt</span>}</div>
        {o?.ly && <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{o.ly}</div>}
        <div style={{ color: 'var(--fg-3)' }}>Bước này: {b.giai}</div>
        <div style={{ color: 'var(--fg-3)' }}>{r.may_ten} · {r.nen} · {gioVn(r.bd)}{r.lan > 1 ? ` · lặp ${r.lan} lần tới ${gioVn(r.kt ?? r.bd)}` : ''}</div>
        <ViecLuot r={r} admin={admin} xong={xong} />
        <button type="button" onClick={() => { setMo(false); moChiTiet(); }} style={{ justifySelf: 'start', border: 0, background: 'none', color: 'var(--accent, #60a5fa)', cursor: 'pointer', padding: 0, fontSize: 12 }}>Mở chi tiết lượt →</button>
      </div>
    </AnchoredPopover>
  </>;
}

const PillKet = ({ ket }: { ket: string }) => { const k = KET[ket] ?? { ten: ket, mau: 'var(--fg-3)', giai: '' };
  return <span title={k.giai} style={{ color: k.mau, fontWeight: ['hong', 'mat_dau', 'chay'].includes(ket) ? 700 : 500 }}>{ket === 'chay' ? '● ' : ''}{k.ten}</span>; };
const Nen = ({ nen }: { nen: string }) => <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><SiteFavicon platformKey={pkCua(nen)} size={14} title={nen} /><code style={{ fontSize: 11 }}>{nen}</code></span>;

function ChiTiet({ r, admin, xong, dong }: { r: Dong; admin: boolean; xong: () => void; dong: () => void }) {
  const iDung = r.buoc_dung ? BUOC.findIndex((x) => x.k === r.buoc_dung) : -1;
  const truong: [string, ReactNode][] = [
    ['Bài', r.slug ?? '—'], ['Link bài', r.url ? <a href={wrapExternalUrl(r.url)} target="_blank" rel="noreferrer">{r.url}</a> : '—'], ['Đường đăng', r.duong ?? '—'],
    ['Tài khoản', r.acct ? `#${r.acct}` : '—'], ['Profile', <span key="p" style={{ wordBreak: 'break-all' }}>{r.profile ?? '—'}</span>],
    ['Sổ đăng bài', r.so_dang ? (r.so_dang.url ? 'đã lên' : r.so_dang.bo ? 'đã bỏ khỏi nền này' : r.so_dang.chuaXacNhan ? 'đã bấm, chưa xác nhận' : 'có mục') : 'chưa có mục nền này'],
    ...(r.nguon === 'nhat_ky' ? [['Nguồn', 'nạp lại từ nhật ký máy cũ (trước 09/11/2026) — chỉ có các bước nhật ký ghi'] as [string, ReactNode]] : []),
  ];
  return <Drawer onClose={dong} width={640}>
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{r.may_ten} <Nen nen={r.nen} /></div>
        <div style={nho}><PillKet ket={r.ket} /> · {gioVn(r.bd)}{r.kt && r.kt !== r.bd ? ` → ${gioVn(r.kt)}` : ''}{r.lan > 1 ? ` · lặp ${r.lan} lần` : ''}{r.giay != null ? ` · ${Math.round(Number(r.giay))}s` : ''} · dự án {r.du_an || '—'}{r.may_mac ? ` · ${r.may_mac}` : ''}</div>
        <div style={{ ...nho, color: 'var(--fg-3)' }}>{KET[r.ket]?.giai}</div>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {BUOC.map((b, i) => { const o = r.buoc?.[b.k], [ky, mau] = o ? KY[o.t] : ['·', 'var(--fg-3)'];
          return <div key={b.k} style={{ display: 'grid', gridTemplateColumns: '18px 96px 1fr', gap: 6, alignItems: 'baseline', opacity: o ? 1 : 0.55 }}>
            <b style={{ color: mau }}>{ky}</b><span style={{ fontWeight: 600 }} title={b.giai}>{b.ten}</span>
            <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12 }}>
              {o ? o.ly || TEN_T[o.t] : iDung >= 0 && i > iDung ? 'chưa tới (lượt dừng ở bước trước)' : r.nguon === 'nhat_ky' ? 'nhật ký cũ không ghi bước này' : '—'}
              {o?.ms != null && <span style={{ color: 'var(--fg-3)' }}> · {(o.ms / 1000).toFixed(1)}s</span>}</span>
          </div>; })}
      </div>
      {r.loi && <div style={{ fontSize: 12 }}><b>Lời máy nói</b> <span style={{ color: 'var(--fg-3)' }}>({tenLy(r.ma_ly)})</span>
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 11 }}>{r.loi}</div></div>}
      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '4px 8px', fontSize: 12 }}>
        {truong.map(([k, v]) => <Fragment key={k}><span style={{ color: 'var(--fg-3)' }}>{k}</span><span>{v}</span></Fragment>)}
      </div>
      <div style={{ display: 'grid', gap: 6 }}><b style={{ fontSize: 12 }}>Làm ngay</b><ViecLuot r={r} admin={admin} xong={xong} /></div>
      {!!r.ghi_chu?.length && <div style={{ display: 'grid', gap: 4 }}><b style={{ fontSize: 12 }}>Ghi chú</b>
        {r.ghi_chu.map((g, i) => <div key={i} style={{ fontSize: 12 }}><span style={{ color: 'var(--fg-3)' }}>{gioVn(g.luc)} · {g.ai}</span> — {g.chu}</div>)}</div>}
    </div>
  </Drawer>;
}

/** Trạng thái xem đọc từ URL khi mount (F5 / chia sẻ giữ nguyên). */
function docUrl() {
  const p = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const loc = locTrong(); for (const k of LOC) loc[k] = (p.get(`md_${k}`) ?? '').split(',').filter(Boolean);
  const md = p.get('md'), ngay = p.get('md_ngay');
  return { md: (md === 'loi' || md === 'may' ? md : 'luot') as 'luot' | 'loi' | 'may', ngay: NGAY.some((x) => x.value === ngay) ? ngay! : '3', loc, q: p.get('md_q') ?? '' };
}
/** URL hiện tại với một khoá đổi — cho ⌘/Ctrl-click mở tab mới (ui-conventions §1). */
const hrefVoi = (k: string, v: string | null) => { if (typeof window === 'undefined') return null; const p = new URLSearchParams(window.location.search); if (v) p.set(k, v); else p.delete(k); return `${window.location.pathname}?${p}`; };

export function MayDangView() {
  const dau = useMemo(docUrl, []), modal = useModalParam();
  const [md, setMd] = useState(dau.md), [ngay, setNgay] = useState(dau.ngay), [loc, setLoc] = useState<Loc>(dau.loc), [q, setQ] = useState(dau.q), [caDung, setCaDung] = useState(false);
  const [rows, setRows] = useState<Map<string, Dong>>(new Map()), [chay, setChay] = useState<Chay[]>([]), [admin, setAdmin] = useState(false), [loi, setLoi] = useState<string | null>(null), [tai, setTai] = useState(true);
  const moc = useRef<string | null>(null), ngayRef = useRef(ngay);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search), dat = (k: string, v: string | null) => (v ? p.set(k, v) : p.delete(k));
    dat('md', md === 'luot' ? null : md); dat('md_ngay', ngay === '3' ? null : ngay); dat('md_q', q || null);
    for (const k of LOC) dat(`md_${k}`, loc[k].length ? loc[k].join(',') : null);
    window.history.replaceState(null, '', `${window.location.pathname}?${p}`);
  }, [md, ngay, loc, q]);

  // THỜI GIAN THỰC: lần đầu đọc cả khoảng; sau đó mỗi 5 giây chỉ hỏi dòng mới / vừa cập nhật từ mốc trước (lùi 15 giây chống lọt) + lượt đang chạy
  const hoi = useCallback(async (lai = false) => {
    try {
      const tu = lai ? null : moc.current;
      const r = await fetch(`/api/may-dang/so?ngay=${ngayRef.current}${tu ? `&tu=${encodeURIComponent(tu)}` : ''}`, { cache: 'no-store' });
      const j = await r.json(); if (j.error) throw new Error(j.error);
      moc.current = new Date(Date.parse(j.luc) - 15_000).toISOString();
      setAdmin(!!j.admin); setChay(j.chay ?? []); setLoi(null);
      setRows((cu) => { const m = lai ? new Map<string, Dong>() : new Map(cu); for (const x of j.rows as Dong[]) m.set(String(x.id), x); return m; });
    } catch (e) { setLoi((e as Error).message); } finally { setTai(false); }
  }, []);
  useEffect(() => { ngayRef.current = ngay; moc.current = null; setTai(true); void hoi(true); }, [ngay, hoi]);
  useEffect(() => { const id = setInterval(() => { if (document.visibilityState === 'visible') void hoi(); }, 5_000); return () => clearInterval(id); }, [hoi]);
  const xong = useCallback(() => { void hoi(); }, [hoi]);

  const tat = useMemo(() => [...chay.map(dongTam), ...rows.values()].sort((a, b) => Date.parse(b.bd) - Date.parse(a.bd)), [rows, chay]);
  const opt = useMemo(() => {
    const dem = (f: (r: Dong) => string | null, ten?: (k: string) => string): MultiSelectOption<string>[] => {
      const m = new Map<string, number>(); for (const r of tat) { const k = f(r); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
      return [...m].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, label: ten ? ten(value) : value, count }));
    };
    return { da: dem(GIA_TRI.da), km: dem(GIA_TRI.km), nen: dem(GIA_TRI.nen), tk: dem(GIA_TRI.tk), kq: dem(GIA_TRI.kq, (k) => KET[k]?.ten ?? k), bd: dem(GIA_TRI.bd, (k) => TEN_BUOC[k] ?? k), ml: dem(GIA_TRI.ml, tenLy) };
  }, [tat]);
  const qq = q.trim().toLowerCase();
  const loc1 = useMemo(() => tat.filter((r) => LOC.every((k) => !loc[k].length || loc[k].includes(GIA_TRI[k](r) ?? ''))
    && (!qq || `${r.slug ?? ''} ${r.loi ?? ''} ${r.may_ten} ${r.nen} ${r.url ?? ''}`.toLowerCase().includes(qq))), [tat, loc, qq]);
  const dat = (k: KhoaLoc, v: string[]) => setLoc((c) => ({ ...c, [k]: v }));
  const moR = modal.is('luot-dang') && modal.id ? tat.find((r) => String(r.id) === modal.id) ?? null : null;
  const moChiTiet = useCallback((r: Dong) => modal.open('luot-dang', String(r.id)), [modal]);

  const tong = (f: (r: Dong) => boolean) => loc1.filter(f).reduce((a, r) => a + (r.lan ?? 1), 0), soHong = tong((r) => r.ket === 'hong' || r.ket === 'mat_dau');
  const soChay = loc1.filter((r) => r.ket === 'chay').length;
  const the = [
    { key: 'chay', label: 'Đang đăng', value: soChay, color: soChay ? 'var(--info, #3b82f6)' : undefined, onClick: () => dat('kq', ['chay']) },
    { key: 'dang', label: 'Đã lên', value: tong((r) => r.ket === 'dang' || r.ket === 'hen'), color: 'var(--ok, #16a34a)', onClick: () => dat('kq', ['dang', 'hen']) },
    { key: 'hong', label: 'Hỏng', value: soHong, color: soHong ? 'var(--danger, #dc2626)' : undefined, onClick: () => dat('kq', ['hong', 'mat_dau']) },
    { key: 'het', label: 'Kho cạn', value: new Set(loc1.filter((r) => r.ket === 'het').map((r) => `${r.ma}|${r.nen}`)).size, sub: 'kênh × nền', onClick: () => dat('kq', ['het']) },
    { key: 'dung', label: 'Dừng đúng luật', value: tong((r) => r.ket === 'dung' || r.ket === 'bo'), sub: 'lượt', onClick: () => dat('kq', ['dung', 'bo']) },
  ];

  const cot: DataColumn<Dong>[] = [
    { key: 'bd', header: 'Giờ', align: 'left', width: 96, sortValue: (r) => Date.parse(r.bd), cell: (r) => <span title={r.lan > 1 ? `lặp ${r.lan} lần tới ${gioVn(r.kt ?? r.bd)}` : undefined}>{gioVn(r.bd)}{r.lan > 1 && <span style={{ color: 'var(--fg-3)' }}> ×{r.lan}</span>}</span> },
    { key: 'kq', header: 'Kết quả', align: 'left', width: 96, sortValue: (r) => r.ket, cell: (r) => <PillKet ket={r.ket} /> },
    { key: 'du_an', group: 'tt', header: 'Dự án', align: 'left', sortValue: (r) => r.du_an, cell: (r) => r.du_an || '—' },
    { key: 'kenh_ten', group: 'tt', header: 'Kênh', align: 'left', sortValue: (r) => r.may_ten, cell: (r) => <span style={cat(180)} title={r.ma}>{r.may_ten}</span> },
    { key: 'nen', group: 'tt', header: 'Nền', align: 'left', sortValue: (r) => r.nen, cell: (r) => <Nen nen={r.nen} /> },
    { key: 'tk', group: 'tt', header: 'Tài khoản', align: 'left', sortValue: tkCua, cell: (r) => <span title={r.profile ?? undefined}>{tkCua(r)}</span> },
    ...BUOC.map((b): DataColumn<Dong> => ({ key: `b_${b.k}`, group: 'buoc', header: b.ten, title: b.giai, align: 'left', sortValue: (r) => r.buoc?.[b.k]?.t ?? null,
      cell: (r) => <OBuoc r={r} k={b.k} admin={admin} xong={xong} moChiTiet={() => moChiTiet(r)} /> })),
    { key: 'buoc_dung', group: 'loi', header: 'Dừng ở', align: 'left', sortValue: (r) => r.buoc_dung, cell: (r) => (r.buoc_dung ? TEN_BUOC[r.buoc_dung] ?? r.buoc_dung : '—') },
    { key: 'ma_ly', group: 'loi', header: 'Nhóm lý do', align: 'left', sortValue: (r) => r.ma_ly, cell: (r) => <span title={r.loi ?? undefined}>{tenLy(r.ma_ly)}</span> },
    { key: 'lan', group: 'loi', header: 'Lần', sortValue: (r) => r.lan, cell: (r) => r.lan },
    { key: 'giay', group: 'loi', header: 'Giây', sortValue: (r) => r.giay, cell: (r) => (r.giay != null ? Math.round(Number(r.giay)) : '—') },
    { key: 'slug', group: 'tt', header: 'Bài', align: 'left', sortValue: (r) => r.slug, cell: (r) => r.url
      ? <a href={wrapExternalUrl(r.url)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={cat(200)}>{r.slug ?? r.url}</a>
      : <span style={cat(200)}>{r.slug ?? '—'}</span> },
    { key: 'gc', group: 'loi', header: '💬', title: 'số ghi chú', sortValue: (r) => r.ghi_chu?.length ?? 0, cell: (r) => (r.ghi_chu?.length ? r.ghi_chu.length : '') },
  ];
  const nhom: DataGroup[] = [{ key: 'tt', label: 'Lượt' }, { key: 'buoc', label: '7 bước máy đi' }, { key: 'loi', label: 'Dừng / lỗi' }];

  // LỖI HAY GẶP: gom bước dừng × nhóm lý do trên các lượt đang lọc (bỏ lượt đã lên) — số lần, số kênh dính, lần cuối, lời gần nhất; bấm = lọc bảng lượt
  type Gom = { khoa: string; bd: string | null; ml: string | null; ket: string; lan: number; kenh: number; cuoi: string; vd: string; dsKenh: string };
  const gom: Gom[] = useMemo(() => {
    const m = new Map<string, { bd: string | null; ml: string | null; ket: string; lan: number; kenh: Set<string>; cuoi: string; vd: string }>();
    for (const r of loc1) {
      if (['dang', 'hen', 'chay'].includes(r.ket) || (!caDung && ['dung', 'bo'].includes(r.ket))) continue;
      const k = `${r.buoc_dung}|${r.ma_ly}`, g = m.get(k) ?? { bd: r.buoc_dung, ml: r.ma_ly, ket: r.ket, lan: 0, kenh: new Set<string>(), cuoi: r.kt ?? r.bd, vd: r.loi ?? '' };
      g.lan += r.lan ?? 1; g.kenh.add(`${r.may_ten} · ${r.nen}`); if ((r.kt ?? r.bd) >= g.cuoi) { g.cuoi = r.kt ?? r.bd; g.vd = r.loi ?? g.vd; } m.set(k, g);
    }
    return [...m].map(([khoa, g]) => ({ khoa, bd: g.bd, ml: g.ml, ket: g.ket, lan: g.lan, kenh: g.kenh.size, cuoi: g.cuoi, vd: g.vd, dsKenh: [...g.kenh].join('\n') }));
  }, [loc1, caDung]);
  const locLoi = (g: Gom) => { setLoc((c) => ({ ...c, bd: g.bd ? [g.bd] : [], ml: g.ml ? [g.ml] : [], kq: [] })); setMd('luot'); };
  const coLoc = LOC.some((k) => loc[k].length) || !!q;

  return <div style={{ display: 'grid', gap: 10 }}>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <Segmented<'luot' | 'loi' | 'may'> value={md} onChange={setMd} hrefFor={(v) => hrefVoi('md', v === 'luot' ? null : v)} options={[
        { value: 'luot', label: 'Lượt đăng', title: 'mỗi dòng một lượt máy đăng xét một kênh × một nền, mới nhất trên đầu, 7 bước thành 7 cột' },
        { value: 'loi', label: 'Lỗi hay gặp', title: 'gom theo bước dừng × nhóm lý do để tập trung sửa — bấm một dòng là lọc ra các lượt đó' },
        { value: 'may', label: 'Máy', title: 'bật / tắt máy, cho nền nghỉ, vòng 10 phút gần nhất, kế hoạch hôm nay' }]} />
      <span style={{ ...nho, color: 'var(--fg-3)' }}>Máy đăng iMac, mỗi 10 phút · phụ trách: Phòng Social Traffic · Pinterest Front Porch (pin-hang) chưa vào sổ · sổ cũ bai_hen (dừng 25/10) và publications (dừng tháng 5) không còn chạy</span>
    </div>
    {md !== 'may' && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      <Segmented<string> options={NGAY} value={ngay} onChange={setNgay} hrefFor={(v) => hrefVoi('md_ngay', v === '3' ? null : v)} />
      <MultiSelect label="Dự án" options={opt.da} selected={loc.da} onChange={(v) => dat('da', v)} compact />
      <MultiSelect label="Kênh" options={opt.km} selected={loc.km} onChange={(v) => dat('km', v)} compact />
      <MultiSelect label="Nền" options={opt.nen} selected={loc.nen} onChange={(v) => dat('nen', v)} compact />
      <MultiSelect label="Tài khoản / profile" options={opt.tk} selected={loc.tk} onChange={(v) => dat('tk', v)} compact />
      <MultiSelect label="Kết quả" options={opt.kq} selected={loc.kq} onChange={(v) => dat('kq', v)} compact />
      <MultiSelect label="Dừng ở bước" options={opt.bd} selected={loc.bd} onChange={(v) => dat('bd', v)} compact />
      <MultiSelect label="Nhóm lý do" options={opt.ml} selected={loc.ml} onChange={(v) => dat('ml', v)} compact />
      <SearchInput value={q} onChange={setQ} placeholder="Tìm bài / lỗi…" width={160} />
      {coLoc && <button type="button" onClick={() => { setLoc(locTrong()); setQ(''); }} style={{ border: 0, background: 'none', color: 'var(--accent, #60a5fa)', cursor: 'pointer', fontSize: 12 }}>bỏ lọc</button>}
      <span style={{ ...nho, color: loi ? 'var(--danger, #dc2626)' : 'var(--fg-3)', marginLeft: 'auto' }}>{loi ? `không đọc được sổ: ${loi}` : tai ? 'đang đọc…' : `${loc1.length} dòng · tự làm mới 5 giây`}</span>
    </div>}
    {md !== 'may' && <StatsStrip cards={the} minColWidth={120} />}
    {md === 'luot' && (loc1.length || tai
      ? <DataTable rows={loc1} columns={cot} groups={nhom} getRowKey={(r) => String(r.id)} persistKey="may-dang-luot" minWidth={1900} pageSize={100}
          defaultSort={[{ key: 'bd', dir: 'desc' }]} onRowClick={moChiTiet}
          rowStyle={(r) => (r.ket === 'hong' || r.ket === 'mat_dau' ? { boxShadow: 'inset 3px 0 0 var(--danger, #dc2626)' } : r.ket === 'chay' ? { boxShadow: 'inset 3px 0 0 var(--info, #3b82f6)' } : undefined)}
          card={{ minWidth: 280, render: (r) => <div onClick={() => moChiTiet(r)} style={{ display: 'grid', gap: 3, padding: 10, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-1)', cursor: 'pointer', fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{gioVn(r.bd)}{r.lan > 1 ? ` ×${r.lan}` : ''}</span><PillKet ket={r.ket} /></div>
            <div style={{ fontWeight: 600 }}>{r.may_ten}</div><Nen nen={r.nen} />
            {r.buoc_dung && <div style={{ color: 'var(--fg-2)' }}>Dừng ở <b>{TEN_BUOC[r.buoc_dung] ?? r.buoc_dung}</b> · {tenLy(r.ma_ly)}</div>}
          </div> }} />
      : <EmptyState icon="📭" title="Không có lượt nào" description={coLoc ? 'Không lượt nào khớp bộ lọc — bỏ bớt lọc hoặc chọn khoảng ngày dài hơn.' : 'Chưa có lượt nào trong khoảng này.'} />)}
    {md === 'loi' && <>
      <label style={{ ...nho, display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={caDung} onChange={(e) => setCaDung(e.target.checked)} />gồm cả dừng đúng luật / bỏ lượt (mặc định chỉ hỏng, mất dấu, kho cạn)</label>
      <DataTable rows={gom} getRowKey={(g) => g.khoa} persistKey="may-dang-loi" minWidth={900} defaultSort={[{ key: 'lan', dir: 'desc' }]} onRowClick={locLoi} card
        columns={[
          { key: 'ml', header: 'Nhóm lý do', align: 'left', sortValue: (g) => tenLy(g.ml), cell: (g) => <b>{tenLy(g.ml)}</b> },
          { key: 'bd', header: 'Bước', align: 'left', sortValue: (g) => g.bd, cell: (g) => (g.bd ? TEN_BUOC[g.bd] ?? g.bd : '—') },
          { key: 'ket', header: 'Loại', align: 'left', sortValue: (g) => g.ket, cell: (g) => <PillKet ket={g.ket} /> },
          { key: 'lan', header: 'Số lần', sortValue: (g) => g.lan, cell: (g) => g.lan },
          { key: 'kenh', header: 'Kênh × nền dính', sortValue: (g) => g.kenh, cell: (g) => <span title={g.dsKenh}>{g.kenh}</span> },
          { key: 'cuoi', header: 'Lần cuối', align: 'left', sortValue: (g) => Date.parse(g.cuoi), cell: (g) => gioVn(g.cuoi) },
          { key: 'vd', header: 'Lời gần nhất', align: 'left', cell: (g) => <span title={g.vd} style={cat(420)}>{g.vd}</span> },
        ]} />
    </>}
    {md === 'may' && <MayDang />}
    {moR && <ChiTiet r={moR} admin={admin} xong={xong} dong={() => modal.close()} />}
  </div>;
}
