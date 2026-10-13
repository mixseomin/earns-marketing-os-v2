// THẨM ĐỊNH MAIL BẢO MẬT — Phòng An toàn tài khoản (anh 13/10/2026: "mail từ amazon.in có thật không? thực tế không có contact nào cả").
// Thư "xác nhận liên hệ / đăng nhập mới / đổi mật khẩu / mã OTP / thanh toán" là chỗ kẻ gian ra tay theo HAI đường, máy tách hai đường:
//   (1) THƯ GIẢ: tên người gửi giả nền tảng, link dẫn sang tên miền khác → bắt bằng tên miền THẬT của từng link (gỡ cả link chuyển tiếp ?U=…).
//   (2) THƯ THẬT, YÊU CẦU GIẢ: kẻ gian gọi CSKH / đăng nhập mạo danh, nền tảng gửi thư thật xin chủ duyệt → link đúng mà KHÔNG được bấm Duyệt
//       nếu chủ không tự làm. Máy không biết anh có tự làm không → hỏi đúng câu đó, kèm việc cần làm.
// Nguồn: hòm claude@orit.app (Directus claude_inbox, anh chuyển tiếp thư nghi vấn vào). Thư chuyển tiếp mất header gốc (SPF/DKIM) → kết luận dựa
// trên link, ghi rõ điều đó. Thư đã đọc / lưu trữ trong hòm = việc đã xử (không còn là việc cần người).
//   node worker/mail-bao-mat.mjs            thư bảo mật 30 ngày qua + kết luận (cần DIRECTUS_URL + DIRECTUS_TOKEN — chạy trên box3)
//   node worker/mail-bao-mat.mjs --tu-kiem
const SLD = new Set(['co', 'com', 'net', 'org', 'gov', 'ac', 'edu']);
/** Tên miền đăng ký: www.amazon.co.uk → amazon.co.uk · smile.amazon.in → amazon.in. */
export function mienGoc(host) {
  const p = String(host).toLowerCase().replace(/\.$/, '').split('.');
  return p.slice(p.length >= 3 && SLD.has(p.at(-2)) && p.at(-1).length === 2 ? -3 : -2).join('.');
}
/** Nhãn thương hiệu: amazon.co.uk / amazon.in → amazon (cùng một nhà ở nhiều nước). */
const nhan = (mien) => mien.split('.')[0];
/** Nhà thật anh đang có tài khoản — chỉ thư của những nhà này mới được gọi là "thư thật". ponytail: danh sách tay; dùng nền tảng mới thì thêm một
 *  dòng (không có tên ở đây → máy nói "tên miền lạ", không bao giờ nói "thật"). Tên nhái (paypa1, amaz0n) rơi vào nhánh lạ. */
export const NHA = new Set(['amazon', 'google', 'youtube', 'apple', 'icloud', 'paypal', 'etsy', 'gumroad', 'stripe', 'payoneer', 'wise', 'udemy', 'facebook',
  'facebookmail', 'meta', 'instagram', 'tiktok', 'pinterest', 'printables', 'cloudflare', 'hetzner', 'github', 'microsoft', 'mailjet', 'okx', 'telegram', 'x', 'twitter']);
