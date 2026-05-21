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

export interface JoinStatusBannerProps {
  projectId: string;
  briefId: number;
  habitatLabel: string;
  habitatUrl: string | null;
  joinStatus: JoinStatus;
  joinedAt: string | null;
  joinUrl: string;
  joinNote: string;
  onChange: (next: JoinStatus, payload?: { joinUrl?: string | null; joinNote?: string | null }) => void;
}

export const JoinStatusBanner = memo(JoinStatusBannerImpl);
JoinStatusBanner.displayName = 'JoinStatusBanner';

function JoinStatusBannerImpl({
  projectId, briefId, habitatLabel, habitatUrl,
  joinStatus, joinedAt, joinUrl, joinNote, onChange,
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
  current, url, note, busy, onSet, onClose, onUrlChange, onNoteChange, habitatUrl,
}: {
  current: JoinStatus; url: string; note: string; busy: boolean;
  habitatUrl: string | null;
  onSet: (next: JoinStatus) => void;
  onClose: () => void;
  onUrlChange: (v: string) => void;
  onNoteChange: (v: string) => void;
}) {
  return (
    <div className="modal-backdrop" style={{ zIndex: 2100 }}
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 'min(520px, 95vw)', padding: 16 }}
           onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 16 }}>{JOIN_STATUS_ICON[current]}</span>
          <h3 style={{ margin: 0, fontSize: 14 }}>Membership state</h3>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} className="btn ghost" style={{ fontSize: 13 }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
        <div style={{ marginTop: 12, fontSize: 10, color: 'var(--fg-4)', fontStyle: 'italic' }}>
          💡 Bấm 1 button trạng thái phía trên để lưu (auto close).
        </div>
      </div>
    </div>
  );
}
