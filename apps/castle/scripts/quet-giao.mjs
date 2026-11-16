#!/usr/bin/env node
// MÁY QUÉT GIAO VIỆC (anh 16/11/2026: hệ tự phản biện — bước 3 không cần anh ngồi tìm lỗi): hòm góp ý castle TRỐNG thì lấy khối lệch nặng nhất
// trong bảng chấm góc chuẩn (public/du-lieu/<lâu>-cham-goc.json, scripts/cham-goc.mjs) → tạo MỘT thẻ "[MÁY QUÉT]" trong hòm (kèm LECH-JSON camera góc lệch nhất,
// so-lech.mjs --the đọc được như thẻ 🔍) → Thắng (apps/cty/may/castle-gop-y.mjs) nhận như thẻ thường, sửa, trọng tài máy chấm, nộp Review.
// Chọn khối: |lệch| ≥ 1,5 m, đo tin được ở ≥ 2 góc, các góc CÙNG chiều và chênh nhau ≤ 3 m (thước chắc), bỏ nhà hàng dưới chân đồi (ngoài lâu đài),
// chưa có thẻ máy quét cho khối đó trong 3 ngày. Hòm còn thẻ mở (người gửi hay máy quét) thì không tạo — mỗi lúc một việc.
//   node apps/castle/scripts/quet-giao.mjs         tạo thẻ nếu đủ điều kiện   · --thu   chỉ in khối sẽ giao
// tra-repo-ok: keo nội bộ (đọc bảng chấm + ghi một dòng hòm góp ý).
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { du } from './chung.mjs';

const BOX = 'root@167.233.241.16', THU = process.argv.includes('--thu');
const sqlBox = (q) => execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', BOX,
  'cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && psql "$DATABASE_URL" -tA -v ON_ERROR_STOP=1 -f -'],
{ input: q, encoding: 'utf8', timeout: 60000 }).trim();
const LOC = "project_id = 'mos2' AND prep_payload->>'source_platform' = 'feedback' AND prep_payload->>'source_url' LIKE 'https://castle.on.tc/%'";

const mo = Number(sqlBox(`SELECT count(*) FROM human_tasks WHERE ${LOC} AND coalesce(prep_payload->'site_status'->>'mos2', status) IN ('pending','claimed','broken');`));
if (mo && !THU) { console.log(`hòm castle còn ${mo} thẻ mở — không giao thêm`); process.exit(0); }
const daGiao = new Set(sqlBox(`SELECT title FROM human_tasks WHERE ${LOC} AND title LIKE '[MÁY QUÉT]%' AND created_at > now() - interval '3 days';`)
  .split('\n').map((t) => (t.match(/way\/\d+/) || [])[0]).filter(Boolean));

const M = JSON.parse(readFileSync(du('cham-goc'), 'utf8'));
const G = new Map(JSON.parse(readFileSync(du('goc-chuan'), 'utf8')).goc.map((g) => [g.ten, g]));
const chac = (k) => {
  const ls = k.chi_tiet.map((c) => c.lech);
  return Math.abs(k.lech) >= 1.5 && ls.length >= 2 && ls.every((l) => Math.sign(l) === Math.sign(k.lech)) && Math.max(...ls) - Math.min(...ls) <= 3;
};
const ung = M.khoi.filter((k) => chac(k) && !daGiao.has(k.id) && !/restaurant/i.test(k.ten)).sort((a, b) => Math.abs(b.lech) - Math.abs(a.lech));
if (!ung.length) { console.log('không có khối lệch đủ chắc để giao'); process.exit(0); }

const k = ung[0], c = [...k.chi_tiet].sort((a, b) => b.so - a.so)[0], g = G.get(c.goc);
const cam = { p: g.p, d: g.d, fov: g.fov, zoom: g.zoom, w: 1280, h: 800, cheDo: 'toan_canh' };
const ten = k.ten ? `${k.id} (${k.ten})` : k.id;
const tieuDe = `[MÁY QUÉT] Khối ${ten} ${k.lech > 0 ? 'THẤP hơn' : 'CAO hơn'} ảnh thật ${Math.abs(k.lech)} m`;
const chiTiet = `${tieuDe} — đo theo tia ở ${k.chi_tiet.length} góc chuẩn (${k.chi_tiet.map((x) => `${x.goc} ${x.lech} m / ${x.so} cột`).join(', ')}); y_tren mô hình hiện ${k.y_tren}. Góc mở sẵn: ${c.goc}.\n`
  + 'Sửa theo QUY-TRINH.md: xem ảnh so-lech kiểm hình mái + độ cao trước khi đổi số; trọng tài máy chấm bộ góc chuẩn trước khi lên.';
const trang = `https://castle.on.tc/neuschwanstein.html#g=t,${g.p.join(',')},${g.p.map((v, i) => +(v + g.d[i] * g.zoom).toFixed(2)).join(',')},${g.fov}`;
console.log(`giao: ${chiTiet}\n${trang}`);
if (THU) process.exit(0);

const nguCanh = `LECH-JSON:${JSON.stringify(cam)}`;
const pp = { source_url: trang, source_platform: 'feedback', loai: 'loi', draft: chiTiet, site_status: { mos2: 'pending' },
  trao_doi: [{ nguoi: 'may-quet', noiDung: chiTiet, xuLy: null, luc: new Date().toISOString(), anh: [], trang, nguCanh }] };
const q = (s) => `$q$${s}$q$`;
const id = sqlBox(`INSERT INTO human_tasks (tenant_id, project_id, title, instructions, prep_payload, platform_key, status, publish_url)
  VALUES ('self', 'mos2', ${q(tieuDe.slice(0, 120))}, ${q(`${chiTiet}\n\nTrang báo: ${trang}\nNgữ cảnh: ${nguCanh}`)}, ${q(JSON.stringify(pp))}::jsonb, 'backlink', 'pending', '') RETURNING id;`);
console.log('đã tạo thẻ #' + id.split('\n')[0]);
