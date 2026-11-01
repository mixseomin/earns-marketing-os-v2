// WORKER SHOT CODE trên iMac (anh 01/11/2026 "làm B3 luôn"): box3 không được chạy trình duyệt, nên lớp hình của mẫu khai `shotCode` (mau-dung.ts)
// dựng ở đây rồi gửi về. Một lượt: hỏi box3 hàng chờ (may-dung.mts --cho-code) → mỗi video: tải ảnh nền, quay trang HTML ra MP4 (dung.mjs, không tiếng)
// → scp lên box3 → may-dung.mts --gan-code (R2 + ghép tiếng + khung + ảnh, xuất lại). 0đ. Hàng chờ do xuatVideo đánh dấu (cột hinh_code.cho).
//   cd /Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/xuong-video && ../../node_modules/.bin/tsx scripts/shot-code/may.mts [--so N]
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BOX = 'root@167.233.241.16', DIR = new URL('.', import.meta.url).pathname, THU = join(tmpdir(), 'shot-code-may');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const boxTsx = (args: string, han = 300): string => execFileSync('ssh', [BOX, `cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/may-dung.mts ${args}`], { encoding: 'utf8', timeout: han * 1000 }).trim();
type Cho = { id: number; slug: string; mau: string; phien: string; nen_url: string | null; trang: string; cau: Record<string, unknown> };

const a = process.argv.slice(2), so = Number(a[a.indexOf('--so') + 1]) || 10;
const ds = JSON.parse(boxTsx(`--cho-code --so ${so}`).split('\n').pop() || '[]') as Cho[];
if (!ds.length) { console.log('· shot code: không có video chờ'); process.exit(0); }
mkdirSync(THU, { recursive: true });
let hong = 0;
for (const x of ds) {
  const t0 = Date.now(), nen = join(THU, `${x.id}.jpg`), cau = join(THU, `${x.id}.json`), ra = join(THU, `${x.id}.mp4`), tren = `/tmp/shot-code-${x.id}.mp4`;
  try {
    if (!x.nen_url) throw new Error('chưa có ảnh nền (nen_url)');
    const r = await fetch(x.nen_url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60_000) });
    if (!r.ok) throw new Error(`tải ảnh nền ${r.status}`);
    writeFileSync(nen, Buffer.from(await r.arrayBuffer()));
    writeFileSync(cau, JSON.stringify({ ...x.cau, nen: `file://${nen}` }));
    execFileSync(process.execPath, [join(DIR, 'dung.mjs'), '--trang', join(DIR, x.trang), '--cau', cau, '--ra', ra], { stdio: ['ignore', 'ignore', 'inherit'], timeout: 10 * 60_000 });
    execFileSync('scp', ['-q', ra, `${BOX}:${tren}`], { timeout: 5 * 60_000 });
    const kq = boxTsx(`--gan-code ${x.id} ${x.phien} ${tren}`);
    console.log(`${kq.split('\n').pop()} · ${x.slug} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  } catch (e) { hong++; console.log(`✗ #${x.id} ${x.slug}: ${String((e as { stderr?: string }).stderr || (e as Error).message).trim().split('\n').pop()?.slice(0, 200)}`); }
  finally { for (const f of [nen, cau, ra]) rmSync(f, { force: true }); }
}
if (hong) process.exit(1);
