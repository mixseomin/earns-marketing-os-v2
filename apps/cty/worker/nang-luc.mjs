// HỒ SƠ NĂNG LỰC — máy đo từ KẾT QUẢ THẬT (nhật ký lượt + bộ việc chuẩn), không ai tự khai, không ai sửa tay (decision 2026-10-11
// nhân sự sống, lớp "năng lực đo được"). 0 đồng: chỉ đọc nhật ký. Mỗi năng lực có số mẫu — ít mẫu thì điểm chưa đáng tin, hiện kèm.
// Năng lực gắn với LOẠI BƯỚC người đó làm, không gắn với vai: người đổi vai vẫn giữ lịch sử năng lực của mình.
import { dsLuotTho, boViecChuan, chamViecChuan } from './quy-trinh.mjs';
import { tienUsd } from './gia.mjs';

export const NANG_LUC = {
  giao_viec: { ten: 'Giao việc', do: 'lượt người này giao kết thúc đúng (bộ việc chuẩn: khớp kỳ vọng; lượt thật: nộp được)' },
  thuc_hien: { ten: 'Thực hiện', do: 'bài làm được người kiểm duyệt ngay vòng đầu' },
  kiem_soat: { ten: 'Kiểm soát', do: 'trên bộ việc chuẩn, kết luận cuối khớp kỳ vọng khi người này soát' },
  bao_cao: { ten: 'Báo cáo', do: 'báo cáo đúng mẫu 4 dòng' },
  on_dinh: { ten: 'Ổn định', do: 'bước không lỗi (HTTP / không trả lời)' },
};
const LOAI = [['giao_viec', /giao việc/], ['bao_cao', /báo cáo/], ['kiem_soat', /soát/], ['thuc_hien', /\blàm\b/]];
const loai = (buoc) => LOAI.find(([, r]) => r.test(buoc))?.[0] ?? null;
const jsonOk = (s) => { const m = String(s || '').match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : null; } catch { return null; } };

/** Một lượt đúng hay sai THEO KẾT QUẢ: bộ việc chuẩn chấm theo kỳ vọng; lượt thật = nộp được. null = chưa xong. */
function ketDung(l) {
  if (l.trang_thai === 'đang chạy') return null;
  if (l.bo_viec) { const v = boViecChuan(l.khoa ?? 'thu-nghiem/lam-viec')?.viec.find((x) => x.id === l.bo_viec); return v ? chamViecChuan(l, v).dung : null; }
  return l.ket?.trang_thai_viec === 'submitted';
}

/** Hồ sơ năng lực của mọi người từng làm bước nào đó: { <id>: { nang_luc: {<k>: {dat, so_mau, diem}}, so_buoc, chi_phi, ms_tb, lan_cuoi } }. */
export function hoSoNangLuc(luot = dsLuotTho()) {
  const hs = {};
  const cua = (id) => (hs[id] ??= { id, nang_luc: Object.fromEntries(Object.keys(NANG_LUC).map((k) => [k, { dat: 0, so_mau: 0 }])), so_buoc: 0, chi_phi: 0, ms: 0, lan_cuoi: null });
  const cham = (id, k, dung) => { if (dung == null) return; const x = cua(id).nang_luc[k]; x.so_mau++; if (dung) x.dat++; };
  for (const l of luot) {
    const buoc = l.buoc || []; const dung = ketDung(l);
    const giao = buoc.find((b) => loai(b.buoc) === 'giao_viec'); if (giao) cham(giao.id, 'giao_viec', dung);
    const lam = buoc.find((b) => loai(b.buoc) === 'thuc_hien'); const soat1 = buoc.find((b) => loai(b.buoc) === 'kiem_soat');
    if (lam && soat1 && !soat1.loi) cham(lam.id, 'thuc_hien', jsonOk(soat1.dap)?.ok === true);
    if (l.bo_viec) for (const id of new Set(buoc.filter((b) => loai(b.buoc) === 'kiem_soat').map((b) => b.id))) cham(id, 'kiem_soat', dung);
    for (const b of buoc) {
      const h = cua(b.id); h.so_buoc++; h.chi_phi += b.usage ? tienUsd(b.model, b.usage) : 0; h.ms += b.ms || 0;
      if (!h.lan_cuoi || String(b.bat_dau) > h.lan_cuoi) h.lan_cuoi = b.bat_dau ?? h.lan_cuoi;
      cham(b.id, 'on_dinh', !b.loi);
      if (loai(b.buoc) === 'bao_cao' && !b.loi) cham(b.id, 'bao_cao', String(b.dap || '').split('\n').filter((x) => x.trim()).length === 4);
    }
  }
  for (const h of Object.values(hs)) { for (const x of Object.values(h.nang_luc)) x.diem = x.so_mau ? x.dat / x.so_mau : null; h.ms_tb = h.so_buoc ? Math.round(h.ms / h.so_buoc) : 0; delete h.ms; }
  return hs;
}

