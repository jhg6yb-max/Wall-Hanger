import {cp,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');const dest=path.join(root,'dist');
await rm(dest,{recursive:true,force:true});await mkdir(dest,{recursive:true});
for(const item of ['index.html','styles.css','app.js','geometry-worker.js','README.md','.nojekyll','src','vendor','examples'])await cp(path.join(root,item),path.join(dest,item),{recursive:true});
console.log('Static site ready in dist/. Serve over HTTP or deploy with GitHub Pages.');
