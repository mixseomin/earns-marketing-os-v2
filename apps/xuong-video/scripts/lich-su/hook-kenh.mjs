// BỘ CHỌN HOOK CHUNG cho mọi máy viết kênh (06/11/2026, anh: "Sửa hook quan trọng" — trước đó mỗi máy gọi --goc-hook một lần rồi xoay 6 câu cho mọi tập,
// 3/4 tập dự trữ G6 mở bằng cùng một câu). MỘT nguồn: kho hook của máy trên box3 (may-dung.mts --kho-hook: QC chạy lâu nhất đã qua Ngọc lọc + QC gắn góc
// + hook đã nằm trong bài đang chờ), đệm 24 giờ ở lich-su/hook-kho/<kênh>.json. Chia hook:
//   · ưu tiên QC gắn đúng các góc spy của playlist (so-kenh › playlist.goc_spy), rồi kho chung của nhóm (chạy lâu trước)
//   · MỖI CÂU MỘT TẬP: đếm hook đã dùng ở mọi tập đã viết (shot-code/tap-<kênh>/*.json › hook.qc) + bài đang chờ trên box → chọn câu ít dùng nhất
//   · tập viết lại giữ hook cũ của nó (chạy lại máy không xáo hook) · hook có số / nói nghịch hành chỉ cho đúng chỗ (retro: true) · ưu tiên bản ngắn gọn một khung (hookGon)
//   · VIDEO ĐÃ DỰNG không trùng hook với nhau: sổ hook-kho/<kênh>-video.json (long-tieng.mjs ghi mỗi lần dựng xong) — câu đã nằm trong video nặng ×100,
//     tập đã có video giữ đúng hook của video đó (chữ tập khớp tiếng đã đọc)
//   chonHook(kenh, playlist, maTap, { retro }) → { hook: { id, chu }, chuHook, goc: { id, ten, loai } }
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOX, GOC_BOX } from './box3.mjs';
import { hookNgan } from './chu-man.mjs';
import { sachHook } from '../../src/lib/xuong-video/hook-qc.mjs';
import { docSo } from './kiem-so-kenh.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), SHOT = join(DIR, '../shot-code'), KHO = join(DIR, 'hook-kho');
const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; };

/** kho hook của kênh: --kho-hook <tệp> (thử) → đệm < 24 giờ → hỏi box3 (may-dung --kho-hook) */
export function khoHook(kenh) {
  if (arg('kho-hook')) return JSON.parse(readFileSync(arg('kho-hook'), 'utf8'));
  const f = join(KHO, `${kenh}.json`);
  if (existsSync(f) && !process.argv.includes('--hook-moi') && Date.now() - statSync(f).mtimeMs < 24 * 3600e3) return JSON.parse(readFileSync(f, 'utf8'));
  const r = spawnSync('ssh', [BOX, `cd ${GOC_BOX} && set -a && . ../../.env.production && set +a && NODE_OPTIONS=--conditions=react-server timeout 300s ../../node_modules/.bin/tsx scripts/may-dung.mts --may ${kenh} --kho-hook`], { encoding: 'utf8', maxBuffer: 32 << 20 });
  const dong = (r.stdout ?? '').trim().split('\n').reverse().find((l) => l.startsWith('{"gocs"'));
  if (!dong) { console.error(`✗ không lấy được kho hook ${kenh} từ box3:\n${(r.stderr ?? '').slice(-400)}`); process.exit(3); }
  mkdirSync(KHO, { recursive: true }); writeFileSync(f, dong + '\n');
  return JSON.parse(dong);
}

