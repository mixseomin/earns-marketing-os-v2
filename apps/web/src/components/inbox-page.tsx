'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type HumanTaskRow, claimTask, completeTask, cancelTask, unclaimTask, pollWorkflowProgress, type WorkflowProgress } from '@/lib/actions/inbox';
import { Pill, EmptyState, StatsStrip, type StatCard } from './ui';

const STATUS_COLOR: Record<string, string> = {
  pending: 'var(--fg-3)',
  claimed: 'var(--neon-cyan)',
  in_progress: 'var(--neon-amber)',
  completed: 'var(--neon-violet)',
  verified: 'var(--ok)',
  failed: 'var(--bad)',
  cancelled: 'var(--fg-4)',
};

function fmtSlaCountdown(iso: string | null): { text: string; tone: 'ok' | 'warn' | 'bad' | 'flat' } {
  if (!iso) return { text: 'no SLA', tone: 'flat' };
  const ms = new Date(iso).getTime() - Date.now();
  const min = Math.round(ms / 60_000);
  if (ms < 0) return { text: `overdue ${-min}m`, tone: 'bad' };
  if (min < 30) return { text: `${min}m left`, tone: 'bad' };
  if (min < 120) return { text: `${min}m left`, tone: 'warn' };
  if (min < 1440) return { text: `${Math.round(min / 60)}h left`, tone: 'ok' };
  return { text: `${Math.round(min / 1440)}d left`, tone: 'flat' };
}

