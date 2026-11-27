// Office-staff UI in the integrated calculator: traffic-light cards with term help, the request
// reference opened in a new tab and the SolidCraft 3D file download.
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
before(async()=>{if(playwright)browser=await playwright.chromium.launch({channel:process.env.TEST_BROWSER_CHANNEL||'msedge',headless:true});});
after(async()=>{await browser?.close();});
const browserTest=(name,fn)=>test(name,{skip:!playwright?'Playwright is not installed':false},fn);

browserTest('the overview explains results in plain words and exports the reference and the 3D file',async()=>{
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];
  context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
  try{
    const page=await context.newPage();await page.goto(suiteURL);await page.waitForFunction(()=>window.CalculatorSuite?.getState().ready);
    // The foundation calculator's easy result shows the same four questions.
    const foundation=page.frames().find(f=>f.name()==='foundation-calculator');
    await foundation.waitForFunction(()=>document.querySelectorAll('#overview .plain-card').length===4);
    await page.click('#tab-overview');
    const card=page.locator('#plain-overview');await card.waitFor();
    assert.equal(await card.locator('.plain-card').count(),4);
    assert.match(await card.innerText(),/바람에 넘어지거나 밀리지 않나요\?/);assert.match(await card.innerText(),/확인 안 된 자료/);
    // (?) shows a short definition and closes again.
    const term=card.locator('.plain-term[data-term="전도"]');await term.click();
    assert.match(await card.locator('.plain-definition').innerText(),/^전도: 바람에 기초째 넘어가는 것입니다/);assert.equal(await term.getAttribute('aria-expanded'),'true');
    await term.click();assert.equal(await card.locator('.plain-definition').count(),0);
    // The request reference opens in a new tab with the office summary first.
    const popup=context.waitForEvent('page');await page.click('#suite-report');const tab=await popup;await tab.waitForLoadState();
    const text=await tab.locator('main').innerText();
    assert.match(text,/구조계산 의뢰 전 사전 검토 자료/);assert.ok(text.indexOf('1부 · 사무용 요약')<text.indexOf('2부 · 설계자용 상세'));assert.match(text,/구조물\(프레임\) 산출 요약/);
    // The 3D file is a SolidCraft command list with the frame and the foundation.
    const download=page.waitForEvent('download');await page.click('#suite-solidcraft');const file=await download;
    assert.match(file.suggestedFilename(),/_SolidCraft\.json$/);
    const script=JSON.parse(fs.readFileSync(await file.path(),'utf8'));
    assert.ok(script.commands.some(c=>c.params.name==='앞면 좌측 외곽'));assert.ok(script.commands.some(c=>c.params.name==='기초 푸팅'));
    assert.match(await page.locator('#suite-message').innerText(),/SolidCraft/);
  }finally{await context.close();}
  assert.deepEqual(errors,[]);
});
