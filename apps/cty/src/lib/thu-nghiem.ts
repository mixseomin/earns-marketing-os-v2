'use server';
// Phòng thử: đọc nhật ký các lượt (JSON do worker/ca.mjs ghi) và nút "Chạy một lượt" (spawn worker, không chờ).
// Mỗi lượt là MỘT lần Giám đốc bấm — không có lịch, không tự chạy. Chỉ admin mos2 được bấm (tốn tiền, dù ~1 cent).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from './auth';

const DATA = process.env.CTY_DATA_DIR || '/var/lib/cty';
const NK = path.join(DATA, 'nhat-ky');

export type Luot = { ts: string; viec: string; trang_thai: string; loi?: string; tong?: { buoc: number; token: number; ms: number };
  buoc: { buoc: string; ai: string; id: string; model: string; ms: number; http: number; usage: { input_tokens?: number; output_tokens?: number } | null; loi: string | null; hoi: string; dap: string }[];
  ket: { giao: { viec: string; tieu_chi: string[] }; lam: { ket_qua: string; bang_chung: string }; soat: { ok: boolean; ly_do: string } | null; bao_cao: string; trang_thai_viec: string } | null };

export async function dsLuot(): Promise<Luot[]> {
  if (!fs.existsSync(NK)) return [];
  return fs.readdirSync(NK).filter((f) => f.endsWith('.json')).sort().reverse().slice(0, 20)
    .map((f) => { try { return JSON.parse(fs.readFileSync(path.join(NK, f), 'utf8')) as Luot; } catch { return null; } }).filter((x): x is Luot => !!x);
}

export async function chayMotLuot(form: FormData): Promise<void> {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return;
  const viec = String(form.get('viec') || '').trim().slice(0, 500);
  if (!viec) return;
  const worker = path.join(process.cwd(), 'worker', 'ca.mjs');
  fs.mkdirSync(NK, { recursive: true });
  const log = fs.openSync(path.join(DATA, 'ca.log'), 'a');
  const child = spawn(process.execPath, [worker, '--viec', viec], { detached: true, stdio: ['ignore', log, log], env: process.env });
  child.unref();
  revalidatePath('/phong/thu-nghiem');
}
