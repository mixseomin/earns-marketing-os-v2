// Chạy trên MacBook (FB htuan82 sống ở bản hồ sơ MacBook, br use 411): node scripts/fb/bat-lai-page.mjs <page_id> … — danh sách Page đã tắt: Facebook › Pages › Deactivated and deleted Pages › See all (settings/reactivation).
// bật lại từng Page đã tắt của htuan82 (anh 25/10/2026 "bật lại FB page") — một Page một lượt, về tài khoản cá nhân sau mỗi lượt, dừng khi gặp mật khẩu / xác minh
import { execFileSync } from 'node:child_process';
const br = (...a) => { try { return execFileSync(`${process.env.HOME}/bin/br`, a, { encoding: 'utf8', env: { ...process.env, BR_URL_NGUON: 'trang Reactivation mở bằng nút See all ở Pages lúc 01:50 25/10 (chính phiên này đã đứng ở đó)' }, timeout: 60000 }).trim().split('\n').pop(); } catch (e) { return `LOI ${String(e.stderr || e.message).split('\n').filter(Boolean).pop()}`; } };
const ngu = (s) => new Promise((r) => setTimeout(r, s * 1000));
const ai = () => br('eval', `(()=>{if(document.querySelector('input[type=password]'))return 'MAT_KHAU';if(/checkpoint/.test(location.href))return 'XAC_MINH';return [...document.querySelectorAll('span')].map(s=>s.innerText).find(t=>/on your mind/.test(t))||location.href})()`);
for (const id of process.argv.slice(2)) {
  br('use', '411'); br('goto', 'https://web.facebook.com/settings/reactivation'); await ngu(7);
  const r = br('eval', `(()=>{if(document.querySelector('input[type=password]'))return 'MAT_KHAU';const t=[...document.querySelectorAll('span,div')].find(e=>e.innerText&&e.innerText.trim()==='Deactivated profile • ${id}');if(!t)return 'KHONG_THAY';let el=t;for(let i=0;i<8&&el;i++){el=el.parentElement;const b=[...el.querySelectorAll('[role=button],button')].find(x=>x.innerText.trim()==='Reactivate');if(b){b.setAttribute('data-bat','${id}');return 'OK'}}return 'KHONG_NUT'})()`);
  if (r !== 'OK') { console.log(`${id}: ${r}`); if (r === 'MAT_KHAU') process.exit(2); continue; }
  br('click', `[data-bat="${id}"]`); await ngu(6);
  const sau = ai(); console.log(`${id}: bấm xong → ${sau}`);
  if (/MAT_KHAU|XAC_MINH/.test(sau)) { console.log('DỪNG: Facebook đòi xác minh'); process.exit(2); }
  br('eval', `document.querySelector('[aria-label="Account, your profile"]')?.setAttribute('data-acc','1');'ok'`); br('click', '[data-acc="1"]'); await ngu(3);
  br('eval', `(()=>{const b=[...document.querySelectorAll('[role=dialog] [role=button], [role=dialog] a')].find(x=>x.innerText.trim()==='Nguyen Hoang Tuan');if(b)b.setAttribute('data-ve','1');return !!b})()`); br('click', '[data-ve="1"]'); await ngu(6);
  console.log(`   về: ${ai()}`);
  await ngu(30);
}
