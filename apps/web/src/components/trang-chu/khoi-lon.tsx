// HAI KHỐI LỚN của trang chủ đọc số ở máy chủ rồi giao cho khối phía trình duyệt — tab cũ (app/page.tsx) và các widget H*, I* của /home dùng chung,
// nên cùng một lần đọc (React cache) và cùng con số. `chi` = chỉ vẽ một phần (xem EthopexView / SocialTrafficView). Tách khỏi app/page.tsx 20/11/2026.
import { cache, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { docEthopex } from '@/lib/ethopex-doc';
import { getSocialLive } from '@/lib/social-traffic';
import { MailwizzListsPanel } from '@/components/mailwizz-lists-panel';
import type { ChiSocial } from '@/components/social-traffic-view';
import type { ChiEthopex } from '@/components/ethopex-view';

const EthopexView = dynamic(() => import('@/components/ethopex-view').then((m) => m.EthopexView));
const SocialTrafficView = dynamic(() => import('@/components/social-traffic-view').then((m) => m.SocialTrafficView));

const docEtp = cache(() => docEthopex());
// số thô của Social gửi xuống trình duyệt; phần HỆ SINH THÁI (~820 KB, chỉ city dùng) và lưới lịch đăng (~750 KB) bỏ lại — mục Thành phố / Lịch tự tải khi mở
// (anh 25/10 + 30/10/2026: trang 1,9 MB "load chậm vãi")
const docSocial = cache(async () => { const { heSinhThai: _bo, ...nhe } = await getSocialLive({ hst: false, luoi: false }); return { ...nhe, heSinhThai: undefined as never }; });

/** Ethopex — camp FB phim ngắn: kéo sống API Ethopex (nhớ 60s) + luật từng camp (lib/ethopex-luat.ts) */
export async function EthopexKhoi({ chi }: { chi?: ChiEthopex } = {}) {
  return <EthopexView du={await docEtp()} chi={chi} />;
}

/** Social Traffic — góc thật đọc từ spy.on.tc (nhớ 5 phút) cho chế độ LIVE; DEMO nằm sẵn trong view. */
export async function SocialKhoi({ chi }: { chi?: ChiSocial } = {}) {
  const live = await docSocial();
  // danh sách email chỉ tab đủ mới cần (mục Email) — widget từng phần không kéo theo MailWizz
  const email = chi ? undefined : <Suspense fallback={<div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Đang đọc MailWizz…</div>}><MailwizzListsPanel /></Suspense>;
  return <SocialTrafficView live={live} email={email} chi={chi} />;
}
