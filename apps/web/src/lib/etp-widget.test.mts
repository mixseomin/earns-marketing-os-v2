import assert from 'node:assert';
import { hopLe, xep, them, TEMPLATE, WIDGET, HANG } from './etp-widget';

for (const [k, t] of Object.entries(TEMPLATE)) assert.ok(hopLe(t.o), `template ${k} phải hợp lệ`);
assert.equal(hopLe([{ ma: 'khong_co', x: 0, y: 0, w: 4, h: 4 }]), null, 'widget ngoài sổ bị chặn');
assert.equal(hopLe([{ ma: 'bang_ngay', x: 0, y: HANG - 2, w: 12, h: 4 }]), null, 'vượt màn bị chặn');
assert.equal(hopLe([{ ma: 'bieu_do_ngay', x: 0, y: 0, w: 6, h: 6 }, { ma: 'bang_ngay', x: 3, y: 2, w: 6, h: 6 }]), null, 'chồng nhau bị chặn');
const ds = TEMPLATE.mac_dinh!.o;
const r = xep(ds, { ...ds[1]!, y: 0 });   // kéo bảng ngày lên đầu → biểu đồ dồn xuống dưới
assert.equal(r.find((o) => o.ma === 'bang_ngay')!.y, 0);
assert.equal(r.find((o) => o.ma === 'bieu_do_ngay')!.y, 11);
assert.equal(them([], 'bieu_do_ngay')!.length, 1);
assert.equal(them(ds, 'bang_ngay'), null, 'đã có thì không thêm lại');
assert.ok(Object.values(WIDGET).every((w) => w.min[0] <= w.mac[0] && w.min[1] <= w.mac[1]));
console.log('etp-widget: ok');
