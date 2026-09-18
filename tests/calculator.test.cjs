const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../dist/calculator.js');
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-5,`${actual} != ${expected}`);
function verifyPlan(result){
  const p=result.purchase;
  assert.equal(p.status,'ready');
  const counts=Object.fromEntries(result.rows.map(r=>[r.code,0]));
  for(const pattern of p.patterns){
    assert.ok(Number.isInteger(pattern.repeat)&&pattern.repeat>0);
    const material=pattern.cuts.reduce((n,c)=>n+c.length*c.count,0);
    close(material+pattern.kerfLoss+pattern.trimLoss+pattern.remainder,result.input.stockLength);
    assert.ok(pattern.remainder>=0&&pattern.kerfLoss>=0);
    for(const cut of pattern.cuts)counts[cut.code]+=cut.count*pattern.repeat;
  }
  for(const row of result.rows)assert.equal(counts[row.code],row.count);
  close(p.grossLength,result.totalLength+p.remainder+p.kerfLoss+p.trimLoss);
}
test('single frame hand calculation and procurement',()=>{
  const r=C.calculate(C.defaults);
  assert.equal(r.totalPieces,11);close(r.totalLength,21.25);close(r.frameWeight,73.1);
  assert.equal(r.purchase.stockCount,4);close(r.purchase.purchaseWeight,82.56);verifyPlan(r);
});
test('two faces and corner connectors scale with assembly quantity',()=>{
  const r=C.calculate({...C.defaults,planes:2,frames:2,equipment:100});
  assert.equal(r.totalPieces,52);close(r.totalLength,89);close(r.totalWeight,506.16);
  const connector=r.rows.find(row=>row.code==='E');assert.equal(connector.count,8);assert.equal(connector.length,500);verifyPlan(r);
});
test('no reinforcement and fractional bay length preserve quantities',()=>{
  const simple=C.calculate({...C.defaults,vertical:0,horizontal:0});
  assert.equal(simple.rows.length,2);assert.equal(simple.totalPieces,4);close(simple.totalLength,11.8);verifyPlan(simple);
  verifyPlan(C.calculate({...C.defaults,width:4099,vertical:2,horizontal:3,frames:17,endTrim:10,kerf:2.4}));
});
test('oversize prevents a misleading purchasing count, without losing BOM',()=>{
  const r=C.calculate({...C.defaults,stockLength:2000});
  assert.equal(r.purchase.status,'oversize');assert.ok(r.purchase.oversize.includes('B'));assert.equal(r.purchase.stockCount,undefined);close(r.totalLength,21.25);
  assert.equal(C.calculate({...C.defaults,stockLength:100,endTrim:100}).purchase.status,'unavailable');
});
test('exact fit and a tail narrower than kerf conserve stock',()=>{
  for(const length of [6000,5999,5997,2998.5]){
    const rows=[{code:'A',name:'test',length,count:2,totalLength:2*length/1000}];
    const purchase=C.planCuts(rows,6000,3,0,3.44);
    verifyPlan({rows,totalLength:2*length/1000,purchase,input:{stockLength:6000}});
  }
});
test('invalid dimensions and counts are rejected',()=>{
  for(const values of [{width:100},{planes:2,depth:100},{frames:1.5},{height:NaN},{unitWeight:-1},{vertical:101},{planes:3},{kerf:-1},{width:''}])assert.throws(()=>C.calculate({...C.defaults,...values}));
});
test('settings round-trip, mismatched preset and corrupt file',()=>{
  const p={type:'led-frame-project',version:2,section:'50',input:{...C.defaults,planes:2}};
  assert.deepEqual(C.parseProject(JSON.stringify(p)),{input:p.input,section:'50'});
  p.input.unitWeight=3.7;assert.equal(C.parseProject(JSON.stringify(p)).section,'custom');
  assert.throws(()=>C.parseProject('{'));assert.throws(()=>C.parseProject('{}'));
  p.input.frames=-1;assert.throws(()=>C.parseProject(JSON.stringify(p)));
});
test('CSV contains complete purchasing inputs and results, and escapes cells',()=>{
  const csv=C.toCSV(C.calculate(C.defaults),'=UNTRUSTED');
  assert.equal(csv.charCodeAt(0),0xfeff);assert.ok(csv.includes('"\'=UNTRUSTED"'));assert.ok(csv.includes('"예상 구매 본수","4"'));
  assert.ok(csv.includes('"원자재 길이(mm)","6000"'));assert.ok(csv.includes('"73.100000"'));assert.ok(csv.includes('"절단 패턴"'));
});
test('varied geometry and large batches conserve every piece and millimetre',()=>{
  let seed=41;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<120;i++){
    const r=C.calculate({...C.defaults,width:3000+Math.floor(rand()*5000),height:2000+Math.floor(rand()*3000),vertical:Math.floor(rand()*8),horizontal:Math.floor(rand()*5),frames:1+Math.floor(rand()*30),planes:i%2+1,stockLength:12000,kerf:i%4,endTrim:i%3*10});
    verifyPlan(r);
  }
  const large=C.calculate({...C.defaults,width:100000,height:100000,face:1,vertical:100,horizontal:100,frames:1000,planes:2,stockLength:100000});
  assert.ok(large.totalPieces>20000000);assert.ok(large.purchase.patterns.length<100);verifyPlan(large);
});
