const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const E=require('../dist/foundation/engine.js');
const W=require('../dist/foundation/wind.js');
const C=require('../dist/foundation/estimate.js');

// An in-memory DOM adapter exercises form state, render and download handlers.
// It is not a browser layout or screenshot test.
function harness(singleFile=false,{motion=false,reduced=false,savedStorage}={}){
  const elements=new Map(),fieldNodes=new Map(),downloads=[],motionCalls=[],scrollCalls=[];
  const windowEvents=new Map(),preferenceEvents=[];let reduceMotion=reduced;
  function el(id){
    if(elements.has(id))return elements.get(id);
    const classes=new Set(),handlers=new Map(),attrs=new Map();let markup='',value='';
    const e={id,hidden:false,disabled:false,options:[],textContent:'',name:'',download:'',href:'',
      classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},
      addEventListener:(event,fn)=>{if(!handlers.has(event))handlers.set(event,[]);handlers.get(event).push(fn);},
      emit(event,extra={}){for(const fn of handlers.get(event)||[])fn({target:e,type:event,preventDefault(){},...extra});},
      setAttribute(k,v){attrs.set(k,String(v));},getAttribute:k=>attrs.get(k),setCustomValidity(v){e.validationMessage=v;},closest(selector){return selector==='[data-point]'&&attrs.has('data-point')?e:null;},
      getBoundingClientRect:()=>({left:0,top:0,width:790,height:1090}),
      click(){if(id.startsWith('anchor-'))downloads.push({name:e.download,content:blobs.get(e.href).content});else e.emit('click');},
      remove(){},append(){},get value(){return value;},set value(v){value=String(v);},
      get innerHTML(){return markup;},set innerHTML(s){
        markup=s;
        for(const m of s.matchAll(/<[\w-]+\b[^>]*\bid="([^"]+)"[^>]*>/g)){const node=el(m[1]);for(const a of m[0].matchAll(/([\w-]+)="([^"]*)"/g))node.setAttribute(a[1],a[2]);if(m[0].includes(' value="'))node.value=node.getAttribute('value');}
        for(const m of s.matchAll(/<select\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g))el(m[1]).options=[...m[2].matchAll(/<option value="([^"]+)">([^<]*)<\/option>/g)].map(x=>({value:x[1],text:x[2],disabled:false}));
        for(const m of s.matchAll(/data-field="([^"]+)"/g))fieldNodes.set(m[1],{hidden:false});
      }
    };
    e.scrollIntoView=options=>scrollCalls.push({id,options});
    if(motion)e.animate=(frames,options)=>{
      const animation={id,frames,options,cancelled:false,cancel(){this.cancelled=true;this.oncancel?.();}};
      motionCalls.push(animation);return animation;
    };
    elements.set(id,e);return e;
  }
  const html=fs.readFileSync(path.join(__dirname,singleFile?'../전광판_기초_철근_계산기.html':'../dist/foundation/index.html'),'utf8');
  for(const m of html.matchAll(/\bid="([^"]+)"/g))el(m[1]);
  const document={getElementById:id=>elements.get(id),querySelector:selector=>fieldNodes.get(selector.match(/data-field="([^"]+)"/)?.[1]),createElement:()=>el('anchor-'+elements.size),body:{append(){}}};
  const blobs=new Map();let count=0,printed=false;
  const storage=new Map(savedStorage),timers=new Map();let timerId=0,calculatorChanges=0;
  const emitWindow=(event,extra={})=>{for(const fn of windowEvents.get(event)||[])fn({type:event,...extra});};
  const context={document,TextEncoder,...(singleFile?{}:{FoundationEngine:E,FoundationWind:W,FoundationEstimate:C}),window:{print(){printed=true;},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},addEventListener:(event,fn)=>{if(!windowEvents.has(event))windowEvents.set(event,[]);windowEvents.get(event).push(fn);},CustomEvent:class{constructor(type){this.type=type;}},dispatchEvent(event){if(event.type==='calculatorchange')calculatorChanges++;emitWindow(event.type);}},Blob:class{constructor(parts){this.content=parts.every(p=>typeof p==='string')?parts.join(''):Buffer.concat(parts.map(p=>Buffer.from(p)));}},URL:{createObjectURL:b=>{const id='blob:'+count++;blobs.set(id,b);return id;},revokeObjectURL(){}},setTimeout:(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id)};
  if(motion){
    context.window.matchMedia=()=>({get matches(){return reduceMotion;},addEventListener:(event,fn)=>{if(event==='change')preferenceEvents.push(fn);}});
    context.window.print=()=>{for(const fn of windowEvents.get('beforeprint')||[])fn();printed=true;};
  }
  vm.createContext(context);
  const script=singleFile?[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n'):['excel-theme.js','excel.js','dxf.js','motion.js','app.js','easy.js'].map(file=>fs.readFileSync(path.join(__dirname,'../dist/foundation',file),'utf8')).join('\n');
  vm.runInContext(script,context);
  return {el,downloads,motionCalls,scrollCalls,emitWindow,calculatorChanges:()=>calculatorChanges,pendingTimers:delay=>[...timers.values()].filter(t=>t.delay===delay).length,runTimers(delay){for(const [id,t]of [...timers])if(t.delay===delay){timers.delete(id);t.fn();}},reload:()=>harness(singleFile,{motion,reduced:reduceMotion,savedStorage:storage}),fieldHidden:key=>fieldNodes.get(key)?.hidden,setReduced(value){reduceMotion=value;for(const fn of preferenceEvents)fn();},api:context.window.FoundationUI,ux:context.window.FoundationUX,storage,printed:()=>printed,input(id,value){el(id).value=value;el(id).emit('input');if(!['item-name','project-name'].includes(id))el('form').emit('input',{target:el(id)});},change(id,value){el(id).value=value;el(id).emit('change');el('form').emit('change');},price(id,value){const target=el('price-'+id);target.value=value;el('cost-table').emit('input',{target});}};
}

test('form changes propagate through dimensions, diagrams and quantities',()=>{
  const h=harness();assert.match(h.el('summary').innerHTML,/계산 항목 충족/);assert.equal(h.el('L').value,'2500');assert.ok(Number(h.el('H').value)>=1500);
  assert.equal((h.el('drawings').innerHTML.match(/<svg /g)||[]).length,5);
  h.change('signW',8000);h.change('signH',4000);
  const expected=E.calculate({signW:8000,signH:4000});
  assert.equal(Number(h.el('L').value),expected.g.L);assert.match(h.el('drawings').innerHTML,/8000 × 4000/);
  assert.match(h.el('load-summary').innerHTML,/48\.00 kN/);
  h.change('qty',3);assert.match(h.el('quantity-caption').textContent,/3개소/);
  h.change('type','combined');assert.equal(h.el('mode').value,'manual');assert.match(h.el('summary').innerHTML,/구조 미검토/);assert.match(h.el('checks').innerHTML,/미검토/);
  h.change('type','strip');h.change('qty',2);assert.equal(h.el('error').hidden,true);assert.ok(Number(h.el('neckNX').value)>30);
  h.el('reset').click();assert.equal(h.el('type').value,'single');assert.equal(h.el('signW').value,'4000');assert.ok(Number(h.el('H').value)>=1500);
  h.change('mode','manual');h.change('L',3100);h.change('W',3100);h.change('H',1000);const manual=E.calculate({mode:'manual',L:3100,W:3100,H:1000});assert.equal(Number(h.el('bar').value),manual.r.code);assert.equal(Number(h.el('spacing').value),manual.r.s);
});

test('invalid input blocks exports and reset recovers a valid result',()=>{
  const h=harness();h.change('signW','');assert.equal(h.el('error').hidden,false);assert.match(h.el('error').textContent,/화면 가로/);assert.ok(h.el('outputs').classList.contains('stale'));
  for(const id of ['csv','drawing','print'])assert.equal(h.el(id).disabled,true);
  h.el('csv').click();assert.equal(h.downloads.length,0);
  h.el('reset').click();assert.equal(h.el('error').hidden,true);assert.equal(h.el('csv').disabled,false);
});

