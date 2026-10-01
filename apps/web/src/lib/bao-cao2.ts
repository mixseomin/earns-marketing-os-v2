/* REPORT2 trên MOS2 — bảng xoay (gộp theo chiều × chỉ số) cho các dự án KHÔNG thuộc adfond (anh chốt 01/10/2026:
 * mellowstep + mảng adult, một trang chung có bộ lọc dự án). Cùng trải nghiệm report2 của be.adfond, nhưng đọc sổ
 * PHỦ của MOS2 thay vì schema adfond:
 *   phu_chi        chi QC theo ngày × sid_prefix (nguồn_camp)
 *   phu_su_kien    sự kiện: view/click/out (phễu lander) · signup/lead/spend (affiliate, amount = tiền về) ·
 *                  don (đơn shop, amount = tổng tiền khách trả, raw.gia_von/ship/phi) · hoan (hoàn tiền, amount > 0)
 *   phu_ga4_ngay   GA4 theo ngày × nguồn × camp (utm_campaign cùng khuôn sid_prefix)
 * Ba bảng hợp (UNION ALL) về một khuôn dòng rồi GROUP BY chiều đã chọn — ghép được vì `camp` là khoá chung.
 *   node --experimental-strip-types apps/web/src/lib/bao-cao2.ts   # tự kiểm
 */

export type Chieu = { key: string; nhan: string; bieuThuc: string };
export const CHIEU: Chieu[] = [
  { key: 'ngay', nhan: 'Ngày', bieuThuc: 's.ngay::text' },
  { key: 'tuan', nhan: 'Tuần', bieuThuc: "to_char(date_trunc('week', s.ngay), 'YYYY-MM-DD')" },
  { key: 'thang', nhan: 'Tháng', bieuThuc: "to_char(s.ngay, 'YYYY-MM')" },
  { key: 'du_an', nhan: 'Dự án', bieuThuc: 's.project_id' },
  { key: 'nguon', nhan: 'Nguồn', bieuThuc: "coalesce(nullif(s.nguon, ''), '(không rõ)')" },
  { key: 'camp', nhan: 'Camp', bieuThuc: "coalesce(nullif(s.camp, ''), '(không camp)')" },
  { key: 'dich', nhan: 'Offer / SP', bieuThuc: "coalesce(nullif(s.dich, ''), '—')" },
];

/* Cột gốc cộng dồn được (sum) — tỷ lệ tính SAU khi cộng, không bao giờ cộng tỷ lệ. */
const GOC = ['chi', 'hien_thi', 'click', 'phien', 'phien_tt', 'vao', 'ra', 'signup', 'aff', 'don', 'doanh_thu', 'gia_von', 'ship', 'phi', 'hoan', 'them_gio'] as const;
type Goc = (typeof GOC)[number];

