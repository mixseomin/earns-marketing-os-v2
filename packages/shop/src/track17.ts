// SHOP — 17TRACK API v2.2: mốc vận đơn chi tiết (CJ chỉ trả trạng thái tóm tắt). Khoá SHOP_17TRACK_KEY trong .env.production.
// Mỗi mã ĐĂNG KÝ tốn 1 lượt (tài khoản mới: 200 lượt miễn phí một lần, sau đó mua trước) — đọc lại (gettrackinfo) thì không tốn.
// Không có khoá → mọi hàm trả null, máy chạy tiếp bằng trạng thái tóm tắt của CJ.

const API = 'https://api.17track.net/track/v2.2/';
const khoa = () => process.env.SHOP_17TRACK_KEY ?? '';
export const co17 = () => !!khoa();

export type Moc = { ts: string; mo_ta: string; noi: string; nuoc: string | null; giai_doan: string | null };
export type Tin17 = { tt: string | null; moc: Moc[]; duKien: { tu: string | null; den: string | null } | null };

async function goi<T>(duong: string, than: unknown): Promise<T | null> {
  if (!khoa()) return null;
  try {
    const r = await fetch(API + duong, { method: 'POST', cache: 'no-store', headers: { '17token': khoa(), 'Content-Type': 'application/json' },
      body: JSON.stringify(than), signal: AbortSignal.timeout(30_000) });
    return (await r.json()) as T;
  } catch { return null; }
}

type KqDk = { code: number; data?: { accepted?: { number: string }[]; rejected?: { number: string; error?: { code: number; message: string } }[] } };
/** Đăng ký mã (tự nhận hãng). Mã đã đăng ký trước đó (-18019901) cũng tính là xong. Trả null khi chưa có khoá. */
export async function dangKy17(ma: string): Promise<{ ok: boolean; loi?: string } | null> {
  const r = await goi<KqDk>('register', [{ number: ma, lang: 'en' }]);
  if (!r) return null;
  if (r.data?.accepted?.some((x) => x.number === ma)) return { ok: true };
  const e = r.data?.rejected?.find((x) => x.number === ma)?.error;
  if (e?.code === -18019901) return { ok: true };
  return { ok: false, loi: e ? `${e.code} ${e.message}` : `code ${r.code}` };
}

type Ev = { time_iso?: string; time_utc?: string; description?: string; location?: string; stage?: string | null; address?: { country?: string | null; state?: string | null; city?: string | null } };
type KqTin = { code: number; data?: { accepted?: { number: string; track_info?: {
  latest_status?: { status?: string };
  time_metrics?: { estimated_delivery_date?: { from?: string | null; to?: string | null } };
  tracking?: { providers?: { events?: Ev[] }[] };
} }[] } };

/** Mốc + trạng thái của một mã (đã đăng ký). Gộp mọi hãng (chặng TQ + USPS chặng cuối), bỏ trùng, mới nhất trước. */
export async function tin17(ma: string): Promise<Tin17 | null> {
  const r = await goi<KqTin>('gettrackinfo', [{ number: ma }]);
  const t = r?.data?.accepted?.find((x) => x.number === ma)?.track_info;
  if (!t) return null;
  const thay = new Set<string>();
  const moc: Moc[] = [];
  for (const p of t.tracking?.providers ?? []) for (const e of p.events ?? []) {
    const ts = e.time_utc ?? e.time_iso ?? '';
    const k = `${ts}|${e.description}`;
    if (!ts || thay.has(k)) continue;
    thay.add(k);
    const a = e.address ?? {};
    const noi = [a.city, a.state].filter(Boolean).join(', ') || e.location || '';
    moc.push({ ts, mo_ta: e.description ?? '', noi, nuoc: a.country ?? null, giai_doan: e.stage ?? null });
  }
  moc.sort((x, y) => (x.ts < y.ts ? 1 : -1));
  const dk = t.time_metrics?.estimated_delivery_date;
  return { tt: t.latest_status?.status ?? null, moc, duKien: dk && (dk.from || dk.to) ? { tu: dk.from ?? null, den: dk.to ?? null } : null };
}
