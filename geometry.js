// The geometry path is shared by the Web Worker and the Node verification suite.
export function traceRegions(labels,n,target,epsilon=.18){
 const stride=n+1,edges=new Map();
 const inside=(x,y)=>x>=0&&y>=0&&x<n&&y<n&&(target<0?labels[y*n+x]>=0:labels[y*n+x]===target);
 const add=(x,y,xx,yy)=>{const k=y*stride+x,v=yy*stride+xx;if(!edges.has(k))edges.set(k,[]);edges.get(k).push(v);};
 for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(inside(x,y)){
  if(!inside(x,y-1))add(x,y,x+1,y);if(!inside(x+1,y))add(x+1,y,x+1,y+1);
  if(!inside(x,y+1))add(x+1,y+1,x,y+1);if(!inside(x-1,y))add(x,y+1,x,y);
 }
 const rings=[];
 while(edges.size){const start=edges.keys().next().value;let cur=start,prev=null,loop=[],guard=0;
  do{loop.push([cur%stride,Math.floor(cur/stride)]);const ns=edges.get(cur);if(!ns?.length)break;let chosen=0;
   if(prev!==null&&ns.length>1){const dx=cur%stride-prev%stride,dy=Math.floor(cur/stride)-Math.floor(prev/stride);for(let i=0;i<ns.length;i++){const nx=ns[i]%stride-cur%stride,ny=Math.floor(ns[i]/stride)-Math.floor(cur/stride);if(dx*ny-dy*nx>0){chosen=i;break;}}}
   const next=ns.splice(chosen,1)[0];if(!ns.length)edges.delete(cur);prev=cur;cur=next;if(++guard>n*n*4)throw Error('The artwork outline could not be traced.');
  }while(cur!==start);
  if(cur!==start||loop.length<4)continue;let area=0;for(let i=0;i<loop.length;i++){const a=loop[i],b=loop[(i+1)%loop.length];area+=a[0]*b[1]-b[0]*a[1];}
  if(Math.abs(area)<12)continue;loop=cleanPixelSteps(loop);const half=Math.floor(loop.length/2);const ring=rdp(loop.slice(0,half+1),epsilon).slice(0,-1).concat(rdp(loop.slice(half).concat([loop[0]]),epsilon));ring.pop();if(ring.length>=3)rings.push(fitSmoothCurve(ring));
 }
 return rings;
}
// Smooth the raw pixel contour before simplification so cleanup affects every
// outline and color region. Long straight runs retain deliberate sharp corners.
function cleanPixelSteps(points){
 const n=points.length,locked=new Uint8Array(n),at=i=>points[(i+n)%n];
 for(let i=0;i<n;i++){const p=at(i),before=at(i-4),after=at(i+4),a=[p[0]-before[0],p[1]-before[1]],b=[after[0]-p[0],after[1]-p[1]];if(Math.hypot(...a)<3.99||Math.hypot(...b)<3.99)continue;if(a[0]*b[0]+a[1]*b[1]!==0)continue;for(let j=-3;j<=3;j++)locked[(i+j+n)%n]=1;}
 let ring=points;
 for(let pass=0;pass<4;pass++){const previous=ring;ring=previous.map((p,i)=>{if(locked[i])return points[i];const a=previous[(i+n-1)%n],b=previous[(i+1)%n];return[(a[0]+2*p[0]+b[0])/4,(a[1]+2*p[1]+b[1])/4];});}
 return ring;
}
// Fit a closed Hermite curve to the cleaned contour and sample it densely.
// Sharp design corners remain sharp; smooth arcs no longer use large flat chords.
function fitSmoothCurve(ring){
 const n=ring.length,tangents=ring.map((p,i)=>{const a=ring[(i+n-1)%n],b=ring[(i+1)%n],u=[p[0]-a[0],p[1]-a[1]],v=[b[0]-p[0],b[1]-p[1]],lu=Math.hypot(...u),lv=Math.hypot(...v);if(!lu||!lv||(u[0]*v[0]+u[1]*v[1])/(lu*lv)<Math.cos(Math.PI/3))return[0,0];const t=[u[0]/lu+v[0]/lv,u[1]/lu+v[1]/lv],length=Math.hypot(...t);return t.map(x=>x/length);});
 const output=[];
 for(let i=0;i<n;i++){const a=ring[i],b=ring[(i+1)%n],distance=Math.hypot(b[0]-a[0],b[1]-a[1]),u=tangents[i].map(x=>x*distance),v=tangents[(i+1)%n].map(x=>x*distance),count=Math.max(2,Math.ceil(distance/1.25));for(let j=0;j<count;j++){const t=j/count,t2=t*t,t3=t2*t;output.push([0,1].map(k=>(2*t3-3*t2+1)*a[k]+(t3-2*t2+t)*u[k]+(-2*t3+3*t2)*b[k]+(t3-t2)*v[k]));}}
 const half=Math.floor(output.length/2);const simplified=rdp(output.slice(0,half+1),.02).slice(0,-1).concat(rdp(output.slice(half).concat([output[0]]),.02));simplified.pop();return simplified;
}
function rdp(a,eps){if(a.length<3)return a;const p=a[0],q=a.at(-1),dx=q[0]-p[0],dy=q[1]-p[1],den=dx*dx+dy*dy;let max=0,k=0;for(let i=1;i<a.length-1;i++){const t=den?Math.max(0,Math.min(1,((a[i][0]-p[0])*dx+(a[i][1]-p[1])*dy)/den)):0;const d=(a[i][0]-p[0]-t*dx)**2+(a[i][1]-p[1]-t*dy)**2;if(d>max){max=d;k=i;}}if(max<=eps*eps)return[p,q];return rdp(a.slice(0,k+1),eps).slice(0,-1).concat(rdp(a.slice(k),eps));}

