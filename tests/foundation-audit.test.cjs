const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../dist/foundation/engine.js');
const C=require('../dist/foundation/estimate.js');
const near=(actual,expected,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);

test('current default output agrees with a separate fixed-number calculation',()=>{
  const r=E.calculate({}),c=C.calculate(r);
  assert.deepEqual([r.g.L,r.g.W,r.g.H],[2500,2500,1600]);
  near(r.q.concrete,2.5*2.5*1.6+.8*.8*1);
  near(r.q.orderedConcrete,10.64*1.01);near(r.q.form,2*(2.5+2.5)*1.6+2*(.8+.8)*1);
  near(r.q.excavation,3.3*3.3*2.6);near(r.q.backfill,28.314-10-.8*.8*.7-.729-1.458);
  near(r.l.front,4*2*1.5);near(r.l.mx,12*(3+2/2+1.6+.7));
  near(r.total.rebarNet,4*13*2.35*5.04+20*1.75*3.04+7*2.95248*.56+56*.88107*.56);
  near(r.total.rebarGross,761.4920768*1.03);assert.equal(c.total,4835793);
});

test('rectangular geometry, sloped excavation, buoyancy and forces agree across varied dimensions',()=>{
  for(let i=0;i<48;i++){
    const p={mode:'manual',installMode:'repeat',qty:1+i%4,L:2500+100*(i%17),W:2700+100*(i%13),H:1500+100*(i%8),cL:600+100*(i%4),cW:700+100*(i%3),cH:1000+100*(i%5),above:100*(i%4),slope:(i%5)/4,waterDepth:(i%6)*.5,ow:50*(i%4),work:100+50*(i%5),lean:50+25*(i%3),stone:100+50*(i%4),pressure:(i%7)*.4,sidePressure:(i%3)*.3,bottom:2+(i%5),signW:3000+100*(i%9),signH:1500+100*(i%7),extraForce:(i%4)*.5,extraForceZ:2};
    const r=E.calculate(p),v=r.p;
    const L=v.L/1000,W=v.W/1000,H=v.H/1000,neckA=v.cL*v.cW/1e6,embed=(v.cH-v.above)/1000;
    const depth=embed+H+v.lean/1000+v.stone/1000,BL=L+2*(v.ow+v.work)/1000,BW=W+2*(v.ow+v.work)/1000;
    // Integrate (BL+2sz)(BW+2sz) analytically, independently of the engine's Simpson expression.
    const excavation=BL*BW*depth+v.slope*(BL+BW)*depth**2+4/3*v.slope**2*depth**3;
    near(r.q.excavation,excavation);near(r.q.concrete,L*W*H+neckA*v.cH/1000);
    const submergedFoot=Math.max(0,Math.min(H,embed+H-v.waterDepth)),submergedNeck=Math.max(0,embed-v.waterDepth);
    near(r.q.buoyancy,9.81*(L*W*submergedFoot+neckA*submergedNeck));
    const front=v.signW/1000*v.signH/1000*v.pressure,side=v.signDepth/1000*v.signH/1000*v.sidePressure;
    near(r.l.front,front);near(r.l.side,side);near(r.l.mx,front*(v.bottom+v.signH/2000+embed+H)+v.extraForce*(v.extraForceZ+embed+H));
    near(r.total.concrete,r.q.concrete*v.qty);near(r.total.excavation,excavation*v.qty);
    near(r.quantities.surplus/v.soilL-r.quantities.borrow+r.quantities.backfill/v.soilC,r.total.excavation);
  }
});

test('asymmetric footing grids have the right orientation, finite bar counts and nominal masses',()=>{
  const masses={10:.56,13:.995,16:1.56,19:2.25,22:3.04,25:3.98,29:5.04,32:6.23};
  for(const type of ['single','combined'])for(const bar of [16,19,22,25,29,32]){
    const r=E.calculate({type,mode:'manual',rebarMode:'manual',L:type==='combined'?6500:4200,W:3100,H:1700,bar,spacing:175});
    const [x,y]=r.r.rows;
    assert.equal(x.length,r.g.L-150);assert.equal(y.length,r.g.W-150);assert.ok(y.count>x.count);
    for(const [row,layout,span]of [[x,r.r.x,r.g.W],[y,r.r.y,r.g.L]]){
      assert.ok(layout.actual<=175+1e-8);near(layout.start+(row.count-1)*layout.actual,span-75-r.r.b.d/2);
      // One fewer bar cannot span the same endpoints within the selected maximum spacing.
      assert.ok((span-150-r.r.b.d)/(row.count-2)>175);
    }
    near(r.r.net,r.r.rows.reduce((kg,row)=>kg+row.count*row.length/1000*masses[row.bar],0));
    assert.equal(r.r.rows.find(row=>row.code==='P1').count,r.r.neck.longN*(type==='combined'?2:1));
  }
});

