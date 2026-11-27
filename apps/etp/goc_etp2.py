"""GỐC REPO etp2 — etp2 tách khỏi monorepo sang repo riêng github.com/mixseomin/etp2 (anh 27/11/2026 "Tách etp2 sang repo riêng").
Máy monorepo còn đọc vài tệp của etp2 (sổ mẫu creative, hệ số mùa, dich-truoc.mts, etp-khung.ts) → tìm repo đó MỘT chỗ ở đây:
  env ETP2_GOC, không có thì <cha của monorepo>/etp2 (box3 /opt/etp2 · iMac /Users/htuan/Me/GitHub/etp2).
Không thấy repo → FileNotFoundError nói rõ đường đã tìm (kêu to, không đọc nhầm bản cũ).
Dùng: from goc_etp2 import tep, GOC   ·   tep("src", "lib", "etp-mau-cr.json")"""
import os
_MONO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
# thử theo thứ tự: env → cạnh monorepo → chỗ cố định của hai máy. Bản sao monorepo của máy chạy nền (iMac /Users/htuan/may-ky-su/etp-dong-phim)
# không nằm cạnh etp2 → trước chỉ thử "cạnh monorepo" nên mọi lượt dựng mẫu chết FileNotFoundError (27/11/2026)
_THU = [os.environ.get("ETP2_GOC"), os.path.join(os.path.dirname(_MONO), "etp2"), os.path.expanduser("~/Me/GitHub/etp2"), "/opt/etp2"]
GOC = os.path.normpath(next((d for d in _THU if d and os.path.isdir(os.path.join(d, "src"))), _THU[0] or _THU[1]))

def tep(*p):
    """đường tuyệt đối tới tệp trong repo etp2 — không có thì báo lỗi to"""
    d = os.path.join(GOC, *p)
    if not os.path.exists(d):
        raise FileNotFoundError(f"không thấy {d} — repo etp2 không thấy ở {[d for d in _THU if d]} (đặt ETP2_GOC nếu ở chỗ khác; clone github.com/mixseomin/etp2)")
    return d

if __name__ == "__main__":
    print(GOC, "✓" if os.path.isdir(os.path.join(GOC, "src")) else "✗ không có")
