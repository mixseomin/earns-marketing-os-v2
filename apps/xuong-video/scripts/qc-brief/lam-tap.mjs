#!/usr/bin/env node
// tra-repo-ok: dán keo nội bộ — cổng AI chung (packages/cong-ai hoiChu), máy dựng qc-brief/dung.mjs, cổng nạp qc-brief/nap.mjs, lối box3 lich-su/box3.mjs
// SẢN XUẤT TẬP "AD BREAKDOWN" TỰ ĐỘNG cho máy anglebrief (anh 19/11/2026: "bật máy chạy anglebrief cho sản xuất đi" + "lên lịch đăng bài").
// Gọi từ lượt MỖI GIỜ có sẵn (lich-su/chay-kenh.mjs, việc nền iMac com.earns.lich-su-lam-tap) — không tiến trình riêng. Mỗi lượt:
//   1. --theo-lich: hôm nay (giờ VN, sau 09:00) chưa làm tập + hàng chờ đăng (DUYỆT / chờ chấm, chưa lên Facebook) < HANG → làm; không thì thoát im
//   2. chọn QC: kho spy, khớp nhóm #4668 (goc_sp.lien_quan), chạy ≥ 30 ngày, có ảnh, chưa mổ (theo library_id và theo câu mở đầu — QC nhân bản cùng chữ tính là một)
//   3. viết kịch bản qua cổng AI (dòng Sonnet, ~100₫): khuôn cảnh của qc-brief/san-khau.html; máy KIỂM (số chữ, câu kết, chữ "khi" có trong câu, trích QC nguyên văn,
//      số chỉ lấy từ QC, tiêu đề giữ chữ câu mở đầu QC) — sai thì tuyến khác viết lại
//   4. dựng (dung.mjs — giọng ~1.400₫) → nạp máy đăng (nap.mjs) → Phòng Nội dung chấm → máy đăng 20:00 theo nhịp an toàn
//   node scripts/qc-brief/lam-tap.mjs [--theo-lich] [--xem]      --xem: chọn QC + viết kịch bản, in ra, không dựng / không nạp
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOX, sqlBox } from '../lich-su/box3.mjs';
import { goiAi, MO_HINH } from '../../../../packages/cong-ai/index.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), KHO = `${process.env.HOME}/.cache/qc-brief`, MAY = 'anglebrief', SP = 4668, HANG = 3, NGAY_TOI_THIEU = 30;
const GOC = { id: 153879, sp: SP, loai: 'ai_cach_giai', ten: 'Săn và tái tạo ad thắng của đối thủ, kể cả qua ad spy tool' };
const CAU_KET = 'Want the angles buyers actually respond to in your niche? Find them at AngleBrief dot net.';
const DANG = ['chi_tay', 'suy_nghi', 'noi_mo', 'ngac_nhien'];
const q1 = (x) => `'${String(x).replace(/'/g, "''")}'`;
const spy = (sql) => execFileSync('ssh', [BOX, 'set -a; . /root/.secrets/spy.env 2>/dev/null; set +a; psql "$DATABASE_URL" -qtA -v ON_ERROR_STOP=1 -f -'], { input: sql, encoding: 'utf8', maxBuffer: 32 << 20 }).trim();

// ---------- 1. lịch ----------
const homNay = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10), gioVn = new Date(Date.now() + 7 * 3600e3).getUTCHours();
if (process.argv.includes('--theo-lich')) {
  if (gioVn < 9) process.exit(0);
  const r = sqlBox(`SELECT count(*) FILTER (WHERE (v.created_at + interval '7 hours')::date = ${q1(homNay)}::date) || ',' || count(*) FILTER (WHERE NOT (coalesce(v.da_dang, '{}'::jsonb) ? 'facebook') AND coalesce(v.cham->>'ket', 'DUYET') = 'DUYET')
    FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id WHERE m.ma = ${q1(MAY)} AND NOT coalesce(v.luu_tru, false) AND m.chay;`);
  const [homnay, hang] = (r || '0,0').split(',').map(Number);
  if (homnay > 0 || hang >= HANG) process.exit(0);
}

