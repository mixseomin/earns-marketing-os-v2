// MÔ HÌNH LỊCH — phần THUẦN (không import gì: ô chỉnh lịch phía trình duyệt components/chinh-lich.tsx dùng chung với máy chủ).
// Một mô hình cho mọi việc tự làm, đọc được từ cả ba loại máy (timer systemd, cron, LaunchAgent) và ghi ngược lại được (worker/lich-may.mjs):
//   { kieu: 'moi', phut }                       mỗi N phút (N ≥ 60 và chia hết 60 → đọc thành "mỗi N giờ")
//   { kieu: 'luc', gio: ['08:15', …], thu: [] } các giờ trong ngày (giờ VN); thu = thứ chạy (1 = T2 … 7 = CN), rỗng = mỗi ngày
//   { kieu: 'lien' }                            chạy liền (KeepAlive) — không có lịch để đổi
// Box chạy giờ UTC nên đọc/ghi lịch box phải đổi giờ VN ↔ UTC, kể cả LỆCH NGÀY (01:00 VN thứ Hai = 18:00 UTC Chủ nhật).
//   node scripts/thu-lich-chu.mjs      (tự kiểm để riêng: tệp này vào gói trình duyệt, không được import node:assert)
export const TEN_THU = ['', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const SD = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];   // systemd
const GIO = /^([01]\d|2[0-3]):[0-5]\d$/;
const p2 = (n) => String(n).padStart(2, '0');

/** "T2–T6", "T7, CN", "T2, T4, T6" — dải liền nhau gộp bằng gạch. */
export function chuThu(thu) {
  const ds = [...new Set(thu)].sort((a, b) => a - b); const kq = [];
  for (let i = 0; i < ds.length; i++) { let j = i; while (ds[j + 1] === ds[j] + 1) j++; kq.push(j - i >= 2 ? `${TEN_THU[ds[i]]}–${TEN_THU[ds[j]]}` : ds.slice(i, j + 1).map((t) => TEN_THU[t]).join(', ')); i = j; }
  return kq.join(', ');
}
/** Mô hình → chữ người đọc. */
export function chuLich(l) {
  if (!l) return '';
  if (l.kieu === 'lien') return 'chạy liền';
  if (l.kieu === 'moi') return l.phut % 60 === 0 && l.phut >= 60 ? `mỗi ${l.phut / 60} giờ` : `mỗi ${l.phut} phút`;
  const thu = l.thu?.length && l.thu.length < 7 ? ` · ${chuThu(l.thu)}` : ' hằng ngày';
  return `${l.gio.join(', ')}${thu}`;
}
/** Kiểm + chuẩn hoá một lịch (giờ sắp xếp, bỏ trùng; đủ 7 thứ = mỗi ngày). Sai → ném lỗi đủ câu. */
export function sach(l) {
  if (l?.kieu === 'moi') { const p = Number(l.phut); if (!Number.isInteger(p) || p < 1 || p > 1440) throw new Error(`"Mỗi ${l.phut} phút" không được — từ 1 phút tới 24 giờ`); return { kieu: 'moi', phut: p }; }
  if (l?.kieu === 'luc') {
    const gio = [...new Set((l.gio ?? []).map(String))].sort(); if (!gio.length) throw new Error('Chưa có giờ chạy nào');
    for (const g of gio) if (!GIO.test(g)) throw new Error(`Giờ "${g}" sai — dạng 08:30`);
    if (gio.length > 24) throw new Error('Tối đa 24 mốc giờ một ngày');
    const thu = [...new Set((l.thu ?? []).map(Number))].sort((a, b) => a - b);
    if (thu.some((t) => !(t >= 1 && t <= 7))) throw new Error('Thứ phải từ T2 tới CN');
    return { kieu: 'luc', gio, thu: thu.length === 7 ? [] : thu };
  }
  throw new Error('Lịch phải là "mỗi N phút/giờ" hoặc "các giờ trong ngày"');
}
/** Dời giờ đi `lech` giờ (VN→UTC: -7, UTC→VN: +7). Trả [{ h, m, lechNgay }] theo từng giờ. */
const doi = (gio, lech) => gio.map((g) => { const [h, m] = g.split(':').map(Number); const t = h + lech; return { h: (t + 24) % 24, m, lechNgay: t < 0 ? -1 : t > 23 ? 1 : 0 }; });
const doiThu = (thu, d) => thu.map((t) => ((t - 1 + d + 7) % 7) + 1).sort((a, b) => a - b);

