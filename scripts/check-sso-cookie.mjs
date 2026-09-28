#!/usr/bin/env node
// SSO .on.tc: MOS2 lấy cookie cổng trong header Cookie rồi hỏi cổng "cookie này của ai".
// Hai bước đó dễ sai âm thầm — cookie khác trùng tiền tố tên, giá trị urlencode của PHP,
// cổng trả {"email":null} hoặc trả nguyên trang lỗi 403 của Cloudflare.
//   node scripts/check-sso-cookie.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Bản sao của docCookieCong/docTraLoiCong trong apps/web/src/lib/auth.ts (JS thuần, bỏ kiểu).
const docCookieCong = (cookieHeader, ten) =>
  cookieHeader.match(new RegExp('(?:^|;\\s*)' + ten.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]+)'))?.[1] ?? null;
const docTraLoiCong = (body) => {
  try {
    const j = JSON.parse(body);
    const e = typeof j.email === 'string' ? j.email.trim().toLowerCase() : '';
    return e.includes('@') ? e : null;
  } catch { return null; }
};

// Chống trôi: bản gốc đổi mà bản sao ở đây không đổi thì bài kiểm hết ý nghĩa.
const src = readFileSync(new URL('../apps/web/src/lib/auth.ts', import.meta.url), 'utf8');
for (const dau of ['export function docCookieCong', 'export function docTraLoiCong',
                   "ten.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')", "e.includes('@') ? e : null"]) {
  assert.ok(src.includes(dau), `lib/auth.ts không còn chứa: ${dau} — sửa hàm gốc thì sửa bản sao trong bài kiểm này`);
}

const gt = encodeURIComponent('htuan82@gmail.com|1790000000|abc');   // PHP setcookie urlencode giá trị
assert.equal(docCookieCong(`stm_sso=${gt}`, 'stm_sso'), gt, 'cookie đứng một mình');
assert.equal(docCookieCong(`a=1; stm_sso=${gt}; b=2`, 'stm_sso'), gt, 'cookie nằm giữa');
assert.equal(docCookieCong(`stm_sso_khac=${gt}`, 'stm_sso'), null, 'tên chỉ trùng tiền tố thì không tính');
assert.equal(docCookieCong('a=1', 'stm_sso'), null, 'không có cookie');

assert.equal(docTraLoiCong('{"email":"Htuan82@Gmail.com"}'), 'htuan82@gmail.com', 'chuẩn hoá chữ thường');
assert.equal(docTraLoiCong('{"email":null}'), null, 'cổng nói không ai');
assert.equal(docTraLoiCong('<html>403 Forbidden</html>'), null, 'trang lỗi không phải JSON');
assert.equal(docTraLoiCong('{"email":"khong-phai-email"}'), null, 'chuỗi không phải email');
console.log('✓ check-sso-cookie: 8/8');
