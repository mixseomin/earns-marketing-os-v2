"""TRẦN CAMP MỚI THEO LÃI + BA CHỐT CHẶN (anh 11/11/2026: "Hạ trần camp mới mỗi ngày tăng theo lãi trước đó để ko bị lệch quá và đi từ dưới lên.
Giai đoạn A khoảng 30-40 camp" · "Ok thì làm"). dong-bo.py gọi chay(q) mỗi lượt (10 phút), TRƯỚC mua_le.chay — mua_le nhận số này làm trần gốc rồi co giãn mùa lễ.

Mỗi ngày Ethopex quyết MỘT lần, sau GIO_QUYET giờ UTC (số hôm qua đã khép — cùng mốc mua_le / T1_CHO):
  mức theo lãi = lãi hôm qua (camp nhà, ngày đã khép) × PHAN_LAI ÷ GIA_THU   (GIA_THU = tiền thử trung bình một camp $1 mới: 5 ngày đầu chi ~$4,3 · ROI −25%,
                                                                            số 25/10–06/11)
  trần mới = min(trần cũ + BUOC, mức theo lãi, TRAN_MAX) — đi lên từng nấc; lãi tụt thì xuống thẳng mức theo lãi.
CHỐT CHẶN (máy tự làm, không chờ anh):
  1. ROI chung 2 ngày đã khép liền < CHAN_ROI% → trần 0 (ngưng lên camp mới tới khi hồi; hồi lại thì bắt đầu lại từ BAT_DAU).
  2. Lớp camp thử (camp thường ≤ 4 ngày tuổi) hôm qua lỗ quá CHAN_THU $ → trần ≤ một nửa trần cũ.
  3. Bộ nào 3 ngày đã khép chi ≥ BO_CHI và ROI < BO_ROI% → vào bo_dung: cổng chung (cong.kiem) chặn tạo camp / nhân bản vào bộ đó.
Phần chia NUOI (bộ → tỉ lệ trần) để apps/etp/nuoi_bo.py nhân phim thắng sang bộ ít camp (anh 11/11/2026 "lên thêm camp ở 2 bộ chưa lên camp nào để nuôi tài khoản").
BÙ GIÁ ADSENSE (anh 13/11/2026 "tạo roadmap cho plan này và triển khai đi", tiendo E24 bước 1): mọi số lãi / ROI ở đây (mức theo lãi, chốt 1, chốt 2, chốt 3)
chia thu ngày đó cho hệ số giá AdSense cả chợ (gia_adsense.hs_sql — chỉ ngày giá tụt). 12/11/2026 lãi thô +$13 (ROI +0,1%) kéo trần 45 → 1; đã bù = +19%.
Trạng thái: etp.cau_hinh.tran_len {ngay, tran, ly_do, bo_dung, nuoi}. Ghi tran_camp_moi_ngay. Telegram (etp.canh_bao 'tran_len') khi trần đổi.
Tự kiểm: python3 apps/etp/tran_len.py"""
import json, os, sys, datetime as dt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import gia_adsense as GA

BAT_DAU, BUOC, TRAN_MAX = 35, 10, 75
PHAN_LAI, GIA_THU = 0.15, 1.1
CHAN_ROI, CHAN_THU = 15, 100
BO_CHI, BO_ROI = 10, -20
NUOI = {"3": 0.25, "4": 0.15, "5": 0.10}   # còn lại cho phim mới ở bo_phim_moi (bộ 1)
GIO_QUYET = 6

roi = lambda c, t: (t - c) / c * 100 if c else None