// khoá một câu hook = chữ đã làm sạch (cùng một câu nằm ở nhiều QC khác mã — đếm theo mã thì một câu vẫn lặp ở hai tập)
const khoa = (chu) => sachHook(String(chu ?? '')).replace(/\p{Extended_Pictographic}/gu, '').toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
// kênh tiếng Anh toàn cầu: bỏ câu chữ Kirin / Devanagari / Ả Rập / CJK… (kho lọt câu tiếng Nga 06/11/2026)
const LA_TINH = (chu) => !/[\u0370-\u03FF\u0400-\u052F\u0590-\u06FF\u0900-\u0DFF\u0E00-\u0E7F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/.test(chu);
let BO = null;   // một bộ cho cả lượt chạy (đếm cả hook vừa chia trong lượt)
function bo(kenh) {
  if (BO?.kenh === kenh) return BO;
  const K = khoHook(kenh), dung = new Map();   // khoá câu → Set(mã tập)
  const them = (qc, ma) => { if (!dung.has(qc)) dung.set(qc, new Set()); dung.get(qc).add(ma); };
  const theoId = new Map([...K.qc_goc, ...K.nhom].map((h) => [String(h.id), khoa(h.chu)]));
  for (const q of K.da_dung ?? []) if (theoId.has(String(q))) them(theoId.get(String(q)), '(box)');
  const tapDir = join(SHOT, `tap-${kenh}`), cu = new Map();
  if (existsSync(tapDir)) for (const f of readdirSync(tapDir).filter((x) => x.endsWith('.json') && !x.startsWith('.'))) {
    try { const t = JSON.parse(readFileSync(join(tapDir, f), 'utf8')); if (t.hook?.goc && t.y_tuong) { them(khoa(t.hook.goc), t.y_tuong); cu.set(t.y_tuong, khoa(t.hook.goc)); } } catch { /* tệp hỏng: bỏ */ }
  }
  // sổ video đã dựng (long-tieng.mjs › ghiHookVideo): { <mã tập>: { khoa, chu, video, luc } }
  const fv = join(KHO, `${kenh}-video.json`), video = existsSync(fv) ? JSON.parse(readFileSync(fv, 'utf8')) : {};
  BO = { kenh, K, dung, cu, them, video };
  return BO;
}

export function chonHook(kenh, plMa, maTap, { retro = false } = {}) {
  const { K, dung, cu, them, video } = bo(kenh), pl = docSo()[kenh].playlist.find((p) => p.ma === plMa);
  const idGoc = new Set((pl?.goc_spy ?? []).map((g) => g.id)), gocPl = K.gocs.filter((g) => idGoc.has(g.id));
  const cuaGoc = new Map(); for (const g of gocPl) for (const q of g.qc_ids) cuaGoc.set(String(q), g);
  // CHỦ ĐỀ của câu khớp playlist: câu tình yêu chỉ cho Love & Compatibility, câu tiền / việc chỉ cho Career (06/11/2026: câu "relate to money" lọt vào Timing)
  const deTai = (c) => (/\b(love|loves|lover|relationships?|him|he|his|heart|partners?|marriage|married|ex|crush|soulmate|dating|romance)\b/i.test(c) ? 'love-compatibility'
    : /\b(money|career|job|work|business|salary|wealth)\b/i.test(c) ? 'career' : null);
  const hop = (h) => !/\d/.test(h.chu) && LA_TINH(h.chu) && (retro ? true : !/retrograde/i.test(h.chu)) && [null, plMa].includes(deTai(h.chu));
  // thứ tự kho: QC gắn góc của playlist → QC chạy lâu của nhóm; trong mỗi tầng, bản ngắn gọn một khung (≤ 60 ký tự) trước
  const tang = [...K.qc_goc.filter((h) => cuaGoc.has(String(h.id))), ...K.nhom.filter((h) => !cuaGoc.has(String(h.id)))].filter(hop);
  const ds = [...tang.filter((h) => hookNgan(h.chu).length <= 60), ...tang.filter((h) => hookNgan(h.chu).length > 60)];
  if (!ds.length) { console.error(`✗ kho hook ${kenh} không còn câu hợp cho playlist ${plMa}`); process.exit(3); }
  const daDung = (h) => [...(dung.get(khoa(h.chu)) ?? [])].filter((m) => m !== maTap).reduce((n, m) => n + (video[m] || m === '(box)' ? 100 : 1), 0);   // câu đã vào video / bài chờ đăng: gần như cấm
  // tập viết lại: giữ hook cũ nếu câu đó vẫn trong kho và chưa tập nào khác giành
  // tập đã có video: giữ đúng hook đã đọc trong video · tập viết lại: giữ hook cũ nếu chưa tập nào khác giành
  const giu = (video[maTap] && ds.find((h) => khoa(h.chu) === video[maTap].khoa)) || (cu.get(maTap) && ds.find((h) => khoa(h.chu) === cu.get(maTap) && !daDung(h)));
  const hook = giu || ds.reduce((tot, h) => (daDung(h) < daDung(tot) ? h : tot), ds[0]);
  them(khoa(hook.chu), maTap);
  const g = cuaGoc.get(String(hook.id)) ?? gocPl[0] ?? K.gocs[0];
  return { hook: { id: hook.id, chu: hook.chu }, chuHook: hookNgan(hook.chu), goc: { id: g?.id, ten: g?.ten, loai: g?.loai } };
}
/** báo cáo cuối lượt: bao nhiêu câu hook khác nhau / bao nhiêu tập, câu nào phải dùng lại */
export function baoHook() { if (!BO) return ''; const lap = [...BO.dung.values()].filter((s) => s.size > 1).length; return `hook: ${BO.dung.size} câu cho ${new Set([...BO.dung.values()].flatMap((s) => [...s])).size} tập · ${lap} câu dùng > 1 tập`; }
/** long-tieng.mjs gọi sau khi dựng xong một tập: ghi hook của video vào sổ — các tập khác tránh câu này */
export function ghiHookVideo(tap, video) {
  if (!tap?.kenh || !tap.y_tuong || !tap.hook?.goc) return;
  const fv = join(KHO, `${tap.kenh}-video.json`), so = existsSync(fv) ? JSON.parse(readFileSync(fv, 'utf8')) : {};
  so[tap.y_tuong] = { khoa: khoa(tap.hook.goc), chu: tap.hook.goc, video, luc: new Date().toISOString() };
  mkdirSync(KHO, { recursive: true }); writeFileSync(fv, JSON.stringify(so, null, 1) + '\n');
}
