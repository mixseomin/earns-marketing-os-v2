#!/usr/bin/env node
// Một LƯỢT vận hành của Phòng thử (cong-ty/phong/thu-nghiem.md): việc → Tâm giao + tiêu chí → Lộc làm → Kỳ soát (trả về tối đa 1 lần)
// → Tâm viết báo cáo sáng theo AGENTS.md §7. Mọi lượt gọi đi qua proxy (x-cty-staff) nên trần chi + ai_usage áp tự động.
// Nhật ký ghi ${CTY_DATA_DIR:-/var/lib/cty}/nhat-ky/<ts>.json, trang /phong/thu-nghiem đọc lên. Không tự chạy: chỉ khi được gọi
// (nút "Chạy một lượt" hoặc `node worker/ca.mjs --viec "…"`). `--tu-kiem` = proxy giả, $0.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { parseFm } from '../scripts/fm.mjs';
import { ghiLog } from './log.mjs';

const DIR = path.dirname(new URL(import.meta.url).pathname);
const CONG_TY = path.join(DIR, '..', 'cong-ty');
const DATA = process.env.CTY_DATA_DIR || '/var/lib/cty';
const PROXY = () => process.env.CTY_PROXY_URL || 'http://127.0.0.1:3862';   // đọc lúc gọi: tự kiểm đổi env sau khi nạp module
const PHONG = 'thu-nghiem';

const doc = (rel) => parseFm(fs.readFileSync(path.join(CONG_TY, rel), 'utf8'));
const luat = fs.readFileSync(path.join(CONG_TY, 'AGENTS.md'), 'utf8');
const nhanSu = (id, luot) => { const rel = `nhan-su/${id}/SOUL.md`; const d = doc(rel); ghiLog({ luot, loai: 'doc', tu: id, chi_tiet: { tep: rel, ky_tu: d.body.length, ly_do: 'nạp hồ sơ trước ca' } }); return { id, ...d.fm, body: d.body }; };

