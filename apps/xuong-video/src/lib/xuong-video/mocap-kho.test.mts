// Sổ mã mocap (mocap-kho.ts) ↔ thông số kỹ thuật (scripts/bo-set/mesh/mocap.py › MOCAP): cùng bộ mã, cùng dáng đầu / cuối, đủ tệp .bvh.
// Chạy: ../../node_modules/.bin/tsx src/lib/xuong-video/mocap-kho.test.mts
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { MOCAP_KHO } from './mocap-kho';
import { DANG_DIEN, dangMo, dangKet, thieuDongTac } from './bo-set-3d';
import { tuTheEn } from './prompt-khoi';
import { chuDien } from './trang-thai-doi-tuong';

const goc = new URL('../../../scripts/bo-set/', import.meta.url);
const py = readFileSync(new URL('mesh/mocap.py', goc), 'utf8');
const khoi = py.slice(py.indexOf('MOCAP = {'), py.indexOf('\n}', py.indexOf('MOCAP = {')));
const dong = [...khoi.matchAll(/^\s+'(\w+)':\s+\('(\d+_\d+)',\s*([\d.]+),\s*'(tren|tat_ca)'(?:,\s*([\d.]+|None)(?:,\s*'(\w+)',\s*'(\w+)')?)?\)/gm)];
assert.ok(/khung = khung\[1:\]/.test(py), 'doc_bvh phải bỏ khung 0 (tư thế chữ T hiệu chỉnh của CMU)');
assert.ok(dong.length >= 30, `đọc được ${dong.length} dòng MOCAP — regex lệch khuôn mocap.py?`);
const PY = new Map(dong.map((m) => [`mc_${m[1]}`, { ma: m[2]!, bd: Number(m[3]), kt: m[5] && m[5] !== 'None' ? Number(m[5]) : null, dau: m[6] ?? 'dung', cuoi: m[7] ?? 'dung' }]));

assert.deepEqual([...PY.keys()].sort(), Object.keys(MOCAP_KHO).sort(), 'mocap.py › MOCAP và mocap-kho.ts phải cùng bộ mã');
for (const [k, p] of PY) {
  assert.ok(existsSync(new URL(`mocap/${p.ma}.bvh`, goc)), `${k}: thiếu scripts/bo-set/mocap/${p.ma}.bvh`);
  if (p.kt != null) assert.ok(p.kt >= p.bd, `${k}: giây dừng không được trước giây bắt đầu (bằng nhau = giữ một dáng cả shot)`);
  const d = MOCAP_KHO[k]!.dang ?? ['dung', 'dung'];
  assert.deepEqual(d, [p.dau, p.cuoi], `${k}: dáng đầu / cuối lệch giữa mocap.py và mocap-kho.ts`);
  if (MOCAP_KHO[k]!.dang) assert.deepEqual(DANG_DIEN[k], MOCAP_KHO[k]!.dang, `${k}: DANG_DIEN phải lấy từ sổ`);
  assert.equal(tuTheEn({ dien: [k] }), MOCAP_KHO[k]!.en, `${k}: chữ prompt lấy từ sổ`);
  assert.equal(chuDien(k), MOCAP_KHO[k]!.vi, `${k}: chữ đọc lấy từ sổ`);
}
// DI (đổi chỗ) trong mocap.py chỉ chứa mã có thật
const di = py.match(/^DI = \{([^}]*)\}/m)![1]!.match(/'(\w+)'/g)!.map((x) => `mc_${x.slice(1, -1)}`);
for (const k of di) assert.ok(PY.has(k), `DI có ${k} không có trong MOCAP`);

// dáng đổi qua mã mới: ngồi xuống → kết NGỒI, đứng dậy khỏi ghế → mở NGỒI
assert.equal(dangKet({ dien: ['mc_ngoi_xuong@0.2-0.7'] }), 'ngoi'); assert.equal(dangMo({ dien: ['mc_dung_day_ghe@0-0.4'] }), 'ngoi');
// mô tả ↔ động tác: nghe điện thoại / bắt tay mà không khai mã → cảnh báo; khai rồi → hết
const shot = (hanh_dong: string, dien?: string[]) => ({ hanh_dong, may_3d: { vi_tri: [{ ten: 'Hạ', tam: [0, 0, 0] as [number, number, number], ...(dien ? { dien } : {}) }] } }) as unknown as Parameters<typeof thieuDongTac>[0];
assert.ok(thieuDongTac(shot('Hạ nghe điện thoại, mặt tái đi')).some((x) => x.includes('nghe điện thoại')));
assert.deepEqual(thieuDongTac(shot('Hạ nghe điện thoại, mặt tái đi', ['nghe_dien_thoai'])), []);
assert.ok(thieuDongTac(shot('Thần bắt tay đối tác')).some((x) => x.includes('bắt tay')));
assert.deepEqual(thieuDongTac(shot('Thần đứng nhìn ra cửa sổ')), [], 'không nhắc động tác → không cảnh báo');
console.log('mocap-kho: ok', PY.size, 'mã');
