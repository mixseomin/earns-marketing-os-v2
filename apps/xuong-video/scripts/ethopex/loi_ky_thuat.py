"""PHÂN LOẠI LỖI dây chuyền creative Ethopex (anh 23/10/2026: "phải fix khi lỗi xảy ra thì làm gì tiếp… lần sau gặp lại lỗi này thì sao").
Hai loại, xử khác nhau — mọi bước (cat-cuoi-lo, len-creative, phim-moi) dùng chung hàm này, không tự đoán riêng:
  KỸ THUẬT (tải hỏng, quá giờ, script đổ, mạng, tệp hỏng) → TỰ THỬ LẠI tại chỗ (THU_LAI lần, nghỉ NGHI giây); vẫn hỏng → trạng thái *_loi để lượt sau tự làm lại
  NỘI DUNG (thoại cấm, 18+, không còn khung sạch, Meta từ chối) → bỏ, không thử lại
Lỗi không nhận ra loại nào → coi là KỸ THUẬT (thử lại tốn ít; bỏ oan một phim thì mất cả phim)."""
import re, time
THU_LAI, NGHI = 2, 20
NOI_DUNG = re.compile(r"THOAI CHAN: \d+s|THOAI CHAN: \d+ khung|PHIM18|18\+|khung cuối sạch|từ chối|rejected|Adult Sexual|STUDIO SAI|CTA không đạt|ngắn hơn khung", re.I)   # "ngắn hơn khung" = phim không còn khung sạch đủ dài (cắt bỏ giây cấm) — NỘI DUNG, không cắt lại (03/11/2026: coi là kỹ thuật → sua-cta cắt lại 5 phim mỗi 10 phút, ~3 giờ/lượt, treo box3)

def ky_thuat(loi):
    """True = lỗi kỹ thuật (thử lại được); False = bị loại vì nội dung; None = không lỗi"""
    if not loi: return None
    s = str(loi)
    if re.search(r"không tải được|không đọc được|Timeout|timed out|Traceback|Errno|Connection|ssh:|curl:|moov atom|Invalid data|No such file|Broken pipe|HTTP Error 5\d\d", s, re.I): return True
    return not NOI_DUNG.search(s)

# TIN TELEGRAM KHÔNG LỘ ĐƯỜNG DẪN / MÃ NGUỒN (anh 07/11/2026): đuôi lỗi máy → câu dễ hiểu. Dừng ở "<" để không nuốt thẻ HTML đóng. Bản JS: deHieu ở apps/cty/worker/ethopex.mjs
_DUOI_MAY = re.compile(r"(?:Traceback|subprocess\.|\w*TimeoutExpired|\b\w+(?:Error|Exception):|Command \[|\[?'?(?:/Users|/opt|/private|/root|/tmp)/)[^\n<]*")
def de_hieu(chu):
    """đổi đuôi lỗi máy trong chữ gửi người đọc thành câu thường; chữ không có đuôi máy giữ nguyên"""
    s = _DUOI_MAY.sub(lambda m: "máy chạy quá giờ" if re.search("timeout|timed out", m.group(0), re.I) else "máy gặp sự cố kỹ thuật", str(chu or ""))
    return re.sub(r"[\w./-]+\.(?:py|mjs)\b", "máy", s)

def thu(f, *a, lan=THU_LAI, nghi=NGHI, loi_cua=lambda k: k.get("loi") if isinstance(k, dict) else None):
    """chạy f(*a); kết quả mang lỗi KỸ THUẬT thì chạy lại (tối đa `lan` lần nữa). Lỗi nội dung hoặc đạt → trả ngay."""
    k = f(*a)
    for _ in range(lan):
        if ky_thuat(loi_cua(k)) is not True: break
        time.sleep(nghi); k = f(*a)
    return k

if __name__ == "__main__":
    assert ky_thuat("THOAI CHAN: không tải được video https://x") is True
    assert ky_thuat("subprocess.TimeoutExpired: Command ...") is True
    assert ky_thuat("Traceback (most recent call last):\n ModuleNotFoundError: No module named 'PIL'") is True
    assert ky_thuat("THOAI CHAN: 738s «You filthy bitch» (từ: bitch)") is False
    assert ky_thuat("THOAI CHAN: 1 khung — đoạn 0.0–88.9s không cắt (Meta: Adult Sexual Exploitation)") is False
    assert ky_thuat("không có khung cuối sạch (giây cấm [56.0])") is False
    assert ky_thuat("PHIM18 CHAN: phim 78433 dính từ khoá 18+ 'steamy'") is False
    assert ky_thuat("lỗi lạ chưa gặp") is True and ky_thuat(None) is None
    n = [0]; assert thu(lambda: (n.__setitem__(0, n[0] + 1), {"loi": "Timeout"} if n[0] < 2 else {"ok": 1})[1], nghi=0) == {"ok": 1} and n[0] == 2
    assert de_hieu("cat: không ra đoạn nào: TimeoutExpired: Command ['nice', '/Users/htuan/x/cat-cuoi-lo.py'") == "cat: không ra đoạn nào: máy chạy quá giờ"
    assert de_hieu("<b>a</b> ValueError: x /opt/y</i>") == "<b>a</b> máy gặp sự cố kỹ thuật</i>" and de_hieu("thu $5 — bình thường") == "thu $5 — bình thường"
    print("loi_ky_thuat: tự kiểm đạt")
