-- CAMP THAY THẾ (anh 29/10/2026: "Các phim chỉ còn 1 camp duy nhất và có xu hướng bị đóng lại thì phải ưu tiên lên camp mới thay thế luôn. Camp mới phải
-- nhìn thấy ở cùng vị trí … ở dạng mờ … đậm dần khi có thêm các bước" + "nếu camp trước bị âm vì lý do gì đó thì camp mới phải rút kinh nghiệm").
-- Một dòng = một phim đang cần camp thay. Máy thay-the.py (nhịp ethopex của cty) ghi; trang etp › Cây vẽ dòng mờ dưới phim theo buoc.
-- buoc: chuan_bi (vừa xếp, đang chọn creative) · cat_goc (phim hết creative sạch → chờ cắt góc mới trên iMac) · cho_cham (có creative, chờ chấm)
--       · len_lich (đã tạo camp, chờ chạy) · chay (camp mới đã chạy → xong) · huy (phim không còn cần thay / không làm được)
-- bai_hoc: {ly_do, huong, so: {...}} — vì sao camp cũ lỗ + camp mới tránh gì (chọn creative theo đó).
-- bo_camp: [{dang, creative, camp}] — LÊN THEO BỘ (anh 29/10/2026 "các định dạng kiểu CC, CT,... đều $0 thì sao ko lên theo bộ đi"): mỗi dạng một camp $1.
create table if not exists etp.thay_the (
  id          bigserial primary key,
  content_id  integer not null,
  camp_cu     integer not null,
  buoc        text not null default 'chuan_bi',
  creative_id integer,
  camp_moi    integer,
  bai_hoc     jsonb not null default '{}'::jsonb,
  bo_camp     jsonb not null default '[]'::jsonb,
  ghi         text,
  tao         timestamptz not null default now(),
  cap_nhat    timestamptz not null default now()
);
create unique index if not exists etp_thay_the_mo on etp.thay_the (content_id) where buoc not in ('chay', 'huy');
create index if not exists etp_thay_the_buoc on etp.thay_the (buoc);
