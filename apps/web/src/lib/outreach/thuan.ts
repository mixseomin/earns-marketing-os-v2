// HÀM THUẦN của hệ outreach (không DB, không mạng, không alias đường dẫn) — tách riêng để bài tự kiểm so.test.mts chạy được bằng tsx:
// chọn email liên hệ trong một trang HTML · đọc danh sách dán tay · cửa kiểm chuỗi thư do mô hình viết · nhận ra lời xin thôi nhận thư.
// Các tệp nap.ts, soan-thu.ts, thu-den.ts dùng lại từ đây (một định nghĩa, một chỗ kiểm).

const DUOI_RAC = /\.(png|jpe?g|gif|webp|svg|css|js|woff2?)$/i;
const MIEN_RAC = /(sentry|wixpress|example|domain|email|yourdomain|yoursite|godaddy|schema|w3|shopify|cloudflare|googleapis|gstatic|jsdelivr|sentry-next)\./i;
const TEN_XAU = /^(no-?reply|donotreply|do-not-reply|abuse|privacy|legal|dmca|postmaster|mailer-daemon|webmaster|noreply|unsubscribe|bounce)/i;
const TEN_TOT = ['hello', 'hi', 'hey', 'contact', 'team', 'info', 'support', 'help', 'care', 'customercare', 'customerservice', 'service', 'sales', 'partnerships', 'marketing', 'press'];

/** Chọn email liên hệ tốt nhất trong một trang HTML: cùng tên miền với website trước, hộp thư chung (hello, contact, support…) trước hộp cá nhân. Thuần — có bài tự kiểm. */
export function chonEmail(html: string, mien: string): string | null {
  const giai = html.replace(/&#64;|&#x40;|%40/gi, '@').replace(/&#46;|&#x2e;/gi, '.').replace(/\s*\[at\]\s*|\s*\(at\)\s*/gi, '@');
  const thay = new Set((giai.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi) ?? []).map((x) => x.toLowerCase().replace(/^[._%+-]+|\.+$/g, '')));
  const goc = mien.replace(/^www\./, '').toLowerCase();
  const diem = (e: string) => {
    const [ten, m] = e.split('@') as [string, string];
    if (!ten || !m || DUOI_RAC.test(e) || MIEN_RAC.test(`${m}.`) || TEN_XAU.test(ten) || ten.length > 40 || /^\d+$/.test(ten) || /[0-9a-f]{16,}/.test(ten)) return -1;
    const cungMien = m === goc || m.endsWith(`.${goc}`) || goc.endsWith(`.${m}`);
    const hang = TEN_TOT.indexOf(ten);
    const hopMienPhi = /^(gmail|outlook|yahoo|hotmail|icloud|proton|protonmail)\./.test(m);
    if (!cungMien && !hopMienPhi) return -1;   // địa chỉ của tên miền KHÁC (đối tác, nhà cung cấp, mẫu theme) không phải liên hệ của thương hiệu này
    return (cungMien ? 100 : 30) + (hang >= 0 ? 50 - hang : 10);
  };
  const xep = [...thay].map((e) => ({ e, d: diem(e) })).filter((x) => x.d >= 30).sort((a, b) => b.d - a.d);
  return xep[0]?.e ?? null;
}


