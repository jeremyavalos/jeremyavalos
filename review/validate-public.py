"""Validate and stage the buildless public frontend without publishing."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import fnmatch, json, shutil, subprocess, re
ROOT = Path(__file__).resolve().parents[1]
OUT = Path('/tmp/portfolio-review-public')
patterns = [l.strip() for l in (ROOT/'.vercelignore').read_text().splitlines() if l.strip() and not l.startswith('#')]
files = sorted(set(subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard'], cwd=ROOT,text=True).splitlines()))
def excluded(name):
    return any(name.startswith(p) if p.endswith('/') else fnmatch.fnmatch(name,p) or (p.startswith('**/') and fnmatch.fnmatch(name,p[3:])) for p in patterns)
if OUT.exists(): shutil.rmtree(OUT)
OUT.mkdir()
for name in files:
    src=ROOT/name
    if not src.is_file() or excluded(name) or name.startswith('.') or name=='vercel.json': continue
    dest=OUT/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dest)
class HTML(HTMLParser):
    def __init__(self,text):
        super().__init__();self.links=[];self.ids=set();self.feed(text)
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a: self.ids.add(a['id'])
        for key in ['href','src']:
            if key in a: self.links.append(a[key])
html={p.relative_to(OUT).as_posix():HTML(p.read_text()) for p in OUT.glob('*.html')}
checked=0
for path in OUT.rglob('*'):
    if not path.is_file():continue
    assert not re.search(r'local[\s_-]?studio',path.name,re.I),path
    if path.suffix in ['.html','.js','.css','.svg','.json','.txt','.xml']:
        assert not re.search(r'local[\s_-]?studio|my independent studio|I created the studio',path.read_text(),re.I),path
for name,doc in html.items():
    for link in doc.links:
        u=urlsplit(link)
        if u.scheme and not (u.scheme in ['http','https'] and u.hostname in ['jeremyavalos.xyz','www.jeremyavalos.xyz']):continue
        if u.netloc and u.hostname not in ['jeremyavalos.xyz','www.jeremyavalos.xyz']:continue
        target=unquote(u.path).lstrip('/') or (name if not u.path else 'index.html')
        if u.path=='/':target='index.html'
        if not (OUT/target).is_file() and not Path(target).suffix:target+='.html'
        assert (OUT/target).is_file(),(name,link)
        if u.fragment and target in html: assert u.fragment in html[target].ids,(name,link)
        checked+=1
config=json.loads((ROOT/'vercel.json').read_text())
assert not config.get('rewrites'), 'Unknown pages must return native static 404'
assert (OUT/'404.html').is_file()
assert all((ROOT/name).read_bytes()==subprocess.check_output(['git','show','HEAD:'+name],cwd=ROOT) for name in ['script.js','fingerprint.js','returning-visitor-copy.js','cybernetic-liquid.js','certifications.js','trading-bot.js','styles.css'])
assert not subprocess.check_output(['git','diff','--name-only','HEAD','--','backend'],cwd=ROOT).strip()
result={'artifact':str(OUT),'files':len([p for p in OUT.rglob('*') if p.is_file()]),'html_pages':len(html),'local_references_checked':checked,'removed_brand_matches':0,'protected_sources_unchanged':True,'routing':'Vercel native static 404; no SPA rewrites','limit':'Staged static files; no remote Vercel build or deployment performed.'}
(ROOT/'review/public-artifact-results.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
