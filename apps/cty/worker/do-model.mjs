#!/usr/bin/env node
// DÒ MODEL (kế hoạch 11/10/2026, anh duyệt tới mức 2 ~ $8). Đo MODEL, chưa đo người: hồ sơ trung tính, chưa tính cách, chưa bài học,
// đúng lời nhắc của quy trình đang chạy (thu-nghiem/lam-viec hiện hành), trên bộ đo Hà giữ (cong-ty/bo-viec-chuan/do-model.json).
// Đáp án máy biết trước, không dùng model chấm model:
//   kiem  60 bài nộp cố định (30 sạch, 30 cài đúng 1 lỗi × 6 loại) → chấm đúng? bác sai? duyệt sai? bắt được loại lỗi nào?
//   lam   6 loại việc × 8, tiêu chí chuẩn đưa sẵn → phép đo máy (quy-trinh.mjs mayDo) trên ket_qua
//   giao  48 việc làm được (brief phải giữ đủ ràng buộc) + 16 việc thiếu dữ kiện / mâu thuẫn (phải trả {"thieu"}, không giao)
// Mọi lời gọi qua proxy (giá fail-closed, sổ ai_usage dưới tên Hà, người giữ bộ đo). MỌI lời gọi đã trả tiền ghi nguyên văn vào
// <DATA>/do-model/<dot>/goi.jsonl (hỏi, đáp, token, USD, ms, điểm) để làm insight về sau. Chạy lại cùng --dot = chạy tiếp phần còn
// thiếu, không trả tiền lần hai.
//   node worker/do-model.mjs --chay --dot <tên> --tran <USD> [--lan 3] [--lan-kiem 2] [--models a,b] [--song-song 24]
//   node worker/do-model.mjs --tong <dot>     tổng hợp → ket.json + in bảng (0 đồng)
//   node worker/do-model.mjs --tu-kiem        bộ đo tự kiểm + chạy giả qua proxy giả ($0)
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { GOC } from './goc.mjs';
import { hienHanh, dien, json, mayDo, theVai, tenPhong } from './quy-trinh.mjs';
import { heThong, LOI_HOI_LAI, quyDinhLuot } from './ca.mjs';
import { tienUsd } from './gia.mjs';

const K = 'thu-nghiem/lam-viec';
const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const PROXY = () => process.env.CTY_PROXY_URL || 'http://127.0.0.1:3862';
const BO = JSON.parse(fs.readFileSync(path.join(GOC, 'cong-ty', 'bo-viec-chuan', 'do-model.json'), 'utf8'));
// 3 model nhân sự đang dùng + 11 model qua fal (giá trong gia-model.json, chọn theo bảng giá OpenRouter 11/10/2026: rẻ / tầm trung / mốc trần).
export const MODELS = ['openai:gpt-4o', 'openai:gpt-4o-mini', 'openai:gpt-4.1-nano',
  'fal:anthropic/claude-haiku-5.5', 'fal:qwen/qwen3.8-flash', 'fal:z-ai/glm-5.3-flash', 'fal:openai/gpt-5.6-luna', 'fal:deepseek/deepseek-v4-flash',
  'fal:deepseek/deepseek-v4-pro', 'fal:mistralai/mistral-large-4-0', 'fal:google/gemini-3.8-flash',
  'fal:anthropic/claude-sonnet-5.5', 'fal:openai/gpt-5.6-sol', 'fal:x-ai/grok-4.7'];
const VAI = { giao: 'truong-phong', lam: 'nguoi-lam', kiem: 'nguoi-kiem' };
const TEN = { nguoi_lam: 'Người làm', nguoi_kiem: 'Người kiểm', ma_nguoi_lam: 'nguoi-lam' };
const HO_SO = 'Ứng viên đang được đo năng lực ở vai này. Chưa có kinh nghiệm riêng ở công ty. Làm đúng thẻ vai và lời dặn của lượt.';
const NGUONG = 0.05;   // nhóm dẫn đầu = kém người giỏi nhất không quá 5 điểm → chọn người rẻ nhất trong nhóm (anh chưa đổi thì giữ)
const so = (ds) => ds.map((t, i) => `${i + 1}. ${t}`).join('\n');
const q = (x) => `"${x}"`;