/** dòng dán tay: "tên, email, website" (dấu phẩy, chấm phẩy hoặc tab; thiếu tên thì lấy phần trước @). Thuần — có bài tự kiểm. */
export function docCsv(chu: string): { ds: { ten: string; email: string; website: string }[]; hong: number } {
  const ds: { ten: string; email: string; website: string }[] = []; let hong = 0; const da = new Set<string>();
  for (const dong of chu.split(/\r?\n/)) {
    const d = dong.trim(); if (!d) continue;
    const o = d.split(/[,;\t]/).map((x) => x.trim().replace(/^"|"$/g, ''));
    const email = o.find((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x))?.toLowerCase();
    if (!email) { if (!/email/i.test(d)) hong++; continue; }   // dòng tiêu đề có chữ "email" không tính là hỏng
    if (da.has(email)) continue; da.add(email);
    const web = o.find((x) => x !== email && /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(x)) ?? '';
    const ten = o.find((x) => x && x.toLowerCase() !== email && x !== web) ?? email.split('@')[0]!;
    ds.push({ ten, email, website: web && !/^https?:\/\//i.test(web) ? `https://${web}` : web });
  }
  return { ds, hong };
}


/** lời chào của chiến dịch — mọi thứ mô hình được phép nói về bên gửi */
export type LoiChao = {
  ben_gui: string;           // tên thương hiệu gửi (AngleBrief)
  ky_ten: string;            // tên ký cuối thư
  ban_gi: string;            // một câu: bán gì cho ai
  ngach?: string;            // ngách của chiến dịch
  phat_hien: string[];       // phát hiện được phép nêu (mỗi thư đầu chọn MỘT cái hợp nhất với quảng cáo của người nhận)
  co_so?: string;            // phát hiện dựa trên gì (vd "5,682 buyer conversations about hiking boots")
  link_mien_phi?: string;    // link được gắn ở thư đầu (bài hướng dẫn miễn phí)
  link_ban?: string;         // link trang bán, chỉ được nhắc ở thư nhắc cuối
  gia?: string;              // giá được phép nêu ở thư nhắc cuối
  cam?: string[];            // điều cấm nói thêm của chiến dịch
};
export type ThuChuoi = { tieu_de: string; noi_dung: string };

const GACH = /[—–]/;
const LO = /\b(spy|scrap(e|ed|ing|er)|crawl(ed|ing|er)?|ad library tool|our (tool|software|ai)|artificial intelligence|\bAI\b|chatgpt|language model)\b/i;
const demTu = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const linkTrong = (s: string) => s.match(/https?:\/\/[^\s)>\]]+/g) ?? [];

/** Cửa kiểm chuỗi thư trước khi lưu. Trả câu lỗi (mô hình viết lại) hoặc null. Thuần — có bài tự kiểm. */
export function kiemChuoi(v: unknown, c: LoiChao): string | null {
  const ds = (v as { emails?: { subject?: string; body?: string }[] })?.emails;
  if (!Array.isArray(ds) || ds.length !== 3) return 'cần đúng 3 thư trong emails';
  const choPhep = new Set([c.link_mien_phi, c.link_ban].filter(Boolean).map((x) => String(x).replace(/\/$/, '')));
  for (const [i, t] of ds.entries()) {
    const body = String(t?.body ?? '').trim(), sub = String(t?.subject ?? '').trim();
    if (!body) return `thư ${i + 1} trống`;
    if (i === 0 && (sub.length < 8 || sub.length > 70)) return 'tiêu đề thư đầu phải 8–70 ký tự';
    if (i === 0 && /^(re|fwd?):/i.test(sub)) return 'tiêu đề thư đầu không được giả làm thư trả lời';
    const tu = demTu(body);
    if (i === 0 && (tu < 45 || tu > 120)) return `thư đầu ${tu} từ, cần 45–120`;
    if (i > 0 && (tu < 15 || tu > 80)) return `thư nhắc ${i} ${tu} từ, cần 15–80`;
    if (GACH.test(body) || GACH.test(sub)) return `thư ${i + 1} còn gạch dài, dùng "-" hoặc viết lại câu`;
    if (LO.test(body) || LO.test(sub)) return `thư ${i + 1} nhắc tới công cụ / AI / cách lấy dữ liệu, bỏ đi`;
    if (/\[[^\]]*\]|\{\{/.test(body)) return `thư ${i + 1} còn chỗ để trống kiểu [..]`;
    for (const l of linkTrong(body)) if (!choPhep.has(l.replace(/[.,;!?]+$/, '').replace(/\/$/, ''))) return `thư ${i + 1} có link ngoài danh sách cho phép: ${l}`;
    if (i === 0 && c.link_ban && body.includes(c.link_ban)) return 'thư đầu không gắn link trang bán';
    if (i < 2 && /\$\s?\d/.test(body)) return `thư ${i + 1} không nêu giá (chỉ thư nhắc cuối)`;
  }
  return null;
}


/** câu mở đầu thư trả lời là lời xin thôi — chỉ xét 200 ký tự đầu (phần trích thư cũ bên dưới không tính) */
export const laXinThoi = (tieuDe: string, noiDung: string) => /unsubscribe/i.test(tieuDe) || /^\W*(no|no thanks?|not interested|stop|unsubscribe|remove me|please remove|take me off)\b/i.test(noiDung.trim().slice(0, 200));

