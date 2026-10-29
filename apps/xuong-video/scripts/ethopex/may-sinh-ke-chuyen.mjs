#!/usr/bin/env node
// MÁY SINH KỂ CHUYỆN THEO NHỊP (anh 29/10/2026 duyệt: kịch bản bằng ckey + tiến trình nền launchd có tên). iMac — br giữ phiên VideoExpress (tk #677 htuan82).
// Mỗi nhịp (launchd com.htuan.ethopex-may-sinh-ke-chuyen, 5 phút — nhịp chờ render thoát ngay, không mở Chrome; launchd không chạy chồng hai lượt) làm TIẾP đúng một phim, theo sổ ~/.cache/ethopex/vx-kc/may.json:
//   chon  hàng đợi hiệu quả (box3 hang-ke-chuyen.mts) → viết kịch bản ckey + tạo tập studio (box3 viet-ke-chuyen.mts, ~25₫)
//   sinh  giọng + ảnh + clip trên VideoExpress ($0, ≤ 5 clip song song — vx-ke-chuyen.mts; chưa xong thì nhịp sau làm tiếp)
//   nap   box3 nạp R2 + xuất thân phim (vx-nap-tap.mts, cổng không câm) → cta  thẻ cuối mẫu CTA v2 (vx-ke-chuyen --cta, cổng câm / giọng đè)
//   xong  đưa vào thư viện etp (thu-vien-them.mts, trạng thái "sẵn sàng")
//   len   TỰ ĐƯA LÊN THÀNH CREATIVE (anh 29/10/2026 "làm đi" — kế hoạch KT cho phim đang chạy): mỗi nhịp, bản "sẵn sàng" chưa có creative → thu-vien-len.py
//         (len-creative: kho + chữ QC + chấm Meta/AFS). Chấm Sạch rồi thì nhịp ethopex của cty lên camp KT $1 cho phim (worker ethopex.mjs, khối PHIM MỚI / KT).
// TÀI NGUYÊN: trần TRAN phim/ngày (giờ VN) — mặc định 12; một phim hỏng 3 lần thì bỏ (ghi dòng "loai" vào thư viện để hàng đợi không chọn lại trong 3 ngày).
// Phiên VideoExpress = scripts/videoexpress.mjs (profile RIÊNG htuan82-vx, không đụng htuan82 chính); xong mỗi nhịp đóng phiên đó.
//   node /Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/xuong-video/scripts/ethopex/may-sinh-ke-chuyen.mjs [--tran=12] [--xem]   (--xem: chỉ in sổ + hàng đợi)
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { moPhien, dongPhien } from '../videoexpress.mjs';   // phiên VideoExpress: MỘT tệp nền tảng, profile riêng htuan82-vx (anh 29/10/2026)

const XV = '/Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/xuong-video', B = 'root@167.233.241.16', HOME = process.env.HOME;
const BOX = 'cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx';
const TRAN = Number(process.argv.find((a) => a.startsWith('--tran='))?.slice(7) ?? 12);
const C = `${HOME}/.cache/ethopex/vx-kc`; mkdirSync(C, { recursive: true });
const SO = `${C}/may.json`, KHOA = `${C}/may.lock`;
const gio = () => new Date(Date.now() + 7 * 3600e3).toISOString().replace('T', ' ').slice(0, 16);
const ngay = () => gio().slice(0, 10);
const ghi = (s) => console.log(`[${gio()} VN] ${s}`);
const so = existsSync(SO) ? JSON.parse(readFileSync(SO, 'utf8')) : { dang: null, ngay: {}, bo: [], xong: [] };
const luu = () => writeFileSync(SO, JSON.stringify(so, null, 1));
const ssh = (lenh, han = 900) => execFileSync('ssh', [B, `${BOX} ${lenh}`], { encoding: 'utf8', timeout: han * 1000, maxBuffer: 64 << 20 }).trim();
const tsx = (args, han = 3600) => spawnSync(`${XV}/../../node_modules/.bin/tsx`, args, { cwd: XV, encoding: 'utf8', timeout: han * 1000, maxBuffer: 64 << 20 });
const q = (s) => JSON.stringify(s);

