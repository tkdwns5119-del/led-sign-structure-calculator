// 3D view: occlusion order, shading, hover info, wheel zoom, pan and the enlarged view.
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const P=require('../dist/planner.js'),V=require('../dist/frame-3d.js');
const root=path.join(__dirname,'..'),dist=path.join(root,'dist');

function depthModel(){const p=P.createProject();p.general.planes=2;const r=P.calculate(p);return V.geometry(p,r);}
const orderOf=(svg)=>[...svg.matchAll(/data-index="(\d+)"/g)].map(m=>Number(m[1])).filter((v,i,a)=>a.indexOf(v)===i);

test('boxes nearer to the viewer are drawn after the boxes they cover',()=>{
  const m=depthModel(),chord=m.boxes.findIndex(b=>b.name==='앞면 하단 외곽'),backChord=m.boxes.findIndex(b=>b.name==='뒷면 하단 외곽'),tie=m.boxes.findIndex(b=>b.kind==='tie'&&b.name.includes('하단'));
  const front=orderOf(V.render(m,{yaw:-.48,pitch:.24,zoom:1}));
  assert.ok(front.indexOf(tie)<front.indexOf(chord),'from the front the front chord covers the tie end');
  assert.ok(front.indexOf(backChord)<front.indexOf(tie),'the back chord is behind the tie');
  const rear=orderOf(V.render(m,{yaw:Math.PI-.48,pitch:.24,zoom:1}));
  assert.ok(rear.indexOf(chord)<rear.indexOf(tie)&&rear.indexOf(tie)<rear.indexOf(backChord),'from behind the order reverses');
});

test('separated boxes follow the separating plane and touching boxes do not create cycles',()=>{
  const boxes=[{x:0,y:0,z:100,w:100,h:100,d:100},{x:0,y:0,z:0,w:100,h:100,d:100}];
  const screen=[{minX:0,maxX:10,minY:0,maxY:10,depth:5},{minX:0,maxX:10,minY:0,maxY:10,depth:5}];
  // Depth grows with z, so the box at z=0 is nearer and must be drawn last.
  assert.deepEqual(V.drawOrder(boxes,screen,[0,0,1]),[0,1]);
  assert.deepEqual(V.drawOrder(boxes,screen,[0,0,-1]),[1,0]);
  const m=depthModel(),svg=V.render(m,{yaw:-.9,pitch:.6,zoom:1});
  assert.equal(orderOf(svg).length,m.boxes.length);assert.ok(!/NaN|Infinity/.test(svg));
});

test('faces are shaded by orientation, outlined, and carry hover info with length and material',()=>{
  const m=depthModel(),svg=V.render(m,{yaw:-.48,pitch:.24,zoom:1});
  const edgeFills=new Set([...svg.matchAll(/fill="(#[0-9a-f]{6})"[^>]*data-kind="edge"/g)].map(x=>x[1]));
  assert.ok(edgeFills.size>=3,'top, front and side faces get different brightness');
  assert.match(svg,/stroke="#[0-9a-f]{6}" stroke-width="0.7"/);
  assert.equal(m.boxes.find(b=>b.name==='앞면 좌측 외곽').info,'앞면 좌측 외곽 · 길이 2,000mm · 50 × 50 × 2.3t');
  const hovered=V.render(m,{yaw:-.48,pitch:.24,zoom:1,hover:0});assert.match(hovered,/stroke="#ffffff" stroke-width="1.6"[^>]*data-hover="true" data-index="0"/);
  const moved=V.render(m,{yaw:-.48,pitch:.24,zoom:1,panX:40,panY:-20});assert.notEqual(moved,svg);assert.match(moved,/<ellipse cx="360.0" cy="360.0"/);
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

test('wheel zoom, shift-drag pan, hover tooltip and the enlarged view work in the frame screen',{skip:!playwright?'Playwright is not installed':false},async()=>{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),problems=[];
  page.on('pageerror',error=>problems.push(error.message));
  try{
    await page.goto(origin+'/frame.html');await page.waitForFunction(()=>window.FrameUI?.getResult()&&window.Frame3D);
    const svg=page.locator('.frame-3d-svg');await svg.scrollIntoViewIfNeeded();const box=await svg.boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height/2;
    const state=()=>page.evaluate(()=>Frame3D.getState());
    const face=page.locator('.frame-3d-svg polygon[data-kind="edge"]').first(),fb=await face.boundingBox();
    await page.mouse.move(fb.x+fb.width/2,fb.y+fb.height/2);const tip=page.locator('.frame-3d-tip');
    await tip.waitFor({state:'visible'});assert.match(await tip.innerText(),/외곽 · 길이 [\d,]+mm · 50 × 50 × 2\.3t/);
    assert.ok(await page.locator('.frame-3d-svg polygon[data-hover="true"]').count()>0,'the hovered member is outlined');
    await page.mouse.move(cx+60,cy);await page.mouse.wheel(0,-100);await page.waitForFunction(()=>Frame3D.getState().zoom>1);
    const zoomed=await state();assert.ok(zoomed.panX!==0,'zooming at the cursor keeps that spot fixed by shifting the view');
    await page.keyboard.down('Shift');await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+80,cy+40,{steps:5});await page.mouse.up();await page.keyboard.up('Shift');
    const panned=await state();assert.ok(panned.panX>zoomed.panX&&panned.panY>zoomed.panY);assert.equal(panned.yaw,zoomed.yaw,'panning does not rotate');
    await page.locator('[data-frame-expand]').click();assert.equal(await page.locator('.frame-3d-widget').evaluate(w=>w.classList.contains('is-expanded')),true);
    const big=await page.locator('.frame-3d-svg').boundingBox();assert.ok(big.width>box.width,'the enlarged view is larger');
    await page.keyboard.press('Escape');assert.equal(await page.locator('.frame-3d-widget').evaluate(w=>w.classList.contains('is-expanded')),false);
    await page.locator('#frame-3d-tools summary').click();await page.locator('[data-frame-camera="reset"]').click();
    const reset=await state();assert.deepEqual([reset.zoom,reset.panX,reset.panY],[1,0,0]);
  }finally{await context.close();}
  assert.deepEqual(problems,[]);
});
