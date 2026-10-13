// GIỜ LÀM của nhân sự (giờ VN) — một chỗ cho ca làm, ngày làm việc, mốc điểm danh / báo cáo cuối ca (nhip.mjs + các nhịp dùng chung).
//   node worker/gio-lam.mjs --tu-kiem
const phut = (s) => { const m = String(s ?? '').match(/^(\d{1,2}):(\d{2})$/); return m ? +m[1] * 60 + +m[2] : null; };
/** Phút trong ngày theo giờ VN (UTC+7). */
export const phutVN = (ms = Date.now()) => { const d = new Date(ms); return ((d.getUTCHours() + 7) % 24) * 60 + d.getUTCMinutes(); };
/** "06:00-02:00" → { tu, den } phút; không khai → cả ngày. */
export const khungCa = (ca) => { const m = String(ca ?? '').match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/); return m ? { tu: phut(m[1]), den: phut(m[2]) } : null; };
/** CA LÀM: `ca: 06:00-02:00` → chỉ làm trong khung đó (qua đêm được); không khai = cả ngày. Anh 13–14/10/2026. */
export function trongCa(ca, gio = new Date()) {
  const k = khungCa(ca); if (!k) return true; const vn = phutVN(+gio);
  return k.tu <= k.den ? vn >= k.tu && vn < k.den : vn >= k.tu || vn < k.den;
}
/** Ngày làm việc (YYYY-MM-DD giờ VN) của thời điểm ms: ca qua đêm thì phần sau nửa đêm thuộc ngày hôm trước. */
export function ngayLam(ms, ca) {
  const k = khungCa(ca), vnMs = ms + 7 * 3_600_000;
  const lui = k && k.tu > k.den && phutVN(ms) < k.den ? 86_400_000 : 0;
  return new Date(vnMs - lui).toISOString().slice(0, 10);
}
/** Giờ bắt đầu ca (ms UTC) của ngày làm việc chứa ms. */
export function dauCa(ms, ca) { const k = khungCa(ca) ?? { tu: 0 }; return Date.parse(`${ngayLam(ms, ca)}T00:00:00Z`) - 7 * 3_600_000 + k.tu * 60_000; }
/** Đã tới mốc "HH:MM" (giờ VN) của ngày làm việc này chưa — mốc sau nửa đêm của ca qua đêm cũng đúng. */
export function quaMoc(moc, ms, ca) { const p = phut(moc); return p !== null && ms >= dauCa(ms, ca) + (((p - (khungCa(ca)?.tu ?? 0)) % 1440 + 1440) % 1440) * 60_000; }
/** Mốc báo cáo cuối ca = 5 phút trước khi hết ca. */
export const mocCuoiCa = (ca) => { const k = khungCa(ca); if (!k) return '23:55'; const p = (k.den - 5 + 1440) % 1440; return `${String(Math.floor(p / 60)).padStart(2, '0')}:${String(p % 60).padStart(2, '0')}`; };

if (process.argv[1]?.endsWith('gio-lam.mjs') && process.argv.includes('--tu-kiem')) {
  const { strict: a } = await import('node:assert'); const g = (ngay, h, p = 0) => Date.parse(`${ngay}T${String(h).padStart(2, '0')}:${String(p).padStart(2, '0')}:00+07:00`);
  a.ok(trongCa('08:00-24:00', g('2026-10-14', 8)) && trongCa('08:00-24:00', g('2026-10-14', 23, 59)) && !trongCa('08:00-24:00', g('2026-10-14', 0)) && !trongCa('08:00-24:00', g('2026-10-14', 7, 59)));
  a.ok(trongCa('22:00-06:00', g('2026-10-14', 23)) && trongCa('22:00-06:00', g('2026-10-14', 5)) && !trongCa('22:00-06:00', g('2026-10-14', 12)) && trongCa(undefined, g('2026-10-14', 3)));
  const CA = '06:00-02:00';
  a.equal(ngayLam(g('2026-10-15', 1, 30), CA), '2026-10-14', '01:30 sáng 15 thuộc ngày làm 14'); a.equal(ngayLam(g('2026-10-14', 9), CA), '2026-10-14');
  a.equal(dauCa(g('2026-10-15', 1), CA), g('2026-10-14', 6));
  a.ok(!quaMoc('08:00', g('2026-10-14', 7, 59), CA) && quaMoc('08:00', g('2026-10-14', 8), CA) && quaMoc('08:00', g('2026-10-15', 1), CA));
  a.equal(mocCuoiCa(CA), '01:55'); a.ok(!quaMoc('01:55', g('2026-10-14', 23), CA) && quaMoc('01:55', g('2026-10-15', 1, 55), CA));
  console.log('✓ gio-lam: ca qua đêm, ngày làm việc, mốc điểm danh 8h, báo cáo 5 phút trước hết ca');
}
