#!/usr/bin/env python3
"""A/B PHẢI ĐỦ MẪU MỚI ĐƯỢC KẾT LUẬN (anh 08/11/2026: "Các A/B phải làm cho đúng và đủ mẫu mới đc kết luận").
Trước: sổ etp.ab chỉ có tên nhánh — không ai đếm mỗi nhánh đã bao nhiêu camp / bao nhiêu tiền, AB01 đứng từ 06/11 (khung nhận camp = đúng một ngày) mà không ai biết.
Nay (một chỗ, chạy mỗi lượt đồng bộ 10 phút — dong-bo.py gọi chay(q)):
  1. etp.ab.mau {camp, chi, ngay}: NGƯỠNG MẪU mỗi nhánh — số camp có chi ≥ $1, tổng chi ($), số ngày đã khép kể từ bat_dau
  2. view etp.ab_so: mỗi lần A/B × nhánh → camp, camp có chi, chi, thu, lãi, ROI (CHỈ ngày đã khép, từ lúc camp vào A/B; bỏ camp etp.camp_ab.loai_tru) + du_mau
  3. trigger etp.ab: ghi ket_luan khi CHƯA đủ mẫu → lỗi (máy chặn, không ai kết luận sớm được); ket_luan bắt đầu "HUỶ" (dừng thử nghiệm) không bị chặn
  4. AB04 (roas_tang, anh 08/11/2026 "Camp ROAS làm thêm thử nghiệm tăng bậc <=1.5 lần đến max $30"): camp ★ ROAS $20 chạm trần + ROI cao chưa thuộc A/B nào
     → chia vào nhánh đang ít camp hơn (bằng nhau → thử); nhánh thử tăng $20 → $30 (×1,5, đúng thang) qua lam-ethopex.py; nhánh đối chứng để luật hiện hành
Dùng: python3 ab_mau.py --bao   → bảng từng A/B (box3, có DATABASE_URL)"""
import json, os, subprocess, sys

R = os.path.dirname(os.path.abspath(__file__)); LAM = os.path.join(R, "..", "xuong-video", "scripts", "ethopex", "lam-ethopex.py")

KHO = r"""
alter table etp.ab add column if not exists mau jsonb;
alter table etp.camp_ab add column if not exists loai_tru text;
create or replace view etp.ab_so as
with n as (
  select a.ab, a.nhanh, a.camp_id, coalesce(sum(s.chi), 0) chi, coalesce(sum(s.thu), 0) thu
  from etp.camp_ab a left join etp.so_ngay s on s.camp_id = a.camp_id and s.ngay >= (a.tao at time zone 'utc')::date and s.ngay < (now() at time zone 'utc')::date
  where a.loai_tru is null group by 1, 2, 3),
x as (
  select b.ma, n.nhanh, count(n.camp_id) camp, count(n.camp_id) filter (where n.chi >= 1) co_chi, round(sum(n.chi), 2) chi, round(sum(n.thu), 2) thu,
    round(sum(n.thu - n.chi), 2) lai, round(100 * (sum(n.thu) - sum(n.chi)) / nullif(sum(n.chi), 0)) roi
  from etp.ab b left join n on n.ab = b.ma group by 1, 2)
select x.*, b.trang_thai, b.mau, greatest(0, (now() at time zone 'utc')::date - b.bat_dau) ngay,
  coalesce(x.co_chi >= (b.mau->>'camp')::int and x.chi >= (b.mau->>'chi')::numeric, false) nhanh_du,
  coalesce((select bool_and(y.co_chi >= (b.mau->>'camp')::int and y.chi >= (b.mau->>'chi')::numeric) and count(*) = 2 from x y where y.ma = b.ma and y.nhanh in ('thu', 'doi'))
           and (now() at time zone 'utc')::date - b.bat_dau >= (b.mau->>'ngay')::int, false) du_mau
from x join etp.ab b on b.ma = x.ma;
create or replace function etp.ab_chan_ket_luan() returns trigger language plpgsql as $f$
declare d boolean; t text;
begin
  if new.ket_luan is null or new.ket_luan is not distinct from old.ket_luan or new.ket_luan like 'HUỶ%' then return new; end if;
  select bool_and(du_mau), string_agg(nhanh || ': ' || co_chi || '/' || coalesce(new.mau->>'camp', '?') || ' camp, $' || chi || '/' || coalesce(new.mau->>'chi', '?'), ' · ')
    into d, t from etp.ab_so where ma = new.ma;
  if new.mau is null or not coalesce(d, false) then
    raise exception 'A/B % chưa đủ mẫu — không được kết luận (anh 08/11/2026). %', new.ma, coalesce(t, 'chưa có số');
  end if;
  return new;
end $f$;
drop trigger if exists ab_chan_ket_luan on etp.ab;
create trigger ab_chan_ket_luan before update of ket_luan on etp.ab for each row execute function etp.ab_chan_ket_luan();
"""

