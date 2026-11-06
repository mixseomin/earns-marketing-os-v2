import sys, re, json, urllib.request, urllib.parse
from html.parser import HTMLParser
SKIP={'style','script','sup','table'}
class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.out=[]; s.skip=0; s.stack=[]
    def handle_starttag(s,t,a):
        a=dict(a); cls=a.get('class') or ''
        sk = (t=='sup' and ('reference' in cls or 'noprint' in cls)) or t in ('style','script') or ('mw-ref' in cls and t=='sup')
        if t in ('p','li','h2','h3','h4','div','br','tr','figcaption','dd','dt'): s.out.append('\n')
        if t in ('h2','h3','h4') and not s.skip: s.out.append('## ')
        s.stack.append((t,sk))
        if sk: s.skip+=1
    def handle_endtag(s,t):
        while s.stack:
            tt,sk=s.stack.pop()
            if sk: s.skip-=1
            if tt==t: break
        if t in ('p','li','h2','h3','h4'): s.out.append('\n')
    def handle_data(s,d):
        if not s.skip: s.out.append(d)
def text(title):
    url='https://en.wikipedia.org/api/rest_v1/page/html/'+urllib.parse.quote(title.replace(' ','_'),safe='')
    req=urllib.request.Request(url,headers={'User-Agent':'astrolas-verify/1.0 (admin@example.org)'})
    import time
    for k in range(8):
        try:
            h=urllib.request.urlopen(req,timeout=30).read().decode(); time.sleep(1.5); break
        except urllib.error.HTTPError as e:
            if e.code!=429: raise
            time.sleep(10*(k+1))
    p=P(); p.feed(h); t=''.join(p.out)
    t=re.sub(r'\[\s*\d+\s*\]','',t)
    t=t.replace(' ',' ')
    t=re.sub(r'[ \t]+',' ',t); t=re.sub(r'\n\s*\n+','\n',t)
    return t
if __name__=='__main__':
    for ti in sys.argv[1:]:
        fn='wp/'+re.sub(r'[^A-Za-z0-9]+','_',ti)+'.txt'
        try:
            open(fn,'w').write(text(ti)); print('ok',ti,fn)
        except Exception as e: print('ERR',ti,e)
