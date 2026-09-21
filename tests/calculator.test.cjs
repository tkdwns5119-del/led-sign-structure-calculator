const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../dist/calculator.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
const member=(section,rotation=0,stockLength=6000)=>({section,family:C.presets[section].family,rotation,...C.presetValues(section,rotation),stockLength});
const input=values=>({...C.defaults,baseProfile:{section:'50',family:'square',rotation:0},...values});
function verifyPlan(r){
  const p=r.purchase;assert.equal(p.status,'ready');
  const base=new Map(r.rows.map(row=>[row.code,0])),extra=new Map(r.rows.map(row=>[row.code,0]));
  let stocks=0,additional=0;
  for(const pattern of p.patterns){
    assert.ok(Number.isInteger(pattern.repeat)&&pattern.repeat>0);
    stocks+=pattern.repeat;if(pattern.extensionOnly)additional+=pattern.repeat;
    const material=pattern.cuts.reduce((n,c)=>n+c.length*c.count,0);
    close(material+pattern.kerfLoss+pattern.trimLoss+pattern.remainder,pattern.stockLength);
    assert.ok(pattern.remainder>=0&&pattern.kerfLoss>=0);
    assert.equal(pattern.extensionOnly,pattern.cuts.every(c=>c.extension));
    for(const c of pattern.cuts){
      assert.ok(c.length>0&&c.length<=pattern.stockLength-pattern.trimLoss+1e-7);
      const target=c.extension?extra:base;assert.ok(target.has(c.code));target.set(c.code,target.get(c.code)+c.count*pattern.repeat);
      if(pattern.groupId)assert.equal(r.rows.find(row=>row.code===c.code).groupId,pattern.groupId);
    }
  }
  assert.equal(stocks,p.stockCount);assert.equal(additional,p.additionalStockCount);assert.equal(p.baseStockCount+p.additionalStockCount,p.stockCount);
  for(const row of r.rows){assert.equal(base.get(row.code),row.count);assert.equal(extra.get(row.code),row.jointCount||0);}
  close(p.grossLength,p.materialLength+p.remainder+p.kerfLoss+p.trimLoss);
  close(p.materialLength,r.totalLength+p.overlapLength);
  if(p.groups){
    close(p.purchaseWeight,p.groups.reduce((n,g)=>n+g.grossLength*g.profile.unitWeight,0));close(r.frameWeight,r.rows.reduce((n,row)=>n+row.materialLength*row.profile.unitWeight,0));
    for(const g of p.groups){const firstPieces=g.rows.map(row=>({...row,length:Math.min(row.length,g.stockLength-r.input.endTrim)}));assert.equal(C.planCuts(firstPieces,g.stockLength,r.input.kerf,r.input.endTrim,g.profile.unitWeight).stockCount,g.baseStockCount);}
  }
  for(const e of p.extensions){close(e.segments.reduce((n,s)=>n+s.length*s.count,0),e.length+e.jointsPerPiece*(r.input?.spliceAllowance||0));assert.equal(e.totalJoints,e.jointsPerPiece*e.count);}
}
test('default hand calculation remains 11 pieces, 21.25 m and four stock bars',()=>{
  const r=C.calculate(input());assert.equal(r.totalPieces,11);close(r.totalLength,21.25);close(r.frameWeight,70.975);assert.equal(r.purchase.stockCount,4);close(r.purchase.purchaseWeight,80.16);verifyPlan(r);
});
test('two faces and shared side edges are not counted twice',()=>{
  const r=C.calculate(input({planes:2,frames:2,equipment:100,sideHorizontal:0}));
  assert.equal(r.totalPieces,52);close(r.totalLength,89);close(r.totalWeight,497.26);
  assert.equal(r.rows.filter(row=>row.role.startsWith('depth')).reduce((n,row)=>n+row.count,0),8);verifyPlan(r);
});
test('no reinforcement and fractional bay lengths',()=>{
  const r=C.calculate(input({vertical:0,horizontal:0}));assert.equal(r.rows.length,4);assert.equal(r.totalPieces,4);close(r.totalLength,11.8);verifyPlan(r);
  verifyPlan(C.calculate(input({width:4099,vertical:2,horizontal:3,frames:17,endTrim:10,kerf:2.4})));
});
test('user 10 m example: 6 m + 3.9 m and four extra stock bars',()=>{
  const r=C.calculate(input({width:10000,height:2600,planes:2}));
  assert.equal(r.totalPieces,28);close(r.totalLength,87.5);assert.equal(r.purchase.baseStockCount,13);assert.equal(r.purchase.additionalStockCount,4);assert.equal(r.purchase.stockCount,17);
  close(r.purchase.extensionLength,15.6);assert.equal(r.purchase.jointCount,4);
  for(const e of r.purchase.extensions){assert.equal(e.length,9900);assert.equal(e.count,2);assert.deepEqual(e.segments,[{length:6000,count:1},{length:3900,count:1}]);}verifyPlan(r);
});
test('an extension reuses a compatible base-stock offcut before adding stock',()=>{
  const rows=[{code:'A',name:'normal',length:2000,count:1,totalLength:2},{code:'B',name:'long',length:9500,count:1,totalLength:9.5,jointCount:1}];
  const p=C.planCuts(rows,6000,3,0,3.34);assert.equal(p.baseStockCount,2);assert.equal(p.additionalStockCount,0);close(p.reusedExtensionLength,3.5);verifyPlan({rows,purchase:p,totalLength:11.5});
});
test('multiple joints and overlap allowance conserve material and weight',()=>{
  assert.deepEqual(C.splitMember(12300,6000,100),{segments:[{length:6000,count:2},{length:500,count:1}],joints:2,extra:200});
  assert.equal(C.splitMember(12000,6000,0).joints,1);
  const r=C.calculate(input({width:20000,stockLength:6000,endTrim:20,spliceAllowance:100,frames:3}));verifyPlan(r);assert.ok(r.purchase.jointCount>0);close(r.frameWeight,(r.totalLength+r.purchase.overlapLength)*3.34);
});
test('short stock produces extension quantities instead of an oversize warning',()=>{
  const r=C.calculate(input({stockLength:2000}));assert.equal(r.purchase.status,'ready');assert.ok(r.purchase.extensions.length);verifyPlan(r);
  assert.equal(C.calculate(input({stockLength:100,endTrim:100})).purchase.status,'unavailable');
  assert.throws(()=>C.calculate(input({stockLength:100,spliceAllowance:100})),/겹침/);
});
test('exact end fits and tails shorter than the saw kerf',()=>{
  for(const length of [6000,5999,5997,2998.5]){const rows=[{code:'A',name:'test',length,count:2,totalLength:2*length/1000}];verifyPlan({rows,totalLength:2*length/1000,purchase:C.planCuts(rows,6000,3,0,3.44)});}
});
test('top and bottom profiles independently change the internal cut height',()=>{
  const r=C.calculate(input({members:{outerTop:member('r100x50'),outerBottom:member('h100')}}));
  assert.equal(r.innerWidth,3900);assert.equal(r.innerHeight,1850);assert.equal(r.rows.find(x=>x.role==='innerVertical').length,1850);
  assert.equal(r.purchase.groups.length,3);assert.equal(r.rows.find(x=>x.role==='outerTop').profile.unitWeight,7.01);assert.equal(r.rows.find(x=>x.role==='outerBottom').profile.unitWeight,17.2);verifyPlan(r);
});
test('left/right and top/bottom side members use each actual profile width',()=>{
  const r=C.calculate(input({planes:2,depth:1000,sideVertical:1,sideHorizontal:2,members:{outerRight:member('r100x50'),depthTop:member('75'),depthBottom:member('100'),sideLeftVertical:member('r100x50'),sideRightVertical:member('h100'),sideRightHorizontal:member('75')}}));
  assert.equal(r.geometry.sides.Left.innerDepth,900);assert.equal(r.geometry.sides.Right.innerDepth,800);assert.equal(r.geometry.sides.Left.innerHeight,1825);
  assert.equal(r.rows.find(x=>x.role==='sideLeftVertical').length,1825);
  assert.equal(r.rows.find(x=>x.role==='sideLeftHorizontal').length,400);assert.equal(r.rows.find(x=>x.role==='sideRightHorizontal').length,350);
  assert.equal(r.rows.filter(x=>x.role==='depthTop').length,2);assert.equal(r.rows.filter(x=>x.role==='depthBottom').length,2);verifyPlan(r);
});
test('same stock profile at 90 degrees shares inventory; different stock lengths do not',()=>{
  const same=C.calculate(input({members:{outerTop:member('r100x50'),outerBottom:member('r100x50',1)}}));assert.equal(same.purchase.groups.length,2);verifyPlan(same);
  const different=C.calculate(input({width:10000,members:{outerTop:member('r100x50',0,6000),outerBottom:member('r100x50',1,12000)}}));assert.equal(different.purchase.groups.length,3);assert.equal(different.purchase.extensions.some(e=>e.code==='B2'),false);verifyPlan(different);
});
test('custom material names prevent inventory pooling across different grades',()=>{
  const p={...member('50'),section:'custom',materialName:'SS400'},q={...p,materialName:'SUS304'};
  const r=C.calculate(input({members:{outerTop:p,outerBottom:q}}));assert.equal(r.purchase.groups.length,3);verifyPlan(r);
});
test('invalid input and overlapping geometry are rejected',()=>{
  for(const values of [{width:100},{planes:2,depth:100},{frames:1.5},{height:NaN},{unitWeight:-1},{vertical:101},{planes:3},{kerf:-1},{width:''},{spliceAllowance:-1},{members:{notARole:member('50')}},{members:{outerTop:{section:'unknown'}}},{members:{outerTop:{...member('50'),face:-1}}}])assert.throws(()=>C.calculate(input(values)));
  for(const values of [{sectionDepth:300},{sideVertical:10},{sideHorizontal:38},{height:1100,members:{depthTop:member('h100'),depthBottom:{...member('100'),face:1000}}}])assert.throws(()=>C.calculate(input({planes:2,...values})));
});
test('version 4 settings preserve mixed profiles, stock length and overlap',()=>{
  const r=C.calculate(input({width:10000,planes:2,spliceAllowance:40,members:{outerTop:member('r100x50',1),outerBottom:member('h100',0,12000)}}));
  const p=C.parseProject(JSON.stringify({type:'led-frame-project',version:4,section:'50',family:'square',rotation:0,input:r.input}));
  const restored=C.calculate(p.input);close(restored.totalWeight,r.totalWeight);assert.deepEqual(restored.purchase,r.purchase);assert.deepEqual(restored.input.members,r.input.members);
  assert.throws(()=>C.parseProject('{'));assert.throws(()=>C.parseProject('{}'));
});
test('legacy v2 and v3 settings retain their original dimensions and weight',()=>{
  const old={...C.defaults,unitWeight:3.44,planes:2};delete old.sectionDepth;delete old.sideVertical;delete old.sideHorizontal;delete old.spliceAllowance;
  const p=C.parseProject(JSON.stringify({type:'led-frame-project',version:2,section:'50',input:old}));assert.equal(p.input.sideHorizontal,0);assert.equal(p.section,'custom');const r=C.calculate(p.input);close(r.frameWeight,153.08);assert.equal(r.totalPieces,26);verifyPlan(r);
  for(const section of ['h100','h150','h200x100'])for(const rotation of [0,1]){const v={...C.defaults,...C.presetValues(section,rotation),planes:2,depth:1000};const restored=C.parseProject(JSON.stringify({type:'led-frame-project',version:3,section,family:'hbeam',rotation,input:v}));assert.equal(restored.section,section);assert.equal(restored.rotation,rotation);verifyPlan(C.calculate(restored.input));}
});
test('CSV exports per-material stock, extensions and safe cell values',()=>{
  const csv=C.toCSV(C.calculate(input({width:10000,height:2600,planes:2})),'=UNTRUSTED');assert.equal(csv.charCodeAt(0),0xfeff);assert.ok(csv.includes('"\'=UNTRUSTED"'));assert.ok(csv.includes('"예상 구매 본수","17"'));assert.ok(csv.includes('"연장용 추가 본수","4"'));assert.ok(csv.includes('6000 × 1 + 3900 × 1'));assert.ok(csv.includes('"규격 그룹"'));assert.ok(csv.includes('"절단 패턴"'));
});
test('random mixed material, extensions, quantities and losses conserve every piece',()=>{
  let seed=41;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<160;i++){
    const r=C.calculate(input({width:3000+Math.floor(rand()*24000),height:2000+Math.floor(rand()*8000),vertical:Math.floor(rand()*8),horizontal:Math.floor(rand()*5),frames:1+Math.floor(rand()*30),planes:i%2+1,depth:1200,sideVertical:i%2,sideHorizontal:i%3,stockLength:i%2?6000:12000,kerf:i%4,endTrim:i%3*10,spliceAllowance:i%5*10,members:i%3?{}:{outerTop:member('r100x50'),outerBottom:member('h100'),sideLeftVertical:member('75')}}));verifyPlan(r);
  }
});
test('large batches stay count-based rather than allocating millions of pieces',()=>{
  const r=C.calculate({...C.defaults,width:100000,height:100000,face:1,vertical:100,horizontal:100,frames:1000,planes:2,stockLength:6000});assert.ok(r.totalPieces>20000000);assert.ok(r.purchase.patterns.length<150);verifyPlan(r);
});
