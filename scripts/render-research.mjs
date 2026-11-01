import {readFile,writeFile} from 'node:fs/promises';
const base=new URL('../docs/research/',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('research-catalog.json',base),'utf8'));
const nodes=catalog.nodes,names={city:'城市',factory:'工厂',barracks:'兵营',fort:'要塞',port:'港口',airfield:'机场',radarStation:'雷达站',railway:'铁路节点',researchCenter:'研究所',spaceCenter:'航天中心',nuclearLaboratory:'核研究设施'};
const sourceUrls=[...new Set(nodes.flatMap(n=>n.sources))],sources=new Map(sourceUrls.map((u,i)=>[u,'R'+String(i+1).padStart(2,'0')]));
let doc=`# 军事装备与科学研究 · 42节点草案

更新：2026年11月1日。按照新的分类，原科研科技线的全部装备与军工项目迁至战术军事线，新科研线研究基础科学、材料、化工、电子、计算机、核能与航天。原条令战术树保存在 archive/，不再计入当前42项。

## 共同规则

两条树各21项、六阶段分别1／2／4／8／4／2项；前四层正常二叉展开，第五、六层两两汇合。每个汇合节点必须完成两个上层前置。同一父项下两支可分别研究。编号T为战术军事、S为科学研究；层级表示项目深度，不强制等于历史年代。树边为游戏前置而非真实技术谱系，跨国研究仍保留真实出处。

新增卫星终点将科研时代延伸到1958年，战后节点必须按真实年代标明，不写成二战已有技术。科研中的科学仪器和实验项目不自动解锁作战单位；卫星不默认具有GPS、全球成像或导弹制导功能。

所有资金、时间、设施等级、数量与增益为游戏设计。付费、进度、条件校验、设施许可与即时加成已接入战役，逐项即时效果见[live-effects.md](live-effects.md)；原目录中的飞机、军舰、核能、卫星等独立项目目前只记录许可，后续玩法待开放。设施按己方已完工且等级至少达到门槛计数；设施丢失暂停研究，恢复后继续；切换保留进度且不重复扣费。库存、人力、人口是开研检查，不因研究额外扣除。全国一个研究槽；研发成功后生产单位仍另付成本。

## 设施许可

现有四类基础设施一级无需研究。研究所I/II/III由T01/T03/T15，工厂II/III由T04/T08，城市II由T02，兵营II/III由T05/T10，要塞II/III由T11，港口I/II/III由T06/T12/T18，机场I/II/III由T07/T14/T19，雷达站I/II/III由T07/T15/T19，铁路I/II由T11/T17许可。城市III与要塞III还需工程里程碑，见结构化数据的facilityUpgradeRules。上述升级与新设施均为后续功能设计。

## 研发规模与费用

| 阶段 | 每线数量 | 默认费用 | 默认时间 |
| --- | ---: | ---: | ---: |
| I | 1 | 8,000 | 1分钟 |
| II | 2 | 20,000 | 2分钟 |
| III | 4 | 50,000 | 4分钟 |
| IV | 8 | 120,000 | 8分钟 |
| V | 4 | 300,000 | 20分钟 |
| VI | 2 | 900,000起 | 30分钟起 |

大型核能、原子弹、航天项目另设更高费用，具体以节点为准，均为待平衡的游戏数值。

`;
for(const [track,title]of [['tactics','战术军事线 · 原有装备与军工技术'],['science','科学研究线 · 基础科学至核能与航天']]){
 doc+='## '+title+'\n\n';
 for(let stage=1;stage<=6;stage++){
  const ns=nodes.filter(n=>n.track===track&&n.stage===stage);
  doc+='### 第'+stage+'阶段 · '+ns.length+'项\n\n| 编号与项目 | 国别与年代 | 历史说明与来源 | 前置 → 子项 | 设施及条件 | 费用／时间 | 游戏效果草案 |\n| --- | --- | --- | --- | --- | --- | --- |\n';
  for(const n of ns){
   const pre=[...n.parentIds,...n.additionalPrerequisites].filter(Boolean).join('＋')||'无';
   const req=[...n.requirements.map(r=>(names[r.type]||r.type)+'≥'+r.level+'级×'+r.count),...n.conditions].join('；');
   const refs=n.sources.map(u=>'['+sources.get(u)+']('+u+')').join(' ');
   doc+='| <a id="'+n.id+'"></a>**'+n.id+' '+n.name+'** | '+n.countryOrContext+'；'+n.historicalPeriod+' | '+n.historicalNote+' '+refs+' | '+pre+' → '+(n.children.join('、')||'末级')+' | '+req+' | '+n.researchCost.toLocaleString('en-US')+'／'+n.researchSeconds/60+'分 | '+n.effect.replace(/^游戏设计：/,'')+' |\n';
  }doc+='\n';
 }
}
doc+='## 数据与预览\n\n[二叉树预览](research-browser.html) · [完整JSON](research-catalog.json) · [战术军事数据](tactics-nodes.json) · [科学研究数据](science-nodes.json) · [资料索引](sources.md)。\n\n验证：`node scripts/validate-research.mjs`。原子弹节点只使用历史项目概括及游戏效果，不包含制造工艺、设计参数或操作步骤。\n';
await writeFile(new URL('README.md',base),doc);
await writeFile(new URL('sources.md',base),'# 研发资料索引\n\n来源核对历史名称、年代和原理用途；费用、设施、前置和增益为游戏设定。科研线覆盖至1958年，不能以二战时间解释战后项目。\n\n'+sourceUrls.map(u=>'- **'+sources.get(u)+'**：[原始资料／馆藏说明]('+u+')').join('\n')+'\n');
let page=await readFile(new URL('research-browser.html',base),'utf8');
const start=page.indexOf('const catalog=')+'const catalog='.length,terminator=/;\r?\n/.exec(page.slice(start)),end=terminator?start+terminator.index:-1;
if(start<14||end<start)throw new Error('Could not locate embedded catalog');
page=page.slice(0,start)+JSON.stringify(catalog).replaceAll('<','\\u003c')+page.slice(end);
page=page.replaceAll('126节点','42节点').replaceAll('科研科技线','科学研究线').replaceAll('IRONFRONT · 二战研发树','IRONFRONT · 军事与科研树').replace('两条路线 · 六阶段 · 42个历史节点 · 点击节点查看详情','军事装备与科学研究 · 六阶段 · 42节点 · 科研延伸至1958年');
await writeFile(new URL('research-browser.html',base),page);
console.log('Rendered Markdown, source index and embedded tree: '+nodes.length+' nodes, '+sourceUrls.length+' sources.');