// ---------- 2. chọn QC ----------
const daDung = sqlBox(`SELECT coalesce(string_agg(v.dang->'hook'->>'qc', ','), '') FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id WHERE m.ma = ${q1(MAY)};`).split(',').filter(Boolean);
const lq = new RegExp(spy(`SELECT lien_quan FROM goc_sp WHERE id = ${SP};`), 'i');
const ung = JSON.parse(spy(`SELECT coalesce(json_agg(x), '[]') FROM (SELECT library_id::text AS id, coalesce(mien, '') AS mien, page_ten AS page, bat_dau::text AS bat_dau, (coalesce(lan_cuoi::date, current_date) - bat_dau) AS ngay, noi_dung, anh
  FROM qc_meta WHERE anh IS NOT NULL AND bat_dau IS NOT NULL AND noi_dung ~* '\\m(ads? ?hooks?|ads? ?angles?|ads? ?creatives?|winning ads?|ugc ads?|media ?buyers?|ad spy|creative testing)\\M' AND (coalesce(lan_cuoi::date, current_date) - bat_dau) >= ${NGAY_TOI_THIEU}
  ORDER BY 5 DESC LIMIT 1000) x;`));
const dau = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80);
// QC nhân bản / cùng sản phẩm (cùng câu mở đầu hoặc cùng tên miền đích) tính là một — không mổ Arcads hai lần qua hai Page khác nhau
const dauDung = new Set(ung.filter((x) => daDung.includes(x.id)).map((x) => dau(x.noi_dung))), mienDung = new Set(ung.filter((x) => daDung.includes(x.id) && x.mien).map((x) => x.mien));
const qc = ung.find((x) => !daDung.includes(x.id) && lq.test(x.noi_dung) && !dauDung.has(dau(x.noi_dung)) && !(x.mien && mienDung.has(x.mien)));
if (process.env.QCB_GO) console.error(ung.filter((x) => lq.test(x.noi_dung)).slice(0, 8).map((x) => `${x.id} ${x.ngay}d ${x.mien} ${x.page}`).join('\n'));
if (!qc) { console.log(`⚠ ${MAY}: hết QC chưa mổ (nhóm #${SP}, chạy ≥ ${NGAY_TOI_THIEU} ngày) — chờ máy cào thêm`); process.exit(0); }
const dongDau = qc.noi_dung.split('\n').map((s) => s.trim()).find(Boolean);