async function goi(ns, user, buoc, nk, toi) {
  ghiLog({ luot: nk.ts, loai: 'tin', tu: toi?.tu ?? 'giam-doc', toi: ns.id, chi_tiet: { buoc, noi_dung: user.slice(0, 240) } });
  const body = { model: ns.model, max_tokens: 500, temperature: 0.3,
    system: `Bạn là ${ns.ten}, ${ns.chuc_danh}, Phòng thử của công ty. LUẬT CHUNG (rút gọn): ba mức quyết định; việc nộp phải có bằng chứng; không khen mở đầu; trả lời đúng định dạng được yêu cầu, không thêm lời dẫn.\n\nHỒ SƠ CỦA BẠN:\n${ns.body}`,
    messages: [{ role: 'user', content: user }] };
  const t0 = Date.now();
  const r = await fetch(`${PROXY()}/v1/messages`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-cty-staff': ns.id, 'x-cty-luot': nk.ts }, body: JSON.stringify(body) });
  const d = await r.json();
  const text = r.ok ? (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('') : '';
  nk.buoc.push({ buoc, ai: ns.ten, id: ns.id, model: ns.model, ms: Date.now() - t0, http: r.status, usage: d.usage || null, loi: r.ok ? null : d.error || JSON.stringify(d).slice(0, 200), hoi: user, dap: text });
  if (!r.ok) throw new Error(`${ns.ten}: ${r.status} ${d.error || ''}`);
  ghiLog({ luot: nk.ts, loai: 'tin', tu: ns.id, toi: toi?.tu ?? 'giam-doc', chi_tiet: { buoc, tra_loi: text.slice(0, 240) } });
  return text;
}
const json = (t) => { const m = t.match(/\{[\s\S]*\}/); try { return JSON.parse(m ? m[0] : t); } catch { return null; } };

export async function motLuot(viec, ghi = true) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  ghiLog({ luot: ts, loai: 'he-thong', tu: 'giam-doc', chi_tiet: { su_kien: 'bắt đầu lượt', viec } });
  const tam = nhanSu('tam', ts), loc = nhanSu('loc', ts), ky = nhanSu('ky', ts);
  const nk = { ts, viec, trang_thai: 'đang chạy', buoc: [], ket: null };
  const f = path.join(DATA, 'nhat-ky', `${ts}.json`);
  const luu = () => { if (ghi) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(nk, null, 2)); } };
  luu();
  try {
    const giao = json(await goi(tam, `Việc Giám đốc giao cho phòng: "${viec}". Chia thành MỘT việc cụ thể cho Lộc kèm 2–4 tiêu chí đo được. BẮT BUỘC: giữ nguyên mọi ràng buộc trong câu gốc (ngôn ngữ, số câu, cấm từ) thành tiêu chí; việc gốc tiếng Anh thì "viec" viết tiếng Anh. Trả lời JSON: {"giao_cho":"loc","viec":"…","tieu_chi":["…"]}`, '1 giao việc', nk, { tu: 'giam-doc' }));
    if (!giao?.viec) throw new Error('Tâm không trả JSON giao việc');
    const tieuChi = (giao.tieu_chi || []).map((t, i) => `${i + 1}. ${t}`).join('\n');
    let lam = json(await goi(loc, `Việc: ${giao.viec}\nTiêu chí:\n${tieuChi}\nLàm đúng ngôn ngữ tiêu chí yêu cầu. Trả lời JSON: {"ket_qua":"…","bang_chung":"…"}`, '2 làm', nk, { tu: 'tam' }));
    if (!lam?.ket_qua) throw new Error('Lộc không trả JSON kết quả');
    let soat = json(await goi(ky, `Tiêu chí:\n${tieuChi}\nKết quả Lộc nộp:\n${lam.ket_qua}\nBằng chứng Lộc khai: ${lam.bang_chung}\nSoát từng tiêu chí. Tiêu chí đếm được (số câu, số từ): liệt kê từng câu/từ rồi đếm, ghi số đếm vào ly_do. Trả lời JSON: {"ok":true|false,"ly_do":"…"}`, '3 soát', nk, { tu: 'loc' }));
    if (soat && soat.ok === false) {
      lam = json(await goi(loc, `Kỳ trả về vì: ${soat.ly_do}\nViệc: ${giao.viec}\nTiêu chí:\n${tieuChi}\nSửa và nộp lại JSON: {"ket_qua":"…","bang_chung":"…"}`, '4 làm lại', nk, { tu: 'ky' })) || lam;
      soat = json(await goi(ky, `Tiêu chí:\n${tieuChi}\nKết quả nộp lại:\n${lam.ket_qua}\nBằng chứng: ${lam.bang_chung}\nLiệt kê từng câu rồi đếm. Trả lời JSON: {"ok":true|false,"ly_do":"…"}`, '5 soát lại', nk, { tu: 'loc' })) || soat;
    }
    const baoCao = await goi(tam, `Viết báo cáo sáng bằng VĂN BẢN THUẦN đúng 4 dòng theo mẫu dưới (không JSON, không thêm dòng):\n[Tên] · [phòng] · [ngày]\nXong: <việc> — <bằng chứng>\nĐang: <việc> — <tới đâu>\nCần: <mức> — <một câu>\n\nDữ kiện: việc "${giao.viec}"; Lộc nộp: ${lam.ket_qua.slice(0, 300)}; bằng chứng: ${lam.bang_chung}; Kỳ soát: ${soat ? (soat.ok ? 'đạt' : 'chưa đạt — ' + soat.ly_do) : 'không có kết luận'}. Trạng thái việc: ${soat?.ok ? 'submitted (chờ Giám đốc ký)' : 'revision'}. Ngày ${new Date().toISOString().slice(0, 10)}.`, '6 báo cáo', nk, { tu: 'minh' });
    nk.ket = { giao, lam, soat, bao_cao: baoCao, trang_thai_viec: soat?.ok ? 'submitted' : 'revision' };
    nk.trang_thai = 'xong';
    ghiLog({ luot: ts, loai: 'quyet', tu: 'ky', chi_tiet: { viec: giao.viec, ok: !!soat?.ok, ly_do: soat?.ly_do, trang_thai_viec: nk.ket.trang_thai_viec } });
  } catch (e) { nk.trang_thai = 'lỗi'; nk.loi = String(e.message || e); ghiLog({ luot: ts, loai: 'loi', tu: 'he-thong', chi_tiet: { loi: nk.loi } }); }
  const tok = nk.buoc.reduce((s, b) => s + (b.usage?.input_tokens || 0) + (b.usage?.output_tokens || 0), 0);
  nk.tong = { buoc: nk.buoc.length, token: tok, ms: nk.buoc.reduce((s, b) => s + b.ms, 0) };
  luu();
  ghiLog({ luot: ts, loai: 'he-thong', tu: 'he-thong', chi_tiet: { su_kien: 'kết thúc lượt', trang_thai: nk.trang_thai, tong: nk.tong } });
  return nk;
}

