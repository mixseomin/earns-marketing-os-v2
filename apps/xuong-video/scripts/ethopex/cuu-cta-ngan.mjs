#!/usr/bin/env node
// CỨU PHIM KỂ CHUYỆN BỊ BỎ Ở BƯỚC CTA VÌ SÀN 30s (anh 04/11/2026 "Ok. Làm thế đi"): 27 phim đã sinh + trả tiền đủ 6 clip, thân phim đã xuất,
// rớt ở cat-canh.py "bỏ giây cấm xong còn Ns — quá ngắn" (sàn 30s của tập thật áp nhầm cho kể chuyện ~33s; nay sàn 15s).
// Đọc log máy sinh → (tập, url thân phim) → chạy lại ĐÚNG bước cta của may-sinh-ke-chuyen.mjs (vx-ke-chuyen --cta → thu-vien-them) — KHÔNG sinh lại, $0.
// Giữ khoá của máy sinh suốt lượt: một lúc một việc dựng trên iMac (luật render một lúc một). Bỏ qua phim đã có bản kể chuyện khác đang dùng được.
// Dùng: node cuu-cta-ngan.mjs [--xem]
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const XV = '/Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/xuong-video', B = 'root@167.233.241.16', HOME = process.env.HOME;
const BOX = 'cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx';
const C = `${HOME}/.cache/ethopex/vx-kc`, KHOA = `${C}/may.lock`, LOG = `${HOME}/Library/Logs/ethopex/may-sinh-ke-chuyen.log`;
const XEM = process.argv.includes('--xem');
const gio = () => new Date(Date.now() + 7 * 3600e3).toISOString().replace('T', ' ').slice(0, 16);
const ghi = (s) => console.log(`[${gio()} VN] ${s}`);
const psqlA = (cau) => execFileSync('ssh', [B, `cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; psql "$DATABASE_URL" -qtA -c ${JSON.stringify(cau)}`], { encoding: 'utf8', timeout: 60e3 }).trim();

// 1. log → tập rớt vì quá ngắn (lần 3) + url thân phim xuất ngay trước đó
const ds = new Map(); let cuoi = null, dang = null;
for (const l of readFileSync(LOG, 'utf8').split('\n')) {
  let m = /xuất thân phim: (\S+\/(\d+)-A-\S+\.mp4)/.exec(l); if (m) { cuoi = { url: m[1], tap: m[2] }; continue; }
  m = /✗ (.+?) bước cta \(lần 3\)/.exec(l); if (m) { dang = m[1]; continue; }
  if (dang && cuoi && /quá ngắn, bỏ tập/.test(l) && /stderr/.test(l)) { ds.set(cuoi.tap, { ...cuoi, ten: dang }); dang = null; }
}
const viec = [...ds.values()].filter((x) => existsSync(`${C}/${x.tap}/so.json`) || existsSync(`${C}/${x.tap}`));
ghi(`${ds.size} tập rớt vì sàn 30s · ${viec.length} còn thư mục clip`);
if (XEM) { for (const x of viec) console.log(x.tap, x.ten); process.exit(0); }

if (existsSync(KHOA)) { const pid = Number(readFileSync(KHOA, 'utf8')); try { process.kill(pid, 0); ghi(`máy sinh (pid ${pid}) đang chạy — thử lại sau`); process.exit(1); } catch { /* khoá cũ */ } }
writeFileSync(KHOA, String(process.pid));
let xong = 0, bo = 0, loi = 0;
try {
  for (const x of viec) {
    const r = psqlA(`select content_id || '|' || (exists (select 1 from etp.thu_vien o where o.content_id = t.content_id and o.dang = 'kể chuyện' and o.trang_thai in ('san_sang', 'da_len', 'dang_sinh') and o.id <> t.id))::text from etp.thu_vien t where tap_id = ${Number(x.tap)} limit 1`);
    const [cid, coBanKhac] = r.split('|');
    if (!cid) { ghi(`  ${x.tap} ${x.ten}: không thấy dòng thư viện — bỏ`); bo++; continue; }
    if (coBanKhac === 'true') { ghi(`  ${x.tap} ${x.ten}: phim đã có bản kể chuyện khác dùng được — bỏ`); bo++; continue; }
    const t = spawnSync('taskpolicy', ['-b', `${XV}/../../node_modules/.bin/tsx`, 'scripts/ethopex/vx-ke-chuyen.mts', `--tap=${x.tap}`, `--cta=${x.url}`], { cwd: XV, encoding: 'utf8', timeout: 15 * 60e3, maxBuffer: 64 << 20 });
    if (t.status !== 0) { ghi(`  ✗ ${x.tap} ${x.ten}: ${(t.stderr || t.stdout || '').trim().split('\n').filter((s) => !/^\s+at /.test(s)).slice(-2).join(' | ').slice(0, 240)}`); loi++; continue; }
    const tep = `${C}/${x.tap}/${x.tap}-cta-v2.mp4`;
    execFileSync('ssh', [B, `mkdir -p /var/tmp/vx-kc/${x.tap}`]);
    execFileSync('rsync', ['-a', tep, `${B}:/var/tmp/vx-kc/${x.tap}/`], { timeout: 600e3 });
    const ra = execFileSync('ssh', [B, `${BOX} scripts/ethopex/thu-vien-them.mts ${x.tap} /var/tmp/vx-kc/${x.tap}/${x.tap}-cta-v2.mp4 --chi-vnd=0 --ghi=${JSON.stringify(`cứu bước cta (sàn 15s) ${gio()} — clip đã trả tiền ở lượt sinh trước`)}`], { encoding: 'utf8', timeout: 600e3 }).trim();
    ghi(`  ✓ ${x.tap} ${x.ten}: ${ra.split('\n').pop()}`); xong++;
  }
} finally { try { unlinkSync(KHOA); } catch { /* */ } }
ghi(`cứu xong ${xong} · bỏ ${bo} · lỗi ${loi}`);
