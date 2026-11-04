const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const root=path.join(__dirname,'..'),dist=path.join(root,'dist');
const packageRoot=path.join(os.homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','node');
let playwright;try{playwright=require(require.resolve('playwright',{paths:[root,packageRoot]}));}catch{}
let browser,server,origin;const problems=[];
before(async()=>{
  if(!playwright)return;
  browser=await playwright.chromium.launch({channel:process.env.TEST_BROWSER_CHANNEL||'msedge',headless:true});
  server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),target=path.resolve(dist,'.'+(pathname==='/'?'/index.html':pathname));if(!target.startsWith(dist+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(target,(error,data)=>{if(error){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.js':'application/javascript','.css':'text/css','.html':'text/html'})[path.extname(target)]||'application/octet-stream');res.end(data);});});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
async function pageFor(url=origin){
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage();
  page.on('pageerror',e=>problems.push(e.message));await page.goto(url);await page.waitForFunction(()=>window.CalculatorSuite?.getState().ready);await page.frameLocator('#frame-calculator').locator('#frame-input-detailed').click();return {context,page};
}
async function applyTransfer(page){await page.click('#suite-transfer');await page.click('#transfer-confirm');}
const browserTest=(name,fn)=>test(name,{skip:!playwright?'Playwright is not installed':false},fn);
browserTest('offline single HTML loads both isolated calculators without any network request',async()=>{
  const context=await browser.newContext(),page=await context.newPage(),network=[];page.on('pageerror',e=>problems.push(e.message));
  await context.route(/^https?:\/\//,route=>{network.push(route.request().url());return route.abort();});
  await page.goto(pathToFileURL(path.join(root,'전광판_구조물_기초_통합계산기.html')).href);await page.waitForFunction(()=>window.CalculatorSuite?.getState().ready);
  assert.deepEqual(network,[]);assert.equal(await page.locator('#suite-loading').isHidden(),true);
  const state=await page.evaluate(()=>({frame:CalculatorSuite.getFrame().getResult().totalWeight,foundation:CalculatorSuite.getFoundation().getResult().p.signW}));
  assert.equal(state.frame,70.975);assert.equal(state.foundation,4000);await applyTransfer(page);
  assert.equal(await page.locator('#suite-link-status').getAttribute('data-state'),'linked');await context.close();
});
browserTest('transfer preserves site conditions, footing count, all prices and per-board loads',async()=>{
  const {context,page}=await pageFor();
  const expected=await page.evaluate(()=>{
    const api=CalculatorSuite,f=api.getFoundation(),raw=JSON.parse(JSON.stringify(f.snapshot())),item=raw.project.items[0];
    Object.assign(item.p,{qty:3,mode:'manual',qa:175,mu:0.45,pressure:1.8});raw.prices.rebar=2300;f.loadProject(raw);
    const p=api.getFrame().getProject();p.general.quantity=5;p.general.planes=2;p.general.extraEquipment=100;Object.assign(p.cabinet,{enabled:true,weightEach:12});api.getFrame().loadProject(p);
    return api.getFrame().getResult().totalWeight/5;
  });
  await applyTransfer(page);const state=await page.evaluate(()=>({p:CalculatorSuite.getFoundation().read(),project:CalculatorSuite.snapshot(),upper:CalculatorSuite.getFoundation().getResult().l.upper}));
  assert.equal(state.p.qty,3);assert.equal(state.p.qa,175);assert.equal(state.p.mu,0.45);assert.equal(state.p.pressure,1.8);assert.equal(state.p.mode,'manual');assert.equal(state.p.signDepth,600);assert.equal(state.p.extraKg,100);
  assert.ok(Math.abs(state.upper-expected*9.80665/1000)<1e-8);assert.equal(state.project.foundation.prices.rebar,2300);assert.equal(state.project.frame.general.quantity,5);
  assert.equal(await page.locator('#panel-foundation').isVisible(),true);await context.close();
});
browserTest('integrated JSON download restores both projects and rejects bad bundles atomically',async()=>{
  const {context,page}=await pageFor();await page.fill('#suite-name','시험 통합 작업');await applyTransfer(page);
  const pending=page.waitForEvent('download');await page.click('#suite-save');const download=await pending,raw=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
  assert.match(download.suggestedFilename(),/시험 통합 작업/);assert.equal(raw.format,'led-integrated-project');assert.equal(raw.link.active,0);
  const verified=await page.evaluate(raw=>{
    const api=CalculatorSuite;const original=JSON.stringify(api.snapshot()),bad=JSON.parse(JSON.stringify(raw));bad.frame.general.width=5000;bad.foundation.project.items[0].p.signW=-1;
    let error;try{api.load(bad);}catch(e){error=e.message;}const unchanged=JSON.stringify(api.snapshot())===original;
    const changed=api.getFrame().getProject();changed.general.width=6000;api.getFrame().loadProject(changed);api.load(raw);return {error,unchanged,restored:api.snapshot()};
  },raw);
  assert.ok(verified.error);assert.equal(verified.unchanged,true);assert.equal(verified.restored.frame.general.width,4000);assert.equal(verified.restored.name,'시험 통합 작업');
  await page.reload();await page.waitForFunction(()=>window.CalculatorSuite?.getState().ready);assert.equal(await page.locator('#suite-name').inputValue(),'시험 통합 작업');
  assert.equal(await page.evaluate(()=>CalculatorSuite.getState().linked),true);await context.close();
});
browserTest('editing linked dimensions marks them stale and invalid inputs cannot replace saved results',async()=>{
  const {context,page}=await pageFor();await applyTransfer(page);await page.click('#tab-frame');
  const frame=page.frameLocator('#frame-calculator');await frame.locator('[data-path="general.width"]').fill('5000');
  await page.waitForFunction(()=>document.getElementById('suite-link-status').dataset.state==='stale');
  assert.equal(await page.evaluate(()=>CalculatorSuite.getFoundation().read().signW),4000);await applyTransfer(page);
  assert.equal(await page.evaluate(()=>CalculatorSuite.getFoundation().read().signW),5000);
  await page.click('#tab-frame');await frame.locator('[data-path="general.width"]').fill('');
  await page.waitForFunction(()=>document.getElementById('suite-save').disabled);assert.equal(await page.locator('#suite-transfer').isDisabled(),true);
  await page.waitForTimeout(600);const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('led-integrated-project-v1')));assert.equal(saved.frame.general.width,5000);
  await frame.locator('[data-path="general.width"]').fill('5000');await page.waitForFunction(()=>!document.getElementById('suite-save').disabled);await context.close();
});
browserTest('both calculators retain XLSX and foundation DXF export inside the integrated screen',async()=>{
  const {context,page}=await pageFor();const frame=page.frameLocator('#frame-calculator');await frame.locator('[data-tab="report"]').click();
  let pending=page.waitForEvent('download');await frame.locator('[data-action="xlsx"]').click();let d=await pending;assert.ok(fs.readFileSync(await d.path()).subarray(0,2).equals(Buffer.from('PK')));
  // The embedded foundation's single-calculator exports live in the suite's work menu (2026-10-21).
  await page.click('#tab-foundation');await page.locator('.project-menu summary').click();
  pending=page.waitForEvent('download');await page.click('[data-foundation-export="xlsx"]');d=await pending;assert.ok(fs.readFileSync(await d.path()).subarray(0,2).equals(Buffer.from('PK')));
  await page.locator('.project-menu summary').click();pending=page.waitForEvent('download');await page.click('[data-foundation-export="drawing"]');d=await pending;assert.match(fs.readFileSync(await d.path(),'utf8'),/AC1015/);await context.close();
});
browserTest('keyboard tabs, legacy imports, responsive layout and new-work backup remain usable',async()=>{
  const {context,page}=await pageFor();await page.locator('#tab-frame').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#tab-foundation').getAttribute('aria-selected'),'true');
  await page.keyboard.press('End');assert.equal(await page.locator('#panel-overview').isVisible(),true);
  const kept=await page.evaluate(()=>{const api=CalculatorSuite,f=api.getFoundation(),raw=JSON.parse(JSON.stringify(f.snapshot()));raw.project.items[0].p.signW=7000;api.load(raw);const original=f.read().signW;const p=api.getFrame().getProject();p.general.width=4500;api.load(p);return {original,after:f.read().signW};});
  assert.equal(kept.original,7000);assert.equal(kept.after,7000);
  const pending=page.waitForEvent('download');await page.locator('.project-menu summary').click();await page.click('#suite-new');const backup=JSON.parse(fs.readFileSync(await (await pending).path(),'utf8'));assert.equal(backup.foundation.project.items[0].p.signW,7000);
  assert.equal(await page.evaluate(()=>CalculatorSuite.getFoundation().read().signW),4000);
  await page.setViewportSize({width:390,height:844});await page.click('#tab-overview');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);assert.equal(await page.locator('#suite-transfer').isVisible(),false,'the transfer bar is hidden on the mobile summary');
  await page.click('#tab-frame');assert.equal(await page.locator('#suite-transfer').isVisible(),true);await context.close();
  assert.deepEqual(problems,[]);
});