function intervalUnion(intervals){
  intervals.sort((a,b)=>a[0]-b[0]);let length=0,[left,right]=intervals[0];
  for(const [a,b]of intervals.slice(1)){if(a>right){length+=right-left;left=a;right=b;}else right=Math.max(right,b);}
  return length+right-left;
}
test('shared excavation matches numerical integration of the actual union of pit sections',()=>{
  for(const options of [{qty:3,foundationSpacing:2900,slope:0},{qty:4,foundationSpacing:5000,slope:.5},{qty:6,foundationSpacing:4700,slope:1}]){
    const r=E.calculate({mode:'manual',L:2800,W:3200,H:1600,...options}),p=r.p;
    const centers=Array.from({length:p.qty},(_,i)=>i*p.foundationSpacing/1000);
    const BL=(p.L+2*(p.ow+p.work))/1000,BW=(p.W+2*(p.ow+p.work))/1000;
    const depth=(p.cH-p.above+p.H+p.lean+p.stone)/1000,steps=20000,dz=depth/steps;let volume=0;
    for(let i=0;i<steps;i++){
      const z=(i+.5)*dz,half=BL/2+p.slope*z;
      volume+=intervalUnion(centers.map(x=>[x-half,x+half]))*(BW+2*p.slope*z)*dz;
    }
    near(r.total.excavation,volume,1e-5);
  }
});

test('automatic search chooses minimum concrete volume among all admissible grid candidates',()=>{
  for(const options of [{},{signW:6000,signH:2500,bottom:5,aspect:.8},{pressure:0,sidePressure:0,aspect:1.3}]){
    const auto=E.calculate({...options,autoMax:6000}),p=auto.p;let best=Infinity;
    assert.equal(auto.search.found,true);
    for(let H=1500;H<=p.autoHMax;H+=100)for(let W=1500;W<=p.autoMax;W+=100){
      const L=Math.ceil(W*p.aspect/100)*100;if(L>p.autoMax)continue;
      let r;try{r=E.calculate({...p,mode:'manual',L,W,H});}catch{continue;}
      if(r.screenOK&&r.r.criticalFits&&r.r.punchVu<=r.r.punchVc)best=Math.min(best,r.q.concrete);
    }
    near(auto.q.concrete,best);
  }
});

test('anchor geometry rejects overlapping bolts and bolts extending beyond the plate',()=>{
  for(const p of [{anchorCount:32,plateL:200,plateW:200,anchorEdge:50,anchorDiameter:30},{anchorCount:8,anchorEdge:20,anchorDiameter:64}])assert.throws(()=>C.calculate(E.calculate(p)),/앵커 볼트/);
  for(const count of [4,8,12,16,20,24,28,32]){
    const r=E.calculate({anchorCount:count}),a=C.accessory(r);assert.equal(a.positions.length,count);
    for(let i=0;i<count;i++){
      const [x,y]=a.positions[i];assert.ok(Math.abs(x)+r.p.anchorDiameter/2<=r.p.plateL/2);assert.ok(Math.abs(y)+r.p.anchorDiameter/2<=r.p.plateW/2);
      for(let j=0;j<i;j++)assert.ok(Math.hypot(x-a.positions[j][0],y-a.positions[j][1])+1e-9>=r.p.anchorDiameter);
    }
  }
  assert.equal(C.accessory(E.calculate({anchorCount:0,anchorEdge:20,anchorDiameter:64})).positions.length,0);
});

test('both one-post and two-post screens must sit at or above the pedestal top',()=>{
  for(const type of ['single','combined']){
    const p={...E.types[type],type,mode:'manual'};
    assert.throws(()=>E.calculate({...p,bottom:.1}),/목 상단/);
    assert.equal(E.calculate({...p,bottom:.3}).p.bottom,.3);
  }
});

test('a punching perimeter outside the footing does not display zero demand as a valid estimate',()=>{
  const r=E.calculate({mode:'manual',L:2200,W:2200,H:3000}),check=r.checks.find(x=>x.label.startsWith('뚫림전단'));
  assert.equal(r.r.criticalFits,false);assert.equal(check.demand,null);assert.equal(check.capacity,null);assert.equal(check.pass,null);assert.equal(check.status,'적용 범위 밖');
  assert.match(check.detail,/적용하지 않/);
  const valid=E.calculate({}).checks.find(x=>x.label.startsWith('뚫림전단'));assert.ok(valid.demand>0);assert.equal(valid.pass,null);
});
