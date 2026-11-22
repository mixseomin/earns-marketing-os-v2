// Sprawl · nướng cây: chạy ez-tree (dgreenheck/ez-tree, MIT) NGOÀI máy để dựng vài mẫu cây ít tam giác, ghi ra public/du-lieu/cay.json + ảnh lá.
// Không nạp ez-tree lúc chạy trang: bản dựng của nó 4 MB vì nhúng 16 ảnh vỏ cây. Trang chỉ đọc lưới đã nướng (vài chục KB).
// Chạy (iMac): node /Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/sprawl/scripts/nuong-cay.mjs
// Lần đầu tự tải gói @dgreenheck/ez-tree@1.1.0 từ npm về scripts/.cache (không vào git). Thu ảnh lá dùng `cwebp`.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as THREE from 'three';

const DAY = dirname(fileURLToPath(import.meta.url)), KHO = join(DAY, '.cache'), GOI = join(KHO, 'package'), RA = join(DAY, '..', 'public', 'du-lieu');
const BAN = '1.1.0';
if (!existsSync(join(GOI, 'build', 'ez-tree.es.js'))) {
  mkdirSync(KHO, { recursive: true });
  const r = await fetch(`https://registry.npmjs.org/@dgreenheck/ez-tree/-/ez-tree-${BAN}.tgz`); if (!r.ok) throw new Error('không tải được ez-tree: ' + r.status);
  writeFileSync(join(KHO, 'ez-tree.tgz'), Buffer.from(await r.arrayBuffer())); execFileSync('tar', ['-xzf', join(KHO, 'ez-tree.tgz'), '-C', KHO]);
}
copyFileSync(join(GOI, 'build', 'ez-tree.es.js'), join(KHO, 'ez-tree.es.mjs')); // đuôi .mjs để node đọc là ESM; nằm trong repo nên 'three' tìm ra ở node_modules gốc
THREE.TextureLoader.prototype.load = () => new THREE.Texture(); // ngoài trình duyệt không có ảnh: chỉ cần lưới
const { Tree } = await import(pathToFileURL(join(KHO, 'ez-tree.es.mjs')).href);

// mỗi mẫu: bộ tham số gốc của ez-tree + phần ghi đè để hạ số tam giác (2 cấp cành, ít khúc, lá to hơn bù số lượng) + chiều cao đích (m)
const MAU = {
  pho: { goc: 'ash_medium', cao: 6.8, la: 'ash', de: { seed: 4107, branch: { levels: 2, children: { 0: 5, 1: 2 }, sections: { 0: 5, 1: 3, 2: 2 }, segments: { 0: 5, 1: 3, 2: 3 }, length: { 0: 36, 1: 15, 2: 8 }, start: { 1: 0.56, 2: 0.3 }, angle: { 1: 52, 2: 50 } }, leaves: { count: 6, size: 10.5, sizeVariance: 0.3, start: 0.2 } } },
  vuon: { goc: 'oak_medium', cao: 9, la: 'oak', de: { seed: 9120, branch: { levels: 2, children: { 0: 6, 1: 2 }, sections: { 0: 5, 1: 3, 2: 2 }, segments: { 0: 6, 1: 3, 2: 3 }, length: { 0: 34, 1: 17, 2: 10 }, start: { 1: 0.5, 2: 0.25 }, angle: { 1: 55, 2: 50 } }, leaves: { count: 5, size: 10.5, sizeVariance: 0.3, start: 0.25 } } },
};
const tron = (o, de) => { for (const [k, v] of Object.entries(de)) { if (v && typeof v === 'object') tron(o[k] ??= {}, v); else o[k] = v; } return o; };
const lam = (a, n = 1000) => Array.from(a, (v) => Math.round(v * n) / n);

const cay = {};
for (const [ten, m] of Object.entries(MAU)) {
  const t = new Tree(); t.loadFromJson(tron(JSON.parse(readFileSync(join(GOI, 'src', 'lib', 'presets', m.goc + '.json'), 'utf8')), m.de)); t.generate();
  const gn = t.branchesMesh.geometry, gl = t.leavesMesh.geometry; gn.computeBoundingBox();
  const k = m.cao / Math.max(1e-6, new THREE.Box3().setFromBufferAttribute(gl.attributes.position).union(gn.boundingBox).max.y);
  gn.scale(k, k, k); gl.scale(k, k, k);
  // lá: pháp tuyến hướng ra khỏi tâm tán (tấm phẳng mà sáng như một khối tròn); độ tối theo độ sâu trong tán (giả bóng đổ giữa tán), mỗi tấm lệch sắc một chút
  const p = gl.attributes.position, hop = new THREE.Box3().setFromBufferAttribute(p), tam = hop.getCenter(new THREE.Vector3()), R = hop.getSize(new THREE.Vector3()).length() / 2;
  const n = new Float32Array(p.count * 3), c = new Float32Array(p.count), v = new THREE.Vector3(); let hat = 7;
  const ngau = () => { hat = (hat * 16807) % 2147483647; return hat / 2147483647; };
  for (let i = 0; i < p.count; i += 4) { const lech = 0.86 + ngau() * 0.28;
    for (let j = i; j < i + 4; j++) { v.fromBufferAttribute(p, j).sub(tam); const sau = Math.min(1, v.length() / (R * 0.62));
      c[j] = (0.66 + 0.34 * sau) * lech; v.y = v.y * 0.7 + R * 0.35; v.normalize(); n.set([v.x, v.y, v.z], j * 3); } }
  cay[ten] = { cao: m.cao, la: m.la,
    nhanh: { p: lam(gn.attributes.position.array), n: lam(gn.attributes.normal.array, 100), i: Array.from(gn.index.array) },
    tan: { p: lam(p.array), uv: lam(gl.attributes.uv.array), n: lam(n, 100), c: lam(c, 100), i: Array.from(gl.index.array) } };
  console.log(`${ten}: cành ${gn.index.count / 3} tam giác · lá ${gl.index.count / 3} tam giác (${p.count / 4} tấm) · cao ${m.cao} m · tán rộng ${(hop.max.x - hop.min.x).toFixed(1)} m, từ ${hop.min.y.toFixed(1)} tới ${hop.max.y.toFixed(1)} m`);
}
mkdirSync(RA, { recursive: true });
writeFileSync(join(RA, 'cay.json'), JSON.stringify({ nguon: `ez-tree ${BAN} (dgreenheck/ez-tree, MIT) — nướng bằng scripts/nuong-cay.mjs`, cay }));
for (const la of new Set(Object.values(MAU).map((m) => m.la))) // ảnh lá gốc PNG 1024 px → WebP 512 px có kênh trong suốt (cwebp: brew install webp)
  execFileSync('cwebp', ['-quiet', '-q', '82', '-alpha_q', '90', '-resize', '512', '512', join(GOI, 'src', 'lib', 'assets', 'leaves', `${la}_color.png`), '-o', join(RA, `la-${la}.webp`)]);
console.log('đã ghi', join(RA, 'cay.json'), (readFileSync(join(RA, 'cay.json')).length / 1024).toFixed(0) + ' KB');
