#!/usr/bin/env node
// PHỦ adapter: kéo nhật ký click (/px) + cửa ra (/r/) của chatwhenbored* trên box2 → /api/phu/ingest.
//
// Chạy trên box3 (cron */15), đọc log qua ssh root@box2 từ byte offset đã ghi ở STATE (log xoay thì
// kích thước nhỏ hơn offset → đọc lại từ 0). Mỗi dòng thành một sự kiện, ma_don = sha1(dòng) nên chạy
// lại không nhân đôi. Bot/curl và IP thử của box3 bị bỏ. Kèm nhịp tim lander (mtime + số phòng).
//   env: MOS2_EXT_KEY (từ /opt/earns-marketing-os-v2/.env.production) · PHU_PROJECT (mặc định adfond)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const BOX2 = 'root@37.27.241.222';
const MOS2 = process.env.MOS2_URL || 'http://127.0.0.1:3821';
const KEY = process.env.MOS2_EXT_KEY;
const PROJECT = process.env.PHU_PROJECT || 'chatwhenbored';
const STATE_DIR = '/var/lib/mos2-phu';
const STATE = `${STATE_DIR}/log-box2.json`;
const LOGS = ['chatwhenbored', 'chatwhenbored-live', 'chatwhenbored-ai'];
const BOT = /bot|crawl|spider|curl|python|wget|headless|lighthouse|facebookexternalhit|preview/i;
const IP_THU = new Set(['2a01:4f8:1c16:9aaf::1', '127.0.0.1']);   // box3 tự test — không phải khách
if (!KEY) { console.error('thiếu MOS2_EXT_KEY'); process.exit(1); }

const ssh = (cmd) => execFileSync('ssh', ['-o', 'BatchMode=yes', BOX2, cmd], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
mkdirSync(STATE_DIR, { recursive: true });
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};

