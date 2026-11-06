-- SỔ INSIGHT etp (anh 06/11/2026 "tạo 1 tab mới là Insight (chỉ david xem) và tổng hợp các insight gần đây sau khi phân tích chi tiết theo từng ngày và từng giờ của nhà và đội"):
-- mỗi dòng một nhận định có số làm nền, ghi lúc phân tích (Claude / người). Tab Insight trên etp.on.tc (chỉ vai chủ) đọc sổ này + bảng số sống theo ngày / khung giờ / giờ.
-- nhom: gio · ngay · camp · doi. Không máy luật nào đọc sổ này — chỉ để đọc, quyết định vẫn là của anh.
create table if not exists etp.insight (
  id serial primary key,
  ngay date not null,                -- ngày phân tích (giờ VN)
  khoang text not null,              -- khoảng số liệu, vd '23/10–05/11 (14 ngày đã khép)'
  nhom text not null,
  tieu_de text not null,
  noi_dung text not null,
  goi_y text,                        -- việc nên cân nhắc (không phải lệnh)
  ai text not null default 'Claude',
  luc timestamptz not null default now()
);
insert into etp.insight (ngay, khoang, nhom, tieu_de, noi_dung, goi_y) select * from (values
  ('2026-11-06'::date, '23/10–05/11', 'gio', 'Khung 15–21h lỗ ở cả nhà và đội',
   'Tuần 30/10–05/11: nhà ROI −7% trên $2.349, đội −12% trên $3.243. Nhà âm ở khung này 10/14 ngày, đội 8/14 ngày. Tuần trước đó nhà −5%, đội +2%.',
   'Máy đã để 15–21h là khung chỉ giảm / tắt — đúng hướng. Có thể giảm chi khung này thêm bằng lịch giờ (tạm dừng thể loại lỗ 15–21h).'),
  ('2026-11-06', '23/10–05/11', 'gio', 'Khung 21–07h là nơi kiếm lãi',
   'Tuần 30/10–05/11: nhà +18% trên $5.019 (48% chi tuần của nhà), đội +20% trên $6.849. Tuần trước: nhà +24%, đội +40%. Khung đêm luôn dương ở nhà 13/14 ngày.',
   'Giữ khung tăng 21–07h; tăng bậc nên rơi vào đầu khung này.'),
  ('2026-11-06', '23/10–05/11', 'gio', 'Buổi sáng 07–15h: đội hơn nhà rõ',
   'Đội ROI cao hơn nhà ở khung 07–15h 12/14 ngày. Tuần 30/10–05/11: đội +23% vs nhà +11%; tuần trước +39% vs +17%. Chi hai bên gần bằng nhau ($3,0–3,9k/tuần).',
   'So cách đội lên camp buổi sáng (Kiên lên phần lớn từ 7h) với nhà: giờ lên, ngân sách đầu, loại creative.'),
  ('2026-11-06', '30/10–05/11', 'gio', 'Số từng giờ nhiễu — đọc theo khung',
   'Doanh thu ghi dồn theo đợt đồng bộ: cùng tuần, 08h nhà +155% rồi 07h −57%, 12h +146% rồi 13h −18%. Một giờ lẻ không nói được giờ đó tốt hay xấu.',
   'Kết luận về giờ chỉ dùng khung ≥ 3 giờ (07–15 / 15–21 / 21–07).'),
  ('2026-11-06', '23/10–05/11', 'ngay', 'Đổ thêm tiền làm ROI cả hệ sụt',
   '29/10–01/11 cả hệ chi $4,3–4,8k/ngày (nhà $1,8–2,0k, đội $2,5–2,8k), ROI cả hệ −1…+14%. 03–05/11 cả hệ hạ về $2,1–2,7k/ngày, ROI +19…+33%; nhà $0,9–1,2k/ngày lên +24% (03/11, 05/11).',
   'Tăng chi theo nấc, nhìn ROI ngày đã khép trước khi lên nấc kế.'),
  ('2026-11-06', '23/10–05/11', 'camp', 'Ít camp hơn, camp to hơn thì lãi hơn',
   'Nhà 26/10: 528 camp có chi, $2,0/camp, 32% camp lãi. 03–05/11: 191–208 camp, $4,9–6,5/camp, 38–50% camp lãi, ROI nhà +8…+24%.',
   'Giữ hướng dọn camp yếu, dồn tiền vào camp đã thắng thay vì mở rộng số camp.'),
  ('2026-11-06', '26/10–05/11', 'camp', '★ ROAS là nguồn lãi chính của nhà',
   'Camp ROAS nhà ROI +6…+36% mỗi ngày, chiếm ~40% chi; camp thường từ 26/10 chỉ −6…+16%. 05/11: ROAS $454 +34%, thường $700 +8%. Đội mới chạy ROAS nhỏ ($93–431/ngày) nhưng 3 ngày gần +31…+63%.',
   'Theo dõi AB03 (nhân đôi camp ROAS chạm trần #72929) — nếu cặp vẫn lãi thì mở thêm ROAS cho camp gốc thắng.'),
  ('2026-11-06', '02/11–05/11', 'doi', 'Kiên đang dẫn đội',
   'Kiên 4 ngày 02–05/11 ROI +32 / +41 / +38 / +43% ở $530–1.100/ngày. 05/11 Kiên chi $1.099 (bằng nhà $1.103) lãi $473, nhà lãi $265. Sơn hạ chi về $400, ROI +29%.',
   'Phim đội lãi giờ được nhà lên 5 camp một lần (luật 06/11) — xem phim Kiên đang thắng trong danh sách etp.phim_doi_lai.')
) v where not exists (select 1 from etp.insight where ngay = '2026-11-06');
