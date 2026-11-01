# 军事装备与科学研究 · 42节点草案

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

## 战术军事线 · 原有装备与军工技术

### 第1阶段 · 1项

| 编号与项目 | 国别与年代 | 历史说明与来源 | 前置 → 子项 | 设施及条件 | 费用／时间 | 游戏效果草案 |
| --- | --- | --- | --- | --- | --- | --- |
| <a id="T01"></a>**T01 战间期军用工业基础** | 多国；1920—1930年代，基础领域 | 标准化生产支撑战时扩军。 [R01](https://home.nps.gov/articles/liberty-ships-and-victory-ships-america-s-lifeline-in-war-teaching-with-historic-places.htm) [R02](https://www.nps.gov/spar/learn/historyculture/john-c-garand.htm) | 无 → T02、T03 | 城市≥1级×1 | 8,000／1分 | 解锁战术军事树、研究所Ⅰ级；工厂生产资金消耗−5%。 |

### 第2阶段 · 2项

| 编号与项目 | 国别与年代 | 历史说明与来源 | 前置 → 子项 | 设施及条件 | 费用／时间 | 游戏效果草案 |
| --- | --- | --- | --- | --- | --- | --- |
| <a id="T02"></a>**T02 车辆与兵器工程** | 多国；1930年代，基础领域 | 装甲车辆和步兵兵器并行发展。 [R03](https://daspanzermuseum.de/en/large-exhibits/) [R02](https://www.nps.gov/spar/learn/historyculture/john-c-garand.htm) | T01 → T04、T05 | 工厂≥1级×1 | 20,000／2分 | 解锁地面装备研究及城市Ⅱ／Ⅲ级升级许可；Ⅲ级另需工程里程碑。 |
| <a id="T03"></a>**T03 舰船航空与无线电工程** | 多国；1930年代，基础领域 | 舰船航空与电子技术在战间期发展。 [R04](https://www.history.navy.mil/research/histories/ship-histories/danfs/e/essex-iv.html) [R05](https://www.history.navy.mil/research/library/online-reading-room/title-list-alphabetically/u/operational-characteristics-of-radar-classified-by-tactical-application.html) | T01 → T06、T07 | 工厂≥1级×1 | 20,000／2分 | 解锁海空电子分支、研究所Ⅱ级升级许可。 |

### 第3阶段 · 4项

| 编号与项目 | 国别与年代 | 历史说明与来源 | 前置 → 子项 | 设施及条件 | 费用／时间 | 游戏效果草案 |
| --- | --- | --- | --- | --- | --- | --- |
| <a id="T04"></a>**T04 装甲车辆制造** | 多国；1930年代，基础领域 | 装甲车体与动力制造构成坦克工业基础。 [R03](https://daspanzermuseum.de/en/large-exhibits/) | T02 → T08、T09 | 工厂≥1级×2 | 50,000／4分 | 解锁工厂Ⅱ级升级许可及装甲生产类别。 |
| <a id="T05"></a>**T05 步兵兵器与弹药制造** | 多国；1930年代，基础领域 | 制式枪械与配套弹药需批量制造。 [R02](https://www.nps.gov/spar/learn/historyculture/john-c-garand.htm) | T02 → T10、T11 | 工厂≥1级×2 | 50,000／4分 | 解锁兵营Ⅱ级升级许可；装备产量+5%。 |
| <a id="T06"></a>**T06 海军造船工程** | 多国；1930年代，基础领域 | 港口造船支撑水面舰艇与潜艇。 [R04](https://www.history.navy.mil/research/histories/ship-histories/danfs/e/essex-iv.html) [R06](https://www.history.navy.mil/research/histories/ship-histories/danfs/l/lst-1.html) | T03 → T12、T13 | 工厂≥1级×2 | 50,000／4分 | 解锁港口Ⅰ级、基础运兵船和自动商船；届时登陆改为需要港口。 |
| <a id="T07"></a>**T07 航空制造与无线电探测** | 多国；1930年代，基础领域 | 飞机制造与无线电探测成为空战基础。 [R05](https://www.history.navy.mil/research/library/online-reading-room/title-list-alphabetically/u/operational-characteristics-of-radar-classified-by-tactical-application.html) [R07](https://www.nationalmuseum.af.mil/Visit/Museum-Exhibits/Fact-Sheets/Display/Article/196263/north-american-p-51d-mustang/) | T03 → T14、T15 | 工厂≥1级×2 | 50,000／4分 | 解锁机场Ⅰ级、基础侦察与雷达站Ⅰ级。 |

### 第4阶段 · 8项

| 编号与项目 | 国别与年代 | 历史说明与来源 | 前置 → 子项 | 设施及条件 | 费用／时间 | 游戏效果草案 |
| --- | --- | --- | --- | --- | --- | --- |
| <a id="T08"></a>**T08 中型坦克生产工艺** | 多国；1930年代—1940年代初，技术类别 | 中型坦克兼顾机动与生产规模。 [R08](https://tankmuseum.org/tank-nuts/tank-collection/m4-sherman/) [R09](https://tankmuseum.org/tank-nuts/tank-collection/t-34-85) | T04 → T16 | 工厂≥2级×3 | 120,000／8分 | 解锁中型坦克研究项目与工厂Ⅲ级升级许可。 |
| <a id="T09"></a>**T09 重型装甲与无炮塔战车** | 苏联、德国等；1930年代末—1940年代，技术类别 | 重型坦克与突击炮是不同装备路线。 [R10](https://ar.culture.ru/en/subject/tank-kv-1) [R11](https://tankmuseum.org/tank-nuts/tank-collection/stug-iii) | T04 → T16 | 工厂≥2级×3 | 120,000／8分 | 解锁重装甲及突击炮研究类别。 |
| <a id="T10"></a>**T10 自动装填与机枪制造** | 美国、德国等；1930年代，技术类别 | 半自动步枪和机枪采用不同设计。 [R02](https://www.nps.gov/spar/learn/historyculture/john-c-garand.htm) [R12](https://norfolktankmuseum.co.uk/mg-42/) | T05＋T04 → T17 | 工厂≥2级×3 | 120,000／8分 | 解锁步兵装备改进、兵营Ⅲ级升级许可。 |
| <a id="T11"></a>**T11 火炮弹药与重装运输** | 多国；1930年代，技术类别 | 火炮、弹药和铁路运输支撑重火力。 [R13](https://goordnance.army.mil/history/historicalCollectionHighlights.html) [R14](https://www.awm.gov.au/collection/C239057) | T05＋T04 → T17 | 工厂≥2级×3 | 120,000／8分 | 解锁铁路Ⅰ级、要塞Ⅱ／Ⅲ级升级许可与炮兵研究；Ⅲ级要塞另需工程里程碑。 |
| <a id="T12"></a>**T12 水面舰艇与船体工程** | 多国；1930年代，技术类别 | 航母与运输船采用不同船体需求。 [R04](https://www.history.navy.mil/research/histories/ship-histories/danfs/e/essex-iv.html) [R06](https://www.history.navy.mil/research/histories/ship-histories/danfs/l/lst-1.html) | T06＋T04 → T18 | 工厂≥2级×3；港口≥1级×1 | 120,000／8分 | 解锁港口Ⅱ级升级许可、水面舰船研究类别。 |
| <a id="T13"></a>**T13 潜艇与反潜探测工程** | 多国；1930年代—二战，技术类别 | 潜艇发展推动护航与探测技术。 [R15](https://www.bremerhaven.de/en/tourism/museums-adventure-worlds/submarine-wilhelm-bauer.21815.html) [R16](https://www.history.navy.mil/content/history/museums/nmusn/explore/photography/wwii/wwii-atlantic/battle-of-the-atlantic/anti-submarine-warfare/hedgehog.html) | T06＋T04 → T18 | 工厂≥2级×3；港口≥1级×1 | 120,000／8分 | 解锁潜艇和反潜装备研究类别。 |
| <a id="T14"></a>**T14 航空动力与机体工程** | 多国；1930年代，技术类别 | 活塞与喷气动力是不同航空技术路线。 [R07](https://www.nationalmuseum.af.mil/Visit/Museum-Exhibits/Fact-Sheets/Display/Article/196263/north-american-p-51d-mustang/) [R17](https://www.history.navy.mil/content/history/museums/nnam/explore/collections/aircraft/m/me-262.html) | T07＋T04 → T19 | 工厂≥2级×3；机场≥1级×1 | 120,000／8分 | 解锁机场Ⅱ级升级许可和先进飞机研究类别。 |
| <a id="T15"></a>**T15 无线电测向与电子工程** | 英国、美国等；1930年代—二战，技术类别 | 无线电测向和雷达服务侦察与火控。 [R05](https://www.history.navy.mil/research/library/online-reading-room/title-list-alphabetically/u/operational-characteristics-of-radar-classified-by-tactical-application.html) [R18](https://www.history.navy.mil/research/histories/ship-histories/danfs/g/guadalcanal-i.html) | T07＋T04 → T19 | 工厂≥2级×3；雷达站≥1级×1 | 120,000／8分 | 解锁研究所Ⅲ级升级许可及电子设备研究类别。 |

### 第5阶段 · 4项

| 编号与项目 | 国别与年代 | 历史说明与来源 | 前置 → 子项 | 设施及条件 | 费用／时间 | 游戏效果草案 |
| --- | --- | --- | --- | --- | --- | --- |
| <a id="T16"></a>**T16 装甲与自行火炮工程** | 多国历史技术综合研究；1940年起生产，二战服役；1942年投入作战；1939—1940年起，二战服役；1940年起，二战服役 | 汇集T-34/76中型坦克、M4“谢尔曼”中型坦克、KV-1重型坦克等已有历史项目；不是同名的单一历史发明。 [R09](https://tankmuseum.org/tank-nuts/tank-collection/t-34-85) [R08](https://tankmuseum.org/tank-nuts/tank-collection/m4-sherman/) [R10](https://ar.culture.ru/en/subject/tank-kv-1) [R11](https://tankmuseum.org/tank-nuts/tank-collection/stug-iii) | T08＋T09 → T20 | 工厂≥2级×4 | 300,000／20分 | 汇合中型坦克、重型装甲和突击炮项目，为机械化陆军提供装备基础。 |
| <a id="T17"></a>**T17 步兵装备与炮兵工程** | 多国历史技术综合研究；1930年代—二战，技术类别；1930年代—1940年代，技术类别 | 汇集半自动步枪与通用机枪工艺、冲锋枪与中间威力弹研究、反坦克炮与穿甲弹等已有历史项目；不是同名的单一历史发明。 [R02](https://www.nps.gov/spar/learn/historyculture/john-c-garand.htm) [R12](https://norfolktankmuseum.co.uk/mg-42/) [R19](https://muzeumwp.pl/mwpedia/karabin-automatyczny-sturmgewehr-44/) [R20](https://paradata.org.uk/content/4663761) [R14](https://www.awm.gov.au/collection/C239057) [R13](https://goordnance.army.mil/history/historicalCollectionHighlights.html) [R21](https://www.nationalmuseum.af.mil/Visit/Museum-Exhibits/Fact-Sheets/Display/Article/196684/AFmuseum/flying-bomb-and-rocket-development/) | T10＋T11 → T20 | 工厂≥2级×4；兵营≥2级×1 | 300,000／20分 | 汇合制式枪械、反坦克炮、火箭炮和铁路重炮研究；解锁铁路Ⅱ级。 |
| <a id="T18"></a>**T18 舰船与海运工程** | 多国历史技术综合研究；1930年代—二战，技术类别；1940—1941年起，战时量产 | 汇集舰载航空与航母工程、标准船型与焊接造船、柴电潜艇与水下航行等已有历史项目；不是同名的单一历史发明。 [R04](https://www.history.navy.mil/research/histories/ship-histories/danfs/e/essex-iv.html) [R22](https://collection.nam.ac.uk/detail.php?acc=2003-03-622-1) [R01](https://home.nps.gov/articles/liberty-ships-and-victory-ships-america-s-lifeline-in-war-teaching-with-historic-places.htm) [R06](https://www.history.navy.mil/research/histories/ship-histories/danfs/l/lst-1.html) [R15](https://www.bremerhaven.de/en/tourism/museums-adventure-worlds/submarine-wilhelm-bauer.21815.html) [R16](https://www.history.navy.mil/content/history/museums/nmusn/explore/photography/wwii/wwii-atlantic/battle-of-the-atlantic/anti-submarine-warfare/hedgehog.html) [R18](https://www.history.navy.mil/research/histories/ship-histories/danfs/g/guadalcanal-i.html) | T12＋T13 → T21 | 工厂≥2级×4；港口≥2级×1 | 300,000／20分 | 汇合水面舰船、商运、潜艇和反潜技术；解锁港口Ⅲ级升级许可。 |
| <a id="T19"></a>**T19 航空与电子工程** | 多国历史技术综合研究；1930年代末—1944年，技术类别；1930年代—1940年代，技术类别；1940—1944年，战时技术；1930年代—1944年，研发与服役 | 汇集高性能战斗机工程、四发动机重型轰炸机工程、厘米波雷达工程等已有历史项目；不是同名的单一历史发明。 [R07](https://www.nationalmuseum.af.mil/Visit/Museum-Exhibits/Fact-Sheets/Display/Article/196263/north-american-p-51d-mustang/) [R17](https://www.history.navy.mil/content/history/museums/nnam/explore/collections/aircraft/m/me-262.html) [R23](https://airandspace.si.edu/collection-objects/boeing-b-29-superfortress-enola-gay/nasm_A19500100000) [R24](https://www.rafmuseum.org.uk/blog/the-lancaster-enters-the-fray/) [R05](https://www.history.navy.mil/research/library/online-reading-room/title-list-alphabetically/u/operational-characteristics-of-radar-classified-by-tactical-application.html) [R25](https://collection.sciencemuseumgroup.org.uk/objects/co35145/h2s-mk-iic-airborne-ground-scanning-radar-installation-c-1943) [R26](https://collection.sciencemuseumgroup.org.uk/objects/co34430/original-cavity-magnetron) [R21](https://www.nationalmuseum.af.mil/Visit/Museum-Exhibits/Fact-Sheets/Display/Article/196684/AFmuseum/flying-bomb-and-rocket-development/) [R27](https://www.rafmuseum.org.uk/research/collections/german-army-v2-assembly-4/) | T14＋T15 → T21 | 工厂≥2级×4；机场≥2级×1；雷达站≥2级×1 | 300,000／20分 | 汇合航空动力、重轰炸机、雷达与火箭工程；解锁机场Ⅲ级、雷达站Ⅲ级升级许可。 |

### 第6阶段 · 2项

| 编号与项目 | 国别与年代 | 历史说明与来源 | 前置 → 子项 | 设施及条件 | 费用／时间 | 游戏效果草案 |
| --- | --- | --- | --- | --- | --- | --- |
| <a id="T20"></a>**T20 机械化陆军体系** | 多国历史技术综合研究；1944年起量产并服役；1944年起生产，战争末期服役；1944年末—1945年，战时使用；1944年投入作战；1943年末—1944年，生产服役；1942年末起生产，二战服役；1936年定型，二战大规模装备；1942年起，二战服役；1941年起，二战服役；1943年先行型号、1944年名称，战时服役；1943年投入战场；1941—1942年起，二战服役；1941年投入作战；1930年代制造、1944年安齐奥使用 | 汇集T-34/85中型坦克、SU-100坦克歼击车、M4A3E8“谢尔曼”等已有历史项目；不是同名的单一历史发明。 [R09](https://tankmuseum.org/tank-nuts/tank-collection/t-34-85) [R03](https://daspanzermuseum.de/en/large-exhibits/) [R28](https://tankmuseum.org/article/make-tracks-with-ww2-inspired-trainers) [R08](https://tankmuseum.org/tank-nuts/tank-collection/m4-sherman/) [R29](https://www.panssarimuseo.fi/en/visit/node/is-2-has-arrived-at-the-parola-armour-museum) [R11](https://tankmuseum.org/tank-nuts/tank-collection/stug-iii) [R02](https://www.nps.gov/spar/learn/historyculture/john-c-garand.htm) [R12](https://norfolktankmuseum.co.uk/mg-42/) [R30](https://www.awm.gov.au/collection/C1203998) [R19](https://muzeumwp.pl/mwpedia/karabin-automatyczny-sturmgewehr-44/) [R20](https://paradata.org.uk/content/4663761) [R14](https://www.awm.gov.au/collection/C239057) [R31](https://ar.culture.ru/en/subject/boevaya-mashina-reaktivnoy-artillerii-bm-13) [R13](https://goordnance.army.mil/history/historicalCollectionHighlights.html) | T16＋T17 → 末级 | 工厂≥2级×6；兵营≥3级×1 | 900,000／30分 | 解锁T-34/85、M4改进型、IS-2、自行火炮、改进步兵装备及K5铁路炮等终期陆战生产项目；生产仍另付成本。 |
| <a id="T21"></a>**T21 远洋海空与远程打击** | 多国历史技术综合研究；1942年底首舰服役、1943年投入作战；1940年起服役；1941年起量产；1942年起服役；1943年起服役，U 995为保存实例；1944—1945年建造；战末有限出航；1942年起使用；二战，1941—1943年扩大运用；1944年大量投入欧洲战场；1944年投入作战；1942年首飞、1944年投入作战；1942年首次作战；1944年前后投入作战；1941—1942年研制、1943年使用；1944年首次作战发射 | 汇集“埃塞克斯”级航空母舰、“光辉”级航空母舰、“自由轮”标准货船等已有历史项目；不是同名的单一历史发明。 [R04](https://www.history.navy.mil/research/histories/ship-histories/danfs/e/essex-iv.html) [R22](https://collection.nam.ac.uk/detail.php?acc=2003-03-622-1) [R01](https://home.nps.gov/articles/liberty-ships-and-victory-ships-america-s-lifeline-in-war-teaching-with-historic-places.htm) [R06](https://www.history.navy.mil/research/histories/ship-histories/danfs/l/lst-1.html) [R32](https://deutscher-marinebund.de/marine-ehrenmal-u-995/technisches-museum-u-995/) [R15](https://www.bremerhaven.de/en/tourism/museums-adventure-worlds/submarine-wilhelm-bauer.21815.html) [R16](https://www.history.navy.mil/content/history/museums/nmusn/explore/photography/wwii/wwii-atlantic/battle-of-the-atlantic/anti-submarine-warfare/hedgehog.html) [R18](https://www.history.navy.mil/research/histories/ship-histories/danfs/g/guadalcanal-i.html) [R07](https://www.nationalmuseum.af.mil/Visit/Museum-Exhibits/Fact-Sheets/Display/Article/196263/north-american-p-51d-mustang/) [R17](https://www.history.navy.mil/content/history/museums/nnam/explore/collections/aircraft/m/me-262.html) [R23](https://airandspace.si.edu/collection-objects/boeing-b-29-superfortress-enola-gay/nasm_A19500100000) [R33](https://www.nationalmuseum.af.mil/Visit/Museum-Exhibits/Fact-Sheets/Display/Article/196652/development-of-the-boeing-b-29/) [R24](https://www.rafmuseum.org.uk/blog/the-lancaster-enters-the-fray/) [R05](https://www.history.navy.mil/research/library/online-reading-room/title-list-alphabetically/u/operational-characteristics-of-radar-classified-by-tactical-application.html) [R25](https://collection.sciencemuseumgroup.org.uk/objects/co35145/h2s-mk-iic-airborne-ground-scanning-radar-installation-c-1943) [R21](https://www.nationalmuseum.af.mil/Visit/Museum-Exhibits/Fact-Sheets/Display/Article/196684/AFmuseum/flying-bomb-and-rocket-development/) [R27](https://www.rafmuseum.org.uk/research/collections/german-army-v2-assembly-4/) | T18＋T19 → 末级 | 工厂≥2级×6；港口≥2级×1；机场≥2级×1；研究所≥2级×1 | 1,200,000／40分 | 解锁舰队航母、先进潜艇、P-51D、Me 262、B-29和V系列等海空远程项目；B-29仍要求至少Ⅱ级机场；各单位生产单独付费。 |

## 科学研究线 · 基础科学至核能与航天

### 第1阶段 · 1项

| 编号与项目 | 国别与年代 | 历史说明与来源 | 前置 → 子项 | 设施及条件 | 费用／时间 | 游戏效果草案 |
| --- | --- | --- | --- | --- | --- | --- |
| <a id="S01"></a>**S01 实验科学与现代研究体系** | 多国，跨国科学史草案；20世纪前半叶为基础，研究内容延伸至1958年 | 大型科学项目结合实验、工程与机构协作。 [R34](https://www.nps.gov/mapr/learn/manhattan-project.htm) [R35](https://www.computerhistory.org/timeline/computers/) | 无 → S02、S03 | 城市≥1级×1 | 8,000／1分 | 解锁纯科研树；基础研究速度提高3%。 |

### 第2阶段 · 2项

| 编号与项目 | 国别与年代 | 历史说明与来源 | 前置 → 子项 | 设施及条件 | 费用／时间 | 游戏效果草案 |
| --- | --- | --- | --- | --- | --- | --- |
| <a id="S02"></a>**S02 物质科学与化学基础** | 多国；1900—1940年代，研究领域 | 物质结构、材料和化学构成不同研究方向。 [R36](https://ndaarchives.gov.uk/history/1930s/) [R37](https://www.acs.org/education/whatischemistry/landmarks/carotherspolymers.html) [R38](https://www.acs.org/education/whatischemistry/landmarks/flemingpenicillin.html) | S01 → S04、S05 | 研究所≥1级×1 | 20,000／2分 | 解锁物理材料和化学生命两个研究方向。 |
| <a id="S03"></a>**S03 信息科学与飞行研究** | 多国；1920—1958年，研究领域 | 电子计算与航空宇航在此时期发展。 [R35](https://www.computerhistory.org/timeline/computers/) [R39](https://www.nasa.gov/history/the-national-advisory-committee-for-aeronautics-naca/) [R40](https://www.nasa.gov/history/sputnik/sputorig.html) | S01 → S06、S07 | 研究所≥1级×1 | 20,000／2分 | 解锁电子计算和航空宇航两个研究方向。 |

### 第3阶段 · 4项

| 编号与项目 | 国别与年代 | 历史说明与来源 | 前置 → 子项 | 设施及条件 | 费用／时间 | 游戏效果草案 |
| --- | --- | --- | --- | --- | --- | --- |
| <a id="S04"></a>**S04 物理与材料研究** | 多国；20世纪前半叶，基础领域 | 核物理与工程材料分别取得进展。 [R36](https://ndaarchives.gov.uk/history/1930s/) [R41](https://blog.sciencemuseum.org.uk/100-years-of-stainless-steel/) | S02 → S08、S09 | 研究所≥1级×1 | 50,000／4分 | 开启物理实验和新材料课题；研究失败返工损失减少3%。 |
| <a id="S05"></a>**S05 化学与生命科学** | 多国；1910—1940年代，基础领域 | 工业化学和生物化学形成不同应用。 [R42](https://www.basf.com/global/en/who-we-are/history/chronology) [R38](https://www.acs.org/education/whatischemistry/landmarks/flemingpenicillin.html) | S02 → S10、S11 | 研究所≥1级×1 | 50,000／4分 | 开启化学和生命研究；城市科研人员恢复效率提高3%。 |
| <a id="S06"></a>**S06 电子学与计算科学** | 英美等；1930—1950年代，基础领域 | 电子器件与数字计算逐步发展。 [R43](https://www.computerhistory.org/siliconengine/invention-of-the-point-contact-transistor/) [R35](https://www.computerhistory.org/timeline/computers/) | S03 → S12、S13 | 研究所≥1级×1 | 50,000／4分 | 开启电子和计算课题；研究数据整理时间减少3%。 |
| <a id="S07"></a>**S07 航空与宇航科学** | 多国；1920—1958年，基础领域 | 航空实验与火箭研究先于人造卫星。 [R39](https://www.nasa.gov/history/the-national-advisory-committee-for-aeronautics-naca/) [R44](https://www.nasa.gov/history/95-years-ago-goddards-first-liquid-fueled-rocket/) [R45](https://www.nasa.gov/history/story-of-explorer-1/) | S03 → S14、S15 | 研究所≥1级×1 | 50,000／4分 | 开启航空和宇航课题；实验项目组织成本减少3%。 |

### 第4阶段 · 8项

| 编号与项目 | 国别与年代 | 历史说明与来源 | 前置 → 子项 | 设施及条件 | 费用／时间 | 游戏效果草案 |
| --- | --- | --- | --- | --- | --- | --- |
| <a id="S08"></a>**S08 原子物理与核科学** | 英国、德国、美国等；1930—1940年代，研究领域 | 中子与裂变研究推动核科学。 [R36](https://ndaarchives.gov.uk/history/1930s/) [R46](https://www.ne.anl.gov/About/reactors/early-reactors.shtml) | S04 → S16 | 研究所≥2级×1；工厂≥2级×2 | 120,000／8分 | 解锁原子结构和核能历史项目。 |
| <a id="S09"></a>**S09 冶金与高分子材料** | 多国；1900—1940年代，研究领域 | 金属合金与合成聚合物分别发展。 [R41](https://blog.sciencemuseum.org.uk/100-years-of-stainless-steel/) [R37](https://www.acs.org/education/whatischemistry/landmarks/carotherspolymers.html) | S04 → S16 | 研究所≥2级×1；工厂≥2级×2 | 120,000／8分 | 解锁合金和聚合物项目；工业维护资金消耗减少3%。 |
| <a id="S10"></a>**S10 微生物与工业化学** | 英美、德国等；1910—1940年代，研究领域 | 微生物研究和催化工艺具有不同应用。 [R38](https://www.acs.org/education/whatischemistry/landmarks/flemingpenicillin.html) [R42](https://www.basf.com/global/en/who-we-are/history/chronology) | S05 → S17 | 研究所≥2级×1；工厂≥2级×2 | 120,000／8分 | 解锁抗生素与催化化工课题。 |
| <a id="S11"></a>**S11 实验分析与生物化学** | 多国；1920—1940年代，研究领域 | 测量仪器和生物化学研究支持实验。 [R47](https://www.acs.org/education/whatischemistry/landmarks/beckman.html) [R48](https://www.acs.org/education/whatischemistry/landmarks/insulin.html) | S05 → S17 | 研究所≥2级×1；工厂≥2级×2 | 120,000／8分 | 解锁分析仪器及生化研究；科研质量检查耗时减少3%。 |
| <a id="S12"></a>**S12 固态电子与微波研究** | 英美等；1930—1950年代，研究领域 | 半导体器件与微波器件沿不同路线发展。 [R43](https://www.computerhistory.org/siliconengine/invention-of-the-point-contact-transistor/) [R26](https://collection.sciencemuseumgroup.org.uk/objects/co34430/original-cavity-magnetron) | S06 → S18 | 研究所≥2级×1；工厂≥2级×2 | 120,000／8分 | 解锁固态器件和微波实验；电子科研成本减少3%。 |
| <a id="S13"></a>**S13 数字计算与信息存储** | 英美等；1940—1950年代，研究领域 | 电子数字计算机需要运算与存储技术。 [R35](https://www.computerhistory.org/timeline/computers/) [R49](https://www.computerhistory.org/storageengine/timeline/) | S06 → S18 | 研究所≥2级×1；工厂≥2级×2 | 120,000／8分 | 解锁计算机与存储课题；复杂研究数据处理效率提高3%。 |
| <a id="S14"></a>**S14 空气动力与推进实验** | 多国；1930—1950年代，研究领域 | 风洞和发动机实验用于理解飞行性能。 [R50](https://www.nasa.gov/altitude-wind-tunnel/) [R39](https://www.nasa.gov/history/the-national-advisory-committee-for-aeronautics-naca/) | S07 → S19 | 研究所≥2级×1；工厂≥2级×2 | 120,000／8分 | 解锁气动和喷气推进研究；航空实验返工成本减少3%。 |
| <a id="S15"></a>**S15 火箭与空间科学** | 美国、苏联及国际合作；1920—1958年，研究领域 | 火箭实验最终使早期卫星入轨。 [R44](https://www.nasa.gov/history/95-years-ago-goddards-first-liquid-fueled-rocket/) [R40](https://www.nasa.gov/history/sputnik/sputorig.html) [R45](https://www.nasa.gov/history/story-of-explorer-1/) | S07 → S19 | 研究所≥2级×1；工厂≥2级×2 | 120,000／8分 | 解锁火箭科学与早期卫星课题；明确进入战后延伸研究。 |

### 第5阶段 · 4项

| 编号与项目 | 国别与年代 | 历史说明与来源 | 前置 → 子项 | 设施及条件 | 费用／时间 | 游戏效果草案 |
| --- | --- | --- | --- | --- | --- | --- |
| <a id="S16"></a>**S16 核物理与先进材料** | 多国历史技术综合研究；1932—1939年，研究领域；1942—1945年，研究领域；20世纪前半叶，研究领域；1920—1930年代，研究领域 | 汇集原子核结构实验、受控核反应与大型科学项目、工程合金与材料性能等已有历史项目；不是同名的单一历史发明。 [R36](https://ndaarchives.gov.uk/history/1930s/) [R46](https://www.ne.anl.gov/About/reactors/early-reactors.shtml) [R34](https://www.nps.gov/mapr/learn/manhattan-project.htm) [R41](https://blog.sciencemuseum.org.uk/100-years-of-stainless-steel/) [R51](https://data.fitzmuseum.cam.ac.uk/id/terminology/term-39714) [R37](https://www.acs.org/education/whatischemistry/landmarks/carotherspolymers.html) [R52](https://pubs.acs.org/doi/10.1021/bk-2011-1080.ch009) | S08＋S09 → S20 | 研究所≥3级×1；工厂≥2级×3 | 300,000／20分 | 汇合原子核、核能研究、冶金与材料基础，解锁终期核能项目研究。 |
| <a id="S17"></a>**S17 工业化学与生命科学** | 多国历史技术综合研究；1928—1940年代，研究领域；1910—1930年代，研究领域；1930—1940年代，研究领域；1920—1930年代，研究领域 | 汇集抗生素发现与药物研究、工业催化研究、实验测量与工艺放大等已有历史项目；不是同名的单一历史发明。 [R38](https://www.acs.org/education/whatischemistry/landmarks/flemingpenicillin.html) [R53](https://www.acs.org/education/whatischemistry/landmarks/selmanwaksman.html) [R42](https://www.basf.com/global/en/who-we-are/history/chronology) [R54](https://www.acs.org/education/whatischemistry/landmarks/houdry.html) [R47](https://www.acs.org/education/whatischemistry/landmarks/beckman.html) [R55](https://www.acs.org/content/dam/acsorg/education/whatischemistry/landmarks/penicillin/development-of-deep-tank-fermentation-commemorative-booklet.pdf) [R56](https://www.acs.org/education/whatischemistry/landmarks/medical.html) [R48](https://www.acs.org/education/whatischemistry/landmarks/insulin.html) | S10＋S11 → S20 | 研究所≥2级×1；工厂≥2级×3 | 300,000／20分 | 汇合工业化学、实验测量与医药研究；提升人口恢复和工业资源利用效率。 |
| <a id="S18"></a>**S18 电子计算与自动控制** | 多国历史技术综合研究；1947—1948年，战后；1940—1945年，研究领域；1943—1949年，研究领域；1946—1950年代，战后 | 汇集半导体放大器研究、微波发生与回波测量、电子数字计算项目等已有历史项目；不是同名的单一历史发明。 [R43](https://www.computerhistory.org/siliconengine/invention-of-the-point-contact-transistor/) [R57](https://www.computerhistory.org/siliconengine/conception-of-the-junction-transistor/) [R26](https://collection.sciencemuseumgroup.org.uk/objects/co34430/original-cavity-magnetron) [R05](https://www.history.navy.mil/research/library/online-reading-room/title-list-alphabetically/u/operational-characteristics-of-radar-classified-by-tactical-application.html) [R35](https://www.computerhistory.org/timeline/computers/) [R49](https://www.computerhistory.org/storageengine/timeline/) | S12＋S13 → S21 | 研究所≥3级×1；工厂≥2级×3 | 300,000／20分 | 汇合半导体、微波、电子计算与存储研究，为科学观测和航天控制提供基础。 |
| <a id="S19"></a>**S19 航天推进与空间观测** | 多国历史技术综合研究；1930—1950年代，研究领域；1940—1950年代，研究领域；1926—1958年，研究领域；1957—1958年，战后 | 汇集风洞与高速气动、喷气推进试验科学、液体火箭与高空探测研究等已有历史项目；不是同名的单一历史发明。 [R50](https://www.nasa.gov/altitude-wind-tunnel/) [R58](https://www.nasa.gov/pdf/607087main_NASAsFirst50YearsHistoricalPerspectives-ebook.pdf) [R39](https://www.nasa.gov/history/the-national-advisory-committee-for-aeronautics-naca/) [R44](https://www.nasa.gov/history/95-years-ago-goddards-first-liquid-fueled-rocket/) [R45](https://www.nasa.gov/history/story-of-explorer-1/) [R40](https://www.nasa.gov/history/sputnik/sputorig.html) [R59](https://science.nasa.gov/mission/explorer-1/) | S14＋S15 → S21 | 研究所≥3级×1；机场≥2级×1 | 300,000／20分 | 汇合空气动力、推进与空间观测项目，为人造卫星科学工程提供基础。 |

### 第6阶段 · 2项

| 编号与项目 | 国别与年代 | 历史说明与来源 | 前置 → 子项 | 设施及条件 | 费用／时间 | 游戏效果草案 |
| --- | --- | --- | --- | --- | --- | --- |
| <a id="S20"></a>**S20 原子弹与核能项目** | 多国历史技术综合研究；1942年12月2日；1942—1945年，1945年首次核试验 | 汇集芝加哥一号堆：受控核反应、曼哈顿计划：原子弹项目等已有历史项目；不是同名的单一历史发明。 [R46](https://www.ne.anl.gov/About/reactors/early-reactors.shtml) [R34](https://www.nps.gov/mapr/learn/manhattan-project.htm) | S16＋S17 → 末级 | 研究所≥3级×1；工厂≥3级×4；总人口≥50000；可用人力≥3000 | 2,000,000／60分 | 完成终期核科学项目，获得核能与原子弹战略项目资格；具体作战、设施与生产规则另行实现。 |
| <a id="S21"></a>**S21 人造卫星科学项目** | 多国历史技术综合研究；1957年10月4日，战后；1958年1月31日美国当地时间，战后 | 汇集Sputnik 1：首颗人造卫星、Explorer 1：宇宙射线观测卫星等已有历史项目；不是同名的单一历史发明。 [R40](https://www.nasa.gov/history/sputnik/sputorig.html) [R59](https://science.nasa.gov/mission/explorer-1/) | S18＋S19 → 末级 | 研究所≥3级×1；工厂≥2级×4；机场≥2级×1；总人口≥50000；装备库存≥3000 | 1,800,000／60分 | 完成Sputnik 1和Explorer 1代表的早期卫星科学工程，解锁空间观测与科研收益；不提供GPS或现代全球成像能力。 |

## 数据与预览

[二叉树预览](research-browser.html) · [完整JSON](research-catalog.json) · [战术军事数据](tactics-nodes.json) · [科学研究数据](science-nodes.json) · [资料索引](sources.md)。

验证：`node scripts/validate-research.mjs`。原子弹节点只使用历史项目概括及游戏效果，不包含制造工艺、设计参数或操作步骤。
