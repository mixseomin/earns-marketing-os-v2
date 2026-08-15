import { PubLogin } from '@/components/pub-login';
import { EmptyState } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function SetPasswordRoute({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const t = (await searchParams).t;
  if (!t) {
    return (
      <div style={{ height: '100dvh', display: 'grid', placeItems: 'center' }}>
        <EmptyState icon="🔑" title="Thiếu mã đặt mật khẩu" description="Mở đúng link admin gửi cho bạn." />
      </div>
    );
  }
  return <PubLogin setupToken={t} />;
}
