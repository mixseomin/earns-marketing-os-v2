// task-resume — "bàn giao" của 1 card việc: đủ để 1 CHAT KHÁC nối tiếp mà không đoán.
// Lưu trong prep_payload (zero migration): inputs (link cụ thể) · done_when (tiêu chí xong) ·
// depends_on (card cần output trước). Client-safe (pure) — dùng chung: getBacklinkTasks (đọc),
// setTaskResume (ghi), ext GET/POST, drawer UI. 1 định nghĩa, không mỗi nơi tự parse jsonb.

export interface TaskInput { label: string; url: string }
export interface TaskResume { inputs: TaskInput[]; doneWhen: string; dependsOn: number[] }

export const EMPTY_RESUME: TaskResume = { inputs: [], doneWhen: '', dependsOn: [] };

/** True nếu card có ÍT NHẤT 1 mảnh bàn giao (để UI biết có/không mà hiện badge). */
export function hasResume(r: TaskResume): boolean {
  return r.inputs.length > 0 || r.doneWhen.trim() !== '' || r.dependsOn.length > 0;
}

export function cleanInputs(v: unknown): TaskInput[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (x && typeof x === 'object' ? { label: String((x as TaskInput).label ?? '').trim(), url: String((x as TaskInput).url ?? '').trim() } : { label: '', url: '' }))
    .filter((x) => x.url !== '');   // link rỗng thì bỏ — input phải trỏ được tới đâu đó
}

export function cleanDependsOn(v: unknown): number[] {
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,\s]+/) : [];
  return [...new Set(arr.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];
}

/** Chuẩn hoá 3 nguồn (jsonb/string) → TaskResume dùng ở mọi nơi. */
export function toResume(inputs: unknown, doneWhen: unknown, dependsOn: unknown): TaskResume {
  return { inputs: cleanInputs(inputs), doneWhen: String(doneWhen ?? '').trim(), dependsOn: cleanDependsOn(dependsOn) };
}
