const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const P=require('../dist/planner.js'),V=require('../dist/frame-3d.js'),E=require('../dist/export.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('three paired verticals automatically add six depth ties per board to mass, cuts and exports',()=>{
  const p=P.createProject();Object.assign(p.general,{planes:2,quantity:2});p.materials[0].pricePerKg=1000;
  const old=P.clone(p);old.general.verticalDepthTies=false;const prior=P.calculate(old),before=JSON.stringify(p),r=P.calculate(p),ties=r.rows.filter(row=>row.location==='depth');
  assert.equal(r.depthConnectors.length,6);assert.equal(ties.length,6);assert.equal(ties.reduce((n,row)=>n+row.count,0),12);
  assert.ok(ties.every(row=>row.length===500&&row.count===2&&row.materialId==='m1'));
  assert.equal(prior.totalPieces,56);assert.equal(r.totalPieces,68);close(prior.totalLength,91);close(r.totalLength,97);close(r.frameWeight,323.98);
  close(r.frameWeight-prior.frameWeight,20.04);close(r.purchase.allocatedLength-prior.purchase.allocatedLength,6);
  close(r.costs.materials,r.purchase.purchaseWeight*1000);assert.ok(ties.every(tie=>r.purchase.patterns.some(pattern=>pattern.cuts.some(c=>c.rowId===tie.id))));
  const sheet=E.sheets(p,r).find(s=>s.name==='부재산출표');assert.equal(sheet.rows.filter(row=>String(row[0]).startsWith('depth-')).length,6);assert.match(E.csv(p,r),/보강 상하 연결재 전체 수량/);
  assert.equal(V.geometry(p,r).boxes.filter(b=>b.kind==='tie').length,6);assert.equal(JSON.stringify(p),before);
});
test('rotated and mixed-depth verticals use their actual inner faces and section bearing width',()=>{
  const p=P.createProject();p.general.planes=2;Object.assign(p.materials[0],{face:80,depth:40,section:'custom',kgm:5});
  Object.assign(p.front.vertical[0],{position:1200,rotation:1});const r=P.calculate(p),c=r.depthConnectors.find(c=>c.id==='depth-v1-T');
  assert.equal(c.x,1180);assert.equal(c.width,40);assert.equal(c.height,80);assert.equal(c.z,80);assert.equal(c.depth,440);
  assert.equal(c.z+c.depth,600-80);assert.equal(r.rows.find(row=>row.id===c.id).rotation,0);
  const other=r.depthConnectors.find(c=>c.id==='depth-v2-T');assert.equal(other.depth,520);assert.equal(other.width,80);assert.equal(other.height,40);
  const model=V.geometry(p,r);assert.equal(model.boxes.length,r.totalPieces);assert.ok(model.boxes.some(b=>b.kind==='tie'&&b.x===1180&&b.d===440));
});
test('single-face frames and disabled automation do not add depth ties; production rounding still applies',()=>{
  const p=P.createProject();assert.equal(P.calculate(p).depthConnectors.length,0);p.general.planes=2;p.general.verticalDepthTies=false;
  assert.equal(P.calculate(p).depthConnectors.length,0);p.general.verticalDepthTies=true;p.general.depth=600.5;p.cut.precision=1;
  const r=P.calculate(p),tie=r.rows.find(row=>row.id==='depth-v1-T');assert.equal(tie.designLength,500.5);assert.equal(tie.length,501);assert.equal(tie.delta,.5);
  p.front.vertical=[];assert.equal(P.calculate(p).depthConnectors.length,0);
});
test('independent rear members are matched by physical centerline and unmatched positions are reported',()=>{
  const p=P.createProject();p.general.planes=2;p.backLinked=false;p.back=P.clone(p.front);p.back.vertical[0].id='rear-different-id';p.back.vertical[2].position=3300;
  const r=P.calculate(p);assert.equal(r.depthConnectors.length,4);assert.equal(r.connectorWarnings.length,2);
  assert.equal(r.depthConnectors.find(c=>c.frontId==='v1').backId,'rear-different-id');assert.ok(!r.depthConnectors.some(c=>c.frontId==='v3'));
  assert.match(E.csv(p,r),/연결재 자동 산출 제외/);
});
test('missing V5 flags enable automation, explicit choices survive JSON, older format quantities are retained',()=>{
  const p=P.createProject();p.general.planes=2;delete p.general.verticalDepthTies;assert.equal(P.migrate(p).general.verticalDepthTies,true);
  for(const enabled of [true,false]){p.general.verticalDepthTies=enabled;assert.equal(P.parse(JSON.stringify(p)).general.verticalDepthTies,enabled);}
  p.general.verticalDepthTies='yes';assert.throws(()=>P.migrate(p),/자동 추가 설정/);
  const input={...P.legacy.defaults,planes:2},legacy=P.legacy.calculate(input),raw={type:'led-frame-project',version:4,section:'50',family:'square',rotation:0,input:legacy.input},migrated=P.migrate(raw);
  assert.equal(migrated.general.verticalDepthTies,false);close(P.calculate(migrated).totalWeight,legacy.totalWeight);
});
test('impossible tie gaps are rejected rather than producing negative members',()=>{
  const p=P.createProject();p.general.planes=2;p.general.depth=150;p.materials.push({...P.material('100','m2'),face:50,depth:100,section:'custom'});p.front.vertical[0].materialId='m2';
  assert.throws(()=>P.calculate(p),/연결 길이가 0 이하/);
  p.general.depth=600;Object.assign(p.general,{height:200});p.front.vertical[0].materialId='m1';Object.assign(p.materials[0],{depth:100});
  assert.throws(()=>P.calculate(p),/높이 공간/);
});
const root=path.join(__dirname,'..'),runtime=path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node');
let playwright,browser;try{playwright=require(require.resolve('playwright',{paths:[root,runtime]}));}catch{}
before(async()=>{if(playwright)browser=await playwright.chromium.launch({channel:process.env.TEST_BROWSER_CHANNEL||'msedge',headless:true});});after(async()=>{await browser?.close();});
test('offline UI calculates, draws, exports and transfers automatic ties and preserves the option on restore',{skip:!playwright},async()=>{
  const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true}),page=await context.newPage(),errors=[],network=[];
  page.on('pageerror',e=>errors.push(e.message));await context.route(/^https?:\/\//,route=>{network.push(route.request().url());return route.abort();});
  try{
    await page.goto(pathToFileURL(path.join(root,'전광판_구조물_기초_통합계산기.html')).href);await page.waitForFunction(()=>CalculatorSuite.getState().ready);
    const ui=await (await page.$('#frame-calculator')).contentFrame();await ui.locator('[data-frame-shape="2"]').click();
    await ui.locator('[data-path="general.quantity"]').fill('3');await ui.locator('#frame-step-2').click();await ui.locator('#frame-side-settings summary').click();
    assert.equal(await ui.locator('[data-path="general.verticalDepthTies"]').isChecked(),true);assert.match(await ui.locator('#frame-depth-tie-info').innerText(),/6개\/대.*18개/);assert.ok(await ui.locator('polygon[data-kind="tie"]').count());
    const withTies=await ui.evaluate(()=>({p:FrameUI.getProject(),r:FrameUI.getResult().totalWeight}));
    await ui.locator('[data-path="general.verticalDepthTies"]').uncheck();assert.equal(await ui.locator('polygon[data-kind="tie"]').count(),0);close(withTies.r-await ui.evaluate(()=>FrameUI.getResult().totalWeight),30.06);
    await ui.evaluate(p=>FrameUI.loadProject(p),withTies.p);assert.equal(await ui.locator('[data-path="general.verticalDepthTies"]').isChecked(),true);
    await ui.locator('#frame-step-3').click();await ui.locator('#frame-to-foundation').click();await page.locator('#transfer-confirm').click();
    const target=await page.evaluate(()=>CalculatorSuite.getFoundation().getResult().l.upper/9.80665*1000);close(target,withTies.r/3);
    await page.locator('#tab-frame').click();const pending=page.waitForEvent('download');await ui.locator('[data-action="csv"]:visible').first().click();const data=require('node:fs').readFileSync(await (await pending).path(),'utf8');assert.match(data,/depth-v1-T/);assert.match(data,/세로 보강 v1 앞뒤 상단 연결재/);
    assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  }finally{await context.close();}
});
