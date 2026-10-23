import assert from 'node:assert';
import { doiTayDo, cauDoiTayVideo, cauDoiTayKet, thieuCachThao, thaoMacDinh } from './thao-do';
const nguoi = (t: string) => ['Lâm Hạ', 'Vivian'].includes(t);
// #132 #15: Vivian giật thẻ đeo cổ Hạ → giật đứt khoá, câu video nói khoá bật + không qua mặt; ảnh kết: dây hở hai đầu
const s15 = [{ ten: 'Lâm Hạ', tam: [-100, 380, 0] }, { ten: 'Vivian', tam: [55, 290, 0], den: [-15, 372, 0], dien: ['mc_sai_buoc@0-0.55', 'giat@0.55-0.8'] }, { ten: 'Thẻ nhân viên', cam: 'Lâm Hạ', deo: 'co', tam: [-100, 368, 140], den: [-35, 370, 120] }, { ten: 'Thùng đồ cá nhân', cam: 'Lâm Hạ', tam: [-100, 362, 95] }];
const d = doiTayDo(s15, nguoi);
assert.deepEqual(d.map((x) => [x.mon, x.tu, x.den, x.thao]), [['Thẻ nhân viên', 'Lâm Hạ', 'Vivian', 'giat_dut_khoa']]);
assert.ok(cauDoiTayVideo(d).includes('breakaway clasp') && cauDoiTayVideo(d).includes('{Thẻ nhân viên}') && cauDoiTayVideo(d).includes('never rides up over'));
assert.ok(cauDoiTayKet(d)[0]!.includes('loose ends'));
assert.equal(thieuCachThao(d), null);
// lấy êm (không mã giat) → nhấc qua đầu; khai tay thao hợp lệ thắng mặc định; khai sai nơi đeo bỏ qua
assert.equal(thaoMacDinh('co', ['cam_truoc']), 'nhac_qua_dau');
assert.equal(doiTayDo(s15.map((x) => (x.ten === 'Thẻ nhân viên' ? { ...x, thao: 'nhac_qua_dau' } : x)), nguoi)[0]!.thao, 'nhac_qua_dau');
assert.equal(doiTayDo(s15.map((x) => (x.ten === 'Thẻ nhân viên' ? { ...x, thao: 'tuot' } : x)), nguoi)[0]!.thao, 'giat_dut_khoa');
// nơi đeo lạ ('tai') không suy ra được → cổng chặn
assert.ok(thieuCachThao(doiTayDo(s15.map((x) => (x.ten === 'Thẻ nhân viên' ? { ...x, deo: 'tai' } : x)), nguoi))?.includes("'tai'"));
// đồ cầm (không đeo) đổi tay → câu trao tay; không ai nhận (món về chỗ người cũ) → không tính
assert.ok(cauDoiTayVideo(doiTayDo([s15[0]!, s15[1]!, { ten: 'Cốc', cam: 'Lâm Hạ', tam: [-100, 368, 100], den: [-20, 372, 100] }], nguoi)).includes('hand to hand'));
assert.deepEqual(doiTayDo([s15[0]!, s15[1]!, { ten: 'Cốc', cam: 'Lâm Hạ', tam: [-100, 368, 100], den: [-98, 375, 100] }], nguoi), []);
console.log('thao-do: ok');
