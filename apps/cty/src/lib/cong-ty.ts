// Kho hồ sơ công ty = thư mục `cong-ty/` (markdown + frontmatter + svg), đọc lúc render. Đây là nguồn sự thật cho
// sơ đồ tổ chức, phòng, nhân sự, luật; worker đợt sau đọc cùng thư mục này để lắp ráp gói đọc theo vai.
// ponytail: parser frontmatter tự viết (key: value · [a, b] · số · true/false), đủ cho hồ sơ; không thêm gray-matter.
import 'server-only';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.join(process.cwd(), 'cong-ty');

export type Fm = Record<string, string | number | boolean | string[]>;
export type Doc = { id: string; fm: Fm; body: string };

export function parseFm(raw: string): { fm: Fm; body: string } {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: raw };
  const fm: Fm = {};
  for (const line of (m[1] ?? '').split('\n')) {
    const kv = line.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    const k = kv[1] ?? ''; const v: string = (kv[2] ?? '').trim();
    if (v.startsWith('[') && v.endsWith(']')) { fm[k] = v.slice(1, -1).split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean); continue; }
    if (v === 'true' || v === 'false') { fm[k] = v === 'true'; continue; }
    if (/^-?\d+(\.\d+)?$/.test(v)) { fm[k] = Number(v); continue; }
    fm[k] = v.replace(/^["']|["']$/g, '');
  }
  return { fm, body: m[2] ?? '' };
}

function readDoc(file: string, id: string): Doc | null {
  if (!fs.existsSync(file)) return null;
  const { fm, body } = parseFm(fs.readFileSync(file, 'utf8'));
  return { id, fm, body };
}

export function docText(rel: string): string {
  const f = path.join(ROOT, rel);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
}

export function dsPhong(): Doc[] {
  const dir = path.join(ROOT, 'phong');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => readDoc(path.join(dir, f), f.replace(/\.md$/, ''))!)
    .sort((a, b) => Number(a.fm.thu_tu ?? 99) - Number(b.fm.thu_tu ?? 99));
}
export function phong(id: string): Doc | null { return readDoc(path.join(ROOT, 'phong', `${id}.md`), id); }

export function dsNhanSu(): Doc[] {
  const dir = path.join(ROOT, 'nhan-su');
  return fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'SOUL.md')))
    .map((d) => readDoc(path.join(dir, d, 'SOUL.md'), d)!)
    .sort((a, b) => Number(a.fm.thu_tu ?? 99) - Number(b.fm.thu_tu ?? 99));
}
export function nhanSu(id: string): Doc | null { return readDoc(path.join(ROOT, 'nhan-su', id, 'SOUL.md'), id); }
export function heartbeat(id: string): string { return docText(path.join('nhan-su', id, 'HEARTBEAT.md')); }
export function soDo(id: string): string { return docText(path.join('so-do', `${id}.svg`)); }

export const KHUON: Record<string, { ten: string; mota: string }> = {
  'day-chuyen': { ten: 'Dây chuyền', mota: 'thẳng, theo lô; 1 cuốn / 1 khoá · tuần; cổng người trước khi đăng' },
  'vong-toi-uu': { ten: 'Vòng tối ưu', mota: 'lặp đo → quyết → chỉnh → chạy; 1 camp đang sống · giờ; cổng = tiền, Kiên là công tắc cắt vòng' },
  'hat-nho': { ten: 'Hạt nhỏ tích luỹ', mota: 'máy trạng thái theo thời gian; 1 card = 1 link / 1 bài / 1 đơn · ngày; cổng = link / bài theo standing' },
  'dung-san-pham': { ten: 'Dựng sản phẩm', mota: 'issue → build → review → deploy; 1 issue · ngày; cổng chỉ cho thao tác không hoàn tác' },
  'bo-loc': { ten: 'Bộ lọc', mota: 'không sản xuất, chỉ phân loại / chặn; 1 phát sinh · 15 phút' },
  'theo-du-an': { ten: 'Theo dự án', mota: 'mỗi trưởng dự án cầm một phòng theo khuôn của dự án đó' },
};
export const MUC: Record<number, string> = { 1: 'tự làm', 2: 'trưởng phòng', 3: 'Giám đốc' };
