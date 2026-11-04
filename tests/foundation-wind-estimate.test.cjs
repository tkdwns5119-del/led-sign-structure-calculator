const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const E=require('../dist/foundation/engine.js');
const W=require('../dist/foundation/wind.js');
const C=require('../dist/foundation/estimate.js');
const close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<tol,`${a} ≠ ${b}`);

test('official wind example and exposure boundary formulas are reproduced',()=>{
  const d=W.regional({basicWind:42,height:70,exposure:'D'});
  close(d.kzr,1.499,0.0005);close(d.velocity,42*.98*70**.1);close(d.pressure,.5*1.225*(42*.98*70**.1)**2*1.8*1.5/1000);
  for(const [name,e]of Object.entries(W.exposures)){
    close(W.regional({basicWind:28,height:e.zb,exposure:name}).kzr,e.low);
    close(W.regional({basicWind:28,height:e.zb+1,exposure:name}).kzr,e.c*(e.zb+1)**e.alpha);
    close(W.regional({basicWind:28,height:e.zg+100,exposure:name}).kzr,e.c*e.zg**e.alpha);
  }
  close(W.regional({basicWind:56,height:10}).pressure,4*W.regional({basicWind:28,height:10}).pressure);
});

test('map reference lookup is bounded and does not represent coordinate GIS',()=>{
  const p=W.getPoint('busan');assert.equal(p.v,42);assert.equal(W.nearest(p.x,p.y).id,p.id);
  assert.equal(W.nearest(-1,5),null);assert.equal(W.nearest(NaN,5),null);assert.equal(W.nearest(1,1091),null);
  assert.equal(W.points.length,26);assert.equal(new Set(W.points.map(p=>p.id)).size,26);
  assert.equal(W.source.year,2022);assert.match(W.source.figure,/500년/);
});

test('regional pressure drives geometry and keeps bearing data and per footing loading intact',()=>{
  const a=E.calculate({windMode:'regional',windPoint:'seoul',basicWind:28,qa:233,sideMode:'linked'});
  const b=E.calculate({windMode:'regional',windPoint:'busan',basicWind:42,qa:233,sideMode:'linked'});
  assert.ok(b.q.concrete>a.q.concrete);close(b.l.pressure,a.l.pressure*2.25);assert.equal(b.p.qa,233);assert.equal(b.l.sidePressure,b.l.pressure);
  const n=E.calculate({...b.p,installMode:'repeat',qty:4});close(n.l.front,b.l.front);close(n.total.concrete,b.total.concrete*4);
  const h=E.calculate({...b.p,bottom:20});assert.ok(h.l.pressure>b.l.pressure);assert.ok(h.l.mx>b.l.mx);
});

test('grout uses plate dimensions, product yield and rounding across current item quantity',()=>{
  const r=E.calculate({installMode:'repeat',qty:7}),a=C.accessory(r);
  close(a.liters,70);assert.equal(a.groutBags,6);assert.equal(a.anchors,56);assert.equal(a.templates,7);assert.equal(a.positions.length,8);
  assert.equal(new Set(a.positions.map(p=>p.join(','))).size,8);
  const duo=C.accessory(E.calculate({type:'combined',mode:'manual',L:6500,W:2200,H:1200,qty:3}));close(duo.liters,60);assert.equal(duo.groutBags,6);assert.equal(duo.anchors,48);assert.equal(duo.templates,6);
  const zero=C.accessory(E.calculate({anchorCount:0,groutThickness:0,groundRods:0,elpLength:0}));assert.equal(zero.templates,0);assert.equal(zero.groutBags,0);assert.equal(zero.anchors,0);
  assert.throws(()=>C.calculate(E.calculate({plateL:900})),/플레이트/);assert.throws(()=>C.calculate(E.calculate({anchorCount:6})),/4의 배수/);
});

