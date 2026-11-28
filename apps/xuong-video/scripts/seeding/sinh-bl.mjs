#!/usr/bin/env node
// tra-repo-ok: dán keo nội bộ — yt-dlp đọc video + bình luận top, một lệnh gọi cổng AI nhà (spy /api/ai), ghi xv_seeding_bl.
// SINH BÌNH LUẬN SEEDING (anh 28/11/2026): kênh của máy vào bình luận dưới video top của kênh mục tiêu (xv_seeding_kenh) để người xem bấm sang kênh mình.
// Mỗi bình luận viết riêng cho đúng video: AI đọc tiêu đề + mô tả + 15 bình luận top đang có, viết một câu như người xem thật (nhắc chi tiết của video,
// không link, không mời xem kênh, không khen chung chung). Ghi trang_thai='nhap' → chưa đăng gì; Phòng Nội dung chấm trước khi máy đăng.
//   node sinh-bl.mjs --may orbiball [--so 1] [--kenh <channel id>] [--xem]
import { execFile, execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';

const a = process.argv.slice(2), co = (k) => a.includes(k), gt = (k, m) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : m; };
const MAY = gt('--may'), SO = Number(gt('--so', 1)), KENH = gt('--kenh'), XEM = co('--xem');
if (!MAY) { console.error('✗ thiếu --may'); process.exit(1); }
const MODEL = 'claude-haiku-5-5';
const CHU_DE = { orbiball: 'Orbiball FC: marble/physics-simulation football — every real fixture (Premier League, Champions League, LaLiga…) is played out as a marble match to predict the result.' };

