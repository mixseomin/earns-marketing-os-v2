import assert from 'node:assert';
import { htmlBaiDai, kiemBaiDai } from './may-de';

const h = htmlBaiDai({ tieu_de: 'A <b>', phu_de: 'Sub', muc: [{ h2: 'S', doan: ['go {LINK} now'] }] }, 'https://militarycalc.com/x?utm_source=substack', 'https://images.pexels.com/photos/9/a.jpg');
assert.ok(h.includes('<h1>A &lt;b&gt;</h1>') && h.includes('<em>Sub</em>') && h.includes('<img src='), 'khung h1 / phụ đề / ảnh');
assert.ok(h.includes('<a href="https://militarycalc.com/x?utm_source=substack">https://militarycalc.com/x?utm_source=substack</a>'), 'link đích thành thẻ a + chữ link thuần');
assert.ok(kiemBaiDai('x'.repeat(100), 'L').some((x) => x.startsWith('độ dài')), 'bài ngắn bị chặn');
assert.ok(kiemBaiDai(`${'word '.repeat(800)} L`, 'L').length === 0, 'bài đủ dài, có link: qua');
console.log('bai-dai: 4/4 ok');
