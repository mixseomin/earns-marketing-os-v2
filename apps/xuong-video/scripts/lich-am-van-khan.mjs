// LÕI ÂM LỊCH cho lịch văn khấn — chép từ lõi Giỗ Chạp /Users/htuan/Me/earns/giochap-ios/web/app/lich.js (Thuật toán Hồ Ngọc Đức,
// đã đối chiếu với bản Swift của app qua bộ ca ngày âm), CHỈ GIỮ phần lịch văn khấn cần: đổi ngày dương ↔ âm, tiết khí,
// ngày lễ theo quy tắc âm lịch / tiết khí, và danh sách dịp trong N ngày tới.
// Nhờ chép vào repo nên mã này lên box3 qua GHA (commit → deploy), không còn scp từ máy Mac lúc chạy.
// tra-repo-ok: trước khi chép đã grep apps/xuong-video — repo chưa có lõi âm lịch nào; dùng lại lõi Giỗ Chạp thay vì viết mới.
// Swift là nguồn: sửa luật âm lịch thì sửa ở app Giỗ Chạp trước rồi chép lại tệp này.

const tr = Math.trunc;
const TZ = 7;

export function jdFromDate(dd, mm, yy) {
  const a = tr((14 - mm) / 12), y = yy + 4800 - a, m = mm + 12 * a - 3;
  let jd = dd + tr((153 * m + 2) / 5) + 365 * y + tr(y / 4) - tr(y / 100) + tr(y / 400) - 32045;
  if (jd < 2299161) jd = dd + tr((153 * m + 2) / 5) + 365 * y + tr(y / 4) - 32083;
  return jd;
}

export function jdToDate(jd) {
  let a, b, c;
  if (jd > 2299160) { a = jd + 32044; b = tr((4 * a + 3) / 146097); c = a - tr((b * 146097) / 4); }
  else { b = 0; c = jd + 32082; }
  const d = tr((4 * c + 3) / 1461), e = c - tr((1461 * d) / 4), m = tr((5 * e + 2) / 153);
  return { day: e - tr((153 * m + 2) / 5) + 1, month: m + 3 - 12 * tr(m / 10), year: b * 100 + d - 4800 + tr(m / 10) };
}

function newMoonDay(k) {
  const T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = Math.PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat = T < -11 ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
                         : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return Math.floor(Jd1 + C1 - deltat + 0.5 + TZ / 24);
}

function sunLongitude(jdn) {
  const T = (jdn - 2451545.5 - TZ / 24) / 36525, T2 = T * T, dr = Math.PI / 180;
  const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  L = L - Math.PI * 2 * Math.floor(L / (Math.PI * 2));
  return Math.floor(L / Math.PI * 6);
}

function lunarMonth11(yy) {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = Math.floor(off / 29.530588853);
  let nm = newMoonDay(k);
  if (sunLongitude(nm) >= 9) nm = newMoonDay(k - 1);
  return nm;
}

function leapMonthOffset(a11) {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0, i = 1, arc = sunLongitude(newMoonDay(k + i));
  do { last = arc; i += 1; arc = sunLongitude(newMoonDay(k + i)); } while (arc !== last && i < 14);
  return i - 1;
}

/** Ngày dương {day, month, year} → âm {day, month, year, leap}. */
export function toLunar(s) {
  const dayNumber = jdFromDate(s.day, s.month, s.year);
  const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
  let kk = k + 1, monthStart = newMoonDay(kk);
  while (monthStart > dayNumber) { kk -= 1; monthStart = newMoonDay(kk); }
  let a11 = lunarMonth11(s.year), b11 = a11, lunarYear;
  if (a11 >= monthStart) { lunarYear = s.year; a11 = lunarMonth11(s.year - 1); }
  else { lunarYear = s.year + 1; b11 = lunarMonth11(s.year + 1); }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = Math.floor((monthStart - a11) / 29);
  let leap = false, lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapDiff = leapMonthOffset(a11);
    if (diff >= leapDiff) { lunarMonth = diff + 10; if (diff === leapDiff) leap = true; }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
  return { day: lunarDay, month: lunarMonth, year: lunarYear, leap };
}

