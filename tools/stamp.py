# Give every local script and stylesheet in index.html the same fresh ?v= stamp,
# so browsers never keep an old copy after a deploy. Run before each commit.
import re,datetime,pathlib
p=pathlib.Path(__file__).resolve().parent.parent/'index.html'
v=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).strftime('%Y%m%d%H%M')
s=p.read_text(encoding='utf-8')
s=re.sub(r'(src|href)="(\./[\w.-]+\.(?:js|css))(?:\?v=[^"]*)?"',lambda m:f'{m.group(1)}="{m.group(2)}?v={v}"',s)
p.write_text(s,encoding='utf-8');print('stamped',v)
