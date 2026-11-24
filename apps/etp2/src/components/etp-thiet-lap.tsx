'use client';
// TAB CAMP › ⚙ THIẾT LẬP (anh 24/11/2026): mọi cấu hình của từng camp, đủ cột, chữ không cắt, cột gom nhóm THEO CÁC BƯỚC LÊN CAMP của Etho
// (1 Campaign → 2 Ad set: tối ưu & ngân sách → 3 Ad set: đối tượng & vị trí → 4 Ad: Page & trang đích → 5 Creative: form chữ → 6 Đồng bộ) — sai ở bước nào nhìn ra bước đó.
// Dữ liệu tải khi mở (actions/etp-thiet-lap.ts ← etp.bai_camp.du, apps/etp/bai-qc.py). Ô form chữ so với form chuẩn apps/etp/form-chu.json: ✓ đúng · ✗ lệch.
// Cột VẤN ĐỀ (anh 24/11/2026: "cột duy nhất tổng hợp các vấn đề phát sinh chứ ko chỉ về FORM chữ… hover vào có nút sửa thủ công (=AI)"): gom form chữ lệch,
// Meta từ chối / có vấn đề, đồng bộ lỗi / treo, lỗi Ethopex, camp bật mà ad set / ad tắt, kho chưa đọc. Nút 🛠 gửi card góp ý etp2 → kỹ sư AI Huy (hàng góp ý chung, gop-y-mos2.ts).
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DataTable, type DataColumn, type DataGroup } from '@mos2/bang/data-table';
import { docThietLap, type ThietLap, type DongTl, type OTl, type KeTl } from '@/lib/actions/etp-thiet-lap';
import { guiGopY } from '@/lib/actions/gop-y-mos2';