test('round plates use circular grout area and an evenly spaced rotated bolt circle',()=>{
  const r=E.calculate({plateShape:'circle',plateDiameter:500,columnShape:'circle',columnDiameter:300,anchorCount:6,anchorAngle:30,installMode:'repeat',qty:7}),a=C.accessory(r);
  close(a.area,Math.PI*250**2);close(a.liters,Math.PI*250**2*40*7/1e6);assert.equal(a.groutBags,5);assert.equal(a.anchors,42);assert.equal(a.boltCircleDiameter,350);
  for(let i=0;i<6;i++){
    const [x,y]=a.positions[i],angle=(30+i*60)*Math.PI/180;
    close(Math.hypot(x,y),175);close(x,175*Math.cos(angle));close(y,175*Math.sin(angle));
    close(Math.hypot(x-a.positions[(i+1)%6][0],y-a.positions[(i+1)%6][1]),175);
  }
  const square=C.accessory(E.calculate());assert.equal(square.area,250000);assert.equal(square.liters,10);assert.equal(square.round,false);
  const combined=C.accessory(E.calculate({type:'combined',mode:'manual',L:6500,W:2200,H:1500,plateShape:'circle',columnShape:'circle',qty:3}));
  close(combined.liters,Math.PI*250**2*40*6/1e6);assert.equal(combined.anchors,48);assert.equal(combined.groutBags,4);
});

test('column and plate shapes reject geometric interference without inventing steel weight or wind loads',()=>{
  const round={plateShape:'circle',columnShape:'circle'};
  assert.throws(()=>C.accessory(E.calculate({...round,columnDiameter:400})),/기둥 단면과 겹칩니다/);
  assert.throws(()=>C.accessory(E.calculate({...round,columnDiameter:550})),/플레이트 밖으로/);
  assert.throws(()=>C.accessory(E.calculate({...round,plateDiameter:900})),/지지 콘크리트/);
  assert.throws(()=>C.accessory(E.calculate({plateShape:'circle',columnShape:'rect',columnWidth:400,columnDepth:400,anchorCount:0})),/플레이트 밖으로/);
  assert.throws(()=>C.accessory(E.calculate({plateShape:'circle',columnShape:'rect',columnWidth:300,columnDepth:300})),/기둥 단면과 겹칩니다/);
  assert.throws(()=>C.accessory(E.calculate({plateShape:'circle',plateDiameter:200,anchorEdge:50,anchorCount:32})),/볼트끼리 겹칩니다/);
  assert.throws(()=>E.calculate({columnShape:'hex'}),/기둥 형상/);assert.throws(()=>E.calculate({plateShape:'ellipse'}),/플레이트 형상/);
  const baseline=E.calculate(),actual=E.calculate({...round,plateDiameter:600,columnDiameter:400,postKg:baseline.p.postKg});
  const a=C.accessory(actual);assert.equal(a.boltCircleDiameter,450);assert.deepEqual(actual.g,baseline.g);assert.deepEqual(actual.l,baseline.l);assert.equal(actual.total.rebarGross,baseline.total.rebarGross);
  assert.match(actual.warnings.join(' '),/자중은.*직접 입력/);assert.match(actual.warnings.join(' '),/자체 풍하중.*추가 하중/);
  const mixed=C.accessory(E.calculate({columnShape:'circle',plateShape:'rect'}));assert.equal(mixed.positions.length,8);
  const zero=C.accessory(E.calculate({...round,anchorCount:0,groutThickness:0}));assert.equal(zero.anchors,0);assert.equal(zero.positions.length,0);assert.equal(zero.groutBags,0);assert.equal(zero.boltCircleDiameter,null);
});

