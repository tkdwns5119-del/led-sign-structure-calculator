const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const {pathToFileURL}=require('node:url');
const root=path.join(__dirname,'..'),dist=path.join(root,'dist');
const packageRoot=path.join(os.homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','node');
let playwright;
try{playwright=require(require.resolve('playwright',{paths:[root,packageRoot]}));}catch{}
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
async function pageFor(url=origin+'/frame.html'){
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage(),problems=[];
 page.on('pageerror',error=>problems.push(error.message));await page.goto(url);await page.waitForFunction(()=>window.FrameUI?.getResult()&&window.FrameUX);await page.locator('#frame-input-detailed').click();return {context,page,problems};
}
const browserTest=(name,fn)=>test(name,{skip:!playwright?'Playwright is not installed':false},fn);
browserTest('invalid frame input keeps focus, explains the field and recovers after leaving its tab',async()=>{
 const {context,page,problems}=await pageFor(),width=page.locator('[data-path="general.width"]');
 await width.fill('0');assert.equal(await width.evaluate(element=>element===document.activeElement),true);
 assert.equal(await width.getAttribute('aria-invalid'),'true');
 const description=await width.getAttribute('aria-describedby');assert.match(await page.locator('#'+description).textContent(),/100.*100,000/);
 assert.equal(await page.evaluate(()=>FrameUI.getResult()),null);assert.equal(await page.locator('[data-action="json"]').isDisabled(),true);
 await page.locator('[data-tab="report"]').click();assert.equal(await page.locator('#errorBox').isVisible(),true);
 await page.locator('[data-action="focus-error"]').click();assert.equal(await width.evaluate(element=>element===document.activeElement),true);
 await width.fill('5000');assert.equal(await width.getAttribute('aria-invalid'),null);assert.equal(await page.locator('#errorBox').isHidden(),true);
 assert.equal(await page.evaluate(()=>FrameUI.getResult().general.width),5000);assert.equal(await page.locator('[data-action="json"]').isDisabled(),false);
 assert.deepEqual(problems,[]);await context.close();
});
browserTest('geometry overlap identifies the reinforcement and opens its editor on demand',async()=>{
 const {context,page}=await pageFor();const position=page.locator('[data-path="front.vertical.0.position"]');
 await position.fill('50');assert.equal(await position.getAttribute('aria-invalid'),'true');assert.match(await page.locator('#errorBox').textContent(),/외곽|겹치/);
 await page.locator('[data-tab="materials"]').click();await page.locator('[data-action="focus-error"]').click();
 assert.equal(await position.evaluate(element=>element===document.activeElement),true);
 await position.fill('');assert.ok(await page.evaluate(()=>FrameUI.getResult()));await context.close();
});
browserTest('frame and face tabs support arrow keys, selection semantics and linked-face skipping',async()=>{
 const {context,page}=await pageFor();const selected=()=>page.locator('.tabs [aria-selected="true"]');
 await page.locator('[data-tab="design"]').focus();await page.keyboard.press('ArrowRight');assert.equal(await selected().getAttribute('data-tab'),'materials');
 assert.equal(await page.locator('#content').getAttribute('role'),'tabpanel');assert.equal(await page.locator('#content').getAttribute('aria-labelledby'),'frame-tab-materials');
 assert.equal(await page.locator('.tabs [tabindex="0"]').count(),1);await page.keyboard.press('End');assert.equal(await selected().getAttribute('data-tab'),'projects');
 await page.keyboard.press('Home');assert.equal(await selected().getAttribute('data-tab'),'design');
 await page.locator('[data-path="general.planes"]').focus();await page.locator('[data-path="general.planes"]').selectOption('2');assert.equal(await page.locator('[data-path="general.planes"]').evaluate(element=>element===document.activeElement),true);
 await page.locator('[data-face="front"]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('.face-tabs [aria-selected="true"]').getAttribute('data-face'),'left');
 assert.equal(await page.locator('#frame-face-editor').getAttribute('aria-labelledby'),'frame-face-left');
 assert.equal(await page.locator('[data-face="left"]').evaluate(element=>element===document.activeElement),true);await page.keyboard.press('ArrowRight');assert.equal(await page.locator('.face-tabs [aria-selected="true"]').getAttribute('data-face'),'front');
 await context.close();
});
browserTest('flush captures a focused reinforcement count and rejects a fractional count without overwriting the normal save',async()=>{
 const {context,page}=await pageFor();const count=page.locator('[data-count="front.vertical"]');
 await count.fill('5');await page.evaluate(()=>FrameUI.flush());assert.equal(await page.evaluate(()=>FrameUI.getProject().front.vertical.length),5);
 assert.equal(await count.evaluate(element=>element===document.activeElement),true);
 await count.fill('5.5');assert.equal(await count.getAttribute('aria-invalid'),'true');await page.evaluate(()=>FrameUI.flush());
 assert.equal(await page.evaluate(()=>FrameUI.getResult()),null);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('led-frame-projects-v5')).projects[0].project.front.vertical.length),5);
 await count.fill('4');await page.evaluate(()=>FrameUI.flush());assert.equal(await page.evaluate(()=>FrameUI.getProject().front.vertical.length),4);await context.close();
});
browserTest('shared name updates preserve the active material, tab and focused input',async()=>{
 const {context,page}=await pageFor();await page.locator('[data-tab="materials"]').click();const price=page.locator('[data-path="materials.0.pricePerKg"]');await price.fill('2500');
 assert.equal(await page.evaluate(()=>FrameUI.setName('공통 현장 이름')),true);assert.equal(await page.evaluate(()=>FrameUI.setName('공통 현장 이름')),false);
 assert.equal(await price.evaluate(element=>element===document.activeElement),true);assert.equal(await page.locator('#projectName').inputValue(),'공통 현장 이름');
 assert.equal(await page.locator('[data-tab="materials"]').getAttribute('aria-selected'),'true');assert.equal(await price.inputValue(),'2500');await context.close();
});
browserTest('unchanged normal and invalid flush calls do not restart calculator change or auto-save cycles',async()=>{
 const {context,page}=await pageFor();await page.evaluate(()=>{window.frameChanges=0;window.addEventListener('calculatorchange',()=>window.frameChanges++);for(let i=0;i<6;i++)FrameUI.flush();});
 assert.equal(await page.evaluate(()=>window.frameChanges),0);
 await page.locator('[data-path="general.width"]').fill('0');await page.evaluate(()=>{window.frameChanges=0;for(let i=0;i<6;i++)FrameUI.flush();});
 assert.equal(await page.evaluate(()=>window.frameChanges),0);assert.equal(await page.evaluate(()=>FrameUI.getResult()),null);
 await page.locator('[data-path="general.width"]').fill('4000');await page.locator('[data-count="front.vertical"]').fill('3.5');
 await page.evaluate(()=>{window.frameChanges=0;for(let i=0;i<6;i++)FrameUI.flush();});assert.equal(await page.evaluate(()=>window.frameChanges),0);
 assert.equal(await page.evaluate(()=>FrameUI.getResult()),null);await context.close();
});
browserTest('flush reads DOM-only dimension and count changes once, including invalid-to-valid recovery',async()=>{
 const {context,page}=await pageFor();const state=await page.evaluate(()=>{
  window.frameChanges=0;window.addEventListener('calculatorchange',()=>window.frameChanges++);
  const width=document.querySelector('[data-path="general.width"]'),count=document.querySelector('[data-count="front.vertical"]');
  width.value='5000';FrameUI.flush();const valid={width:FrameUI.getResult().general.width,changes:window.frameChanges};FrameUI.flush();valid.repeated=window.frameChanges;
  width.value='0';FrameUI.flush();const invalid={result:FrameUI.getResult(),changes:window.frameChanges};FrameUI.flush();invalid.repeated=window.frameChanges;
  width.value='5000';FrameUI.flush();count.value='3.5';FrameUI.flush();const invalidCount={result:FrameUI.getResult(),changes:window.frameChanges};FrameUI.flush();invalidCount.repeated=window.frameChanges;
  count.value='3';FrameUI.flush();const recovered={valid:!!FrameUI.getResult(),changes:window.frameChanges};FrameUI.flush();recovered.repeated=window.frameChanges;
  count.value='5';FrameUI.flush();const final={count:FrameUI.getProject().front.vertical.length,changes:window.frameChanges};FrameUI.flush();final.repeated=window.frameChanges;
  return {valid,invalid,invalidCount,recovered,final};
 });
 assert.deepEqual(state.valid,{width:5000,changes:1,repeated:1});assert.deepEqual(state.invalid,{result:null,changes:2,repeated:2});
 assert.deepEqual(state.invalidCount,{result:null,changes:4,repeated:4});assert.deepEqual(state.recovered,{valid:true,changes:5,repeated:5});assert.deepEqual(state.final,{count:5,changes:6,repeated:6});
 await context.close();
});
browserTest('flush preserves custom material dimensions while committing a DOM-only preset change',async()=>{
 const {context,page}=await pageFor();await page.locator('[data-tab="materials"]').click();await page.locator('[data-path="materials.0.face"]').fill('60');
 const custom=await page.evaluate(()=>{FrameUI.flush();return FrameUI.getProject().materials[0];});assert.equal(custom.face,60);assert.equal(custom.section,'custom');
 const preset=await page.evaluate(()=>{document.querySelector('[data-path="materials.0.section"]').value='100';FrameUI.flush();return FrameUI.getProject().materials[0];});
 assert.equal(preset.section,'100');assert.equal(preset.face,100);assert.equal(await page.locator('[data-path="materials.0.face"]').inputValue(),'100');await context.close();
});
browserTest('mobile frame inputs remain readable, within the viewport and above normal-text contrast requirements',async()=>{
 const {context,page}=await pageFor();await page.setViewportSize({width:390,height:844});
 const values=await page.locator('[data-path="general.width"]').evaluate(element=>({input:getComputedStyle(element).fontSize,label:getComputedStyle(element.closest('label')).fontSize,overflow:document.documentElement.scrollWidth>innerWidth}));
 assert.equal(values.input,'16px');assert.equal(values.label,'14px');assert.equal(values.overflow,false);
 const contrast=await page.locator('.tabs [aria-selected="true"]').evaluate(element=>{
  const rgb=color=>(color.match(/[\d.]+/g)||[]).slice(0,3).map(Number),lum=color=>rgb(color).map(value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
  const style=getComputedStyle(element),front=lum(style.color),back=lum(style.backgroundColor);return(Math.max(front,back)+.05)/(Math.min(front,back)+.05);
 });
 assert.ok(contrast>=4.5,`Selected frame tab contrast was ${contrast}`);await context.close();
});
browserTest('standalone frame page still downloads XLSX, CSV and JSON and prepares the print report',async()=>{
 const {context,page,problems}=await pageFor(pathToFileURL(path.join(dist,'frame.html')).href);
 await page.evaluate(()=>{FrameUI.setName('독립 구조물 검수');window.print=()=>{window.framePrinted=true;};});await page.locator('[data-tab="report"]').click();
 for(const action of ['xlsx','csv','json']){
  const pending=page.waitForEvent('download');await page.locator('[data-action="'+action+'"]').click();const download=await pending,data=fs.readFileSync(await download.path());
  if(action==='xlsx')assert.equal(data.subarray(0,2).toString(),'PK');
  if(action==='csv')assert.match(data.toString('utf8'),/독립 구조물 검수/);
  if(action==='json')assert.equal(JSON.parse(data.toString('utf8')).name,'독립 구조물 검수');
 }
 await page.locator('[data-action="print"]').click();assert.equal(await page.evaluate(()=>window.framePrinted),true);assert.match(await page.locator('#printArea').innerHTML(),/독립 구조물 검수/);
 assert.deepEqual(problems,[]);await context.close();
});
