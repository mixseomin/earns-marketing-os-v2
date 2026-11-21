#!/usr/bin/env node
// NÓN THEO TIA — đọc khối mái nón / chóp từ trang (chân mái y1 + đỉnh sau mọi chỉnh của ns.js) rồi gọi non-theo-tia.py đo đỉnh + bán kính chân trên ảnh định vị.
//   node apps/castle/scripts/non-theo-tia.mjs [--ghi] [--khoi way/…,…] [--anh-ra <thư mục>]    --tu-kiem → non-theo-tia.py --tu-kiem
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { GOC, doiSo, moTrang } from './chung.mjs';
const PY = join(homedir(), '.venvs/castle-khop/bin/python'), PYS = join(GOC, 'scripts', 'non-theo-tia.py');
if (doiSo.includes('--tu-kiem')) process.exit(spawnSync(PY, ['-W', 'ignore', PYS, '--tu-kiem'], { stdio: 'inherit' }).status);
const k = doiSo.indexOf('--khoi'), CHON = k < 0 ? null : doiSo[k + 1].split(',');
const { pg, dong } = await moTrang({ anh3d: false, them: 'non_tia=0' }); // non_tia=0: đo trên nón OSM gốc, không nón đã sửa
const vao = await pg.evaluate((CHON) => { const n = window.__ns, tam = (v) => [v.reduce((a, p) => a + p[0], 0) / v.length, v.reduce((a, p) => a + p[1], 0) / v.length];
  const tat_ca = n.dsKhoi.map((q) => { const [x, z] = tam(q.v); return { id: q.id, x, z, yTren: q.yTren, y1: q._y1, yDuoi: q.yDuoi, vo: !!q.vo, v: q.v, mai: q.tags['roof:shape'] || null }; });
  const khoi = n.dsKhoi.filter((q) => (CHON ? CHON.includes(q.id) : /^(cone|pyramidal)$/.test(q.tags['roof:shape'] || '')) && q._y1 != null).map((q) => { const [x, z] = tam(q.v);
    return { id: q.id, x, z, y1: q._y1, yTren: q.yTren, r: q.v.reduce((a, p) => a + Math.hypot(p[0] - x, p[1] - z), 0) / q.v.length }; });
  return { khoi, tat_ca }; }, CHON);
await dong();
process.exit(spawnSync(PY, ['-W', 'ignore', PYS, ...doiSo.filter((a) => a === '--ghi'), ...(doiSo.includes('--anh-ra') ? ['--anh-ra', doiSo[doiSo.indexOf('--anh-ra') + 1]] : [])], { input: JSON.stringify(vao), stdio: ['pipe', 'inherit', 'inherit'] }).status);
