'use client';

// PostFiltersBar — chips toolbar filter cho list posts trong PostsForPhase.
// Trước đây chỉ filter content_type. Giờ multi-dimension:
//   - Trạng thái đăng: ⏳ Chưa đăng / ✓ Đã đăng
//   - Loại bài (content_type): text/image/video/link/...
//   - Trụ cột (pillar)
//   - Channel (Discord/Slack/Telegram)
//   - Ngôn ngữ (lang)
//   - Quality flags: 📷 Có media / 📝 Có nội dung
//
// UX: chips inline, click toggle, multiple chips có thể active cùng lúc.
// Auto-hide dimension nếu chỉ có 1 value (vd brief chỉ có 1 pillar → không
// hiện row "Trụ cột" để gọn).

import { memo } from 'react';
import { FormatIcon } from './ui';
import { formatMeta, formatColors } from '@/lib/content-formats';
import type { BriefPost } from '@/lib/actions/brief-posts';

export interface PostFilters {
  /** 'all' | 'text' | 'image' | ... */
  contentType: string;
  /**
   * 'all' | 'posted' | 'unposted' | 'removed'
   * - 'posted' = mặc định LOẠI removed-by-mod + self-deleted (chỉ live / ghosted / null / low-engagement)
   * - 'removed' = chỉ show removed-by-mod + self-deleted (cards đã bị xoá / mod xoá)
   */
  postStatus: 'all' | 'posted' | 'unposted' | 'removed';
  /** 'all' | pillarId string */
  pillarId: string;
  /** 'all' | channelId string */
  channelId: string;
  /** 'all' | lang code */
  lang: string;
  /** all | needs-media | has-media */
  media: 'all' | 'needs' | 'has';
}

export const EMPTY_FILTERS: PostFilters = {
  contentType: 'all',
  postStatus: 'all',
  pillarId: 'all',
  channelId: 'all',
  lang: 'all',
  media: 'all',
};

export function isFilterActive(f: PostFilters): boolean {
  return f.contentType !== 'all'
      || f.postStatus !== 'all'
      || f.pillarId !== 'all'
      || f.channelId !== 'all'
      || f.lang !== 'all'
      || f.media !== 'all';
}

// Lifecycle classified "removed" — comment đã không còn live, ẩn khỏi tab
// "Đã đăng" mặc định vì user không cần re-engage nữa.
const REMOVED_LIFECYCLES = new Set(['removed-by-mod', 'self-deleted']);

/** Apply filters to list. Pure function — easy test. */
export function applyPostFilters(posts: BriefPost[], f: PostFilters): BriefPost[] {
  return posts.filter((p) => {
    if (f.contentType !== 'all' && (p.contentType || 'text') !== f.contentType) return false;
    // Tab "Tất cả" cũng ẩn removed/self-deleted mặc định (user feedback:
    // 'để các seed removed ẩn default đi'). Chỉ tab "🗑 Removed" mới show
    // các card này — explicit opt-in để xem history.
    if (f.postStatus === 'all') {
      if (p.postLifecycle && REMOVED_LIFECYCLES.has(p.postLifecycle)) return false;
    }
    if (f.postStatus === 'posted') {
      if (!p.postUrl) return false;
      // Posted mặc định ẩn các card đã removed (mod xoá hoặc self-delete)
      if (p.postLifecycle && REMOVED_LIFECYCLES.has(p.postLifecycle)) return false;
    }
    if (f.postStatus === 'unposted' && p.postUrl) return false;
    if (f.postStatus === 'removed') {
      // Chỉ show removed/self-deleted
      if (!p.postLifecycle || !REMOVED_LIFECYCLES.has(p.postLifecycle)) return false;
    }
    if (f.pillarId !== 'all') {
      const pid = p.pillarId != null ? String(p.pillarId) : 'none';
      if (pid !== f.pillarId) return false;
    }
    if (f.channelId !== 'all') {
      const cid = p.channelId != null ? String(p.channelId) : 'none';
      if (cid !== f.channelId) return false;
    }
    if (f.lang !== 'all' && (p.targetLang || 'en') !== f.lang) return false;
    if (f.media === 'has' && p.mediaAssetId == null) return false;
    if (f.media === 'needs') {
      // "Needs media" = content_type visual (image/carousel/story) mà chưa có media.
      const isVisual = ['image', 'carousel', 'story', 'video'].includes(p.contentType || 'text');
      if (!isVisual || p.mediaAssetId != null) return false;
    }
    return true;
  });
}

// ── UI ───────────────────────────────────────────────────────────────

interface ChipProps {
  active: boolean;
  count?: number;
  color?: { fg: string; bg: string; border: string };
  icon?: React.ReactNode;
  label: React.ReactNode;
  onClick: () => void;
  title?: string;
}

