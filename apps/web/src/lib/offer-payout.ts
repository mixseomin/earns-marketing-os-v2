// Quy tỉ lệ hoa hồng (chuỗi người ta viết tự do) về TIỀN THẬT mỗi chuyển đổi, tính bằng USD.
//
// Tách khỏi actions/offers.ts vì file đó là 'use server' (chỉ export được hàm async, node chạy trần
// không nạp nổi) — mà đây đúng là chỗ phải có lưới: nó là phép tính RA TIỀN, và đã từng sai 60 lần.
//
// Sự cố 2026-08-15: `rate.replace(/[^\d.]/g, '')` bóc trụi mọi ký tự không phải số, nên khoảng
// "€5–12" mất dấu gạch và dính thành "512" → $552.96 (thật ra ~$9). "$20-25" → $2025. Bảng lại sắp
// theo cột này giảm dần, nên mấy dòng parse hỏng nổi lên đầu — danh sách "offer ngon nhất" hoá ra
// là danh sách lỗi. Bài học: ĐỪNG bóc ký tự phân cách, hãy tách theo TOKEN số.

/** Tỉ giá xấp xỉ, CHỈ để xếp các khoản phẳng về một đơn vị mà liếc mắt so. Không chuyển tiền thật. */
export const FX_USD: Record<string, number> = {
  USD: 1, EUR: 1.08, GBP: 1.27, VND: 1 / 24500,
  CAD: 0.73, AUD: 0.66, CZK: 0.043, PLN: 0.25, SEK: 0.095, DKK: 0.145,
  NOK: 0.093, CHF: 1.12, JPY: 1 / 150, INR: 0.012, BRL: 0.18, SGD: 0.74, MXN: 0.05,
};

/** Đoán đơn vị tiền: ký hiệu/từ rõ nghĩa trước, rồi mã ISO nằm trong chuỗi, cuối cùng mới tới cột. */
export function currencyOf(rate: string, currency: string | null): string {
  const c = /€|eur/i.test(rate) ? 'EUR' : /£|gbp/i.test(rate) ? 'GBP'
    : /[₫đ]|vnd/i.test(rate) ? 'VND' : /\$|usd/i.test(rate) ? 'USD' : '';
  return (c || rate.match(/\b([A-Za-z]{3})\b/)?.[1] || currency || '').toUpperCase();
}

/**
 * Mọi con số trong chuỗi, giữ nguyên ranh giới giữa chúng.
 *
 * Dấu chấm/phẩy phải đoán theo NGỮ CẢNH chứ không bỏ hết: "349.00" là thập phân, "50.000đ" là hàng
 * nghìn kiểu VN, "1,250" là hàng nghìn kiểu Anh-Mỹ, "4,9" là thập phân kiểu châu Âu. Bỏ hết dấu thì
 * 349.00 thành 34900; bỏ hết chữ số phân cách thì 5–12 thành 512.
 */
export function parseNum(token: string, vnd = false): number {
  const s = vnd
    ? token.replace(/[.,]/g, '')                    // VN: cả '.' lẫn ',' đều là hàng nghìn
    : /[.,]\d{3}(?:\D|$)/.test(`${token} `) ? token.replace(/[.,](?=\d{3}(?:\D|$))/g, '')
    : token.replace(',', '.');                      // còn lại: phẩy là dấu thập phân
  return parseFloat(s);
}

export function amountsIn(rate: string, vnd: boolean): number[] {
  return (rate.match(/\d[\d.,]*/g) ?? [])
    .map((t) => parseNum(t, vnd))
    .filter((n) => isFinite(n) && n > 0);
}

/**
 * Tiền tuyệt đối mỗi chuyển đổi, USD. CHỈ khoản PHẲNG mới là tiền nói được (CPA/CPL/CPI $X);
 * phần trăm cần giá đơn hàng mà mình không có → null (ô trống thật thà, không phải số đoán).
 *
 * Khoảng ("€5–12", "$20-25") lấy trung điểm — cùng quy ước với `pctOf`, để hai cột không nói hai
 * kiểu về cùng một dòng.
 */
export function payoutUsdOf(rate: string | null, currency: string | null): number | null {
  if (!rate || rate.includes('%')) return null;
  const cur = currencyOf(rate, currency);
  const mul = FX_USD[cur];
  if (mul == null) return null;   // đơn vị lạ → ô trống, KHÔNG bịa USD (lớp lỗi "$105000")
  const nums = amountsIn(rate, cur === 'VND');
  if (!nums.length) return null;
  const mid = (Math.min(...nums) + Math.max(...nums)) / 2;
  return +(mid * mul).toFixed(2);
}

