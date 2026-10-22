// BÁO DANH SÁCH CHỜ: sản phẩm đã lên store → gửi MỘT thư cho mọi email đăng ký chờ (app_cho_tin, 0308) rồi ghi bao_luc. Không gửi lần hai.
// Gọi từ scripts/theo-doi-duyet.mjs khi một sản phẩm đổi sang 'published' (khoá sp = slug trang clane.app/<sp>/), hoặc chạy tay:
//   node scripts/bao-cho-tin.mjs <sp> <ten> <url-store> [--dry]      node scripts/bao-cho-tin.mjs --tu-kiem
// Gửi qua MailBaby (relay.mailbaby.net:587, khoá /root/.secrets/mailbaby.env), từ hello@clane.app, ký DKIM mailer._domainkey.clane.app
// (/root/.secrets/dkim-clane.pem). DNS clane.app: SPF có box3 + spf-c.mailbaby.net, _mailbaby TXT, DMARC p=none (23/10/2026).
import fs from 'node:fs';
import nodemailer from 'nodemailer';

export function thu(ten, url, sp) {
  const sach = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
  return {
    subject: `${ten} is out`,
    text: `You asked us to tell you when ${ten} is available. It is now:\n\n${url}\n\nThat's the only email we'll send about it. Your address is removed from the list now.\n\nClane · https://clane.app/${sp}/`,
    html: `<p>You asked us to tell you when <b>${sach(ten)}</b> is available. It is now:</p><p><a href="${sach(url)}">${sach(url)}</a></p><p style="color:#666">That's the only email we'll send about it. Your address is removed from the list now.</p><p style="color:#666">Clane · <a href="https://clane.app/${sach(sp)}/">clane.app/${sach(sp)}</a></p>`,
  };
}

export async function baoChoTin(sp, ten, url, { dry = false } = {}) {
  const env = Object.fromEntries(fs.readFileSync('/root/.secrets/mailbaby.env', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => l.replace(/^export\s+/, '').split(/=(.*)/s).slice(0, 2).map((x) => x.trim().replace(/^["']|["']$/g, ''))));
  const { default: postgres } = await import('postgres');
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    const ds = await sql`SELECT id, email FROM app_cho_tin WHERE sp = ${sp} AND bao_luc IS NULL ORDER BY id`;
    if (!ds.length || dry) return { gui: 0, cho: ds.length };
    const tx = nodemailer.createTransport({ host: 'relay.mailbaby.net', port: 587, secure: false, requireTLS: true, auth: { user: env.MBUSER, pass: env.MBPASS },
      dkim: { domainName: 'clane.app', keySelector: 'mailer', privateKey: fs.readFileSync('/root/.secrets/dkim-clane.pem', 'utf8') } });
    const m = thu(ten, url, sp); let gui = 0;
    for (const r of ds) {
      try {
        await tx.sendMail({ from: 'Clane <hello@clane.app>', to: r.email, ...m, headers: { 'Auto-Submitted': 'auto-generated' } });
        await sql`UPDATE app_cho_tin SET bao_luc = now(), email = ${`da-bao-${r.id}@xoa.invalid`} WHERE id = ${r.id}`;   // gửi xong: xoá địa chỉ (hứa trong thư)
        gui++;
      } catch (e) { console.error(`✗ ${sp} #${r.id}: ${String(e.message).slice(0, 120)}`); }
    }
    return { gui, cho: ds.length };
  } finally { await sql.end(); }
}

if (process.argv[1]?.endsWith('bao-cho-tin.mjs')) {
  const a = process.argv.slice(2);
  if (a.includes('--tu-kiem')) {
    const { strict: t } = await import('node:assert');
    const m = thu('Side<cue>', 'https://apps.microsoft.com/detail/x', 'sidecue');
    t.ok(m.html.includes('Side&lt;cue&gt;') && !m.html.includes('<cue>'), 'tên sản phẩm được thoát HTML');
    t.ok(m.text.includes('https://apps.microsoft.com/detail/x') && m.subject === 'Side<cue> is out');
    console.log('bao-cho-tin: tự kiểm đạt');
  } else {
    const [sp, ten, url] = a.filter((x) => !x.startsWith('--'));
    if (!sp || !ten || !url) { console.error('cần: <sp> <ten> <url-store>'); process.exit(1); }
    console.log(JSON.stringify(await baoChoTin(sp, ten, url, { dry: a.includes('--dry') })));
  }
}
