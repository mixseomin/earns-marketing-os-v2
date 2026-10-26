-- Camp ROAS ★ (anh 26/10/2026: "ở tab roas cần thêm thông tin về ROAS bid từng camp đang set là bao nhiêu"):
-- mức ROAS goal THẬT đang đặt trên Ethopex (Ad Set bid_constraints.roas_average_floor) — apps/etp/dong-bo.py ghi mỗi lượt đồng bộ chi tiết camp.
-- chien_luoc = bid strategy cấp campaign (LOWEST_COST_WITH_MIN_ROAS / LOWEST_COST_WITHOUT_CAP …). null = chưa đồng bộ lại.
alter table etp.camp add column if not exists roas numeric;
alter table etp.camp add column if not exists chien_luoc text;
