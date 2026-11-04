const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../dist/planner.js');

test('new structure projects and V5 files without UI metadata open in simple mode',()=>{
  const project=P.createProject();assert.deepEqual(project.ui,{inputMode:'simple'});
  delete project.ui;const before=JSON.stringify(project),result=P.calculate(project),restored=P.migrate(project);
  assert.deepEqual(restored.ui,{inputMode:'simple'});assert.equal(JSON.stringify(project),before);
  assert.deepEqual(P.calculate(restored),result);
});

test('simple and detailed UI preferences survive native JSON round trips',()=>{
  for(const inputMode of ['simple','detailed']){
    const project=P.createProject();project.ui={inputMode,collapsed:['purchase'],helperAcknowledged:true};
    const before=JSON.stringify(project),restored=P.parse(before);
    assert.deepEqual(restored.ui,project.ui);assert.equal(JSON.stringify(project),before);
    restored.ui.collapsed.push('cost');assert.deepEqual(project.ui.collapsed,['purchase'],'migration must not share mutable UI state');
  }
});

test('missing or unsupported UI preferences normalize to simple without affecting inputs',()=>{
  for(const ui of [undefined,null,[],2,'detailed',{}, {inputMode:'unknown'}, {inputMode:true}]){
    const project=P.createProject();project.ui=ui;const before=JSON.stringify(project),expected=P.calculate(project);
    const restored=P.migrate(project);assert.equal(restored.ui.inputMode,'simple');
    assert.equal(JSON.stringify(project),before);assert.deepEqual(P.calculate(restored),expected);
  }
});

test('switching saved UI modes leaves quantities, weights, cut planning and prices identical',()=>{
  const project=P.createProject();Object.assign(project.general,{planes:2,depth:900,quantity:3,extraEquipment:55});
  Object.assign(project.cabinet,{enabled:true,width:600,height:500,columns:12,rows:7,weightEach:10});
  project.materials[0].pricePerKg=1500;
  project.extras=[{id:'post-1',name:'별도 지주',...P.ref(),length:3000,quantity:2}];
  project.accessories=[{id:'plate-1',name:'베이스 플레이트',type:'plate',width:500,height:500,thickness:12,density:7850,quantity:2,unitPrice:65000},{id:'hardware-1',name:'앵커 세트',type:'hardware',quantity:8,weightEach:0.8,unitPrice:1500}];
  project.inventory=[{id:'stock-1',materialId:'m1',length:6000,quantity:4,trim:0}];
  Object.assign(project.cost,{cutFee:3000,spliceFee:5000,fabrication:250000,painting:100000,transport:70000,taxRate:10});
  const original=JSON.stringify(project),expected=P.calculate(project,{compare:true});
  for(const inputMode of ['simple','detailed']){
    const next=P.clone(project);next.ui.inputMode=inputMode;
    const restored=P.migrate(next);assert.equal(restored.ui.inputMode,inputMode);
    assert.deepEqual(P.calculate(restored,{compare:true}),expected);
  }
  assert.equal(JSON.stringify(project),original);
});

test('legacy calculator imports default to simple while preserving their calculated quantities',()=>{
  const input={...P.legacy.defaults,baseProfile:{section:'50',family:'square',rotation:0},frames:3};
  const raw={type:'led-frame-project',version:4,section:'50',family:'square',rotation:0,input:P.legacy.calculate(input).input},before=JSON.stringify(raw),restored=P.migrate(raw);
  assert.equal(restored.ui.inputMode,'simple');assert.equal(JSON.stringify(raw),before);
  const legacy=P.legacy.calculate(input),current=P.calculate(restored);
  assert.equal(current.general.quantity,legacy.input.frames);assert.ok(Math.abs(current.totalWeight-legacy.totalWeight)<1e-8);
  assert.ok(Math.abs(current.totalLength-legacy.totalLength)<1e-8);assert.equal(current.totalPieces,legacy.totalPieces);
});
