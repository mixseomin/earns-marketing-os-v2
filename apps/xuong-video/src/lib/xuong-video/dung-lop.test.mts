// Tự kiểm dung-lop.ts: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/dung-lop.test.mts
import assert from 'node:assert';
import { laDungLop, khoaNen, boiCanhCua, thanhPhanLop, cauDoMang, promptNen, promptLop, locGhep, coGhep, anhLopCua } from './dung-lop';

// gói MV gag mặc định dựng lớp; chọn tay 'khung' thì không; gói khác trống thì không
assert.strictEqual(laDungLop({ dung: '', goi: 'mv_gag_hoat_hinh' }), true);
assert.strictEqual(laDungLop({ dung: 'khung', goi: 'mv_gag_hoat_hinh' }), false);
assert.strictEqual(laDungLop({ dung: '', goi: 'phim_doc_tong_tai' }), false);
assert.strictEqual(laDungLop({ dung: 'lop', goi: '' }), true);

// khoá nền: cùng bối cảnh + cùng cỡ + cùng góc = cùng tấm; đổi góc = tấm khác; thiếu kỹ thuật có mặc định
assert.strictEqual(khoaNen(749, { co_canh: 'ws', goc: 'thap' } as never), '749:ws:thap');
assert.notStrictEqual(khoaNen(749, { co_canh: 'ws', goc: 'thap' } as never), khoaNen(749, { co_canh: 'ws', goc: 'cao' } as never));
assert.strictEqual(khoaNen(749, null), '749:mws:ngang');

// tách anchor của shot: bối cảnh riêng, người + vật vào lớp theo thứ tự shot
const nv = [{ id: 1, loai: 'nhan_vat' }, { id: 2, loai: 'boi_canh' }, { id: 3, loai: 'dao_cu' }, { id: 4, loai: 'nhan_vat' }] as const;
const canh = { nhan_vat: [3, 2, 1] };
assert.strictEqual(boiCanhCua(canh, [...nv])?.id, 2);
assert.deepStrictEqual(thanhPhanLop(canh, [...nv]).map((v) => v.id), [3, 1]);
assert.strictEqual(boiCanhCua({ nhan_vat: [1] }, [...nv]), null);

// đồ luôn mang: chỉ nhân vật có khai; bỏ chấm cuối
const dm = cauDoMang([{ ten: 'Bà Lụa', loai: 'nhan_vat', do_mang: 'a bamboo pole with two baskets.' }, { ten: 'Ghế', loai: 'dao_cu', do_mang: 'x' }, { ten: 'B', loai: 'nhan_vat', do_mang: '' }]);
assert.ok(dm.startsWith('Bà Lụa always carries a bamboo pole with two baskets —') && !dm.includes('Ghế') && !dm.includes('B always'), dm);

// prompt nền trống người, có góc máy; prompt lớp đòi nền xanh, không cảnh
const pn = promptNen('2D', 'Hanoi Train Street.', { co_canh: 'ws', goc: 'thap' } as never);
assert.ok(/EMPTY/.test(pn) && pn.includes('wide shot') && pn.includes('low-angle') && !pn.includes('Street..'), pn);
const pl = promptLop('2D', 'The vendor walks.', null, dm, 2);
assert.ok(pl.includes('#00FF00') && /no scenery/.test(pl) && pl.includes('Reference images 1–2') && pl.includes('always carries'), pl);

// bộ lọc ghép: có chromakey, bóng đổ, video thêm shortest; cỡ theo tỉ lệ
const v = locGhep(1280, 720, true), a = locGhep(1280, 720, false);
assert.ok(v.includes('chromakey=0x00FF00') && v.includes('colorchannelmixer') && v.includes('shortest=1') && !a.includes('shortest'), v);
assert.deepStrictEqual(coGhep('16:9'), [1280, 720]); assert.deepStrictEqual(coGhep('9:16'), [720, 1280]);

// video đi từ ảnh lớp của keyframe đang chọn; keyframe khác (cũ, không phải ghép) → null
assert.strictEqual(anhLopCua({ keyframe_url: 'g1', lop: { anh: { g1: 'xanh1' } } }), 'xanh1');
assert.strictEqual(anhLopCua({ keyframe_url: 'cu', lop: { anh: { g1: 'xanh1' } } }), null);
assert.strictEqual(anhLopCua({ keyframe_url: null, lop: null }), null);
console.log('✓ dung-lop');
