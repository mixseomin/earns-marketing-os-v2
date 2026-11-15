#!/usr/bin/env node
// gop-y.mjs — MỘT LỆNH cho hòm góp ý studio.on.tc (đường của /tasks-studio), chạy trên iMac.
// tra-repo-ok: mã dán keo nội bộ — bọc scripts/gop-y.sh trên box3, không có thư viện ngoài cho việc này.
//
// Vì sao có tệp này: gop-y.sh trên box3 là cửa GHI (claim / reply / submit, có cổng "nộp phải có
// link"), nhưng một lượt /tasks-studio còn phải tự lo ba thứ dễ rớt: lọc ra việc thật sự mở (hòm
// có 1 việc mở chìm giữa 105 card Review, đo 15/11/2026), nhận cả lô trước khi đọc, và TẢI ẢNH về
// mà đọc (phần lớn lỗi hiển thị nằm trong ảnh). Ở đây mỗi thứ là một động từ. Mọi động tác GHI vẫn
// đi qua gop-y.sh — không viết SQL ghi thứ hai.
//
//   node gop-y.mjs ds [review|all]          việc còn phải làm (pending/claimed) + dòng đếm
//   node gop-y.mjs nhan <id…>               nhận cả lô (→ In progress) rồi in luồng + tải ảnh từng mục
//   node gop-y.mjs xem <id>                 in luồng + tải ảnh, không đổi trạng thái
//   node gop-y.mjs tra-loi <id> "<lời>"     thêm tin vào luồng (để nguyên trạng thái)
//   node gop-y.mjs nop <id> "<lời>" [url]   nộp cho anh duyệt → Review (KHÔNG phải đóng sổ)
//   node gop-y.mjs tu-kiem                  kiểm đường ssh + đọc được hòm
//
// Ảnh tải về /Users/htuan/.cache/gop-y-studio/<id>/ (iMac), in đường dẫn tuyệt đối để Read.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const HOST = process.env.STUDIO_HOST || 'root@167.233.241.16';
const P = 'xuong-video';
const GOPY = `GOPY_PROJECT=${P} /opt/earns-marketing-os-v2/scripts/gop-y.sh`;
const ENV = 'set -a; . /opt/earns-marketing-os-v2/.env.production; set +a';
const SCOPE = `project_id = '${P}' AND prep_payload->>'source_platform' = 'feedback'`;
const ST = `COALESCE(prep_payload->'site_status'->>'${P}', 'pending')`;
const DONG = `('review','completed','verified','dropped','broken')`;
const KHO_ANH = join(homedir(), '.cache', 'gop-y-studio');

