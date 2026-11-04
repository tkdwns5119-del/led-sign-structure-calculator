const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const E=require('../dist/foundation/engine.js');
const near=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<eps,`${a} ≠ ${b}`);

test('original attached quantity formulas match an independent hand calculation',()=>{
  const file=process.env.FOUNDATION_REFERENCE||path.join(__dirname,'fixtures/foundation-original.html');
  const source=fs.readFileSync(file,'utf8');
  const start=source.indexOf('function performCalculations()'),end=source.indexOf('function generateBOQ(',start);
  const state={footingL:2200,footingW:2200,footingH:1000,hasNeck:true,neckL:800,neckW:800,neckH:1000,neckAboveGL:300,neckCount:1,dimOw:100,dimTb:100,dimTr:200,dimS:300,qtyN:1,slope:0,rebarRatio:95,concExtra:1,rebarExtra:3,soilL:1.2};
  const original=vm.runInNewContext(source.slice(start,end)+';performCalculations();',{state});
  near(original.v_conc_net,5.48);near(original.a_form_total,12);near(original.v_excv_total,18);near(original.v_backfill,10.984);near(original.v_surplus_soil,8.4192);near(original.rebar_kg_gross,536.218);
  const r=E.calculate({mode:'manual',H:1000});
  near(r.q.concrete,original.v_conc_net);near(r.q.form,original.a_form_total);near(r.q.excavation,original.v_excv_total);near(r.q.backfill,original.v_backfill);near(r.q.surplus,original.v_surplus_soil);near(r.oldRebar,original.rebar_kg_gross);
  state.slope=0.5;
  const sloped=vm.runInNewContext(source.slice(start,end)+';performCalculations();',{state});
  near(sloped.v_excv_total,98/3);near(E.calculate({mode:'manual',H:1000,slope:0.5}).q.excavation,98/3);
});

test('biaxial bearing independently satisfies vertical force and moments',()=>{
  const p=E.validate({mode:'manual',L:4000,W:5000,H:1000,eccX:0.1,eccY:0.2}),g=E.geometry(p),q=E.earth(p,g),l=E.loads(p,g,q);
  const L=g.L/1000,W=g.W/1000;
  // Analytic integration of q=N/A +12My*x/(W L^3)+12Mx*y/(L W^3).
  const constant=l.N/(L*W),gx=12*l.my/(W*L**3),gy=12*l.mx/(L*W**3);
  near(constant*L*W,l.N);near(gx*W*L**3/12,l.my);near(gy*L*W**3/12,l.mx);
  near(constant+gx*L/2+gy*W/2,l.qmax);near(constant-gx*L/2-gy*W/2,l.qmin);
});

test('all layers use exact counts and nominal masses; N scales only project quantities',()=>{
  const r=E.calculate({mode:'manual',rebarMode:'manual',bar:19,spacing:200,L:3200,W:2800,H:1000});
  assert.equal(r.r.rows.find(x=>x.code==='F1').count,15);assert.equal(r.r.rows.find(x=>x.code==='F2').count,17);
  near(r.r.rows.find(x=>x.code==='F1').kg,15*3.05*2.25);
  near(r.r.net,r.r.rows.reduce((s,x)=>s+x.count*x.length/1000*E.bars[x.bar].kg,0));
  for(const row of r.r.rows)assert.ok(row.length>0);
  const triple=E.calculate({...r.p,installMode:'repeat',qty:3});near(triple.l.front,r.l.front);near(triple.total.rebarNet,r.r.net*3);near(triple.total.concrete,r.q.concrete*3);
  const n=r.r.neck;assert.equal(n.longN,2*(n.nx+n.ny)-4);near(n.ties.actual*(n.ties.n-1),r.g.cH-2*r.p.neckCover-E.bars[r.p.tieBar].d);
});

test('size, wind and mounting height change automatic footing demand and geometry',()=>{
  const small=E.calculate({}),wide=E.calculate({signW:8000,signH:4000}),high=E.calculate({bottom:12});
  assert.ok(small.search.found&&wide.search.found&&high.search.found);
  const volume=r=>r.g.L*r.g.W*r.g.H;
  assert.ok(volume(wide)>volume(small));assert.ok(volume(high)>volume(small));
  near(wide.l.front/small.l.front,4);near(wide.l.panelKg/small.l.panelKg,4);
  for(const r of [small,wide,high]){assert.equal(r.screenOK,true);assert.ok(r.checks.some(c=>c.pass===null));assert.ok(r.g.L%100===0&&r.g.W%100===0&&r.g.H%100===0);}
});

