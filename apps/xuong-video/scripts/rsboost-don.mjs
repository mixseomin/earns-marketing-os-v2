#!/usr/bin/env node
// BÁO ĐƠN RS BOOST (anh 10/11/2026: "gửi thông báo nếu có convert từ RS") — đọc My Earnings của cổng CPS chính chủ ReelShort
// (cps.reelshort.com, tài khoản mikerey887 #675), so với lần đọc trước, có số mới thì nhắn vào chủ đề Telegram "Aff Convert".
//
// VÌ SAO ĐỌC BẰNG TRÌNH DUYỆT: RS Boost không công bố API; phiên đăng nhập nằm trong profile Chrome .capture-profile-ytaff-mikerey
// trên iMac, không mang sang máy chủ được. Nên việc này chạy ở iMac, không chạy trên box3.
//
//   node apps/xuong-video/scripts/rsboost-don.mjs            đọc, so, báo khi có thay đổi
//   node apps/xuong-video/scripts/rsboost-don.mjs --xem      chỉ in số đang thấy, không nhắn, không ghi mốc
//   node apps/xuong-video/scripts/rsboost-don.mjs --bao-moi  nhắn kể cả khi không đổi (để thử đường nhắn)
//
// Mốc lần trước lưu ở ~/.cache/rsboost-don.json (KHÔNG để trong scratchpad: /private/tmp bị macOS xoá mỗi lần khởi động lại).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const BR = `${process.env.HOME}/bin/br`;
const PROFILE = `${process.env.HOME}/Me/Earns/courseforge-demo/.capture-profile-ytaff-mikerey`;
const MOC = `${process.env.HOME}/.cache/rsboost-don.json`;
const TG = `${process.env.HOME}/bin/tg`;
const ag = process.argv.slice(2), co = (t) => ag.includes(t);

const br = (...a) => {
  try { return execFileSync(BR, a, { encoding: 'utf8', timeout: 180_000, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, BR_PROFILE: PROFILE } }).trim(); }
  catch (e) { return `__LOI__ ${((e.stdout || '') + (e.stderr || '')).slice(0, 200)}`; }
};
const brEval = (js) => { const r = br('eval', js); return r.startsWith('__LOI__') ? null : r.trim(); };
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

/** Số trên trang My Earnings: mọi cặp "nhãn → số" đọc được, để nhãn đổi vẫn không mất dữ liệu. */
function docSo(chu) {
  const ra = {};
  // Cổng in dạng "Total Earnings $12.34" / "New Users 5" — bắt nhãn chữ rồi số ngay sau.
  for (const m of chu.matchAll(/([A-Z][A-Za-z' ]{3,28}?)\s*[:：]?\s*(\$?\s?[\d,]+(?:\.\d{1,2})?)(?=\s|$)/g)) {
    const nhan = m[1].trim().replace(/\s+/g, ' ');
    if (/^(Content Hub|My Referral|My Earnings|Featured|Dramas|All rights|Release Date)/i.test(nhan)) continue;
    ra[nhan] = m[2].replace(/\s/g, '');
  }
  return ra;
}

const docMoc = () => { try { return JSON.parse(readFileSync(MOC, 'utf8')); } catch { return null; } };
const ghiMoc = (d) => { mkdirSync(path.dirname(MOC), { recursive: true }); writeFileSync(MOC, JSON.stringify(d, null, 2)); };

/** Giờ Việt Nam cho mọi dòng chữ gửi anh (luật: không in giờ UTC). */
const gioVN = () => new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });

async function doc() {
  const mo = br('open', PROFILE);
  if (mo.startsWith('__LOI__')) throw new Error(`khong mo duoc profile rsboost: ${mo}`);
  try {
    br('use', '675');
    br('goto', 'https://cps.reelshort.com/', '--here');
    await nghi(7000);
    // "My Earnings" là nút router của Next (thẻ a không href) → bấm bằng chính phần tử, rồi chờ mốc chữ trên trang.
    brEval(`(()=>{const a=[...document.querySelectorAll("a,button")].find(x=>(x.innerText||"").trim()==="My Earnings");if(a)a.click();return "ok"})()`);
    for (let i = 0; i < 12; i++) {
      await nghi(2500);
      const u = brEval('location.href') || '';
      if (/earning|income|revenue/i.test(u)) break;
    }
    await nghi(3000);
    const chu = JSON.parse(brEval(`JSON.stringify((document.body.innerText||"").replace(/\\s+/g," "))`) || '""');
    const url = (brEval('location.href') || '').replace(/^"|"$/g, '');
    return { chu, url };
  } finally { br('close', PROFILE); }
}

const main = async () => {
  const { chu, url } = await doc();
  if (!chu || chu.length < 40) throw new Error('trang My Earnings tra ve rong — phien co the da het hạn, mo lai profile de dang nhap');
  const so = docSo(chu);
  const cu = docMoc();

  if (co('--xem')) {
    console.log(`trang: ${url}`);
    console.log(`so doc duoc: ${JSON.stringify(so, null, 2)}`);
    console.log(`moc lan truoc: ${cu ? JSON.stringify(cu.so) : '(chua co)'}`);
    return;
  }

  const doi = Object.entries(so).filter(([k, v]) => !cu || cu.so?.[k] !== v);
  if (!cu) {
    ghiMoc({ so, luc: new Date().toISOString(), url });
    console.log(`lan dau: ghi moc ${Object.keys(so).length} chi so, chua bao`);
    return;
  }
  if (!doi.length && !co('--bao-moi')) { console.log(`khong doi (${gioVN()})`); return; }

  const bang = doi.map(([k, v]) => `${k.padEnd(22).slice(0, 22)} ${String(cu.so?.[k] ?? '-').padStart(10)} → ${String(v).padStart(10)}`).join('\n');
  const tin = `<b>RS Boost - số đã đổi</b>\n<pre>${bang || '(không có dòng nào đổi)'}</pre>\nĐọc lúc ${gioVN()} · Page Mia Calloway`;
  const tep = `${process.env.HOME}/.cache/rsboost-tin.html`;
  writeFileSync(tep, tin);
  try { execFileSync(TG, ['send', 'mine', '--topic', 'Aff Convert', '--file', tep], { encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] }); console.log(`da bao ${doi.length} dong doi`); }
  catch (e) { console.error(`gui Telegram hong: ${String(e.message).slice(0, 200)}`); }
  ghiMoc({ so, luc: new Date().toISOString(), url });
};

main().catch((e) => { console.error(`rsboost-don: ${e.message}`); process.exit(1); });