test('cost uses full quantities, separate concrete members and kg unit prices',()=>{
  const r=E.calculate({mode:'manual',L:2201,W:2202,H:1001,qty:3});const c=C.calculate(r,{footing:99999,rebar:1180});
  const foot=c.rows.find(x=>x.id==='footing');close(foot.quantity,2.201*2.202*1.001*1.01*3);assert.equal(foot.amount,Math.round(foot.quantity*99999));
  assert.notEqual(foot.amount,Math.round(Number(foot.quantity.toFixed(2))*99999));
  const members=c.rows.filter(x=>['footing','neck'].includes(x.id));close(members.reduce((s,x)=>s+x.quantity,0),r.total.orderedConcrete);
  assert.equal(c.rows.find(x=>x.id==='rebar').unit,'kg');close(c.rows.find(x=>x.id==='rebar').quantity,r.total.rebarGross);
  assert.equal(c.subtotal,c.rows.reduce((s,x)=>s+x.amount,0));assert.equal(c.total,c.subtotal+Math.round(c.subtotal*.1));
  for(const prices of [{footing:-1},{rebar:NaN},{unknown:1}])assert.throws(()=>C.calculate(r,prices),/단가/);
});

test('one-board shared supports scale anchors, grout and footing quantities without pricing steel columns',()=>{
  const r=E.calculate({mode:'manual',qty:3,foundationSpacing:3500}),c=C.calculate(r);
  assert.equal(r.supports.boards,1);assert.equal(r.total.posts,3);assert.equal(c.a.anchors,24);assert.equal(c.a.templates,3);close(c.a.liters,30);
  close(c.rows.find(x=>x.id==='footing').quantity,r.q.footing*1.01*3);close(c.rows.find(x=>x.id==='rebar').quantity,r.r.gross*3);
  assert.match(c.note,/지주·전광판/);assert.ok(!c.rows.some(x=>x.id==='post'));
});

test('shared excavation unions flow into the BOQ and price calculations',()=>{
  const r=E.calculate({mode:'manual',H:1000,qty:3,foundationSpacing:2500}),c=C.calculate(r,{excavation:14000});
  close(r.boq.find(x=>x.name==='터파기 · 자연상태').total,48);assert.match(r.boq.find(x=>x.name==='터파기 · 자연상태').formula,/중복 제거/);
  close(c.rows.find(x=>x.id==='excavation').quantity,48);assert.equal(c.rows.find(x=>x.id==='excavation').amount,672000);
  close(c.rows.find(x=>x.id==='backfill').quantity,r.quantities.backfill);close(c.rows.find(x=>x.id==='surplus').quantity,r.quantities.surplus);
});

test('attached V3 stability can be inflated solely by increasing excavation work space',()=>{
  const source=fs.readFileSync('tests/fixtures/foundation-original-v3.html','utf8');
  const start=source.indexOf('function performCalculations(item)'),end=source.indexOf('// Generate BOQ',start);
  const item={footingL:2200,footingW:2200,footingH:1000,hasNeck:true,neckL:800,neckW:800,neckH:1000,neckAboveGL:300,neckCount:1,dimOw:100,dimTb:100,dimTr:200,dimS:300,qtyN:1,slope:0,rebarRatio:95,soilL:1.2,anchorCount:8,groutThick:40,groundRods:2,elpLength:10,signW:4,signH:3,poleH:5,windSpeed:35};
  const run=arg=>vm.runInNewContext(source.slice(start,end)+'\nperformCalculations(arg)',{arg});
  const original=run(item),expanded=run({...item,dimS:1000});close(original.v_conc_net,5.48);close(original.v_backfill,10.984);close(original.F_wind_kN,15.1263);assert.equal(original.groutBags,2);
  assert.ok(original.isSafe);assert.ok(expanded.safetyFactor>original.safetyFactor*2);
  const p={mode:'manual',L:2200,W:2200,H:1000,signW:4000,signH:3000,bottom:3.5,panelKgM2:0,postKg:0,windMode:'velocity',velocity:35,cf:1.2,gust:1.4,sidePressure:0,stabilize:1};
  const fixed=E.calculate(p),wide=E.calculate({...p,work:1000});close(fixed.l.fsOver,wide.l.fsOver);assert.ok(fixed.l.fsOver<1.5);assert.ok(!fixed.screenOK);
});
