// Plain-language layer: every engine check has office-staff wording, lights follow the thresholds,
// and the summary lists unconfirmed inputs and what to hand over with a calculation request.
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../dist/foundation/engine.js');
const L=require('../dist/foundation/plain.js');

const steel={columnShape:'circle',columnDiameter:318.5,columnThickness:6.9,anchorEmbed:600,plateThickness:25};
const cases=[{},{...steel},{...steel,qty:2,mode:'manual'},{type:'combined',mode:'manual',...E.types.combined,...steel},{type:'block',mode:'manual',...E.types.block},
  {columnShape:'h',columnWidth:200,columnDepth:200,columnThickness:8,columnFlange:12,anchorEmbed:600},{...steel,anchorCount:0},{...steel,plateShape:'circle',plateDiameter:600,anchorCount:6},{mode:'manual',L:1200,W:1200,H:600}];

test('every check label the engine produces has plain wording and a group',()=>{
  for(const raw of cases)for(const row of E.calculate(raw).checks){
    assert.ok(L.ITEMS[row.label],`plain wording missing for "${row.label}"`);
    const it=L.item(row.label);assert.ok(it.name&&it.explain,row.label);
    if(['stability','ground','concrete','steel'].includes(it.group)&&!/입력 필요|앵커 없음/.test(row.status))assert.ok(it.fix,`fix missing for "${row.label}"`);
  }
  for(const terms of Object.values(L.TERMS))for(const t of terms)assert.ok(L.define(t),`glossary missing "${t}"`);
});

test('traffic lights follow the 0.8 and 1.0 limits and inverted safety factors',()=>{
  const row=(label,demand,capacity,pass,status='충족')=>({label,demand,capacity,pass,status});
  assert.equal(L.light(row('지반 지지력 (사용하중)',70,100,true)),'green');
  assert.equal(L.light(row('지반 지지력 (사용하중)',85,100,true)),'yellow');
  assert.equal(L.light(row('지반 지지력 (사용하중)',120,100,false,'미충족')),'red');
  // A safety factor of 3 against a target of 1.5 uses half its limit; 1.6 against 1.5 is tight.
  assert.equal(L.ratio(row('활동 안전율',3,1.5,true)),0.5);assert.equal(L.light(row('활동 안전율',1.6,1.5,true)),'yellow');
  assert.equal(L.light(row('설정 최소 철근량 / 순간격',3010,3000,true)),'green','a minimum met with little excess is not a warning');
  assert.equal(L.light({label:'지주 강재 · 휨·전단·축력',demand:null,capacity:null,pass:null,status:'미검토 · 입력 필요'}),'yellow');
  assert.equal(L.light({label:'목 P–M',demand:null,capacity:null,pass:null,status:'별도 검토'}),'gray');
});

test('the summary groups checks, keeps engineer-only rows apart and flags missing inputs',()=>{
  const r=E.calculate({}),s=L.summarize(r,{});
  assert.deepEqual(s.groups.map(g=>g.id),['stability','ground','concrete','steel']);
  assert.equal(s.groups.find(g=>g.id==='steel').light,'yellow','column inputs missing');
  assert.ok(s.separate.some(x=>x.label==='목 P–M'));assert.ok(!s.groups.some(g=>g.items.some(x=>x.label==='목 P–M')));
  assert.ok(s.unconfirmed.some(x=>x.topic==='땅(지반)')&&s.unconfirmed.some(x=>x.topic==='기둥 규격'));
  assert.notEqual(s.overall,'green','unconfirmed site data keeps the overall light from green');
  // A failing case turns its group red and offers what to try.
  const weak=L.summarize(E.calculate({mode:'manual',L:1200,W:1200,H:600,pressure:3}),{groundKnown:true,windManual:true});
  assert.equal(weak.overall,'red');assert.ok(weak.groups.some(g=>g.light==='red'&&g.fixes.length));
  // Combined footings are not screened: footing groups stay gray.
  const combined=L.summarize(E.calculate({type:'combined',mode:'manual',...E.types.combined,...steel}),{});
  assert.equal(combined.groups.find(g=>g.id==='stability').light,'gray');assert.notEqual(combined.groups.find(g=>g.id==='steel').light,'gray');
  const shared=L.summarize(E.calculate({...steel,qty:2,mode:'manual'}),{});assert.ok(shared.checklist.some(x=>x.includes('기초 2개')));
  const html=L.cardsHTML(s);assert.ok(!/undefined|NaN/.test(html));assert.match(html,/참고용/);assert.match(html,/용어 풀이/);
  assert.equal((html.match(/class="plain-card /g)||[]).length,4);
  const printed=L.cardsHTML(s,{print:true});assert.ok(!printed.includes('plain-disclaimer'));assert.ok(!printed.includes('용어 풀이'));
});