// Mẫu câu theo loại việc: tham số nằm trong bộ đo. giu = ràng buộc brief của trưởng phòng phải giữ (mỗi nhóm: một trong các cách viết).
const MAU = {
  copy_en: ([sp, n, kw]) => ({ viec: `Write one Etsy listing title for ${sp}. Max ${n} characters including spaces, must include "${kw}", English only.`,
    tieu_chi: ['One Etsy listing title, one line only', `Max ${n} characters including spaces`, `Must include "${kw}"`, 'English only'],
    do: [{ loai: 'so_dong', bang: 1 }, { loai: 'so_ky_tu', toi_da: n }, { loai: 'chua', chuoi: [kw] }, { loai: 'ngon_ngu', la: 'en' }],
    giu: [[`${n}`], [kw], ['English', 'tiếng Anh']] }),
  viet_vi: ([sp, c, w, kw, cam]) => ({ viec: `Viết mô tả ${sp} bằng tiếng Việt, đúng ${c} câu, tối đa ${w} từ, có nhắc "${kw}", không dùng chữ "${cam}".`,
    tieu_chi: ['Viết bằng tiếng Việt', `Đúng ${c} câu`, `Tối đa ${w} từ`, `Có nhắc "${kw}"`, `Không dùng chữ "${cam}"`],
    do: [{ loai: 'ngon_ngu', la: 'vi' }, { loai: 'so_cau', bang: c }, { loai: 'so_tu', toi_da: w }, { loai: 'chua', chuoi: [kw] }, { loai: 'khong_chua', chuoi: [cam] }],
    giu: [[`${c}`], [`${w}`], [kw], [cam], ['tiếng Việt', 'Vietnamese']] }),
  tom_tat: ([nguon, w, s, moc]) => ({ viec: `Tóm tắt đoạn sau bằng tiếng Việt trong tối đa ${w} từ, giữ nguyên con số ${s}, không thêm số liệu ngoài đoạn: "${nguon}"`,
    tieu_chi: ['Tóm tắt bằng tiếng Việt', `Tối đa ${w} từ`, `Giữ nguyên con số ${s}`, 'Chỉ dùng số liệu có trong đoạn nguồn', `Đoạn nguồn: "${nguon}"`],
    do: [{ loai: 'ngon_ngu', la: 'vi' }, { loai: 'so_tu', toi_da: w }, { loai: 'chua', chuoi: [s] }, { loai: 'so_trong_nguon', nguon }],
    giu: [[`${w}`], [s], [moc]] }),
  trich_json: ([nguon, khop, moc]) => { const k = Object.keys(khop); return { viec: `Trích từ đoạn sau và trả về JSON đúng ${k.length} khoá ${k.join(', ')} (số viết dạng số): "${nguon}"`,
    tieu_chi: [`JSON đúng ${k.length} khoá: ${k.join(', ')}, không thêm khoá`, 'Giá trị lấy đúng từ đoạn nguồn; số viết dạng số', `Đoạn nguồn: "${nguon}"`],
    do: [{ loai: 'json_khop', khop, du_khoa: true }], giu: [...k.map((x) => [x]), [moc]], mau: JSON.stringify(khop) }; },
  dich: ([nguon, tu, moc]) => ({ viec: `Dịch sang tiếng Anh, giữ nguyên thuật ngữ ${tu.map(q).join(', ')}, không thêm thông tin: "${nguon}"`,
    tieu_chi: ['Dịch sang tiếng Anh', `Giữ nguyên thuật ngữ: ${tu.map(q).join(', ')}`, 'Không thêm thông tin hay số liệu ngoài câu gốc', `Câu gốc: "${nguon}"`],
    do: [{ loai: 'ngon_ngu', la: 'en' }, { loai: 'chua', chuoi: tu }, { loai: 'so_trong_nguon', nguon }],
    giu: [['English', 'tiếng Anh'], ...tu.map((x) => [x]), [moc]] }),
  phan_loai: ([tin, nhan, moc]) => ({ viec: `Phân loại tin nhắn khách sau vào đúng một nhãn trong: hoan_tien, giao_hang, ky_thuat, khac. Chỉ trả nhãn. Tin nhắn: "${tin}"`,
    tieu_chi: ['Đúng một nhãn trong: hoan_tien, giao_hang, ky_thuat, khac', 'Chỉ trả nhãn, viết đúng như danh sách', `Tin nhắn: "${tin}"`],
    do: [{ loai: 'bang_chuoi', la: [nhan] }], giu: [['hoan_tien'], ['giao_hang'], ['ky_thuat'], ['khac'], [moc]], mau: nhan }),
};

