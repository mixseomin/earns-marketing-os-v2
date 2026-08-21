// SẢN PHẨM MÌNH BÁN — một dòng một sản phẩm, đủ views · đơn · doanh thu · giá.
//
// Đặt ngay dưới SEO Sites Overview vì hai bảng trả lời hai nửa của cùng một câu: có ai đi ngang
// không, và có ai mua không. Trước đây doanh thu nằm ở /revenue còn lượt xem thì chỉ đọc được bằng
// cách mở tay giao diện Gumroad — không nhìn cạnh nhau được, nên không thấy chỗ gãy.
//
// HAI NGUỒN, và phải nói rõ nguồn nào cho cột nào, không thì số 0 gây hiểu nhầm:
//   · đơn/doanh thu/giá ← Gumroad API v2, cộng dồn TRỌN ĐỜI, luôn tươi.
//   · views             ← bảng product_daily, do job trình duyệt trên box1 đẩy hằng ngày
//     (systemd timer `gumroad-views`, KHÔNG còn là LaunchAgent trên máy — đổi 14/08).
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
    job chạy trên box1 (<code>systemctl status gumroad-views</code> · log{' '}
    <code>journalctl -u gumroad-views</code>) · chạy tay: <code>~/bin/gumroad-views</code>
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

  const rows: ProductRow[] = sum.products.filter((p) => p.published).map((p) => {
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
      missingDiscover: lacksDiscover(p),
    };
  });
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
      subtitle={`${rows.length} sản phẩm đang bán · ${sum.stores.length} store · ${sum.totalSales} đơn · $${sum.totalUsd.toLocaleString('en-US')} trọn đời${views.lastSync ? ` · views tới ${views.lastSync}` : ' · views CHƯA có'}`}
      actions={<a href="/revenue" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '4px 10px', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-2)', textDecoration: 'none', background: 'var(--bg-2)' }}>💵 Revenue</a>}
    >
      <ProductsTable rows={rows} />
      {!anyViews && (
        <p style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', margin: '10px 0 0' }}>
          Cột views trống vì job đọc Gumroad Analytics chưa chạy lần nào — {JOB_HINT}
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