test('CSV and SVG downloads carry quantity, input and scope data; standalone HTML runs offline',()=>{
  const h=harness(true);h.el('csv').click();h.el('drawing-svg').click();h.el('print').click();
  assert.equal(h.downloads.length,2);assert.equal(h.printed(),true);
  const csv=h.downloads.find(x=>x.name.endsWith('.csv')).content;
  assert.equal(csv.charCodeAt(0),0xfeff);assert.match(csv,/총 허용지지력 qa/);assert.match(csv,/정면 유효 풍압/);assert.match(csv,/F1/);assert.match(csv,/P4/);assert.match(csv,/시공 승인 아님/);
  const svg=h.downloads.find(x=>x.name.endsWith('.svg')).content;assert.match(svg,/viewBox="0 0 1000 1290"/);assert.match(svg,/시공용 확정도면 아님/);assert.match(svg,/목 평면/);
  if(process.env.FOUNDATION_EXAMPLES){fs.mkdirSync(process.env.FOUNDATION_EXAMPLES,{recursive:true});for(const d of h.downloads)fs.writeFileSync(path.join(process.env.FOUNDATION_EXAMPLES,d.name),d.content,'utf8');}
});

module.exports={harness};

function dxfRecords(content,section){
  assert.doesNotMatch(content,/[^\x09\x0A\x0D\x20-\x7E]/,'DXF is ASCII with Unicode escapes');
  const lines=content.trimEnd().split(/\r?\n/);assert.equal(lines.length%2,0);const tags=[];
  for(let i=0;i<lines.length;i+=2){assert.match(lines[i],/^\d+$/);tags.push([Number(lines[i]),lines[i+1]]);}
  assert.deepEqual(tags.at(-1),[0,'EOF']);let active=false,record=null;const records=[];
  for(let i=0;i<tags.length;i++){
    const [code,value]=tags[i];
    if(code===0&&value==='SECTION'){active=tags[i+1][1]===section;i++;record=null;continue;}
    if(code===0&&value==='ENDSEC'){active=false;continue;}
    if(!active)continue;
    if(code===0){record={type:value,tags:[]};records.push(record);}else if(record)record.tags.push([code,value]);
  }
  return records;
}
const dxfTag=(entity,code)=>entity.tags.find(t=>t[0]===code)?.[1];

test('CAD drawing download produces native millimetre DXF entities and editable dimension blocks offline',()=>{
  const h=harness(true);h.el('drawing').click();const file=h.downloads[0];assert.match(file.name,/\.dxf$/);
  const r=h.api.getResult(),entities=dxfRecords(file.content,'ENTITIES'),blocks=dxfRecords(file.content,'BLOCKS');
  assert.match(file.content,/9\r\n\$INSUNITS\r\n70\r\n4\r\n/);assert.match(file.content,/AC1015/);assert.doesNotMatch(file.content,/<svg/);
  const dims=entities.filter(e=>e.type==='DIMENSION');assert.ok(dims.length>=10);assert.ok(dims.some(e=>Number(dxfTag(e,42))===r.g.L));assert.ok(dims.some(e=>Number(dxfTag(e,42))===r.g.H));
  for(const dim of dims)assert.ok(blocks.some(e=>e.type==='BLOCK'&&dxfTag(e,2)===dxfTag(dim,2)));
  assert.equal(entities.filter(e=>dxfTag(e,8)==='FND_COLUMN'&&e.type==='LWPOLYLINE').length,1);
  assert.equal(entities.filter(e=>dxfTag(e,8)==='FND_ANCHOR'&&e.type==='CIRCLE').length,r.p.anchorCount);
  const text=entities.filter(e=>e.type==='TEXT').map(e=>dxfTag(e,1));assert.ok(text.some(s=>s.includes('\\U+')));assert.ok(text.every(s=>s.length<=240));
  const handles=[...dxfRecords(file.content,'TABLES'),...blocks,...entities,...dxfRecords(file.content,'OBJECTS')].map(e=>dxfTag(e,5)||dxfTag(e,105)).filter(Boolean);assert.equal(new Set(handles).size,handles.length);
  assert.match(h.el('toast').textContent,/DXF/);
});

test('DXF uses exact footing dimensions and reinforcement centre spacing rather than screen pixel scaling',()=>{
  const h=harness();h.change('mode','manual');h.change('L',3100);h.change('W',2700);h.change('H',1500);h.el('drawing').click();
  const r=h.api.getResult(),entities=dxfRecords(h.downloads[0].content,'ENTITIES'),dims=entities.filter(e=>e.type==='DIMENSION').map(e=>Number(dxfTag(e,42)));
  for(const value of [3100,2700,1500])assert.ok(dims.includes(value));
  const planLines=entities.filter(e=>e.type==='LINE'&&dxfTag(e,8)==='FND_BOTTOM'&&Number(dxfTag(e,20))===Number(dxfTag(e,21))&&Math.abs(Number(dxfTag(e,11))-Number(dxfTag(e,10)))===3100-2*r.p.cover);
  assert.equal(planLines.length,r.r.x.n);
  const ys=planLines.map(e=>Number(dxfTag(e,20))).sort((a,b)=>a-b);
  for(let i=1;i<ys.length;i++)assert.ok(Math.abs(ys[i]-ys[i-1]-r.r.x.actual)<1e-7);
  const circles=entities.filter(e=>e.type==='CIRCLE'&&dxfTag(e,8)==='FND_BOTTOM');assert.equal(circles.length,r.r.x.n);assert.ok(circles.every(e=>Number(dxfTag(e,40))===r.r.b.d/2));
});

test('DXF shared columns and spacing, repeated representatives and undefined supports remain distinct',()=>{
  const h=harness();h.change('qty',3);h.change('foundationSpacing',4500);h.el('drawing').click();let entities=dxfRecords(h.downloads.at(-1).content,'ENTITIES');
  let columns=entities.filter(e=>e.type==='LWPOLYLINE'&&dxfTag(e,8)==='FND_COLUMN');assert.equal(columns.length,3);
  const xs=columns.map(e=>Number(dxfTag(e,10))).sort((a,b)=>a-b);assert.equal(xs[1]-xs[0],4500);assert.equal(xs[2]-xs[1],4500);
  assert.equal(entities.filter(e=>e.type==='LWPOLYLINE'&&dxfTag(e,8)==='FND_SIGN').length,1);
  h.change('installMode','repeat');h.el('drawing').click();entities=dxfRecords(h.downloads.at(-1).content,'ENTITIES');assert.equal(entities.filter(e=>e.type==='LWPOLYLINE'&&dxfTag(e,8)==='FND_COLUMN').length,1);
  h.change('type','combined');h.el('drawing').click();entities=dxfRecords(h.downloads.at(-1).content,'ENTITIES');assert.equal(entities.filter(e=>e.type==='LWPOLYLINE'&&dxfTag(e,8)==='FND_COLUMN').length,2);
  h.change('type','block');h.el('drawing').click();entities=dxfRecords(h.downloads.at(-1).content,'ENTITIES');assert.equal(entities.filter(e=>dxfTag(e,8)==='FND_COLUMN').length,0);
});

test('DXF literal names cannot inject group records, and errors block both drawing formats',()=>{
  const h=harness();h.el('project-name').value='도면'.repeat(30)+'\\U+0041 100%';h.el('project-name').emit('change');h.el('item-name').value='0\r\nEOF\r\n한글';h.el('item-name').emit('change');h.el('drawing').click();
  const texts=dxfRecords(h.downloads[0].content,'ENTITIES').filter(e=>e.type==='TEXT').map(e=>dxfTag(e,1));assert.ok(texts.every(s=>s.length<=240));assert.ok(texts.some(s=>s.includes('\\U+005CU+0041')));assert.ok(texts.some(s=>s.includes('100\\U+0025')));
  h.change('signW','');for(const id of ['drawing','drawing-svg'])assert.equal(h.el(id).disabled,true);
  const count=h.downloads.length;h.el('drawing').click();h.el('drawing-svg').click();assert.equal(h.downloads.length,count);
  h.el('reset').click();assert.equal(h.el('drawing').disabled,false);assert.equal(h.el('drawing-svg').disabled,false);h.el('drawing-svg').click();assert.match(h.downloads.at(-1).name,/\.svg$/);
});

