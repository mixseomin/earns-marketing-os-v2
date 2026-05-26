'use client';

// JoinStatusBanner — tầng MEMBERSHIP giữa account.status (global) và
// currentPhase (engagement). Extracted từ brief-edit-modal trong refactor
// 2026-05-22 (file modal trước đó 3500+ LOC). Xem
// [[project-mos2-account-status-two-levels]] cho design rationale.
//
// Behavior: 1-click mark joined / pending / rejected / kicked / left với
// context phù hợp. Hiển thị banner thay vì hidden form vì JOIN STATE LÀ
// GATE — không join = không seed = không warm. User cần thấy rõ trạng thái.

import { memo, useState, useTransition, type CSSProperties } from 'react';
import { setBriefJoinStatus } from '@/lib/actions/community-briefs';
import {
  JOIN_STATUS_LABEL, JOIN_STATUS_COLOR, JOIN_STATUS_ICON,
  type JoinStatus,
} from '@/lib/join-status';
import { TextField, TextAreaField } from './ui';

// Habitat context — đủ thông tin để user "biết phải làm gì khi join":
// name + kind (Discord server vs subreddit vs FB group có flow khác),
// members (cảnh giác community nhỏ), modStrictness + rules (cần intro post
// trước không?), min karma/age (account đủ điều kiện chưa?), dominant/
// forbidden topics (post gì vào để được approve).
// Account context — user cần biết ĐANG join community NÀY cho ACCOUNT NÀO.
// Bắt buộc cho modal multi-account: 1 habitat có 3 briefs (3 accounts) → mở
// nhầm modal cũng phải biết account nào đang được sửa state.
export interface AccountJoinContext {
  handle: string | null;          // @oritapp (no '@' prefix)
  platformLabel: string;          // "Reddit" / "Discord" / ...
  status: string;                 // active|banned|cooling|...
  blockReason?: string | null;    // lý do nếu banned
  avatarUrl?: string | null;      // ảnh đại diện account
}

export interface HabitatJoinContext {
  name: string;
  kind: string;                 // discord-server, subreddit, fb-group, ...
  url: string | null;
  members: number;
  language: string;
  status: string;               // active|saturated|fading|defunct
  modStrictness: string;        // low|medium|high|invite-only
  postingRules: string;         // free-text mod rules
  postingRulesUrl: string;      // external rules page (Reddit wiki, Discord rules channel)
  minAccountAgeDays: number;
  minKarma: number;
  minPosts: number;
  dominantTopics: string[];
  forbiddenTopics: string[];
  tribeName: string | null;
  habitatIconUrl: string | null;
}

export interface JoinStatusBannerProps {
  projectId: string;
  briefId: number;
  habitatLabel: string;
  habitatUrl: string | null;
  joinStatus: JoinStatus;
  joinedAt: string | null;
  joinUrl: string;
  joinNote: string;
  /** Habitat context cho popover edit — nếu không pass, popover chỉ có form
      cơ bản (URL + note). Pass vào để show "yêu cầu join" + "cấm/khuyến khích". */
  habitatInfo?: HabitatJoinContext | null;
  /** Account context — render ở popover header để user biết ĐANG sửa membership
      cho account NÀO (cần khi 1 habitat có nhiều briefs từ nhiều accounts). */
  accountInfo?: AccountJoinContext | null;
  /** Click "Mở chi tiết habitat" trong popover → mở HabitatFormModal sửa rules.
      Optional vì có thể context view-only. */
  onOpenHabitat?: () => void;
  onChange: (next: JoinStatus, payload?: { joinUrl?: string | null; joinNote?: string | null }) => void;
}

export const JoinStatusBanner = memo(JoinStatusBannerImpl);
JoinStatusBanner.displayName = 'JoinStatusBanner';

