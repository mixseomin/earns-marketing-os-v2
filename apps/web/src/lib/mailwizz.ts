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
