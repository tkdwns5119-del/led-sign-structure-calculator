// Reference document for a structural-calculation request: office summary first, engineering appendix after.
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../dist/foundation/engine.js');
const C=require('../dist/foundation/estimate.js');
const R=require('../dist/foundation/report.js');
const P=require('../dist/planner.js');

function report(raw,ctx={}){const r=E.calculate(raw);r.estimate=C.calculate(r,C.defaultPrices);return {r,html:R.build(r,{projectName:'시험 현장',itemName:'동측',notes:{},...ctx})};}
const body=html=>html.replace(/<style>[\s\S]*?<\/style>/g,'');

test('the reference has an office summary, a request checklist, a glossary and an engineering appendix',()=>{
  const frame=P.createProject(),{html}=report({columnShape:'circle',columnDiameter:318.5,columnThickness:6.9,anchorEmbed:600,plateThickness:25,qty:2,mode:'manual'},{frame:{project:frame,result:P.calculate(frame)}});
  const text=body(html);
  assert.ok(!/NaN|undefined|\[object/.test(text));
  assert.match(text,/<title>시험 현장 · 구조계산 의뢰 전 사전 검토 자료<\/title>/);
  assert.ok(!/예비 구조계산서/.test(text),'never presented as a calculation document');
  assert.match(text,/확정 구조계산서가 아니며/);
  for(const heading of ['1부 · 사무용 요약','한눈에 보기','구조계산 의뢰 시 함께 보낼 것','용어 풀이','2부 · 설계자용 상세 (부록)','풍하중 산정','지주 반력 분배','기초 안정 검토','별도 검토 항목','구조물(프레임) 산출 요약'])assert.ok(text.includes(heading),heading);
  assert.ok(text.indexOf('1부 · 사무용 요약')<text.indexOf('2부 · 설계자용 상세'));
  assert.equal((text.match(/class="plain-card /g)||[]).length,4);
});

test('rows failing on a precondition explain why, and unjudged out-of-scope rows move to separate review',()=>{
  // Partial uplift fails the flexure rows although their strength ratio is far below 1.
  const {r,html}=report({mode:'manual',L:1200,W:1200,H:600,pressure:3});
  assert.ok(r.checks.some(c=>c.label==='푸팅 X방향 휨'&&c.pass===false));
  assert.match(html,/적용 전제\(전면 접지 등\)를 충족하지 못해 미충족/);
  const outside=r.checks.find(c=>c.status==='적용 범위 밖'&&c.pass===null);
  if(outside){const separate=html.slice(html.indexOf('별도 검토 항목'));assert.ok(separate.includes(outside.label));}
});
