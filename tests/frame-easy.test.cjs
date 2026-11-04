const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const root=path.join(__dirname,'..'),dist=path.join(root,'dist'),packageRoot=path.join(os.homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','node');
let playwright;try{playwright=require(require.resolve('playwright',{paths:[root,packageRoot]}));}catch{}
let browser,server,origin;
before(async()=>{
  if(!playwright)return;
  browser=await playwright.chromium.launch({channel:process.env.TEST_BROWSER_CHANNEL||'msedge',headless:true});
  server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),target=path.resolve(dist,'.'+(pathname==='/'?'/index.html':pathname));
    if(!target.startsWith(dist+path.sep)){res.writeHead(403);res.end();return;}
    fs.readFile(target,(error,data)=>{if(error){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.js':'application/javascript','.css':'text/css','.html':'text/html'})[path.extname(target)]||'application/octet-stream');res.end(data);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
const browserTest=(name,fn)=>test(name,{skip:!playwright?'Playwright is not installed':false},fn);
async function withPage(fn,{suite=false,offline=false,viewport={width:1440,height:1000}}={}){
  const context=await browser.newContext({viewport,acceptDownloads:true}),page=await context.newPage(),errors=[],network=[];
  page.on('pageerror',error=>errors.push(error.message));
  if(offline)await context.route(/^https?:\/\//,route=>{network.push(route.request().url());return route.abort();});
  try{
    await page.goto(offline?pathToFileURL(path.join(root,'전광판_구조물_기초_통합계산기.html')).href:origin+(suite?'/':'/frame.html'));
    if(suite||offline)await page.waitForFunction(()=>window.CalculatorSuite?.getState().ready);
    const ui=suite||offline?await (await page.$('#frame-calculator')).contentFrame():page;
    await ui.waitForFunction(()=>window.FrameUX&&window.FrameUI?.getResult());
    await fn({page,ui,context});assert.deepEqual(errors,[]);if(offline)assert.deepEqual(network,[]);
  }finally{await context.close();}
}
async function openSettings(ui,id){const details=ui.locator('#'+id);if(!await details.evaluate(el=>el.open))await details.locator('summary').first().click();}
const state=ui=>ui.evaluate(()=>FrameUX.getState());
async function step(ui,number){await ui.locator('#frame-step-'+number).click();assert.equal((await state(ui)).step,number);}
async function advancedFixture(ui){
  return ui.evaluate(()=>{
    const p=FrameUI.getProject();p.name='옥상 전광판 제작 검수 '.repeat(4).slice(0,80);
    Object.assign(p.general,{planes:2,width:4800,height:2600,depth:900,quantity:2,extraEquipment:45});
    const custom=JSON.parse(JSON.stringify(p.materials[0]));Object.assign(custom,{id:'custom-profile',name:'현장 지정 자재 '.repeat(7).slice(0,80),section:'custom',face:80,depth:40,t1:3,t2:0,kgm:6.5});p.materials.push(custom);
    p.extras=[{id:'custom-post',name:'현장 지주 '.repeat(9).slice(0,80),materialId:custom.id,rotation:0,length:3400,quantity:2}];
    p.accessories=[{id:'custom-plate',type:'plate',name:'베이스플레이트 특수 치수',width:150,height:150,thickness:10,density:7850,quantity:2,unitPrice:15000}];
    p.inventory=[{id:'stock-custom',materialId:custom.id,length:6000,quantity:5,trim:15}];
    Object.assign(p.cut,{kerf:3.2,endTrim:20,overlap:45,precision:1,objective:'waste'});p.backLinked=false;p.rightLinked=false;p.back.vertical[0].rotation=1;
    FrameUI.loadProject(p);FrameUX.setMode('simple');return FrameUI.getProject();
  });
}
browserTest('simple mode starts with three stages and next, previous and direct stage navigation work',async()=>withPage(async({ui})=>{
  assert.deepEqual(await state(ui),{mode:'simple',step:1});assert.ok(await ui.locator('#frame-prev').count()===0||await ui.locator('#frame-prev').isDisabled());
  assert.equal(await ui.locator('[data-path="general.width"]').isVisible(),true);
  await ui.locator('#frame-next').click();assert.equal((await state(ui)).step,2);assert.equal(await ui.locator('[data-path="materials.0.section"]').isVisible(),true);assert.equal(await ui.locator('[data-path="materials.0.kgm"]').isVisible(),false);
  await ui.locator('#frame-next').click();assert.equal((await state(ui)).step,3);
  await ui.locator('#frame-prev').click();assert.equal((await state(ui)).step,2);await step(ui,1);await step(ui,3);
}));
browserTest('mode and stage changes retain long names, custom material, members, inventory, accessories and cutting details',async()=>withPage(async({ui})=>{
  const original=await advancedFixture(ui),initialWeight=await ui.evaluate(()=>FrameUI.getResult().totalWeight);
  for(const number of [2,3,1])await step(ui,number);
  for(const mode of ['detailed','simple','detailed','simple'])await ui.locator('#frame-input-'+mode).click();
  const current=await ui.evaluate(()=>FrameUI.getProject());
  // Input mode is intentionally stored in project.ui; all fabrication data is
  // invariant when the user changes only the presentation mode or stage.
  delete current.ui;delete original.ui;assert.deepEqual(current,original);assert.equal(await ui.evaluate(()=>FrameUI.getResult().totalWeight),initialWeight);
}));
browserTest('invalid simple dimensions block result navigation, focus their field and disable integrated save and transfer',async()=>withPage(async({page,ui})=>{
  const width=ui.locator('[data-path="general.width"]');await width.fill('0');
  assert.equal(await ui.evaluate(()=>FrameUI.getResult()),null);assert.equal(await width.getAttribute('aria-invalid'),'true');
  await ui.locator('#frame-step-3').click();assert.notEqual((await state(ui)).step,3);assert.equal(await width.evaluate(e=>e===e.ownerDocument.activeElement),true);
  await page.waitForFunction(()=>document.getElementById('suite-save').disabled);assert.equal(await page.locator('#suite-transfer').isDisabled(),true);
  await width.fill('5200');await step(ui,3);assert.equal(await ui.evaluate(()=>FrameUI.getResult().general.width),5200);assert.equal(await page.locator('#suite-save').isDisabled(),false);
},{suite:true}));
browserTest('a fractional reinforcement count retains its invalid draft when navigation is blocked and focuses the count',async()=>withPage(async({ui})=>{
  await step(ui,2);const count=ui.locator('[data-count="front.vertical"]');await count.fill('4.5');
  assert.equal(await ui.evaluate(()=>FrameUI.getResult()),null);await ui.locator('#frame-input-detailed').click();
  assert.deepEqual(await state(ui),{mode:'simple',step:2});assert.equal(await count.inputValue(),'4.5');
  await ui.locator('#frame-step-3').click();assert.equal((await state(ui)).step,2);assert.equal(await count.inputValue(),'4.5');assert.equal(await count.evaluate(e=>e===e.ownerDocument.activeElement),true);
  await count.fill('4');assert.ok(await ui.evaluate(()=>FrameUI.getResult()));await ui.locator('#frame-input-detailed').click();
  assert.equal((await state(ui)).mode,'detailed');assert.equal(await ui.evaluate(()=>FrameUI.getProject().front.vertical.length),4);
}));
browserTest('changing a profile or linked-face checkbox cannot discard an invalid reinforcement count draft',async()=>withPage(async({ui})=>{
  await ui.locator('[data-frame-shape="2"]').click();await step(ui,2);
  const count=ui.locator('[data-count="front.vertical"]');await count.fill('4.5');assert.equal(await ui.evaluate(()=>FrameUI.getResult()),null);
  await ui.locator('[data-path="materials.0.section"]').selectOption('100');assert.equal(await count.inputValue(),'4.5');assert.equal(await ui.evaluate(()=>FrameUI.getResult()),null);
  await openSettings(ui,'frame-side-settings');await ui.locator('[data-path="backLinked"]').uncheck();assert.equal(await count.inputValue(),'4.5');assert.equal(await ui.evaluate(()=>FrameUI.getResult()),null);
  await ui.locator('[data-path="rightLinked"]').uncheck();assert.equal(await count.inputValue(),'4.5');assert.equal(await ui.evaluate(()=>FrameUI.getResult()),null);
  await count.fill('4');assert.ok(await ui.evaluate(()=>FrameUI.getResult()));assert.equal(await ui.evaluate(()=>FrameUI.getProject().materials[0].section),'100');
  assert.equal(await ui.evaluate(()=>FrameUI.getProject().backLinked),false);assert.equal(await ui.evaluate(()=>FrameUI.getProject().rightLinked),false);
}));
browserTest('one real mouse click after editing the reinforcement count reaches results and preserves each existing member',async()=>{
  for(const quantity of [4,20])await withPage(async({page,ui})=>{
    const existing=await ui.evaluate(()=>{
      const p=FrameUI.getProject();p.general.width=50000;const m=FramePlanner.material('75','m2');p.materials.push(m);
      Object.assign(p.front.vertical[0],{materialId:m.id,rotation:1,position:1000});Object.assign(p.front.vertical[1],{rotation:1});Object.assign(p.front.vertical[2],{materialId:m.id});
      FrameUI.loadProject(p);return FrameUI.getProject().front.vertical;
    });
    await step(ui,2);const count=ui.locator('[data-count="front.vertical"]');assert.equal(await count.inputValue(),'3');
    const button=ui.locator('#frame-next');await button.scrollIntoViewIfNeeded();const box=await button.boundingBox();assert.ok(box);
    // Keep the button visible before editing. Focusing with preventScroll
    // avoids a scroll operation racing with browser focus restoration.
    await count.evaluate((input,value)=>{input.focus({preventScroll:true});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,String(value));input.dispatchEvent(new Event('input',{bubbles:true}));},quantity);
    assert.equal(await count.evaluate(e=>e===e.ownerDocument.activeElement),true,'the count is still focused when the calculation button is clicked');
    // A physical click has no locator retry. Its mousedown blurs the count and
    // fires change before the button click, reproducing the lost-click defect.
    await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
    assert.deepEqual(await state(ui),{mode:'simple',step:3},`${quantity} members reach results in one click`);
    const saved=await ui.evaluate(()=>FrameUI.getProject());assert.equal(saved.front.vertical.length,quantity);assert.deepEqual(saved.front.vertical.slice(0,3),existing);assert.ok(await ui.evaluate(()=>FrameUI.getResult()));
  });
});
browserTest('loading a valid project with the same identity clears an invalid count draft and restores normal navigation',async()=>withPage(async({page,ui})=>{
  const valid=await ui.evaluate(()=>FrameUI.getProject());await step(ui,2);const count=ui.locator('[data-count="front.vertical"]');await count.fill('101');
  assert.equal(await ui.evaluate(()=>FrameUI.getResult()),null);await ui.locator('[data-path="materials.0.section"]').selectOption('100');assert.equal(await count.inputValue(),'101');
  assert.equal(await ui.evaluate(()=>FrameUI.hasCountErrors()),true);await page.waitForFunction(()=>document.getElementById('suite-save').disabled);
  await count.focus();assert.equal(await count.evaluate(e=>e===e.ownerDocument.activeElement),true,'the old invalid control still has focus when the saved project replaces it');
  const restored=await ui.evaluate(raw=>FrameUI.loadProject(raw),valid);assert.equal(restored.id,valid.id);assert.equal(await ui.evaluate(()=>FrameUI.hasCountErrors()),false);assert.ok(await ui.evaluate(()=>FrameUI.getResult()));
  await step(ui,2);assert.equal(await count.inputValue(),'3');assert.equal(await count.getAttribute('aria-invalid'),null);
  await step(ui,3);await page.waitForFunction(()=>!document.getElementById('suite-save').disabled);assert.equal(await page.locator('#suite-transfer').isDisabled(),false);
},{suite:true}));
browserTest('cabinet-derived dimensions and product mass are reflected in simple inputs and the result summary',async()=>withPage(async({ui})=>{
  await ui.locator('#frame-cabinet-settings summary').click();await ui.locator('[data-path="cabinet.enabled"]').check();
  for(const [key,value]of Object.entries({width:'640',height:'480',columns:'10',rows:'6',weightEach:'12.5'}))await ui.locator('[data-path="cabinet.'+key+'"]').fill(value);
  assert.equal(await ui.locator('[data-path="general.width"]').isDisabled(),true);assert.equal(await ui.locator('[data-path="general.width"]').inputValue(),'6400');assert.equal(await ui.locator('[data-path="general.height"]').inputValue(),'2880');
  const result=await ui.evaluate(()=>FrameUI.getResult());assert.equal(result.general.width,6400);assert.equal(result.general.height,2880);assert.equal(result.cabinetWeight,750);
  await step(ui,3);assert.match(await ui.locator('#frame-result-size').innerText(),/6[.,]4.*2[.,]88/);assert.match(await ui.locator('#frame-mass-breakdown').innerText(),/캐비닛 750/);
}));
browserTest('adding an optional post keeps its editor open so its name, length and count can be entered immediately',async()=>withPage(async({ui})=>{
  await step(ui,2);await ui.locator('#frame-extra-settings summary').click();await ui.locator('#frame-extra-settings [data-action="add-extra"]').click();
  assert.equal(await ui.locator('#frame-extra-settings').getAttribute('open')!==null,true,'the post editor remains open after adding its row');
  await ui.locator('[data-path="extras.0.name"]').fill('현장 지주');await ui.locator('[data-path="extras.0.length"]').fill('3200');await ui.locator('[data-path="extras.0.quantity"]').fill('2');
  const extra=await ui.evaluate(()=>FrameUI.getProject().extras[0]);assert.equal(extra.name,'현장 지주');assert.equal(extra.length,3200);assert.equal(extra.quantity,2);
  await step(ui,3);assert.ok(await ui.evaluate(()=>FrameUI.getResult().rows.some(row=>row.location==='extra')));
}));
browserTest('editing the unit mass marks a preset as custom in both the visible selector and the calculated project',async()=>withPage(async({ui})=>{
  await step(ui,2);const section=ui.locator('[data-path="materials.0.section"]');await section.selectOption('100');
  assert.equal(await section.inputValue(),'100');await openSettings(ui,'frame-basic-settings');await ui.locator('[data-path="materials.0.kgm"]').fill('6');
  assert.equal(await section.inputValue(),'custom');const values=await ui.evaluate(()=>({material:FrameUI.getProject().materials[0],result:FrameUI.getResult()}));
  assert.equal(values.material.section,'custom');assert.equal(values.material.kgm,6);
  const rows=values.result.rows.filter(row=>row.materialId===values.material.id);assert.ok(rows.length>0);assert.ok(rows.every(row=>row.kgm===6));
  const expectedWeight=rows.reduce((sum,row)=>sum+row.length*row.count/1000*6,0);assert.ok(Math.abs(values.result.frameWeight-expectedWeight)<1e-8);
  await step(ui,3);await step(ui,2);assert.equal(await section.inputValue(),'custom');assert.equal(await ui.locator('[data-path="materials.0.kgm"]').inputValue(),'6');
}));
browserTest('mixed purchase length mode disables the single-length selector and selecting one length changes the actual purchase plan',async()=>withPage(async({ui})=>{
  const before=await ui.evaluate(()=>{
    const p=FrameUI.getProject();Object.assign(p.materials[0],{stockMode:'mixed',selectedLength:6000,stocks:[{length:6000,price:null},{length:10000,price:null}]});
    FrameUI.loadProject(p);return p.materials[0].stocks;
  });
  await step(ui,2);await openSettings(ui,'frame-purchase-settings');const mode=ui.locator('[data-path="materials.0.stockMode"]'),length=ui.locator('[data-path="materials.0.selectedLength"]');
  assert.equal(await mode.inputValue(),'mixed');assert.equal(await length.isDisabled(),true);
  await mode.selectOption('selected');assert.equal(await length.isDisabled(),false);await length.selectOption('10000');
  assert.equal(await ui.evaluate(()=>FrameUI.getProject().materials[0].stockMode),'selected');assert.equal(await ui.evaluate(()=>FrameUI.getProject().materials[0].selectedLength),10000);
  await step(ui,3);const result=await ui.evaluate(()=>FrameUI.getResult()),purchased=result.purchase.patterns.filter(pattern=>pattern.source==='purchase');
  assert.ok(purchased.length>0);assert.ok(purchased.every(pattern=>pattern.length===10000));
  await step(ui,2);await mode.selectOption('mixed');assert.equal(await length.isDisabled(),true);assert.deepEqual(await ui.evaluate(()=>FrameUI.getProject().materials[0].stocks),before);
}));
browserTest('mixed per-bar pricing exposes each supply length and uses its own confirmed price in the purchase total',async()=>withPage(async({ui})=>{
  await ui.evaluate(()=>{const p=FrameUI.getProject();Object.assign(p.materials[0],{stockMode:'mixed',priceMode:'bar',selectedLength:6000,stocks:[{length:6000,price:null},{length:10000,price:null}]});FrameUI.loadProject(p);});
  await step(ui,2);await openSettings(ui,'frame-purchase-settings');const short=ui.locator('[data-path="materials.0.stocks.0.price"]'),long=ui.locator('[data-path="materials.0.stocks.1.price"]');
  assert.equal(await short.isVisible(),true);assert.equal(await long.isVisible(),true);assert.equal(await ui.evaluate(()=>FrameUI.getResult().costs.total),null);
  await short.fill('65000');await long.fill('108000');await step(ui,3);const result=await ui.evaluate(()=>FrameUI.getResult());
  const purchased=result.purchase.patterns.filter(pattern=>pattern.source==='purchase'),prices={6000:65000,10000:108000};assert.ok(purchased.length>0);
  for(const pattern of purchased)assert.equal(pattern.price,prices[pattern.length]);
  const expected=purchased.reduce((sum,pattern)=>sum+prices[pattern.length]*pattern.repeat,0);assert.equal(result.purchase.knownCost,expected);assert.equal(result.costs.total,expected);
  await step(ui,2);await ui.locator('[data-path="materials.0.stockMode"]').selectOption('selected');await ui.locator('[data-path="materials.0.selectedLength"]').selectOption('10000');
  assert.equal(await long.isVisible(),true);assert.equal(await long.inputValue(),'108000');assert.equal(await short.count(),0);
  await ui.locator('[data-path="materials.0.stockMode"]').selectOption('mixed');assert.equal(await short.inputValue(),'65000');assert.equal(await long.inputValue(),'108000');
}));
browserTest('simple edits calculate the same registered mass, transfer it to the foundation and survive JSON restore',async()=>withPage(async({page,ui})=>{
  await ui.locator('[data-path="general.width"]').fill('5200');await ui.locator('[data-path="general.height"]').fill('2800');await ui.locator('[data-path="general.quantity"]').fill('3');await openSettings(ui,'frame-equipment-settings');await ui.locator('[data-path="general.extraEquipment"]').fill('80');
  await step(ui,2);await ui.locator('[data-path="materials.0.section"]').selectOption('100');await openSettings(ui,'frame-basic-settings');await ui.locator('[data-path="materials.0.kgm"]').fill('6');await ui.locator('[data-count="front.vertical"]').fill('4');
  await step(ui,3);const expected=await ui.evaluate(()=>{const p=FrameUI.getProject(),r=FrameUI.getResult();return {width:p.general.width,height:p.general.height,quantity:p.general.quantity,kgm:p.materials[0].kgm,count:p.front.vertical.length,mass:r.totalWeight/p.general.quantity};});
  assert.deepEqual({width:expected.width,height:expected.height,quantity:expected.quantity,kgm:expected.kgm,count:expected.count},{width:5200,height:2800,quantity:3,kgm:6,count:4});
  await ui.locator('#frame-to-foundation').click();assert.equal(await page.locator('#transfer-dialog').isVisible(),true);await page.locator('#transfer-confirm').click();
  const target=await page.evaluate(()=>{const f=CalculatorSuite.getFoundation();return {p:f.read(),mass:f.getResult().l.upper/9.80665*1000};});
  assert.equal(target.p.signW,expected.width);assert.equal(target.p.signH,expected.height);assert.ok(Math.abs(target.mass-expected.mass)<1e-8);
  const pending=page.waitForEvent('download');await page.locator('#suite-save').click();const saved=JSON.parse(fs.readFileSync(await (await pending).path(),'utf8'));
  assert.equal(saved.frame.ui.inputMode,'simple');assert.equal(saved.frame.front.vertical.length,4);
  await page.evaluate(raw=>{const p=CalculatorSuite.getFrame().getProject();p.general.width=8000;CalculatorSuite.getFrame().loadProject(p);CalculatorSuite.load(raw);},saved);
  assert.equal(await ui.evaluate(()=>FrameUI.getProject().general.width),5200);assert.equal(await ui.evaluate(()=>FrameUX.getState().mode),'simple');
},{suite:true}));
browserTest('detailed mode selection is saved in project JSON and restored without changing the project',async()=>withPage(async({ui})=>{
  await ui.locator('#frame-input-detailed').click();const raw=await ui.evaluate(()=>FrameUI.getProject());assert.equal(raw.ui.inputMode,'detailed');
  await ui.locator('#frame-input-simple').click();await ui.evaluate(raw=>FrameUI.loadProject(raw),raw);
  assert.equal((await state(ui)).mode,'detailed');assert.equal(await ui.locator('.tabs [data-tab="design"]').isVisible(),true);
}));
browserTest('offline simple editing and native JSON export preserve custom project data without network access',async()=>withPage(async({page,ui})=>{
  const original=await advancedFixture(ui);await step(ui,3);
  const pending=page.waitForEvent('download');await ui.locator('[data-action="json"]:visible').first().click();const saved=JSON.parse(fs.readFileSync(await (await pending).path(),'utf8'));
  assert.deepEqual(saved.materials,original.materials);assert.deepEqual(saved.extras,original.extras);assert.deepEqual(saved.inventory,original.inventory);assert.deepEqual(saved.accessories,original.accessories);assert.deepEqual(saved.cut,original.cut);assert.equal(saved.ui.inputMode,'simple');
},{suite:true,offline:true}));
browserTest('every simple stage fits 320 and 390 pixels with readable input labels and fields',async()=>withPage(async({page,ui})=>{
  for(const width of [320,390])for(const number of [1,2,3]){
    await page.setViewportSize({width,height:844});await step(ui,number);
    const values=await ui.evaluate(()=>{
      const inputs=[...document.querySelectorAll('input[type="number"]')].filter(e=>e.getClientRects().length&&!e.disabled);
      return {overflow:document.documentElement.scrollWidth>innerWidth,inputs:inputs.map(e=>({font:parseFloat(getComputedStyle(e).fontSize),label:parseFloat(getComputedStyle(e.closest('label')||e.labels[0]).fontSize)}))};
    });
    assert.equal(values.overflow,false,`${width}px stage ${number}`);for(const input of values.inputs){assert.ok(input.font>=16);assert.ok(input.label>=14);}
  }
},{suite:true,viewport:{width:390,height:844}}));

browserTest('picture choices expose only relevant size inputs and preserve depth, member settings and product mass',async()=>withPage(async({ui})=>{
  const before=await ui.evaluate(()=>FrameUI.getProject());
  assert.equal(await ui.locator('[data-path="general.depth"]').count(),0);
  assert.equal(await ui.locator('[data-path="general.extraEquipment"]').isVisible(),false);
  assert.equal(await ui.locator('#frame-3d-tools').evaluate(el=>el.open),false);
  assert.equal(await ui.locator('.frame-3d-svg').isVisible(),true);
  await ui.locator('[data-frame-shape="2"]').click();
  assert.equal(await ui.locator('[data-path="general.depth"]').isVisible(),true);
  assert.equal(await ui.locator('[data-frame-shape="2"]').getAttribute('aria-pressed'),'true');
  await ui.locator('[data-path="general.depth"]').fill('750');
  await ui.locator('[data-frame-shape="1"]').click();
  assert.equal(await ui.locator('[data-path="general.depth"]').count(),0);
  await ui.locator('[data-frame-shape="2"]').click();
  assert.equal(await ui.locator('[data-path="general.depth"]').inputValue(),'750');
  await openSettings(ui,'frame-equipment-settings');await ui.locator('[data-path="general.extraEquipment"]').fill('80');
  await step(ui,2);
  for(const id of ['frame-side-settings','frame-basic-settings','frame-purchase-settings','frame-cut-settings'])assert.equal(await ui.locator('#'+id).evaluate(el=>el.open),false);
  assert.equal(await ui.locator('.frame-3d-svg').isVisible(),true);
  assert.match(await ui.locator('#frame-depth-tie-summary').innerText(),/6개\/대.*6개/);
  const after=await ui.evaluate(()=>FrameUI.getProject());
  assert.deepEqual(after.front,before.front);assert.deepEqual(after.materials,before.materials);assert.equal(after.general.extraEquipment,80);
  await step(ui,3);assert.match(await ui.locator('#frame-mass-breakdown').innerText(),/제품·장비 80/);
},{suite:true,offline:true}));

browserTest('plus and minus update calculated members and automatic ties without changing existing individual settings',async()=>withPage(async({ui})=>{
  const original=await ui.evaluate(()=>{const p=FrameUI.getProject();p.general.planes=2;p.front.vertical[0].position=800;FrameUI.loadProject(p);return FrameUI.getProject().front.vertical;});
  await step(ui,2);
  await ui.locator('[data-frame-count-adjust="front.vertical"][data-delta="1"]').click();
  const added=await ui.evaluate(()=>({p:FrameUI.getProject(),ties:FrameUI.getResult().depthConnectors.length}));
  assert.equal(added.p.front.vertical.length,4);assert.deepEqual(added.p.front.vertical.slice(0,3),original);assert.equal(added.ties,8);
  assert.equal(await ui.locator('polygon[data-frame-part="front.vertical"][data-selected="true"]').count()>0,true);
  await ui.locator('[data-frame-count-adjust="front.vertical"][data-delta="-1"]').click();
  assert.deepEqual(await ui.evaluate(()=>FrameUI.getProject().front.vertical),original);
  const count=ui.locator('[data-count="front.vertical"]');await count.fill('0');await count.dispatchEvent('change');
  await ui.locator('[data-frame-count-adjust="front.vertical"][data-delta="-1"]').click();assert.equal(await count.inputValue(),'0');
  await count.fill('4.5');await ui.locator('[data-frame-count-adjust="front.vertical"][data-delta="1"]').click();
  assert.equal(await count.inputValue(),'4.5');assert.equal(await ui.evaluate(()=>FrameUI.getResult()),null);
}));

browserTest('a physical click on a 3D member focuses the matching control; drag remains a camera gesture',async()=>withPage(async({page,ui})=>{
  await step(ui,2);await openSettings(ui,'frame-3d-tools');await ui.locator('[data-frame-camera="front"]').click();
  const face=ui.locator('polygon[data-frame-part="front.vertical"]').first();await face.click();
  assert.equal(await ui.locator('[data-count="front.vertical"]').evaluate(el=>el===document.activeElement),true);
  assert.equal(await ui.locator('polygon[data-frame-part="front.vertical"][data-selected="true"]').count()>0,true);
  const p=await ui.evaluate(()=>FrameUI.getProject()),svg=ui.locator('.frame-3d-svg');await svg.scrollIntoViewIfNeeded();
  const box=await svg.boundingBox(),yaw=await ui.evaluate(()=>Frame3D.getState().yaw);
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+45,box.y+box.height/2+20,{steps:5});await page.mouse.up();
  await ui.waitForFunction(previous=>Frame3D.getState().yaw!==previous,yaw);
  assert.deepEqual(await ui.evaluate(()=>FrameUI.getProject()),p);
  await ui.locator('button[data-frame-part="front.horizontal"]').click();
  assert.equal(await ui.locator('[data-count="front.horizontal"]').evaluate(el=>el===document.activeElement),true);
  await ui.locator('[data-count="front.horizontal"]').fill('0');await step(ui,3);
  await ui.locator('button[data-frame-part="front.horizontal"]').click();assert.equal((await state(ui)).step,2);
  assert.equal(await ui.locator('[data-count="front.horizontal"]').inputValue(),'0');
},{suite:true,offline:true}));

browserTest('front-back connector shortcut opens its setting and preset selection still supplies the correct unit mass',async()=>withPage(async({ui})=>{
  await ui.locator('[data-frame-shape="2"]').click();await step(ui,2);
  await ui.locator('button[data-frame-part="tie"]').click();
  assert.equal(await ui.locator('#frame-side-settings').evaluate(el=>el.open),true);
  assert.equal(await ui.locator('[data-path="general.verticalDepthTies"]').evaluate(el=>el===document.activeElement),true);
  await ui.locator('[data-path="general.verticalDepthTies"]').uncheck();assert.match(await ui.locator('#frame-depth-tie-summary').innerText(),/꺼짐/);
  await ui.locator('[data-path="materials.0.section"]').selectOption('100');
  assert.equal(await ui.evaluate(()=>FrameUI.getProject().materials[0].kgm),await ui.evaluate(()=>FramePlanner.material('100').kgm));
  await step(ui,1);await ui.locator('[data-frame-shape="1"]').click();
  assert.equal(await ui.locator('button[data-frame-part="tie"]').isVisible(),false);
}));
