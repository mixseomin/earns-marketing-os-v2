import 'server-only';
import mysql from 'mysql2/promise';

// Đẩy người đăng ký vào MailWizz — mỗi SẢN PHẨM một list riêng để đo được list nào sống.
//
// Ghi THẲNG vào MySQL của MailWizz qua tunnel box3→box2 (127.0.0.1:33306, systemd
// `mailwizz-tunnel`). MySQL vẫn chỉ nghe 127.0.0.1 trên box2 — tunnel không mở nó ra Internet.
//
// Vì sao không đi qua form công khai hay API v1 (đã thử cả hai, 2026-08-09):
//   • API v1 trả `[]` rỗng khi sai chữ ký → hỏng LẶNG LẼ, không phân biệt được với "list rỗng".
//   • Form công khai nhận POST đúng CSRF nhưng KHÔNG tạo hàng nào (frontend chưa cấu hình đủ).
// Ghi DB thì đúng/sai thấy ngay, và đó cũng là cách 11k subscriber cũ được nhập vào.
//
// Lỗi ở đây KHÔNG được làm hỏng cú gửi của người đọc: bản ghi gốc nằm ở `contacts` trong MOS2.

const HOST = process.env.MAILWIZZ_DB_HOST || '127.0.0.1';
const PORT = Number(process.env.MAILWIZZ_DB_PORT || 33306);
const USER = process.env.MAILWIZZ_DB_USER || 'mailwizz';
const PASS = process.env.MAILWIZZ_DB_PASSWORD || '';
const NAME = process.env.MAILWIZZ_DB_NAME || 'mailwizz';

const uid = () => Array.from({ length: 13 }, () => 'abcdef0123456789'[Math.floor(Math.random() * 16)]).join('');