export function boDo() {
  const lam = Object.entries(BO.lam).flatMap(([loai, ds]) => ds.map((p, i) => ({ id: `${loai}-${i + 1}`, loai, ...MAU[loai](p) })));
  const kiem = BO.kiem.flatMap((b) => b.bai.map((x, i) => ({ id: `${b.id}-${i + 1}`, loai: b.id, loi: x.loi ?? null, tieu_chi: x.tieu_chi ?? b.tieu_chi, do: x.do ?? b.do, ket_qua: x.ket_qua })));
  const giao = [...lam.map((x) => ({ id: x.id, loai: x.loai, viec: x.viec, giu: x.giu, ky_vong: 'nop' })),
    ...Object.entries(BO.ket).flatMap(([loai, ds]) => ds.map((viec, i) => ({ id: `${loai}-${i + 1}`, loai, viec, ky_vong: 'ket' })))];
  return { kiem, lam, giao };
}

function loiNhac(vai, m, qt) {
  const L = qt.loi_nhac;
  if (vai === 'giao') return dien(L.giao, { ...TEN, viec: m.viec }) + (qt.hoi_lai_khi_thieu_du_kien ? LOI_HOI_LAI : '');
  if (vai === 'lam') return dien(L.lam, { ...TEN, viec_giao: m.viec, tieu_chi: so(m.tieu_chi) });
  return dien(L.soat, { ...TEN, tieu_chi: so(m.tieu_chi), ket_qua: m.ket_qua, bang_chung: 'Đã tự kiểm từng tiêu chí.' });
}

// Ràng buộc brief còn thiếu: số so theo ranh giới số (giữ "60" không khớp "160"), chữ so chứa (không phân biệt hoa thường).
const laSo = (x) => /^\d+(?:[.,]\d+)*%?$/.test(x);
const giuThieu = (text, nhom) => nhom.filter((alts) => !alts.some((x) => (laSo(x)
  ? new RegExp(`(^|[^\\d])${x.replace(/[.%]/g, '\\$&')}(?!\\d)`).test(text) : text.toLowerCase().includes(x.normalize('NFC').toLowerCase()))));

/** Chấm một câu trả lời theo đáp án máy biết trước. */
export function cham(vai, m, dap) {
  const o = json(dap);
  if (vai === 'kiem') {
    const ok = typeof o?.ok === 'boolean' ? o.ok : null; const sach = m.loi == null;
    return { dung: ok === sach, ok, dinh_dang: ok !== null, bac_sai: sach && ok === false, duyet_sai: !sach && ok === true };
  }
  if (vai === 'giao') {
    const thieu = !!(o && o.thieu);
    if (m.ky_vong === 'ket') return { dung: thieu, dinh_dang: !!o, giao_bua: !thieu };
    const brief = `${o?.viec ?? ''}\n${(Array.isArray(o?.tieu_chi) ? o.tieu_chi : []).join('\n')}`.normalize('NFC');
    const mat = thieu || !o?.viec ? [] : giuThieu(brief, m.giu).map((g) => g[0]);
    return { dung: !thieu && !!o?.viec && !mat.length, dinh_dang: !!o, hoi_thua: thieu, mat };
  }
  const kq = o?.ket_qua; const t = kq == null ? null : typeof kq === 'string' ? kq : JSON.stringify(kq);
  if (t == null) return { dung: false, dinh_dang: false, truot: ['không có ket_qua'] };
  const truot = m.do.map((d) => ({ ...d, ...mayDo(d, t) })).filter((x) => !x.dat).map((x) => x.mo_ta);
  return { dung: !truot.length, dinh_dang: true, truot };
}

