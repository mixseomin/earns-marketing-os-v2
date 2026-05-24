import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

// Public (no auth) endpoint trả về deployed commit SHA + build time.
// Ext FAB poll mỗi 10s → so sánh SHA với last-known → biết deploy mới
// vừa live → nhắc user reload page Reddit để code mới active.
//
// Source SHA priority:
//   1. process.env.BUILD_SHA (set qua GHA env trước build)
//   2. .git/HEAD ở /opt/earns-marketing-os-v2 runtime
//   3. 'unknown'

let cachedSha: string | null = null;
let cachedStartedAt: number = Date.now();

function readGitSha(): string {
  if (cachedSha) return cachedSha;
  if (process.env.BUILD_SHA) {
    cachedSha = process.env.BUILD_SHA;
    return cachedSha;
  }
  // Try read .git/HEAD ở repo root - works trên server có git clone
  // (GHA deploy.sh git pull → .git/HEAD update sau mỗi deploy).
  try {
    // Repo root từ Next.js: apps/web/.next/... → cd 3 levels up
    const candidates = [
      join(process.cwd(), '.git', 'HEAD'),
      join(process.cwd(), '..', '..', '.git', 'HEAD'),
      '/opt/earns-marketing-os-v2/.git/HEAD',
    ];
    for (const headPath of candidates) {
      if (!existsSync(headPath)) continue;
      const head = readFileSync(headPath, 'utf-8').trim();
      // HEAD có thể là 'ref: refs/heads/main' hoặc SHA trực tiếp
      if (head.startsWith('ref: ')) {
        const refPath = headPath.replace('HEAD', head.slice(5));
        if (existsSync(refPath)) {
          cachedSha = readFileSync(refPath, 'utf-8').trim().slice(0, 12);
          return cachedSha;
        }
      } else {
        cachedSha = head.slice(0, 12);
        return cachedSha;
      }
    }
  } catch {
    // silent fallback
  }
  cachedSha = 'unknown';
  return cachedSha;
}

export async function GET() {
  const sha = readGitSha();
  return NextResponse.json({
    ok: true,
    sha,
    started_at: new Date(cachedStartedAt).toISOString(),
    uptime_sec: Math.floor((Date.now() - cachedStartedAt) / 1000),
    server_time: new Date().toISOString(),
  }, {
    headers: {
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
