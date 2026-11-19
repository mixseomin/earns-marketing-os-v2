// Live Orders của strategy-lab — cùng blotter với /p/strategy-lab/orders, bộ lọc giữ ở cookie slf2 như bên đó.
// Dùng ở tab Lệnh MT5 của trang chủ cũ và widget C6 của /home (một nguồn, tách khỏi app/page.tsx 20/11/2026).
import Link from 'next/link';
import { cookies } from 'next/headers';
import { OrdersBlotter } from '@/components/orders-blotter';
import { listStrategyTrades, listStrategyTests, listStrategyForward, getBrokerNowMs } from '@/lib/data';

const SL = 'strategy-lab';
export async function LenhMt5() {
  let initial = { range: '24h', grouped: true, hideClosed: false, sort: 'equity' };
  try { const slf = (await cookies()).get('slf2')?.value; if (slf) initial = { ...initial, ...JSON.parse(decodeURIComponent(slf)) }; } catch { /* cookie hỏng thì dùng mặc định */ }
  const [trades, tests, forward, brokerNowMs] = await Promise.all([listStrategyTrades(), listStrategyTests(SL), listStrategyForward(), getBrokerNowMs()]);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Link href={`/p/${SL}/strategy-tests`} style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>🔬 Strategy Tests →</Link>
      </div>
      <OrdersBlotter trades={trades} tests={tests} forward={forward} brokerNowMs={brokerNowMs} initial={initial} />
    </div>
  );
}
