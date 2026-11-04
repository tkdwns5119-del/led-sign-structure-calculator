const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../dist/suite-engine.js'),E=require('../dist/foundation/engine.js'),C=require('../dist/foundation/estimate.js'),P=require('../dist/planner.js');
test('all valid foundation IDs keep counts without using object prototype properties',()=>{
  const f={project:{items:[{id:'__proto__',name:'기초 A',p:{...E.defaults}},{id:'constructor',name:'기초 B',p:{...E.defaults}}]},prices:C.defaultPrices};
  const defaults=S.cleanCounts({},f);assert.equal(defaults.__proto__,1);assert.equal(defaults.constructor,1);
  const counts=S.cleanCounts(JSON.parse('{"__proto__":3,"constructor":2}'),f),total=S.aggregate(f,E,C,counts);
  assert.equal(total.foundations,5);assert.equal(S.aggregate(f,E,C,{}).foundations,2);assert.equal({}.polluted,undefined);
});
test('a valid 120-character foundation identity survives an integrated round trip',()=>{
  const frame=P.createProject(),patch=S.transfer(P.calculate(frame),E.limits),itemId='f'.repeat(120);
  const f={project:{active:0,items:[{id:itemId,p:{...E.defaults,...patch}}]}};
  const raw={format:'led-integrated-project',version:1,frame,foundation:f,link:{source:S.fingerprint(frame,patch),active:0,itemId}};
  const clean=S.validate(raw,{validateProject:P.migrate},{validateProject:S.clone});
  assert.equal(clean.link.itemId,itemId);assert.equal(S.isLinked(clean.link,clean.frame,patch,clean.foundation),true);
});