function Chip({ active, count, color, icon, label, onClick, title }: ChipProps) {
  return (
    <button type="button" onClick={onClick} title={title}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', fontSize: 10.5, borderRadius: 999, cursor: 'pointer',
              border: `1px solid ${active ? (color?.fg ?? 'var(--accent)') : (color?.border ?? 'var(--line)')}`,
              background: active ? (color?.bg ?? 'var(--accent-soft)') : 'var(--bg-2)',
              color: active ? (color?.fg ?? 'var(--accent)') : (color?.fg ?? 'var(--fg-2)'),
              fontWeight: active ? 700 : 400,
              whiteSpace: 'nowrap',
            }}>
      {icon}
      {label}
      {count != null && <span style={{ color: 'var(--fg-4)', fontSize: 9.5 }}>{count}</span>}
    </button>
  );
}

interface PillarMeta { id: number; name: string }
interface ChannelMeta { id: number; name: string }

export interface PostFiltersBarProps {
  posts: BriefPost[];
  filters: PostFilters;
  onChange: (next: PostFilters) => void;
  pillars?: PillarMeta[];
  channels?: ChannelMeta[];
}

function PostFiltersBarImpl({ posts, filters, onChange, pillars, channels }: PostFiltersBarProps) {
  const total = posts.length;
  if (total === 0) return null;

  // Count by dimension
  const byType = new Map<string, number>();
  const byPillar = new Map<string, { count: number; name: string }>();
  const byChannel = new Map<string, { count: number; name: string }>();
  const byLang = new Map<string, number>();
  let posted = 0; let unposted = 0; let removed = 0;
  let hasMedia = 0; let needsMedia = 0;

  for (const p of posts) {
    const ct = p.contentType || 'text';
    byType.set(ct, (byType.get(ct) ?? 0) + 1);

    const pid = p.pillarId != null ? String(p.pillarId) : 'none';
    const pname = p.pillarName || (pid === 'none' ? '(không gắn)' : `#${pid}`);
    const existing = byPillar.get(pid);
    byPillar.set(pid, { count: (existing?.count ?? 0) + 1, name: pname });

    const cid = p.channelId != null ? String(p.channelId) : 'none';
    const cname = p.channelName || (cid === 'none' ? '(habitat-level)' : `#${cid}`);
    const existingCh = byChannel.get(cid);
    byChannel.set(cid, { count: (existingCh?.count ?? 0) + 1, name: cname });

    const lang = p.targetLang || 'en';
    byLang.set(lang, (byLang.get(lang) ?? 0) + 1);

    // Posted count: trừ các card đã removed/self-deleted (đã không còn live).
    // Removed count: track riêng cho chip "🗑 Removed".
    if (p.postUrl) {
      const isRemoved = p.postLifecycle && REMOVED_LIFECYCLES.has(p.postLifecycle);
      if (isRemoved) removed++;
      else posted++;
    } else {
      unposted++;
    }
    if (p.mediaAssetId != null) hasMedia++;
    const isVisual = ['image', 'carousel', 'story', 'video'].includes(ct);
    if (isVisual && p.mediaAssetId == null) needsMedia++;
  }

  const set = <K extends keyof PostFilters>(key: K, value: PostFilters[K]) =>
    onChange({ ...filters, [key]: value });
  const toggle = <K extends keyof PostFilters>(key: K, value: PostFilters[K]) =>
    onChange({ ...filters, [key]: filters[key] === value ? ('all' as PostFilters[K]) : value });

  const active = isFilterActive(filters);
  const filteredCount = applyPostFilters(posts, filters).length;

  // Auto-hide dimension nếu chỉ có 1 group (không có lựa chọn để lọc).
  const showTypeRow = byType.size >= 2;
  const showPillarRow = byPillar.size >= 2;
  const showChannelRow = byChannel.size >= 2;
  const showLangRow = byLang.size >= 2;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      padding: '6px 8px', background: 'var(--bg-1)',
      border: '1px solid var(--line)', borderRadius: 5, marginBottom: 6,
    }}>
      {/* Row 1: trạng thái đăng + media (luôn hiện) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <span style={lblStyle}>trạng thái:</span>
        {/* 'Tất cả' = mọi card TRỪ removed (default ẩn) — count = total - removed.
            Click chip 'Removed' explicit để xem các card đã bị mod xoá / self-delete. */}
        <Chip active={filters.postStatus === 'all'} label="Tất cả" count={total - removed}
              title={removed > 0 ? `${total - removed} card visible (${removed} removed ẩn — click chip 🗑 Removed để xem)` : undefined}
              onClick={() => set('postStatus', 'all')} />
        {unposted > 0 && (
          <Chip active={filters.postStatus === 'unposted'} count={unposted}
                color={{ fg: 'var(--warn)', bg: 'rgba(251,191,36,.12)', border: 'rgba(251,191,36,.4)' }}
                icon="⏳" label="Chưa đăng"
                title="Bài chưa có post_url — đang chờ đăng"
                onClick={() => toggle('postStatus', 'unposted')} />
        )}
        {posted > 0 && (
          <Chip active={filters.postStatus === 'posted'} count={posted}
                color={{ fg: 'var(--ok)', bg: 'rgba(74,222,128,.12)', border: 'rgba(74,222,128,.4)' }}
                icon="✓" label="Đã đăng"
                title="Bài có post_url + chưa removed (live / ghosted / null lifecycle)"
                onClick={() => toggle('postStatus', 'posted')} />
        )}
        {removed > 0 && (
          <Chip active={filters.postStatus === 'removed'} count={removed}
                color={{ fg: 'var(--bad)', bg: 'rgba(248,113,113,.12)', border: 'rgba(248,113,113,.4)' }}
                icon="🗑" label="Removed"
                title="Bài đã removed-by-mod hoặc self-deleted (comment không còn live)"
                onClick={() => toggle('postStatus', 'removed')} />
        )}
        {needsMedia > 0 && (
          <Chip active={filters.media === 'needs'} count={needsMedia}
                color={{ fg: 'var(--bad)', bg: 'rgba(248,113,113,.12)', border: 'rgba(248,113,113,.4)' }}
                icon="📷" label="Cần ảnh"
                title="Bài visual (image/carousel/story/video) chưa có media"
                onClick={() => toggle('media', 'needs')} />
        )}
        {hasMedia > 0 && (
          <Chip active={filters.media === 'has'} count={hasMedia}
                icon="🖼" label="Có media"
                title="Bài đã gắn media asset"
                onClick={() => toggle('media', 'has')} />
        )}
        <span style={{ flex: 1 }} />
        {active && (
          <>
            <span style={{ fontSize: 9.5, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
              {filteredCount}/{total} bài
            </span>
            <button type="button" onClick={() => onChange(EMPTY_FILTERS)}
                    title="Xoá tất cả bộ lọc"
                    style={{ fontSize: 10, padding: '1px 6px', background: 'transparent',
                             color: 'var(--fg-3)', border: '1px solid var(--line)',
                             borderRadius: 3, cursor: 'pointer' }}>
              × Xoá lọc
            </button>
          </>
        )}
      </div>

      {/* Row 2: content type */}
      {showTypeRow && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <span style={lblStyle}>loại:</span>
          <Chip active={filters.contentType === 'all'} label="Tất cả" count={total}
                onClick={() => set('contentType', 'all')} />
          {[...byType.entries()].sort((a, b) => b[1] - a[1]).map(([ct, n]) => {
            const col = formatColors(ct);
            return (
              <Chip key={ct} active={filters.contentType === ct} count={n}
                    color={{ fg: col.fg, bg: col.bg, border: col.border }}
                    icon={<FormatIcon kind={ct} size={11} />} label={formatMeta(ct).label}
                    onClick={() => toggle('contentType', ct)} />
            );
          })}
        </div>
      )}

      {/* Row 3: pillar (nếu có nhiều) */}
      {showPillarRow && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <span style={lblStyle}>trụ cột:</span>
          <Chip active={filters.pillarId === 'all'} label="Tất cả"
                onClick={() => set('pillarId', 'all')} />
          {[...byPillar.entries()].sort((a, b) => b[1].count - a[1].count).map(([id, { count, name }]) => (
            <Chip key={id} active={filters.pillarId === id} count={count}
                  label={name}
                  onClick={() => toggle('pillarId', id)} />
          ))}
          {/* Mention pillar registry chỉ để type-safe (chưa dùng) */}
          {void pillars}
        </div>
      )}

      {/* Row 4: channel (Discord/Slack nhiều channel) */}
      {showChannelRow && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <span style={lblStyle}>channel:</span>
          <Chip active={filters.channelId === 'all'} label="Tất cả"
                onClick={() => set('channelId', 'all')} />
          {[...byChannel.entries()].sort((a, b) => b[1].count - a[1].count).map(([id, { count, name }]) => (
            <Chip key={id} active={filters.channelId === id} count={count}
                  label={name.startsWith('#') ? name : `#${name}`}
                  onClick={() => toggle('channelId', id)} />
          ))}
          {void channels}
        </div>
      )}

      {/* Row 5: ngôn ngữ (nếu có nhiều) */}
      {showLangRow && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <span style={lblStyle}>ngôn ngữ:</span>
          <Chip active={filters.lang === 'all'} label="Tất cả"
                onClick={() => set('lang', 'all')} />
          {[...byLang.entries()].sort((a, b) => b[1] - a[1]).map(([lang, count]) => (
            <Chip key={lang} active={filters.lang === lang} count={count}
                  label={lang.toUpperCase()}
                  onClick={() => toggle('lang', lang)} />
          ))}
        </div>
      )}
    </div>
  );
}

const lblStyle: React.CSSProperties = {
  fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)',
  textTransform: 'uppercase', letterSpacing: '.04em', minWidth: 60,
};

export const PostFiltersBar = memo(PostFiltersBarImpl);
PostFiltersBar.displayName = 'PostFiltersBar';
