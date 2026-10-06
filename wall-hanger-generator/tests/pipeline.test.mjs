import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {Resvg} from '@resvg/resvg-js';import {PNG} from 'pngjs';import JSZip from 'jszip';
import Module from '../vendor/manifold.js';import {buildModel,positionArches} from '../src/geometry.js';import {quantizePixels} from '../src/image.js';import {make3MF,makeSTL} from '../src/export.js';
const k=await Module();k.setup();
function closed(mesh){const counts=new Map();for(let i=0;i<mesh.triangles.length;i+=3)for(let j=0;j<3;j++){const a=mesh.triangles[i+j],b=mesh.triangles[i+(j+1)%3],key=Math.min(a,b)+','+Math.max(a,b);counts.set(key,(counts.get(key)||0)+1);}assert.ok([...counts.values()].every(v=>v===2));}
function signedVolume(mesh){let sum=0;const p=mesh.positions;for(let i=0;i<mesh.triangles.length;i+=3){const [a,b,c]=[0,1,2].map(j=>mesh.triangles[i+j]*3);sum+=p[a]*(p[b+1]*p[c+2]-p[b+2]*p[c+1])+p[a+1]*(p[b+2]*p[c]-p[b]*p[c+2])+p[a+2]*(p[b]*p[c+1]-p[b+1]*p[c]);}return sum/6;}
test('SVG raster colors produce printable four-material 3MF and fused STL',async()=>{
 const svg=await fs.readFile(new URL('../examples/flower.svg',import.meta.url),'utf8');const render=new Resvg(svg,{fitTo:{mode:'width',value:512}}).render();const png=PNG.sync.read(render.asPng());
 const hints=[...new Set([...svg.matchAll(/fill="(#[0-9A-F]{6})"/g)].map(m=>m[1]))];const q=quantizePixels(png.data,7,hints);assert.equal(q.palette.length,4);assert.deepEqual(new Set(q.palette),new Set(hints));
 const m=buildModel(k,{...q,n:512,size:100,thickness:3,mount:{auto:true}});assert.equal(m.parts.length,4);assert.equal(m.components,1);m.parts.forEach(closed);closed(m.stlMesh);assert.ok(Math.abs(signedVolume(m.stlMesh)-m.volume)<.1,'parts must not overlap');
 const zip=await JSZip.loadAsync(await make3MF(m,()=>new JSZip(),'Flower & test'));const xml=await zip.file('3D/3dmodel.model').async('string');assert.equal((xml.match(/<base /g)||[]).length,4);assert.equal((xml.match(/<component /g)||[]).length,4);assert.ok(xml.includes('Flower &amp; test'));assert.ok(xml.includes('unit="millimeter"'));for(const color of hints)assert.ok(xml.includes(color+'FF'));assert.ok(zip.file('_rels/.rels'));assert.ok(zip.file('[Content_Types].xml'));
 const bytes=makeSTL(m),view=new DataView(bytes.buffer);assert.equal(bytes.length,84+view.getUint32(80,true)*50);assert.equal(view.getUint32(80,true),m.stlMesh.triangles.length/3);
});
test('holes remain empty and arch dimensions do not scale with the artwork',()=>{
 const n=128,labels=new Int8Array(n*n);labels.fill(0);const input={labels,n,palette:['#113322'],size:100,thickness:3,mount:{auto:true}};const solid=buildModel(k,input);for(let y=52;y<76;y++)for(let x=52;x<76;x++)labels[y*n+x]=-1;
 const hole=buildModel(k,input);closed(hole.stlMesh);assert.ok(Math.abs((solid.volume-hole.volume)-(24*100/128)**2*3)<.1);const large=buildModel(k,{...input,size:150});assert.ok(Math.abs((hole.bounds.max[2]-3)-(large.bounds.max[2]-3))<.001);
 const points=positionArches(labels,n,100,{auto:true});assert.equal(points.centers.length,2);assert.ok(points.centers.every(p=>p[1]>0));
});
test('raster palettes respect the user color limit and transparency',()=>{
 const rgba=new Uint8Array(40*40*4);const colors=[[255,0,0],[0,255,0],[0,0,255],[255,255,0]];for(let i=0;i<1600;i++){rgba.set([...colors[i%4],i<80?0:255],i*4);}const result=quantizePixels(rgba,2);assert.equal(result.palette.length,2);assert.ok([...result.labels.slice(0,80)].every(v=>v===-1));assert.ok([...result.labels.slice(80)].every(v=>v>=0&&v<2));
});
