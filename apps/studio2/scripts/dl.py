# Studio 2: đóng gói dữ liệu thật của hai phim mẫu (studio phim #3071 tập 3074 'Hai chai nước ngọt', YNT phim #1195 tập 1659) thành public/du-lieu.js.
# Chạy: python3 apps/studio2/scripts/dl.py   (nguồn: scripts/du-lieu-goc/*.json — lấy từ DB studio bằng truy-van.sql; lop/lop.json do lop-ynt.cjs xuất)
import json,re,os
G=os.path.dirname(os.path.abspath(__file__)); REPO=os.path.abspath(G+'/../../..'); S=G+'/du-lieu-goc/'; RA=G+'/../public/du-lieu.js'
d=json.load(open(S+'canh.json')); x={r['id']:r for r in json.load(open(S+'canh2.json'))}; nv=json.load(open(S+'nv.json'))
bs=json.load(open(REPO+'/apps/xuong-video/scripts/du-lieu/bo-set/tau-nuoc-ngot.json'))
cn=[c for c in d if c['tap_id']==3074]; yn=[c for c in d if c['tap_id']==1659]
r1=lambda v:round(float(v),2)
CO={'ws':'Toàn','els':'Toàn','ls':'Toàn','ms':'Trung','two':'Trung','ots':'Trung','mcu':'Trung cận','cu':'Cận','ecu':'Đặc tả','insert':'Đặc tả','pov':'Trung'}
GOC={'ngang':'Ngang','thap':'Thấp','sat_dat':'Thấp','cao':'Cao'}; ONG={'rong':'Rộng','chuan':'Chuẩn','chan_dung':'Chân dung','macro':'Macro'}
TEN={'Half-drunk bottle POV':'Chai uống dở, góc nhìn chú','Second question':'Chú hỏi câu thứ hai','Change hand-off insert':'Trao tiền thừa'}
CD={'tinh':'Đứng yên','day':'Phóng gần','day_vao':'Phóng gần','lui':'Lùi xa','lia':'Lia ngang','truot':'Lia ngang','theo':'Lia ngang','cam_tay':'Đứng yên'}
vs={k:set() for k in('co_canh','goc','ong_kinh','chuyen_dong','chuyen_canh')}
ten2id={n['ten']:f"n{n['id']}" for n in nv}
canh=[];tu=0
for i,c in enumerate(cn,1):
    e=x[c['id']]; kt=e['kt'] or {}
    for k in vs: vs[k].add(kt.get(k))
    th=[{'ai':t['nhan_vat'],'cau':t['loi']} for t in (e['thoai'] or []) if t.get('loi')]
    nhan=re.sub(r'^\[[^\]]*\]\s*','',c['canh'] or f'Shot {i}'); nhan=re.sub(r'\s*\(.*\)$','',nhan); nhan=TEN.get(nhan,nhan)
    vt=[{'ten':v['ten'],'x':round(v['tam'][0]),'y':round(v['tam'][1]),'h':v.get('huong')} for v in (c['vt'] or [])]
    names={v['ten'] for v in vt}|{k['n'] for k in (e['kiem'] or [])}
    hop={k:[round(a,3) for a in v] for k,v in (c['hop'] or {}).items() if k in names and k!='Tàu xanh'}
    soi=[re.sub(r':.*$','',s).strip().capitalize() for s in (e['soi'] or [])]
    canh.append({'nhan':nhan,'loi':' '.join(t['cau'] for t in th),'chu':c['chu_man'] or '','anh':f'v/cn/k{i}.jpg','k3':f'v/cn/d{i}.jpg','tg':r1(c['phat_s']),'tu':round(tu,2),
      'goc':c['goc_may'] or '','co':CO.get(kt.get('co_canh'),''),'gm':GOC.get(kt.get('goc'),''),'ong':ONG.get(kt.get('ong_kinh'),''),'cd':CD.get(kt.get('chuyen_dong'),'Đứng yên'),
      'mota':c['hanh_dong_vi'] or c['hanh_dong'] or '','thoai':th,'td':c['am_thanh'] or '','cx':int(c['cam_xuc'] or 0),'pd':c['phan_doan'] or '',
      'hop':hop,'m3':{'dat':[round(v) for v in c['dat'][:2]],'nhin':[round(v) for v in c['nhin'][:2]],'vt':vt} if c['dat'] else None,
      'pb':int(c['pb']),'soi':soi,'kiem':[{'n':k['n'],'ok':bool(k['ok'])} for k in (e['kiem'] or []) if k.get('bb')],
      'nv':[f'n{n}' for n in (c['nhan_vat'] or []) if n in (1383,1384,1386,1387,1389)]})
    tu+=float(c['phat_s'])
