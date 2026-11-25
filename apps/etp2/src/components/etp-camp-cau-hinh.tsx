'use client';
// NGĂN CAMP = TRANG CẤU HÌNH ETHOPEX (anh 24/11/2026: "Muốn xem chi tiết camp khi bấm vào thì drawer hiện ra giống config page bên etho với các page y hệt").
// Khuôn: Hộp thư / cây điều hướng + chi tiết (MAU-CHUAN.md, shadcn sidebar-09) — đúng bố cục trang app.ethopex.dev/…/facebook/campaigns/<id>:
// cột trái "Campaign structure" (Campaign → Ad set → Ad, chấm đỏ / vàng khi cấp đó có lỗi / cảnh báo), bên phải các khối của trang đang chọn,
// CÙNG tên khối + tên trường + thứ tự như Ethopex (đọc từ gói mã facebook-campaign-create-page của họ). Màn hẹp: cây thành dải nút ngang trên đầu.
// Chỉ đọc. Dữ liệu = docThietLap (etp.bai_camp.du — GET /api/v1/campaigns/<id> trọn, cùng nguồn bảng ⚙ Thiết lập), không đọc riêng.
// Trang "Số liệu nhà" giữ phần ngăn camp cũ (bậc, ROI, điều khiển, biểu đồ, luật, creative) để không mất gì.
import { useEffect, useState, type ReactNode } from 'react';
import { docThietLap, type DongTl, type KeTl, type OTl } from '@/lib/actions/etp-thiet-lap';

type Trang = 'camp' | 'nhom' | 'ad' | 'so';
const KHOA = 'etp-ngan-camp-trang';

