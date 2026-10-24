// tài nguyên: dải cảnh báo CHỈ hiện khi tới gần khu Tài nguyên (toàn cảnh ẩn), biểu đồ lãi Ethopex chỉ hiện khi tới gần, nút ✥ gom cụm điều hướng; dải cảnh báo (việc gấp nhất + danh sách bấm bay tới, tự đóng), thẻ bồn khi rê, vòng hạn máy chủ · node tai-nguyen.mjs <tệp thử>.html [thư mục ảnh]
import { chromium } from '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs';
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 850 } }); p.on('pageerror', (e) => console.log('LOI', e.message));
const raAnh = process.argv[3];
await p.goto('file://' + process.argv[2]); await p.waitForTimeout(3000); await p.evaluate(() => { document.querySelector('.goi-y')?.remove(); document.querySelector('.ben .wg-x')?.click(); });
const tim = async (chu) => { await p.evaluate((c) => { const i = document.querySelector('.tim input'); i.value = c; i.dispatchEvent(new Event('input', { bubbles: true })); }, chu); await p.waitForTimeout(300); await p.evaluate(() => document.querySelector('.tim-ds button')?.click()); await p.waitForTimeout(2600); await p.evaluate(() => document.querySelector('.ngan .wg-x')?.click()); await p.mouse.move(5, 845); await p.waitForTimeout(400); };
const dai_ = () => p.evaluate(() => document.querySelector('.tn-canh').hidden);
const bd = () => p.evaluate(() => document.querySelector('.tp').__soGan());
console.log('toàn cảnh — dải:', (await dai_()) ? '✓ ẩn' : '— SAI, vẫn hiện', '· nhãn / biểu đồ "tới gần":', (await bd()) === 0 ? '✓ không vẽ cái nào' : '— SAI, đang vẽ ' + await bd());
console.log('nút điều hướng thu gọn:', await p.evaluate(() => [...document.querySelectorAll('.dieu > button')].filter((x) => x.offsetParent).length) === 1 ? '✓ chỉ còn ✥' : '— SAI');
await p.click('.dieu-mo'); console.log('bấm ✥ mở:', await p.evaluate(() => [...document.querySelectorAll('.dieu > button')].filter((x) => x.offsetParent).length) > 6 ? '✓' : '— SAI'); await p.click('.dieu-mo');
await tim('Ethopex'); console.log('tới Ethopex — biểu đồ lãi:', (await bd()) >= 1 ? '✓ hiện' : '— SAI, không hiện', '·', (await dai_()) ? 'dải ẩn ✓' : 'dải hiện — SAI');
if (raAnh) await p.screenshot({ path: raAnh + '/tn-ethopex.png' });
await tim('Đài theo dõi'); console.log('tới khu Tài nguyên — dải:', (await dai_()) ? '— SAI, vẫn ẩn' : '✓ hiện: ' + await p.evaluate(() => document.querySelector('.tn-canh').innerText.replace(/\n/g, ' · ')));
if (raAnh) await p.screenshot({ path: raAnh + '/tn-gan.png' });
await p.click('.tn-canh > button'); await p.waitForTimeout(200); console.log('danh sách:', await p.evaluate(() => [...document.querySelectorAll('.tn-canh .ds button')].map((x) => x.innerText.replace(/\n/g, ' ')).join(' | ')));

await p.click('.tn-canh .ds button[data-i="0"]'); await p.waitForTimeout(2600); await p.evaluate(() => document.querySelector('.ngan .wg-x')?.click());
await p.keyboard.down('Shift'); await p.mouse.move(700, 425); await p.mouse.wheel(0, 300); await p.keyboard.up('Shift'); await p.mouse.move(5, 845); await p.waitForTimeout(1500);

let v = null; for (let y = 150; y < 700 && !v; y += 15) for (let x = 500; x < 1000 && !v; x += 15) { await p.mouse.move(x, y); await p.waitForTimeout(25); const d = await p.evaluate(() => document.querySelector('.tp').__dangSang()); if (d?.loai === 'binh') v = { x, y }; }
console.log('dải sau khi bay:', await p.evaluate(() => document.querySelector('.tn-canh .ds') ? 'VẪN MỞ — SAI' : 'đã đóng ✓')); if (v) await p.waitForTimeout(1300);
 const theBon = await p.evaluate(() => document.querySelector('.meo').hidden ? 'ẩn' : document.querySelector('.meo').innerText.replace(/\n/g, ' | ')); console.log('thẻ bồn:', theBon);
// vòng hạn: bấm dòng "máy … còn N ngày" trong dải → bay tới toà máy, toà phải có vòng vàng / đỏ quanh chân
await tim('Đài theo dõi'); await p.click('.tn-canh > button'); await p.waitForTimeout(200);
const iMay = await p.evaluate(() => [...document.querySelectorAll('.tn-canh .ds button[data-i]')].findIndex((x) => /máy/.test(x.textContent)));
if (iMay >= 0) { await p.click(`.tn-canh .ds button[data-i="${iMay}"]`); await p.waitForTimeout(2600); console.log('vòng hạn máy chủ:', await p.evaluate(() => document.querySelector('.tp').__vongHan()) > 0 ? '✓ có vòng quanh toà máy' : '— SAI, không có vòng'); }
else console.log('vòng hạn máy chủ: bỏ qua (không có máy sắp hết hạn trong số hiện tại)');
// ĐÀI THEO DÕI: nút "Theo dõi tất cả" trên dải → bay tới đài + mở bảng đầy đủ (bồn, máy chủ, tên miền), ô lọc chạy
await tim('Đài theo dõi'); await p.click('.tn-canh .mo-dai'); await p.waitForTimeout(2600);
const dai = await p.evaluate(() => { const n = document.querySelector('.ngan'); return n.hidden ? null : { ten: n.querySelector('.wg-ten').textContent, muc: [...n.querySelectorAll('.xg-ds summary')].map((x) => x.textContent.trim().slice(0, 30)), dong: n.querySelectorAll('.xg-ds > div').length }; });
console.log('đài theo dõi:', dai && /Theo dõi tài nguyên/.test(dai.ten) && dai.muc.length >= 2 ? `✓ ${dai.dong} dòng · ${dai.muc.join(' | ')}` : '— SAI ' + JSON.stringify(dai));
if (dai) { await p.fill('.ngan .xg-loc', 'wenoted'); await p.waitForTimeout(200); const con = await p.evaluate(() => [...document.querySelectorAll('.ngan .xg-ds > div')].filter((r) => !r.hidden && r.closest('details').open && r.offsetParent).length); console.log('lọc đài "wenoted":', con === 1 ? '✓ còn 1 dòng, nhìn thấy (mục tự mở)' : `— SAI thấy ${con} dòng`); if (raAnh) await p.screenshot({ path: raAnh + '/dai-tn.png' }); }
console.log('thẻ bồn có đủ mức + còn ngày:', /Mức/.test(theBon) && /Còn/.test(theBon) ? '✓' : '— SAI');
await b.close();