if (process.argv.includes('--tu-kiem')) {
  // proxy giả: trả JSON đúng vai theo x-cty-staff; Kỳ trả về lần 1 để kiểm nhánh làm lại
  let soatLan = 0;
  const fake = http.createServer(async (req, res) => {
    let raw = ''; for await (const c of req) raw += c; const staff = req.headers['x-cty-staff'];
    const hoi = String(JSON.parse(raw).messages?.[0]?.content || '');   // chỉ nhìn câu hỏi, không nhìn system (SOUL Tâm cũng có chữ 'báo cáo sáng')
    const ans = staff === 'tam' ? (hoi.includes('báo cáo sáng') ? 'Tâm · Phòng thử · 2026-10-10\nXong: việc — bằng chứng\nĐang: —\nCần: mức 3 — ký' : '{"giao_cho":"loc","viec":"viết 3 câu","tieu_chi":["3 câu","English"]}')
      : staff === 'loc' ? '{"ket_qua":"One. Two. Three.","bang_chung":"3 câu"}' : (++soatLan === 1 ? '{"ok":false,"ly_do":"thiếu"}' : '{"ok":true,"ly_do":"đủ"}');
    res.end(JSON.stringify({ content: [{ type: 'text', text: ans }], usage: { input_tokens: 10, output_tokens: 5 } }));
  }).listen(0, '127.0.0.1');
  await new Promise((r) => fake.once('listening', r));
  process.env.CTY_PROXY_URL = `http://127.0.0.1:${fake.address().port}`;
  process.env.CTY_DATA_DIR = fs.mkdtempSync('/tmp/cty-ca-');
  const nk = await motLuot('thử', false);
  const { docLog } = await import('./log.mjs');
  const lg = docLog({ luot: nk.ts, n: 999 });
  const assert = (c, m) => { if (!c) { console.error('✗ ca.mjs:', m, JSON.stringify(nk).slice(0, 300)); process.exit(1); } };
  assert(nk.trang_thai === 'xong', 'lượt phải xong');
  assert(nk.buoc.length === 6, `đủ 6 bước khi Kỳ trả về một lần (có ${nk.buoc.length})`);
  assert(nk.ket.trang_thai_viec === 'submitted' && nk.tong.token === 90, 'kết luận submitted + cộng token');
  assert(lg.filter((e) => e.loai === 'doc').length === 3 && lg.filter((e) => e.loai === 'tin').length === 12 && lg.some((e) => e.loai === 'quyet'), `log: 3 doc + 12 tin + quyet (có ${lg.length} dòng)`);
  fake.close(); console.log('✓ ca.mjs: 1 lượt 6 bước, nhánh làm lại, cộng token'); process.exit(0);
}

if (process.argv.includes('--viec')) {
  const viec = process.argv[process.argv.indexOf('--viec') + 1];
  const nk = await motLuot(viec);
  console.log(JSON.stringify({ ts: nk.ts, trang_thai: nk.trang_thai, loi: nk.loi, tong: nk.tong, ket: nk.ket?.trang_thai_viec }, null, 1));
  process.exit(nk.trang_thai === 'xong' ? 0 : 1);
}
