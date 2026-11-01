// Rebuilt once per intelligence tick; queries retain exact circular distances.
export class FacilitySpatialIndex {
 constructor(g){this.buckets=new Map();this.width=g.width;for(const entry of g.buildings){const t=entry[0],key=`${Math.floor((t%g.width+.5)/8)},${Math.floor((Math.floor(t/g.width)+.5)/8)}`;if(!this.buckets.has(key))this.buckets.set(key,[]);this.buckets.get(key).push(entry);}}
 *near(x,y,radius){for(let by=Math.floor((y-radius)/8);by<=Math.floor((y+radius)/8);by++)for(let bx=Math.floor((x-radius)/8);bx<=Math.floor((x+radius)/8);bx++)yield* this.buckets.get(`${bx},${by}`)??[];}
}
