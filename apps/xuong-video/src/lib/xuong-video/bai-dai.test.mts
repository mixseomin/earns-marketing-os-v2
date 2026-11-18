import assert from 'node:assert';
import { htmlBaiDai, kiemBaiDai, chuBaiDai } from './may-de';

const d = {
  tieu_de: 'A <b>', phu_de: 'Sub', canh: 'Imagine a sergeant at 6 a.m.', hua: 'In five minutes you will know.',
  muc: [{ h2: 'Answer', doan: ['a'] }, { h2: 'How', doan: ['b'] }, { h2: 'Mistakes', doan: ['c'] }],
  vi_du: { tieu_de: 'Example: E-6', dong: ['High-3: $5,000', 'Years: 20', 'Pension: $2,500'] },
  neu_da_lo: { h2: 'If you already retired', doan: ['d'] }, faq: [{ hoi: 'Q1?', dap: 'A1' }, { hoi: 'Q2?', dap: 'A2' }, { hoi: 'Q3?', dap: 'A3' }],
  ket: 'Check it at {LINK} today.',
};
const L = 'https://militarycalc.com/x?utm_source=substack';
const h = htmlBaiDai(d, L, ['https://images.pexels.com/photos/1/a.jpg', 'https://images.pexels.com/photos/2/b.jpg', 'https://images.pexels.com/photos/3/c.jpg'], 'abcdefghijk');
assert.ok(h.includes('<h1>A &lt;b&gt;</h1>') && h.includes('<em>Sub</em>'), 'tiêu đề + phụ đề');
assert.equal((h.match(/<img /g) || []).length, 3, 'ba ảnh thật');
assert.ok(/<iframe src="https:\/\/www\.youtube\.com\/embed\/abcdefghijk"/.test(h), 'video nhúng (kiem-bai đếm iframe youtube)');
assert.ok(h.includes('<h2>Questions people ask</h2>') && h.includes('<h2>If you already retired</h2>'), 'FAQ + nếu đã lỡ');
assert.ok(h.includes('<blockquote class="mock">') && h.includes('class="cta"'), 'khung ví dụ + nút');
assert.ok(h.includes(`<a href="${L}">${L}</a>`), 'link đích thành thẻ a + chữ link thuần');
assert.ok(h.indexOf('Imagine') < h.indexOf('<h2>'), 'cảnh mở đứng trước mục đầu');
assert.ok(chuBaiDai(d).includes('{LINK}') && chuBaiDai(d).includes('Q3?'), 'chữ kiểm gồm mọi khối');
assert.equal((h.match(/class="cta"/g) || []).length, 2, 'nút giữa bài + cuối bài');
const h2 = htmlBaiDai({ ...d, checklist: ['Check one', 'Check two', 'Check three', 'Check four'] }, L, [], null);
assert.ok(h2.includes('<ul class="checklist"><li>☐ Check one</li>') && chuBaiDai({ ...d, checklist: ['Check one'] }).includes('Check one'), 'checklist thành danh sách ô tick');
assert.ok(kiemBaiDai('x'.repeat(100), 'L').some((x) => x.startsWith('độ dài')), 'bài ngắn bị chặn');
assert.ok(kiemBaiDai(`${'word '.repeat(900)} L`, 'L').length === 0, 'bài đủ dài, có link: qua');
console.log('bai-dai: 10/10 ok');
