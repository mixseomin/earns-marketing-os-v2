#!/usr/bin/env node
// Kiểm dữ liệu Sổ Thế Giới (apps/worlds/public/the-gioi): id trùng, sinh_tu trỏ id không có, thiếu lop/type,
// phần tử không phải Gốc mà không sinh từ đâu, vòng nhân quả khép kín, index.json lệch tệp. Đỏ = exit 1.
// Chạy: node apps/worlds/scripts/kiem.mjs [thư mục]   ·   --tu-kiem: phá thử dữ liệu mẫu, phải đỏ đúng chỗ.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOP = new Set(['goc', 'phat', 'nhu', 'hinh', 'xa', 'su', 'truyen']);
const LOAI = new Set(['Ability', 'Character', 'Collective', 'Construct', 'Creature', 'Event', 'Family', 'Institution', 'Language', 'Law', 'Location', 'Map', 'Marker', 'Narrative', 'Object', 'Phenomenon', 'Pin', 'Relation', 'Species', 'Title', 'Trait', 'Zone', 'Need']);

export function kiemTheGioi(w) {
  const loi = [];
  const ids = new Map();
  for (const e of w.elements || []) {
    if (!e.id) { loi.push(`phần tử thiếu id: ${e.name}`); continue; }
    if (ids.has(e.id)) loi.push(`id trùng: ${e.id}`);
    ids.set(e.id, e);
    if (!LOAI.has(e.type)) loi.push(`${e.id}: type "${e.type}" không thuộc OnlyWorlds (+Need)`);
    if (!LOP.has(e.lop)) loi.push(`${e.id}: lop "${e.lop}" không hợp lệ`);
    if (!e.name) loi.push(`${e.id}: thiếu name`);
  }
  for (const e of ids.values()) {
    const st = e.sinh_tu || [];
    for (const p of st) if (!ids.has(p)) loi.push(`${e.id}: sinh_tu trỏ "${p}" không có`);
    if (e.lop !== 'goc' && !st.length) loi.push(`${e.id}: không phải Gốc mà không sinh từ đâu`);
  }
  const mau = new Map();
  const di = (id, vet) => {
    if (mau.get(id) === 2) return;
    if (mau.get(id) === 1) { loi.push(`vòng nhân quả: ${[...vet, id].join(' → ')}`); return; }
    mau.set(id, 1);
    for (const p of ids.get(id)?.sinh_tu || []) if (ids.has(p)) di(p, [...vet, id]);
    mau.set(id, 2);
  };
  for (const id of ids.keys()) di(id, []);
  return loi;
}

function kiemThuMuc(thu) {
  const loi = [];
  const idx = JSON.parse(fs.readFileSync(path.join(thu, 'index.json'), 'utf8'));
  const tep = fs.readdirSync(thu).filter((f) => f.endsWith('.json') && f !== 'index.json').map((f) => f.slice(0, -5));
  for (const t of tep) if (!idx.worlds.some((w) => w.id === t)) loi.push(`index.json thiếu thế giới ${t}`);
  for (const w of idx.worlds) {
    if (!tep.includes(w.id)) { loi.push(`index.json có ${w.id} mà không có tệp`); continue; }
    const tg = JSON.parse(fs.readFileSync(path.join(thu, `${w.id}.json`), 'utf8'));
    if (tg.id !== w.id) loi.push(`${w.id}.json mang id ${tg.id}`);
    if (w.so_phan_tu !== tg.elements.length) loi.push(`${w.id}: index ghi ${w.so_phan_tu} phần tử, tệp có ${tg.elements.length}`);
    for (const l of kiemTheGioi(tg)) loi.push(`${w.id}/${l}`);
    console.log(`${w.id}: ${tg.elements.length} phần tử`);
  }
  return loi;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--tu-kiem')) {
    const mau = { elements: [{ id: 'a', type: 'Phenomenon', name: 'A', lop: 'goc', sinh_tu: [] }, { id: 'b', type: 'Need', name: 'B', lop: 'nhu', sinh_tu: ['a'] }] };
    const bai = [
      ['sạch', mau, 0],
      ['trỏ id không có', { elements: [...mau.elements, { id: 'c', type: 'Event', name: 'C', lop: 'su', sinh_tu: ['zz'] }] }, /không có/],
      ['id trùng', { elements: [...mau.elements, mau.elements[1]] }, /trùng/],
      ['mồ côi', { elements: [...mau.elements, { id: 'c', type: 'Event', name: 'C', lop: 'su', sinh_tu: [] }] }, /không sinh từ đâu/],
      ['vòng', { elements: [{ id: 'a', type: 'Event', name: 'A', lop: 'su', sinh_tu: ['b'] }, { id: 'b', type: 'Event', name: 'B', lop: 'su', sinh_tu: ['a'] }] }, /vòng/],
      ['loại lạ', { elements: [{ id: 'a', type: 'Dragon', name: 'A', lop: 'goc', sinh_tu: [] }] }, /OnlyWorlds/],
    ];
    let hong = 0;
    for (const [ten, w, mong] of bai) { const l = kiemTheGioi(w); const dat = mong === 0 ? l.length === 0 : l.some((x) => mong.test(x)); console.log(`${dat ? '✓' : '✗'} ${ten}${dat ? '' : ': ' + JSON.stringify(l)}`); if (!dat) hong++; }
    process.exit(hong ? 1 : 0);
  }
  const thu = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../public/the-gioi');
  const loi = kiemThuMuc(thu);
  if (loi.length) { console.error(`✗ ${loi.length} lỗi:\n  ` + loi.join('\n  ')); process.exit(1); }
  console.log('✓ dữ liệu sạch');
}
