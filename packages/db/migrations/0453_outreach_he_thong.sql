-- OUTREACH.ON.TC nhịp 2–4 (anh 20/11/2026 "chạy một lượt hết nhịp 4"): đường gửi theo tên miền người gửi · nhật ký từng thư (đi + đến) · sổ chặn · dữ kiện người nhận · cấu hình chiến dịch.
-- Thay cho việc gửi cứng qua Mailjet (cổng đó đã chết, chiến dịch tự gửi đứng từ 09/07/2026): mỗi tên miền người gửi một dòng outreach_duong_gui.
-- KHÔNG lưu mật khẩu trong DB: dòng chỉ ghi TỆP khoá trên máy chủ + TÊN biến trong tệp đó.

create table if not exists outreach_duong_gui (
  id bigserial primary key,
  mien text not null unique,                 -- tên miền của địa chỉ gửi (vd anglebrief.net); chiến dịch chọn đường theo phần sau @ của from_email
  kieu text not null default 'smtp',         -- smtp
  host text not null,
  cong integer not null default 587,
  khoa_tep text not null,                    -- tệp khoá trên máy chủ (vd /root/.secrets/mailbaby.env)
  khoa_user text not null,                   -- TÊN biến tài khoản trong tệp (vd MBUSER)
  khoa_pass text not null,                   -- TÊN biến mật khẩu trong tệp (vd MBPASS)
  dkim_tep text,                             -- tệp khoá ký DKIM (vd /root/.secrets/dkim-anglebrief.pem)
  dkim_selector text,
  tra_loi text,                              -- địa chỉ Reply-To có hộp nhận thật; trống = dùng địa chỉ gửi
  hop_den text,                              -- địa chỉ mà thư trả lời rơi vào hộp thư chung (to_addr trong claude_inbox) — máy dò thư đến lọc theo đây
  chan_thu text,                             -- dòng chân thư bắt buộc (tên + địa chỉ bưu chính của bên gửi); trống = chưa khai
  tran_ngay integer not null default 30,     -- trần thư outreach mỗi ngày của CẢ tên miền (mọi chiến dịch cộng lại)
  bat boolean not null default true,
  ghi_chu text,
  tao_luc timestamptz not null default now(),
  cap_nhat timestamptz not null default now()
);

create table if not exists outreach_thu (
  id bigserial primary key,
  prospect_id bigint references outreach_prospects(id) on delete cascade,
  campaign_id bigint,
  project_id text,
  chieu text not null,                       -- di | den
  buoc integer not null default 0,           -- thư đi: 0 = thư đầu, 1.. = thư nhắc; thư thử ghi -1
  tu text,
  toi text,
  tieu_de text,
  noi_dung text,
  ma_thu text,                               -- Message-ID (thư đến: dùng để không nạp trùng)
  trang_thai text not null default 'ok',     -- ok | loi | thu (gửi thử)
  loi text,
  luc timestamptz not null default now()
);
create index if not exists outreach_thu_prospect_idx on outreach_thu(prospect_id);
create index if not exists outreach_thu_luc_idx on outreach_thu(chieu, luc);
create unique index if not exists outreach_thu_ma_den_uidx on outreach_thu(ma_thu) where chieu = 'den' and ma_thu is not null;

-- người đã xin thôi nhận / địa chỉ dội: không bao giờ gửi nữa, ở MỌI chiến dịch của mọi dự án
create table if not exists outreach_chan (
  email text primary key,
  ly_do text not null,                       -- thoi (xin thôi) | doi (thư dội) | tay (chặn tay)
  ghi_chu text,
  luc timestamptz not null default now()
);

-- dữ kiện lấy từ nguồn (quảng cáo của chính họ, số ngày chạy…) + chuỗi thư đã soạn — AI viết thư đọc ở đây, người duyệt cũng đọc ở đây
alter table outreach_prospects add column if not exists du_lieu jsonb not null default '{}'::jsonb;
-- cấu hình theo kiểu chiến dịch: ngách, report gắn kèm, sản phẩm chào…
alter table outreach_campaigns add column if not exists cau_hinh jsonb not null default '{}'::jsonb;

-- Đường gửi đầu tiên: anglebrief.net qua MailBaby (đúng đường thư mua hàng của AngleBrief đang chạy: relay.mailbaby.net:587 + DKIM selector mailer).
insert into outreach_duong_gui (mien, kieu, host, cong, khoa_tep, khoa_user, khoa_pass, dkim_tep, dkim_selector, tra_loi, hop_den, tran_ngay, ghi_chu)
values ('anglebrief.net', 'smtp', 'relay.mailbaby.net', 587, '/root/.secrets/mailbaby.env', 'MBUSER', 'MBPASS', '/root/.secrets/dkim-anglebrief.pem', 'mailer',
        'hello@anglebrief.net', 'hello@anglebrief.net', 20, 'cùng đường với thư mua hàng AngleBrief; trần thấp vì là tên miền chính')
on conflict (mien) do nothing;
