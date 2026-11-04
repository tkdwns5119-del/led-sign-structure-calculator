// Frame posts marked as "기초 지주" reach the foundation column review through the transfer dialog.
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

browserTest('a post marked in the frame tab transfers its pipe section to the foundation column review',async()=>{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),errors=[];
  context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
  try{
    const page=await context.newPage();await page.goto(suiteURL);await page.waitForFunction(()=>window.CalculatorSuite?.getState().ready);
    const frame=page.frames().find(f=>f.name()==='frame-calculator'),foundation=page.frames().find(f=>f.name()==='foundation-calculator');
    await frame.evaluate(()=>{const p=FrameUI.getProject();p.ui.inputMode='detailed';p.materials.push(FramePlanner.material('p318_5','m2'));p.extras=[{id:'post1',name:'지주',materialId:'m2',rotation:0,length:3000,quantity:1,post:true}];FrameUI.loadProject(p);});
    assert.equal(await frame.locator('[data-path="extras.0.post"]').first().isChecked(),true);
    await page.click('#suite-transfer');
    const preview=await page.locator('#transfer-preview').innerText();
    assert.match(preview,/지주 단면/);assert.match(preview,/원형 Ø318\.5×6\.9t · 지주 대당 1개/);
    assert.doesNotMatch(await page.locator('#transfer-warnings').innerText(),/지주/);
    await page.click('#transfer-confirm');await page.waitForFunction(()=>document.getElementById('suite-link-status').dataset.state==='linked');
    const p=await foundation.evaluate(()=>FoundationUI.read());
    assert.deepEqual([p.columnShape,p.columnDiameter,p.columnThickness],['circle',318.5,6.9]);
    assert.match(await page.locator('#suite-message').innerText(),/지주 단면 원형 Ø318\.5×6\.9t을 기둥 검토에 반영/);
    // A shorter post than the plate-to-screen height is flagged before applying.
    await frame.evaluate(()=>{const p=FrameUI.getProject();p.extras[0].length=2000;p.extras[0].quantity=2;FrameUI.loadProject(p);});
    await page.click('#suite-transfer');const warnings=await page.locator('#transfer-warnings').innerText();
    assert.match(warnings,/구조물 지주는 대당 2개인데 기초 배치는 대당 1개/);assert.match(warnings,/지주 길이 2,000 mm가 베이스플레이트~화면 하단 2,700 mm보다 짧습니다/);
  }finally{await context.close();}
  assert.deepEqual(errors,[]);
});