print({k:v for k,v in vs.items()}); print([c['nhan'] for c in canh]); print(sum(1 for c in canh if c['soi']), [c['co'] for c in canh])
# mặt bằng: vật nền + khối
xs=[c['m3']['dat'][0] for c in canh]+[v['x'] for c in canh for v in c['m3']['vt'] if v['ten'] in('Chú','Nhóc')]; ys=[c['m3']['dat'][1] for c in canh]+[v['y'] for c in canh for v in c['m3']['vt'] if v['ten'] in('Chú','Nhóc')]
print('x',min(xs),max(xs),'y',min(ys),max(ys))
vat=[{'ten':v['ten'],'x':round(v['tam'][0]-v['co'][0]/2),'y':round(v['tam'][1]-v['co'][1]/2),'w':round(v['co'][0]),'h':round(v['co'][1]),'mau':v.get('mau','#888'),'nen':bool(v.get('nen'))} for v in bs['vat'] if v.get('hinh')=='hop' and v.get('tam')]
print(len(vat),[v['ten'] for v in vat])
khoi={k:{'w':v['co'][0],'h':v['co'][1],'nguoi':v['hinh']=='nguoi','mau':v.get('ao') or v.get('mau')} for k,v in bs['khoi'].items()}
print(khoi); print([ (v['ten'],v['x'],v['y']) for v in canh[0]['m3']['vt']], [ (v['ten'],v['x'],v['y']) for v in canh[21]['m3']['vt']])
VAI={'nhan_vat':'Nhân vật','dao_cu':'Đồ vật','boi_canh':'Bối cảnh'}
nvs=[{'id':f"n{n['id']}",'ten':n['ten'],'vai':VAI[n['loai']],'anh':f"v/cn/nv-{n['id']}.jpg",'mo':''} for n in sorted(nv,key=lambda n:(['nhan_vat','dao_cu','boi_canh'].index(n['loai']),n['id'])) if n['id'] in (1383,1384,1386,1387,1389,1388,1385)]
DL={'cn':{'ten':'Hai chai nước ngọt','tile':'16:9','loai':'phim','kieu':'chart-chapters','vid':'v/cn/phim.mp4','vid3':'v/cn/3d.mp4','nvs':nvs,'set':{'vat':vat,'khoi':khoi,'khung':[-420,60,640,1960]},'canh':canh}}
# YNT
yc=[];st=[float(c['phat_s']) for c in yn]+[59.9]
for i,c in enumerate(yn,1):
    m=re.search(r'năm (\d+)',c['canh'] or ''); 
    yc.append({'nhan':('Bản đồ '+m.group(1)) if m else f'Cảnh {i}','loi':c['loi_thoai'] or '','chu':c['chu_man'] or '','anh':f'v/ynt/k{i}.jpg','tg':r1(st[i]-st[i-1]),'tu':r1(st[i-1]),'cd':'Đứng yên','mota':'','pd':'','cx':0,
      'nv':[ten2id[n] for n in (c['nhan_vat'] or []) if n in ten2id]})
