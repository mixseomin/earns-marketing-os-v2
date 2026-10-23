"""NHỊP XƯỞNG PHIM MỚI cho city.on.tc (anh 23/10/2026: "quá trình sản xuất phải nhìn được realtime trên city"). Mỗi bước dây chuyền gọi bao(...)
→ studio xv_khoa_ngoai['ethopex_xuong'] = {buoc, lo, phim, xong, tong, bat_dau, loi, luc, may:{tai, nhan, trong_gb, che_do}}; city đọc mỗi 5 giây
(mos2 /api/social/thanh-pho/xuong). Gửi tối đa 1 lần / 3 giây, đổi bước thì gửi ngay; lỗi gửi không bao giờ làm hỏng dây chuyền.
Bước: tai (tải tập) · cat (chọn khung + dựng đoạn) · soat (chờ Claude soát 18+) · day (đẩy creative + cổng chữ) · len (tạo camp) · sua (sửa CTA / góc mới) · nghi"""
import datetime as dt, json, os, shutil, subprocess, sys, time
B = "root@167.233.241.16"; ENV = "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a"
_cuoi = {"t": 0.0, "buoc": None, "bat_dau": None}

def may():
    h = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)).hour
    try: tai = round(os.getloadavg()[0], 1)
    except Exception: tai = None
    return {"tai": tai, "nhan": os.cpu_count(), "trong_gb": round(shutil.disk_usage(os.path.expanduser("~")).free / 1e9), "che_do": "đêm (đủ lõi)" if (h >= 22 or h < 8) else "ngày (chế độ nền)",
            "ten": os.uname().nodename.split(".")[0]}

def bao(buoc, lo=None, phim=None, xong=None, tong=None, loi=None, ep=False):
    try:
        now = time.time()
        if buoc != _cuoi["buoc"]: _cuoi["bat_dau"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"); ep = True
        if not ep and now - _cuoi["t"] < 3: return
        _cuoi.update(t=now, buoc=buoc)
        v = {"buoc": buoc, "lo": lo, "phim": phim, "xong": xong, "tong": tong, "loi": (str(loi)[:160] if loi else None), "bat_dau": _cuoi["bat_dau"],
             "luc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "may": may()}
        s = json.dumps(v, ensure_ascii=False).replace("'", "''")
        cau = f"insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_xuong', '{s}'::jsonb) on conflict (ten) do update set gia_tri = excluded.gia_tri"
        if os.path.exists("/opt/earns-marketing-os-v2"):   # chạy trên box3
            subprocess.run(["psql", os.environ.get("DATABASE_URL", ""), "-tAc", cau], capture_output=True, timeout=15)
        else:
            subprocess.Popen(["ssh", "-o", "ConnectTimeout=8", B, f'{ENV}; psql "$DATABASE_URL" -tA -f -'], stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, text=True).communicate(cau, timeout=20)
    except Exception as e:
        print("xuong.bao lỗi (bỏ qua):", e, file=sys.stderr)

if __name__ == "__main__":   # xuong.py <bước> [lô] — ghi tay một nhịp (thử / đặt 'nghi')
    a = sys.argv[1:]; bao(a[0] if a else "nghi", a[1] if len(a) > 1 else None, ep=True); print("đã ghi nhịp", a)
