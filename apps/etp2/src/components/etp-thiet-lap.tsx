'use client';
// TAB CAMP › ⚙ THIẾT LẬP (anh 24/11/2026): mọi cấu hình của từng camp, đủ cột, chữ không cắt, cột gom nhóm THEO CÁC BƯỚC LÊN CAMP của Etho
// (1 Campaign → 2 Ad set: tối ưu & ngân sách → 3 Ad set: đối tượng & vị trí → 4 Ad: Page & trang đích → 5 Creative: form chữ → 6 Đồng bộ) — sai ở bước nào nhìn ra bước đó.
// Dữ liệu tải khi mở (actions/etp-thiet-lap.ts ← etp.bai_camp.du, apps/etp/bai-qc.py). Ô form chữ so với form chuẩn apps/etp/form-chu.json: ✓ đúng · ✗ lệch.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DataTable, type DataColumn, type DataGroup } from '@mos2/bang/data-table';
import { docThietLap, type ThietLap, type DongTl, type OTl } from '@/lib/actions/etp-thiet-lap';

type CampCo = { camp_id: number };
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

export function ThietLapCamp({ camps, hep }: { camps: CampCo[]; hep?: boolean }) {
  const ids = useMemo(() => camps.map((c) => c.camp_id).filter((x) => x > 0), [camps]);
  const khoa = ids.join(',');
  const [du, setDu] = useState<ThietLap | null>(null), [loi, setLoi] = useState<string | null>(null);
  useEffect(() => {
    let bo = false; setLoi(null);
    docThietLap(ids).then((r) => { if (bo) return; if ('loi' in r) setLoi(r.loi); else setDu(r); }, (e) => { if (!bo) setLoi(String(e?.message ?? e)); });
    return () => { bo = true; };
  }, [khoa]);   // eslint-disable-line react-hooks/exhaustive-deps
  const chu = (v: OTl | undefined): string | null => (v == null ? null : typeof v === 'number' ? (du?.chung[v] ?? null) : v);
  const form = du?.form;
  // ô chữ ĐỦ, xuống dòng (không cắt) — td của bảng để nowrap, div con giữ pre-wrap
  const o = (v: OTl | undefined, rong = 120, mau?: string): ReactNode => { const s = chu(v); return s == null ? <span style={{ color: 'var(--fg-3)' }}>—</span>
    : <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', minWidth: rong, maxWidth: Math.max(rong, 360), textAlign: 'left', color: mau, fontFamily: 'var(--font-sans, inherit)' }}>{s}</div>; };
  // so với form chuẩn
  const chuan: Record<string, () => string> = form ? { f_kieu: () => form.creative_type, f_cta: () => form.call_to_action, f_link: () => form.link_url, f_chinh: () => form.primaryTexts.join('\n'), f_tieu: () => form.headlines.join('\n'), f_mo_ta: () => form.descriptions.join('\n') } : {};
  const dungForm = (r: DongTl, k: string) => { const s = chu(r[k]); return !chuan[k] || (s ?? '').trim() === chuan[k]().trim(); };
  const loiForm = (r: DongTl) => Object.keys(chuan).filter((k) => !dungForm(r, k));
  const oForm = (k: string, rong: number) => (r: DongTl) => { const ok = dungForm(r, k); return <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
    <b title={ok ? 'đúng form' : `lệch form — chuẩn: ${chuan[k]?.() ?? ''}`} style={{ color: ok ? '#4ade80' : '#f87171', flex: 'none' }}>{ok ? '✓' : '✗'}</b>{o(r[k], rong, ok ? undefined : '#fca5a5')}</div>; };
  const C = (key: string, group: string, header: string, rong = 110, title?: string): DataColumn<DongTl> =>
    ({ key, group, header, title: title ?? header, align: 'left', cell: (r) => o(r[key], rong), sortValue: (r) => chu(r[key]) ?? '' });
  const G = (key: string, group: string, header: string, rong = 110, title?: string): DataColumn<DongTl> =>
    ({ ...C(key, group, header, rong, title), cell: (r) => o(gioVn(chu(r[key])), rong) });
  const cot: DataColumn<DongTl>[] = [
    { key: 'camp_id', header: 'Camp', align: 'left', cell: (r) => <b>#{r.camp_id}</b>, sortValue: (r) => r.camp_id },
    { key: 'form', header: 'Form chữ', title: 'so 6 ô chữ với form chuẩn (apps/etp/form-chu.json)', align: 'left', sortValue: (r) => loiForm(r).length,
      cell: (r) => { const l = loiForm(r); return l.length ? <b style={{ color: '#f87171' }}>✗ lệch {l.length}/6</b> : <b style={{ color: '#4ade80' }}>✓ đúng</b>; } },
    C('c_ten', 'b1', 'Tên camp', 260), C('c_bo', 'b1', 'Bộ', 30), C('c_tk', 'b1', 'TK QC', 130, 'mã tài khoản quảng cáo Meta'), C('c_ext', 'b1', 'Mã camp Meta', 150),
    C('c_muc_tieu', 'b1', 'Mục tiêu', 110, 'objective'), C('c_mua', 'b1', 'Kiểu mua', 70, 'buying type'), C('c_gia', 'b1', 'Đặt giá', 180, 'bid strategy'),
    C('c_ns', 'b1', 'NS ngày $', 50), C('c_ns_tron', 'b1', 'NS trọn $', 50), C('c_ns_chia', 'b1', 'Chia NS ad set', 60), C('c_dac_biet', 'b1', 'Hạng mục đặc biệt', 80),
    C('c_dsa', 'b1', 'DSA hưởng / trả', 160), C('c_tt', 'b1', 'Trạng thái', 60), C('c_meta', 'b1', 'Trên Meta', 60), C('c_giao', 'b1', 'Phân phối', 70), G('tao', 'b1', 'Tạo lúc (VN)', 80),
    C('g_ten', 'b2', 'Tên ad set', 260), C('g_toi_uu', 'b2', 'Tối ưu cho', 70, 'optimization goal'), C('g_tinh_phi', 'b2', 'Tính phí theo', 90, 'billing event'), C('g_dich', 'b2', 'Đích', 70, 'destination type'),
    C('g_su_kien', 'b2', 'Sự kiện', 70), C('g_pixel', 'b2', 'Pixel', 130), C('g_roas', 'b2', 'ROAS sàn', 50), C('g_ns', 'b2', 'NS ad set $', 50),
    C('g_attr', 'b2', 'Attribution', 200), G('g_bat_dau', 'b2', 'Bắt đầu (VN)', 80), G('g_ket_thuc', 'b2', 'Kết thúc (VN)', 80), C('g_lich', 'b2', 'Lịch giờ nhà', 90),
    C('g_so_nuoc', 'b3', 'Số nước', 40), C('g_nuoc', 'b3', 'Nước nhắm', 300), C('g_kieu_vt', 'b3', 'Kiểu vị trí', 80), C('g_so_loai', 'b3', 'Số nước loại', 40), C('g_loai_nuoc', 'b3', 'Nước loại', 300),
    C('g_ngon_ngu', 'b3', 'Ngôn ngữ (mã)', 60), C('g_tuoi', 'b3', 'Tuổi', 50), C('g_gioi', 'b3', 'Giới', 40), C('g_adv', 'b3', 'Advantage+ đối tượng', 60),
    C('g_nen', 'b3', 'Nền tảng', 200), C('g_vi_tri', 'b3', 'Vị trí', 320), C('g_thiet_bi', 'b3', 'Thiết bị', 100), C('g_an_toan', 'b3', 'Lọc an toàn', 160), C('g_vung_qd', 'b3', 'Vùng quy định', 160),
    C('g_ext', 'b3', 'Mã ad set Meta', 150), C('g_meta', 'b3', 'Ad set trên Meta', 60), C('g_giao', 'b3', 'Ad set phân phối', 70),
    C('a_page_ten', 'b4', 'Page', 140), C('a_page', 'b4', 'Mã Page', 90), C('a_mien', 'b4', 'Tên miền', 90), C('a_lp', 'b4', 'Landing page', 60), C('a_phim', 'b4', 'Phim (content)', 60),
    C('a_url', 'b4', 'Final URL', 360), C('a_tags', 'b4', 'URL tags', 300), C('a_bai_co', 'b4', 'Bài có sẵn', 50), C('a_bai', 'b4', 'Mã bài', 150),
    C('a_ext', 'b4', 'Mã ad Meta', 150), C('a_ext_cr', 'b4', 'Mã creative Meta', 140), C('a_video', 'b4', 'Mã video Meta', 140), C('a_meta', 'b4', 'Ad trên Meta', 60), C('a_giao', 'b4', 'Ad phân phối', 70),
    C('f_cr', 'b5', 'Creative', 60), { ...C('f_kieu', 'b5', 'Ad type', 90), cell: oForm('f_kieu', 90) }, { ...C('f_cta', 'b5', 'CTA', 90), cell: oForm('f_cta', 90) },
    C('f_tt', 'b5', 'Status', 60), { ...C('f_link', 'b5', 'Display link', 90), cell: oForm('f_link', 90) },
    { ...C('f_chinh', 'b5', 'Primary text', 300), cell: oForm('f_chinh', 300) }, { ...C('f_tieu', 'b5', 'Headline', 220), cell: oForm('f_tieu', 220) },
    { ...C('f_mo_ta', 'b5', 'Description', 160), cell: oForm('f_mo_ta', 160) }, C('f_nguon', 'b5', 'Chữ lấy từ', 200, 'ad trên Meta giữ bản creative lúc lên — creative đưa về form SAU khi camp lên thì ad vẫn chạy chữ cũ'),
    C('s_camp', 'b6', 'Camp', 50), C('s_nhom', 'b6', 'Ad set', 50), C('s_ad', 'b6', 'Ad', 50), C('s_media', 'b6', 'Media', 50), C('s_cho', 'b6', 'Chờ kích hoạt', 70),
    C('s_loi', 'b6', 'Lỗi / cảnh báo', 300), G('s_dong_bo_luc', 'b6', 'Ethopex đồng bộ (VN)', 80), G('du_luc', 'b6', 'Kho đọc lúc (VN)', 80),
  ];
  if (loi) return <div style={{ margin: 12, padding: '10px 12px', border: '1px solid #f87171', borderRadius: 6, color: '#fca5a5', fontSize: 12 }}>Không tải được Thiết lập: {loi}</div>;
  if (!du) return <div style={{ padding: 24, color: 'var(--fg-2)', fontSize: 12 }}>Đang tải thiết lập {ids.length} camp…</div>;
  const lech = du.dong.filter((r) => loiForm(r).length).length;
  return <>
    <div style={{ fontSize: 11.5, color: 'var(--fg-2)', margin: '6px 0 4px', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
      <span>{du.dong.length} camp theo lọc ở trên</span>
      <span style={{ color: lech ? '#f87171' : '#4ade80' }}>{lech ? `✗ ${lech} camp lệch form chữ` : '✓ mọi camp đúng form chữ'}</span>
      {du.thieu ? <span style={{ color: '#fbbf24' }}>{du.thieu} camp kho chưa đọc cấu hình Ethopex (bai-qc.py đọc dần mỗi lượt đồng bộ)</span> : null}
      <span title="apps/etp/form-chu.json">Form chuẩn: {form?.creative_type} · {form?.call_to_action} · {form?.link_url} · “{form?.primaryTexts.join(' / ')}” · “{form?.headlines.join(' / ')}” · “{form?.descriptions.join(' / ')}”</span>
    </div>
    <DataTable rows={du.dong} columns={cot} groups={NHOM_TL} groupHeader getRowKey={(r) => String(r.camp_id)} persistKey="etp-thiet-lap" minWidth={hep ? 900 : 1400} pageSize={50}
      defaultSort={[{ key: 'tao', dir: 'desc' }]} stickyCols={2}
      searchText={(r) => Object.values(r).map((v) => chu(v as OTl) ?? '').join(' ')} searchPlaceholder="Tìm camp, Page, nước, chữ QC…" />
  </>;
}