export function distanceField(labels,n){
 const d=new Float32Array(n*n);for(let i=0;i<d.length;i++)d[i]=labels[i]<0?0:1e6;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=y*n+x;if(!d[i])continue;d[i]=Math.min(d[i],x?d[i-1]+1:1,y?d[i-n]+1:1,x&&y?d[i-n-1]+Math.SQRT2:1,x<n-1&&y?d[i-n+1]+Math.SQRT2:1);}
 for(let y=n-1;y>=0;y--)for(let x=n-1;x>=0;x--){const i=y*n+x;if(!d[i])continue;d[i]=Math.min(d[i],x<n-1?d[i+1]+1:1,y<n-1?d[i+n]+1:1,x<n-1&&y<n-1?d[i+n+1]+Math.SQRT2:1,x&&y<n-1?d[i+n-1]+Math.SQRT2:1);}
 return d;
}
export function positionArches(labels,n,size,options={}){
 const d=distanceField(labels,n),ppm=n/size,footR=(2.5+(options.smoothing??0))*ppm+1.25,bend=3.5*ppm;
 let sx=0,sy=0,count=0,minX=n,minY=n,maxX=0,maxY=0;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(labels[y*n+x]>=0){sx+=x;sy+=y;count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 if(!count)throw Error('No printable artwork was found.');const cx=sx/count,cy=sy/count;
 const sample=(x,y)=>{x=Math.round(x);y=Math.round(y);return x>=0&&y>=0&&x<n&&y<n?d[y*n+x]:0;};
 const safe=(x,y)=>sample(x-bend,y)>footR&&sample(x+bend,y)>footR;
 if(options.auto===false){const gap=options.spacing??44,x=-((options.x??0)*ppm)+n/2,y=n/2-(options.y??22)*ppm;const pair=[x-gap*ppm/2,x+gap*ppm/2];if(!pair.every(px=>safe(px,y)))throw Error('Move the arches onto solid artwork. Both feet of each arch need room.');return {centers:pair.map(px=>[-(px/n-.5)*size,(.5-y/n)*size]),spacing:gap,balanced:false,centroid:[-(cx/n-.5)*size,(.5-cy/n)*size]};}
 const target=Math.min(70,Math.max(18,(maxX-minX)/ppm*.44))*ppm;
 const desiredY=minY+(maxY-minY)*.25;let best=null;
 const step=Math.max(2,Math.round(n/150));
 // Search the upper half first, then the full outline if the shape is unusual.
 for(const upperOnly of [true,false]){
  for(let y=minY+Math.ceil(footR);y<=Math.min(maxY-footR,upperOnly?cy-3*ppm:maxY);y+=step){const row=[];for(let x=minX;x<=maxX;x+=step)if(safe(x,y))row.push(x);
   for(let i=0;i<row.length;i++)for(let j=i+1;j<row.length;j++){const gap=row[j]-row[i];if(gap<14*ppm||gap>95*ppm)continue;const midpoint=(row[i]+row[j])/2;const penalty=Math.abs(midpoint-cx)*2.8+Math.abs(gap-target)*.45+Math.abs(y-desiredY)*.65+(y>cy?1000:0);if(!best||penalty<best.penalty)best={pair:[row[i],row[j]],y,penalty};}
  }
  if(best)break;
 }
 if(!best)throw Error('This outline has no room for two compact arches. Increase the artwork size or use a wider silhouette.');
 return {centers:best.pair.map(x=>[-(x/n-.5)*size,(.5-best.y/n)*size]),spacing:(best.pair[1]-best.pair[0])/ppm,balanced:true,centroid:[-(cx/n-.5)*size,(.5-cy/n)*size]};
}

export function buildModel(kernel,{labels,n,palette,size=100,thickness=3,smoothing=0,mount={auto:true}},progress=()=>{}){
 const {CrossSection:C,Manifold:M}=kernel,bag=[];const keep=x=>{bag.push(x);return x;};
 const mm=rings=>rings.map(r=>r.map(([x,y])=>[-(x/n-.5)*size,(.5-y/n)*size]));
 try{
  smoothing=Math.max(0,Math.min(2,Number(smoothing)||0));
  const rounded=shape=>{if(!smoothing||shape.isEmpty())return shape;let x=shape;for(const delta of [smoothing,-smoothing,-smoothing,smoothing]){x=keep(x.offset(delta,'Round',2,32));if(x.isEmpty())break;}return x;};
  progress('Finding solid attachment points');const placement=positionArches(labels,n,size,{...mount,smoothing});
  progress('Building color regions');const silhouette=rounded(keep(new C(mm(traceRegions(labels,n,-1)),'EvenOdd')));
  if(silhouette.isEmpty())throw Error('The image has no usable filled outline. Reduce edge smoothing or increase artwork size.');
  for(const [x,y] of placement.centers)for(const side of [-1,1]){const pad=keep(keep(C.circle(2.25,32)).translate([x+side*3.5,y]));if(keep(pad.subtract(silhouette)).area()>.001)throw Error('The smoothed outline leaves an arch foot unsupported. Reduce smoothing or adjust placement.');}
  const empty=()=>keep(C.square([0,0]));
  const allRegions=palette.map((_,i)=>{const rings=traceRegions(labels,n,i);return rings.length?rounded(keep(new C(mm(rings),'EvenOdd'))):empty();});
  // Clip and subtract to ensure materials never overlap even after tracing.
  const regions=[],claimed=empty();let occupied=claimed;
  for(let i=0;i<allRegions.length;i++){const clipped=keep(allRegions[i].intersect(silhouette));const region=keep(clipped.subtract(occupied));regions.push(region);occupied=keep(occupied.add(region));}
  const overlays=regions.length>1?keep(C.union(regions.slice(1))):empty();const front=keep(silhouette.subtract(overlays));
  const inlayDepth=Math.min(.6,thickness/2);
  const frontBody=keep(front.extrude(inlayDepth));const backing=keep(keep(silhouette.extrude(thickness-inlayDepth)).translate([0,0,inlayDepth]));
  const pieces=[frontBody,backing];progress('Adding rounded rear arches');
  for(const [x,y] of placement.centers){for(const side of [-1,1]){pieces.push(keep(keep(M.cylinder(3.04,1.5,1.5,32)).translate([x+side*3.5,y,thickness-.05])));pieces.push(keep(keep(M.cylinder(.65,2.25,1.5,32)).translate([x+side*3.5,y,thickness-.05])));}
   const rod=keep(keep(C.circle(1.5,20)).translate([3.5,0]));pieces.push(keep(keep(keep(rod.revolve(48,180)).rotate([90,0,0])).translate([x,y,thickness+2.95])));
  }
  const body=keep(M.union(pieces));const solids=[body,...regions.slice(1).map(r=>keep(r.extrude(inlayDepth)))];
  const parts=[];let totalVolume=0;for(let i=0;i<solids.length;i++){const s=solids[i];if(s.isEmpty())continue;const status=s.status();if(status!=='NoError')throw Error('Geometry check failed: '+status);const volume=s.volume();if(volume<=0)throw Error('A printable region has invalid volume.');const m=s.getMesh();parts.push({name:i===0?'Body and rear arches':'Color '+(i+1),color:palette[i],positions:new Float32Array(m.vertProperties),triangles:new Uint32Array(m.triVerts),volume});totalVolume+=volume;}
  // Build the single-color shell directly to avoid coincident material interfaces.
  const solidBacking=keep(silhouette.extrude(thickness));const fused=keep(M.union([solidBacking,...pieces.slice(2)]));if(fused.status()!=='NoError')throw Error('The assembled mesh did not pass the geometry check.');const fusedMesh=fused.getMesh();
  const stlMesh={positions:new Float32Array(fusedMesh.vertProperties),triangles:new Uint32Array(fusedMesh.triVerts)};
  const meshParts=body.decompose();for(const x of meshParts)bag.push(x);const bounds=body.boundingBox();
  return {parts,stlMesh,placement,bounds,volume:totalVolume,components:meshParts.length,inlayDepth,smoothing};
 }finally{for(let i=bag.length-1;i>=0;i--){try{bag[i].delete();}catch{}}}
}
