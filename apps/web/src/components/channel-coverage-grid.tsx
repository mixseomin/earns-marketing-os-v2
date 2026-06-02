'use client';

// Matrix coverage channel × phase cho 1 brief Discord. Hiện trong tab
// Overview của BriefEditModal. Mỗi cell: số bài đã có (nếu trống → "+"
// to create). Click cell → tạo 1 bài cho (channel × phase) đó, gắn channel
// id sẵn. Optimistic update bằng onPostsChanged để parent reload list.

import { useEffect, useState, useTransition } from 'react';
import { listChannelsForHabitat, type HabitatChannelRow } from '@/lib/actions/habitat-channels';
import { listBriefPostChannels } from '@/lib/actions/card-channel';
import { createPostForBriefPhase } from '@/lib/actions/brief-posts';
import { PHASE_LABEL, PLANNED_PHASES, type Phase } from '@/lib/phase-plan';
import { Spinner } from './ui';

// 5 active phases có plan — đồng bộ với roadmap card phía trên.
const PHASES: Phase[] = PLANNED_PHASES;

interface Props {
  projectId: string;
  briefId: number;
  habitatId: number;
  // reloadKey bump khi parent tạo/xoá bài → grid tự re-fetch posts.
  reloadKey?: number;
  onPostsChanged?: () => void;   // parent reload list sau khi tạo bài
}

