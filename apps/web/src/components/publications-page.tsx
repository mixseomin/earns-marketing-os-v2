'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import type { Publication, PublicationActivity } from '@/lib/publications/types';
import { PLATFORM_CONFIGS, detectPlatform } from '@/lib/publications/types';
import { addPublication, updatePublicationStatus, updatePublicationInterval, getPublicationActivities } from '@/lib/actions/publications';
import { Pill, EmptyState, StatsStrip, type StatCard } from './ui';

// ── Helpers ──────────────────────────────────────────────────────
function fmtRel(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function fmtNextCheck(iso: string | null): string {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return 'now';
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  return `${Math.round(ms / 3_600_000)}h`;
}

function activityTone(iso: string | null): 'hot' | 'warm' | 'cold' {
  if (!iso) return 'cold';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 3_600_000) return 'hot';
  if (ms < 86_400_000) return 'warm';
  return 'cold';
}

function goldenWindowLabel(pub: Publication): string | null {
  const cfg = PLATFORM_CONFIGS[pub.platformKey];
  if (!cfg || cfg.evergreen) return null;
  if (!pub.publishedAt) return null;
  const ageHours = (Date.now() - new Date(pub.publishedAt).getTime()) / 3_600_000;
  const windowHours = pub.platformKey === 'reddit' ? 6 : pub.platformKey === 'hackernews' ? 24 : 48;
  if (ageHours > windowHours) {
    const daysAgo = Math.floor(ageHours / 24);
    return `expired ${daysAgo}d ago`;
  }
  const remaining = windowHours - ageHours;
  return `${Math.round(remaining)}h left`;
}

