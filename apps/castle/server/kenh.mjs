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

const may = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
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
    for (const b of p.values()) if (b !== a && b.p && Math.hypot(b.p[0] - a.p[0], b.p[2] - a.p[2]) < GAN) n.push([b.id, b.ten, ...b.p, b.h, b.s]);
    a.ws.send(JSON.stringify({ t: 'ds', n }));
  }
}, NHIP);
may.listen(CONG, '127.0.0.1', () => console.log(`[kenh] nghe 127.0.0.1:${CONG}`));
