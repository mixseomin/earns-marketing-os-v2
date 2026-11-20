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
  link_dau?: boolean;        // true = gắn link miễn phí ngay thư đầu (mặc định KHÔNG: thư đầu không link dễ vào hộp chính hơn, link miễn phí đi ở thư 2)
};
export type ThuChuoi = { tieu_de: string; noi_dung: string };

const GACH = /[—–]/;
const LO = /\b(spy|scrap(e|ed|ing|er)|crawl(ed|ing|er)?|ad library tool|our (tool|software|ai)|artificial intelligence|\bAI\b|chatgpt|language model)\b/i;
const demTu = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const linkTrong = (s: string) => s.match(/https?:\/\/[^\s)>\]]+/g) ?? [];
// CỤM CẤM trong thư lạnh — học từ growthenginenowoslawski/coldoutboundskills (MIT; skills/spam-word-checker, campaign-copywriting) và luật văn phong của
// ethanplusai/sellbird (đọc 20/11/2026): câu sáo mở thư, câu nhắc thư trước, lời mời họp, chữ quảng cáo ép mua, từ đệm rỗng. Danh sách từ đơn của repo
// (get, new, now, sales…) KHÔNG lấy: quá rộng, chặn cả câu bình thường.
const CAM_CUM = [
  'i hope this email finds you well', 'hope this finds you well', 'i wanted to reach out', 'i am reaching out', "i'm reaching out", 'we help companies', 'our solution', 'would love to schedule',
  'hop on a call', 'jump on a call', 'quick call', 'quick question', 'just checking in', 'checking in', 'following up', 'follow up on my', 'circle back', 'touch base', 'bumping this', 'one more thought',
  'my last email', 'my previous email', 'my last note', 'last note', 'take silence as', 'off chance', 'great fit', 'click here', 'for free', 'free trial', 'free access', 'discount', 'limited time',
  'act now', 'guaranteed', 'guarantee', 'increase revenue', 'increase sales', 'amazing', 'game-changer', 'game changer', 'world-class', 'cutting-edge', 'leverage', 'synergy', 'ecosystem', 'not just',
];
const CAM_TIEU_DE = ['quick question', 'curious', 'checking in', 'following up', 'touching base'];

/** một bước của chuỗi thư: thư mở luồng mới (có tiêu đề riêng) hay nối luồng trước; được gắn link nào; khoảng số từ */
export type BuocThu = { moi: boolean; link: 'khong' | 'mien_phi' | 'ban'; tu: [number, number]; gia: boolean };
/**
 * Kế hoạch chuỗi theo số thư (1–4) — học cấu trúc 4 thư của coldoutboundskills (ngày 0, 3–4, 7–8, 11–12; thư 3 mở luồng mới) và trần độ dài của sellbird:
 * thư đầu KHÔNG link (kết bằng một câu hỏi ngắn trả lời được trong vài từ), thư 2 nối luồng và gửi luôn link miễn phí, thư 3 luồng mới với góc khác,
 * thư cuối nêu sản phẩm trả tiền + giá. `linkDau`: chiến dịch chủ động muốn gắn link miễn phí ngay thư đầu.
 */
export function keHoachChuoi(soThu: number, linkDau = false): BuocThu[] {
  const n = Math.max(1, Math.min(4, Math.round(soThu)));
  const dau: BuocThu = { moi: true, link: linkDau ? 'mien_phi' : 'khong', tu: [40, 95], gia: false };
  const mienPhi: BuocThu = { moi: false, link: 'mien_phi', tu: [20, 70], gia: false };
  const gocKhac: BuocThu = { moi: true, link: 'khong', tu: [35, 90], gia: false };
  const ban: BuocThu = { moi: false, link: 'ban', tu: [18, 60], gia: true };
  return n === 1 ? [dau] : n === 2 ? [dau, mienPhi] : n === 3 ? [dau, mienPhi, ban] : [dau, mienPhi, gocKhac, ban];
}