export type Kieu = 'tien' | 'so' | 'pt' | 'x';
/** Cụm cột — dải tiêu đề trên bảng + nhóm ô tick "Cột" (cùng vai CUM2 của report2 adfond). */
export const CUM = [
  { key: 'qc', nhan: 'Quảng cáo', mau: '#d97706' },
  { key: 'traffic', nhan: 'Traffic', mau: '#2563eb' },
  { key: 'chuyen', nhan: 'Chuyển đổi', mau: '#7c3aed' },
  { key: 'tien', nhan: 'Tiền', mau: '#16a34a' },
] as const;
export type ChiSo = { key: string; nhan: string; kieu: Kieu; sql: string; tong: 'cong' | 'tinh'; cum: (typeof CUM)[number]['key']; chuThich: string };
const g = (k: Goc) => `sum(s.${k})`;
const chia = (a: string, b: string) => `(${a})::numeric / nullif(${b}, 0)`;
const THU = `(${g('doanh_thu')} + ${g('aff')} - ${g('hoan')})`;
const LAI = `(${THU} - ${g('chi')} - ${g('gia_von')} - ${g('ship')} - ${g('phi')})`;
export const CHI_SO: ChiSo[] = [
  { key: 'chi', nhan: 'Chi', kieu: 'tien', sql: g('chi'), tong: 'cong', cum: 'qc', chuThich: 'Tiền đã chi cho mạng quảng cáo (phu_chi)' },
  { key: 'hien_thi', nhan: 'Hiển thị', kieu: 'so', sql: g('hien_thi'), tong: 'cong', cum: 'qc', chuThich: 'Lượt hiển thị mạng QC báo' },
  { key: 'click', nhan: 'Click', kieu: 'so', sql: g('click'), tong: 'cong', cum: 'qc', chuThich: 'Click mạng QC báo' },
  { key: 'ctr', nhan: 'CTR', kieu: 'pt', sql: chia(g('click'), g('hien_thi')), tong: 'tinh', cum: 'qc', chuThich: 'Click / hiển thị' },
  { key: 'cpc', nhan: 'CPC', kieu: 'tien', sql: chia(g('chi'), g('click')), tong: 'tinh', cum: 'qc', chuThich: 'Chi / click' },
  { key: 'phien', nhan: 'Phiên GA4', kieu: 'so', sql: g('phien'), tong: 'cong', cum: 'traffic', chuThich: 'Phiên GA4 (sessions)' },
  { key: 'vao', nhan: 'Vào lander', kieu: 'so', sql: g('vao'), tong: 'cong', cum: 'traffic', chuThich: 'Lượt vào lander (view + click /px)' },
  { key: 'ra', nhan: 'Bấm ra', kieu: 'so', sql: g('ra'), tong: 'cong', cum: 'traffic', chuThich: 'Lượt bấm ra offer (/r/)' },
  { key: 'them_gio', nhan: 'Thêm giỏ', kieu: 'so', sql: g('them_gio'), tong: 'cong', cum: 'traffic', chuThich: 'Thêm giỏ (GA4 addToCarts)' },
  { key: 'signup', nhan: 'Signup', kieu: 'so', sql: g('signup'), tong: 'cong', cum: 'chuyen', chuThich: 'Đăng ký affiliate báo về' },
  { key: 'don', nhan: 'Đơn', kieu: 'so', sql: g('don'), tong: 'cong', cum: 'chuyen', chuThich: 'Đơn shop đã thu tiền' },
  { key: 'cr', nhan: 'CR đơn/phiên', kieu: 'pt', sql: chia(g('don'), g('phien')), tong: 'tinh', cum: 'chuyen', chuThich: 'Đơn / phiên GA4' },
  { key: 'thu', nhan: 'Tiền về', kieu: 'tien', sql: THU, tong: 'cong', cum: 'tien', chuThich: 'Doanh thu đơn + tiền affiliate − hoàn' },
  { key: 'gia_von', nhan: 'Giá vốn + ship', kieu: 'tien', sql: `(${g('gia_von')} + ${g('ship')})`, tong: 'cong', cum: 'tien', chuThich: 'Giá vốn CJ + phí ship CJ' },
  { key: 'phi', nhan: 'Phí cổng', kieu: 'tien', sql: g('phi'), tong: 'cong', cum: 'tien', chuThich: 'Phí cổng thanh toán (Stripe)' },
  { key: 'hoan', nhan: 'Hoàn', kieu: 'tien', sql: g('hoan'), tong: 'cong', cum: 'tien', chuThich: 'Tiền đã hoàn cho khách' },
  { key: 'lai', nhan: 'Lãi', kieu: 'tien', sql: LAI, tong: 'cong', cum: 'tien', chuThich: 'Tiền về − chi − giá vốn − ship − phí' },
  { key: 'roas', nhan: 'ROAS', kieu: 'x', sql: chia(THU, g('chi')), tong: 'tinh', cum: 'tien', chuThich: 'Tiền về / chi' },
  { key: 'cpa', nhan: 'CPA (đơn+signup)', kieu: 'tien', sql: chia(g('chi'), `(${g('don')} + ${g('signup')})`), tong: 'tinh', cum: 'chuyen', chuThich: 'Chi / (đơn + signup)' },
  { key: 'epc', nhan: 'EPC', kieu: 'tien', sql: chia(THU, `greatest(${g('click')}, ${g('vao')})`), tong: 'tinh', cum: 'tien', chuThich: 'Tiền về / click (lấy số lớn hơn giữa click mạng và lượt vào)' },
];
export const CHI_SO_MAC_DINH = ['chi', 'click', 'cpc', 'phien', 'ra', 'signup', 'don', 'thu', 'lai', 'roas'];
/** Dải KPI — tổng của khoảng, tỷ lệ chia lại từ tổng (cùng dòng Tổng của bảng). */
export const KPI = ['chi', 'click', 'cpc', 'phien', 'signup', 'don', 'thu', 'lai', 'roas', 'cpa'];
/** Biểu đồ theo ngày (đúng bộ lọc đang áp): cột = chuyển đổi, đường trái = tiền, đường phải = lưu lượng. */
export const DUONG_BIEU_DO = [
  { key: 'chi', nhan: 'Chi', mau: '#d97706', kieu: 'duong', truc: 'trai' },
  { key: 'thu', nhan: 'Tiền về', mau: '#16a34a', kieu: 'duong', truc: 'trai' },
  { key: 'lai', nhan: 'Lãi', mau: '#0891b2', kieu: 'duong', truc: 'trai' },
  { key: 'phien', nhan: 'Phiên GA4', mau: '#2563eb', kieu: 'duong', truc: 'phai' },
  { key: 'ra', nhan: 'Bấm ra', mau: '#94a3b8', kieu: 'duong', truc: 'phai' },
  { key: 'don', nhan: 'Đơn', mau: '#7c3aed', kieu: 'cot', truc: 'phai' },
  { key: 'signup', nhan: 'Signup', mau: '#db2777', kieu: 'cot', truc: 'phai' },
] as const;
/** Chiều có ô lọc (giá trị lấy từ chính dữ liệu trong khoảng). */
export const LOC = ['du_an', 'nguon', 'camp', 'dich'];
/** Bấm một ô chiều này = lọc nó VÀ chia xuống chiều kế (như report2 adfond: Campaign → Ad group). */
export const XUONG: Record<string, string> = { du_an: 'nguon', nguon: 'camp', camp: 'dich' };