function JoinStatusBannerImpl({
  projectId, briefId, habitatLabel, habitatUrl,
  joinStatus, joinedAt, joinUrl, joinNote,
  habitatInfo, accountInfo, onOpenHabitat, onChange,
}: JoinStatusBannerProps) {
  const [editing, setEditing] = useState(false);
  const [, startTrans] = useTransition();
  const [editUrl, setEditUrl] = useState(joinUrl);
  const [editNote, setEditNote] = useState(joinNote);
  const [busy, setBusy] = useState(false);

  const color = JOIN_STATUS_COLOR[joinStatus];
  const icon = JOIN_STATUS_ICON[joinStatus];
  const label = JOIN_STATUS_LABEL[joinStatus];

  const handleSet = (next: JoinStatus) => {
    setBusy(true);
    startTrans(async () => {
      const res = await setBriefJoinStatus(projectId, briefId, {
        joinStatus: next,
        joinUrl: editUrl.trim() || null,
        joinNote: editNote.trim() || null,
      });
      setBusy(false);
      if (res.ok) {
        onChange(next, { joinUrl: editUrl.trim() || null, joinNote: editNote.trim() || null });
        setEditing(false);
        if (res.warnings?.length) {
          console.warn('Join status warnings:', res.warnings);
        }
      }
    });
  };

  // joined → banner xanh compact (1 dòng) - happy path
  if (joinStatus === 'joined') {
    return (
      <div style={{
        margin: '8px 16px 0', padding: '6px 10px',
        background: color + '12', border: `1px solid ${color}44`,
        borderRadius: 5, display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 11, fontFamily: 'var(--font-mono)',
      }}>
        <span style={{ color, fontWeight: 700 }}>{icon} ĐÃ JOIN</span>
        <span style={{ color: 'var(--fg-3)' }}>
          {habitatLabel}{joinedAt ? ` · từ ${new Date(joinedAt).toLocaleDateString('vi-VN')}` : ''}
        </span>
        {joinNote && (
          <span title={joinNote} style={{ color: 'var(--fg-4)', cursor: 'help' }}>📝</span>
        )}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setEditing(true)}
                title="Sửa trạng thái join (đã rời / bị kick / cập nhật ghi chú)"
                style={{ fontSize: 9.5, padding: '2px 7px', background: 'transparent',
                         color: 'var(--fg-3)', border: '1px solid var(--line)',
                         borderRadius: 3, cursor: 'pointer' }}>
          sửa
        </button>
        {editing && (
          <JoinStatusEditPopover
            current={joinStatus} url={editUrl} note={editNote} busy={busy}
            onSet={handleSet} onClose={() => setEditing(false)}
            onUrlChange={setEditUrl} onNoteChange={setEditNote}
            habitatUrl={habitatUrl}
            habitatInfo={habitatInfo ?? null}
            accountInfo={accountInfo ?? null}
            habitatLabel={habitatLabel}
            onOpenHabitat={onOpenHabitat}
          />
        )}
      </div>
    );
  }

  // Các trạng thái khác: banner warning nổi bật vì BLOCK seeding
  const isPending = joinStatus === 'pending';
  const isDead = joinStatus === 'rejected' || joinStatus === 'kicked' || joinStatus === 'left';
  return (
    <div style={{
      margin: '8px 16px 0', padding: '10px 12px',
      background: color + '15', border: `1px solid ${color}55`,
      borderRadius: 6, display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700,
                         color, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            {icon} {label}
          </span>
          <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>{habitatLabel}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.5 }}>
          {joinStatus === 'not_joined' && (
            <>⚠ Account chưa join community này. <strong style={{ color: 'var(--fg-1)' }}>Phase warm-up + seed sẽ không có ý nghĩa</strong> đến khi joined. Mở community, gửi join request / accept invite, rồi đánh dấu trạng thái.</>
          )}
          {isPending && (
            <>⏳ Đã gửi join request, chờ admin/mod duyệt. <strong style={{ color: 'var(--fg-1)' }}>Chưa nên đăng bài</strong>. Khi được approved → đánh dấu &quot;Đã join&quot;.</>
          )}
          {joinStatus === 'rejected' && (
            <>✗ Bị admin/mod từ chối join. Xem lại lý do, sửa profile/intro rồi thử lại — hoặc đổi sang account khác.</>
          )}
          {joinStatus === 'kicked' && (
            <>🚫 Account đã bị kick sau khi join. Đọc rules, đợi cool-down (1-4 tuần), liên hệ mod nếu cần — hoặc swap account.</>
          )}
          {joinStatus === 'left' && (
            <>↩ Account đã chủ động rời community. Nếu muốn quay lại → join lại + đánh dấu.</>
          )}
        </div>
        {joinNote && (
          <div style={{ marginTop: 6, padding: '4px 8px', fontSize: 10.5,
                        fontFamily: 'var(--font-mono)', color: 'var(--fg-2)',
                        background: 'var(--bg-2)', borderRadius: 3,
                        borderLeft: `2px solid ${color}` }}>
            📝 {joinNote}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
        {joinStatus === 'not_joined' && (
          <>
            {habitatUrl && (
              <a href={habitatUrl} target="_blank" rel="noopener noreferrer"
                 title={`Mở ${habitatLabel} → join thủ công`}
                 style={{ fontSize: 10.5, padding: '4px 9px',
                          background: 'var(--bg-2)', color: 'var(--accent)',
                          border: '1px solid var(--accent-line)', borderRadius: 4,
                          textDecoration: 'none', whiteSpace: 'nowrap' }}>
                ↗ mở community
              </a>
            )}
            <button type="button" onClick={() => handleSet('pending')} disabled={busy}
                    title="Đã gửi join request, chờ admin duyệt"
                    style={joinBtnStyle('#fbbf24')}>
              ⏳ đã gửi request
            </button>
            <button type="button" onClick={() => handleSet('joined')} disabled={busy}
                    title="Account đã trong community (invite accepted / sub joined / group approved)"
                    style={joinBtnStyle('#10b981')}>
              ✓ đã join
            </button>
          </>
        )}
        {isPending && (
          <>
            <button type="button" onClick={() => handleSet('joined')} disabled={busy}
                    style={joinBtnStyle('#10b981')}>
              ✓ approved → joined
            </button>
            <button type="button" onClick={() => handleSet('rejected')} disabled={busy}
                    style={joinBtnStyle('#f87171')}>
              ✗ bị từ chối
            </button>
          </>
        )}
        {isDead && (
          <button type="button" onClick={() => handleSet('not_joined')} disabled={busy}
                  title="Reset về not_joined để thử lại"
                  style={joinBtnStyle('#6b7280')}>
            ↻ reset, thử lại
          </button>
        )}
        <button type="button" onClick={() => setEditing(true)}
                title="Sửa join URL + ghi chú chi tiết"
                style={{ fontSize: 9.5, padding: '2px 7px', background: 'transparent',
                         color: 'var(--fg-3)', border: '1px solid var(--line)',
                         borderRadius: 3, cursor: 'pointer' }}>
          ✎ chi tiết
        </button>
      </div>
      {editing && (
        <JoinStatusEditPopover
          current={joinStatus} url={editUrl} note={editNote} busy={busy}
          onSet={handleSet} onClose={() => setEditing(false)}
          onUrlChange={setEditUrl} onNoteChange={setEditNote}
          habitatUrl={habitatUrl}
          habitatInfo={habitatInfo ?? null}
          accountInfo={accountInfo ?? null}
          habitatLabel={habitatLabel}
          onOpenHabitat={onOpenHabitat}
        />
      )}
    </div>
  );
}

function joinBtnStyle(color: string): CSSProperties {
  return {
    fontSize: 10.5, padding: '4px 9px', fontWeight: 700,
    background: color, color: '#0d1117', border: 'none',
    borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
  };
}

function JoinStatusEditPopover({
  current, url, note, busy, onSet, onClose, onUrlChange, onNoteChange,
  habitatUrl, habitatInfo, accountInfo, habitatLabel, onOpenHabitat,
}: {
  current: JoinStatus; url: string; note: string; busy: boolean;
  habitatUrl: string | null;
  habitatInfo: HabitatJoinContext | null;
  accountInfo: AccountJoinContext | null;
  habitatLabel: string;
  onOpenHabitat?: () => void;
  onSet: (next: JoinStatus) => void;
  onClose: () => void;
  onUrlChange: (v: string) => void;
  onNoteChange: (v: string) => void;
}) {
  const h = habitatInfo;
  const a = accountInfo;
  return (
    <div className="modal-backdrop" style={{ zIndex: 2100 }}
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 'min(640px, 95vw)', padding: 0, display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}
           onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px',
                      borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <span style={{ fontSize: 16 }}>{JOIN_STATUS_ICON[current]}</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 14 }}>Membership state</h3>
            <div style={{ marginTop: 2, fontSize: 11, color: 'var(--fg-3)' }}>{habitatLabel}</div>
          </div>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} className="btn ghost" style={{ fontSize: 13 }}>✕</button>
        </div>

        {/* Body — scrollable */}
        <div style={{ overflowY: 'auto', flex: 1, padding: 16,
                      display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Account context — show "đang sửa membership cho account nào".
              QUAN TRỌNG: 1 habitat thường có nhiều briefs (mỗi account 1 brief),
              user cần thấy rõ account hiện tại để không click nhầm. */}
          {a && <AccountContextPanel info={a} />}

          {/* Habitat context — show "đang quyết định join community nào" */}
          {h && <HabitatContextPanel info={h} habitatUrl={habitatUrl} onOpenHabitat={onOpenHabitat} />}

          {/* Status picker */}
          <div>
            <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)',
                            color: 'var(--fg-3)', textTransform: 'uppercase',
                            letterSpacing: '.06em', marginBottom: 4, fontWeight: 700 }}>
              Trạng thái mới
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {(['not_joined','pending','joined','rejected','kicked','left'] as JoinStatus[]).map((s) => (
                <button key={s} type="button" disabled={busy}
                        onClick={() => onSet(s)}
                        title={JOIN_STATUS_LABEL[s]}
                        style={{
                          padding: '6px 8px', fontSize: 10.5,
                          background: current === s ? JOIN_STATUS_COLOR[s] + '33' : 'var(--bg-2)',
                          color: current === s ? JOIN_STATUS_COLOR[s] : 'var(--fg-2)',
                          border: `1px solid ${current === s ? JOIN_STATUS_COLOR[s] + 'aa' : 'var(--line)'}`,
                          borderRadius: 4, cursor: 'pointer', fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        }}>
                  {JOIN_STATUS_ICON[s]} {JOIN_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <TextField
            type="url"
            label={<>🔗 Join URL <span style={{ color: 'var(--fg-4)', fontWeight: 400 }}>(invite link / request URL)</span></>}
            value={url} onChange={(e) => onUrlChange(e.target.value)}
            placeholder={habitatUrl || 'https://discord.gg/xxx hoặc https://reddit.com/r/...'}
          />
          <TextAreaField
            label="📝 Ghi chú" rows={3} mono
            value={note} onChange={(e) => onNoteChange(e.target.value)}
            placeholder="vd: 'mod yêu cầu intro post', 'phải có 100 karma trước khi post', 'bị shadow ban sau bài 2'"
          />
        </div>

        {/* Footer hint */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line)',
                      background: 'var(--bg-1)', fontSize: 10, color: 'var(--fg-4)',
                      fontStyle: 'italic', flexShrink: 0 }}>
          💡 Bấm 1 button trạng thái phía trên để lưu (auto close).
        </div>
      </div>
    </div>
  );
}