const docKhoa = (t) => { try { return readFileSync(t, 'utf8').match(/^CONG_AI_KEY=(.*)$/m)?.[1]?.replace(/["']/g, '').trim() || null; } catch { return null; } };
const KHOA = process.env.CONG_AI_KEY || docKhoa('/root/.secrets/spy.env') || docKhoa(`${homedir()}/.secrets/cong-ai.env`);
const URL_CONG = process.env.CONG_AI_URL || (existsSync('/root/.secrets/spy.env') ? 'http://127.0.0.1:3850/api/ai' : 'https://spy.on.tc/api/ai');

/** psql trên box3: SQL gửi base64 qua -f -, JSON qua stdin vào biến :'j'. */
const sql = (q, j = '[]') => execFileSync('ssh', ['-o', 'BatchMode=yes', 'root@167.233.241.16',
  `cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; J=$(cat); echo ${Buffer.from(q).toString('base64')} | base64 -d | psql "$DATABASE_URL" -tA -v ON_ERROR_STOP=1 -v j="$J" -f -`],
  { input: j, encoding: 'utf8' }).trim();

// 1. chọn video: mỗi kênh chưa có bình luận nào của máy, lấy video nhiều view nhất chưa bình luận; kênh to trước.
const ds = JSON.parse(sql(`SELECT coalesce(json_agg(x),'[]') FROM (
  SELECT k.kenh_id, k.ten, k.nguoi_dk, v->>'id' vid, v->>'ten' vten, (v->>'xem')::bigint xem
  FROM xv_seeding_kenh k CROSS JOIN LATERAL (SELECT v FROM jsonb_array_elements(k.video_top) v
    WHERE v->>'ten' ~* '(football|soccer|league|cup|uefa|laliga|fifa|premier|beat the keeper)' /* video bóng đá của kênh, không lấy đua bi quốc gia */
      AND NOT EXISTS (SELECT 1 FROM xv_seeding_bl b WHERE b.may=k.may AND b.video_id=v->>'id') ORDER BY (v->>'xem')::bigint DESC NULLS LAST LIMIT 1) t
  WHERE k.may='${MAY.replace(/'/g, '')}' AND k.bat ${KENH ? `AND k.kenh_id='${KENH.replace(/'/g, '')}'` : `AND NOT EXISTS (SELECT 1 FROM xv_seeding_bl b WHERE b.may=k.may AND b.kenh_id=k.kenh_id)`}
  ORDER BY k.nguoi_dk DESC NULLS LAST LIMIT ${SO}) x`));
if (!ds.length) { console.log('· không còn video nào để bình luận'); process.exit(0); }

const yt = (url) => new Promise((ok, loi) => execFile('yt-dlp', ['-J', '--no-warnings', '--skip-download', '--write-comments',
  '--extractor-args', 'youtube:max_comments=15,15,0,0;comment_sort=top', url], { maxBuffer: 64 << 20, timeout: 180_000 }, (e, o) => (e ? loi(e) : ok(JSON.parse(o)))));

async function viet(v, info, sua = []) {
  const bl = (info.comments ?? []).filter((c) => !c.parent || c.parent === 'root').slice(0, 15).map((c) => `- (${c.like_count ?? 0} likes) ${String(c.text).replace(/\s+/g, ' ').slice(0, 200)}`).join('\n');
  const system = `You write ONE YouTube comment as a genuine fan of this kind of video. The commenter runs a related channel (${CHU_DE[MAY]}) but must NOT mention it, link anything, or ask anyone to subscribe/check out a channel — the channel name and avatar next to the comment do that work.
Rules: English, 1–2 short sentences, max 180 characters. Refer to something SPECIFIC in this video (a team, a moment, the result, the format) using the title, description and existing comments. Sound like a real viewer: a reaction, a prediction, a playful question or a friendly debate point that invites replies. No generic praise ("great video", "nice content"), no emojis spam (max 1), no hashtags, no "first", no copying an existing comment.
Facts: use ONLY facts stated in the title, description or comments below. Never invent timestamps, scores, minutes or results; do not claim the comments say something they do not.
Return JSON {"chu": "<comment>", "ly": "<what specific detail it hooks onto, Vietnamese, short>"}`;
  const user = (sua.length ? `Your previous attempt was rejected: ${sua.join('; ')}. Write a new one that fixes it.\n\n` : '') + `Channel: ${v.ten}\nVideo title: ${info.title}\nViews: ${info.view_count}\nDescription:\n${String(info.description ?? '').slice(0, 1200)}\n\nTop comments now:\n${bl || '(none)'}`;
  const r = await fetch(URL_CONG, { method: 'POST', headers: { authorization: `Bearer ${KHOA}`, 'content-type': 'application/json' },
    body: JSON.stringify({ viec: `${MAY}-seeding-bl`, model: MODEL, max_tokens: 300, system, messages: [{ role: 'user', content: user }],
      schema: { type: 'object', additionalProperties: false, required: ['chu', 'ly'], properties: { chu: { type: 'string' }, ly: { type: 'string' } } } }) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`cổng AI ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  const nguon = user;
  const kq = typeof j.kq === 'string' ? JSON.parse(j.kq) : j.kq;
  const chu = String(kq?.chu ?? '').trim();
  const loi = [chu.length < 15 && 'quá ngắn', chu.length > 220 && 'quá dài', /https?:|www\.|\.com|subscribe|my channel|check out/i.test(chu) && 'có link / mời kênh', /orbiball/i.test(chu) && 'nhắc tên kênh', (chu.match(/\d+(?::\d+)?/g) ?? []).some((n) => !nguon.includes(n)) && 'bịa số'].filter(Boolean);
  if (loi.length) throw Object.assign(new Error(`bình luận hỏng (${loi.join(', ')}): ${chu}`), { sua: loi.map((x) => ({ 'quá dài': 'too long — max 180 characters, one or two short sentences', 'quá ngắn': 'too short', 'có link / mời kênh': 'contains a link or channel invite', 'nhắc tên kênh': 'mentions Orbiball', 'bịa số': 'contains a number/timestamp that is not in the source — remove it' }[x])), chi: Number(j.chi_usd) || 0 });
  return { chu, ly: kq.ly, chi: Number(j.chi_usd) || 0, model: j.model || MODEL, bl: (info.comments ?? []).length };
}

let tong = 0; const ghi = [];
for (const v of ds) {
  try {
    const info = await yt(`https://www.youtube.com/watch?v=${v.vid}`);
    let k; for (let l = 0, sua = []; ; l++) { try { k = await viet(v, info, sua); break; } catch (e) { if (l >= 2 || !e.sua) throw e; sua = e.sua; tong += e.chi; } } tong += k.chi;
    console.log(`\n▶ ${v.ten} (${v.nguoi_dk ?? '?'} sub) · "${info.title}" · ${info.view_count} view · https://youtu.be/${v.vid}\n  💬 ${k.chu}\n  ↳ ${k.ly} · đọc ${k.bl} bình luận · ${k.model} $${k.chi.toFixed(5)}`);
    ghi.push({ may: MAY, kenh_id: v.kenh_id, video_id: v.vid, video_ten: info.title, chu: k.chu });
  } catch (e) { console.log(`⚠ ${v.ten} ${v.vid}: ${e.message.slice(0, 300)}`); }
}
console.log(`\nchi AI: $${tong.toFixed(5)} ≈ ${Math.round(tong * 3250)}₫`);
if (XEM || !ghi.length) process.exit(0);
console.log(sql(`INSERT INTO xv_seeding_bl (may,kenh_id,video_id,video_ten,chu,trang_thai)
  SELECT may,kenh_id,video_id,video_ten,chu,'nhap' FROM jsonb_to_recordset(:'j'::jsonb) AS x(may text,kenh_id text,video_id text,video_ten text,chu text)
  ON CONFLICT (may,video_id) DO NOTHING`, JSON.stringify(ghi)) || `✓ ${ghi.length} bình luận nháp → xv_seeding_bl (trang_thai nhap)`);