// ---------- 3. viết kịch bản ----------
const soTrong = (s) => (String(s).match(/\d[\d,.]*/g) || []).map((n) => n.replace(/[,.]+$/, '').replace(/,/g, ''));
const nhay = (s) => String(s).replace(/[“”„"]/g, '"').replace(/[‘’]/g, "'");
const chuan = (w) => String(w).toLowerCase().replace(/[^a-z0-9]/g, '');
function kiem(t) {
  if (!t || !Array.isArray(t.cau)) return 'not valid JSON or missing cau[] — return the full object';
  const tong = t.cau.reduce((s, c) => s + String(c.chu || '').trim().split(/\s+/).length, 0);
  if (tong < 85 || tong > 140) return `tổng ${tong} chữ, cần 85–140 (≤ 60 giây giọng)`;
  if (t.cau.length < 8 || t.cau.length > 12) return `${t.cau.length} câu, cần 8–12`;
  if (t.cau.at(-1).chu !== CAU_KET || t.cau.at(-1).canh?.loai !== 'ket') return 'câu cuối phải đúng câu kết + cảnh ket';
  if (t.cau[0].canh?.loai !== 'dt') return 'câu 1 phải là cảnh dt (điện thoại chiếu QC)';
  const choPhep = new Set([...soTrong(qc.noi_dung), String(qc.ngay)]);
  for (const [i, c] of t.cau.entries()) { const k = c.canh || {}, ws = String(c.chu).split(/\s+/).map(chuan);
    if (!['dt', 'nv', 'so', 'chu', 'ds', 'ket'].includes(k.loai)) return `câu ${i + 1}: loai ${k.loai} lạ`;
    const co = (w) => ws.some((x) => x.startsWith(chuan(w)));
    for (const w of [k.khi, k.dau?.khi, ...(k.muc || []).map((m) => m.khi)].filter(Boolean)) if (!co(w)) return `câu ${i + 1}: chữ khi "${w}" không có trong câu`;
    if (k.loai === 'nv' && (!DANG.includes(k.dang) || !k.noi)) return `câu ${i + 1}: nv cần dang ∈ ${DANG.join('/')} + noi`;
    if (k.loai === 'so' && !(Number(k.so) > 0 && k.nhan)) return `câu ${i + 1}: so cần số + nhan`;
    if (k.loai === 'ds' && !((k.muc || []).length >= 2 && k.muc.length <= 4)) return `câu ${i + 1}: ds cần 2–4 mục`;
    if (k.khoanh && !nhay(qc.noi_dung).includes(nhay(k.khoanh))) return `câu ${i + 1}: khoanh phải trích NGUYÊN VĂN chữ QC`;
    for (const n of [...soTrong(c.chu), ...soTrong(JSON.stringify(k))]) if (!choPhep.has(n)) return `câu ${i + 1}: số ${n} không có trong QC`; }
  const giu = String(t.tieu_de || '').toLowerCase().split(/\W+/).filter((w) => w.length > 2 && dongDau.toLowerCase().includes(w)).length, can = dongDau.split(/\W+/).filter((w) => w.length > 2).length;
  if (!t.tieu_de || giu / Math.max(1, can) < 0.35) return 'tiêu đề phải giữ ≥ 35% chữ câu mở đầu QC';
  for (const n of soTrong(t.tieu_de)) if (!soTrong(dongDau).includes(n)) return `tiêu đề có số ${n} không có trong câu mở đầu QC`;
  if (!t.mo_ta || t.mo_ta.length > 600) return 'mo_ta 1–600 ký tự';
  if (/[—–]/.test(JSON.stringify([t.tieu_de, t.mo_ta, t.cau.map((c) => c.chu)]))) return 'no em dash or en dash anywhere (use a comma, colon or period)';   // luật chữ public: cấm gạch dài
  return null;
}
const SYSTEM = `You write a 45–55 second vertical "AD BREAKDOWN" video script for AngleBrief (buyer research reports for advertisers). The video dissects ONE real long-running competitor ad: what its hook does, its offer structure, its proof, and the reusable lesson for media buyers. Never claim AngleBrief made or ran the ad. Use ONLY facts in the ad copy and the run length; never invent numbers, results or claims.
Return ONE JSON object only: {"tieu_de": string, "mo_ta": string, "cau": [{"chu": sentence spoken by narrator, "canh": scene}]}.
Rules:
- 8 to 12 sentences, 100 to 120 words total (count them), plain spoken English, short sentences.
- Sentence 1 says how many days the ad has been live, scene {"loai":"dt","dau":{"chu":"<N> DAYS LIVE","khi":"<first word of the number phrase in that sentence>"}}.
- Sentence 2 quotes the hook, scene {"loai":"dt","khoanh":"<exact substring copied from the ad copy>","khi":"<a word in sentence 2>"}.
- Other scene types: {"loai":"nv","dang":"chi_tay|suy_nghi|noi_mo|ngac_nhien","noi":"<speech bubble, max 5 words>"} · {"loai":"so","so":<number from the ad>,"truoc":"$" optional,"sau":"+/mo" optional,"nhan":"<LABEL, max 4 words caps>","khi":"<word in sentence where the number is said>"} · {"loai":"chu","chu_to":"<2-4 WORDS CAPS>","phu":"<small line>" optional,"gach":"<CAPS words struck out>" optional,"khi":"<word>"} · {"loai":"ds","tieu":"<CAPS title>","muc":[{"chu":"<item max 4 words>","bieu":"<one emoji>","khi":"<word in this sentence>"}] 2-4 items}.
- Mix scene types; at least 2 "nv", at least 1 "so" or "ds". Every "khi" word must literally appear in that same sentence.
- Last sentence EXACTLY: "${CAU_KET}" with scene {"loai":"ket","chu":"AngleBrief","url":"anglebrief.net","phu":"Real buyer research. Winning ad angles."}.
- tieu_de: keep at least 35% of the words of the ad's first line, add a short "steal the structure" style ending; no numbers that are not in that first line; max 110 characters.
- Never use em dashes or en dashes; use commas, colons or periods.
- mo_ta: 2-3 sentences summarising the breakdown for the Facebook caption (no link, no hashtags).`;
const KHUON = { type: 'object', required: ['tieu_de', 'mo_ta', 'cau'], properties: { tieu_de: { type: 'string' }, mo_ta: { type: 'string' },
  cau: { type: 'array', items: { type: 'object', required: ['chu', 'canh'], properties: { chu: { type: 'string' }, canh: { type: 'object', required: ['loai'], properties: {
    loai: { type: 'string', enum: ['dt', 'nv', 'so', 'chu', 'ds', 'ket'] }, khi: { type: 'string' }, khoanh: { type: 'string' }, dang: { type: 'string' }, noi: { type: 'string' }, so: { type: 'number' },
    truoc: { type: 'string' }, sau: { type: 'string' }, nhan: { type: 'string' }, chu_to: { type: 'string' }, phu: { type: 'string' }, gach: { type: 'string' }, tieu: { type: 'string' }, chu: { type: 'string' }, url: { type: 'string' },
    dau: { type: 'object', properties: { chu: { type: 'string' }, khi: { type: 'string' } } },
    muc: { type: 'array', items: { type: 'object', properties: { chu: { type: 'string' }, bieu: { type: 'string' }, khi: { type: 'string' } } } } } } } } } } };
const user = `AD COPY (page: ${qc.page}, live since ${qc.bat_dau}, ${qc.ngay} days running):\n"""\n${qc.noi_dung.slice(0, 2500)}\n"""\nFIRST LINE: ${dongDau}`;
let viet, loiCuoi = '';
for (let lan = 0; lan < 5 && !viet; lan++) {   // tuyến donk đôi khi trả khuôn rỗng ({}) → thêm lượt, mỗi lượt ~100₫
  // ép khuôn bằng schema của cổng (kq là đối tượng): chữ QC hay có dấu nháy, để model tự viết JSON thì hỏng thoát chuỗi (19/11/2026: 3/3 lượt hỏng)
  // lượt chẵn: JSON chữ thường (cấm nháy thẳng trong chuỗi) · lượt lẻ: ép schema — tuyến donk lúc ép schema hay trả khuôn rỗng, lúc chữ thường hay quên thoát nháy
  const theoKhuon = lan % 2 === 1;
  let r; try { r = await goiAi({ viec: 'anglebrief-ad-breakdown', model: MO_HINH.sonnet, system: theoKhuon ? SYSTEM : `${SYSTEM}\n- Output raw JSON only (no code fence). Never put the straight double-quote character inside a string value: when quoting the ad, use curly quotes “ ” instead.`,
    noi_dung: loiCuoi ? `${user}\n\nYour previous answer was rejected: ${loiCuoi}. Fix it.` : user, max_tokens: 4000, ...(theoKhuon ? { schema: KHUON } : {}) }, { lan: 2 }); }
  catch (e) { loiCuoi = e.message.slice(0, 200); continue; }
  // cổng ép khuôn bằng công cụ → mọi trường khai trong schema đều có mặt ("" / 0 / [] / {} rỗng) → gọt trường rỗng trước khi kiểm
  const got = (v) => Array.isArray(v) ? v.map(got).filter((x) => x !== undefined) : v && typeof v === 'object' ? (() => { const o = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'so' && x === 0 ? undefined : got(x)]).filter(([, x]) => x !== undefined && x !== '' && !(Array.isArray(x) && !x.length) && !(x && typeof x === 'object' && !Array.isArray(x) && !Object.keys(x).length))); return o; })() : v;
  const t = got(typeof r.kq === 'string' ? (() => { try { return JSON.parse(r.kq.slice(r.kq.indexOf('{'), r.kq.lastIndexOf('}') + 1)); } catch { return null; } })() : r.kq);
  loiCuoi = kiem(t); if (!loiCuoi) viet = { ...t, model: r.model, chi_usd: r.chi_usd };
}
if (!viet) { console.log(`⚠ ${MAY}: viết kịch bản QC ${qc.id} hỏng 5 lần — ${loiCuoi}`); process.exit(1); }
const id = `qc-brief-${qc.id}`, nen = [['mau1/nen-8100069.jpg', '8100069'], ['mau1/nen-20232363.jpg', '20232363']], dao = Number(qc.id.slice(-1)) % 2;
const tap = { id, may: MAY, mau: 'ad-breakdown', ngon_ngu: 'en', giong: { voice: 'Daniel' }, tieu_de: viet.tieu_de, mo_ta: viet.mo_ta, goc: GOC,
  nguon_qc: { library_id: qc.id, page: qc.page, bat_dau: qc.bat_dau, ngay: qc.ngay },
  may_viet: { model: viet.model, luc: new Date().toISOString(), chi_usd: viet.chi_usd },
  tai_san: { qc: `${id}/qc.jpg`, nen: (dao ? [nen[1], nen[0]] : nen).map((x) => x[0]), nen_nguon: (dao ? [nen[1], nen[0]] : nen).map((x) => `https://www.pexels.com/photo/${x[1]}/`),
    nv: Object.fromEntries(DANG.map((d) => [d, `nv/${d}.png`])) }, cau: viet.cau };
