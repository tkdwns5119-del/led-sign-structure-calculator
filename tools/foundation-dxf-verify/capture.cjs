const fs=require('node:fs');
const path=require('node:path');
const {harness}=require('../../tests/foundation-ui.test.cjs');
const base=path.join(__dirname,'tmp');fs.mkdirSync(base,{recursive:true});
const cases=[];
for(const name of ['default','shared','combined','block','round']){
  const h=harness(true);
  if(name==='shared'){h.change('qty',3);h.change('foundationSpacing',4500);}
  if(name==='combined')h.change('type','combined');
  if(name==='block')h.change('type','block');
  if(name==='round'){h.change('columnShape','circle');h.change('plateShape','circle');h.change('anchorCount',6);h.change('anchorAngle',30);}
  h.el('drawing').click();const download=h.downloads.find(x=>x.name.endsWith('.dxf'));
  if(!download)throw new Error('DXF download failed: '+h.el('toast').textContent);
  const file=path.join(base,name+'.dxf');fs.writeFileSync(file,download.content,'ascii');
  const r=h.api.getResult();cases.push({name,file,footing:[r.g.L,r.g.W,r.g.H],columnsDrawn:r.supports.known?(r.supports.shared?r.supports.total:r.supports.perFoundation):0,...(name==='round'?{plateRadius:250,columnRadius:150,boltCircleRadius:175,anchorCount:6}:{})});
  if(name==='default')fs.writeFileSync(path.resolve(__dirname,'../../foundation-examples/전광판_기초_철근_배근초안.dxf'),download.content,'ascii');
  if(name==='round'){
    fs.writeFileSync(path.resolve(__dirname,'../../foundation-examples/전광판_원형기둥_원형플레이트_배근초안.dxf'),download.content,'ascii');
    fs.writeFileSync(path.join(base,'round-neck.svg'),r.drawingParts.at(-1)[1],'utf8');
  }
}
fs.writeFileSync(path.join(base,'cases.json'),JSON.stringify(cases,null,2));
