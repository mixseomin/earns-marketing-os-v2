-- XÉT LUẬT TỪNG CAMP (anh 28/10/2026: "68683: camp này sao không bị dính luật nào? Cần xem mức độ liên quan của từng camp với các luật khi hover vào"
-- · "luật gần thì phải show ra là ok. Luật khác thì cũng cần có thể xem khi hover vào để biết tính có đúng không + hiểu rõ hơn về từng luật").
-- luat-ethopex.py --json ghi mỗi nhịp: với mỗi camp đang chạy, từng luật → điều kiện (giá trị thật · ngưỡng · đạt?), kết luận đạt / gần / xa,
-- và máy có xếp camp vào danh sách làm hay không. Cùng số + ngưỡng máy dùng để quyết, không tính lại bản riêng.
CREATE TABLE IF NOT EXISTS etp.xet_luat (
  camp_id integer PRIMARY KEY,
  luc     timestamptz NOT NULL DEFAULT now(),
  xet     jsonb NOT NULL DEFAULT '[]'::jsonb
);