async function goi(model, vai, user, nk, luot) {
  const ns = { id: 'ung-vien', ten: 'Ứng viên', model, vai: theVai(VAI[vai]), body: HO_SO, tinh_cach: [], bai_hoc: [] };
  const body = { model, max_tokens: 500, temperature: 0.3, system: heThong(ns, nk), messages: [{ role: 'user', content: user }] };   // như goi() của lượt thật
  for (let thu = 0; ; thu++) {
    const t0 = Date.now(); let st = 0, d = {};
    try { const r = await fetch(`${PROXY()}/v1/messages`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-cty-staff': 'ha', 'x-cty-luot': luot }, body: JSON.stringify(body) }); st = r.status; d = await r.json().catch(() => ({})); } catch (e) { d = { error: String(e.message || e) }; }
    const loi = st === 200 ? null : typeof d.error === 'string' ? d.error : d.error?.message ?? JSON.stringify(d).slice(0, 300);
    const tranChan = st === 429 && /trần/.test(loi ?? '');
    if (!tranChan && (st === 0 || st === 429 || st >= 500) && thu < 3) { await new Promise((ok) => setTimeout(ok, 2000 * 2 ** thu)); continue; }   // mạng / nhà quá tải: thử lại
    return { http: st, ms: Date.now() - t0, usage: d.usage ?? null, het: d.stop_reason ?? null, loi, tran_chan: tranChan,
      dap: st === 200 ? (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('') : '' };
  }
}

const docDong = (tep) => (fs.existsSync(tep) ? fs.readFileSync(tep, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const xongRoi = (x) => x.http === 200 || (x.http >= 400 && x.http < 500 && x.http !== 429);   // 4xx (vd tên model sai) chạy lại cũng thế

export async function chay({ dot, tran, lan = 3, lanKiem = 2, models = MODELS, songSong = 24, im = false }) {
  if (!dot || !(tran > 0)) throw new Error('cần --dot và --tran <USD>');
  const dir = path.join(DATA(), 'do-model', dot); fs.mkdirSync(dir, { recursive: true });
  const tep = path.join(dir, 'goi.jsonl'); const cu = docDong(tep);
  const xong = new Set(cu.filter(xongRoi).map((x) => x.khoa));
  let chi = cu.reduce((s, x) => s + (x.usd || 0), 0);
  const qt = hienHanh(K); const nk = { ten_phong: tenPhong(K), quy_dinh: quyDinhLuot(K) }; const bo = boDo(); const hang = [];
  for (let l = 1; l <= lan; l++) for (const vai of ['kiem', 'giao', 'lam']) if (l <= (vai === 'kiem' ? lanKiem : lan))
    for (const m of bo[vai]) for (const model of models) { const khoa = `${vai}|${m.id}|${l}|${model}`; if (!xong.has(khoa)) hang.push({ vai, m, lan: l, model, khoa }); }
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ dot, tran, lan, lan_kiem: lanKiem, models, quy_trinh: `${K} v${qt.ban}`, lan_chay: [...(docJson(path.join(dir, 'meta.json'))?.lan_chay ?? []), { ts: new Date().toISOString(), con_lai: hang.length, da_chi: chi }] }, null, 1));
  if (!im) console.log(`dò model ${dot}: ${hang.length} lời gọi còn lại · đã chi $${chi.toFixed(4)} · trần $${tran} · quy trình v${qt.ban}`);
  let dung = null, i = 0, n = 0;
  const tho = async () => {
    while (!dung && i < hang.length) {
      if (chi >= tran - 0.05) { dung = `chạm trần $${tran}`; break; }   // chừa biên cho các lời gọi đang bay
      const h = hang[i++]; const user = loiNhac(h.vai, h.m, qt);
      const r = await goi(h.model, h.vai, user, nk, `do-model-${dot}`);
      if (r.tran_chan) dung = `proxy chặn trần: ${r.loi}`;
      const usd = r.usage ? r.usage.cost_usd ?? tienUsd(h.model, r.usage) ?? 0 : 0; chi += usd;
      const diem = r.http === 200 ? cham(h.vai, h.m, r.dap) : {};
      fs.appendFileSync(tep, JSON.stringify({ ts: new Date().toISOString(), khoa: h.khoa, vai: h.vai, muc: h.m.id, loai: h.m.loai, loi_cai: h.m.loi ?? null, ky_vong: h.m.ky_vong ?? null,
        lan: h.lan, model: h.model, quy_trinh: qt.ban, http: r.http, ms: r.ms, usage: r.usage, usd, het: r.het, loi: r.loi, hoi: user, dap: r.dap, ...diem }) + '\n');
      if (++n % 250 === 0 && !im) console.log(`  ${n}/${hang.length} · chi $${chi.toFixed(3)}`);
    }
  };
  await Promise.all(Array.from({ length: songSong }, tho));
  if (!im) console.log(`${dung ? `DỪNG (${dung})` : 'xong'} · ${n} lời gọi lượt này · tổng chi $${chi.toFixed(4)}`);
  return { dung, n, chi, con: hang.length - n };
}
function docJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } }

