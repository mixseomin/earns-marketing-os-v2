// SỔ CHỮ QC THEO KIỂU (dùng chung Chờ lên + Phiếu lên camp) — đọc ĐÚNG sổ máy tạo creative dùng (chu-qc.py chu_theo_kieu → apps/etp/so_kieu.py):
// kien (K) = apps/etp/chu-kieu.json kien[content_id] (tay, ưu tiên) ∪ etp.chu_kieu (máy sinh, apps/etp/sinh-chu-kien.py) + _link_url; dol (D) = apps/etp/form-chu.json.
import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export type Kieu = 'kien' | 'dol';
export type ChuQc = { pt: string[]; hl: string[]; de: string[]; link: string };
const run = async <T,>(s: ReturnType<typeof sql>) => (await getDb()!.execute(s)) as unknown as T[];
const docSo = (f: string) => { try { return JSON.parse(readFileSync(path.join(process.cwd(), '..', 'etp', f), 'utf8')) as Record<string, any>; } catch { return null; } };

export async function soChu(cids: number[]) {
  const k = docSo('chu-kieu.json'), f = docSo('form-chu.json');
  if (!f) throw new Error('không đọc được apps/etp/form-chu.json (cwd ' + process.cwd() + ')');
  const dol: ChuQc = { pt: f.primaryTexts ?? [], hl: f.headlines ?? [], de: f.descriptions ?? [], link: f.link_url ?? '' };
  const ids = [...new Set(cids.map((c) => Math.trunc(Number(c))).filter((c) => c > 0))];
  const may = new Map<number, { pt: string[]; hl: string[]; de: string[] }>();
  if (ids.length) for (const r of await run<{ content_id: number; pt: string[]; hl: string[]; de: string[] }>(sql`select content_id, pt, hl, de from etp.chu_kieu
      where kieu = 'kien' and content_id = any(${`{${ids.join(',')}}`}::bigint[])`)) may.set(Number(r.content_id), r);
  const kien = (cid: number): ChuQc | null => {
    const b = k?.kien?.[String(cid)], link = k?.kien?._link_url ?? '';
    if (b) return { pt: b.primaryTexts ?? [], hl: b.headlines ?? [], de: b.descriptions ?? [], link };
    const m = may.get(Number(cid)); return m ? { pt: m.pt ?? [], hl: m.hl ?? [], de: m.de ?? [], link } : null;
  };
  return { dol, kien };
}