if (process.argv.includes('--tu-kiem') && (process.argv[1] || '').endsWith('nang-luc.mjs')) {
  const a = (c, m, x) => { if (!c) { console.error('✗ nang-luc:', m, JSON.stringify(x ?? {}).slice(0, 300)); process.exit(1); } };
  const B = (buoc, id, dap, o = {}) => ({ buoc, id, dap, model: 'openai:gpt-4o-mini', usage: { input_tokens: 100, output_tokens: 50 }, ms: 1000, bat_dau: '2026-10-11T00:00:00Z', ...o });
  const luot = [
    { trang_thai: 'xong', ket: { trang_thai_viec: 'submitted' }, buoc: [B('1 giao việc', 'tam', '{}'), B('2 làm', 'loc', '{}'), B('3 soát', 'ky', '{"ok":true}'), B('4 báo cáo', 'tam', 'a\nb\nc\nd')] },
    { trang_thai: 'xong', ket: { trang_thai_viec: 'revision' }, buoc: [B('1 giao việc', 'tam', '{}'), B('2 làm', 'loc', '{}'), B('3 soát', 'ky', '{"ok":false}'), B('4 làm lại', 'loc', '{}'), B('5 soát lại', 'ky', '{"ok":false}'), B('6 báo cáo', 'tam', 'một dòng', { loi: null })] },
    { trang_thai: 'xong', ket: { trang_thai_viec: 'submitted' }, buoc: [B('1 giao việc', 'tam', '', { loi: 'HTTP 500' })] },
    { trang_thai: 'đang chạy', buoc: [B('1 giao việc', 'tam', '{}')] },
  ];
  const hs = hoSoNangLuc(luot);
  a(hs.tam.nang_luc.giao_viec.so_mau === 3 && hs.tam.nang_luc.giao_viec.dat === 2, 'giao việc: 3 lượt xong, 2 nộp được (lượt đang chạy không tính)', hs.tam);
  a(hs.loc.nang_luc.thuc_hien.so_mau === 2 && hs.loc.nang_luc.thuc_hien.dat === 1, 'thực hiện: chỉ tính vòng đầu', hs.loc);
  a(hs.tam.nang_luc.bao_cao.dat === 1 && hs.tam.nang_luc.bao_cao.so_mau === 2, 'báo cáo: đúng 4 dòng mới đạt', hs.tam);
  a(hs.tam.nang_luc.on_dinh.so_mau === 6 && hs.tam.nang_luc.on_dinh.dat === 5, 'ổn định: bước lỗi trừ điểm', hs.tam);
  a(hs.ky.nang_luc.kiem_soat.so_mau === 0 && hs.ky.nang_luc.kiem_soat.diem === null, 'kiểm soát: chưa có bộ việc chuẩn thì chưa có điểm (không bịa)', hs.ky);
  a(hs.loc.chi_phi > 0 && hs.loc.ms_tb === 1000, 'cộng chi phí + thời gian', hs.loc);
  console.log('✓ nang-luc: giao việc / thực hiện vòng đầu / báo cáo đúng mẫu / ổn định / kiểm soát chỉ từ bộ việc chuẩn');
}
