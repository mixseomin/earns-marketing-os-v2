// SẢN PHẨM MÌNH BÁN — một dòng một sản phẩm, đủ views · đơn · doanh thu · giá.
//
// Đặt ngay dưới SEO Sites Overview vì hai bảng trả lời hai nửa của cùng một câu: có ai đi ngang
// không, và có ai mua không. Trước đây doanh thu nằm ở /revenue còn lượt xem thì chỉ đọc được bằng
// cách mở tay giao diện Gumroad — không nhìn cạnh nhau được, nên không thấy chỗ gãy.
//
// HAI NGUỒN, và phải nói rõ nguồn nào cho cột nào, không thì số 0 gây hiểu nhầm:
//   · đơn/doanh thu/giá ← Gumroad API v2, cộng dồn TRỌN ĐỜI, luôn tươi.
//   · views             ← bảng product_daily, do job trình duyệt trên iMac đẩy 3 lần/ngày
//     (LaunchAgent `com.earns.gumroad-views`; box1 chết lặng 18/09 vì không tự đăng nhập lại được — dời 04/10).
//     API v2 không có trường này. Store nào job chưa quét thì cột views là "—", KHÔNG phải 0.
//
// NỐI HAI NGUỒN BẰNG `id` GỐC, không bằng permalink: sản phẩm đặt slug tuỳ chỉnh
// (write-like-a-person) thì short_url không còn chứa unique_permalink (efvcp), và dòng đó lặng lẽ
// mất views — trông hệt như "chưa có dữ liệu". `analytics_props.products[].id` mà job đọc chính là
// `product.id` của API v2, nên nó là khoá duy nhất đúng cho mọi sản phẩm.
//
// Phần BẢNG nằm ở `products-table.tsx` (client) và dựng trên `ui.DataTable` — bản đầu em tự chế thẻ
// <table> ngay ở đây: mất nhóm cột bật/tắt, mất sắp xếp, mất ô lọc, pad lệch với bảng SEO ngay trên.
// `columns[].cell` là HÀM nên không serialize qua ranh giới server → client được, phải tách file.
import { Panel } from './ui/panel';
import { getGumroadSummary, lacksDiscover } from '@/lib/gumroad/products';
import { loadProductViews } from '@/lib/gumroad/daily';
import { ProductsTable, type ProductRow } from './products-table';

/* Chỗ CHỈ ĐƯỜNG khi views thiếu — một chuỗi, hai cảnh báo dùng chung. Tách ra vì bản đầu
 * viết tay ở từng chỗ, rồi job dời từ LaunchAgent trên máy sang systemd timer box1: một
 * chỗ nói "job local", chỗ kia trỏ vào ~/.cache/gumroad-views.out.log — tệp đã xoá cùng
 * lúc dời. Chỉ sai đường là tệ hơn không chỉ gì: người ta mở log trống rồi tưởng job im. */
const JOB_HINT = (
  <>
    job chạy trên iMac (LaunchAgent <code>com.earns.gumroad-views</code> · log{' '}
    <code>~/.cache/gumroad-views.log</code>) · chạy tay: <code>~/bin/gumroad-views</code>
  </>
);

export async function ProductsPanel() {
  const [sum, views] = await Promise.all([getGumroadSummary(), loadProductViews()]);

  if (!sum.ok) {
    return (
      <Panel title="Products Overview">
        <p style={{ color: 'var(--fg-3)', fontSize: 12, margin: 0 }}>Không đọc được Gumroad — {sum.error}</p>
      </Panel>
    );
  }

  // Nháp cũng hiện (nhãn "nháp"): lọc published thì sản phẩm vừa up biến mất khỏi bảng tới lúc đăng bán.
  const rows: ProductRow[] = sum.products.map((p) => {
    const v = views.byProduct[`${p.store}:${p.id}`] ?? null;
    return {
      key: `${p.store}:${p.id}`,
      name: p.name,
      store: p.store,
      url: p.url,
      price: p.priceCents,
      sales: p.salesCount,
      usdCents: p.salesUsdCents,
      views7d: v ? v.views7d : null,
      views30d: v ? v.views30d : null,
      refs7d: v ? v.refs7d : {},
      missingDiscover: p.published && lacksDiscover(p),
      draft: !p.published,
    };
  });
  const live = rows.filter((r) => !r.draft).length;
  // Store job views đọc được (từ menu tài khoản) mà vault chưa có token API → sản phẩm của nó không
  // hiện ở đây. Bắt đúng ca 04/10: Front Porch Puzzles + ExamWeight mở thêm mà không ai thêm token.
  const apiStores = new Set(sum.stores.map((s) => s.handle));
  const noToken = [...new Set(Object.keys(views.byProduct).map((k) => k.split(':')[0] ?? ''))].filter((s) => !apiStores.has(s));
  const anyViews = rows.some((r) => r.views7d !== null);
  // Views CŨ trông y hệt views THẤP. Bảng đứng im ở 10/08 suốt mấy ngày vì job đọc Gumroad chết
  // (ERR_NETWORK_CHANGED) mà dòng "views tới …" vẫn xám nhạt như bình thường — nhìn ra thành "không
  // ai xem". Gumroad tự chốt số chậm ~2 ngày, nên chỉ kêu khi trễ hơn thế.
  const staleDays = views.lastSync
    ? Math.round((Date.now() - Date.parse(`${views.lastSync}T00:00:00Z`)) / 864e5)
    : null;
  const stale = staleDays !== null && staleDays > 3;

  return (
    <Panel
      title="Products Overview"
      subtitle={`${live} sản phẩm đang bán${rows.length > live ? ` + ${rows.length - live} nháp` : ''} · ${sum.stores.length} store · ${sum.totalSales} đơn · $${sum.totalUsd.toLocaleString('en-US')} trọn đời${views.lastSync ? ` · views tới ${views.lastSync}` : ' · views CHƯA có'}`}
      actions={<a href="/revenue" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '4px 10px', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-2)', textDecoration: 'none', background: 'var(--bg-2)' }}>💵 Revenue</a>}
    >
      <ProductsTable rows={rows} />
      {!anyViews && (
        <p style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', margin: '10px 0 0' }}>
          Cột views trống vì job đọc Gumroad Analytics chưa chạy lần nào — {JOB_HINT}
        </p>
      )}
      {noToken.length > 0 && (
        <p style={{ fontSize: 11, color: 'var(--warn)', fontFamily: 'var(--font-mono)', margin: '10px 0 0' }}>
          ⚠ Store {noToken.join(', ')} có lượt xem nhưng vault chưa có token API → sản phẩm của store đó KHÔNG hiện ở bảng.
          Tạo + lưu token: <code>node resources/auto-publish/scripts/gumroad-api-token.mjs &quot;&lt;tên store&gt;&quot;</code> (repo earns-strategy)
        </p>
      )}
      {stale && (
        <p style={{ fontSize: 11, color: 'var(--warn)', fontFamily: 'var(--font-mono)', margin: '10px 0 0' }}>
          ⚠ Views cũ {staleDays} ngày (tới {views.lastSync}) — job chưa đẩy số về. Cột 7D/30D đang
          THIẾU số, không phải bằng 0. {JOB_HINT}
        </p>
      )}
    </Panel>
  );
}
