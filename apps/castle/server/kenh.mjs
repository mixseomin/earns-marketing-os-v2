#!/usr/bin/env node
// MÁY CHỦ KÊNH NHIỀU NGƯỜI cho castle.on.tc — dịch vụ systemd castle-kenh (apps/castle/deploy/castle-kenh.service), cổng 127.0.0.1:3891, nginx castle.on.tc
// chuyển /mp/ vào đây (sau cổng SSO mos2). Kiểu kênh (giảm tải: người dồn vào nhiều kênh có trần, mỗi người chỉ nhận người ở gần):
//   kênh đông 1–4 (tối đa 25) · kênh yên tĩnh (tối đa 6) · phòng riêng theo mã 4 ký tự (tối đa 10, tự tạo khi có người vào, tự xoá khi trống).
// Danh tính: cookie mos2-session → bảng auth_sessions + users (đọc thẳng Postgres của mos2, không tự đặt mật khẩu riêng).
// Giao thức JSON: khách → {t:'vt', p:[x,y,z], h, s:{tt,toc,nen,ngoi}} (≤ 15 lần/s) · {t:'chat', c} (≤ 1 lần/s, ≤ 120 ký tự);
// máy chủ → {t:'chao', id, ten, kenh} · {t:'ds', n:[[id, ten, x, y, z, h, s]]} 10 lần/s, chỉ người trong 200 m · {t:'ra', id} · {t:'chat', id, ten, c} (trong 60 m).
// GET /mp/kenh?lau=<lâu đài> → danh sách kênh + số người. Thư viện: ws (websockets/ws, MIT) — tra-repo-ok: chọn sau bảng tra ws / Colyseus / PartyKit 15/11/2026.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { WebSocketServer } from 'ws';
import postgres from 'postgres';
import { timAnhQuanh } from './anh-quanh.mjs';
import { macDinh as taiMac } from './tai-mang.mjs';
taiMac.thu = 1; taiMac.choToiDa = 5; // người đang chờ nút 📷: thử lại một lần, chờ tối đa 5 s (lệnh kỹ sư giữ 6 lần / 120 s)

const CONG = +(process.env.CONG || 3891), GAN = 200, GAN_CHAT = 60, NHIP = 100;
const KIEU = [
  ...[1, 2, 3, 4].map((i) => ({ id: 'k' + i, ten: 'Kênh ' + i, kieu: 'dong', toiDa: 25 })),
  { id: 'yen', ten: 'Kênh yên tĩnh', kieu: 'yen', toiDa: 6 },
];
const TOI_DA_RIENG = 10, LAU = new Set(['neuschwanstein', 'dungnham']);
const env = (() => { try { return Object.fromEntries(readFileSync(new URL('../../../.env.production', import.meta.url), 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })); } catch { return {}; } })();
const sql = process.env.KENH_THU === '1' ? null : postgres(process.env.DATABASE_URL || env.DATABASE_URL, { max: 2, idle_timeout: 60 });

const phong = new Map(); // `${lau}/${kenh}` → Map(id → nguoi)
const tenPhong = (lau, kenh) => `${lau}/${kenh}`;
function demKenh(lau) {
  const ds = KIEU.map((k) => ({ ...k, so: phong.get(tenPhong(lau, k.id))?.size || 0 }));
  return { kenh: ds, rieng: [...phong.keys()].filter((k) => k.startsWith(lau + '/r-')).length, toiDaRieng: TOI_DA_RIENG };
}
const cache = new Map(); // phiên → { id, ten, het }
// CHỈ ĐỂ THỬ trên máy dev: KENH_THU=1 bỏ đọc phiên, lấy tên từ ?thu=<tên>. Đơn vị systemd không đặt biến này → máy chủ thật luôn đọc phiên mos2.
const THU = process.env.KENH_THU === '1';
async function danhTinh(cookie = '', url = null) {
  if (THU) { const t = url?.searchParams.get('thu'); return t ? { id: 'thu-' + t, ten: t.slice(0, 24), het: 0 } : null; }
  const tok = /(?:^|;\s*)mos2-session=([^;]+)/.exec(cookie)?.[1]; if (!tok) return null;
  const c = cache.get(tok); if (c && c.het > Date.now()) return c;
  const [r] = await sql`SELECT u.id, COALESCE(NULLIF(u.name, ''), split_part(u.email, '@', 1)) AS ten FROM auth_sessions s JOIN users u ON u.id = s.user_id
    WHERE s.session_token = ${decodeURIComponent(tok)} AND s.expires_at > now() AND s.revoked_at IS NULL LIMIT 1`;
  if (!r) return null; const v = { id: String(r.id), ten: String(r.ten).slice(0, 24), het: Date.now() + 60_000 }; cache.set(tok, v); return v;
}