function unzipWorkbook(bytes){
  assert.ok(Buffer.isBuffer(bytes));const files=new Map();let at=0;
  while(bytes.readUInt32LE(at)===0x04034b50){
    assert.equal(bytes.readUInt16LE(at+8),0,'offline package uses stored ZIP entries');
    const size=bytes.readUInt32LE(at+18),nameLength=bytes.readUInt16LE(at+26),extra=bytes.readUInt16LE(at+28);
    const name=bytes.subarray(at+30,at+30+nameLength).toString('utf8'),start=at+30+nameLength+extra,data=bytes.subarray(start,start+size);
    assert.equal(require('node:zlib').crc32(data),bytes.readUInt32LE(at+14));files.set(name,data.toString('utf8'));at=start+size;
  }
  assert.equal(bytes.readUInt32LE(at),0x02014b50);assert.equal(bytes.readUInt32LE(bytes.length-22),0x06054b50);
  assert.equal(bytes.readUInt16LE(bytes.length-12),files.size);return files;
}
const workbookCell=(xml,address)=>xml.match(new RegExp(`<c r="${address}"[^>]*>([\\s\\S]*?)<\\/c>`))?.[1];
const cachedNumber=(xml,address)=>Number(workbookCell(xml,address)?.match(/<v>([^<]+)<\/v>/)?.[1]);

test('designed XLSX export is an offline six-sheet package with valid formulas, styles and print settings',()=>{
  const h=harness(true);h.el('xlsx').click();assert.equal(h.downloads.length,1);
  assert.match(h.downloads[0].name,/\.xlsx$/);const files=unzipWorkbook(h.downloads[0].content),r=h.api.getResult();
  const workbook=files.get('xl/workbook.xml');for(const name of ['요약','물량','철근','견적','프로젝트','검토·입력'])assert.ok(workbook.includes(`name="${name}"`));
  assert.equal((workbook.match(/<sheet /g)||[]).length,6);assert.match(workbook,/_xlnm.Print_Area/);assert.match(workbook,/_xlnm.Print_Titles/);
  assert.equal(cachedNumber(files.get('xl/worksheets/sheet1.xml'),'B20'),r.estimate.total);
  assert.match(workbookCell(files.get('xl/worksheets/sheet1.xml'),'B20'),/<f>&apos;견적&apos;!F29<\/f>/);
  assert.equal(cachedNumber(files.get('xl/worksheets/sheet4.xml'),'F27'),r.estimate.subtotal);
  assert.match(workbookCell(files.get('xl/worksheets/sheet4.xml'),'F9'),/<f>ROUND\(D9\*E9,0\)<\/f>/);
  assert.equal(cachedNumber(files.get('xl/worksheets/sheet3.xml'),'H19'),r.total.rebarGross);
  assert.match(files.get('xl/worksheets/sheet2.xml'),/showGridLines="0"/);assert.match(files.get('xl/worksheets/sheet2.xml'),/state="frozen"/);
  assert.match(files.get('xl/worksheets/sheet4.xml'),/<autoFilter ref="A8:G25"/);
  for(let i=1;i<=6;i++)assert.match(files.get(`xl/worksheets/sheet${i}.xml`),/paperSize="9"/);
  assert.match(files.get('xl/styles.xml'),/Malgun Gothic/);assert.match(files.get('xl/styles.xml'),/FF153D49|153D49/);
  const html=fs.readFileSync(path.join(__dirname,'../전광판_기초_철근_계산기.html'),'utf8');assert.doesNotMatch(html,/<script[^>]+src=/);assert.ok(html.includes('서식 엑셀 (.xlsx) 저장'));
});

test('XLSX downloads are blocked for invalid dimensions and rates and recover with fresh calculated values',()=>{
  const h=harness();h.change('signW','');assert.equal(h.el('xlsx').disabled,true);h.el('xlsx').click();assert.equal(h.downloads.length,0);
  h.el('reset').click();h.price('rebar','');assert.equal(h.el('xlsx').disabled,true);h.el('xlsx').click();assert.equal(h.downloads.length,0);
  h.price('rebar',2000);assert.equal(h.el('xlsx').disabled,false);h.el('xlsx').click();
  const f=unzipWorkbook(h.downloads[0].content);assert.equal(cachedNumber(f.get('xl/worksheets/sheet1.xml'),'B20'),h.api.getResult().estimate.total);
  assert.equal(cachedNumber(f.get('xl/worksheets/sheet4.xml'),'E17'),2000);
});

test('XLSX preserves one-board multiple-support counts and current-item versus project totals',()=>{
  const h=harness();h.change('qty',3);h.el('item-add').click();h.change('installMode','repeat');h.change('qty',2);h.change('signW',6000);h.el('xlsx').click();
  const f=unzipWorkbook(h.downloads[0].content),r=h.api.getResult(),project=f.get('xl/worksheets/sheet5.xml'),iron=f.get('xl/worksheets/sheet3.xml');
  assert.equal(cachedNumber(project,'C9'),3);assert.equal(cachedNumber(project,'D9'),1);assert.equal(cachedNumber(project,'E9'),3);
  assert.equal(cachedNumber(project,'C10'),2);assert.equal(cachedNumber(project,'D10'),2);assert.equal(cachedNumber(project,'E10'),2);
  assert.match(workbookCell(project,'F10'),/<f>&apos;견적&apos;!F27<\/f>/);assert.doesNotMatch(workbookCell(project,'F9'),/<f>/);
  assert.equal(cachedNumber(iron,'G9'),r.r.rows[0].count*r.p.qty);assert.equal(cachedNumber(iron,'H19'),r.total.rebarGross);
  assert.match(f.get('xl/worksheets/sheet6.xml'),/구조 미검토|미검토/);
});

test('XLSX names remain literal text and undefined column counts remain unspecified',()=>{
  const h=harness();h.el('project-name').value='=HYPERLINK("https://example.com") & <제목>';h.el('project-name').emit('change');
  h.el('item-name').value='=1+1 한글 & <기초>';h.el('item-name').emit('change');h.change('type','mat');h.el('xlsx').click();
  const f=unzipWorkbook(h.downloads[0].content),pr=f.get('xl/worksheets/sheet5.xml'),name=workbookCell(pr,'A9');
  assert.match(name,/=1\+1 한글 &amp; &lt;기초&gt;/);assert.doesNotMatch(name,/<f>/);assert.match(workbookCell(pr,'E9'),/미지정/);assert.match(workbookCell(pr,'E11'),/미지정 포함/);
  assert.match(f.get('xl/worksheets/sheet1.xml'),/=HYPERLINK\(&quot;https:\/\/example.com&quot;\)/);
});

