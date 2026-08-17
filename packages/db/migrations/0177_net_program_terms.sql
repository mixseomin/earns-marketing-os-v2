-- Điều khoản riêng của từng chương trình advertiser — sổ tra trước khi dựng traffic.
--
-- Vì sao KHÔNG nhét vào net_offers.terms: cột đó chỉ tồn tại khi mình ĐÃ có offer chạy. Nhưng luật
-- cần đọc SỚM hơn thế — lúc quyết định có nộp đơn không, và lúc bị từ chối vẫn phải nhớ vì sao để
-- lần sau khỏi vấp lại (Mortgage Research Center 7647072: cấm direct linking, auto-decline
-- 2026-08-17). Chương trình chưa tham gia không có dòng net_offers nào để bám vào.
--
-- Mỗi advertiser mỗi luật khác nhau và vi phạm thì bị huỷ hoa hồng cả kỳ, nên `rules` để jsonb có
-- khoá cố định thay vì đọc lại 5.000 chữ hợp đồng mỗi lần dựng campaign:
--   directLinking      false = CẤM đổ quảng cáo thẳng vào aff link, phải qua trang mình
--   trademarkBidding   false = CẤM đấu giá từ khoá thương hiệu của advertiser
--   coupon/incentive   false = CẤM coupon site / thưởng người click
--   email              'optin' | false — gửi email được không, điều kiện gì
--   popups             false = cấm pop-up/pop-under
-- Khoá nào chưa tra được thì ĐỪNG đoán: bỏ trống, khác hẳn với ghi false.
CREATE TABLE IF NOT EXISTS net_program_terms (
  id            bigserial PRIMARY KEY,
  network       text NOT NULL,
  advertiser_id text NOT NULL,
  advertiser    text NOT NULL,
  status        text NOT NULL DEFAULT 'prospect',
  rules         jsonb NOT NULL DEFAULT '{}'::jsonb,
  quotes        text,
  source_url    text,
  checked_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT net_program_terms_status_check
    CHECK (status IN ('prospect', 'applied', 'joined', 'declined', 'terminated')),
  CONSTRAINT net_program_terms_uniq UNIQUE (network, advertiser_id)
);

COMMENT ON TABLE net_program_terms IS
  'Luật riêng từng chương trình advertiser. Đọc TRƯỚC khi dựng campaign — vi phạm = mất hoa hồng cả kỳ.';
COMMENT ON COLUMN net_program_terms.rules IS
  'Cờ cố định: directLinking, trademarkBidding, coupon, incentive, email, popups. Chưa tra được thì BỎ TRỐNG, không đoán false.';
COMMENT ON COLUMN net_program_terms.quotes IS
  'Nguyên văn câu ràng buộc — để cãi được khi advertiser claw back, và để người sau kiểm lại cách hiểu.';