if (process.argv.includes('--xem')) { console.log(JSON.stringify(tap, null, 1)); process.exit(0); }

// ---------- 4. dựng + nạp ----------
const tep = join(DIR, 'tap', `${id}.json`); mkdirSync(dirname(tep), { recursive: true }); writeFileSync(tep, JSON.stringify(tap, null, 1) + '\n');
mkdirSync(join(KHO, id), { recursive: true });
if (!existsSync(join(KHO, id, 'qc.jpg'))) { execFileSync('ssh', [BOX, `curl -s -L --max-time 60 -o /tmp/${id}.jpg ${q1(qc.anh)} && test -s /tmp/${id}.jpg`]); execFileSync('scp', ['-q', `${BOX}:/tmp/${id}.jpg`, join(KHO, id, 'qc.jpg')]); execFileSync('ssh', [BOX, `rm -f /tmp/${id}.jpg`]); }
const chay = (f, args) => { const r = spawnSync(process.execPath, [join(DIR, f), ...args], { encoding: 'utf8', maxBuffer: 64 << 20 }); if (r.status) { console.log(`⚠ ${MAY}: ${f} hỏng — ${(r.stderr || r.stdout).trim().split('\n').slice(-3).join(' | ')}`); process.exit(1); } return r.stdout.trim().split('\n'); };
const d = chay('dung.mjs', [tep]), n = chay('nap.mjs', [tep, tap.mo_ta]);
const tien = (d.find((x) => /tiền ~/.test(x)) || '').match(/~(\d+)₫/)?.[1];
console.log(`✓ tập mới ${MAY}: "${tap.tieu_de}" · QC ${qc.page} ${qc.ngay} ngày · giọng ~${tien ?? '?'}₫ + chữ $${Number(viet.chi_usd || 0).toFixed(4)} · ${n.at(-1)}`);
