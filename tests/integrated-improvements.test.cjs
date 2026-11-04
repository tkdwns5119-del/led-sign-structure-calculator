const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../dist/planner.js'),F=require('../dist/foundation/engine.js'),C=require('../dist/foundation/estimate.js'),S=require('../dist/suite-engine.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function project(){return {format:'foundation-project',version:1,project:{name:'통합 검수',active:0,items:[{id:'east',name:'동측',p:{...F.defaults,mode:'manual',installMode:'shared',qty:3,L:2000,W:3000,H:1500,concWaste:5,anchorCount:4},ui:{groundKnown:true,windManual:true}},{id:'west',name:'서측',p:{...F.defaults,mode:'manual',installMode:'repeat',qty:2,L:2000,W:3000,H:1500,concWaste:5,anchorCount:4},ui:{groundKnown:true,windManual:true}}]},prices:{...C.defaultPrices}};}
test('overview distinguishes invalid, unreviewed, failed, missing automatic candidates and preliminary results',()=>{
  assert.equal(S.status(null,F).code,'invalid');
  assert.equal(S.status(F.calculate({...F.defaults,mode:'manual',installMode:'shared',qty:3}),F).code,'unreviewed');
  assert.equal(S.status(F.calculate({...F.defaults,mode:'manual',pressure:20}),F).code,'failed');
  assert.equal(S.status(F.calculate({...F.defaults,mode:'auto',autoMax:2000,autoHMax:1500,pressure:20}),F).code,'no-candidate');
  assert.equal(S.status(F.calculate(F.defaults),F).code,'preliminary');
});
test('site verification requires the selected wind input mode and does not accept an unused map point',()=>{
  const item={p:{...F.defaults,windMode:'pressure',windPoint:'seoul'},ui:{groundKnown:true,windManual:false,windExample:false}};
  assert.ok(S.dataStatus(item).some(text=>/풍하중.*미확인/.test(text)),'a stale map point cannot confirm directly entered pressure');
  item.p.windMode='regional';assert.deepEqual(S.dataStatus(item),[]);
  item.p.windMode='pressure';item.ui.windExample=true;assert.ok(S.dataStatus(item).some(text=>/예시/.test(text)));
  item.ui.windExample=false;item.ui.windManual=true;assert.deepEqual(S.dataStatus(item),[]);
});
test('all-item installation totals conserve concrete, supports and anchors without changing per-board forces',()=>{
  const raw=project(),before=JSON.stringify(raw),single=F.calculate(raw.project.items[0].p),total=S.aggregate(raw,F,C,{east:5,west:1});
  assert.equal(total.boards,7);assert.equal(total.foundations,17);assert.equal(total.posts,17);assert.equal(total.anchors,68);
  // 2 m × 3 m × 1.5 m footing + 0.8 m × 0.8 m × 1 m neck,
  // ordered with 5% allowance for 17 identical foundations.
  close(total.concrete,(9+0.64)*1.05*17);
  close(total.rebar,single.r.gross*17);assert.equal(JSON.stringify(raw),before);
  assert.equal(total.items[0].r.l.upper,single.l.upper);assert.equal(total.items[0].status.code,'unreviewed');
});
test('installation metadata follows stable item IDs through reordering and rejects invalid counts',()=>{
  const raw=project(),counts={east:5,west:2};assert.deepEqual(S.cleanCounts(counts,raw),counts);
  raw.project.items.reverse();assert.deepEqual(S.cleanCounts(counts,raw),counts);
  assert.deepEqual(S.cleanCounts(undefined,raw),{west:1,east:1});
  for(const value of [0,-1,1.5,1001,'5',Infinity,NaN])assert.throws(()=>S.cleanCounts({east:value},raw),/반복 설치/);
  const before=JSON.stringify(raw);assert.throws(()=>S.aggregate(raw,F,C,{east:0}),/반복 설치/);assert.equal(JSON.stringify(raw),before);
});
test('project price completeness names positive-quantity items omitted by a zero price',()=>{
  const raw=project();raw.prices.rebar=0;const total=S.aggregate(raw,F,C);
  assert.ok(total.unpriced.some(row=>row.id==='rebar'&&/철근/.test(row.name)));
  assert.equal(total.unpriced.filter(row=>row.id==='rebar').length,1,'one missing price is reported once across all foundations');
  const supplied=total.items.reduce((sum,item)=>sum+item.cost.total,0);close(total.cost,supplied);
});
test('order detail includes accessory totals and retains volume and procurement cautions',()=>{
  const raw=project();for(const item of raw.project.items)Object.assign(item.p,{groundRods:2,elpLength:6,plateL:500,plateW:500,groutThickness:20,groutYield:10,groutWaste:0});
  const total=S.aggregate(raw,F,C,{east:5,west:1}),find=pattern=>total.boq.find(row=>pattern.test(row.name));
  assert.equal(find(/앵커 M/).quantity,68);assert.equal(find(/앵커 템플릿/).quantity,17);
  assert.equal(find(/접지 동봉/).quantity,34);assert.equal(find(/ELP/).quantity,102);close(find(/그라우트 순체적/).quantity,85);
  // Each layout's order is rounded before independent installations repeat:
  // ceil(3 × 5 L / 10 L) × 5 + ceil(2 × 5 L / 10 L) = 11 bags.
  assert.equal(find(/무수축 몰탈/).quantity,11);
  assert.ok(find(/그라우트 순체적/).notes.some(note=>/중복 합산 금지/.test(note)));
  assert.ok(find(/구조 콘크리트 · 주문량/).notes.some(note=>/중복 합산 금지/.test(note)));
  for(const row of total.boq)assert.ok(row.notes.length>0,`${row.name} has an inspectable quantity basis`);
});
test('version one bundles remain readable and bad installation metadata fails before mutation',()=>{
  const foundation=project(),raw={format:'led-integrated-project',version:1,name:'회귀',frame:P.createProject(),foundation};
  const frameAPI={validateProject:p=>P.migrate(p)},foundationAPI={validateProject:p=>S.clone(p)};
  const clean=S.validate(raw,frameAPI,foundationAPI);assert.deepEqual(clean.installationCounts,{east:1,west:1});assert.equal(clean.massReview,null);
  raw.installationCounts={east:3,west:2};raw.massReview={source:'frame-check',product:true,posts:false,accessories:true};
  const reviewed=S.validate(raw,frameAPI,foundationAPI);assert.deepEqual(reviewed.installationCounts,raw.installationCounts);assert.equal(reviewed.massReview.posts,false);
  raw.installationCounts.east=0;const before=JSON.stringify(raw);assert.throws(()=>S.validate(raw,frameAPI,foundationAPI),/반복 설치/);assert.equal(JSON.stringify(raw),before);
});
test('candidate comparison returns individually evaluated options and leaves input conditions intact',()=>{
  const p={...F.defaults},before=JSON.stringify(p),prices={...C.defaultPrices},result=S.compareCandidates(p,F,C,prices);
  assert.ok(result.evaluated>0);assert.ok(result.alternatives.length>=1&&result.alternatives.length<=3);
  for(const candidate of result.alternatives)if(candidate.r){assert.equal(candidate.r.screenOK,true);assert.ok(candidate.r.r.criticalFits);assert.ok(candidate.r.r.punchVu<=candidate.r.r.punchVc);assert.ok(candidate.estimate.total>0);}
  assert.equal(JSON.stringify(p),before);assert.deepEqual(prices,C.defaultPrices);
  assert.throws(()=>S.compareCandidates({...p,mode:'manual',installMode:'shared',qty:3},F,C,prices),/중앙 1주/);
});
