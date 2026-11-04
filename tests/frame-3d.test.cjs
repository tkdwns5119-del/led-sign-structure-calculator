const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const P=require('../dist/planner.js'),V=require('../dist/frame-3d.js');
const root=path.join(__dirname,'..'),runtime=path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node');
let playwright;try{playwright=require(require.resolve('playwright',{paths:[root,runtime]}));}catch{}
let browser;
before(async()=>{if(playwright)browser=await playwright.chromium.launch({channel:process.env.TEST_BROWSER_CHANNEL||'msedge',headless:true});});
after(async()=>{await browser?.close();});
test('3D members follow the calculated face, side and rotated profile geometry without changing fabrication data',()=>{
  for(const planes of [1,2]){
    const p=P.createProject();p.general.planes=planes;p.general.quantity=3;p.materials[0].face=80;p.materials[0].depth=40;
    p.front.vertical[0].rotation=1;p.front.vertical[0].position=1000;
    p.left.vertical=[P.reinforcement('sv1')];p.rightLinked=false;p.right.horizontal=[];
    const r=P.calculate(p),before=JSON.stringify({p,r}),model=V.geometry(p,r);
    assert.equal(model.boxes.length,r.rows.reduce((n,row)=>n+row.count/3,0));
    const rotated=model.boxes.find(b=>b.name==='앞면 세로 보강 v1');assert.equal(rotated.x,980);assert.equal(rotated.w,40);assert.equal(rotated.d,80);
    assert.equal(model.bounds.max[0],r.general.width);assert.equal(model.bounds.max[1],r.general.height);
    if(planes===2){assert.equal(model.bounds.max[2],600);assert.ok(model.boxes.some(b=>b.name==='좌측면 세로 보강 sv1'));assert.ok(!model.boxes.some(b=>b.name==='우측면 가로 보강 h1'));}
    assert.equal(JSON.stringify({p,r}),before);
  }
});
test('cabinet-derived outer dimensions and extras are represented independently of installation positions',()=>{
  const p=P.createProject();Object.assign(p.cabinet,{enabled:true,width:640,height:480,columns:10,rows:6});
  p.extras=[{id:'post',name:'별도 지주',materialId:'m1',rotation:0,length:3500,quantity:12}];
  const r=P.calculate(p),model=V.geometry(p,r),extras=model.boxes.filter(b=>b.kind==='extra');
  assert.equal(model.general.width,6400);assert.equal(model.general.height,2880);assert.equal(extras.length,4);assert.ok(extras.every(b=>b.x>6400&&b.h===3500));
  const sample=V.geometry(p,r,{posts:true});assert.ok(sample.boxes.filter(b=>b.kind==='extra').every(b=>b.y===2880));
});
test('dense assemblies have a bounded visual representation and finite projections',()=>{
  const p=P.createProject();p.general.width=50000;p.general.height=50000;
  p.front.vertical=Array.from({length:100},(_,i)=>P.reinforcement('v'+i));p.front.horizontal=Array.from({length:100},(_,i)=>P.reinforcement('h'+i));
  const model=V.geometry(p,P.calculate(p));assert.equal(model.boxes.length,350);assert.ok(model.omitted>0);
  const svg=V.render(model,{yaw:-.48,pitch:.24,zoom:1});assert.ok(!/NaN|Infinity/.test(svg));assert.match(svg,/polygon/);
});
const browserTest=(name,fn)=>test(name,{skip:!playwright?'Playwright unavailable':false},fn);
async function withPage(fn,{suite=false,mobile=false}={}){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1100},hasTouch:mobile,isMobile:mobile}),page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));await context.route(/^https?:\/\//,route=>{requests.push(route.request().url());return route.abort();});
  try{
    await page.goto(pathToFileURL(path.join(root,suite?'전광판_구조물_기초_통합계산기.html':'dist/frame.html')).href);
    if(suite)await page.waitForFunction(()=>CalculatorSuite?.getState().ready);
    const ui=suite?await (await page.$('#frame-calculator')).contentFrame():page;
    await ui.waitForFunction(()=>Frame3D&&FrameUI.getResult());await ui.locator('#frame-3d-tools summary').click();await fn({page,ui,context});assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  }finally{await context.close();}
}
browserTest('3D examples, screen overlay and 2D switching are offline and leave project inputs and results unchanged',async()=>withPage(async({ui})=>{
  const before=await ui.evaluate(()=>JSON.stringify({p:FrameUI.getProject(),weight:FrameUI.getResult().totalWeight}));
  for(const example of ['flat','depth','posts']){
    await ui.locator('[data-frame-example]').selectOption(example);assert.match(await ui.locator('.frame-3d-caption').innerText(),/예시만 보기/);
    assert.equal(await ui.evaluate(()=>JSON.stringify({p:FrameUI.getProject(),weight:FrameUI.getResult().totalWeight})),before);
  }
  assert.ok(await ui.locator('polygon[data-kind="extra"]').count());await ui.locator('[data-frame-screen]').check();assert.ok(await ui.locator('polygon[data-kind="screen"]').count());
  await ui.locator('[data-frame-preview="2d"]').click();assert.equal(await ui.locator('#frame-simple-diagram').isVisible(),true);assert.equal(await ui.locator('.frame-3d-output').isVisible(),false);
  await ui.locator('[data-frame-preview="3d"]').click();await ui.locator('[data-frame-example]').selectOption('current');
  await ui.locator('[data-path="general.width"]').fill('5200');assert.match(await ui.locator('.frame-3d-caption').innerText(),/5,200/);
  await ui.locator('[data-path="general.width"]').fill('0');assert.equal(await ui.locator('.frame-3d-svg').count(),0);assert.match(await ui.locator('.frame-3d-output').innerText(),/입력 오류/);
},{suite:true}));
browserTest('pointer and keyboard rotation, fixed camera views and zoom keep working after SVG redraws',async()=>withPage(async({page,ui})=>{
  const svg=ui.locator('.frame-3d-svg');await svg.scrollIntoViewIfNeeded();const box=await svg.boundingBox(),before=await ui.evaluate(()=>Frame3D.getState());
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+50,box.y+box.height/2+25,{steps:5});await page.mouse.up();
  await ui.waitForFunction(yaw=>Frame3D.getState().yaw!==yaw,before.yaw);const dragged=await ui.evaluate(()=>Frame3D.getState());assert.notEqual(dragged.pitch,before.pitch);
  await svg.focus();await svg.press('ArrowRight');assert.ok((await ui.evaluate(()=>Frame3D.getState())).yaw>dragged.yaw);await svg.press('+');assert.ok((await ui.evaluate(()=>Frame3D.getState())).zoom>1);
  await ui.locator('[data-frame-camera="front"]').click();assert.equal((await ui.evaluate(()=>Frame3D.getState())).yaw,0);assert.ok(await ui.locator('polygon').count());
  await ui.locator('[data-frame-camera="side"]').click();assert.equal((await ui.evaluate(()=>Frame3D.getState())).yaw,-Math.PI/2);assert.ok(await ui.locator('polygon').count());
  await ui.locator('[data-frame-camera="reset"]').click();assert.equal((await ui.evaluate(()=>Frame3D.getState())).zoom,1);
}));
browserTest('3D is available through simple stages, touch rotation and detailed design on narrow integrated screens',async()=>withPage(async({page,ui,context})=>{
  for(const width of [320,390])for(const step of [1,2,3]){
    await page.setViewportSize({width,height:844});await ui.locator('#frame-step-'+step).click();assert.equal(await ui.locator('.frame-3d-svg').count(),1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await ui.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  const svg=ui.locator('.frame-3d-svg');await svg.scrollIntoViewIfNeeded();const box=await svg.boundingBox(),previous=await ui.evaluate(()=>Frame3D.getState().yaw),session=await context.newCDPSession(page);
  const x=box.x+box.width/2,y=box.y+box.height/2;
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+40,y:y+20}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await ui.waitForFunction(yaw=>Frame3D.getState().yaw!==yaw,previous);await session.detach();
  await ui.locator('#frame-input-detailed').click();await ui.locator('[data-tab="design"]').click();assert.equal(await ui.locator('.frame-3d-svg').count(),1);
  await ui.locator('[data-frame-example]').selectOption('posts');const saved=await ui.evaluate(()=>FrameUI.getProject());saved.id+='-new';await ui.evaluate(p=>FrameUI.loadProject(p),saved);
  assert.equal((await ui.evaluate(()=>Frame3D.getState())).example,'current');
},{suite:true,mobile:true}));