def quyet(tong, lop_thu, tran_cu, bo3):
    """hàm thuần. tong = [(ngày, chi, thu)] 2 ngày đã khép gần nhất (cũ → mới) · lop_thu = lãi $ hôm qua của camp thường ≤ 4 ngày tuổi ·
    tran_cu = trần đang áp (None = chưa có) · bo3 = {bộ: (chi, thu)} 3 ngày đã khép → {tran, ly_do, bo_dung}"""
    bo_dung = sorted(b for b, (c, t) in bo3.items() if c >= BO_CHI and roi(c, t) < BO_ROI)
    if len(tong) < 2 or not all(c > 0 for _, c, _ in tong): return {"tran": min(tran_cu or BAT_DAU, BAT_DAU), "ly_do": "thiếu số 2 ngày đã khép — giữ mức khởi đầu", "bo_dung": bo_dung}
    r2, r1 = (roi(c, t) for _, c, t in tong); lai1 = tong[-1][2] - tong[-1][1]
    if r1 < CHAN_ROI and r2 < CHAN_ROI:
        return {"tran": 0, "ly_do": f"CHỐT 1: ROI chung 2 ngày liền {r2:+.0f}% · {r1:+.0f}% < {CHAN_ROI}% → ngưng lên camp mới", "bo_dung": bo_dung}
    muc = int(max(0.0, lai1) * PHAN_LAI / GIA_THU)
    goc = tran_cu if tran_cu else BAT_DAU - BUOC   # đang 0 (chốt 1) / chưa có → bắt đầu lại từ BAT_DAU
    tran = max(0, min(goc + BUOC, muc, TRAN_MAX))
    ly = f"lãi hôm qua ${lai1:+.0f} (ROI {r1:+.0f}%) → mức theo lãi {muc} · trần cũ {tran_cu if tran_cu is not None else '—'} → {tran} (nấc +{BUOC}, trần {TRAN_MAX})"
    if lop_thu < -CHAN_THU and tran_cu:
        tran = min(tran, tran_cu // 2); ly += f" · CHỐT 2: lớp camp thử hôm qua lỗ ${lop_thu:.0f} > ${CHAN_THU} → còn {tran}"
    return {"tran": tran, "ly_do": ly, "bo_dung": bo_dung}

def chia(tran, bo_dung=()):
    """trần → {bộ: số camp nuôi} — bộ đang dừng không nhận"""
    return {b: int(tran * p) for b, p in NUOI.items() if b not in bo_dung}

def chay(q, luc=None):
    ch = lambda k, md: json.loads(q(f"select coalesce((select gia_tri::text from etp.cau_hinh where khoa = '{k}'), '{md}')") or md)
    luc = luc or dt.datetime.now(dt.timezone.utc); hn = luc.date().isoformat()
    tt = ch("tran_len", "{}")
    if tt.get("ngay") == hn or luc.hour < GIO_QUYET: return {**tt, "da_quyet": tt.get("ngay") == hn}
    d1, d2, d3 = ((luc.date() - dt.timedelta(days=i)).isoformat() for i in (1, 2, 3))
    tong = [(l.split("|")[0], float(l.split("|")[1]), float(l.split("|")[2])) for l in q(
        f"select ngay, sum(chi), sum(thu / {GA.hs_sql('ngay')}) from etp.so_ngay where ngay between '{d2}' and '{d1}' group by 1 order by 1").splitlines() if l.count("|") == 2]
    lop = float(q(f"""select coalesce(sum(n.thu / {GA.hs_sql('n.ngay')} - n.chi), 0) from etp.so_ngay n join etp.camp c using (camp_id)
        where n.ngay = '{d1}' and not c.la_roas and n.ngay - (c.tao at time zone 'utc')::date <= 4""") or 0)
    bo3 = {l.split("|")[0]: (float(l.split("|")[1]), float(l.split("|")[2])) for l in q(
        f"""select c.bo, sum(n.chi), sum(n.thu / {GA.hs_sql('n.ngay')}) from etp.so_ngay n join etp.camp c using (camp_id) where n.ngay between '{d3}' and '{d1}' and c.bo is not null group by 1""").splitlines() if l.count("|") == 2}
    cu = tt.get("tran") if tt else None
    kq = quyet(tong, lop, cu, bo3)
    moi = {"ngay": hn, "tran": kq["tran"], "ly_do": kq["ly_do"], "bo_dung": kq["bo_dung"], "nuoi": chia(kq["tran"], kq["bo_dung"])}
    q(f"insert into etp.cau_hinh (khoa, gia_tri) values ('tran_len', $J${json.dumps(moi, ensure_ascii=False)}$J$::jsonb) on conflict (khoa) do update set gia_tri = excluded.gia_tri, luc = now()")
    q(f"update etp.cau_hinh set gia_tri = to_jsonb({int(kq['tran'])}), luc = now() where khoa = 'tran_camp_moi_ngay'")
    if cu != kq["tran"] or tt.get("bo_dung") != kq["bo_dung"]:
        chu = (f"Trần camp mới {hn}: {cu if cu is not None else '—'} → {kq['tran']}/ngày — {kq['ly_do']}"
               + (f" · bộ dừng nhận camp mới (3 ngày ROI < {BO_ROI}%): {', '.join(kq['bo_dung'])}" if kq["bo_dung"] else "")
               + f" · nuôi bộ: {', '.join(f'bộ {b} {n}' for b, n in moi['nuoi'].items())} (máy đã tự áp — apps/etp/tran_len.py)")
        q(f"""insert into etp.canh_bao (loai, khoa, muc, noi_dung) select 'tran_len', 'tran_len:' || md5($N${chu}$N$), 'info', $N${chu}$N$
              where not exists (select 1 from etp.canh_bao where khoa = 'tran_len:' || md5($N${chu}$N$))""")
    return moi

if __name__ == "__main__":
    t = lambda a, b: [("d2", 1000.0, 1000 * (1 + a / 100)), ("d1", 1300.0, 1300 * (1 + b / 100))]
    k = quyet(t(30, 30), 0, None, {}); assert k["tran"] == 35 and not k["bo_dung"], k                  # chưa có trần: khởi đầu 35 (mức theo lãi 53)
    k = quyet(t(30, 30), 0, 35, {}); assert k["tran"] == 45, k                                         # lên một nấc
    k = quyet(t(30, 30), 0, 70, {}); assert k["tran"] == 53, k                                         # chạm mức theo lãi (390 × 15% ÷ 1,1 = 53)
    k = quyet(t(30, 10), 0, 45, {}); assert k["tran"] == 17, k                                         # lãi tụt → xuống thẳng mức theo lãi
    k = quyet(t(10, 12), 0, 45, {}); assert k["tran"] == 0 and "CHỐT 1" in k["ly_do"], k               # chốt 1
    k = quyet(t(10, 30), 0, 0, {}); assert k["tran"] == 35, k                                          # hồi lại → bắt đầu lại 35
    k = quyet(t(30, 30), -150, 45, {}); assert k["tran"] == 22 and "CHỐT 2" in k["ly_do"], k           # chốt 2: một nửa trần cũ
    k = quyet(t(30, 30), 0, 35, {"4": (12.0, 5.0), "3": (8.0, 2.0), "1": (900.0, 1100.0)}); assert k["bo_dung"] == ["4"], k   # chốt 3 (bộ 3 chi < $10 chưa xét)
    big = [("d2", 9000.0, 13000.0), ("d1", 9000.0, 13000.0)]; assert quyet(big, 0, 70, {})["tran"] == 75   # trần trên
    assert quyet([], 0, 40, {})["tran"] == 35                                                          # thiếu số: không đoán
    assert chia(35) == {"3": 8, "4": 5, "5": 3} and chia(35, ["4"]) == {"3": 8, "5": 3}
    print("✓ tran_len tự kiểm: khởi đầu · nấc · mức theo lãi · lãi tụt · chốt 1 / hồi lại · chốt 2 · chốt 3 · trần trên · thiếu số · chia nuôi")