type CampCo = { camp_id: number };
/** nhóm cột PHỤ mượn từ bảng Camp chính (creative + hiệu suất hiện tại — anh 24/11/2026): DÙNG LẠI cột etp-view (PhimO, soCot), không chép tay */
export type CotThem<T extends CampCo> = { cot: DataColumn<T>[]; nhom: DataGroup[] };
// cột của dòng camp → cột của dòng Thiết lập (nối theo camp_id); camp không có trong danh sách → ô trống
function noiCot<T extends CampCo>(k: DataColumn<T>, lay: (r: DongTl) => T | undefined): DataColumn<DongTl> {
  const trong = <span style={{ color: 'var(--fg-3)' }}>—</span>;
  return { ...k, cell: (r, i) => { const c = lay(r); return c ? k.cell(c, i) : trong; },
    cellTitle: k.cellTitle && ((r, i) => { const c = lay(r); return c ? k.cellTitle!(c, i) : undefined; }),
    onCellClick: k.onCellClick && ((r, i) => { const c = lay(r); if (c) k.onCellClick!(c, i); }),
    sortValue: k.sortValue && ((r) => { const c = lay(r); return c ? k.sortValue!(c) : null; }),
    total: k.total && ((rs, o) => k.total!(rs.map(lay).filter((c): c is T => !!c), o)) };
}
const NHOM_TL: DataGroup[] = [
  { key: 'b1', label: '1 · Campaign', color: '#60a5fa', title: 'Bước 1 lên camp: tài khoản, mục tiêu, cách đặt giá, ngân sách, trạng thái' },
  { key: 'b2', label: '2 · Ad set — tối ưu & ngân sách', color: '#a78bfa', title: 'Bước 2: mục tiêu tối ưu, pixel + sự kiện, ROAS sàn, attribution, giờ chạy' },
  { key: 'b3', label: '3 · Ad set — đối tượng & vị trí', color: '#f472b6', title: 'Bước 3: nước nhắm, nước loại, ngôn ngữ, tuổi / giới, Advantage, nền tảng, vị trí, thiết bị' },
  { key: 'b4', label: '4 · Ad — Page & trang đích', color: '#fbbf24', title: 'Bước 4: Page, tên miền, landing page, final URL, URL tags, mã ad trên Meta' },
  { key: 'b5', label: '5 · Creative — form chữ', color: '#34d399', title: 'Bước 5: Ad type · CTA · Status · Display link · Primary text · Headline · Description — so với form chuẩn apps/etp/form-chu.json' },
  { key: 'b6', label: '6 · Đồng bộ & lỗi', color: '#f87171', title: 'Trạng thái đồng bộ Ethopex ↔ Meta từng cấp + lỗi / cảnh báo' },
];
const gioVn = (iso: string | null) => {
  if (!iso) return null;
  const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso.replace(' ', 'T') : `${iso.replace(' ', 'T')}Z`);
  if (!Number.isFinite(t)) return iso;
  const d = new Date(t + 7 * 3_600_000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

export function ThietLapCamp<T extends CampCo>({ camps, them, moCamp, trangThai, keHoach }: { camps: T[]; hep?: boolean; them?: CotThem<T>; moCamp?: (id: number) => void; trangThai?: (c: T) => { chu: string; mau: string; t: string };
  /** dòng chưa có camp (khối 📝 Đang lên kế hoạch) → camp DỰ KIẾN: chép cấu hình camp khuôn + ô khối đè (anh 25/11/2026) */ keHoach?: (c: T) => Omit<KeTl, 'id'> | null }) {
  const theoId = useMemo(() => new Map(camps.map((c) => [c.camp_id, c])), [camps]);
  const ids = useMemo(() => camps.map((c) => c.camp_id).filter((x) => x > 0), [camps]);
  const keTl = useMemo(() => (keHoach ? camps.filter((c) => c.camp_id < 0).flatMap((c) => { const k = keHoach(c); return k ? [{ ...k, id: c.camp_id }] : []; }) : []), [camps, keHoach]);
  const khoa = `${ids.join(',')}|${JSON.stringify(keTl)}`;
  // dòng Thiết lập → dòng camp của bảng chính (camp dự kiến nối về dòng khối cha)
  const cha = (r: DongTl) => theoId.get(typeof r.ke_cha === 'number' ? r.ke_cha : r.camp_id);
  const [du, setDu] = useState<ThietLap | null>(null), [loi, setLoi] = useState<string | null>(null);
  const [gui, setGui] = useState<Record<number, { dang?: boolean; id?: number; loi?: string }>>({});
  // LỌC THEO MỨC VẤN ĐỀ (anh 24/11/2026 "Nếu đỏ thì show cái đỏ, ko show vàng"): '' = tất cả · do / vang = chỉ camp có mức đó, ô chỉ hiện vấn đề mức đó · khong = camp không vấn đề
  const [muc, setMuc] = useState<'' | 'do' | 'vang' | 'khong'>('');
  // GỌN / ĐỦ (anh 24/11/2026 "Bảng đó còn làm gì cho gọn và giúp tao nắm đc tổng thể"): Gọn = cột giống hệt nhau ở MỌI camp đang hiện gom lên dải "Cấu hình chung",
  // 13 cột trạng thái / đồng bộ gộp thành một ô · Đủ = bảng đủ cột như cũ (lệnh 24/11 "đủ cột, chữ không cắt" — luôn cách một lần bấm)
  const [gon, setGon] = useState(true);
  useEffect(() => { try { if (localStorage.getItem('etp-tl-gon') === '0') setGon(false); } catch { /* không có localStorage: giữ mặc định Gọn */ } }, []);
  const doiGon = (v: boolean) => { setGon(v); try { localStorage.setItem('etp-tl-gon', v ? '1' : '0'); } catch { /* như trên */ } };
  useEffect(() => {
    let bo = false; setLoi(null);
    docThietLap(ids, keTl).then((r) => { if (bo) return; if ('loi' in r) setLoi(r.loi); else setDu(r); }, (e) => { if (!bo) setLoi(String(e?.message ?? e)); });
    return () => { bo = true; };
  }, [khoa]);   // eslint-disable-line react-hooks/exhaustive-deps
  const chu = (v: OTl | undefined): string | null => (v == null ? null : typeof v === 'number' ? (du?.chung[v] ?? null) : v);
  const form = du?.form;
  // ô chữ ĐỦ, xuống dòng (không cắt) — td của bảng để nowrap, div con giữ pre-wrap
  const TRONG = <span style={{ color: 'var(--fg-3)' }}>—</span>;
  const o = (v: OTl | undefined, mau?: string, nho?: boolean): ReactNode => { const s = chu(v); return s == null ? TRONG
    : <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', textAlign: 'left', color: mau, fontSize: nho ? 11 : undefined, lineHeight: nho ? 1.35 : undefined }}>{s}</div>; };
  // so với form chuẩn
  const chuan: Record<string, () => string> = form ? { f_kieu: () => form.creative_type, f_cta: () => form.call_to_action, f_link: () => form.link_url, f_chinh: () => form.primaryTexts.join('\n'), f_tieu: () => form.headlines.join('\n'), f_mo_ta: () => form.descriptions.join('\n') } : {};
  const dungForm = (r: DongTl, k: string) => { const s = chu(r[k]); return !chuan[k] || (s ?? '').trim() === chuan[k]().trim(); };
  // kho CHƯA đọc chữ creative (creative mới gắn, bai-qc.py đọc ở lượt đồng bộ kế) = chưa biết, không phải lệch — so với ô trống thì lần gắn creative nào cũng báo đỏ giả
  const chuaDoc = (r: DongTl) => /^chưa đọc/.test(chu(r.f_nguon) ?? '');
  const loiForm = (r: DongTl) => chuaDoc(r) ? [] : Object.keys(chuan).filter((k) => !dungForm(r, k));
  const oForm = (k: string) => (r: DongTl) => { const cd = chuaDoc(r), ok = cd || dungForm(r, k); return <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
    <b title={cd ? 'kho chưa đọc chữ creative — lượt đồng bộ kế (10 phút) sẽ đọc' : ok ? 'đúng form' : `lệch form — chuẩn: ${chuan[k]?.() ?? ''}`} style={{ color: cd ? 'var(--fg-3)' : ok ? '#4ade80' : '#f87171', flex: 'none' }}>{cd ? '?' : ok ? '✓' : '✗'}</b>{o(r[k], ok ? undefined : '#fca5a5', true)}</div>; };
  // VẤN ĐỀ của một camp — đỏ = hỏng / Meta chặn, vàng = treo / cần xem. PAUSED thường không phải vấn đề.
  // ai=false: vấn đề KHÔNG gửi AI sửa (không nút Sửa (AI), không vào card) — vd ad gắn mẫu trước khi form về: luật 03/11 cấm đổi creative ad Meta chưa từ chối
  type VanDe = { chu: string; do: boolean; ai?: boolean };
  const TEN_FORM: Record<string, string> = { f_kieu: 'Ad type', f_cta: 'CTA', f_link: 'Display link', f_chinh: 'Primary text', f_tieu: 'Headline', f_mo_ta: 'Description' };
  const TT_LOI = /error|fail|reject|disapprov|with_issues/i, TT_TREO = /pending|checking|creating|in_process|review/i;
  const TT_CAP: [string, string][] = [['c_meta', 'Camp trên Meta'], ['c_giao', 'Camp phân phối'], ['g_meta', 'Ad set trên Meta'], ['g_giao', 'Ad set phân phối'], ['a_meta', 'Ad trên Meta'],
    ['a_giao', 'Ad phân phối'], ['s_camp', 'Đồng bộ camp'], ['s_nhom', 'Đồng bộ ad set'], ['s_ad', 'Đồng bộ ad'], ['s_media', 'Media']];
  // PHẢI GIỐNG NHAU ở mọi camp (Fable soát 24/11/2026: chỉ danh sách cố định này, không so số đông mọi cột — cột khác khác nhau là bình thường): lệch số đông = vàng
  const GIONG: [string, string][] = [['c_muc_tieu', 'Mục tiêu'], ['g_pixel', 'Pixel'], ['g_su_kien', 'Sự kiện'], ['g_attr', 'Attribution'], ['g_nuoc', 'Nước nhắm'],
    ['g_loai_nuoc', 'Nước loại'], ['g_vi_tri', 'Vị trí'], ['g_an_toan', 'An toàn thương hiệu']];
  // mục của một danh sách: dòng "Facebook: feed, story" → "Facebook feed", "Facebook story" (cùng tên vị trí ở hai nền không lẫn nhau)
  const mucDs = (s: string) => s.split('\n').flatMap((l) => { const i = l.indexOf(': '); return i > 0 ? l.slice(i + 2).split(', ').map((x) => `${l.slice(0, i)} ${x}`) : l.split(', '); }).map((x) => x.trim()).filter(Boolean);
  // so theo TẬP mục, không theo chuỗi: Vị trí cùng 20 mục mà xếp khác thứ tự trước bị báo lệch oan (4 camp, soát 24/11/2026)
  const tap = (s: string) => [...new Set(mucDs(s))].sort().join('\n');
  const soDong: Record<string, string> = {};
  for (const [k] of GIONG) {
    const dem = new Map<string, number>(); let n = 0;
    for (const r of du?.dong ?? []) { if (r.ke_cha != null) continue;   // camp dự kiến chép khuôn → không được bầu số đông
      const s0 = chu(r[k]), s = s0 == null ? null : tap(s0); if (s != null) { n++; dem.set(s, (dem.get(s) ?? 0) + 1); } }
    const top = [...dem].sort((a, b) => b[1] - a[1])[0];
    if (top && dem.size > 1 && top[1] * 2 > n) soDong[k] = top[0];   // có số đông rõ (> nửa) mới so; chia đôi thì không biết bên nào đúng → không báo
  }
  const ke = (m: string[]) => m.length > 4 ? `${m.slice(0, 4).join(', ')} +${m.length - 4}` : m.join(', ');
  // KHÁC SỐ ĐÔNG = chỉ phần chênh (anh 24/11/2026 lần soát: in cả hai bản thì hai đầu giống hệt nhau, không đọc ra khác ở đâu)
  const chenh = (s: string, d: string) => { const a = mucDs(s), b = mucDs(d), A = new Set(a), B = new Set(b);
    const them = a.filter((x) => !B.has(x)), thieu = b.filter((x) => !A.has(x));
    return them.length || thieu.length ? [them.length ? `thêm ${ke(them)}` : '', thieu.length ? `thiếu ${ke(thieu)}` : ''].filter(Boolean).join(' · ') : ''; };
  const vanDe = (r: DongTl): VanDe[] => {
    const v: VanDe[] = [], thay = new Set<string>();
    if (r.ke_cha != null) { if (r.ke_thieu) v.push({ chu: String(r.ke_thieu), do: true, ai: false }); return v; }   // camp dự kiến: chưa tạo → chưa có gì để chấm
    const them = (chu: string, laDo: boolean, ai = true) => { const k = chu.replace(/^[^:]*:\s*/, '').slice(0, 80); if (!thay.has(k)) { thay.add(k); v.push({ chu, do: laDo, ai }); } };
    const lf = loiForm(r);
    if (chuaDoc(r)) them(`Kho chưa đọc chữ creative #${chu(r.f_cr) ?? '?'} (lượt đồng bộ kế đọc)`, false);
    // chữ cũ = ad gắn mẫu TRƯỚC khi creative về form (Meta giữ bản lúc lên) → ghi chú vàng, giữ nguyên ad đang chạy, không gửi AI (anh 24/11/2026, góp ý #1813);
    // lệch form thật (creative hiện tại sai form) vẫn đỏ. Camp mới: cửa CamLechForm (apps/etp/ethopex_api.py) chặn lên bằng mẫu chưa đúng form.
    if (lf.length && /^chữ cũ/.test(chu(r.f_nguon) ?? '')) them(`Ad gắn mẫu trước khi form về (lệch ${lf.length}/6: ${lf.map((k) => TEN_FORM[k]).join(', ')}) — giữ nguyên ad đang chạy, chữ form áp cho camp lên sau`, false, false);
    else if (lf.length) them(`Form chữ lệch ${lf.length}/6: ${lf.map((k) => TEN_FORM[k]).join(', ')}`, true);
    for (const [k, ten] of TT_CAP) { const s = chu(r[k]); if (s && (TT_LOI.test(s) || TT_TREO.test(s))) them(`${ten}: ${s.toLowerCase().replace(/_/g, ' ')}`, TT_LOI.test(s)); }
    // ad set / ad ADSET_PAUSED khi giờ bắt đầu (start_time UTC không Z, hoặc lịch nhà) còn ở tương lai = đang HẸN GIỜ, không phải vấn đề
    const tuongLai = (x: string | null) => { if (!x) return false; const t = Date.parse(/[zZ]|[+-]\d\d(:?\d\d)?$/.test(x) ? x.replace(' ', 'T') : `${x.replace(' ', 'T')}Z`); return Number.isFinite(t) && t > Date.now(); };
    const henGio = tuongLai(chu(r.g_bat_dau)) || tuongLai(chu(r.g_lich));
    if (!henGio && /^active$/i.test(chu(r.c_tt) ?? '')) for (const [k, ten] of [['g_giao', 'ad set'], ['a_giao', 'ad']] as const) { const s = chu(r[k]); if (s && /paused/i.test(s) && !/campaign_paused/i.test(s)) them(`Camp bật nhưng ${ten} đang tắt (${s.toLowerCase().replace(/_/g, ' ')})`, false); }
    if (chu(r.s_cho)) them('Chờ kích hoạt', false);
    for (const d of (chu(r.s_loi) ?? '').split('\n').filter(Boolean)) them(`Lỗi ${d}`, !/^[^:]*⚠/.test(d));
    if (!r.du_luc) them('Kho chưa đọc cấu hình Ethopex', false);
    for (const [k, ten] of GIONG) { const s = chu(r[k]), d = soDong[k]; if (d != null && s != null && tap(s) !== d) them(`${ten} khác số đông: ${chenh(s, d)}`, false); }
    return v;
  };
  const vanDeHien = (r: DongTl) => vanDe(r).filter((x) => muc === 'do' ? x.do : muc === 'vang' ? !x.do : true);
  const guiAi = async (r: DongTl, v: VanDe[]) => {
    setGui((g) => ({ ...g, [r.camp_id]: { dang: true } }));
    const noiDung = `Thiết lập camp #${r.camp_id} có ${v.length} vấn đề — sửa tận gốc (máy / luật), không bấm tay từng camp:\n${v.map((x) => `- ${x.do ? '[đỏ]' : '[vàng]'} ${x.chu}`).join('\n')}`;
    const nguCanh = [`camp_id=${r.camp_id}`, `tên=${chu(r.c_ten) ?? ''}`, `bộ=${chu(r.c_bo) ?? ''}`, `TK QC=${chu(r.c_tk) ?? ''}`, `campaign Meta=${chu(r.c_ext) ?? ''}`, `creative=${chu(r.f_cr) ?? ''}`, `phim=${chu(r.a_phim) ?? ''}`].join(' · ');
    try {
      const k = await guiGopY({ loai: 'loi', noiDung, trang: window.location.href, anhUrls: [], nguCanh });
      setGui((g) => ({ ...g, [r.camp_id]: k.ok ? { id: k.id } : { loi: k.error ?? 'không rõ lỗi' } }));
    } catch (e) { setGui((g) => ({ ...g, [r.camp_id]: { loi: String((e as Error)?.message ?? e) } })); }
  };
  const oVanDe = (r: DongTl): ReactNode => {
    const v = vanDeHien(r), g = gui[r.camp_id], vAi = v.filter((x) => x.ai !== false);
    return <div className="tl-vd">
      {v.length ? <div className="tl-vd-ds">{v.map((x, i) => <div key={i} title={x.chu} style={{ display: 'flex', gap: 4, alignItems: 'baseline', fontSize: 11, lineHeight: 1.35, color: x.do ? '#fca5a5' : '#fcd34d', whiteSpace: 'normal', wordBreak: 'break-word' }}>
        <i style={{ width: 6, height: 6, borderRadius: 3, background: x.do ? '#f87171' : '#fbbf24', flex: 'none', transform: 'translateY(-1px)' }} />{x.chu.length > 110 ? `${x.chu.slice(0, 110)}…` : x.chu}</div>)}
        {!g?.id && vAi.length ? <button className="tl-sua" disabled={g?.dang} onClick={(e) => { e.stopPropagation(); void guiAi(r, vAi); }}
          title="Gửi các vấn đề này thành card góp ý etp2 → kỹ sư AI (Huy) sửa tận gốc, kết quả trả lời trong hòm 💬">{g?.dang ? '…đang gửi' : '🛠 Sửa (AI)'}</button> : null}</div>
        : <b style={{ color: '#4ade80', fontSize: 11 }}>✓ không có</b>}
      {g?.id ? <div style={{ fontSize: 11, color: '#4ade80', marginTop: 2 }}>✓ đã gửi AI sửa — góp ý #{g.id}</div> : null}
      {g?.loi ? <div style={{ fontSize: 11, color: '#f87171', marginTop: 2, whiteSpace: 'normal' }}>✗ không gửi được: {g.loi}</div> : null}
    </div>;
  };
  // camp MỚI LÊN / MỚI TẠO (tạo trong MOI_GIO giờ) luôn nằm trên cùng, mới nhất trước — bất kể đang sắp theo cột nào (anh 24/11/2026)
  const MOI_GIO = 24;
  const ghimMoi = (r: DongTl) => { const t = Date.parse(chu(r.tao) ?? ''); return Number.isFinite(t) && Date.now() - t < MOI_GIO * 3_600_000 ? t : null; };
  const diemVd = (r: DongTl) => vanDe(r).reduce((s, x) => s + (x.do ? 10 : 1), 0);
  // KIỂU Ô (anh 24/11/2026 "format các cột cho trực quan và gọn"): mỗi cột khai kiểu → cùng một cách hiện cho mọi cột cùng loại
  //  chu = chữ thường · ds = danh sách dài (chữ nhỏ) · ma = mã số (mono, mờ) · tien = $ canh phải · so = số canh phải · tt = trạng thái (chấm màu) · bat = bật/tắt (✓ / ✗) · gio = giờ VN
  type Kieu = 'chu' | 'ds' | 'ma' | 'tien' | 'so' | 'tt' | 'bat' | 'gio';
  const MAU_TT: [RegExp, string][] = [[/error|fail|reject|disapprov|lỗi|deleted|archived/i, '#f87171'], [/pending|progress|review|chờ|learning|limited/i, '#fbbf24'],
    [/^(active|enabled|ok|synced|success|delivering|ready|on|live)$/i, '#4ade80'], [/paus|off|inactive|not_deliver|tắt/i, '#9ca3af']];
  const oTt = (s: string) => { const m = MAU_TT.find(([re]) => re.test(s))?.[1] ?? 'var(--fg-2)';
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, whiteSpace: 'nowrap' }}><i style={{ width: 6, height: 6, borderRadius: 3, background: m, flex: 'none' }} />{s.toLowerCase().replace(/_/g, ' ')}</span>; };
  const ve = (kieu: Kieu, s: string | null): ReactNode => {
    if (s == null) return TRONG;
    if (kieu === 'ma') return <span style={{ fontFamily: 'var(--font-mono, ui-monospace, monospace)', fontSize: 10.5, color: 'var(--fg-2)' }}>{s}</span>;
    if (kieu === 'tien') return <span style={{ fontVariantNumeric: 'tabular-nums' }}>${s}</span>;
    if (kieu === 'so') return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{s}</span>;
    if (kieu === 'tt') return oTt(s);
    if (kieu === 'bat') return /^(bật|true)$/i.test(s) ? <b style={{ color: '#4ade80' }}>✓</b> : /^(tắt|false|không)$/i.test(s) ? <span style={{ color: 'var(--fg-3)' }}>✗</span> : <span style={{ fontSize: 11 }}>{s}</span>;
    if (kieu === 'gio') return <span style={{ fontSize: 11, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{gioVn(s)}</span>;
    if (kieu === 'ds') { const m = mucDs(s);
      // DANH SÁCH DÀI THU GỌN (anh 24/11/2026 "Thu gọn dạng collapsed. Chỉ hiện 1 vài cái đại diện"): > GON_TRAN mục → GON_HIEN mục đầu + "+N", bấm mở / gập.
      // đếm theo MỤC chứ không theo dòng: Vị trí chỉ 4 dòng (mỗi nền một dòng) mà 20 mục → trước không gập, ô cao 148px, cả bảng chỉ thấy 3 hàng
      if (m.length > GON_TRAN) return <details className="tl-gon" onClick={(e) => e.stopPropagation()} title={s}>
        <summary style={{ cursor: 'pointer', listStyle: 'none', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.slice(0, GON_HIEN).join(', ')} <b style={{ color: 'var(--accent, #f472b6)', fontWeight: 600 }}>+{m.length - GON_HIEN}</b></summary>
        {o(s, undefined, true)}</details>; }
    return o(s, undefined, kieu === 'ds');
  };
  const GON_TRAN = 6, GON_HIEN = 4;
  // bề rộng SÁT tên hoặc nội dung (anh 24/11/2026 "thu gọn cho sát với tên hoặc nội dung"): max(nội dung ước, tiêu đề) — tên dài nằm ở dải nhóm + hover, tiêu đề cột ngắn
  const rongCot = (header: string, rong: number) => Math.round(Math.max(rong + 16, header.length * 7 + 26));
  const PHAI: Kieu[] = ['tien', 'so'];
  const C = (key: string, group: string, header: string, rong = 90, title?: string, kieu: Kieu = 'chu'): DataColumn<DongTl> =>
    ({ key, group, header, title: title ?? header, align: PHAI.includes(kieu) ? 'right' : 'left', width: rongCot(header, rong), cell: (r) => ve(kieu, chu(r[key])),
      sortValue: (r) => { const s = chu(r[key]); return PHAI.includes(kieu) && s != null && Number.isFinite(Number(s)) ? Number(s) : s ?? ''; } });
  const G = (key: string, group: string, header: string, title?: string): DataColumn<DongTl> => C(key, group, header, 72, title, 'gio');
  const ff = (k: string, header: string, rong: number, title?: string): DataColumn<DongTl> => ({ ...C(k, 'b5', header, rong, title), cell: oForm(k) });
  const cotNay = (them?.cot ?? []).filter((k) => k.group === 'ngay');   // nhóm 7 ngày gần nhất (useCotNgay của Cây, #1819)
  const soMuc = { do: 0, vang: 0, khong: 0 };
  for (const r of du?.dong ?? []) { const v = vanDe(r); if (v.some((x) => x.do)) soMuc.do++; if (v.some((x) => !x.do)) soMuc.vang++; if (!v.length) soMuc.khong++; }
  const cot: DataColumn<DongTl>[] = [
    // #1831 anh "Show trạng thái của camp": chữ trạng thái ngay dưới số camp — đọc CHUNG hàm ttCamp của cây / bảng camp (truyền vào qua trangThai), chi tiết gập vào chữ rê
    { key: 'camp_id', header: 'Camp', align: 'left', width: 80, cell: (r) => { const c = cha(r), x = c && trangThai ? trangThai(c) : null;
      if (r.ke_cha != null) return <span data-o="tl-ke-hoach" style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }} title={`camp dự kiến ${r.ke_thu} của phim — chưa tạo. Máy nhân bản camp khuôn #${r.ke_khuon} (giữ cấu hình bên dưới), đè ROAS · ngân sách · giờ · bộ · creative mới theo mẫu của khối`}>
        <b style={{ color: '#38bdf8', whiteSpace: 'nowrap' }}>📝 {r.ke_thu}</b><span style={{ fontSize: 11, color: '#38bdf8', whiteSpace: 'nowrap' }}>Đang lên kế hoạch</span>
        <span onClick={moCamp ? (e) => { e.stopPropagation(); moCamp(Number(r.ke_khuon)); } : undefined} style={{ fontSize: 10.5, color: 'var(--fg-3)', whiteSpace: 'nowrap', cursor: moCamp ? 'pointer' : undefined, textDecoration: moCamp ? 'underline dotted' : undefined }}>chép #{r.ke_khuon}</span></span>;
      return <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}><b data-nut="mo-camp" onClick={moCamp ? (e) => { e.stopPropagation(); moCamp(r.camp_id); } : undefined} title={moCamp ? `Mở chi tiết camp #${r.camp_id}` : undefined}
      style={moCamp ? { cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 } : undefined}>#{r.camp_id}</b>
      {x ? <span data-tt-camp title={x.t} style={{ fontSize: 11, color: x.mau, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'help' }}>{x.chu}</span> : null}</span>; },
      sortValue: (r) => r.camp_id },
    { key: 'van_de', header: <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>Vấn đề<select value={muc} onClick={(e) => e.stopPropagation()} onChange={(e) => setMuc(e.target.value as typeof muc)}
        title="lọc theo mức vấn đề" style={{ fontSize: 10.5, padding: '0 2px', background: 'var(--bg-2, #1f1f2e)', color: muc === 'do' ? '#f87171' : muc === 'vang' ? '#fbbf24' : muc === 'khong' ? '#4ade80' : 'var(--fg-2)', border: '1px solid var(--line, #333)', borderRadius: 4 }}>
        <option value="">tất cả</option><option value="do">● đỏ ({soMuc.do})</option><option value="vang">● vàng ({soMuc.vang})</option><option value="khong">✓ không ({soMuc.khong})</option></select></span>, width: 230, align: 'left', sortValue: diemVd, cell: oVanDe,
      title: 'mọi vấn đề phát sinh của camp: form chữ lệch, Meta từ chối / có vấn đề, đồng bộ lỗi / treo, lỗi Ethopex, camp bật mà ad set / ad tắt, kho chưa đọc — rê chuột: 🛠 Sửa (AI)' },
    // hiệu suất 7 NGÀY GẦN NHẤT (6 ngày đã khép + nay, chính dải ngày của Cây) đứng ngay sau Vấn đề, KHÔNG ghim (anh 24/11/2026: ghim cả 7 ngày che hết bảng) — thay nhóm Hôm nay / Hôm qua (anh 24/11/2026 #1819); phần còn lại (phim, kỳ) theo sau
    ...cotNay.map((k) => noiCot(k, cha)),
    ...(them?.cot ?? []).filter((k) => !cotNay.includes(k)).map((k) => noiCot(k, cha)),
    C('c_ten', 'b1', 'Tên camp', 230), C('c_bo', 'b1', 'Bộ', 16, 'bộ tài khoản', 'so'), C('c_tk', 'b1', 'TK QC', 110, 'mã tài khoản quảng cáo Meta', 'ma'), C('c_ext', 'b1', 'ID Meta', 110, 'mã campaign trên Meta', 'ma'),
    C('c_muc_tieu', 'b1', 'Mục tiêu', 100, 'objective', 'ds'), C('c_mua', 'b1', 'Mua', 60, 'buying type', 'ds'), C('c_gia', 'b1', 'Đặt giá', 130, 'bid strategy', 'ds'),
    C('c_ns', 'b1', 'NS/ngày', 30, 'ngân sách ngày $', 'tien'), C('c_ns_tron', 'b1', 'NS trọn', 30, 'ngân sách trọn đời $', 'tien'), C('c_ns_chia', 'b1', 'Chia NS', 20, 'chia ngân sách cho ad set', 'bat'),
    C('c_dac_biet', 'b1', 'HM đặc biệt', 50, 'hạng mục quảng cáo đặc biệt', 'ds'), C('c_dsa', 'b1', 'DSA', 130, 'DSA người hưởng / người trả', 'ds'),
    C('c_tt', 'b1', 'TT', 56, 'trạng thái camp (kho)', 'tt'), C('c_meta', 'b1', 'Meta', 56, 'trạng thái trên Meta', 'tt'), C('c_giao', 'b1', 'Phân phối', 70, 'delivery', 'tt'), G('tao', 'b1', 'Tạo', 'tạo lúc (giờ VN)'),
    C('g_ten', 'b2', 'Tên ad set', 200, undefined, 'ds'), C('g_toi_uu', 'b2', 'Tối ưu', 70, 'optimization goal', 'ds'), C('g_tinh_phi', 'b2', 'Tính phí', 70, 'billing event', 'ds'), C('g_dich', 'b2', 'Đích', 60, 'destination type', 'ds'),
    C('g_su_kien', 'b2', 'Sự kiện', 60, 'custom event', 'ds'), C('g_pixel', 'b2', 'Pixel', 110, undefined, 'ma'), C('g_roas', 'b2', 'ROAS sàn', 30, undefined, 'so'), C('g_ns', 'b2', 'NS', 30, 'ngân sách ad set $', 'tien'),
    C('g_attr', 'b2', 'Attribution', 150, undefined, 'ds'), G('g_bat_dau', 'b2', 'Bắt đầu', 'giờ VN'), G('g_ket_thuc', 'b2', 'Kết thúc', 'giờ VN'), C('g_lich', 'b2', 'Lịch', 70, 'lịch giờ nhà', 'ds'),
    C('g_so_nuoc', 'b3', 'Nước', 20, 'số nước nhắm', 'so'), C('g_nuoc', 'b3', 'Nước nhắm', 130, undefined, 'ds'), C('g_kieu_vt', 'b3', 'Kiểu VT', 70, 'kiểu vị trí', 'ds'),
    C('g_so_loai', 'b3', 'Loại', 20, 'số nước loại', 'so'), C('g_loai_nuoc', 'b3', 'Nước loại', 130, undefined, 'ds'),
    C('g_ngon_ngu', 'b3', 'Ngôn ngữ', 50, 'mã ngôn ngữ', 'ds'), C('g_tuoi', 'b3', 'Tuổi', 40, undefined, 'so'), C('g_gioi', 'b3', 'Giới', 24, undefined, 'ds'), C('g_adv', 'b3', 'Adv+', 20, 'Advantage+ đối tượng', 'bat'),
    C('g_nen', 'b3', 'Nền tảng', 150, undefined, 'ds'), C('g_vi_tri', 'b3', 'Vị trí', 280, undefined, 'ds'), C('g_thiet_bi', 'b3', 'Thiết bị', 80, undefined, 'ds'), C('g_an_toan', 'b3', 'An toàn', 120, 'lọc an toàn thương hiệu', 'ds'),
    C('g_vung_qd', 'b3', 'Vùng QĐ', 110, 'vùng có quy định', 'ds'), C('g_ext', 'b3', 'ID ad set', 110, 'mã ad set trên Meta', 'ma'), C('g_meta', 'b3', 'Meta', 56, 'ad set trên Meta', 'tt'), C('g_giao', 'b3', 'Phân phối', 70, 'ad set phân phối', 'tt'),
    C('a_page_ten', 'b4', 'Page', 120), C('a_page', 'b4', 'ID Page', 100, undefined, 'ma'), C('a_mien', 'b4', 'Tên miền', 80, undefined, 'ds'), C('a_lp', 'b4', 'LP', 40, 'landing page', 'ma'), C('a_phim', 'b4', 'Phim', 40, 'content id', 'ma'),
    C('a_url', 'b4', 'Final URL', 260, undefined, 'ds'), C('a_tags', 'b4', 'URL tags', 220, undefined, 'ds'), C('a_bai_co', 'b4', 'Bài sẵn', 20, 'dùng bài có sẵn', 'bat'), C('a_bai', 'b4', 'Mã bài', 130, undefined, 'ma'),
    C('a_ext', 'b4', 'ID ad', 110, 'mã ad trên Meta', 'ma'), C('a_ext_cr', 'b4', 'ID creative', 110, 'mã creative trên Meta', 'ma'), C('a_video', 'b4', 'ID video', 110, 'mã video trên Meta', 'ma'),
    C('a_meta', 'b4', 'Meta', 56, 'ad trên Meta', 'tt'), C('a_giao', 'b4', 'Phân phối', 70, 'ad phân phối', 'tt'),
    C('f_cr', 'b5', 'Creative', 44, undefined, 'ma'), ff('f_kieu', 'Ad type', 70), ff('f_cta', 'CTA', 70), C('f_tt', 'b5', 'Status', 56, undefined, 'tt'), ff('f_link', 'Display link', 80),
    ff('f_chinh', 'Primary text', 300), ff('f_tieu', 'Headline', 180), ff('f_mo_ta', 'Description', 130),
    C('f_nguon', 'b5', 'Chữ lấy từ', 160, 'ad trên Meta giữ bản creative lúc lên — creative đưa về form SAU khi camp lên thì ad vẫn chạy chữ cũ', 'ds'),
    C('s_camp', 'b6', 'Camp', 50, 'đồng bộ camp', 'tt'), C('s_nhom', 'b6', 'Ad set', 50, 'đồng bộ ad set', 'tt'), C('s_ad', 'b6', 'Ad', 50, 'đồng bộ ad', 'tt'), C('s_media', 'b6', 'Media', 50, undefined, 'tt'),
    C('s_cho', 'b6', 'Chờ', 70, 'chờ kích hoạt', 'tt'), C('s_loi', 'b6', 'Lỗi / cảnh báo', 240, undefined, 'ds'), G('s_dong_bo_luc', 'b6', 'Đồng bộ', 'Ethopex đồng bộ lúc (giờ VN)'), G('du_luc', 'b6', 'Kho đọc', 'kho đọc cấu hình lúc (giờ VN)'),
  ];
  // Ô TRẠNG THÁI GỘP (chế độ Gọn): 13 cột trạng thái / đồng bộ → một ô; ổn hết = một chấm xanh, không thì chỉ liệt kê cấp đang không ổn
  const TT_GOP: [string, string][] = [['c_tt', 'Camp (kho)'], ...TT_CAP.slice(0, 6), ['f_tt', 'Creative'], ...TT_CAP.slice(6), ['s_cho', 'Chờ kích hoạt']];
  const XANH = /^(active|enabled|ok|synced|success|delivering|ready|on|live|done|completed)$/i;
  const ttXau = (r: DongTl) => TT_GOP.map(([k, ten]) => [ten, chu(r[k])] as const).filter(([, s]) => s != null && !XANH.test(s));
  const cotTt: DataColumn<DongTl> = { key: 'tt_gop', group: 'b6', header: 'Trạng thái', align: 'left', width: 190, sortValue: (r) => ttXau(r).length,
    title: `gộp ${TT_GOP.length} cột: ${TT_GOP.map((x) => x[1]).join(' · ')} — chế độ Đủ để xem từng cột`,
    cell: (r) => { const x = ttXau(r); return x.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>{x.map(([ten, s]) => <span key={ten} style={{ display: 'flex', gap: 4, fontSize: 11 }}><span style={{ color: 'var(--fg-3)' }}>{ten}</span>{oTt(s!)}</span>)}</div>
      : <span style={{ fontSize: 11 }}>{oTt('active')}<span style={{ color: 'var(--fg-3)', marginLeft: 4 }}>mọi cấp</span></span>; } };
  if (loi) return <div style={{ margin: 12, padding: '10px 12px', border: '1px solid #f87171', borderRadius: 6, color: '#fca5a5', fontSize: 12 }}>Không tải được Thiết lập: {loi}</div>;
  if (!du) return <div style={{ padding: 24, color: 'var(--fg-2)', fontSize: 12 }}>Đang tải thiết lập {ids.length} camp…</div>;
  const chuCu = (r: DongTl) => /^chữ cũ/.test(chu(r.f_nguon) ?? '');
  const lech = du.dong.filter((r) => loiForm(r).length && !chuCu(r)).length, soCu = du.dong.filter((r) => loiForm(r).length && chuCu(r)).length, coVd = du.dong.filter((r) => vanDe(r).length).length, coDo = du.dong.filter((r) => vanDe(r).some((x) => x.do)).length;
  const dongLoc = muc ? du.dong.filter((r) => { const v = vanDe(r); return muc === 'khong' ? !v.length : muc === 'do' ? v.some((x) => x.do) : v.some((x) => !x.do); }) : du.dong;
  // CỘT CHUNG (chế độ Gọn): cột cấu hình (bước 1–6) có CÙNG một giá trị ở 100% camp đang hiện → lên dải "Cấu hình chung", bỏ khỏi bảng. Ngưỡng 100% (không 90%):
  // cột không nhảy ra vào khi một camp đổi, và camp lệch vẫn nằm trong bảng. Tên camp / cột mượn bảng Camp không bao giờ gom.
  const boGop = new Set(TT_GOP.map((x) => x[0]));
  const chung = gon && dongLoc.length > 1 ? cot.filter((c) => /^b[1-6]$/.test(c.group ?? '') && c.key !== 'c_ten' && !boGop.has(c.key)
    && dongLoc.every((r) => chu(r[c.key]) === chu(dongLoc[0]![c.key]))) : [];
  const boChung = new Set(chung.map((c) => c.key));
  const cotHien = gon ? [...cot.filter((c) => !boChung.has(c.key) && !boGop.has(c.key)), cotTt] : cot;
  const nutGon = (v: boolean, nhan: string, title: string) => <button onClick={() => doiGon(v)} title={title} style={{ fontSize: 11, padding: '1px 9px', cursor: 'pointer', border: '1px solid var(--line, #333)',
    background: gon === v ? 'var(--accent, #f472b6)' : 'transparent', color: gon === v ? '#111' : 'var(--fg-2)', fontWeight: gon === v ? 700 : 400, borderRadius: v ? '4px 0 0 4px' : '0 4px 4px 0' }}>{nhan}</button>;
  return <>
    <div style={{ fontSize: 11.5, color: 'var(--fg-2)', margin: '6px 0 4px', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
      <span style={{ display: 'inline-flex' }}>{nutGon(true, 'Gọn', 'gom cột giống nhau ở mọi camp lên dải Cấu hình chung + gộp 13 cột trạng thái thành một ô')}{nutGon(false, 'Đủ', 'đủ mọi cột như bảng gốc')}</span>
      <span>{du.dong.length} camp theo lọc ở trên</span>
      <span style={{ color: coDo ? '#f87171' : coVd ? '#fbbf24' : '#4ade80' }}>{coVd ? `✗ ${coVd} camp có vấn đề (${coDo} đỏ) · ${lech} lệch form chữ${soCu ? ` · ${soCu} ad gắn mẫu trước khi form về (giữ nguyên)` : ''}` : '✓ không camp nào có vấn đề'}</span>
      <style>{'.tl-vd{position:relative;min-height:16px}.tl-vd .tl-sua{display:none;position:absolute;top:-2px;right:-4px;font-size:11px;padding:1px 7px;border-radius:4px;border:1px solid #f59e0b;background:#422006;color:#fde68a;cursor:pointer}.tl-vd-ds{position:relative}.tl-vd-ds:hover .tl-sua{display:inline-block}.tl-vd .tl-sua:disabled{opacity:.6;cursor:wait}.tl-gon summary::-webkit-details-marker{display:none}.tl-gon[open] summary b{display:none}'}</style>
      {du.thieu ? <span style={{ color: '#fbbf24' }}>{du.thieu} camp kho chưa đọc cấu hình Ethopex (bai-qc.py đọc dần mỗi lượt đồng bộ)</span> : null}
      <span style={{ cursor: 'help', borderBottom: '1px dotted var(--fg-3)' }} title={`Primary text: ${form?.primaryTexts.join(' / ')}\nHeadline: ${form?.headlines.join(' / ')}\nDescription: ${form?.descriptions.join(' / ')}`}>Form chuẩn: {form?.creative_type} · {form?.call_to_action} · {form?.link_url}</span>
    </div>
    {/* DẢI CẤU HÌNH CHUNG (anh #1816 "Cần dễ nhìn hơn"): MỘT HÀNG MỖI BƯỚC — cột trái tên bước (màu nhóm như tiêu đề nhóm của bảng, thẳng cột), cột phải các cặp
        nhãn mờ · giá trị sáng cách nhau rộng; bỏ hộp chip + viền màu từng ô (cầu vồng trang trí); câu giải thích gập vào chữ rê. */}
    {gon && chung.length ? <div className="tl-chung" style={{ fontSize: 12, margin: '0 0 8px', padding: '6px 10px', border: '1px solid var(--line, #333)', borderRadius: 6, background: 'var(--bg-2, #16161f)' }}>
      <div style={{ color: 'var(--fg-2)', marginBottom: 4 }} title={`${chung.length} cột có cùng một giá trị ở cả ${dongLoc.length} camp đang hiện nên đã gom khỏi bảng — bấm Đủ để xem lại từng cột`}><b style={{ color: 'var(--fg-1)' }}>Cấu hình chung</b> <span style={{ color: 'var(--fg-3)' }}>· giống nhau ở cả {dongLoc.length} camp</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 14 }}>{NHOM_TL.map((g) => { const ds = chung.filter((c) => c.group === g.key); return ds.length ? <Fragment key={g.key}>
        <span data-cot="buoc" title={g.title} style={{ color: g.color, fontWeight: 600, whiteSpace: 'nowrap', padding: '4px 0', borderTop: '1px solid var(--line, #2a2a35)' }}>{g.label}</span>
        <div data-cot="muc" style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 20px', padding: '4px 0', borderTop: '1px solid var(--line, #2a2a35)' }}>{ds.map((c) => {
          const s = chu(dongLoc[0]![c.key]);
          return <span key={c.key} title={typeof c.title === 'string' ? c.title : undefined} style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline', maxWidth: '100%' }}>
            <span style={{ color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{typeof c.header === 'string' ? c.header : c.key}</span>
            <span style={{ color: 'var(--fg-1)', fontWeight: 500, whiteSpace: 'normal', wordBreak: 'break-word' }}>{s == null ? '—' : c.cell(dongLoc[0]!, 0)}</span></span>; })}</div>
      </Fragment> : null; })}</div>
    </div> : null}
    <DataTable rows={dongLoc} columns={cotHien} groups={[...(them?.nhom ?? []), ...NHOM_TL]} groupHeader getRowKey={(r) => String(r.camp_id)} persistKey={gon ? 'etp-thiet-lap-gon' : 'etp-thiet-lap-2'} fixedLayout cuonNgang minWidth={0} pageSize={50}
      defaultSort={[{ key: 'tao', dir: 'desc' }]} ghimDau={ghimMoi} stickyCols={2}
      searchText={(r) => Object.values(r).map((v) => chu(v as OTl) ?? '').join(' ')} searchPlaceholder="Tìm camp, Page, nước, chữ QC…" />
  </>;
}