if (process.argv.includes('--xem')) { console.log(JSON.stringify(so, null, 1)); console.log(ssh('scripts/ethopex/hang-ke-chuyen.mts --so=5')); process.exit(0); }
// một lượt một lúc (launchd đã không chạy chồng; khoá này đỡ thêm khi chạy tay)
if (existsSync(KHOA)) { const pid = Number(readFileSync(KHOA, 'utf8')); try { process.kill(pid, 0); ghi(`lượt ${pid} đang chạy — bỏ nhịp này`); process.exit(0); } catch { /* khoá cũ */ } }
writeFileSync(KHOA, String(process.pid));
const dong = () => { try { unlinkSync(KHOA); } catch { /* */ } dongPhien(); };

// DÒNG "ĐANG SINH" TRÊN THƯ VIỆN (anh 29/10/2026: "nếu đang tạo video cho phim nào thì show ở etp.on.tc/?t=tv&tvt=dang_sinh"): có tập là ghi một dòng etp.thu_vien
// theo tap_id, mỗi nhịp cập nhật bước + ảnh bìa (khung cảnh 1 VideoExpress vừa sinh); xong thì thu-vien-them.mts đổi chính dòng đó sang "sẵn sàng", hỏng 3 lần → "loai"
const lit = (x) => `'${String(x ?? '').replace(/'/g, "''")}'`;
const psql = (cau) => execFileSync('ssh', [B, 'cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; psql "$DATABASE_URL" -q'], { timeout: 60e3, input: cau });
function tienDo(d) {
  try { const x = JSON.parse(readFileSync(`${C}/${d.tap}/so.json`, 'utf8')).canh ?? {}; const v = Object.values(x);
    return { am: v.filter((c) => c.am).length, anh: v.filter((c) => c.anh).length, vid: v.filter((c) => c.vid).length, bia: x['1']?.anhUuid ? `https://user-assets.renderplatform.com/preview/${x['1'].anhUuid}.jpg` : null }; }
  catch { return { am: 0, anh: 0, vid: 0, bia: null }; }
}
function dongTv(d, tt, ghiChu) {
  if (!d.tap) return;
  const t = tienDo(d);
  try { psql(`update etp.thu_vien set trang_thai = ${lit(tt)}, ghi = ${lit(ghiChu)}, anh = coalesce(${t.bia ? lit(t.bia) : 'null'}, anh), cap_nhat = now() where tap_id = ${Number(d.tap)};
insert into etp.thu_vien (content_id, dang, lang, ten, tap_id, nguon, trang_thai, ghi, anh, chi_vnd) select ${Number(d.content_id)}, 'kể chuyện', ${lit(d.lang)}, ${lit(d.ten)}, ${Number(d.tap)}, 'videoexpress', ${lit(tt)}, ${lit(ghiChu)}, ${t.bia ? lit(t.bia) : 'null'}, ${Number(d.chi_vnd ?? 0)}
  where not exists (select 1 from etp.thu_vien where tap_id = ${Number(d.tap)});`); }
  catch (e) { ghi(`  không ghi được dòng thư viện: ${String(e).slice(0, 120)}`); }
}
const buocChu = (d) => { const t = tienDo(d); return d.buoc === 'sinh' ? `giọng ${t.am}/6 · ảnh ${t.anh}/6 · clip ${t.vid}/6` : d.buoc === 'nap' ? 'xuất thân phim' : d.buoc === 'cta' ? 'gắn thẻ cuối CTA v2' : d.buoc; };

