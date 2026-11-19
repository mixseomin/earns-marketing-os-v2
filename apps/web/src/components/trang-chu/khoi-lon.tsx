// HAI KHỐI LỚN của trang chủ đọc số ở máy chủ rồi giao cho khối phía trình duyệt — tab cũ (app/page.tsx) và các widget H*, I* của /home dùng chung,
// nên cùng một lần đọc (React cache) và cùng con số. `chi` = chỉ vẽ một phần (xem EthopexView / SocialTrafficView). Tách khỏi app/page.tsx 20/11/2026.
// GÓI GỌN CHO WIDGET (đo 20/11/2026: Ethopex 995 KB — ngayCamp 444 + camps 393; Social 742 KB — goc 484 + lo 105): widget chỉ vẽ một phần thì chỉ nhận
// đúng mảng phần đó đọc, mảng khác gửi rỗng. Mảng giữ lại là CÙNG một đối tượng với gói đầy đủ nên nhiều widget cùng màn vẫn chỉ gửi nó xuống trình duyệt một lần.
import { cache, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { docEthopex, type DuLieuEthopex } from '@/lib/ethopex-doc';
import { getSocialLive } from '@/lib/social-traffic';
import { MailwizzListsPanel } from '@/components/mailwizz-lists-panel';
import type { ChiSocial } from '@/components/social-traffic-view';
import type { ChiEthopex } from '@/components/ethopex-view';

const EthopexView = dynamic(() => import('@/components/ethopex-view').then((m) => m.EthopexView));
const SocialTrafficView = dynamic(() => import('@/components/social-traffic-view').then((m) => m.SocialTrafficView));
const ThanhPhoTai = dynamic(() => import('@/components/social-traffic-view').then((m) => m.ThanhPhoTai));
const SucKhoeDang = dynamic(() => import('@/components/social-suc-khoe').then((m) => m.SucKhoeDang));

const docEtp = cache(() => docEthopex());
// số thô của Social gửi xuống trình duyệt; phần HỆ SINH THÁI (~820 KB, chỉ city dùng) và lưới lịch đăng (~750 KB) bỏ lại — mục Thành phố / Lịch tự tải khi mở
// (anh 25/10 + 30/10/2026: trang 1,9 MB "load chậm vãi")
const docSocial = cache(async () => { const { heSinhThai: _bo, ...nhe } = await getSocialLive({ hst: false, luoi: false }); return { ...nhe, heSinhThai: undefined as never }; });

// mục nào của Ethopex đọc mảng nào (components/ethopex-view.tsx): dải số / bảng camp / theo phim / lên test đọc camps; theo ngày đọc thêm ba mảng ngày;
// thể loại × thứ chỉ đọc theLoaiThu; hàng chờ chỉ đọc hangCho; sổ luật không đọc gì.
const ETP_CAN_CAMP: ChiEthopex[] = ['so', 'camp', 'phim', 'test', 'ngay'];
function gonEtp(du: DuLieuEthopex, chi: ChiEthopex): DuLieuEthopex {
  const ngay = chi === 'ngay';
  return { ...du, camps: ETP_CAN_CAMP.includes(chi) ? du.camps : [], ngayCamp: ngay ? du.ngayCamp : [], theoNgay: ngay ? du.theoNgay : [], tienMoi: ngay ? du.tienMoi : [],
    theLoaiThu: chi === 'tl' ? du.theLoaiThu : undefined, hangCho: chi === 'cho' ? du.hangCho : [] };
}
/** Ethopex — camp FB phim ngắn: kéo sống API Ethopex (nhớ 60s) + luật từng camp (lib/ethopex-luat.ts) */
export async function EthopexKhoi({ chi }: { chi?: ChiEthopex } = {}) {
  const du = await docEtp();
  return <EthopexView du={chi ? gonEtp(du, chi) : du} chi={chi} />;
}

// mục nào của Social đọc kho góc (components/social-traffic-view.tsx): góc ra tiền, mục Góc, lô sản xuất, bảng kênh, trang đích (tên góc của từng dòng).
// Kho góc (~2.400 góc, 484 KB) — đọc lại components/social-traffic-view.tsx 20/11/2026, chỉ mục Góc cần CẢ kho:
//   · góc ra tiền: chỉ vẽ góc đang thắng (+ câu đếm số góc cả kho → gửi kèm soGoc) · trang đích / lô sản xuất: chỉ tra TÊN góc của các dòng đang có (gocOf)
//   · bảng kênh, phễu, việc gấp, lịch, landing, sổ tiền, kế hoạch đăng góc: không đọc kho góc. Lô sản xuất (lo) chỉ mục Sản xuất đọc.
type Live = Awaited<ReturnType<typeof docSocial>>;
function gocCho(live: Live, chi: ChiSocial): Live['goc'] {
  if (chi === 'goc') return live.goc;
  if (chi === 'ratien') return live.goc.filter((g) => g.tt === 'thang');
  const can = new Set<number>(chi === 'trang' ? live.trang.map((x) => x.goc) : chi === 'sx' ? live.lo.map((l) => l.goc) : []);
  return can.size ? live.goc.filter((g) => can.has(g.id)) : [];
}
/** Social Traffic — góc thật đọc từ spy.on.tc (nhớ 5 phút) cho chế độ LIVE; DEMO nằm sẵn trong view. */
export async function SocialKhoi({ chi }: { chi?: ChiSocial } = {}) {
  if (chi === 'pho') return <ThanhPhoTai />;   // thành phố tự tải mô hình dựng sẵn qua /api/social/thanh-pho — không cần gói số của tab
  const live = await docSocial();
  if (chi === 'suc') return <SucKhoeDang suc={live.suc} />;
  if (chi) return <SocialTrafficView chi={chi} soGoc={live.goc.length} live={{ ...live, goc: gocCho(live, chi), lo: chi === 'sx' ? live.lo : [] }} />;
  // danh sách email chỉ tab đủ mới cần (mục Email) — widget từng phần không kéo theo MailWizz
  return <SocialTrafficView live={live} email={<Suspense fallback={<div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Đang đọc MailWizz…</div>}><MailwizzListsPanel /></Suspense>} />;
}
