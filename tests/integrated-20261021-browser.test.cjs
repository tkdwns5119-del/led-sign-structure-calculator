// 2026-10-21 improvements: isolated autosave, staged status, transfer warnings, report sheets, mobile layout.
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {pathToFileURL}=require('node:url');
const root=path.join(__dirname,'..');
const packageRoot=path.join(os.homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','node');
let playwright;try{playwright=require(require.resolve('playwright',{paths:[root,packageRoot]}));}catch{}
let browser;
const suiteURL=pathToFileURL(path.join(root,'전광판_구조물_기초_통합계산기.html')).href;
const foundationURL=pathToFileURL(path.join(root,'전광판_기초_철근_계산기.html')).href;
before(async()=>{if(playwright)browser=await playwright.chromium.launch({channel:process.env.TEST_BROWSER_CHANNEL||'msedge',headless:true});});
after(async()=>{await browser?.close();});
const browserTest=(name,fn)=>test(name,{skip:!playwright?'Playwright is not installed':false},fn);
async function withContext(fn,viewport={width:1440,height:1000}){
  const context=await browser.newContext({viewport,acceptDownloads:true}),errors=[];
  context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
  try{await fn(context);}finally{await context.close();}
  assert.deepEqual(errors,[]);
}
async function openSuite(context){const page=await context.newPage();page.on('pageerror',()=>{});await page.goto(suiteURL);await page.waitForFunction(()=>window.CalculatorSuite?.getState().ready);return page;}
const embedded=page=>page.frames().find(f=>f.name()==='foundation-calculator');
async function setField(frame,id,value){await frame.evaluate(([id,value])=>{const e=document.getElementById(id);e.value=String(value);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},[id,value]);}

browserTest('standalone and integrated foundation screens keep separate autosaves',()=>withContext(async context=>{
  const solo=await context.newPage();await solo.goto(foundationURL);await solo.waitForFunction(()=>window.FoundationUI?.getResult());
  await setField(solo,'bottom',7.7);await solo.evaluate(()=>FoundationUI.flush());
  const suite=await openSuite(context);
  assert.equal(await embedded(suite).evaluate(()=>FoundationUI.read().bottom),3,'standalone work does not leak into a new integrated job');
  await setField(embedded(suite),'bottom',4.4);await suite.evaluate(()=>CalculatorSuite.snapshot());await suite.waitForTimeout(600);
  await solo.reload();await solo.waitForFunction(()=>window.FoundationUI?.getResult());
  assert.equal(await solo.evaluate(()=>FoundationUI.read().bottom),7.7,'integrated edits do not overwrite the standalone save');
  const keys=await solo.evaluate(()=>Object.keys(localStorage).sort());
  assert.ok(keys.includes('foundation-project-v7'));assert.ok(keys.includes('led-suite-foundation-project-v7'));assert.ok(!keys.includes('foundation-project-v4'));
  assert.match(await suite.locator('#suite-build').innerText(),/구조물 V\d+ · 기초 V\d+ · \d{4}-\d{2}-\d{2} 빌드/);
}));

browserTest('example data keeps the headline amber and per-board transfer warns about missing product weight',()=>withContext(async context=>{
  const page=await openSuite(context);await page.click('#tab-overview');
  assert.equal(await page.locator('#foundation-status').getAttribute('data-state'),'example');
  assert.match(await page.locator('#foundation-status').innerText(),/예시 조건 충족 · 확정 전/);
  assert.match(await page.locator('#governing-check').innerText(),/\d/);assert.match(await page.locator('#uplift-reference').innerText(),/0\.9D/);
  await page.click('#suite-transfer');const warnings=await page.locator('#transfer-warnings').innerText();
  assert.match(warnings,/0kg/);assert.match(warnings,/88% 줄어듭니다/);assert.match(await page.locator('#transfer-confirm').innerText(),/남기고 적용/);
  await page.check('#keep-product');assert.doesNotMatch(await page.locator('#transfer-warnings').innerText(),/캐비닛 중량이 없습니다/);
  await page.click('#transfer-confirm');await page.waitForFunction(()=>document.getElementById('suite-link-status').dataset.state==='linked');
  assert.equal(await embedded(page).evaluate(()=>FoundationUI.read().panelKgM2),45,'the foundation keeps its product weight');
  const frame=page.frames().find(f=>f.name()==='frame-calculator');await page.click('#tab-frame');
  await frame.fill('#frame-field-general-quantity','5');await page.waitForTimeout(300);
  assert.equal(await page.locator('#suite-link-status').getAttribute('data-state'),'linked','a production quantity change keeps per-board values linked');
  await page.click('#tab-overview');assert.match(await page.locator('#weight-review-status').innerText(),/확인 필요/);
}));

browserTest('integrated workbook adds foundation rebar and check sheets with rounded values and Korean price names',()=>withContext(async context=>{
  const page=await openSuite(context);await page.click('#tab-overview');
  const sheets=await page.evaluate(()=>CalculatorSuite.reportSheets());const names=sheets.map(s=>s.name);
  for(const name of ['통합요약','전체기초항목','기초통합물량','기초철근','기초검토','단가확인'])assert.ok(names.includes(name),name);
  const prices=sheets.find(s=>s.name==='단가확인').rows.slice(1).map(r=>r[0]);assert.ok(prices.includes('터파기'));assert.ok(!prices.includes('excavation'));
  const numbers=sheets.filter(s=>['통합요약','전체기초항목','기초통합물량','기초철근'].includes(s.name)).flatMap(s=>s.rows.flat()).filter(v=>typeof v==='number');
  assert.ok(numbers.every(v=>Math.abs(v*1000-Math.round(v*1000))<1e-6),'quantities are rounded to 3 decimals');
  const summary=sheets[0].rows.map(r=>String(r[1]));assert.ok(summary.every(v=>!/ \/ $/.test(v)),'no dangling separators');
  assert.ok(sheets.find(s=>s.name==='기초철근').rows.some(r=>r[2]==='F1'));
  assert.ok(sheets.find(s=>s.name==='기초검토').rows.some(r=>/0\.9D/.test(r[1])));
  const csv=await Promise.all([page.waitForEvent('download'),page.click('#suite-csv')]).then(([d])=>d.path()).then(p=>fs.readFileSync(p,'utf8'));
  assert.doesNotMatch(csv,/\d\.\d*0000000\d/);
}));

browserTest('candidate table marks the current size and automatic search can be restored after fixing a candidate',()=>withContext(async context=>{
  const page=await openSuite(context);await page.click('#tab-overview');await page.click('#compare-candidates');
  await page.waitForSelector('#candidate-results tr.current');assert.match(await page.locator('#candidate-results tr.current').innerText(),/현재 적용 중/);
  await page.locator('#candidate-results [data-apply-candidate]').first().click();
  assert.equal(await embedded(page).evaluate(()=>FoundationUI.read().mode),'manual');
  await page.click('#restore-auto');assert.equal(await embedded(page).evaluate(()=>FoundationUI.read().mode),'auto');
}));

browserTest('mobile keeps most of the screen for inputs and hides embedded save buttons',()=>withContext(async context=>{
  const page=await openSuite(context);
  for(const view of ['frame','foundation']){
    await page.click('#tab-'+view);const top=await page.evaluate(()=>Math.round(document.querySelector('.workspace').getBoundingClientRect().top));
    assert.ok(top<=180,`${view} workspace starts at ${top}px`);
  }
  assert.equal(await embedded(page).evaluate(()=>getComputedStyle(document.querySelector('body>header')).display),'none','the embedded foundation has no second save bar');
  await page.locator('.project-menu summary').click();
  const [download]=await Promise.all([page.waitForEvent('download'),page.click('[data-foundation-export="xlsx"]')]);
  assert.match(download.suggestedFilename(),/\.xlsx$/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
},{width:390,height:844}));
