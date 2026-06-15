import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { revalidateTag } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';

const execAsync = promisify(exec);

// Services kicked off in parallel by the "Refresh All" button.
// gsc-check.service has bing-check chained via ExecStartPost — no need to call separately.
const SERVICES = [
  'gsc-check.service',
  'cgg-adsense-pull.service',
  'cgg-ga4-views.service',
  'cgg-ga4-realtime.service',
];

async function startAndWait(unit: string): Promise<{ unit: string; ok: boolean; durationMs: number }> {
  const start = performance.now();
  try {
    await execAsync(`systemctl start ${unit}`, { timeout: 5_000 });
  } catch {
    return { unit, ok: false, durationMs: 0 };
  }
  // Poll up to 90s for non-active state
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 1_000));
    const { stdout } = await execAsync(`systemctl is-active ${unit} || true`).catch(() => ({ stdout: '' }));
    const state = stdout.trim();
    if (state !== 'active' && state !== 'activating') {
      return { unit, ok: state === 'inactive' || state === 'failed' ? state !== 'failed' : true, durationMs: Math.round(performance.now() - start) };
    }
  }
  return { unit, ok: false, durationMs: Math.round(performance.now() - start) };
}

export async function POST() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Fire all services in parallel; wait for each to finish.
    const results = await Promise.all(SERVICES.map(startAndWait));

    // Read fresh updated_at from the GSC payload (Bing chains after it).
    let updatedAt: string | null = null;
    try {
      const r = await fetch('https://militarymarkdown.com/wp-content/uploads/phase7/gsc-latest.json?t=' + Date.now(), { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        updatedAt = j.updated_at || null;
      }
    } catch { /* swallow */ }

    revalidateTag('gsc-json');

    return NextResponse.json({ ok: true, updated_at: updatedAt, results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'unknown' },
      { status: 500 },
    );
  }
}
