-- AB02 chia theo CẶP (anh 05/11/2026 "AB thì phải cùng điểm xuất phát"): camp mới vào nhánh đang ít camp hơn, thay crc32 chẵn/lẻ (22:33 05/11 cả hai camp đầu rơi vào nhánh thu).
update etp.ab set cach_chia = 'theo cặp: camp mới vào nhánh đang ít camp hơn' where ma = 'AB02';
