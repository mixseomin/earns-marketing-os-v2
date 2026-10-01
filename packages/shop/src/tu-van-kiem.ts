// SHOP — BƯỚC KIỂM trả lời chat trước khi gửi khách (anh chốt 01/10/2026: máy tự gửi loại AN TOÀN, loại nhạy cảm chờ anh duyệt).
// Kiểm bằng LUẬT (không tin lời máy soạn tự khai): câu hứa tiền/hoàn/thay hàng, mã giảm không có thật, số tiền lạ, ngày giao lệch, quá
// dài → không tự gửi. Máy soạn tự xếp nhóm 'nhay_cam' cũng không tự gửi. File thuần — trình duyệt/máy chủ cùng dùng, có tự kiểm.

export type BoiCanhKiem = { gia: number[]; ma: string[]; ngay: string[] };   // giá hợp lệ (sản phẩm, ship) · mã giảm có thật · chuỗi ngày được phép nói
export type KetQuaKiem = { ok: boolean; ly_do: string[] };

const HUA = /\b(we(?:'ll| will| can| are able to)|i(?:'ll| will| can)|let me)\s+(?:\w+\s+){0,3}(refund|replace|reship|resend|send (?:you )?(?:a )?(?:new|replacement|free)|give you|offer you|credit|compensat|waive|cancel your order)/i;
const TU_NHAY = /\b(refund|chargeback|dispute|lawyer|scam|fraud|bank|paypal|compensation|damaged|broken|wrong (?:size|item|color)|never (?:arrived|received)|not received)\b/i;

export function kiemTraLoi(traLoi: string, nhom: string, bc: BoiCanhKiem, cauKhach = ''): KetQuaKiem {
  const ly: string[] = [];
  const t = traLoi.trim();
  if (!t) ly.push('trả lời trống');
  if (t.length > 1200) ly.push('quá dài (>1200 ký tự)');
  if (nhom !== 'an_toan') ly.push('máy soạn xếp nhóm nhạy cảm');
  if (HUA.test(t)) ly.push('có câu hứa hoàn tiền / gửi hàng mới / bồi thường');
  if (TU_NHAY.test(cauKhach)) ly.push('khách nhắc tới hoàn tiền / hỏng / không nhận được / ngân hàng');
  for (const m of t.match(/\$\s?\d+(?:\.\d{1,2})?/g) ?? []) {
    const so = Number(m.replace(/[^\d.]/g, ''));
    if (!bc.gia.some((g) => Math.abs(g - so) < 0.01)) ly.push(`số tiền ${m} không khớp giá nào của shop`);
  }
  for (const m of t.match(/\b\d{1,2}\s?%/g) ?? []) ly.push(`nhắc % giảm (${m.trim()}) — để anh duyệt`);
  for (const m of t.match(/\b[A-Z][A-Z0-9]{3,19}\b/g) ?? []) {
    if (/^(USPS|UPS|FEDEX|DHL|USA|US|EU|UK|FAQ|SMS|ASAP|OK|CJ)$/.test(m)) continue;
    if (/\d/.test(m) && !bc.ma.includes(m)) ly.push(`mã "${m}" không phải mã giảm có thật`);
  }
  const thang = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}\b/g;
  for (const m of t.match(thang) ?? []) if (!bc.ngay.some((n) => n.includes(m.replace(/[a-z]*\.?\s+/, ' ').replace(/\s+/, ' ')) || n.includes(m))) ly.push(`ngày "${m}" không khớp ngày dự kiến của shop/đơn`);
  return { ok: ly.length === 0, ly_do: [...new Set(ly)] };
}

// Tự kiểm: node_modules/.bin/tsx packages/shop/src/tu-van-kiem.ts
if (process.argv[1]?.endsWith('tu-van-kiem.ts')) {
  const bc: BoiCanhKiem = { gia: [49.99, 54.99, 0], ma: ['WELCOME10'], ngay: ['Tue, Oct 13 – Tue, Oct 27'] };
  const an = kiemTraLoi('Our Cloud Wide-Fit runs true to size. If you are between sizes, go half a size up. It is $49.99 with free US shipping, and orders placed today arrive Oct 13 – Oct 27.', 'an_toan', bc, 'does it run small?');
  if (!an.ok) throw new Error('câu an toàn bị chặn: ' + an.ly_do.join('; '));
  const hua = kiemTraLoi("Sorry about that! We'll refund you right away.", 'an_toan', bc);
  if (hua.ok) throw new Error('câu hứa hoàn tiền phải bị chặn');
  const ma = kiemTraLoi('Use code SAVE20OFF for a discount.', 'an_toan', bc);
  if (ma.ok) throw new Error('mã giảm bịa phải bị chặn');
  const tien = kiemTraLoi('It costs $39.99 today.', 'an_toan', bc);
  if (tien.ok) throw new Error('giá lạ phải bị chặn');
  const khach = kiemTraLoi('Let me check on that for you.', 'an_toan', bc, 'my package never arrived');
  if (khach.ok) throw new Error('khách nói không nhận được hàng phải chờ duyệt');
  const ngay = kiemTraLoi('It will arrive by Nov 2.', 'an_toan', bc);
  if (ngay.ok) throw new Error('ngày lệch phải bị chặn');
  console.log('tu-van-kiem: 6/6 ok');
}