// mã Meta → chữ Ethopex / Meta hiện trên trang; mã gốc vẫn in mờ bên cạnh
const MA: Record<string, string> = {
  OUTCOME_SALES: 'Sales', OUTCOME_TRAFFIC: 'Traffic', OUTCOME_ENGAGEMENT: 'Engagement', OUTCOME_LEADS: 'Leads', OUTCOME_AWARENESS: 'Awareness', AUCTION: 'Auction',
  LOWEST_COST_WITHOUT_CAP: 'Highest volume', LOWEST_COST_WITH_MIN_ROAS: 'ROAS goal', COST_CAP: 'Cost per result goal', LOWEST_COST_WITH_BID_CAP: 'Bid cap',
  VALUE: 'Maximize value of conversions', OFFSITE_CONVERSIONS: 'Maximize number of conversions', LINK_CLICKS: 'Maximize number of link clicks', LANDING_PAGE_VIEWS: 'Maximize number of landing page views',
  WEBSITE: 'Website', PURCHASE: 'Purchase', COMPLETE_REGISTRATION: 'Complete registration', ADD_TO_CART: 'Add to cart', IMPRESSIONS: 'Impressions',
  ACTIVE: 'On', PAUSED: 'Off', ARCHIVED: 'Archived', DELETED: 'Deleted',
};
// mã locale Meta (targeting.locales) — chỉ ghi mã đã chắc; mã khác in nguyên số
const LOCALE: Record<string, string> = { '6': 'English (US)', '24': 'English (UK)' };
const gioVn = (iso: string) => {
  const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso.replace(' ', 'T') : `${iso.replace(' ', 'T')}Z`);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t + 7 * 3_600_000), p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} ${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)} giờ VN`;
};

export function CamCauHinh({ campId, soLieu, xemTruoc, phim, ke }: {
  campId: number;
  /** camp DỰ KIẾN (chưa tạo — lib/etp-ke-cr keCr): đọc docThietLap([], [ke]) = khuôn + ô đè đúng lệnh ▶ Lên sẽ gửi (anh 25/11/2026 ô chờ duyệt bấm mở ngăn camp) */
  ke?: KeTl | null;
  /** trang "Số liệu nhà" = nội dung ngăn camp cũ */
  soLieu: ReactNode;
  /** khối Ad preview (KhungBaiQc) — chỗ gọi dựng vì cần ảnh / video của creative */
  xemTruoc?: ReactNode;
  /** tên phim của content_id (trường Content) */
  phim?: string | null;
}) {
  const [trang, datTrang] = useState<Trang>('camp');
  useEffect(() => { try { const v = localStorage.getItem(KHOA); if (v === 'camp' || v === 'nhom' || v === 'ad' || v === 'so') datTrang(v); } catch { /* không có localStorage: mở trang Campaign */ } }, []);
  const chon = (v: Trang) => { datTrang(v); try { localStorage.setItem(KHOA, v); } catch { /* như trên */ } };
  const [du, setDu] = useState<{ r: DongTl | null; chung: string[] } | null>(null), [loi, setLoi] = useState<string | null>(null);
  // #1862: danh sách Chờ duyệt tải lại mỗi ~13s trao `ke` là object MỚI cùng nội dung → effect chạy lại, xoá du → khung xem trước bị dựng lại, bản dịch vừa mở gập mất. Khoá theo NỘI DUNG ke.
  const keKhoa = ke ? JSON.stringify(ke) : '';
  useEffect(() => {
    let bo = false; setDu(null); setLoi(null);
    (ke ? docThietLap([], [ke]) : docThietLap([campId])).then((x) => { if (bo) return; if ('loi' in x) setLoi(x.loi);
      else setDu({ r: (ke ? x.dong.find((d) => d.ke_cha === ke.id) : x.dong[0]) ?? null, chung: x.chung }); }, (e) => { if (!bo) setLoi(String(e?.message ?? e)); });
    return () => { bo = true; };
  }, [campId, keKhoa]); // eslint-disable-line react-hooks/exhaustive-deps
  const [rong, setRong] = useState(true);
  useEffect(() => { const f = () => setRong(window.innerWidth >= 760); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);

  const r = du?.r ?? null;
  const v = (k: string): string | null => { const x: OTl | undefined = r?.[k]; return x == null ? null : typeof x === 'number' ? (du?.chung[x] ?? null) : x; };
  const docDuoc = !!r && (r.du_luc != null);
  const coLoi = { camp: !!v('c_loi') && !v('c_loi')!.startsWith('⚠'), nhom: !!v('g_loi') && !v('g_loi')!.startsWith('⚠'), ad: !!v('a_loi') && !v('a_loi')!.startsWith('⚠') };
  const coCanh = { camp: !!v('c_loi'), nhom: !!v('g_loi'), ad: !!v('a_loi') };

  // ── cây trái (Ethopex: aside "Campaign structure", nav "Campaign tree") ──
  const NUT: { k: Trang; ten: string; nhan: string; lui: number }[] = [
    { k: 'camp', ten: 'Campaign', nhan: v('c_ten') ?? `#${campId}`, lui: 0 },
    { k: 'nhom', ten: 'Ad set', nhan: v('g_ten') ?? '—', lui: 1 },
    { k: 'ad', ten: 'Ad', nhan: v('a_ten') ?? '—', lui: 2 },
  ];
  const cham = (k: Trang) => k === 'so' ? null : coLoi[k] ? '#f87171' : coCanh[k] ? '#fbbf24' : null;
  const cay = rong
    ? <aside style={{ position: 'sticky', top: 0, alignSelf: 'start', borderRight: '1px solid var(--line)', paddingRight: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--fg-3, #777)', padding: '2px 6px 8px' }}>Campaign structure</div>
        <nav aria-label="Campaign tree" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NUT.map((n) => <button key={n.k} type="button" onClick={() => chon(n.k)} title={n.nhan}
            style={{ textAlign: 'left', border: 0, borderRadius: 6, padding: '6px 8px', marginLeft: n.lui * 12, cursor: 'pointer', fontSize: 12, background: trang === n.k ? 'var(--bg-2, #1f2937)' : 'transparent', color: 'inherit', minWidth: 0 }}>
            <div style={{ fontSize: 10, color: 'var(--fg-3, #777)', display: 'flex', alignItems: 'center', gap: 5 }}>{n.ten}{cham(n.k) ? <span style={{ width: 6, height: 6, borderRadius: 3, background: cham(n.k)! }} /> : null}</div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: trang === n.k ? 600 : 400 }}>{n.nhan}</div>
          </button>)}
        </nav>
        <div style={{ borderTop: '1px solid var(--line)', margin: '8px 0 4px' }} />
        <button type="button" onClick={() => chon('so')} style={{ textAlign: 'left', border: 0, borderRadius: 6, padding: '6px 8px', cursor: 'pointer', fontSize: 12, background: trang === 'so' ? 'var(--bg-2, #1f2937)' : 'transparent', color: 'inherit', fontWeight: trang === 'so' ? 600 : 400 }}>📊 Số liệu nhà</button>
      </aside>
    : <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 6, borderBottom: '1px solid var(--line)' }}>
        {[...NUT.map((n) => ({ k: n.k, ten: n.ten })), { k: 'so' as Trang, ten: '📊 Số liệu nhà' }].map((n) => <button key={n.k} type="button" onClick={() => chon(n.k)}
          style={{ flex: 'none', border: '1px solid var(--line)', borderRadius: 999, padding: '4px 10px', fontSize: 12, cursor: 'pointer', background: trang === n.k ? 'var(--bg-2, #1f2937)' : 'transparent', color: 'inherit', fontWeight: trang === n.k ? 600 : 400, display: 'flex', alignItems: 'center', gap: 5 }}>
          {n.ten}{cham(n.k) ? <span style={{ width: 6, height: 6, borderRadius: 3, background: cham(n.k)! }} /> : null}</button>)}
      </div>;

  // ── khối + trường (Ethopex: R title / Mo label·value; trống = "Not selected") ──
  const Khoi = ({ ten, children }: { ten: string; children: ReactNode }) => <section style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px' }}>
    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{ten}</div>
    <div style={{ display: 'grid', gridTemplateColumns: rong ? 'fit-content(180px) minmax(0, 1fr)' : 'minmax(0, 1fr)', columnGap: 16, rowGap: rong ? 6 : 2 }}>{children}</div></section>;
  const Truong = ({ nhan, gt, ma, chu }: { nhan: string; gt: string | null | undefined; ma?: boolean; chu?: string }) => {
    const ten = gt != null && ma ? MA[gt] : undefined;
    return <>
      <div style={{ fontSize: 12, color: 'var(--fg-2)', paddingTop: rong ? 0 : 4 }}>{nhan}</div>
      <div style={{ fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', userSelect: 'text' }}>
        {gt == null || gt === '' ? <span style={{ color: 'var(--fg-3, #777)' }}>Not selected</span> : ten ? <>{ten} <span style={{ color: 'var(--fg-3, #777)', fontSize: 11 }}>{gt}</span></> : gt}
        {chu ? <span style={{ color: 'var(--fg-3, #777)', fontSize: 11 }}> · {chu}</span> : null}</div>
    </>;
  };
  const Loi = ({ k }: { k: string }) => { const s = v(k); if (!s) return null; const do_ = !s.startsWith('⚠');
    return <div style={{ border: `1px solid ${do_ ? '#f87171' : '#fbbf24'}`, background: do_ ? 'rgba(248,113,113,.08)' : 'rgba(251,191,36,.08)', borderRadius: 8, padding: '8px 10px', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{s}</div>; };
  const tien = (k: string) => (v(k) == null ? null : `$${v(k)}`);
  const gioUtc = (k: string) => { const s = v(k); return s == null ? null : s; };
  const gioChu = (k: string) => { const s = v(k); return s ? gioVn(s) ?? undefined : undefined; };
  const gioi = (s: string | null) => s == null ? 'All genders' : s.split(', ').map((x) => (x === '1' ? 'Male' : x === '2' ? 'Female' : x)).join(', ');

  const trangCamp = <>
    <Loi k="c_loi" />
    <Khoi ten="Campaign name">
      <Truong nhan="Campaign name" gt={v('c_ten')} />
      <Truong nhan="build_name" gt={v('c_build')} />
      <Truong nhan="Status" gt={v('c_tt')} ma chu={v('c_meta') ? `Meta: ${v('c_meta')}` : undefined} />
      <Truong nhan="External campaign ID" gt={v('c_ext')} />
      <Truong nhan="Delivery status" gt={v('c_giao')} />
    </Khoi>
    <Khoi ten="Account traffic source Facebook">
      <Truong nhan="Facebook ad account" gt={v('c_tk')} chu={v('c_bo') ? `bộ ${v('c_bo')}` : undefined} />
    </Khoi>
    <Khoi ten="Campaign details">
      <Truong nhan="Buying type" gt={v('c_mua')} ma />
      <Truong nhan="Campaign objective" gt={v('c_muc_tieu')} ma />
    </Khoi>
    <Khoi ten="Budget">
      <Truong nhan="Budget strategy" gt={v('c_che_do')} />
      <Truong nhan="Budget amount (USD)" gt={tien('c_ns')} chu={v('c_ns_tron') ? `trọn đời $${v('c_ns_tron')}` : undefined} />
      <Truong nhan="Campaign bid strategy" gt={v('c_gia')} ma />
      {v('c_epc') ? <Truong nhan="Min EPC" gt={tien('c_epc')} /> : null}
      {v('c_ns_chia') ? <Truong nhan="Ad set budget sharing" gt={v('c_ns_chia')} /> : null}
    </Khoi>
    <Khoi ten="Special ad categories">
      <Truong nhan="Categories" gt={v('c_dac_biet')} />
    </Khoi>
  </>;
  const vtThu = v('g_vi_tri');
  const trangNhom = <>
    <Loi k="g_loi" />
    <Khoi ten="Ad set name">
      <Truong nhan="Ad set name" gt={v('g_ten')} />
      <Truong nhan="Status" gt={v('g_tt')} ma chu={[v('g_meta') && `Meta: ${v('g_meta')}`, v('g_kich')].filter(Boolean).join(' · ') || undefined} />
      <Truong nhan="External group ID" gt={v('g_ext')} />
      <Truong nhan="Delivery status" gt={v('g_giao')} />
    </Khoi>
    <Khoi ten="Conversion">
      <Truong nhan="Conversion location" gt={v('g_dich') ?? 'WEBSITE'} ma />
      <Truong nhan="Performance goal" gt={v('g_toi_uu')} ma />
      {v('g_roas') ? <Truong nhan="ROAS goal" gt={v('g_roas')} /> : null}
      {v('g_cpa') ? <Truong nhan="Cost per result goal" gt={tien('g_cpa')} /> : null}
      {v('g_epc') ? <Truong nhan="Min EPC" gt={tien('g_epc')} /> : null}
      <Truong nhan="Pixel (Dataset)" gt={v('g_pixel')} />
      <Truong nhan="Conversion event" gt={v('g_su_kien')} ma />
      <Truong nhan="Attribution setting" gt={v('g_attr')} />
      {v('g_tinh_phi') ? <Truong nhan="Billing event" gt={v('g_tinh_phi')} ma /> : null}
    </Khoi>
    <Khoi ten="Budget & schedule">
      <Truong nhan="Daily budget" gt={tien('g_ns')} />
      <Truong nhan="Start time (UTC)" gt={gioUtc('g_bat_dau')} chu={gioChu('g_bat_dau')} />
      <Truong nhan="End date" gt={v('g_ket_thuc') ?? 'No end date'} chu={gioChu('g_ket_thuc')} />
      {v('g_lich') ? <Truong nhan="Lịch lên (nhà)" gt={v('g_lich')} /> : null}
    </Khoi>
    <Khoi ten="Audience">
      <Truong nhan="Locations (include countries)" gt={v('g_nuoc')} chu={v('g_so_nuoc') ? `${v('g_so_nuoc')} nước` : undefined} />
      <Truong nhan="Locations (exclude countries)" gt={v('g_loai_nuoc')} chu={v('g_so_loai') ? `${v('g_so_loai')} nước` : undefined} />
      {v('g_kieu_vt') ? <Truong nhan="Location types" gt={v('g_kieu_vt')} /> : null}
      <Truong nhan="Age" gt={v('g_tuoi')} />
      <Truong nhan="Genders" gt={gioi(v('g_gioi'))} />
      <Truong nhan="Languages" gt={v('g_ngon_ngu') == null ? 'All languages' : v('g_ngon_ngu')!.split(', ').map((x) => LOCALE[x] ? `${LOCALE[x]} (${x})` : x).join(', ')} />
      {v('g_adv') ? <Truong nhan="Advantage+ audience" gt={v('g_adv')} /> : null}
    </Khoi>
    <Khoi ten="Ad transparency">
      <Truong nhan="DSA beneficiary" gt={v('g_dsa_b')} />
      <Truong nhan="DSA payor" gt={v('g_dsa_p')} />
    </Khoi>
    <Khoi ten="Placements">
      <Truong nhan="Placements" gt={vtThu ? 'Manual placements' : 'Advantage+ placements'} />
      <Truong nhan="Devices" gt={v('g_thiet_bi')} />
      <Truong nhan="Publisher platforms" gt={v('g_nen')} />
      {vtThu ? <Truong nhan="Positions" gt={vtThu} /> : null}
      {v('g_an_toan') ? <Truong nhan="Brand safety" gt={v('g_an_toan')} /> : null}
      {v('g_vung_qd') ? <Truong nhan="Regional regulated categories" gt={v('g_vung_qd')} /> : null}
    </Khoi>
  </>;
  const baiCo = v('a_bai_co') === 'true';
  const trangAd = <div style={{ display: 'grid', gridTemplateColumns: rong && xemTruoc ? 'minmax(0, 1fr) minmax(280px, 360px)' : 'minmax(0, 1fr)', gap: 12, alignItems: 'start' }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <Loi k="a_loi" />
      <Khoi ten="Ad name">
        <Truong nhan="Ad name" gt={v('a_ten')} />
        <Truong nhan="Post ID" gt={v('a_bai')} />
        <Truong nhan="Status" gt={v('f_tt')} ma chu={[v('a_meta') && `Meta: ${v('a_meta')}`, v('a_kich')].filter(Boolean).join(' · ') || undefined} />
        <Truong nhan="External ad ID" gt={v('a_ext')} />
        <Truong nhan="Delivery status" gt={v('a_giao')} />
      </Khoi>
      <Khoi ten="Identity">
        <Truong nhan="Facebook Page" gt={v('a_page_ten') ?? v('a_page')} chu={v('a_page_ten') && v('a_page') ? `#${v('a_page')}` : undefined} />
      </Khoi>
      <Khoi ten="Ad setup">
        <Truong nhan="Ad setup" gt={baiCo ? 'Use existing post' : 'Create ad'} />
      </Khoi>
      <Khoi ten="Ad creative">
        {baiCo ? <Truong nhan="Post" gt={v('a_bai')} /> : <Truong nhan="Set up creative" gt={v('f_cr') ? `#${v('f_cr')}` : null} chu={[v('a_ext_cr') && `Meta creative ${v('a_ext_cr')}`, v('a_video') && `video ${v('a_video')}`].filter(Boolean).join(' · ') || undefined} />}
        <Truong nhan="Ad type" gt={v('f_kieu')} />
        <Truong nhan="Call to action" gt={v('f_cta')} />
        <Truong nhan="Display link" gt={v('f_link')} />
        <Truong nhan="Primary text" gt={v('f_chinh')} />
        <Truong nhan="Headline" gt={v('f_tieu')} />
        <Truong nhan="Description" gt={v('f_mo_ta')} />
        <Truong nhan="Nguồn chữ (nhà)" gt={v('f_nguon')} />
      </Khoi>
      <Khoi ten="Destination">
        <Truong nhan="Destination type" gt="WEBSITE" ma />
        <Truong nhan="Domain" gt={v('a_mien')} />
        <Truong nhan="Content" gt={phim ?? (v('a_phim') ? `#${v('a_phim')}` : null)} chu={phim && v('a_phim') ? `#${v('a_phim')}` : undefined} />
        <Truong nhan="Landing page" gt={v('a_lp') ? `#${v('a_lp')}` : null} />
        <Truong nhan="Final URL" gt={v('a_url')} />
        <Truong nhan="URL tags" gt={v('a_tags')} />
      </Khoi>
    </div>
    {xemTruoc ? <section style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', position: rong ? 'sticky' : undefined, top: 0 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Ad preview</div>{xemTruoc}</section> : null}
  </div>;

  const than = trang === 'so' ? soLieu
    : loi ? <div style={{ border: '1px solid #f87171', background: 'rgba(248,113,113,.08)', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}>Không đọc được cấu hình camp #{campId}: {loi}</div>
    : !du ? <div style={{ color: 'var(--fg-2)', fontSize: 12 }}>Đang đọc cấu hình…</div>
    : !r ? <div style={{ color: 'var(--fg-2)', fontSize: 12 }}>Không thấy camp #{campId} trong kho.</div>
    : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ke ? <div title="chép camp khuôn theo tiếng + các ô lệnh ▶ Lên đè (★ ROAS, ngân sách, tên, bộ → tài khoản / Page, không nhắm ngôn ngữ); ô chữ lấy từ form-chu.json" style={{ border: '1px solid #60a5fa', background: 'rgba(96,165,250,.08)', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}>
            Camp DỰ KIẾN — chưa tạo · chép khuôn #{String(r.ke_khuon ?? '')} + ô máy đè lúc lên{r.ke_thieu ? <b style={{ color: '#f87171' }}> · {String(r.ke_thieu)}</b> : null}</div>
          : !docDuoc ? <div title="apps/etp/bai-qc.py đọc ở lượt đồng bộ kế (~10 phút); các ô dưới chỉ có phần kho camp sẵn có" style={{ border: '1px solid #fbbf24', background: 'rgba(251,191,36,.08)', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}>Kho chưa đọc cấu hình Ethopex · chờ lượt đồng bộ kế</div>
          : <div style={{ fontSize: 11, color: 'var(--fg-3, #777)' }}>Đọc từ Ethopex lúc {gioVn(String(r.du_luc)) ?? String(r.du_luc)} · chỉ xem</div>}
        {trang === 'camp' ? trangCamp : trang === 'nhom' ? trangNhom : trangAd}
      </div>;

  return rong
    ? <div style={{ display: 'grid', gridTemplateColumns: '210px minmax(0, 1fr)', gap: 12, alignItems: 'start' }}>{cay}<div style={{ minWidth: 0 }}>{than}</div></div>
    : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{cay}{than}</div>;
}
