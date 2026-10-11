// LƯƠNG QUY ĐỔI + VÍ ẢO (anh chốt 11/10/2026). Bảng lương thị trường có nguồn ở cong-ty/luong/thi-truong.json.
// Trả theo VIỆC đã làm: mỗi bước xong không lỗi = phút quy đổi × đơn giá giờ của vai ứng với loại việc đó (giao việc/báo cáo → trưởng phòng,
// làm → người làm, soát → người kiểm) × bậc theo cấp của người làm bước. Ví = sổ cái TÍNH TỪ NHẬT KÝ (không lưu riêng, không chạm tiền thật).
import fs from 'node:fs';
import path from 'node:path';
import { GOC } from './goc.mjs';
import { dsLuotTho } from './quy-trinh.mjs';
import { hoSoNangLuc, theGame, loaiBuoc as loai, ngayVN } from './nang-luc.mjs';
import { tienUsd } from './gia.mjs';

export const bangLuong = () => JSON.parse(fs.readFileSync(path.join(GOC, 'cong-ty', 'luong', 'thi-truong.json'), 'utf8'));
export const bacCuaCap = (B, cap) => Object.entries(B.bac_theo_cap).find(([k, [a, b]]) => !k.endsWith('_') && cap >= a && cap <= b)?.[0] ?? 'tb';
const usTheoBac = (us, bac) => (bac === 'thap' ? us.nam_p10 : bac === 'cao' ? us.nam_p90 : us.nam_trung_vi);

/** Mức lương tương đương của một vai ở một cấp: { vn_thang, vn_gio, us_nam, us_gio, bac, nguon }. */
export function luongVai(vai, cap, B = bangLuong()) {
  const v = B.vai[vai]; if (!v) return null; const bac = bacCuaCap(B, cap);
  const vnThang = v.vn[bac]; const usNam = usTheoBac(v.us, bac);
  return { vai, bac, vn_thang: vnThang, vn_gio: vnThang / B.gio_thang_vn, us_nam: usNam, us_gio: usNam / B.gio_nam_us, nghe_vn: v.vn.nghe, nghe_us: v.us.nghe };
}

/** Ví của mọi người: { <id>: { muc: [...], tong_vnd, tong_usd, chi_ai_usd, thang: {vnd, usd, chi_ai_usd} } }. */
export function soVi(luot = dsLuotTho(), B = bangLuong(), luc = new Date()) {
  const capCua = Object.fromEntries(Object.entries(theGame(hoSoNangLuc(luot))).map(([id, t]) => [id, t.cap]));
  const thang = ngayVN(luc.toISOString()).slice(0, 7);
  const out = {};
  for (const l of luot) for (const b of l.buoc || []) {
    const lo = loai(b.buoc); const vai = lo && B.viec_sang_vai[lo]; const v = (out[b.id] ??= { muc: [], tong_vnd: 0, tong_usd: 0, chi_ai_usd: 0, thang: { vnd: 0, usd: 0, chi_ai_usd: 0 } });
    const ai = b.usage ? tienUsd(b.model, b.usage) ?? 0 : 0; const trongThang = b.bat_dau && ngayVN(b.bat_dau).slice(0, 7) === thang;
    v.chi_ai_usd += ai; if (trongThang) v.thang.chi_ai_usd += ai;
    if (!vai || b.loi) continue;   // bước lỗi không có công
    const lg = luongVai(vai, capCua[b.id] ?? 1, B); const phut = B.phut_quy_doi[lo];
    const vnd = Math.round((phut / 60) * lg.vn_gio); const usd = (phut / 60) * lg.us_gio;
    v.muc.push({ luc: b.bat_dau, luot: l.ts, buoc: b.buoc, vai, phut, vnd, usd, ai_usd: ai });
    v.tong_vnd += vnd; v.tong_usd += usd; if (trongThang) { v.thang.vnd += vnd; v.thang.usd += usd; }
  }
  for (const v of Object.values(out)) v.muc.sort((a, b) => String(b.luc).localeCompare(String(a.luc)));
  return out;
}

if (process.argv.includes('--tu-kiem') && (process.argv[1] || '').endsWith('luong.mjs')) {
  const a = (c, m, x) => { if (!c) { console.error('✗ luong:', m, JSON.stringify(x ?? {}).slice(0, 300)); process.exit(1); } };
  const B = bangLuong();
  for (const [vai, v] of Object.entries(B.vai)) a(v.vn.url && v.vn.lay && v.us.url && v.us.lay && v.vn.thap < v.vn.tb && v.vn.tb < v.vn.cao, `vai ${vai}: đủ nguồn + ngày lấy, thấp < tb < cao`, v);
  const l1 = luongVai('nguoi-lam', 1, B), l5 = luongVai('nguoi-lam', 5, B), l9 = luongVai('nguoi-lam', 9, B);
  a(l1.vn_thang === B.vai['nguoi-lam'].vn.thap && l5.vn_thang === B.vai['nguoi-lam'].vn.tb && l9.vn_thang === B.vai['nguoi-lam'].vn.cao, 'bậc theo cấp: 1–3 thấp, 4–7 tb, 8+ cao', { l1, l5, l9 });
  a(Math.abs(l5.us_gio - 76910 / 2080) < 1e-9, 'giờ Mỹ = năm / 2080', l5);
  const B0 = (buoc, id, o = {}) => ({ buoc, id, model: 'openai:gpt-4o-mini', usage: { input_tokens: 1000, output_tokens: 500 }, ms: 1000, bat_dau: '2026-10-11T03:00:00Z', ...o });
  const vi = soVi([{ ts: 't1', trang_thai: 'xong', ket: { trang_thai_viec: 'submitted' }, buoc: [B0('1 giao việc', 'tam'), B0('2 làm', 'loc'), B0('3 soát', 'ky'), B0('4 làm lại', 'loc', { loi: 'HTTP 500' }), B0('5 báo cáo', 'tam')] }], B, new Date('2026-10-11T05:00:00Z'));
  a(vi.loc.muc.length === 1 && vi.loc.chi_ai_usd > vi.loc.muc[0].ai_usd, 'bước lỗi: tốn AI nhưng không có công', vi.loc);
  a(vi.loc.muc[0].vnd === Math.round((20 / 60) * (B.vai['nguoi-lam'].vn.thap / 208)), 'lương bước = phút × giờ của vai × bậc', vi.loc.muc[0]);
  a(vi.tam.muc.length === 2 && vi.tam.muc.every((m) => m.vai === 'truong-phong') && vi.ky.muc[0].vai === 'nguoi-kiem', 'loại việc → vai trả lương', vi.tam.muc);
  a(vi.tam.thang.vnd === vi.tam.tong_vnd, 'cộng tháng này', vi.tam);
  console.log('✓ luong: bảng có nguồn, bậc theo cấp, trả theo việc, bước lỗi không công, ví theo tháng');
}
