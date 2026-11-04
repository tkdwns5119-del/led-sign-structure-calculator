const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../dist/planner.js'),F=require('../dist/foundation/engine.js'),S=require('../dist/suite-engine.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('default transfer uses installed member mass and leaves single-plane depth alone',()=>{
  const r=P.calculate(P.createProject()),patch=S.transfer(r,F.limits);
  close(patch.postKg,70.975);assert.equal(patch.signW,4000);assert.equal(patch.signH,2000);
  assert.equal(patch.panelKgM2,0);assert.equal(patch.extraKg,0);assert.equal(Object.hasOwn(patch,'signDepth'),false);
  const f=F.calculate({...F.defaults,...patch});close(f.l.upper,70.975*9.80665/1000);
});
test('multi-unit transfer conserves finished mass with cabinet, plates, hardware and extra members',()=>{
  for(const quantity of [1,3,100]){
    const p=P.createProject();p.general.quantity=quantity;p.general.planes=2;p.general.extraEquipment=75;
    Object.assign(p.cabinet,{enabled:true,weightEach:12.5});p.accessories=[{id:'a1',type:'plate',name:'판재',width:500,height:500,thickness:10,density:7850,quantity:2,unitPrice:null},{id:'a2',type:'hardware',name:'부속',quantity:8,weightEach:1.5,unitPrice:null}];
    p.extras=[{id:'x1',name:'지주',materialId:'m1',rotation:0,length:3000,quantity:2}];
    const r=P.calculate(p),patch=S.transfer(r,F.limits),area=patch.signW*patch.signH/1e6;
    close(patch.panelKgM2*area+patch.postKg+patch.extraKg,r.totalWeight/quantity);
    assert.equal(patch.extraKg,75);assert.equal(patch.signDepth,600);assert.equal(Object.hasOwn(patch,'qty'),false);assert.equal(Object.hasOwn(patch,'installMode'),false);
    const f=F.calculate({...F.defaults,...patch,mode:'manual'});close(f.l.upper,(r.totalWeight/quantity)*9.80665/1000);
  }
});
test('cabinet-derived dimensions are transferred instead of stale outer dimensions',()=>{
  const p=P.createProject();Object.assign(p.cabinet,{enabled:true,width:640,height:480,columns:10,rows:6,weightEach:20});
  const patch=S.transfer(P.calculate(p),F.limits);assert.equal(patch.signW,6400);assert.equal(patch.signH,2880);close(patch.panelKgM2,1200/(6.4*2.88));
});
test('transfer rejects incompatible foundation ranges and non-finite values',()=>{
  const p=P.createProject();p.general.width=60000;assert.throws(()=>S.transfer(P.calculate(p),F.limits),/signW/);
  const r=P.calculate(P.createProject());assert.throws(()=>S.transfer({...r,cabinetWeight:NaN},F.limits),/panelKgM2/);assert.throws(()=>S.transfer(null,F.limits),/입력 오류/);
});
test('link becomes stale after source changes, target edits or selecting another foundation',()=>{
  const p=P.createProject(),patch=S.transfer(P.calculate(p),F.limits),foundation={project:{active:0,items:[{p:{...F.defaults,...patch}}]}};
  const link={source:S.fingerprint(p,patch),active:0};assert.equal(S.isLinked(link,p,patch,foundation),true);
  foundation.project.items[0].p.pressure=2;assert.equal(S.isLinked(link,p,patch,foundation),true);
  foundation.project.items[0].p.postKg+=1;assert.equal(S.isLinked(link,p,patch,foundation),false);
  foundation.project.items[0].p.postKg=patch.postKg;p.general.quantity=2;assert.equal(S.isLinked(link,p,patch,foundation),true,'per-board values are unchanged when only the production quantity changes');
  assert.equal(S.isLinked({source:S.legacyFingerprint(p,patch),active:0},p,patch,foundation),true,'links saved before 2026-10-21 still match');
  p.general.quantity=1;foundation.project.active=1;assert.equal(S.isLinked(link,p,patch,foundation),false);
});
test('complete bundle validates both halves without applying either',()=>{
  const calls=[],frame={validateProject:p=>{calls.push('frame');return P.migrate(p);}},foundation={validateProject:p=>{calls.push('foundation');if(p.invalid)throw Error('bad foundation');return S.clone(p);}};
  const input={format:'led-integrated-project',version:1,name:'통합',frame:P.createProject(),foundation:{invalid:true}};
  assert.throws(()=>S.validate(input,frame,foundation),/bad foundation/);assert.deepEqual(calls,['frame','foundation']);assert.equal(input.foundation.invalid,true);
  input.foundation={project:{items:[]}};const clean=S.validate(input,frame,foundation);assert.equal(clean.view,'frame');assert.equal(clean.link,null);assert.notEqual(clean.frame,input.frame);
});
