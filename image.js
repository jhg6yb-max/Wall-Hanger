export function quantizePixels(rgba,maxColors=7,hints=[]){
 const histogram=new Map();for(let i=0;i<rgba.length;i+=4){if(rgba[i+3]<128)continue;const r=rgba[i],g=rgba[i+1],b=rgba[i+2],key=(r>>3)*1024+(g>>3)*32+(b>>3);let h=histogram.get(key);if(!h){h={count:0,s:[0,0,0]};histogram.set(key,h);}h.count++;h.s[0]+=r;h.s[1]+=g;h.s[2]+=b;}
 const bins=[...histogram.values()].map(h=>({count:h.count,c:h.s.map(x=>x/h.count)})).sort((a,b)=>b.count-a.count);
 if(!bins.length)throw Error('No opaque image regions were found.');const dist=(a,b)=>a.reduce((s,v,i)=>s+(v-b[i])**2,0);
 const hasHints=hints.length>0&&hints.length<=maxColors;
 const centers=hasHints?hints.map(h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16))):[bins[0].c];while(!hasHints&&centers.length<maxColors&&centers.length<bins.length){let best=null,score=0;for(const b of bins){const s=Math.min(...centers.map(c=>dist(b.c,c)))*Math.sqrt(b.count);if(s>score){score=s;best=b.c;}}if(!best||score<2)break;centers.push(best.slice());}
 for(let iter=0;!hasHints&&iter<12;iter++){const sums=centers.map(()=>[0,0,0,0]);for(const b of bins){let k=0,dd=Infinity;centers.forEach((c,j)=>{const d=dist(c,b.c);if(d<dd){dd=d;k=j;}});for(let j=0;j<3;j++)sums[k][j]+=b.c[j]*b.count;sums[k][3]+=b.count;}centers.forEach((c,j)=>{if(sums[j][3])centers[j]=sums[j].slice(0,3).map(v=>v/sums[j][3]);});}
 let labels=new Int8Array(rgba.length/4);labels.fill(-1);const counts=centers.map(()=>0);for(let i=0;i<labels.length;i++){if(rgba[4*i+3]<128)continue;const p=[rgba[4*i],rgba[4*i+1],rgba[4*i+2]];let k=0,dd=Infinity;centers.forEach((c,j)=>{const d=dist(c,p);if(d<dd){dd=d;k=j;}});labels[i]=k;counts[k]++;}
 const total=counts.reduce((a,b)=>a+b,0);let active=centers.map((c,i)=>({c,i,count:counts[i]})).filter(x=>x.count>Math.max(8,total*.0008));active.sort((a,b)=>(.2126*a.c[0]+.7152*a.c[1]+.0722*a.c[2])-(.2126*b.c[0]+.7152*b.c[1]+.0722*b.c[2]));
 const newColors=active.map(x=>x.c.map(v=>Math.round(v))),remap=centers.map(c=>{let k=0,dd=Infinity;newColors.forEach((p,j)=>{const d=dist(c,p);if(d<dd){dd=d;k=j;}});return k;});for(let i=0;i<labels.length;i++)if(labels[i]>=0)labels[i]=remap[labels[i]];
 return {labels,palette:newColors.map(rgb=> '#'+rgb.map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase())};
}
function removeBackground(data,w,h){const seen=new Uint8Array(w*h),queue=[];const corner=[data[0],data[1],data[2]];if(data[3]<128)return;const close=i=>(data[4*i]-corner[0])**2+(data[4*i+1]-corner[1])**2+(data[4*i+2]-corner[2])**2<35**2;for(const i of [0,w-1,(h-1)*w,w*h-1])if(close(i)){queue.push(i);seen[i]=1;}for(let q=0;q<queue.length;q++){const i=queue[q],x=i%w,y=Math.floor(i/w);data[i*4+3]=0;for(const j of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1])if(j>=0&&!seen[j]&&close(j)){seen[j]=1;queue.push(j);}}}
export async function readArtwork(file,{removeBg=false,n=768}={}){
 if(file.size>15*1024*1024)throw Error('Choose an image smaller than 15 MB.');let blob=file,originalPalette=[];
 if(/\.svg$/i.test(file.name)||file.type==='image/svg+xml'){
  const doc=new DOMParser().parseFromString(await file.text(),'image/svg+xml');if(doc.querySelector('parsererror')||doc.documentElement.localName!=='svg')throw Error('This SVG could not be read.');
  doc.querySelectorAll('script,foreignObject').forEach(e=>e.remove());for(const e of [doc.documentElement,...doc.querySelectorAll('*')])for(const a of [...e.attributes]){if(a.name.startsWith('on'))e.removeAttribute(a.name);if((a.localName==='href'&&!a.value.startsWith('#')&&!a.value.startsWith('data:'))||(/url\(/.test(a.value)&&/url\(\s*["']?(?:https?:|\/\/)/.test(a.value)))throw Error('Embed external images or fonts in the SVG before uploading.');}
  if([...doc.querySelectorAll('style')].some(e=>/@import|url\(\s*["']?(?:https?:|\/\/)/.test(e.textContent)))throw Error('Embed external SVG styles before uploading.');
  // A shadow tree reads inherited SVG colors without exposing page styling.
  if(!doc.querySelector('use,image,filter,linearGradient,radialGradient,pattern')){
   const host=document.createElement('div');host.style.cssText='position:fixed;left:-20000px;top:0;pointer-events:none';const shadow=host.attachShadow({mode:'closed'});const live=document.importNode(doc.documentElement,true);shadow.append(live);document.body.append(host);let valid=true;
   for(const e of live.querySelectorAll('path,rect,circle,ellipse,polygon,polyline,line,text')){if(e.closest('defs,clipPath,mask,symbol'))continue;const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden')continue;for(const prop of ['fill','stroke']){const v=cs[prop];if(v==='none')continue;const m=v.match(/^rgba?\(([^)]+)\)/);if(!m){valid=false;continue;}const a=m[1].split(/[, ]+/).filter(Boolean).map(Number);if(a.length>3&&a[3]<1){valid=false;continue;}const h='#'+a.slice(0,3).map(n=>Math.round(n).toString(16).padStart(2,'0')).join('').toUpperCase();if(!originalPalette.includes(h))originalPalette.push(h);}}
   host.remove();if(!valid)originalPalette=[];
  }
  doc.documentElement.setAttribute('xmlns','http://www.w3.org/2000/svg');blob=new Blob([new XMLSerializer().serializeToString(doc)],{type:'image/svg+xml'});
 }
 const url=URL.createObjectURL(blob),img=new Image();try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Use a valid SVG, PNG, or JPEG image.'));img.src=url;});}finally{URL.revokeObjectURL(url);}
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const ctx=canvas.getContext('2d',{willReadFrequently:true});const f=1024/Math.max(img.naturalWidth,img.naturalHeight);ctx.drawImage(img,(1024-img.naturalWidth*f)/2,(1024-img.naturalHeight*f)/2,img.naturalWidth*f,img.naturalHeight*f);
 const data=ctx.getImageData(0,0,1024,1024);if(removeBg){removeBackground(data.data,1024,1024);ctx.putImageData(data,0,0);}
 let minX=1024,minY=1024,maxX=-1,maxY=-1;for(let y=0;y<1024;y++)for(let x=0;x<1024;x++)if(data.data[(y*1024+x)*4+3]>=128){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 if(maxX<0)throw Error('The image is empty after background removal.');const w=maxX-minX+1,h=maxY-minY+1;
 const result=document.createElement('canvas');result.width=result.height=n;const rctx=result.getContext('2d',{willReadFrequently:true});const scale=n/Math.max(w,h);rctx.drawImage(canvas,minX,minY,w,h,(n-w*scale)/2,(n-h*scale)/2,w*scale,h*scale);return {rgba:rctx.getImageData(0,0,n,n).data,n,originalPalette};
}