// AccountContextPanel — compact 1-row card hiển thị account đang được sửa
// membership. Persona handle + platform + status badge. Banned/cooling →
// đỏ + warning text vì không nên join community mới khi account đang bị block.
function AccountContextPanel({ info }: { info: AccountJoinContext }) {
  const statusColor = info.status === 'active' ? 'var(--ok)'
                    : info.status === 'banned' || info.status === 'kicked' ? 'var(--bad)'
                    : info.status === 'cooling' || info.status === 'pending' ? 'var(--warn)'
                    : 'var(--fg-3)';
  const isBlocked = info.status === 'banned' || info.status === 'kicked';
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--accent-line)',
                  borderLeft: '3px solid var(--accent)',
                  borderRadius: 6, padding: '10px 12px',
                  display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {info.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={info.avatarUrl} alt="" width={28} height={28}
               style={{ borderRadius: '50%', flexShrink: 0, border: '1px solid var(--line)' }} />
        ) : (
          <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        background: 'var(--bg-1)', border: '1px solid var(--line)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
            {info.handle ? info.handle.charAt(0).toUpperCase() : '?'}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)',
                        textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 1 }}>
            Đang sửa membership cho
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-0)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            @{info.handle ?? 'no-handle'}
            <span style={{ marginLeft: 8, fontSize: 10.5, color: 'var(--fg-3)',
                           fontWeight: 400, fontFamily: 'var(--font-mono)' }}>
              · {info.platformLabel}
            </span>
          </div>
        </div>
        <span title={info.blockReason ?? `Account status: ${info.status}`}
              style={{ padding: '2px 7px', fontSize: 10, fontFamily: 'var(--font-mono)',
                       fontWeight: 700, borderRadius: 3, textTransform: 'uppercase',
                       letterSpacing: '.04em', cursor: info.blockReason ? 'help' : 'default',
                       background: statusColor + '22', color: statusColor,
                       border: `1px solid ${statusColor}66` }}>
          {info.status}
        </span>
      </div>
      {isBlocked && (
        <div style={{ fontSize: 10.5, color: 'var(--bad)', lineHeight: 1.4,
                      padding: '4px 8px', background: 'rgba(248,113,113,.08)',
                      borderRadius: 3 }}>
          ⚠ Account đang bị <strong>{info.status}</strong>
          {info.blockReason ? ` — ${info.blockReason}` : ''}. Không nên join community mới đến khi unblock.
        </div>
      )}
    </div>
  );
}

