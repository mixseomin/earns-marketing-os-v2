#!/usr/bin/env node
// DÒ MODEL (kế hoạch 11/10/2026, anh duyệt tới mức 2 ~ $8). Đo MODEL, chưa đo người: hồ sơ trung tính, chưa tính cách, chưa bài học,
// đúng lời nhắc của quy trình đang chạy (thu-nghiem/lam-viec hiện hành), trên bộ đo Hà giữ (cong-ty/bo-viec-chuan/do-model.json).
// Đáp án máy biết trước, không dùng model chấm model:
//   kiem  60 bài nộp cố định (30 sạch, 30 cài đúng 1 lỗi × 6 loại) → chấm đúng? bác sai? duyệt sai? bắt được loại lỗi nào?
//   lam   6 loại việc × 8, tiêu chí chuẩn đưa sẵn → phép đo máy (quy-trinh.mjs mayDo) trên ket_qua
//   giao  48 việc làm được (brief phải giữ đủ ràng buộc) + 16 việc thiếu dữ kiện / mâu thuẫn (phải trả {"thieu"}, không giao)
// Cấu hình đo (chạy thử 11/10: 9/11 model qua fal trả RỖNG vì suy luận ngầm ăn hết trần 500 token): model qua fal gửi reasoning
// {effort:'none'}; trần 1000 token và đếm số câu vượt 500 (= lượt thật đang để 500 sẽ cắt cụt, phải nâng nếu dùng model đó).
// Model bắt buộc suy luận (400 "Reasoning is mandatory": glm-5.3-flash, gemini-3.8-flash, sonnet-5.5, grok-4.7 lúc thử) → tự lùi về
// effort 'minimal', trần TRAN_SUY_LUAN (suy luận tính chung vào trần); dòng nhật ký ghi suy_luan để so cho đúng.
// fal giới hạn 10 lời gọi đồng thời mỗi tài khoản → tối đa FAL_SONG_SONG lời gọi fal bay cùng lúc.
// Mọi lời gọi qua proxy (giá fail-closed, sổ ai_usage dưới tên Hà, người giữ bộ đo). MỌI lời gọi đã trả tiền ghi nguyên văn vào
// <DATA>/do-model/<dot>/goi.jsonl (hỏi, đáp, token, USD, ms, điểm) để làm insight về sau. Chạy lại cùng --dot = chạy tiếp phần còn
// thiếu, không trả tiền lần hai.
//   node worker/do-model.mjs --chay --dot <tên> --tran <USD> [--lan 3] [--lan-kiem 2] [--models a,b] [--song-song 24] [--moi-vai N: chạy thử N việc đầu mỗi vai]
//   ... --tinh-cach can_than=9[,mem_mong=2]     cùng hồ sơ trung tính + chỉ số tính cách (đo tính cách có đổi hành vi không)
//   node worker/do-model.mjs --tong <dot>     tổng hợp → ket.json + in bảng (0 đồng)
//   node worker/do-model.mjs --so <dot> --voi <dot gốc>   so THEO CẶP (cùng bài, cùng lần, cùng model): chênh điểm + McNemar (0 đồng)
//   node worker/do-model.mjs --tu-kiem        bộ đo tự kiểm + chạy giả qua proxy giả ($0)
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { GOC } from './goc.mjs';
import { hienHanh, dien, json, mayDo, theVai, tenPhong } from './quy-trinh.mjs';
import { heThong, LOI_HOI_LAI, quyDinhLuot } from './ca.mjs';
import { tienUsd } from './gia.mjs';
import { tinhCachCua } from './tinh-cach.mjs';

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
const TRAN_TOKEN = 1000, TRAN_SUY_LUAN = 2000, TRAN_THAT = 500, FAL_SONG_SONG = 8;
const BAT_BUOC = new Set();   // model fal không tắt được suy luận (học trong lượt chạy)
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

