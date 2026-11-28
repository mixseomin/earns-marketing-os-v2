#!/usr/bin/env node
// tra-repo-ok: dán keo nội bộ — một lệnh gọi cổng AI nhà (spy /api/ai) + luật hook-qc.mjs có sẵn.
// TÊN VIDEO TRẬN ORBIBALL DO AI SINH (anh 28/11/2026: "Cấm ko bao giờ đc dùng tên theo form ngu như vậy" · "Tên phải đa dạng. Dùng AI sinh để có tính thời điểm").
// Trước đây tiêu đề = khuôn hook.json thay {H}/{A} → mọi video chỉ khác tên đội. Giờ mỗi trận AI viết tên riêng từ sự thật của trận (giải, ngày, bảng, phong độ,
// derby…) và bám MỘT câu móc YouTube thật trong kho (luật Phòng Nội dung: giữ ≥ 35% chữ của câu gốc, không thêm số). Máy tự soát trước khi nạp, sai thì gửi lỗi
// cho AI viết lại (tối đa 3 lượt):
//   loiHook (hook-qc.mjs)  ·  khuonTrung (rập khuôn với tên khác của kênh — luật Phòng Nội dung chặn)  ·  25–100 ký tự  ·  có ? hoặc !  ·  không chữ Việt
//   node tieu-de-ai.mjs --tu-kiem        soát phần thuần (không gọi AI)
//   node tieu-de-ai.mjs --doi-ten <slug gốc> [...] [--xem]   đổi tên các video ĐÃ NẠP của máy orbiball (mọi bản <slug gốc>*), ghi dang.title + dang.hook
//                                        (Phòng Nội dung tự chấm lại vì dang đổi); tên trên YouTube đồng bộ bằng puzzle-books dang-may.mjs --sua-tieu-de-youtube
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loiHook, khuonTrung, CHU_VIET, tuNoiDung, GIU_HOOK_TOI_THIEU } from '../../src/lib/xuong-video/hook-qc.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const docKhoa = (t) => { try { return readFileSync(t, 'utf8').match(/^CONG_AI_KEY=(.*)$/m)?.[1]?.replace(/["']/g, '').trim() || null; } catch { return null; } };
const KHOA = () => process.env.CONG_AI_KEY || docKhoa('/root/.secrets/spy.env') || docKhoa(`${homedir()}/.secrets/cong-ai.env`);
const URL_CONG = () => process.env.CONG_AI_URL || (existsSync('/root/.secrets/spy.env') ? 'http://127.0.0.1:3850/api/ai' : 'https://spy.on.tc/api/ai');
export const MODEL = 'claude-sonnet-5-5';

/** Kho câu móc: mọi mục ngang + reel của hook.json, bỏ trùng theo qc, rồi TÁCH tiêu đề gốc thành từng câu móc theo " | " / " - " (28/11/2026: so với cả dòng
 *  "WORLD CUP 2026 - Group Stage Round 1 | Can They Beat The Keeper?" thì giữ đủ câu móc "Can They Beat The Keeper?" vẫn chỉ 33% → AI 3 lượt không qua).
 *  Mỗi đoạn ≥ 3 từ nội dung là một mục, goc = đoạn đó (luật Phòng Nội dung chấm theo dang.hook.goc), tieu_de_goc = nguyên tiêu đề video thật để đối chứng. */