test('zero wind is valid, loss of contact cannot pass, and failed search is explicit',()=>{
  const calm=E.calculate({pressure:0,sidePressure:0});assert.ok(calm.search.found);near(calm.l.front,0);assert.equal(calm.l.fsSlide,Infinity);
  const fail=E.calculate({mode:'manual',L:2200,W:2200,H:1000,pressure:15,bottom:20});assert.ok(fail.l.kern>1);assert.equal(fail.screenOK,false);assert.equal(fail.checks.find(c=>c.label.startsWith('지반 지지력')).pass,false);
});

test('bounded search failure, groundwater and low bearing pressure are handled',()=>{
  const r=E.calculate({autoMax:2000,autoHMax:500,pressure:20,signW:20000,signH:10000});assert.equal(r.search.found,false);assert.equal(r.screenOK,false);assert.ok(r.warnings.some(w=>w.includes('후보')));
  const dry=E.calculate({mode:'manual',H:1000}),wet=E.calculate({mode:'manual',H:1000,waterDepth:0});near(wet.q.buoyancy,(4.84+0.448)*9.81);assert.ok(wet.l.N<dry.l.N);
  const weak=E.calculate({qa:5});assert.equal(weak.search.found,false);
});

test('unsupported forms never receive a structural pass',()=>{
  for(const type of ['combined','block','mat','strip']){
    const t=E.types[type];const r=E.calculate({type,mode:'manual',...t});assert.equal(r.screenOK,false);assert.ok(r.checks.every(c=>c.pass===null));assert.ok(r.r.rows.length>=4);
  }
  assert.throws(()=>E.calculate({type:'mat',mode:'auto'}),/자동 치수/);
});

test('invalid inputs are rejected instead of coerced to a valid looking answer',()=>{
  for(const bad of [{qty:1.5},{signW:NaN},{qa:0},{above:1500,cH:1000},{mode:'manual',cL:3000,L:2200},{type:'combined',mode:'manual',L:6500,W:2200,H:1200,postSpacing:6000},{mode:'manual',H:250,cover:120}])assert.throws(()=>E.calculate(bad));
  assert.throws(()=>E.calculate({mode:'manual',rebarMode:'manual',neckNX:30,neckNY:30}),/순간격/);
});

test('soil state conversion conserves the natural soil volume',()=>{
  const r=E.calculate({mode:'manual',soilL:1.25,soilC:0.9});near(r.q.surplus/1.25+r.q.backfill/0.9,r.q.excavation);
});

test('shared and repeated layouts distinguish board, foundation and column counts',()=>{
  for(const qty of [1,2,3,32]){
    const r=E.calculate({qty,mode:qty===1?'auto':'manual'});assert.equal(r.supports.boards,1);assert.equal(r.total.foundations,qty);assert.equal(r.total.posts,qty);
    const row=r.boq.find(x=>x.name==='기둥·지주 수량');assert.equal(row.value,1);assert.equal(row.total,qty);
  }
  const repeat=E.calculate({installMode:'repeat',qty:1000});assert.equal(repeat.supports.boards,1000);assert.equal(repeat.total.posts,1000);
  const pair=E.calculate({type:'combined',mode:'manual',L:6500,W:2200,H:1200,qty:3});assert.equal(pair.supports.boards,1);assert.equal(pair.supports.perFoundation,2);assert.equal(pair.total.posts,6);
  for(const type of ['block','mat','strip']){const r=E.calculate({type,mode:'manual',...E.types[type],qty:2});assert.equal(r.supports.known,false);assert.equal(r.total.posts,null);assert.ok(!r.boq.some(x=>x.name==='기둥·지주 수량'));}
});