// ── đọc từ máy → mô hình (null = dạng chưa đọc được: giữ chữ gốc, chỉnh là đặt lịch mới) ─────────────────────────────────
const phutKy = (x) => { let n = 0, ok = false; for (const [, so, dv] of String(x).matchAll(/(\d+)\s*(d|h|min|s)\b/g)) { ok = true; n += Number(so) * { d: 1440, h: 60, min: 1, s: 1 / 60 }[dv]; } return ok ? Math.max(1, Math.round(n)) : null; };
const thuSD = (s) => { if (!s) return []; const ra = new Set(); for (const p of s.split(',')) { const [a, b] = p.split('..').map((x) => SD.indexOf(x)); if (a < 1) return null; for (let t = a; t <= (b > 0 ? b : a); t++) ra.add(t); } return [...ra]; };
/** Gộp các mốc (giờ VN + thứ VN) thành một mô hình 'luc' — các mốc phải cùng tập thứ, không thì null. */
function gop(moc) {
  if (!moc.length) return null; const k = (x) => x.thu.join(','); if (moc.some((x) => k(x) !== k(moc[0]))) return null;
  return sach({ kieu: 'luc', gio: moc.map((x) => x.gio), thu: moc[0].thu });
}
/** Timer systemd: chuỗi "OnCalendar=… · OnUnitActiveUSec=…" (viec-may DO_BOX), giờ UTC. */
export function tuSystemd(lich) {
  const s = String(lich); const lap = s.match(/OnUnitActiveUSec=([^·]+)/);
  if (lap) { const p = phutKy(lap[1]); return p ? { kieu: 'moi', phut: p } : null; }
  const moc = [];
  for (const [, c0] of s.matchAll(/OnCalendar=([^·]+)/g)) {
    const c = c0.trim().replace(/ UTC$/, ''); let m;
    if ((m = c.match(/^\*-\*-\* \*:0?0\/(\d+)(:00)?$/))) return { kieu: 'moi', phut: Number(m[1]) };
    if (/^\*-\*-\* \*:\d+(:00)?$/.test(c) || c === 'hourly') return { kieu: 'moi', phut: 60 };
    if ((m = c.match(/^\*-\*-\* \*:([\d,]+)(:00)?$/))) { const p = m[1].split(',').map(Number); const b = 60 / p.length; if (p.every((x, i) => i === 0 || x - p[i - 1] === b)) return { kieu: 'moi', phut: b }; }   // *:02,17,32,47 = mỗi 15 phút
    if ((m = c.match(/^\*-\*-\* (?:\*|0?0)\/(\d+):\d+(:00)?$/))) return { kieu: 'moi', phut: Number(m[1]) * 60 };
    if (c === 'daily') { moc.push({ gio: '07:00', thu: [] }); continue; }
    if (!(m = c.match(/^(?:([A-Za-z.,]+) )?\*-\*-\* ([\d,]+):(\d+)(?::\d+)?$/))) return null;
    const thu = thuSD(m[1]); if (thu === null) return null;
    for (const x of doi(m[2].split(',').map((h) => `${p2(h)}:${p2(m[3])}`), 7)) moc.push({ gio: `${p2(x.h)}:${p2(x.m)}`, thu: thu.length ? doiThu(thu, x.lechNgay) : [] });
  }
  return gop(moc);
}
/** Cron: 5 trường, giờ UTC. */
export function tuCron(truong) {
  const [mi, h, dom, mon, dow] = String(truong).trim().split(/\s+/); let m;
  if (dom !== '*' || mon !== '*') return null;
  if (mi === '*' && h === '*') return { kieu: 'moi', phut: 1 };
  if ((m = mi.match(/^\*\/(\d+)$/)) && h === '*') return { kieu: 'moi', phut: Number(m[1]) };
  if (/^[\d,]+$/.test(mi) && h === '*') return { kieu: 'moi', phut: 60 };
  if (/^\d+$/.test(mi) && (m = h.match(/^(?:\*|\d+-\d+)\/(\d+)$/))) return { kieu: 'moi', phut: Number(m[1]) * 60 };
  if (!/^\d+$/.test(mi) || !/^[\d,]+$/.test(h)) return null;
  const thu = dow === '*' ? [] : dow.split(',').map((x) => (Number(x) === 0 ? 7 : Number(x))); if (thu.some((t) => !(t >= 1 && t <= 7))) return null;
  return gop(doi(h.split(',').map((x) => `${p2(x)}:${p2(mi)}`), 7).map((x) => ({ gio: `${p2(x.h)}:${p2(x.m)}`, thu: thu.length ? doiThu(thu, x.lechNgay) : [] })));
}
/** LaunchAgent: chữ do scripts/do-launchd.mjs dựng ("mỗi 10 phút", "lúc 09:15, thứ 1 08:00", "chạy liền"), giờ máy = giờ VN. */
export function tuLaunchd(chu) {
  const s = String(chu).trim(); let m;
  if (/chạy liền/.test(s)) return { kieu: 'lien' };
  if ((m = s.match(/^mỗi (\d+) (phút|giờ)$/))) return { kieu: 'moi', phut: Number(m[1]) * (m[2] === 'giờ' ? 60 : 1) };
  if (!(m = s.match(/^lúc (.+)$/))) return null;
  const theoGio = {};   // launchd mỗi thứ một mục → gộp thứ theo giờ (0 = mỗi ngày)
  for (const p of m[1].split(', ')) { const x = p.match(/^(?:thứ (\d) )?(\d\d):(\d\d)$/); if (!x) return null; (theoGio[`${x[2]}:${x[3]}`] ??= new Set()).add(x[1] ? (Number(x[1]) === 0 ? 7 : Number(x[1])) : 0); }
  return gop(Object.entries(theoGio).map(([gio, t]) => ({ gio, thu: t.has(0) ? [] : [...t].sort((a, b) => a - b) })));
}