// ---- tổng hợp (0 đồng) ----
const wilson = (k, n) => { if (!n) return [0, 0]; const z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d; return [Math.max(0, c - h), Math.min(1, c + h)]; };
function thongKe(xs) {
  const ok = xs.filter((x) => x.http === 200); const n = ok.length, k = ok.filter((x) => x.dung).length;
  const usd = xs.reduce((s, x) => s + (x.usd || 0), 0); const ms = ok.map((x) => x.ms).sort((a, b) => a - b);
  return { n, dung: k, ti_le: n ? k / n : 0, kt95: wilson(k, n), usd, usd_goi: n ? usd / n : 0, usd_moi_dat: k ? usd / k : null, ms_giua: ms[Math.floor(ms.length / 2)] ?? null,
    hong_ky_thuat: xs.length - n, hong_dinh_dang: ok.filter((x) => x.dinh_dang === false).length, cat_cut: ok.filter((x) => x.het === 'max_tokens').length };
}
const gom = (ds, f) => { const m = {}; for (const x of ds) (m[f(x)] ??= []).push(x); return m; };
/** Đường biên chi phí–chất lượng: xếp theo giá mỗi lời gọi, giữ model nào đúng hơn mọi model rẻ hơn nó. */
const duongBien = (tk) => { let max = -1; return Object.entries(tk).sort((a, b) => a[1].usd_goi - b[1].usd_goi).filter(([, s]) => (s.n && s.ti_le > max ? ((max = s.ti_le), true) : false)).map(([m]) => m); };
/** Chọn: nhóm dẫn đầu (kém người giỏi nhất ≤ NGUONG) → rẻ nhất trong nhóm. */
const chon = (tk) => { const ds = Object.entries(tk).filter(([, s]) => s.n); if (!ds.length) return null; const best = Math.max(...ds.map(([, s]) => s.ti_le));
  const nhom = ds.filter(([, s]) => s.ti_le >= best - NGUONG).sort((a, b) => a[1].usd_goi - b[1].usd_goi); return { model: nhom[0][0], ti_le: nhom[0][1].ti_le, usd_goi: nhom[0][1].usd_goi, gioi_nhat: best, nhom_dan_dau: nhom.map(([m]) => m) }; };