/**
 * "15-20%" → 17.5 · "5%" → 5 · "3-10% + $20" → 6.5 (chỉ phần %). null khi không có %.
 *
 * Trong một KHOẢNG, chỉ số cuối mang dấu %: "15-20%". Bản cũ chỉ bắt số dính ngay dấu % nên nuốt
 * mất số đầu và báo 20 — luôn đọc theo cận TRÊN, tức là luôn thổi phồng. Cùng lớp lỗi với chuyện
 * bóc trụi dấu gạch ở payoutUsdOf, nên sửa một lượt.
 */
const PCT_RE = /(\d[\d.,]*)\s*(?:[-–—~]|to)\s*(\d[\d.,]*)\s*%|(\d[\d.,]*)\s*%/g;

export function pctOf(rate: string | null): number | null {
  if (!rate) return null;
  const nums: number[] = [];
  for (const m of rate.matchAll(PCT_RE)) {
    if (m[1] && m[2]) nums.push(parseNum(m[1]), parseNum(m[2]));
    else if (m[3]) nums.push(parseNum(m[3]));
  }
  const ok = nums.filter((n) => isFinite(n) && n > 0);
  if (!ok.length) return null;
  const v = (Math.min(...ok) + Math.max(...ok)) / 2;
  return isFinite(v) && v > 0 ? v : null;
}

// ── Chia hoa hồng cho publisher ──────────────────────────────────────────────
// Network sống bằng CHÊNH LỆCH: upstream trả mình X, mình trả publisher một phần của X. Publisher
// KHÔNG được thấy X — biết mức nhà là biết luôn biên của mình, và lần thương lượng sau họ đòi đúng
// bằng đó. Mọi con số đi xuống portal đều phải đi qua đây.

/** Phần publisher được hưởng. Một hằng số, một chỗ — hiển thị và báo cáo phải đọc CÙNG số này, nếu
 *  không portal in một đằng còn tiền tính một nẻo. Đặt riêng từng publisher thì dùng
 *  net_publisher_offers.publisher_rate (đè lên cái derive ra đây). */
export const PUB_SHARE = 0.7;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Tiền mình thật sự trả publisher trên một khoản upstream. */
export function pubCut(upstreamAmount: number, share = PUB_SHARE): number {
  return round2(upstreamAmount * share);
}

/**
 * Mức upstream → mức PHÁT CHO PUBLISHER, giữ nguyên dạng viết ("2.5%" → "1.75%", "$30" → "$21").
 *
 * Cắt sạch ghi chú kèm theo: "2.5% (CJ link 15534820)" mà in nguyên si xuống portal là lộ cả mã
 * link CJ lẫn mức nhà. Không đọc được dạng nào thì trả null — ô trống rồi admin đặt tay, TUYỆT ĐỐI
 * không rơi về chuỗi gốc (đó đúng là lỗi vừa xảy ra: portal fallback về upstream_rate).
 */
export function derivePubRate(upstreamRate: string | null, share = PUB_SHARE): string | null {
  if (!upstreamRate) return null;
  const pct = pctOf(upstreamRate);
  if (pct != null) return `${round2(pct * share)}%`;
  const cur = currencyOf(upstreamRate, null);
  const nums = amountsIn(upstreamRate, cur === 'VND');
  if (!nums.length || !FX_USD[cur]) return null;
  const sym = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : cur === 'GBP' ? '£' : '';
  const lo = round2(Math.min(...nums) * share);
  const hi = round2(Math.max(...nums) * share);
  const body = lo === hi ? `${lo}` : `${lo}-${hi}`;
  return sym ? `${sym}${body}` : `${body} ${cur}`;
}

/**
 * Tiền publisher được nhận trên MỘT đơn cụ thể.
 *
 * Thứ tự: mức của họ ăn theo % → tính trên giá trị đơn · mức phẳng ($X/đơn) → đúng $X · KHÔNG có
 * mức nào ("thoả thuận") → tạm chia PUB_SHARE của khoản nhà nhận.
 *
 * Trước đây mọi đơn đều chia cứng PUB_SHARE, kể cả khi admin đã đặt mức riêng — portal in một tỉ lệ
 * còn tiền tính theo một tỉ lệ khác. Số hiện ra phải sinh từ ĐÚNG cái mức đang niêm yết cho họ.
 */
export function pubPayout(gross: number, upstreamCommission: number, rate: string | null): number {
  const pct = pctOf(rate);
  if (pct != null) return gross > 0 ? round2((gross * pct) / 100) : pubCut(upstreamCommission);
  const flat = payoutUsdOf(rate, null);
  if (flat != null) return flat;
  return pubCut(upstreamCommission);
}

/** Offer ăn % thành tiền thật khi biết giá đơn hàng: payout = AOV × tỉ lệ. aov_usd đã là USD rồi. */
export function payoutFromAov(rate: string | null, aovUsd: number | null): number | null {
  const pct = pctOf(rate);
  if (pct == null || !aovUsd) return null;
  return +((aovUsd * pct) / 100).toFixed(2);
}