export function khoHook(HOOK) {
  const da = new Set(), ra = [];
  for (const h of [HOOK.ngang, HOOK.reel].flat().filter(Boolean)) {
    if (da.has(h.qc)) continue; da.add(h.qc); const { tieu_de, ...g } = h;
    // Bỏ đoạn có chữ số (AI phải giữ đúng số đó = tên mang "2026"/"32 Teams" không thuộc trận) và đoạn tên giải không liên quan (World Cup / Copa / vòng bảng).
    const doan = String(h.goc).split(/\s+[|｜–-]\s+/).map((x) => x.replace(/[\p{Extended_Pictographic}️]/gu, '').trim())
      .filter((x) => tuNoiDung(x).length >= 3 && !/\d/.test(x) && !/world cup|copa|group stage|tournament/i.test(x));
    for (const d of doan) ra.push({ ...g, goc: d, tieu_de_goc: h.goc });
  }
  return ra;
}
/** Từ phải giữ của một câu móc + số tối thiểu (cùng phép đếm giuHook). */
const tuGiu = (goc) => { const w = [...new Set(tuNoiDung(goc))]; return { w, can: Math.ceil(w.length * GIU_HOOK_TOI_THIEU) }; };

/** Phong độ đọc từ khối sự thật ("- X last 5: L 0-4 …, D …" hoặc "- X recent form: L W W W L") → nhãn đếm sẵn cho AI + các cụm từ BỊ CẤM vì không đúng
 *  (28/11/2026 AI viết "Brentford Arrive Flying" khi Brentford W-L-W-D-L; dặn bằng lời không đủ, máy chặn). Không đọc được phong độ → không cấm gì. */
export function phongDo(su_that) {
  const doi = [];
  for (const m of String(su_that ?? '').matchAll(/^-\s*(.+?)\s+(?:last \d+|recent form):\s*(.+)$/gim)) {
    const kq = [...m[2].matchAll(/(?:^|[\s,])([WDL])(?=[\s,]|$)/g)].map((x) => x[1]); if (kq.length >= 3) doi.push({ ten: m[1].trim(), kq });
  }
  const dem = (d, c) => d.kq.filter((x) => x === c).length, chuoi = (d, c) => d.kq.join('').includes(c.repeat(3));
  const cam = [];
  if (doi.length) {
    if (!doi.some((d) => dem(d, 'W') >= 3 && dem(d, 'L') <= 1)) cam.push([/\b(flying|in form|on fire|red[- ]hot|unstoppable|rampant)\b/i, 'no team is in form (needs 3+ wins and at most 1 loss in last 5)']);
    if (!doi.some((d) => dem(d, 'W') === 0)) cam.push([/\b(winless|without a win)\b/i, 'no team is winless in its last 5']);
    if (!doi.some((d) => dem(d, 'W') <= 1)) cam.push([/\b(crisis|struggling|in freefall)\b/i, 'no team is in crisis (needs at most 1 win in last 5)']);
    if (!doi.some((d) => chuoi(d, 'L'))) cam.push([/\b(loss|losing) streak\b/i, 'no team lost 3 in a row']);
    if (!doi.some((d) => chuoi(d, 'W'))) cam.push([/\b(win|winning|unbeaten) streak\b/i, 'no team won 3 in a row']);
    if (!doi.some((d) => chuoi(d, 'W') || chuoi(d, 'L') || chuoi(d, 'D'))) cam.push([/\bstreak\b/i, 'no team has 3 same results in a row']);
  }
  const nhan = doi.map((d) => `${d.ten}: ${dem(d, 'W')} wins, ${dem(d, 'D')} draws, ${dem(d, 'L')} losses in last ${d.kq.length} (${d.kq.join('-')})`);
  return { nhan, cam };
}

/** Lỗi của một tên (thuần). khac = tên khác của kênh (kể cả tên bản anh em vừa sinh). cam = phongDo().cam. [] = đạt. */
export function loiTen(title, hook, khac, cam = []) {
  const t = String(title ?? '').trim(), loi = [...loiHook([t], hook.goc)];
  for (const [re, ly] of cam) { const m = t.match(re); if (m) loi.push(`"${m[0]}" is false: ${ly}`); }
  if (/\bbottom\b/i.test(t)) loi.push('"bottom" is not allowed: describe the table position instead');
  if (t.length < 25 || t.length > 100) loi.push(`length ${t.length} chars, must be 25-100`);
  if (!/[?!]/.test(t)) loi.push('needs a "?" or "!"');
  if (CHU_VIET.test(t)) loi.push('must be English only');
  if (/\{[HA]\}/.test(t)) loi.push('placeholder left in title');
  const k = khuonTrung(t, khac); if (k) loi.push(`same skeleton as an existing channel title ("${k}") — only team names changed; write a structurally different title`);
  if (khac.some((x) => String(x).trim().toLowerCase() === t.toLowerCase())) loi.push('identical to an existing channel title');
  return loi;
}