/** Cửa kiểm chuỗi thư trước khi lưu. Trả câu lỗi (mô hình viết lại) hoặc null. Thuần — có bài tự kiểm. `kh` = kế hoạch chuỗi (mặc định 3 thư). */
export function kiemChuoi(v: unknown, c: LoiChao, kh: BuocThu[] = keHoachChuoi(3)): string | null {
  // thương hiệu KHÔNG bán đúng ngách: mô hình trả hop 'no' + lý do, không viết thư — hợp lệ, người gọi loại người nhận này
  const hop = (v as { hop?: string; ly_do?: string })?.hop;
  if (hop !== 'yes' && hop !== 'no') return 'thiếu hop: yes hoặc no';
  if (hop === 'no') return String((v as { ly_do?: string }).ly_do ?? '').trim().length >= 8 ? null : 'hop no thì phải ghi ly_do';
  const ds = (v as { emails?: { subject?: string; body?: string }[] })?.emails;
  if (!Array.isArray(ds) || ds.length !== kh.length) return `cần đúng ${kh.length} thư trong emails`;
  const sach = (x: string | undefined) => String(x ?? '').replace(/\/$/, '');
  const mienPhi = sach(c.link_mien_phi), ban = sach(c.link_ban);
  for (const [i, t] of ds.entries()) {
    const k = kh[i]!, body = String(t?.body ?? '').trim(), sub = String(t?.subject ?? '').trim(), thap = `${sub}\n${body}`.toLowerCase();
    if (!body) return `thư ${i + 1} trống`;
    if (k.moi) {
      const soTu = demTu(sub);
      if (soTu < 2 || soTu > 5 || sub.length > 45) return `thư ${i + 1}: tiêu đề cần 2–5 từ, tối đa 45 ký tự`;
      if (/^(re|fwd?):/i.test(sub)) return `thư ${i + 1}: tiêu đề không được giả làm thư trả lời`;
      if (/[!?]/.test(sub)) return `thư ${i + 1}: tiêu đề không có dấu chấm than hay dấu hỏi`;
      const cam = CAM_TIEU_DE.find((x) => sub.toLowerCase().includes(x)); if (cam) return `thư ${i + 1}: tiêu đề có cụm sáo "${cam}"`;
    } else if (sub) return `thư ${i + 1} nối luồng thư trước nên tiêu đề phải để trống`;
    const tu = demTu(body);
    if (tu < k.tu[0] || tu > k.tu[1]) return `thư ${i + 1} dài ${tu} từ, cần ${k.tu[0]}–${k.tu[1]}`;
    if (GACH.test(body) || GACH.test(sub)) return `thư ${i + 1} còn gạch dài, dùng "-" hoặc viết lại câu`;
    if (LO.test(body) || LO.test(sub)) return `thư ${i + 1} nhắc tới công cụ / AI / cách lấy dữ liệu, bỏ đi`;
    if (/\[[^\]]*\]|\{\{/.test(body)) return `thư ${i + 1} còn chỗ để trống kiểu [..]`;
    if (body.includes('!')) return `thư ${i + 1} có dấu chấm than`;
    const cum = CAM_CUM.find((x) => thap.includes(x)); if (cum) return `thư ${i + 1} có cụm sáo / cụm dễ vào spam "${cum}"`;
    if ((body.match(/\?/g) ?? []).length > 1) return `thư ${i + 1} có hơn một câu hỏi, mỗi thư chỉ một lời mời`;
    const links = linkTrong(body).map((l) => sach(l.replace(/[.,;!?]+$/, '')));
    const duoc = k.link === 'mien_phi' ? mienPhi : k.link === 'ban' ? ban : '';
    for (const l of links) if (!duoc || l !== duoc) return `thư ${i + 1} có link không thuộc bước này: ${l}`;
    if (links.length > 1) return `thư ${i + 1} có hơn một link`;
    if (duoc && k.link === 'mien_phi' && !links.length) return `thư ${i + 1} phải gắn link miễn phí ${duoc}`;
    if (!k.gia && /\$\s?\d/.test(body)) return `thư ${i + 1} không được nêu giá (chỉ thư cuối)`;
  }
  return null;
}

/** THƯ TRẢ LỜI TỰ ĐỘNG (vắng mặt, hệ thống trả tự động) — không phải người thật trả lời nên KHÔNG dừng chuỗi. Hộp thư chung không giữ header gốc
 *  nên chỉ xét tiêu đề + địa chỉ gửi (thứ tự và mẫu học từ warmbly internal/app/replyclassify/headers.go: tiêu đề vắng mặt, người gửi no-reply). */
export const laTuDong = (tieuDe: string, tu: string) =>
  /\b(out of (the )?office|automatic reply|auto[- ]?reply|autoreply|auto[- ]?response|away from (my|the) (desk|office)|on (annual |parental |maternity )?leave|on vacation|ooo\b|abwesenheit|absence du bureau)/i.test(tieuDe)
  || /^(no-?reply|noreply|donotreply|do-not-reply|auto-?reply|autoresponder)@/i.test(tu.trim());

/** LOẠI THƯ DỘI theo mã trạng thái trong thân thư báo dội — bảng mã học từ warmbly internal/pkg/dsn/cause.go: chỉ 5.x.x mới là dội cứng;
 *  'cung' = địa chỉ hỏng (vào sổ chặn) · 'chinh_sach' = bị chặn vì uy tín / chính sách (KHÔNG chặn người nhận, là tín hiệu tên miền gửi có vấn đề) ·
 *  'tam' = lỗi tạm (4.x.x, hộp đầy) · 'khong_ro' = không thấy mã (xử như dội cứng nhưng ghi rõ là đoán). */
export function loaiDoi(than: string): 'cung' | 'chinh_sach' | 'tam' | 'khong_ro' {
  const ma = [...than.matchAll(/\b([245])\.(\d{1,3})\.(\d{1,3})\b/g)].map((m) => `${m[1]}.${m[2]}.${m[3]}`);
  if (ma.some((x) => /^5\.(1\.(1|2|3|6|10)|2\.1)$/.test(x))) return 'cung';
  if (ma.some((x) => /^5\.(1\.(7|8)|2\.3|6\.\d+|7\.\d+)$/.test(x))) return 'chinh_sach';
  if (ma.some((x) => /^(4\.\d+\.\d+|5\.(2\.2|3\.\d+))$/.test(x))) return 'tam';
  if (/user unknown|no such user|does not exist|mailbox not found|address rejected|unknown recipient|invalid recipient/i.test(than)) return 'cung';
  if (/blocked|spam|blacklist|reputation|policy|dmarc|not authorized/i.test(than)) return 'chinh_sach';
  if (/mailbox full|over quota|try again later|temporar/i.test(than)) return 'tam';
  return 'khong_ro';
}

/** TRẦN HÔM NAY của một tên miền gửi đang tăng dần: bắt đầu 5 thư, mỗi ngày đã gửi sạch cộng 5, không vượt trần đầy đủ
 *  (học sellbird.yaml start_sends 5 và warmbly internal/app/warmupramp/cold.go: 5 thư/ngày, mỗi ngày sạch cộng 5). */
export const tranTangDan = (tranDayDu: number, soNgayDaGui: number) => Math.max(1, Math.min(tranDayDu, 5 + 5 * Math.max(0, soNgayDaGui)));

/** địa chỉ chuẩn để so sổ chặn: chữ thường, bỏ phần +nhãn (a+x@b.com và a@b.com là một người) */
export const chuanEmail = (e: string) => { const [ten, mien] = String(e ?? '').trim().toLowerCase().split('@'); return ten && mien ? `${ten.split('+')[0]}@${mien}` : ''; };

/** PHANH chiến dịch — ngưỡng học từ warmbly (dội ≥ 5%, cảnh báo sớm ở nửa ngưỡng, cửa sổ 7 ngày) + sellbird / coldoutboundskills (xin thôi > 2% là khẩn;
 *  mẫu nhỏ dễ sai nên cần tối thiểu 20 thư mới xét). Trả { dung, canh } bằng câu lời thường; rỗng = ổn. */
export function xetPhanh(o: { gui: number; doi: number; thoi: number; chanUyTin: number }): { dung: string | null; canh: string | null } {
  if (o.gui < 20) return { dung: null, canh: null };
  const pd = o.doi / o.gui, pt = o.thoi / o.gui, pc = o.chanUyTin / o.gui, pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  if (pd >= 0.05) return { dung: `thư dội ${pct(pd)} (${o.doi}/${o.gui} thư trong 7 ngày), ngưỡng dừng 5%: danh sách có nhiều địa chỉ hỏng`, canh: null };
  if (pc >= 0.05) return { dung: `${pct(pc)} thư bị máy chủ nhận chặn vì uy tín tên miền gửi (${o.chanUyTin}/${o.gui} thư trong 7 ngày)`, canh: null };
  if (o.gui >= 50 && pt > 0.02) return { dung: `${pct(pt)} người nhận xin thôi (${o.thoi}/${o.gui} thư trong 7 ngày), ngưỡng dừng 2%: thư đang bị coi là làm phiền`, canh: null };
  if (pd >= 0.025) return { dung: null, canh: `thư dội ${pct(pd)} trong 7 ngày, đã quá nửa ngưỡng dừng 5%` };
  if (o.gui >= 50 && pt > 0.01) return { dung: null, canh: `${pct(pt)} người nhận xin thôi trong 7 ngày, đã quá nửa ngưỡng dừng 2%` };
  return { dung: null, canh: null };
}

/** câu mở đầu thư trả lời là lời xin thôi — chỉ xét 200 ký tự đầu (phần trích thư cũ bên dưới không tính) */
export const laXinThoi = (tieuDe: string, noiDung: string) => /unsubscribe/i.test(tieuDe) || /^\W*(no|no thanks?|not interested|stop|unsubscribe|remove me|please remove|take me off)\b/i.test(noiDung.trim().slice(0, 200));

