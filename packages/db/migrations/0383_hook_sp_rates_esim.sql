-- Kho hook đúng ngách (31/10/2026): Ngọc chặn gần hết hook của Ratesbyroom (QC so giá khách sạn #179) và eSIMfares (QC vé máy bay #180, nhóm eSIM #181 chỉ 2 QC)
-- vì lệch ngách / hứa điều thương hiệu không có → mượn hook từ nhóm spy mới: #2449 lừa đảo du lịch, #2448 cước roaming / sim / dữ liệu khi ra nước ngoài.
UPDATE xv_may SET hook_sp = '{2449}' WHERE ma = 'ratesbyroom-scam-or-real';
UPDATE xv_may SET hook_sp = '{2448}' WHERE ma = 'esimfares-before-you-land';