/** Ngày âm → dương; null khi không tồn tại (tháng nhuận không có, ngày 30 của tháng thiếu). */
export function toSolar(l) {
  let a11, b11;
  if (l.month < 11) { a11 = lunarMonth11(l.year - 1); b11 = lunarMonth11(l.year); }
  else { a11 = lunarMonth11(l.year); b11 = lunarMonth11(l.year + 1); }
  const k = Math.floor(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = l.month - 11;
  if (off < 0) off += 12;
  if (b11 - a11 > 365) {
    const leapOff = leapMonthOffset(a11);
    let leapMonth = leapOff - 2;
    if (leapMonth < 0) leapMonth += 12;
    if (l.leap && l.month !== leapMonth) return null;
    if (l.leap || off >= leapOff) off += 1;
  } else if (l.leap) return null;
  const monthStart = newMoonDay(k + off), next = newMoonDay(k + off + 1);
  if (l.day < 1 || l.day > next - monthStart) return null;
  return jdToDate(monthStart + l.day - 1);
}

export function monthLength(month, year, leap = false) {
  if (!toSolar({ day: 1, month, year, leap })) return 0;
  return toSolar({ day: 30, month, year, leap }) ? 30 : 29;
}

function sunLongitudeDegrees(jdn) {
  const T = (jdn - 2451545.5 - TZ / 24) / 36525, T2 = T * T, dr = Math.PI / 180;
  const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  const DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M) + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
  const L = (L0 + DL) % 360;
  return L < 0 ? L + 360 : L;
}
export function solarTerm(deg, month, year) {
  const start = jdFromDate(1, month, year) - 10;
  for (let jd = start; jd < start + 45; jd++) {
    const a = sunLongitudeDegrees(jd), b = sunLongitudeDegrees(jd + 1);
    const crosses = deg === 0 ? (a > 300 && b < 60) : (a < deg && b >= deg);
    if (crosses) return jdToDate(jd);
  }
  return null;
}

// ── tiện ích ngày ────────────────────────────────────────────────────────────────────────────────
export const jd = (s) => jdFromDate(s.day, s.month, s.year);
export const tuJd = (n) => jdToDate(n);
export const thangAm = ["Giêng", "Hai", "Ba", "Tư", "Năm", "Sáu", "Bảy", "Tám", "Chín", "Mười", "Một", "Chạp"];
export const tenThangAm = (m) => thangAm[m - 1];
export const thu = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
export const weekday = (s) => thu[(jd(s) + 1) % 7];
export const amNgan = (l) => `${l.day}/${l.month}${l.leap ? " nhuận" : ""}`;

// ── ngày lễ ─────────────────────────────────────────────────────────────────────────────────────
let DL = null;   // du-lieu-van-khan.json (ngày lễ + bài khấn) — nạp một lần
export function napDuLieu(d) { DL = d; }

/** Ngày dương làm lễ năm âm y: tháng thiếu mà lễ ngày 30 → làm 29; tháng nhuận → theo tháng thường. */
export function observed(day, month, y) {
  const len = monthLength(month, y);
  if (!len) return null;
  return toSolar({ day: Math.min(day, len), month, year: y });
}

export function holidaySolar(h, y) {
  if (h.rule.k === "lunar") return observed(h.rule.d, h.rule.m, y);
  if (h.rule.k === "term") return solarTerm(h.rule.deg, h.rule.m, y);
  const tet = toSolar({ day: 1, month: 1, year: y + 1 });
  return tet ? tuJd(jd(tet) - 1) : null;
}
export function holidayOn(h, picks) {
  const p = (picks || "").split(",");
  if (p.includes("+" + h.id)) return true;
  if (p.includes("-" + h.id)) return false;
  return h.on;
}

/**
 * Dịp trong `days` ngày tới (từ `today`), sắp theo ngày — CHỈ ngày lễ; rằm / mùng 1 hằng tháng do người gọi tự tính
 * (sapToi của app chỉ trả 6 lần rằm / mùng 1 gần nhất, đủ cho màn Sắp tới nhưng thiếu cho lịch cả năm).
 */
export function sapToi({ picks = "", holidaysOn = true } = {}, today, days = 400) {
  const out = [], f = jd(today), end = f + days, ly = toLunar(today).year;
  for (const h of DL.holidays) {
    if (!(holidaysOn && holidayOn(h, picks))) continue;
    for (let y = ly - 1; y <= ly + 1; y++) {
      const s = holidaySolar(h, y);
      if (!s || jd(s) < f || jd(s) > end) continue;
      out.push({ id: `h-${h.id}-${y}`, src: "holiday", hol: h, title: h.name, solar: s, lunar: toLunar(s), prayer: h.prayer });
      break;
    }
  }
  return out.sort((a, b) => jd(a.solar) - jd(b.solar));
}