function fmtRel(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export function InboxPage({ tasks: initial }: { tasks: HumanTaskRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [filterStatus, setFilterStatus] = useState<string>('open');  // 'open' = pending+claimed+in_progress
  const [openTask, setOpenTask] = useState<HumanTaskRow | null>(null);

  const tasks = initial;
  const filtered = useMemo(() => {
    if (filterStatus === 'all') return tasks;
    if (filterStatus === 'open') return tasks.filter((t) => ['pending', 'claimed', 'in_progress'].includes(t.status));
    return tasks.filter((t) => t.status === filterStatus);
  }, [tasks, filterStatus]);

  const stats: StatCard[] = useMemo(() => {
    const overdue = tasks.filter((t) => t.slaDueAt && new Date(t.slaDueAt).getTime() < Date.now() && ['pending', 'claimed', 'in_progress'].includes(t.status)).length;
    return [
      { key: 'pending', label: 'Pending', value: tasks.filter((t) => t.status === 'pending').length, color: STATUS_COLOR.pending! },
      { key: 'claimed', label: 'Claimed', value: tasks.filter((t) => t.status === 'claimed').length, color: STATUS_COLOR.claimed! },
      { key: 'overdue', label: 'Overdue', value: overdue, color: overdue > 0 ? 'var(--bad)' : 'var(--fg-3)' },
      { key: 'completed', label: 'Completed', value: tasks.filter((t) => t.status === 'completed').length, color: STATUS_COLOR.completed! },
      { key: 'verified', label: 'Verified', value: tasks.filter((t) => t.status === 'verified').length, color: STATUS_COLOR.verified! },
    ];
  }, [tasks]);

  return (
    <div className="page" style={{ padding: 16, maxWidth: 920 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">📥 Inbox<small>// {tasks.length} tasks</small></h1>
          <p className="page-sub">
            Human task queue — agents handed off (FB/IG/TikTok DM, Reddit/Twitter manual). 1-tap claim → đăng → upload URL.
          </p>
        </div>
      </div>

      <StatsStrip cards={stats} />

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '10px 0' }}>
        <span className="chip" data-active={filterStatus === 'open' || undefined} onClick={() => setFilterStatus('open')} style={{ cursor: 'pointer', fontSize: 11 }}>open</span>
        <span className="chip" data-active={filterStatus === 'all' || undefined} onClick={() => setFilterStatus('all')} style={{ cursor: 'pointer', fontSize: 11 }}>all</span>
        {['pending', 'claimed', 'completed', 'verified', 'cancelled'].map((s) => (
          <span key={s} className="chip" data-active={filterStatus === s || undefined} onClick={() => setFilterStatus(s)}
                style={{ cursor: 'pointer', fontSize: 11, color: STATUS_COLOR[s] }}>
            {s}
          </span>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="📭" title="No tasks in queue" description="Agent runtime sẽ tạo human_tasks khi platform requires_human=true (FB/IG/TikTok DM)." compact />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((t) => {
            const sla = fmtSlaCountdown(t.slaDueAt);
            return (
              <div key={t.id} className="panel" style={{
                cursor: 'pointer',
                borderLeft: sla.tone === 'bad' ? '4px solid var(--bad)' : sla.tone === 'warn' ? '4px solid var(--warn)' : '4px solid var(--line)',
              }} onClick={() => setOpenTask(t)}>
                <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                    <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <Pill color={STATUS_COLOR[t.status] ?? 'var(--fg-3)'} label={t.status} size="xs" />
                      {t.platformKey && <span>· {t.platformKey}</span>}
                      <span>· {t.projectName ?? t.projectId}</span>
                      <span>· {fmtRel(t.createdAt)}</span>
                      <span style={{ color: sla.tone === 'bad' ? 'var(--bad)' : sla.tone === 'warn' ? 'var(--warn)' : 'var(--fg-3)', marginLeft: 'auto' }}>
                        ⏱ {sla.text}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {openTask && (
        <TaskDetailModal
          task={openTask}
          onClose={() => setOpenTask(null)}
          onAction={() => { setOpenTask(null); router.refresh(); }}
          onSwapTask={(newTask) => { setOpenTask(newTask); router.refresh(); }}
        />
      )}
    </div>
  );
}

// ── Task detail modal ────────────────────────────────────────
function TaskDetailModal({ task, onClose, onAction, onSwapTask }: { task: HumanTaskRow; onClose: () => void; onAction: () => void; onSwapTask: (newTask: HumanTaskRow) => void }) {
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const draftKey = `inbox-draft-${task.id}`;
  // Lazy init từ localStorage để giữ nội dung đang gõ qua F5 / accidental close.
  const [publishUrl, setPublishUrl] = useState(() => {
    if (typeof window === 'undefined') return task.publishUrl ?? '';
    try { const d = JSON.parse(localStorage.getItem(draftKey) ?? '{}'); return d.publishUrl ?? task.publishUrl ?? ''; } catch { return task.publishUrl ?? ''; }
  });
  const [screenshotUrl, setScreenshotUrl] = useState(() => {
    if (typeof window === 'undefined') return task.screenshotUrl ?? '';
    try { const d = JSON.parse(localStorage.getItem(draftKey) ?? '{}'); return d.screenshotUrl ?? task.screenshotUrl ?? ''; } catch { return task.screenshotUrl ?? ''; }
  });
  const [notes, setNotes] = useState(() => {
    if (typeof window === 'undefined') return task.notes ?? '';
    try { const d = JSON.parse(localStorage.getItem(draftKey) ?? '{}'); return d.notes ?? task.notes ?? ''; } catch { return task.notes ?? ''; }
  });
  const [feedbackType, setFeedbackType] = useState<'success' | 'revise' | 'error' | 'more-info'>(() => {
    if (typeof window === 'undefined') return 'success';
    try { const d = JSON.parse(localStorage.getItem(draftKey) ?? '{}'); return d.feedbackType ?? 'success'; } catch { return 'success'; }
  });
  const [feedbackText, setFeedbackText] = useState(() => {
    if (typeof window === 'undefined') return '';
    try { const d = JSON.parse(localStorage.getItem(draftKey) ?? '{}'); return d.feedbackText ?? ''; } catch { return ''; }
  });
  const [reviseTarget, setReviseTarget] = useState<'text' | 'image' | 'both'>(() => {
    if (typeof window === 'undefined') return 'text';
    try { const d = JSON.parse(localStorage.getItem(draftKey) ?? '{}'); return d.reviseTarget ?? 'text'; } catch { return 'text'; }
  });

  // Auto-persist draft mỗi khi user gõ.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const draft = { publishUrl, screenshotUrl, notes, feedbackType, feedbackText, reviseTarget };
    const isDirty = publishUrl || screenshotUrl || notes || feedbackText;
    if (isDirty) localStorage.setItem(draftKey, JSON.stringify(draft));
    else localStorage.removeItem(draftKey);
  }, [publishUrl, screenshotUrl, notes, feedbackType, feedbackText, draftKey]);

  const isDirty = !!(feedbackText.trim() || publishUrl.trim() || screenshotUrl.trim() || notes.trim());
  // Sau complete, modal hiển thị kết quả thay vì đóng ngay → user thấy spawn lineage.
  const [lastResult, setLastResult] = useState<{ spawnedCardId?: number; spawnedSquad?: string; feedbackType: string; workflowRunId?: string } | null>(null);
  const [progress, setProgress] = useState<WorkflowProgress | null>(null);
  const safeClose = () => {
    if (lastResult) { onAction(); return; }
    if (isDirty && !confirm('Có nội dung chưa submit. Đóng bỏ bản nháp?\n(Bản nháp đã auto-save sẵn — bấm OK nếu chỉ muốn ẩn modal.)')) return;
    onClose();
  };

  // Poll workflow progress sau khi spawn revise card. Mỗi 3s check:
  //  - latest agent_run status của các step trong workflow
  //  - new human_task pending → swap modal sang task mới
  useEffect(() => {
    if (!lastResult?.workflowRunId || !lastResult?.spawnedCardId) return;
    let cancelled = false;
    const wfRunId = lastResult.workflowRunId;
    const afterTaskId = task.id;
    const tick = async () => {
      const p = await pollWorkflowProgress(wfRunId, afterTaskId);
      if (cancelled) return;
      setProgress(p);
      if (p.newTask) onSwapTask(p.newTask);
    };
    tick();
    const interval = setInterval(tick, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [lastResult, task.id, onSwapTask]);

  const fld: React.CSSProperties = {
    width: '100%', padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)',
    borderRadius: 5, color: 'var(--fg-0)', fontSize: 13, outline: 'none',
  };
  const lbl: React.CSSProperties = {
    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block',
  };

  const handleClaim = () => {
    setBusy(true);
    startTransition(async () => { await claimTask(task.id); setBusy(false); onAction(); });
  };
  const handleComplete = () => {
    if (feedbackType === 'success' && !publishUrl.trim()) {
      alert('Success → cần publishUrl (URL post)');
      return;
    }
    if ((feedbackType === 'revise' || feedbackType === 'error' || feedbackType === 'more-info') && !feedbackText.trim()) {
      alert('Cần nhập feedback text khi không phải success');
      return;
    }
    setBusy(true);
    startTransition(async () => {
      const res = await completeTask(task.id, {
        publishUrl: publishUrl || undefined,
        screenshotUrl: screenshotUrl || undefined,
        notes: notes || undefined,
        feedbackType, feedbackText: feedbackText || undefined,
        reviseTarget: (feedbackType === 'revise' || feedbackType === 'more-info') ? reviseTarget : undefined,
      });
      setBusy(false);
      if (typeof window !== 'undefined') localStorage.removeItem(draftKey);
      setLastResult({ spawnedCardId: res.spawnedCardId, spawnedSquad: res.spawnedSquad, feedbackType, workflowRunId: res.workflowRunId });
    });
  };
  const handleCancel = () => {
    const reason = prompt('Lý do cancel?');
    if (reason === null) return;
    setBusy(true);
    startTransition(async () => { await cancelTask(task.id, reason); setBusy(false); onAction(); });
  };
  const handleUnclaim = () => {
    setBusy(true);
    startTransition(async () => { await unclaimTask(task.id); setBusy(false); onAction(); });
  };

  const payload = task.prepPayload as Record<string, unknown>;
  const caption = typeof payload.caption === 'string' ? payload.caption : '';
  const imageUrls = Array.isArray(payload.imageUrls) ? payload.imageUrls as string[] : [];
  const hashtags = Array.isArray(payload.hashtags) ? payload.hashtags as string[] : [];
  const bestTime = typeof payload.bestTimeIso === 'string' ? payload.bestTimeIso : null;

  const copyToClipboard = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  return (
    <div className="modal-backdrop" onClick={safeClose}>
      <div className="modal" style={{ maxWidth: 720, maxHeight: '92vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="id-line">
              #{task.id} · {task.platformKey ?? 'unknown'} · {task.status}
              {isDirty && <span style={{ marginLeft: 8, color: 'var(--neon-amber)', fontSize: 10 }}>● draft saved</span>}
            </div>
            <h2>{task.title}</h2>
          </div>
          <button className="modal-close" onClick={safeClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="modal-section-title">Instructions</div>
          <div className="modal-text" style={{ whiteSpace: 'pre-wrap' }}>{task.instructions}</div>

          {Object.keys(payload).length > 0 && (
            <>
              <div className="modal-section-title">📋 Prep payload</div>
              {caption && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={lbl}>Caption</span>
                    <button className="btn" style={{ fontSize: 9, padding: '1px 6px', marginLeft: 'auto' }} onClick={() => copyToClipboard(caption)}>📋 Copy</button>
                  </div>
                  <pre style={{ margin: 0, padding: 8, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 4, fontSize: 12, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>{caption}</pre>
                </div>
              )}
              {hashtags.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={lbl}>Hashtags</span>
                    <button className="btn" style={{ fontSize: 9, padding: '1px 6px', marginLeft: 'auto' }} onClick={() => copyToClipboard(hashtags.map((h) => h.startsWith('#') ? h : `#${h}`).join(' '))}>📋 Copy</button>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--neon-cyan)' }}>
                    {hashtags.map((h) => h.startsWith('#') ? h : `#${h}`).join(' ')}
                  </div>
                </div>
              )}
              {imageUrls.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <span style={lbl}>Images ({imageUrls.length})</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {imageUrls.map((u, i) => (
                      <a key={i} href={u} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--line)' }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {bestTime && (
                <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--neon-amber)', fontFamily: 'var(--font-mono)' }}>
                  ⏰ Best time: {new Date(bestTime).toLocaleString('vi-VN')}
                </div>
              )}
            </>
          )}

          {/* Vừa submit xong → show kết quả + spawn lineage thay vì đóng modal */}
          {lastResult && (
            <div style={{
              marginTop: 12, padding: 12,
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid var(--ok)', borderRadius: 6,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ok)', marginBottom: 8 }}>
                ✓ Task completed (outcome: {lastResult.feedbackType})
              </div>
              {lastResult.spawnedCardId ? (
                <>
                  <div style={{ fontSize: 12, color: 'var(--fg-1)', marginBottom: 6 }}>
                    → Spawned card <b style={{ color: 'var(--neon-cyan)' }}>#{lastResult.spawnedCardId}</b> cho squad <b>{lastResult.spawnedSquad ?? 'wf-writer'}</b>
                  </div>
                  {/* Step progress bar — live update từ polling */}
                  {progress && progress.steps.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8, padding: '6px 8px', background: 'var(--bg-2)', borderRadius: 4 }}>
                      {progress.steps.map((s, i) => {
                        const icon =
                          s.runStatus === 'completed' ? '✓' :
                          s.runStatus === 'running' ? '⏳' :
                          s.runStatus === 'failed' ? '✕' :
                          s.runStatus === 'queued' ? '◷' : '○';
                        const color =
                          s.runStatus === 'completed' ? 'var(--ok)' :
                          s.runStatus === 'running' ? 'var(--neon-amber)' :
                          s.runStatus === 'failed' ? 'var(--bad)' :
                          'var(--fg-3)';
                        return (
                          <span key={s.cardId} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            {i > 0 && <span style={{ color: 'var(--fg-4)', fontSize: 10 }}>→</span>}
                            <span style={{ fontSize: 11, color, fontFamily: 'var(--font-mono)' }}>
                              {icon} {s.stepKey}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
                    {progress?.newTask
                      ? '✓ Task mới sẵn sàng — đang chuyển sang task...'
                      : progress && progress.steps.some((s) => s.runStatus === 'running')
                      ? '⏳ AI đang revise...'
                      : progress && progress.steps.length > 0
                      ? '◷ Đang queue, đợi worker tick...'
                      : 'Worker đã được auto-kick. Đang khởi động...'}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Link href={`/p/${task.projectId ?? 'orit'}`} className="btn ghost" style={{ fontSize: 11, padding: '4px 10px' }}>
                      → Xem board
                    </Link>
                    <Link href="/agents" className="btn ghost" style={{ fontSize: 11, padding: '4px 10px' }}>
                      → Agent runs
                    </Link>
                    <button className="btn ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => onAction()}>Đóng (huỷ chờ)</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
                    Workflow đã kết thúc (không spawn thêm).
                  </div>
                  <button className="btn primary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => onAction()}>Đóng</button>
                </>
              )}
            </div>
          )}

          {/* Result form (chỉ show khi task đang active VÀ chưa có lastResult) */}
          {!lastResult && (task.status === 'pending' || task.status === 'claimed' || task.status === 'in_progress') && (
            <>
              <div className="modal-section-title">📤 Result + feedback</div>
              <div>
                <span style={lbl}>Outcome</span>
                <select style={fld} value={feedbackType} onChange={(e) => setFeedbackType(e.target.value as typeof feedbackType)}>
                  <option value="success">✓ Success — đã đăng OK</option>
                  <option value="revise">↻ Revise — yêu cầu writer viết lại theo feedback</option>
                  <option value="error">✕ Error — fail hoàn toàn, cần escalate</option>
                  <option value="more-info">? More info — cần thêm thông tin</option>
                </select>
                <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
                  {feedbackType === 'success' && 'Mark task done với publish URL.'}
                  {feedbackType === 'revise' && '→ System spawn writer card mới với feedback. Writer sẽ revise post.'}
                  {feedbackType === 'error' && 'Mark fail. Workflow dừng.'}
                  {feedbackType === 'more-info' && '→ Spawn writer card request additional context.'}
                </div>
              </div>
              {feedbackType === 'success' && (
                <>
                  <div style={{ marginTop: 8 }}>
                    <span style={lbl}>Publish URL *</span>
                    <input style={fld} type="url" placeholder="https://reddit.com/r/.../comments/..." value={publishUrl} onChange={(e) => setPublishUrl(e.target.value)} />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span style={lbl}>Screenshot URL <span style={{ color: 'var(--fg-4)' }}>(optional)</span></span>
                    <input style={fld} type="url" placeholder="https://..." value={screenshotUrl} onChange={(e) => setScreenshotUrl(e.target.value)} />
                  </div>
                </>
              )}
              {(feedbackType === 'revise' || feedbackType === 'more-info') && (
                <div style={{ marginTop: 8 }}>
                  <span style={lbl}>Sửa cái gì?</span>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {([
                      { v: 'text', label: '📝 Text only', sub: 'giữ ảnh, viết lại' },
                      { v: 'image', label: '🎨 Image only', sub: 'giữ post, vẽ lại' },
                      { v: 'both', label: '↻ Cả hai', sub: 'tốn DALL-E credit' },
                    ] as const).map((opt) => (
                      <span key={opt.v} className="chip" data-active={reviseTarget === opt.v || undefined}
                            onClick={() => setReviseTarget(opt.v)}
                            style={{ cursor: 'pointer', fontSize: 11 }}
                            title={opt.sub}>
                        {opt.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(feedbackType === 'revise' || feedbackType === 'error' || feedbackType === 'more-info') && (
                <div style={{ marginTop: 8 }}>
                  <span style={lbl}>Feedback / lý do *</span>
                  <textarea style={{ ...fld, minHeight: 80 }}
                            placeholder="vd: 'Title chưa hấp dẫn, đổi sang dạng câu hỏi. Body quá dài, rút xuống 200 từ.'"
                            value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} />
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                <span style={lbl}>Notes (internal)</span>
                <textarea style={{ ...fld, minHeight: 40 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </>
          )}

          {/* Result if completed */}
          {(task.status === 'completed' || task.status === 'verified') && task.publishUrl && (
            <>
              <div className="modal-section-title">✓ Completed</div>
              <div style={{ fontSize: 12 }}>
                <a href={task.publishUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{task.publishUrl}</a>
              </div>
              {task.completedAt && <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>Completed: {fmtRel(task.completedAt)}</div>}
            </>
          )}
        </div>

        <div className="modal-foot">
          <div className="meta">
            {task.parentRunId && (<span style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>Spawned by agent run #{task.parentRunId}</span>)}
          </div>
          <div className="modal-foot-actions">
            <button className="btn ghost" onClick={safeClose}>Close</button>
            {!lastResult && task.status === 'pending' && (
              <>
                <button className="btn" onClick={handleClaim} disabled={busy}>👤 Claim only</button>
                <button className="btn primary" onClick={handleComplete} disabled={busy}>✓ Submit + complete</button>
              </>
            )}
            {!lastResult && (task.status === 'claimed' || task.status === 'in_progress') && (
              <>
                <button className="btn" onClick={handleUnclaim} disabled={busy}>↻ Unclaim</button>
                <button className="btn primary" onClick={handleComplete} disabled={busy}>✓ Mark complete</button>
              </>
            )}
            {!lastResult && (task.status === 'pending' || task.status === 'claimed' || task.status === 'in_progress') && (
              <button className="btn danger" onClick={handleCancel} disabled={busy}>✕ Cancel</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
