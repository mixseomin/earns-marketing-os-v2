// Gọi API App Store Connect (JWT ES256) — dùng chung cho app-store-so.mjs (số liệu) và app-store-trang-thai.mjs (trạng thái duyệt).
// Khoá: /root/.secrets/asc/{asc.env,AuthKey_<KEY_ID>.p8} trên box3 (ASC_DIR ghi đè).
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const ASC_DIR = process.env.ASC_DIR || '/root/.secrets/asc';
// Khoá đọc LẦN ĐẦU gọi API (không lúc import) — bài tự kiểm của script dùng chung chạy được ở máy không có khoá.
let env, KEY;
function khoa() {
  if (KEY) return;
  env = Object.fromEntries(readFileSync(`${ASC_DIR}/asc.env`, 'utf8').split('\n')
    .map((l) => l.match(/^\s*([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]));
  KEY = readFileSync(`${ASC_DIR}/AuthKey_${env.ASC_KEY_ID}.p8`, 'utf8');
}
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
function jwt() {
  khoa();
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'ES256', kid: env.ASC_KEY_ID, typ: 'JWT' }), body = b64({ iss: env.ASC_ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' });
  const s = createSign('SHA256'); s.update(`${head}.${body}`);
  return `${head}.${body}.${s.sign({ key: KEY, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}
export async function api(method, path, body) {
  const r = await fetch(path.startsWith('http') ? path : `https://api.appstoreconnect.apple.com${path}`, {
    method, headers: { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${(await r.text()).slice(0, 300)}`);
  return r.status === 204 ? null : r.json();
}
export async function all(path) {
  let out = [], next = path;
  while (next) { const j = await api('GET', next); out = out.concat(j.data); next = j.links?.next; }
  return out;
}