// DATA-DRIVEN: hiện grid khi habitat CÓ channels (Discord/Slack/Telegram channel HOẶC
// forum sub-forum) — bất kể platform. Không có channel → ẩn hẳn. Xem channel-support.ts.
export function ChannelCoverageGrid({
  projectId, briefId, habitatId, reloadKey = 0, onPostsChanged,
}: Props) {
  const [channels, setChannels] = useState<HabitatChannelRow[] | null>(null);
  const [posts, setPosts] = useState<Array<{ channelId: number | null; briefPhase: string | null }>>([]);
  const [busy, setBusy] = useState<string | null>(null);   // "channelId-phase" đang tạo
  const [, startTransition] = useTransition();

  useEffect(() => {
    listChannelsForHabitat(habitatId).then(setChannels).catch(() => setChannels([]));
  }, [habitatId]);

  // Posts re-fetch khi reloadKey bump (parent vừa tạo/sửa bài)
  useEffect(() => {
    listBriefPostChannels(briefId).then(setPosts).catch(() => setPosts([]));
  }, [briefId, reloadKey]);

  if (channels == null) return null;          // đang load → chưa render (tránh nhấp nháy)
  if (channels.length === 0) return null;     // habitat ko có channel → ẩn grid hẳn

  // Count posts per (channelId, phase). channelId=null tách riêng.
  const countMap = new Map<string, number>();
  for (const p of posts) {
    const key = `${p.channelId ?? 'null'}__${p.briefPhase ?? 'unknown'}`;
    countMap.set(key, (countMap.get(key) ?? 0) + 1);
  }

  const cellCount = (channelId: number | null, phase: string) =>
    countMap.get(`${channelId ?? 'null'}__${phase}`) ?? 0;

  const createCell = (channelId: number, phase: Phase, channelName: string) => {
    const key = `${channelId}-${phase}`;
    setBusy(key);
    startTransition(async () => {
      const res = await createPostForBriefPhase(projectId, briefId, phase, 'text', undefined, channelId);
      setBusy(null);
      if (!res.ok) {
        alert(`Lỗi tạo bài cho #${channelName} × ${PHASE_LABEL[phase]}: ${res.error}`);
        return;
      }
      onPostsChanged?.();
    });
  };

  return (
    <div style={{ padding: 10, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span title="Matrix channel × phase: ô số = số bài đã có, ô trống = chưa có (click + để tạo). Cover các bề mặt khác nhau trong server."
              style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
                       textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'help' }}>
          📊 Bao phủ channel × phase
        </span>
        <span style={{ fontSize: 10, color: 'var(--fg-4)' }}>
          click ô trống để tạo bài cho channel × phase đó
        </span>
      </div>
      <div style={{ display: 'grid',
                    gridTemplateColumns: `minmax(120px, max-content) repeat(${PHASES.length}, 1fr)`,
                    gap: 4, fontSize: 11 }}>
        {/* Header row */}
        <div style={{ padding: '4px 6px', fontSize: 9, fontFamily: 'var(--font-mono)',
                      color: 'var(--fg-3)', textTransform: 'uppercase' }}>
          Channel
        </div>
        {PHASES.map((p) => (
          <div key={p} title={PHASE_LABEL[p]}
               style={{ padding: '4px 0', fontSize: 9.5, fontFamily: 'var(--font-mono)',
                        textAlign: 'center', color: 'var(--fg-3)',
                        textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {PHASE_LABEL[p].split(/[/\s]/)[0]}
          </div>
        ))}
        {/* Habitat-level row (null channel) */}
        <div style={{ padding: '4px 6px', fontFamily: 'var(--font-mono)',
                      color: 'var(--fg-3)', fontStyle: 'italic',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
             title="Bài habitat-level — không gắn channel cụ thể">
          (habitat-level)
        </div>
        {PHASES.map((p) => {
          const c = cellCount(null, p);
          return (
            <div key={`null-${p}`}
                 title={c > 0 ? `${c} bài habitat-level cho ${PHASE_LABEL[p]}` : 'Không có bài habitat-level'}
                 style={{ padding: '6px 0', textAlign: 'center', borderRadius: 3,
                          background: c > 0 ? 'var(--bg-1)' : 'transparent',
                          color: c > 0 ? 'var(--fg-2)' : 'var(--fg-4)',
                          border: `1px solid ${c > 0 ? 'var(--line)' : 'transparent'}` }}>
              {c > 0 ? c : '·'}
            </div>
          );
        })}
        {/* 1 row mỗi channel */}
        {channels.map((ch) => {
          const skipForPost: boolean = ch.postingGates != null && typeof ch.postingGates === 'object'
            && (ch.postingGates as Record<string, unknown>).skip_for_post === true;
          return (
            <FragmentRow key={ch.id}>
              <div style={{ padding: '4px 6px', fontFamily: 'var(--font-mono)',
                            color: 'var(--accent)', fontWeight: 600,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            display: 'flex', alignItems: 'center', gap: 4 }}
                   title={skipForPost ? 'Channel này không dùng để đăng (vd #rules)' : ch.description || ch.name}>
                #{ch.name}
                {skipForPost && <span title="Read-only / rules channel"
                                      style={{ fontSize: 9, color: 'var(--bad)' }}>🚫</span>}
              </div>
              {PHASES.map((p) => {
                const c = cellCount(ch.id, p);
                const cellKey = `${ch.id}-${p}`;
                const isBusy = busy === cellKey;
                const has = c > 0;
                return (
                  <button key={cellKey} type="button"
                          disabled={isBusy || skipForPost}
                          onClick={() => !skipForPost && createCell(ch.id, p, ch.name)}
                          title={
                            skipForPost ? 'Channel này không đăng được'
                            : has ? `${c} bài cho #${ch.name} × ${PHASE_LABEL[p]} — click + để tạo thêm`
                            : `Tạo 1 bài cho #${ch.name} × ${PHASE_LABEL[p]} (auto-gắn channel + voice)`
                          }
                          style={{ padding: '6px 0', textAlign: 'center', borderRadius: 3,
                                   background: has ? 'rgba(74,222,128,0.10)' : 'var(--bg-1)',
                                   color: has ? 'var(--ok)' : skipForPost ? 'var(--fg-4)' : 'var(--accent)',
                                   border: `1px solid ${has ? 'rgba(74,222,128,0.35)' : 'var(--line)'}`,
                                   cursor: isBusy ? 'wait' : skipForPost ? 'not-allowed' : 'pointer',
                                   opacity: skipForPost ? 0.4 : 1,
                                   fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {isBusy ? <Spinner size="xs" /> : has ? c : '+'}
                  </button>
                );
              })}
            </FragmentRow>
          );
        })}
      </div>
      <div style={{ marginTop: 6, fontSize: 9.5, color: 'var(--fg-4)', fontStyle: 'italic' }}>
        💡 Mỗi ô = 1 (channel × phase). Số = bài đã có, + = tạo mới. Bài mới tự gắn channel + voice tương ứng.
      </div>
    </div>
  );
}

// Wrapper để render multiple cells trong grid (1 row = 1 channel + N phases)
// mà không vỡ grid layout. Dùng React.Fragment thực ra cũng OK nhưng helper
// tên rõ ràng hơn.
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
