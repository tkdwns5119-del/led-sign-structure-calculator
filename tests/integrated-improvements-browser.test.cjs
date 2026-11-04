const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const os=require('node:os');
const {pathToFileURL}=require('node:url');
const root=path.join(__dirname,'..'),dist=path.join(root,'dist');
const packageRoot=path.join(os.homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','node');
let playwright;try{playwright=require(require.resolve('playwright',{paths:[root,packageRoot]}));}catch{}
let browser,server,origin;
before(async()=>{
  if(!playwright)return;
  browser=await playwright.chromium.launch({channel:process.env.TEST_BROWSER_CHANNEL||'msedge',headless:true});
  server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),target=path.resolve(dist,'.'+(pathname==='/'?'/index.html':pathname));
    if(!target.startsWith(dist+path.sep)){res.writeHead(403);res.end();return;}
    fs.readFile(target,(error,data)=>{if(error){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.js':'application/javascript','.css':'text/css','.html':'text/html'})[path.extname(target)]||'application/octet-stream');res.end(data);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
const browserTest=(name,fn)=>test(name,{skip:!playwright?'Playwright is not installed':false},fn);
async function withPage(fn,{offline=false,viewport={width:1440,height:1000}}={}){
  const context=await browser.newContext({viewport,acceptDownloads:true}),page=await context.newPage(),errors=[],network=[];
  page.on('pageerror',e=>errors.push(e.message));
  if(offline)await context.route(/^https?:\/\//,route=>{network.push(route.request().url());return route.abort();});
  try{
    await page.goto(offline?pathToFileURL(path.join(root,'전광판_구조물_기초_통합계산기.html')).href:origin);
    await page.waitForFunction(()=>window.CalculatorSuite?.getState().ready);
    await page.frameLocator('#frame-calculator').locator('#frame-input-detailed').click();
    await fn(page,context);assert.deepEqual(errors,[]);if(offline)assert.deepEqual(network,[]);
  }finally{await context.close();}
}
async function immediateReload(page,childId,inputId,value){
  // One JavaScript turn guarantees that neither the 180 ms child debounce nor
  // the parent automatic-save timer can make this pass accidentally.
  await Promise.all([page.waitForNavigation(),page.evaluate(({childId,inputId,value})=>{
    const child=document.getElementById(childId).contentWindow,input=child.document.getElementById(inputId);
    input.focus();input.value=value;input.dispatchEvent(new child.Event('input',{bubbles:true}));window.location.reload();
  },{childId,inputId,value})]);
  await page.waitForFunction(()=>window.CalculatorSuite?.getState().ready);
}
async function waitSummary(page,pattern){
  await page.waitForFunction(source=>new RegExp(source).test(document.getElementById('suite-overview').innerText),pattern.source);
  return page.locator('#suite-overview').innerText();
}
browserTest('the last valid foundation number survives an immediate reload on HTTP and offline HTML',async()=>{
  for(const offline of [false,true])await withPage(async page=>{
    await page.click('#tab-foundation');await immediateReload(page,'foundation-calculator','bottom','9.1');
    const state=await page.evaluate(()=>({p:CalculatorSuite.getFoundation().read(),saved:JSON.parse(localStorage.getItem('led-integrated-project-v1'))}));
    assert.equal(state.p.bottom,9.1);assert.equal(state.saved.foundation.project.items[0].p.bottom,9.1);
  },{offline});
});
browserTest('a focused foundation item name survives reload and snapshot flushes pending edits',async()=>withPage(async page=>{
  await page.click('#tab-foundation');await immediateReload(page,'foundation-calculator','item-name','옥상 동측 기초');
  assert.equal(await page.evaluate(()=>CalculatorSuite.getFoundation().snapshot().project.items[0].name),'옥상 동측 기초');
  const saved=await page.evaluate(()=>{
    const child=document.getElementById('foundation-calculator').contentWindow,bottom=child.document.getElementById('bottom'),name=child.document.getElementById('item-name');
    bottom.value='6.4';bottom.dispatchEvent(new child.Event('input',{bubbles:true}));name.value='남측 변경';name.dispatchEvent(new child.Event('input',{bubbles:true}));return CalculatorSuite.snapshot();
  });
  assert.equal(saved.foundation.project.items[0].p.bottom,6.4);assert.equal(saved.foundation.project.items[0].name,'남측 변경');
}));
browserTest('immediate reload with an invalid foundation number preserves the previous valid bundle',async()=>withPage(async page=>{
  await page.click('#tab-foundation');await page.evaluate(()=>CalculatorSuite.snapshot());await page.waitForFunction(()=>localStorage.getItem('led-integrated-project-v1'));
  const prior=await page.evaluate(()=>JSON.parse(localStorage.getItem('led-integrated-project-v1')).foundation.project.items[0].p.signW);
  await immediateReload(page,'foundation-calculator','signW','');
  const state=await page.evaluate(()=>({width:CalculatorSuite.getFoundation().read().signW,saved:JSON.parse(localStorage.getItem('led-integrated-project-v1')).foundation.project.items[0].p.signW}));
  assert.equal(state.width,prior);assert.equal(state.saved,prior);
}));
browserTest('common project name reaches both native exports without requiring a blur',async()=>withPage(async page=>{
  await page.fill('#suite-name','부산 현장 통합 산출');
  const names=await page.evaluate(()=>({frame:CalculatorSuite.getFrame().getProject().name,foundation:CalculatorSuite.getFoundation().getExcelPacket().projectName}));
  assert.equal(names.frame,'부산 현장 통합 산출');assert.equal(names.foundation,'부산 현장 통합 산출');
  const downloadEvent=page.waitForEvent('download');await page.click('#suite-save');const download=await downloadEvent,raw=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
  assert.equal(raw.name,'부산 현장 통합 산출');assert.equal(raw.frame.name,raw.name);assert.equal(raw.foundation.project.name,raw.name);
  const frame=page.frameLocator('#frame-calculator');await frame.locator('[data-tab="report"]').click();
  let pending=page.waitForEvent('download');await frame.locator('[data-action="xlsx"]').click();let nativeExport=await pending;
  assert.ok(fs.readFileSync(await nativeExport.path()).includes(Buffer.from(raw.name)),'structure XLSX contains the common project name');
  await page.click('#tab-foundation');await page.locator('.project-menu summary').click();
  pending=page.waitForEvent('download');await page.click('[data-foundation-export="xlsx"]');nativeExport=await pending;
  assert.ok(fs.readFileSync(await nativeExport.path()).includes(Buffer.from(raw.name)),'foundation XLSX contains the common project name');
  await page.reload();await page.waitForFunction(()=>window.CalculatorSuite?.getState().ready);
  assert.equal(await page.evaluate(()=>CalculatorSuite.getFrame().getProject().name),'부산 현장 통합 산출');
}));
browserTest('an empty common name uses the same fallback in both saved projects',async()=>withPage(async page=>{
  await page.fill('#suite-name','');const saved=await page.evaluate(()=>CalculatorSuite.snapshot());
  assert.equal(saved.name,saved.frame.name);assert.equal(saved.name,saved.foundation.project.name);
}));
browserTest('a legacy project can recover its calculator while the current input is invalid',async()=>withPage(async page=>{
  const frame=await page.evaluate(()=>CalculatorSuite.getFrame().getProject());await page.frameLocator('#frame-calculator').locator('[data-path="general.width"]').fill('');
  await page.waitForFunction(()=>!CalculatorSuite.getFrame().getResult());await page.evaluate(raw=>CalculatorSuite.load(raw),frame);
  assert.equal(await page.evaluate(()=>CalculatorSuite.getFrame().getProject().general.width),4000);assert.equal(await page.evaluate(()=>!!CalculatorSuite.getFrame().getResult()),true);
  await page.click('#tab-foundation');const foundation=await page.evaluate(()=>JSON.parse(JSON.stringify(CalculatorSuite.getFoundation().snapshot())));
  await page.evaluate(()=>{const child=document.getElementById('foundation-calculator').contentWindow,input=child.document.getElementById('signW');input.value='';input.dispatchEvent(new child.Event('input',{bubbles:true}));child.FoundationUI.flush();});
  assert.equal(await page.evaluate(()=>CalculatorSuite.getFoundation().getResult()),null);await page.evaluate(raw=>CalculatorSuite.load(raw),foundation);
  assert.equal(await page.evaluate(()=>CalculatorSuite.getFoundation().read().signW),4000);assert.equal(await page.evaluate(()=>!!CalculatorSuite.getFoundation().getResult()),true);
}));
browserTest('overview keeps structural scope and unconfirmed site data visible alongside quantities',async()=>withPage(async page=>{
  await page.evaluate(()=>{
    const f=CalculatorSuite.getFoundation(),raw=JSON.parse(JSON.stringify(f.snapshot()));
    Object.assign(raw.project.items[0].p,{installMode:'shared',qty:3,mode:'manual'});raw.project.items[0].ui={groundKnown:false,windManual:false,windExample:false};f.loadProject(raw);
  });
  await page.click('#tab-overview');const summary=await waitSummary(page,/구조 미검토/);
  assert.match(summary,/지반.*미확인|지반.*확인 필요/);assert.match(summary,/풍하중.*미확인|풍하중.*확인 필요|풍하중.*미선택/);assert.match(summary,/콘크리트/);
}));
browserTest('overview identifies automatic candidate failure and lists excluded zero-price material',async()=>withPage(async page=>{
  await page.evaluate(()=>{
    const f=CalculatorSuite.getFoundation(),raw=JSON.parse(JSON.stringify(f.snapshot()));
    Object.assign(raw.project.items[0].p,{installMode:'repeat',qty:1,mode:'auto',autoMax:2000,autoHMax:1500,pressure:20});raw.prices.rebar=0;f.loadProject(raw);
  });
  await page.click('#tab-overview');const summary=await waitSummary(page,/자동 후보 없음/);
  assert.match(summary,/수동 치수|수동값|치수 재검토/);assert.match(summary,/단가 미입력|미입력 단가/);assert.match(summary,/철근/);
  assert.equal(await page.evaluate(()=>CalculatorSuite.getFoundation().getResult().search.found),false);
}));
browserTest('mass review shows old and new weights before applying and a tiny extra load cannot hide missing products',async()=>withPage(async page=>{
  await page.evaluate(()=>{const api=CalculatorSuite,p=api.getFrame().getProject();p.general.extraEquipment=1;api.getFrame().loadProject(p);});
  await page.click('#suite-transfer');assert.equal(await page.locator('#transfer-dialog').isVisible(),true);
  const review=await page.locator('#transfer-dialog').innerText();assert.match(review,/610/);assert.match(review,/71[.,]975/);assert.match(review,/제품|캐비닛/);assert.match(review,/지주/);
  assert.equal(await page.evaluate(()=>CalculatorSuite.getFoundation().getResult().l.panelKg+CalculatorSuite.getFoundation().read().postKg+CalculatorSuite.getFoundation().read().extraKg),610);
  await page.click('#transfer-confirm');await page.click('#tab-overview');
  const status=await page.locator('#weight-review-status').innerText();assert.match(status,/확인 필요/);
  const p=await page.evaluate(()=>CalculatorSuite.getFoundation().read());assert.equal(p.extraKg,1);assert.equal(p.panelKgM2,0);assert.equal(p.postKg,70.975);
  await page.reload();await page.waitForFunction(()=>window.CalculatorSuite?.getState().ready);
  assert.match(await page.locator('#weight-review-status').innerText(),/확인 필요/);
}));
browserTest('cancelling the mass review leaves the target loads and link unchanged',async()=>withPage(async page=>{
  const before=await page.evaluate(()=>({p:CalculatorSuite.getFoundation().read(),link:CalculatorSuite.getState().linked}));
  await page.click('#suite-transfer');await page.keyboard.press('Escape');assert.equal(await page.locator('#transfer-dialog').isVisible(),false);
  const after=await page.evaluate(()=>({p:CalculatorSuite.getFoundation().read(),link:CalculatorSuite.getState().linked}));assert.deepEqual(after,before);
}));
browserTest('mass confirmation persists and becomes pending again when a reviewed load changes',async()=>withPage(async page=>{
  await page.click('#suite-transfer');for(const id of ['mass-product','mass-posts','mass-accessories'])await page.locator('#'+id).check();await page.click('#transfer-confirm');
  await page.click('#tab-overview');assert.doesNotMatch(await page.locator('#weight-review-status').innerText(),/확인 필요/);
  await page.reload();await page.waitForFunction(()=>window.CalculatorSuite?.getState().ready);
  assert.doesNotMatch(await page.locator('#weight-review-status').innerText(),/확인 필요/);
  await page.evaluate(()=>{const api=CalculatorSuite,p=api.getFrame().getProject();p.general.extraEquipment=25;api.getFrame().loadProject(p);});
  await page.waitForFunction(()=>document.getElementById('suite-link-status').dataset.state==='stale');
  await page.click('#tab-overview');assert.match(await page.locator('#weight-review-status').innerText(),/확인 필요|다시 확인/);
}));
browserTest('replacing a foundation item at the same position invalidates the old load and mass confirmations',async()=>withPage(async page=>{
  await page.evaluate(()=>CalculatorSuite.applyFrame({product:true,posts:true,accessories:true}));await page.click('#tab-overview');
  assert.equal(await page.locator('#weight-review-status').getAttribute('data-state'),'confirmed');
  const changed=await page.evaluate(()=>{
    const f=CalculatorSuite.getFoundation(),raw=JSON.parse(JSON.stringify(f.snapshot())),old=raw.project.items[0].id;
    delete raw.project.items[0].id;f.loadProject(raw);return f.snapshot().project.items[0].id!==old;
  });
  assert.equal(changed,true);await page.waitForFunction(()=>document.getElementById('weight-review-status').dataset.state==='pending');
  assert.equal(await page.evaluate(()=>CalculatorSuite.getState().linked),false);
}));
browserTest('project totals include every foundation and installation multipliers without changing per-board checks',async()=>withPage(async page=>{
  const expected=await page.evaluate(()=>{
    const api=CalculatorSuite,f=api.getFoundation(),raw=JSON.parse(JSON.stringify(f.snapshot()));
    Object.assign(raw.project.items[0].p,{installMode:'shared',qty:3,mode:'manual'});raw.project.items[0].name='동측';
    raw.project.items.push({name:'서측',p:{...raw.project.items[0].p,installMode:'repeat',qty:2},ui:{groundKnown:true,windManual:true}});f.loadProject(raw);
    const frame=api.getFrame().getProject();frame.general.quantity=5;api.getFrame().loadProject(frame);
    const E=document.getElementById('foundation-calculator').contentWindow.FoundationEngine;
    return raw.project.items.reduce((a,item)=>{const r=E.calculate(item.p);return {concrete:a.concrete+r.total.orderedConcrete,rebar:a.rebar+r.total.rebarGross,foundations:a.foundations+r.p.qty,boards:a.boards+r.supports.boards};},{concrete:0,rebar:0,foundations:0,boards:0});
  });
  await page.click('#tab-overview');
  const formatted=(n,d=3)=>n.toLocaleString('ko-KR',{maximumFractionDigits:d});
  assert.match(await page.locator('#project-concrete').innerText(),new RegExp(formatted(expected.concrete).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(await page.locator('#project-rebar').innerText(),new RegExp(formatted(expected.rebar).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(await page.locator('#project-foundations').innerText(),/5/);assert.match(await page.locator('#project-boards').innerText(),/3/);
  await page.click('#tab-foundation');
  const before=await page.evaluate(()=>({p:CalculatorSuite.getFoundation().read(),upper:CalculatorSuite.getFoundation().getResult().l.upper}));
  await page.locator('#installation-count').fill('5');await page.locator('#installation-count').press('Tab');
  const after=await page.evaluate(()=>({p:CalculatorSuite.getFoundation().read(),upper:CalculatorSuite.getFoundation().getResult().l.upper}));
  assert.deepEqual(after.p,before.p);assert.equal(after.upper,before.upper);
  await page.click('#tab-overview');assert.match(await page.locator('#project-foundations').innerText(),/17/);assert.match(await page.locator('#project-boards').innerText(),/7/);
  await page.reload();await page.waitForFunction(()=>window.CalculatorSuite?.getState().ready);
  assert.match(await page.locator('#project-foundations').innerText(),/17/);
}));
browserTest('mobile controls remain readable with a compact header and sufficient tab contrast',async()=>withPage(async page=>{
  await page.click('#suite-transfer');await page.click('#transfer-confirm');
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});await page.click('#tab-frame');
    const metrics=await page.evaluate(()=>{
      const color=s=>s.match(/[\d.]+/g).slice(0,3).map(Number),light=rgb=>rgb.map(v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[0.2126,0.7152,0.0722][i],0);
      const ratio=node=>{
        const fg=color(getComputedStyle(node).color);let parent=node,bg;
        while(parent){const value=getComputedStyle(parent).backgroundColor;if(value!=='rgba(0, 0, 0, 0)'&&value!=='transparent'){bg=color(value);break;}parent=parent.parentElement;}
        const a=light(fg),b=light(bg||[255,255,255]);return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
      };
      const iframe=document.getElementById('frame-calculator'),input=iframe.contentDocument.querySelector('[data-path="general.width"]');
      return {overflow:document.documentElement.scrollWidth>innerWidth,header:iframe.getBoundingClientRect().top,height:innerHeight,inputFont:parseFloat(iframe.contentWindow.getComputedStyle(input).fontSize),labelFont:parseFloat(iframe.contentWindow.getComputedStyle(input.closest('label')).fontSize),contrasts:['tab-frame','tab-foundation','suite-link-status'].map(id=>({id,ratio:ratio(document.getElementById(id))}))};
    });
    assert.equal(metrics.overflow,false);assert.ok(metrics.header<metrics.height/2,JSON.stringify(metrics));assert.ok(metrics.inputFont>=16,JSON.stringify(metrics));assert.ok(metrics.labelFont>=14,JSON.stringify(metrics));
    for(const c of metrics.contrasts)assert.ok(c.ratio>=4.5,`${c.id} contrast ${c.ratio}`);
  }
},{viewport:{width:390,height:844}}));
browserTest('all mobile tabs fit 320 and 390 pixels without document overflow',async()=>withPage(async page=>{
  for(const width of [320,390])for(const view of ['frame','foundation','overview']){
    await page.setViewportSize({width,height:844});await page.click('#tab-'+view);
    const overflow=await page.evaluate(view=>{
      const iframe=view==='overview'?null:document.getElementById(view+'-calculator');
      return {outer:document.documentElement.scrollWidth>innerWidth,inner:iframe?iframe.contentDocument.documentElement.scrollWidth>iframe.contentWindow.innerWidth:false};
    },view);
    assert.equal(overflow.outer,false,`${width} px ${view} outer document`);assert.equal(overflow.inner,false,`${width} px ${view} child document`);
  }
}));
browserTest('candidate comparison explains sizing and does not change the selected foundation',async()=>withPage(async page=>{
  await page.click('#tab-overview');assert.match(await page.locator('#candidate-explanation').innerText(),/후보|치수|검토/);
  const before=await page.evaluate(()=>JSON.stringify(CalculatorSuite.getFoundation().snapshot()));
  await page.click('#compare-candidates');
  await page.waitForFunction(()=>document.getElementById('candidate-results').innerText.trim().length>0);
  const comparison=await page.locator('#candidate-results').innerText();assert.match(comparison,/콘크리트/);assert.match(comparison,/철근/);assert.match(comparison,/금액|비용|원/);
  assert.equal(await page.evaluate(()=>JSON.stringify(CalculatorSuite.getFoundation().snapshot())),before);
}));
browserTest('an invalid structure input is identified and the error action focuses that input',async()=>withPage(async page=>{
  const frame=page.frameLocator('#frame-calculator'),width=frame.locator('[data-path="general.width"]');
  await width.fill('');await page.waitForFunction(()=>!CalculatorSuite.getFrame().getResult());
  assert.equal(await width.getAttribute('aria-invalid'),'true');
  const description=await width.getAttribute('aria-describedby');assert.ok(description);assert.match(await frame.locator('#'+description).innerText(),/가로|general.width|100/);
  await frame.locator('[data-action="focus-error"]').click();assert.equal(await width.evaluate(e=>e===e.ownerDocument.activeElement),true);
  assert.equal(await page.locator('#suite-save').isDisabled(),true);await width.fill('4000');
  await page.waitForFunction(()=>!!CalculatorSuite.getFrame().getResult());assert.notEqual(await width.getAttribute('aria-invalid'),'true');
}));
browserTest('structure internal tabs provide keyboard selection and panel labelling',async()=>withPage(async page=>{
  const frame=page.frameLocator('#frame-calculator'),tabs=frame.locator('.tabs [data-tab]');
  assert.equal(await frame.locator('.tabs').getAttribute('role'),'tablist');await tabs.first().focus();await page.keyboard.press('ArrowRight');
  assert.equal(await tabs.nth(1).getAttribute('aria-selected'),'true');assert.equal(await tabs.nth(1).getAttribute('tabindex'),'0');
  const label=await frame.locator('#content').getAttribute('aria-labelledby');assert.equal(label,await tabs.nth(1).getAttribute('id'));
  await page.keyboard.press('Home');assert.equal(await tabs.first().getAttribute('aria-selected'),'true');
}));
browserTest('integrated CSV and XLSX exports carry all-item quantities, common name and review status',async()=>withPage(async page=>{
  await page.fill('#suite-name','통합 발주 검수');
  const expected=await page.evaluate(()=>{
    const api=CalculatorSuite,f=api.getFoundation(),raw=JSON.parse(JSON.stringify(f.snapshot()));
    Object.assign(raw.project.items[0].p,{installMode:'shared',qty:3,mode:'manual'});raw.project.items[0].name='A 기초';
    raw.project.items.push({name:'B 기초',p:{...raw.project.items[0].p,installMode:'repeat',qty:2},ui:{groundKnown:false,windManual:false}});f.loadProject(raw);
    const E=document.getElementById('foundation-calculator').contentWindow.FoundationEngine;
    return raw.project.items.reduce((sum,item)=>sum+E.calculate(item.p).total.orderedConcrete,0);
  });
  await page.click('#tab-overview');
  const sheets=await page.evaluate(()=>CalculatorSuite.reportSheets());assert.ok(Array.isArray(sheets));assert.ok(sheets.length>=2);
  assert.ok(sheets.some(sheet=>sheet.rows.some(row=>row.some(value=>typeof value==='number'&&Math.abs(value-expected)<1e-8))),'report includes concrete from every foundation');
  const contents=JSON.stringify(sheets);assert.match(contents,/통합 발주 검수/);assert.match(contents,/A 기초/);assert.match(contents,/B 기초/);assert.match(contents,/구조 미검토/);assert.match(contents,/미확인/);
  const order=sheets.find(sheet=>sheet.name==='기초통합물량');assert.ok(order);const orderText=JSON.stringify(order);
  for(const label of ['앵커 템플릿','무수축 몰탈','접지 동봉','ELP','산출 근거','중복 합산 금지'])assert.ok(orderText.includes(label),label);
  let pending=page.waitForEvent('download');await page.evaluate(()=>CalculatorSuite.exportReport('csv'));let download=await pending;
  const csv=fs.readFileSync(await download.path(),'utf8');assert.equal(csv.charCodeAt(0),0xfeff);assert.match(csv,/통합 발주 검수/);assert.match(csv,/구조 미검토/);assert.match(csv,/B 기초/);
  pending=page.waitForEvent('download');await page.evaluate(()=>CalculatorSuite.exportReport('xlsx'));download=await pending;
  const bytes=fs.readFileSync(await download.path());assert.ok(bytes.subarray(0,2).equals(Buffer.from('PK')));assert.ok(bytes.includes(Buffer.from('통합 발주 검수')));assert.ok(bytes.includes(Buffer.from('B 기초')));
}));
browserTest('combined cost requires current price and duplicate-cost reviews and a rate edit clears those reviews',async()=>withPage(async page=>{
  const expected=await page.evaluate(()=>{
    const api=CalculatorSuite,p=api.getFrame().getProject();for(const m of p.materials){m.priceMode='kg';m.pricePerKg=1000;}api.getFrame().loadProject(p);
    return api.getFrame().getResult().costs.total+api.getFoundation().getResult().estimate.total;
  });
  await page.click('#tab-overview');assert.match(await page.locator('#combined-cost').innerText(),/확인 후/);
  await page.locator('#cost-confirmed').check();assert.match(await page.locator('#combined-cost').innerText(),/확인 후/);
  await page.locator('#prices-confirmed').check();assert.match(await page.locator('#combined-cost').innerText(),/확인 후/);
  await page.locator('#cost-confirmed').check();assert.equal(await page.locator('#combined-cost').innerText(),expected.toLocaleString('ko-KR',{maximumFractionDigits:0})+'원');
  await page.evaluate(()=>{const f=CalculatorSuite.getFoundation(),raw=JSON.parse(JSON.stringify(f.snapshot()));raw.prices.rebar+=1;f.loadProject(raw);});
  await page.waitForFunction(()=>document.getElementById('foundation-price-status').dataset.state==='pending');
  assert.match(await page.locator('#combined-cost').innerText(),/확인 후/);assert.equal(await page.locator('#prices-confirmed').isChecked(),false);
}));
browserTest('a zero-priced item remains pending until its inclusion or free-supply reason is acknowledged',async()=>withPage(async page=>{
  await page.evaluate(()=>{const f=CalculatorSuite.getFoundation(),raw=JSON.parse(JSON.stringify(f.snapshot()));raw.prices.rebar=0;f.loadProject(raw);});
  await page.click('#tab-overview');await page.locator('#prices-confirmed').check();assert.equal(await page.locator('#foundation-price-status').getAttribute('data-state'),'pending');
  await page.locator('#price-included-rebar').check();assert.equal(await page.locator('#foundation-price-status').getAttribute('data-state'),'confirmed');
  const review=await page.evaluate(()=>CalculatorSuite.snapshot().priceReview);assert.equal(review.confirmed,true);assert.ok(review.included.includes('rebar'));
  await page.reload();await page.waitForFunction(()=>window.CalculatorSuite?.getState().ready);assert.equal(await page.locator('#foundation-price-status').getAttribute('data-state'),'confirmed');
}));
browserTest('invalid foundation dimensions remove the stale overall quantities and block report exports',async()=>withPage(async page=>{
  await page.click('#tab-overview');assert.equal(await page.locator('#project-concrete').count(),1);
  await page.evaluate(()=>{const child=document.getElementById('foundation-calculator').contentWindow,input=child.document.getElementById('signW');input.value='';input.dispatchEvent(new child.Event('input',{bubbles:true}));child.FoundationUI.flush();});
  await page.waitForFunction(()=>document.getElementById('foundation-status').dataset.state==='invalid');
  assert.equal(await page.locator('#project-concrete').count(),0);assert.equal(await page.locator('#project-foundations').count(),0);
  for(const id of ['suite-save','suite-xlsx','suite-csv','suite-print'])assert.equal(await page.locator('#'+id).isDisabled(),true);
  await page.evaluate(()=>{const child=document.getElementById('foundation-calculator').contentWindow,input=child.document.getElementById('signW');input.value='4000';input.dispatchEvent(new child.Event('input',{bubbles:true}));child.FoundationUI.flush();});
  await page.waitForFunction(()=>!!document.getElementById('project-concrete'));assert.equal(await page.locator('#suite-xlsx').isDisabled(),false);
}));
browserTest('invalid rates mark every foundation amount as unconfirmed instead of showing old monetary totals',async()=>withPage(async page=>{
  await page.click('#tab-overview');await page.waitForFunction(()=>localStorage.getItem('led-integrated-project-v1'));
  const prior=await page.evaluate(()=>JSON.parse(localStorage.getItem('led-integrated-project-v1')).foundation.prices.rebar);
  await page.evaluate(()=>{const child=document.getElementById('foundation-calculator').contentWindow,input=child.document.getElementById('price-rebar');input.value='';input.dispatchEvent(new child.Event('input',{bubbles:true}));});
  await page.waitForFunction(()=>document.getElementById('foundation-price-status').innerText.includes('단가 입력 오류'));
  assert.match(await page.locator('#project-cost').innerText(),/미확정/);
  const amounts=await page.locator('.overview-card.wide .table-scroll tbody tr td.numeric').allTextContents();assert.ok(amounts.length>0);for(const amount of amounts)assert.match(amount,/미확정/);
  for(const id of ['suite-save','suite-xlsx','suite-csv','suite-print'])assert.equal(await page.locator('#'+id).isDisabled(),true);
  await page.reload();await page.waitForFunction(()=>window.CalculatorSuite?.getState().ready);assert.equal(await page.evaluate(()=>CalculatorSuite.getFoundation().snapshot().prices.rebar),prior);
}));