// TRẠNG THÁI BÁO LỆCH (nút 🔍): CLI scripts/so-lech.mjs báo đang xử / đã xong qua POST /mp/lech (chỉ từ chính máy chủ — CLI chạy lệnh qua ssh, curl 127.0.0.1);
// trang hỏi GET /mp/lech mỗi 3 s: đang có việc → nút 🔍 nhún, vừa xong → nháy xanh + hiện báo cáo. Giữ trong tệp để khởi động lại không mất.
import { readFileSync as docTep, writeFileSync as ghiTep, mkdirSync as taoThu } from 'node:fs';
const TEP_LECH = '/var/lib/castle-kenh/lech.json';
let LECH = { dang: [], xong: [] }; try { LECH = JSON.parse(docTep(TEP_LECH, 'utf8')); } catch { /* chưa có tệp: bắt đầu trống */ }
const luuLech = () => { try { taoThu('/var/lib/castle-kenh', { recursive: true }); ghiTep(TEP_LECH, JSON.stringify(LECH)); } catch (e) { console.warn('[kenh] ghi lech.json lỗi', e.message); } };
// BÁO TELEGRAM khi một thẻ báo lệch XONG (anh 16/11/2026: "không phải lúc nào cũng ngồi canh màn hình"): nhóm MINE của anh, topic riêng "🏰 Lâu đài 3D"
// (tạo một lần, nhớ id trong /var/lib/castle-kenh/tg.json). Bot + nhóm: /root/.secrets/mine-tg.env (TG_BOT_TOKEN, TG_CHAT — vault MOS2 #476).
const TG = (() => { try { return Object.fromEntries(docTep('/root/.secrets/mine-tg.env', 'utf8').split('\n').map((l) => l.match(/^(\w+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()])); } catch { return {}; } })();
const TEP_TG = '/var/lib/castle-kenh/tg.json', escTg = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
async function tgGoi(phuong, than) { const r = await fetch(`https://api.telegram.org/bot${TG.TG_BOT_TOKEN}/${phuong}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(than) }); return r.json(); }
async function baoTelegram(x) {
  if (!TG.TG_BOT_TOKEN || !TG.TG_CHAT) { console.warn('[kenh] thiếu cấu hình Telegram'); return; }
  try {
    let topic = null; try { topic = JSON.parse(docTep(TEP_TG, 'utf8')).topic; } catch { /* chưa tạo */ }
    if (!topic) { const j = await tgGoi('createForumTopic', { chat_id: TG.TG_CHAT, name: '🏰 Lâu đài 3D' }); topic = j.result?.message_thread_id || null; if (topic) { taoThu('/var/lib/castle-kenh', { recursive: true }); ghiTep(TEP_TG, JSON.stringify({ topic })); } else console.warn('[kenh] không tạo được topic', JSON.stringify(j).slice(0, 200)); }
    const chu = `<b>✅ Báo lệch #${escTg(x.id)} đã xong</b>\n${escTg(x.tom)}${x.link ? `\n<a href="${escTg(x.link)}">Mở đúng góc trên castle.on.tc</a>` : ''}`;
    const j = await tgGoi('sendMessage', { chat_id: TG.TG_CHAT, ...(topic ? { message_thread_id: topic } : {}), text: chu.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true });
    if (!j.ok) console.warn('[kenh] gửi Telegram lỗi', JSON.stringify(j).slice(0, 200));
  } catch (e) { console.warn('[kenh] gửi Telegram lỗi', e.message); }
}
function xuLyLech(req, res) {
  if (req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(LECH)); return; }
  const ip = req.socket.remoteAddress || ''; if (req.headers['x-forwarded-for'] || !/^(::ffff:)?127\.0\.0\.1$|^::1$/.test(ip)) { res.writeHead(403).end('{}'); return; } // chỉ CLI trên máy chủ, không qua nginx
  let b = ''; req.on('data', (c) => { b += c; if (b.length > 20000) req.destroy(); });
  req.on('end', () => { try { const j = JSON.parse(b), id = String(j.id || '').slice(0, 40); if (!id) throw new Error('thiếu id');
    LECH.dang = LECH.dang.filter((x) => x.id !== id); LECH.xong = LECH.xong.filter((x) => x.id !== id);
    // cam + vung: góc + vùng người báo đánh dấu — trang mở lại đúng góc, vẽ lại vùng yêu cầu để so với kết quả
    const goc = JSON.stringify(j.cam || null).length < 600 ? j.cam || null : null, vung = JSON.stringify(j.vung || []).length < 3000 ? j.vung || [] : [];
    if (j.tt === 'dang') LECH.dang.push({ id, viec: String(j.viec || '').slice(0, 200), luc: Date.now(), cam: goc, vung });
    else { const x = { id, tom: String(j.tom || '').slice(0, 1500), link: String(j.link || '').slice(0, 300), luc: Date.now(), cam: goc, vung }; LECH.xong.unshift(x); if (j.tg !== false) void baoTelegram(x); }
    LECH.xong = LECH.xong.slice(0, 20); luuLech(); res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}'); } catch (e) { res.writeHead(400).end(JSON.stringify({ ok: false, error: e.message })); } });
}
// 📷 ẢNH THẬT QUANH ĐIỂM (nút 📷 trên trang): GET /mp/anh-quanh?lat&lng&r → Commons + Mapillary (server/anh-quanh.mjs). Khoá Mapillary ở máy chủ
// (/root/.secrets/mapillary.env MLY_TOKEN — vault acct #689), không lộ ra trang. Nhớ kết quả 30 phút theo ô ~10 m.
const MLY = process.env.MLY_TOKEN || (() => { try { return (docTep('/root/.secrets/mapillary.env', 'utf8').match(/^MLY_TOKEN=(.+)$/m) || [])[1]?.trim() || null; } catch { return null; } })();
const ANH_NHO = new Map();
async function xuLyAnhQuanh(u, res) {
  const lat = +u.searchParams.get('lat'), lng = +u.searchParams.get('lng'), r = +(u.searchParams.get('r') || 100), huong = u.searchParams.has('huong') ? +u.searchParams.get('huong') : null, khu = (u.searchParams.get('khu') || '').slice(0, 60) || null, khuCam = (u.searchParams.get('khuCam') || '').slice(0, 60) || null;
  const tra = (ma, j) => res.writeHead(ma, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(THU ? { 'Access-Control-Allow-Origin': '*' } : {}) }).end(JSON.stringify(j));
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180) || !Number.isFinite(r)) return tra(400, { loi: ['thiếu lat / lng'] });
  const k = `${lat.toFixed(4)},${lng.toFixed(4)},${Math.round(r / 20)},${huong == null ? '-' : Math.round(huong / 10)},${khu},${khuCam}`, nho = ANH_NHO.get(k);
  if (nho && Date.now() - nho.luc < 30 * 60e3) return tra(200, nho.kq);
  try { const kq = await timAnhQuanh({ lat, lng, r, mly: MLY, huong: Number.isFinite(huong) ? huong : null, khu, khuCam }); if (!kq.loi.length) { ANH_NHO.set(k, { luc: Date.now(), kq }); if (ANH_NHO.size > 500) ANH_NHO.delete(ANH_NHO.keys().next().value); } tra(200, kq); }
  catch (e) { tra(502, { anh: [], loi: [e.message] }); }
}
// TẢI HỘ ẢNH THẬT (📷 chọn ảnh → trang đổi thành dataURL để đính vào thẻ góp ý): chỉ host ảnh Commons / Mapillary, ≤ 8 MB — không thành cổng tải bừa
const HOST_ANH = /^(upload\.wikimedia\.org|[\w-]+\.fbcdn\.net|[\w.-]+\.mapillary\.com)$/;
async function xuLyTaiAnh(u, res) {
  let dich; try { dich = new URL(u.searchParams.get('url') || ''); } catch { res.writeHead(400).end(); return; }
  if (dich.protocol !== 'https:' || !HOST_ANH.test(dich.hostname)) { res.writeHead(403).end(); return; }
  try { const r = await fetch(dich, { headers: { 'User-Agent': 'castle-lau-dai-that/1.0 (anh-tai)' }, signal: AbortSignal.timeout(20000) }); const loai = r.headers.get('content-type') || '';
    if (!r.ok || !loai.startsWith('image/')) { console.warn('[anh-tai]', dich.hostname, r.status, loai); res.writeHead(502).end(); return; }
    const b = Buffer.from(await r.arrayBuffer()); if (b.length > 8e6) { res.writeHead(413).end(); return; }
    res.writeHead(200, { 'Content-Type': loai, 'Cache-Control': 'private, max-age=3600' }).end(b); } catch (e) { console.warn('[anh-tai]', dich.hostname, e.message); res.writeHead(502).end(); }
}
const may = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/mp/anh-quanh') { void xuLyAnhQuanh(u, res); return; }
  if (u.pathname === '/mp/anh-tai') { void xuLyTaiAnh(u, res); return; }
  if (u.pathname === '/mp/lech') { xuLyLech(req, res); return; }
  if (u.pathname === '/mp/kenh') { const lau = u.searchParams.get('lau'); if (!LAU.has(lau)) { res.writeHead(400).end('{}'); return; }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(THU ? { 'Access-Control-Allow-Origin': '*' } : {}) }).end(JSON.stringify(demKenh(lau))); return; }
  res.writeHead(404).end();
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
may.on('upgrade', async (req, sock, head) => {
  const u = new URL(req.url, 'http://x'), m = /^\/mp\/ws\/([a-z]+)$/.exec(u.pathname), lau = m?.[1], kenh = String(u.searchParams.get('kenh') || '');
  const tuChoi = (ma, ly) => { sock.end(`HTTP/1.1 ${ma} ${ly}\r\nConnection: close\r\n\r\n`); };
  if (!lau || !LAU.has(lau)) return tuChoi(400, 'Bad Request');
  const kieu = KIEU.find((k) => k.id === kenh), rieng = /^r-[a-z0-9]{4}$/.test(kenh); if (!kieu && !rieng) return tuChoi(400, 'Bad Request');
  let ai; try { ai = await danhTinh(req.headers.cookie, u); } catch (e) { console.error('[kenh] đọc phiên lỗi', e.message); return tuChoi(503, 'Service Unavailable'); }
  if (!ai) return tuChoi(401, 'Unauthorized');
  const ten = tenPhong(lau, kenh), p = phong.get(ten) || new Map();
  if (p.size >= (kieu ? kieu.toiDa : TOI_DA_RIENG)) return tuChoi(409, 'Full'); // kênh đầy → khách chọn kênh khác
  wss.handleUpgrade(req, sock, head, (ws) => vao(ws, lau, kenh, p, ten, ai));
});

