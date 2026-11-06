export function projectUnitPoint(r,p){const x=r.originX+p.x*r.scale,y=r.originY+p.y*r.scale;return r.surface?.active?r.surface.project(x,y):[x,y];}
export function pickGroundUnit(units,x,y,project,radius=19){let best=null,d=radius;for(const u of units)for(const p of u.positions){const q=project(p),n=Math.hypot(x-q[0],y-q[1]);if(n<d){d=n;best=u;}}return best;}
export function boxGroundUnits(units,rect,project){return units.filter(u=>u.positions.some(p=>{const [x,y]=project(p);return x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom;})).map(u=>u.key);}