test('map click applies reference wind and linked side pressure without changing ground data',()=>{
  const h=harness();assert.deepEqual(Object.keys(h.api.read()).sort(),Object.keys(E.defaults).sort());h.change('qa',333);
  h.el('wind-map').emit('click',{clientX:W.getPoint('busan').x,clientY:W.getPoint('busan').y});
  assert.equal(h.el('basicWind').value,'42');assert.equal(h.el('windMode').value,'regional');assert.equal(h.el('sideMode').value,'linked');assert.equal(h.el('qa').value,'333');
  assert.match(h.el('wind-status').innerHTML,/부산/);assert.match(h.el('wind-status').innerHTML,/Kzr/);
  assert.equal(h.el('pin-busan').getAttribute('aria-pressed'),'true');assert.equal(h.api.getResult().l.pressure,h.api.getResult().l.sidePressure);
  h.el('wind-map').emit('click',{clientX:0,clientY:0});assert.equal(h.el('windPoint').value,'busan');assert.match(h.el('toast').textContent,/기준값이 없습니다/);
  h.el('wind-map').emit('keydown',{target:h.el('pin-seoul'),key:'Enter'});assert.equal(h.el('windPoint').value,'seoul');
  h.el('csv').click();assert.match(h.downloads[0].content,/지도 기준지점/);assert.match(h.downloads[0].content,/정밀 좌표 GIS 판정 아님/);
});

test('tabs expose one result panel and in-place unit price editing preserves focused inputs',()=>{
  const h=harness();h.el('tab-cost').click();assert.equal(h.el('view-cost').hidden,false);assert.equal(h.el('view-drawing').hidden,true);
  h.el('tab-check').click();assert.equal(h.el('view-cost').hidden,true);assert.equal(h.el('tab-check').getAttribute('aria-pressed'),'true');
  const markup=h.el('cost-table').innerHTML;h.price('rebar',2000);assert.equal(h.el('cost-table').innerHTML,markup);assert.equal(h.el('price-rebar').value,'2000');
  assert.equal(h.api.getResult().estimate.prices.rebar,2000);assert.match(h.el('boq').innerHTML,/그라우트/);assert.match(h.el('drawings').innerHTML,/주황 앵커 8-M30/);
  h.price('rebar','');h.price('footing',-1);assert.equal(h.el('csv').disabled,true);h.price('rebar',2000);assert.equal(h.el('csv').disabled,true);h.price('footing',115000);assert.equal(h.el('csv').disabled,false);
});

test('projects retain different dimensions, rates and wind reference through JSON round trip',()=>{
  const h=harness();h.api.selectPoint('busan');h.el('item-add').click();h.change('signW',6000);h.change('qty',3);h.price('rebar',1500);
  h.el('item-name').value='2호기';h.el('item-name').emit('change');h.el('save').click();
  const raw=JSON.parse(h.downloads.find(x=>x.name.endsWith('.json')).content);assert.equal(raw.project.items.length,2);assert.equal(raw.project.items[0].p.signW,4000);assert.equal(raw.project.items[1].p.signW,6000);assert.equal(raw.prices.rebar,1500);
  const expected=h.api.getResult().estimate.total+ C.calculate(E.calculate(raw.project.items[0].p),raw.prices).total;assert.match(h.el('project-total').textContent,new RegExp(expected.toLocaleString('ko-KR')));
  const fresh=harness(true);fresh.api.loadProject(raw);assert.equal(fresh.el('signW').value,'6000');assert.equal(fresh.el('windPoint').value,'busan');assert.equal(fresh.el('price-rebar').value,'1500');
  fresh.change('item-select',0);assert.equal(fresh.el('signW').value,'4000');assert.equal(fresh.el('qty').value,'1');fresh.el('item-delete').click();assert.equal(fresh.api.snapshot().project.items.length,1);
  const before=JSON.stringify(fresh.api.snapshot());assert.throws(()=>fresh.api.loadProject({...raw,project:{...raw.project,items:[{name:'bad',p:{...E.defaults,signW:NaN}}]}}));assert.equal(JSON.stringify(fresh.api.snapshot()),before);
});

test('leaving before debounce or blur restores the last numeric and name keystrokes',()=>{
  const h=harness();h.change('mode','manual');
  h.input('L',3400);h.input('item-name','  서측 기초  ');h.input('project-name','  즉시 새로고침 현장  ');
  assert.equal(h.pendingTimers(180),1);assert.notEqual(h.api.getResult().g.L,3400);assert.match(h.el('save-state').textContent,/입력 중/);
  h.emitWindow('beforeunload');assert.equal(h.pendingTimers(180),0);
  const fresh=h.reload();assert.equal(fresh.api.getResult().g.L,3400);assert.equal(fresh.el('L').value,'3400');
  assert.equal(fresh.el('item-name').value,'서측 기초');assert.equal(fresh.el('project-name').value,'즉시 새로고침 현장');
});

test('debounced names autosave without blur and JSON export flushes pending numeric input',()=>{
  const h=harness();h.input('item-name','입력 중인 기초');h.input('project-name','입력 중인 현장');h.runTimers(180);
  const stored=JSON.parse(h.storage.get('foundation-project-v7'));assert.equal(stored.project.name,'입력 중인 현장');assert.equal(stored.project.items[0].name,'입력 중인 기초');
  h.input('signW',5200);h.el('save').click();assert.equal(h.pendingTimers(180),0);
  const raw=JSON.parse(h.downloads.at(-1).content);assert.equal(raw.project.items[0].p.signW,5200);assert.equal(h.api.getResult().p.signW,5200);
  // Programmatic input assignments are flushed even without any browser input event.
  h.el('project-name').value='마지막 현장명';h.el('item-name').value='마지막 기초명';h.el('csv').click();
  assert.match(h.downloads.at(-1).content,/마지막 현장명/);assert.match(h.downloads.at(-1).content,/마지막 기초명/);
});

test('flush preserves the last normal browser save while numeric or price inputs are invalid',()=>{
  const h=harness();h.change('mode','manual');const normal=h.storage.get('foundation-project-v7');
  h.input('signW','');h.input('item-name','잘못된 입력 중 이름');h.emitWindow('beforeunload');
  assert.equal(h.api.getResult(),null);assert.equal(h.api.flush(),null);assert.equal(h.storage.get('foundation-project-v7'),normal);assert.match(h.el('save-state').textContent,/마지막 정상 저장본 유지/);
  h.api.setNotes({groundKnown:true});assert.equal(h.storage.get('foundation-project-v7'),normal);
  h.el('save').click();assert.equal(h.downloads.length,0);
  h.input('signW',5000);assert.ok(h.api.flush());const corrected=h.storage.get('foundation-project-v7');assert.notEqual(corrected,normal);
  h.price('rebar','');h.input('L',3600);h.input('project-name','단가 확인 중');h.emitWindow('beforeunload');
  assert.equal(h.api.flush(),null);assert.equal(h.api.hasRateErrors(),true);assert.equal(h.storage.get('foundation-project-v7'),corrected);
  h.el('save').click();assert.equal(h.downloads.length,0);h.api.setNotes({groundKnown:false});assert.equal(h.storage.get('foundation-project-v7'),corrected);
  h.price('rebar',1500);assert.ok(h.api.flush());assert.equal(h.api.getResult().g.L,3600);assert.equal(JSON.parse(h.storage.get('foundation-project-v7')).project.name,'단가 확인 중');
});

test('V7 autosave uses its own key, imports a V4 save once and never writes the V4 key',()=>{
  const legacy=harness();legacy.input('project-name','V4 현장');legacy.runTimers(180);
  const v4=legacy.storage.get('foundation-project-v7').replace('V4 현장','V4에서 저장한 현장');
  const h=harness(false,{savedStorage:[['foundation-project-v4',v4]]});
  assert.equal(h.api.snapshot().project.name,'V4에서 저장한 현장');assert.equal(h.storage.get('foundation-project-v4'),v4);
  assert.ok(h.storage.get('foundation-project-v7'));h.input('project-name','V7 현장');h.runTimers(180);
  assert.equal(h.storage.get('foundation-project-v4'),v4,'the V4 screen keeps its own autosave');
  const again=harness(false,{savedStorage:[...h.storage,['foundation-project-v4',v4.replace('V4에서 저장한 현장','V4 나중 수정')]]});
  assert.equal(again.api.snapshot().project.name,'V7 현장','a later V4 edit cannot replace V7 work');
});

