import * as THREE from '../../src/vendor/three.module.js';
import { createFacilityModel, disposeFacilityModel } from '../../src/facility-models.js';

const catalog = {
  city: {name:'城市',index:'01',subtitle:'街区 · 民居 · 钟楼',levels:[
    ['初建街区','四组民居围合街巷，坡屋顶与烟囱组成紧凑的城镇轮廓。'],
    ['街区扩建','民居增加楼层与街角门廊，窗列和屋檐形成更丰富的立面。'],
    ['城市中心','增建钟楼与尖顶，强化中心天际线；前排民居继续向上扩建。']
  ]},
  factory: {name:'工厂',index:'02',subtitle:'锯齿厂房 · 烟囱 · 工业管线',levels:[
    ['基础生产','锯齿屋面引入天光，双烟囱、储罐和砖柱构成完整厂区。'],
    ['车间扩建','厂房上方增加辅助车间，增设压力罐与连接管线。'],
    ['重工厂区','加高烟囱并安装跨厂吊架，新增高位车间与支承立柱。']
  ]},
  barracks: {name:'兵营',index:'03',subtitle:'营舍 · 哨塔 · 防护围墙',levels:[
    ['野战营地','低层营舍、帐篷与开放式哨塔，围绕营区通道展开。'],
    ['常备营区','后排营舍增加楼层，帐篷位置改建为永久营舍。'],
    ['指挥驻地','前排营舍加建指挥层，哨塔升高，补齐围墙与入口岗亭。']
  ]},
  fort: {name:'要塞',index:'04',subtitle:'斜面掩体 · 装甲炮塔 · 射击孔',levels:[
    ['防御阵地','削角斜面掩体搭配装甲顶盖、射击孔和前沿阻车设施。'],
    ['联防工事','增建连接掩体与第二座装甲炮塔，形成连续防御结构。'],
    ['指挥堡垒','主掩体上方增建指挥层与顶置炮塔，两侧补建防御塔。']
  ]}
};
const viewport = document.querySelector('#viewport');
const stats = document.querySelector('#render-stats');
const error = document.querySelector('#error');
const detailControl = document.querySelector('#detail');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#fbfaf3');
const camera = new THREE.OrthographicCamera(-3,3,1,-1,.1,40);
camera.up.set(0,0,1);
camera.position.set(0,-6,5.4);
camera.lookAt(0,0,.2);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
} catch {
  error.hidden = false;
  error.textContent = '浏览器未能初始化 WebGL。请启用硬件加速后重新打开此页。';
  stats.textContent = '三维预览不可用';
  throw new Error('WebGL preview initialization failed');
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.info.autoReset = false;
viewport.append(renderer.domElement);
renderer.domElement.setAttribute('aria-hidden','true');
const sky = new THREE.HemisphereLight('#fffdf3','#a4ac8e',2.4);
sky.position.set(0,0,5);scene.add(sky);
const sun = new THREE.DirectionalLight('#fff2dc',2.2);
sun.position.set(-3,-4,7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-4,right:4,top:3,bottom:-3,near:.1,far:15});
sun.shadow.bias = -.0002;
sun.shadow.normalBias = .018;
scene.add(sun);
scene.add(sun.target);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshStandardMaterial({color:'#fbfaf3',roughness:1}));
ground.position.z = -.018;ground.receiveShadow = true;scene.add(ground);
const models = [];
const initialAngle = -.28;
let selected = 'city', angle = initialAngle, frame = 0, stopped = false;

function render() {
  frame = 0;
  if(stopped) return;
  const width = viewport.clientWidth, height = viewport.clientHeight;
  if(width === 0 || height === 0) return;
  renderer.setSize(width,height,false);
  const halfHeight = 3 * height / width;
  camera.left = -3;camera.right = 3;camera.top = halfHeight;camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
  renderer.shadowMap.needsUpdate = true;
  renderer.info.reset();
  renderer.render(scene,camera);
  const {calls,triangles} = renderer.info.render;
  const detail = detailControl.options[detailControl.selectedIndex].textContent;
  stats.textContent = `${detail} · 本帧 ${calls} 次绘制 / ${triangles.toLocaleString('zh-CN')} 个三角形（含阴影）`;
}
function invalidate() {
  if(!stopped && !frame) frame = requestAnimationFrame(render);
}
function clearModels() {
  for(const model of models) { scene.remove(model);disposeFacilityModel(model); }
  models.length = 0;
}
function showFacility(type) {
  selected = type;
  clearModels();
  const definition = catalog[type];
  for(let level=1;level<=3;level++) {
    const model = createFacilityModel(type,level,'#82946f',{detail:detailControl.value});
    model.position.x = (level-2)*2;
    model.rotation.z = angle;
    scene.add(model);models.push(model);
  }
  document.querySelector('#facility-title').textContent = definition.name;
  document.querySelector('#facility-index').textContent = definition.index;
  document.querySelector('#facility-subtitle').textContent = definition.subtitle;
  viewport.setAttribute('aria-label',`${definition.name}一级、二级和三级建筑的三维对比`);
  document.querySelector('#levels').replaceChildren(...definition.levels.map(([title,description],i) => {
    const article = document.createElement('article');article.className='level';
    const heading = document.createElement('div');heading.className='level-title';
    const label = document.createElement('span');label.className='level-tag';label.textContent=`Lv.${i+1}`;
    const name = document.createElement('h3');name.textContent=title;
    const copy = document.createElement('p');copy.textContent=description;
    heading.append(label,name);article.append(heading,copy);return article;
  }));
  for(const button of document.querySelectorAll('[data-type]'))button.setAttribute('aria-pressed',String(button.dataset.type===type));
  invalidate();
}
function rotate(delta) {
  angle += delta;
  for(const model of models) model.rotation.z = angle;
  invalidate();
}
for(const button of document.querySelectorAll('[data-type]'))button.addEventListener('click',() => showFacility(button.dataset.type));
detailControl.addEventListener('change',() => showFacility(selected));
document.querySelector('#rotate-left').addEventListener('click',() => rotate(Math.PI/12));
document.querySelector('#rotate-right').addEventListener('click',() => rotate(-Math.PI/12));
document.querySelector('#reset-view').addEventListener('click',() => {angle=initialAngle;rotate(0);});
const observer = new ResizeObserver(invalidate);
observer.observe(viewport);
renderer.domElement.addEventListener('webglcontextlost',event => {
  event.preventDefault();
  error.hidden=false;
  error.textContent='三维显示暂时中断，请刷新页面恢复预览。';
});
window.addEventListener('pagehide',() => {
  stopped=true;cancelAnimationFrame(frame);observer.disconnect();
  clearModels();ground.geometry.dispose();ground.material.dispose();
  sun.shadow.map?.dispose();renderer.dispose();
},{once:true});
showFacility('city');