// Nền tảng đích của một cú /r/: referer /go/<slug>/ → slug; host live.* → chaturbate; còn lại = mặc định site.
const dichRa = (ref) => { const m = /\/go\/([a-z0-9-]+)\//.exec(ref || ''); if (m) return m[1]; if (/^https?:\/\/live\./.test(ref || '')) return 'chaturbate'; return 'chaturbate'; };
const sidTuPx = (q) => { const m = /(?:^|&)s=([^&]*)/.exec(q || ''); return m ? decodeURIComponent(m[1]) : ''; };
const px = (q, k) => { const m = new RegExp(`(?:^|&)${k}=([^&]*)`).exec(q || ''); return m ? decodeURIComponent(m[1]) : ''; };

const events = [];
let docThem = 0;
// Postback Bidvertiser: "conversion" của mình = bấm phòng/CTA (click có bvc={BV_CLICKID}), KHÔNG phải pageview
// (họ cấm bắn theo pageview). Mỗi click id bắn một lần, nhớ trong STATE. Có tín hiệu này Bid Automation của
// Bidvertiser mới tự blacklist/nâng bid theo srcid (anh chốt 15/09/2026).
const BV_POSTBACK = 'http://secure.bidvertiser.com/performance/pc.dbm?ver=1.0&AID=15090630&CLICKID=%s&revenue=0';
const bvcClick = new Set();
state.bvcDaBan = Array.isArray(state.bvcDaBan) ? state.bvcDaBan : [];
// /x/ (conf.d/x-mua.conf trên box2): cửa 302 cho traffic MUA (ExoClick pop/native → offer). Khuôn xmua = ts, sid, d, referer,
// UA, ip, cờ bot nginx (7 cột). BOT KHÔNG BỎ: đó là thứ cần đếm theo zone (luật P3) — ghi loai 'bot', không cộng vào phễu.
const XMUA = [['chatwhenbored', 'xmua']];
for (const ten of LOGS) {
  for (const k of ['clicks', 'loira', ...(XMUA.some(([t]) => t === ten) ? ['xmua'] : [])]) {
    const f = `/var/log/nginx/${ten}-${k}.log`;
    const size = Number(ssh(`stat -c %s ${f} 2>/dev/null || echo 0`).trim());
    const key = `${ten}-${k}`;
    let off = Number(state[key] || 0);
    if (size < off) off = 0;                       // log xoay
    if (size === off) continue;
    const chunk = ssh(`tail -c +${off + 1} ${f}`);
    // Chỉ ăn tới hết dòng cuối cùng TRỌN VẸN; phần dở dang đọc lượt sau.
    const cat = chunk.lastIndexOf('\n');
    if (cat < 0) continue;
    const lines = chunk.slice(0, cat).split('\n');
    state[key] = off + Buffer.byteLength(chunk.slice(0, cat + 1));
    for (const line of lines) {
      const c = line.split('\t');
      // Hai khuôn log (conf.d/site-log.conf): clicks = ts, args, referer, UA, ip (5 cột);
      // loira = ts, sid, d, referer, UA, ip (6 cột). Đọc sai khuôn là mất sạch một nửa số (14/09).
      const la = k === 'clicks';
      if (c.length < (la ? 5 : 6)) continue;
      const ts = c[0], ua = la ? c[3] : c[4], ip = la ? c[4] : c[5], ref = la ? c[2] : c[3];
      if (k === 'xmua') {
        if (IP_THU.has(ip)) continue;
        const bot = c[6] === '1' || BOT.test(ua);
        const zone = (c[1] || '').split('_')[2] || '';
        events.push({ ts, loai: bot ? 'bot' : 'out', sid: c[1] || undefined, platform: /^cb/.test(c[2]) ? 'chaturbate' : /^jm/.test(c[2]) ? 'jerkmate' : /^candy/.test(c[2]) ? 'candy-ai' : c[2],
          mang: 'exoclick', ma_don: createHash('sha1').update(line).digest('hex').slice(0, 24), nguon_du_lieu: 'log-xmua', raw: { d: c[2], zone, ua: ua.slice(0, 120), ip } });
        docThem++;
        continue;
      }
      if (BOT.test(ua) || IP_THU.has(ip)) continue;
      const host = (ref.match(/^https?:\/\/([^/]+)/) || [])[1] || '';
      if (la) {
        const q = c[1];
        // d=view (tải trang, k=1 = còn khoá 18+) · d=vao (qua cổng) · còn lại = bấm ra (i = vị trí trong lưới).
        const d = px(q, 'd');
        const loai = d === 'view' ? 'view' : d === 'vao' ? 'gate' : 'click';
        const bvc = px(q, 'bvc');
        events.push({ ts, loai, sid: sidTuPx(q) || undefined, platform: loai === 'click' ? d || undefined : undefined, mang: host || undefined,
          ma_don: createHash('sha1').update(line).digest('hex').slice(0, 24), nguon_du_lieu: 'log-px', raw: { p: px(q, 'p'), r: px(q, 'r'), host, k: px(q, 'k') || undefined, i: px(q, 'i') || undefined, bvc: bvc || undefined, ua: ua.slice(0, 80) } });
        if (loai === 'click' && bvc) bvcClick.add(bvc);
      } else {
        events.push({ ts, loai: 'out', sid: c[1] || undefined, platform: dichRa(ref), mang: host || undefined,
          ma_don: createHash('sha1').update(line).digest('hex').slice(0, 24), nguon_du_lieu: 'log-loira', raw: { ref, d: c[2] } });
      }
      docThem++;
    }
  }
}

// Nhịp tim lander: mtime + số phòng đang hiện.
const landers = [];
for (const [host, path, docroot, ten, dich] of [
  ['live.chatwhenbored.com', '/', '/var/www/chatwhenbored-live/index.html', 'Girls live (Chaturbate rooms)', 'chaturbate'],
  ['live.chatwhenbored.com', '/couples/', '/var/www/chatwhenbored-live/couples/index.html', 'Couples live', 'chaturbate'],
  ['live.chatwhenbored.com', '/trans/', '/var/www/chatwhenbored-live/trans/index.html', 'Trans live', 'chaturbate'],
  ['ai.chatwhenbored.com', '/', '/var/www/chatwhenbored-ai/index.html', 'AI girlfriend (Candy.ai)', 'candy-ai'],
]) {
  const out = ssh(`if [ -f ${docroot} ]; then stat -c %Y ${docroot}; grep -o 'class="ph"' ${docroot} | wc -l; else echo 0; echo 0; fi`).trim().split('\n');
  const mtime = Number(out[0] || 0), so = Number(out[1] || 0);
  landers.push({ host, path, ten, dich, last_sinh: mtime ? new Date(mtime * 1000).toISOString() : null, so_muc: so || null, trang_thai: mtime ? 'song' : 'hong' });
}

let daBan = 0, banLoi = 0;
const daCo = new Set(state.bvcDaBan);
for (const id of bvcClick) {
  if (daCo.has(id)) continue;
  try { const r = await fetch(BV_POSTBACK.replace('%s', encodeURIComponent(id)), { signal: AbortSignal.timeout(8000) }); if (r.ok) { daBan++; state.bvcDaBan.push(id); } else banLoi++; }
  catch { banLoi++; }
}
state.bvcDaBan = state.bvcDaBan.slice(-5000);
const body = { project: PROJECT, events, landers, adapter: { key: 'log-box2', name: 'Nhật ký click + cửa ra (box2) + postback Bidvertiser', loai: 'cron', lich: '*/15 * * * *', ok: banLoi === 0, note: `${docThem} dòng mới, ${events.length} sự kiện · postback Bidvertiser ${daBan} bắn${banLoi ? `, ${banLoi} lỗi` : ''}` } };
const res = await fetch(`${MOS2}/api/phu/ingest`, { method: 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const j = await res.json().catch(() => null);
if (!res.ok || !j || j.ok !== true) { console.error('ingest', res.status, j ? JSON.stringify(j) : '(không phải JSON — bị đẩy sang login? kiểm middleware /api/phu/)'); process.exit(1); }
writeFileSync(STATE, JSON.stringify(state));
console.log(new Date().toISOString(), 'log-box2:', JSON.stringify(j), `| ${docThem} dòng`);
