-- SHOP — ĐỐI THỦ (anh chốt 02/10/2026): ai đang bán cùng/gần mẫu với sản phẩm của mình, trang đích + giá, quảng cáo họ đang chạy.
-- Cây: đối thủ (brand DTC / cửa hàng / chợ) → sản phẩm của họ (trang đích, giá, nối với sản phẩm mình) → quảng cáo (hook, trang đích, ngày chạy).
-- Quản lý ở /shop › Đối thủ (theo sản phẩm của mình hoặc theo đối thủ). Không xoá: thôi theo dõi = theo_doi false.
-- shop_san_pham.tham_khao (trang Amazon/Walmart/AliExpress cùng mẫu) cũng là "đối thủ đang bán" → chép sang đây, sổ đó thôi dùng (giữ dữ liệu).
CREATE TABLE IF NOT EXISTS shop_doi_thu (
  id          serial PRIMARY KEY,
  ten         text NOT NULL,
  website     text,
  kenh_ban    text NOT NULL DEFAULT 'dtc',          -- dtc · amazon · walmart · aliexpress · temu · tiktok_shop · khac
  fb_page_url text,
  fb_page_id  text,                                 -- có thì dựng link Thư viện quảng cáo Meta
  tiktok      text,
  nguon_tim   text,                                 -- tìm ra bằng cách nào (truy vấn, trang)
  ghi_chu     text,
  theo_doi    boolean NOT NULL DEFAULT true,
  tao_luc     timestamptz NOT NULL DEFAULT now(),
  cap_nhat    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS shop_doi_thu_ten_uq ON shop_doi_thu (lower(ten), kenh_ban);

CREATE TABLE IF NOT EXISTS shop_doi_thu_sp (
  id          serial PRIMARY KEY,
  doi_thu_id  integer NOT NULL REFERENCES shop_doi_thu(id),
  san_pham_id integer REFERENCES shop_san_pham(id),  -- sản phẩm của MÌNH mà nó cạnh tranh
  ten         text,
  url         text NOT NULL,                        -- trang đích / trang sản phẩm của họ
  gia         numeric,
  gia_goc     numeric,
  khop        text NOT NULL DEFAULT 'chua_xac_nhan', -- dung_mau (đã so ảnh, cùng mẫu) · gan (cùng loại) · khac · chua_xac_nhan
  ghi_chu     text,
  luc         timestamptz,                          -- lần xem gần nhất
  tao_luc     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doi_thu_id, url)
);

CREATE TABLE IF NOT EXISTS shop_doi_thu_qc (
  id            serial PRIMARY KEY,
  doi_thu_id    integer NOT NULL REFERENCES shop_doi_thu(id),
  doi_thu_sp_id integer REFERENCES shop_doi_thu_sp(id),  -- quảng cáo này đẩy sản phẩm nào của họ
  nen_tang      text NOT NULL DEFAULT 'meta',        -- meta · tiktok · google · khac
  link          text NOT NULL,                       -- link quảng cáo / thư viện
  hook          text,                                -- câu mở đầu / tiêu đề — chép nguyên văn
  landing       text,                                -- trang đích quảng cáo trỏ tới
  bat_dau       date,
  dang_chay     boolean,
  ghi_chu       text,
  luc           timestamptz,                         -- lần xem gần nhất
  tao_luc       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doi_thu_id, link)
);

-- chép tham_khao có link: mỗi chợ một "đối thủ" (người bán trên chợ thường không rõ tên), mỗi link một sản phẩm của họ
INSERT INTO shop_doi_thu (ten, website, kenh_ban, nguon_tim, ghi_chu)
SELECT DISTINCT CASE lower(e->>'nguon') WHEN 'aliexpress' THEN 'AliExpress' ELSE initcap(e->>'nguon') END, 'https://www.' || lower(e->>'nguon') || '.com', lower(e->>'nguon'), 'tham khảo sản phẩm (01/10/2026)',
       'Người bán trên chợ — từng trang sản phẩm ở dưới.'
  FROM shop_san_pham p CROSS JOIN LATERAL jsonb_array_elements(p.tham_khao) e
 WHERE e->>'url' IS NOT NULL AND lower(e->>'nguon') IN ('amazon', 'walmart', 'aliexpress', 'temu')
ON CONFLICT DO NOTHING;
INSERT INTO shop_doi_thu_sp (doi_thu_id, san_pham_id, url, khop, ghi_chu, luc)
SELECT d.id, p.id, e->>'url', COALESCE(e->>'khop', 'chua_xac_nhan'), e->>'ghi_chu', NULLIF(e->>'luc', '')::timestamptz
  FROM shop_san_pham p CROSS JOIN LATERAL jsonb_array_elements(p.tham_khao) e
  JOIN shop_doi_thu d ON d.kenh_ban = lower(e->>'nguon') AND lower(d.ten) = lower(e->>'nguon')
 WHERE e->>'url' IS NOT NULL
ON CONFLICT (doi_thu_id, url) DO NOTHING;