export async function goi(model, vai, user, nk, luot, tc = [], heThongRieng = null) {   // heThongRieng: giám khảo (do-van.mjs) không mang thẻ vai
  const ns = { id: 'ung-vien', ten: 'Ứng viên', model, vai: theVai(VAI[vai]), body: HO_SO, tinh_cach: tc, bai_hoc: [] };
  const fal = model.startsWith('fal:');
  for (let thu = 0; ; thu++) {
    const bb = BAT_BUOC.has(model); const suy_luan = fal ? (bb ? 'minimal' : 'none') : null;
    const body = { model, max_tokens: bb ? TRAN_SUY_LUAN : TRAN_TOKEN, temperature: 0.3, system: heThongRieng ?? heThong(ns, nk), messages: [{ role: 'user', content: user }], ...(fal ? { reasoning: { effort: suy_luan } } : {}) };   // như goi() của lượt thật, trừ trần token + suy luận
    const t0 = Date.now(); let st = 0, d = {};
    try { const r = await fetch(`${PROXY()}/v1/messages`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-cty-staff': 'ha', 'x-cty-luot': luot }, body: JSON.stringify(body) }); st = r.status; d = await r.json().catch(() => ({})); } catch (e) { d = { error: String(e.message || e) }; }
    const loi = st === 200 ? null : typeof d.error === 'string' ? d.error : d.error?.message ?? JSON.stringify(d).slice(0, 300);
    if (st === 400 && fal && !bb && /reasoning is mandatory/i.test(loi ?? '')) { BAT_BUOC.add(model); thu--; continue; }   // 400 không tính tiền
    const tranChan = st === 429 && /trần/.test(loi ?? '');
    if (!tranChan && (st === 0 || st === 429 || st >= 500) && thu < 3) { await new Promise((ok) => setTimeout(ok, 2000 * 2 ** thu)); continue; }   // mạng / nhà quá tải: thử lại
    return { http: st, ms: Date.now() - t0, usage: d.usage ?? null, het: d.stop_reason ?? null, loi, tran_chan: tranChan, suy_luan,
      dap: st === 200 ? (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('') : '' };
  }
}

const docDong = (tep) => (fs.existsSync(tep) ? fs.readFileSync(tep, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const xongRoi = (x) => x.http === 200 || (x.http >= 400 && x.http < 500 && x.http !== 429);   // 4xx (vd tên model sai) chạy lại cũng thế

export async function chay({ dot, tran, lan = 3, lanKiem = 2, models = MODELS, songSong = 24, moiVai = Infinity, tinhCach = null, im = false }) {
  const tc = tinhCach ? tinhCachCua({}, tinhCach) : [];
  if (!dot || !(tran > 0)) throw new Error('cần --dot và --tran <USD>');
  const dir = path.join(DATA(), 'do-model', dot); fs.mkdirSync(dir, { recursive: true });
  const tep = path.join(dir, 'goi.jsonl'); const cu = docDong(tep);
  const xong = new Set(cu.filter(xongRoi).map((x) => x.khoa));
  let chi = cu.reduce((s, x) => s + (x.usd || 0), 0);
  const qt = hienHanh(K); const nk = { ten_phong: tenPhong(K), quy_dinh: quyDinhLuot(K) }; const bo = boDo(); const hang = [];
  for (let l = 1; l <= lan; l++) for (const vai of ['kiem', 'giao', 'lam']) if (l <= (vai === 'kiem' ? lanKiem : lan))
    for (const m of bo[vai].slice(0, moiVai)) for (const model of models) { const khoa = `${vai}|${m.id}|${l}|${model}`; if (!xong.has(khoa)) hang.push({ vai, m, lan: l, model, khoa }); }
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ dot, tran, lan, lan_kiem: lanKiem, models, tinh_cach: tinhCach, quy_trinh: `${K} v${qt.ban}`, lan_chay: [...(docJson(path.join(dir, 'meta.json'))?.lan_chay ?? []), { ts: new Date().toISOString(), con_lai: hang.length, da_chi: chi }] }, null, 1));
  if (!im) console.log(`dò model ${dot}: ${hang.length} lời gọi còn lại · đã chi $${chi.toFixed(4)} · trần $${tran} · quy trình v${qt.ban}`);
  let dung = null, i = 0, n = 0, falBay = 0; const cho = [];
  const vaoFal = () => (falBay < FAL_SONG_SONG ? (falBay++, Promise.resolve()) : new Promise((ok) => cho.push(ok)));
  const raFal = () => { const k = cho.shift(); if (k) k(); else falBay--; };
  const tho = async () => {
    while (!dung && i < hang.length) {
      if (chi >= tran - 0.05) { dung = `chạm trần $${tran}`; break; }   // chừa biên cho các lời gọi đang bay
      const h = hang[i++]; const user = loiNhac(h.vai, h.m, qt);
      const fal = h.model.startsWith('fal:'); if (fal) await vaoFal();
      const r = await goi(h.model, h.vai, user, nk, `do-model-${dot}`, tc).finally(() => fal && raFal());
      if (r.tran_chan) dung = `proxy chặn trần: ${r.loi}`;
      const usd = r.usage ? r.usage.cost_usd ?? tienUsd(h.model, r.usage) ?? 0 : 0; chi += usd;
      const diem = r.http === 200 ? { ...cham(h.vai, h.m, r.dap), vuot_500: (r.usage?.output_tokens ?? 0) - (r.usage?.reasoning_tokens ?? 0) > TRAN_THAT } : {};
      fs.appendFileSync(tep, JSON.stringify({ ts: new Date().toISOString(), khoa: h.khoa, vai: h.vai, muc: h.m.id, loai: h.m.loai, loi_cai: h.m.loi ?? null, ky_vong: h.m.ky_vong ?? null,
        lan: h.lan, model: h.model, ...(tinhCach ? { tinh_cach: tinhCach } : {}), suy_luan: r.suy_luan, quy_trinh: qt.ban, http: r.http, ms: r.ms, usage: r.usage, usd, het: r.het, loi: r.loi, hoi: user, dap: r.dap, ...diem }) + '\n');
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
    hong_ky_thuat: xs.length - n, hong_dinh_dang: ok.filter((x) => x.dinh_dang === false).length, cat_cut: ok.filter((x) => x.het === 'max_tokens').length,
    vuot_500: ok.filter((x) => x.vuot_500).length, token_ra_tb: n ? Math.round(ok.reduce((s, x) => s + (x.usage?.output_tokens ?? 0), 0) / n) : 0 };
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
      console.log(`  ${m.padEnd(34)} ${pc(s.ti_le).padStart(4)} [${pc(s.kt95[0])}–${pc(s.kt95[1])}] n=${s.n} · $${(s.usd_goi * 1000).toFixed(3)}/1000 lời gọi · ${s.ms_giua}ms · hỏng mạng/định dạng/cắt cụt ${s.hong_ky_thuat}/${s.hong_dinh_dang}/${s.cat_cut} · vượt 500 token ${s.vuot_500} · ${them}`);
    }
    for (const [loai, t] of Object.entries(kq.theo_loai[vai])) console.log(`    ${loai.padEnd(14)} chọn ${t._chon?.model} (${pc(t._chon?.ti_le ?? 0)}; giỏi nhất ${pc(t._chon?.gioi_nhat ?? 0)})`);
  }
}

// ---- so theo cặp (0 đồng): cùng khoá (vai|bài|lần|model) ở hai đợt → chỉ khác thứ đổi giữa hai đợt (vd tính cách) ----
const lnF = (n) => { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; };
/** McNemar chính xác, hai phía: b = chỉ A đúng, c = chỉ B đúng. p nhỏ = chênh thật, không phải may rủi. */
export const mcnemar = (b, c) => { const n = b + c; if (!n) return 1; let s = 0; for (let i = 0; i <= Math.min(b, c); i++) s += Math.exp(lnF(n) - lnF(i) - lnF(n - i) - n * Math.LN2); return Math.min(1, 2 * s); };
const DEM = { kiem: ['bac_sai', 'duyet_sai'], giao: ['hoi_thua', 'giao_bua', 'mat'], lam: ['truot'] };
const coLoi = (x, f) => (Array.isArray(x[f]) ? x[f].length > 0 : !!x[f]);
export function soCap(dotA, dotB) {
  const doc = (d) => new Map(docDong(path.join(DATA(), 'do-model', d, 'goi.jsonl')).filter((x) => x.http === 200).map((x) => [x.khoa, x]));
  const A = doc(dotA), B = doc(dotB); const nhom = {};
  for (const [k, a] of A) {
    const b = B.get(k); if (!b) continue;
    const g = (nhom[`${a.model}|${a.vai}`] ??= { model: a.model, vai: a.vai, n: 0, a_dung: 0, b_dung: 0, chi_a: 0, chi_b: 0, tok_a: 0, tok_b: 0, usd_a: 0, usd_b: 0, dem: {} });
    g.n++; g.a_dung += a.dung ? 1 : 0; g.b_dung += b.dung ? 1 : 0; g.chi_a += a.dung && !b.dung ? 1 : 0; g.chi_b += b.dung && !a.dung ? 1 : 0;
    g.tok_a += a.usage?.output_tokens ?? 0; g.tok_b += b.usage?.output_tokens ?? 0; g.usd_a += a.usd || 0; g.usd_b += b.usd || 0;
    for (const f of DEM[a.vai] ?? []) { const d = (g.dem[f] ??= [0, 0]); d[0] += coLoi(a, f) ? 1 : 0; d[1] += coLoi(b, f) ? 1 : 0; }
  }
  return Object.values(nhom).map((g) => ({ ...g, a: g.a_dung / g.n, b: g.b_dung / g.n, chenh: (g.a_dung - g.b_dung) / g.n, p: mcnemar(g.chi_a, g.chi_b) }));
}
/** Nhiễu nền: cùng đợt, lần 1 so lần 2 (chẳng đổi gì) — bao nhiêu câu tự lật đúng/sai. Chênh giữa hai đợt phải vượt mức này mới đáng tin. */
export function nhieuNen(dot) {
  const ds = docDong(path.join(DATA(), 'do-model', dot, 'goi.jsonl')).filter((x) => x.http === 200); const m = new Map(); const out = {};
  for (const x of ds) (m.get(`${x.model}|${x.vai}|${x.muc}`) ?? m.set(`${x.model}|${x.vai}|${x.muc}`, []).get(`${x.model}|${x.vai}|${x.muc}`)).push(x);
  for (const [k, xs] of m) { if (xs.length < 2) continue; const [model, vai] = k.split('|'); const o = (out[`${model}|${vai}`] ??= { n: 0, lat: 0 }); o.n++; o.lat += xs[0].dung !== xs[1].dung ? 1 : 0; }
  return out;
}

// ---------- CLI ----------
const laCli = (process.argv[1] || '').endsWith('do-model.mjs');
const thamSo = (k, mac) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : mac);
if (laCli && process.argv.includes('--chay')) {
  const r = await chay({ dot: thamSo('--dot'), tran: Number(thamSo('--tran')), lan: Number(thamSo('--lan', 3)), lanKiem: Number(thamSo('--lan-kiem', 2)),
    models: thamSo('--models') ? thamSo('--models').split(',') : MODELS, songSong: Number(thamSo('--song-song', 24)), moiVai: Number(thamSo('--moi-vai', Infinity)),
    tinhCach: thamSo('--tinh-cach') ? Object.fromEntries(thamSo('--tinh-cach').split(',').map((x) => x.split('=')).map(([k, v]) => [k, Number(v)])) : null });
  inBang(tong(thamSo('--dot'))); process.exit(r.dung && !/trần/.test(r.dung) ? 1 : 0);
}
if (laCli && process.argv.includes('--tong')) { inBang(tong(thamSo('--tong'))); process.exit(0); }
if (laCli && process.argv.includes('--so')) {
  const [A, B] = [thamSo('--so'), thamSo('--voi')]; const kq = soCap(A, B); const nen = nhieuNen(B);
  fs.writeFileSync(path.join(DATA(), 'do-model', A, `so-voi-${B}.json`), JSON.stringify({ a: A, b: B, ts: new Date().toISOString(), kq, nhieu_nen: nen }, null, 1));
  console.log(`${A} so với ${B} (theo cặp):`);
  for (const g of kq.sort((x, y) => (x.vai + x.model).localeCompare(y.vai + y.model))) {
    const nn = nen[`${g.model}|${g.vai}`];
    console.log(`  ${g.vai.padEnd(5)} ${g.model.split(':').pop().padEnd(28)} ${pc(g.b)}→${pc(g.a)} (${g.chenh >= 0 ? '+' : ''}${Math.round(g.chenh * 100)} điểm, p=${g.p.toFixed(3)}${g.p < 0.05 ? ' THẬT' : ''}) · n=${g.n} · ${Object.entries(g.dem).map(([f, [a, b]]) => `${f} ${b}→${a}`).join(' · ')} · token ra ${Math.round(g.tok_b / g.n)}→${Math.round(g.tok_a / g.n)} · nhiễu nền ${nn ? pc(nn.lat / nn.n) : '—'}`);
  }
  process.exit(0);
}

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
  const hieu = []; const fake2 = http.createServer(async (req, res) => { let raw = ''; for await (const c of req) raw += c; const b = JSON.parse(raw); hieu.push(b.reasoning?.effort);
    if (b.reasoning?.effort === 'none') { res.writeHead(400); return res.end(JSON.stringify({ error: { message: 'Reasoning is mandatory for this endpoint and cannot be disabled.' } })); }
    res.end(JSON.stringify({ content: [{ type: 'text', text: '{"ok":true}' }], usage: { input_tokens: 10, output_tokens: 700, reasoning_tokens: 600 }, stop_reason: 'end_turn' })); }).listen(0, '127.0.0.1');
  await new Promise((r) => fake2.once('listening', r)); const proxyCu = process.env.CTY_PROXY_URL; process.env.CTY_PROXY_URL = `http://127.0.0.1:${fake2.address().port}`;
  await chay({ dot: 'thu-bb', tran: 1, lan: 1, lanKiem: 1, models: ['fal:z-ai/glm-5.3-flash'], songSong: 2, moiVai: 2, im: true });
  const bb = docDong(path.join(process.env.CTY_DATA_DIR, 'do-model', 'thu-bb', 'goi.jsonl'));
  a(bb.length === 6 && bb.every((x) => x.http === 200 && x.suy_luan === 'minimal' && !x.vuot_500) && hieu.filter((e) => e === 'none').length <= 2, 'bắt buộc suy luận → tự lùi "minimal", không ghi dòng lỗi; token suy luận không tính vào "vượt 500"', { hieu, bb: bb.map((x) => [x.http, x.suy_luan]) });
  fake2.close(); process.env.CTY_PROXY_URL = proxyCu;
  // tính cách đi vào lời hệ thống; so theo cặp + McNemar
  const thay = []; const fake3 = http.createServer(async (req, res) => { let raw = ''; for await (const c of req) raw += c; const b = JSON.parse(raw); thay.push(b.system);
    res.end(JSON.stringify({ content: [{ type: 'text', text: '{"ok":false}' }], usage: { input_tokens: 10, output_tokens: 5 }, stop_reason: 'end_turn' })); }).listen(0, '127.0.0.1');
  await new Promise((r) => fake3.once('listening', r)); process.env.CTY_PROXY_URL = `http://127.0.0.1:${fake3.address().port}`;
  await chay({ dot: 'thu-tc', tran: 1, lan: 1, lanKiem: 1, models: ['openai:gpt-4o-mini'], songSong: 2, moiVai: 60, tinhCach: { mem_mong: 9 }, im: true });
  fake3.close(); process.env.CTY_PROXY_URL = proxyCu;
  a(thay.length && thay.every((s) => /TÍNH CÁCH GỐC[\s\S]*Mềm mỏng 9\/10/.test(s)) && !thay.some((s) => /Cẩn thận/.test(s)), 'tính cách vào lời hệ thống, chỉ đúng chỉ số đã đặt');
  const sc = soCap('thu-tc', 'thu').find((g) => g.vai === 'kiem');   // gốc duyệt hết (đúng 30 bài sạch), biến thể bác hết (đúng 30 bài lỗi)
  a(sc.n === 60 && sc.chi_a === 30 && sc.chi_b === 30 && sc.chenh === 0 && sc.p === 1 && sc.dem.bac_sai[0] === 30 && sc.dem.duyet_sai[1] === 30, 'so theo cặp: đếm lật hai chiều, bác sai / duyệt sai', sc);
  a(mcnemar(0, 10) < 0.005 && mcnemar(5, 5) === 1 && mcnemar(0, 0) === 1, 'McNemar: 0/10 là thật, 5/5 là nhiễu');
  const kq = tong('thu');
  a(kq.theo_vai.kiem['openai:gpt-4o-mini'].ti_le === 0.5 && kq.theo_vai.kiem['openai:gpt-4o-mini'].duyet_sai === 30 && kq.theo_vai.lam['openai:gpt-4.1-nano'].hong_dinh_dang === 48, 'tổng hợp: duyệt-hết = 50% kiểm, 30 duyệt sai; trả lời hỏng = hỏng định dạng', kq.theo_vai.kiem);
  a(kq.theo_loai.lam.phan_loai['openai:gpt-4o-mini'].ti_le > 0 && kq.de_xuat.lam.nhom_dan_dau.includes('openai:gpt-4o-mini') && kq.duong_bien.lam.at(-1) === 'openai:gpt-4o-mini' && fs.existsSync(path.join(process.env.CTY_DATA_DIR, 'do-model', 'thu', 'ket.json')), 'đề xuất + ket.json', kq.de_xuat);
  fake.close(); console.log(`✓ do-model: bộ đo 60/48/64 nhãn khớp máy · chấm 3 vai trượt được · trần chặn · chạy tiếp không trả tiền hai lần · tổng hợp`); process.exit(0);
}
