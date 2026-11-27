// 「간편 진행」: a new user answers four steps once; the frame and foundation calculators are filled and
// linked in the background, results and outputs appear, and the answers survive a reload. Phone layout too.
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');
const {pathToFileURL}=require('node:url');
const root=path.join(__dirname,'..');
const packageRoot=path.join(os.homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','node');
let playwright;try{playwright=require(require.resolve('playwright',{paths:[root,packageRoot]}));}catch{}
let browser;
const suiteURL=pathToFileURL(path.join(root,'전광판_구조물_기초_통합계산기.html')).href;
before(async()=>{if(playwright)browser=await playwright.chromium.launch({channel:process.env.TEST_BROWSER_CHANNEL||'msedge',headless:true});});
after(async()=>{await browser?.close();});
const browserTest=(name,fn)=>test(name,{skip:!playwright?'Playwright is not installed':false},fn);
const ready=page=>page.waitForFunction(()=>window.CalculatorSuite?.getState().ready&&document.querySelector('#guide-root .g-form'));
const next=async page=>{await page.click('[data-guide-move="1"]');await page.waitForTimeout(150);};

browserTest('a new user goes from the place to the result in one flow without entering anything twice',async()=>{
  const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true}),errors=[];
  context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
  try{
    const page=await context.newPage();await page.goto(suiteURL);await ready(page);
    assert.equal(await page.evaluate(()=>document.body.dataset.view),'guide');
    assert.equal(await page.locator('.transfer-bar').isVisible(),false,'designer strip hidden in the guided flow');
    // The first input sits in the first screen.
    const top=(await page.locator('[name=region]').boundingBox()).y;assert.ok(top<450,`region select at ${top}px`);
    await page.selectOption('[name=region]','busan');await page.check('[name=exposure][value=D]');await next(page);
    await page.fill('[name=width]','6');await page.fill('[name=height]','3');await page.fill('[name=bottom]','3');
    await page.check('[name=weight][value=kgm2]');await page.fill('[name=kgm2]','40');await next(page);
    await page.check('[name=posts][value="2"]');await page.fill('[name=spacing]','3.6');await page.selectOption('[name=column]','p318_5');
    // The side preview shows the whole installation in 3D and follows each answer.
    await page.waitForFunction(()=>document.querySelectorAll('#guide-side .g-3d-view polygon').length>50);
    const kinds=await page.evaluate(()=>[...new Set([...document.querySelectorAll('#guide-side .g-3d-view polygon')].map(p=>p.dataset.kind))]);
    for(const kind of ['frame','post','concrete','steel'])assert.ok(kinds.includes(kind),kind+' drawn');
    const view=page.locator('#guide-side .g-3d-view svg'),yaw=await view.getAttribute('data-yaw'),box=await page.locator('#guide-side .g-3d-view').boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+80,box.y+box.height/2,{steps:4});await page.mouse.up();
    assert.notEqual(await page.locator('#guide-side .g-3d-view svg').getAttribute('data-yaw'),yaw,'dragging rotates the 3D');
    await page.click('#guide-side [data-g3d="front"]');assert.equal(await page.locator('#guide-side .g-3d-view svg').getAttribute('data-yaw'),'0.000');
    await next(page);
    const state=await page.evaluate(()=>{const f=CalculatorSuite.getFoundation(),p=f.read(),r=CalculatorSuite.getFrame().getResult();return {p,notes:f.getNotes(),frame:r.general,linked:CalculatorSuite.getState().linked};});
    assert.deepEqual([state.frame.width,state.frame.height],[6000,3000]);
    assert.deepEqual([state.p.signW,state.p.signH,state.p.bottom,state.p.windPoint,state.p.exposure],[6000,3000,3,'busan','D']);
    assert.deepEqual([state.p.installMode,state.p.qty,state.p.foundationSpacing,state.p.columnShape,state.p.columnDiameter],['shared',2,3600,'circle',318.5]);
    assert.ok(Math.abs(state.p.extraKg-40*18)<1e-6,'product weight reaches the foundation');assert.equal(state.notes.weightExample,false);assert.equal(state.linked,true);
    // Result: four plain questions, the footing size and one place for every output.
    assert.equal(await page.locator('#guide-root .plain-card').count(),4);
    assert.ok(await page.locator('#guide-root .g-3d.big .g-3d-view polygon[data-kind="concrete"]').count()>0,'the result opens with the 3D example');
    assert.match(await page.locator('#guide-root').innerText(),/기초 1개 크기/);
    const popup=context.waitForEvent('page');await page.click('[data-guide-click="suite-report"]');const tab=await popup;await tab.waitForLoadState();
    assert.match(await tab.locator('main').innerText(),/구조계산 의뢰 전 사전 검토 자료/);await tab.close();
    const download=page.waitForEvent('download');await page.click('[data-guide-click="suite-solidcraft"]');assert.match((await download).suggestedFilename(),/_SolidCraft\.json$/);
    // The step and every answer come back after a reload (read from the saved calculators).
    await page.evaluate(()=>CalculatorSuite.snapshot());await page.waitForTimeout(600);await page.reload();await ready(page);
    assert.equal(await page.locator('[data-guide-step="4"]').getAttribute('aria-current'),'step');
    await page.click('[data-guide-step="2"]');assert.equal(await page.locator('[name=width]').inputValue(),'6');assert.equal(await page.locator('[name=kgm2]').inputValue(),'40');
    // Designer screens stay available from the same navigation.
    await page.click('#tab-foundation');assert.equal(await page.locator('#panel-foundation').isVisible(),true);assert.equal(await page.locator('.transfer-bar').isVisible(),true);
  }finally{await context.close();}
  assert.deepEqual(errors,[]);
});

browserTest('unknown weights and ground are flagged, missing sizes are explained, and the phone layout fits',async()=>{
  const context=await browser.newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true}),errors=[];
  context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
  try{
    const page=await context.newPage();await page.goto(suiteURL);await ready(page);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no sideways scrolling');
    const nav=await page.locator('.g-nav').boundingBox();assert.ok(nav.y+nav.height<=812&&nav.y>700,'next button pinned to the bottom');
    await next(page);await page.fill('[name=width]','');await page.click('[data-guide-move="1"]');
    assert.match(await page.locator('#guide-error').innerText(),/가로는 0\.1~50 m/);assert.equal(await page.locator('[data-guide-step="2"]').getAttribute('aria-current'),'step');
    await page.fill('[name=width]','4');await page.check('[name=weight][value=unknown]');await next(page);await next(page);
    const text=await page.locator('#guide-root').innerText();
    assert.match(text,/확인 안 된 자료/);assert.match(text,/예시값\(1 m²당 45 kg\)/);assert.match(text,/땅이 버티는 값/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }finally{await context.close();}
  assert.deepEqual(errors,[]);
});
