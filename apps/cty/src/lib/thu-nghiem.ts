'use server';
// Phòng thử: đọc nhật ký các lượt (JSON do worker/ca.mjs ghi) và nút "Chạy một lượt" (spawn worker, không chờ).
// Mỗi lượt là MỘT lần Giám đốc bấm — không có lịch, không tự chạy. Chỉ admin mos2 được bấm (tốn tiền, dù ~1 cent).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from './auth';
import { docLog } from '../../worker/log.mjs';

const DATA = process.env.CTY_DATA_DIR || '/var/lib/cty';
const NK = path.join(DATA, 'nhat-ky');

export type Luot = { ts: string; bat_dau?: string; ket_thuc?: string; viec: string; trang_thai: string; loi?: string; tong?: { buoc: number; token: number; ms: number };
  buoc: { buoc: string; ai: string; id: string; model: string; bat_dau?: string; ket_thuc?: string; ms: number; http: number; usage: { input_tokens?: number; output_tokens?: number } | null; loi: string | null; hoi: string; dap: string }[];
  ket: { giao: { viec: string; tieu_chi: string[] }; lam: { ket_qua: string; bang_chung: string }; soat: { ok: boolean; ly_do: string } | null; bao_cao: string; trang_thai_viec: string } | null };

export async function dsLuot(): Promise<Luot[]> {
  if (!fs.existsSync(NK)) return [];
  return fs.readdirSync(NK).filter((f) => f.endsWith('.json')).sort().reverse().slice(0, 20)
    .map((f) => { try { return JSON.parse(fs.readFileSync(path.join(NK, f), 'utf8')) as Luot; } catch { return null; } }).filter((x): x is Luot => !!x)
    .map(boGio);
}

// Lượt ghi trước 10/10/2026 tối chưa có giờ từng bước: lấy từ sổ sự kiện — proxy ghi một dòng `goi` lúc mỗi lượt gọi XONG, theo
// đúng thứ tự bước (bước n ↔ dòng goi thứ n của lượt), bắt đầu = xong − ms. Giờ lượt: tên tệp (ts) là lúc bắt đầu.
function boGio(l: Luot): Luot {
  const batDau = l.bat_dau ?? l.ts.replace(/T(\d\d)-(\d\d)-(\d\d)-(\d+)Z$/, 'T$1:$2:$3.$4Z');
  if (l.buoc.every((b) => b.ket_thuc)) return { ...l, bat_dau: batDau, ket_thuc: l.ket_thuc ?? l.buoc.at(-1)?.ket_thuc };
  const goi = (docLog({ luot: l.ts, loai: 'goi', n: 100 }) as { ts: string }[]).reverse();
  const buoc = l.buoc.map((b, i) => {
    const xong = b.ket_thuc ?? goi[i]?.ts;
    return xong ? { ...b, ket_thuc: xong, bat_dau: b.bat_dau ?? new Date(new Date(xong).getTime() - b.ms).toISOString() } : b;
  });
  return { ...l, bat_dau: batDau, ket_thuc: l.ket_thuc ?? (l.trang_thai === 'đang chạy' ? undefined : buoc.at(-1)?.ket_thuc), buoc };
}

/** Giao một lượt (bấm nút trên trang = một lượt, ~$0,0005). Trả lời RÕ cho nút: ok, hay lý do bị từ chối — không im lặng. */
export async function chayMotLuot(viecGoc: string): Promise<{ ok: boolean; loi?: string }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, loi: 'Phiên đăng nhập đã hết — tải lại trang để đăng nhập.' };
  if (me.role !== 'admin') return { ok: false, loi: 'Chỉ admin được chạy lượt (tốn tiền).' };
  const viec = String(viecGoc || '').trim().slice(0, 500);
  if (!viec) return { ok: false, loi: 'Chưa gõ việc cần giao.' };
  if ((await dsLuot()).some((l) => l.trang_thai === 'đang chạy')) return { ok: false, loi: 'Đang có một lượt chạy — đợi lượt đó xong (vài giây).' };
  const worker = path.join(process.cwd(), 'worker', 'ca.mjs');
  if (!fs.existsSync(worker)) return { ok: false, loi: `Không thấy worker ở ${worker}.` };
  try {
    fs.mkdirSync(NK, { recursive: true });
    const log = fs.openSync(path.join(DATA, 'ca.log'), 'a');
    const child = spawn(process.execPath, [worker, '--viec', viec], { detached: true, stdio: ['ignore', log, log], env: process.env });
    child.unref();
  } catch (e) { return { ok: false, loi: `Không khởi động được worker: ${(e as Error).message}` }; }
  // Worker ghi tệp lượt "đang chạy" ngay khi vào; đợi tệp đó xuất hiện (≤3s) để danh sách hiện lượt mới liền.
  const truoc = (await dsLuot())[0]?.ts;
  for (let i = 0; i < 20; i++) { await new Promise((r) => setTimeout(r, 150)); if ((await dsLuot())[0]?.ts !== truoc) break; }
  revalidatePath('/', 'layout');
  return { ok: true };
}