DL['ynt']={'ten':'The kamikaze typhoons that saved Japan','tile':'9:16','loai':'tailieu','kieu':'sky-calendar','vid':'v/ynt/phim.mp4','nvs':[{'id':'n1229','ten':'Võ sĩ samurai 1274','vai':'Nhân vật','anh':'v/ynt/nv-1229.jpg','mo':''},{'id':'n1230','ten':'Thuyền chiến Mông Cổ','vai':'Đồ vật','anh':'v/ynt/nv-1230.jpg','mo':''}],'canh':yc}
print([ (c['nhan'],c['tg'],c['chu']) for c in yc]); print(yn[2]['nhan_vat'], [c['hanh_dong'] for c in yn][:11])
js=json.dumps(DL,ensure_ascii=False,separators=(',',':')); open(RA,'w').write('const DL = '+js+';\n'); print(len(js))
# ── YNT: các LỚP của từng cảnh (lop-ynt.cjs xuất bằng bộ dựng ban-do.html) + chú thích đọc từ tệp tập
import os
tapj=json.load(open(REPO+'/apps/xuong-video/scripts/lich-su/tap/yesterdays-news-tonight-demo-weather-desk.json'))
lopj={r['i']:r['lop'] for r in json.load(open(S+'lop/lop.json'))}
TS={t['id']:t['ten'] for t in tapj.get('tai_san_moi',[])}; TS.setdefault('mongol_ship','Thuyền chiến Mông Cổ')
DANG={'chi_tay':'chỉ tay','khoanh_tay':'khoanh tay','buon':'buồn','noi_mo':'đang nói','goc':'đứng'}
THU=['to','vong','nhay','ten','duong','nhan','xe','nguoi0','nguoi1','nguoi2','tranh','dau','chu_to','ket','nam','tem','tu']
def chi(k,cg):
    if k=='to': return ('Tô nước','Mặt bằng',' · '.join(t.get('chu') or t['noi'] for t in cg['to']))
    if k=='vong': return ('Vòng khoanh','Khung','Khoanh nơi đang nói tới')
    if k=='nhay': return ('Điểm nháy','Khung','Chấm nháy tại nơi xảy ra')
    if k=='ten': return ('Mũi tên','Phải',f"{len(cg['ten'])} đường tiến quân")
    if k=='duong': return ('Đường kẻ','Kịch bản','')
    if k=='nhan': return ('Nhãn nơi chốn','Đoạn',' · '.join(n['chu'] for n in cg['nhan']))
    if k=='xe': return ('Đồ vật di chuyển','3D',' · '.join(TS.get(x['anh'],x['anh']) for x in cg['xe']))
    if k.startswith('nguoi'):
        n=cg['nguoi'][int(k[5:])]; d=(n.get('dang') or [{}])[0].get('dang','goc'); return ('Nhân vật','Nhân vật',f"{n.get('ten') or TS.get(n['anh'],n['anh'])} · {DANG.get(d,d)}")
    if k=='tranh': return ('Tranh chèn','Hình',re.sub(r'^File:|\.\w+$','',cg['tranh'].get('commons') or 'Tranh minh hoạ'))
    if k=='dau': return ('Con dấu','Soát',' · '.join(x['text'] for x in cg['dau']))
    if k=='chu_to': return ('Chữ to','Chữ',cg['chu_to'])
    if k=='ket': return ('Chữ kết','Chữ',str(cg.get('ket') or 'THE END'))
    if k=='nam': return ('Ô năm','Đoạn',str(cg['nam']))
    if k=='tem': return ('Tem series','Đoạn','Weather Desk')
    if k=='tu': return ('Phụ đề','Thoại','Chạy theo giọng đọc')
for i,c in enumerate(DL['ynt']['canh'],1):
    cg=tapj['cau'][i-1]['canh']; ls=sorted(lopj[i],key=lambda l:THU.index(l['k'])); out=[]
    for l in ls:
        try: ten,bt,ch=chi(l['k'],cg)
        except Exception as e: ten,bt,ch=({'ket':'Chữ kết'}.get(l['k'],l['k']),'Chữ','')
        out.append({'k':l['k'],'ten':ten,'bt':bt,'chi':ch,'anh':f"v/ynt/l{i}-{l['k']}.png",'hop':l['hop']})
    c['nen']=f'v/ynt/l{i}-nen.jpg'; c['lop']=out
print([ (i+1,[(l['ten'],l['chi']) for l in c['lop'] if l['k'] not in('nam','tem','tu')]) for i,c in enumerate(DL['ynt']['canh'])])
js=json.dumps(DL,ensure_ascii=False,separators=(',',':')); open(RA,'w').write('const DL = '+js+';\n'); print(len(js))
