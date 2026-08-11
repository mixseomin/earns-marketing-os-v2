'use client';

// Chỉ số của MỘT account — 2 nguồn tách bạch, dùng chung cho mọi bề mặt
// (drawer account, vault card, bảng /seeding, drawer browser profile):
//   • platform_accounts.account_stats (jsonb) — ext Crew scrape từ chính platform
//     (karma / followers / posts / joined…). Key TUỲ platform → render generic,
//     chỉ đẹp-hoá key đã biết; key lạ vẫn hiện thay vì bị nuốt.
//   • activity — account này đã làm gì trong MOS2 (brief / bài đăng / việc /
//     tương tác). 1 query lazy, CHỈ gọi trong drawer, không gọi cho list row.
// Trước 2026-08-11 account_stats không render ở đâu cả: ext ghi vào DB rồi nằm im.

import { useEffect, useState } from 'react';
import { fmtCompactNum } from '@/lib/format';
import { fmtAgoShort } from '@/lib/time-format';
import { accountActivity, type AccountActivity } from '@/lib/actions/accounts';
import { ExternalLink } from './external-link';

// Key đã gặp thật trong DB (jsonb_each toàn bảng, 2026-08-11) + vài key sát nghĩa.
const META: Record<string, { icon: string; label: string }> = {
  karma:          { icon: '⭐', label: 'karma' },
  link_karma:     { icon: '🔗', label: 'link karma' },
  comment_karma:  { icon: '💬', label: 'comment karma' },
  followers:      { icon: '👥', label: 'followers' },
  following:      { icon: '➡',  label: 'following' },
  subscribers:    { icon: '👥', label: 'subscribers' },
  posts:          { icon: '📝', label: 'posts' },
  reviews:        { icon: '🗒',  label: 'reviews' },
  rating:         { icon: '⭐', label: 'rating' },
  likes_received: { icon: '❤',  label: 'likes' },
  messages:       { icon: '✉',  label: 'messages' },
  unread_messages:{ icon: '✉',  label: 'chưa đọc' },
  balance:        { icon: '💰', label: 'balance' },
  plan:           { icon: '📦', label: 'plan' },
  age_days:       { icon: '📅', label: 'ngày tuổi' },
  joined:         { icon: '📅', label: 'tham gia' },
  created:        { icon: '📅', label: 'tạo' },
  verified_email: { icon: '✓',  label: 'email verified' },
};
// Thứ tự ưu tiên khi cắt bớt (compact) — chỉ số "đánh giá được sức" đứng trước.
const ORDER = ['karma', 'followers', 'subscribers', 'posts', 'comment_karma', 'link_karma',
  'reviews', 'rating', 'likes_received', 'age_days', 'joined', 'created'];
// Key nhận diện, không phải chỉ số.
const SKIP = new Set(['fetched_at', 'captured', 'username', 'name', 'user_id', 'type', 'note',
  'profile', 'handle', 'id']);
// Cờ an toàn: chỉ kêu khi TRUE (đỏ = tín hiệu), false thì im.
const FLAGS: Record<string, string> = {
  suspended: '⛔ suspended', shadowbanned: '👻 shadowbanned', banned: '⛔ banned', locked: '🔒 locked',
};

interface Chip { key: string; text: string; title: string; bad?: boolean }

export function statChips(stats: Record<string, unknown> | null | undefined): Chip[] {
  if (!stats || typeof stats !== 'object') return [];
  const out: Chip[] = [];
  for (const [k, v] of Object.entries(stats)) {
    if (SKIP.has(k) || v == null || v === '') continue;
    if (typeof v === 'boolean' || v === 'true' || v === 'false') {
      const on = v === true || v === 'true';
      if (FLAGS[k]) { if (on) out.push({ key: k, text: FLAGS[k]!, title: `${k} = true`, bad: true }); continue; }
      if (!on) continue;
      out.push({ key: k, text: `✓ ${META[k]?.label ?? k.replace(/_/g, ' ')}`, title: `${k} = true` });
      continue;
    }
    const m = META[k];
    const label = m?.label ?? k.replace(/_/g, ' ');
    const val = typeof v === 'number' ? fmtCompactNum(v) : String(v).slice(0, 24);
    out.push({ key: k, text: `${m?.icon ?? ''}${m?.icon ? ' ' : ''}${val} ${label}`.trim(), title: `${k}: ${String(v)}` });
  }
  const rank = (k: string) => { const i = ORDER.indexOf(k); return i < 0 ? ORDER.length : i; };
  return out.sort((a, b) => (a.bad === b.bad ? rank(a.key) - rank(b.key) : a.bad ? -1 : 1));
}

