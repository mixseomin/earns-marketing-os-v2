#!/usr/bin/env node
// BÁO ĐƠN RS BOOST (anh 10/11/2026: "gửi thông báo nếu có convert từ RS") — đọc doanh thu cổng CPS chính chủ ReelShort
// (cps.reelshort.com, tài khoản mikerey887 #675), so với lần đọc trước, có số mới thì nhắn chủ đề Telegram "Aff Convert".
//
// QUA API, KHÔNG MỞ TRÌNH DUYỆT (anh hỏi 11/11/2026 "dùng API của họ với token đỡ phải mở br được không"):
//   POST https://cps.reelshort.com/api/v1/bill/my-income   body {"page":1,"page_size":10}   Authorization: Bearer <token>
//   → {"code":0,"data":{yestoday_revenue, month_revenue, lath_mouth_settlement_revenue, can_withdrawal}}
// Dò 11/11/2026: trang My Earnings là Server Component nên trình duyệt KHÔNG gọi API — phải dò bằng cách gọi thẳng.
//   /api/v1/bill/estimate: GET trả 405, POST mọi khuôn body đã thử đều 400 "The system is busy" → bỏ, my-income đủ 4 chỉ số.
//   Thiếu Authorization: 401. Token nằm ở localStorage của cổng, đã lưu vault acct #675 kind=api ref=my-income khoá token_enc.
// Token hết hạn → API trả 401/403: script báo rõ để lấy lại token (mở cổng bằng br một lần, đọc localStorage, acct set --secret).
//
//   node apps/xuong-video/scripts/rsboost-don.mjs            đọc, so, báo khi có thay đổi
//   node apps/xuong-video/scripts/rsboost-don.mjs --xem      chỉ in số đang thấy, không nhắn, không ghi mốc
//   node apps/xuong-video/scripts/rsboost-don.mjs --bao-moi  nhắn kể cả khi không đổi (thử đường nhắn)
//
// Mốc lần trước ở ~/.cache/rsboost-don.json (KHÔNG để scratchpad: /private/tmp bị macOS xoá mỗi lần khởi động lại).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const SO = `${process.env.HOME}/.cache/rsboost-don.json`;
const TG = `${process.env.HOME}/bin/tg`;
const ACCT = `${process.env.HOME}/bin/acct`;
const API = 'https://cps.reelshort.com/api/v1/bill/my-income';
const ag = process.argv.slice(2), co = (t) => ag.includes(t);

/** Giờ Việt Nam cho mọi dòng chữ gửi anh (luật: không in giờ UTC). */
const gioVN = () => new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
const docMoc = () => { try { return JSON.parse(readFileSync(SO, 'utf8')); } catch { return null; } };
const ghiMoc = (d) => { mkdirSync(path.dirname(SO), { recursive: true }); writeFileSync(SO, JSON.stringify(d, null, 2)); };

/** Token từ vault (acct #675 api/my-income). KHÔNG in ra log / argv. */
function token() {
  const t = execFileSync(ACCT, ['reveal', '675', 'api', 'my-income', 'token'], { encoding: 'utf8', timeout: 90_000 }).trim();
  if (t.length < 40) throw new Error('vault không trả token RS Boost (acct 675 api my-income token)');
  return t;
}

/** Bốn chỉ số doanh thu. Nhãn tiếng Anh của cổng giữ nguyên làm khoá, thêm nhãn tiếng Việt để đọc. */
const NHAN = {
  yestoday_revenue: 'hôm qua',
  month_revenue: 'tháng này',
  lath_mouth_settlement_revenue: 'tháng trước đã chốt',
  can_withdrawal: 'rút được',
};

async function doc() {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${token()}` },
    body: JSON.stringify({ page: 1, page_size: 10 }),
    signal: AbortSignal.timeout(45_000),
  });
  const j = await r.json().catch(() => null);
  if (r.status === 401 || r.status === 403) throw new Error('token RS Boost hết hạn — mở cổng bằng br một lần, đọc localStorage "token", rồi acct set 675 api my-income --secret token=…');
  if (!r.ok || !j || j.code !== 0) throw new Error(`API RS Boost ${r.status}: ${JSON.stringify(j ?? {}).slice(0, 180)}`);
  return j.data ?? {};
}

const main = async () => {
  const so = await doc();
  const cu = docMoc();

  if (co('--xem')) {
    for (const [k, v] of Object.entries(so)) console.log(`${(NHAN[k] ?? k).padEnd(22)} ${v}`);
    console.log(`mốc lần trước: ${cu ? JSON.stringify(cu.so) : '(chưa có)'}`);
    return;
  }

  if (!cu) { ghiMoc({ so, luc: new Date().toISOString() }); console.log(`lần đầu: ghi mốc ${Object.keys(so).length} chỉ số, chưa báo`); return; }

  const doi = Object.entries(so).filter(([k, v]) => cu.so?.[k] !== v);
  if (!doi.length && !co('--bao-moi')) { console.log(`không đổi (${gioVN()})`); return; }

  const bang = doi.map(([k, v]) => `${(NHAN[k] ?? k).padEnd(22)} ${String(cu.so?.[k] ?? '-').padStart(9)} → ${String(v).padStart(9)}`).join('\n');
  const tin = `<b>RS Boost - doanh thu đổi</b>\n<pre>${bang || '(không dòng nào đổi)'}</pre>\nĐọc lúc ${gioVN()} · Page Mia Calloway`;
  const tep = `${process.env.HOME}/.cache/rsboost-tin.html`;
  writeFileSync(tep, tin);
  try { execFileSync(TG, ['send', 'mine', '--topic', 'Aff Convert', '--file', tep], { encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] }); console.log(`đã báo ${doi.length} dòng đổi`); }
  catch (e) { console.error(`gửi Telegram hỏng: ${String(e.message).slice(0, 200)}`); }
  ghiMoc({ so, luc: new Date().toISOString() });
};

main().catch((e) => { console.error(`rsboost-don: ${e.message}`); process.exit(1); });
