// Tab TÀI SẢN của trang chủ (anh chốt 05/10/2026): mọi thứ sinh tiền hoặc sắp sinh tiền, một màn —
// website (bảng SEO cũ), shop → sản phẩm (cây; có cả hàng đang làm: sách KDP, Etsy…).
// Thuần SEO (chi tiết một site, keyword research, SteamSolo) đã sang tab SEO (seo-tab.tsx).
// Từ 20/11/2026: đọc + tính MỘT chỗ (docTaiSanTab, React cache) — tab cũ vẽ cả năm khối, /home vẽ từng khối thành widget riêng (D1–D5), cùng số.
import { cache } from 'react';
import { StatsStrip, type StatCard } from '@/components/ui';
import { SeoSitesPanel, docSeoSites } from './seo-sites-panel';
import { TaiSanView } from './tai-san-view';
import { docTaiSanBan } from '@/lib/tai-san/doc';
import { docKenh, docKenhSo, docLuotNguon, docPhuongPhap, docVideoSo } from '@/lib/tai-san/kenh';
import { tinhPin, tinhVideo } from '@/lib/tai-san/video-tinh';
import { TaiSanVideo } from './tai-san-video';
import { apDung, ganLuot, ganSo } from '@/lib/tai-san/ap-dung';
import { TaiSanKenh } from './tai-san-kenh';
import { docSocialTroVe } from '@/lib/tai-san/social-tro-ve';
import { KY_SOCIAL } from '@/lib/tai-san/social-tro-ve-tinh';
import { ChonKySocial } from './tai-san-social';
import type { TrangThaiSp } from '@/lib/tai-san/kieu';

export const kySocial = (raw?: string | number): number => ((KY_SOCIAL as readonly number[]).includes(Number(raw)) ? Number(raw) : 7);

/** mọi thứ tab Tài sản cần, đọc một lần cho cả lượt vẽ */
export const docTaiSanTab = cache(async (ky: number) => {
  const [sites, ban, kenhDoc, libDoc, luot, so, vso] = await Promise.all([docSeoSites(), docTaiSanBan(), docKenh().catch((e: Error) => e), docPhuongPhap().catch((e: Error) => e), docLuotNguon().catch(() => ({})), docKenhSo().catch(() => ({})), docVideoSo().catch((e: Error) => e)]);
  if (vso instanceof Error) ban.loi.push(`số video short (kenh_so_ngay): ${vso.message}`);
  // SOCIAL TRỎ VỀ (anh 02/11/2026): mỗi site / sản phẩm / kênh nội dung — số kênh social trỏ về + số trong khung ky ngày
  const homNay = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
  const tro = await docSocialTroVe(ky, homNay).catch((e: Error) => { ban.loi.push(`social trỏ về: ${e.message}`); return null; });
  if (tro) { if (sites.ok) for (const r of sites.rows) { r.social = tro.site(r.domain); r.lichSocial = tro.lich(r.domain); } for (const sh of ban.shops) for (const x of sh.sp) x.social = tro.duong(x.url); }
  // Kênh nội dung (kênh video là sản phẩm) sang tab riêng ?tab=kenh (anh 05/11/2026) — kenh-noi-dung-tab.tsx
  const hom = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }), vid = tinhVideo(vso instanceof Error ? [] : vso.dongs, hom);
  if (kenhDoc instanceof Error) ban.loi.push(`kênh kéo khách (kenh_sp): ${kenhDoc.message}`);
  if (libDoc instanceof Error) ban.loi.push(`thư viện phương pháp (phuong_phap): ${libDoc.message}`);
  const lib = libDoc instanceof Error ? [] : libDoc;
  // Áp thư viện lên MỌI sản phẩm trên cây (ap-dung.ts): tựa + ô theo nhắm, ô thiếu dòng sổ = chưa làm, shop không ai nhắm = thiếu.
  const ap = ganSo(ganLuot(apDung(ban.shops, lib, kenhDoc instanceof Error ? [] : kenhDoc), luot), so);
  const web = sites.ok ? sites.rows : [];
  const sp = ban.shops.flatMap((s) => s.sp);
  const dem = (k: TrangThaiSp) => sp.filter((x) => x.trangThai === k).length;
  const cards: StatCard[] = [
    { key: 'web', label: 'Website', value: web.length, sub: `${web.reduce((t, r) => t + (r.ga4_users_7d ?? 0), 0).toLocaleString('en-US')} users 7d` },
    { key: 'shop', label: 'Shop', value: ban.shops.length, sub: `${sp.length} sản phẩm` },
    { key: 'ban', label: 'Đang bán', value: dem('dang_ban'), color: 'var(--ok)' },
    { key: 'anh', label: 'Chờ anh duyệt', value: dem('cho_anh'), color: dem('cho_anh') ? 'var(--accent)' : undefined },
    { key: 'duyet', label: 'Đã nộp, chờ duyệt', value: dem('cho_duyet'), color: dem('cho_duyet') ? 'var(--warn)' : undefined },
    { key: 'san', label: 'Sẵn sàng', value: dem('san_sang'), sub: 'xong, chưa đăng' },
    { key: 'lam', label: 'Đang làm', value: dem('dang_lam'), sub: `${dem('du_kien')} dự kiến` },
  ];
  return { ky, sites, ban, cards, vid, tenSp: vso instanceof Error ? {} : vso.tenSp, pin: tinhPin(so), hom, ap, lib };
});

// năm khối của tab — mỗi khối một hàm để /home dựng thành widget riêng (cùng docTaiSanTab nên cùng số)
export async function TaiSanSo({ ky }: { ky: number }) { const d = await docTaiSanTab(ky); return <StatsStrip cards={d.cards} minColWidth={120} />; }
export async function TaiSanWeb({ ky }: { ky: number }) { const d = await docTaiSanTab(ky); return <SeoSitesPanel d={d.sites} kySocial={ky} />; }
export async function TaiSanShop({ ky }: { ky: number }) { const d = await docTaiSanTab(ky); return <TaiSanView ban={d.ban} kySocial={ky} />; }
export async function TaiSanVideoNgan({ ky }: { ky: number }) { const d = await docTaiSanTab(ky); return <TaiSanVideo nen={d.vid.nen} video={d.vid.video} tenSp={d.tenSp} pin={d.pin} hom={d.hom} />; }
export async function TaiSanMaTran({ ky }: { ky: number }) { const d = await docTaiSanTab(ky); return <TaiSanKenh ap={d.ap} lib={d.lib} shops={d.ban.shops.map((x) => ({ khoa: x.khoa, ten: x.ten }))} />; }

export async function TaiSanTab({ ky: kyThu }: { ky?: string } = {}) {
  const ky = kySocial(kyThu), d = await docTaiSanTab(ky);
  // minmax(0,1fr): ô grid mặc định min-width:auto → bảng rộng (cột Site width 100%) NỞ theo nội dung, đẩy mọi cột số ra ngoài
  // khung thay vì cuộn ngang (anh bắt 05/10/2026).
  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <StatsStrip cards={d.cards} />
      <ChonKySocial ky={ky} />
      <SeoSitesPanel d={d.sites} kySocial={ky} />
      <TaiSanView ban={d.ban} kySocial={ky} />
      <TaiSanVideo nen={d.vid.nen} video={d.vid.video} tenSp={d.tenSp} pin={d.pin} hom={d.hom} />
      <TaiSanKenh ap={d.ap} lib={d.lib} shops={d.ban.shops.map((x) => ({ khoa: x.khoa, ten: x.ten }))} />
    </div>
  );
}
