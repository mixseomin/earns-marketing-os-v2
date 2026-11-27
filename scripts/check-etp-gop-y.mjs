#!/usr/bin/env node
/* LUẬT: góp ý etp đã sửa thì KHÔNG được quay về bản cũ.
 *
 * Vì sao có tệp này. 29/10/2026 con chuyển Camp › Cây sang DataTable và chép tay ô creative từ một
 * bản cũ — mất luôn "chỉ mã + điểm chấm + ×N" anh đã sửa ở #1465 / #1474. Anh phải tự phát hiện
 * (#1476) rồi hỏi: "lần sau tao không để ý mày lại khôi phục cái cũ thì sao?". Câu trả lời đúng
 * không phải một lời hứa mà là máy chặn: mỗi góp ý đã sửa ghi một ĐIỀU KIỆN ở đây; bản nào làm
 * điều kiện đó sai thì CI + deploy.sh dừng, bản đang chạy giữ nguyên.
 *
 * Cách thêm (bắt buộc với mọi card etp đã sửa — xem .claude/commands/tasks-etp.md): ghi vào apps/etp/gop-y-luat.mjs (danh sách nằm trong app etp từ 10/11/2026)
 *   { card: <id>, tep: <tệp>, mot | co | cam: '<chuỗi>', vi: '<anh muốn gì>' }
 *   mot = xuất hiện ĐÚNG một lần (một chỗ định nghĩa — chép thêm bản thứ hai là đỏ)
 *   co  = phải có · cam = không được có (dạng cũ anh đã bỏ)
 *
 * TẦM VỚI: đọc CHUỖI trong mã, không nhìn màn hình. Bắt được: chép lại khối cũ, xoá chỗ sửa, đẻ
 * bản thứ hai. Không bắt được: chỗ sửa còn nguyên nhưng bị một điều kiện luôn sai vô hiệu hoá.
 * `--tu-kiem` phá thử từng điều kiện (bỏ chuỗi / nhân đôi / chèn dạng cũ) — phải đỏ hết.
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// danh sách điều kiện nằm trong app etp (apps/etp/gop-y-luat.mjs, anh 10/11/2026) — tệp này chỉ còn máy chấm
import { LUAT as TAT_CA, V } from '../apps/etp/gop-y-luat.mjs';

// LUẬT TRÊN MÃ REPO RIÊNG — cty (tách 18/11/2026, github.com/mixseomin/cty) và etp2 (tách 27/11/2026, github.com/mixseomin/etp2). Luật vẫn MỘT chỗ
// (apps/etp/gop-y-luat.mjs), chấm ở nơi có mã thật: monorepo bỏ các luật apps/cty/* + apps/etp2/*; repo kia chạy chính tệp này với cờ của nó + biến gốc
// (đường apps/<app>/x → <gốc>/x; etp2: x không có thì <gốc>/goi/web/x — hai sổ máy đọc nằm ở goi/web). Không bao giờ âm thầm bỏ: lượt monorepo in rõ số luật chuyển đi.
const NGOAI = [{ app: 'cty', prefix: 'apps/cty/', co: '--chi-cty', bien: 'LUAT_GOC_CTY' }, { app: 'etp2', prefix: 'apps/etp2/', co: '--chi-etp2', bien: 'LUAT_GOC_ETP2', du: ['goi/web'] }];
const CHI = NGOAI.find((n) => process.argv.includes(n.co));
const CHI_CTY = !!CHI;   // tên cũ: "đang chấm một repo ngoài" — bỏ các sổ chỉ monorepo có
if (CHI && !process.env[CHI.bien]) { console.error(`✗ ${CHI.co} cần ${CHI.bien}=<gốc repo ${CHI.app}>`); process.exit(1); }
const GOC_NGOAI = CHI && process.env[CHI.bien];
const doiTep = (t) => { const x = t.slice(CHI.prefix.length), a = `${GOC_NGOAI}/${x}`;
  if (existsSync(a)) return a;
  for (const d of CHI.du ?? []) { const b = `${GOC_NGOAI}/${d}/${x}`; if (existsSync(b)) return b; }
  return a; };   // không có ở đâu → giữ đường chính, readFileSync kêu to ENOENT
const LUAT = (CHI ? TAT_CA.filter((l) => l.tep.startsWith(CHI.prefix)).map((l) => ({ ...l, tep: doiTep(l.tep) }))
  : TAT_CA.filter((l) => !NGOAI.some((n) => l.tep.startsWith(n.prefix))));
const SANG = CHI ? [] : NGOAI.map((n) => [n.app, TAT_CA.filter((l) => l.tep.startsWith(n.prefix)).length]).filter(([, k]) => k);
const NHAN = CHI ? ` (mã ${CHI.app})` : '';

// etp2 đã sang repo riêng (27/11/2026) — tệp nào commit lại vào apps/etp2 là sửa nhầm chỗ: bản đó không bao giờ lên etp2.on.tc. Đọc git (tệp đã theo dõi),
// không đọc thư mục: trên box3 apps/etp2/.next / node_modules cũ (bỏ qua bởi .gitignore) có thể còn sau git reset --hard.
if (!CHI) {
  const r = spawnSync('git', ['ls-files', '--', 'apps/etp2'], { encoding: 'utf8' });
  const lai = (r.stdout || '').split('\n').filter(Boolean);
  if (r.status === 0 && lai.length) {
    console.error(`✗ apps/etp2 mọc lại trong monorepo (${lai.length} tệp, vd ${lai.slice(0, 3).join(', ')}).\n  etp2 đã tách repo riêng github.com/mixseomin/etp2 — iMac /Users/htuan/Me/GitHub/etp2: sửa ở đó, lên bản bằng scripts/day.sh. Gỡ các tệp này khỏi monorepo.`);
    process.exit(1);
  }
}

const dem = (s, x) => s.split(x).length - 1;
const sai = (l, s) => (l.mot != null ? (dem(s, l.mot) === 1 ? null : `cần đúng 1 lần, đang ${dem(s, l.mot)}: ${l.mot}`)
  : l.co != null ? (s.includes(l.co) ? null : `mất: ${l.co}`)
  : s.includes(l.cam) ? `quay lại dạng cũ: ${l.cam}` : null);

if (process.argv.includes('--tu-kiem')) {
  let lot = 0;
  for (const l of LUAT) {
    const s = readFileSync(l.tep, 'utf8');
    const pha = l.mot != null ? [s.split(l.mot).join(''), s + l.mot] : l.co != null ? [s.split(l.co).join('')] : [s + l.cam];
    for (const x of pha) if (!sai(l, x)) { lot++; console.error(`✗ phá thử mà vẫn xanh: #${l.card} ${l.vi}`); }
    if (sai(l, s)) { lot++; console.error(`✗ bản hiện tại đã đỏ: #${l.card} ${l.vi}`); }
  }
  if (lot) process.exit(1);
  console.log(`✓ check-etp-gop-y tự kiểm${NHAN}: ${LUAT.length} điều kiện, phá thử đều đỏ`);
  process.exit(0);
}

const loi = [];
if (!CHI_CTY) {   // hai sổ dưới nằm trong web / studio — chỉ monorepo chấm
// SỔ LUẬT CHUNG phủ mọi danh sách máy luật xuất ra (đọc dòng ra_ = {...} của luat-ethopex.py)
{ const so = JSON.parse(readFileSync('apps/web/src/lib/etp-bang-luat.json', 'utf8')).khoa, src = readFileSync('apps/xuong-video/scripts/ethopex/luat-ethopex.py', 'utf8');
  const dong = src.split('\n').find((l) => l.trimStart().startsWith('ra_ = {"luc"')) ?? '';
  const khoa = [...dong.matchAll(/"([a-z0-9_]+)": m\(/g)].map((x) => x[1]);
  if (!khoa.length) loi.push('  #chat sổ luật chung — không đọc được dòng ra_ = {...} của luat-ethopex.py');
  for (const k of khoa) if (!so[k]) loi.push(`  #chat sổ luật chung thiếu khoá máy luật xuất ra: ${k} (thêm mục vào apps/web/src/lib/etp-bang-luat.json)`);
  for (const [k, v] of Object.entries(so)) if (v.nhat_ky) try { new RegExp(v.nhat_ky[1]); } catch { loi.push(`  #chat sổ luật chung: regex nhat_ky của ${k} hỏng`); } }
// SỔ WIDGET Tổng quan 2: mọi widget trong sổ có hàm vẽ (khoá trong ve={{...}} của <Tong2>), không hàm vẽ nào ngoài sổ, template chỉ dùng widget trong sổ
{ const so = JSON.parse(readFileSync('apps/web/src/lib/etp-widget.json', 'utf8')), v = readFileSync(V, 'utf8'), vs = readFileSync('apps/web/src/components/etp-tong2-widget.tsx', 'utf8');
  const ve = new Set([...(v.match(/<Tong2 [^\n]*/)?.[0] ?? '').matchAll(/([a-z0-9_]+): \(/g), ...vs.matchAll(/^    ([a-z0-9_]+): \(/gm)].map((x) => x[1]));
  for (const k of Object.keys(so.widget)) if (!ve.has(k)) loi.push(`  #chat sổ widget: ${k} chưa có hàm vẽ (ve của <Tong2> trong etp-view.tsx hoặc useVeSo trong etp-tong2-widget.tsx)`);
  for (const k of ve) if (!so.widget[k]) loi.push(`  #chat sổ widget: hàm vẽ ${k} không có trong apps/web/src/lib/etp-widget.json`);
  for (const [t, x] of Object.entries(so.template)) for (const o of x.o) if (!so.widget[o.ma]) loi.push(`  #chat template ${t} dùng widget ngoài sổ: ${o.ma}`); }
