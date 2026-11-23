import assert from 'node:assert';
import { htmlBaiDai, kiemBaiDai, chuBaiDai, faqCoKhong } from './may-de';

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
assert.ok(h2.includes('<div class="mock checklist"') && h2.includes('<input type="checkbox"') && chuBaiDai({ ...d, checklist: ['Check one'] }).includes('Check one'), 'checklist thành khối tương tác có ô tick');
assert.ok(kiemBaiDai('x'.repeat(100), 'L').some((x) => x.startsWith('độ dài')), 'bài ngắn bị chặn');
assert.ok(kiemBaiDai(`${'word '.repeat(900)} L`, 'L').length === 0, 'bài đủ dài, có link: qua');
// khung từng mục + câu dẫn nút giữa bài (19/11/2026: Phòng Nội dung chê "chỉ 1 khung ví dụ", "nút giữa bài thiếu lời dẫn")
const h3 = htmlBaiDai({ ...d, dan_cta: 'Run your own numbers.', muc: [{ h2: 'A', doan: ['a'], khung: ['Base pay: $4,000', '"BAH: $1,900"'] }, { h2: 'B', doan: ['b'], khung: ['one'] }, { h2: 'C', doan: ['c'] }] }, L, [], null);
assert.equal((h3.match(/class="mock"/g) || []).length, 2, 'khung mục (≥2 dòng) + khung ví dụ; khung 1 dòng bỏ');
assert.ok(h3.indexOf('Run your own numbers.') < h3.indexOf('Try it free') && h3.indexOf('Base pay') > h3.indexOf('<h2>A</h2>'), 'câu dẫn trước nút giữa, khung dưới mục');
assert.ok(chuBaiDai({ ...d, dan_cta: 'Z9', muc: [{ h2: 'A', doan: ['a'], khung: ['K7', 'K8'] }] }).includes('K7') && chuBaiDai({ ...d, dan_cta: 'Z9' }).includes('Z9'), 'chữ kiểm gồm khung + câu dẫn');
assert.deepEqual(faqCoKhong([{ hoi: 'Is BAH taxable?' }, { hoi: 'How is BAH taxed?' }, { hoi: 'Does rate protection follow me?' }, { hoi: 'Isaac rule?' }]), ['Is BAH taxable?', 'Does rate protection follow me?'], 'chặn câu hỏi có/không, không bắt nhầm');
assert.deepEqual(faqCoKhong([{ hoi: 'How is BAH taxed?', dap: 'No, BAH is not taxed.' }, { hoi: 'What changes?', dap: 'Nothing changes.' }]), ['How is BAH taxed?'], 'đáp mở Yes/No bị chặn');
const h4 = htmlBaiDai({ ...d, vi_du: { tieu_de: 'Sample case: an E-7', dong: ['Sample case: an E-7', 'High-3: $5,000', 'High-3: $5,000', 'Years: 20'] } }, L, [], null);
assert.equal((h4.match(/Sample case: an E-7/g) || []).length, 1, 'dòng ví dụ trùng nhãn bỏ'); assert.equal((h4.match(/High-3: \$5,000/g) || []).length, 1, 'dòng trùng bỏ');
console.log('bai-dai: 17/17 ok');