let dem = 0;
function vao(ws, lau, kenh, p, ten, ai) {
  phong.set(ten, p);
  const id = (++dem).toString(36), nguoi = { id, ten: ai.ten, uid: ai.id, ws, p: null, h: 0, s: {}, lucVt: 0, lucChat: 0 };
  p.set(id, nguoi); ws.send(JSON.stringify({ t: 'chao', id, ten: ai.ten, kenh }));
  console.log(`[kenh] + ${ai.ten} → ${ten} (${p.size})`);
  ws.on('message', (buf) => {
    let d; try { d = JSON.parse(buf); } catch { return; } const now = Date.now();
    if (d.t === 'vt' && Array.isArray(d.p) && d.p.length === 3 && d.p.every(Number.isFinite) && now - nguoi.lucVt > 60) {
      nguoi.lucVt = now; nguoi.p = d.p.map((v) => Math.round(v * 100) / 100); nguoi.h = Number.isFinite(d.h) ? Math.round(d.h * 100) / 100 : 0;
      const s = d.s || {}; nguoi.s = { tt: String(s.tt || 'dat').slice(0, 8), toc: Math.min(12, Math.max(0, +s.toc || 0)), nen: !!s.nen, ngoi: !!s.ngoi };
    } else if (d.t === 'chat' && typeof d.c === 'string' && now - nguoi.lucChat > 1000 && nguoi.p) {
      nguoi.lucChat = now; const c = d.c.replace(/\s+/g, ' ').trim().slice(0, 120); if (!c) return;
      const tin = JSON.stringify({ t: 'chat', id, ten: nguoi.ten, c });
      for (const q of p.values()) if (q.p && Math.hypot(q.p[0] - nguoi.p[0], q.p[2] - nguoi.p[2]) < GAN_CHAT) q.ws.send(tin);
    }
  });
  ws.on('close', () => { p.delete(id); if (!p.size) phong.delete(ten); const tin = JSON.stringify({ t: 'ra', id }); for (const q of p.values()) q.ws.send(tin); console.log(`[kenh] - ${ai.ten} ← ${ten} (${p.size})`); });
  ws.on('error', () => {});
}
setInterval(() => { // mỗi người chỉ nhận người khác trong GAN m — kênh đông vẫn nhẹ cho điện thoại
  for (const p of phong.values()) for (const a of p.values()) {
    if (!a.p || a.ws.readyState !== 1) continue; const n = [];
    for (const b of p.values()) if (b !== a && b.uid !== a.uid && b.p && Math.hypot(b.p[0] - a.p[0], b.p[2] - a.p[2]) < GAN) n.push([b.id, b.ten, ...b.p, b.h, b.s]);
    a.ws.send(JSON.stringify({ t: 'ds', n })); // không gửi các kết nối khác của CHÍNH tài khoản này (tab / khung thứ hai) — không thấy bản sao của mình
  }
}, NHIP);
may.listen(CONG, '127.0.0.1', () => console.log(`[kenh] nghe 127.0.0.1:${CONG}`));
