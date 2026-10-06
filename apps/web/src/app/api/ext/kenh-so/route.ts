import { NextResponse } from 'next/server';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { checkAuth } from '../_auth';

// Máy ghi SỐ ĐO phương pháp kéo khách (bảng kenh_so_ngay, migration 0221) — playbook pinterest.doc-so-ghim gửi mỗi ngày.
// body: { kenh, ngay?, nguon, rows: [{ sanPham, ngay?, hien, tuongTac, click, soMuc, chiTiet? }] } — upsert theo (kenh, san_pham, ngay).
export async function POST(req: Request) {
  const denied = await checkAuth(req);
  if (denied) return denied;
  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'no db' }, { status: 500 });
  let body: { kenh?: string; ngay?: string; nguon?: string; rows?: Array<{ sanPham?: string; ngay?: string; hien?: number; tuongTac?: number; click?: number; soMuc?: number; chiTiet?: unknown }> };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'body không phải JSON' }, { status: 400 }); }
  const kenh = String(body.kenh ?? '').trim();
  if (!/^[a-z0-9][a-z0-9_-]{1,40}$/.test(kenh)) return NextResponse.json({ ok: false, error: 'kenh sai' }, { status: 400 });
  const rows = (body.rows ?? []).filter((r) => r && String(r.sanPham ?? '').trim());
  if (!rows.length) return NextResponse.json({ ok: false, error: 'rows rỗng' }, { status: 400 });
  const so = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));
  let n = 0; const bad: string[] = [];
  for (const r of rows) {
    const sp = String(r.sanPham).trim().slice(0, 120);
    const ngay = String(r.ngay ?? body.ngay ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) { bad.push(`${sp}:${ngay || '(trống)'}`); continue; }
    await db.execute(sql`INSERT INTO kenh_so_ngay (kenh, san_pham, ngay, hien, tuong_tac, click, so_muc, chi_tiet, nguon, cap_nhat)
      VALUES (${kenh}, ${sp}, ${ngay}, ${so(r.hien)}, ${so(r.tuongTac)}, ${so(r.click)}, ${so(r.soMuc)}, ${r.chiTiet == null ? null : JSON.stringify(r.chiTiet)}::jsonb, ${String(body.nguon ?? '').slice(0, 60)}, now())
      ON CONFLICT (kenh, san_pham, ngay) DO UPDATE SET hien = EXCLUDED.hien, tuong_tac = EXCLUDED.tuong_tac, click = EXCLUDED.click, so_muc = EXCLUDED.so_muc,
        chi_tiet = EXCLUDED.chi_tiet, nguon = EXCLUDED.nguon, cap_nhat = now()`);
    n++;
  }
  // Báo rõ dòng bị bỏ thay vì nuốt — thiếu ngày mà im thì bảng trông vẫn ổn.
  return NextResponse.json({ ok: true, kenh, upserted: n, skipped: bad.length, ...(bad.length ? { bad: bad.slice(0, 5) } : {}) });
}
