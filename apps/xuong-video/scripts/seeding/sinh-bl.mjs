#!/usr/bin/env node
// tra-repo-ok: dán keo nội bộ — yt-dlp đọc video + bình luận top, một lệnh gọi cổng AI nhà (spy /api/ai), ghi xv_seeding_bl.
// SINH BÌNH LUẬN SEEDING (anh 28/11/2026): kênh của máy vào bình luận dưới video top của kênh mục tiêu (xv_seeding_kenh) để người xem bấm sang kênh mình.
// Mỗi bình luận viết riêng cho đúng video: AI đọc tiêu đề + mô tả + 15 bình luận top đang có, viết một câu như người xem thật (nhắc chi tiết của video,
// không link, không mời xem kênh, không khen chung chung). Ghi trang_thai='nhap' → chưa đăng gì; Phòng Nội dung chấm trước khi máy đăng.
//   node sinh-bl.mjs --may orbiball [--so 1] [--kenh <channel id>] [--xem]
//   node sinh-bl.mjs --may orbiball --tl-kenh 3 [--xem]   <- trả lời bình luận top của người xem trên video kênh target
//   node sinh-bl.mjs --may orbiball --tra-loi [--xem]   <- viết trả lời cho các dòng can_viet do do-bl.mjs xếp (người xem trả lời bình luận của máy)
import { execFile, execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';

const a = process.argv.slice(2), co = (k) => a.includes(k), gt = (k, m) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : m; };
const MAY = gt('--may'), KENH = gt('--kenh'), XEM = co('--xem');
if (!MAY) { console.error('✗ thiếu --may'); process.exit(1); }
let SO = Number(gt('--so', 1));
const MODEL = 'claude-haiku-5-5';
const CHU_DE = { orbiball: 'Orbiball FC: marble/physics-simulation football — every real fixture (Premier League, Champions League, LaLiga…) is played out as a marble match to predict the result.' };