export function tong(dot) {
  const dir = path.join(DATA(), 'do-model', dot); const tat = docDong(path.join(dir, 'goi.jsonl'));
  const cuoi = new Map(); for (const x of tat) cuoi.set(x.khoa, { ...x, usd: (cuoi.get(x.khoa)?.usd ?? 0) + (x.usd || 0) });   // lời gọi chạy lại: lấy kết quả cuối, cộng đủ tiền
  const ds = [...cuoi.values()]; const kq = { dot, ts: new Date().toISOString(), so_goi: tat.length, tong_chi: tat.reduce((s, x) => s + (x.usd || 0), 0), theo_vai: {}, theo_loai: {}, duong_bien: {}, de_xuat: {} };
  for (const [vai, dsVai] of Object.entries(gom(ds, (x) => x.vai))) {
    const tk = {};
    for (const [model, xs] of Object.entries(gom(dsVai, (x) => x.model))) {
      const s = thongKe(xs); const ok = xs.filter((x) => x.http === 200);
      if (vai === 'kiem') {
        s.bac_sai = ok.filter((x) => x.bac_sai).length; s.duyet_sai = ok.filter((x) => x.duyet_sai).length;
        s.bat_loi = Object.fromEntries(Object.entries(gom(ok.filter((x) => x.loi_cai), (x) => x.loi_cai)).map(([l, ys]) => [l, ys.filter((y) => y.ok === false).length / ys.length]));
        const cap = Object.values(gom(ok, (x) => x.muc)).filter((ys) => ys.length > 1); s.on_dinh = cap.length ? cap.filter((ys) => ys.every((y) => y.ok === ys[0].ok)).length / cap.length : null;
      }
      if (vai === 'giao') { s.hoi_thua = ok.filter((x) => x.hoi_thua).length; s.giao_bua = ok.filter((x) => x.giao_bua).length; s.mat_rang_buoc = ok.filter((x) => x.mat?.length).length; }
      tk[model] = s;
    }
    kq.theo_vai[vai] = tk; kq.duong_bien[vai] = duongBien(tk); kq.de_xuat[vai] = chon(tk);
    kq.theo_loai[vai] = Object.fromEntries(Object.entries(gom(dsVai, (x) => x.loai)).map(([loai, xs]) => { const t = Object.fromEntries(Object.entries(gom(xs, (x) => x.model)).map(([m, ys]) => [m, thongKe(ys)])); return [loai, { ...t, _chon: chon(t) }]; }));
  }
  fs.writeFileSync(path.join(dir, 'ket.json'), JSON.stringify(kq, null, 1));
  return kq;
}
const pc = (x) => `${Math.round(x * 100)}%`;
function inBang(kq) {
  console.log(`dò model ${kq.dot}: ${kq.so_goi} lời gọi · chi $${kq.tong_chi.toFixed(4)}`);
  for (const [vai, tk] of Object.entries(kq.theo_vai)) {
    console.log(`\n== ${vai} (${VAI[vai]}) · chọn: ${kq.de_xuat[vai]?.model} · đường biên: ${kq.duong_bien[vai].join(' → ')}`);
    for (const [m, s] of Object.entries(tk).sort((a, b) => b[1].ti_le - a[1].ti_le)) {
      const them = vai === 'kiem' ? `bác sai ${s.bac_sai} · duyệt sai ${s.duyet_sai} · ổn định ${s.on_dinh == null ? '—' : pc(s.on_dinh)}` : vai === 'giao' ? `hỏi thừa ${s.hoi_thua} · giao bừa ${s.giao_bua} · mất ràng buộc ${s.mat_rang_buoc}` : '';
      console.log(`  ${m.padEnd(34)} ${pc(s.ti_le).padStart(4)} [${pc(s.kt95[0])}–${pc(s.kt95[1])}] n=${s.n} · $${(s.usd_goi * 1000).toFixed(3)}/1000 lời gọi · ${s.ms_giua}ms · hỏng mạng/định dạng/cắt cụt ${s.hong_ky_thuat}/${s.hong_dinh_dang}/${s.cat_cut} · ${them}`);
    }
    for (const [loai, t] of Object.entries(kq.theo_loai[vai])) console.log(`    ${loai.padEnd(14)} chọn ${t._chon?.model} (${pc(t._chon?.ti_le ?? 0)}; giỏi nhất ${pc(t._chon?.gioi_nhat ?? 0)})`);
  }
}

