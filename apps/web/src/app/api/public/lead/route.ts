import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

// CỬA CÔNG KHAI DUY NHẤT của MOS2: người đọc để lại email / gửi phản hồi từ trang landing.
//
// Vì sao ghi vào MOS2 chứ không đẩy thẳng Listmonk: Listmonk trên box2 ĐANG TẮT (container không
// còn, pgdata 11k subscriber vẫn nguyên — 2026-08-09). Trang landing không được phụ thuộc một dịch
// vụ đang chết: mất email người đọc là mất vĩnh viễn, không lấy lại được. Ghi vào `contacts` trước,
// đồng bộ sang Listmonk sau khi nó sống lại (imported_from giữ nguyên nguồn để lọc).
//
// KHÔNG thêm bảng: một người để lại email = một hàng `contacts` (project_id + imported_from + tags).
//
// An toàn: chỉ POST, chỉ 3 trường, chặn theo IP+phút, email phải hợp lệ, cắt độ dài. Không trả về
// bất kỳ dữ liệu nào của hệ thống — cửa công khai thì chỉ được phép NHẬN.

export const dynamic = 'force-dynamic';

const ORIGINS = new Set([
  'https://codecrate.on.tc',
  'https://www.codecrate.on.tc',
]);

const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ORIGINS.has(origin) ? origin : 'https://codecrate.on.tc',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
});

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get('origin')) });
}

// Chặn spam ở mức thô: cùng một IP tối đa 5 lần / 10 phút. Trong RAM là đủ — mất khi restart cũng
// không sao, đây là gờ giảm tốc chứ không phải hàng rào. Hàng rào thật = ràng buộc UNIQUE dưới DB.
const hits = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const keep = (hits.get(ip) || []).filter((t) => now - t < 600_000);
  keep.push(now);
  hits.set(ip, keep);
  if (hits.size > 5000) hits.clear();
  return keep.length > 5;
}

const clean = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  const headers = cors(origin);
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0]!.trim() || 'unknown';
  if (tooMany(ip)) return NextResponse.json({ ok: false, error: 'too many' }, { status: 429, headers });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* form thường cũng chấp nhận */ }

  const email = clean(body.email, 160).toLowerCase();
  const note = clean(body.note, 4000);
  const name = clean(body.name, 120);
  const source = clean(body.source, 60) || 'landing';
  // Bẫy bot: input ẩn "company" — người thật không thấy nên không điền. Điền = bot, nhận 200 rồi vứt
  // (trả lỗi thì bot biết đường mà thử lại).
  if (clean(body.company, 80)) return NextResponse.json({ ok: true }, { headers });

  if (!EMAIL.test(email)) return NextResponse.json({ ok: false, error: 'email không hợp lệ' }, { status: 400, headers });
  if (!note && !body.subscribe) return NextResponse.json({ ok: false, error: 'chưa có nội dung' }, { status: 400, headers });

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'db off' }, { status: 503, headers });

  // Cùng email gửi lần hai = NỐI thêm phản hồi, không đè lên phản hồi cũ và không đẻ hàng trùng.
  await db.execute(sql`
    INSERT INTO contacts (tenant_id, project_id, name, email, notes, tags, imported_from, category, last_touched_at, created_at, updated_at)
    VALUES ('self', 'codecrate', NULLIF(${name}, ''), ${email},
            NULLIF(${note}, ''), ${JSON.stringify(['reader', source])}::jsonb,
            ${`landing:${source}`}, 'reader', now(), now(), now())
    ON CONFLICT DO NOTHING`);

  // Không có ràng buộc UNIQUE trên (email, project) thì ON CONFLICT không bắt được — gộp tay.
  await db.execute(sql`
    WITH dup AS (
      SELECT id, notes, row_number() OVER (ORDER BY id) AS rn
      FROM contacts WHERE project_id = 'codecrate' AND lower(email) = ${email})
    UPDATE contacts c SET
      notes = (SELECT string_agg(notes, E'\\n---\\n' ORDER BY id) FROM dup WHERE notes IS NOT NULL),
      updated_at = now(), last_touched_at = now()
    FROM dup WHERE dup.rn = 1 AND c.id = dup.id`);
  await db.execute(sql`
    DELETE FROM contacts WHERE id IN (
      SELECT id FROM (
        SELECT id, row_number() OVER (ORDER BY id) AS rn
        FROM contacts WHERE project_id = 'codecrate' AND lower(email) = ${email}) t
      WHERE t.rn > 1)`);

  return NextResponse.json({ ok: true }, { headers });
}
