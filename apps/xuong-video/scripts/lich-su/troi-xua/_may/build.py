import json, os, re, sys, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wptext import text
from stories import S
import os; OUT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # lich-su/troi-xua/
READ='05/11/2026'
cache={}
def page(t):
    if t not in cache: cache[t]=text(t)
    return cache[t]
def url(t): return 'https://en.wikipedia.org/wiki/'+urllib.parse.quote(t.replace(' ','_'),safe="()'_,")
def section(t,chu):
    tx=page(t); i=tx.find(chu)
    if i<0: return None, False
    heads=[m for m in re.finditer(r'^## (.+)$',tx[:i],re.M)]
    return (heads[-1].group(1).strip() if heads else None), True
mode=sys.argv[1] if len(sys.argv)>1 else 'check'
fails=[]; so=[]
for ma,ten,loai,skn,main,moc in S:
    out=[]; secs=[]; bad=[]
    for (t,nam,ngay,nhan,chu,noi) in moc:
        sec,ok=section(t,chu)
        if not ok: bad.append((t,chu)); continue
        if len(chu)>160: bad.append((t,'TOO LONG '+str(len(chu))+': '+chu))
        if t==main and sec and sec not in secs: secs.append(sec)
        m={'nam':nam,'ngay':ngay,'nhan':nhan,'chu':chu}
        if noi: m['noi']=noi
        m['nguon']=url(t)+('#'+sec.replace(' ','_') if sec else '')
        out.append(m)
    if bad: fails.append((ma,bad))
    # time order check
    keys=[m['ngay'] for m in out]
    sec_txt=', '.join(secs) if secs else 'phần mở đầu'
    others=sorted({x[0] for x in moc if x[0]!=main})
    ng=f"{url(main)} (mục {sec_txt}, đọc {READ})"
    if others: ng+='; '+'; '.join(f"{url(o)} (đọc {READ})" for o in others)
    d={'ma':ma,'ten':ten,'loai':loai,'su_kien_ngay':skn,'nguon':ng,'moc':out}
    tep=ma+'.json'
    if mode=='write' and not bad:
        open(os.path.join(OUT,tep),'w').write(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
        so.append({'ma':ma,'ten':ten,'loai':loai,'su_kien_ngay':skn,'tep':tep})
    print(ma, len(out), 'moc', 'BAD' if bad else 'ok', '|', ' '.join(keys))
for ma,b in fails:
    print('FAIL',ma); [print('   ',x) for x in b]
if mode=='write':
    open(os.path.join(OUT,'_so.json'),'w').write(json.dumps({'_ghi':'Thư viện chuyện trời xưa cho Sky Calendar — mỗi câu nguyên văn Wikipedia','chuyen':so},ensure_ascii=False,indent=2)+'\n')
    print('wrote',len(so))
