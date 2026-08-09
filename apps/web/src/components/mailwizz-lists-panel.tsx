import { unstable_cache } from 'next/cache';
import { mailwizzAllLists, type MailwizzList } from '@/lib/mailwizz';
import { Panel, StatsStrip, SimpleTable, Section, type SimpleColumn } from '@/components/ui';

// THEO DÕI EMAIL LIST — trang chủ. Mỗi sản phẩm một list, nên bảng này trả lời đúng một câu:
// list nào thật sự gom được người, list nào là xác.
//
// Async server component TỰ ĐỌC (khuôn awin-daily-panel), KHÔNG nhét vào Promise.all của page.tsx:
// mấy loader ở đó là Postgres cùng máy, còn MailWizz là MySQL box2 qua tunnel — trộn vào thì tunnel
// chết kéo sập luôn thời gian mở trang chủ. Bọc <Suspense> ở chỗ gọi để trang ra trước, bảng điền sau.
//
// 46/47 list hiện có 0 người gửi được (rác nhập từ MailChimp scrape). Đổ phẳng 47 dòng thì dòng DUY
// NHẤT đáng nhìn chìm mất — nên chia 3 tầng, chỉ tầng "đang có người" mở sẵn.

const loadLists = unstable_cache(mailwizzAllLists, ['mailwizz-lists'], { revalidate: 300, tags: ['mailwizz'] });

const num = (n: number) => n.toLocaleString('en-US');
const daysAgo = (iso: string | null) => {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? 'hôm nay' : `${d} ngày trước`;
};

const link: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-2)', textDecoration: 'none',
  border: '1px solid var(--line)', borderRadius: 6, padding: '5px 10px',
};

export async function MailwizzListsPanel() {
  let snap: Awaited<ReturnType<typeof mailwizzAllLists>> | null = null;
  let err = '';
  try { snap = await loadLists(); } catch (e) { err = (e as Error).message; }

  // Hỏng phải NÓI hỏng. Ẩn panel hay hiện 0 đều làm người xem tin là "chưa ai đăng ký".
  if (!snap) {
    return (
      <Panel title="✉ Email lists" subtitle="MailWizz">
        <div style={{ fontSize: 12, color: 'var(--bad)' }}>Không đọc được MailWizz: {err}</div>
        <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
          kiểm tunnel: systemctl status mailwizz-tunnel (box3 → box2:3306)
        </div>
      </Panel>
    );
  }

  const live = snap.lists.filter((l) => l.confirmed > 0);
  const dead = snap.lists.filter((l) => l.confirmed === 0 && l.total > 0)
    .sort((a, b) => b.unsubscribed - a.unsubscribed || a.name.localeCompare(b.name));
  const empty = snap.lists.filter((l) => l.total === 0).sort((a, b) => a.name.localeCompare(b.name));
  const lastAll = snap.lists.reduce<string | null>((m, l) => (l.last && (!m || l.last > m) ? l.last : m), null);
  const owners = [...new Set(snap.lists.map((l) => l.owner).filter(Boolean))];
  const showOther = snap.lists.some((l) => l.other > 0);

  const cols: SimpleColumn<MailwizzList>[] = [
    {
      key: 'list', header: 'List',
      cell: (l) => (
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
            <span style={{ fontWeight: 600 }}>{l.name}</span>
            {l.status !== 'active' && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', color: 'var(--fg-3)' }}>[{l.status}]</span>
            )}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)' }}>{l.uid}</div>
        </div>
      ),
    },
    {
      key: 'confirmed', header: 'Gửi được', align: 'right',
      cell: (l) => <span style={{ fontVariantNumeric: 'tabular-nums', color: l.confirmed ? undefined : 'var(--fg-3)' }}>{num(l.confirmed)}</span>,
    },
    {
      key: 'unsub', header: 'Đã huỷ', align: 'right',
      cell: (l) => <span style={{ fontVariantNumeric: 'tabular-nums', color: l.unsubscribed ? undefined : 'var(--fg-3)' }}>{num(l.unsubscribed)}</span>,
    },
    // Cột chỉ xuất hiện khi có số — hôm nay mọi list đều 0, in ra một cột toàn số 0 là nhiễu.
    ...(showOther ? [{
      key: 'other', header: 'Khác', align: 'right' as const,
      title: 'unconfirmed / blacklisted / disabled — chưa gửi được nhưng cũng chưa huỷ',
      cell: (l: MailwizzList) => <span style={{ fontVariantNumeric: 'tabular-nums', color: l.other ? undefined : 'var(--fg-3)' }}>{num(l.other)}</span>,
    }] : []),
    {
      key: 'last', header: 'Người mới gần nhất', align: 'right',
      cell: (l) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>{l.last ? `${l.last.slice(0, 10)} · ${daysAgo(l.last)}` : '—'}</span>,
    },
  ];

  return (
    <Panel
      title="✉ Email lists"
      subtitle={`${snap.lists.length} list${owners.length === 1 ? ` · ${owners[0]}` : ''} · đọc lúc ${snap.readAt.slice(11, 16)}`}
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/p/coldmail" style={link}>Coldmail →</a>
          <a href="https://mail.on.tc/customer/index.php?/lists" target="_blank" rel="noopener noreferrer" style={link}>MailWizz ↗</a>
        </div>
      }
    >
      <StatsStrip
        minColWidth={110}
        cards={[
          {
            key: 'people', label: 'Gửi được', value: num(snap.people - (snap.blocked ?? 0)),
            sub: [
              snap.confirmedRows !== snap.people ? `${num(snap.confirmedRows)} hàng` : '',
              snap.blocked === null ? 'không kiểm được blacklist' : snap.blocked > 0 ? `${num(snap.blocked)} bị chặn` : '',
            ].filter(Boolean).join(' · ') || undefined,
          },
          { key: 'lists', label: 'Lists', value: String(snap.lists.length), sub: `${live.length} có người · ${dead.length} chỉ huỷ · ${empty.length} rỗng` },
          { key: 'unsub', label: 'Đã huỷ', value: num(snap.lists.reduce((n, l) => n + l.unsubscribed, 0)) },
          { key: 'last', label: 'Người mới gần nhất', value: lastAll ? lastAll.slice(0, 10) : '—', sub: daysAgo(lastAll) ?? undefined },
        ]}
      />

      <div style={{ marginTop: 12 }}>
        {live.length
          ? <SimpleTable rows={live} columns={cols} getRowKey={(l) => l.uid} />
          : <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Chưa list nào có người gửi được.</div>}
      </div>

      {dead.length > 0 && (
        <Section title="Chỉ còn người đã huỷ" defaultOpen={false} headerRight={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>{dead.length}</span>}>
          <SimpleTable rows={dead} columns={cols} getRowKey={(l) => l.uid} />
        </Section>
      )}

      {empty.length > 0 && (
        <Section title="List rỗng" defaultOpen={false} headerRight={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>{empty.length}</span>}>
          {/* Không dựng bảng cho nhóm này: 37 dòng × 5 cột toàn số 0 là nhiễu thuần tuý. */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.7, color: 'var(--fg-3)' }}>
            {empty.map((l) => l.name).join('  ·  ')}
          </div>
          <div style={{ fontSize: 10, color: 'var(--fg-4)', marginTop: 6 }}>
            phần lớn là list nhập từ MailChimp scrape — dọn ở MailWizz console
          </div>
        </Section>
      )}
    </Panel>
  );
}
