'use strict';
// Quantity-only foundation calculator: one offline HTML file with the shared foundation engine.
const fs=require('node:fs'),path=require('node:path');
const dist=path.join(__dirname,'dist'),dir=path.join(dist,'quantity');
const read=file=>fs.readFileSync(file,'utf8');
let html=read(path.join(dir,'index.html'));
const replaceOnce=(pattern,replacement,label)=>{const count=html.split(pattern).length-1;if(count!==1)throw Error(`${label}: expected one reference, found ${count}`);html=html.replace(pattern,()=>replacement);};
replaceOnce('<link rel="stylesheet" href="quantity.css">',`<style>${read(path.join(dir,'quantity.css'))}</style>`,'quantity.css');
const scripts=[['../foundation/wind.js',path.join(dist,'foundation','wind.js')],['../foundation/steel.js',path.join(dist,'foundation','steel.js')],['../foundation/engine.js',path.join(dist,'foundation','engine.js')],['../export.js',path.join(dist,'export.js')],['quantity.js',path.join(dir,'quantity.js')]];
for(const [src] of scripts)replaceOnce(`<script defer src="${src}"></script>`,'',src);
html=html.replace('</body>',()=>`<script>${scripts.map(([,file])=>read(file).replace(/<\/script/gi,'<\\/script')).join('\n;\n')}</script></body>`);
const target=path.join(__dirname,'전광판_기초_물량계산기.html');fs.writeFileSync(target,html,'utf8');console.log(`기초 물량 계산기 생성: ${target}`);