const docKhoa = (t) => { try { return readFileSync(t, 'utf8').match(/^CONG_AI_KEY=(.*)$/m)?.[1]?.replace(/["']/g, '').trim() || null; } catch { return null; } };
const KHOA = process.env.CONG_AI_KEY || docKhoa('/root/.secrets/spy.env') || docKhoa(`${homedir()}/.secrets/cong-ai.env`);
const URL_CONG = process.env.CONG_AI_URL || (existsSync('/root/.secrets/spy.env') ? 'http://127.0.0.1:3850/api/ai' : 'https://spy.on.tc/api/ai');

/** psql trên box3: SQL gửi base64 qua -f -, JSON qua stdin vào biến :'j'. */
const sql = (q, j = '[]') => execFileSync('ssh', ['-o', 'BatchMode=yes', 'root@167.233.241.16',
  `cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; J=$(cat); echo ${Buffer.from(q).toString('base64')} | base64 -d | psql "$DATABASE_URL" -tA -v ON_ERROR_STOP=1 -v j="$J" -f -`],
  { input: j, encoding: 'utf8' }).trim();

// 0. TRẢ LỜI người xem (anh 28/11/2026 "tương tác thật"): đọc bình luận gốc của máy + câu họ trả lời → một câu đáp như người thật, rồi về nhap.
if (co('--tra-loi')) {
  const ds = JSON.parse(sql(`SELECT coalesce(json_agg(x),'[]') FROM (SELECT r.id, r.video_ten, r.goc_chu, r.goc_tac_gia, g.chu goc_cua_may
    FROM xv_seeding_bl r JOIN xv_seeding_bl g ON g.may=r.may AND g.video_id=r.video_id AND g.tra_loi_cho IS NULL
    WHERE r.may='${MAY.replace(/'/g, '')}' AND r.trang_thai='can_viet' ORDER BY r.id LIMIT 10) x`));
  if (!ds.length) { console.log('· không có trả lời nào cần viết'); process.exit(0); }
  let tong = 0; const ghi = [];
  for (const r of ds) {
    const system = `You reply ONCE, as the same genuine fan who wrote the original comment, to someone who answered you under a YouTube video. Your channel is about ${CHU_DE[MAY]} but never mention it, never link, never ask anyone to subscribe or visit a channel.
Rules: English, 1 short sentence (max 150 characters), answer what THEY said (agree, push back playfully, or ask a follow-up), friendly and natural, max 1 emoji, no hashtags. If their reply is hostile or spam, return chu "" (skip).
Facts: never invent scores, minutes or results not stated below.
Return JSON {"chu": "<reply or empty>", "ly": "<why, Vietnamese, short>"}`;
    const user = `Video title: ${r.video_ten}\nYour original comment: ${r.goc_cua_may}\nTheir reply (${r.goc_tac_gia}): ${r.goc_chu}`;
    try {
      const res = await fetch(URL_CONG, { method: 'POST', headers: { authorization: `Bearer ${KHOA}`, 'content-type': 'application/json' },
        body: JSON.stringify({ viec: `${MAY}-seeding-tl`, model: MODEL, max_tokens: 200, system, messages: [{ role: 'user', content: user }],
          schema: { type: 'object', additionalProperties: false, required: ['chu', 'ly'], properties: { chu: { type: 'string' }, ly: { type: 'string' } } } }) });
      const j = await res.json().catch(() => ({})); if (!res.ok) throw new Error(`cổng AI ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
      tong += Number(j.chi_usd) || 0;
      const kq = typeof j.kq === 'string' ? JSON.parse(j.kq) : j.kq, chu = String(kq?.chu ?? '').trim();
      const hong = chu && ((chu.match(/\d+(?::\d+)?/g) ?? []).some((n) => !user.includes(n)) || /https?:|www\.|subscribe|my channel|orbiball/i.test(chu) || chu.length > 200);
      console.log(`\n↩ #${r.id} ${r.goc_tac_gia}: ${r.goc_chu.replace(/\s+/g, ' ').slice(0, 120)}\n  💬 ${chu || '(bỏ qua)'}${hong ? ' ✗ hỏng, bỏ' : ''} · ${kq?.ly ?? ''}`);
      ghi.push({ id: r.id, chu: hong ? '' : chu });
    } catch (e) { console.log(`⚠ #${r.id}: ${e.message.slice(0, 200)}`); }
  }
  console.log(`\nchi AI: $${tong.toFixed(5)} ≈ ${Math.round(tong * 3250)}₫`);
  if (XEM || !ghi.length) process.exit(0);
  console.log(sql(`UPDATE xv_seeding_bl b SET chu=x.chu, trang_thai=CASE WHEN x.chu='' THEN 'bo' ELSE 'nhap' END FROM jsonb_to_recordset(:'j'::jsonb) AS x(id int, chu text)
    WHERE b.id=x.id RETURNING b.id || ' → ' || b.trang_thai`, JSON.stringify(ghi)));
  process.exit(0);
}

// --bu N: bù hàng chờ — chỉ viết thêm cho đủ N bình luận gốc chưa đăng (nhap). dang-lien-tuc gọi mỗi 6 giờ; trần đăng 3/ngày nên N=3 là đủ một ngày.
if (gt('--bu')) { SO = Math.max(0, Number(gt('--bu')) - Number(sql(`SELECT count(*) FROM xv_seeding_bl WHERE may='${MAY.replace(/'/g, '')}' AND trang_thai='nhap' AND tra_loi_cho IS NULL`)));
  if (!SO) { console.log('· hàng chờ bình luận đủ'); process.exit(0); } }

// TRẢ LỜI NGƯỜI XEM TRÊN KÊNH TARGET (anh 28/11/2026: "tương tác với người trả lời trên kênh target", không phải chờ người vào trả lời mình):
// --tl-kenh N = bù cho đủ N trả lời nháp. Mỗi video bóng đá của kênh target (chưa có trả lời nào của máy) → đọc 15 bình luận top → AI chọn MỘT bình luận
// người xem đáng đáp nhất và viết câu trả lời → dòng nhap có tra_loi_cho = id bình luận đó (nap-bai nạp, Phòng Nội dung chấm, máy đăng trả lời đúng luồng).
const ytTop = (url) => new Promise((ok, loi) => execFile('yt-dlp', ['-J', '--no-warnings', '--skip-download', '--write-comments',
  '--extractor-args', 'youtube:max_comments=15,15,0,0;comment_sort=top', url], { maxBuffer: 64 << 20, timeout: 180_000 }, (e, o) => (e ? loi(e) : ok(JSON.parse(o)))));
if (gt('--tl-kenh')) {
  const M = MAY.replace(/'/g, ''), can = Math.max(0, Number(gt('--tl-kenh')) - Number(sql(`SELECT count(*) FROM xv_seeding_bl WHERE may='${M}' AND trang_thai='nhap' AND tra_loi_cho IS NOT NULL`)));
  if (!can) { console.log('· hàng chờ trả lời kênh target đủ'); process.exit(0); }
  const HANDLE = sql(`SELECT lower(e->'br'->>'handle') FROM xv_may m, jsonb_array_elements(m.dang) e WHERE m.ma='${M}' AND e->>'nen'='yt_binh_luan' LIMIT 1`);
  const vs = JSON.parse(sql(`SELECT coalesce(json_agg(x),'[]') FROM (SELECT k.kenh_id, k.ten, v->>'id' vid FROM xv_seeding_kenh k CROSS JOIN LATERAL jsonb_array_elements(k.video_top) v
    WHERE k.may='${M}' AND k.bat AND v->>'ten' ~* '(football|soccer|league|cup|uefa|laliga|fifa|premier|beat the keeper)'
      AND NOT EXISTS (SELECT 1 FROM xv_seeding_bl b WHERE b.may=k.may AND b.video_id=v->>'id' AND b.tra_loi_cho IS NOT NULL)
    ORDER BY (v->>'xem')::bigint DESC NULLS LAST LIMIT ${can * 2}) x`));
  let tong = 0; const ghi = [];
  for (const v of vs) {
    if (ghi.length >= can) break;
    try {
      const info = await ytTop(`https://www.youtube.com/watch?v=${v.vid}`);
      const bl = (info.comments ?? []).filter((c) => (!c.parent || c.parent === 'root') && !c.author_is_uploader && String(c.author ?? '').toLowerCase() !== HANDLE && String(c.text ?? '').length >= 15).slice(0, 15);
      if (!bl.length) { console.log(`· ${v.vid}: không có bình luận người xem`); continue; }
      const system = `You are a genuine football fan replying to ONE other viewer's comment under a YouTube video. You run a related channel (${CHU_DE[MAY]}) but never mention it, never link, never ask anyone to subscribe or visit a channel.
Pick the comment that best invites a friendly reply (an opinion, a prediction, a question, a debate point; skip spam, hate, or comments with nothing to answer). Write 1 short sentence (max 150 characters) that answers THAT person directly: agree and add a point, playfully disagree, or ask a follow-up. English, natural, max 1 emoji, no hashtags.
Facts: never invent scores, minutes or results not stated in the title or comments. Return JSON {"so": <index of the chosen comment>, "chu": "<reply>", "ly": "<why, Vietnamese, short>"}; if none is worth replying, return so -1.`;
      const user = `Video title: ${info.title}\nComments:\n${bl.map((c, i) => `[${i}] (${c.like_count ?? 0} likes) ${c.author}: ${String(c.text).replace(/\s+/g, ' ').slice(0, 250)}`).join('\n')}`;
      const res = await fetch(URL_CONG, { method: 'POST', headers: { authorization: `Bearer ${KHOA}`, 'content-type': 'application/json' },
        body: JSON.stringify({ viec: `${MAY}-seeding-tlk`, model: MODEL, max_tokens: 250, system, messages: [{ role: 'user', content: user }],
          schema: { type: 'object', additionalProperties: false, required: ['so', 'chu', 'ly'], properties: { so: { type: 'integer' }, chu: { type: 'string' }, ly: { type: 'string' } } } }) });
      const j = await res.json().catch(() => ({})); if (!res.ok) throw new Error(`cổng AI ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
      tong += Number(j.chi_usd) || 0;
      const kq = typeof j.kq === 'string' ? JSON.parse(j.kq) : j.kq, c = bl[kq?.so], chu = String(kq?.chu ?? '').trim();
      const hong = !c || chu.length < 5 || chu.length > 200 || /https?:|www\.|subscribe|my channel|check out|orbiball/i.test(chu) || (chu.match(/\d+\s*[-:]\s*\d+|\d+/g) ?? []).some((n) => !user.includes(n.replace(/\s+/g, '')));   // tỉ số "4-1" kiểm nguyên cụm, không tách từng chữ số
      console.log(`\n▶ ${v.ten} · "${info.title}" · https://youtu.be/${v.vid}\n  ↩ ${c?.author}: ${String(c?.text ?? '').replace(/\s+/g, ' ').slice(0, 140)}\n  💬 ${chu || '(bỏ qua)'}${hong ? ' ✗ bỏ' : ''} · ${kq?.ly ?? ''}`);
      if (!hong) ghi.push({ may: MAY, kenh_id: v.kenh_id, video_id: v.vid, video_ten: info.title, chu, tra_loi_cho: c.id, goc_chu: String(c.text).slice(0, 1000), goc_tac_gia: c.author ?? '' });
    } catch (e) { console.log(`⚠ ${v.vid}: ${e.message.slice(0, 200)}`); }
  }
  console.log(`\nchi AI: $${tong.toFixed(5)} ≈ ${Math.round(tong * 3250)}₫`);
  if (XEM || !ghi.length) process.exit(0);
  console.log(sql(`INSERT INTO xv_seeding_bl (may,kenh_id,video_id,video_ten,chu,trang_thai,tra_loi_cho,goc_chu,goc_tac_gia)
    SELECT may,kenh_id,video_id,video_ten,chu,'nhap',tra_loi_cho,goc_chu,goc_tac_gia FROM jsonb_to_recordset(:'j'::jsonb)
      AS x(may text,kenh_id text,video_id text,video_ten text,chu text,tra_loi_cho text,goc_chu text,goc_tac_gia text)
    ON CONFLICT DO NOTHING RETURNING '+ trả lời nháp #' || id`, JSON.stringify(ghi)));
  process.exit(0);
}

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
  ON CONFLICT DO NOTHING`, JSON.stringify(ghi)) || `✓ ${ghi.length} bình luận nháp → xv_seeding_bl (trang_thai nhap)`);
