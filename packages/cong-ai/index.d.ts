export type KhoiNoiDung = { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };
export type TinNhan = { role: 'user' | 'assistant'; content: string | (KhoiNoiDung | Record<string, unknown>)[] };
export type YeuCauAi = { viec: string; model?: string; max_tokens?: number; noi_dung?: string | KhoiNoiDung[]; messages?: TinNhan[]; system?: string;
  schema?: Record<string, unknown>; tools?: { name: string; description?: string; input_schema: Record<string, unknown> }[]; tool_choice?: Record<string, unknown>; chi_re?: boolean; bo_chinh_hang?: boolean; bo_donk?: boolean; bo_tuyen?: string[]; ma?: string };
export type KetAi<T = unknown> = { kq: T; model: string; vao: number; ra: number; chi_usd: number };
export declare const MO_HINH: { haiku: string; sonnet: string; opus: string; luna: string };
export declare function dongCua(model?: string | null): string;
export declare function congUrl(): string;
export declare function congKhoa(): string | null;
export declare function goiAi<T = unknown>(o: YeuCauAi, opt?: { kiem?: ((kq: T, model: string) => string | null) | null; lan?: number; hanMs?: number }): Promise<KetAi<T>>;
export declare function hoiChu(o: { viec: string; model?: string | null; system?: string; user: string; max_tokens?: number; chi_re?: boolean }): Promise<{ chu: string; model: string; vao: number; ra: number; chi_usd: number }>;
/** Vỏ cùng bề mặt SDK OpenAI: chat thường qua cổng; tools / stream / images / embeddings đi khách gốc (cổng chưa có). */
export declare function voOpenAI<T = unknown>(goc: T | null, viec?: string): T;
/** Sinh một ảnh qua cổng (ckey Nano Banana → ShopAIKey). */
export declare function sinhAnhAi(o: { viec: string; prompt: string; ti_le?: string; tham_chieu?: string[]; ma?: string }): Promise<{ anh_b64: string; mime: string; model: string; chi_usd: number }>;
/** Nhúng chữ qua cổng — véc-tơ 512 chiều đã chuẩn hoá. */
export declare function nhungAi(o: { viec: string; chu: string[]; ma?: string }): Promise<{ vec: number[][]; chieu: number; model: string }>;
export declare function giongAi(o: { viec: string; chu: string; giong?: string; engine?: string; language?: string; ma?: string }): Promise<{ am_b64: string; mime: string; model: string; giong: string; chi_usd: number }>;
export declare function guiVideoAi(o: { viec: string; prompt: string; anh_dau: string; anh_cuoi?: string | null; giay?: number; ti_le?: string; do_phan_giai?: '720p' | '1080p'; model?: string; cong?: string; bo_chinh_hang?: boolean; ma?: string }): Promise<{ cong: string; model: string; task_id: string; tao_luc: string; chi_usd: number }>;
export declare function docVideoAi(o: { viec: string; cong: string; task_id: string; tao_luc: string }): Promise<{ done: boolean; ok?: boolean; uri?: string; can_khoa?: boolean; loi?: string; treo?: boolean }>;
export declare function taiVideoAi(o: { viec: string; uri: string }): Promise<{ video_b64: string; mime: string }>;
