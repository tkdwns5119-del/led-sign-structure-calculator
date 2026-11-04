const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../dist/calculator.js');
const P=require('../dist/planner.js');
const F=require('../dist/foundation/engine.js');
const S=require('../dist/suite-engine.js');

function frameWithPost(section,extra={}){
  const p=P.createProject();p.materials.push(P.material(section,'m2'));
  p.extras.push({id:'x1',name:'지주',materialId:'m2',rotation:0,length:3000,quantity:1,post:true,...extra});
  return p;
}

test('round steel pipes use the KS D 3566 unit weight formula',()=>{
  const pipes=Object.values(C.presets).filter(p=>p.family==='pipe');
  assert.equal(pipes.length,6);assert.equal(C.families.pipe,'원형 강관');
  for(const p of pipes){assert.equal(p.face,p.sectionDepth);assert.equal(p.unitWeight,Math.round(0.02466*p.thickness*(p.face-p.thickness)*100)/100);}
  assert.equal(C.presets.p318_5.unitWeight,53.02);
  const m=P.material('p318_5','m2');assert.equal(m.family,'pipe');assert.equal(m.t1,6.9);assert.equal(m.kgm,53.02);
});

test('extras marked as posts are summarised and their mass stays in the frame weight',()=>{
  const p=frameWithPost('p318_5',{quantity:2}),r=P.calculate(p);
  assert.deepEqual(r.posts,{count:2,length:3000,rotation:0,names:['지주'],material:{id:'m2',name:'Ø318.5 × 6.9t',family:'pipe',face:318.5,depth:318.5,t1:6.9,t2:0}});
  const plain=P.createProject();assert.equal(P.calculate(plain).posts,null);
  close(r.frameWeight-P.calculate(plain).frameWeight,2*3*53.02);
  p.extras.push({id:'x2',name:'보조 지주',materialId:'m1',rotation:0,length:3000,quantity:1,post:true});
  assert.throws(()=>P.calculate(p),/같은 자재·방향/);
  assert.throws(()=>P.calculate(frameWithPost('p318_5',{post:'yes'})),/기초 지주 표시/);
});
function close(a,b){assert.ok(Math.abs(a-b)<1e-9,`${a} ≠ ${b}`);}

test('post sections map onto the foundation column inputs by family and orientation',()=>{
  const map=p=>S.postTransfer(P.calculate(p),F.limits);
  assert.deepEqual(map(frameWithPost('p318_5')).patch,{columnShape:'circle',columnDiameter:318.5,columnThickness:6.9});
  // Front wind runs along the frame depth: face b → column width (X), depth d → column depth (Y).
  assert.deepEqual(map(frameWithPost('r150x100')).patch,{columnShape:'rect',columnWidth:100,columnDepth:150,columnThickness:3.2});
  assert.deepEqual(map(frameWithPost('r150x100',{rotation:1})).patch,{columnShape:'rect',columnWidth:150,columnDepth:100,columnThickness:3.2});
  assert.deepEqual(map(frameWithPost('h200x100')).patch,{columnShape:'h',columnWidth:100,columnDepth:200,columnThickness:5.5,columnFlange:8});
  const rotatedH=map(frameWithPost('h200x100',{rotation:1}));assert.deepEqual(rotatedH.patch,{});assert.match(rotatedH.notes[0],/웹이 정면 풍향/);
  const small=map(frameWithPost('40'));assert.deepEqual(small.patch,{});assert.match(small.notes[0],/입력 범위 50~3000/);
  const custom=frameWithPost('p318_5');Object.assign(custom.materials[1],{section:'custom',family:'custom'});
  assert.match(map(custom).notes[0],/직접 입력/);
  const thin=frameWithPost('p318_5');thin.materials[1].t1=null;assert.match(map(thin).notes[0],/두께가 없어/);
  assert.deepEqual(S.postTransfer(P.calculate(P.createProject()),F.limits),{patch:{},notes:[],posts:null});
});

test('the transfer patch carries the post section and links on string values',()=>{
  const frame=frameWithPost('p318_5'),r=P.calculate(frame),patch=S.transfer(r,F.limits);
  assert.equal(patch.columnShape,'circle');assert.equal(patch.columnDiameter,318.5);assert.equal(patch.postKg,r.frameWeight+r.accessoryWeight);
  const foundation={project:{active:0,items:[{id:'f1',p:{...F.defaults,...patch}}]}},link={source:S.fingerprint(frame,patch),active:0,itemId:'f1'};
  assert.equal(S.isLinked(link,frame,patch,foundation),true);
  foundation.project.items[0].p.columnShape='rect';assert.equal(S.isLinked(link,frame,patch,foundation),false);
  // The transferred tube is reviewed once a thickness is present and anchors are embedded.
  const checked=F.calculate({...F.defaults,...patch,anchorEmbed:600});
  assert.ok(checked.checks.some(c=>c.label.startsWith('지주 휨')&&c.pass!==null));
});
