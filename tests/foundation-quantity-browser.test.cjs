// Quantity-only foundation calculator (2026-10-21): same engine figures, block/combined types, input errors, exports.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const root=path.join(__dirname,'..'),E=require('../dist/foundation/engine.js');
const packageRoot=path.join(os.homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','node');
let playwright;try{playwright=require(require.resolve('playwright',{paths:[root,packageRoot]}));}catch{}
let browser;before(async()=>{if(playwright)browser=await playwright.chromium.launch({channel:process.env.TEST_BROWSER_CHANNEL||'msedge',headless:true});});after(async()=>{await browser?.close();});
const browserTest=(name,fn)=>test(name,{skip:!playwright?'Playwright is not installed':false},fn);
const url=pathToFileURL(path.join(root,'전광판_기초_물량계산기.html')).href;
browserTest('foundation size alone gives excavation, concrete, formwork, backfill and rebar quantities',async()=>{
  const context=await browser.newContext({acceptDownloads:true}),page=await context.newPage(),errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route(/^https?:\/\//,route=>{network.push(route.request().url());return route.abort();});
  await page.goto(url);await page.waitForFunction(()=>window.FoundationQuantity?.getResult());
  const expected=E.calculate({mode:'manual',rebarMode:'manual',installMode:'repeat',qty:3,L:3000,W:2500,H:1500});
  await page.fill('#L','3000');await page.fill('#qty','3');await page.fill('#H','1500');await page.locator('#H').blur();
  const rows=await page.evaluate(()=>FoundationQuantity.getResult().rows);
  for(const name of ['터파기 · 자연상태','구조 콘크리트 · 주문량','되메우기 · 다짐상태','잔토 반출 · 흐트러진 상태','철근 · 할증 포함']){
    const a=rows.find(x=>x.name===name),b=expected.boq.find(x=>x.name===name);assert.ok(Math.abs(a.total-b.total)<1e-9,name);
  }
  assert.ok(!rows.some(x=>x.name==='기둥·지주 수량'));
  await page.selectOption('#type','block');assert.equal(await page.isVisible('#neck-card'),false);
  assert.ok(!(await page.evaluate(()=>FoundationQuantity.getResult().rows.map(x=>x.name))).some(n=>/목/.test(n)));
  await page.click('text=철근 (입력한 규격·간격으로 산출)');await page.uncheck('#rebar-on');assert.ok(!(await page.evaluate(()=>FoundationQuantity.getResult().rows.map(x=>x.name))).some(n=>/철근/.test(n)));
  await page.fill('#L','');await page.locator('#L').blur();assert.match(await page.locator('#error').innerText(),/푸팅 가로/);
  await page.fill('#L','50');await page.locator('#L').blur();assert.match(await page.locator('#error').innerText(),/300~30,000/);
  await page.fill('#L','3000');await page.locator('#L').blur();assert.equal(await page.isVisible('#error'),false);
  const [x]=await Promise.all([page.waitForEvent('download'),page.click('#save-xlsx')]);assert.ok(fs.readFileSync(await x.path()).subarray(0,2).equals(Buffer.from('PK')));
  await page.reload();assert.equal(await page.inputValue('#type'),'block','inputs are remembered');
  assert.deepEqual(network,[]);assert.deepEqual(errors,[]);await context.close();
});