/* utm_campaign trên GA4 thường là tên camp TRẦN ('direct-us'), còn chi/sự kiện khoá theo '<nguồn>_<camp>'
   ('bidvertiser_direct-us') — thiếu dấu '_' thì ghép nguồn vào trước, để phiên nằm CÙNG dòng với chi. */
const GA4_CAMP = "CASE WHEN a.camp <> '' AND position('_' in a.camp) = 0 THEN lower(a.nguon) || '_' || a.camp ELSE a.camp END";
const so = (raw: string) => `coalesce(nullif(e.raw->>'${raw}', '')::numeric, 0)`;
/* Một khuôn dòng cho cả ba bảng — cột nào bảng không có thì 0. Thứ tự cột phải khớp CỘT_S. */
const COT_S = ['project_id', 'ngay', 'nguon', 'camp', 'dich', ...GOC] as const;
const dong = (v: Partial<Record<(typeof COT_S)[number], string>>) => COT_S.map((c) => `${v[c] ?? '0'} AS ${c}`).join(', ');
export const NGUON_S = `(
  SELECT ${dong({ project_id: 'c.project_id', ngay: 'c.ngay', nguon: 'c.nguon_key', camp: 'c.sid_prefix', dich: "''",
    chi: 'c.chi_usd', hien_thi: 'coalesce(c.impressions, 0)', click: 'coalesce(c.clicks, 0)' })}
    FROM phu_chi c WHERE c.project_id = ANY($1) AND c.ngay BETWEEN $2::date AND $3::date
  UNION ALL
  SELECT ${dong({ project_id: 'e.project_id', ngay: "(e.ts AT TIME ZONE 'UTC')::date", nguon: "split_part(coalesce(e.sid_prefix, ''), '_', 1)",
    camp: "coalesce(e.sid_prefix, '')", dich: "coalesce(e.platform_slug, '')",
    vao: "(e.loai IN ('view', 'click'))::int", ra: "(e.loai = 'out')::int", signup: "(e.loai = 'signup')::int",
    aff: "CASE WHEN e.loai IN ('spend', 'lead') THEN e.amount ELSE 0 END",
    don: "(e.loai = 'don')::int", doanh_thu: "CASE WHEN e.loai = 'don' THEN e.amount ELSE 0 END",
    gia_von: `CASE WHEN e.loai = 'don' THEN ${so('gia_von')} ELSE 0 END`, ship: `CASE WHEN e.loai = 'don' THEN ${so('ship')} ELSE 0 END`,
    phi: `CASE WHEN e.loai IN ('don', 'hoan') THEN ${so('phi')} ELSE 0 END`, hoan: "CASE WHEN e.loai = 'hoan' THEN e.amount ELSE 0 END" })}
    FROM phu_su_kien e WHERE e.project_id = ANY($1) AND e.ts >= $2::date AND e.ts < $3::date + 1
      AND e.loai IN ('view', 'click', 'out', 'signup', 'lead', 'spend', 'don', 'hoan')
  UNION ALL
  SELECT ${dong({ project_id: 'a.project_id', ngay: 'a.ngay', nguon: 'a.nguon', camp: GA4_CAMP, dich: "''",
    phien: 'a.phien', phien_tt: 'a.phien_tt', them_gio: 'a.them_gio' })}
    FROM phu_ga4_ngay a WHERE a.project_id = ANY($1) AND a.ngay BETWEEN $2::date AND $3::date
) s`;

