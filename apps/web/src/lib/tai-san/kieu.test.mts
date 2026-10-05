// node_modules/.bin/tsx apps/web/src/lib/tai-san/kieu.test.mts
import { strict as a } from 'node:assert';
import { shopChet } from './kieu';
const tk = [{ nen: 'udemy', handle: 'evergreen programming', status: 'banned' }, { nen: 'gumroad', handle: 'oldcc7391', status: 'closed' },
  { nen: 'gumroad', handle: 'frontporchpuzzles', status: 'active' }, { nen: 'kdp', handle: 'htuan82', status: 'active' }];
a.equal(shopChet('udemy', null, tk), 'banned');                // Udemy không ghi store → mọi tk udemy chết (05/10/2026)
a.equal(shopChet('gumroad', 'oldcc7391', tk), 'closed');
a.equal(shopChet('gumroad', 'frontporchpuzzles', tk), null);
a.equal(shopChet('gumroad', null, tk), null);                  // còn một tk sống → không chết
a.equal(shopChet('kdp', 'htuan82', tk), null);
a.equal(shopChet('etsy', 'FrontPorchZ', tk), null);            // không có hồ sơ vault → không kết luận chết
console.log('shopChet: 6/6 ok');
