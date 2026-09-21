#!/usr/bin/env node
// PHỦ — bắn conversion về ExoClick (goal S2S) để Bidder/Smart CPM của họ học theo signup thật.
// Mỗi signup/lead/sale từ postback mạng aff (sid exoclick_*) → tra token {conversions_tracking} đầy đủ trong log nginx box2
// (cột 8 = $arg_s, ~350 ký tự; sid trong DB chỉ giữ 19 ký tự đầu của token) → GET goal_s2s → ghi raw.exo_goal để không bắn lại.
// Cron 15 phút (sau log-box2). env: DATABASE_URL · /etc/mos2-phu/exoclick.env (EXO_GOAL_SIGNUP = id goal "signup", tạo 21/09 qua POST /goals).
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import postgres from 'postgres';

const BOX2 = 'root@37.27.241.222';
const LOGS = '/var/log/nginx/chatwhenbored-xmua.log*';
const env = Object.fromEntries(readFileSync('/etc/mos2-phu/exoclick.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]));
const GOAL = env.EXO_GOAL_SIGNUP;
if (!GOAL || !process.env.DATABASE_URL) { console.error('thiếu EXO_GOAL_SIGNUP/DATABASE_URL'); process.exit(1); }

const sql = postgres(process.env.DATABASE_URL);
try {
  const cho = await sql`SELECT id, sid FROM phu_su_kien WHERE loai IN ('signup','lead','sale') AND sid LIKE 'exoclick_%' AND raw->>'exo_goal' IS NULL AND ts > now() - interval '3 days' ORDER BY ts`;
  let ok = 0, thieu = 0;
  for (const e of cho) {
    // token đầy đủ = phần sau "<mạng>_<nhãn>_<zone>_" của $arg_s. Cột 2 log = sid ngắn y hệt sid DB (cắt 24 ký tự HOẶC tại '_' đầu
    // tiên của token) → grep đúng ô \t<sid>\t. KHÔNG thêm '_' sau sid: token có '_' (vd otdPLNHNTXHNdPHPU7_dTqK…) thì cột 2 kết thúc
    // ngay trước '_' → mẫu "<sid>_" không khớp, 4 signup 19-21/09 chưa bao giờ bắn.
    let tok = '';
    try {
      const line = execFileSync('ssh', ['-o', 'BatchMode=yes', BOX2, `zgrep -h -m1 -F $'\\t${e.sid}\\t' ${LOGS} 2>/dev/null | head -1`], { encoding: 'utf8' }).trim();
      const s = line.split('\t')[7] || '';
      tok = s.split('_').slice(3).join('_');
    } catch { /* box2 không trả lời → để lần sau */ }
    if (!tok) { thieu++; continue; }
    const r = await fetch(`http://s.magsrv.com/tag.php?goal=${GOAL}&tag=${encodeURIComponent(tok)}`).catch((x) => ({ ok: false, status: 0, statusText: String(x) }));
    if (r.status === 0) { thieu++; continue; } // mạng lỗi → chưa ghi dấu, 15 phút sau bắn lại
    // jsonb_set, KHÔNG `raw || ${json}::jsonb`: postgres.js gửi chuỗi JSON thành JSON-string → object || string = mảng [obj,"…"],
    // raw->>'exo_goal' vẫn NULL → bắn lại mỗi 15 phút (đo 21/09/2026: 15 dòng phình 14 phần tử).
    await sql`UPDATE phu_su_kien SET raw = jsonb_set(raw, '{exo_goal}', to_jsonb(${`${r.status} ${new Date().toISOString().slice(0, 16)}`}::text)) WHERE id = ${e.id}`;
    if (r.ok) ok++;
  }
  console.log(new Date().toISOString(), `exo-goal: ${ok} bắn / ${thieu} chưa có token / ${cho.length} chờ`);
} finally { await sql.end(); }
