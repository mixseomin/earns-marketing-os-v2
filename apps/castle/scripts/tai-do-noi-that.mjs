#!/usr/bin/env node
// Đồ nội thất có hình thật cho castle: KayKit "Dungeon Remastered" (Kay Lousberg, CC0 1.0 — LICENSE.txt trong repo
// KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0). Tải các món dùng trong phòng, gộp thành MỘT tệp (mỗi món là một Scene
// mang tên castle), dùng chung vân màu, nén meshopt → public/tai-san/do-noi-that.glb.
// Công cụ glTF-Transform (MIT) cài NGOÀI repo (~/.cache/castle-tools, xem scripts/tai-nhan-vat.mjs). Chạy: node apps/castle/scripts/tai-do-noi-that.mjs
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const req = createRequire(join(homedir(), '.cache/castle-tools/node_modules/'));
const { NodeIO } = await import(req.resolve('@gltf-transform/core'));
const { ALL_EXTENSIONS } = await import(req.resolve('@gltf-transform/extensions'));
const { prune, dedup, meshopt, mergeDocuments, unpartition } = await import(req.resolve('@gltf-transform/functions'));
const { MeshoptEncoder, MeshoptDecoder } = await import(req.resolve('meshoptimizer'));

const GOC = 'https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0/main/addons/kaykit_dungeon_remastered/Assets/gltf/';
const DO = {
  ghe: 'chair.gltf.glb', gheDau: 'stool.gltf.glb', banDai: 'table_long_tablecloth_decorated_A.gltf.glb', banDaiTron: 'table_long.gltf.glb',
  banVua: 'table_medium_tablecloth_decorated_B.gltf.glb', banNho: 'table_small_decorated_A.gltf.glb', giuong: 'bed_decorated.gltf.glb',
  giaSach: 'shelf_large.gltf.glb', keNen: 'shelf_small_candles.gltf.glb', ke: 'shelves.gltf.glb', nen: 'candle_lit.gltf.glb', nen3: 'candle_triple.gltf.glb',
  ruongVang: 'chest_gold.glb', ruong: 'chest.glb', hom: 'trunk_medium_A.gltf.glb', dia: 'plate_food_A.gltf.glb', dia2: 'plate_food_B.gltf.glb',
  diaTrong: 'plate.gltf.glb', chai: 'bottle_A_labeled_brown.gltf.glb', chai2: 'bottle_B_green.gltf.glb', thung: 'barrel_small.gltf.glb',
  thungRuou: 'keg_decorated.gltf.glb', coXanh: 'banner_patternA_blue.gltf.glb', coDo: 'banner_patternB_red.gltf.glb', coVang: 'banner_shield_yellow.gltf.glb',
  kiemKhien: 'sword_shield_gold.gltf.glb', duoc: 'torch_mounted.gltf.glb', tienVang: 'coin_stack_large.gltf.glb',
};
const KHO = join(homedir(), '.cache/castle-tools/kaykit'); mkdirSync(KHO, { recursive: true });
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
let doc = null;
for (const [ten, tep] of Object.entries(DO)) {
  const p = join(KHO, tep);
  if (!existsSync(p)) { const r = await fetch(GOC + tep); if (!r.ok) throw new Error(`${tep}: ${r.status}`); writeFileSync(p, Buffer.from(await r.arrayBuffer())); }
  const d = await io.read(p);
  for (const sc of d.getRoot().listScenes()) sc.setName(ten);
  if (!doc) doc = d; else mergeDocuments(doc, d);
}
await doc.transform(unpartition(), dedup(), prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
doc.getRoot().getAsset().extras = { nguon: 'KayKit Dungeon Remastered — Kay Lousberg (www.kaylousberg.com), CC0 1.0', mon: Object.keys(DO) };
const ra = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'tai-san', 'do-noi-that.glb');
await io.write(ra, doc);
console.log(`đã ghi ${ra}: ${(statSync(ra).size / 1e6).toFixed(2)} MB, ${doc.getRoot().listScenes().length} món, ${doc.getRoot().listTextures().length} vân`);
