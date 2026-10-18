#!/usr/bin/env python3
"""KHO CÂU MÓC từ spy cho máy đăng (anh 18/10/2026: "tiêu đề hay hook thường gần với nhau. Hệ thống spy có góc và các hook từ chính comment
người dùng và QC chạy lâu thì dùng lại được chứ?" → "được").
Mỗi ngách (sản phẩm spy goc_sp) → mau/kho-moc/<ngach>.json:
  goc[]  góc nhiều lượt nhắc (nỗi lo / phản đối / tình huống / mong muốn) → CHỌN CHỦ ĐỀ bài; mỗi góc kèm câu thật của người dùng (Reddit /
         YouTube / gợi ý Google, goc_dan.cau) → làm CÂU MÓC theo đúng giọng họ
  qc[]   QC Meta chạy ≥ 60 ngày khớp ngách → học KHUNG câu móc (không chép nguyên câu vào bài đăng tự nhiên — câu QC mang ưu đãi / thương hiệu khác)
Dùng: viết tiêu đề / đề mới / câu hỏi quiz / bài theo chiêu; mỗi bài ghi goc_id để đo lượt sang site theo góc (UTM campaign = slug).
Chạy trên box3 (DB spy, quyền postgres) từ máy Mac:
  ssh root@167.233.241.16 'python3 - hotel' < kho-moc.py > ../../mau/kho-moc/hotel.json
  ssh root@167.233.241.16 'python3 - esim'  < kho-moc.py > ../../mau/kho-moc/esim.json
"""
import json, subprocess, sys

NGACH = {
    'hotel': {'sp': 179, 'qc': "noi_dung ilike '%hotel%' and (noi_dung ~* '(scam|book|fee|resort|refund|cancel|stay|room)')"},
    'esim': {'sp': 181, 'qc': "noi_dung ~* '(esim|e-sim|roaming)'"},
}
SO_GOC, SO_CAU, SO_QC, NGAY_QC = 25, 6, 25, 60

def q(sql):
    r = subprocess.run(['sudo', '-u', 'postgres', 'psql', 'spy', '-tAc', sql], capture_output=True, text=True, check=True)
    return json.loads(r.stdout.strip() or 'null') or []

def main():
    ten = sys.argv[1] if len(sys.argv) > 1 else ''
    if ten not in NGACH: sys.exit(f'ngách: {" | ".join(NGACH)}')
    n = NGACH[ten]
    goc = q(f"""select json_agg(x) from (
      select g.id, g.loai, g.ten, g.mo_ta, g.so_nhac, g.so_qc, g.bat_ngo,
        (select json_agg(c) from (select left(regexp_replace(d.cau, '\\s+', ' ', 'g'), 300) as cau, s.nguon, s.url, s.diem
           from goc_dan d join goc_nguon s on s.id = d.nguon_id
           where d.goc_id = g.id and d.cau is not null and length(d.cau) between 20 and 400
           order by s.diem desc nulls last, length(d.cau) limit {SO_CAU}) c) as cau
      from goc g where g.sp_id = {n['sp']} and coalesce(g.so_nhac, 0) > 0
      order by g.so_nhac desc nulls last limit {SO_GOC}) x""")
    qc = q(f"""select json_agg(x) from (
      select distinct on (left(noi_dung, 120)) library_id, page_ten, left(regexp_replace(noi_dung, '\\s+', ' ', 'g'), 400) as chu,
        coalesce(ngay_dung, current_date) - bat_dau as ngay, bat_dau, ngay_dung is null as dang_chay
      from qc_meta where {n['qc']} and bat_dau is not null and coalesce(ngay_dung, current_date) - bat_dau >= {NGAY_QC}
      order by left(noi_dung, 120), coalesce(ngay_dung, current_date) - bat_dau desc) x""")
    qc = sorted(qc, key=lambda x: -x['ngay'])[:SO_QC]
    json.dump({'ngach': ten, 'sp_id': n['sp'], 'nguon': 'spy (box3, DB spy: goc / goc_dan / goc_nguon / qc_meta)', 'goc': goc, 'qc': qc}, sys.stdout, ensure_ascii=False, indent=1)
    print(f'{ten}: {len(goc)} góc, {sum(len(g["cau"] or []) for g in goc)} câu thật, {len(qc)} QC ≥ {NGAY_QC} ngày', file=sys.stderr)

if __name__ == '__main__':
    main()
