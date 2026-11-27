import assert from 'node:assert';
import { boGachDai, catLuaBinhChon, kiemDe } from './may-de';

assert.strictEqual(boGachDai('BAH — the part most people miss.'), 'BAH, the part most people miss.');
assert.strictEqual(boGachDai('Pick 2–4 options'), 'Pick 2-4 options');
assert.strictEqual(boGachDai('Retire at 20 years — or wait?'), 'Retire at 20 years, or wait?');
assert.strictEqual(boGachDai('End here —'), 'End here');
assert.deepStrictEqual(boGachDai({ chu: { title: 'A — B' }, de: { lua: ['x – y', 'z'], n: 3 } }), { chu: { title: 'A, B' }, de: { lua: ['x, y', 'z'], n: 3 } });
assert.ok(!/[—–]/.test(JSON.stringify(boGachDai({ a: ['—', 'b—c', 'd –– e'] }))));
console.log('bo-gach-dai: ok');

// catLuaBinhChon: lựa chọn bình chọn quá 25 ký tự phải tự cắt về ≤ 25 mà không mất lựa chọn
const goc = ['PXO duty station preference', 'Keep flight pay', 'No opinion'];
const de = { cau_hoi: 'Which duty station would you pick first if orders came tomorrow?', lua: [...goc] };
const hookGi = { id: 1, chu: 'duty station pick', page: '', ngay: '2026-11-28' } as never;
const kiemCu = kiemDe({ mau: 'binh-chon', dang_bai: 'binh-chon', de, title: 'Duty station pick', description: 'x'.repeat(90), nhan: 'MilitaryCalc', ngon_ngu: 'en', hooks: [hookGi], hook_qc: undefined });
assert.ok(kiemCu.some((l) => l.includes('lựa chọn quá 25 ký tự')), 'kiểm gốc phải thấy lỗi 25 ký tự');
const de2 = { lua: [...goc] } as Record<string, unknown>;
catLuaBinhChon(de2);
const sau = de2.lua as string[];
assert.ok(sau.length === 3, 'không mất lựa chọn');
assert.ok(sau.every((l) => l.length <= 25), 'mọi lựa chọn ≤ 25');
const kiemSau = kiemDe({ mau: 'binh-chon', dang_bai: 'binh-chon', de: { ...de, lua: sau }, title: 'Duty station pick', description: 'x'.repeat(90), nhan: 'MilitaryCalc', ngon_ngu: 'en', hooks: [hookGi], hook_qc: undefined });
assert.ok(!kiemSau.some((l) => l.includes('lựa chọn quá 25 ký tự')), 'sau cắt không còn lỗi 25 ký tự');
assert.ok(!kiemSau.some((l) => l.includes('trùng nhau')));
catLuaBinhChon({}); // không lua → không nổ
catLuaBinhChon({ lua: ['ok', 3, null] }); // phần tử lạ → không nổ
console.log('cat-lua-binh-chon: ok');