// ── mô hình → máy ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** Các dòng OnCalendar (giờ UTC) cho mô hình 'luc' — mỗi giờ một dòng, thứ dời theo lệch ngày. */
export const dongOnCalendar = (l) => doi(l.gio, -7).map((x) => `${l.thu.length ? `${doiThu(l.thu, x.lechNgay).map((t) => SD[t]).join(',')} ` : ''}*-*-* ${p2(x.h)}:${p2(x.m)}:00 UTC`);
/** 5 trường cron (giờ UTC). Cron chỉ diễn được một phần: ném lỗi đủ câu khi lịch không viết được thành MỘT dòng cron. */
export function truongCron(l) {
  if (l.kieu === 'moi') {
    if (l.phut === 1) return '* * * * *'; if (l.phut < 60 && 60 % l.phut === 0) return `*/${l.phut} * * * *`;
    if (l.phut === 60) return '0 * * * *'; if (l.phut % 60 === 0 && 24 % (l.phut / 60) === 0) return l.phut === 1440 ? '0 0 * * *' : `0 */${l.phut / 60} * * *`;
    throw new Error(`Cron không chạy được "${chuLich(l)}" — chọn số phút chia hết 60 (1, 2, 5, 10, 15, 20, 30) hoặc số giờ chia hết 24`);
  }
  if (l.kieu !== 'luc') throw new Error('Việc chạy liền không có lịch');
  const u = doi(l.gio, -7);
  if (new Set(u.map((x) => x.m)).size > 1) throw new Error('Cron: các giờ phải cùng số phút (vd 08:15, 14:15) — giờ khác phút thì tách thành việc riêng');
  const thu = l.thu.length ? new Set(u.map((x) => doiThu(l.thu, x.lechNgay).join(','))) : null;
  if (thu && thu.size > 1) throw new Error('Cron: có giờ rơi sang ngày khác khi đổi sang giờ UTC của máy (trước 07:00 sáng) — chọn các giờ cùng trước hoặc cùng sau 07:00');
  return `${u[0].m} ${[...new Set(u.map((x) => x.h))].sort((a, b) => a - b).join(',')} * * ${thu ? [...thu][0].split(',').map((t) => (t === '7' ? '0' : t)).join(',') : '*'}`;
}
