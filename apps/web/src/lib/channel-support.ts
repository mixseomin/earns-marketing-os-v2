// ── channel-support — tổng quát hóa "channel" cho NHIỀU loại community ──
// Channel (habitat_channels) = sub-area trong 1 habitat có rules/tone/format riêng,
// NHƯNG cùng 1 membership/join. Ban đầu chỉ Discord/Slack/Telegram; mở rộng cho
// FORUM (sub-forum/board: XenForo/vBulletin/phpBB/Discourse…). Xem
// wiki/mos/habitat-taxonomy.md "Sub-forum / Discord channel".
//
// 2 tầng quyết định:
//  - EDITOR (habitat modal): hiện tab channels cho platform/kind hỗ trợ → dùng
//    platformSupportsChannels() (kind/technology-based).
//  - PICK/COVERAGE (card-channel, brief-posts, coverage grid): DATA-DRIVEN — habitat
//    CÓ channel rows thì áp dụng, bất kể platform. Không cần list cứng.

const MULTI_CHANNEL_PLATFORMS = new Set(['discord', 'slack', 'telegram']);
// Forum technologies (technology_key) có sub-forum → mỗi sub-forum = 1 channel.
const FORUM_TECHNOLOGIES = new Set([
  'xenforo', 'vbulletin', 'phpbb', 'discourse', 'mybb', 'invision',
  'simplemachines', 'smf', 'flarum', 'nodebb', 'wordpress', 'ipboard',
]);

export interface ChannelScope {
  platformKey?: string | null;
  kind?: string | null;            // habitats.kind: discord|slack|telegram|forum|subreddit|…
  technologyKey?: string | null;   // habitats.technology_key (forum technology)
}

// Platform/habitat này CÓ khái niệm sub-area (channel) không → hiện editor channels.
export function platformSupportsChannels(s: ChannelScope): boolean {
  const pk = (s.platformKey ?? '').toLowerCase();
  const kind = (s.kind ?? '').toLowerCase();
  const tech = (s.technologyKey ?? '').toLowerCase();
  if (MULTI_CHANNEL_PLATFORMS.has(pk)) return true;
  if (MULTI_CHANNEL_PLATFORMS.has(kind)) return true;   // kind=discord/slack/telegram
  if (kind === 'forum') return true;                    // forum → sub-forums
  if (tech && FORUM_TECHNOLOGIES.has(tech)) return true;     // forum technology
  return false;
}

// Stable key cho 1 sub-forum từ URL → externalId của habitat_channels (match khi sync
// rules + tránh duplicate). XenForo /forums/<slug>.<id>/ → "<slug>.<id>"; vBulletin/phpBB
// f=<id> → "f<id>"; Discourse /c/<slug>/<id> → "c<id>". Null nếu không nhận ra.
export function forumSubForumKey(url: string | null | undefined): string | null {
  if (!url) return null;
  const u = String(url);
  let m = u.match(/\/forums\/([^/]+\.\d+)\/?(?:\?|#|$)/);          // XenForo
  if (m?.[1]) return m[1];
  m = u.match(/(?:forumdisplay|viewforum)\.php\?(?:[^#]*&)?f=(\d+)/); // vBulletin / phpBB
  if (m?.[1]) return `f${m[1]}`;
  m = u.match(/\/c\/(?:[-\w/]+\/)?(\d+)(?:\?|#|$)/);                 // Discourse
  if (m?.[1]) return `c${m[1]}`;
  return null;
}

// Nhãn phù hợp platform: forum → "sub-forum", còn lại → "channel".
export function channelNoun(s: ChannelScope): { singular: string; plural: string; emoji: string } {
  const kind = (s.kind ?? '').toLowerCase();
  const tech = (s.technologyKey ?? '').toLowerCase();
  const isForum = kind === 'forum' || (!!tech && FORUM_TECHNOLOGIES.has(tech));
  return isForum
    ? { singular: 'sub-forum', plural: 'Sub-forums', emoji: '🗂' }
    : { singular: 'channel', plural: 'Channels', emoji: '📺' };
}