test('single footings sharing one board split its loads and check the uplift and compression sides',()=>{
  const r=E.calculate({mode:'manual',qty:3,L:3200,W:2800,H:1000,rebarMode:'manual',bar:22,spacing:175});
  assert.equal(r.g.L,3200);assert.equal(r.g.W,2800);assert.equal(r.g.H,1000);assert.equal(r.search,null);assert.ok(r.checks.some(c=>c.pass!==null&&c.group!=='steel'));
  near(r.total.concrete,r.q.concrete*3);near(r.total.rebarNet,r.r.net*3);assert.ok(r.warnings.some(w=>w.includes('나눠 받칩니다')));
  // Board totals stay in l; each footing takes a third, and the outer footing gets ±ΔN = M·xmax/Σx².
  const s=r.l.share,spacing=E.defaults.foundationSpacing/1000,arm=r.l.center-r.g.above/1000;
  near(s.footing.front,r.l.front/3);near(s.footing.upper,r.l.upper/3);near(s.lever,spacing/(2*spacing*spacing));
  near(s.dN,r.l.side*arm/(2*spacing)+r.l.upper*Math.abs(r.p.eccX)/(2*spacing));
  near(s.uplift.N,s.compression.N-2*s.dN);near(r.l.N,s.uplift.N);near(r.l.qmax,Math.max(s.uplift.qmax,s.compression.qmax));
  const one=E.calculate({mode:'manual',L:3200,W:2800,H:1000,rebarMode:'manual',bar:22,spacing:175});assert.ok(r.l.fsOver>one.l.fsOver,'a third of the wind per footing is easier to hold than all of it');
  const auto=E.calculate({qty:2,mode:'auto',foundationSpacing:3000});assert.equal(auto.search.found,true);assert.ok(auto.g.L<=3000);assert.equal(auto.footingOK,true);
  assert.equal(E.calculate({qty:2,installMode:'repeat'}).search.found,true);
  const unsupported=E.calculate({type:'combined',mode:'manual',...E.types.combined,qty:2});assert.ok(unsupported.checks.every(c=>c.pass===null));assert.ok(unsupported.warnings.some(w=>w.includes('지원하지 않아')));
});

test('shared layout reports overlap and outlying supports and validates count and spacing',()=>{
  const overlap=E.calculate({mode:'manual',qty:3,L:3200,foundationSpacing:2000});assert.ok(overlap.warnings.some(w=>w.includes('기초가 겹칩니다')));
  const wide=E.calculate({mode:'manual',qty:3,foundationSpacing:3500,signW:6000});assert.ok(wide.warnings.some(w=>w.includes('전광판 폭 밖')));
  for(const bad of [{mode:'manual',qty:33},{mode:'manual',qty:2,foundationSpacing:0},{installMode:'invalid'}])assert.throws(()=>E.calculate(bad));
});

test('shared trench unions remove overlap with a split integral when slopes begin intersecting',()=>{
  const flat=E.calculate({mode:'manual',H:1000,qty:3,foundationSpacing:2500});near(flat.q.excavation,18);near(flat.total.excavation,48);assert.equal(flat.quantities.mergedExcavation,true);
  const slope=E.calculate({mode:'manual',H:1000,qty:3,foundationSpacing:4000,slope:0.5});near(slope.total.excavation,280/3);near(slope.q.excavation*3,98);
  for(const r of [flat,slope])near(r.quantities.surplus/r.p.soilL+r.quantities.backfill/r.p.soilC,r.total.excavation);
  const subbase=E.calculate({mode:'manual',H:1000,qty:3,foundationSpacing:2300});near(subbase.quantities.lean,1.68);near(subbase.quantities.stone,3.36);
  const repeat=E.calculate({mode:'manual',H:1000,qty:3,foundationSpacing:2300,installMode:'repeat'});near(repeat.total.excavation,54);near(repeat.quantities.lean,1.728);assert.equal(repeat.quantities.mergedExcavation,false);
});

test('new footing defaults and automatic candidates use at least 1500mm thickness',()=>{
  assert.equal(E.defaults.H,1500);assert.ok(Object.values(E.types).every(t=>t.H>=1500));assert.equal(E.calculate({mode:'manual'}).g.H,1500);
  for(const p of [{},{pressure:0,sidePressure:0},{signW:8000,signH:4000}]){const r=E.calculate(p);assert.equal(r.search.found,true);assert.ok(r.g.H>=1500);}
  const capped=E.calculate({autoHMax:1400});assert.equal(capped.search.found,false);assert.equal(capped.search.count,0);
  assert.equal(E.calculate({mode:'manual',H:1800}).g.H,1800);assert.equal(E.calculate({mode:'manual',H:1000}).g.H,1000);
});
