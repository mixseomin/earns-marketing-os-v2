#!/usr/bin/env node
// ĐO VĂN DÀI (11/10/2026, anh "chấm luôn"): tính cách Sáng tạo (2 vs 9) có đổi bài viết DÀI, ít ràng buộc không. Bài ngắn
// ràng buộc chặt đã đo: không khác hơn nhiễu (decision 2026-10-11-cong-ty-ai-do-model.md).
//   --sinh  10 đề (5 Anh, 5 Việt) × Sáng tạo 2/9 × 3 model × 2 lần, đúng lời nhắc "làm" của quy trình (do-model.mjs goi)
//   --cham  2 giám khảo khác hãng chấm MÙ từng cặp S2↔S9 (lần 1), mỗi cặp cả hai thứ tự; chỉ tính khi hai thứ tự cùng chọn
//   --xuat-cap   20 cặp cho anh chấm (thứ tự A/B ngẫu nhiên, đáp án giấu ở cap-nguoi.json, trang chỉ thấy chữ)
//   --tong [--nguoi <tệp JSON {id: "A"|"B"|"ngang"}>]   máy (độ khác chữ so với nhiễu, đặc trưng văn) + giám khảo + người (0 đồng)
// Mọi lời gọi đã trả tiền ghi nguyên văn: <DATA>/do-model/van/{bai,cham}.jsonl. Chạy lại = chạy tiếp phần thiếu.
import fs from 'node:fs';
import path from 'node:path';
import { goi } from './do-model.mjs';
import { hienHanh, dien, json, tenPhong } from './quy-trinh.mjs';
import { quyDinhLuot } from './ca.mjs';
import { tienUsd } from './gia.mjs';
import { tinhCachCua } from './tinh-cach.mjs';

const K = 'thu-nghiem/lam-viec';
const DIR = () => path.join(process.env.CTY_DATA_DIR || '/var/lib/cty', 'do-model', 'van');
const MODELS = ['fal:z-ai/glm-5.3-flash', 'openai:gpt-4o-mini', 'fal:anthropic/claude-haiku-5.5'];
const GIAM_KHAO = ['fal:google/gemini-3.8-flash', 'fal:openai/gpt-5.6-sol'];   // khác hãng nhau; so S2↔S9 CÙNG một model nên thiên vị họ model không lệch phía nào
const DE = [
  ['en', 'Write a cold outreach email to the editor of a puzzle blog, proposing a guest post about large-print puzzles for seniors.', 120, 160],
  ['en', 'Write an Etsy product description for a printable mandala coloring book for adults (50 pages, PDF).', 120, 160],
  ['en', 'Write the opening paragraph of a blog post: why Killer Sudoku is the best next step after classic Sudoku.', 100, 150],
  ['en', 'Write a Gumroad sales blurb for a printable habit tracker PDF.', 100, 140],
  ['en', 'Write a welcome email for new subscribers of a solitaire strategy newsletter.', 100, 150],
  ['vi', 'Viết mô tả sản phẩm cho sách sudoku khổ lớn dành cho người cao tuổi.', 120, 160],
  ['vi', 'Viết email xin lỗi khách vì đơn sách đố vui giao trễ, giữ khách quay lại mua tiếp (không hứa giảm giá).', 100, 140],
  ['vi', 'Viết bài đăng Facebook giới thiệu bộ thẻ học từ vựng tiếng Anh cho trẻ 4–6 tuổi.', 80, 120],
  ['vi', 'Viết đoạn mở đầu bài blog: vì sao giải đố mỗi ngày tốt cho trí nhớ người lớn tuổi.', 100, 150],
  ['vi', 'Viết tin nhắn chăm sóc khách sau khi họ mua sách tô màu mandala.', 60, 100],
];
const MUC = [2, 9];
const docDong = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const ketQua = (dap) => { const o = json(dap); const v = o?.ket_qua; return typeof v === 'string' ? v : null; };