// ── Add Publication Form ─────────────────────────────────────────
function AddPublicationForm({ projectId, onAdded }: { projectId: string; onAdded: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [publishedAt, setPublishedAt] = useState('');
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUrlBlur = () => {
    if (!url.trim()) return;
    setDetecting(true);
    setTimeout(() => {
      setDetectedPlatform(detectPlatform(url.trim()));
      setDetecting(false);
    }, 200);
  };

  const handleSubmit = async () => {
    if (!url.trim()) { setError('URL is required'); return; }
    setSubmitting(true);
    setError(null);
    const res = await addPublication({
      projectId,
      url: url.trim(),
      title: title.trim() || undefined,
      platformKey: detectedPlatform ?? undefined,
      publishedAt: publishedAt || undefined,
    });
    setSubmitting(false);
    if (res.ok) {
      setUrl(''); setTitle(''); setPublishedAt(''); setDetectedPlatform(null);
      setExpanded(false);
      onAdded();
    } else {
      setError(res.error ?? 'Failed to add');
    }
  };

  const platformCfg = detectedPlatform ? PLATFORM_CONFIGS[detectedPlatform] : null;

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 6, border: '1px dashed var(--line)',
          background: 'transparent', color: 'var(--fg-2)', cursor: 'pointer',
          fontSize: 12, fontFamily: 'var(--font-mono)',
          transition: 'border-color .12s, color .12s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--neon-amber)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--neon-amber)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--fg-2)'; }}
      >
        <span style={{ fontSize: 16 }}>+</span> Track new publication
      </button>
    );
  }

  return (
    <div className="panel" style={{ padding: 14, marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        + New publication
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* URL + platform detection */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="url"
            placeholder="https://forum.example.com/threads/my-post.123/"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setDetectedPlatform(null); }}
            onBlur={handleUrlBlur}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            style={{
              flex: 1, padding: '7px 10px', borderRadius: 5,
              border: '1px solid var(--line)', background: 'var(--bg-1)',
              color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)',
            }}
          />
          {detecting && (
            <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>detecting…</span>
          )}
          {!detecting && platformCfg && (
            <Pill
              color="var(--neon-cyan)"
              label={`${platformCfg.icon} ${platformCfg.label}`}
              size="sm"
              uppercase={false}
              title={`Detected platform: ${platformCfg.label} · check every ${platformCfg.defaultIntervalHours}h`}
            />
          )}
        </div>
        {/* Optional title */}
        <input
          type="text"
          placeholder="Title (optional — auto-fetched on first check)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          style={{
            padding: '7px 10px', borderRadius: 5,
            border: '1px solid var(--line)', background: 'var(--bg-1)',
            color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)',
          }}
        />
        {/* Optional published_at */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>Published at</label>
          <input
            type="datetime-local"
            value={publishedAt}
            onChange={(e) => setPublishedAt(e.target.value)}
            style={{
              padding: '6px 10px', borderRadius: 5,
              border: '1px solid var(--line)', background: 'var(--bg-1)',
              color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)',
            }}
          />
          <span style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>(optional)</span>
        </div>
        {error && <div style={{ fontSize: 11, color: 'var(--bad)', fontFamily: 'var(--font-mono)' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: '7px 16px', borderRadius: 5,
              border: 'none', background: 'var(--neon-amber)', color: 'var(--bg-0)',
              fontSize: 12, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Adding…' : 'Track Publication'}
          </button>
          <button
            onClick={() => { setExpanded(false); setUrl(''); setTitle(''); setPublishedAt(''); setDetectedPlatform(null); setError(null); }}
            style={{
              padding: '7px 12px', borderRadius: 5,
              border: '1px solid var(--line)', background: 'transparent',
              color: 'var(--fg-2)', fontSize: 12, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Activity Row ─────────────────────────────────────────────────
function ActivityRow({ act }: { act: PublicationActivity }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '90px 1fr auto auto',
      gap: 8, alignItems: 'start',
      padding: '7px 10px',
      borderBottom: '1px solid var(--line)',
      fontSize: 11, fontFamily: 'var(--font-mono)',
    }}>
      <span style={{ color: 'var(--fg-2)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {act.author ?? '—'}
      </span>
      <span style={{ color: 'var(--fg-1)', lineHeight: 1.4, wordBreak: 'break-word' }}>
        {act.contentSnippet ?? '—'}
      </span>
      <span style={{ display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }}>
        {act.humanTaskId && (
          <Pill color="var(--neon-violet)" label={`Task #${act.humanTaskId}`} size="xs" title={`Human task spawned: #${act.humanTaskId}`} />
        )}
        {act.activityUrl && (
          <a
            href={`https://href.li/?${act.activityUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--neon-cyan)', textDecoration: 'none', fontSize: 10 }}
            title="Open reply in new tab"
          >
            ↗
          </a>
        )}
      </span>
      <span style={{ color: 'var(--fg-4)', whiteSpace: 'nowrap' }}>{fmtRel(act.detectedAt)}</span>
    </div>
  );
}

// ── Publication Row ──────────────────────────────────────────────
function PublicationRow({
  pub,
  onStatusChange,
  onIntervalChange,
}: {
  pub: Publication;
  onStatusChange: (id: number, status: string) => void;
  onIntervalChange: (id: number, hours: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [activities, setActivities] = useState<PublicationActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [, startTransition] = useTransition();
  const [archiveConfirm, setArchiveConfirm] = useState(false);

  const cfg = PLATFORM_CONFIGS[pub.platformKey] ?? { label: pub.platformKey, icon: '📌', evergreen: false };
  const tone = activityTone(pub.lastActivityAt);
  const activityColor = tone === 'hot' ? 'var(--ok)' : tone === 'warm' ? 'var(--neon-amber)' : 'var(--fg-3)';
  const golden = goldenWindowLabel(pub);
  const isActive = pub.status === 'active';
  const isPaused = pub.status === 'paused';

  const handleRowClick = async () => {
    const nowExpanded = !expanded;
    setExpanded(nowExpanded);
    if (nowExpanded && activities.length === 0) {
      setLoadingActivities(true);
      const acts = await getPublicationActivities(pub.id);
      setActivities(acts);
      setLoadingActivities(false);
    }
  };

  const handlePause = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(() => { onStatusChange(pub.id, 'paused'); });
  };
  const handleResume = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(() => { onStatusChange(pub.id, 'active'); });
  };
  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!archiveConfirm) { setArchiveConfirm(true); return; }
    startTransition(() => { onStatusChange(pub.id, 'archived'); });
    setArchiveConfirm(false);
  };

  const displayTitle = pub.title ?? pub.url;
  const urlHost = (() => { try { return new URL(pub.url).hostname; } catch { return pub.url; } })();

  return (
    <>
      <tr
        onClick={handleRowClick}
        style={{
          cursor: 'pointer',
          background: expanded ? 'var(--bg-1)' : 'transparent',
          opacity: pub.status === 'archived' ? 0.45 : 1,
          borderLeft: isActive ? '3px solid transparent' : '3px solid var(--fg-4)',
        }}
      >
        {/* Platform */}
        <td style={{ padding: '8px 6px 8px 10px', whiteSpace: 'nowrap' }}>
          <span title={`${cfg.label} · check every ${pub.checkIntervalHours}h`} style={{ fontSize: 14 }}>
            {cfg.icon}
          </span>
        </td>

        {/* Title / URL */}
        <td style={{ padding: '8px 6px', maxWidth: 260 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
               title={displayTitle}>
            {displayTitle}
          </div>
          <div style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <a
              href={`https://href.li/?${pub.url}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ color: 'var(--fg-4)', textDecoration: 'none' }}
              title="Open original post"
            >
              {urlHost} ↗
            </a>
          </div>
        </td>

        {/* Posted */}
        <td style={{ padding: '8px 6px', whiteSpace: 'nowrap', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
          {pub.publishedAt ? fmtRel(pub.publishedAt) : '—'}
          {golden && (
            <div style={{ fontSize: 9, color: golden.startsWith('expired') ? 'var(--fg-4)' : 'var(--neon-amber)', marginTop: 2 }}>
              {golden.startsWith('expired') ? golden : `⏱ ${golden}`}
            </div>
          )}
          {cfg.evergreen && (
            <div style={{ fontSize: 9, color: 'var(--fg-4)', marginTop: 2 }}>♾ evergreen</div>
          )}
        </td>

        {/* Last Activity */}
        <td style={{ padding: '8px 6px', whiteSpace: 'nowrap', fontSize: 11, fontFamily: 'var(--font-mono)', color: activityColor }}>
          {tone === 'hot' && <span title="Hot! Activity within last hour">🔥 </span>}
          {fmtRel(pub.lastActivityAt)}
        </td>

        {/* Replies / Score */}
        <td style={{ padding: '8px 6px', whiteSpace: 'nowrap', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-1)', textAlign: 'right' }}>
          <span title={`${pub.replyCount} replies`}>{pub.replyCount}</span>
          {pub.score != null && (
            <span style={{ color: 'var(--fg-4)', marginLeft: 4 }} title={`Score: ${pub.score}`}>/{pub.score}</span>
          )}
        </td>

        {/* Next Check */}
        <td style={{ padding: '8px 6px', whiteSpace: 'nowrap', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
          {pub.status !== 'active' ? (
            <span style={{ color: 'var(--fg-4)' }}>paused</span>
          ) : (
            fmtNextCheck(pub.nextCheckAt)
          )}
        </td>

        {/* Status */}
        <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>
          <Pill
            color={pub.status === 'active' ? 'var(--ok)' : pub.status === 'paused' ? 'var(--neon-amber)' : 'var(--fg-4)'}
            label={pub.status}
            size="xs"
          />
        </td>

        {/* Actions */}
        <td style={{ padding: '8px 10px 8px 6px', whiteSpace: 'nowrap' }}>
          <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
            {isActive && (
              <button
                onClick={handlePause}
                title="Pause monitoring — stops future checks"
                style={{ padding: '3px 7px', borderRadius: 4, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg-2)', cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font-mono)' }}
              >
                ⏸
              </button>
            )}
            {isPaused && (
              <button
                onClick={handleResume}
                title="Resume monitoring — next check will run immediately"
                style={{ padding: '3px 7px', borderRadius: 4, border: '1px solid var(--neon-lime)', background: 'transparent', color: 'var(--neon-lime)', cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font-mono)' }}
              >
                ▶
              </button>
            )}
            {pub.status !== 'archived' && (
              <button
                onClick={handleArchive}
                title={archiveConfirm ? 'Click again to confirm archive' : 'Archive this publication'}
                style={{
                  padding: '3px 7px', borderRadius: 4,
                  border: `1px solid ${archiveConfirm ? 'var(--bad)' : 'var(--line)'}`,
                  background: 'transparent',
                  color: archiveConfirm ? 'var(--bad)' : 'var(--fg-3)',
                  cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font-mono)',
                }}
              >
                {archiveConfirm ? 'Confirm?' : '🗄'}
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded activities */}
      {expanded && (
        <tr>
          <td colSpan={8} style={{ padding: 0, background: 'var(--bg-0)' }}>
            <div style={{ borderTop: '1px solid var(--line)', margin: '0 10px' }}>
              {/* Interval control */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                  Check interval:
                </span>
                {[1, 2, 6, 12, 24].map((h) => (
                  <span
                    key={h}
                    onClick={() => { onIntervalChange(pub.id, h); }}
                    style={{
                      padding: '2px 7px', borderRadius: 3, cursor: 'pointer',
                      fontSize: 10, fontFamily: 'var(--font-mono)',
                      background: pub.checkIntervalHours === h ? 'var(--neon-amber)22' : 'transparent',
                      color: pub.checkIntervalHours === h ? 'var(--neon-amber)' : 'var(--fg-3)',
                      border: `1px solid ${pub.checkIntervalHours === h ? 'var(--neon-amber)44' : 'var(--line)'}`,
                    }}
                    title={`Check every ${h}h`}
                  >
                    {h}h
                  </span>
                ))}
                <span style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', marginLeft: 8 }}>
                  Last checked: {fmtRel(pub.lastCheckedAt)}
                </span>
              </div>

              {/* Activities */}
              {loadingActivities && (
                <div style={{ padding: '10px 0', fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                  Loading activity…
                </div>
              )}
              {!loadingActivities && activities.length === 0 && (
                <div style={{ padding: '12px 0', fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                  No replies detected yet — first check runs next cycle.
                </div>
              )}
              {!loadingActivities && activities.length > 0 && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr auto auto', gap: 8, padding: '5px 10px', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--line)' }}>
                    <span>Author</span><span>Content</span><span>Links</span><span>When</span>
                  </div>
                  {activities.map((act) => <ActivityRow key={act.id} act={act} />)}
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main Page ────────────────────────────────────────────────────
export function PublicationsPage({ projectId, publications: initial }: { projectId: string; publications: Publication[] }) {
  const [publications, setPublications] = useState<Publication[]>(initial);
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [refreshTick, setRefreshTick] = useState(0);

  // Sync initial from server
  useEffect(() => { setPublications(initial); }, [initial]);

  // Auto-refresh every 30s
  useEffect(() => {
    const i = setInterval(() => { setRefreshTick((t) => t + 1); }, 30_000);
    return () => clearInterval(i);
  }, []);

  // Re-fetch via server action on tick (using router.refresh would clear form state)
  // Instead, we trigger a full page refresh using the window location (Next.js cache busts)
  useEffect(() => {
    if (refreshTick === 0) return;
    // Soft re-fetch: trigger Next.js router cache invalidation without hard reload
    // by calling listPublications directly as a client-side action
    import('@/lib/actions/publications').then(({ listPublications }) => {
      listPublications(projectId).then((fresh) => {
        setPublications(fresh);
      }).catch(() => {});
    });
  }, [refreshTick, projectId]);

  const stats: StatCard[] = useMemo(() => {
    const active = publications.filter((p) => p.status === 'active').length;
    const pendingReplies = publications.filter((p) => p.status === 'active' && p.replyCount > 0).length;
    const today = publications.filter((p) => {
      if (!p.lastCheckedAt) return false;
      return Date.now() - new Date(p.lastCheckedAt).getTime() < 86_400_000;
    }).length;
    return [
      { key: 'total',   label: 'Total',          value: publications.length, color: 'var(--fg-1)' },
      { key: 'active',  label: 'Active',          value: active,             color: 'var(--ok)' },
      { key: 'replies', label: 'With Replies',    value: pendingReplies,     color: pendingReplies > 0 ? 'var(--neon-amber)' : 'var(--fg-3)' },
      { key: 'checked', label: 'Checked Today',   value: today,              color: 'var(--neon-cyan)' },
    ];
  }, [publications]);

  const filtered = useMemo(() => {
    if (filterStatus === 'all') return publications;
    return publications.filter((p) => p.status === filterStatus);
  }, [publications, filterStatus]);

  const handleStatusChange = async (id: number, status: string) => {
    await updatePublicationStatus(id, status);
    setPublications((prev) => prev.map((p) => p.id === id ? { ...p, status, nextCheckAt: status === 'active' ? new Date().toISOString() : p.nextCheckAt } : p));
  };

  const handleIntervalChange = async (id: number, hours: number) => {
    await updatePublicationInterval(id, hours);
    setPublications((prev) => prev.map((p) => p.id === id ? { ...p, checkIntervalHours: hours } : p));
  };

  const handleAdded = () => {
    // Reload publications after adding
    import('@/lib/actions/publications').then(({ listPublications }) => {
      listPublications(projectId).then((fresh) => { setPublications(fresh); }).catch(() => {});
    });
  };

  return (
    <div className="page" style={{ padding: 16, maxWidth: 1000 }}>
      <div className="page-head" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="page-title">
            📡 Publication Monitor
            <small style={{ fontSize: 11, color: 'var(--fg-4)', fontWeight: 400 }}>
              {' '}// {publications.length} tracked
            </small>
          </h1>
          <p className="page-sub" style={{ fontSize: 12, color: 'var(--fg-3)', margin: 0 }}>
            Track published posts across forums, Reddit, HN — get notified when replies arrive, engage within the golden window.
          </p>
        </div>
      </div>

      <StatsStrip cards={stats} />

      {/* Filter chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '10px 0 12px' }}>
        {(['all', 'active', 'paused', 'archived'] as const).map((s) => (
          <span
            key={s}
            className="chip"
            data-active={filterStatus === s || undefined}
            onClick={() => setFilterStatus(s)}
            style={{ cursor: 'pointer', fontSize: 11, color: filterStatus === s ? 'var(--fg-0)' : 'var(--fg-3)' }}
          >
            {s}
          </span>
        ))}
        <span style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', marginLeft: 'auto', alignSelf: 'center' }}>
          auto-refresh 30s
        </span>
      </div>

      {/* Add form */}
      <AddPublicationForm projectId={projectId} onAdded={handleAdded} />

      {/* Table / empty state */}
      {publications.length === 0 ? (
        <EmptyState
          icon="📡"
          title="No publications tracked yet"
          description={`Paste a URL to a forum thread, Reddit post, or HN item you've published.\nThe monitor checks for new replies and creates inbox tasks when activity is detected.`}
          action={
            <div style={{ fontSize: 12, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginTop: 8, textAlign: 'left', display: 'inline-block' }}>
              <div>Supported platforms:</div>
              {Object.entries(PLATFORM_CONFIGS).map(([key, cfg]) => (
                <div key={key} style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <span>{cfg.icon}</span>
                  <span style={{ color: 'var(--fg-1)' }}>{cfg.label}</span>
                  <span style={{ color: 'var(--fg-4)' }}>· every {cfg.defaultIntervalHours}h · {cfg.evergreen ? 'evergreen' : 'time-sensitive'}</span>
                </div>
              ))}
            </div>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon="🔍" title={`No ${filterStatus} publications`} description={`Switch filter or add a new publication above.`} compact />
      ) : (
        <div className="panel" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 32 }} />  {/* icon */}
              <col style={{ width: '35%' }} />  {/* title */}
              <col style={{ width: '12%' }} />  {/* posted */}
              <col style={{ width: '12%' }} />  {/* last activity */}
              <col style={{ width: '8%' }} />   {/* replies */}
              <col style={{ width: '8%' }} />   {/* next check */}
              <col style={{ width: '8%' }} />   {/* status */}
              <col style={{ width: '10%' }} />  {/* actions */}
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                {(['', 'Title / URL', 'Posted', 'Last Activity', 'Replies', 'Next Check', 'Status', 'Actions'] as const).map((h, i) => (
                  <th key={i} style={{ padding: '6px 6px', textAlign: 'left', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, ...(i === 0 ? { paddingLeft: 10 } : {}), ...(i === 7 ? { paddingRight: 10 } : {}) }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((pub) => (
                <PublicationRow
                  key={pub.id}
                  pub={pub}
                  onStatusChange={handleStatusChange}
                  onIntervalChange={handleIntervalChange}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
