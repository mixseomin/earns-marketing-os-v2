// SHOP — GA4 THỜI GIAN THỰC (Data API runRealtimeReport) cho /shop › Khách trực tiếp: số GA4 đặt cạnh sổ phiên của mình để đối chiếu.
// GA4 không cho nhúng khung trang của họ (iframe bị chặn) → kéo số qua API rồi vẽ ở đây. Property: shop_cua_hang.cau_hinh.ga4_property.
// Khoá: OAuth chỉ-đọc htuan82 /etc/adfond/ga4-oauth.json trên box3 (cùng tệp scripts/phu/ga4-ngay.mjs). Nhớ 20 giây/property để
// màn gọi lại 20 giây/lần không đốt hạn mức realtime. Realtime API không có nguồn truy cập (firstUserSource…) — chỉ nơi, thiết bị, trang, sự kiện.
import fs from 'node:fs';

const OAUTH = process.env.GA4_OAUTH || '/etc/adfond/ga4-oauth.json';
let tok: { v: string; het: number } | null = null;

async function token(): Promise<string> {
  if (tok && tok.het > Date.now() + 60_000) return tok.v;
  const o = JSON.parse(fs.readFileSync(OAUTH, 'utf8')) as { client_id: string; client_secret: string; refresh_token: string; token_uri?: string };
  const r = (await (await fetch(o.token_uri || 'https://oauth2.googleapis.com/token', { method: 'POST', cache: 'no-store',
    body: new URLSearchParams({ client_id: o.client_id, client_secret: o.client_secret, refresh_token: o.refresh_token, grant_type: 'refresh_token' }) })).json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!r.access_token) throw new Error(`GA4 token: ${r.error ?? 'không lấy được'}`);
  tok = { v: r.access_token, het: Date.now() + (r.expires_in ?? 3600) * 1000 };
  return tok.v;
}

type Dong = { k: string; n: number };
export type Ga4TT = { property: string; luc: string; tong30: number; tong5: number; theoPhut: number[]; nuoc: Dong[]; thanhPho: Dong[]; thietBi: Dong[]; trang: Dong[]; suKien: Dong[]; loi?: string };
type Kq = { rows?: { dimensionValues?: { value: string }[]; metricValues: { value: string }[] }[]; error?: { message: string } };

const nho = new Map<string, { ts: number; v: Ga4TT }>();

export async function ga4ThoiGianThuc(property: string): Promise<Ga4TT> {
  const c = nho.get(property);
  if (c && Date.now() - c.ts < 20_000) return c.v;
  const rong: Ga4TT = { property, luc: new Date().toISOString(), tong30: 0, tong5: 0, theoPhut: Array(30).fill(0), nuoc: [], thanhPho: [], thietBi: [], trang: [], suKien: [] };
  try {
    const t = await token();
    const goi = async (b: object): Promise<Kq> => (await (await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runRealtimeReport`, {
      method: 'POST', cache: 'no-store', headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' }, body: JSON.stringify(b), signal: AbortSignal.timeout(15_000) })).json()) as Kq;
    const theo = async (dim: string, metric = 'activeUsers', limit = 8): Promise<Dong[]> => {
      const r = await goi({ dimensions: [{ name: dim }], metrics: [{ name: metric }], limit });
      if (r.error) throw new Error(r.error.message);
      return (r.rows ?? []).map((x) => ({ k: x.dimensionValues![0]!.value, n: Number(x.metricValues[0]!.value) }));
    };
    const [tong, phut, nuoc, thanhPho, thietBi, trang, suKien] = await Promise.all([
      goi({ metrics: [{ name: 'activeUsers' }], minuteRanges: [{ name: 'p30', startMinutesAgo: 29 }, { name: 'p5', startMinutesAgo: 4 }] }),
      theo('minutesAgo', 'activeUsers', 30), theo('country'), theo('city'), theo('deviceCategory'), theo('unifiedScreenName'), theo('eventName', 'eventCount', 12),
    ]);
    if (tong.error) throw new Error(tong.error.message);
    // minuteRanges: mỗi dòng mang tên khoảng ở dimension dateRange-kiểu "p30"/"p5"
    for (const r of tong.rows ?? []) { const ten = r.dimensionValues?.[0]?.value; const n = Number(r.metricValues[0]!.value); if (ten === 'p5') rong.tong5 = n; else rong.tong30 = n; }
    for (const p of phut) { const i = Number(p.k); if (i >= 0 && i < 30) rong.theoPhut[29 - i] = p.n; }
    Object.assign(rong, { nuoc, thanhPho, thietBi, trang, suKien });
  } catch (e) { rong.loi = (e as Error).message.slice(0, 300); }
  nho.set(property, { ts: Date.now(), v: rong });
  return rong;
}
