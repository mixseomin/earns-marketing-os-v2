import 'server-only';

// Đẩy một người đăng ký vào MailWizz — mỗi SẢN PHẨM một list riêng để đo được list nào sống.
//
// Đi qua form công khai của MailWizz (`/index.php?/lists/<uid>/subscribe`) chứ không qua API v1:
// API v1 đòi chữ ký HMAC và trả về `[]` rỗng khi sai — tức là hỏng LẶNG LẼ, không phân biệt được
// "list rỗng" với "sai khoá". Form công khai thì có mã CSRF, đọc được, và sai là báo lỗi thật.
//
// KHÔNG để lỗi MailWizz làm hỏng cú gửi của người đọc: contacts trong MOS2 mới là bản ghi gốc,
// đây là bản đồng bộ. Hỏng thì log rồi đi tiếp.

const BASE = process.env.MAILWIZZ_URL || 'http://37.27.241.222:8810';
const HOST = process.env.MAILWIZZ_HOST || 'mail.on.tc';

export async function mailwizzSubscribe(listUid: string, email: string, name?: string): Promise<{ ok: boolean; error?: string }> {
  if (!listUid) return { ok: false, error: 'thiếu list uid' };
  const url = `${BASE}/index.php?/lists/${listUid}/subscribe`;
  try {
    const page = await fetch(url, { headers: { Host: HOST }, cache: 'no-store' });
    const html = await page.text();
    const cookie = (page.headers.get('set-cookie') || '').split(';')[0];
    const tokenName = html.match(/name="csrf-token-name" content="([^"]+)"/)?.[1] ?? 'csrf_token';
    const tokenVal = html.match(/name="csrf-token-value" content="([^"]+)"/)?.[1] ?? '';

    const body = new URLSearchParams({ EMAIL: email, FNAME: name || email.split('@')[0]!, [tokenName]: tokenVal });
    const res = await fetch(url, {
      method: 'POST', redirect: 'manual', cache: 'no-store',
      headers: { Host: HOST, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
      body,
    });
    // 302 = nhận rồi (chuyển sang trang "kiểm tra hộp thư"), 200 = form trả về kèm lỗi.
    return res.status === 302 || res.status === 200 ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