# AB04 — điều kiện vào: ★ ROAS đang chạy $20, 3 ngày đã khép đủ ở $20, tiêu TB ≥ 90% ngân sách, ROI 3 ngày ≥ +30%, chưa thuộc A/B nào
VAO_AB04 = """with s as (select camp_id, count(*) ngay, sum(chi) chi, sum(thu) thu, avg(chi / nullif(ngan_sach, 0)) ty
                  from etp.so_ngay where ngay between (now() at time zone 'utc')::date - 3 and (now() at time zone 'utc')::date - 1 and ngan_sach = 20 group by 1)
  select c.camp_id from etp.camp c join s using (camp_id)
  where c.la_roas and c.trang_thai = 'ACTIVE' and c.ngan_sach = 20 and s.ngay = 3 and s.ty >= 0.9 and s.thu >= s.chi * 1.3
    and not exists (select 1 from etp.camp_ab a where a.camp_id = c.camp_id) order by c.camp_id"""

def ab04(q):
    """chia camp mới vào AB04 + tăng nhánh thử lên $30. Trả câu tóm tắt."""
    if q("select trang_thai from etp.ab where ma = 'AB04'") != "dang": return ""
    vao = [int(x) for x in q(VAO_AB04).split() if x.isdigit()]
    for cid in vao:
        dem = dict(l.split("|") for l in q("select nhanh, count(*) from etp.camp_ab where ab = 'AB04' and loai_tru is null group by 1").splitlines() if "|" in l)
        nh = "thu" if int(dem.get("thu", 0)) <= int(dem.get("doi", 0)) else "doi"
        q(f"insert into etp.camp_ab (camp_id, ab, nhanh, dang) values ({cid}, 'AB04', '{nh}', null) on conflict (camp_id) do nothing")
    # nhánh thử chưa lên $30 → tăng (lam-ethopex: đúng thang, nhịp ≥ 24 giờ, khung giờ tăng — bị chặn thì lượt sau thử lại)
    can = [int(x) for x in q("""select a.camp_id from etp.camp_ab a join etp.camp c using (camp_id)
                                 where a.ab = 'AB04' and a.nhanh = 'thu' and a.loai_tru is null and c.trang_thai = 'ACTIVE' and c.ngan_sach < 30""").split() if x.isdigit()]
    tang, chan = [], []
    for cid in can:
        r = subprocess.run(["python3", LAM, "tang", str(cid), "30", "--luat", "AB04 nhánh thử: ★ ROAS chạm trần $20 → tăng ×1,5 lên $30",
                            "--ai", "máy A/B (anh chat 08/11/2026: thử nghiệm tăng bậc ≤ 1,5 lần đến max $30)"], capture_output=True, text=True, timeout=300)
        # lam-ethopex thoát mã 0 cả khi bị chặn → đọc "ok" của dòng JSON cuối (08/11/2026: báo "tăng $30" mà Ethopex vẫn $20 vì trần $20/camp)
        try: kq = json.loads((r.stdout.strip().splitlines() or ["{}"])[-1])
        except Exception: kq = {"ok": False, "loi": (r.stdout + r.stderr).strip()[-120:]}
        (tang if kq.get("ok") else chan).append(cid if kq.get("ok") else f"#{cid}: {str(kq.get('loi'))[:120]}")
    return " · ".join(x for x in (f"vào {len(vao)}" if vao else "", f"tăng $30: {tang}" if tang else "", f"chưa tăng được {chan}" if chan else "") if x)

def chay(q):
    q(KHO)
    try: t = ab04(q)
    except Exception as e: t = f"lỗi: {str(e)[:200]}"
    return {"ab": t} if t else {}

def bao(q):
    rows = [l.split("|") for l in q("""select ma, nhanh, camp, co_chi, chi, lai, coalesce(roi::text, '–'), ngay, coalesce(mau::text, '{}'), du_mau from etp.ab_so
                                        where trang_thai = 'dang' and nhanh is not null order by ma, nhanh desc""").splitlines() if "|" in l]
    for ma, nh, camp, co, chi, lai, roi, ngay, mau, du in rows:
        m = json.loads(mau)
        print(f"{ma} {nh:3} camp {co}/{m.get('camp', '?')} có chi · chi ${chi}/{m.get('chi', '?')} · lãi ${lai} · ROI {roi}% · ngày {ngay}/{m.get('ngay', '?')} · {'ĐỦ MẪU' if du == 't' else 'chưa đủ mẫu'}")

if __name__ == "__main__":
    def q(s):
        r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-v", "ON_ERROR_STOP=1", "-c", s], capture_output=True, text=True, timeout=300)
        if r.returncode: raise RuntimeError(r.stderr.strip()[-300:])
        return r.stdout.strip()
    if "--bao" in sys.argv: bao(q)
    else: print(json.dumps(chay(q), ensure_ascii=False))
