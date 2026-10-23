#!/usr/bin/env node
// HẠN TÊN MIỀN CHO CITY (anh 24/10/2026 "đc" — tra WHOIS ghi hạn tên miền vào sổ hạ tầng): tên miền của mọi site trên thành phố mà sổ infra_resources
// chưa có ngày hết hạn → tra RDAP (WHOIS dạng JSON, rdap.org) → ghi expires_at + nhà đăng ký. Có dòng thì CẬP NHẬT, chưa có thì THÊM; không xoá gì.
// Chạy trên box3 (có DB + mạng):  cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && node scripts/thanh-pho/han-ten-mien.mjs [--tat-ca] [--thu]
//   --tat-ca: tra lại cả tên miền đã có hạn · --thu: chỉ in, không ghi DB
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

const tatCa = process.argv.includes('--tat-ca'), thu = process.argv.includes('--thu');
const ban = JSON.parse(readFileSync(`${process.env.MOS2_DATA_DIR || '/var/lib/mos2'}/thanh-pho.json`, 'utf8')).mh;
const can = (ban.taiNguyen?.han ?? []).filter((h) => h.loai === 'domain' && (tatCa || !h.het));
const sql = postgres(process.env.DATABASE_URL, { max: 2 });
const duAnCo = new Set((await sql`SELECT id FROM projects`).map((r) => r.id));
const duAnCua = (khoa) => { const d = ban.dich.find((x) => x.khoa === khoa); const id = d?.duAn?.startsWith('d:') ? d.duAn.slice(2) : null; return id && duAnCo.has(id) ? id : null; };
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const kq = { them: 0, sua: 0, khong: [] };
for (const h of can) {
  let j = null;
  try { const r = await fetch(`https://rdap.org/domain/${h.ten}`, { redirect: 'follow', signal: AbortSignal.timeout(20_000) }); if (r.ok) j = await r.json(); else kq.khong.push(`${h.ten} (RDAP ${r.status})`); }
  catch (e) { kq.khong.push(`${h.ten} (${e.message})`); }
  await ngu(1200);   // nhẹ tay với rdap.org
  if (!j) continue;
  const su = (a) => j.events?.find((e) => e.eventAction === a)?.eventDate ?? null, het = su('expiration');
  const nhaDk = j.entities?.find((e) => e.roles?.includes('registrar'))?.vcardArray?.[1]?.find((v) => v[0] === 'fn')?.[3] ?? null;
  if (!het) { kq.khong.push(`${h.ten} (RDAP không có ngày hết hạn)`); continue; }
  const meta = { registrar: nhaDk, registered: su('registration')?.slice(0, 10) ?? null, han_nguon: 'rdap', han_luc: new Date().toISOString() };
  console.log(`${h.ten.padEnd(28)} hết hạn ${het.slice(0, 10)} · ${nhaDk ?? '?'}`);
  if (thu) continue;
  const co = await sql`SELECT id FROM infra_resources WHERE kind = 'domain' AND lower(regexp_replace(label, '^www\\.', '')) = ${h.ten.toLowerCase()} ORDER BY id LIMIT 1`;
  if (co.length) { await sql`UPDATE infra_resources SET expires_at = ${het}, provider = coalesce(provider, ${nhaDk}), meta = meta || ${sql.json(meta)}, updated_at = now() WHERE id = ${co[0].id}`; kq.sua++; }
  else { await sql`INSERT INTO infra_resources (kind, label, project_id, provider, status, category, expires_at, meta, notes) VALUES ('domain', ${h.ten}, ${duAnCua(h.dich)}, ${nhaDk}, 'active', 'domain', ${het}, ${sql.json(meta)}, 'tự thêm từ RDAP (city tài nguyên 24/10/2026)')`; kq.them++; }
}
console.log(`\n${can.length} tên miền cần tra · thêm ${kq.them} · cập nhật ${kq.sua}${thu ? ' (chạy thử, không ghi)' : ''}`); if (kq.khong.length) console.log('không tra được:', kq.khong.join(' · '));
await sql.end();
