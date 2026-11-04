// Each member's 자재 dropdown lists the registered materials and every standard section;
// picking a standard section registers it as a material and assigns it to that member.
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const root=path.join(__dirname,'..'),dist=path.join(root,'dist');
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

test('a member can switch to a standard section that is not registered yet',{skip:!playwright?'Playwright is not installed':false},async()=>{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),problems=[];
  page.on('pageerror',error=>problems.push(error.message));
  try{
    await page.goto(origin+'/frame.html');await page.waitForFunction(()=>window.FrameUI?.getResult()&&window.FrameUX);
    await page.locator('#frame-input-detailed').click();
    const top=page.locator('select[data-path="front.edges.top.materialId"]');
    const labels=await top.locator('optgroup').evaluateAll(groups=>groups.map(g=>g.label));
    assert.deepEqual(labels,['등록된 자재','표준 규격 · 고르면 자재로 등록']);
    const values=await top.locator('option').evaluateAll(options=>options.map(o=>o.value));
    assert.ok(values.includes('preset:100')&&values.includes('preset:h150'));
    assert.equal(values.includes('preset:50'),false,'the registered default section is not offered twice');
    await top.selectOption('preset:100');
    const project=await page.evaluate(()=>FrameUI.getProject());
    assert.equal(project.materials.length,2);
    const added=project.materials[1];assert.equal(added.section,'100');assert.equal(project.front.edges.top.materialId,added.id);
    assert.equal(project.front.edges.bottom.materialId,project.materials[0].id,'other members keep their material');
    assert.equal(await page.locator('select[data-path="front.edges.top.materialId"]').inputValue(),added.id);
    const labels2=await page.evaluate(()=>Object.fromEntries(FrameUI.getResult().rows.filter(r=>['front-T','front-B'].includes(r.id)).map(r=>[r.id,r.materialLabel])));
    assert.deepEqual(labels2,{'front-T':'100 × 100 × 3.2t','front-B':'50 × 50 × 2.3t'});
    // The new material is now listed under the registered group for every other member.
    const bottomRegistered=await page.locator('select[data-path="front.edges.bottom.materialId"] optgroup[label="등록된 자재"] option').evaluateAll(o=>o.map(x=>x.value));
    assert.deepEqual(bottomRegistered,[project.materials[0].id,added.id]);
    assert.equal(await page.locator('select[data-path="front.edges.bottom.materialId"] option[value="preset:100"]').count(),0);
    assert.match(await page.locator('#notice').textContent(),/자재로 등록/);
  }finally{await context.close();}
  assert.deepEqual(problems,[]);
});
