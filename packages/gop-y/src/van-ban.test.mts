// Tự kiểm bộ hiện lời luồng góp ý: node_modules/.bin/tsx packages/gop-y/src/van-ban.test.mts
import assert from 'node:assert';
import { renderToStaticMarkup } from 'react-dom/server';
import * as React from 'react';
(globalThis as { React?: unknown }).React = React;   // gói không có tsconfig riêng → tsx biên JSX kiểu cũ (React.createElement); Next biên kiểu mới
const { VanBan } = await import('./van-ban');
const { createElement } = React;
const h = (c: string) => renderToStaticMarkup(createElement(VanBan, { chu: c })).replace(/<style>[\s\S]*?<\/style>/, '');
const a = h('**Nguyên nhân:** widget chỉ in thoại\n- Cách sửa: thêm dòng hành động\n- Kết quả: thấy đủ\n\nDòng một\ndòng hai\n• gạch cũ');
assert(a.includes('<strong>Nguyên nhân:</strong>') && (a.match(/<li>/g) ?? []).length === 3, 'đậm + gạch đầu dòng (kể cả • cũ)');
assert(/Dòng một<br\/>\s*dòng hai/.test(a), 'xuống dòng đơn giữ nguyên');
assert(h('| a | b |\n|---|---|\n| 1 | 2 |').includes('<td>1</td>'), 'bảng');
const x = h('<script>alert(1)</script>\n\nxem [link](https://x.y)');
assert(!x.includes('<script') && x.includes('href="https://x.y"') && x.includes('target="_blank"'), 'bỏ HTML thô, link mở tab mới');
console.log('van-ban: tự kiểm đạt');