test('switching or cloning a foundation commits pending fields to the correct item',()=>{
  const h=harness();h.change('mode','manual');h.el('item-add').click();
  h.input('L',3500);h.input('item-name','두 번째 기초');h.change('item-select',0);
  let items=h.api.snapshot().project.items;assert.equal(items[1].name,'두 번째 기초');assert.equal(items[1].p.L,3500);assert.notEqual(items[0].p.L,3500);
  h.input('L',3900);h.input('item-name','첫 번째 기초');h.el('item-add').click();items=h.api.snapshot().project.items;
  assert.equal(items[0].name,'첫 번째 기초');assert.equal(items[0].p.L,3900);assert.equal(items[2].p.L,3900);
});

test('unchanged flush and project-name synchronization do not emit recursive autosave events',()=>{
  const h=harness(),before=h.calculatorChanges();assert.ok(h.api.flush());assert.ok(h.api.flush());assert.equal(h.calculatorChanges(),before);
  h.api.setProjectName('  공통 현장  ');assert.equal(h.el('project-name').value,'공통 현장');assert.equal(h.api.snapshot().project.name,'공통 현장');assert.match(h.el('project-total').textContent,/공통 현장/);
  const changed=h.calculatorChanges();h.api.setProjectName('공통 현장');h.api.flush();assert.equal(h.calculatorChanges(),changed);
  assert.equal(JSON.parse(h.storage.get('foundation-project-v7')).project.name,'공통 현장');
  h.input('signW','');assert.equal(h.api.flush(),null);const invalid=h.calculatorChanges();
  assert.equal(h.api.flush(),null);assert.equal(h.api.flush(),null);assert.equal(h.calculatorChanges(),invalid);
});

test('foundation item identities survive reload, rename and legacy import without duplicates',()=>{
  const h=harness(),first=h.api.snapshot().project.items[0].id;assert.match(first,/^[A-Za-z0-9_-]+$/);h.el('item-add').click();
  h.input('item-name','다른 이름');h.api.flush();let raw=JSON.parse(JSON.stringify(h.api.snapshot())),ids=raw.project.items.map(item=>item.id);
  assert.equal(new Set(ids).size,2);assert.equal(ids[0],first);const fresh=h.reload();assert.deepEqual(Array.from(fresh.api.snapshot().project.items,item=>item.id),ids);
  raw.project.items[1].id=raw.project.items[0].id;fresh.api.loadProject(raw);ids=Array.from(fresh.api.snapshot().project.items,item=>item.id);assert.equal(new Set(ids).size,2);assert.equal(ids[0],first);
  for(const item of raw.project.items)delete item.id;fresh.api.loadProject(raw);ids=Array.from(fresh.api.snapshot().project.items,item=>item.id);assert.equal(new Set(ids).size,2);assert.ok(ids.every(Boolean));
  fresh.el('item-delete').click();assert.equal(fresh.api.snapshot().project.items[0].id,ids[0]);
});

test('simple workflow begins with location, then dimensions, then a plain language result',()=>{
  const h=harness(true);assert.equal(h.ux.getStep(),1);assert.equal(h.el('location-step').hidden,false);assert.equal(h.el('size-step').hidden,true);assert.equal(h.el('outputs').hidden,true);
  h.el('location-next').click();assert.equal(h.ux.getStep(),1);assert.equal(h.el('location-error').hidden,false);
  h.change('windPoint','busan');h.el('location-next').click();assert.equal(h.ux.getStep(),2);assert.equal(h.el('location-step').hidden,true);assert.equal(h.el('width-m').value,'4');assert.equal(h.el('height-m').value,'2');
  h.change('width-m',6);h.change('height-m',3);assert.equal(h.api.read().signW,6000);assert.equal(h.api.read().signH,3000);
  h.el('calculate-simple').click();assert.equal(h.ux.getStep(),3);assert.equal(h.el('outputs').hidden,false);assert.match(h.el('overview').innerHTML,/지반 확인 전/);assert.match(h.el('overview').innerHTML,/콘크리트 주문량/);assert.match(h.el('overview').innerHTML,/철근 주문량/);assert.match(h.el('overview').innerHTML,/예시 단가의 예상 금액/);
  h.el('edit-size').click();assert.equal(h.ux.getStep(),2);h.el('size-back').click();assert.equal(h.ux.getStep(),1);
});

test('explicit example flow stays marked as preliminary and does not assign site values',()=>{
  const h=harness();const before=h.api.read();h.el('example-site').click();assert.equal(h.ux.getStep(),2);h.el('calculate-simple').click();assert.equal(h.ux.getStep(),3);
  assert.equal(h.api.read().qa,before.qa);assert.equal(h.api.read().mu,before.mu);assert.equal(h.api.read().windPoint,'');assert.equal(h.api.read().pressure,before.pressure);
  assert.match(h.el('overview').innerHTML,/風|풍하중 미확인/);assert.equal(h.el('ground-values').hidden,true);
  h.el('csv').click();const csv=h.downloads[0].content;assert.match(csv,/미확인 입력값으로 예비 계산/);assert.match(csv,/미확인 또는 예시값/);
});

test('meter inputs reject empty or out of range dimensions and cannot show a stale result',()=>{
  const h=harness();h.el('example-site').click();h.change('width-m','');assert.equal(h.api.getResult(),null);assert.equal(h.el('calculate-simple').disabled,true);assert.match(h.el('error').textContent,/0\.1~50m/);
  h.el('calculate-simple').click();assert.equal(h.ux.getStep(),2);assert.equal(h.el('outputs').hidden,true);
  h.change('width-m',0.05);assert.equal(h.api.getResult(),null);h.change('width-m',4.125);assert.equal(h.api.read().signW,4125);h.change('height-m',31);assert.equal(h.api.getResult(),null);assert.match(h.el('error').textContent,/0\.1~30m/);
  h.change('height-m',2);h.el('calculate-simple').click();assert.equal(h.ux.getStep(),3);assert.equal(h.api.getResult().p.signW,4125);
});

test('ground status persists per item and unknown status survives older project imports',()=>{
  const h=harness();h.api.selectPoint('seoul');h.change('ground-status','provided');h.change('qa',222);h.change('mu',0.35);assert.equal(h.el('ground-values').hidden,false);assert.equal(h.api.getNotes().groundKnown,true);
  h.el('item-add').click();h.change('ground-status','unknown');assert.equal(h.api.getNotes().groundKnown,false);h.change('item-select',0);assert.equal(h.api.getNotes().groundKnown,true);assert.equal(h.el('qa').value,'222');
  const saved=JSON.parse(JSON.stringify(h.api.snapshot()));const fresh=harness(true);fresh.api.loadProject(saved);assert.equal(fresh.api.getNotes().groundKnown,true);assert.equal(fresh.el('ground-values').hidden,false);
  for(const item of saved.project.items)delete item.ui;fresh.api.loadProject(saved);assert.equal(fresh.api.getNotes().groundKnown,false);assert.equal(fresh.api.read().qa,222);assert.match(fresh.el('overview').innerHTML,/지반 확인 전/);
});

test('direct wind confirmation and changed modes remain explicit in the simplified flow',()=>{
  const h=harness();h.el('use-current-wind').click();assert.equal(h.ux.getStep(),2);assert.equal(h.api.getNotes().windManual,true);h.el('calculate-simple').click();assert.equal(h.ux.getStep(),3);
  h.change('pressure',2);assert.equal(h.api.getNotes().windManual,false);assert.equal(h.ux.getStep(),1);h.el('use-current-wind').click();h.el('calculate-simple').click();assert.equal(h.ux.getStep(),3);
  h.price('rebar','');assert.match(h.el('overview').innerHTML,/단가 확인 필요/);assert.equal(h.el('print').disabled,true);
});

test('printing opens all reinforcement diagrams temporarily and restores their collapsed state',()=>{
  const h=harness();const details=h.el('reinforcement-drawings');details.open=false;h.el('print').click();assert.equal(h.printed(),true);assert.equal(details.open,false);assert.match(h.el('print-context').textContent,/미확인/);
  assert.equal((h.el('drawings').innerHTML.match(/<svg /g)||[]).length,5);assert.match(h.el('drawings').innerHTML,/철근 배근도 4장 펼쳐보기/);
});