// HabitatContextPanel — show community info để user biết phải làm gì
// trước khi đánh dấu joined. Compact stat-row + rules section.
function HabitatContextPanel({
  info, habitatUrl, onOpenHabitat,
}: {
  info: HabitatJoinContext;
  habitatUrl: string | null;
  onOpenHabitat?: () => void;
}) {
  const statusColor = info.status === 'active' ? 'var(--ok)'
                    : info.status === 'saturated' ? 'var(--warn)'
                    : info.status === 'defunct' || info.status === 'fading' ? 'var(--bad)'
                    : 'var(--fg-3)';
  const modColor = info.modStrictness === 'high' || info.modStrictness === 'invite-only' ? 'var(--bad)'
                 : info.modStrictness === 'medium' ? 'var(--warn)'
                 : 'var(--ok)';
  // Pre-join gates: account-level requirements community này yêu cầu
  const hasMinReq = info.minAccountAgeDays > 0 || info.minKarma > 0 || info.minPosts > 0;
  // Active link to open in new tab
  const openLink = habitatUrl || info.url;

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)',
                  borderRadius: 6, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header — name + icon + status + open button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {info.habitatIconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={info.habitatIconUrl} alt="" width={28} height={28}
               style={{ borderRadius: 5, flexShrink: 0, border: '1px solid var(--line)' }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-0)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {info.name}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)',
                        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>{info.kind}</span>
            {info.members > 0 && <span>· 👥 {fmtMembers(info.members)}</span>}
            {info.language && <span>· {info.language.toUpperCase()}</span>}
            {info.tribeName && <span>· tribe: {info.tribeName}</span>}
            <span style={{ color: statusColor }}>· {info.status}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {openLink && (
            <a href={openLink} target="_blank" rel="noopener noreferrer"
               title={`Mở community: ${openLink}`}
               style={{ fontSize: 10.5, padding: '4px 9px', textDecoration: 'none',
                        background: 'var(--accent-soft)', color: 'var(--accent)',
                        border: '1px solid var(--accent-line)', borderRadius: 4, fontWeight: 700,
                        whiteSpace: 'nowrap' }}>
              ↗ Mở
            </a>
          )}
          {onOpenHabitat && (
            <button type="button" onClick={onOpenHabitat}
                    title="Mở Habitat modal — sửa rules, posting gates, members count"
                    style={{ fontSize: 10.5, padding: '4px 9px', background: 'transparent',
                             color: 'var(--fg-2)', border: '1px solid var(--line)',
                             borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              ✎ Sửa
            </button>
          )}
        </div>
      </div>

      {/* Mod strictness + min requirements row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                    fontSize: 11, color: 'var(--fg-2)' }}>
        <span title="Mức độ khắt khe của mod khi duyệt join + post">
          <span style={{ color: 'var(--fg-4)' }}>Mod:</span>{' '}
          <strong style={{ color: modColor, textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
            {info.modStrictness || '?'}
          </strong>
        </span>
        {hasMinReq && (
          <span title="Yêu cầu account tối thiểu trước khi post được">
            <span style={{ color: 'var(--fg-4)' }}>Cần:</span>{' '}
            {info.minAccountAgeDays > 0 && <code style={codeStyle}>{info.minAccountAgeDays}d tuổi</code>}
            {info.minKarma > 0 && <code style={codeStyle}>{info.minKarma} karma</code>}
            {info.minPosts > 0 && <code style={codeStyle}>{info.minPosts} posts</code>}
          </span>
        )}
        {info.postingRulesUrl && (
          <a href={info.postingRulesUrl} target="_blank" rel="noopener noreferrer"
             style={{ fontSize: 10.5, color: 'var(--accent)', textDecoration: 'none' }}>
            📖 Rules ↗
          </a>
        )}
      </div>

      {/* Posting rules text (mod requirements) */}
      {info.postingRules && (
        <div style={{ fontSize: 11, color: 'var(--fg-1)', lineHeight: 1.5,
                      padding: '6px 8px', background: 'var(--bg-1)',
                      borderLeft: '2px solid var(--warn)', borderRadius: 3 }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)',
                        textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>
            ⚠ Quy định mod
          </div>
          {info.postingRules}
        </div>
      )}

      {/* Topics grid */}
      {(info.dominantTopics.length > 0 || info.forbiddenTopics.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: info.dominantTopics.length && info.forbiddenTopics.length ? '1fr 1fr' : '1fr', gap: 8 }}>
          {info.dominantTopics.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ok)',
                            textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>
                ✓ Topics phù hợp
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {info.dominantTopics.map((t, i) => (
                  <span key={i} style={topicChipStyle('var(--ok)')}>{t}</span>
                ))}
              </div>
            </div>
          )}
          {info.forbiddenTopics.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--bad)',
                            textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>
                ✗ Cấm kỵ
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {info.forbiddenTopics.map((t, i) => (
                  <span key={i} style={topicChipStyle('var(--bad)')}>{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function fmtMembers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const codeStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10,
  padding: '0 5px', background: 'var(--bg-2)', borderRadius: 3,
  border: '1px solid var(--line)', marginRight: 4,
};

function topicChipStyle(color: string): CSSProperties {
  return {
    fontSize: 10, padding: '1px 6px', borderRadius: 3,
    background: color + '15', color, border: `1px solid ${color}44`,
    fontFamily: 'var(--font-mono)',
  };
}
