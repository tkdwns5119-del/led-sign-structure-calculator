const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../dist/foundation/engine.js');
const T=require('../dist/foundation/steel.js');
const C=require('../dist/foundation/estimate.js');
const S=require('../dist/suite-engine.js');
const close=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} ≠ ${b}`);
const steel=r=>r.checks.filter(c=>c.group==='steel');
const check=(r,prefix)=>r.checks.find(c=>c.label.startsWith(prefix));
const tube={columnShape:'circle',columnDiameter:300,columnThickness:6,anchorEmbed:600};

test('without post thickness or anchor embedment the steel rows stay pending and the footing result is unchanged',()=>{
  const base=E.calculate(),r=E.calculate({columnShape:'circle',columnDiameter:300});
  assert.deepEqual(r.g,base.g);assert.equal(r.screenOK,base.screenOK);assert.equal(r.footingOK,true);
  assert.ok(steel(r).every(c=>c.pass===null));
  assert.match(check(r,'지주 강재').status,/미검토 · 입력 필요/);assert.match(check(r,'앵커 · 인장').detail,/묻힘깊이/);
  assert.match(check(E.calculate({anchorCount:0,anchorEmbed:600}),'앵커 · 인장').status,/앵커 없음/);
  assert.match(check(E.calculate({columnShape:'h',columnThickness:8}),'지주 강재').detail,/플랜지 두께/);
  const s=S.status(base,E);assert.equal(s.steelPending,true);
  const pending=S.effectiveStatus(s,[],[]);assert.equal(pending.code,'example');assert.match(pending.detail,/지주·앵커 입력/);
});

test('round tube capacity and base moment follow the hand calculation',()=>{
  const s=T.section(tube),d=288;
  close(s.A,Math.PI/4*(300**2-d**2));close(s.Zx,(300**3-d**3)/6);assert.equal(s.Zx,518688);
  const r=E.calculate({...tube,signDepth:0}),row=check(r,'지주 휨·축력');
  // 4 × 2 m sign, 1.5 kPa, centre 4 m above ground, base plate on the 0.3 m neck top, γW = 1.6.
  const Mu=12*3.7*1.6,phiMn=0.9*275*518688/1e6,upper=(8*45+250)*9.80665/1000,Pu=1.2*upper;
  const phiPn=row.detail.match(/φPn ([\d.]+)/)[1]*1;
  close(row.demand,Pu/(2*phiPn)+Mu/phiMn,1e-3);assert.match(row.detail,/φMn 128\.38/);assert.equal(row.pass,true);
  assert.match(row.detail,/조밀/);
  const deflection=check(r,'지주 상단 처짐');assert.equal(deflection.pass,null);assert.equal(deflection.status,'참고');
  const I=Math.PI/64*(300**4-d**4),x=3700,L=4700;close(deflection.demand,12000*x*x*(3*L-x)/(6*210000*I));close(deflection.capacity,47);
});

test('anchor tension, concrete breakout and pullout reproduce the ACI 318 Ch.17 hand values',()=>{
  const r=E.calculate({...tube,signDepth:0}),upper=(8*45+250)*9.80665/1000;
  // 8 × M30 on a 500 × 500 plate, 75 mm edge: bolts at ±175 and 0, Σy² = 6 × 175².
  const T1=(12*3.7*1.6*1e6*175/(6*175**2)-0.9*upper*1000/8)/1000;
  const Ase=Math.PI/4*(30-0.9382*3.5)**2;close(Ase,560.586,1e-5);
  const steelRow=check(r,'앵커 강재 인장');close(steelRow.demand,T1);close(steelRow.capacity,0.75*Ase*410/1000);
  // Three tension bolts at y = 175 in an 800 × 800 neck: edges 225 / 225 / 575 / 225 < 1.5hef → hef' = 575 / 1.5.
  const hef=575/1.5,ANc=800*800,ANco=9*hef*hef,psiEd=0.7+0.3*225/(1.5*hef),Nb=3.9*Math.sqrt(27)*hef**(5/3);
  const cone=check(r,'앵커 콘크리트 콘');close(cone.demand,3*T1);close(cone.capacity,0.70*ANc/ANco*psiEd*Nb/1000);
  assert.equal(cone.pass,false);assert.match(cone.detail,/적용 hef 383 mm/);
  const Abrg=0.866*45**2-Math.PI/4*900;close(check(r,'앵커 뽑힘').capacity,0.70*8*Abrg*27/1000);
  close(check(E.calculate({...tube,anchorHead:'hooked'}),'앵커 뽑힘').capacity,0.70*0.9*27*90*30/1000);
  const shear=check(r,'앵커 강재 전단');close(shear.demand,12*1.6/8);close(shear.capacity,0.65*0.6*Ase*410*0.8/1000);
  close(check(E.calculate({...tube,groutThickness:0}),'앵커 강재 전단').capacity,0.65*0.6*Ase*410/1000);
  const combined=check(r,'앵커 인장·전단 조합');close(combined.demand,3*T1/cone.capacity);assert.equal(combined.capacity,1);
  assert.equal(check(r,'앵커 최소 간격').pass,true);assert.equal(check(r,'앵커 묻힘깊이').capacity,1000+1500-75);
});

test('a failing post or anchor fails the verdict but keeps the automatic footing size',()=>{
  const base=E.calculate(),r=E.calculate(tube);
  assert.equal(r.search.found,true);assert.equal(r.footingOK,true);assert.equal(r.screenOK,false);assert.deepEqual(r.g,base.g);
  assert.match(r.warnings[0],/지주·앵커 검토 미충족.*콘크리트 콘 파괴/);
  assert.equal(S.status(r,E).code,'failed');
  const light=E.calculate({...tube,pressure:0.6,plateThickness:25}),lightBase=E.calculate({pressure:0.6});
  assert.equal(light.screenOK,true);assert.deepEqual(light.g,lightBase.g);assert.ok(steel(light).every(c=>c.pass!==false));
  assert.equal(S.status(light,E).steelPending,false);
  // A minimum-type row reads as limit / actual, so generous spacing never governs.
  assert.doesNotMatch(S.governing(light).label,/최소 간격/);
});

test('square tubes and H-shapes use the slenderness and lateral-torsional limits',()=>{
  const slender=E.calculate({columnShape:'rect',columnWidth:200,columnDepth:200,columnThickness:4.5,anchorEmbed:600}),row=check(slender,'지주 휨·축력');
  assert.equal(row.pass,false);assert.equal(row.status,'적용 범위 밖');assert.match(row.detail,/세장/);
  const box=E.calculate({columnShape:'rect',columnWidth:200,columnDepth:250,columnThickness:9,pressure:0.6,anchorEmbed:600});
  const s=T.section(box.p);close(s.Zx,(200*250**2-182*232**2)/4);assert.equal(check(box,'지주 휨·축력').pass,true);
  const h={columnShape:'h',columnWidth:200,columnDepth:200,columnThickness:8,columnFlange:12};
  const hs=T.section(h);assert.equal(hs.Zx,200*12*188+8*176**2/4);close(hs.Zy,12*200**2/2+176*8**2/4);
  const m=T.flexure(hs,275,4700),Mp=275*hs.Zx;
  assert.ok(m.x<Mp&&m.x>0.7*275*hs.Sx,'Lp < Lb < Lr gives inelastic lateral-torsional buckling');
  assert.equal(T.flexure(hs,275,1000).x,Mp);assert.equal(m.y,Math.min(275*hs.Zy,1.6*275*hs.Sy));
  const hr=E.calculate({...h,anchorEmbed:600});assert.match(check(hr,'지주 휨·축력').detail,/횡비틀림 Lb 4700 mm/);
});

test('invalid steel inputs are rejected and unsupported foundation types never judge steel',()=>{
  assert.throws(()=>E.calculate({columnShape:'circle',columnDiameter:100,columnThickness:50}),/외경의 절반/);
  assert.throws(()=>E.calculate({columnShape:'h',columnWidth:200,columnDepth:200,columnThickness:8,columnFlange:100}),/H형강 치수/);
  assert.throws(()=>E.calculate({anchorFy:500,anchorFu:400}),/인장강도는 항복강도 이상/);
  assert.throws(()=>E.calculate({anchorHead:'glued'}),/정착 형태/);
  const t=E.types.combined,r=E.calculate({type:'combined',mode:'manual',...t,...tube});
  assert.ok(steel(r).every(c=>c.pass===null&&c.demand===null));assert.equal(r.screenOK,false);
  const line=E.calculate({...tube,plateShape:'circle',plateDiameter:500,anchorCount:2,anchorAngle:0});
  assert.equal(check(line,'앵커 강재 인장').pass,false);assert.match(check(line,'앵커 강재 인장').detail,/한 줄/);
});

test('the shared bolt layout matches the accessory drawing positions',()=>{
  for(const p of [{},{plateShape:'circle',plateDiameter:500,columnShape:'circle',anchorCount:6,anchorAngle:30}]){
    const r=E.calculate(p);assert.deepEqual(C.accessory(r).positions,T.anchorPositions(r.p));
  }
  assert.equal(T.threadPitch(30),3.5);assert.equal(T.threadPitch(31),3.5);assert.equal(T.threadPitch(16),2);
});

test('base plate thickness follows Design Guide 1 bearing and anchor-tension bending',()=>{
  const r=E.calculate({...tube,pressure:0.6,plateThickness:25}),thick=check(r,'베이스플레이트 두께'),bearing=check(r,'베이스플레이트 지압');
  // Front wind: bearing resultant C = Σ positive bolt forces (1.2D) + Pu over B = 500, fp = 0.65·0.85·fck·√(A2/A1).
  const upper=(8*45+250)*9.80665/1000,M=0.6*8*3.7*1.6,Pu=1.2*upper,sy=6*175**2;
  const resultant=3*Math.max(0,M*1e6*175/sy-Pu*1000/8)+Pu*1000,fp=0.65*0.85*27*Math.sqrt(800*800/(500*500)),Y=resultant/(fp*500),m=(500-0.8*300)/2;
  close(bearing.demand,Y);close(bearing.capacity,250);
  const Mc=fp*Y*(m-Y/2);close(thick.demand,Math.sqrt(4*Mc/(0.9*265)));assert.equal(thick.capacity,25);assert.equal(thick.pass,true);
  assert.match(thick.detail,/SS275 Fy 265/);
  assert.equal(T.plateFy('SS275',16),275);assert.equal(T.plateFy('SS275',40),265);assert.equal(T.plateFy('SS275',41),245);assert.equal(T.plateFy('SM355',50),335);
  assert.equal(check(E.calculate({...tube,pressure:0.6,plateThickness:16}),'베이스플레이트 두께').pass,false);
  assert.match(check(E.calculate(tube),'베이스플레이트 두께').status,/미검토 · 입력 필요/);
  assert.equal(check(E.calculate({...tube,plateShape:'circle',plateDiameter:500,plateThickness:25}),'베이스플레이트 두께').status,'별도 검토');
  const order=C.accessory(r);assert.equal(order.plate.kg,500*500*25*7.85e-6);assert.match(order.plate.name,/PL 500×500×25 \(SS275\)/);
});

test('automatic connection grows the neck only as far as needed and passes every steel check',()=>{
  const post={columnShape:'circle',columnDiameter:300,columnThickness:8,connectionMode:'auto'};
  const r=E.calculate(post),v=r.connection.values;
  assert.equal(r.connection.found,true);assert.equal(r.connection.neckGrown,true);assert.deepEqual([r.p.cL,r.p.cW,r.g.cL],[900,900,900]);
  assert.ok(steel(r).every(c=>c.pass!==false));assert.equal(r.screenOK,true);assert.ok(r.checks.some(c=>c.label.startsWith('베이스플레이트 두께')&&c.pass===true));
  assert.match(r.warnings[0],/목을 800×800에서 900×900/);
  // The 800 neck has no passing layout, so no lighter answer exists one step smaller.
  const smaller=E.calculate({...post,...v,cL:800,cW:800,connectionMode:'manual'});assert.equal(smaller.screenOK,false);
  // Each chosen value is reproduced by a manual review of the same inputs.
  const manual=E.calculate({...post,...v,connectionMode:'manual'});assert.equal(manual.screenOK,true);assert.deepEqual(manual.g,r.g);
  const light=E.calculate({...post,pressure:0.6});assert.equal(light.connection.neckGrown,false);assert.equal(light.p.cL,800);
  assert.ok(light.connection.mass<r.connection.mass);
  const none=E.calculate({...post,columnThickness:0});assert.equal(none.connection.found,false);assert.match(none.warnings[0],/자동 산정 실패.*두께/);
  const capped=E.calculate({...post,mode:'manual',L:800,W:800,H:1500});assert.equal(capped.connection.found,false);assert.match(capped.connection.reason,/800 mm까지/);
  const combined=E.calculate({type:'combined',mode:'manual',...E.types.combined,...post});assert.equal(combined.connection,null);
});
