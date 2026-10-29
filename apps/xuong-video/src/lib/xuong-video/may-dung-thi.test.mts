import assert from 'node:assert';
import { assThi, boCucThi, lenhThi, nhipThi, tuNguonThi, T_LO, type DeThi } from './may-dung-thi';
import { giayDoc } from './may-dung-ass';

const de: DeThi = { ky: 'PTCB', hoi: 'Which of the following is the correct brand name for atorvastatin?', lua: { A: 'Crestor', B: 'Zocor', C: 'Lipitor', D: 'Pravachol' }, dung: 'C',
  giai: 'Atorvastatin is marketed under the brand name Lipitor and belongs to the HMG-CoA reductase inhibitor class.', mang: 'Medications' };
const n = nhipThi(de);
assert.ok(n.T_KET - T_LO >= giayDoc(de.lua.C, de.giai) - 0.01, 'lời giải đứng đủ thời gian đọc');
assert.ok(n.DAI > n.T_KET + 2, 'màn kết đứng đủ thời gian đọc');
const dai: DeThi = { ...de, hoi: 'A patient presents with a prescription for amoxicillin 500 mg to be taken three times daily for ten days. How many capsules should the technician dispense to fill this prescription completely?', lua: { A: '15 capsules for the full course of therapy', B: '20 capsules dispensed in a single vial', C: '30 capsules, one bottle', D: '40 capsules split into two bottles for travel' } };
const L = boCucThi(dai);
assert.ok(L.cuoi < 1640, `thẻ câu hỏi dài không chạm đồng hồ đếm (đỉnh ~1655) — cuối ${L.cuoi}`);
assert.ok(L.cuoiG <= 1880 && L.giai.length >= 1, `lời giải nằm gọn trong khung (cuối ${L.cuoiG})`);
const daiHon = boCucThi({ ...dai, giai: dai.giai.repeat(4) }); assert.ok(daiHon.cuoiG <= 1880, 'lời giải quá dài thì cắt bớt dòng, không tràn');
const a = assThi(dai);
assert.ok(a.includes('PTCB') && a.includes('l 36 2 l 46 12') && a.includes('C is correct.') && a.includes('examweight.com/ptcb'), 'ASS có tiêu đề, dấu đúng, lời giải, link');
assert.throws(() => lenhThi({ de, ass: 'x.ass', nen: null, fontsDir: '/f', ra: 'r.mp4' }), /ảnh nền thật/, 'không ảnh thật thì dừng');
const r = tuNguonThi({ ...de, slug: 'ptcb-1-1-001' });
assert.ok(r.dang.link === 'https://examweight.com/ptcb/practice-test' && r.dang.description.includes(r.dang.link), 'link trang thi thử nằm trong chữ đăng');
assert.ok(!r.dang.title.includes('Lipitor') && r.dang.title.length <= 110 && r.dang.title.length >= 25, 'tiêu đề không lộ đáp án, độ dài hợp lệ');
assert.ok(!/[—–]/.test(r.dang.title + r.dang.description), 'không gạch ngang dài');
console.log('✓ may-dung-thi: luật đọc · bố cục câu dài không tràn · ASS đủ khối · thiếu ảnh thì dừng · link + tiêu đề không lộ đáp án');
// tiêu đề câu dài giữ phần cuối: hai câu cùng mẫu khác tên thuốc ra hai tiêu đề khác (29/10/2026 — 3 video PTCB trùng tiêu đề)
{ const { mocThi } = await import('./may-dung-thi'); const a1 = mocThi({ hoi: 'Which of the following is the correct brand name for azithromycin in the United States?' } as never), a2 = mocThi({ hoi: 'Which of the following is the correct brand name for atorvastatin in the United States?' } as never);
  if (a1 === a2 || !a1.includes('azithromycin') || a1.length > 61) throw new Error(`mocThi giữ phần cuối hỏng: ${a1} | ${a2}`); console.log('✓ mocThi: câu cùng mẫu ra tiêu đề khác'); }