// LƯỚI XUNG ĐỘT LUẬT TĂNG (việc #125 phần C, anh 19/11/2026): ma trận 180 ô máy luật / cổng / etp2 (+ worker khi có /opt/cty) — chạy mỗi lần máy chấm này chạy (GHA Kiểm tĩnh mỗi lần đẩy, deploy.sh)
{ const r = spawnSync('python3', ['apps/etp/kiem-xung-dot-luat.py'], { encoding: 'utf8', timeout: 180_000 });
  process.stdout.write(r.stdout || '');
  if (r.status !== 0) loi.push(`  #ra-xung-dot-luat-1911 lưới xung đột luật tăng đỏ:\n${(r.stdout || '').split('\n').filter((x) => x.startsWith('ĐỎ')).slice(0, 12).map((x) => `    ${x}`).join('\n')}\n    ${(r.stderr || r.error?.message || '').trim().slice(-400)}`); }
}
// BIẾN TẦNG NGOÀI ĐÈ HÀM (22/11/2026): luật RN gán ke = … đè hàm ke() → thẻ xét luật 'int' object is not callable trên 8 camp — gác cả lớp ở mọi máy Ethopex
if (!CHI_CTY) { const r = spawnSync('python3', ['apps/etp/kiem-de-ham.py'], { encoding: 'utf8', timeout: 60_000 });
  if (r.status !== 0) loi.push(`  #de-ham-2211 biến tầng ngoài đè hàm trong máy Ethopex:\n${(r.stdout || r.stderr || '').split('\n').filter(Boolean).slice(0, 12).map((x) => `    ${x}`).join('\n')}`); }
for (const l of LUAT) { const e = sai(l, readFileSync(l.tep, 'utf8')); if (e) loi.push(`  #${l.card || 'chat'} ${l.vi} — ${e}`); }
if (loi.length) {
  console.error(`✗ góp ý etp đã sửa bị quay về bản cũ (${loi.length}):\n${loi.join('\n')}\n  Sửa mã cho đúng lại — KHÔNG xoá điều kiện trong scripts/check-etp-gop-y.mjs trừ khi anh đổi ý.`);
  process.exit(1);
}
console.log(`✓ check-etp-gop-y${NHAN}: ${LUAT.length} điều kiện giữ nguyên${SANG.map(([a, k]) => ` · ${k} điều kiện trên mã ${a} chấm ở repo ${a}`).join('')}`);
