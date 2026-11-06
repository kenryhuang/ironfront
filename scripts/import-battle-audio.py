"""Import licensed source recordings already downloaded into artifacts/audio-research.
The generated catalog retains origin, license and category per independent file.
"""
import collections,hashlib,json,pathlib,re,shutil
ROOT=pathlib.Path(__file__).resolve().parents[1]
RESEARCH=ROOT/'artifacts/audio-research';OUT=ROOT/'src/audio/library';OUT.mkdir(parents=True,exist_ok=True)
assets=[];hashes=set()
def add(row,path=None):
 path=path or OUT/row['file']
 if not path.exists():return
 digest=hashlib.sha256(path.read_bytes()).hexdigest()
 if digest in hashes:return
 hashes.add(digest)
 if path.parent!=OUT:shutil.copyfile(path,OUT/row['file'])
 row['sha256']=digest;row['bytes']=(OUT/row['file']).stat().st_size
 row['license_url']=row['license_url'].replace('http://creativecommons.org/','https://creativecommons.org/')
 row['categories']=list(dict.fromkeys(row['categories']))
 row['language']=row.get('language','en');assets.append(row)
def meta(id,file,title,author,source,license,categories,license_url=None):
 return dict(id=id,file=file,title=title,author=author,source=source,license=license,license_url=license_url or 'https://creativecommons.org/publicdomain/zero/1.0/',categories=categories)
def classify(title):
 t=title.lower();categories=[]
 if any(x in t for x in ['death','agony','wounded','blood loss','in pain','unitlost','medic','corpsman','splat']):categories+=['death']
 if any(x in t for x in ['incoming','inbound','losing','lost','weakened','underattack','under attack','taking_fire','kicked','backup','get_down','look_out','jammed','need a weapon','no end']):categories+=['rout']
 if any(x in t for x in ['fire','shot','engag','attack','hit em','get him','get the guy','smoke em','go_go','go go','guns','locked','lock n','territory','kaboom','double tap','drop the weapon','to war']):categories+=['attack']
 if any(x in t for x in ['ready','roger','yeah','positive','clear','select','come_in','hold','perimeter','objective secured','area secured','unitready','go.','hurry_up']):categories+=['deploy']
 if re.search(r'(?:^|[. _-])die(?:$|[. _-])',t) or t.endswith('-05-scream'):categories=['death']
 if any(x in t for x in ['mission failed','you lose','getting a** kicked','incoming','jammed','need a weapon']):categories=['rout']
 if any(x in t for x in ['ammo','changing mag','reloading','for a mag']):categories=['alert']
 if 'care package inbound' in t:categories=['deploy']
 if any(x in t for x in ['whoo','good work soldier','sudden death','sniper down','enemy down','kill confirmed','kill streak','got em']):categories=['victory']
 if not categories:categories=['alert']
 if 'death' not in categories:categories+=['intro']
 return categories

for path in sorted((RESEARCH/'grunts').rglob('*.wav')):
 add(meta('grunt-'+path.stem,'grunt-'+path.name,'Male combat vocal / '+path.stem,'HaelDB','https://opengameart.org/content/male-gruntyelling-sounds','CC0-1.0',['death']),path)
for path in sorted((RESEARCH/'kenney').rglob('*.ogg')):
 if path.parent.name not in ['Male','Female']:continue
 name=path.stem
 if not(name.startswith('war_') or name in ['ready','go','hold','hurry_up','mission_completed','mission_failed','objective_achieved','you_win','you_lose']):continue
 id='kenney-'+path.parent.name.lower()+'-'+name
 cats=classify(name)
 if name in ['mission_completed','objective_achieved','you_win']:cats=['victory']
 if name in ['mission_failed','you_lose']:cats=['rout']
 add(meta(id,id+'.ogg',path.parent.name+' / '+name.replace('_',' '),'Kenney; male voice Jeffrey M. Smith; female voice Giselle','https://opengameart.org/content/voiceover-pack-40-lines','CC0-1.0',cats),path)
for row in json.loads((RESEARCH/'freesound-assets.json').read_text(encoding='utf-8')):
 if row['duration']>15:continue # Complete montages are not single callouts.
 row['categories']=classify(row['title']);row['duration']=min(row['duration'],5.5);add(row)
for row in json.loads((RESEARCH/'oga-assets.json').read_text(encoding='utf-8')):
 if row['kind']=='grenadier' and any(x in row['title'].lower() for x in ['3 2 1','mvp','deathmatch','capture the flag','payload','epic win','game over']):continue
 row['categories']=classify(row['title'])
 if any(x in row['title'].lower() for x in ['victory','you win','mission complete','area secured','mission accomplished']):row['categories']=['victory']
 add(row)
for path in sorted((RESEARCH/'rts').rglob('*.wav')):
 if '.template.' in path.name:continue
 id='rts-'+path.stem.replace('.','-');cats=['death'] if '.die' in path.name else ['attack','intro'] if '.action' in path.name else ['rout','intro'] if '.underattack' in path.name else ['deploy','intro']
 add(meta(id,id+'.wav',path.stem,'qubodup; sources by Ferdinger, John Sipos, klankbeeld','https://opengameart.org/content/sci-fi-rts-war-unit-sounds','CC0-1.0',cats),path)
for path in sorted((RESEARCH/'female').rglob('*.flac')):
 if path.parent.name!='cduckett-SoldierRadio':continue # Truck set is same performance with another effect.
 id='duckett-'+path.stem;add(meta(id,id+'.flac',path.stem,'Charlotte Duckett; edited by Iwan Gabovitch','https://opengameart.org/content/female-soldier-voice','CC-BY-3.0',classify(path.stem),'https://creativecommons.org/licenses/by/3.0/'),path)

# The opening is a battle montage, so include human injury reactions too.
for row in assets:
 if 'victory' in row['categories']:row['categories']=[c for c in row['categories'] if c!='intro']
 elif 'intro' not in row['categories']:row['categories'].append('intro')
assets.sort(key=lambda a:a['id'])
data=json.dumps(assets,ensure_ascii=False,indent=2)
(ROOT/'src/audio/battle-catalog.js').write_text('// Imported source recordings; see each entry for license and provenance.\nexport const SOUND_LIBRARY = '+data+';\n',encoding='utf-8')
(OUT/'SOURCES.json').write_text(data,encoding='utf-8')
counts=collections.Counter(c for a in assets for c in a['categories'])
report={'unique_files':len(assets),'bytes':sum(a['bytes'] for a in assets),'categories':dict(counts),'authors':dict(collections.Counter(a['author'] for a in assets))}
(RESEARCH/'library-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
if len(assets)<200:raise SystemExit('Need more than 200 independent source recordings before delivery.')
