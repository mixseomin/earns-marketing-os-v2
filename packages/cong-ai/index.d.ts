export type KhoiNoiDung = { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };
export type TinNhan = { role: 'user' | 'assistant'; content: string | KhoiNoiDung[] };
export type YeuCauAi = { viec: string; model?: string; max_tokens?: number; noi_dung?: string | KhoiNoiDung[]; messages?: TinNhan[]; system?: string;
  schema?: Record<string, unknown>; chi_re?: boolean; bo_chinh_hang?: boolean; bo_donk?: boolean; bo_tuyen?: string[]; ma?: string };
export type KetAi<T = unknown> = { kq: T; model: string; vao: number; ra: number; chi_usd: number };
export declare const MO_HINH: { haiku: string; sonnet: string; opus: string; luna: string };
export declare function dongCua(model?: string | null): string;
export declare function congUrl(): string;
export declare function congKhoa(): string | null;
export declare function goiAi<T = unknown>(o: YeuCauAi, opt?: { kiem?: ((kq: T, model: string) => string | null) | null; lan?: number; hanMs?: number }): Promise<KetAi<T>>;
export declare function hoiChu(o: { viec: string; model?: string | null; system?: string; user: string; max_tokens?: number; chi_re?: boolean }): Promise<{ chu: string; model: string; vao: number; ra: number; chi_usd: number }>;
/** Vỏ cùng bề mặt SDK OpenAI: chat thường qua cổng; tools / stream / images / embeddings đi khách gốc (cổng chưa có). */
export declare function voOpenAI<T = unknown>(goc: T | null, viec?: string): T;