function hong(loi) {
  const d = so.dang; d.lan = (d.lan ?? 0) + 1; d.loi = String(loi).slice(0, 400);
  ghi(`✗ ${d.ten} bước ${d.buoc} (lần ${d.lan}): ${d.loi}`);
  if (d.lan >= 3) {
    // LỖI MÁY ≠ PHIM HỎNG (29/10/2026: "br: TU CHOI 'eval' — chua gan profile" làm bỏ oan Atrás + Step Back, chặn 3 ngày): lỗi br / mạng / hết giờ → 'loi_may'
    // (hàng đợi chọn lại ngay khi máy lành, không vào sổ bỏ); chỉ lỗi của chính phim (kịch bản, cổng, xuất) mới 'loai'
    const mayLoi = /br: TU CHOI|\/bin\/br |ECONN|ETIMEDOUT|timed out|Connection (reset|closed)|ssh:/i.test(d.loi);
    if (!mayLoi) so.bo.push({ content_id: d.content_id, ten: d.ten, loi: d.loi, luc: gio() });
    if (d.tap) dongTv(d, mayLoi ? 'loi_may' : 'loai', `máy sinh ${mayLoi ? 'dừng vì LỖI MÁY' : 'bỏ'} sau 3 lần hỏng (bước ${d.buoc}): ${d.loi.slice(0, 200)}`);
    else { try { psql(`insert into etp.thu_vien (content_id, dang, ten, nguon, trang_thai, ghi) values (${Number(d.content_id)}, 'kể chuyện', ${lit(d.ten)}, 'videoexpress', 'loai', ${lit(`máy sinh bỏ sau 3 lần hỏng (bước ${d.buoc}): ${d.loi.slice(0, 200)}`)});`); } catch (e) { ghi(`  không ghi được dòng loai: ${e}`); } }
    ghi(`  bỏ phim ${d.ten} sau 3 lần hỏng`); so.dang = null;
  }
  else if (d.tap) dongTv(d, 'dang_sinh', `${buocChu(d)} · lỗi lần ${d.lan}, nhịp sau thử lại`);
  luu();
}
// ── ĐƯA BẢN SẴN SÀNG LÊN CREATIVE (tối đa 2 / nhịp, trước khi làm phim dở — bản xong không nằm chờ người chọn) ──
try {
  const tv = execFileSync('ssh', [B, `cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; psql "$DATABASE_URL" -tAc "select id from etp.thu_vien where trang_thai = 'san_sang' and creative_id is null and nguon = 'videoexpress' order by id limit 2"`], { encoding: 'utf8', timeout: 60e3 }).trim().split(/\s+/).filter(Boolean);
  if (tv.length) {
    const r = spawnSync('python3', [`${XV}/scripts/ethopex/thu-vien-len.py`, ...tv], { cwd: XV, encoding: 'utf8', timeout: 40 * 60e3, maxBuffer: 64 << 20 });
    ghi(`đưa lên creative tv${tv.join(', tv')}: ${(r.stdout || r.stderr || '').trim().split('\n').filter((l) => /^[✓✗]|tv\d+:/.test(l)).slice(-3).join(' · ') || `mã thoát ${r.status}`}`);
  }
} catch (e) { ghi(`✗ đưa lên creative: ${String(e?.message ?? e).slice(0, 200)}`); }
try {
  // ── chọn phim mới khi không có phim dở ──
  if (!so.dang) {
    const n = so.ngay[ngay()] ?? 0;
    if (n >= TRAN) { ghi(`đủ trần ${TRAN} phim hôm nay — nghỉ`); dong(); process.exit(0); }
    const bo = new Set(so.bo.map((x) => x.content_id));
    const hang = JSON.parse(ssh('scripts/ethopex/hang-ke-chuyen.mts --so=8').split('\n').pop()).filter((x) => !bo.has(x.content_id));
    if (!hang.length) { ghi('hàng đợi trống'); dong(); process.exit(0); }
    const p = hang[0];
    ghi(`chọn ${p.ten} (${p.lang}, điểm ${p.diem}, lãi 14 ngày $${p.lai14}) → viết kịch bản`);
    so.dang = { content_id: p.content_id, ten: p.ten, lang: p.lang, buoc: 'viet', lan: 0, bat_dau: gio(), phim: p }; luu();
  }
  const d = so.dang;
  if (d.buoc === 'viet') {
    const r = JSON.parse(ssh(`scripts/ethopex/viet-ke-chuyen.mts ${q(JSON.stringify(d.phim))}`, 900).split('\n').pop());
    Object.assign(d, { tap: r.tap, giong: r.giong, chi_vnd: r.chi_vnd, buoc: 'sinh', lan: 0 }); luu();
    ghi(`  kịch bản xong (${r.chi_vnd}₫) → tập #${r.tap}`); dongTv(d, 'dang_sinh', 'kịch bản xong · bắt đầu sinh giọng / ảnh / clip');
  }
  if (d.buoc === 'sinh') {
    // CHỜ RENDER KHÔNG MỞ CHROME (anh 29/10/2026 "khi đợi có thể đóng br lại cho nhẹ"): đợt clip vừa gửi chưa đủ ~4,5 phút (VideoExpress render ~4 phút) → nhịp này bỏ qua
    if (d.gui_luc && Date.now() - d.gui_luc < 270e3) { ghi(`  đang render (gửi ${Math.round((Date.now() - d.gui_luc) / 60e3)} phút trước) — không mở trình duyệt`); try { unlinkSync(KHOA); } catch { /* */ } process.exit(0); }
    await moPhien();
    const r = tsx(['scripts/ethopex/vx-ke-chuyen.mts', `--tap=${d.tap}`, `--giong=${d.giong}`, '--khong-cho'], 20 * 60);
    dongPhien();   // gửi / thu xong là đóng Chrome ngay — không giữ trình duyệt trong lúc chờ render
    const out = r.stdout || '';
    ghi(`  sinh: ${out.trim().split('\n').filter((l) => /✓|→|✗|chưa đủ/.test(l)).slice(-8).join(' · ')}`);   // 8 dòng: 4 dòng cuối từng che lỗi giọng #1–3 (29/10/2026)
    if (/→ gửi clip/.test(out)) d.gui_luc = Date.now();
    dongTv(d, 'dang_sinh', r.status === 0 ? 'đủ 6 cảnh · xuất thân phim' : buocChu(d));
    if (r.status === 0) { d.buoc = 'nap'; d.lan = 0; delete d.gui_luc; luu(); } else if (/chưa đủ/.test(out)) { ghi('  chưa đủ clip — nhịp sau thu tiếp'); luu(); dong(); process.exit(0); } else throw new Error((r.stderr || out || 'vx-ke-chuyen lỗi').slice(-400));
  }
  if (d.buoc === 'nap') {
    execFileSync('ssh', [B, `mkdir -p /var/tmp/vx-kc/${d.tap}`]);
    execFileSync('rsync', ['-a', '--exclude', 'lan1-*', `${C}/${d.tap}/`, `${B}:/var/tmp/vx-kc/${d.tap}/`], { timeout: 900e3 });
    const ra = ssh(`scripts/ethopex/vx-nap-tap.mts ${d.tap} /var/tmp/vx-kc/${d.tap} 2>&1`, 1500);
    const url = /✓ MP4 [\d.]+s → (\S+)/.exec(ra)?.[1];
    if (!url) throw new Error(`xuất không ra MP4: ${ra.slice(-300)}`);
    Object.assign(d, { url, buoc: 'cta', lan: 0 }); luu(); ghi(`  xuất thân phim: ${url}`); dongTv(d, 'dang_sinh', buocChu(d));
  }
  if (d.buoc === 'cta') {
    const r = tsx(['scripts/ethopex/vx-ke-chuyen.mts', `--tap=${d.tap}`, `--cta=${d.url}`], 15 * 60);
    if (r.status !== 0) throw new Error((r.stderr || r.stdout || 'CTA lỗi').slice(-400));
    const tep = `${C}/${d.tap}/${d.tap}-cta-v2.mp4`;
    execFileSync('rsync', ['-a', tep, `${B}:/var/tmp/vx-kc/${d.tap}/`], { timeout: 600e3 });
    const ra = ssh(`scripts/ethopex/thu-vien-them.mts ${d.tap} /var/tmp/vx-kc/${d.tap}/${d.tap}-cta-v2.mp4 --chi-vnd=${d.chi_vnd ?? 0} --ghi=${q(`máy sinh ${d.bat_dau} → ${gio()}`)}`, 600);
    ghi(`  ${ra.split('\n').pop()}`);
    so.ngay[ngay()] = (so.ngay[ngay()] ?? 0) + 1;
    so.xong.push({ content_id: d.content_id, ten: d.ten, tap: d.tap, luc: gio(), chi_vnd: d.chi_vnd ?? 0 }); so.xong = so.xong.slice(-200);
    so.dang = null; luu();
    ghi(`✓ ${d.ten} vào thư viện — hôm nay ${so.ngay[ngay()]}/${TRAN}`);
  }
} catch (e) { if (so.dang) hong(e?.message ?? e); else ghi(`✗ ${e?.message ?? e}`); }
dong();
process.exit(0);
