// Awin daily-route reminder panel.
// Reads the daily snapshot published by /usr/local/bin/awin-daily-route.php
// (systemd awin-daily-route.timer, 08:00 +07). Awin has no apply API — applying
// programmes is manual via the mos2-crew Chrome extension, so this panel's job
// is to surface "did you run today's batch?" + the remaining backlog.

const AWIN_JSON_URL =
  'https://militarymarkdown.com/wp-content/uploads/phase7/awin-daily-latest.json';

type AwinDaily = {
  pub: number;
  date: string;
  updated_at: string;
  joined: number | null;
  pending: number | null;
  rejected: number | null;
  notjoined: number | null;
  delta_joined: number;
  delta_pending: number;
  prev_date: string | null;
  applied_since_last: boolean;
  streak_current?: number;
  streak_best?: number;
  missed_30d?: number;
  tracked_days?: number;
};

function todayUtcPlus7(): string {
  // Server day boundary for "applied today" — Vietnam is UTC+7.
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  return now.toISOString().slice(0, 10);
}

export async function AwinDailyPanel() {
  let d: AwinDaily | null = null;
  try {
    const r = await fetch(AWIN_JSON_URL, { next: { revalidate: 600 } });
    if (r.ok) d = (await r.json()) as AwinDaily;
  } catch {
    /* fall through */
  }

  const wrap: React.CSSProperties = {
    background: 'var(--bg-1)',
    border: '1px solid var(--line)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  };

  if (!d) {
    return (
      <div style={wrap}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>
          Awin Daily Route
        </h2>
        <p style={{ color: 'var(--fg-3)', fontSize: 12, margin: 0 }}>
          Tracker data unavailable — daily cron at 08:00 +07.
        </p>
      </div>
    );
  }

  // "Applied today?" — snapshot delta only tells us change since last run.
  // If the latest snapshot's growth happened and its date is today, treat as done.
  // Otherwise prompt to run the extension.
  const isToday = d.date === todayUtcPlus7();
  const appliedToday = isToday && d.applied_since_last;
  const statusColor = appliedToday ? 'var(--ok)' : 'var(--warn)';
  const statusText = appliedToday
    ? `Applied — +${d.delta_joined} joined, +${d.delta_pending} pending since ${d.prev_date ?? 'last run'}`
    : 'Not applied yet today — open the extension and run Auto';
  const streak = d.streak_current ?? 0;
  const best = d.streak_best ?? 0;
  const missed = d.missed_30d ?? 0;

  const updated = new Date(d.updated_at).toLocaleString('en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const stat = (label: string, val: number | null, tone?: string): React.ReactNode => (
    <div style={{ flex: 1, minWidth: 90 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: tone ?? 'var(--fg-1)' }}>
        {val === null ? '—' : val.toLocaleString()}
      </div>
      <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
        {label}
      </div>
    </div>
  );

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, margin: 0 }}>
          Awin Daily Route
          <small style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', marginLeft: 10, letterSpacing: '0.06em' }}>
            // pub {d.pub} · last sync {updated}
          </small>
        </h2>
        <a
          href="https://ui.awin.com/awin/publisher/410323/partnerships/explore"
          target="_blank"
          rel="noreferrer"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--neon-violet, #a78bfa)',
            textDecoration: 'none',
            border: '1px solid var(--line)',
            borderRadius: 6,
            padding: '5px 10px',
          }}
        >
          Open Awin → run extension
        </a>
      </div>

      <div
        style={
          appliedToday
            ? {
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 6,
                background: 'var(--bg-2)',
                marginBottom: 14,
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                color: statusColor,
              }
            : {
                // Loud, hard-to-ignore banner when the daily route hasn't run.
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 6,
                background: 'rgba(255,176,60,.12)',
                borderLeft: '4px solid var(--warn)',
                marginBottom: 14,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                color: statusColor,
              }
        }
      >
        <span style={{ fontSize: appliedToday ? 14 : 18 }}>{appliedToday ? '✓' : '⚠'}</span>
        {statusText}
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {stat('Joined', d.joined, 'var(--ok)')}
        {stat('Pending', d.pending, 'var(--neon-violet, #a78bfa)')}
        {stat('Rejected', d.rejected, 'var(--fg-2)')}
        {stat('Backlog (notjoined)', d.notjoined, 'var(--fg-1)')}
      </div>

      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: '1px solid var(--line)',
          display: 'flex',
          gap: 18,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--fg-2)',
        }}
      >
        <span title="Consecutive days the daily route ran (joined or pending grew)">
          🔥 Streak <b style={{ color: streak > 0 ? 'var(--ok)' : 'var(--fg-3)' }}>{streak}d</b>
        </span>
        <span title="Longest run since tracking started">
          Best <b style={{ color: 'var(--fg-1)' }}>{best}d</b>
        </span>
        <span title="Days in the last 30 where the route did not run">
          Missed 30d{' '}
          <b style={{ color: missed > 0 ? 'var(--warn)' : 'var(--ok)' }}>{missed}</b>
        </span>
      </div>
    </div>
  );
}
