// Kho hồ sơ công ty = thư mục `cong-ty/` (markdown + frontmatter + svg), đọc lúc render. Đây là nguồn sự thật cho
// sơ đồ tổ chức, phòng, nhân sự, luật; worker đợt sau đọc cùng thư mục này để lắp ráp gói đọc theo vai.
import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { parseFm as parseFmJs } from '../../scripts/fm.mjs';
const parseFm = parseFmJs as (raw: string) => { fm: Fm; body: string };

export const ROOT = path.join(process.cwd(), 'cong-ty');

export type Fm = Record<string, string | number | boolean | string[]>;
export type Doc = { id: string; fm: Fm; body: string };

// Parser dùng chung với script (scripts/fm.mjs) — một bản, một bộ tự kiểm.
export { parseFm };

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
export function cauHinh(): Fm { const f = path.join(ROOT, 'cau-hinh.md'); return fs.existsSync(f) ? parseFm(fs.readFileSync(f, 'utf8')).fm : {}; }
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