const die = (m) => { console.error(`gop-y: ${m}`); process.exit(1); };
const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`; // nháy đơn an toàn cho shell phía box

// Chạy trên box3; lỗi ssh / psql phải KÊU, không trả rỗng im lặng (rỗng ≠ "không có việc").
function box(cmd, input) {
  const r = spawnSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', HOST, cmd], { input, encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) die(`lệnh trên box3 hỏng (exit ${r.status}): ${(r.stderr || r.stdout || '').trim()}`);
  return r.stdout;
}
const sql = (s, opts = '-P pager=off') => box(`${ENV}; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 ${opts}`, s);
const gopy = (...a) => box(`${GOPY} ${a.map(q).join(' ')}`);
const soId = (x) => (/^\d+$/.test(x || '') ? x : die(`id lạ: ${x ?? '(thiếu)'}`));

function ds(che) {
  const loc = che === 'all' ? '' : che === 'review' ? `AND ${ST} = 'review'` : `AND ${ST} NOT IN ${DONG}`;
  const tieu = che === 'all' ? 'mọi trạng thái' : che === 'review' ? 'đã nộp, chờ anh duyệt' : 'còn phải xử';
  const dem = sql(`SELECT count(*) FILTER (WHERE ${ST} NOT IN ${DONG}) || ' việc mở · ' || count(*) FILTER (WHERE ${ST} = 'review') || ' chờ duyệt' FROM human_tasks WHERE ${SCOPE};`, '-At').trim();
  console.log(`=== GÓP Ý studio — ${tieu} — ${dem} ===`);
  process.stdout.write(sql(`SELECT id, ${ST} AS trang_thai, COALESCE(prep_payload->>'loai','—') AS loai,
      left(title, 70) AS tieu_de, jsonb_array_length(COALESCE(prep_payload->'trao_doi','[]'::jsonb)) AS tin,
      to_char(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM') AS gui_luc_vn
    FROM human_tasks WHERE ${SCOPE} ${loc} ORDER BY created_at;`));
}

async function xem(id) {
  const ra = gopy('show', id);
  if (!ra.includes(`| ${id} `) && !new RegExp(`^id\\s*\\|\\s*${id}$`, 'm').test(ra)) die(`#${id}: không phải card góp ý studio (hoặc không tồn tại)`);
  process.stdout.write(ra);
  // Ngữ cảnh lúc gửi (phim · tập · cảnh · vị trí timeline · lỗi trên màn · máy) chỉ nằm trong
  // prep_payload.draft — gop-y.sh show không in, thiếu nó là đoán "nút kia" là nút nào.
  const nc = sql(`SELECT COALESCE(prep_payload->>'draft','') FROM human_tasks WHERE id = ${id} AND ${SCOPE};`, '-At')
    .split('\n').filter((d) => /^(Ngữ cảnh|\[Trang báo lỗi)/.test(d.trim()));
  if (nc.length) console.log(`--- 🧭 ngữ cảnh lúc gửi ---\n${nc.join('\n')}`);
  // Ảnh: cột anh của luồng + ảnh nhúng trong chữ (![ảnh](url)) — gom cả hai, bỏ trùng.
  const urls = [...new Set(ra.match(/https:\/\/img\.on\.tc\/[^\s)'"|]+/g) || [])];
  if (!urls.length) { console.log('--- 🖼 không có ảnh ---'); return; }
  const thu = join(KHO_ANH, id); mkdirSync(thu, { recursive: true });
  console.log(`--- 🖼 ${urls.length} ảnh đã tải (Read từng tệp) ---`);
  for (const [i, u] of urls.entries()) {
    const tep = join(thu, `${i + 1}${(u.match(/\.(png|jpe?g|webp|gif)$/i) || ['.png'])[0]}`);
    if (!existsSync(tep)) {
      const r = await fetch(u);
      if (!r.ok) { console.log(`  LỖI tải ${u}: HTTP ${r.status}`); continue; }
      writeFileSync(tep, Buffer.from(await r.arrayBuffer()));
    }
    console.log(`  ${tep}`);
  }
}

const [cmd = 'ds', ...a] = process.argv.slice(2);
switch (cmd) {
  case 'ds': ds(a[0]); break;
  case 'nhan': {
    if (!a.length) die('thiếu id');
    a.forEach(soId);
    // Nhận CẢ LÔ trước khi đọc mục nào — phiên khác chạy song song thấy In progress mà bỏ qua.
    for (const id of a) { gopy('claim', id); console.log(`#${id} → In progress`); }
    for (const id of a) { console.log(`\n################ #${id} ################`); await xem(id); }
    break;
  }
  case 'xem': await xem(soId(a[0])); break;
  case 'tra-loi': soId(a[0]); if (!a[1]) die('thiếu lời'); gopy('reply', a[0], a[1]); console.log(`#${a[0]}: đã thêm tin`); break;
  case 'nop': soId(a[0]); if (!a[1]) die('thiếu lời nộp (sai gì · sửa gì · commit nào)');
    gopy('submit', ...a.slice(0, 3)); console.log(`#${a[0]} → Review (chờ anh duyệt)`); break;
  case 'tu-kiem': {
    const n = sql(`SELECT count(*) FROM human_tasks WHERE ${SCOPE};`, '-At').trim();
    if (!/^\d+$/.test(n)) die(`đọc hòm ra lạ: ${n}`);
    console.log(`ok: ssh ${HOST} + psql đọc được hòm studio (${n} card)`); break;
  }
  default: die(`lệnh lạ: ${cmd} — dùng ds | nhan | xem | tra-loi | nop | tu-kiem`);
}