export async function mailwizzSubscribe(listUid: string, email: string, name?: string, ip?: string): Promise<{ ok: boolean; error?: string }> {
  if (!listUid || !PASS) return { ok: false, error: 'chưa cấu hình MailWizz' };
  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection({ host: HOST, port: PORT, user: USER, password: PASS, database: NAME, connectTimeout: 8000 });
    const [lists] = await conn.execute('SELECT list_id FROM mw_list WHERE list_uid = ? LIMIT 1', [listUid]);
    const listId = (lists as Array<{ list_id: number }>)[0]?.list_id;
    if (!listId) return { ok: false, error: 'không có list ' + listUid };

    // Đã có thì thôi — gửi lần hai không được đẻ hàng trùng trong list.
    const [dup] = await conn.execute('SELECT subscriber_id FROM mw_list_subscriber WHERE list_id = ? AND email = ? LIMIT 1', [listId, email]);
    if ((dup as unknown[]).length) return { ok: true };

    // status='confirmed': người ta CHỦ ĐỘNG điền form trên trang của mình, không phải danh sách mua.
    await conn.execute(
      `INSERT INTO mw_list_subscriber (subscriber_uid, list_id, email, source, ip_address, status, date_added, last_updated)
       VALUES (?, ?, ?, 'web', ?, 'confirmed', NOW(), NOW())`,
      [uid(), listId, email, ip || ''],
    );
    const [rows] = await conn.execute('SELECT subscriber_id FROM mw_list_subscriber WHERE list_id = ? AND email = ? LIMIT 1', [listId, email]);
    const sid = (rows as Array<{ subscriber_id: number }>)[0]?.subscriber_id;
    const fname = (name || email.split('@')[0] || '').slice(0, 100);
    if (sid && fname) {
      const [f] = await conn.execute('SELECT field_id FROM mw_list_field WHERE list_id = ? AND tag = ? LIMIT 1', [listId, 'FNAME']);
      const fid = (f as Array<{ field_id: number }>)[0]?.field_id;
      if (fid) {
        await conn.execute(
          'INSERT INTO mw_list_field_value (field_id, subscriber_id, value, date_added, last_updated) VALUES (?, ?, ?, NOW(), NOW())',
          [fid, sid, fname],
        );
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  } finally {
    await conn?.end().catch(() => {});
  }
}

/** Thống kê một list (đọc live). Trả về ok:false + lý do thay vì ném — panel hỏng phải NÓI ra. */
export async function mailwizzListStats(listUid: string): Promise<{ ok: boolean; name?: string; total?: number; confirmed?: number; last?: string | null; error?: string }> {
  if (!PASS) return { ok: false, error: 'chưa cấu hình MailWizz' };
  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection({ host: HOST, port: PORT, user: USER, password: PASS, database: NAME, connectTimeout: 8000 });
    const [rows] = await conn.execute(
      `SELECT l.name,
              (SELECT COUNT(*) FROM mw_list_subscriber s WHERE s.list_id = l.list_id) AS total,
              (SELECT COUNT(*) FROM mw_list_subscriber s WHERE s.list_id = l.list_id AND s.status='confirmed') AS confirmed,
              (SELECT MAX(s.date_added) FROM mw_list_subscriber s WHERE s.list_id = l.list_id) AS last
       FROM mw_list l WHERE l.list_uid = ? LIMIT 1`, [listUid]);
    const r = (rows as Array<{ name: string; total: number; confirmed: number; last: string | null }>)[0];
    if (!r) return { ok: false, error: 'không có list' };
    return { ok: true, name: r.name, total: Number(r.total), confirmed: Number(r.confirmed), last: r.last ? String(r.last) : null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  } finally { await conn?.end().catch(() => {}); }
}

export interface MailwizzList {
  uid: string; name: string; owner: string; status: string;
  total: number; confirmed: number; unsubscribed: number; other: number;
  last: string | null;
}

export interface MailwizzSnapshot {
  lists: MailwizzList[];
  /** NGƯỜI, không phải hàng: một email nằm ở nhiều list thì vẫn là một người. */
  people: number;
  /** Tổng số HÀNG confirmed cộng qua mọi list — khác `people` khi có email trùng list. */
  confirmedRows: number;
  /** Số email trong blacklist (không gửi được). null = không đọc được, KHÁC 0. */
  blocked: number | null;
  readAt: string;
}

/**
 * MỌI list kèm số liệu — cho bảng theo dõi ở TRANG CHỦ.
 *
 * KHÔNG lọc theo l.status: đây là bảng "theo dõi TẤT CẢ list". Lọc active thì hôm nay không mất gì
 * (47/47 đang active) nhưng ngày ai archive một list, nó BIẾN MẤT im lặng khỏi bảng — đúng kiểu lỗi
 * không ai phát hiện ra. Thay vì giấu, trả `status` về để bảng dán nhãn.
 *
 * Một câu SQL cho toàn bộ list (không N+1): 47 list × một vòng qua tunnel cho một trang ai cũng mở
 * là 47 lần chờ mạng.
 *
 * Ném lỗi thay vì trả rỗng: mảng rỗng làm trang chủ nói dối "không có list nào".
 */
export async function mailwizzAllLists(): Promise<MailwizzSnapshot> {
  if (!PASS) throw new Error('chưa cấu hình MailWizz');
  let conn: mysql.Connection | null = null;
  try {
    // 4s cho đường ĐỌC (ghi lead giữ 8s): tunnel chết mà chờ 8s thì mỗi lần hết cache là trang chủ treo.
    conn = await mysql.createConnection({ host: HOST, port: PORT, user: USER, password: PASS, database: NAME, connectTimeout: 4000 });
    const [rows] = await conn.execute(
      `SELECT l.list_uid AS uid, l.name, l.status, c.email AS owner,
              COALESCE(s.total, 0)        AS total,
              COALESCE(s.confirmed, 0)    AS confirmed,
              COALESCE(s.unsubscribed, 0) AS unsubscribed,
              COALESCE(s.other, 0)        AS other,
              s.last
       FROM mw_list l
       LEFT JOIN mw_customer c ON c.customer_id = l.customer_id
       LEFT JOIN (
         SELECT list_id,
                COUNT(*) AS total,
                SUM(status = 'confirmed')    AS confirmed,
                SUM(status = 'unsubscribed') AS unsubscribed,
                SUM(status NOT IN ('confirmed','unsubscribed')) AS other,
                MAX(date_added) AS last
         FROM mw_list_subscriber GROUP BY list_id
       ) s ON s.list_id = l.list_id
       ORDER BY COALESCE(s.confirmed, 0) DESC, COALESCE(s.total, 0) DESC, l.list_id DESC`);

    const [peopleRows] = await conn.execute(
      `SELECT COUNT(DISTINCT email) AS people FROM mw_list_subscriber WHERE status = 'confirmed'`);
    const people = Number((peopleRows as Array<{ people: number }>)[0]?.people ?? 0);

    // Blacklist đọc riêng và được phép hỏng: user mos2sync chỉ có quyền trên 4 bảng list. Hỏng thì
    // trả null để chỗ hiển thị nói "không kiểm tra được", KHÔNG hiện 0 (0 nghĩa là đã kiểm và sạch).
    let blocked: number | null = null;
    try {
      const [b] = await conn.execute(`SELECT COUNT(*) AS n FROM mw_email_blacklist`);
      blocked = Number((b as Array<{ n: number }>)[0]?.n ?? 0);
    } catch { blocked = null; }

    const lists = (rows as Array<Record<string, unknown>>).map((r) => ({
      uid: String(r.uid), name: String(r.name ?? ''), status: String(r.status ?? ''), owner: String(r.owner ?? ''),
      total: Number(r.total ?? 0), confirmed: Number(r.confirmed ?? 0),
      unsubscribed: Number(r.unsubscribed ?? 0), other: Number(r.other ?? 0),
      // mysql2 trả Date — String(Date) ra "Mon Jul 21 2026 07:24:11 GMT+0700", vô dụng để so sánh/cắt.
      last: r.last instanceof Date ? r.last.toISOString() : (r.last ? String(r.last) : null),
    }));
    const confirmedRows = lists.reduce((n, l) => n + l.confirmed, 0);
    return { lists, people, confirmedRows, blocked, readAt: new Date().toISOString() };
  } finally { await conn?.end().catch(() => {}); }
}