async function chayHang(hang, tep, tran, lam) {
  let chi = docDong(tep).reduce((s, x) => s + (x.usd || 0), 0), i = 0, dung = null;
  const tho = async () => { while (!dung && i < hang.length) { if (chi >= tran) { dung = `chạm trần $${tran}`; break; } const h = hang[i++]; const x = await lam(h); chi += x.usd; fs.appendFileSync(tep, JSON.stringify(x) + '\n'); } };
  await Promise.all(Array.from({ length: 6 }, tho));   // ≤ 6 đồng thời: dưới giới hạn 10 của fal
  return { dung, chi };
}

export async function sinh(tran) {
  fs.mkdirSync(DIR(), { recursive: true }); const tep = path.join(DIR(), 'bai.jsonl');
  const xong = new Set(docDong(tep).filter((x) => x.http === 200).map((x) => x.khoa));
  const qt = hienHanh(K); const nk = { ten_phong: tenPhong(K), quy_dinh: quyDinhLuot(K) }; const hang = [];
  for (let lan = 1; lan <= 2; lan++) for (const [i, [nn, de, a, b]] of DE.entries()) for (const model of MODELS) for (const muc of MUC) {
    const khoa = `${i}|${muc}|${lan}|${model}`; if (!xong.has(khoa)) hang.push({ khoa, de: i, nn, muc, lan, model,
      user: dien(qt.loi_nhac.lam, { nguoi_lam: 'Người làm', viec_giao: de, tieu_chi: `1. ${nn === 'en' ? 'English' : 'Viết bằng tiếng Việt'}\n2. ${a}–${b} ${nn === 'en' ? 'words' : 'từ'}` }) });
  }
  return chayHang(hang, tep, tran, async (h) => { const r = await goi(h.model, 'lam', h.user, nk, 'do-van', tinhCachCua({}, { sang_tao: h.muc }));
    const { user, ...g } = h; return { ...g, ts: new Date().toISOString(), hoi: user, http: r.http, ms: r.ms, usage: r.usage, usd: r.usage ? r.usage.cost_usd ?? tienUsd(h.model, r.usage) ?? 0 : 0, dap: r.dap, loi: r.loi }; });
}

const capLan1 = () => { const bai = new Map(docDong(path.join(DIR(), 'bai.jsonl')).filter((x) => x.http === 200 && ketQua(x.dap)).map((x) => [x.khoa, x]));
  return DE.flatMap((_, i) => MODELS.flatMap((m) => { const s2 = bai.get(`${i}|2|1|${m}`), s9 = bai.get(`${i}|9|1|${m}`); return s2 && s9 ? [{ id: `${i}-${m.split('/').pop()}`, de: i, model: m, s2: ketQua(s2.dap), s9: ketQua(s9.dap) }] : []; })); };
const HE_GK = 'Bạn là giám khảo chấm văn, khó tính, công bằng. Chỉ trả JSON.';
const loiGK = (de, A, B) => `Đề bài: «${de}»\n\nHai bản viết cho cùng đề:\n\n[BẢN A]\n${A}\n\n[BẢN B]\n${B}\n\nBản nào đạt mục đích của đề tốt hơn — người đọc thật muốn đọc tiếp / trả lời / mua; cụ thể, tự nhiên, không sáo rỗng? Khác biệt không đáng kể thì chọn "ngang". Trả JSON {"hon":"A"|"B"|"ngang","ly_do":"<một câu>"}`;

