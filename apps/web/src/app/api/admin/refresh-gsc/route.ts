import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { revalidateTag } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';

const execAsync = promisify(exec);

export async function POST() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Run PHP cron: pulls GSC for all 15 sites, writes gsc-latest.json
    // systemctl returns immediately on start; script ~3-4s for 15 sites
    await execAsync('systemctl start gsc-check.service', { timeout: 5_000 });

    // Wait for service to finish writing the file (poll up to 30s)
    let attempt = 0;
    let updatedAt: string | null = null;
    while (attempt++ < 30) {
      await new Promise((r) => setTimeout(r, 1_000));
      const { stdout } = await execAsync('systemctl is-active gsc-check.service || true').catch(() => ({ stdout: '' }));
      if (stdout.trim() !== 'active' && stdout.trim() !== 'activating') {
        // Service finished — read fresh JSON updated_at
        const r = await fetch('https://militarymarkdown.com/wp-content/uploads/phase7/gsc-latest.json?t=' + Date.now(), { cache: 'no-store' });
        if (r.ok) {
          const j = await r.json();
          updatedAt = j.updated_at || null;
        }
        break;
      }
    }

    // Bust Next.js fetch cache so portfolio re-fetches fresh JSON
    revalidateTag('gsc-json');

    return NextResponse.json({ ok: true, updated_at: updatedAt });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'unknown' },
      { status: 500 },
    );
  }
}
