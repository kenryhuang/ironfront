export function homeTile(game,owner){
 const tiles=game.nations.get(owner)?.tiles;if(!tiles?.size)return -1;
 let x=0,y=0;for(const t of tiles){x+=t%game.width;y+=Math.floor(t/game.width);}x/=tiles.size;y/=tiles.size;
 let best=-1,distance=Infinity;for(const t of tiles){const d=(t%game.width-x)**2+(Math.floor(t/game.width)-y)**2;if(d<distance){best=t;distance=d;}}
 return best;
}

export function focusTerritory(renderer,owner,now=performance.now()){
 const tile=homeTile(renderer.game,owner);if(tile<0)return false;
 renderer.zoom=6;renderer.panX=renderer.panY=0;renderer.constrainView();
 const [x,y]=renderer.point(tile);
 // Leave the left HUD and bottom command dock clear of the starting position.
 renderer.panX+=renderer.w*.6-x;renderer.panY+=renderer.h*.42-y;renderer.constrainView();
 renderer.homeMarker={tile,owner,start:now,until:now+8000};renderer.updateReliefBounds();return true;
}
