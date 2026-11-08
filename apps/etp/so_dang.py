"""SỔ DẠNG CREATIVE cho máy Python — đọc apps/web/src/lib/etp-dang.json (một nơi duy nhất, web cũng đọc tệp đó). Không khai lại bảng dạng ở tệp khác:
apps/etp/kiem-so-dang.mjs (dong-bo.py chạy mỗi lượt, đỏ → cảnh báo Telegram). Dùng: sys.path có apps/etp → import so_dang as DG.
  DG.DS           danh sách mục {dang, ma, mau, khong_dau, dong, tinh}
  DG.CHUAN        nhãn (có dấu / không dấu) → dạng có dấu
  DG.KHONG_DAU    dạng có dấu → nhãn không dấu
  DG.MA           dạng có dấu → mã ngắn
  DG.DONG         mã loại dòng phim → dạng
  DG.TINH         tập mã dòng phim dạng tĩnh
  DG.KIEU         tên kiểu script dựng (--kieu) → mục sổ
  DG.theo_ten(t)  dạng đọc từ tên creative / camp (khớp nhãn DÀI trước: 'anh tinh tom tat' trước 'anh tinh')"""
import json, os

_TEP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "src", "lib", "etp-dang.json")
DS = json.load(open(_TEP, encoding="utf-8"))["dang"]
CHUAN = {**{x["khong_dau"]: x["dang"] for x in DS}, **{x["dang"]: x["dang"] for x in DS}}
KHONG_DAU = {x["dang"]: x["khong_dau"] for x in DS}
MA = {x["dang"]: x["ma"] for x in DS}   # dạng → mã ngắn (badge / báo cáo)
DONG = {x["dong"]: x["dang"] for x in DS if x.get("dong")}
TINH = {x["dong"] for x in DS if x.get("tinh") and x.get("dong")}
KIEU = {x["kieu"]: x for x in DS if x.get("kieu")}   # tên kiểu (--kieu của kieu-moi.py / tinh-ba-kieu.py) → mục sổ
_THEO_DAI = sorted(CHUAN.items(), key=lambda kv: -len(kv[0]))

def theo_ten(t, mac_dinh=None):
    t = (t or "").lower()
    return next((v for k, v in _THEO_DAI if k in t), mac_dinh)

if __name__ == "__main__":
    ma = [x["ma"] for x in DS]; dong = [x["dong"] for x in DS if x.get("dong")]
    assert len(set(ma)) == len(ma), f"mã ngắn trùng: {ma}"
    assert len(set(dong)) == len(dong), f"mã dòng trùng: {dong}"
    assert theo_ten("dp297 X ES - anh tinh tom tat 0-9s") == "ảnh tĩnh tóm tắt" and theo_ten("tv1 X EN - anh tinh 0-9s") == "ảnh tĩnh"
    print(f"sổ dạng ok: {len(DS)} dạng · dòng {sorted(DONG)} · tĩnh {sorted(TINH)}")
