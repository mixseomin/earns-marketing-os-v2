// VIDEOEXPRESS — MỘT tệp cho nền tảng này (anh 29/10/2026: "mỗi nền tảng luôn phải có file mjs riêng nếu nó là riêng biệt"): phiên, đăng nhập, đóng.
// Gọi API sinh (upload / image2video / TTS / ảnh) nằm ở vx-br.mts; máy sinh kể chuyện (ethopex/may-sinh-ke-chuyen.mjs) và mọi script khác mở phiên QUA ĐÂY.
// PROFILE RIÊNG (anh 29/10/2026 "cần tạo 1 br htuan82 mới cho việc chạy video này"): .capture-profile-htuan82-vx (vault profile #65, tài khoản #677) — máy chạy nền
// không đụng profile htuan82 chính của anh. Phiên giữ bằng cookie REMEMBERME của VideoExpress.
// ĐĂNG NHẬP khi phiên rụng: br prefill điền email + mật khẩu VAULT (không in ra) → KIỂM ô trước khi gửi (ô mật khẩu có chữ, KHÁC email — lỗi 29/10: prefill điền email
// vào ô id "login-password", gửi hai lần "Invalid username or password") → gửi ĐÚNG MỘT LẦN → kiểm đã vào app. Sai thì DỪNG, không thử lại (tránh khoá tài khoản).
//   node apps/xuong-video/scripts/videoexpress.mjs mo | dong | kiem
import { execFileSync } from 'node:child_process';

export const PROFILE = '/Users/htuan/Me/Earns/courseforge-demo/.capture-profile-htuan82-vx';
export const ACCT = '677';
export const APP = 'https://app.videoexpress.ai/';
const BR = `${process.env.HOME}/bin/br`;
const br = (...a) => execFileSync(BR, a, { encoding: 'utf8', timeout: 180e3 }).trim();
const evalMain = (js) => { const o = br('eval', '--main', js).split('\n').pop(); try { return JSON.parse(o); } catch { return o; } };
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const trang = () => evalMain('({url:location.href, app: !!document.body && /Create with AI/.test(document.body.innerText)})');

/** đăng nhập bằng mật khẩu vault — chỉ gọi khi đang ở /login. Ném lỗi (không thử lại) nếu ô sai hoặc VideoExpress từ chối. */
export async function dangNhap() {
  br('prefill');
  // prefill dò nút SSO tới 8 giây rồi mới điền → chờ tới khi ô mật khẩu có giá trị
  let o = {};
  for (let i = 0; i < 15; i++) {
    o = evalMain('(()=>{const u=document.querySelector("#login-username,[name=_username]"),p=document.querySelector("#login-password,[name=_password]");return {u:u?u.value:"",pl:p?p.value.length:0,trung:!!(u&&p&&p.value&&p.value===u.value)}})()');
    if (o.pl) break; await ngu(1000);
  }
  if (!o.u || !o.pl) throw new Error(`VideoExpress: ô đăng nhập chưa được điền (email ${o.u ? 'có' : 'trống'}, mật khẩu ${o.pl ? 'có' : 'trống'}) — kiểm vault #${ACCT} có mật khẩu, KHÔNG gửi`);
  if (o.trung) throw new Error('VideoExpress: ô mật khẩu đang chứa EMAIL — KHÔNG gửi (lớp lỗi prefill 29/10/2026)');
  evalMain('(()=>{const f=document.querySelector("#login-password,[name=_password]").form;f.requestSubmit();return 1})()');
  for (let i = 0; i < 20; i++) {
    await ngu(1500);
    const t = trang();
    if (t.app && !/\/login/.test(t.url)) return true;
    const loi = evalMain('(document.body.innerText.match(/Invalid[^\\n]*/)||[""])[0]');
    if (loi) throw new Error(`VideoExpress từ chối đăng nhập: "${loi}" — mật khẩu vault #${ACCT} sai/cũ; anh cập nhật vault (browsers-setpass) rồi chạy lại. Không thử lại.`);
  }
  throw new Error('VideoExpress: gửi đăng nhập rồi mà không vào được app sau 30 giây');
}

/** mở phiên làm việc: profile riêng → cổng br use → app; phiên rụng thì đăng nhập một lần */
export async function moPhien() {
  br('open', PROFILE); br('use', ACCT); br('goto', APP);
  let t = trang();
  if (/\/login/.test(t.url)) { await dangNhap(); t = trang(); }
  if (!t.app) throw new Error(`VideoExpress: không vào được app (đang ở ${t.url})`);
  return true;
}
/** đóng phiên profile riêng (dọn cửa sổ Chrome sau mỗi lượt) */
export function dongPhien() { try { br('close', PROFILE); } catch { /* đã đóng */ } }

if (import.meta.url === `file://${process.argv[1]}`) {
  const lenh = process.argv[2] ?? 'kiem';
  try {
    if (lenh === 'mo') { await moPhien(); console.log('✓ VideoExpress đã mở, đang đăng nhập'); }
    else if (lenh === 'dong') { dongPhien(); console.log('✓ đã đóng phiên VideoExpress'); }
    else { await moPhien(); console.log(`✓ phiên VideoExpress sống (${PROFILE})`); dongPhien(); }
  } catch (e) { console.error(`✗ ${e.message}`); process.exit(1); }
}