export async function cham(tran) {
  const tep = path.join(DIR(), 'cham.jsonl'); const xong = new Set(docDong(tep).filter((x) => x.http === 200).map((x) => x.khoa)); const hang = [];
  for (const c of capLan1()) for (const gk of GIAM_KHAO) for (const thuTu of ['s2-truoc', 's9-truoc']) { const khoa = `${c.id}|${gk}|${thuTu}`; if (!xong.has(khoa)) hang.push({ khoa, cap: c.id, gk, thuTu, c }); }
  return chayHang(hang, tep, tran, async (h) => {
    const [A, B] = h.thuTu === 's2-truoc' ? [h.c.s2, h.c.s9] : [h.c.s9, h.c.s2];
    const r = await goi(h.gk, 'kiem', loiGK(DE[h.c.de][1], A, B), {}, 'do-van-cham', [], HE_GK);
    const hon = json(r.dap)?.hon; const chon = hon === 'ngang' ? 'ngang' : hon === 'A' ? (h.thuTu === 's2-truoc' ? 's2' : 's9') : hon === 'B' ? (h.thuTu === 's2-truoc' ? 's9' : 's2') : null;
    return { khoa: h.khoa, cap: h.cap, gk: h.gk, thu_tu: h.thuTu, ts: new Date().toISOString(), http: r.http, usage: r.usage, usd: r.usage ? r.usage.cost_usd ?? tienUsd(h.gk, r.usage) ?? 0 : 0, dap: r.dap, chon, loi: r.loi };
  });
}

// Trộn có hạt giống: cùng dữ liệu → cùng 20 cặp, cùng thứ tự A/B (chạy lại không đổi đề anh đang chấm).
const hat = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 2 ** 32; };
export function xuatCap() {
  const ds = capLan1().filter((c) => { const mi = MODELS.indexOf(c.model); return mi === c.de % 3 || mi === (c.de + 1) % 3; });   // mỗi đề 2/3 model, xoay vòng → 20 cặp
  const cap = ds.map((c) => { const s9A = hat(c.id) < 0.5; return { id: c.id, de: DE[c.de][1], A: s9A ? c.s9 : c.s2, B: s9A ? c.s2 : c.s9, s9: s9A ? 'A' : 'B', model: c.model }; });
  fs.writeFileSync(path.join(DIR(), 'cap-nguoi.json'), JSON.stringify(cap, null, 1));
  return cap.map(({ id, de, A, B }) => ({ id, de, A, B }));   // trang chấm chỉ thấy chữ
}

