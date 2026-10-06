import Module from './vendor/manifold.js';
import {buildModel} from './src/geometry.js?v=curves-2';
const ready=Module({locateFile:()=>new URL('./vendor/manifold.wasm',import.meta.url).href}).then(k=>{k.setup();return k;});
self.onmessage=async({data})=>{try{const k=await ready;const result=buildModel(k,data.input,status=>self.postMessage({id:data.id,status}));const transfers=result.parts.flatMap(p=>[p.positions.buffer,p.triangles.buffer]);transfers.push(result.stlMesh.positions.buffer,result.stlMesh.triangles.buffer);self.postMessage({id:data.id,result},transfers);}catch(e){self.postMessage({id:data.id,error:e.message||String(e)});}};
