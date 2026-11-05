import json, glob, os, re, urllib.request, urllib.parse, html
import os; D=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # lich-su/troi-xua/
UA={'User-Agent':'astrolas-verify/1.0'}
import time
def get(u):
    for k in range(8):
        try:
            r=urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=30).read().decode(); time.sleep(1.5); return r
        except (urllib.error.URLError, TimeoutError) as e:
            if isinstance(e,urllib.error.HTTPError) and e.code!=429: raise
            time.sleep(10*(k+1))
    raise RuntimeError('rate limited '+u)
cache={}
def texts(title):
    if title in cache: return cache[title]
    # A: REST HTML, drop <sup class=reference>, <style>, then strip tags
    h=get('https://en.wikipedia.org/api/rest_v1/page/html/'+urllib.parse.quote(title,safe=''))
    h=re.sub(r'<sup[^>]*class="[^"]*(reference|noprint)[^"]*"[^>]*>.*?</sup>','',h,flags=re.S)
    h=re.sub(r'<(style|script)[^>]*>.*?</\1>','',h,flags=re.S)
    a=html.unescape(re.sub(r'<[^>]+>','',h)).replace(' ',' ')
    a=re.sub(r'\[\s*\d+\s*\]','',a); a=re.sub(r'\s+',' ',a)
    # B: plain-text extract API
    j=json.loads(get('https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles='+urllib.parse.quote(title)))
    b=''.join(p.get('extract','') for p in j['query']['pages'].values()).replace(' ',' ')
    b=re.sub(r'\s+',' ',b)
    cache[title]=(a,b); return cache[title]
tot=okn=0; bad=[]
for f in sorted(glob.glob(D+'/sc-*.json')):
    d=json.load(open(f)); sbad=0
    for m in d['moc']:
        tot+=1
        title=urllib.parse.unquote(m['nguon'].split('/wiki/')[1].split('#')[0]).replace('_',' ')
        a,b=texts(title); c=re.sub(r'\s+',' ',m['chu'])
        ia, ib = c in a, c in b
        if ia: okn+=1
        else: sbad+=1; bad.append((os.path.basename(f),title,m['chu']))
        if not ib: print('  note: not in extract API (REST ok=%s):'%ia, os.path.basename(f), m['chu'][:80])
    print(os.path.basename(f), 'PASS' if not sbad else 'FAIL %d'%sbad, len(d['moc']),'moc')
print('total',tot,'verbatim in REST HTML',okn)
for x in bad: print('BAD',x)