export type YeuCau = { duAn: string[]; tu: string; den: string; gop: string[]; chiSo: string[]; loc?: Record<string, string[]> };
export type TruyVan = { sql: string; params: unknown[]; cot: string[] };

const NGAY = /^\d{4}-\d{2}-\d{2}$/;
/** Dựng SQL — chỉ nhận chiều/chỉ số trong sổ (chặn tiêm SQL bằng whitelist, giá trị lọc đi qua tham số). */
export function dungTruyVan(y: YeuCau): TruyVan | { loi: string } {
  if (!y.duAn.length) return { loi: 'chưa chọn dự án' };
  if (!NGAY.test(y.tu) || !NGAY.test(y.den) || y.tu > y.den) return { loi: 'khoảng ngày không hợp lệ' };
  const chieu = y.gop.map((k) => CHIEU.find((c) => c.key === k)).filter((c): c is Chieu => !!c).slice(0, 3);
  const tim = (ds: string[]) => ds.map((k) => CHI_SO.find((c) => c.key === k)).filter((c): c is ChiSo => !!c);
  const chiSo = tim(y.chiSo).length ? tim(y.chiSo) : tim(CHI_SO_MAC_DINH);
  const params: unknown[] = [y.duAn, y.tu, y.den];
  const dk: string[] = [];
  for (const [k, v] of Object.entries(y.loc ?? {})) {
    const c = CHIEU.find((x) => x.key === k);
    if (c && v?.length) { params.push(v); dk.push(`${c.bieuThuc} = ANY($${params.length})`); }
  }
  const sel = [...chieu.map((c) => `${c.bieuThuc} AS "${c.key}"`), ...chiSo.map((c) => `${c.sql} AS "${c.key}"`)].join(',\n  ');
  const nhom = chieu.length ? `GROUP BY ${chieu.map((_, i) => i + 1).join(', ')}` : '';
  const xep = chieu.some((c) => ['ngay', 'tuan', 'thang'].includes(c.key)) ? 'ORDER BY 1 DESC' : chiSo[0] ? `ORDER BY "${chiSo[0].key}" DESC NULLS LAST` : '';
  return {
    sql: `SELECT\n  ${sel}\nFROM ${NGUON_S}\n${dk.length ? 'WHERE ' + dk.join(' AND ') : ''}\n${nhom}\n${xep}\nLIMIT 2000`,
    params, cot: [...chieu.map((c) => c.key), ...chiSo.map((c) => c.key)],
  };
}