const W = (t) => String(t).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const khac = (a, b) => { const A = new Set(W(a)), B = new Set(W(b)); let c = 0; for (const x of A) if (B.has(x)) c++; return 1 - c / Math.max(1, A.size + B.size - c); };
const SAO = /\b(perfect|ultimate|amazing|stunning|unlock|elevate|seamless|journey|dive into|whether you're)\b|tuyệt vời|hoàn hảo|lý tưởng|đẳng cấp|tuyệt đỉnh|không thể bỏ qua|vô cùng|hành trình/giu;
const cauDai = (t) => { const c = String(t).split(/(?<=[.!?])\s+/).map((s) => W(s).length).filter(Boolean); const m = c.reduce((s, x) => s + x, 0) / (c.length || 1); return { tb: m, lech: Math.sqrt(c.reduce((s, x) => s + (x - m) ** 2, 0) / (c.length || 1)) }; };
const tb = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

export function tong(nguoiTep) {
  const bai = docDong(path.join(DIR(), 'bai.jsonl')).filter((x) => x.http === 200 && ketQua(x.dap)); const B = new Map(bai.map((x) => [x.khoa, ketQua(x.dap)]));
  const may = {};
  for (const m of MODELS) {
    const lay = (muc, lan) => DE.map((_, i) => B.get(`${i}|${muc}|${lan}|${m}`));
    const cap = (a, b) => tb(a.map((x, i) => (x && b[i] ? khac(x, b[i]) : null)).filter((x) => x != null));
    const dac = (muc) => { const ts = [...lay(muc, 1), ...lay(muc, 2)].filter(Boolean); return { tu: tb(ts.map((t) => W(t).length)), nhip_lech: tb(ts.map((t) => cauDai(t).lech)), sao: ts.reduce((s, t) => s + (t.match(SAO) ?? []).length, 0), so_lieu: tb(ts.map((t) => (t.match(/\d+/g) ?? []).length)) }; };
    may[m] = { s2_vs_s9: tb([cap(lay(2, 1), lay(9, 1)), cap(lay(2, 2), lay(9, 2))]), nhieu_nen: tb([cap(lay(2, 1), lay(2, 2)), cap(lay(9, 1), lay(9, 2))]), s2: dac(2), s9: dac(9) };
  }
  // giám khảo: một phiếu = hai thứ tự cùng chọn; lệch nhau = ngang (thiên vị chỗ đứng)
  const ch = docDong(path.join(DIR(), 'cham.jsonl')).filter((x) => x.http === 200); const phieu = {};
  for (const x of ch) ((phieu[x.cap] ??= {})[x.gk] ??= {})[x.thu_tu] = x.chon;
  const ketGK = {}; const theoCap = {};
  for (const [cap, gks] of Object.entries(phieu)) for (const [gk, t] of Object.entries(gks)) {
    const v = t['s2-truoc'] && t['s2-truoc'] === t['s9-truoc'] ? t['s2-truoc'] : 'ngang'; (theoCap[cap] ??= {})[gk] = v;
    const m = cap.split('-').slice(1).join('-'); const o = ((ketGK[gk] ??= {})[m] ??= { s9: 0, s2: 0, ngang: 0 }); o[v]++;
  }
  const dongY = Object.values(theoCap).filter((g) => Object.keys(g).length === 2); const cungChon = dongY.filter((g) => new Set(Object.values(g)).size === 1);
  const kq = { ts: new Date().toISOString(), chi_sinh: docDong(path.join(DIR(), 'bai.jsonl')).reduce((s, x) => s + (x.usd || 0), 0), chi_cham: docDong(path.join(DIR(), 'cham.jsonl')).reduce((s, x) => s + (x.usd || 0), 0),
    may, giam_khao: ketGK, hai_gk_dong_y: { n: dongY.length, cung_chon: cungChon.length, s9: cungChon.filter((g) => Object.values(g)[0] === 's9').length, s2: cungChon.filter((g) => Object.values(g)[0] === 's2').length } };
  if (nguoiTep && fs.existsSync(nguoiTep)) {   // anh chấm: { id: "A"|"B"|"ngang" } → quy về s2/s9 bằng đáp án giấu
    const dap = JSON.parse(fs.readFileSync(path.join(DIR(), 'cap-nguoi.json'), 'utf8')); const nguoi = JSON.parse(fs.readFileSync(nguoiTep, 'utf8')); const o = { s9: 0, s2: 0, ngang: 0, khop_gk: {} };
    for (const c of dap) { const v = nguoi[c.id]; if (!v) continue; const s = v === 'ngang' ? 'ngang' : v === c.s9 ? 's9' : 's2'; o[s]++;
      for (const [gk, g] of Object.entries(theoCap[c.id] ?? {})) { const k = (o.khop_gk[gk] ??= { n: 0, khop: 0 }); k.n++; k.khop += g === s ? 1 : 0; } }
    kq.nguoi = o;
  }
  fs.writeFileSync(path.join(DIR(), 'ket.json'), JSON.stringify(kq, null, 1));
  return kq;
}

const thamSo = (k, mac) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : mac);
if ((process.argv[1] || '').endsWith('do-van.mjs')) {
  if (process.argv.includes('--sinh')) console.log(await sinh(Number(thamSo('--tran', 0.1))));
  if (process.argv.includes('--cham')) console.log(await cham(Number(thamSo('--tran', 0.4))));
  if (process.argv.includes('--xuat-cap')) console.log(JSON.stringify(xuatCap()));
  if (process.argv.includes('--tong')) console.log(JSON.stringify(tong(thamSo('--nguoi')), null, 1));
  if (process.argv.includes('--tu-kiem')) {
    const a = (c, m) => { if (!c) { console.error('✗ do-van:', m); process.exit(1); } };
    a(khac('một hai ba', 'một hai ba') === 0 && khac('a b', 'c d') === 1, 'độ khác chữ 0..1');
    a(cauDai('Một hai. Ba bốn năm sáu.').lech === 1, 'nhịp câu = độ lệch độ dài câu');
    a(DE.length === 10 && DE.filter((d) => d[0] === 'vi').length === 5, '10 đề, 5 Việt');
    console.log('✓ do-van: độ khác chữ, nhịp câu, 10 đề');
  }
}
