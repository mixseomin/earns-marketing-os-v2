-- ĐỀ XUẤT BẬC CHO TEAM (anh 30/10/2026: "các đề xuất áp dụng bậc. Nhưng chỉ đề xuất, ko tự ý update !! Trừ tk Nhà vẫn làm như cũ").
-- apps/etp/de-xuat-ngoai.py chạy máy luật nhà (luat-ethopex.py) ở chế độ ETP_XEM_NGUOI cho từng người: cổng chung chặn mọi lệnh ghi.
--   · xet_luat_ngoai: bảng xét từng luật của camp ngoài (cùng dạng etp.xet_luat — trang etp ?ng=<người> hiện như camp nhà)
--   · de_xuat_bac: mỗi đề xuất (camp × loại × ngân sách lúc đề xuất) — lan_dau / lan_cuoi máy thấy; so với etp.bac_ngoai (0373) để biết người
--     lên bậc sớm / muộn hơn máy bao lâu, và ROI sau đó.
create table if not exists etp.xet_luat_ngoai (
  camp_id int primary key,
  nguoi_id int not null,
  luc timestamptz not null default now(),
  xet jsonb not null default '[]'::jsonb
);
create index if not exists etp_xet_luat_ngoai_nguoi on etp.xet_luat_ngoai (nguoi_id);

create table if not exists etp.de_xuat_bac (
  camp_id int not null,
  loai text not null,          -- tang · dau_phien · tang30 · moc30 · nb · ha · tat (gộp mọi luật tắt) · giam
  ns numeric not null,         -- ngân sách camp lúc máy đề xuất
  nguoi_id int not null,
  luat text,                   -- khoá luật gốc trong JSON máy luật (tat_l3, tat_d24…)
  chu text,                    -- câu máy viết (điều kiện + đích)
  lan_dau timestamptz not null default now(),
  lan_cuoi timestamptz not null default now(),
  primary key (camp_id, loai, ns)
);
create index if not exists etp_de_xuat_bac_nguoi on etp.de_xuat_bac (nguoi_id, lan_cuoi desc);