test('simple results keep search failures and unsupported foundation types prominent',()=>{
  const h=harness();h.el('example-site').click();h.change('autoMax',2000);h.el('calculate-simple').click();assert.equal(h.api.getResult().search.found,false);
  assert.match(h.el('overview').innerHTML,/자동 후보를 찾지 못했습니다/);assert.match(h.el('overview').innerHTML,/자동 후보 없음 · 입력되어 있던 크기/);assert.match(h.el('overview').innerHTML,/foundation-size unresolved/);
  h.change('type','block');assert.match(h.el('overview').innerHTML,/자재량 계산 결과 · 구조 검토 필요/);assert.match(h.el('overview').innerHTML,/미충족·미검토/);
});

test('input mode selection opens detailed fields and preserves all calculation values',()=>{
  const h=harness();h.api.selectPoint('seoul');h.el('location-next').click();h.change('width-m',5.25);h.change('height-m',2.5);h.change('qty',2);
  const before=JSON.stringify(h.api.read());const result=h.api.getResult();
  h.el('input-detailed').click();assert.equal(h.ux.getInputMode(),'detailed');assert.equal(h.el('input-detailed').getAttribute('aria-pressed'),'true');
  assert.equal(h.el('wizard-nav').hidden,true);assert.equal(h.el('detail-nav').hidden,false);assert.equal(h.el('location-step').hidden,false);assert.equal(h.el('size-step').hidden,false);
  for(const id of ['wind-settings','product-settings','advanced-settings','dimension-details','rebar-settings','design-settings','site-settings','quantity-settings','accessory-settings'])assert.equal(h.el(id).open,true);
  assert.equal(JSON.stringify(h.api.read()),before);assert.equal(h.api.getResult(),result);
  h.el('input-simple').click();assert.equal(h.ux.getInputMode(),'simple');assert.equal(h.el('wizard-nav').hidden,false);assert.equal(h.el('detail-nav').hidden,true);assert.equal(h.el('detail-shortcuts').hidden,true);
  assert.equal(h.el('advanced-settings').open,false);assert.equal(h.el('wind-settings').open,false);assert.equal(JSON.stringify(h.api.read()),before);assert.equal(h.el('width-m').value,'5.25');
});

test('detailed manual geometry and reinforcement update quantities and diagrams',()=>{
  const h=harness();h.el('input-detailed').click();assert.equal(h.el('L').disabled,true);assert.equal(h.el('bar').disabled,true);
  h.change('mode','manual');h.change('L',4200);h.change('W',3600);h.change('H',900);
  h.change('rebarMode','manual');h.change('bar','22');h.change('spacing',175);h.change('neckBar','22');h.change('neckNX',4);h.change('neckNY',4);
  assert.equal(h.el('L').disabled,false);assert.equal(h.el('bar').disabled,false);
  const r=h.api.getResult(),expected=E.calculate(h.api.read());assert.ok(r);assert.equal(r.g.L,4200);assert.equal(r.g.W,3600);assert.equal(r.g.H,900);
  assert.equal(r.r.code,22);assert.equal(r.r.s,175);assert.equal(r.total.rebarGross,expected.total.rebarGross);assert.match(h.el('drawings').innerHTML,/4200/);assert.match(h.el('rebar-table').innerHTML,/D22/);
  const before=JSON.stringify(h.api.read());h.el('input-simple').click();h.el('input-detailed').click();assert.equal(JSON.stringify(h.api.read()),before);assert.equal(h.el('mode').value,'manual');assert.equal(h.el('spacing').value,'175');
});

test('detailed editing is available before wind selection while results require explicit wind choice',()=>{
  const h=harness();h.el('input-detailed').click();assert.equal(h.ux.getStep(),2);assert.equal(h.el('location-step').hidden,false);assert.equal(h.el('size-step').hidden,false);
  h.change('pressure',2);assert.equal(h.ux.getStep(),2);h.el('detail-result').click();assert.equal(h.el('location-error').hidden,false);assert.equal(h.el('outputs').hidden,true);
  h.el('use-current-wind').click();h.el('detail-result').click();assert.equal(h.ux.getStep(),3);assert.equal(h.el('outputs').hidden,false);assert.equal(h.el('detail-input').getAttribute('aria-pressed'),'false');
  h.el('edit-size').click();h.change('pressure',2.2);assert.equal(h.api.getNotes().windManual,false);assert.equal(h.el('size-step').hidden,false);h.el('calculate-simple').click();assert.equal(h.el('outputs').hidden,true);
  h.el('use-current-wind').click();h.change('width-m','');assert.equal(h.el('detail-result').disabled,true);assert.equal(h.el('calculate-simple').disabled,true);h.el('detail-result').click();assert.equal(h.el('outputs').hidden,true);
  h.change('width-m',4);h.el('detail-result').click();assert.equal(h.ux.getStep(),3);h.el('input-simple').click();assert.equal(h.ux.getStep(),3);assert.equal(h.el('outputs').hidden,false);
});

test('detailed input preference survives project save, item selection and reset with legacy defaults',()=>{
  const h=harness(true);h.el('input-detailed').click();h.api.selectPoint('busan');h.change('mode','manual');h.change('L',4300);h.el('item-add').click();h.el('input-simple').click();
  const saved=JSON.parse(JSON.stringify(h.api.snapshot()));assert.equal(saved.project.items[0].ui.inputMode,'detailed');assert.equal(saved.project.items[1].ui.inputMode,'simple');
  const fresh=harness(true);fresh.api.loadProject(saved);assert.equal(fresh.ux.getInputMode(),'simple');fresh.change('item-select',0);assert.equal(fresh.ux.getInputMode(),'detailed');assert.equal(fresh.el('L').value,'4300');
  fresh.el('reset').click();assert.equal(fresh.ux.getInputMode(),'detailed');assert.equal(fresh.el('size-step').hidden,false);assert.equal(fresh.el('wind-settings').open,true);
  delete saved.project.items[0].ui.inputMode;saved.project.items[1].ui.inputMode='unrecognised';saved.project.active=0;fresh.api.loadProject(saved);assert.equal(fresh.ux.getInputMode(),'simple');assert.equal(fresh.api.read().L,4300);
  assert.equal(fresh.api.snapshot().project.items[1].ui.inputMode,'simple');
});

test('detailed shortcuts reopen the chosen input group without replacing entered data',()=>{
  const h=harness();h.el('input-detailed').click();h.api.selectPoint('seoul');h.change('cover',80);h.el('detail-result').click();
  h.el('advanced-settings').open=false;h.el('rebar-settings').open=false;h.el('jump-rebar').click();assert.equal(h.ux.getStep(),2);assert.equal(h.el('advanced-settings').open,true);assert.equal(h.el('rebar-settings').open,true);assert.equal(h.api.read().cover,80);
  h.el('quantity-settings').open=false;h.el('jump-quantity').click();assert.equal(h.el('quantity-settings').open,true);
  h.el('dimension-details').open=false;h.api.recalc();assert.equal(h.el('dimension-details').open,false);h.el('jump-foundation').click();assert.equal(h.el('dimension-details').open,true);
});

