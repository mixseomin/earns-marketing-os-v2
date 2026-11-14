#!/usr/bin/env node
// Nhân vật NGƯỜI có xương + động tác thật cho castle: Quaternius "Universal Animation Library" (CC0 1.0, @Quaternius),
// lấy từ bản công khai trong repo DyingStar-game/DyingStar (nhánh develop, có License.txt CC0 gốc). UAL1_Standard (người mẫu + 43 động tác)
// + UAL2 (134 động tác, cùng bộ xương) → giữ đúng các động tác castle dùng, lấy mẫu lại, nén meshopt → public/tai-san/nguoi.glb.
// Công cụ glTF-Transform (MIT) cài NGOÀI repo: npm i --prefix ~/.cache/castle-tools @gltf-transform/core@4 @gltf-transform/functions@4 @gltf-transform/extensions@4 meshoptimizer
// Chạy: node apps/castle/scripts/tai-nhan-vat.mjs
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const CONG_CU = join(homedir(), '.cache/castle-tools/node_modules/');
const req = createRequire(CONG_CU);
const { NodeIO } = await import(req.resolve('@gltf-transform/core'));
const { ALL_EXTENSIONS, EXTMeshoptCompression } = await import(req.resolve('@gltf-transform/extensions'));
const { prune, dedup, resample, quantize, meshopt } = await import(req.resolve('@gltf-transform/functions'));
const { MeshoptEncoder, MeshoptDecoder } = await import(req.resolve('meshoptimizer'));

const GOC = 'https://raw.githubusercontent.com/DyingStar-game/DyingStar/develop/assets/Universal%20Animation%20Library/Unreal-Godot/';
const KHO = join(homedir(), '.cache/castle-tools/ual'); mkdirSync(KHO, { recursive: true });
// tên trong castle → [tệp, tên động tác gốc]
const GIU = {
  dung: ['UAL1_Standard', 'Idle_Loop'], di: ['UAL1_Standard', 'Walk_Loop'], chay: ['UAL1_Standard', 'Jog_Fwd_Loop'], nuocRut: ['UAL1_Standard', 'Sprint_Loop'],
  nhayLen: ['UAL1_Standard', 'Jump_Start'], tren: ['UAL1_Standard', 'Jump_Loop'], tiepDat: ['UAL1_Standard', 'Jump_Land'],
  ngoi: ['UAL1_Standard', 'Crouch_Idle_Loop'], ngoiDi: ['UAL1_Standard', 'Crouch_Fwd_Loop'],
  boi: ['UAL1_Standard', 'Swim_Fwd_Loop'], boiDung: ['UAL1_Standard', 'Swim_Idle_Loop'],
  ngoiGhe: ['UAL1_Standard', 'Sitting_Idle_Loop'], laiXe: ['UAL1_Standard', 'Driving_Loop'],
  mua: ['UAL1_Standard', 'Dance_Loop'], noi: ['UAL1_Standard', 'Idle_Talking_Loop'], chao: ['UAL1_Standard', 'Interact'], nga: ['UAL1_Standard', 'Death01'],
  len1m: ['UAL2', 'ClimbUp_1m'], len2m: ['UAL2', 'ClimbUp_2m'], vuot: ['UAL2', 'SafetyVault'], buocLen: ['UAL2', 'StepUp'],
  nem: ['UAL2', 'OverhandThrow'], da: ['UAL2', 'Melee_Knee'], gat: ['UAL2', 'Yes'],
};

async function tai(ten) {
  const p = join(KHO, ten + '.glb');
  if (!existsSync(p)) { process.stdout.write(`tải ${ten}.glb… `); const r = await fetch(GOC + ten + '.glb'); if (!r.ok) throw new Error(`${ten}: ${r.status}`); writeFileSync(p, Buffer.from(await r.arrayBuffer())); console.log('xong'); }
  return p;
}
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(await tai('UAL1_Standard'));
const doc2 = await io.read(await tai('UAL2'));

// chép động tác UAL2 sang: kênh trỏ vào nút cùng TÊN xương trong người mẫu UAL1 (hai tệp chung bộ xương Mannequin)
const nutTheoTen = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
const buf = doc.getRoot().listBuffers()[0];
for (const [moi, [tep, goc]] of Object.entries(GIU)) {
  if (tep !== 'UAL2') continue;
  const a2 = doc2.getRoot().listAnimations().find((a) => a.getName() === goc); if (!a2) throw new Error('UAL2 thiếu ' + goc);
  const a = doc.createAnimation(goc);
  for (const ch of a2.listChannels()) {
    const n = nutTheoTen.get(ch.getTargetNode()?.getName()); if (!n) continue;
    const s2 = ch.getSampler();
    const chep = (acc) => doc.createAccessor().setType(acc.getType()).setArray(acc.getArray().slice()).setBuffer(buf);
    const s = doc.createAnimationSampler().setInput(chep(s2.getInput())).setOutput(chep(s2.getOutput())).setInterpolation(s2.getInterpolation());
    a.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(n).setTargetPath(ch.getTargetPath()).setSampler(s));
  }
}
// giữ đúng các động tác cần, đổi sang tên castle
const canGoc = new Map(Object.entries(GIU).map(([moi, [, goc]]) => [goc, moi]));
for (const a of doc.getRoot().listAnimations()) { const moi = canGoc.get(a.getName()); if (moi) a.setName(moi); else a.dispose(); }
const thieu = Object.keys(GIU).filter((k) => !doc.getRoot().listAnimations().some((a) => a.getName() === k));
if (thieu.length) throw new Error('thiếu động tác: ' + thieu.join(', '));
// bỏ kênh thừa (24 động tác × 65 xương × 3 kênh làm khung JSON 1,45 MB): co giãn xương không đổi; dịch chuyển chỉ cần ở root / pelvis
// (xương khác dài cố định). Ngón tay chỉ giữ ở vài động tác cần tay (ném, chào) — ở đâu cũng là cùng một nắm tay.
const DICH = new Set(['root', 'pelvis']), NGON = /^(?:index|middle|pinky|ring|thumb)_/;
let bo = 0;
for (const a of doc.getRoot().listAnimations()) for (const ch of a.listChannels()) {
  const n = ch.getTargetNode()?.getName() || '', p = ch.getTargetPath();
  if (p === 'scale' || (p === 'translation' && !DICH.has(n)) || (NGON.test(n) && !['nem', 'chao', 'gat'].includes(a.getName()))) { const s = ch.getSampler(); ch.dispose(); s?.dispose(); bo++; }
}
console.log('bỏ', bo, 'kênh thừa');
await doc.transform(resample({ tolerance: 4e-3 }), prune(), dedup(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
doc.getRoot().getAsset().extras = { nguon: 'Quaternius Universal Animation Library — CC0 1.0 (https://quaternius.com)', dung: Object.keys(GIU) };
const ra = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'tai-san', 'nguoi.glb');
mkdirSync(dirname(ra), { recursive: true });
await io.write(ra, doc);
console.log(`đã ghi ${ra}: ${(statSync(ra).size / 1e6).toFixed(2)} MB, ${doc.getRoot().listAnimations().length} động tác`);
