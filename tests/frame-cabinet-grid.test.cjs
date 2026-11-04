// Cabinet grids put verticals on every column joint; horizontals stay at the top and bottom chords
// unless the middle row joints are explicitly selected (cabinet.midHorizontal).
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const P=require('../dist/planner.js');
const root=path.join(__dirname,'..'),dist=path.join(root,'dist');

function cabinetProject(extra={}){const p=P.createProject();Object.assign(p.cabinet,{enabled:true,width:500,height:500,columns:8,rows:4},extra);return p;}
const positions=list=>list.map(r=>r.position);

test('the cabinet grid keeps only the top and bottom horizontals by default',()=>{
  const p=P.cabinetGrid(cabinetProject());
  assert.equal(P.createProject().cabinet.midHorizontal,false);
  assert.deepEqual(positions(p.front.vertical),[500,1000,1500,2000,2500,3000,3500]);
  assert.deepEqual(p.front.horizontal,[]);
  const r=P.calculate(p);
  assert.equal(r.panels.front.horizontal.length,0);
  assert.equal(r.rows.filter(row=>row.id.startsWith('front-H-')).length,0);
});

test('middle horizontals follow the cabinet row joints only when selected',()=>{
  const p=P.cabinetGrid(cabinetProject({midHorizontal:true}));
  assert.deepEqual(positions(p.front.horizontal),[500,1000,1500]);
  // Turning the option off again removes the middle horizontals but keeps the verticals.
  p.cabinet.midHorizontal=false;P.cabinetHorizontal(p);
  assert.deepEqual(p.front.horizontal,[]);assert.equal(p.front.vertical.length,7);
  // An unlinked back face follows the front when the option changes.
  const q=cabinetProject({midHorizontal:true});q.backLinked=false;P.cabinetGrid(q);
  assert.deepEqual(positions(q.back.horizontal),[500,1000,1500]);
  q.cabinet.midHorizontal=false;P.cabinetHorizontal(q);assert.deepEqual(q.back.horizontal,[]);
  assert.throws(()=>P.calculate(cabinetProject({midHorizontal:'yes'})),/가운데 가로재/);
});

test('older saved projects infer the option from their existing horizontals',()=>{
  const withBars=P.cabinetGrid(cabinetProject({midHorizontal:true}));delete withBars.cabinet.midHorizontal;
  assert.equal(P.parse(JSON.stringify(withBars)).cabinet.midHorizontal,true);
  const plain=P.createProject();delete plain.cabinet.midHorizontal;
  assert.equal(P.parse(JSON.stringify(plain)).cabinet.midHorizontal,false);
});

const packageRoot=path.join(os.homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','node');
let playwright;try{playwright=require(require.resolve('playwright',{paths:[root,packageRoot]}));}catch{}
let browser,server,origin;
before(async()=>{
  if(!playwright)return;
  browser=await playwright.chromium.launch({channel:process.env.TEST_BROWSER_CHANNEL||'msedge',headless:true});
  server=http.createServer((request,response)=>{
    const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname),target=path.resolve(dist,'.'+pathname);
    if(!target.startsWith(dist+path.sep)){response.writeHead(403);return response.end();}
    fs.readFile(target,(error,data)=>{if(error){response.writeHead(404);return response.end();}response.setHeader('Content-Type',({'.js':'application/javascript','.css':'text/css','.html':'text/html'})[path.extname(target)]||'application/octet-stream');response.end(data);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});

test('the frame screen offers the middle horizontal option next to the cabinet grid button',{skip:!playwright?'Playwright is not installed':false},async()=>{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),problems=[];
  page.on('pageerror',error=>problems.push(error.message));
  try{
    await page.goto(origin+'/frame.html');await page.waitForFunction(()=>window.FrameUI?.getResult()&&window.FrameUX);
    // Simple mode: the cabinet settings sit on the first wizard step.
    await page.locator('#frame-cabinet-settings summary').click();
    const option=page.locator('#frame-cabinet-settings [data-path="cabinet.midHorizontal"]');
    assert.equal(await option.isChecked(),false);
    await page.locator('#frame-cabinet-settings [data-action="cabinet-grid"]').click();
    let front=await page.evaluate(()=>FrameUI.getProject().front);
    assert.equal(front.vertical.length,7);assert.equal(front.horizontal.length,0);
    if(!await option.isVisible())await page.locator('#frame-cabinet-settings summary').click();
    await option.check();
    front=await page.evaluate(()=>FrameUI.getProject().front);
    assert.deepEqual(front.horizontal.map(h=>h.position),[500,1000,1500]);
    assert.equal(await page.evaluate(()=>FrameUI.getResult().panels.front.horizontal.length),3);
  }finally{await context.close();}
  assert.deepEqual(problems,[]);
});