const LOAI = [
  ['xac-nhan-lien-he', /confirm (that )?you('|’)?re contacting|customer service wants to confirm|approve (or deny|this request)|xác nhận.*liên hệ/i, 'xác nhận liên hệ CSKH'],
  ['dang-nhap', /sign-?in|log-?in|new device|unrecognized|đăng nhập|thiết bị mới/i, 'đăng nhập'],
  ['mat-khau', /password|reset your|mật khẩu/i, 'mật khẩu'],
  ['otp', /one-time|\bOTP\b|verification code|security code|mã xác (minh|nhận)/i, 'mã xác minh'],
  ['thanh-toan', /payment|billing|card ending|refund|thanh toán/i, 'thanh toán'],
];
export const TEN_LOAI = Object.fromEntries(LOAI.map(([k, , t]) => [k, t]));
const chu = (html) => String(html).replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?>|<\/(p|div|tr)>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
/** Mọi link (href) → host thật; link chuyển tiếp (tham số mang URL: U, url, u, q, target, redirect) gỡ thêm một lớp. */
export function tachLink(html) {
  const ra = [];
  for (const m of String(html).matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    let u; try { u = new URL(m[1].replace(/&amp;/g, '&')); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    ra.push(u.hostname);
    for (const [, v] of u.searchParams) if (/^https?:\/\//i.test(v)) { try { ra.push(new URL(v).hostname); } catch { /* không phải URL */ } }
  }
  return [...new Set(ra)];
}
/** Người gửi THẬT: thư chuyển tiếp → địa chỉ trong khối "From:" của thư gốc; không thì người gửi của thư. */
export function nguoiGui(from, html) {
  const t = chu(html), i = t.search(/Forwarded message|Begin forwarded message|Thư được chuyển tiếp|-----Original Message/i);
  const m = i >= 0 && t.slice(i).match(/(?:From|Từ):[^\n@]*?([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/i);
  return { gui: (m ? m[1] : String(from)).toLowerCase(), chuyenTiep: i >= 0 };
}
/** Kết luận một thư: { gui, mien, loai[], links, la (host khác nhà người gửi), ket: 'gia'|'that'|'chua-ro', chu, viec }. */
export function thamDinh({ from, subject = '', html = '' }) {
  const { gui, chuyenTiep } = nguoiGui(from, html);
  const mien = gui.includes('@') ? mienGoc(gui.split('@')[1]) : '';
  const t = `${subject}\n${chu(html)}`, loai = LOAI.filter(([, re]) => re.test(t)).map(([k]) => k);
  const links = tachLink(html), la = mien ? links.filter((h) => nhan(mienGoc(h)) !== nhan(mien)) : [];
  const dkim = chuyenTiep ? ' (thư chuyển tiếp mất header gốc nên chưa đọc được chữ ký DKIM — kết luận theo link)' : '';
  if (!mien) return { gui, mien, loai, links, la, ket: 'chua-ro', chu: 'Không đọc được địa chỉ người gửi.', viec: 'Không bấm link nào; chuyển tiếp lại thư dạng tệp đính kèm (.eml) để đọc header.' };
  if (la.length) return { gui, mien, loai, links, la, ket: 'gia', chu: `THƯ GIẢ: mang tên ${mien} nhưng link dẫn sang ${la.slice(0, 3).join(', ')}.`, viec: 'Không bấm link, không nhập gì; xoá thư. Đã lỡ bấm/nhập → đổi mật khẩu ngay trên trang thật (gõ tay địa chỉ) + bật xác minh 2 lớp.' };
  if (!NHA.has(nhan(mien))) return { gui, mien, loai, links, la, ket: 'chua-ro', chu: `Tên miền ${mien} không phải nhà anh có tài khoản (worker/mail-bao-mat.mjs NHA) — tên nhái hay gặp.`, viec: 'Coi như giả: không bấm link, không trả lời. Đúng là nhà mới anh dùng thì thêm tên vào NHA.' };
  if (!links.length) return { gui, mien, loai, links, la, ket: 'chua-ro', chu: `Thư mang tên ${mien}, không có link để đối chiếu${dkim}.`, viec: 'Không trả lời thư; kiểm thẳng trên trang thật (gõ tay địa chỉ).' };
  const yeuCau = loai.some((k) => ['xac-nhan-lien-he', 'dang-nhap', 'mat-khau', 'otp'].includes(k));
  return { gui, mien, loai, links, la, ket: 'that', chu: `Thư thật của ${mien}: mọi link về ${[...new Set(links.map(mienGoc))].join(', ')}${dkim}.`,
    viec: yeuCau ? `Anh KHÔNG tự làm việc này (${loai.map((k) => TEN_LOAI[k]).join(', ')}) → có người mạo danh: KHÔNG bấm Approve/Duyệt (bấm Deny nếu có), đổi mật khẩu + bật xác minh 2 lớp trên ${mien} (gõ tay địa chỉ, không qua link thư), xem "thiết bị đã đăng nhập".`
      : 'Thư thông báo, không đòi duyệt gì — đọc rồi lưu trữ.' };
}

// Đọc hòm: thư 30 ngày có dấu hiệu bảo mật (tiêu đề / đoạn đầu) → kết luận. Lỗi đọc trả null (trang hiện lỗi, không giấu thành "không có thư").
const DAU = ['confirm', 'verif', 'sign-in', 'sign in', 'login', 'log in', 'password', 'security', 'account', 'suspend', 'unusual', 'otp', 'code', 'payment', 'xác nhận', 'đăng nhập', 'mật khẩu', 'bảo mật'];
export async function docMailBaoMat({ ngay = 30, url = process.env.DIRECTUS_URL, token = process.env.DIRECTUS_TOKEN } = {}) {
  if (!url || !token) return null;
  const tu = new Date(Date.now() - ngay * 86_400_000).toISOString();
  const q = new URLSearchParams({ limit: '60', sort: '-captured_at', fields: 'id,from_addr,from_name,subject,body_html,captured_at,status',
    filter: JSON.stringify({ _and: [{ captured_at: { _gte: tu } }, { _or: DAU.flatMap((k) => [{ subject: { _icontains: k } }, { snippet: { _icontains: k } }]) }] }) });
  try {
    const r = await fetch(`${url}/items/claude_inbox?${q}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    return (await r.json()).data.map((m) => ({ id: m.id, luc: m.captured_at, tieuDe: String(m.subject ?? '').replace(/^(fwd?|tr|chuyển tiếp):\s*/i, ''), xong: m.status !== 'new',
      ...thamDinh({ from: m.from_addr, subject: m.subject, html: m.body_html }) })).filter((m) => m.loai.length || m.la.length);
  } catch { return null; }
}

if (process.argv[1]?.endsWith('mail-bao-mat.mjs') && process.argv.includes('--tu-kiem')) {
  const { strict: a } = await import('node:assert');
  a.equal(mienGoc('www.amazon.co.uk'), 'amazon.co.uk'); a.equal(mienGoc('smile.amazon.in'), 'amazon.in'); a.equal(mienGoc('amazon-in.verify-acct.top'), 'verify-acct.top');
  // thư thật amazon.in 13/10/2026 (anh chuyển tiếp từ iPhone): link qua bộ chuyển tiếp gp/f.html, đích thật nằm ở tham số U
  const THAT = '<div>Begin forwarded message:</div><b>From:</b> "amazon.in" &lt;account-update@amazon.in&gt;<br>Subject: amazon.in: Account confirmation request<br>'
    + 'Amazon Customer Service wants to confirm you\'re contacting us. To confirm it\'s you, approve this request'
    + '<a href="https://www.amazon.in/gp/f.html?C=1&amp;U=https%3A%2F%2Fwww.amazon.in%2Fa%2Fc%2Fr%2F8Y%3Fref_%3Dpe">Approve</a><a href="https://www.amazon.in/gp/r.html?U=https%3A%2F%2Fwww.amazon.in">x</a>';
  const t = thamDinh({ from: 'htuan82@gmail.com', subject: 'Fwd: amazon.in: Account confirmation request', html: THAT });
  a.equal(t.gui, 'account-update@amazon.in'); a.equal(t.ket, 'that'); a.ok(t.loai.includes('xac-nhan-lien-he')); a.match(t.viec, /KHÔNG bấm Approve/); a.match(t.chu, /DKIM/);
  // thư giả: cùng tên, link gỡ ra dẫn sang tên miền lạ (kể cả giấu trong tham số chuyển tiếp)
  const GIA = THAT.replace('https%3A%2F%2Fwww.amazon.in%2Fa%2Fc', 'https%3A%2F%2Famazon-in.verify-acct.top%2Fa%2Fc');
  const g = thamDinh({ from: 'htuan82@gmail.com', subject: 'Fwd: amazon.in', html: GIA }); a.equal(g.ket, 'gia'); a.deepEqual(g.la, ['amazon-in.verify-acct.top']);
  a.equal(thamDinh({ from: 'no-reply@accounts.google.com', html: '<a href="https://accounts.google.com/x">Check activity</a> New sign-in on Mac' }).ket, 'that');   // thư gửi thẳng (không chuyển tiếp)
  a.equal(thamDinh({ from: 'security@paypa1-support.com', html: '<a href="https://paypa1-support.com/login">Confirm</a> unusual sign-in' }).ket, 'chua-ro');   // tên miền nhái, link cùng nhà nhái → không bao giờ "thật"
  a.equal(thamDinh({ from: 'x', html: '' }).ket, 'chua-ro');
  console.log('✓ mail-bao-mat: 12 ca đạt (tên miền đăng ký, gỡ link chuyển tiếp, người gửi thư chuyển tiếp, thư thật yêu cầu giả, thư giả, tên miền nhái, không đọc được người gửi)');
}
if (process.argv[1]?.endsWith('mail-bao-mat.mjs') && !process.argv.includes('--tu-kiem')) {
  const ds = await docMailBaoMat();
  if (!ds) { console.error('✗ không đọc được hòm (thiếu DIRECTUS_URL / DIRECTUS_TOKEN hoặc Directus lỗi)'); process.exit(1); }
  for (const m of ds) console.log(`${m.luc.slice(0, 16)} ${m.xong ? '✓ đã xử' : '● chờ'} [${m.ket}] ${m.tieuDe}\n   ${m.chu}\n   → ${m.viec}`);
  console.log(`${ds.length} thư bảo mật 30 ngày qua`);
}