const chipStyle = (bad?: boolean): React.CSSProperties => ({
  fontSize: 10, padding: '1px 6px', borderRadius: 999, whiteSpace: 'nowrap',
  border: '1px solid var(--line)', color: bad ? 'var(--bad)' : 'var(--fg-2)',
  fontFamily: 'var(--font-mono)',
});

// Compact — cho list row / bảng / drawer browser. Không query gì thêm: đọc
// account_stats đã nằm sẵn trong row.
export function AccountStatChips({ stats, max = 3 }: {
  stats: Record<string, unknown> | null | undefined; max?: number;
}) {
  const chips = statChips(stats);
  if (!chips.length) return null;
  const shown = chips.slice(0, max);
  const rest = chips.length - shown.length;
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      {shown.map((c) => <span key={c.key} title={c.title} style={chipStyle(c.bad)}>{c.text}</span>)}
      {rest > 0 && (
        <span title={chips.slice(max).map((c) => c.title).join('\n')}
              style={{ ...chipStyle(), color: 'var(--fg-3)' }}>+{rest}</span>
      )}
    </span>
  );
}

// Panel đầy đủ — dùng trong account drawer. Chỉ số platform + hoạt động MOS2.
export function AccountMetricsPanel({ accountId, stats, profileUrl }: {
  accountId: number;
  stats: Record<string, unknown> | null | undefined;
  profileUrl?: string | null;
}) {
  const [act, setAct] = useState<AccountActivity | null>(null);
  useEffect(() => {
    let live = true;
    accountActivity(accountId).then((a) => { if (live) setAct(a); }).catch(() => {});
    return () => { live = false; };
  }, [accountId]);

  const chips = statChips(stats);
  const fetchedAt = typeof stats?.fetched_at === 'string' ? stats.fetched_at : null;
  const ago = fetchedAt ? fmtAgoShort(new Date(fetchedAt).getTime()) : '';
  const lbl: React.CSSProperties = {
    fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
    textTransform: 'uppercase', letterSpacing: '.06em',
  };
  const actChips: Array<[string, number | string, string]> = act ? [
    ['🏘', act.briefs, 'community đang seed (community_briefs)'],
    ['📝', act.posts, 'bài đã đăng (cards có post_url)'],
    ['🗒', `${act.tasksOpen}/${act.tasksOpen + act.tasksDone}`, 'việc còn mở / tổng việc gắn account này'],
    ['💬', act.interactions, 'tương tác đã ghi (interactions)'],
    ['📰', act.publications, 'publication đang theo dõi'],
  ] : [];

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg-1)', padding: '8px 10px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={lbl}>Chỉ số trên platform</span>
        <span style={{ flex: 1 }} />
        {ago && <span style={{ ...lbl, textTransform: 'none' }} title={`ext Crew cập nhật lúc ${fetchedAt}`}>ext quét {ago} trước</span>}
      </div>
      {chips.length ? (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {chips.map((c) => <span key={c.key} title={c.title} style={chipStyle(c.bad)}>{c.text}</span>)}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.45 }}>
          Chưa quét được chỉ số nào.{' '}
          {profileUrl
            ? <ExternalLink href={profileUrl} style={{ color: 'var(--accent)' }}>↗ Mở profile</ExternalLink>
            : 'Mở profile của account'} bằng Chrome có ext Crew → ext tự lưu karma/followers/ngày tham gia.
        </div>
      )}

      <div style={{ ...lbl, marginTop: 10, marginBottom: 5 }}>Hoạt động trong MOS2</div>
      {act ? (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {actChips.map(([icon, val, title]) => (
            <span key={title} title={title} style={chipStyle()}>{icon} {val}</span>
          ))}
          {act.lastPostedAt && (
            <span title={`Bài gần nhất: ${act.lastPostedAt}`} style={chipStyle()}>
              🕒 đăng {fmtAgoShort(new Date(act.lastPostedAt).getTime())} trước
            </span>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--fg-4)' }}>đang đếm…</div>
      )}
    </div>
  );
}
