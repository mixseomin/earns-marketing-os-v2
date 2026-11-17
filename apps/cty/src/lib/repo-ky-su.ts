// REPO CỦA TỪNG KỸ SƯ CLI (anh 17/11/2026 "Mỗi con CLI đều có repo riêng thì phải chỉ rõ ra") — đọc từ máy, không gõ tay:
// hồ sơ người (heartbeat) → NHIP_MAY (máy + nhãn launchd) → sổ bộ điều phối cong-ty/viec-nen.json (thu_muc + chay) → các cây làm việc.
// Nhánh: cây riêng ~/may-ky-su/<người>/<repo> luôn là ky-su/<người> (may/cay-rieng.mjs). Cây khác (repo chính trên Mac) chưa có đường đẩy nhánh về box3 → để trống.
import fs from 'node:fs';
import path from 'node:path';
import { GOC } from '../../worker/goc.mjs';
import { NHIP_MAY } from '../../worker/nhip-may.mjs';
import { docSoNen } from '../../worker/lich-may.mjs';

export type CayLam = { repo: string; dir: string; may: string; nhanh?: string };
type ViecNen = { nhan: string; chay?: string[]; thu_muc?: string };

const CAY_RIENG = /^(\/Users\/[^/]+\/may-ky-su\/([a-z0-9-]+)\/[^/]+)/;
/** Gốc cây từ một đường dẫn: cây riêng kỹ sư → /Users/x/may-ky-su/<người>/<repo>; còn lại giữ nguyên thư mục. */
function goc(p: string): { dir: string; nhanh?: string } {
  const m = CAY_RIENG.exec(p); return m ? { dir: m[1]!, nhanh: `ky-su/${m[2]}` } : { dir: p.replace(/\/+$/, '') };
}
/** Repo khác mà script của việc đó làm trong (vd spy-gop-y.mjs: path.join(HOME, 'Me/GitHub/spy-on-tc')) — đọc thẳng mã script trong repo này. */
function repoTrongScript(file: string, home: string): string[] {
  const m = /\/apps\/cty\/(may\/[^/]+\.m?js)$/.exec(file); if (!m) return [];
  let src = ''; try { src = fs.readFileSync(path.join(GOC, m[1]!), 'utf8'); } catch { return []; }
  return [...src.matchAll(/path\.join\((?:HOME|os\.homedir\(\)),\s*'(Me\/GitHub\/[^'/]+)'\)/g)].map((x) => `${home}/${x[1]}`);
}

export function cayCua(heartbeat: unknown): CayLam[] {
  const so = docSoNen() as { viec: ViecNen[] }; const ra = new Map<string, CayLam>();
  for (const v of String(heartbeat ?? '').split(',').map((s) => s.trim())) {
    const x = (NHIP_MAY as Record<string, { may: string; launchd: string }>)[v]; if (!x) continue;
    const e = so.viec.find((n) => n.nhan === `${x.may}:${x.launchd}`); if (!e) continue;
    const home = /^(\/Users\/[^/]+)/.exec(e.thu_muc ?? e.chay?.find((c) => c.startsWith('/Users/')) ?? '')?.[1] ?? '';
    const dirs = [...(e.chay ?? []).filter((c) => CAY_RIENG.test(c)), ...(e.thu_muc ? [e.thu_muc] : []), ...(e.chay ?? []).flatMap((c) => repoTrongScript(c, home))];
    for (const d of dirs) { const g = goc(d); if (!g.dir.startsWith('/Users/') || g.dir === home || ra.has(g.dir)) continue;
      ra.set(g.dir, { repo: path.basename(g.dir), dir: g.dir, may: x.may, nhanh: g.nhanh }); }
  }
  // đã có cây riêng của một repo thì bản chính cùng repo (script chỉ kéo nó theo, vd tho-may.mjs) không phải chỗ người đó làm
  const ds = [...ra.values()]; return ds.filter((c) => c.nhanh || !ds.some((k) => k.nhanh && k.repo === c.repo));
}