async function goiAi(body) {
  const khoa = KHOA(); if (!khoa) throw new Error('thiếu CONG_AI_KEY (box3 /root/.secrets/spy.env hoặc iMac ~/.secrets/cong-ai.env)');
  const r = await fetch(URL_CONG(), { method: 'POST', headers: { authorization: `Bearer ${khoa}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`cổng AI ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

const schema = (ban) => ({ type: 'object', additionalProperties: false, required: ['ten'],
  properties: { ten: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['ban', 'chon', 'title'],
    properties: { ban: { type: 'string', enum: ban }, chon: { type: 'integer' }, title: { type: 'string' } } } } } });

/** Sinh tên cho các bản của MỘT trận. su_that = khối chữ sự thật (mô tả bài + bối cảnh). ban = ['ngang','reel'] hoặc một. kho = khoHook(). khac = tên gần đây của kênh.
 *  Trả { ten: { ngang: {title, hook}, reel: {...} }, chi_usd, model, luot }. Ném khi 3 lượt vẫn sai. */
export async function sinhTieuDe({ su_that, ban = ['ngang', 'reel'], kho, khac = [], viec = 'orbiball-tieu-de' }) {
  const pd = phongDo(su_that);
  const tuKhac = khac.map((x) => new Set(tuNoiDung(x)));
  const dsKho = kho.map((h, i) => {
    const { w, can } = tuGiu(h.goc), dung = tuKhac.some((s) => w.filter((x) => s.has(x)).length >= Math.ceil(w.length / 2));
    return `${i}. "${h.goc}" — keep at least ${can} of these exact words: ${w.join(', ')}${dung ? ` — ALREADY USED on this channel: keep ONLY ${can} of its words, never the whole phrase` : ''}`;
  }).join('\n');
  const system = `You write YouTube titles for "Orbiball", a channel that simulates real upcoming football matches with marble physics (22 marbles, real squad names, nothing scripted).
Every title must be built on ONE proven hook from the hook list (real high-view YouTube titles in this niche): keep the listed minimum of that hook's exact words (same spelling; you may reorder and add words around them, the hook's feel must stay recognisable).
Make it timely and specific to THIS fixture using only the facts given: the rivalry or derby, table situation (title race, top-four, relegation fight), recent form streaks, venue, weekday, competition stage.
Hard rules: English only. 35-90 characters. Include "?" or "!". NO digits at all (no scores, dates, positions as numbers) unless the digits appear in the chosen hook. No placeholders, no hashtags, no emoji. Never invent facts.
Every claim must be literally true from the facts: "flying / in form / on fire" only if the team won at least 3 of its last 5 with at most 1 loss; "winless / crisis / struggling" only if the last 5 show it; "bottom" only if last in the table (19th of 20 is "relegation zone", not bottom); "streak" only if the results show consecutive same outcomes; "derby" only for a real local derby. If unsure, describe the table or venue instead.
Prefer a hook that is NOT marked "ALREADY USED". Each match should open differently from the other recent titles.
Never copy 5 or more words in a row from any channel recent title, and never reuse a recent title's sentence pattern with only the team names swapped.
Each version needs a structurally different title (different opening, different sentence shape) from each other and from the channel's recent titles. Versions named with "reel" or "short" are vertical YouTube Shorts: punchier; the others are full 90-minute videos.`;
  let tin = `FACTS\n${su_that}\n${pd.nhan.length ? `\nFORM COUNTED FOR YOU (use these, do not recount)\n${pd.nhan.map((x) => `- ${x}`).join('\n')}\n${pd.cam.length ? `Words you must NOT use: ${pd.cam.map(([, ly]) => ly).join('; ')}\n` : ''}` : ''}\nHOOK LIST (pick by index)\n${dsKho}\n\nCHANNEL RECENT TITLES (do not copy their skeleton)\n${khac.slice(-30).map((x) => `- ${x}`).join('\n') || '- (none)'}\n\nWrite one title for each version: ${ban.join(', ')}.`;
  const messages = [{ role: 'user', content: tin }];
  let chi = 0, model = MODEL;
  for (let luot = 1; luot <= 3; luot++) {
    const j = await goiAi({ viec, model, max_tokens: 600, system, messages, schema: schema(ban) });
    chi += Number(j.chi_usd) || 0; model = j.model || model;
    const kq = typeof j.kq === 'string' ? JSON.parse(j.kq) : j.kq, ra = {}, loi = [];
    for (const b of ban) {
      const x = kq?.ten?.find((y) => y.ban === b), h = kho[x?.chon];
      if (!x || !h) { loi.push(`${b}: missing or bad hook index`); continue; }
      const khacB = [...khac, ...Object.values(ra).map((y) => y.title)];
      const l = loiTen(x.title, h, khacB, pd.cam);
      if (l.length) loi.push(`${b} "${x.title}": ${l.join('; ')}`); else ra[b] = { title: x.title.trim(), hook: h };
    }
    if (!loi.length) return { ten: ra, chi_usd: chi, model, luot };
    console.log(`  · tên AI lượt ${luot} chưa đạt: ${loi.join(' | ').slice(0, 400)}`);
    messages.push({ role: 'assistant', content: JSON.stringify(kq) }, { role: 'user', content: `These titles failed the checks:\n${loi.join('\n')}\nRewrite ALL versions fixing every issue. Same JSON shape.` });
  }
  throw new Error(`AI không ra được tên đạt luật sau 3 lượt (đã chi $${chi.toFixed(4)})`);
}

if (process.argv.includes('--tu-kiem')) {
  const t = await import('node:assert/strict');
  const HOOK = JSON.parse(readFileSync(join(DIR, 'kenh-orbiball', 'hook.json'), 'utf8')), kho = khoHook(HOOK);
  t.ok(kho.length >= 3 && new Set(kho.map((h) => h.qc + h.goc)).size === kho.length, 'kho bỏ trùng qc');
  t.ok(kho.every((h) => !('tieu_de' in h) && h.goc && h.tieu_de_goc), 'kho không mang khuôn tieu_de');
  t.ok(kho.some((h) => h.goc === 'Can They Beat The Keeper?'), 'tách câu móc khỏi tiêu đề dài');
  const h0 = kho.find((h) => /Blow Your Mind/.test(h.goc));
  const cu = ['This Marble Match Will Blow Your Mind! Man Utd vs Brentford Prediction'];
  t.ok(loiTen('This Marble Match Will Blow Your Mind! Everton vs Liverpool Prediction', h0, cu).some((x) => /skeleton/.test(x)), 'khuôn cũ thay đội bị chặn');
  t.deepEqual(loiTen('Merseyside Derby Marble Match: Can Everton Blow Liverpool\'s Mind?', h0, cu), [], 'tên mới khác khung, giữ hook → đạt');
  t.ok(loiTen('Everton vs Liverpool 3-1 marble match blow mind!', h0, cu).some((x) => /con số/.test(x)), 'số bịa bị chặn');
  t.ok(loiTen('Marble match blow mind derby Everton Liverpool', h0, cu).some((x) => /\?/.test(x)), 'thiếu ? ! bị chặn');
  const pd = phongDo('- Man Utd last 5: L 0-4 at Liverpool, D 4-4 vs Aston Villa, L 0-2 at Chelsea, L 0-3 vs Bournemouth, D 1-1 at Leeds\n- Brentford last 5: W 4-0 vs Everton, L 0-2 at Brighton, W 2-0 vs Nottingham Forest, D 1-1 at Hull, L 1-2 vs Liverpool');
  t.equal(pd.nhan.length, 2, 'đọc đủ phong độ hai đội');
  t.ok(loiTen('Relegation Zone Man Utd Host Flying Brentford! Marble Match Blow Mind', h0, cu, pd.cam).some((x) => /in form/.test(x)), '"Flying" khi không đội nào đang phong độ bị chặn');
  t.deepEqual(loiTen('Winless Man Utd At Old Trafford: Will This Marble Match Blow Your Mind?', h0, cu, pd.cam), [], '"Winless" đúng sự thật → đạt');
  t.equal(phongDo('- Everton recent form: L W W W L\n- Liverpool recent form: W W W L L').cam.some(([re]) => re.test('win streak')), false, 'WWW → được nói win streak');
  console.log('tieu-de-ai: 11 ca đạt');
}

const pg = (s) => `'${String(s).replace(/'/g, "''")}'`;
/** Chạy một câu SQL trên DB studio (box3), câu đi qua stdin — không lồng nháy shell. */
export async function sqlBox(q) {
  const { execFileSync } = await import('node:child_process');
  const chay = `cd /opt/earns-marketing-os-v2; set -a; . ./.env.production; set +a; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -tA <<'__SQL__'\n${q}\n__SQL__\n`;
  return execFileSync('ssh', ['root@167.233.241.16', 'bash -s'], { input: chay, encoding: 'utf8', maxBuffer: 64 << 20 }).trim();
}

if (process.argv.includes('--doi-ten')) {
  const goc = process.argv.slice(process.argv.indexOf('--doi-ten') + 1).filter((x) => !x.startsWith('--')), xem = process.argv.includes('--xem');
  const kho = khoHook(JSON.parse(readFileSync(join(DIR, 'kenh-orbiball', 'hook.json'), 'utf8')));
  const hang = JSON.parse(await sqlBox(`select coalesce(json_agg(json_build_object('id', v.id, 'slug', v.slug, 'title', v.dang->>'title', 'mota', v.dang->>'description') order by v.id), '[]')
    from xv_may_video v join xv_may m on m.id = v.may_id where m.ma = 'orbiball' and not coalesce(v.luu_tru, false)`));
  let tong = 0; const khac = hang.map((h) => h.title).filter(Boolean);
  for (const g of goc) {
    const nhom = hang.filter((h) => h.slug === g || h.slug.startsWith(`${g}-`)); if (!nhom.length) { console.log(`✗ ${g}: không có video`); continue; }
    const ban = nhom.map((h) => (h.slug === g ? 'ngang' : h.slug.slice(g.length + 1)));
    const r = await sinhTieuDe({ su_that: (nhom.find((h) => h.slug === g) ?? nhom[0]).mota, ban, kho, khac });
    tong += r.chi_usd;
    for (const [i, h] of nhom.entries()) {
      const x = r.ten[ban[i]]; khac.push(x.title);
      console.log(`${xem ? '·' : '✓'} ${h.id} ${h.slug}\n    cũ: ${h.title}\n    mới: ${x.title}   (hook ${x.hook.qc})`);
      if (!xem) await sqlBox(`update xv_may_video set dang = jsonb_set(jsonb_set(dang, '{title}', to_jsonb(${pg(x.title)}::text)), '{hook}', ${pg(JSON.stringify(x.hook))}::jsonb), updated_at = now() where id = ${Number(h.id)}`);
    }
  }
  console.log(`chi AI: $${tong.toFixed(4)} ≈ ${Math.round(tong * 26000)}₫ (${MODEL})`);
}