// ---------- CLI ----------
const laCli = (process.argv[1] || '').endsWith('do-model.mjs');
const thamSo = (k, mac) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : mac);
if (laCli && process.argv.includes('--chay')) {
  const r = await chay({ dot: thamSo('--dot'), tran: Number(thamSo('--tran')), lan: Number(thamSo('--lan', 3)), lanKiem: Number(thamSo('--lan-kiem', 2)),
    models: thamSo('--models') ? thamSo('--models').split(',') : MODELS, songSong: Number(thamSo('--song-song', 24)) });
  inBang(tong(thamSo('--dot'))); process.exit(r.dung && !/trần/.test(r.dung) ? 1 : 0);
}
if (laCli && process.argv.includes('--tong')) { inBang(tong(thamSo('--tong'))); process.exit(0); }

if (laCli && process.argv.includes('--tu-kiem')) {
  process.env.CTY_DATA_DIR = fs.mkdtempSync('/tmp/cty-dm-');
  const a = (c, m, x) => { if (!c) { console.error('✗ do-model:', m, JSON.stringify(x ?? '').slice(0, 400)); process.exit(1); } };
  const bo = boDo();
  // 1. bộ đo: đủ cỡ, và NHÃN của mọi bài kiểm khớp phép đo máy (bài sạch qua hết, bài cài lỗi trượt ít nhất một)
  a(bo.kiem.length === 60 && bo.kiem.filter((x) => !x.loi).length === 30 && bo.lam.length === 48 && bo.giao.length === 64 && bo.giao.filter((x) => x.ky_vong === 'ket').length === 16, 'cỡ bộ đo 60 / 48 / 64');
  const theoLoi = gom(bo.kiem.filter((x) => x.loi), (x) => x.loi); a(Object.keys(theoLoi).length === 6 && Object.values(theoLoi).every((v) => v.length === 5), '6 loại lỗi × 5', Object.fromEntries(Object.entries(theoLoi).map(([k, v]) => [k, v.length])));
  const lech = bo.kiem.filter((x) => x.do.every((d) => mayDo(d, x.ket_qua).dat) !== (x.loi == null));
  a(!lech.length, 'nhãn bài kiểm khớp phép đo máy', lech.map((x) => [x.id, x.loi, x.do.map((d) => mayDo(d, x.ket_qua).mo_ta)]));
  const mau = bo.lam.filter((x) => x.mau); a(mau.length === 16 && mau.every((x) => cham('lam', x, JSON.stringify({ ket_qua: x.mau, bang_chung: '' })).dung), 'đáp án mẫu (trích JSON, phân loại) qua phép đo');
  // 2. chấm — có thể trượt
  const sach = bo.kiem.find((x) => !x.loi), loi = bo.kiem.find((x) => x.loi);
  a(cham('kiem', sach, '{"ok":true}').dung && cham('kiem', sach, '{"ok":false}').bac_sai && cham('kiem', loi, '```json\n{"ok":true}\n```').duyet_sai && !cham('kiem', sach, 'đạt').dinh_dang, 'chấm kiểm: đúng / bác sai / duyệt sai / hỏng định dạng');
  const g = bo.giao.find((x) => x.id === 'copy_en-1'), gk = bo.giao.find((x) => x.ky_vong === 'ket');
  a(cham('giao', g, '{"viec":"Etsy title, English","tieu_chi":["max 60 characters","include \\"large print\\""]}').dung, 'giao đủ ràng buộc');
  a(cham('giao', g, '{"viec":"Etsy title, English","tieu_chi":["max 160 characters","include large print"]}').mat.join() === '60', '"160" không giữ được "60"');
  a(cham('giao', gk, '{"thieu":"Nó là gì?"}').dung && cham('giao', gk, '{"viec":"x","tieu_chi":[]}').giao_bua && cham('giao', g, '{"thieu":"?"}').hoi_thua, 'việc kẹt phải hỏi; việc rõ mà hỏi = hỏi thừa');
  const l = bo.lam.find((x) => x.id === 'copy_en-1');
  a(cham('lam', l, '{"ket_qua":"Large Print Word Search for Seniors","bang_chung":"x"}').dung && cham('lam', l, '{"ket_qua":"Big Word Search for Seniors"}').truot.length === 1 && !cham('lam', l, 'không JSON').dinh_dang, 'chấm làm theo phép đo máy');
  // 3. chạy giả qua proxy giả: trần chặn giữa chừng, chạy tiếp không gọi lại phần đã xong, tổng hợp ra đề xuất
  let goiN = 0; const fake = http.createServer(async (req, res) => { let raw = ''; for await (const c of req) raw += c; const b = JSON.parse(raw); goiN++;
    const t = /Người kiểm/.test(b.system) ? '{"ok":true}' : /Trưởng phòng/.test(b.system) ? '{"giao_cho":"nguoi-lam","viec":"v","tieu_chi":["t"]}' : b.model.includes('nano') ? 'hỏng' : '{"ket_qua":"giao_hang"}';
    res.end(JSON.stringify({ content: [{ type: 'text', text: t }], usage: { input_tokens: 100, output_tokens: 10 }, stop_reason: 'end_turn' })); }).listen(0, '127.0.0.1');
  await new Promise((r) => fake.once('listening', r)); process.env.CTY_PROXY_URL = `http://127.0.0.1:${fake.address().port}`;
  const M2 = ['openai:gpt-4o-mini', 'openai:gpt-4.1-nano']; const tong1 = (60 + 64 + 48) * 2;
  const r1 = await chay({ dot: 'thu', tran: 0.051, lan: 1, lanKiem: 1, models: M2, songSong: 1, im: true });
  a(r1.dung && r1.n > 0 && r1.n < tong1, 'trần chặn giữa chừng', r1);
  const r2 = await chay({ dot: 'thu', tran: 1, lan: 1, lanKiem: 1, models: M2, songSong: 4, im: true });
  a(!r2.dung && goiN === tong1 && r1.n + r2.n === tong1, `chạy tiếp: đủ ${tong1} lời gọi, không gọi lại phần đã xong`, { goiN, r1: r1.n, r2: r2.n });
  const kq = tong('thu');
  a(kq.theo_vai.kiem['openai:gpt-4o-mini'].ti_le === 0.5 && kq.theo_vai.kiem['openai:gpt-4o-mini'].duyet_sai === 30 && kq.theo_vai.lam['openai:gpt-4.1-nano'].hong_dinh_dang === 48, 'tổng hợp: duyệt-hết = 50% kiểm, 30 duyệt sai; trả lời hỏng = hỏng định dạng', kq.theo_vai.kiem);
  a(kq.theo_loai.lam.phan_loai['openai:gpt-4o-mini'].ti_le > 0 && kq.de_xuat.lam.nhom_dan_dau.includes('openai:gpt-4o-mini') && kq.duong_bien.lam.at(-1) === 'openai:gpt-4o-mini' && fs.existsSync(path.join(process.env.CTY_DATA_DIR, 'do-model', 'thu', 'ket.json')), 'đề xuất + ket.json', kq.de_xuat);
  fake.close(); console.log(`✓ do-model: bộ đo 60/48/64 nhãn khớp máy · chấm 3 vai trượt được · trần chặn · chạy tiếp không trả tiền hai lần · tổng hợp`); process.exit(0);
}
