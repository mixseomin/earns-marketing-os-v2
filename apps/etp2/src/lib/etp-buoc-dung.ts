// Tên các bước máy dựng theo mẫu (etp.mau_dung.buoc, dung-mau.py iMac) — một chỗ khai: tab Mẫu Creative + dòng 🏭 phiếu lên camp (etp-doc) cùng đọc.
export const BUOC_DUNG: [string, string][] = [['cho', 'chờ máy'], ['nang_cap', 'chờ nâng cấp mẫu'], ['trang_phim', 'chờ link tập'], ['tai_tap', 'tải tập'], ['chon_khung', 'chọn khung'], ['ve_mau', 'vẽ mẫu'], ['giong', 'giọng'], ['video', 'video'], ['thu_vien', 'thư viện'], ['creative', 'tải creative'], ['xong', 'xong']];
export const tenBuocDung = (b: string) => BUOC_DUNG.find(([k]) => k === b)?.[1] ?? b;