test('one board gains matching columns and foundations when the quantity changes',()=>{
  const h=harness();h.api.selectPoint('seoul');h.change('width-m',6);const size={...h.api.getResult().g};
  for(const qty of [2,3,32]){
    h.change('qty',qty);const r=h.api.getResult();assert.ok(r);assert.equal(r.supports.boards,1);assert.equal(r.total.posts,qty);assert.equal(h.el('mode').value,'manual');assert.equal(h.el('mode').options[0].disabled,true);
    assert.equal(r.g.L,size.L);assert.equal(r.g.W,size.W);assert.equal(r.g.H,size.H);
    assert.equal((h.el('drawings').innerHTML.match(/data-foundation="/g)||[]).length,qty);assert.equal((h.el('drawings').innerHTML.match(/data-column="/g)||[]).length,qty);assert.equal((h.el('drawings').innerHTML.match(/data-board="/g)||[]).length,1);
    assert.equal((h.el('guide-columns').innerHTML.match(/data-guide-column="/g)||[]).length,qty);assert.match(h.el('support-counts').textContent,new RegExp(`전광판 1대 · 기초 ${qty}개 · 기둥 ${qty}본`));
    assert.match(h.el('overview').innerHTML,/하중 분배 미검토/);assert.match(h.el('checks').innerHTML,/미검토/);
  }
  h.change('qty',3);h.change('foundationSpacing',1000);assert.match(h.el('overview').innerHTML,/기초가 겹칩니다/);
  h.el('edit-multi-foundation').click();assert.equal(h.el('advanced-settings').open,true);assert.equal(h.el('dimension-details').open,true);assert.equal(h.el('L').disabled,false);
  h.change('qty',33);assert.equal(h.api.getResult(),null);assert.equal(h.el('csv').disabled,true);
});

test('shared support layout, counts and unreviewed status survive standalone JSON, CSV and SVG exports',()=>{
  const h=harness(true);h.api.selectPoint('busan');h.change('qty',3);h.change('foundationSpacing',4500);h.el('save').click();h.el('csv').click();h.el('drawing-svg').click();
  const saved=JSON.parse(h.downloads.find(x=>x.name.endsWith('.json')).content),fresh=harness(true);fresh.api.loadProject(saved);assert.equal(fresh.api.read().installMode,'shared');assert.equal(fresh.api.read().foundationSpacing,4500);assert.equal(fresh.api.getResult().total.posts,3);
  const csv=h.downloads.find(x=>x.name.endsWith('.csv')).content;assert.match(csv,/"전광판 전체 수량","1","대"/);assert.match(csv,/"기둥 전체 수량","3","본"/);assert.match(csv,/"전도 안전율 \(두 축 합산\)","","","미검토"/);
  const svg=h.downloads.find(x=>x.name.endsWith('.svg')).content;assert.match(svg,/전광판 1대 \/ 기초 3개 \/ 기둥 3본/);assert.equal((svg.match(/data-column="/g)||[]).length,3);assert.match(svg,/부산 기준/);assert.match(svg,/기초별 반력 분배/);
  assert.match(fresh.el('print-context').textContent,/반력 분배 미검토/);
  for(const item of saved.project.items){delete item.p.installMode;delete item.p.foundationSpacing;item.p.mode='auto';}
  fresh.api.loadProject(saved);assert.equal(fresh.api.read().installMode,'repeat');assert.equal(fresh.api.getResult().supports.boards,3);assert.equal(fresh.api.getResult().total.posts,3);assert.equal(fresh.api.getResult().search.found,true);
});

test('repeated installations, two-post templates and undefined supports remain distinct',()=>{
  const h=harness();h.change('installMode','repeat');h.change('qty',3);assert.equal(h.api.getResult().supports.boards,3);assert.equal(h.api.getResult().total.posts,3);assert.equal(h.el('mode').value,'auto');
  assert.equal((h.el('drawings').innerHTML.match(/data-column="/g)||[]).length,1);assert.match(h.el('drawings').innerHTML,/도면은 기초 1개 기준/);
  h.change('type','combined');assert.equal(h.api.getResult().total.posts,6);assert.match(h.el('support-counts').textContent,/기둥 6본/);assert.equal((h.el('drawings').innerHTML.match(/data-column="/g)||[]).length,2);
  h.change('type','mat');assert.equal(h.api.getResult().total.posts,null);assert.match(h.el('support-counts').textContent,/수량 미지정/);assert.match(h.el('project-total').textContent,/미지정 항목/);
});

test('rapid animated navigation remains immediate and preserves entered dimensions and results',()=>{
  const h=harness(true,{motion:true});h.change('mode','manual');h.change('H',1900);h.el('example-site').click();h.el('calculate-simple').click();
  const values=JSON.stringify(h.api.read()),quantities=JSON.stringify(h.api.getResult().total);
  for(let i=0;i<4;i++){
    h.el('edit-size').click();h.el('size-back').click();h.el('example-site').click();h.el('calculate-simple').click();
    h.el('input-detailed').click();h.el('input-simple').click();
    h.el('tab-cost').click();h.el('tab-boq').click();h.el('tab-drawing').click();
  }
  assert.equal(h.ux.getStep(),3);assert.equal(h.el('outputs').hidden,false);assert.equal(h.el('size-step').hidden,true);
  assert.equal(h.el('view-drawing').hidden,false);assert.equal(h.el('view-cost').hidden,true);assert.equal(h.el('view-boq').hidden,true);
  assert.equal(JSON.stringify(h.api.read()),values);assert.equal(JSON.stringify(h.api.getResult().total),quantities);
  assert.ok(h.motionCalls.some(animation=>animation.cancelled));
  assert.ok(h.motionCalls.some(animation=>animation.frames[0].transform.includes('-18px')));
  h.el('print').click();assert.equal(h.printed(),true);assert.ok(h.motionCalls.every(animation=>animation.cancelled));
});

test('reduced motion keeps navigation usable, skips smooth scrolling and stops running effects',()=>{
  const h=harness(true,{motion:true,reduced:true});h.el('example-site').click();h.el('calculate-simple').click();h.el('input-detailed').click();h.el('jump-foundation').click();
  assert.equal(h.ux.getStep(),2);assert.equal(h.el('dimension-details').open,true);assert.equal(h.motionCalls.length,0);
  assert.equal(h.scrollCalls.at(-1).options.behavior,'auto');
  const values=JSON.stringify(h.api.read());h.setReduced(false);h.el('detail-result').click();assert.equal(h.ux.getStep(),3);assert.ok(h.motionCalls.length>0);
  h.setReduced(true);assert.ok(h.motionCalls.every(animation=>animation.cancelled));assert.equal(h.el('outputs').hidden,false);assert.equal(JSON.stringify(h.api.read()),values);
  const count=h.motionCalls.length;h.el('tab-boq').click();assert.equal(h.el('view-boq').hidden,false);assert.equal(h.motionCalls.length,count);
});

test('impossible anchor and two-post heights block stale exports and recover after correction',()=>{
  const h=harness(true);h.change('plateL',200);h.change('plateW',200);h.change('anchorEdge',50);h.change('anchorCount',32);
  assert.equal(h.api.getResult(),null);assert.match(h.el('error').textContent,/앵커 볼트끼리/);
  for(const id of ['csv','drawing','print','save'])assert.equal(h.el(id).disabled,true);
  h.el('csv').click();h.el('drawing').click();assert.equal(h.downloads.length,0);
  h.change('plateL',500);h.change('plateW',500);assert.ok(h.api.getResult());assert.equal(h.el('csv').disabled,false);
  h.change('type','combined');h.change('bottom',.1);assert.equal(h.api.getResult(),null);assert.match(h.el('error').textContent,/목 상단/);
  h.change('bottom',3);assert.ok(h.api.getResult());assert.equal(h.el('drawing').disabled,false);
  const before=JSON.stringify(h.api.snapshot()),bad=JSON.parse(before);bad.project.items[0].p.bottom=.1;
  assert.throws(()=>h.api.loadProject(bad),/목 상단/);assert.equal(JSON.stringify(h.api.snapshot()),before);
});

test('shape choices expose the appropriate dimensions and retain the existing default calculation',()=>{
  const h=harness(true),before=h.api.getResult();assert.equal(h.api.read().columnShape,'schematic');assert.equal(h.api.read().plateShape,'rect');
  assert.equal(h.fieldHidden('columnDiameter'),true);assert.equal(h.fieldHidden('plateDiameter'),true);assert.equal(h.fieldHidden('plateL'),false);
  h.el('input-detailed').click();assert.equal(h.el('connection-settings').open,true);h.el('connection-settings').open=false;h.el('jump-connection').click();assert.equal(h.el('connection-settings').open,true);
  h.change('columnShape','circle');h.change('plateShape','circle');h.change('anchorCount',6);h.change('anchorAngle',30);
  const r=h.api.getResult();assert.ok(r);assert.equal(h.fieldHidden('columnDiameter'),false);assert.equal(h.fieldHidden('columnWidth'),true);assert.equal(h.fieldHidden('plateL'),true);assert.equal(h.fieldHidden('plateDiameter'),false);
  assert.equal(h.el('anchorCount').getAttribute('step'),'1');assert.match(h.el('connection-summary').textContent,/원형 Ø300.*원형 Ø500.*Ø350.*6조/);
  assert.equal(r.total.concrete,before.total.concrete);assert.equal(r.total.rebarGross,before.total.rebarGross);assert.equal(r.l.front,before.l.front);
  const drawing=r.drawingParts.at(-1)[1],scale=230/800;
  assert.match(drawing,new RegExp(`data-plate-shape="circle"[^>]*r="${250*scale}"`));assert.match(drawing,new RegExp(`data-column-shape="circle"[^>]*r="${150*scale}"`));
  assert.equal((drawing.match(/data-anchor="1"/g)||[]).length,6);
  const first=[...drawing.matchAll(/<circle data-anchor="1" cx="([^"]+)" cy="([^"]+)"/g)][0];
  assert.ok(Math.abs(Number(first[1])-(215+175*Math.cos(Math.PI/6)*scale))<1e-9);assert.ok(Math.abs(Number(first[2])-(181-175*Math.sin(Math.PI/6)*scale))<1e-9);
  h.el('reset').click();assert.equal(h.api.read().columnShape,'schematic');assert.equal(h.api.read().plateShape,'rect');assert.equal(h.api.getResult().estimate.total,before.estimate.total);
});

test('round profiles and bolt circle geometry survive offline DXF, SVG, XLSX, CSV and project exports',()=>{
  const h=harness(true);h.change('columnShape','circle');h.change('plateShape','circle');h.change('anchorCount',6);h.change('anchorAngle',30);
  for(const id of ['drawing','drawing-svg','xlsx','csv','save'])h.el(id).click();assert.equal(h.downloads.length,5);
  const entities=dxfRecords(h.downloads.find(d=>d.name.endsWith('.dxf')).content,'ENTITIES');
  const plate=entities.find(e=>e.type==='CIRCLE'&&dxfTag(e,8)==='FND_PLATE');assert.ok(plate);assert.equal(Number(dxfTag(plate,40)),250);
  const ring=entities.find(e=>e.type==='CIRCLE'&&dxfTag(e,8)==='FND_BOLT_CIRCLE');assert.equal(Number(dxfTag(ring,40)),175);
  const columns=entities.filter(e=>e.type==='CIRCLE'&&dxfTag(e,8)==='FND_COLUMN');assert.equal(columns.length,3);assert.ok(columns.every(e=>Number(dxfTag(e,40))===150));
  const anchors=entities.filter(e=>e.type==='CIRCLE'&&dxfTag(e,8)==='FND_ANCHOR');assert.equal(anchors.length,6);
  anchors.forEach((e,i)=>{assert.ok(Math.abs(Number(dxfTag(e,10))-Number(dxfTag(plate,10))-175*Math.cos((30+60*i)*Math.PI/180))<1e-7);assert.ok(Math.abs(Number(dxfTag(e,20))-Number(dxfTag(plate,20))-175*Math.sin((30+60*i)*Math.PI/180))<1e-7);});
  const elevation=entities.find(e=>e.type==='LWPOLYLINE'&&dxfTag(e,8)==='FND_COLUMN');const xs=elevation.tags.filter(t=>t[0]===10).map(t=>Number(t[1]));assert.equal(Math.max(...xs)-Math.min(...xs),300);
  assert.match(h.downloads.find(d=>d.name.endsWith('.svg')).content,/data-plate-shape="circle"/);
  const csv=h.downloads.find(d=>d.name.endsWith('.csv')).content;assert.match(csv,/"강재 기둥 단면","원형 강관"/);assert.match(csv,/"기둥 외경 Ø","300","mm"/);assert.match(csv,/"플레이트 지름 Ø","500","mm"/);assert.match(csv,/πD²\/4/);
  const files=unzipWorkbook(h.downloads.find(d=>d.name.endsWith('.xlsx')).content);assert.match(files.get('xl/worksheets/sheet6.xml'),/원형 플레이트/);assert.match(files.get('xl/worksheets/sheet6.xml'),/기둥外径|기둥 외경/);assert.match(files.get('xl/worksheets/sheet2.xml'),/πD²\/4/);
  const saved=JSON.parse(h.downloads.find(d=>d.name.endsWith('.json')).content),fresh=harness(true);fresh.api.loadProject(saved);assert.equal(fresh.api.read().columnDiameter,300);assert.equal(fresh.api.read().plateShape,'circle');assert.equal(fresh.api.read().anchorAngle,30);assert.equal(fresh.api.getResult().estimate.a.anchors,6);
  for(const key of ['columnShape','columnDiameter','columnWidth','columnDepth','plateShape','plateDiameter','anchorAngle'])delete saved.project.items[0].p[key];saved.project.items[0].p.anchorCount=8;fresh.api.loadProject(saved);assert.equal(fresh.api.read().columnShape,'schematic');assert.equal(fresh.api.read().plateShape,'rect');assert.ok(fresh.api.getResult());
});

test('column interference blocks exports until the plate or column dimensions are corrected',()=>{
  const h=harness(true);h.change('columnShape','circle');h.change('plateShape','circle');h.change('columnDiameter',400);
  assert.equal(h.api.getResult(),null);assert.match(h.el('error').textContent,/기둥 단면과 겹칩니다/);for(const id of ['drawing','drawing-svg','xlsx','csv','save','print'])assert.equal(h.el(id).disabled,true);
  for(const id of ['drawing','drawing-svg','xlsx','csv','save'])h.el(id).click();assert.equal(h.downloads.length,0);
  h.change('plateDiameter',600);assert.ok(h.api.getResult());assert.equal(h.el('drawing').disabled,false);assert.match(h.el('connection-summary').textContent,/Ø450/);
  h.change('plateShape','rect');h.change('columnShape','rect');assert.equal(h.fieldHidden('columnWidth'),false);assert.equal(h.fieldHidden('columnDiameter'),true);assert.equal(h.el('anchorCount').getAttribute('step'),'4');assert.ok(h.api.getResult());
});

test('steel post and anchor inputs appear with their section and feed the review table',()=>{
  const h=harness(true);
  for(const key of ['columnThickness','columnFlange','columnFy'])assert.equal(h.fieldHidden(key),true);assert.equal(h.fieldHidden('anchorEmbed'),false);
  h.change('columnShape','h');for(const key of ['columnWidth','columnDepth','columnThickness','columnFlange','columnFy'])assert.equal(h.fieldHidden(key),false);
  h.change('columnWidth',200);h.change('columnDepth',200);h.change('columnThickness',8);h.change('columnFlange',12);h.change('anchorEmbed',600);
  const r=h.api.getResult();assert.equal(r.p.columnShape,'h');assert.match(h.el('connection-summary').textContent,/H 200×200×8×12/);
  assert.ok(r.checks.some(c=>c.group==='steel'&&c.label.startsWith('지주 휨')&&c.pass!==null));assert.match(h.el('checks').innerHTML,/앵커 콘크리트 콘 파괴/);
  h.change('anchorCount',0);for(const key of ['anchorEmbed','anchorHead','anchorFy','anchorFu'])assert.equal(h.fieldHidden(key),true);
});
