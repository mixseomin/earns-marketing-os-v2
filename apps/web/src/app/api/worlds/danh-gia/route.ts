// ĐÁNH GIÁ MÓN 3D của worlds.on.tc (repo mixseomin/worlds, trang tĩnh): ở bước Dựng 3D của kế hoạch dựng, người xem bấm
// "Đạt" / "Chưa đạt" + lý do cho từng mô-đun → trang GET/POST same-origin /api/danh-gia → nginx worlds chuyển vào đây kèm cookie SSO mos2.
// Lưu ngoài repo (git reset của deploy không xoá): /opt/worlds-du-lieu/danh-gia/<thế giới>.json
//   { "<đường glb>": { dat: boolean, ly_do: string, ban: "<glb_nguon.ngay lúc chấm>", nguoi: string, luc: ISO } }
// "ban" để trang biết món đã dựng lại SAU lần chấm chưa đạt (chấm cũ không còn áp cho bản mới).
// Máy đọc sổ này để biết món nào phải làm lại: ssh box3 cat /opt/worlds-du-lieu/danh-gia/<thế giới>.json
import { NextResponse } from 'next/server';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const KHO = '/opt/worlds-du-lieu/danh-gia';
type Cham = { dat: boolean; ly_do: string; ban: string; nguoi: string; luc: string };

const tenTg = (x: unknown) => (typeof x === 'string' && /^[a-z0-9-]{1,60}$/.test(x) ? x : null);
const tep = (tg: string) => join(KHO, `${tg}.json`);
const docSo = async (tg: string): Promise<Record<string, Cham>> => JSON.parse(await readFile(tep(tg), 'utf8').catch(() => '{}'));
const loi = (s: string, status = 400) => NextResponse.json({ ok: false, loi: s }, { status });

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return loi('Chưa đăng nhập mos2.', 401);
  const tg = tenTg(new URL(req.url).searchParams.get('the_gioi'));
  if (!tg) return loi('Thiếu ?the_gioi=<id thế giới>.');
  return NextResponse.json({ ok: true, so: await docSo(tg) });
}

export async function POST(req: Request) {
  const u = await getCurrentUser();
  if (!u) return loi('Chưa đăng nhập mos2.', 401);
  const b = await req.json().catch(() => null) as { the_gioi?: unknown; mon?: unknown; dat?: unknown; ly_do?: unknown; ban?: unknown } | null;
  const tg = tenTg(b?.the_gioi);
  if (!tg) return loi('Thiếu the_gioi.');
  if (typeof b?.mon !== 'string' || !/^hinh\/[\w\-/.]{1,300}\.glb$/.test(b.mon)) return loi('Món phải là đường glb dạng hinh/…/<món>.glb.');
  if (b.dat !== true && b.dat !== false && b.dat !== null) return loi('dat phải là true, false, hoặc null (xoá đánh giá).');
  const ly_do = typeof b.ly_do === 'string' ? b.ly_do.trim().slice(0, 2000) : '';
  const so = await docSo(tg);
  if (b.dat === null) delete so[b.mon];
  else so[b.mon] = { dat: b.dat, ly_do, ban: typeof b.ban === 'string' ? b.ban.slice(0, 40) : '', nguoi: u.displayName || u.email || String(u.id), luc: new Date().toISOString() };
  await mkdir(KHO, { recursive: true });
  await writeFile(tep(tg) + '.tam', JSON.stringify(so, null, 2) + '\n');
  await rename(tep(tg) + '.tam', tep(tg));
  return NextResponse.json({ ok: true, so });
}
