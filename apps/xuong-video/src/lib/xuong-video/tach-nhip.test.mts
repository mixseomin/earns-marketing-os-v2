import assert from 'node:assert';
import { canTachNhip } from './tach-nhip';
const nguoi = (t: string) => ['Lâm Hạ', 'Vivian', 'Lục Thần'].includes(t);
const ha = { ten: 'Lâm Hạ', tam: [-100, 380, 0] };
const the = { ten: 'Thẻ nhân viên', cam: 'Lâm Hạ', deo: 'co', tam: [-100, 368, 140], den: [-35, 370, 120] };
// #132 #15 gốc: toàn cảnh, Vivian đi ~110 cm + giật thẻ đeo cổ → 2 lý do (tháo đồ đeo ở khung rộng + đi lại cùng shot)
const s15 = { co_canh: 'ws', vi_tri: [ha, { ten: 'Vivian', tam: [55, 290, 0], den: [-15, 372, 0], dien: ['giat@0.55-0.8'] }, the] };
assert.equal(canTachNhip(s15, nguoi).length, 2);
// #15b đã tách: cận chèn, Vivian đứng yên → qua
assert.deepEqual(canTachNhip({ co_canh: 'insert', vi_tri: [ha, { ten: 'Vivian', tam: [-45, 372, 0], dien: ['giat@0-0.5'] }, the] }, nguoi), []);
// #15a đã tách: Vivian đi tới nhưng thẻ chưa đổi tay → qua
assert.deepEqual(canTachNhip({ co_canh: 'ws', vi_tri: [ha, { ten: 'Vivian', tam: [55, 290, 0], den: [-45, 372, 0] }, { ...the, den: undefined }] }, nguoi), []);
// trao đồ cầm (không đeo) ở cận trung, không ai đi → qua; có người đi → tách
const coc = { ten: 'Cốc', cam: 'Lâm Hạ', tam: [-100, 368, 100], den: [-50, 372, 100] };
assert.deepEqual(canTachNhip({ co_canh: 'mcu', vi_tri: [ha, { ten: 'Vivian', tam: [-45, 372, 0] }, coc] }, nguoi), []);
assert.equal(canTachNhip({ co_canh: 'ms', vi_tri: [ha, { ten: 'Vivian', tam: [60, 300, 0], den: [-45, 372, 0] }, coc] }, nguoi).length, 1);
// hai món đổi tay một shot → tách
assert.ok(canTachNhip({ co_canh: 'cu', vi_tri: [ha, { ten: 'Vivian', tam: [-45, 372, 0] }, coc, { ...coc, ten: 'Bút' }] }, nguoi).some((x) => x.startsWith('2 lần')));
console.log('tach-nhip: ok');
// #13: insert chuyển chủ thể → tách; #27: buông bút + đi lại (ms) → tách; đặt đồ đứng yên → qua
{
  const { canTachNhip } = await import('./tach-nhip');
  const nguoi = (t: string) => ['Lâm Hạ', 'Lục Thần'].includes(t);
  assert.ok(canTachNhip({ co_canh: 'insert', vi_tri: [{ ten: 'Lục Thần', tam: [230, 760, 0] }], chuyen_toi: 'Lâm Hạ' }, nguoi)[0]!.includes('cận chèn'));
  const but = { ten: 'Bút ký', cam: 'Lục Thần', tam: [8, 728, 110], den: [10, 690, 76] };
  assert.equal(canTachNhip({ co_canh: 'ms', vi_tri: [{ ten: 'Lục Thần', tam: [0, 740, 0], den: [-40, 698, 0] }, but] }, nguoi).length, 1);
  assert.deepEqual(canTachNhip({ co_canh: 'ms', vi_tri: [{ ten: 'Lục Thần', tam: [0, 740, 0] }, but] }, nguoi), []);
  assert.deepEqual(canTachNhip({ co_canh: 'ms', vi_tri: [{ ten: 'Lục Thần', tam: [0, 740, 0] }], chuyen_toi: 'Lâm Hạ' }, nguoi), []);
}
