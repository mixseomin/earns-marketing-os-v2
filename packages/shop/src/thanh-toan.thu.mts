// Tự kiểm đường "trả xong → thành đơn" trên DB THẬT, gói trong một giao dịch rồi ROLLBACK (không để lại dòng nào). Stripe giả lập,
// SMTP tắt (thư lỗi phải được ghi vào nhật ký đơn, không làm hỏng việc chốt). Chạy trên box3:
//   cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && SHOP_THU_KHOA=mellowstep node_modules/.bin/tsx packages/shop/src/thanh-toan.thu.mts
import assert from 'node:assert';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';

const khoa = process.env.SHOP_THU_KHOA ?? 'mellowstep';
process.env[`SHOP_${khoa.toUpperCase()}_SMTP_HOST`] = '';
let soPi = 0;
const goc = globalThis.fetch;
globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
  const u = String(url);
  if (!u.startsWith('https://api.stripe.com/')) return goc(url, init);
  const body = Object.fromEntries(new URLSearchParams(String(init?.body ?? '')));
  const pi = { id: 'pi_thu_1', status: 'succeeded', amount: Number(body.amount ?? 0), amount_received: 8548, currency: 'usd', client_secret: 'cs_thu',
    metadata: {}, receipt_email: 'thu@example.com', shipping: null, latest_charge: { billing_details: {}, balance_transaction: { fee: 278 } } };
  if (u.includes('/payment_intents') && init?.method === 'POST' && !u.includes('pi_thu')) soPi++;
  return new Response(JSON.stringify(pi), { status: 200 });
}) as typeof fetch;

const pg = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
class XongRoi extends Error {}
try {
  await pg.begin(async (tx) => {
    (globalThis as { __mos2_db?: unknown }).__mos2_db = drizzle(Object.assign(tx, { options: pg.options }) as unknown as postgres.Sql, { casing: 'snake_case' })   // drizzle đọc options.parsers của client gốc;
    const { moThanhToan, ghiKhach, chotThanhToan, doiSoat } = await import('./thanh-toan');
    const [ch] = await tx`SELECT id, khoa, project_id, ten, domain, nen_tang, mat_tien, so_don_tiep FROM shop_cua_hang WHERE khoa = ${khoa}`;
    assert.ok(ch, 'không có cửa hàng');
    const bt = await tx`SELECT b.id FROM shop_bien_the b JOIN shop_san_pham p ON p.id = b.san_pham_id WHERE p.cua_hang_id = ${ch.id} AND p.hien AND NOT b.het_hang ORDER BY b.id LIMIT 2`;
    assert.equal(bt.length, 2, 'cần 2 biến thể');
    const shop = ch as never;
    const p = await moThanhToan(shop, null, [{ b: bt[0]!.id, sl: 1 }, { b: bt[1]!.id, sl: 1 }, { b: 999999999, sl: 1 }], { sid: 'fb_thu' });
    assert.equal(p.mon.length, 2, 'biến thể lạ phải bị bỏ');
    assert.equal(soPi, 1, 'tạo đúng một PaymentIntent');
    assert.ok(p.tong.pt >= 0);
    const p2 = await moThanhToan(shop, p.id, [{ b: bt[0]!.id, sl: 2 }], {});
    assert.equal(p2.id, p.id, 'giỏ đổi → cùng phiên'); assert.equal(soPi, 1, 'giỏ đổi → cập nhật PI, không tạo mới');
    await ghiKhach(shop, p.id, { ten: 'Thu Nghiem', email: 'thu@example.com', sdt: '5550100' },
      { ten: 'Thu Nghiem', dong1: '1 Main St', dong2: '', thanh_pho: 'Austin', bang: 'TX', zip: '73301', nuoc: 'US' });
    const d = await chotThanhToan(shop, p.id);
    assert.ok(d, 'PI succeeded → phải ra đơn');
    assert.equal(d!.so_don, String(ch.so_don_tiep), 'số đơn = so_don_tiep');
    const [don] = await tx`SELECT * FROM shop_don WHERE id = ${d!.don_id}`;
    assert.equal(don!.trang_thai_shop, 'processing'); assert.equal(Number(don!.tong), 85.48); assert.equal(Number(don!.phi_cong), 2.78); assert.equal(don!.sid, 'fb_thu');
    assert.equal(don!.dia_chi.thanh_pho, 'Austin');
    const mon = await tx`SELECT * FROM shop_don_mon WHERE don_id = ${d!.don_id}`;
    assert.equal(mon.length, 1); assert.equal(mon[0]!.sl, 2); assert.ok(mon[0]!.bien_the_id);
    const phu = await tx`SELECT * FROM phu_su_kien WHERE nguon_du_lieu = ${`shop:${khoa}`} AND ma_don = ${d!.so_don}`;
    assert.equal(phu.length, 1, 'sổ PHỦ có dòng đơn');
    const sk = await tx`SELECT noi_dung, loi FROM shop_su_kien WHERE don_id = ${d!.don_id} ORDER BY id`;
    assert.ok(sk.some((x) => x.loi && String(x.noi_dung).includes('thư xác nhận')), 'thư lỗi phải ghi vào nhật ký, không làm hỏng chốt');
    const lai = await chotThanhToan(shop, p.id);
    assert.equal(lai!.don_id, d!.don_id, 'chốt lần hai → cùng đơn');
    const [dem] = await tx`SELECT count(*)::int AS so FROM shop_don WHERE ma_ngoai = ${`tt-${p.id}`}`;
    assert.equal(dem!.so, 1, "không nhân đôi đơn");
    // DB thật còn phiên dở khác (giỏ bỏ ngang) → Stripe giả lập báo succeeded cho mọi PI nên đối soát có thể chốt chúng — trong
    // giao dịch này thôi. Điều cần kiểm: phiên đã thành đơn KHÔNG bị chốt lần nữa.
    await doiSoat(shop);
    const [dem2] = await tx`SELECT count(*)::int AS so FROM shop_don WHERE ma_ngoai = ${`tt-${p.id}`}`;
    assert.equal(dem2!.so, 1, 'đối soát không chốt lại phiên đã thành đơn');
    console.log('thanh-toan: ok — đơn thử', d!.so_don, '· tổng', don!.tong, '· sự kiện:', sk.map((x) => x.noi_dung).join(' | '));
    throw new XongRoi();
  });
} catch (e) { if (!(e instanceof XongRoi)) { console.error(e); process.exitCode = 1; } else console.log('đã ROLLBACK — không để lại dòng nào'); }
await pg.end();