/** Giá trị CÓ THẬT trong khoảng cho từng ô lọc — chọn cái nào cũng còn dòng. Không áp lọc (bày đủ để đổi). */
export function truyVanChonCho(y: Pick<YeuCau, 'duAn' | 'tu' | 'den'>): TruyVan {
  const cot = LOC.map((k) => CHIEU.find((c) => c.key === k)!);
  return { sql: `SELECT DISTINCT ${cot.map((c) => `${c.bieuThuc} AS "${c.key}"`).join(', ')} FROM ${NGUON_S} LIMIT 5000`, params: [y.duAn, y.tu, y.den], cot: LOC };
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('/bao-cao2.ts')) {
  let sai = 0;
  const ok = (t: string, d: boolean) => { if (!d) sai++; console.log(`  ${d ? 'ok  ' : 'SAI '} ${t}`); };
  const q = dungTruyVan({ duAn: ['mellowstep'], tu: '2026-09-01', den: '2026-09-30', gop: ['ngay', 'camp'], chiSo: ['chi', 'lai', 'roas'] }) as TruyVan;
  ok('dựng được SQL', 'sql' in q);
  ok('gộp theo ngày + camp', q.sql.includes('GROUP BY 1, 2') && q.cot.join() === 'ngay,camp,chi,lai,roas');
  ok('tỷ lệ chia sau khi cộng, mẫu 0 → null', q.sql.includes('nullif(sum(s.chi), 0)'));
  ok('ba nguồn đều vào', ['phu_chi', 'phu_su_kien', 'phu_ga4_ngay'].every((t) => q.sql.includes(t)));
  ok('mỗi nhánh UNION cùng số cột', (NGUON_S.match(/ AS hoan/g) ?? []).length === 3 && (NGUON_S.match(/ AS project_id/g) ?? []).length === 3);
  const x = dungTruyVan({ duAn: ['a'], tu: '2026-09-01', den: '2026-09-02', gop: ["ngay; DROP TABLE x"], chiSo: ['khong_co'] }) as TruyVan;
  ok('chiều/chỉ số lạ bị bỏ (whitelist), chỉ số rỗng → mặc định', !x.sql.includes('DROP') && x.cot.join() === CHI_SO_MAC_DINH.join());
  const l = dungTruyVan({ duAn: ['a'], tu: '2026-09-01', den: '2026-09-02', gop: ['camp'], chiSo: [], loc: { nguon: ["x' or 1=1", 'exo'] } }) as TruyVan;
  ok('giá trị lọc (nhiều giá trị) đi qua tham số', l.params.length === 4 && !l.sql.includes('or 1=1') && l.sql.includes('= ANY($4)'));
  ok('mọi chỉ số có cụm + chú thích', CHI_SO.every((c) => CUM.some((u) => u.key === c.cum) && c.chuThich.length > 3));
  ok('KPI đều có trong sổ', KPI.every((k) => CHI_SO.some((c) => c.key === k)));
  ok('camp GA4 trần được ghép nguồn (cùng khoá với phu_chi)', NGUON_S.includes("lower(a.nguon) || '_' || a.camp"));
  ok('ô lọc giá trị có thật', truyVanChonCho({ duAn: ['a'], tu: '2026-09-01', den: '2026-09-02' }).sql.includes('SELECT DISTINCT'));
  ok('ngày sai → lỗi', 'loi' in dungTruyVan({ duAn: ['a'], tu: '2026-9-1', den: '2026-09-02', gop: [], chiSo: [] }));
  ok('không chọn dự án → lỗi', 'loi' in dungTruyVan({ duAn: [], tu: '2026-09-01', den: '2026-09-02', gop: [], chiSo: [] }));
  console.log(sai ? `\n${sai} SAI` : '\nbao-cao2: mọi kiểm đạt');
  process.exit(sai ? 1 : 0);
}
